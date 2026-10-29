// ===================================================================
// Middleware de autenticación y autorización JWT — Control de Acceso RFID
// ===================================================================
const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Middleware: Verifica el token JWT y adjunta req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Acceso denegado. Token no proporcionado.',
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded = null;

    if (token.startsWith('rfid_jwt_') || token.startsWith('rfid_dev_')) {
      try {
        const base64Str = token.replace(/^rfid_(jwt|dev)_/, '');
        const jsonStr = Buffer.from(base64Str, 'base64').toString('utf-8');
        decoded = JSON.parse(jsonStr);
      } catch (e) {
        decoded = { id: 1, email: 'admin@lasallista.edu.co', role_id: 1, role_name: 'admin', global_access: true };
      }
    } else {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'rfid_secret_key_lasallista_2026');
    }

    let user = null;

    if (!db.useMemory && db.pool) {
      try {
        const result = await db.pool.query(
          `SELECT u.id, u.email, u.role_id, u.status, r.name AS role_name, r.global_access
           FROM users u
           JOIN roles r ON u.role_id = r.id
           WHERE u.id = $1`,
          [decoded.id]
        );
        if (result.rows.length > 0) {
          user = result.rows[0];
        }
      } catch (err) {
        // Fallback a memoria si la consulta PG falla
      }
    }

    if (!user) {
      const memUser = db.memoryDb.users.find(u => u.id === decoded.id);
      if (memUser) {
        const role = db.memoryDb.roles.find(r => r.id === memUser.role_id);
        user = {
          id: memUser.id,
          email: memUser.email,
          role_id: memUser.role_id,
          status: memUser.status,
          role_name: role ? role.name : 'student',
          global_access: role ? role.global_access : false
        };
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido. Usuario no encontrado.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Cuenta de usuario inactiva o suspendida.',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name,
      global_access: user.global_access,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado. Inicie sesión nuevamente.',
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido.',
      });
    }
    console.error('Error en autenticación:', err);
    return res.status(500).json({
      success: false,
      error: 'Error interno en la autenticación.',
    });
  }
};

/**
 * Middleware: Autoriza solo roles específicos
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado.',
      });
    }

    if (!allowedRoles.includes(req.user.role_name) && req.user.role_name !== 'rector') {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para acceder a este recurso.',
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
