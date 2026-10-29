-- =============================================================================
-- BASE DE DATOS POSTGRESQL — CONTROL DE ACCESO INSTITUCIONAL RFID
-- Corporación Universitaria Lasallista
-- Compatible 100% con Supabase SQL Editor
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Limpiar tablas previas si existen (en orden de dependencia)
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
-- 1. ROLES — Jerarquía de Permisos Institucionales
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
-- 2. USUARIOS — Estudiantes, Profesores, Administrativos y Seguridad
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
-- 3. BLOQUES — Estructura Física del Campus Institucional
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
-- 4. SALAS / ESPACIOS — Áreas Académicas y Administrativas
-- (Sin sensores de cámaras ni movimiento PIR)
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
-- 5. PUERTAS — Puntos de Control con Lector RFID
-- =============================================================================
CREATE TABLE doors (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    door_type VARCHAR(30) DEFAULT 'main',
    hardware_ip VARCHAR(45) DEFAULT '192.168.1.100',
    mac_address VARCHAR(17) DEFAULT 'AA:BB:CC:DD:EE:01',
    status VARCHAR(20) DEFAULT 'online' CHECK (status IN ('online', 'offline', 'maintenance', 'alarm')),
    is_locked BOOLEAN DEFAULT TRUE,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doors_room ON doors(room_id);

-- =============================================================================
-- 6. TARJETAS RFID — Carnets Físicos Enrolados
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
-- 7. ARTICULACIÓN HORARIA — Horarios de Acceso a Salas
-- =============================================================================
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 1=Lunes ... 6=Sábado
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
-- 8. AUDITORÍA DE ACCESOS — Registro Inmutable de Escaneos RFID
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
-- 9. ALERTAS DE SEGURIDAD — Notificaciones de Incidentes
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
-- DATOS SEMILLA INICIALES (Credenciales de acceso web y estructura inicial)
-- Contraseña para admin y celador: acceso2026
-- Hash bcrypt: $2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq
-- =============================================================================

INSERT INTO roles (id, name, display_name, global_access, description) VALUES
(1, 'admin', 'Administrador del Sistema', TRUE, 'Acceso total a la configuración y gestión del campus.'),
(2, 'celador', 'Celador / Personal de Seguridad', TRUE, 'Control de accesos, monitoreo y fichas maestras.'),
(3, 'rector', 'Rectora / Alta Dirección', TRUE, 'Acceso institucional irrestricto a todas las puertas.'),
(4, 'professor', 'Profesor / Docente', FALSE, 'Acceso condicionado a la articulación horaria de clases.'),
(5, 'student', 'Estudiante', FALSE, 'Acceso a salas de biblioteca y laboratorios según horario.'),
(6, 'admin_staff', 'Personal Administrativo', FALSE, 'Acceso a bloques administrativos según cargo.');

SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));

INSERT INTO users (id, first_name, last_name, email, password_hash, document_id, role_id, program, status) VALUES
(1, 'Administrador', 'General', 'admin@lasallista.edu.co', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000001', 1, 'Sistemas', 'active'),
(2, 'Celador', 'de Seguridad', 'celador@lasallista.edu.co', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000002', 2, 'Seguridad', 'active'),
(3, 'María Elena', 'Gómez', 'rectora@lasallista.edu.co', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000003', 3, 'Rectoría', 'active'),
(4, 'Carlos Andrés', 'López Mejía', 'carlos.lopez@lasallista.edu.co', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1000000004', 4, 'Ingeniería de Software', 'active'),
(5, 'Victor Manuel', 'Cordoba Larez', 'victor.cordoba@lasallista.edu.co', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1152345678', 5, 'Ingeniería de Software', 'active'),
(6, 'Jeronimo', 'Arboleda Galeano', 'jeronimo.arboleda@lasallista.edu.co', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq', '1152987654', 5, 'Ingeniería de Software', 'active');

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

INSERT INTO blocks (id, name, description, location_info) VALUES
(1, 'Bloque A', 'Laboratorios de Informática e Ingeniería', 'Costado Norte'),
(2, 'Bloque B', 'Aulas de Clase y Biblioteca Central', 'Costado Sur'),
(3, 'Bloque C', 'Auditorio y Áreas Comunes', 'Costado Occidental'),
(4, 'Bloque Administrativo', 'Decanatura, RRHH, Oficinas de Profesores', 'Edificio Central');

SELECT setval('blocks_id_seq', (SELECT MAX(id) FROM blocks));

INSERT INTO rooms (id, block_id, name, floor, room_type, has_alarm, security_status, description) VALUES
(1, 1, 'Sala de Informática 1', 1, 'lab_informatica', TRUE, 'armed', 'Laboratorio principal de software y redes.'),
(2, 1, 'Sala de Informática 2', 1, 'lab_informatica', FALSE, 'normal', 'Laboratorio de cómputo general.'),
(3, 1, 'Taller de Ingeniería', 1, 'lab_ingenieria', FALSE, 'normal', 'Taller de electrónica y diseño.'),
(4, 2, 'Biblioteca Central', 1, 'biblioteca', FALSE, 'normal', 'Acceso general en horarios de servicio.'),
(5, 4, 'Decanatura y Profesores', 2, 'administrativo', FALSE, 'normal', 'Oficinas docentes y administrativas.');

SELECT setval('rooms_id_seq', (SELECT MAX(id) FROM rooms));

INSERT INTO doors (id, room_id, name, door_type, status, is_locked) VALUES
(1, 1, 'Puerta Principal — Sala Informática 1', 'main', 'online', TRUE),
(2, 3, 'Puerta Lateral Derecha — Lab. Ingeniería', 'lateral', 'online', TRUE);

SELECT setval('doors_id_seq', (SELECT MAX(id) FROM doors));

INSERT INTO rfid_cards (id, uid, user_id, card_type, is_active, label) VALUES
(1, 'A1B2C3D4', 1, 'master', TRUE, 'Ficha Maestra Administración'),
(2, 'E5F6A7B8', 4, 'standard', TRUE, 'Carnet Prof. Carlos López'),
(3, '11223344', 5, 'standard', TRUE, 'Carnet Estudiante Victor Cordoba'),
(4, 'AABBCCDD', 2, 'master', TRUE, 'Ficha Maestra Vigilancia');

SELECT setval('rfid_cards_id_seq', (SELECT MAX(id) FROM rfid_cards));

INSERT INTO schedules (user_id, room_id, day_of_week, start_time, end_time, semester, subject_name) VALUES
(4, 1, 1, '06:00:00', '22:00:00', '2026-1', 'Programación Avanzada'),
(4, 1, 2, '06:00:00', '22:00:00', '2026-1', 'Programación Avanzada'),
(4, 1, 3, '06:00:00', '22:00:00', '2026-1', 'Programación Avanzada'),
(4, 1, 4, '06:00:00', '22:00:00', '2026-1', 'Programación Avanzada'),
(4, 1, 5, '06:00:00', '22:00:00', '2026-1', 'Programación Avanzada'),
(5, 4, 1, '07:00:00', '21:00:00', '2026-1', 'Acceso Biblioteca Central'),
(5, 4, 2, '07:00:00', '21:00:00', '2026-1', 'Acceso Biblioteca Central'),
(5, 4, 3, '07:00:00', '21:00:00', '2026-1', 'Acceso Biblioteca Central'),
(5, 4, 4, '07:00:00', '21:00:00', '2026-1', 'Acceso Biblioteca Central'),
(5, 4, 5, '07:00:00', '21:00:00', '2026-1', 'Acceso Biblioteca Central');

INSERT INTO access_logs (user_id, door_id, rfid_card_id, rfid_uid_raw, granted, denial_reason, notes) VALUES
(4, 1, 2, 'E5F6A7B8', TRUE, NULL, 'Ingreso autorizado a clase'),
(5, 1, 3, '11223344', FALSE, 'denegado_area_no_autorizada', 'Sin clase asignada en Sala 1'),
(2, 1, 4, 'AABBCCDD', TRUE, NULL, 'Ficha Maestra - Ronda de Seguridad');
