require('dotenv').config();
const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[DATABASE CRITICAL] La variable de entorno DATABASE_URL no está configurada.');
  } else {
    console.warn('[DATABASE WARNING] DATABASE_URL no definida. Configure su archivo .env con la conexión segura.');
  }
}

const isCloud = Boolean(
  databaseUrl &&
  !databaseUrl.includes('localhost') &&
  !databaseUrl.includes('127.0.0.1')
);

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

const pool = new Pool({
  connectionString: databaseUrl || 'postgresql://localhost:5432/rfid_db',
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: isServerless ? 1000 : 15000,
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : (isServerless ? 1 : 10),
  allowExitOnIdle: true,
  ...(isCloud ? { ssl: { rejectUnauthorized: false } } : {})
});

pool.on('error', (err) => {
  console.error('Error no controlado en el pool de PostgreSQL:', err.message);
});

if (!isServerless) {
  pool.query('SELECT NOW() as server_time', (err, res) => {
    if (err) {
      console.error('[DATABASE] No se pudo conectar a PostgreSQL / Supabase:', err.message);
      console.error('Verifique la variable DATABASE_URL y la conexión a internet.');
    } else {
      console.log('[DATABASE] Conectado a PostgreSQL / Supabase:', res.rows[0].server_time);
    }
  });
}

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query
};
