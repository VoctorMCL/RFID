const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { getJwtSecret } = require('../config/security');
const sessionStore = require('../config/sessionStore');
const wsService = require('../services/wsService');

const normalizeDeviceId = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw.slice(0, 128) || 'terminal-sin-identificar';
};

const loginWithCard = async (req, res) => {
  try {
    const { rfid_uid, device_info, device_id } = req.body;

    if (!rfid_uid || !rfid_uid.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El UID de la tarjeta física RFID es obligatorio.'
      });
    }

    const cleanUid = rfid_uid.trim().replace(/[\s:\-]/g, '').toUpperCase();

    const result = await db.query(
      `SELECT c.id as card_id, c.uid, c.is_active as card_active, c.card_type,
              u.id as user_id, u.first_name, u.last_name, u.email, u.document_id,
              u.program, u.phone, u.status as user_status, u.photo_url,
              r.id as role_id, r.name as role_name, r.display_name as role_display, r.global_access
       FROM rfid_cards c
       JOIN users u ON u.id = c.user_id
       JOIN roles r ON u.role_id = r.id
       WHERE UPPER(c.uid) = $1`,
      [cleanUid]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: `Tarjeta RFID [${cleanUid}] no registrada en el sistema.`
      });
    }

    const user = result.rows[0];

    if (!user.card_active) {
      return res.status(403).json({
        success: false,
        error: 'Tarjeta RFID desactivada o suspendida por seguridad.'
      });
    }

    if (user.user_status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'La cuenta del titular de esta tarjeta está inactiva o suspendida.'
      });
    }

    const allowedWebRoles = ['admin', 'rector', 'security', 'celador'];
    const userRole = (user.role_name || '').toLowerCase();
    if (!allowedWebRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: `Acceso denegado: Esta tarjeta pertenece a un ${user.role_display}. Los estudiantes y docentes solo validan ingreso en puertas físicas.`
      });
    }

    const deviceId = normalizeDeviceId(device_id || req.headers['x-device-id']);
    const deviceString = device_info || req.headers['user-agent'] || 'Terminal Web';
    const clientIp = (req.headers['x-forwarded-for'] || req.ip || '')
      .toString()
      .split(',')[0]
      .trim()
      .slice(0, 64);

    const { sessionId: newSessionId } = await sessionStore.createSession({
      userId: user.user_id,
      deviceId,
      deviceInfo: deviceString,
      ipAddress: clientIp
    });

    await db.query(
      `UPDATE users
       SET active_session_id = $1,
           last_login_at = NOW(),
           last_login_device = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [newSessionId, deviceString, user.user_id]
    );

    const token = jwt.sign(
      {
        id: user.user_id,
        email: user.email,
        role_id: user.role_id,
        role_name: user.role_name,
        global_access: user.global_access,
        sessionId: newSessionId,
        deviceId
      },
      getJwtSecret(),
      { expiresIn: sessionStore.SESSION_TTL_MS / 1000 }
    );

    return res.json({
      success: true,
      message: `Bienvenido(a), ${user.first_name} ${user.last_name}`,
      data: {
        token,
        sessionId: newSessionId,
        deviceId,
        user: {
          id: user.user_id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          document_id: user.document_id,
          program: user.program,
          photo_url: user.photo_url || null,
          role_id: user.role_id,
          role: {
            id: user.role_id,
            name: user.role_name,
            display_name: user.role_display,
            global_access: user.global_access
          },
          status: user.user_status,
          rfid_tag: user.uid
        }
      }
    });
  } catch (error) {
    console.error('Error en login con tarjeta RFID:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno validando tarjeta RFID: ' + error.message
    });
  }
};

const logout = async (req, res) => {
  try {
    if (req.user?.id) {
      if (req.user.sessionId) {
        await sessionStore.revokeSession(req.user.sessionId, req.user.id);
      }
      // Solo limpiamos el marcador de "último ingreso" si pertenece a esta
      // misma sesión; nunca pisamos la sesión vigente de otro equipo.
      await db.query(
        `UPDATE users
         SET active_session_id = NULL
         WHERE id = $1 AND active_session_id = $2`,
        [req.user.id, req.user.sessionId || '']
      );
      // El silencio solo vale dentro de la sesión: al salir, el login vuelve a pitar.
      try {
        const r = await db.query(`UPDATE doors SET buzzer_muted = FALSE WHERE buzzer_muted = TRUE`);
        if (r.rowCount) wsService.broadcast('buzzer_mute_change', { muted: false });
      } catch (e) {}
    }
    return res.json({ success: true, message: 'Sesión finalizada exitosamente.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const me = async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.document_id, u.program, u.phone, u.status, u.photo_url,
              r.id as role_id, r.name as role_name, r.display_name as role_display, r.global_access
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado en la base de datos' });
    }

    const user = userResult.rows[0];
    const cardResult = await db.query(
      `SELECT uid FROM rfid_cards WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [user.id]
    );

    return res.json({
      success: true,
      data: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        document_id: user.document_id,
        program: user.program,
        photo_url: user.photo_url || null,
        role_id: user.role_id,
        role: {
          id: user.role_id,
          name: user.role_name,
          display_name: user.role_display,
          global_access: user.global_access
        },
        status: user.status,
        rfid_tag: cardResult.rows[0]?.uid || null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al consultar perfil: ' + error.message });
  }
};

module.exports = { loginWithCard, logout, me };
