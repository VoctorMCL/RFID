# ADR-003: Restricción Exclusiva de Inicio de Sesión Web a Administrador y Celador

## Status
Aceptada

## Fecha
2026-10-02

## Contexto
Durante las fases tempranas del proyecto se contempló si los estudiantes y docentes debían tener un panel de usuario web para consultar su historial de entradas. Sin embargo, esto introducía graves inconvenientes:
1. La plataforma web contiene controles críticos sobre electroimanes, cerrojos, consolas de alarma y mapeo de infraestructura.
2. Habilitar inicio de sesión para miles de estudiantes abre innecesariamente la superficie de ataque a ataques de fuerza bruta, phishing de credenciales institucionales o intentos de escalamiento de privilegios hacia el control de puertas físicas.
3. El propósito real del estudiante o profesor es interactuar físicamente mediante su carnet RFID, sin fricción de contraseñas ni navegación web.

## Decisión
1. **Restricción Estricta en Backend:** El endpoint `POST /api/auth/login` restringe de forma categórica el acceso exclusivamente a los roles autorizados:
   - `admin` (Administrador General)
   - `rector` (Rectoría / Alta Dirección)
   - `security` / `celador` (Personal de Vigilancia y Portería)
2. **Rechazo Activo a Estudiantes y Profesores:** Si se introducen las credenciales de un estudiante o docente, el backend rechaza de forma inmediata con código HTTP `403 Forbidden` y un mensaje claro:
   > *"Acceso denegado: Los estudiantes y profesores no inician sesión en la plataforma web. Su acceso se valida únicamente mediante carnet RFID en las puertas."*
3. **Interfaz de Login Optimizada:** La vista `Login.jsx` dispone de botones de 1-clic directos para el Celador y el Administrador, eliminando cualquier ambigüedad en auditorías y demostraciones.

## Consecuencias
- La consola web permanece como una herramienta técnica de seguridad cerrada y blindada.
- No se expone información de cerraduras ni alarmas a usuarios que no forman parte del equipo de seguridad o administración del campus.
