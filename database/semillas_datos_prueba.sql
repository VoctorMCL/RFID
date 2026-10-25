-- ===================================================================
-- Semillas de Datos Iniciales de Prueba
-- Corporación Universitaria Lasallista — Caldas, Antioquia
-- ===================================================================

-- 1. Torniquetes
INSERT INTO torniquetes (id_torniquete, nombre, ubicacion, activo) VALUES
(1, 'Torniquete 1 — Portería Principal', 'Acceso Peatonal Portería Principal (Carrera 51)', true),
(2, 'Torniquete 2 — Entrada Vehicular / Mixta', 'Acceso Portería 2 (Costado Norte)', true)
ON CONFLICT (id_torniquete) DO NOTHING;

-- 2. Personas
INSERT INTO personas (id_persona, nombre, apellido, documento_identidad, tipo_persona, programa, foto_path, activo) VALUES
(1, 'Victor Manuel', 'Cordoba Larez', '1152345678', 'estudiante', 'Ingeniería de Software', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', true),
(2, 'Jeronimo', 'Arboleda Galeano', '1152987654', 'estudiante', 'Ingeniería de Software', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80', true),
(3, 'Feibert Alirio', 'Guzman Perez', '71234567', 'docente', 'Facultad de Ingenierías', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80', true),
(4, 'Mariana', 'Zapata Correa', '1000123456', 'estudiante', 'Medicina Veterinaria', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80', true),
(5, 'Carlos Alberto', 'Montoya Rios', '98765432', 'visitante', 'Proveedor Tecnológico', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80', true)
ON CONFLICT (documento_identidad) DO NOTHING;

-- Actualizar fecha de expiración para el visitante (vigente por 1 mes)
UPDATE personas SET fecha_expiracion = CURRENT_DATE + INTERVAL '30 days' WHERE tipo_persona = 'visitante';

-- 3. Tarjetas RFID
INSERT INTO tarjetas_rfid (id_tarjeta, uid, id_persona, activa, tipo_tarjeta, notas) VALUES
(1, 'A1B2C3D4', 1, true, 'carnet_estudiantil', 'Carnet titular Victor Cordoba'),
(2, 'E5F6A7B8', 2, true, 'carnet_estudiantil', 'Carnet titular Jeronimo Arboleda'),
(3, 'C9D0E1F2', 3, true, 'carnet_docente', 'Carnet docente Feibert Guzman'),
(4, '11223344', 4, true, 'carnet_estudiantil', 'Carnet Mariana Zapata'),
(5, '55667788', 5, true, 'pase_visitante', 'Pase temporal de visitante'),
(6, '99887766', 1, false, 'carnet_estudiantil', 'Carnet revocado por reporte de extravío')
ON CONFLICT (uid) DO NOTHING;

-- Reiniciar secuencias si es necesario
SELECT setval('personas_id_persona_seq', (SELECT MAX(id_persona) FROM personas));
SELECT setval('tarjetas_rfid_id_tarjeta_seq', (SELECT MAX(id_tarjeta) FROM tarjetas_rfid));
SELECT setval('torniquetes_id_torniquete_seq', (SELECT MAX(id_torniquete) FROM torniquetes));
