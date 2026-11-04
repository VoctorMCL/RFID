const crypto = require('crypto');
const db = require('../config/db');

const normalizeUid = (uid) => String(uid || '').trim().replace(/[\s:\-]/g, '').toUpperCase();

const findDuplicateUser = async ({ email, documentId, excludeId }) => {
  const conditions = [];
  const params = [];

  if (email) {
    params.push(email.trim().toLowerCase());
    conditions.push(`LOWER(email) = $${params.length}`);
  }

  if (documentId) {
    params.push(documentId.trim());
    conditions.push(`document_id = $${params.length}`);
  }

  if (conditions.length === 0) return null;

  let whereClause = `(${conditions.join(' OR ')})`;

  if (excludeId) {
    params.push(excludeId);
    whereClause += ` AND id <> $${params.length}`;
  }

  const result = await db.query(
    `SELECT id, email, document_id FROM users WHERE ${whereClause} LIMIT 1`,
    params
  );

  return result.rows[0] || null;
};

const duplicateMessage = (duplicate, email) => {
  const emailTaken = duplicate?.email &&
    duplicate.email.toLowerCase() === String(email || '').trim().toLowerCase();
  return emailTaken
    ? 'Ya existe una persona registrada con ese correo institucional'
    : 'Ya existe una persona registrada con ese documento de identidad';
};

const attachCardToUser = async (userId, rawUid, label) => {
  const uid = normalizeUid(rawUid);
  if (!uid) return null;

  await db.query(
    `UPDATE rfid_cards SET is_active = false WHERE user_id = $1 AND uid <> $2`,
    [userId, uid]
  );

  await db.query(
    `UPDATE visitor_passes
     SET status = 'returned', exit_time = NOW()
     WHERE status = 'active'
       AND card_uid IN (SELECT uid FROM rfid_cards WHERE user_id = $1 AND uid <> $2)`,
    [userId, uid]
  );

  await db.query(
    `UPDATE visitor_passes
     SET status = 'returned', exit_time = NOW()
     WHERE card_uid = $1 AND status = 'active'`,
    [uid]
  );

  const result = await db.query(
    `INSERT INTO rfid_cards (uid, user_id, card_type, is_active, label, enrolled_at)
     VALUES ($1, $2, 'standard', true, $3, NOW())
     ON CONFLICT (uid) DO UPDATE
     SET user_id = $2, card_type = 'standard', is_active = true, label = $3, enrolled_at = NOW()
     RETURNING *`,
    [uid, userId, label]
  );

  return result.rows[0];
};

const detachCardsFromUser = async (userId) => {
  await db.query(
    `UPDATE visitor_passes
     SET status = 'returned', exit_time = NOW()
     WHERE status = 'active'
       AND card_uid IN (SELECT uid FROM rfid_cards WHERE user_id = $1)`,
    [userId]
  );

  await db.query(
    `UPDATE rfid_cards
     SET user_id = NULL, is_active = false
     WHERE user_id = $1 AND is_active = true`,
    [userId]
  );
};

const getUsers = async (req, res) => {
  try {
    const { role_id, status, search } = req.query;

    let queryText = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.document_id, u.program, u.phone, u.status, u.access_expiry, u.created_at,
             r.id as role_id, r.name as role_name, r.display_name as role_display, r.global_access,
             c.uid as rfid_tag, c.id as rfid_card_id
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN rfid_cards c ON c.user_id = u.id AND c.is_active = true
      WHERE 1=1
    `;
    const params = [];

    if (role_id) {
      params.push(parseInt(role_id, 10));
      queryText += ` AND u.role_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      queryText += ` AND u.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      queryText += ` AND (
        LOWER(u.first_name) LIKE $${params.length} OR
        LOWER(u.last_name) LIKE $${params.length} OR
        LOWER(u.email) LIKE $${params.length} OR
        LOWER(u.document_id) LIKE $${params.length} OR
        LOWER(COALESCE(c.uid, '')) LIKE $${params.length}
      )`;
    }

    queryText += ` ORDER BY u.id ASC`;

    const result = await db.query(queryText, params);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    return res.status(500).json({ success: false, error: 'Error al consultar usuarios en PostgreSQL: ' + error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.document_id, u.program, u.phone, u.status, u.access_expiry, u.created_at,
              r.id as role_id, r.name as role_name, r.display_name as role_display, r.global_access
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const cardsResult = await db.query(`SELECT * FROM rfid_cards WHERE user_id = $1`, [id]);

    return res.json({
      success: true,
      data: {
        ...result.rows[0],
        cards: cardsResult.rows
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { first_name, last_name, email, document_id, role_id, program, phone, rfid_tag } = req.body;

    if (!first_name || !last_name || !email || !document_id || !role_id) {
      return res.status(400).json({ success: false, error: 'Todos los campos obligatorios deben ser completados' });
    }

    const duplicate = await findDuplicateUser({ email, documentId: document_id });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: duplicateMessage(duplicate, email)
      });
    }

    const rfidOnlyToken = 'RFID_AUTH_ONLY';

    const insertUser = await db.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, document_id, role_id, program, phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       RETURNING id, first_name, last_name, email, document_id, role_id, program, phone, status`,
      [first_name.trim(), last_name.trim(), email.trim().toLowerCase(), rfidOnlyToken, document_id.trim(), parseInt(role_id, 10), program || null, phone || null]
    );

    const newUser = insertUser.rows[0];

    if (normalizeUid(rfid_tag)) {
      await attachCardToUser(newUser.id, rfid_tag, `Carnet de ${newUser.first_name}`);
    }

    return res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    console.error('Error al crear usuario:', error);

    if (error.code === '23505') {
      const duplicate = await findDuplicateUser({ email, documentId: document_id });

      return res.status(409).json({
        success: false,
        error: duplicate
          ? duplicateMessage(duplicate, email)
          : 'Ya existe una persona registrada con ese correo o documento'
      });
    }

    return res.status(500).json({ success: false, error: 'Error al registrar usuario: ' + error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { first_name, last_name, email, document_id, role_id, program, phone, status, rfid_tag } = req.body;

    const duplicate = await findDuplicateUser({ email, documentId: document_id, excludeId: id });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: duplicateMessage(duplicate, email)
      });
    }

    const result = await db.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           email = COALESCE($3, email),
           document_id = COALESCE($4, document_id),
           role_id = COALESCE($5, role_id),
           program = COALESCE($6, program),
           phone = COALESCE($7, phone),
           status = COALESCE($8, status),
           updated_at = NOW()
       WHERE id = $9
       RETURNING id, first_name, last_name, email, document_id, role_id, program, phone, status`,
      [first_name, last_name, email ? email.toLowerCase() : null, document_id, role_id ? parseInt(role_id, 10) : null, program, phone, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    if (rfid_tag !== undefined) {
      if (normalizeUid(rfid_tag)) {
        await attachCardToUser(id, rfid_tag, `Carnet de ${result.rows[0].first_name}`);
      } else {
        await detachCardsFromUser(id);
      }
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      const duplicate = await findDuplicateUser({
        email: req.body.email,
        documentId: req.body.document_id,
        excludeId: parseInt(req.params.id, 10)
      });

      return res.status(409).json({
        success: false,
        error: duplicate
          ? duplicateMessage(duplicate, req.body.email)
          : 'Ya existe una persona registrada con ese correo o documento'
      });
    }

    return res.status(500).json({ success: false, error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    return res.json({ success: true, message: 'Usuario eliminado de PostgreSQL' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getUsers, getUserById, createUser, updateUser, deleteUser };
