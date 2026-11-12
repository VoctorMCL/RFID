const crypto = require('crypto');
const db = require('./db');

/**
 * Almacén de sesiones por dispositivo.
 *
 * El acceso web se organiza como "una sesión activa por puesto de trabajo"
 * (una por PC/navegador), no una sesión global por usuario. Así, dos equipos
 * pueden permanecer autenticados al mismo tiempo y cerrar sesión en uno no
 * afecta al otro.
 */

const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

let ensurePromise = null;

const ensureSessionTable = () => {
  if (!ensurePromise) {
    ensurePromise = db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id VARCHAR(128) NOT NULL,
        device_info TEXT,
        ip_address VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_device
        ON user_sessions (user_id, device_id);

      CREATE INDEX IF NOT EXISTS idx_user_sessions_active
        ON user_sessions (user_id, expires_at)
        WHERE revoked_at IS NULL;
    `).catch((error) => {
      // En arranques concurrentes (serverless) PostgreSQL puede reportar que
      // otra instancia creó la tabla al mismo tiempo. En ese caso ya existe.
      if (error.code === '42P07' || error.code === '23505') {
        return;
      }
      // Permitir reintentos si la creación falló por otra causa.
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
};

const createSession = async ({ userId, deviceId, deviceInfo, ipAddress }) => {
  await ensureSessionTable();

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // Una nueva autenticación reemplaza únicamente la sesión anterior del mismo
  // equipo. Las sesiones de otros PCs quedan intactas.
  await db.query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL`,
    [userId, deviceId]
  );

  await db.query(
    `INSERT INTO user_sessions
       (id, user_id, device_id, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, userId, deviceId, deviceInfo || null, ipAddress || null, expiresAt]
  );

  return { sessionId, expiresAt };
};

const isSessionActive = async (sessionId, userId) => {
  if (!sessionId) return false;
  await ensureSessionTable();

  const result = await db.query(
    `SELECT 1
     FROM user_sessions
     WHERE id = $1
       AND user_id = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [sessionId, userId]
  );

  return result.rows.length > 0;
};

const touchSession = async (sessionId) => {
  if (!sessionId) return;
  // Se actualiza como máximo una vez por minuto para no generar una escritura
  // por cada petición de los paneles que hacen polling.
  await db.query(
    `UPDATE user_sessions
     SET last_seen_at = NOW()
     WHERE id = $1
       AND revoked_at IS NULL
       AND last_seen_at < NOW() - INTERVAL '60 seconds'`,
    [sessionId]
  ).catch(() => {});
};

const revokeSession = async (sessionId, userId) => {
  if (!sessionId) return;
  await ensureSessionTable();
  await db.query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [sessionId, userId]
  );
};

const revokeExpiredSessions = async () => {
  await ensureSessionTable();
  await db.query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE revoked_at IS NULL AND expires_at <= NOW()`
  ).catch(() => {});
};

module.exports = {
  SESSION_TTL_MS,
  ensureSessionTable,
  createSession,
  isSessionActive,
  touchSession,
  revokeSession,
  revokeExpiredSessions
};
