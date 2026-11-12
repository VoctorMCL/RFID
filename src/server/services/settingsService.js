const db = require('../config/db');

// Ajustes clave/valor compartidos entre instancias serverless (tabla system_settings).
let tableReady = false;
const ensureTable = async () => {
  if (tableReady) return;
  await db.query(
    `CREATE TABLE IF NOT EXISTS system_settings (
       key TEXT PRIMARY KEY,
       value TEXT NOT NULL,
       updated_at TIMESTAMPTZ DEFAULT NOW()
     )`
  );
  tableReady = true;
};

const getSetting = async (key) => {
  await ensureTable();
  const r = await db.query(`SELECT value FROM system_settings WHERE key = $1`, [key]);
  return r.rows.length ? r.rows[0].value : null;
};

const setSetting = async (key, value) => {
  await ensureTable();
  if (value == null) {
    await db.query(`DELETE FROM system_settings WHERE key = $1`, [key]);
    return;
  }
  await db.query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, String(value)]
  );
};

module.exports = { getSetting, setSetting };
