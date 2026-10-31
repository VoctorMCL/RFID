// ===================================================================
// Controlador de Puertas Inteligentes — Control de Acceso RFID (PostgreSQL)
// ===================================================================
const db = require('../config/db');
const wsService = require('../services/wsService');

/**
 * Obtiene el listado de puertas con su sala, bloque y estado de hardware
 * @route GET /api/doors
 * @param {import('express').Request} req - Petición con query param room_id opcional
 * @param {import('express').Response} res - Listado de puertas
 */
const getDoors = async (req, res) => {
  try {
    const { room_id } = req.query;
    let queryText = `
      SELECT d.*,
             r.name as room_name,
             r.has_alarm as room_has_alarm,
             r.security_status as room_security_status,
             b.name as block_name,
             CASE
               WHEN d.last_heartbeat IS NOT NULL AND d.last_heartbeat > NOW() - INTERVAL '90 seconds' THEN true
               ELSE false
             END as is_hardware_active
      FROM doors d
      LEFT JOIN rooms r ON r.id = d.room_id
      LEFT JOIN blocks b ON b.id = r.block_id
    `;
    const params = [];

    if (room_id) {
      params.push(parseInt(room_id, 10));
      queryText += ` WHERE d.room_id = $1`;
    }

    queryText += ` ORDER BY d.id ASC`;

    const result = await db.query(queryText, params);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al listar puertas desde PostgreSQL:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener puertas de la base de datos: ' + error.message });
  }
};

/**
 * Obtiene los detalles de una puerta específica por su ID
 * @route GET /api/doors/:id
 * @param {import('express').Request} req - Petición con ID en req.params.id
 * @param {import('express').Response} res - Datos de la puerta
 */
const getDoorById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(
      `SELECT d.*,
              r.name as room_name,
              r.has_alarm as room_has_alarm,
              r.security_status as room_security_status,
              b.name as block_name,
              CASE
                WHEN d.last_heartbeat IS NOT NULL AND d.last_heartbeat > NOW() - INTERVAL '90 seconds' THEN true
                ELSE false
              END as is_hardware_active
       FROM doors d
       LEFT JOIN rooms r ON r.id = d.room_id
       LEFT JOIN blocks b ON b.id = r.block_id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Puerta no encontrada' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al consultar puerta: ' + error.message });
  }
};

/**
 * Registra una nueva puerta inteligente en una sala
 * @route POST /api/doors
 * @param {import('express').Request} req - Petición con room_id, name, door_type, hardware_ip, mac_address
 * @param {import('express').Response} res - Puerta creada
 */
const createDoor = async (req, res) => {
  try {
    const { room_id, name, door_type = 'acceso', hardware_ip = '192.168.1.100', mac_address = 'AA:BB:CC:DD:EE:01' } = req.body;

    if (!room_id || !name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Sala y nombre de la puerta son obligatorios' });
    }

    const insertResult = await db.query(
      `INSERT INTO doors (room_id, name, door_type, hardware_ip, mac_address, status, is_locked)
       VALUES ($1, $2, $3, $4, $5, 'online', true)
       RETURNING *`,
      [parseInt(room_id, 10), name.trim(), door_type, hardware_ip, mac_address]
    );

    const newDoor = insertResult.rows[0];
    wsService.broadcast('door_status', { doorId: newDoor.id, status: newDoor.status, isLocked: newDoor.is_locked });

    return res.status(201).json({ success: true, data: newDoor });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al registrar puerta: ' + error.message });
  }
};

/**
 * Actualiza los parámetros o estado de una puerta existente
 * @route PUT /api/doors/:id
 * @param {import('express').Request} req - Petición con ID en params y datos a actualizar en body
 * @param {import('express').Response} res - Puerta actualizada
 */
const updateDoor = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, door_type, hardware_ip, mac_address, status, is_locked } = req.body;

    const result = await db.query(
      `UPDATE doors
       SET name = COALESCE($1, name),
           door_type = COALESCE($2, door_type),
           hardware_ip = COALESCE($3, hardware_ip),
           mac_address = COALESCE($4, mac_address),
           status = COALESCE($5, status),
           is_locked = COALESCE($6, is_locked)
       WHERE id = $7
       RETURNING *`,
      [name, door_type, hardware_ip, mac_address, status, is_locked, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Puerta no encontrada' });
    }

    const updated = result.rows[0];
    wsService.broadcast('door_status', { doorId: updated.id, status: updated.status, isLocked: updated.is_locked });

    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al actualizar puerta: ' + error.message });
  }
};

/**
 * Elimina una puerta de la base de datos
 * @route DELETE /api/doors/:id
 * @param {import('express').Request} req - Petición con ID en params
 * @param {import('express').Response} res - Mensaje de confirmación
 */
const deleteDoor = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(`DELETE FROM doors WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Puerta no encontrada' });
    }
    return res.json({ success: true, message: 'Puerta eliminada correctamente' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al eliminar puerta: ' + error.message });
  }
};

/**
 * Desbloqueo manual y temporal de puerta por personal autorizado (5 segundos)
 * @route POST /api/doors/:id/unlock
 * @param {import('express').Request} req - Petición con ID de puerta
 * @param {import('express').Response} res - Resultado del desbloqueo
 */
const unlockDoor = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query(`UPDATE doors SET is_locked = false WHERE id = $1`, [id]);

    wsService.broadcast('door_status', { doorId: id, isLocked: false });

    // Bloqueo automático de seguridad tras 5 segundos
    setTimeout(async () => {
      try {
        await db.query(`UPDATE doors SET is_locked = true WHERE id = $1`, [id]);
        wsService.broadcast('door_status', { doorId: id, isLocked: true });
      } catch (e) {}
    }, 5000);

    return res.json({ success: true, message: 'Puerta desbloqueada por 5 segundos' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al desbloquear puerta: ' + error.message });
  }
};

/**
 * Recibe latido de telemetría desde ESP32 / Raspberry Pi para marcar puerta online
 * @route POST /api/doors/:id/heartbeat
 * @param {import('express').Request} req - Petición con ID de puerta
 * @param {import('express').Response} res - Estado actualizado
 */
const heartbeat = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(
      `UPDATE doors SET status = 'online', last_heartbeat = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Puerta no encontrada' });
    }

    wsService.broadcast('hardware_heartbeat', {
      doorId: id,
      doorName: result.rows[0].name,
      status: 'online',
      timestamp: new Date().toISOString()
    });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al registrar heartbeat: ' + error.message });
  }
};

module.exports = {
  getDoors,
  getDoorById,
  createDoor,
  updateDoor,
  deleteDoor,
  unlockDoor,
  heartbeat
};
