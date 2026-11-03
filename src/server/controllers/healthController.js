// ===================================================================
// Controlador de Salud del Sistema — Control de Acceso RFID
// Verifica la conexión a PostgreSQL y la actividad reciente del lector
// ===================================================================
const db = require('../config/db');

const READER_FRESHNESS_MS = 90 * 1000;

/**
 * Comprueba el estado de la base de datos y del lector RFID.
 * @returns {Promise<{database: object, reader: object, status: string}>}
 */
const getSystemHealth = async () => {
  const startedAt = Date.now();

  let databaseConnected = false;
  let databaseLatency = null;
  let databaseError = null;

  try {
    await db.query('SELECT 1');
    databaseConnected = true;
    databaseLatency = Date.now() - startedAt;
  } catch (error) {
    databaseError = error.message;
  }

  let readerConnected = false;
  let lastHeartbeat = null;

  // El lector se reporta en línea si alguna puerta envió un heartbeat
  // dentro de la ventana de frescura (90 s), igual que en /doors.
  if (databaseConnected) {
    try {
      const result = await db.query(
        `SELECT MAX(last_heartbeat) AS last_heartbeat
           FROM doors
          WHERE last_heartbeat IS NOT NULL`
      );
      const rawHeartbeat = result.rows[0]?.last_heartbeat || null;
      if (rawHeartbeat) {
        lastHeartbeat = new Date(rawHeartbeat).toISOString();
        readerConnected = Date.now() - new Date(rawHeartbeat).getTime() < READER_FRESHNESS_MS;
      }
    } catch (error) {
      // Si falla la consulta de puertas no se invalida la base de datos;
      // simplemente se informa el lector como desconectado.
      databaseError = databaseError || error.message;
    }
  }

  return {
    status: databaseConnected ? (readerConnected ? 'ok' : 'degraded') : 'down',
    database: {
      connected: databaseConnected,
      latency_ms: databaseLatency,
      ...(databaseError ? { error: databaseError } : {})
    },
    reader: {
      connected: readerConnected,
      last_heartbeat: lastHeartbeat
    }
  };
};

/**
 * Endpoint público de salud del sistema.
 * @route GET /api/health
 * @route GET /health
 */
const getHealth = async (req, res) => {
  const health = await getSystemHealth();

  return res.json({
    success: true,
    ...health,
    system: 'Control de Acceso RFID Institucional',
    institution: 'Corporación Universitaria Lasallista',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  getHealth
};
