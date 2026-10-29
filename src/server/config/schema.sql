-- ===================================================================
-- Esquema de Base de Datos
-- Ecosistema Inteligente de Control de Acceso RFID
-- Corporación Universitaria Lasallista
-- ===================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ROLES — Jerarquía de permisos del sistema
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(50) UNIQUE NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    global_access   BOOLEAN DEFAULT FALSE,
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. USERS — Usuarios del ecosistema
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    document_id     VARCHAR(50) UNIQUE NOT NULL,
    role_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    photo_url       TEXT,
    program         VARCHAR(200),
    phone           VARCHAR(30),
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    access_expiry   DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- 3. RFID_CARDS — Tarjetas RFID registradas
-- ============================================================
CREATE TABLE IF NOT EXISTS rfid_cards (
    id              SERIAL PRIMARY KEY,
    uid             VARCHAR(50) UNIQUE NOT NULL,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    card_type       VARCHAR(20) DEFAULT 'standard' CHECK (card_type IN ('standard', 'master', 'temporary', 'visitor')),
    is_active       BOOLEAN DEFAULT TRUE,
    label           VARCHAR(100),
    enrolled_at     TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rfid_uid ON rfid_cards(uid);
CREATE INDEX IF NOT EXISTS idx_rfid_user ON rfid_cards(user_id);

-- ============================================================
-- 4. BLOCKS — Bloques institucionales (dinámicos)
-- ============================================================
CREATE TABLE IF NOT EXISTS blocks (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    location_info   TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. ROOMS — Salas/Espacios dentro de cada bloque
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
    id              SERIAL PRIMARY KEY,
    block_id        INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    floor           INTEGER DEFAULT 1,
    room_type       VARCHAR(50) DEFAULT 'general' CHECK (room_type IN ('lab_informatica', 'lab_ingenieria', 'administrativo', 'financiero', 'biblioteca', 'auditorio', 'general')),
    has_alarm       BOOLEAN DEFAULT FALSE,
    has_camera      BOOLEAN DEFAULT FALSE,
    motion_sensors  INTEGER DEFAULT 0,
    door_sensors    INTEGER DEFAULT 0,
    security_status VARCHAR(30) DEFAULT 'normal' CHECK (security_status IN ('normal', 'armed', 'alert', 'lockdown')),
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_block ON rooms(block_id);

-- ============================================================
-- 6. DOORS — Puertas con hardware RFID
-- ============================================================
CREATE TABLE IF NOT EXISTS doors (
    id              SERIAL PRIMARY KEY,
    room_id         INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    door_type       VARCHAR(30) DEFAULT 'standard' CHECK (door_type IN ('main', 'lateral', 'emergency', 'standard')),
    hardware_ip     VARCHAR(45),
    mac_address     VARCHAR(17),
    status          VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance', 'alarm')),
    is_locked       BOOLEAN DEFAULT TRUE,
    last_heartbeat  TIMESTAMPTZ,
    firmware_version VARCHAR(20),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doors_room ON doors(room_id);
CREATE INDEX IF NOT EXISTS idx_doors_status ON doors(status);

-- ============================================================
-- 7. SCHEDULES — Articulación horaria de accesos
-- ============================================================
CREATE TABLE IF NOT EXISTS schedules (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id         INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    semester        VARCHAR(20),
    subject_name    VARCHAR(200),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_time_range CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_schedules_user ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_room ON schedules(room_id);
CREATE INDEX IF NOT EXISTS idx_schedules_day ON schedules(day_of_week);

-- ============================================================
-- 8. ACCESS_LOGS — Registro completo de accesos
-- ============================================================
CREATE TABLE IF NOT EXISTS access_logs (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    door_id         INTEGER REFERENCES doors(id) ON DELETE SET NULL,
    rfid_card_id    INTEGER REFERENCES rfid_cards(id) ON DELETE SET NULL,
    rfid_uid_raw    VARCHAR(50),
    timestamp       TIMESTAMPTZ DEFAULT NOW(),
    access_method   VARCHAR(30) DEFAULT 'rfid' CHECK (access_method IN ('rfid', 'master_key', 'manual_override', 'emergency', 'remote')),
    granted         BOOLEAN NOT NULL,
    denial_reason   VARCHAR(100),
    notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_logs_user ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_door ON access_logs(door_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_granted ON access_logs(granted);

-- ============================================================
-- 9. ALERTS — Alertas de seguridad
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
    id              SERIAL PRIMARY KEY,
    door_id         INTEGER REFERENCES doors(id) ON DELETE SET NULL,
    room_id         INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    sensor_type     VARCHAR(50) NOT NULL CHECK (sensor_type IN ('door_forced', 'motion_detected', 'unauthorized_access', 'alarm_triggered', 'device_offline', 'tamper_detected')),
    severity        VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message         TEXT NOT NULL,
    timestamp       TIMESTAMPTZ DEFAULT NOW(),
    is_resolved     BOOLEAN DEFAULT FALSE,
    resolved_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,
    resolution_note TEXT,
    email_sent      BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp DESC);

-- ============================================================
-- 10. ALARM_ZONES — Configuración de zonas de alarma
-- ============================================================
CREATE TABLE IF NOT EXISTS alarm_zones (
    id              SERIAL PRIMARY KEY,
    room_id         INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    zone_name       VARCHAR(100) NOT NULL,
    requires_security_clearance BOOLEAN DEFAULT TRUE,
    auto_arm_time   TIME,
    auto_disarm_time TIME,
    is_armed        BOOLEAN DEFAULT FALSE,
    armed_by        INTEGER REFERENCES users(id),
    armed_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCCION: Actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
