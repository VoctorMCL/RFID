-- =============================================================================
-- BASE DE DATOS POSTGRESQL — SUPABASE (CONTROL DE ACCESO RFID)
-- Corporación Universitaria Lasallista
-- Esquema Oficial sin sensores de cámaras ni movimiento PIR
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_document ON users(document_id);

-- =============================================================================
-- 3. TABLA: BLOQUES DEL CAMPUS (Datos Fijos Institucionales)
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
-- 4. TABLA: SALAS Y ESPACIOS (Salones, Salas de PCs y Laboratorio de Animales)
-- =============================================================================
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    floor INTEGER DEFAULT 1,
    room_type VARCHAR(50) DEFAULT 'general' CHECK (room_type IN ('general', 'lab_pcs', 'lab_animales', 'biblioteca', 'administrativo', 'auditorio')),
    has_alarm BOOLEAN DEFAULT FALSE,
    security_status VARCHAR(30) DEFAULT 'normal' CHECK (security_status IN ('normal', 'armed', 'alert', 'lockdown')),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rooms_block ON rooms(block_id);

-- =============================================================================
-- 5. TABLA: PUERTAS Y PUNTOS DE CONTROL (Entrada Principal y Salones)
-- =============================================================================
CREATE TABLE doors (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    door_type VARCHAR(30) DEFAULT 'puerta_sencilla' CHECK (door_type IN ('puerta_sencilla', 'puerta_doble')),
    hardware_ip VARCHAR(45) DEFAULT '192.168.1.100',
    mac_address VARCHAR(17) DEFAULT 'AA:BB:CC:DD:EE:01',
    status VARCHAR(20) DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance', 'alarm')),
    is_locked BOOLEAN DEFAULT TRUE,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doors_room ON doors(room_id);

-- =============================================================================
-- 6. TABLA: TARJETAS RFID (Carnets Físicos — Vacía inicialmente)
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
-- DATOS FIJOS DEL CAMPUS
-- =============================================================================

-- 1. Roles del Sistema
INSERT INTO roles (id, name, display_name, global_access, description) VALUES
(1, 'admin', 'Administrador del Sistema', TRUE, 'Acceso total a la administración y enrolamiento.'),
(2, 'celador', 'Celador / Personal de Seguridad', TRUE, 'Control y monitoreo de accesos.'),
(3, 'rector', 'Rectora / Alta Dirección', TRUE, 'Acceso total a todas las dependencias del campus.'),
(4, 'professor', 'Profesor / Docente', FALSE, 'Acceso condicionado a articulación horaria de clases.'),
(5, 'student', 'Estudiante', FALSE, 'Acceso a salas de biblioteca y laboratorios según horario.'),
(6, 'admin_staff', 'Personal Administrativo', FALSE, 'Acceso a oficinas y bloques administrativos.');

SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));

-- 2. Usuarios Iniciales para Acceso Web (Contraseña: acceso2026)
-- Hash bcrypt oficial: $2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq
INSERT INTO users (id, first_name, last_name, email, password_hash, document_id, role_id, program, status) VALUES
(1, 'Administrador', 'General', 'admin@lasallista.edu.co', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000001', 1, 'Sistemas', 'active'),
(2, 'Celador', 'de Seguridad', 'celador@lasallista.edu.co', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000002', 2, 'Seguridad', 'active');

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 3. Bloques Fijos del Campus (4 Bloques)
INSERT INTO blocks (id, name, description, location_info) VALUES
(1, 'Bloque A', 'Aulas generales de clase', 'Costado Norte'),
(2, 'Bloque B', 'Aulas de clase y Biblioteca Central', 'Costado Sur'),
(3, 'Bloque C', 'Aulas de clase y Salas de Cómputo / PCs', 'Costado Occidental'),
(4, 'Bloque Administrativo', 'Oficinas, Salas de PCs y Laboratorios de Animales / Veterinaria', 'Edificio Central');

SELECT setval('blocks_id_seq', (SELECT MAX(id) FROM blocks));

-- 4. Salas y Espacios Fijos por Bloque
INSERT INTO rooms (id, block_id, name, floor, room_type, has_alarm, security_status, description) VALUES
-- Bloque A (Aulas)
(1, 1, 'Salón A-101', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(2, 1, 'Salón A-102', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(3, 1, 'Salón A-201', 2, 'general', FALSE, 'normal', 'Aula de clase general - Piso 2'),

-- Bloque B (Aulas y Biblioteca)
(4, 2, 'Salón B-101', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(5, 2, 'Salón B-102', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(6, 2, 'Biblioteca Central', 1, 'biblioteca', FALSE, 'normal', 'Biblioteca institucional y salas de estudio'),

-- Bloque C (Aulas y Salas de PCs)
(7, 3, 'Salón C-101', 1, 'general', FALSE, 'normal', 'Aula de clase general - Piso 1'),
(8, 3, 'Sala de Cómputo C-1', 1, 'lab_pcs', TRUE, 'armed', 'Laboratorio principal de informática y desarrollo'),
(9, 3, 'Sala de Cómputo C-2', 2, 'lab_pcs', FALSE, 'normal', 'Sala de cómputo y redes - Piso 2'),

-- Bloque Administrativo (Oficinas, PCs y Lab Animales)
(10, 4, 'Entrada Principal Campus', 1, 'general', FALSE, 'normal', 'Acceso general institucional al campus'),
(11, 4, 'Decanatura y Profesores', 2, 'administrativo', FALSE, 'normal', 'Oficinas docentes y administrativas'),
(12, 4, 'Sala de Cómputo Administrativa', 1, 'lab_pcs', FALSE, 'normal', 'Sala de cómputo para personal administrativo'),
(13, 4, 'Laboratorio de Animales y Veterinaria', 1, 'lab_animales', TRUE, 'armed', 'Laboratorio especializado de Medicina Veterinaria y Zootecnia');

SELECT setval('rooms_id_seq', (SELECT MAX(id) FROM rooms));

-- 5. Puertas Inteligentes Preparadas para Escaneo RFID (ID 1 es la Entrada Principal vinculada al CrowPi)
INSERT INTO doors (id, room_id, name, door_type, status, is_locked) VALUES
(1, 10, 'Entrada Principal', 'puerta_sencilla', 'online', TRUE),
(2, 1, 'Puerta Salón A-101', 'puerta_sencilla', 'online', TRUE),
(3, 2, 'Puerta Salón A-102', 'puerta_sencilla', 'online', TRUE),
(4, 3, 'Puerta Salón A-201', 'puerta_sencilla', 'online', TRUE),
(5, 4, 'Puerta Salón B-101', 'puerta_sencilla', 'online', TRUE),
(6, 5, 'Puerta Salón B-102', 'puerta_sencilla', 'online', TRUE),
(7, 6, 'Puerta Biblioteca Central', 'puerta_doble', 'online', TRUE),
(8, 7, 'Puerta Salón C-101', 'puerta_sencilla', 'online', TRUE),
(9, 8, 'Puerta Sala de Cómputo C-1', 'puerta_doble', 'online', TRUE),
(10, 9, 'Puerta Sala de Cómputo C-2', 'puerta_sencilla', 'online', TRUE),
(11, 11, 'Puerta Decanatura y Profesores', 'puerta_sencilla', 'online', TRUE),
(12, 12, 'Puerta Sala de Cómputo Administrativa', 'puerta_sencilla', 'online', TRUE),
(13, 13, 'Puerta Laboratorio de Animales y Veterinaria', 'puerta_doble', 'online', TRUE);

SELECT setval('doors_id_seq', (SELECT MAX(id) FROM doors));
