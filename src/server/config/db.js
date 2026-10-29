// ===================================================================
// Configuración de base de datos PostgreSQL con fallback en memoria
// Control de Acceso RFID Institucional
// ===================================================================
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

let useMemoryStore = false;
let pool = null;

// Semilla inicial en memoria (sincronizada con seed.sql)
const memoryDb = {
  roles: [
    { id: 1, name: 'admin', display_name: 'Administrador del Sistema', global_access: true, description: 'Acceso total a la configuración y gestión del campus.' },
    { id: 2, name: 'rector', display_name: 'Rectora / Administración Alta', global_access: true, description: 'Acceso total a TODAS las puertas y bloques del campus en cualquier momento.' },
    { id: 3, name: 'professor', display_name: 'Profesor / Docente', global_access: false, description: 'Acceso condicionado a su articulación horaria.' },
    { id: 4, name: 'student', display_name: 'Estudiante', global_access: false, description: 'Acceso limitado a áreas comunes como biblioteca.' },
    { id: 5, name: 'security', display_name: 'Vigilante / Celador', global_access: true, description: 'Fichas maestras RFID con privilegios de anulación.' },
    { id: 6, name: 'admin_staff', display_name: 'Personal Administrativo', global_access: false, description: 'Acceso a bloques administrativos según decanatura.' }
  ],
  users: [
    { id: 1, first_name: 'Administrador', last_name: 'General', email: 'admin@lasallista.edu.co', password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', document_id: '1000000000', role_id: 1, program: 'Sistemas', status: 'active', phone: '3000000000', photo_url: null },
    { id: 2, first_name: 'Celador', last_name: 'de Seguridad / Portería', email: 'celador@lasallista.edu.co', password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', document_id: '1000000008', role_id: 5, program: 'Seguridad', status: 'active', phone: '3008901234', photo_url: null },
    { id: 3, first_name: 'María Elena', last_name: 'Gómez Ramírez', email: 'rectora@lasallista.edu.co', password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', document_id: '1000000001', role_id: 2, program: 'Rectoría', status: 'active', phone: '3001234567', photo_url: null },
    { id: 4, first_name: 'Carlos Andrés', last_name: 'López Mejía', email: 'carlos.lopez@lasallista.edu.co', password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', document_id: '1000000002', role_id: 3, program: 'Ingeniería de Software', status: 'active', phone: '3002345678', photo_url: null },
    { id: 5, first_name: 'Ana María', last_name: 'Restrepo Vélez', email: 'ana.restrepo@lasallista.edu.co', password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', document_id: '1000000003', role_id: 3, program: 'Ingeniería de Sistemas', status: 'active', phone: '3003456789', photo_url: null },
    { id: 6, first_name: 'Victor Manuel', last_name: 'Cordoba Larez', email: 'victor.cordoba@lasallista.edu.co', password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', document_id: '1152345678', role_id: 4, program: 'Ingeniería de Software', status: 'active', phone: '3004567890', photo_url: null },
    { id: 7, first_name: 'Camila Andrea', last_name: 'Martínez Torres', email: 'camila.martinez@lasallista.edu.co', password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', document_id: '1000000005', role_id: 4, program: 'Administración de Empresas', status: 'active', phone: '3005678901', photo_url: null },
    { id: 8, first_name: 'Jorge Enrique', last_name: 'Hernández Castro', email: 'vigilancia1@lasallista.edu.co', password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', document_id: '1000000006', role_id: 5, program: 'Seguridad', status: 'active', phone: '3006789012', photo_url: null },
    { id: 9, first_name: 'Patricia', last_name: 'Ríos Duque', email: 'patricia.rios@lasallista.edu.co', password_hash: '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', document_id: '1000000007', role_id: 6, program: 'Decanatura', status: 'active', phone: '3007890123', photo_url: null }
  ],
  blocks: [
    { id: 1, name: 'Bloque A', description: 'Bloque académico principal — Laboratorios de Informática e Ingeniería', location_info: 'Costado norte del campus', is_active: true },
    { id: 2, name: 'Bloque B', description: 'Bloque académico secundario — Aulas de clase y biblioteca', location_info: 'Costado sur del campus', is_active: true },
    { id: 3, name: 'Bloque C', description: 'Bloque de servicios — Auditorio y áreas comunes', location_info: 'Costado occidental del campus', is_active: true },
    { id: 4, name: 'Bloque Administrativo', description: 'Decanatura, RRHH, Oficinas de profesores, Admisiones y Financiero', location_info: 'Edificio central del campus', is_active: true }
  ],
  rooms: [
    { id: 1, block_id: 1, name: 'Sala de Informática 1', floor: 1, room_type: 'lab_informatica', has_alarm: true, has_camera: true, motion_sensors: 2, door_sensors: 1, security_status: 'armed', description: 'Piloto inicial de control de acceso. Alarma integrada con sensores de movimiento y puerta.' },
    { id: 2, block_id: 1, name: 'Sala de Informática 2', floor: 1, room_type: 'lab_informatica', has_alarm: false, has_camera: false, motion_sensors: 0, door_sensors: 0, security_status: 'normal', description: 'Laboratorio de informática general.' },
    { id: 3, block_id: 1, name: 'Sala de Informática 3', floor: 2, room_type: 'lab_informatica', has_alarm: false, has_camera: false, motion_sensors: 0, door_sensors: 0, security_status: 'normal', description: 'Laboratorio de informática — segundo piso.' },
    { id: 4, block_id: 1, name: 'Sala de Informática 4', floor: 2, room_type: 'lab_informatica', has_alarm: false, has_camera: false, motion_sensors: 0, door_sensors: 0, security_status: 'normal', description: 'Laboratorio de informática — segundo piso.' },
    { id: 5, block_id: 1, name: 'Sala de Informática 5', floor: 3, room_type: 'lab_informatica', has_alarm: false, has_camera: false, motion_sensors: 0, door_sensors: 0, security_status: 'normal', description: 'Laboratorio de informática — tercer piso.' },
    { id: 6, block_id: 1, name: 'Sala de Informática 6', floor: 3, room_type: 'lab_informatica', has_alarm: false, has_camera: false, motion_sensors: 0, door_sensors: 0, security_status: 'normal', description: 'Laboratorio de informática — tercer piso.' },
    { id: 7, block_id: 1, name: 'Taller de Ingeniería', floor: 1, room_type: 'lab_ingenieria', has_alarm: false, has_camera: false, motion_sensors: 0, door_sensors: 0, security_status: 'normal', description: 'Sala de taller práctico de ingeniería.' },
    { id: 8, block_id: 2, name: 'Biblioteca Central', floor: 1, room_type: 'biblioteca', has_alarm: false, has_camera: true, motion_sensors: 0, door_sensors: 0, security_status: 'normal', description: 'Biblioteca principal — acceso para estudiantes en horarios establecidos.' },
    { id: 9, block_id: 4, name: 'Decanatura y Profesores', floor: 2, room_type: 'administrativo', has_alarm: false, has_camera: false, motion_sensors: 0, door_sensors: 0, security_status: 'normal', description: 'Oficinas de decanatura y sala de profesores.' },
    { id: 10, block_id: 4, name: 'Administrativo Financiero y Contable', floor: 1, room_type: 'financiero', has_alarm: false, has_camera: false, motion_sensors: 0, door_sensors: 0, security_status: 'normal', description: 'Oficina financiera y contable.' },
    { id: 11, block_id: 4, name: 'Admisiones', floor: 1, room_type: 'administrativo', has_alarm: false, has_camera: false, motion_sensors: 0, door_sensors: 0, security_status: 'normal', description: 'Oficina de admisiones — primera planta.' }
  ],
  doors: [
    { id: 1, room_id: 1, name: 'Puerta Principal — Sala Informática 1', door_type: 'main', hardware_ip: '192.168.1.100', mac_address: 'AA:BB:CC:DD:EE:01', status: 'online', is_locked: true, last_heartbeat: new Date().toISOString() },
    { id: 2, room_id: 1, name: 'Puerta Lateral Derecha — Lab. Ingeniería', door_type: 'lateral', hardware_ip: '192.168.1.101', mac_address: 'AA:BB:CC:DD:EE:02', status: 'online', is_locked: true, last_heartbeat: new Date().toISOString() }
  ],
  rfid_cards: [
    { id: 1, uid: 'A1B2C3D4', user_id: 1, card_type: 'master', is_active: true, label: 'Tarjeta Rectora', enrolled_at: '2026-02-01T08:00:00Z' },
    { id: 2, uid: 'E5F6A7B8', user_id: 2, card_type: 'standard', is_active: true, label: 'Tarjeta Prof. López', enrolled_at: '2026-02-01T08:30:00Z' },
    { id: 3, uid: 'C9D0E1F2', user_id: 3, card_type: 'standard', is_active: true, label: 'Tarjeta Prof. Restrepo', enrolled_at: '2026-02-01T09:00:00Z' },
    { id: 4, uid: '11223344', user_id: 4, card_type: 'standard', is_active: true, label: 'Tarjeta Victor Cordoba', enrolled_at: '2026-02-01T09:30:00Z' },
    { id: 5, uid: '55667788', user_id: 5, card_type: 'standard', is_active: true, label: 'Tarjeta Camila Martínez', enrolled_at: '2026-02-01T10:00:00Z' },
    { id: 6, uid: 'AABBCCDD', user_id: 6, card_type: 'master', is_active: true, label: 'Ficha Maestra Vigilancia', enrolled_at: '2026-02-01T10:30:00Z' },
    { id: 7, uid: 'EEFF0011', user_id: 7, card_type: 'standard', is_active: true, label: 'Tarjeta Patricia Ríos', enrolled_at: '2026-02-01T11:00:00Z' }
  ],
  schedules: [
    { id: 1, user_id: 2, room_id: 1, day_of_week: 1, start_time: '07:00:00', end_time: '09:00:00', semester: '2026-2', subject_name: 'Programación Orientada a Objetos', is_active: true },
    { id: 2, user_id: 2, room_id: 1, day_of_week: 3, start_time: '07:00:00', end_time: '09:00:00', semester: '2026-2', subject_name: 'Programación Orientada a Objetos', is_active: true },
    { id: 3, user_id: 2, room_id: 2, day_of_week: 2, start_time: '09:00:00', end_time: '11:00:00', semester: '2026-2', subject_name: 'Bases de Datos', is_active: true },
    { id: 4, user_id: 3, room_id: 1, day_of_week: 2, start_time: '14:00:00', end_time: '16:00:00', semester: '2026-2', subject_name: 'Ingeniería de Software', is_active: true },
    { id: 5, user_id: 3, room_id: 3, day_of_week: 4, start_time: '10:00:00', end_time: '12:00:00', semester: '2026-2', subject_name: 'Arquitectura de Computadores', is_active: true },
    { id: 6, user_id: 4, room_id: 8, day_of_week: 1, start_time: '07:00:00', end_time: '20:00:00', semester: '2026-2', subject_name: 'Acceso Biblioteca', is_active: true },
    { id: 7, user_id: 4, room_id: 8, day_of_week: 2, start_time: '07:00:00', end_time: '20:00:00', semester: '2026-2', subject_name: 'Acceso Biblioteca', is_active: true },
    { id: 8, user_id: 4, room_id: 8, day_of_week: 3, start_time: '07:00:00', end_time: '20:00:00', semester: '2026-2', subject_name: 'Acceso Biblioteca', is_active: true },
    { id: 9, user_id: 4, room_id: 8, day_of_week: 4, start_time: '07:00:00', end_time: '20:00:00', semester: '2026-2', subject_name: 'Acceso Biblioteca', is_active: true },
    { id: 10, user_id: 4, room_id: 8, day_of_week: 5, start_time: '07:00:00', end_time: '20:00:00', semester: '2026-2', subject_name: 'Acceso Biblioteca', is_active: true }
  ],
  access_logs: [
    { id: 1, user_id: 2, door_id: 1, rfid_card_id: 2, rfid_uid_raw: 'E5F6A7B8', timestamp: new Date(Date.now() - 3600000).toISOString(), access_method: 'rfid', granted: true, denial_reason: null, notes: 'Ingreso a clase' },
    { id: 2, user_id: 4, door_id: 1, rfid_card_id: 4, rfid_uid_raw: '11223344', timestamp: new Date(Date.now() - 2500000).toISOString(), access_method: 'rfid', granted: false, denial_reason: 'schedule_violation', notes: 'Sin clase asignada en Sala 1' },
    { id: 3, user_id: 6, door_id: 1, rfid_card_id: 6, rfid_uid_raw: 'AABBCCDD', timestamp: new Date(Date.now() - 1200000).toISOString(), access_method: 'master_key', granted: true, denial_reason: null, notes: 'Ronda de seguridad' }
  ],
  alerts: [
    { id: 1, door_id: 1, room_id: 1, sensor_type: 'alarm_triggered', severity: 'critical', message: 'Alarma activada en Sala de Informática 1 — Apertura no autorizada sin aviso a seguridad', timestamp: new Date(Date.now() - 600000).toISOString(), is_resolved: false, resolved_by: null, resolved_at: null, resolution_note: null, email_sent: true }
  ],
  alarm_zones: [
    { id: 1, room_id: 1, zone_name: 'Zona Alarma — Sala Informática 1', requires_security_clearance: true, is_armed: true, armed_at: new Date().toISOString() }
  ]
};

// Generador de IDs para memoria
let nextIds = {
  users: 8,
  blocks: 5,
  rooms: 12,
  doors: 3,
  rfid_cards: 8,
  schedules: 11,
  access_logs: 4,
  alerts: 2,
  alarm_zones: 2
};

// Inicialización de PostgreSQL
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://victormcl:rfid2026@localhost:5432/rfid_db',
    connectionTimeoutMillis: 2000
  });

  pool.query('SELECT 1', (err) => {
    if (err) {
      console.warn('⚠️  PostgreSQL no conectado (ejecute setup-db.sh para configurarlo).');
      console.log('🔄 Activando modo Storage en Memoria con datos institucionales completos.');
      useMemoryStore = true;
    } else {
      console.log('📦 Conectado exitosamente a PostgreSQL (rfid_db)');
    }
  });
} catch (e) {
  console.warn('⚠️  PostgreSQL no disponible. Usando almacén en memoria.');
  useMemoryStore = true;
}

module.exports = {
  pool,
  get useMemory() {
    return useMemoryStore;
  },
  setUseMemory(val) {
    useMemoryStore = val;
  },
  memoryDb,
  nextIds,
  async query(text, params = []) {
    if (!useMemoryStore && pool) {
      try {
        return await pool.query(text, params);
      } catch (err) {
        console.warn('Fallo en consulta PG, recurriendo a memoria:', err.message);
      }
    }
    // Fallback simple si se usa memoria directamente
    return { rows: [] };
  }
};
