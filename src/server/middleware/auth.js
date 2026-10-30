// ===================================================================
// Middleware de autenticación y autorización JWT — Control de Acceso RFID
// Seguridad Reforzada: Sesión Única por Dispositivo y Expiración Estricta
// ===================================================================
const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Middleware: Verifica el token JWT, valida sesión única activa y adjunta req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        code: 'NO_TOKEN',
        error: 'Acceso denegado. Se requiere iniciar sesión con tarjeta RFID.',
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded = null;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'rfid_secret_key_lasallista_2026');
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          error: 'Su sesión ha expirado por tiempo límite. Aproxime su tarjeta RFID para ingresar nuevamente.',
        });
      }
      return res.status(401).json({
        success: false,
        code: 'INVALID_TOKEN',
        error: 'Token de autenticación inválido o alterado.',
      });
    }

    let user = null;
    try {
      const result = await db.query(
        `SELECT u.id, u.email, u.role_id, u.status, u.active_session_id,
                r.name AS role_name, r.global_access
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [decoded.id]
      );
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    } catch (dbErr) {
      console.error('Error verificando usuario en PostgreSQL:', dbErr.message);
      return res.status(500).json({
        success: false,
        error: 'Error consultando base de datos de usuarios.',
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        error: 'Usuario no encontrado en la base de datos.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        code: 'USER_INACTIVE',
        error: 'Cuenta de usuario inactiva o suspendida.',
      });
    }

    // 🔒 POLÍTICA DE SEGURIDAD: Solo 1 sesión activa por dispositivo / puesto
    // Si la sesión del token no coincide con active_session_id en la BD, fue cerrada por otro login
    if (decoded.sessionId && user.active_session_id && decoded.sessionId !== user.active_session_id) {
      return res.status(401).json({
        success: false,
        code: 'SESSION_TERMINATED',
        error: 'Sesión finalizada: Se ha iniciado sesión desde otro dispositivo o puesto de control.',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name,
      global_access: user.global_access,
      sessionId: decoded.sessionId || user.active_session_id,
    };

    next();
  } catch (err) {
    console.error('Error en autenticación:', err);
    return res.status(500).json({
      success: false,
      error: 'Error interno en la autenticación del servidor.',
    });
  }
};

/**
 * Middleware: Autoriza solo roles específicos (Admin y Rector tienen superacceso siempre)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado.',
      });
    }

    const isSuperRole = req.user.role_name === 'admin' || req.user.role_name === 'rector';
    if (!isSuperRole && !allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para acceder a este recurso administrativo.',
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
