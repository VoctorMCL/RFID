// ===================================================================
// Controlador de Usuarios — PostgreSQL
// ===================================================================
const bcrypt = require('bcryptjs');
const db = require('../config/db');

/**
 * Consulta la lista de usuarios con filtros por rol, estado y búsqueda por nombre/documento/UID
 * @route GET /api/users
 * @param {import('express').Request} req - Petición con query params role_id, status, search
 * @param {import('express').Response} res - Listado de usuarios
 */
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

/**
 * Consulta la información completa de un usuario por su ID, incluyendo sus tarjetas asociadas
 * @route GET /api/users/:id
 * @param {import('express').Request} req - Petición con ID de usuario
 * @param {import('express').Response} res - Datos del usuario y tarjetas
 */
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

/**
 * Registra un nuevo usuario en la base de datos y enrola opcionalmente su carnet RFID
 * @route POST /api/users
 * @param {import('express').Request} req - Datos de creación
 * @param {import('express').Response} res - Usuario creado
 */
const createUser = async (req, res) => {
  try {
    const { first_name, last_name, email, document_id, role_id, program, phone, password, rfid_tag } = req.body;

    if (!first_name || !last_name || !email || !document_id || !role_id) {
      return res.status(400).json({ success: false, error: 'Todos los campos obligatorios deben ser completados' });
    }

    const defaultPass = password || 'acceso2026';
    const hash = await bcrypt.hash(defaultPass, 10);

    const insertUser = await db.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, document_id, role_id, program, phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       RETURNING id, first_name, last_name, email, document_id, role_id, program, phone, status`,
      [first_name.trim(), last_name.trim(), email.trim().toLowerCase(), hash, document_id.trim(), parseInt(role_id, 10), program, phone]
    );

    const newUser = insertUser.rows[0];

    // Enrolar tarjeta física si fue suministrada
    if (rfid_tag && rfid_tag.trim()) {
      const cleanUid = rfid_tag.trim().toUpperCase();
      await db.query(
        `INSERT INTO rfid_cards (uid, user_id, card_type, is_active, label)
         VALUES ($1, $2, 'standard', true, $3)
         ON CONFLICT (uid) DO UPDATE SET user_id = $2, is_active = true`,
        [cleanUid, newUser.id, `Carnet de ${newUser.first_name}`]
      );
    }

    return res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return res.status(500).json({ success: false, error: 'Error al registrar usuario: ' + error.message });
  }
};

/**
 * Actualiza los datos de un usuario existente
 * @route PUT /api/users/:id
 * @param {import('express').Request} req - Parámetros y campos a actualizar
 * @param {import('express').Response} res - Usuario actualizado
 */
const updateUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { first_name, last_name, email, document_id, role_id, program, phone, status } = req.body;

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

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Elimina un usuario de la base de datos
 * @route DELETE /api/users/:id
 * @param {import('express').Request} req - Petición con ID en params
 * @param {import('express').Response} res - Confirmación de eliminación
 */
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
