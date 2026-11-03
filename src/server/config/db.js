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

const pool = new Pool({
  connectionString: databaseUrl || 'postgresql://localhost:5432/rfid_db',
  connectionTimeoutMillis: 12000,
  idleTimeoutMillis: 30000,
  max: 15,
  ...(isCloud ? { ssl: { rejectUnauthorized: false } } : {})
});

pool.on('error', (err) => {
  console.error('Error no controlado en el pool de PostgreSQL:', err.message);
});

pool.query('SELECT NOW() as server_time', (err, res) => {
  if (err) {
    console.error('[DATABASE] No se pudo conectar a PostgreSQL / Supabase:', err.message);
    console.error('Verifique la variable DATABASE_URL y la conexión a internet.');
  } else {
    console.log('[DATABASE] Conectado a PostgreSQL / Supabase:', res.rows[0].server_time);
  }
});

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query
};
