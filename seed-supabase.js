const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const STUDENTS = [
  { first: 'Mateo', last: 'Gómez Restrepo', doc: '1037654120', prog: 'Ingeniería de Sistemas', role: 5, uid: 'E4A23B10' },
  { first: 'Valentina', last: 'Ochoa Calle', doc: '1037654121', prog: 'Medicina Veterinaria', role: 5, uid: 'A1B2C3D4' },
  { first: 'Sebastián', last: 'Arboleda Ríos', doc: '1037654122', prog: 'Zootecnia', role: 5, uid: '9F8E7D6C' },
  { first: 'Camila', last: 'Londoño Pérez', doc: '1037654123', prog: 'Ingeniería de Alimentos', role: 5, uid: '12345678' },
  { first: 'Santiago', last: 'Zapata Montoya', doc: '1037654124', prog: 'Ingeniería de Sistemas', role: 5, uid: '87654321' },
  { first: 'Mariana', last: 'Cardona Mesa', doc: '1037654125', prog: 'Administración de Empresas', role: 5, uid: 'A0B1C2D3' },
  { first: 'Daniel', last: 'Henao Quintero', doc: '1037654126', prog: 'Derecho', role: 5, uid: 'D4C3B2A1' },
  { first: 'Isabella', last: 'Castrillón Ruiz', doc: '1037654127', prog: 'Medicina Veterinaria', role: 5, uid: '5E6F7A8B' },
  { first: 'Nicolás', last: 'Vásquez Posada', doc: '1037654128', prog: 'Zootecnia', role: 5, uid: 'F1E2D3C4' },
  { first: 'Sofía', last: 'Echeverri Jaramillo', doc: '1037654129', prog: 'Ingeniería de Alimentos', role: 5, uid: 'B4A39281' },
  { first: 'Alejandro', last: 'Morales Correa', doc: '1037654130', prog: 'Ingeniería de Sistemas', role: 5, uid: '7890ABCD' },
  { first: 'Laura', last: 'Ceballos Toro', doc: '1037654131', prog: 'Licenciatura en Educación', role: 5, uid: 'CDEF1234' },
  { first: 'Carlos', last: 'Duque Roldán', doc: '71234567', prog: 'Ingeniería de Sistemas', role: 4, uid: 'DOC12345' }, // Docente
  { first: 'Elena', last: 'Álvarez Peláez', doc: '43987654', prog: 'Medicina Veterinaria', role: 4, uid: 'DOC67890' } // Docente
];

const DENIAL_REASONS = [
  'Tarjeta no registrada en el sistema',
  'Fuera de articulación horaria asignada',
  'Área restringida para este rol',
  'Tarjeta inactiva o revocada',
  'Acceso expirado'
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🔄 Iniciando sembrado de datos en Supabase...');

    // 1. Insertar o actualizar usuarios
    const userIds = [];
    for (const s of STUDENTS) {
      const email = `${s.first.toLowerCase()}.${s.last.split(' ')[0].toLowerCase()}@lasallista.edu.co`;
      const res = await client.query(`
        INSERT INTO users (first_name, last_name, document_id, email, password_hash, program, role_id, status)
        VALUES ($1, $2, $3, $4, '$2a$10$YourHashedPasswordPlaceholderHere', $5, $6, 'active')
        ON CONFLICT (document_id) DO UPDATE
        SET program = EXCLUDED.program, role_id = EXCLUDED.role_id, status = 'active'
        RETURNING id;
      `, [s.first, s.last, s.doc, email, s.prog, s.role]);
      const uid = res.rows[0].id;
      userIds.push({ ...s, id: uid });

      // Registrar su tarjeta RFID
      await client.query(`
        INSERT INTO rfid_cards (uid, user_id, is_active, card_type, label)
        VALUES ($1, $2, true, 'standard', 'Carnet Institucional')
        ON CONFLICT (uid) DO UPDATE
        SET user_id = EXCLUDED.user_id, is_active = true;
      `, [s.uid, uid]);
    }
    console.log(`✅ ${userIds.length} estudiantes y docentes asegurados.`);

    // 2. Obtener puertas
    const doorsRes = await client.query('SELECT id, name FROM doors ORDER BY id');
    const doors = doorsRes.rows;
    if (doors.length === 0) throw new Error('No hay puertas en la BD');

    // 3. Generar logs para los últimos 14 días (incluyendo ayer y hoy)
    console.log('⏳ Generando histórico de logs de acceso (últimos 14 días)...');
    
    // Limpiar logs anteriores para evitar duplicados masivos
    await client.query('DELETE FROM access_logs;');

    const now = new Date();
    const logs = [];

    // Para cada día desde hace 13 días hasta hoy (día 0)
    for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - dayOffset);
      const isToday = dayOffset === 0;
      const dayOfWeek = targetDate.getDay(); // 0 Dom, 6 Sab
      if (dayOfWeek === 0) continue; // Domingo casi no hay clases

      // Cantidad de accesos para este día: entre 35 y 85 accesos
      const maxHour = isToday ? now.getHours() : 21;
      const baseCount = isToday ? Math.max(15, Math.floor((maxHour / 22) * 60)) : Math.floor(Math.random() * 40) + 45;

      for (let i = 0; i < baseCount; i++) {
        // Horarios pico: 7-9, 12-14, 17-19
        let hour;
        const rand = Math.random();
        if (rand < 0.4) {
          hour = 7 + Math.floor(Math.random() * 3); // 7, 8, 9
        } else if (rand < 0.7) {
          hour = 12 + Math.floor(Math.random() * 3); // 12, 13, 14
        } else if (rand < 0.9) {
          hour = 17 + Math.floor(Math.random() * 3); // 17, 18, 19
        } else {
          hour = 10 + Math.floor(Math.random() * 2); // 10, 11
        }

        if (hour > maxHour) hour = Math.max(7, maxHour - Math.floor(Math.random() * 3));
        const minute = Math.floor(Math.random() * 60);
        const second = Math.floor(Math.random() * 60);

        const logTime = new Date(targetDate);
        logTime.setHours(hour, minute, second, 0);

        const student = userIds[Math.floor(Math.random() * userIds.length)];
        const door = doors[Math.floor(Math.random() * doors.length)];

        // 94% de probabilidad de acceso concedido, 6% denegado
        const isGranted = Math.random() < 0.93;
        const denialReason = isGranted ? null : DENIAL_REASONS[Math.floor(Math.random() * DENIAL_REASONS.length)];

        logs.push({
          rfid_uid_raw: isGranted ? student.uid : (Math.random() < 0.5 ? student.uid : 'F9A8B7C6'),
          user_id: isGranted ? student.id : (Math.random() < 0.5 ? student.id : null),
          door_id: door.id,
          granted: isGranted,
          denial_reason: denialReason,
          access_method: 'rfid_nfc',
          timestamp: logTime.toISOString()
        });
      }
    }

    // Insertar en baches
    console.log(`📦 Insertando ${logs.length} eventos de acceso en Supabase...`);
    for (const log of logs) {
      await client.query(`
        INSERT INTO access_logs (rfid_uid_raw, user_id, door_id, granted, denial_reason, access_method, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, [log.rfid_uid_raw, log.user_id, log.door_id, log.granted, log.denial_reason, log.access_method, log.timestamp]);
    }

    // Actualizar heartbeat de una puerta para que el sensor RFID se vea activo si es hoy
    await client.query(`
      UPDATE doors
      SET last_heartbeat = NOW(), status = 'online'
      WHERE id = 1;
    `);

    console.log('🎉 Sembrado completado exitosamente con histórico de 14 días.');
  } catch (err) {
    console.error('❌ Error sembrando base de datos:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
