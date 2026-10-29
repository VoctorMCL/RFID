// ===================================================================
// Controlador de Alertas de Seguridad — PostgreSQL
// ===================================================================
const db = require('../config/db');
const wsService = require('../services/wsService');

const getAlerts = async (req, res) => {
  try {
    const { is_resolved, severity, limit = 50 } = req.query;

    let queryText = `
      SELECT a.*,
             d.name as door_name,
             r.name as room_name,
             b.name as block_name,
             (u.first_name || ' ' || u.last_name) as resolved_by_name
      FROM alerts a
      LEFT JOIN doors d ON d.id = a.door_id
      LEFT JOIN rooms r ON r.id = a.room_id
      LEFT JOIN blocks b ON b.id = r.block_id
      LEFT JOIN users u ON u.id = a.resolved_by
      WHERE 1=1
    `;
    const params = [];

    if (is_resolved !== undefined) {
      params.push(is_resolved === 'true');
      queryText += ` AND a.is_resolved = $${params.length}`;
    }
    if (severity) {
      params.push(severity);
      queryText += ` AND a.severity = $${params.length}`;
    }

    queryText += ` ORDER BY a.timestamp DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10));

    const result = await db.query(queryText, params);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al consultar alertas: ' + error.message });
  }
};

const createAlert = async (req, res) => {
  try {
    const { door_id, room_id, sensor_type = 'alarm_triggered', severity = 'high', message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: 'Mensaje de alerta requerido' });
    }

    const result = await db.query(
      `INSERT INTO alerts (door_id, room_id, sensor_type, severity, message, timestamp, is_resolved)
       VALUES ($1, $2, $3, $4, $5, NOW(), false)
       RETURNING *`,
      [door_id ? parseInt(door_id, 10) : null, room_id ? parseInt(room_id, 10) : null, sensor_type, severity, message]
    );

    const alert = result.rows[0];
    wsService.broadcast('new_alert', alert);
    return res.status(201).json({ success: true, data: alert });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const resolveAlert = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { resolution_note } = req.body;
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE alerts
       SET is_resolved = true,
           resolved_by = $1,
           resolved_at = NOW(),
           resolution_note = $2
       WHERE id = $3
       RETURNING *`,
      [userId, resolution_note || 'Alerta resuelta por personal de seguridad', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alerta no encontrada' });
    }

    const resolved = result.rows[0];
    wsService.broadcast('alert_resolved', { alertId: id, resolvedBy: userId });
    return res.json({ success: true, data: resolved });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const disarmRoomAlarm = async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    await db.query(`UPDATE rooms SET security_status = 'normal' WHERE id = $1`, [roomId]);
    wsService.broadcast('room_security_change', { roomId, status: 'normal' });
    return res.json({ success: true, message: 'Alarma de sala desarmada por seguridad' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getAlerts, createAlert, resolveAlert, disarmRoomAlarm };
