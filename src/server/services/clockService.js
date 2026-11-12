const db = require('../config/db');

// Reloj simulado para pruebas de horarios. Se guarda en la BD (system_settings)
// para que lo compartan todas las instancias serverless de Vercel.
const TZ = 'America/Bogota';
const KEY = 'simulated_clock';
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

const readSimulation = async () => {
  await ensureTable();
  const r = await db.query(`SELECT value FROM system_settings WHERE key = $1`, [KEY]);
  if (!r.rows.length) return null;
  try {
    const { simulated_at, set_at } = JSON.parse(r.rows[0].value);
    if (!Number.isFinite(simulated_at) || !Number.isFinite(set_at)) return null;
    return { simulated_at, set_at };
  } catch (e) {
    return null;
  }
};

// Hora "efectiva" del sistema: simulada (y avanzando) o real.
const getNow = async () => {
  try {
    const sim = await readSimulation();
    if (sim) return { date: new Date(sim.simulated_at + (Date.now() - sim.set_at)), simulated: true };
  } catch (e) {
    console.error('clockService.getNow:', e.message);
  }
  return { date: new Date(), simulated: false };
};

// Entrada: 'YYYY-MM-DDTHH:mm' en hora de Bogotá (UTC-5, sin horario de verano) o null para volver a la real.
const setSimulation = async (localDateTime) => {
  await ensureTable();
  if (localDateTime == null || localDateTime === '') {
    await db.query(`DELETE FROM system_settings WHERE key = $1`, [KEY]);
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime)) {
    throw new Error('Formato de fecha inválido (use YYYY-MM-DDTHH:mm)');
  }
  const ms = new Date(`${localDateTime}:00-05:00`).getTime();
  if (!Number.isFinite(ms)) throw new Error('Fecha inválida');
  await db.query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [KEY, JSON.stringify({ simulated_at: ms, set_at: Date.now() })]
  );
  return ms;
};

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Día de la semana (0=domingo) y hora HH:MM:SS en Bogotá, sin depender de la zona del servidor.
const bogotaParts = (date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return { day: DOW[parts.weekday], time: `${parts.hour}:${parts.minute}:${parts.second}` };
};

module.exports = { getNow, setSimulation, bogotaParts, TZ };
