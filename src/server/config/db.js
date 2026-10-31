// ===================================================================
// Cliente de Base de Datos PostgreSQL / Supabase
// Conexión Directa y Obligatoria — Control de Acceso RFID Institucional
// ===================================================================
require('dotenv').config();
const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL || 'postgresql://victormcl:rfid2026@localhost:5432/rfid_db';

const isCloud = databaseUrl &&
  !databaseUrl.includes('localhost') &&
  !databaseUrl.includes('127.0.0.1');

/**
 * Pool de conexiones a PostgreSQL / Supabase
 */
const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 12000,
  idleTimeoutMillis: 30000,
  max: 15,
  ...(isCloud ? { ssl: { rejectUnauthorized: false } } : {})
});

pool.on('error', (err) => {
  console.error('❌ Error no controlado en el pool de PostgreSQL:', err.message);
});

// Prueba de conectividad inmediata
pool.query('SELECT NOW() as server_time', (err, res) => {
  if (err) {
    console.error('❌ [DATABASE] No se pudo conectar a PostgreSQL / Supabase:', err.message);
    console.error('   Verifique la variable DATABASE_URL y la conexión a internet.');
  } else {
    console.log('✅ [DATABASE] Conectado exitosamente a PostgreSQL / Supabase a las', res.rows[0].server_time);
  }
});

/**
 * Ejecuta una consulta SQL parametrizada sobre el pool de PostgreSQL
 * @param {string} text - Sentencia SQL con placeholders $1, $2, etc.
 * @param {Array<any>} [params] - Parámetros de la consulta
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query
};
