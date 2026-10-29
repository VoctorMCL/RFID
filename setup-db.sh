#!/bin/bash
# ===================================================================
# Script de configuración de PostgreSQL — Control de Acceso RFID
# Ejecutar con: sudo bash setup-db.sh
# ===================================================================
set -e

echo "🔧 Configurando PostgreSQL para Control de Acceso RFID..."

# Crear usuario y base de datos
sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'victormcl') THEN
    CREATE ROLE victormcl WITH LOGIN SUPERUSER PASSWORD 'rfid2026';
    RAISE NOTICE 'Rol victormcl creado.';
  ELSE
    ALTER ROLE victormcl WITH PASSWORD 'rfid2026';
    RAISE NOTICE 'Rol victormcl ya existía, contraseña actualizada.';
  END IF;
END $$;
SQL

sudo -u postgres createdb rfid_db -O victormcl 2>/dev/null && echo "✅ Base de datos rfid_db creada." || echo "ℹ️  Base de datos rfid_db ya existe."

# Ejecutar esquema
echo "📋 Ejecutando esquema..."
psql -U victormcl -d rfid_db -f "$(dirname "$0")/src/server/config/schema.sql"

# Ejecutar seeds
echo "🌱 Insertando datos semilla..."
psql -U victormcl -d rfid_db -f "$(dirname "$0")/src/server/seeds/seed.sql"

echo ""
echo "✅ PostgreSQL configurado correctamente."
echo "   Usuario: victormcl"
echo "   Base de datos: rfid_db"
echo "   Puerto: 5432"
