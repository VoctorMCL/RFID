// ===================================================================
// Motor Central de Validación de Acceso RFID y Alarmas
// ===================================================================
const db = require('../config/db');
const wsService = require('../services/wsService');
const emailService = require('../services/emailService');

// Caché en memoria del último evento de escaneo para clientes en polling (Vercel Serverless)
let latestScanEvent = null;

/**
 * Valida un intento de acceso con tarjeta RFID en una puerta
 * POST /api/access/validate
 * Body: { rfid_uid, door_id, access_method }
 */
const validateAccess = async (req, res) => {
  try {
    const { rfid_uid, door_id, access_method = 'rfid' } = req.body;

    if (!rfid_uid || !door_id) {
      return res.status(400).json({
        success: false,
        error: 'El UID de la tarjeta y el ID de la puerta son obligatorios'
      });
    }

    const cleanUid = rfid_uid.trim().replace(/[\s:\-]/g, '').toUpperCase();
    const doorId = parseInt(door_id, 10);

    // 1. Obtener la puerta y la sala asociada
    const door = db.memoryDb.doors.find(d => d.id === doorId);
    if (!door) {
      return res.status(404).json({ success: false, error: 'Puerta no registrada en el sistema' });
    }
    const room = db.memoryDb.rooms.find(r => r.id === door.room_id);
    const block = room ? db.memoryDb.blocks.find(b => b.id === room.block_id) : null;

    let granted = false;
    let denialReason = null;
    let user = null;
    let role = null;
    let card = null;

    // 2. Buscar la tarjeta RFID en el sistema
    card = db.memoryDb.rfid_cards.find(c => c.uid === cleanUid);

    if (!card) {
      denialReason = 'denegado_no_registrado';
    } else if (!card.is_active) {
      denialReason = 'denegado_tarjeta_inactiva';
    } else if (!card.user_id) {
      denialReason = 'denegado_sin_usuario_asignado';
    } else {
      // 3. Buscar usuario
      user = db.memoryDb.users.find(u => u.id === card.user_id);
      if (!user) {
        denialReason = 'denegado_usuario_no_encontrado';
      } else if (user.status !== 'active') {
        denialReason = 'denegado_usuario_inactivo';
      } else if (user.access_expiry && new Date(user.access_expiry) < new Date()) {
        denialReason = 'denegado_acceso_expirado';
      } else {
        role = db.memoryDb.roles.find(r => r.id === user.role_id);

        // 4. Jerarquía de roles y permisos
        // A) Rectora / Vigilante con privilegios globales o ficha maestra
        if (role && role.global_access) {
          granted = true;
        } else if (card.card_type === 'master') {
          granted = true;
        } else if (role && role.name === 'admin_staff') {
          // Administrativos en bloques administrativos
          if (room && room.room_type === 'administrativo' || (block && block.name.includes('Administrativo'))) {
            granted = true;
          } else {
            denialReason = 'denegado_area_no_autorizada';
          }
        } else {
          // B) Profesores y Estudiantes: Validación estricta contra articulación horaria
          const now = new Date();
          const currentDay = now.getDay(); // 0: Dom, 1: Lun, 2: Mar, ...
          const currentHour = now.toTimeString().split(' ')[0]; // 'HH:MM:SS'

          // Buscar horario para el usuario en esta sala
          const matchingSchedule = db.memoryDb.schedules.find(s =>
            s.user_id === user.id &&
            s.room_id === room.id &&
            s.day_of_week === currentDay &&
            s.is_active &&
            s.start_time <= currentHour &&
            s.end_time >= currentHour
          );

          if (matchingSchedule) {
            granted = true;
          } else {
            denialReason = 'denegado_horario_no_valido';
          }
        }
      }
    }

    // 5. Lógica de Alarmas Integradas (Prototipo Sala de Informática 1 y salas aseguradas)
    let alarmTriggered = false;
    let alarmDetails = null;

    if (room && room.has_alarm && room.security_status === 'armed') {
      // Si la sala está armada y el acceso fue denegado o no es personal de seguridad desarmando
      const isSecurity = role && (role.name === 'security' || role.name === 'rector');
      if (!granted || !isSecurity) {
        alarmTriggered = true;
        room.security_status = 'alert';

        const alertObj = {
          id: db.nextIds.alerts++,
          door_id: door.id,
          room_id: room.id,
          sensor_type: 'alarm_triggered',
          severity: 'critical',
          message: `🚨 ALERTA CRÍTICA: Intento de apertura no autorizada en ${room.name} (${door.name}). Alarma física activada. Solo deshabilitable desde el cuarto de control de seguridad.`,
          timestamp: new Date().toISOString(),
          is_resolved: false,
          resolved_by: null,
          resolved_at: null,
          resolution_note: null,
          email_sent: false
        };

        db.memoryDb.alerts.unshift(alertObj);

        // Envío de correo electrónico a seguridad y administración
        emailService.sendAlertEmail({
          sensor_type: 'alarm_triggered',
          severity: 'critical',
          message: alertObj.message,
          room_name: room.name,
          door_name: door.name
        }).then(res => {
          if (res && res.sent) alertObj.email_sent = true;
        });

        // Broadcast WebSocket de la alerta crítica
        wsService.broadcast('new_alert', alertObj);
        alarmDetails = alertObj;
      }
    }

    // 6. Desbloqueo físico simulado si se concedió acceso
    if (granted) {
      door.is_locked = false;
      setTimeout(() => {
        door.is_locked = true;
        wsService.broadcast('door_status', { doorId: door.id, isLocked: true });
      }, 5000);
    }

    // 7. Registro de log de auditoría
    const logEntry = {
      id: db.nextIds.access_logs++,
      user_id: user ? user.id : null,
      door_id: door.id,
      rfid_card_id: card ? card.id : null,
      rfid_uid_raw: cleanUid,
      timestamp: new Date().toISOString(),
      access_method,
      granted,
      denial_reason: denialReason,
      notes: granted ? 'Acceso autorizado' : `Intento fallido: ${denialReason}`
    };

    db.memoryDb.access_logs.unshift(logEntry);

    // 8. Broadcast de intento de acceso en tiempo real a monitores y cuartos de control
    const broadcastPayload = {
      logId: logEntry.id,
      granted,
      timestamp: logEntry.timestamp,
      uid: cleanUid,
      door: { id: door.id, name: door.name },
      room: { id: room.id, name: room.name, has_alarm: room.has_alarm, security_status: room.security_status },
      user: user ? {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        document_id: user.document_id,
        program: user.program,
        role: role ? role.display_name : 'Usuario'
      } : null,
      denialReason,
      alarmTriggered
    };

    wsService.broadcast('access_attempt', broadcastPayload);

    // Actualizar el último escaneo en memoria para clientes en polling (Vercel Serverless)
    latestScanEvent = {
      id: logEntry.id,
      logId: logEntry.id,
      granted,
      denial_reason: denialReason,
      timestamp: logEntry.timestamp,
      uid: cleanUid,
      user: user ? {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        name: `${user.first_name} ${user.last_name}`,
        document_id: user.document_id,
        program: user.program,
        role: role ? role.display_name : 'Usuario',
        photo_url: user.photo_url
      } : null,
      door: {
        id: door.id,
        name: door.name,
        status: door.status
      },
      room: {
        id: room.id,
        name: room.name,
        block_name: block ? block.name : 'Campus',
        security_status: room.security_status,
        has_alarm: room.has_alarm
      },
      alarm_triggered: alarmTriggered,
      alarm: alarmDetails
    };

    return res.json({
      success: true,
      data: {
        granted,
        denial_reason: denialReason,
        timestamp: logEntry.timestamp,
        user: user ? {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          document_id: user.document_id,
          program: user.program,
          role: role ? role.display_name : 'Usuario',
          photo_url: user.photo_url
        } : null,
        door: {
          id: door.id,
          name: door.name,
          status: door.status
        },
        room: {
          id: room.id,
          name: room.name,
          block_name: block ? block.name : 'Campus',
          security_status: room.security_status
        },
        alarm_triggered: alarmTriggered,
        alarm: alarmDetails
      }
    });
  } catch (error) {
    console.error('Error en validateAccess:', error);
    return res.status(500).json({ success: false, error: 'Error interno en la validación de acceso' });
  }
};

/**
 * Obtiene el historial de logs de acceso con paginación y filtros
 * GET /api/access/logs
 */
const getAccessLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, granted, user_id, door_id, search } = req.query;

    let logs = db.memoryDb.access_logs.map(log => {
      const user = log.user_id ? db.memoryDb.users.find(u => u.id === log.user_id) : null;
      const door = log.door_id ? db.memoryDb.doors.find(d => d.id === log.door_id) : null;
      const room = door ? db.memoryDb.rooms.find(r => r.id === door.room_id) : null;
      const block = room ? db.memoryDb.blocks.find(b => b.id === room.block_id) : null;

      return {
        ...log,
        user_name: user ? `${user.first_name} ${user.last_name}` : 'Desconocido',
        user_document: user ? user.document_id : '—',
        user_program: user ? user.program : '—',
        door_name: door ? door.name : 'Puerta eliminada',
        room_name: room ? room.name : 'Sala eliminada',
        block_name: block ? block.name : 'Campus'
      };
    });

    if (granted !== undefined) {
      const isGranted = granted === 'true';
      logs = logs.filter(l => l.granted === isGranted);
    }
    if (user_id) {
      logs = logs.filter(l => l.user_id === parseInt(user_id, 10));
    }
    if (door_id) {
      logs = logs.filter(l => l.door_id === parseInt(door_id, 10));
    }
    if (search) {
      const q = search.toLowerCase();
      logs = logs.filter(l =>
        (l.rfid_uid_raw && l.rfid_uid_raw.toLowerCase().includes(q)) ||
        l.user_name.toLowerCase().includes(q) ||
        l.door_name.toLowerCase().includes(q) ||
        l.room_name.toLowerCase().includes(q)
      );
    }

    const total = logs.length;
    const p = parseInt(page, 10);
    const lim = parseInt(limit, 10);
    const paginated = logs.slice((p - 1) * lim, p * lim);

    return res.json({
      success: true,
      data: paginated,
      pagination: {
        page: p,
        limit: lim,
        total,
        pages: Math.ceil(total / lim)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener historial de accesos' });
  }
};

/**
 * Obtiene métricas del dashboard
 * GET /api/access/logs/stats
 */
const getStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = db.memoryDb.access_logs.filter(l => l.timestamp && l.timestamp.startsWith(today));

    const totalToday = todayLogs.length;
    const grantedToday = todayLogs.filter(l => l.granted).length;
    const deniedToday = todayLogs.filter(l => !l.granted).length;
    const activeUsers = db.memoryDb.users.filter(u => u.status === 'active').length;
    const activeAlerts = db.memoryDb.alerts.filter(a => !a.is_resolved).length;
    const totalDoors = db.memoryDb.doors.length;
    const totalRooms = db.memoryDb.rooms.length;
    const totalBlocks = db.memoryDb.blocks.length;

    return res.json({
      success: true,
      data: {
        totalToday,
        grantedToday,
        deniedToday,
        activeUsers,
        activeAlerts,
        totalDoors,
        totalRooms,
        totalBlocks
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
  }
};

/**
 * Obtiene el último evento de escaneo RFID registrado (para polling en Vercel Serverless)
 * GET /api/access/latest
 */
const getLatestScan = async (req, res) => {
  try {
    return res.json({
      success: true,
      data: latestScanEvent
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener último escaneo' });
  }
};

module.exports = { validateAccess, getAccessLogs, getStats, getLatestScan };
