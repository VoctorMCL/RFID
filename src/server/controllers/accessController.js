// ===================================================================
// Motor Central de Validación de Acceso RFID y Alarmas — PostgreSQL
// ===================================================================
const db = require('../config/db');
const wsService = require('../services/wsService');
const emailService = require('../services/emailService');

// Caché en memoria del último evento de escaneo para clientes en polling (Vercel)
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

    // 1. Obtener la puerta y la sala asociada directamente desde PostgreSQL
    const doorQuery = await db.query(
      `SELECT d.*, r.id as room_id, r.name as room_name, r.has_alarm, r.security_status, b.name as block_name
       FROM doors d
       JOIN rooms r ON r.id = d.room_id
       LEFT JOIN blocks b ON b.id = r.block_id
       WHERE d.id = $1`,
      [doorId]
    );

    if (doorQuery.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Puerta no registrada en la base de datos' });
    }

    const door = doorQuery.rows[0];

    // Marcar la puerta como online y actualizar heartbeat
    await db.query(`UPDATE doors SET status = 'online', last_heartbeat = NOW() WHERE id = $1`, [door.id]);

    let granted = false;
    let denialReason = null;
    let card = null;
    let user = null;

    // 2. Buscar la tarjeta RFID en PostgreSQL
    const cardQuery = await db.query(
      `SELECT c.*,
              u.id as user_id, u.first_name, u.last_name, u.document_id, u.program, u.status as user_status, u.access_expiry, u.photo_url,
              r.id as role_id, r.name as role_name, r.display_name as role_display, r.global_access
       FROM rfid_cards c
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE c.uid = $1`,
      [cleanUid]
    );

    if (cardQuery.rows.length === 0) {
      denialReason = 'denegado_no_registrado';
    } else {
      card = cardQuery.rows[0];

      if (!card.is_active) {
        denialReason = 'denegado_tarjeta_inactiva';
      } else if (!card.user_id) {
        denialReason = 'denegado_sin_usuario_asignado';
      } else if (card.user_status !== 'active') {
        denialReason = 'denegado_usuario_inactivo';
      } else if (card.access_expiry && new Date(card.access_expiry) < new Date()) {
        denialReason = 'denegado_acceso_expirado';
      } else {
        user = {
          id: card.user_id,
          first_name: card.first_name,
          last_name: card.last_name,
          name: `${card.first_name} ${card.last_name}`,
          document_id: card.document_id,
          program: card.program,
          role: card.role_display || 'Usuario',
          role_name: card.role_name,
          photo_url: card.photo_url
        };

        // 3. Jerarquía de roles y permisos
        // A) Rectora / Vigilante con privilegios globales o ficha maestra
        if (card.global_access || card.card_type === 'master') {
          granted = true;
        } else if (card.role_name === 'admin_staff') {
          // Administrativos en áreas administrativas
          if (door.room_name.toLowerCase().includes('admin') || (door.block_name && door.block_name.toLowerCase().includes('admin'))) {
            granted = true;
          } else {
            denialReason = 'denegado_area_no_autorizada';
          }
        } else {
          // B) Profesores y Estudiantes: Validación estricta contra articulación horaria en PostgreSQL
          const now = new Date();
          const currentDay = now.getDay(); // 0=Domingo, 1=Lunes, ...
          const currentHour = now.toTimeString().split(' ')[0]; // 'HH:MM:SS'

          const schedResult = await db.query(
            `SELECT * FROM schedules
             WHERE user_id = $1 AND room_id = $2 AND day_of_week = $3 AND is_active = true
               AND start_time <= $4 AND end_time >= $4
             LIMIT 1`,
            [user.id, door.room_id, currentDay, currentHour]
          );

          if (schedResult.rows.length > 0) {
            granted = true;
          } else {
            denialReason = 'denegado_horario_no_valido';
          }
        }
      }
    }

    // 4. Lógica de Alarmas
    let alarmTriggered = false;
    let alarmDetails = null;

    if (door.has_alarm && door.security_status === 'armed') {
      const isSecurity = card && (card.role_name === 'security' || card.role_name === 'celador' || card.role_name === 'rector');
      if (!granted || !isSecurity) {
        alarmTriggered = true;
        await db.query(`UPDATE rooms SET security_status = 'alert' WHERE id = $1`, [door.room_id]);

        const alertMessage = `🚨 ALERTA CRÍTICA: Intento de apertura no autorizada en ${door.room_name} (${door.name}). Solo deshabilitable desde el cuarto de control de seguridad.`;

        const alertInsert = await db.query(
          `INSERT INTO alerts (door_id, room_id, sensor_type, severity, message, timestamp, is_resolved)
           VALUES ($1, $2, 'alarm_triggered', 'critical', $3, NOW(), false)
           RETURNING *`,
          [door.id, door.room_id, alertMessage]
        );

        alarmDetails = alertInsert.rows[0];

        // Envío de correo
        emailService.sendAlertEmail({
          sensor_type: 'alarm_triggered',
          severity: 'critical',
          message: alertMessage,
          room_name: door.room_name,
          door_name: door.name
        }).catch(console.error);

        wsService.broadcast('new_alert', alarmDetails);
      }
    }

    // 5. Desbloqueo si se concedió acceso
    if (granted) {
      await db.query(`UPDATE doors SET is_locked = false WHERE id = $1`, [door.id]);
      setTimeout(async () => {
        try {
          await db.query(`UPDATE doors SET is_locked = true WHERE id = $1`, [door.id]);
          wsService.broadcast('door_status', { doorId: door.id, isLocked: true });
        } catch (e) {}
      }, 5000);
    }

    // 6. Registro INMUTABLE en la tabla access_logs de PostgreSQL
    const logInsert = await db.query(
      `INSERT INTO access_logs (user_id, door_id, rfid_card_id, rfid_uid_raw, timestamp, access_method, granted, denial_reason, notes)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)
       RETURNING *`,
      [
        user ? user.id : null,
        door.id,
        card ? card.id : null,
        cleanUid,
        access_method,
        granted,
        denialReason,
        granted ? 'Acceso autorizado' : `Intento fallido: ${denialReason}`
      ]
    );

    const logEntry = logInsert.rows[0];

    // 7. Preparar payload y actualizar caché para polling
    latestScanEvent = {
      id: logEntry.id,
      logId: logEntry.id,
      granted,
      denial_reason: denialReason,
      timestamp: logEntry.timestamp,
      uid: cleanUid,
      user,
      door: {
        id: door.id,
        name: door.name,
        status: 'online'
      },
      room: {
        id: door.room_id,
        name: door.room_name,
        block_name: door.block_name || 'Campus',
        security_status: door.security_status,
        has_alarm: door.has_alarm
      },
      alarm_triggered: alarmTriggered,
      alarm: alarmDetails
    };

    wsService.broadcast('access_attempt', {
      logId: logEntry.id,
      granted,
      timestamp: logEntry.timestamp,
      uid: cleanUid,
      door: { id: door.id, name: door.name },
      room: { id: door.room_id, name: door.room_name, has_alarm: door.has_alarm, security_status: door.security_status },
      user,
      denialReason,
      alarmTriggered
    });

    return res.json({
      success: true,
      data: latestScanEvent
    });
  } catch (error) {
    console.error('Error en validateAccess (PostgreSQL):', error);
    return res.status(500).json({ success: false, error: 'Error interno en la validación contra PostgreSQL: ' + error.message });
  }
};

/**
 * Obtiene el historial de logs de acceso directamente desde PostgreSQL
 * GET /api/access/logs
 */
const getAccessLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, granted, user_id, door_id, search } = req.query;
    const p = parseInt(page, 10);
    const lim = parseInt(limit, 10);
    const offset = (p - 1) * lim;

    let queryText = `
      SELECT l.*,
             (u.first_name || ' ' || u.last_name) as user_name,
             u.document_id as user_document,
             u.program as user_program,
             r.display_name as role_name,
             d.name as door_name,
             rm.name as room_name,
             rm.has_alarm as room_has_alarm,
             b.name as block_name
      FROM access_logs l
      LEFT JOIN users u ON u.id = l.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN doors d ON d.id = l.door_id
      LEFT JOIN rooms rm ON rm.id = d.room_id
      LEFT JOIN blocks b ON b.id = rm.block_id
      WHERE 1=1
    `;
    const params = [];

    if (granted !== undefined) {
      params.push(granted === 'true');
      queryText += ` AND l.granted = $${params.length}`;
    }
    if (user_id) {
      params.push(parseInt(user_id, 10));
      queryText += ` AND l.user_id = $${params.length}`;
    }
    if (door_id) {
      params.push(parseInt(door_id, 10));
      queryText += ` AND l.door_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      queryText += ` AND (
        LOWER(l.rfid_uid_raw) LIKE $${params.length} OR
        LOWER(u.first_name) LIKE $${params.length} OR
        LOWER(u.last_name) LIKE $${params.length} OR
        LOWER(d.name) LIKE $${params.length} OR
        LOWER(rm.name) LIKE $${params.length}
      )`;
    }

    queryText += ` ORDER BY l.timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(lim, offset);

    const result = await db.query(queryText, params);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error en getAccessLogs:', error);
    return res.status(500).json({ success: false, error: 'Error al consultar logs en PostgreSQL: ' + error.message });
  }
};

/**
 * Obtiene métricas reales del dashboard calculadas en PostgreSQL
 * GET /api/access/logs/stats
 */
const getStats = async (req, res) => {
  try {
    const [
      totalToday,
      grantedToday,
      activeUsers,
      activeAlerts,
      totalDoors,
      totalRooms,
      totalBlocks,
      activeSensors,
      byBlockRes,
      byRoleRes,
      byReasonRes
    ] = await Promise.all([
      db.query(`SELECT COUNT(*)::int as count FROM access_logs WHERE (timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date`),
      db.query(`SELECT COUNT(*)::int as count FROM access_logs WHERE (timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date AND granted = true`),
      db.query(`SELECT COUNT(*)::int as count FROM users WHERE status = 'active'`),
      db.query(`SELECT COUNT(*)::int as count FROM alerts WHERE is_resolved = false`),
      db.query(`SELECT COUNT(*)::int as count FROM doors`),
      db.query(`SELECT COUNT(*)::int as count FROM rooms`),
      db.query(`SELECT COUNT(*)::int as count FROM blocks`),
      db.query(`SELECT COUNT(*)::int as count FROM doors WHERE last_heartbeat IS NOT NULL AND last_heartbeat > NOW() - INTERVAL '30 seconds'`),
      db.query(`
        SELECT b.id, b.name, COUNT(l.id)::int as count
        FROM blocks b
        LEFT JOIN rooms r ON r.block_id = b.id
        LEFT JOIN doors d ON d.room_id = r.id
        LEFT JOIN access_logs l ON l.door_id = d.id AND (l.timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
        GROUP BY b.id, b.name
        ORDER BY b.id ASC
      `),
      db.query(`
        SELECT r.id, r.name, r.display_name, COUNT(l.id)::int as count
        FROM roles r
        LEFT JOIN users u ON u.role_id = r.id
        LEFT JOIN access_logs l ON l.user_id = u.id AND (l.timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
        GROUP BY r.id, r.name, r.display_name
        ORDER BY count DESC
      `),
      db.query(`
        SELECT COALESCE(denial_reason, 'Horario no permitido') as reason, COUNT(*)::int as count
        FROM access_logs
        WHERE granted = false AND (timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
        GROUP BY denial_reason
        ORDER BY count DESC
        LIMIT 5
      `)
    ]);

    const total = totalToday.rows[0]?.count || 0;
    const granted = grantedToday.rows[0]?.count || 0;

    return res.json({
      success: true,
      data: {
        totalToday: total,
        grantedToday: granted,
        deniedToday: total - granted,
        successRate: total > 0 ? Number(((granted / total) * 100).toFixed(1)) : 100,
        activeUsers: activeUsers.rows[0]?.count || 0,
        activeAlerts: activeAlerts.rows[0]?.count || 0,
        totalDoors: totalDoors.rows[0]?.count || 0,
        totalRooms: totalRooms.rows[0]?.count || 0,
        totalBlocks: totalBlocks.rows[0]?.count || 0,
        activeSensors: activeSensors.rows[0]?.count || 0,
        byBlock: byBlockRes.rows || [],
        byRole: byRoleRes.rows || [],
        byReason: byReasonRes.rows || []
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener estadísticas: ' + error.message });
  }
};

/**
 * Obtiene el último evento de escaneo RFID registrado (para polling en Vercel)
 * GET /api/access/latest
 */
const getLatestScan = async (req, res) => {
  try {
    if (latestScanEvent) {
      return res.json({ success: true, data: latestScanEvent });
    }

    // Si aún no hubo escaneos en esta instancia serverless, consultar el último de PostgreSQL
    const lastLogQuery = await db.query(
      `SELECT l.*,
              (u.first_name || ' ' || u.last_name) as user_name,
              u.first_name, u.last_name, u.document_id, u.program, u.photo_url,
              r.display_name as role_name,
              d.name as door_name, d.status as door_status,
              rm.name as room_name, rm.has_alarm as room_has_alarm,
              b.name as block_name
       FROM access_logs l
       LEFT JOIN users u ON u.id = l.user_id
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN doors d ON d.id = l.door_id
       LEFT JOIN rooms rm ON rm.id = d.room_id
       LEFT JOIN blocks b ON b.id = rm.block_id
       ORDER BY l.timestamp DESC
       LIMIT 1`
    );

    if (lastLogQuery.rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    const last = lastLogQuery.rows[0];
    return res.json({
      success: true,
      data: {
        id: last.id,
        logId: last.id,
        granted: last.granted,
        denial_reason: last.denial_reason,
        timestamp: last.timestamp,
        uid: last.rfid_uid_raw,
        user: last.user_name ? {
          first_name: last.first_name,
          last_name: last.last_name,
          name: last.user_name,
          document_id: last.document_id,
          program: last.program,
          role: last.role_name
        } : null,
        door: { id: last.door_id, name: last.door_name, status: last.door_status },
        room: { name: last.room_name, block_name: last.block_name },
        alarm_triggered: !last.granted && last.room_has_alarm
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al consultar último escaneo: ' + error.message });
  }
};

/**
 * Analítica avanzada de telemetría institucional para Grafana
 * Picos por minuto/hora, estudiantes activos por carrera, afluencia semanal,
 * auditoría de infracciones, top espacios y comparativa temporal
 * GET /api/access/analytics
 */
const getAnalytics = async (req, res) => {
  try {
    // 1. Picos por hora (hoy en hora Colombia)
    const hourlyQuery = await db.query(`
      SELECT
        TO_CHAR(l.timestamp AT TIME ZONE 'America/Bogota', 'HH24:00') as time_slot,
        COUNT(*)::int as total,
        COUNT(CASE WHEN l.granted = true THEN 1 END)::int as granted,
        COUNT(CASE WHEN l.granted = false THEN 1 END)::int as denied
      FROM access_logs l
      WHERE (l.timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
      GROUP BY TO_CHAR(l.timestamp AT TIME ZONE 'America/Bogota', 'HH24:00')
      ORDER BY time_slot ASC
    `);

    // 2. Picos por minuto (últimos 60 minutos)
    const minuteQuery = await db.query(`
      SELECT
        TO_CHAR(l.timestamp AT TIME ZONE 'America/Bogota', 'HH24:MI') as time_slot,
        COUNT(*)::int as total,
        COUNT(CASE WHEN l.granted = true THEN 1 END)::int as granted,
        COUNT(CASE WHEN l.granted = false THEN 1 END)::int as denied
      FROM access_logs l
      WHERE l.timestamp >= NOW() - INTERVAL '60 minutes'
      GROUP BY TO_CHAR(l.timestamp AT TIME ZONE 'America/Bogota', 'HH24:MI')
      ORDER BY time_slot ASC
    `);

    // 3. Estudiantes actualmente en campus por carrera
    const studentsByProgramQuery = await db.query(`
      WITH last_student_access AS (
        SELECT DISTINCT ON (l.user_id)
          l.user_id,
          l.granted,
          l.timestamp,
          u.program
        FROM access_logs l
        JOIN users u ON u.id = l.user_id
        JOIN roles r ON r.id = u.role_id
        WHERE r.name = 'student'
          AND (l.timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
        ORDER BY l.user_id, l.timestamp DESC
      )
      SELECT
        COALESCE(NULLIF(TRIM(program), ''), 'Sin Carrera Asignada') as program,
        COUNT(*)::int as active_students
      FROM last_student_access
      WHERE granted = true
      GROUP BY program
      ORDER BY active_students DESC
    `);

    // 4. Afluencia semanal por día y carrera
    const weeklyByProgramQuery = await db.query(`
      SELECT
        TO_CHAR(l.timestamp AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') as date_str,
        TO_CHAR(l.timestamp AT TIME ZONE 'America/Bogota', 'Dy') as day_label,
        COALESCE(NULLIF(TRIM(u.program), ''), 'General') as program,
        COUNT(*)::int as count
      FROM access_logs l
      JOIN users u ON u.id = l.user_id
      WHERE l.granted = true
        AND (l.timestamp AT TIME ZONE 'America/Bogota')::date >= (NOW() AT TIME ZONE 'America/Bogota')::date - INTERVAL '6 days'
      GROUP BY date_str, day_label, program
      ORDER BY date_str ASC, count DESC
    `);

    // 5. Tráfico acumulado por Bloque
    const byBlockQuery = await db.query(`
      SELECT
        b.id,
        b.name as block_name,
        COUNT(l.id)::int as count
      FROM blocks b
      LEFT JOIN rooms r ON r.block_id = b.id
      LEFT JOIN doors d ON d.room_id = r.id
      LEFT JOIN access_logs l ON l.door_id = d.id AND (l.timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
      GROUP BY b.id, b.name
      ORDER BY b.id ASC
    `);

    // 6. Heatmap de intensidad de accesos (Día de la semana vs Hora)
    const heatmapQuery = await db.query(`
      SELECT
        EXTRACT(DOW FROM l.timestamp AT TIME ZONE 'America/Bogota')::int as dow,
        EXTRACT(HOUR FROM l.timestamp AT TIME ZONE 'America/Bogota')::int as hour,
        COUNT(*)::int as count
      FROM access_logs l
      WHERE (l.timestamp AT TIME ZONE 'America/Bogota')::date >= (NOW() AT TIME ZONE 'America/Bogota')::date - INTERVAL '14 days'
      GROUP BY dow, hour
      ORDER BY dow, hour
    `);

    // 7. Puertas con mayor tráfico hoy
    const topDoorsQuery = await db.query(`
      SELECT
        d.id,
        d.name as door_name,
        rm.name as room_name,
        b.name as block_name,
        COUNT(l.id)::int as count
      FROM doors d
      JOIN rooms rm ON rm.id = d.room_id
      JOIN blocks b ON b.id = rm.block_id
      LEFT JOIN access_logs l ON l.door_id = d.id AND (l.timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
      GROUP BY d.id, d.name, rm.name, b.name
      ORDER BY count DESC
      LIMIT 6
    `);

    // 8. Volumen Semanal Comparativo (Autorizados vs Denegados día a día)
    const weeklyVolumeQuery = await db.query(`
      SELECT
        TO_CHAR(l.timestamp AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') as date_str,
        TO_CHAR(l.timestamp AT TIME ZONE 'America/Bogota', 'Dy DD/MM') as day_label,
        COUNT(*)::int as total,
        COUNT(CASE WHEN l.granted = true THEN 1 END)::int as granted,
        COUNT(CASE WHEN l.granted = false THEN 1 END)::int as denied
      FROM access_logs l
      WHERE (l.timestamp AT TIME ZONE 'America/Bogota')::date >= (NOW() AT TIME ZONE 'America/Bogota')::date - INTERVAL '6 days'
      GROUP BY date_str, day_label
      ORDER BY date_str ASC
    `);

    // 9. Pareto de Causas de Denegación e Infracciones
    const denialReasonsQuery = await db.query(`
      SELECT
        COALESCE(l.denial_reason, 'Horario no permitido') as reason,
        COUNT(*)::int as count
      FROM access_logs l
      WHERE l.granted = false
      GROUP BY l.denial_reason
      ORDER BY count DESC
      LIMIT 6
    `);

    // 10. Distribución de Flujo por Rol Institucional Hoy
    const rolesDistQuery = await db.query(`
      SELECT
        COALESCE(r.display_name, 'No Asignado') as role_name,
        COUNT(l.id)::int as count
      FROM access_logs l
      LEFT JOIN users u ON u.id = l.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE (l.timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
      GROUP BY r.display_name
      ORDER BY count DESC
    `);

    // 11. Espacios y Laboratorios Más Ocupados Hoy
    const topRoomsQuery = await db.query(`
      SELECT
        rm.id,
        rm.name as room_name,
        b.name as block_name,
        COUNT(l.id)::int as count,
        COUNT(CASE WHEN l.granted = true THEN 1 END)::int as granted_count
      FROM rooms rm
      JOIN blocks b ON b.id = rm.block_id
      JOIN doors d ON d.room_id = rm.id
      LEFT JOIN access_logs l ON l.door_id = d.id AND (l.timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
      GROUP BY rm.id, rm.name, b.name
      ORDER BY count DESC
      LIMIT 6
    `);

    // 12. Comparativa Directa Hoy vs Ayer
    const comparisonQuery = await db.query(`
      SELECT
        COUNT(CASE WHEN (timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date THEN 1 END)::int as today_total,
        COUNT(CASE WHEN (timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date - INTERVAL '1 day' THEN 1 END)::int as yesterday_total,
        COUNT(CASE WHEN (timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date AND granted = true THEN 1 END)::int as today_granted,
        COUNT(CASE WHEN (timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date - INTERVAL '1 day' AND granted = true THEN 1 END)::int as yesterday_granted,
        COUNT(CASE WHEN (timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date AND granted = false THEN 1 END)::int as today_denied,
        COUNT(CASE WHEN (timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date - INTERVAL '1 day' AND granted = false THEN 1 END)::int as yesterday_denied
      FROM access_logs
      WHERE (timestamp AT TIME ZONE 'America/Bogota')::date >= (NOW() AT TIME ZONE 'America/Bogota')::date - INTERVAL '1 day'
    `);

    // 13. Concentración de Accesos por Categoría de Espacio
    const spaceTypesQuery = await db.query(`
      SELECT
        CASE
          WHEN LOWER(rm.name) LIKE '%lab%' OR LOWER(rm.name) LIKE '%cómputo%' OR LOWER(rm.name) LIKE '%hardware%' THEN 'Laboratorios Especializados'
          WHEN LOWER(rm.name) LIKE '%salón%' OR LOWER(rm.name) LIKE '%salon%' THEN 'Aulas de Clase'
          WHEN LOWER(rm.name) LIKE '%profesor%' OR LOWER(rm.name) LIKE '%cartera%' OR LOWER(b.name) LIKE '%admin%' THEN 'Áreas Administrativas'
          ELSE 'Accesos y Áreas Comunes'
        END as space_category,
        COUNT(l.id)::int as count
      FROM access_logs l
      JOIN doors d ON d.id = l.door_id
      JOIN rooms rm ON rm.id = d.room_id
      JOIN blocks b ON b.id = rm.block_id
      WHERE (l.timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
      GROUP BY space_category
      ORDER BY count DESC
    `);

    // 14. Tiempo Promedio de Permanencia en Campus
    const avgStayQuery = await db.query(`
      WITH user_daily_spans AS (
        SELECT
          user_id,
          MIN(timestamp) as first_scan,
          MAX(timestamp) as last_scan,
          EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) / 3600.0 as hours_diff
        FROM access_logs
        WHERE user_id IS NOT NULL
          AND (timestamp AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date
        GROUP BY user_id
        HAVING COUNT(*) > 1
      )
      SELECT
        ROUND(COALESCE(AVG(hours_diff), 3.8)::numeric, 1) as avg_hours,
        COUNT(*)::int as users_count
      FROM user_daily_spans
    `);

    return res.json({
      success: true,
      data: {
        hourly: hourlyQuery.rows || [],
        minute: minuteQuery.rows || [],
        studentsByProgram: studentsByProgramQuery.rows || [],
        weeklyByProgram: weeklyByProgramQuery.rows || [],
        byBlock: byBlockQuery.rows || [],
        heatmap: heatmapQuery.rows || [],
        topDoors: topDoorsQuery.rows || [],
        weeklyVolume: weeklyVolumeQuery.rows || [],
        denialReasons: denialReasonsQuery.rows || [],
        rolesDistribution: rolesDistQuery.rows || [],
        topRooms: topRoomsQuery.rows || [],
        comparison: comparisonQuery.rows[0] || {
          today_total: 0,
          yesterday_total: 0,
          today_granted: 0,
          yesterday_granted: 0,
          today_denied: 0,
          yesterday_denied: 0
        },
        spaceTypes: spaceTypesQuery.rows || [],
        avgStay: avgStayQuery.rows[0] || { avg_hours: 3.8, users_count: 0 }
      }
    });
  } catch (error) {
    console.error('Error en getAnalytics:', error);
    return res.status(500).json({ success: false, error: 'Error al consultar analítica en PostgreSQL: ' + error.message });
  }
};

module.exports = { validateAccess, getAccessLogs, getStats, getLatestScan, getAnalytics };
