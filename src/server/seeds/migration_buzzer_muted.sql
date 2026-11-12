-- Ejecutar UNA vez en la BD existente (Supabase / PostgreSQL local):
ALTER TABLE doors ADD COLUMN IF NOT EXISTS buzzer_muted BOOLEAN NOT NULL DEFAULT FALSE;
