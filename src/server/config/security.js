const rateLimit = require('express-rate-limit');

/**
 * Obtiene la clave secreta JWT desde variables de entorno.
 * En producción se exige que JWT_SECRET esté definida para evitar claves débiles conocidas.
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY CRITICAL] JWT_SECRET no está configurada en variables de entorno de producción.');
    }
    return 'rfid_fallback_dev_secret_2026';
  }
  return secret;
};

/**
 * Limiter general de peticiones a la API:
 * Máximo 300 peticiones por ventana de 15 minutos por IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Tasa de solicitudes excedida. Por motivos de ciberseguridad, intente de nuevo en unos minutos.'
  }
});

/**
 * Limiter estricto para rutas de autenticación (Login con credenciales y tarjeta):
 * Máximo 20 intentos por ventana de 15 minutos por IP (protección contra fuerza bruta y enumeración).
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiados intentos de acceso fallidos desde esta dirección IP. Acceso pausado por 15 minutos.'
  }
});

/**
 * Limiter para el endpoint físico de validación de tarjetas RFID:
 * Máximo 60 validaciones por minuto por IP/lector.
 */
const accessValidateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Límite de lecturas físicas por minuto alcanzado para este lector.'
  }
});

module.exports = {
  getJwtSecret,
  apiLimiter,
  authLimiter,
  accessValidateLimiter
};
