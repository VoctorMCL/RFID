// ===================================================================
// Controlador de Tarjetas RFID y Enrolamiento — PostgreSQL
// ===================================================================
const db = require('../config/db');

const getCards = async (req, res) => {
  try {
    const { is_active, card_type, search } = req.query;

    let queryText = `
      SELECT c.*,
             u.first_name, u.last_name, (u.first_name || ' ' || u.last_name) as user_name,
             u.document_id as user_document, u.email as user_email,
             r.display_name as role_name
      FROM rfid_cards c
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE 1=1
    `;
    const params = [];

    if (is_active !== undefined) {
      params.push(is_active === 'true');
      queryText += ` AND c.is_active = $${params.length}`;
    }
    if (card_type) {
      params.push(card_type);
      queryText += ` AND c.card_type = $${params.length}`;
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      queryText += ` AND (LOWER(c.uid) LIKE $${params.length} OR LOWER(u.first_name) LIKE $${params.length} OR LOWER(u.last_name) LIKE $${params.length})`;
    }

    queryText += ` ORDER BY c.id ASC`;

    const result = await db.query(queryText, params);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al consultar tarjetas RFID: ' + error.message });
  }
};

const getCardById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(
      `SELECT c.*, (u.first_name || ' ' || u.last_name) as user_name, r.display_name as role_name
       FROM rfid_cards c
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE c.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tarjeta no encontrada' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const enrollCard = async (req, res) => {
  try {
    const { uid, user_id, card_type = 'standard', label } = req.body;

    if (!uid || !uid.trim()) {
      return res.status(400).json({ success: false, error: 'El UID de la tarjeta RFID es obligatorio' });
    }

    const cleanUid = uid.trim().replace(/[\s:\-]/g, '').toUpperCase();
    const userId = user_id ? parseInt(user_id, 10) : null;

    const result = await db.query(
      `INSERT INTO rfid_cards (uid, user_id, card_type, is_active, label, enrolled_at)
       VALUES ($1, $2, $3, true, $4, NOW())
       ON CONFLICT (uid) DO UPDATE
       SET user_id = $2, card_type = $3, is_active = true, label = $4
       RETURNING *`,
      [cleanUid, userId, card_type, label || `Carnet ${cleanUid}`]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al enrolar tarjeta: ' + error.message });
  }
};

const updateCard = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { user_id, card_type, is_active, label } = req.body;

    const result = await db.query(
      `UPDATE rfid_cards
       SET user_id = COALESCE($1, user_id),
           card_type = COALESCE($2, card_type),
           is_active = COALESCE($3, is_active),
           label = COALESCE($4, label)
       WHERE id = $5
       RETURNING *`,
      [user_id ? parseInt(user_id, 10) : null, card_type, is_active, label, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tarjeta no encontrada' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const deactivateCard = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(
      `UPDATE rfid_cards SET is_active = false, deactivated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tarjeta no encontrada' });
    }
    return res.json({ success: true, message: 'Tarjeta desactivada', data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const deleteCard = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(`DELETE FROM rfid_cards WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tarjeta no encontrada' });
    }
    return res.json({ success: true, message: 'Tarjeta eliminada' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getCards, getCardById, enrollCard, updateCard, deactivateCard, deleteCard };
