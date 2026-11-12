# 🛡️ Ecosistema Inteligente de Control de Acceso RFID
### Monitoreo Físico y Articulación Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia (2026-2)**

---

## 🏛️ Visión y Arquitectura General

El sistema es un ecosistema inteligente de control de acceso físico, telemetría en tiempo real, gestión de seguridad y articulación horaria institucional diseñado para la Corporación Universitaria Lasallista:

1. **Terminal RADAR de Acceso y Detección:**
   - Autenticación criptográfica con tarjetas físicas RFID (MFRC522 / Mifare 13.56 MHz).
   - Interfaz inmersiva Split-Screen con animación de barrido de radar y revelación líquida de identidad al aproximar el carnet.
   - Soporte universal de lectura: WebSocket en tiempo real, polling resiliente y detectores USB cuña de teclado.
   - Botón de acceso de prueba (*demo*) para inspección visual sin requerir hardware conectado.
2. **Gestión Dinámica de Espacios (cero hardcoding):**
   - **Bloques:** Bloque A, Bloque B, Bloque C y Bloque Administrativo.
   - **Salas:** 6 Salas de Informática, Taller de Ingeniería, Biblioteca Central, Decanatura, Financiero y Admisiones.
   - **Puertas Inteligentes:** Configuración de hardware IP y MAC (ej. Puerta Principal y Puerta Lateral hacia Taller de Ingeniería).
3. **Articulación Horaria (RRHH / Decanatura):** Validación de permisos de acceso de docentes y estudiantes en tiempo real contra los horarios de clase asignados en cada sala (`schedules`).
4. **Pases de Visitantes y Préstamos Temporales RFID:**
   - Registro de visitantes externos, contratistas y estudiantes sin carnet con vinculación obligatoria de tarjeta física.
   - Auditoría de préstamos activos, control de devolución y liberación automática de tarjetas.
5. **Jerarquía Estricta de Roles (RBAC) y Seguridad:**
   - **Administrador:** Control total de la plataforma web, gestión de bloques, salas, puertas, personas, horarios y analítica.
   - **Celador / Seguridad:** Monitoreo visual de accesos en tiempo real, validación de ingresos, registro de pases y consola de desarme de alarmas críticas.
   - **Rectora / Alta Administración:** Acceso total e irrestricto a todas las puertas del campus en cualquier momento.
   - **Profesores:** Acceso condicionado a los horarios de clase programados en las salas específicas mediante carnet RFID (no ingresan a la plataforma web).
   - **Estudiantes:** Acceso a espacios autorizados en franjas horarias válidas mediante carnet RFID (no ingresan a la plataforma web).
   - **Política de Sesión Única:** Solo 1 sesión activa simultánea por estación de trabajo (`active_session_id`).
   - **Cierre por Inactividad:** Cierre de sesión automático tras 15 minutos sin interacción del usuario.
6. **Telemetría Avanzada y Dashboard en Grafana:**
   - Endpoint dedicado de analítica institucional (`/api/access/analytics`).
   - Dashboard exportado en JSON listo para Grafana (`grafana-dashboard.json`) con métricas por hora, minuto, carrera, calor y afluencia.
7. **Prototipo Sala de Informática 1 con Alarma Integrada:**
   - 2 Puertas inteligentes con sensores magnéticos y de movimiento.
   - **Lógica de Alarma Crítica:** Si se abre sin desarmado previo desde la central de seguridad, se activa una alarma física y virtual que **únicamente** puede deshabilitarse desde el cuarto de control de seguridad.

---

## 📁 Estructura del Proyecto

```
RFID/
├── src/
│   ├── client/                  # Frontend SPA React 19 + Vite
│   │   ├── api/client.js        # Cliente HTTP con inyección JWT y tolerancia a fallos
│   │   ├── context/AuthContext  # Manejador de sesión única, inactividad y roles
│   │   ├── components/Layout/   # Barra lateral comprimible (Sidebar) y Topbar
│   │   ├── pages/
│   │   │   ├── Login.jsx        # Terminal RADAR split-screen con lectura RFID y botón demo
│   │   │   ├── Monitor.jsx      # Escáner RFID, sensor dinámico (rojo/verde) y telemetría
│   │   │   ├── Dashboard.jsx    # Métricas y resumen operativo en tiempo real
│   │   │   ├── InstitutionalMap # CRUD dinámico de Bloques → Salas → Puertas
│   │   │   ├── Users.jsx        # Gestión de personas, roles y credenciales
│   │   │   ├── RFIDCards.jsx    # Enrolamiento de tarjetas maestras, estándar y pases temporales
│   │   │   ├── Schedules.jsx    # Articulación horaria docente/estudiantil
│   │   │   ├── AccessLogs.jsx   # Historial de auditoría y exportación a CSV
│   │   │   └── Alerts.jsx       # Consola de resolución de alarmas críticas y desarme
│   │   ├── App.css              # Estilos UI, animaciones de radar, ondas líquidas y tema oscuro
│   │   ├── App.jsx              # Enrutador principal del cliente
│   │   └── main.jsx             # Punto de montaje React
│   │
│   └── server/                  # Backend Node.js + Express + WebSockets (puerto 4000)
│       ├── config/              # db.js (Pool PostgreSQL / Supabase) y schema.sql
│       ├── controllers/         # auth, access, alerts, blocks, doors, rfidCards, rooms, schedules, users, visitorPasses
│       ├── middleware/          # auth.js (JWT, sesión única & verificación de roles)
│       ├── routes/              # Endpoints de la API REST (/api)
│       ├── seeds/               # Semillas SQL institucionales con usuarios demo (seed.sql)
│       ├── services/            # wsService.js (WebSockets) y emailService.js (alertas)
│       ├── app.js               # Configuración Express (CORS, Helmet, API, estáticos dist/)
│       └── server.js            # Entrypoint del servidor HTTP + WebSockets
│
├── api/                         # Función Serverless para despliegue en Vercel
│   └── index.js                 # Exporta la API de Express directamente a Vercel
│
├── hardware/                    # Scripts y Firmware para Hardware Físico
│   ├── lector_rfid.py           # Cliente Python para Raspberry Pi / CrowPi 3 (RC522 por SPI)
│   ├── esp32_rfid_firmware.ino  # Firmware Arduino/C++ para microcontroladores ESP32 por WiFi
│   └── README.md                # Pinout de conexión SPI y manual de ejecución
│
├── docs/                        # Suite Exhaustiva de Documentación Técnica
│   ├── README.md                # Índice maestro de documentación
│   ├── ARCHITECTURE.md          # Arquitectura del ecosistema (C4 y capas)
│   ├── REQUIREMENTS.md          # Especificación formal de requisitos (SRS)
│   ├── USE_CASES.md             # Casos de uso formales (CU-001 a CU-010)
│   ├── USER_STORIES.md          # Historias de usuario por rol (US-001 a US-012)
│   ├── DATABASE.md              # Modelo relacional PostgreSQL y diagrama ER
│   ├── DATA-DICTIONARY.md       # Diccionario de datos exhaustivo campo por campo
│   ├── ENDPOINTS.md             # Referencia completa de endpoints REST y WebSockets
│   ├── AUTH.md                  # Modelo RBAC, tokens JWT y bloqueo de login a alumnos
│   ├── SECURITY.md              # Seguridad física, alarmas en Sala 1 y Ley 1581
│   ├── HARDWARE.md              # Lector MFRC522, pinout SPI, ESP32 y Raspberry Pi
│   ├── DEPLOYMENT.md            # Despliegue en producción y servicio systemd
│   ├── VERCEL_DEPLOYMENT.md     # Despliegue oficial en Vercel + captura RFID
│   ├── SEQUENCE_DIAGRAMS.md     # Diagramas de secuencia en Mermaid (SD-001..004)
│   ├── ACTIVITIES.md            # Diagramas de actividad en Mermaid (AD-001..003)
│   ├── UML.md                   # Diagrama de clases y componentes en Mermaid
│   ├── USER_MANUAL.md           # Manual de usuario para Administrador y Celador
│   ├── TESTING.md               # Plan de pruebas, QA y verificación SLA < 3s
│   ├── TROUBLESHOOTING.md       # Runbook de diagnóstico de fallas operativas
│   ├── GLOSSARY.md              # Glosario técnico y de control de acceso
│   ├── CHANGELOG.md             # Historial de cambios y versiones (v1 a v2.2)
│   ├── CONTRIBUTING.md          # Estándares de desarrollo y directrices de equipo
│   └── decisions/               # Registros de Decisiones de Arquitectura (ADR-001..006)
│
├── grafana-dashboard.json       # Definición de tablero de telemetría institucional en Grafana
├── supabase_schema.sql          # Esquema DDL para base de datos PostgreSQL en Supabase
├── seed-supabase.js             # Script de población de datos iniciales en Supabase
├── setup-db.sh                  # Script de configuración de PostgreSQL local
├── start.sh                     # Lanzador unificado de todo el ecosistema (Servidor + Web)
├── vite.config.mjs              # Configuración unificada de Vite
├── vercel.json                  # Configuración de despliegue en la nube
└── package.json                 # Dependencias y scripts npm unificados
```

---

## 🚀 Puesta en Marcha (PC como Servidor de Pruebas & Despliegue)

### 1. Iniciar el Servidor Unificado (Frontend + Backend + WebSockets en Puerto 4000)
Desde la raíz del repositorio:

```bash
# Opción 1: Lanzador automático con detección de IP de red
./start.sh

# Opción 2: Directamente con npm (deja la PC como servidor de pruebas)
npm run serve
```

El servidor unificado atiende tanto la aplicación web completa como la API y los sockets:
- **Acceso Local (en esta PC):** [http://localhost:4000](http://localhost:4000)
- **Acceso en Red LAN (desde celulares, tablets o laptops conectadas al mismo Wi-Fi/red):** `http://<IP_DE_TU_PC>:4000` *(ej. `http://10.55.98.145:4000`)*
- **API REST:** `http://<IP_DE_TU_PC>:4000/api`
- **Servidor WebSocket:** `ws://<IP_DE_TU_PC>:4000`

### 2. Dejar la PC corriendo permanentemente como Servidor de Pruebas
Si deseas dejar la terminal libre o cerrar la sesión mientras la PC sigue funcionando como servidor de pruebas:

```bash
# Iniciar en segundo plano
nohup npm run serve > server.log 2>&1 &

# Para monitorear logs en tiempo real:
tail -f server.log

# Para detener el servidor cuando termines:
pkill -f "node src/server/server.js"
```

### 3. Credenciales de Demostración para Ingreso Web (Contraseña: `acceso2026`):

| Rol Autorizado | Correo / Usuario | Privilegios y Alcance |
|---|---|---|
| **Administrador** | `admin@lasallista.edu.co` (o `admin`) | Acceso total irrestricto, configuración de bloques, salas, puertas, personas y horarios |
| **Celador / Vigilancia** | `celador@lasallista.edu.co` (o `celador`) | Acceso al Escáner en tiempo real, validación de ingresos y consola de alarmas críticas |

> ℹ️ **Nota de Seguridad:** Estudiantes y docentes no inician sesión en la plataforma web; su acceso físico se valida al aproximar su carnet RFID al sensor de cada puerta o torniquete. En la pantalla de login, también está disponible el botón **Entrar como administrador (demo)** para pruebas rápidas.

---

## ⚡ Aspectos Clave Implementados

1. **Terminal RADAR Inmersiva:** Split-screen con ondas líquidas, telemetría de sesión, audio institucional de validación y detección automática de tarjetas físicas.
2. **Barra Lateral Comprimible (Sidebar):** Ubicada a la izquierda con botón de toggle para expandir (250px) o comprimir (68px en modo iconos compactos).
3. **Detección Dinámica de Sensor RFID:**
   - Si no hay lector conectado o activo: muestra en **ROJO** `🔴 Sensor RFID No Detectado`.
   - Cuando se detecta o comprueba la comunicación: cambia a **VERDE** `🟢 Sensor RFID Conectado / Confirmado`.
   - Botón interactivo para comprobar o simular el enlace de hardware directamente en pantalla.
4. **Animación de Vibraciones en Errores:** En accesos denegados, tarjetas no registradas o violaciones de horario, el módulo visual ejecuta una vibración lateral (`@keyframes vibrate-shake`) acompañada de vibración háptica con la API `navigator.vibrate`.
5. **Resistencia a Fallos de Red y Base de Datos:** Conexión directa a PostgreSQL / Supabase con reconexión resiliente, verificación SSL y soporte serverless en Vercel.
