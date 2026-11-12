# 🔄 Diagramas de Secuencia del Sistema

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**

---

## SD-001: Validación de Acceso Exitoso en Puerta / Torniquete

Muestra el flujo completo desde que la tarjeta es detectada por la antena hasta que la cerradura se abre y el monitor del celador se actualiza en menos de 3 segundos.

```mermaid
sequenceDiagram
    autonumber
    actor Titular as Titular del Carnet
    participant Sensor as Lector RC522 (SPI)
    participant Edge as Controlador Edge (ESP32/Pi)
    participant API as Backend Express (/api/access/validate)
    participant Engine as Motor de Validación
    participant DB as PostgreSQL / MemoryDb
    participant Relay as Relé de Puerta (GPIO 2)
    participant WS as WebSocket Server
    participant Celador as Monitor de Celaduría (/monitor)

    Titular->>Sensor: Acerca tarjeta RFID (13.56 MHz)
    Sensor->>Edge: Transmite UID por bus SPI (ej. A1B2C3D4)
    Edge->>API: POST /api/access/validate { rfid_uid, door_id, access_method: 'rfid' }
    API->>Engine: validateAccess(uid, door_id)
    Engine->>DB: Consulta tarjeta por UID y usuario asignado
    DB-->>Engine: Retorna { card, user, role }
    Engine->>Engine: Evalúa permisos globales o articulación horaria
    Note over Engine: Permiso válido -> granted = true
    
    par Apertura física
        Engine-->>Edge: 200 OK { granted: true }
        Edge->>Relay: Activa relé (HIGH por 5 segundos)
        Relay-->>Titular: Puerta liberada / Paso habilitado
    and Notificación en tiempo real (< 300 ms)
        Engine->>WS: broadcast('access_attempt', { logId, granted: true, user, door })
        WS-->>Celador: Evento en vivo por WebSocket
        Celador->>Celador: Muestra foto, nombre y datos en VERDE
        Celador->>Celador: Reproduce tono sonoro positivo
    and Auditoría
        Engine->>DB: INSERT INTO access_logs (granted: true)
    end
```

---

## SD-002: Acceso Denegado con Animación de Vibración y Alerta Háptica

Representa el rechazo de un acceso (por tarjeta vencida, no registrada o intento fuera de horario) y la activación de los estímulos visuales y hápticos de alerta.

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Usuario No Autorizado
    participant Sensor as Lector RC522
    participant Edge as Controlador Edge
    participant API as Backend Express
    participant Engine as Motor de Validación
    participant DB as PostgreSQL / MemoryDb
    participant WS as WebSocket Server
    participant Celador as Monitor de Celaduría (/monitor)

    Usuario->>Sensor: Acerca tarjeta no autorizada (ej. 11223344)
    Sensor->>Edge: Captura UID por SPI
    Edge->>API: POST /api/access/validate
    API->>Engine: validateAccess(uid, door_id)
    Engine->>DB: Valida contra tabla schedules y rfid_cards
    DB-->>Engine: No coincide horario o área no autorizada
    
    Note over Engine: granted = false<br/>denial_reason = 'denegado_area_no_autorizada'
    
    par Rechazo en Hardware
        Engine-->>Edge: 200 OK { granted: false, denial_reason }
        Edge->>Edge: Mantiene relé en LOW (puerta cerrada)
        Edge->>Edge: Emite tono sonoro grave en buzzer
    and Alerta en Monitor de Portería
        Engine->>WS: broadcast('access_attempt', { granted: false, denialReason, user })
        WS-->>Celador: Recibe evento de rechazo
        Celador->>Celador: Aplica animación CSS @keyframes vibrate-shake
        Celador->>Celador: Dispara API háptica navigator.vibrate([120, 60, 120])
        Celador->>Celador: Muestra causa en ROJO y fotografía del infractor
    and Auditoría
        Engine->>DB: INSERT INTO access_logs (granted: false, denial_reason)
    end
```

---

## SD-003: Disparo de Alarma Crítica en Sala de Informática 1 y Desarme por Seguridad

Ilustra la lógica de seguridad cuando una sala asegurada es vulnerada y la restricción estricta de que solo puede ser desarmada desde el panel del celador.

```mermaid
sequenceDiagram
    autonumber
    actor Intruso as Intruso / Intento no autorizado
    participant SensorPuerta as Sensor Magnético / Movimiento
    participant Edge as ESP32 (Sala de Informática 1)
    participant API as Backend Express
    participant AlarmCtrl as Motor de Alarmas
    participant Email as Nodemailer (emailService)
    participant WS as WebSocket Server
    participant Celador as Cuarto de Control / Consola Celador
    actor Guardia as Guardia de Seguridad

    Intruso->>SensorPuerta: Apertura física sin previo aviso a seguridad
    SensorPuerta->>Edge: Contacto seco abierto (GPIO 21)
    Edge->>API: POST /api/access/validate (o evento intrusión)
    API->>AlarmCtrl: Comprueba estado de sala (security_status == 'armed')
    
    Note over AlarmCtrl: CONDICIÓN CRÍTICA:<br/>Sala armada + sin aviso = ALERTA CRÍTICA
    AlarmCtrl->>AlarmCtrl: Cambia sala a security_status = 'alert'
    
    par Activación de Sirena Local
        AlarmCtrl-->>Edge: Orden de disparo de sirena
        Edge->>Edge: Enciende buzzer continuo (GPIO 4)
    and Despacho de Correo Electrónico
        AlarmCtrl->>Email: sendAlertEmail()
        Email-->>Email: Envía correo a vigilancia@lasallista.edu.co
    and Difusión de Emergencia
        AlarmCtrl->>WS: broadcast('new_alert', { severity: 'critical', room: 'Sala 1' })
        WS-->>Celador: Recibe alerta roja titilante con sonido de sirena
    end

    Note over Celador,Guardia: PROTOCOLO DE DESARME EXCLUSIVO:
    Guardia->>Celador: Ingresa a vista /alerts en la consola web
    Guardia->>Celador: Clic en "Resolver Alarma" e ingresa informe de novedades
    Celador->>API: POST /api/alerts/:id/resolve { resolution_note }
    API->>AlarmCtrl: resolveAlert(alertId, celadorId)
    AlarmCtrl->>AlarmCtrl: Restaura sala a security_status = 'normal'
    AlarmCtrl-->>Edge: Orden de silenciar buzzer
    AlarmCtrl->>WS: broadcast('alert_resolved', { alertId })
    WS-->>Celador: Alarma desactivada y confirmada en consola
```

---

## SD-004: Autenticación Web y Protección de Rutas (Admin y Celador)

Demuestra la validación de credenciales en el login y la denegación automática a estudiantes o profesores.

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Usuario Web
    participant LoginView as Login.jsx (React)
    participant AuthCtx as AuthContext.jsx
    participant AuthAPI as authController.js
    participant DB as PostgreSQL / MemoryDb
    participant Protected as ProtectedRoute.jsx
    participant Dashboard as Monitor / Dashboard

    Usuario->>LoginView: Ingresa correo y contraseña
    LoginView->>AuthCtx: login(email, password)
    AuthCtx->>AuthAPI: POST /api/auth/login { email, password }
    AuthAPI->>DB: Busca usuario por email
    DB-->>AuthAPI: Retorna registro con role_name

    alt Rol es Student o Professor
        AuthAPI-->>AuthCtx: 403 Forbidden ("Estudiantes y profesores no inician sesión web")
        AuthCtx-->>LoginView: Retorna { success: false, error }
        LoginView->>LoginView: Dispara vibración visual de error en formulario
    else Rol es Admin o Celador
        AuthAPI->>AuthAPI: Valida contraseña (bcrypt)
        AuthAPI->>AuthAPI: Genera JWT (HS256)
        AuthAPI-->>AuthCtx: 200 OK { token, user }
        AuthCtx->>AuthCtx: Guarda rfid_token en localStorage
        AuthCtx-->>LoginView: Retorna { success: true, user }
        LoginView->>Protected: Navega a /dashboard o /monitor
        Protected->>Protected: Verifica isAuthenticated == true
        Protected-->>Dashboard: Renderiza la interfaz operativa con Sidebar lateral
    end
```
