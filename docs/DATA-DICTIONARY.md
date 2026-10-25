# 📖 Diccionario de Datos

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**  
**Base de Datos:** PostgreSQL 16 (`rfid_db`) / In-Memory Spec

---

## 1. Tabla: `roles`
Jerarquía de roles y permisos de acceso para la comunidad universitaria.

| Columna | Tipo de Dato | Nulo | Default | Restricciones | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | SERIAL | NO | auto | PRIMARY KEY | Identificador numérico secuencial del rol. | `1` |
| `name` | VARCHAR(50) | NO | — | UNIQUE | Código interno del rol (`admin`, `rector`, `professor`, `student`, `security`, `admin_staff`). | `'admin'` |
| `display_name` | VARCHAR(100) | NO | — | — | Nombre formal del rol para visualización en interfaz. | `'Administrador del Sistema'` |
| `global_access` | BOOLEAN | NO | `FALSE` | — | Indica si el rol puede abrir cualquier puerta sin restricción de horario. | `TRUE` |
| `description` | TEXT | SÍ | NULL | — | Descripción y alcance institucional de las atribuciones del rol. | `'Acceso total a la configuración'` |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Fecha y hora de creación del registro. | `'2026-02-01 08:00:00+00'` |

---

## 2. Tabla: `users`
Cuentas y perfiles del personal directivo, docente, administrativo, estudiantil y de seguridad.

| Columna | Tipo de Dato | Nulo | Default | Restricciones | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | SERIAL | NO | auto | PRIMARY KEY | Identificador único del usuario. | `1` |
| `first_name` | VARCHAR(100) | NO | — | — | Nombres del titular. | `'Victor Manuel'` |
| `last_name` | VARCHAR(100) | NO | — | — | Apellidos del titular. | `'Cordoba Larez'` |
| `email` | VARCHAR(255) | NO | — | UNIQUE | Correo institucional único. | `'victor.cordoba@lasallista.edu.co'` |
| `password_hash` | VARCHAR(255) | NO | — | — | Hash bcrypt de la contraseña (solo aplica para Admin y Celador). | `'$2b$10$8K1p/a0dL...'` |
| `document_id` | VARCHAR(50) | NO | — | UNIQUE | Número de identificación oficial (cédula o tarjeta de identidad). | `'1152345678'` |
| `role_id` | INTEGER | NO | — | FK $\rightarrow$ `roles(id)` | Rol institucional asociado. | `4` |
| `photo_url` | TEXT | SÍ | NULL | — | Ruta relativa o URL a la fotografía del titular para verificación visual. | `'/photos/1152345678.jpg'` |
| `program` | VARCHAR(200) | SÍ | NULL | — | Carrera, departamento o dependencia institucional. | `'Ingeniería de Software'` |
| `phone` | VARCHAR(30) | SÍ | NULL | — | Teléfono celular de contacto para emergencias. | `'3004567890'` |
| `status` | VARCHAR(20) | NO | `'active'` | CHECK IN (`'active'`, `'inactive'`, `'suspended'`) | Estado del usuario en el sistema. | `'active'` |
| `access_expiry` | DATE | SÍ | NULL | — | Fecha de vigencia máxima (usado para visitantes o contratos temporales). | `'2026-12-31'` |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Fecha de registro en la plataforma. | `'2026-02-01 09:30:00+00'` |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Última fecha de actualización del registro. | `'2026-02-01 09:30:00+00'` |

---

## 3. Tabla: `blocks`
Pabellones y edificios que conforman la infraestructura física del campus.

| Columna | Tipo de Dato | Nulo | Default | Restricciones | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | SERIAL | NO | auto | PRIMARY KEY | Identificador numérico del bloque. | `1` |
| `name` | VARCHAR(100) | NO | — | UNIQUE | Nombre institucional del bloque. | `'Bloque A'` |
| `description` | TEXT | SÍ | NULL | — | Descripción funcional de las actividades que alberga. | `'Laboratorios de Informática'` |
| `location_info` | VARCHAR(255) | SÍ | NULL | — | Orientación espacial en el plano del campus. | `'Costado norte del campus'` |
| `is_active` | BOOLEAN | NO | `TRUE` | — | Indica si el bloque está en operación o mantenimiento. | `TRUE` |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Fecha de alta del bloque. | `'2026-02-01 08:00:00+00'` |

---

## 4. Tabla: `rooms`
Salas de cómputo, talleres, aulas, bibliotecas y dependencias dentro de un bloque.

| Columna | Tipo de Dato | Nulo | Default | Restricciones | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | SERIAL | NO | auto | PRIMARY KEY | Identificador numérico de la sala. | `1` |
| `block_id` | INTEGER | NO | — | FK $\rightarrow$ `blocks(id)` ON DELETE CASCADE | Bloque al cual pertenece la sala. | `1` |
| `name` | VARCHAR(100) | NO | — | — | Nombre formal del espacio físico. | `'Sala de Informática 1'` |
| `floor` | INTEGER | NO | `1` | — | Piso o nivel en el que se ubica la sala. | `1` |
| `room_type` | VARCHAR(50) | NO | `'aula'` | — | Tipología del espacio (`'lab_informatica'`, `'lab_ingenieria'`, `'biblioteca'`, `'administrativo'`). | `'lab_informatica'` |
| `has_alarm` | BOOLEAN | NO | `FALSE` | — | `TRUE` si la sala posee sistema de alarma perimetral integrado. | `TRUE` |
| `has_camera` | BOOLEAN | NO | `FALSE` | — | `TRUE` si la sala cuenta con cámara de videovigilancia. | `TRUE` |
| `motion_sensors` | INTEGER | NO | `0` | — | Número de sensores de movimiento instalados. | `2` |
| `door_sensors` | INTEGER | NO | `0` | — | Número de sensores magnéticos de puerta instalados. | `1` |
| `security_status` | VARCHAR(30) | NO | `'normal'` | CHECK IN (`'normal'`, `'armed'`, `'alert'`) | Estado actual de seguridad y alarma de la sala. | `'armed'` |
| `description` | TEXT | SÍ | NULL | — | Observaciones operativas o descripción del laboratorio. | `'Piloto inicial con alarma'` |

---

## 5. Tabla: `doors`
Puertas y torniquetes inteligentes dotados de lector RFID y cerradura eléctrica.

| Columna | Tipo de Dato | Nulo | Default | Restricciones | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | SERIAL | NO | auto | PRIMARY KEY | Identificador único de la puerta inteligente. | `1` |
| `room_id` | INTEGER | NO | — | FK $\rightarrow$ `rooms(id)` ON DELETE CASCADE | Sala o recinto al que da acceso la puerta. | `1` |
| `name` | VARCHAR(100) | NO | — | — | Nombre descriptivo de la puerta. | `'Puerta Principal — Sala 1'` |
| `door_type` | VARCHAR(30) | NO | `'main'` | CHECK IN (`'main'`, `'lateral'`, `'turnstile'`) | Función arquitectónica de la puerta. | `'main'` |
| `hardware_ip` | VARCHAR(45) | SÍ | NULL | — | Dirección IP en red local del controlador (ESP32 / Pi). | `'192.168.1.100'` |
| `mac_address` | VARCHAR(17) | SÍ | NULL | — | Dirección física MAC del dispositivo controlador. | `'AA:BB:CC:DD:EE:01'` |
| `status` | VARCHAR(20) | NO | `'offline'` | CHECK IN (`'online'`, `'offline'`, `'maintenance'`) | Estado de conectividad de red del hardware. | `'online'` |
| `is_locked` | BOOLEAN | NO | `TRUE` | — | Estado del electroimán (`TRUE` = asegurado, `FALSE` = libre). | `TRUE` |
| `last_heartbeat` | TIMESTAMPTZ | SÍ | NULL | — | Marca de tiempo de la última comunicación del hardware. | `'2026-10-25 14:50:35+00'` |

---

## 6. Tabla: `rfid_cards`
Carnets físicos y fichas maestras emitidas y enroladas.

| Columna | Tipo de Dato | Nulo | Default | Restricciones | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | SERIAL | NO | auto | PRIMARY KEY | Identificador interno de la tarjeta. | `1` |
| `uid` | VARCHAR(50) | NO | — | UNIQUE | Código UID hexadecimal capturado del chip RFID. | `'A1B2C3D4'` |
| `user_id` | INTEGER | NO | — | FK $\rightarrow$ `users(id)` ON DELETE CASCADE | Usuario universitario al que pertenece la tarjeta. | `1` |
| `card_type` | VARCHAR(20) | NO | `'standard'` | CHECK IN (`'standard'`, `'master'`) | Tipo de tarjeta (`'master'` tiene privilegios de anulación). | `'master'` |
| `is_active` | BOOLEAN | NO | `TRUE` | — | Permite revocar o bloquear el carnet de inmediato. | `TRUE` |
| `label` | VARCHAR(100) | SÍ | NULL | — | Rótulo para auditoría y reconocimiento administrativo. | `'Ficha Maestra Vigilancia'` |
| `enrolled_at` | TIMESTAMPTZ | NO | `NOW()` | — | Fecha y hora en la que se enroló la tarjeta. | `'2026-02-01 08:00:00+00'` |

---

## 7. Tabla: `schedules`
Reglas de articulación horaria para laboratorios y salas especializadas.

| Columna | Tipo de Dato | Nulo | Default | Restricciones | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | SERIAL | NO | auto | PRIMARY KEY | Identificador de la regla horaria. | `1` |
| `user_id` | INTEGER | NO | — | FK $\rightarrow$ `users(id)` ON DELETE CASCADE | Docente o estudiante autorizado. | `2` |
| `room_id` | INTEGER | NO | — | FK $\rightarrow$ `rooms(id)` ON DELETE CASCADE | Sala o laboratorio autorizado. | `1` |
| `day_of_week` | INTEGER | NO | — | CHECK (`day_of_week BETWEEN 1 AND 7`) | Día (1=Lunes, 2=Martes, ..., 7=Domingo). | `1` |
| `start_time` | TIME | NO | — | — | Hora de inicio de la clase o reserva. | `'07:00:00'` |
| `end_time` | TIME | NO | — | — | Hora de finalización de la clase o reserva. | `'09:00:00'` |
| `semester` | VARCHAR(20) | NO | `'2026-2'` | — | Periodo académico vigente. | `'2026-2'` |
| `subject_name` | VARCHAR(150) | SÍ | NULL | — | Nombre de la asignatura que se imparte. | `'Programación O. Objetos'` |
| `is_active` | BOOLEAN | NO | `TRUE` | — | Habilita o suspende la regla temporalmente. | `TRUE` |

---

## 8. Tabla: `access_logs`
Historial de auditoría forense de cada lectura de carnet en el campus.

| Columna | Tipo de Dato | Nulo | Default | Restricciones | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | SERIAL | NO | auto | PRIMARY KEY | Identificador numérico del log. | `1042` |
| `user_id` | INTEGER | SÍ | NULL | FK $\rightarrow$ `users(id)` ON DELETE SET NULL | Titular identificado (NULL si tarjeta no está registrada). | `2` |
| `door_id` | INTEGER | NO | — | FK $\rightarrow$ `doors(id)` ON DELETE CASCADE | Puerta donde se realizó la lectura física. | `1` |
| `rfid_card_id` | INTEGER | SÍ | NULL | FK $\rightarrow$ `rfid_cards(id)` ON DELETE SET NULL | Tarjeta utilizada. | `2` |
| `rfid_uid_raw` | VARCHAR(50) | NO | — | — | UID hexadecimal puro capturado por la antena RFID. | `'E5F6A7B8'` |
| `timestamp` | TIMESTAMPTZ | NO | `NOW()` | — | Momento exacto de la lectura física. | `'2026-10-25 14:48:10+00'` |
| `access_method` | VARCHAR(30) | NO | `'rfid'` | — | Medio tecnológico utilizado (`'rfid'`, `'manual'`). | `'rfid'` |
| `granted` | BOOLEAN | NO | — | — | Resultado de la validación (`TRUE` = Concedido, `FALSE` = Denegado). | `TRUE` |
| `denial_reason` | VARCHAR(100) | SÍ | NULL | — | Causa técnica del rechazo en caso de `granted == FALSE`. | `'denegado_horario_no_valido'` |
| `notes` | TEXT | SÍ | NULL | — | Notas adicionales o mensaje de respuesta. | `'Acceso autorizado'` |

---

## 9. Tabla: `alerts`
Registro y estado de alarmas de intrusión, puertas forzadas e incidentes de seguridad.

| Columna | Tipo de Dato | Nulo | Default | Restricciones | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | SERIAL | NO | auto | PRIMARY KEY | Identificador numérico de la alerta. | `15` |
| `door_id` | INTEGER | NO | — | FK $\rightarrow$ `doors(id)` ON DELETE CASCADE | Puerta origen de la alarma. | `1` |
| `room_id` | INTEGER | NO | — | FK $\rightarrow$ `rooms(id)` ON DELETE CASCADE | Sala comprometida. | `1` |
| `sensor_type` | VARCHAR(50) | NO | — | — | Tipo de evento (`'alarm_triggered'`, `'door_forced'`, `'tamper'`). | `'alarm_triggered'` |
| `severity` | VARCHAR(20) | NO | `'critical'` | CHECK IN (`'low'`, `'medium'`, `'high'`, `'critical'`) | Nivel de gravedad del incidente. | `'critical'` |
| `message` | TEXT | NO | — | — | Descripción detallada de la anomalía detectada. | `'Apertura no autorizada en Sala 1'` |
| `timestamp` | TIMESTAMPTZ | NO | `NOW()` | — | Momento en el que se disparó la alarma. | `'2026-10-25 14:52:00+00'` |
| `is_resolved` | BOOLEAN | NO | `FALSE` | — | Indica si el guardia de seguridad ya atendió y desactivó la alarma. | `FALSE` |
| `resolved_by` | INTEGER | SÍ | NULL | FK $\rightarrow$ `users(id)` ON DELETE SET NULL | Celador que resolvió el incidente. | `2` |
| `resolved_at` | TIMESTAMPTZ | SÍ | NULL | — | Fecha y hora en la que se desarmó la alarma. | `'2026-10-25 14:55:12+00'` |
| `resolution_note`| TEXT | SÍ | NULL | — | Informe de la causa real (ej. *"Falsa alarma por limpieza"*).| `'Verificado por celador'` |
| `email_sent` | BOOLEAN | NO | `FALSE` | — | `TRUE` si se remitió con éxito el correo a seguridad. | `TRUE` |
