// ===================================================================
// Controlador de Alertas y Gestión de Seguridad — Control de Acceso RFID
// ===================================================================
const db = require('../config/db');
const wsService = require('../services/wsService');
const emailService = require('../services/emailService');

const getAlerts = async (req, res) => {
  try {
    const { severity, is_resolved } = req.query;

    let alerts = db.memoryDb.alerts.map(a => {
      const door = a.door_id ? db.memoryDb.doors.find(d => d.id === a.door_id) : null;
      const room = a.room_id ? db.memoryDb.rooms.find(r => r.id === a.room_id) : (door ? db.memoryDb.rooms.find(r => r.id === door.room_id) : null);
      const resolver = a.resolved_by ? db.memoryDb.users.find(u => u.id === a.resolved_by) : null;

      return {
        ...a,
        door_name: door ? door.name : 'General',
        room_name: room ? room.name : 'Campus',
        resolver_name: resolver ? `${resolver.first_name} ${resolver.last_name}` : null
      };
    });

    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }
    if (is_resolved !== undefined) {
      const resolved = is_resolved === 'true';
      alerts = alerts.filter(a => a.is_resolved === resolved);
    }

    return res.json({ success: true, data: alerts });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener alertas' });
  }
};

const createAlert = async (req, res) => {
  try {
    const { door_id, room_id, sensor_type, severity = 'medium', message } = req.body;

    if (!sensor_type || !message) {
      return res.status(400).json({ success: false, error: 'Tipo de sensor y mensaje son requeridos' });
    }

    const newAlert = {
      id: db.nextIds.alerts++,
      door_id: door_id ? parseInt(door_id, 10) : null,
      room_id: room_id ? parseInt(room_id, 10) : null,
      sensor_type,
      severity,
      message,
      timestamp: new Date().toISOString(),
      is_resolved: false,
      resolved_by: null,
      resolved_at: null,
      resolution_note: null,
      email_sent: false
    };

    db.memoryDb.alerts.unshift(newAlert);

    // Si es severidad alta o crítica, enviar email automático
    if (severity === 'high' || severity === 'critical') {
      emailService.sendAlertEmail(newAlert).then(r => {
        if (r && r.sent) newAlert.email_sent = true;
      });
    }

    wsService.broadcast('new_alert', newAlert);

    return res.status(201).json({ success: true, data: newAlert });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al registrar alerta' });
  }
};

const resolveAlert = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { resolution_note } = req.body;
    const resolverId = req.user.id;

    const alert = db.memoryDb.alerts.find(a => a.id === id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alerta no encontrada' });
    }

    alert.is_resolved = true;
    alert.resolved_by = resolverId;
    alert.resolved_at = new Date().toISOString();
    alert.resolution_note = resolution_note ? resolution_note.trim() : 'Resuelta desde el centro de control';

    // Si la alerta involucraba una sala en estado de alerta, restablecer la sala a normal/armada
    if (alert.room_id) {
      const room = db.memoryDb.rooms.find(r => r.id === alert.room_id);
      if (room && room.security_status === 'alert') {
        room.security_status = room.has_alarm ? 'armed' : 'normal';
      }
    }

    wsService.broadcast('alert_resolved', { alertId: alert.id, resolvedBy: resolverId });

    return res.json({ success: true, message: 'Alerta resuelta con éxito', data: alert });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al resolver alerta' });
  }
};

const disarmRoomAlarm = async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    const room = db.memoryDb.rooms.find(r => r.id === roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Sala no encontrada' });
    }

    const previousStatus = room.security_status;
    room.security_status = 'normal';

    const zone = db.memoryDb.alarm_zones.find(z => z.room_id === roomId);
    if (zone) zone.is_armed = false;

    wsService.broadcast('room_security_change', {
      roomId: room.id,
      roomName: room.name,
      status: 'normal',
      action: 'disarmed_by_security',
      user: req.user.email
    });

    return res.json({
      success: true,
      message: `Alarma deshabilitada manualmente para ${room.name} desde el centro de control`,
      data: room
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al desarmar sala' });
  }
};

module.exports = { getAlerts, createAlert, resolveAlert, disarmRoomAlarm };
