-- ===================================================================
-- Datos Semilla — Control de Acceso RFID Institucional
-- Corporación Universitaria Lasallista
-- ===================================================================

-- ============================================================
-- ROLES
-- ============================================================
INSERT INTO roles (name, display_name, global_access, description) VALUES
    ('admin',      'Administrador del Sistema',     TRUE,  'Acceso total a la configuración y gestión del campus.'),
    ('rector',     'Rectora / Administración Alta', TRUE,  'Acceso total a TODAS las puertas y bloques del campus en cualquier momento.'),
    ('professor',  'Profesor / Docente',            FALSE, 'Acceso condicionado a su articulación horaria. Solo salas asignadas en horarios establecidos.'),
    ('student',    'Estudiante',                    FALSE, 'Acceso limitado a áreas comunes como biblioteca, condicionado a horarios.'),
    ('security',   'Vigilante / Celador',           TRUE,  'Fichas maestras RFID con privilegios de anulación para rondas y emergencias.'),
    ('admin_staff','Personal Administrativo',       FALSE, 'Acceso a bloques administrativos según asignación de decanatura.')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- BLOQUES INSTITUCIONALES
-- ============================================================
INSERT INTO blocks (name, description, location_info) VALUES
    ('Bloque A', 'Bloque académico principal — Laboratorios de Informática e Ingeniería', 'Costado norte del campus'),
    ('Bloque B', 'Bloque académico secundario — Aulas de clase y biblioteca', 'Costado sur del campus'),
    ('Bloque C', 'Bloque de servicios — Auditorio y áreas comunes', 'Costado occidental del campus'),
    ('Bloque Administrativo', 'Decanatura, RRHH, Oficinas de profesores, Admisiones y Financiero', 'Edificio central del campus')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SALAS / ESPACIOS
-- ============================================================
-- Bloque A: Laboratorios
INSERT INTO rooms (block_id, name, floor, room_type, has_alarm, has_camera, motion_sensors, door_sensors, description) VALUES
    (1, 'Sala de Informática 1', 1, 'lab_informatica', TRUE,  TRUE, 2, 1, 'Piloto inicial de control de acceso. Alarma integrada con sensores de movimiento y puerta.'),
    (1, 'Sala de Informática 2', 1, 'lab_informatica', FALSE, FALSE, 0, 0, 'Laboratorio de informática general.'),
    (1, 'Sala de Informática 3', 2, 'lab_informatica', FALSE, FALSE, 0, 0, 'Laboratorio de informática — segundo piso.'),
    (1, 'Sala de Informática 4', 2, 'lab_informatica', FALSE, FALSE, 0, 0, 'Laboratorio de informática — segundo piso.'),
    (1, 'Sala de Informática 5', 3, 'lab_informatica', FALSE, FALSE, 0, 0, 'Laboratorio de informática — tercer piso.'),
    (1, 'Sala de Informática 6', 3, 'lab_informatica', FALSE, FALSE, 0, 0, 'Laboratorio de informática — tercer piso.'),
    (1, 'Taller de Ingeniería',  1, 'lab_ingenieria',  FALSE, FALSE, 0, 0, 'Sala de taller práctico de ingeniería.');

-- Bloque B: Biblioteca
INSERT INTO rooms (block_id, name, floor, room_type, has_alarm, has_camera, motion_sensors, door_sensors, description) VALUES
    (2, 'Biblioteca Central', 1, 'biblioteca', FALSE, TRUE, 0, 0, 'Biblioteca principal — acceso para estudiantes en horarios establecidos.');

-- Bloque Administrativo
INSERT INTO rooms (block_id, name, floor, room_type, has_alarm, has_camera, motion_sensors, door_sensors, description) VALUES
    (4, 'Decanatura y Profesores',           2, 'administrativo', FALSE, FALSE, 0, 0, 'Oficinas de decanatura y sala de profesores.'),
    (4, 'Administrativo Financiero y Contable', 1, 'financiero',  FALSE, FALSE, 0, 0, 'Oficina financiera y contable.'),
    (4, 'Admisiones',                         1, 'administrativo', FALSE, FALSE, 0, 0, 'Oficina de admisiones — primera planta.');

-- ============================================================
-- PUERTAS — Prototipo Sala Informática 1
-- ============================================================
INSERT INTO doors (room_id, name, door_type, hardware_ip, mac_address, status) VALUES
    (1, 'Puerta Principal — Sala Informática 1',       'main',    '192.168.1.100', 'AA:BB:CC:DD:EE:01', 'offline'),
    (1, 'Puerta Lateral Derecha — Lab. Ingeniería',    'lateral', '192.168.1.101', 'AA:BB:CC:DD:EE:02', 'offline');

-- ============================================================
-- ZONA DE ALARMA — Sala Informática 1
-- ============================================================
INSERT INTO alarm_zones (room_id, zone_name, requires_security_clearance, auto_arm_time, auto_disarm_time, is_armed) VALUES
    (1, 'Zona Alarma — Sala Informática 1', TRUE, '22:00', '06:00', FALSE);

-- ============================================================
-- USUARIOS DE DEMO (ADMINISTRADORES Y CELADORES / PERSONAL)
-- ============================================================
-- Contraseña para todos los demo: "acceso2026" / "rfid2026" (hash bcrypt)
-- $2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq

INSERT INTO users (first_name, last_name, email, password_hash, document_id, role_id, program, status) VALUES
    ('Administrador', 'General',          'admin@lasallista.edu.co',      '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000000', 1, 'Sistemas', 'active'),
    ('Celador',       'de Portería',      'celador@lasallista.edu.co',    '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000008', 5, 'Seguridad', 'active'),
    ('María Elena',   'Gómez Ramírez',    'rectora@lasallista.edu.co',    '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000001', 2, 'Rectoría', 'active'),
    ('Carlos Andrés', 'López Mejía',      'carlos.lopez@lasallista.edu.co','$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000002', 3, 'Ingeniería de Software', 'active'),
    ('Ana María',     'Restrepo Vélez',   'ana.restrepo@lasallista.edu.co','$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000003', 3, 'Ingeniería de Sistemas', 'active'),
    ('Victor Manuel', 'Cordoba Larez',    'victor.cordoba@lasallista.edu.co','$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1152345678', 4, 'Ingeniería de Software', 'active'),
    ('Camila Andrea', 'Martínez Torres',  'camila.martinez@lasallista.edu.co','$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000005', 4, 'Administración de Empresas', 'active'),
    ('Jorge Enrique', 'Hernández Castro', 'vigilancia1@lasallista.edu.co','$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000006', 5, 'Seguridad', 'active'),
    ('Patricia',      'Ríos Duque',       'patricia.rios@lasallista.edu.co','$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000007', 6, 'Decanatura', 'active')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- TARJETAS RFID DE DEMO
-- ============================================================
INSERT INTO rfid_cards (uid, user_id, card_type, is_active, label) VALUES
    ('A1B2C3D4', 1, 'master',   TRUE, 'Tarjeta Rectora'),
    ('E5F6A7B8', 2, 'standard', TRUE, 'Tarjeta Prof. López'),
    ('C9D0E1F2', 3, 'standard', TRUE, 'Tarjeta Prof. Restrepo'),
    ('11223344', 4, 'standard', TRUE, 'Tarjeta Victor Cordoba'),
    ('55667788', 5, 'standard', TRUE, 'Tarjeta Camila Martínez'),
    ('AABBCCDD', 6, 'master',   TRUE, 'Ficha Maestra Vigilancia'),
    ('EEFF0011', 7, 'standard', TRUE, 'Tarjeta Patricia Ríos')
ON CONFLICT (uid) DO NOTHING;

-- ============================================================
-- HORARIOS DE DEMO — Profesor López: Sala Informática 1, Lun-Mié 7:00-9:00
-- ============================================================
INSERT INTO schedules (user_id, room_id, day_of_week, start_time, end_time, semester, subject_name) VALUES
    (2, 1, 1, '07:00', '09:00', '2026-2', 'Programación Orientada a Objetos'),
    (2, 1, 3, '07:00', '09:00', '2026-2', 'Programación Orientada a Objetos'),
    (2, 2, 2, '09:00', '11:00', '2026-2', 'Bases de Datos'),
    (3, 1, 2, '14:00', '16:00', '2026-2', 'Ingeniería de Software'),
    (3, 3, 4, '10:00', '12:00', '2026-2', 'Arquitectura de Computadores');

-- Estudiantes: Biblioteca Lun-Vie 7:00-20:00
INSERT INTO schedules (user_id, room_id, day_of_week, start_time, end_time, semester, subject_name) VALUES
    (4, 8, 1, '07:00', '20:00', '2026-2', 'Acceso Biblioteca'),
    (4, 8, 2, '07:00', '20:00', '2026-2', 'Acceso Biblioteca'),
    (4, 8, 3, '07:00', '20:00', '2026-2', 'Acceso Biblioteca'),
    (4, 8, 4, '07:00', '20:00', '2026-2', 'Acceso Biblioteca'),
    (4, 8, 5, '07:00', '20:00', '2026-2', 'Acceso Biblioteca'),
    (5, 8, 1, '07:00', '20:00', '2026-2', 'Acceso Biblioteca'),
    (5, 8, 2, '07:00', '20:00', '2026-2', 'Acceso Biblioteca'),
    (5, 8, 3, '07:00', '20:00', '2026-2', 'Acceso Biblioteca'),
    (5, 8, 4, '07:00', '20:00', '2026-2', 'Acceso Biblioteca'),
    (5, 8, 5, '07:00', '20:00', '2026-2', 'Acceso Biblioteca');

-- ============================================================
-- LOGS DE ACCESO DE DEMO
-- ============================================================
INSERT INTO access_logs (user_id, door_id, rfid_card_id, rfid_uid_raw, access_method, granted, denial_reason) VALUES
    (2, 1, 2, 'E5F6A7B8', 'rfid', TRUE,  NULL),
    (4, 1, 4, '11223344', 'rfid', FALSE, 'schedule_violation'),
    (6, 1, 6, 'AABBCCDD', 'master_key', TRUE, NULL),
    (1, 1, 1, 'A1B2C3D4', 'rfid', TRUE,  NULL);
