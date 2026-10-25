-- ===================================================================
-- Esquema de Base de Datos: Control de Acceso Peatonal RFID con Validación Visual
-- Institución: Corporación Universitaria Lasallista (Caldas - Antioquia)
-- Proyecto: Ingeniería de Software 2026-2
-- Motor: PostgreSQL 14+ / Supabase
-- ===================================================================

-- Habilitar extensión UUID por si se requiere
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------
-- 1. TABLA: personas
-- Representa a los miembros de la comunidad universitaria y visitantes
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personas (
    id_persona SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    documento_identidad VARCHAR(50) NOT NULL UNIQUE,
    tipo_persona VARCHAR(30) NOT NULL DEFAULT 'estudiante'
        CHECK (tipo_persona IN ('estudiante', 'docente', 'administrativo', 'visitante')),
    programa VARCHAR(150),
    foto_path TEXT,
    fecha_expiracion DATE,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -------------------------------------------------------------------
-- 2. TABLA: tarjetas_rfid
-- Tarjetas físicas RFID/NFC (Mifare Classic 1K / 13.56 MHz)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarjetas_rfid (
    id_tarjeta SERIAL PRIMARY KEY,
    uid VARCHAR(50) NOT NULL UNIQUE,
    id_persona INTEGER REFERENCES personas(id_persona) ON DELETE SET NULL,
    activa BOOLEAN NOT NULL DEFAULT true,
    tipo_tarjeta VARCHAR(30) DEFAULT 'carnet_estudiantil',
    fecha_emision TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notas TEXT
);

-- -------------------------------------------------------------------
-- 3. TABLA: torniquetes
-- Puntos físicos de acceso peatonal (porterías, torniquetes, molinetes)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS torniquetes (
    id_torniquete SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    ubicacion VARCHAR(150) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -------------------------------------------------------------------
-- 4. TABLA: accesos
-- Registro de auditoría y trazabilidad de cada intento de acceso
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accesos (
    id_acceso BIGSERIAL PRIMARY KEY,
    uid_leido VARCHAR(50) NOT NULL,
    id_tarjeta INTEGER REFERENCES tarjetas_rfid(id_tarjeta) ON DELETE SET NULL,
    id_torniquete INTEGER REFERENCES torniquetes(id_torniquete) ON DELETE SET NULL,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resultado VARCHAR(40) NOT NULL
        CHECK (resultado IN ('permitido', 'denegado_no_registrado', 'denegado_revocada', 'denegado_revocado', 'denegado_expirada', 'denegado_inactivo')),
    confirmado_celador BOOLEAN DEFAULT true,
    tiempo_respuesta_ms INTEGER DEFAULT 120
);

-- -------------------------------------------------------------------
-- ÍNDICES PARA ALTO RENDIMIENTO (Meta < 3 segundos)
-- -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tarjetas_uid ON tarjetas_rfid(uid);
CREATE INDEX IF NOT EXISTS idx_tarjetas_persona ON tarjetas_rfid(id_persona);
CREATE INDEX IF NOT EXISTS idx_personas_doc ON personas(documento_identidad);
CREATE INDEX IF NOT EXISTS idx_accesos_fecha ON accesos(fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_accesos_torniquete ON accesos(id_torniquete);

-- -------------------------------------------------------------------
-- POLÍTICAS DE SEGURIDAD (Row Level Security - RLS)
-- Conforme a RNF-014 y Ley 1581 de 2012 de Protección de Datos Personales
-- -------------------------------------------------------------------
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarjetas_rfid ENABLE ROW LEVEL SECURITY;
ALTER TABLE torniquetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE accesos ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir operaciones desde la API anónima de lectura y registro
DO $$
BEGIN
    DROP POLICY IF EXISTS "Permitir lectura general anon a personas" ON personas;
    CREATE POLICY "Permitir lectura general anon a personas" ON personas FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Permitir insercion/edicion a personas" ON personas;
    CREATE POLICY "Permitir insercion/edicion a personas" ON personas FOR ALL USING (true);

    DROP POLICY IF EXISTS "Permitir lectura general anon a tarjetas" ON tarjetas_rfid;
    CREATE POLICY "Permitir lectura general anon a tarjetas" ON tarjetas_rfid FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Permitir mutacion a tarjetas" ON tarjetas_rfid;
    CREATE POLICY "Permitir mutacion a tarjetas" ON tarjetas_rfid FOR ALL USING (true);

    DROP POLICY IF EXISTS "Permitir lectura a torniquetes" ON torniquetes;
    CREATE POLICY "Permitir lectura a torniquetes" ON torniquetes FOR ALL USING (true);

    DROP POLICY IF EXISTS "Permitir acceso total a accesos" ON accesos;
    CREATE POLICY "Permitir acceso total a accesos" ON accesos FOR ALL USING (true);
END $$;
