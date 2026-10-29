// ===================================================================
// Controlador de Articulación Horaria (Schedules) — PostgreSQL
// ===================================================================
const db = require('../config/db');

const getSchedules = async (req, res) => {
  try {
    const { user_id, room_id, day_of_week } = req.query;

    let queryText = `
      SELECT s.*,
             (u.first_name || ' ' || u.last_name) as professor_name,
             u.document_id as user_document,
             r.name as room_name,
             b.name as block_name
      FROM schedules s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN rooms r ON r.id = s.room_id
      LEFT JOIN blocks b ON b.id = r.block_id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      params.push(parseInt(user_id, 10));
      queryText += ` AND s.user_id = $${params.length}`;
    }
    if (room_id) {
      params.push(parseInt(room_id, 10));
      queryText += ` AND s.room_id = $${params.length}`;
    }
    if (day_of_week !== undefined) {
      params.push(parseInt(day_of_week, 10));
      queryText += ` AND s.day_of_week = $${params.length}`;
    }

    queryText += ` ORDER BY s.day_of_week ASC, s.start_time ASC`;

    const result = await db.query(queryText, params);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al consultar articulación horaria: ' + error.message });
  }
};

const getScheduleById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(`SELECT * FROM schedules WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Horario no encontrado' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const createSchedule = async (req, res) => {
  try {
    const { user_id, room_id, day_of_week, start_time, end_time, semester = '2026-1', subject_name } = req.body;

    if (!user_id || !room_id || day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ success: false, error: 'Usuario, sala, día y rango horario son obligatorios' });
    }

    const result = await db.query(
      `INSERT INTO schedules (user_id, room_id, day_of_week, start_time, end_time, semester, subject_name, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [parseInt(user_id, 10), parseInt(room_id, 10), parseInt(day_of_week, 10), start_time, end_time, semester, subject_name]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al registrar horario: ' + error.message });
  }
};

const updateSchedule = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { day_of_week, start_time, end_time, semester, subject_name, is_active } = req.body;

    const result = await db.query(
      `UPDATE schedules
       SET day_of_week = COALESCE($1, day_of_week),
           start_time = COALESCE($2, start_time),
           end_time = COALESCE($3, end_time),
           semester = COALESCE($4, semester),
           subject_name = COALESCE($5, subject_name),
           is_active = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING *`,
      [day_of_week, start_time, end_time, semester, subject_name, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Horario no encontrado' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(`DELETE FROM schedules WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Horario no encontrado' });
    }
    return res.json({ success: true, message: 'Horario eliminado' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getSchedules, getScheduleById, createSchedule, updateSchedule, deleteSchedule };
