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

- **Rutas Públicas:** No requieren token (`/auth/login`, `/access/validate`, `/doors/:id/heartbeat`, `/health`).
- **Rutas Protegidas:** Exigen token JWT emitido a roles autorizados (`admin`, `rector`, `security`, `celador`, `admin_staff`).

---

## 2. Endpoints Públicos

### 2.1 Iniciar Sesión en Plataforma Web
Autentica a un Administrador o Celador para operar la consola web.

- **Método:** `POST`
- **Ruta:** `/api/auth/login`
- **Body:**
  ```json
  {
    "email": "admin@lasallista.edu.co",
    "password": "acceso2026"
  }
  ```
  *(También se admiten los alias rápidos `"admin"` o `"celador"` en el campo `email`).*
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": 1,
        "first_name": "Administrador",
        "last_name": "General",
        "email": "admin@lasallista.edu.co",
        "document_id": "1000000000",
        "program": "Sistemas",
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
- **Respuesta de Rechazo a Estudiantes/Profesores (403 Forbidden):**
  ```json
  {
    "success": false,
    "error": "Acceso denegado: Los estudiantes y profesores no inician sesión en la plataforma web. Su acceso se valida únicamente mediante carnet RFID en las puertas."
  }
  ```
- **Ejemplo `curl`:**
  ```bash
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"celador@lasallista.edu.co","password":"acceso2026"}'
  ```

---

### 2.2 Validación de Acceso RFID (Desde Hardware ESP32 o CrowPi 3)
Invocado por el microcontrolador o script Python al aproximar un carnet.

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
      "granted": true,
      "denial_reason": null,
      "timestamp": "2026-10-25T14:48:10.123Z",
      "user": {
        "id": 2,
        "first_name": "Carlos Andrés",
        "last_name": "López Mejía",
        "document_id": "1000000002",
        "program": "Ingeniería de Software",
        "role": "Profesor / Docente"
      },
      "door": { "id": 1, "name": "Puerta Principal — Sala Informática 1" },
      "room": { "id": 1, "name": "Sala de Informática 1", "has_alarm": true, "security_status": "normal" },
      "alarm_triggered": false
    }
  }
  ```
- **Respuesta - Acceso Denegado con Disparo de Alarma Crítica (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "granted": false,
      "denial_reason": "denegado_area_no_autorizada",
      "timestamp": "2026-10-25T14:50:00.000Z",
      "user": { "id": 4, "first_name": "Victor Manuel", "last_name": "Cordoba Larez", "role": "Estudiante" },
      "door": { "id": 1, "name": "Puerta Principal — Sala Informática 1" },
      "room": { "id": 1, "name": "Sala de Informática 1", "has_alarm": true, "security_status": "alert" },
      "alarm_triggered": true
    }
  }
  ```
- **Ejemplo `curl`:**
  ```bash
  curl -X POST http://localhost:4000/api/access/validate \
    -H "Content-Type: application/json" \
    -d '{"rfid_uid":"A1B2C3D4","door_id":1}'
  ```

---

### 2.3 Señal de Vida de Hardware (Heartbeat)
- **Método:** `POST`
- **Ruta:** `/api/doors/:id/heartbeat`
- **Body:** `{ "status": "online" }`
- **Respuesta:** `{ "success": true, "message": "Heartbeat registrado" }`

---

### 2.4 Estado de Salud del Sistema (Health Check)
- **Método:** `GET`
- **Ruta:** `/health`
- **Respuesta (200 OK):**
  ```json
  {
    "status": "ok",
    "system": "Control de Acceso RFID Institucional",
    "institution": "Corporación Universitaria Lasallista",
    "timestamp": "2026-10-25T19:57:28.927Z"
  }
  ```

---

## 3. Endpoints Protegidos (Gestión y Operación)

### 3.1 Puertas Inteligentes (`/api/doors`)
- `GET /api/doors` — Lista todas las puertas con su estado de cerradura, sala y bloque asociado.
- `GET /api/doors/:id` — Obtiene el detalle de una puerta específica.
- `POST /api/doors` — Registra una nueva puerta (`name`, `room_id`, `door_type`, `hardware_ip`, `mac_address`).
- `PUT /api/doors/:id` — Actualiza parámetros técnicos o ubicación de una puerta.
- `DELETE /api/doors/:id` — Elimina o retira una puerta de la red.
- `POST /api/doors/:id/unlock` — Desbloqueo remoto de emergencia desde la consola del celador/admin.

### 3.2 Bloques Institucionales (`/api/blocks`)
- `GET /api/blocks` — Lista todos los bloques institucionales y el conteo de salas que contienen.
- `GET /api/blocks/:id` — Detalle del bloque y sus dependencias.
- `POST /api/blocks` — Crea un bloque (`name`, `description`, `location_info`).
- `PUT /api/blocks/:id` — Actualiza información descriptiva o estado de un bloque.
- `DELETE /api/blocks/:id` — Desactiva un bloque.

### 3.3 Salas y Laboratorios (`/api/rooms`)
- `GET /api/rooms` — Lista las salas con indicadores de alarma, cámaras y sensores instalados.
- `GET /api/rooms/:id` — Detalle de una sala y sus puertas vinculadas.
- `POST /api/rooms` — Registra una sala (`block_id`, `name`, `floor`, `room_type`, `has_alarm`, `motion_sensors`).
- `PUT /api/rooms/:id` — Actualiza atributos de la sala.
- `DELETE /api/rooms/:id` — Elimina la sala.
- `POST /api/rooms/:id/toggle-alarm` — Arma o desarma perimetralmente la alarma de una sala (ej. Sala 1).

### 3.4 Personas y Usuarios (`/api/users`)
- `GET /api/users` — Lista usuarios con filtros por `role_id`, `status` y término de búsqueda `search`.
- `GET /api/users/:id` — Ficha completa del usuario con sus tarjetas RFID asociadas y roles.
- `POST /api/users` — Da de alta a una persona con su rol institucional.
- `PUT /api/users/:id` — Modifica datos personales o suspende el acceso de un usuario.
- `DELETE /api/users/:id` — Elimina o archiva un usuario.

### 3.5 Tarjetas RFID (`/api/rfid-cards`)
- `GET /api/rfid-cards` — Lista todos los carnets enrolados con el nombre del titular y categoría.
- `POST /api/rfid-cards` — Enrola una nueva tarjeta física (`uid`, `user_id`, `card_type`, `label`).
- `PUT /api/rfid-cards/:id` — Actualiza la tarjeta o transfiere el UID a otro titular.
- `DELETE /api/rfid-cards/:id` — Da de baja un carnet físico.
- `PATCH /api/rfid-cards/:id/toggle-active` — Revoca o reactiva de inmediato una tarjeta perdida.

### 3.6 Articulación Horaria (`/api/schedules`)
- `GET /api/schedules` — Lista las asignaciones de horario activas por docente, sala o día.
- `POST /api/schedules` — Crea una franja horaria (`user_id`, `room_id`, `day_of_week`, `start_time`, `end_time`, `subject_name`).
- `PUT /api/schedules/:id` — Edita las horas o sala de una clase.
- `DELETE /api/schedules/:id` — Elimina una asignación horaria.

### 3.7 Auditoría y Logs (`/api/access/logs`)
- `GET /api/access/logs` — Retorna el historial cronológico con soporte de paginación (`limit`, `offset`) y filtros (`granted`, `door_id`, `date`).
- `GET /api/access/logs/stats` — Resumen estadístico del día (total de accesos, aprobados, denegados, alarmas activas).

### 3.8 Alarmas y Seguridad (`/api/alerts`)
- `GET /api/alerts` — Lista alertas activas o resueltas (`is_resolved=false`).
- `POST /api/alerts/:id/resolve` — **Desarme de Alarma Crítica:** Silencia la sirena, restaura la sala a estado normal y registra la nota de resolución del celador.
  ```json
  { "resolution_note": "Revisión presencial completada. Apertura autorizada de emergencia." }
  ```

---

## 4. Canal de Tiempo Real: WebSockets (`ws://localhost:4000`)

El servidor difunde eventos JSON automáticos sobre el bus TCP a todos los navegadores conectados:

| Evento | Payload Clave | Descripción |
| :--- | :--- | :--- |
| `access_attempt` | `{ logId, granted, uid, door, room, user, alarmTriggered }` | Difundido instantáneamente ante cada lectura de tarjeta en cualquier puerta o torniquete. |
| `new_alert` | `{ id, room_id, door_id, severity: 'critical', message }` | Emitido cuando se viola una sala asegurada o se fuerza una puerta. |
| `alert_resolved` | `{ alertId, resolvedBy, resolvedAt }` | Notifica que el celador ha silenciado y resuelto la alarma crítica. |
| `door_status` | `{ doorId, isLocked }` | Informa la apertura (5 s) y re-bloqueo automático del electroimán. |
| `hardware_heartbeat`| `{ doorId, status: 'online' }` | Notifica que el lector físico está operativo (conmuta caja a VERDE). |
