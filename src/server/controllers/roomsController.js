// ===================================================================
// Controlador de Salas y Espacios — PostgreSQL
// ===================================================================
const db = require('../config/db');

const getRooms = async (req, res) => {
  try {
    const { block_id } = req.query;
    let queryText = `
      SELECT r.*, b.name as block_name, COUNT(d.id)::int as doors_count
      FROM rooms r
      LEFT JOIN blocks b ON b.id = r.block_id
      LEFT JOIN doors d ON d.room_id = r.id
    `;
    const params = [];
    if (block_id) {
      params.push(parseInt(block_id, 10));
      queryText += ` WHERE r.block_id = $1`;
    }
    queryText += ` GROUP BY r.id, b.name ORDER BY r.id ASC`;

    const result = await db.query(queryText, params);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al consultar salas: ' + error.message });
  }
};

const getRoomById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(
      `SELECT r.*, b.name as block_name
       FROM rooms r
       LEFT JOIN blocks b ON b.id = r.block_id
       WHERE r.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sala no encontrada' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const createRoom = async (req, res) => {
  try {
    const { block_id, name, floor = 1, room_type = 'general', has_alarm = false, description } = req.body;
    if (!block_id || !name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Bloque y nombre son obligatorios' });
    }

    const result = await db.query(
      `INSERT INTO rooms (block_id, name, floor, room_type, has_alarm, security_status, description)
       VALUES ($1, $2, $3, $4, $5, 'normal', $6)
       RETURNING *`,
      [parseInt(block_id, 10), name.trim(), floor, room_type, has_alarm, description]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const updateRoom = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, floor, room_type, has_alarm, security_status, description, is_active } = req.body;

    const result = await db.query(
      `UPDATE rooms
       SET name = COALESCE($1, name),
           floor = COALESCE($2, floor),
           room_type = COALESCE($3, room_type),
           has_alarm = COALESCE($4, has_alarm),
           security_status = COALESCE($5, security_status),
           description = COALESCE($6, description),
           is_active = COALESCE($7, is_active)
       WHERE id = $8
       RETURNING *`,
      [name, floor, room_type, has_alarm, security_status, description, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sala no encontrada' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(`DELETE FROM rooms WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sala no encontrada' });
    }
    return res.json({ success: true, message: 'Sala eliminada' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getRooms, getRoomById, createRoom, updateRoom, deleteRoom };
