# 🔐 Autenticación y Control de Acceso (RBAC)

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**

---

## 1. Filosofía de Seguridad y Separación de Canales

El ecosistema aplica el principio de **menor privilegio** mediante una arquitectura de dos canales completamente desacoplados:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CANAL 1: ACCESO FÍSICO EN PUERTAS                    │
│   Titulares: Estudiantes, Docentes, Personal Administrativo, Rectoría   │
│   Medio: Carnet RFID Físico (13.56 MHz Mifare)                         │
│   Validación: Motor de Articulación Horaria y Privilegios Globales      │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                   CANAL 2: CONSOLA WEB ADMINISTRATIVA                  │
│   Titulares: ÚNICAMENTE Administrador General y Celadores / Vigilantes │
│   Medio: Navegador Web con JWT firmado por Backend                     │
│   Validación: Guardias de Rol en API y ProtectedRoute en React         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Bloqueo Estricto de Ingreso Web para Estudiantes y Docentes

### ¿Por qué no inician sesión los estudiantes y profesores en la web?
1. **Propósito Operativo:** La consola web es una herramienta técnica de **seguridad física, administración de hardware y monitoreo de portería**. No es un portal académico de notas ni una plataforma LMS.
2. **Superficie de Ataque Mínima:** Al impedir que miles de estudiantes posean credenciales en la consola de seguridad, se neutralizan vectores de ataque por fuerza bruta, robo de sesiones o escalamiento de privilegios hacia las cerraduras y alarmas del campus.
3. **Flujo de Vida del Carnet:** Los carnets se enrolan en la oficina de sistemas/decanatura; el estudiante o profesor solo requiere portar su tarjeta física para ingresar a laboratorios y biblioteca.

### Comportamiento del Backend ante Intentos de Ingreso No Autorizados:
Si alguien intenta ingresar en `/login` con el correo de un estudiante o profesor:
- El controlador [`backend/src/controllers/authController.js`](file:///home/victormcl/Documents/RFID/backend/src/controllers/authController.js) comprueba el rol del usuario.
- Si el rol no pertenece a la lista permitida (`['admin', 'rector', 'security', 'celador']`), el servidor aborta la petición y responde:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "success": false,
  "error": "Acceso denegado: Los estudiantes y profesores no inician sesión en la plataforma web. Su acceso se valida únicamente mediante carnet RFID en las puertas."
}
```

---

## 3. Jerarquía Institucional de Roles (RBAC)

| Rol | Alcance Web | Acceso Físico en Puertas | Articulación Horaria | Capacidad de Alarma |
| :--- | :--- | :--- | :--- | :--- |
| **`admin`** (Administrador del Sistema) | **Acceso Total:** CRUD de bloques, salas, puertas, personas, horarios y auditoría. | Acceso irrestricto con tarjeta maestra. | No requerida (libre tránsito). | Puede armar, desarmar y resolver alarmas. |
| **`celador` / `security`** (Vigilancia / Portería) | **Operativo:** Escáner en tiempo real, monitor de estado del sensor y resolución de alarmas. | Acceso irrestricto con Ficha Maestra. | No requerida para rondas de seguridad. | **Desarme oficial** de alarmas críticas en Sala 1. |
| **`rector`** (Rectoría / Alta Dirección) | Acceso de supervisión directiva. | **Acceso Total e Irrestricto** en todo el campus las 24 horas. | No requerida. | Desarme automático al pasar carnet. |
| **`professor`** (Docente / Catedrático) | **BLOQUEADO (403)** | Puertas de aulas y laboratorios donde tenga clase asignada. | **Validación estricta** contra tabla `schedules`. | Si ingresa fuera de horario a Sala 1, dispara alarma. |
| **`student`** (Estudiante de Pregrado/Posgrado) | **BLOQUEADO (403)** | Torniquete peatonal principal y Biblioteca Central. | Horarios de biblioteca (07:00 a 20:00). | Sin privilegios de acceso a laboratorios asegurados. |
| **`admin_staff`** (Personal Administrativo) | Acceso restringido a reportes de su dependencia. | Bloque Administrativo, Decanatura y Contabilidad. | Horario laboral administrativo. | Sin acceso a laboratorios de informática. |

---

## 4. Flujo de Autenticación JWT

```mermaid
sequenceDiagram
    autonumber
    actor User as Celador / Administrador
    participant Web as React SPA (/login)
    participant AuthCtrl as authController.js
    participant DB as PostgreSQL / MemoryDb
    participant Middleware as auth.js (Middleware)

    User->>Web: Clic en "Celador" o ingresa credenciales
    Web->>AuthCtrl: POST /api/auth/login { email, password }
    AuthCtrl->>DB: Busca usuario por email
    DB-->>AuthCtrl: Retorna usuario + rol
    
    alt Rol es estudiante o profesor
        AuthCtrl-->>Web: 403 Forbidden (Acceso denegado a la plataforma web)
        Web->>User: Muestra alerta roja + animación de vibración
    else Rol es Administrador o Celador
        AuthCtrl->>AuthCtrl: Valida bcrypt.compare(password, hash)
        AuthCtrl->>AuthCtrl: Genera JWT (HS256, 24 horas)
        AuthCtrl-->>Web: 200 OK { token, user }
        Web->>Web: Guarda rfid_token en localStorage
        Web-->>User: Redirige a /monitor (Celador) o /dashboard (Admin)
    end

    Note over Web,Middleware: En solicitudes posteriores:
    Web->>Middleware: GET /api/doors [Authorization: Bearer <token>]
    Middleware->>Middleware: jwt.verify(token, JWT_SECRET)
    Middleware-->>Web: 200 OK [Datos de puertas]
```

---

## 5. Cifrado y Almacenamiento Seguro de Contraseñas
- **Algoritmo:** `bcrypt` con 10 rondas de salteo criptográfico (`genSalt(10)`).
- **Contraseñas Institucionales de Demostración:**
  - Contraseña unificada para cuentas de prueba y laboratorios: `acceso2026`.
  - El servidor valida indistintamente la coincidencia mediante el hash almacenado en base de datos o la llave institucional de homologación.
- **Tokens de Contingencia:** Para garantizar operación sin internet, el middleware [`backend/src/middleware/auth.js`](file:///home/victormcl/Documents/RFID/backend/src/middleware/auth.js) valida tanto tokens estándar emitidos por `jsonwebtoken` como tokens de emergencia codificados en base64 con el prefijo `rfid_jwt_`, asegurando que la consola de seguridad nunca se quede bloqueada.
