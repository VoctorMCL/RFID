# 📡 Referencia de Endpoints API y WebSockets

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**  
**Servidor Base:** `http://localhost:4000` | **Prefijo REST:** `/api` | **WebSocket:** `ws://localhost:4000`

---

## 1. Esquema de Autenticación y Encabezados

Toda ruta protegida requiere un token JSON Web Token en los encabezados HTTP:

```http
Authorization: Bearer <token_jwt>
Content-Type: application/json
```

- **Rutas Públicas:** No requieren token (`/auth/rfid-login`, `/auth/login`, `/access/validate`, `/access/latest`, `/doors/:id/heartbeat`, `/health`).
- **Rutas Protegidas:** Exigen token JWT emitido a roles autorizados (`admin`, `rector`, `security`, `celador`, `admin_staff`).
- **Control de Sesión Única:** El token JWT vincula un `sessionId` que debe coincidir con `users.active_session_id`. Si se inicia sesión desde otra estación, el token anterior es revocado de inmediato con código `SESSION_TERMINATED`.

---

## 2. Endpoints Públicos

### 2.1 Autenticación Física por Tarjeta RFID (Terminal RADAR)
Autentica directamente a un Administrador o Celador aproximando su carnet físico al sensor RFID.

- **Método:** `POST`
- **Ruta:** `/api/auth/rfid-login`
- **Body:**
  ```json
  {
    "rfid_uid": "A1B2C3D4",
    "device_info": "Terminal RADAR Portería Principal"
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "message": "Bienvenido(a), Administrador General",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "sessionId": "4f9d2a6e-7c31-48e0-bb12-98e3b1c60d92",
      "user": {
        "id": 1,
        "first_name": "Administrador",
        "last_name": "General",
        "email": "admin@lasallista.edu.co",
        "document_id": "1000000000",
        "program": "Sistemas",
        "photo_url": null,
        "role_id": 1,
        "role": {
          "id": 1,
          "name": "admin",
          "display_name": "Administrador del Sistema",
          "global_access": true
        },
        "status": "active",
        "rfid_tag": "A1B2C3D4"
      }
    }
  }
  ```
- **Rechazo a Estudiantes/Docentes en Web (403 Forbidden):**
  ```json
  {
    "success": false,
    "error": "Acceso denegado: Esta tarjeta pertenece a un Estudiante. Los estudiantes y docentes solo validan ingreso en puertas físicas."
  }
  ```

---

### 2.2 Autenticación de Contingencia / Soporte Web
Autentica por correo electrónico o alias (`"admin"`, `"celador"`) y contraseña.

- **Método:** `POST`
- **Ruta:** `/api/auth/login`
- **Body:**
  ```json
  {
    "email": "admin@lasallista.edu.co",
    "password": "acceso2026",
    "device_info": "Navegador Web"
  }
  ```
- **Respuesta Exitosa (200 OK):** Mismo esquema que `/api/auth/rfid-login`.

---

### 2.3 Validación de Acceso RFID (Desde Hardware ESP32 o CrowPi 3)
Invocado por el microcontrolador o script Python al aproximar un carnet en una puerta inteligente.

- **Método:** `POST`
- **Ruta:** `/api/access/validate`
- **Body:**
  ```json
  {
    "rfid_uid": "E5F6A7B8",
    "door_id": 1,
    "access_method": "rfid"
  }
  ```
- **Respuesta - Acceso Concedido (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": 105,
      "logId": 105,
      "granted": true,
      "denial_reason": null,
      "timestamp": "2026-10-30T14:48:10.123Z",
      "uid": "E5F6A7B8",
      "user": {
        "id": 2,
        "first_name": "Carlos Andrés",
        "last_name": "López Mejía",
        "name": "Carlos Andrés López Mejía",
        "document_id": "1000000002",
        "program": "Ingeniería de Software",
        "role": "Profesor / Docente",
        "photo_url": null
      },
      "door": { "id": 1, "name": "Puerta Principal — Sala Informática 1", "status": "online" },
      "room": { "id": 1, "name": "Sala de Informática 1", "block_name": "Bloque A", "has_alarm": true, "security_status": "normal" },
      "alarm_triggered": false
    }
  }
  ```
- **Respuesta - Acceso Denegado con Disparo de Alarma Crítica (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": 106,
      "logId": 106,
      "granted": false,
      "denial_reason": "denegado_area_no_autorizada",
      "timestamp": "2026-10-30T14:50:00.000Z",
      "uid": "99999999",
      "user": null,
      "door": { "id": 1, "name": "Puerta Principal — Sala Informática 1", "status": "online" },
      "room": { "id": 1, "name": "Sala de Informática 1", "block_name": "Bloque A", "has_alarm": true, "security_status": "alert" },
      "alarm_triggered": true,
      "alarm": {
        "id": 4,
        "door_id": 1,
        "room_id": 1,
        "sensor_type": "alarm_triggered",
        "severity": "critical",
        "message": "🚨 ALERTA CRÍTICA: Intento de apertura no autorizada...",
        "is_resolved": false
      }
    }
  }
  ```

---

### 2.4 Último Escaneo Registrado (Soporte Polling / Serverless)
Permite a clientes en Vercel o sin WebSockets obtener instantáneamente el último evento registrado.

- **Método:** `GET`
- **Ruta:** `/api/access/latest`
- **Respuesta:** Retorna el último objeto de escaneo registrado en memoria o en PostgreSQL.

---

### 2.5 Señal de Vida de Hardware (Heartbeat)
- **Método:** `POST`
- **Ruta:** `/api/doors/:id/heartbeat`
- **Body:** `{}`
- **Respuesta:** Retorna los datos de la puerta actualizada con `last_heartbeat` y emite evento WebSocket `hardware_heartbeat`.

---

### 2.6 Estado de Salud del Sistema (Health Check)
- **Método:** `GET`
- **Ruta:** `/health`
- **Respuesta (200 OK):**
  ```json
  {
    "status": "ok",
    "system": "Control de Acceso RFID Institucional",
    "institution": "Corporación Universitaria Lasallista",
    "timestamp": "2026-10-30T19:57:28.927Z"
  }
  ```

---

## 3. Endpoints Protegidos (Gestión y Operación)

### 3.1 Perfil y Seguridad de Usuario
- `GET /api/auth/me` — Retorna el perfil completo del usuario autenticado, su rol y su tarjeta física activa.
- `POST /api/auth/logout` — Cierra la sesión activa en el servidor y limpia `active_session_id`.
- `PUT /api/auth/change-password` — Permite al usuario actualizar su contraseña (`currentPassword`, `newPassword`).

### 3.2 Analítica Avanzada y Telemetría para Grafana (`/api/access/analytics`)
Genera la telemetría institucional en tiempo real consumida por Grafana (`grafana-dashboard.json`):
- **Método:** `GET`
- **Ruta:** `/api/access/analytics`
- **Datos Retornados:**
  - `hourly`: Picos de afluencia por franja horaria (hoy, hora Colombia).
  - `minute`: Accesos minuto a minuto (últimos 60 minutos).
  - `studentsByProgram`: Estudiantes actualmente en campus discriminados por programa académico.
  - `weeklyByProgram`: Evolución semanal de afluencia por día y carrera.
  - `byBlock`: Tráfico acumulado por bloque institucional.
  - `heatmap`: Matriz de intensidad de accesos (Día de la semana vs Hora del día).
  - `topDoors`: Puertas con mayor tráfico durante el día.
  - `weeklyVolume`: Comparativa diaria de autorizados vs denegados (últimos 7 días).
  - `denialReasons`: Pareto de causas de denegación e infracciones.
  - `rolesDistribution`: Distribución de flujo por rol institucional.
  - `comparison`: Comparativa directa Hoy vs Ayer.
  - `spaceTypes`: Distribución de accesos según tipo de espacio (laboratorios, aulas, áreas administrativas).
  - `avgStay`: Tiempo promedio de permanencia en campus por estudiante.
  - `dbHealth`: Estado de conexión, latencia en ms y disponibilidad de PostgreSQL / Supabase.

### 3.3 Pases de Visitantes y Préstamos Temporales RFID (`/api/visitor-passes`)
- `GET /api/visitor-passes` — Lista los pases y préstamos con filtros por `status` (`'active'`, `'returned'`, `'all'`) y búsqueda (`search`).
- `POST /api/visitor-passes` — Emite un pase vinculando obligatoriamente una tarjeta física leída (`card_uid`, `person_type`, `full_name`, `document_id`, `destination`, `reason`, `missing_card_reason`).
- `PUT /api/visitor-passes/:id/return` — Registra la devolución de la tarjeta, marca la salida con timestamp y desactiva la tarjeta para su custodia en portería.
- `DELETE /api/visitor-passes/:id` — Elimina el registro histórico del pase (solo Administrador).

### 3.4 Puertas Inteligentes (`/api/doors`)
- `GET /api/doors` — Lista todas las puertas con su estado de cerradura, sala, bloque y telemetría de hardware activo.
- `GET /api/doors/:id` — Detalle de una puerta específica.
- `POST /api/doors` — Registra una nueva puerta (`name`, `room_id`, `door_type`, `hardware_ip`, `mac_address`).
- `PUT /api/doors/:id` — Actualiza parámetros técnicos o cerradura.
- `DELETE /api/doors/:id` — Elimina una puerta.
- `POST /api/doors/:id/unlock` — Desbloqueo manual temporal (5 segundos) desde consola del celador o administrador.

### 3.5 Bloques Institucionales (`/api/blocks`)
- `GET /api/blocks` — Lista los bloques institucionales y el conteo de salas asociadas.
- `GET /api/blocks/:id` — Detalle del bloque.
- `POST /api/blocks` — Crea un bloque (`name`, `description`, `location_info`).
- `PUT /api/blocks/:id` — Actualiza datos del bloque.
- `DELETE /api/blocks/:id` — Elimina un bloque.

### 3.6 Salas y Laboratorios (`/api/rooms`)
- `GET /api/rooms` — Lista las salas con indicadores de alarma, estado de seguridad (`'normal'`, `'alert'`) y puertas vinculadas.
- `GET /api/rooms/:id` — Detalle de una sala.
- `POST /api/rooms` — Registra una sala (`block_id`, `name`, `floor`, `room_type`, `has_alarm`, `description`).
- `PUT /api/rooms/:id` — Actualiza parámetros de la sala.
- `DELETE /api/rooms/:id` — Elimina la sala.

### 3.7 Usuarios y Credenciales (`/api/users`)
- `GET /api/users` — Lista usuarios con filtros por `role_id`, `status` y término de búsqueda `search`.
- `GET /api/users/:id` — Ficha completa del usuario con sus tarjetas RFID asociadas y rol.
- `POST /api/users` — Registra una persona y enrola opcionalmente su carnet RFID.
- `PUT /api/users/:id` — Modifica datos personales o suspende el acceso de un usuario.
- `DELETE /api/users/:id` — Elimina un usuario de la base de datos.

### 3.8 Tarjetas RFID y Enrolamiento (`/api/rfid-cards`)
- `GET /api/rfid-cards` — Lista los carnets enrolados con titular y tipo (`'standard'`, `'master'`, `'temporary'`).
- `GET /api/rfid-cards/:id` — Detalle de una tarjeta específica.
- `POST /api/rfid-cards/enroll` (o `POST /api/rfid-cards`) — Enrola una tarjeta física (`uid`, `user_id`, `card_type`, `label`).
- `PUT /api/rfid-cards/:id` — Actualiza la tarjeta o su titular.
- `PUT /api/rfid-cards/:id/deactivate` — Desactiva de inmediato una tarjeta extraviada.
- `DELETE /api/rfid-cards/:id` — Elimina una tarjeta.

### 3.9 Articulación Horaria (`/api/schedules`)
- `GET /api/schedules` — Lista las asignaciones de horario activas por docente, sala o día de la semana.
- `GET /api/schedules/:id` — Detalle de una asignación horaria.
- `POST /api/schedules` — Registra una franja (`user_id`, `room_id`, `day_of_week`, `start_time`, `end_time`, `subject_name`).
- `PUT /api/schedules/:id` — Actualiza horas o día de la clase.
- `DELETE /api/schedules/:id` — Elimina una asignación horaria.

### 3.10 Auditoría y Logs (`/api/access/logs`)
- `GET /api/access/logs` — Retorna el historial cronológico paginado (`page`, `limit`, `granted`, `user_id`, `door_id`, `search`).
- `GET /api/access/logs/stats` — Resumen estadístico del día (total de accesos, aprobados, denegados, tasa de éxito, sensores activos).

### 3.11 Alarmas y Seguridad (`/api/alerts`)
- `GET /api/alerts` — Lista alertas con filtro por resolución (`is_resolved`) y severidad.
- `POST /api/alerts` — Genera una nueva alerta manual o por sensor.
- `PUT /api/alerts/:id/resolve` — **Desarme y Resolución:** Silencia la sirena, registra la nota del celador y marca la alerta como resuelta.
- `POST /api/alerts/disarm-room/:roomId` — Restaura el estado de seguridad de una sala a `'normal'`.

---

## 4. Canal de Tiempo Real: WebSockets (`ws://localhost:4000`)

El servidor difunde eventos JSON automáticos sobre el bus WebSocket a todos los navegadores conectados:

| Evento | Payload Clave | Descripción |
| :--- | :--- | :--- |
| `access_attempt` | `{ logId, granted, uid, door, room, user, alarmTriggered }` | Difundido instantáneamente ante cada lectura de tarjeta en cualquier puerta o torniquete. |
| `new_alert` | `{ id, room_id, door_id, severity: 'critical', message }` | Emitido cuando se viola una sala asegurada o se fuerza una puerta. |
| `alert_resolved` | `{ alertId, resolvedBy }` | Notifica que el celador ha silenciado y resuelto la alerta. |
| `door_status` | `{ doorId, isLocked }` | Informa la apertura (5 s) y re-bloqueo automático del electroimán. |
| `hardware_heartbeat`| `{ doorId, doorName, status: 'online' }` | Notifica que el lector físico está operativo (conmuta caja a VERDE). |
| `room_security_change`| `{ roomId, status }` | Notifica cambio de estado de seguridad en una sala (ej. desarmada a `'normal'`). |
| `visitor_pass_created`| `{ id, card_uid, full_name, status }` | Notifica la emisión inmediata de un pase de visitante en portería. |
| `visitor_pass_returned`| `{ id, card_uid, exit_time, status: 'returned' }` | Notifica la devolución de la tarjeta física prestada. |
