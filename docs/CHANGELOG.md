# 📜 Registro de Cambios (Changelog)

Todos los cambios notables en el proyecto **Ecosistema Inteligente de Control de Acceso RFID** están documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [2.2.0] - 2026-10-30

### ✨ Añadido
- **Terminal RADAR de Acceso:** Interfaz split-screen inmersiva con barrido de radar animado, ondas líquidas SVG multicapa, detección automática de tarjetas físicas y botón interactivo para acceso de prueba (demo).
- **Módulo de Pases de Visitantes y Préstamos Temporales:** Nueva entidad `visitor_passes` y endpoints `/api/visitor-passes` para emitir pases con vinculación obligatoria de tarjeta RFID física, control de motivo, seguimiento de destino y registro de devolución.
- **Telemetría Avanzada para Grafana:** Endpoint `/api/access/analytics` con métricas por minuto/hora, distribución de estudiantes por carrera, flujo por bloques, mapa de calor semanal y pareto de causas de denegación.
- **Tablero Oficial de Grafana:** Archivo `grafana-dashboard.json` listo para importar en instancias institucionales de Grafana.
- **Control Estricto de Sesión Única:** Generación y validación de `active_session_id` por puesto de trabajo que revoca automáticamente tokens previos si se inicia sesión desde otra terminal.
- **Temporizador de Inactividad:** Cierre de sesión y revocación automática tras 15 minutos continuos sin interacción del usuario.
- **Documentación JSDoc y Limpieza de Código:** Estandarización de cabeceras JSDoc en todos los controladores y módulos del servidor, eliminación de código muerto y preservación estricta de componentes de demostración (demo).

### 🔄 Modificado
- **Unificación de Servidor en Puerto 4000:** El servidor Express sirve simultáneamente la API REST, WebSockets y la SPA de React compilada (`dist/`).
- **Actualización Integral de Documentación:** Sincronización completa de `README.md`, `hardware/README.md`, `docs/ENDPOINTS.md`, `docs/DATABASE.md`, `docs/DATA-DICTIONARY.md`, `docs/AUTH.md` y `docs/USER_MANUAL.md`.

---

## [2.0.0] - 2026-10-25

### ✨ Añadido
- **Estructuración Dinámica de Campus:** Soporte completo para creación de Bloques (A, B, C, Administrativo), Salas (Informática 1 a 6, Taller de Ingeniería, Biblioteca, Admisiones) y Puertas Inteligentes (IP/MAC) sin código quemado.
- **Motor de Articulación Horaria:** Validación de permisos en tiempo real contra la tabla `schedules` para profesores y estudiantes por día y franja horaria.
- **Prototipo Sala de Informática 1:** Integración de dos puertas (Principal y Lateral), sensores magnéticos y de movimiento PIR, y lógica de alarma perimetral.
- **Protocolo de Alarma Crítica:** La alarma de intrusión en Sala 1 solo puede ser silenciada y resuelta desde el cuarto de control de seguridad del celador (`POST /api/alerts/:id/resolve`).
- **Barra Lateral Comprimible (Sidebar):** Menú colapsable a la izquierda con modo compacto (68 px) y persistencia en `localStorage` (`rfid_sidebar_collapsed`).
- **Detección Dinámica de Sensor RFID:** Indicador visual en el Escáner que muestra en **ROJO** cuando el sensor está desconectado y en **VERDE** cuando se confirma el enlace de hardware.
- **Animación de Vibración en Errores:** Implementación de `@keyframes vibrate-shake` en CSS y activación de la API de vibración háptica del navegador (`navigator.vibrate`) en denegaciones.
- **Arquitectura Dual Engine:** Fallback en memoria de alta disponibilidad que mantiene el sistema 100% operativo ante caídas o ausencia de PostgreSQL.
- **Lanzador Unificado:** Script [`start.sh`](file:///home/victormcl/Documents/RFID/start.sh) que arranca simultáneamente el backend en el puerto 4000 y el frontend en el puerto 5173.

### 🔄 Modificado
- **Restricción Estricta de Ingreso Web:** La consola web ahora está restringida **únicamente al Administrador y al Celador / Vigilante**. Estudiantes y profesores reciben código `403 Forbidden` y mensaje explicativo al intentar loguearse.
- **Paleta Monocromática Oscura:** Migración de la interfaz general a una escala estricta de tonos grises y neutros técnicos (`#121214` a `#34343d`), eliminando colores saturados distractores.
- **Cliente API Resiliente:** Lectura segura con `response.text()` y eliminación de redirecciones destructivas `window.location.href` en errores 401.

### 🐛 Corregido
- Corregido el fallo `JSON.parse: unexpected end of data at line 1 column 1` durante el inicio de sesión.
- Corregida la desconexión cíclica de WebSockets en Firefox (`The connection to ws://localhost:4000/ was interrupted while loading`) mediante desacoplamiento con `useRef`.
- Corregido el fallo de autenticación de PostgreSQL envolviendo todas las consultas en bloques `try...catch` con conmutación instantánea a memoria.

### 🗑️ Eliminado
- Eliminación total de toda referencia, nomenclatura y residuo textual a "SISV" en el código fuente, base de datos, scripts y documentación.
- Renombrado `hardware/lector_rfid_sisv.py` a [`hardware/lector_rfid.py`](file:///home/victormcl/Documents/RFID/hardware/lector_rfid.py).

---

## [1.0.0] - 2026-02-01

### ✨ Versión Inicial de Prototipo
- Prototipo inicial de lectura RFID mediante módulo RC522 en Raspberry Pi.
- Validación básica de UID contra base de datos en la nube.
- Interfaz gráfica elemental para despliegue de fotografía en pantalla.
- Registro básico de asistencias peatonales en torniquete.
