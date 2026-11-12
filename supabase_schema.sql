-- =============================================================================
-- BASE DE DATOS POSTGRESQL — SUPABASE (CONTROL DE ACCESO RFID)
-- Corporación Universitaria Lasallista
-- Campus Real: Bloques A, B, C y Bloque Administrativo (Pisos 1, 2, 3 y 4)
-- Tablas Operativas 100% Vacías — Solo Usuarios Iniciales y Espacios Fijos
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Limpieza limpia de tablas previas si existen
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS access_logs CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS rfid_cards CASCADE;
DROP TABLE IF EXISTS doors CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- =============================================================================
-- 1. TABLA: ROLES (Jerarquía de Permisos Institucionales)
-- =============================================================================
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    global_access BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. TABLA: USUARIOS (Solo Administrador y Celador iniciales para acceso web)
-- =============================================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    document_id VARCHAR(50) UNIQUE NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    photo_url TEXT,
    program VARCHAR(200),
    phone VARCHAR(30),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    access_expiry DATE,
    active_session_id VARCHAR(100),
    last_login_at TIMESTAMPTZ,
    last_login_device TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_document ON users(document_id);

-- =============================================================================
-- 3. TABLA: BLOQUES DEL CAMPUS (4 Bloques Institucionales)
-- =============================================================================
CREATE TABLE blocks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    location_info TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. TABLA: SALAS Y ESPACIOS
-- =============================================================================
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    floor INTEGER DEFAULT 1,
    room_type VARCHAR(50) DEFAULT 'general',
    has_alarm BOOLEAN DEFAULT FALSE,
    security_status VARCHAR(30) DEFAULT 'normal' CHECK (security_status IN ('normal', 'armed', 'alert', 'lockdown')),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rooms_block ON rooms(block_id);

-- =============================================================================
-- 5. TABLA: PUERTAS Y PUNTOS DE ACCESO (Cada acceso físico a un espacio)
-- =============================================================================
CREATE TABLE doors (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    door_type VARCHAR(50) DEFAULT 'acceso',
    hardware_ip VARCHAR(45) DEFAULT '192.168.1.100',
    mac_address VARCHAR(17) DEFAULT 'AA:BB:CC:DD:EE:01',
    status VARCHAR(20) DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance', 'alarm')),
    is_locked BOOLEAN DEFAULT TRUE,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doors_room ON doors(room_id);

-- =============================================================================
-- 6. TABLA: TARJETAS RFID (Carnets Físicos — Vacía para enrolamiento real)
-- =============================================================================
CREATE TABLE rfid_cards (
    id SERIAL PRIMARY KEY,
    uid VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    card_type VARCHAR(20) DEFAULT 'standard' CHECK (card_type IN ('standard', 'master', 'temporary')),
    is_active BOOLEAN DEFAULT TRUE,
    label VARCHAR(100),
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ
);

CREATE INDEX idx_rfid_uid ON rfid_cards(uid);
CREATE INDEX idx_rfid_user ON rfid_cards(user_id);

-- =============================================================================
-- 7. TABLA: ARTICULACIÓN HORARIA (Schedules — Vacía inicialmente)
-- =============================================================================
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    semester VARCHAR(20) DEFAULT '2026-1',
    subject_name VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_schedule_time CHECK (start_time < end_time)
);

CREATE INDEX idx_schedules_lookup ON schedules(user_id, room_id, day_of_week, is_active);

-- =============================================================================
-- 8. TABLA: AUDITORÍA DE ACCESOS (Logs de lectura RFID — Vacía inicialmente)
-- =============================================================================
CREATE TABLE access_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    door_id INTEGER REFERENCES doors(id) ON DELETE SET NULL,
    rfid_card_id INTEGER REFERENCES rfid_cards(id) ON DELETE SET NULL,
    rfid_uid_raw VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    access_method VARCHAR(30) DEFAULT 'rfid',
    granted BOOLEAN NOT NULL,
    denial_reason VARCHAR(100),
    notes TEXT
);

CREATE INDEX idx_access_logs_timestamp ON access_logs(timestamp DESC);
CREATE INDEX idx_access_logs_user ON access_logs(user_id);
CREATE INDEX idx_access_logs_door ON access_logs(door_id);

-- =============================================================================
-- 9. TABLA: ALERTAS DE SEGURIDAD (Vacía inicialmente)
-- =============================================================================
CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    door_id INTEGER REFERENCES doors(id) ON DELETE SET NULL,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    sensor_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'high',
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT,
    email_sent BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_alerts_unresolved ON alerts(is_resolved, timestamp DESC);

-- =============================================================================
-- 10. TABLA: PASES DE VISITANTES Y PRÉSTAMOS TEMPORALES RFID
-- =============================================================================
CREATE TABLE visitor_passes (
    id SERIAL PRIMARY KEY,
    card_uid VARCHAR(50) NOT NULL,
    person_type VARCHAR(50) NOT NULL CHECK (person_type IN ('student', 'visitor', 'professor', 'contractor')),
    full_name VARCHAR(150) NOT NULL,
    document_id VARCHAR(50) NOT NULL,
    phone VARCHAR(30),
    destination VARCHAR(150),
    reason TEXT NOT NULL,
    missing_card_reason VARCHAR(100),
    issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    entry_time TIMESTAMPTZ DEFAULT NOW(),
    exit_time TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'returned', 'lost')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_visitor_passes_status ON visitor_passes(status);
CREATE INDEX idx_visitor_passes_card_uid ON visitor_passes(card_uid);

-- =============================================================================
-- DATOS FIJOS DEL CAMPUS
-- =============================================================================

-- 1. Roles del Sistema
INSERT INTO roles (id, name, display_name, global_access, description) VALUES
(1, 'admin', 'Administrador del Sistema', TRUE, 'Acceso total a la administración y enrolamiento.'),
(2, 'celador', 'Celador / Personal de Seguridad', TRUE, 'Control y monitoreo de accesos.'),
(3, 'rector', 'Rectora / Alta Dirección', TRUE, 'Acceso total a todas las dependencias del campus.'),
(4, 'professor', 'Profesor / Docente', FALSE, 'Acceso condicionado a articulación horaria de clases.'),
(5, 'student', 'Estudiante', FALSE, 'Acceso a salas de biblioteca y laboratorios según horario.'),
(6, 'admin_staff', 'Personal Administrativo', FALSE, 'Acceso a oficinas y dependencias administrativas.');

SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));

-- 2. Usuarios Iniciales para Acceso Web (Contraseña: acceso2026)
-- Hash bcrypt oficial: $2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq
INSERT INTO users (id, first_name, last_name, email, password_hash, document_id, role_id, program, status) VALUES
(1, 'Administrador', 'General', 'admin@lasallista.edu.co', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000001', 1, 'Sistemas', 'active'),
(2, 'Celador', 'de Seguridad', 'celador@lasallista.edu.co', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000002', 2, 'Seguridad', 'active');

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 3. Bloques del Campus (4 Bloques)
INSERT INTO blocks (id, name, description, location_info) VALUES
(1, 'Bloque A', 'Aulas de clase y salas de cómputo', 'Costado Norte'),
(2, 'Bloque B', 'Aulas de clase y sala de idiomas', 'Costado Sur'),
(3, 'Bloque C', 'Aulas de clase, salas de cómputo y laboratorios de hardware', 'Costado Occidental'),
(4, 'Bloque Administrativo', 'Laboratorios generales, laboratorios de informática, alimentos, profesores y cartera', 'Edificio Central');

SELECT setval('blocks_id_seq', (SELECT MAX(id) FROM blocks));

-- 4. Salas y Espacios por Bloque
INSERT INTO rooms (id, block_id, name, floor, room_type, has_alarm, security_status, description) VALUES
-- Bloque A (14 salones)
(1, 1, 'Salón A-101', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(2, 1, 'Salón A-102', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(3, 1, 'Salón A-103', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(4, 1, 'Salón A-104', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(5, 1, 'Salón A-105', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(6, 1, 'Salón A-201', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),
(7, 1, 'Salón A-202', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),
(8, 1, 'Salón A-203', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),
(9, 1, 'Salón A-204', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),
(10, 1, 'Salón A-205', 2, 'lab_pcs', FALSE, 'normal', 'Sala de cómputo con PCs - Piso 2'),
(11, 1, 'Salón A-301', 3, 'general', FALSE, 'normal', 'Aula de clase general - Piso 3'),
(12, 1, 'Salón A-302', 3, 'general', FALSE, 'normal', 'Aula de clase general - Piso 3'),
(13, 1, 'Salón A-303', 3, 'general', FALSE, 'normal', 'Aula de clase general - Piso 3'),
(14, 1, 'Salón A-304', 3, 'general', FALSE, 'normal', 'Aula de clase general - Piso 3'),

-- Bloque B (14 salones)
(15, 2, 'Salón B-101', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(16, 2, 'Salón B-102', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(17, 2, 'Salón B-103', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(18, 2, 'Salón B-104', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(19, 2, 'Salón B-105', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(20, 2, 'Salón B-201', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),
(21, 2, 'Salón B-202', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),
(22, 2, 'Salón B-203', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),
(23, 2, 'Salón B-204', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),
(24, 2, 'Salón B-205', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),
(25, 2, 'Salón B-301', 3, 'idiomas', FALSE, 'normal', 'Salón de Idiomas / Inglés - Piso 3'),
(26, 2, 'Salón B-302', 3, 'general', FALSE, 'normal', 'Aula de clase general - Piso 3'),
(27, 2, 'Salón B-303', 3, 'general', FALSE, 'normal', 'Aula de clase general - Piso 3'),
(28, 2, 'Salón B-304', 3, 'general', FALSE, 'normal', 'Aula de clase general - Piso 3'),

-- Bloque C (Salones, Salas de PCs, Laboratorio de Hardware y Aula Máxima)
(29, 3, 'Aula Máxima', 1, 'auditorio', FALSE, 'normal', 'Auditorio principal para eventos institucionales - Piso 1'),
(30, 3, 'Salón C-105', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(31, 3, 'Sala de Cómputo C-201', 2, 'lab_pcs', TRUE, 'normal', 'Laboratorio de informática y desarrollo - Piso 2'),
(32, 3, 'Sala de Cómputo C-202', 2, 'lab_pcs', TRUE, 'normal', 'Laboratorio de informática y redes - Piso 2'),
(33, 3, 'Salón C-203', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),
(34, 3, 'Salón C-204', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),
(35, 3, 'Salón C-205', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),
(36, 3, 'Salón C-301', 3, 'general', FALSE, 'normal', 'Aula de clase general - Piso 3'),
(37, 3, 'Salón C-302', 3, 'general', FALSE, 'normal', 'Aula de clase general - Piso 3'),
(38, 3, 'Laboratorio de Hardware 1', 3, 'lab_hardware', TRUE, 'normal', 'Laboratorio especializado en arquitectura y hardware - Piso 3'),
(39, 3, 'Laboratorio de Hardware 2', 3, 'lab_hardware', TRUE, 'normal', 'Laboratorio especializado en arquitectura y hardware - Piso 3'),

-- Bloque Administrativo (Pisos 1, 2, 3 y 4)
-- Piso 1: 2 laboratorios generales (alimentos y zootecnia)
(40, 4, 'Laboratorio General 1 (Alimentos y Zootecnia)', 1, 'lab_general', TRUE, 'normal', 'Laboratorio general de prácticas para alimentos y zootecnia - Piso 1'),
(41, 4, 'Laboratorio General 2 (Alimentos y Zootecnia)', 1, 'lab_general', TRUE, 'normal', 'Laboratorio general de prácticas para alimentos y zootecnia - Piso 1'),

-- Piso 2: 2 laboratorios generales (alimentos y zootecnia) y Cartera
(42, 4, 'Laboratorio General 3 (Alimentos y Zootecnia)', 2, 'lab_general', TRUE, 'normal', 'Laboratorio general de prácticas para alimentos y zootecnia - Piso 2'),
(43, 4, 'Laboratorio General 4 (Alimentos y Zootecnia)', 2, 'lab_general', TRUE, 'normal', 'Laboratorio general de prácticas para alimentos y zootecnia - Piso 2'),
(44, 4, 'Cartera', 2, 'administrativo', FALSE, 'normal', 'Oficina de gestión financiera y cartera - Piso 2'),

-- Piso 3: Sala de Profesores, 2 Laboratorios de Informática y 1 Lab de Alimentos
(45, 4, 'Sala de Profesores (Piso 3)', 3, 'administrativo', FALSE, 'normal', 'Entrada y sala de trabajo docente - Piso 3'),
(46, 4, 'Laboratorio de Informática 1', 3, 'lab_pcs', TRUE, 'normal', 'Laboratorio de cómputo y PCs - Piso 3'),
(47, 4, 'Laboratorio de Informática 2', 3, 'lab_pcs', TRUE, 'normal', 'Laboratorio de cómputo y PCs - Piso 3'),
(48, 4, 'Laboratorio de Alimentos', 3, 'lab_alimentos', TRUE, 'normal', 'Laboratorio especializado en ciencia y tecnología de alimentos - Piso 3'),

-- Piso 4: 3 Laboratorios de Informática y otra entrada para Profesores
(49, 4, 'Laboratorio de Informática 3', 4, 'lab_pcs', TRUE, 'normal', 'Laboratorio de cómputo y PCs - Piso 4'),
(50, 4, 'Laboratorio de Informática 4', 4, 'lab_pcs', TRUE, 'normal', 'Laboratorio de cómputo y PCs - Piso 4'),
(51, 4, 'Laboratorio de Informática 5', 4, 'lab_pcs', TRUE, 'normal', 'Laboratorio de cómputo y PCs - Piso 4'),
(52, 4, 'Sala de Profesores (Piso 4)', 4, 'administrativo', FALSE, 'normal', 'Acceso y sala de trabajo docente - Piso 4');

SELECT setval('rooms_id_seq', (SELECT MAX(id) FROM rooms));

-- 5. Puertas y Puntos de Acceso (Cada acceso físico a los espacios)
INSERT INTO doors (id, room_id, name, door_type, status, is_locked) VALUES
-- Bloque A (1 acceso por salón)
(1, 1, 'Puerta Salón A-101', 'acceso', 'online', TRUE),
(2, 2, 'Puerta Salón A-102', 'acceso', 'online', TRUE),
(3, 3, 'Puerta Salón A-103', 'acceso', 'online', TRUE),
(4, 4, 'Puerta Salón A-104', 'acceso', 'online', TRUE),
(5, 5, 'Puerta Salón A-105', 'acceso', 'online', TRUE),
(6, 6, 'Puerta Salón A-201', 'acceso', 'online', TRUE),
(7, 7, 'Puerta Salón A-202', 'acceso', 'online', TRUE),
(8, 8, 'Puerta Salón A-203', 'acceso', 'online', TRUE),
(9, 9, 'Puerta Salón A-204', 'acceso', 'online', TRUE),
(10, 10, 'Puerta Salón A-205 (PCs)', 'acceso', 'online', TRUE),
(11, 11, 'Puerta Salón A-301', 'acceso', 'online', TRUE),
(12, 12, 'Puerta Salón A-302', 'acceso', 'online', TRUE),
(13, 13, 'Puerta Salón A-303', 'acceso', 'online', TRUE),
(14, 14, 'Puerta Salón A-304', 'acceso', 'online', TRUE),

-- Bloque B (1 acceso por salón)
(15, 15, 'Puerta Salón B-101', 'acceso', 'online', TRUE),
(16, 16, 'Puerta Salón B-102', 'acceso', 'online', TRUE),
(17, 17, 'Puerta Salón B-103', 'acceso', 'online', TRUE),
(18, 18, 'Puerta Salón B-104', 'acceso', 'online', TRUE),
(19, 19, 'Puerta Salón B-105', 'acceso', 'online', TRUE),
(20, 20, 'Puerta Salón B-201', 'acceso', 'online', TRUE),
(21, 21, 'Puerta Salón B-202', 'acceso', 'online', TRUE),
(22, 22, 'Puerta Salón B-203', 'acceso', 'online', TRUE),
(23, 23, 'Puerta Salón B-204', 'acceso', 'online', TRUE),
(24, 24, 'Puerta Salón B-205', 'acceso', 'online', TRUE),
(25, 25, 'Puerta Salón B-301 (Inglés)', 'acceso', 'online', TRUE),
(26, 26, 'Puerta Salón B-302', 'acceso', 'online', TRUE),
(27, 27, 'Puerta Salón B-303', 'acceso', 'online', TRUE),
(28, 28, 'Puerta Salón B-304', 'acceso', 'online', TRUE),

-- Bloque C
(29, 29, 'Aula Máxima - Acceso 1', 'acceso', 'online', TRUE),
(30, 29, 'Aula Máxima - Acceso 2', 'acceso', 'online', TRUE),
(31, 30, 'Puerta Salón C-105', 'acceso', 'online', TRUE),
(32, 31, 'Puerta Sala de Cómputo C-201', 'acceso', 'online', TRUE),
(33, 32, 'Puerta Sala de Cómputo C-202', 'acceso', 'online', TRUE),
(34, 33, 'Puerta Salón C-203', 'acceso', 'online', TRUE),
(35, 34, 'Puerta Salón C-204', 'acceso', 'online', TRUE),
(36, 35, 'Puerta Salón C-205', 'acceso', 'online', TRUE),
(37, 36, 'Puerta Salón C-301', 'acceso', 'online', TRUE),
(38, 37, 'Puerta Salón C-302', 'acceso', 'online', TRUE),
(39, 38, 'Puerta Laboratorio de Hardware 1', 'acceso', 'online', TRUE),
(40, 39, 'Puerta Laboratorio de Hardware 2', 'acceso', 'online', TRUE),

-- Bloque Administrativo (Pisos 1 al 4)
-- Piso 1
(41, 40, 'Puerta Laboratorio General 1 (Piso 1)', 'acceso', 'online', TRUE),
(42, 41, 'Puerta Laboratorio General 2 (Piso 1)', 'acceso', 'online', TRUE),

-- Piso 2
(43, 42, 'Puerta Laboratorio General 3 (Piso 2)', 'acceso', 'online', TRUE),
(44, 43, 'Puerta Laboratorio General 4 (Piso 2)', 'acceso', 'online', TRUE),
(45, 44, 'Puerta Cartera', 'acceso', 'online', TRUE),

-- Piso 3
(46, 45, 'Puerta Sala de Profesores (Piso 3)', 'acceso', 'online', TRUE),
(47, 46, 'Puerta Laboratorio de Informática 1', 'acceso', 'online', TRUE),
(48, 47, 'Puerta Laboratorio de Informática 2', 'acceso', 'online', TRUE),
(49, 48, 'Puerta Laboratorio de Alimentos (Piso 3)', 'acceso', 'online', TRUE),

-- Piso 4
(50, 49, 'Puerta Laboratorio de Informática 3', 'acceso', 'online', TRUE),
(51, 50, 'Puerta Laboratorio de Informática 4', 'acceso', 'online', TRUE),
(52, 51, 'Puerta Laboratorio de Informática 5', 'acceso', 'online', TRUE),
(53, 52, 'Puerta Sala de Profesores (Piso 4)', 'acceso', 'online', TRUE);

INSERT INTO rfid_cards (uid, user_id, card_type, is_active, label) VALUES
('9B160795', 1, 'master', TRUE, 'Carnet Maestro Administrador'),
('0DDA86CD', 2, 'master', TRUE, 'Carnet Operador Celador / Seguridad');

SELECT setval('doors_id_seq', (SELECT MAX(id) FROM doors));
