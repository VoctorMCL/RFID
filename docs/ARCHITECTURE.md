# 🏛️ Documento de Arquitectura de Software

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**  
**Versión:** 2.0.0 (Actualizado a oct-2026)

---

## 1. Visión General del Sistema

El ecosistema no es únicamente un control de acceso tradicional para torniquetes peatonal, sino una **plataforma unificada e inteligente de gestión de seguridad, monitoreo físico y articulación horaria institucional**. 

El sistema está concebido para un despliegue **incremental y paulatino**:
- En las ubicaciones donde aún se conservan llaves físicas, la transición se realiza progresivamente instalando cerraduras electromagnéticas y lectores inteligentes en las puertas.
- El software está desacoplado del hardware y soporta la creación dinámica de campus enteros sin necesidad de recompilar código ni alterar la base de datos.
- El piloto inicial opera en la **Sala de Informática 1**, gestionando sus dos puertas de acceso y un sistema de alarma perimetral coordinado con el cuarto de seguridad.

---

## 2. Principios de Arquitectura

1. **Gestión Dinámica de Espacios (Cero Hardcoding):**
   Los bloques del campus (Bloque A, Bloque B, Bloque C, Bloque Administrativo), las salas/laboratorios y las puertas físicas se modelan como entidades relacionales en la base de datos y se administran desde la interfaz web. Ningún espacio está pre-diseñado rígidamente en el código fuente.

2. **Alta Disponibilidad y Resiliencia (Fallback en Memoria):**
   El servidor backend implementa un mecanismo de contingencia transparente: si el motor relacional PostgreSQL se encuentra offline o experimenta latencias de red, el sistema conmuta instantáneamente a un almacén en memoria precargado (`memoryDb`), garantizando que la apertura de puertas y la validación de carnets nunca se detengan.

3. **Separación Estricta entre Acceso Físico y Consola Web:**
   - **Estudiantes y Docentes:** Su interacción es **100% física mediante tarjeta RFID**. No tienen credenciales ni permisos para acceder a la plataforma web administrativa.
   - **Administradores y Celadores / Vigilantes:** Son los **únicos autorizados** para autenticarse en la consola web mediante credenciales protegidas con JWT.

4. **Monitoreo en Tiempo Real y Baja Latencia:**
   Toda lectura de tarjeta física se valida y refleja en el monitor del celador en **menos de 3 segundos** mediante WebSockets bidireccionales sobre TCP.

5. **Diseño de Interfaz Monocromático Técnico:**
   La interfaz web utiliza una paleta estricta en escala de grises y derivados oscuros (`#121214`, `#1a1a1e`, `#2b2b32`) para evitar fatiga visual y distracciones en el cuarto de control, complementada con **animaciones de vibración física y háptica** en eventos de error o acceso denegado.

---

## 3. Diagrama de Arquitectura Global (Modelo C4 Nivel 2)

```mermaid
graph TD
    subgraph CapaFisica ["1. Capa Física y Hardware Edge"]
        ESP32["ESP32 Microcontrolador<br/>(WiFi + SPI + RC522 + Relé + Buzzer)"]
        CrowPi["Raspberry Pi 5 / CrowPi 3<br/>(SPI + MFRC522 + Python 3)"]
        SensorMov["Sensores de Movimiento (x2)<br/>Sala Informática 1"]
        SensorPuerta["Sensor Magnético Puerta<br/>Sala Informática 1"]
    end

    subgraph CapaBackend ["2. Capa de Servicios Backend (Node.js :4000)"]
        APIServer["Express REST API Engine<br/>(/api/access, /api/doors, ...)"]
        WS["WebSocket Server (ws://:4000)<br/>Eventos de Acceso y Alarmas"]
        AuthMiddleware["JWT Authentication<br/>RBAC Guard"]
        ValEngine["Motor de Validación RFID<br/>y Articulación Horaria"]
        AlarmEngine["Motor de Alarmas Críticas<br/>y Notificación Nodemailer"]
        FallbackStore["Almacén en Memoria Transparente<br/>(Fallback de Alta Disponibilidad)"]
    end

    subgraph CapaDatos ["3. Capa de Persistencia"]
        Postgres[("PostgreSQL 16 Database<br/>rfid_db :5432")]
    end

    subgraph CapaFrontend ["4. Capa de Presentación Web (React 19 :5173)"]
        LoginView["Vista Login<br/>(Admin / Celador)"]
        MonitorView["Escáner en Vivo<br/>(Sensor Rojo/Verde + Vibración)"]
        AdminDashboard["Panel Dashboard & Métricas"]
        MapCRUD["Mapa Institucional Dinámico<br/>(Bloques → Salas → Puertas)"]
        SchedulesView["Articulación Horaria Docente"]
        AlertsConsole["Consola de Alarmas Críticas"]
    end

    %% Relaciones
    ESP32 -->|HTTP POST /api/access/validate| APIServer
    CrowPi -->|HTTP POST /api/access/validate| APIServer
    SensorMov -.->|Disparo de Alarma| ESP32
    SensorPuerta -.->|Detección de Intrusión| ESP32

    APIServer --> AuthMiddleware
    AuthMiddleware --> ValEngine
    ValEngine --> AlarmEngine

    ValEngine -->|Lectura / Escritura| Postgres
    Postgres -.->|Falla de Conexión| FallbackStore
    ValEngine -->|Fallback Automático| FallbackStore

    AlarmEngine -->|Broadcast WebSocket| WS
    ValEngine -->|Broadcast Intento| WS

    WS -->|Eventos en Vivo (3s)| MonitorView
    WS -->|Alerta Crítica| AlertsConsole
    APIServer -->|REST JSON| CapaFrontend
```

---

## 4. Desglose de Capas

### 4.1 Capa de Presentación (Frontend React)
- **Framework:** React 19 montado sobre Vite 8.
- **Enrutamiento:** `react-router-dom` con `ProtectedRoute` para aislamiento estricto de rutas.
- **Gestión de Sesión:** `AuthContext` con almacenamiento en `localStorage` (`rfid_token`, `rfid_user`).
- **Navegación:** Barra lateral (`Sidebar.jsx`) a la izquierda, comprimible entre modo expandido (250px) y modo compacto con solo iconos (68px).
- **Indicador Dinámico de Hardware:** En la vista del Escáner, el sensor se muestra en **ROJO** cuando no hay lector físico conectado y conmuta a **VERDE** cuando se confirma la presencia del lector CrowPi 3 o ESP32.
- **Efecto de Vibración:** `@keyframes vibrate-shake` en CSS y `navigator.vibrate([120, 60, 120])` en navegadores móviles/táctiles para alertar visual y físicamente al personal de seguridad en accesos denegados.

### 4.2 Capa de Negocio y API (Backend Node.js)
- **Runtime:** Node.js v20+ con Express 4.21.
- **Canal en Tiempo Real:** Servidor nativo de WebSockets (`ws` v8.18) multiplexado en el puerto HTTP 4000.
- **Motor de Validación de Acceso (`accessController.js`):**
  1. Recibe el UID de la tarjeta y el ID de la puerta consultada.
  2. Comprueba existencia, vigencia y estado de activación del carnet.
  3. Evalúa la jerarquía de roles:
     - **Rectoría / Ficha Maestra:** Acceso global irrestricto concedido.
     - **Personal Administrativo:** Acceso a salas de su bloque administrativo.
     - **Docentes y Estudiantes:** Valida contra la tabla de **Articulación Horaria** (`schedules`), verificando si el usuario tiene asignada la sala en el día de la semana y en la franja horaria actual (`HH:MM:SS`).
  4. Si la sala está asegurada con alarma (`has_alarm = TRUE` y `security_status = 'armed'`) y el intento es inválido o no autorizado, **activa inmediatamente la alarma física**, genera una alerta crítica en la base de datos y difunde el evento por WebSocket y correo electrónico.
  5. Si el acceso es concedido, emite la orden de desenganche del relé durante 5 segundos y registra el evento de auditoría en `access_logs`.

### 4.3 Capa de Persistencia y Resiliencia
- **Motor Primario:** PostgreSQL con índices B-Tree en `users(email)`, `rfid_cards(uid)`, `access_logs(timestamp)` y `schedules(user_id, room_id)`.
- **Motor Secundario (Fallback en Memoria):** Estructura en RAM inicializada con los datos institucionales completos (Bloques A, B, C, Administrativo; Salas 1 a 6; puertas de prueba; docentes, estudiantes y tarjetas demo). Todas las consultas del backend utilizan envoltorios `try...catch` con conmutación automática ante fallos de conexión a Postgres.

### 4.4 Capa de Hardware y Edge
- **Dispositivo 1: ESP32 Standalone:** Microcontrolador con WiFi integrado conectado al lector RFID RC522 mediante bus SPI a 3.3V. Controla directamente el relé de la cerradura electromagnética (GPIO 2) y el buzzer sonoro (GPIO 4).
- **Dispositivo 2: Raspberry Pi 5 / CrowPi 3:** Lector de escritorio o estación de torniquetes que ejecuta el script `hardware/lector_rfid.py` en Python 3, interactuando con `/dev/spidev0.0` para capturar tarjetas y despachar peticiones HTTP POST al backend central.

---

## 5. Prototipo Físico: Sala de Informática 1

La Sala de Informática 1 constituye el entorno piloto del proyecto y cuenta con el siguiente arreglo de seguridad:
- **Puerta 1 (Principal - ID 1):** Acceso directo desde el pasillo del Bloque A. Controlada por electroimán y lector RFID maestro.
- **Puerta 2 (Lateral Derecha - ID 2):** Conexión interna hacia el Taller de Ingeniería.
- **Sensores Físicos:** 2 sensores de presencia/movimiento PIR y 1 sensor magnético de contacto seco en la puerta principal.
- **Lógica de Alarma Crítica:** Si se detecta apertura forzada o no autorizada sin desarmado previo desde la central de seguridad, se activa una alarma crítica que **únicamente puede silenciarse y desactivarse desde la consola del celador/seguridad**.
