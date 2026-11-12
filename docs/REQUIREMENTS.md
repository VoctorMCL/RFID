# 📑 Especificación de Requisitos de Software (SRS)

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**  
**Autores:** Victor Manuel Cordoba Larez & Jeronimo Arboleda Galeano  
**Docente Asesor:** Feibert Alirio Guzman Perez  
**Versión:** 2.0.0 (oct-2026)

---

## 1. Introducción y Alcance del Producto

El presente documento especifica los requisitos de software y hardware para el **Ecosistema Inteligente de Control de Acceso RFID** de la Corporación Universitaria Lasallista. El sistema abarca el control de ingreso peatonal, la articulación horaria para laboratorios y aulas, la administración dinámica de la infraestructura física del campus y el monitoreo de alarmas críticas en tiempo real.

---

## 2. Requisitos de Usuario (RU)

| ID | Nombre | Descripción del Requisito | Actor Principal |
| :--- | :--- | :--- | :--- |
| **RU-001** | Ingreso sin contacto | La persona debe poder registrar su acceso aproximando su carnet institucional al sensor RFID, sin contacto físico ni interacción en teclado. | Estudiante, Docente, Funcionario |
| **RU-002** | Verificación visual inmediata | El celador o personal de portería debe observar en su monitor la foto, datos del titular y resultado de la validación en menos de 3 segundos. | Celador / Guardia |
| **RU-003** | Consola web restringida | Solo el Administrador y el Celador deben tener autorización para iniciar sesión en la plataforma web. Estudiantes y docentes no ingresan a la web. | Administrador, Celador |
| **RU-004** | Creación dinámica de campus | El administrador debe poder crear, modificar y dar de baja bloques, salas y puertas sin quemar datos en el código fuente. | Administrador del Sistema |
| **RU-005** | Articulación horaria docente | El acceso de profesores y estudiantes a salas y laboratorios debe verificarse en tiempo real contra los horarios autorizados por Decanatura y RRHH. | Docente, Estudiante, RRHH |
| **RU-006** | Fichas maestras de seguridad | El personal de vigilancia debe contar con tarjetas RFID maestras con capacidad de anulación para rondas nocturnas y emergencias. | Celador / Seguridad |
| **RU-007** | Alerta crítica en Sala 1 | Si la Sala de Informática 1 se abre sin autorización previa a seguridad, el sistema debe disparar una alarma que solo se apague en el cuarto de control. | Celador, Administrador |
| **RU-008** | Enrolamiento centralizado | El administrador debe contar con una interfaz para registrar nuevas tarjetas físicas y vincularlas de inmediato a las personas. | Administrador del Sistema |
| **RU-009** | Estado del lector físico | El celador debe visualizar en pantalla si el sensor RFID está conectado físicamente (verde) o desconectado/ausente (rojo). | Celador / Guardia |
| **RU-010** | Detección sensorial de fallas | Ante un intento denegado o violación de horario, la pantalla debe ejecutar una animación de vibración visual y emitir una vibración háptica en la terminal. | Celador / Guardia |

---

## 3. Requisitos Funcionales (RF)

| ID | Nombre | Descripción de la Funcionalidad | Actor | RU Asociado |
| :--- | :--- | :--- | :--- | :--- |
| **RF-001** | Captura de UID RFID | Capturar el Identificador Único (UID) de 4 a 7 bytes de tarjetas Mifare Classic / Ultralight (13.56 MHz, ISO/IEC 14443-A) vía SPI. | Lector Físico | RU-001 |
| **RF-002** | Motor de Validación | Validar el UID contra la base de datos verificando vigencia, estado activo y coincidencia de persona asignada. | Motor Central | RU-001, RU-002 |
| **RF-003** | Articulación Horaria | Comparar el día de la semana y la hora actual con la tabla `schedules` para profesores y estudiantes antes de autorizar una sala. | Motor Central | RU-005 |
| **RF-004** | Acceso Global de Fichas Maestras | Otorgar acceso irrestricto sin restricción de horario a tarjetas catalogadas como `master` o pertenecientes a la Rectoría. | Motor Central | RU-006 |
| **RF-005** | Apertura de Cerradura | Enviar pulso de activación durante 5 segundos a la cerradura electromagnética cuando el acceso sea autorizado. | Controlador Edge | RU-001 |
| **RF-006** | Telemetría WebSocket | Difundir el resultado del intento en tiempo real a todos los monitores web conectados en menos de 300 ms. | WebSocket Server | RU-002 |
| **RF-007** | Validación Visual en Escáner | Mostrar en la pantalla del celador la fotografía, nombre, documento, programa, sala, puerta y estado de autorización. | Frontend React | RU-002 |
| **RF-008** | Animación de Vibración | Aplicar `@keyframes vibrate-shake` y llamada a `navigator.vibrate` en pantalla ante un acceso denegado. | Frontend React | RU-010 |
| **RF-009** | Detección Dinámica de Sensor | Consultar el estado del sensor y mostrarlo en rojo (`Desconectado`) o verde (`Conectado / Confirmado`). | Frontend React | RU-009 |
| **RF-010** | Autenticación Web Exclusiva | Permitir inicio de sesión web únicamente a roles `admin` y `celador`. Retornar `403 Forbidden` a estudiantes o profesores. | Backend Auth | RU-003 |
| **RF-011** | CRUD de Bloques | Permitir crear, listar, editar y desactivar bloques institucionales (ej. Bloque A, Bloque B, Bloque C, Bloque Administrativo). | Administrador | RU-004 |
| **RF-012** | CRUD de Salas | Permitir registrar salas asociadas a un bloque con indicadores de tipo, piso, presencia de alarma y sensores instalados. | Administrador | RU-004 |
| **RF-013** | CRUD de Puertas | Permitir vincular puertas físicas a una sala indicando su nombre, tipo (principal/lateral), dirección IP y dirección MAC. | Administrador | RU-004 |
| **RF-014** | Enrolamiento de Tarjetas | Permitir registrar UIDs de tarjetas RFID, asignarlas a usuarios y definir su categoría (`standard` o `master`). | Administrador | RU-008 |
| **RF-015** | Asignación de Horarios | Permitir configurar las franjas horarias por semestre, materia, docente y sala (ej. Lunes 07:00 a 09:00). | Administrador | RU-005 |
| **RF-016** | Disparo de Alarma Crítica | Activar alarma física y digital en Sala 1 ante apertura indebida. Notificar por email a seguridad y admin. | Motor de Alarmas | RU-007 |
| **RF-017** | Desarme de Alarma | Restringir el desarme y resolución de alertas críticas exclusivamente al panel de control del Celador / Seguridad. | Celador | RU-007 |
| **RF-018** | Auditoría y Exportación | Almacenar cada intento con timestamp, UID, puerta, resultado y permitir su descarga en formato CSV. | Administrador | RU-002 |

---

## 4. Requisitos No Funcionales (RNF)

### 4.1 Usabilidad y Diseño
- **RNF-001 (Paleta Monocromática Oscura):** La interfaz gráfica debe utilizar estrictamente tonos grises técnicos (`#121214` a `#34343d`) para prevenir fatiga visual en turnos nocturnos de seguridad.
- **RNF-002 (Barra Lateral Comprimible):** La barra de navegación debe permitir colapsarse a 68 px (modo iconos) o expandirse a 250 px, persistiendo su estado en el navegador.
- **RNF-003 (Vista Unificada de Portería):** La pantalla de validación debe exhibir fotografía, datos y decisión en un solo viewport sin requerir scroll.

### 4.2 Rendimiento y Latencia
- **RNF-004 (Tiempo de Respuesta < 3 s):** El tiempo total transcurrido desde que la tarjeta toca el lector hasta que la puerta abre y la pantalla se actualiza debe ser inferior a **3,0 segundos**.
- **RNF-005 (Capacidad de Procesamiento):** El sistema debe procesar al menos 30 intentos de validación por minuto por torniquete sin degradación.
- **RNF-006 (Consultas Indexadas):** Las búsquedas de UID y usuarios deben resolverse mediante índices B-Tree en la base de datos con un tiempo de ejecución menor a 15 ms.

### 4.3 Confiabilidad y Resiliencia
- **RNF-007 (Fallback en Memoria):** Ante caídas de la base de datos relacional PostgreSQL, el backend debe continuar validando accesos de forma transparente utilizando el almacén en memoria.
- **RNF-008 (Reconexión Automática WebSocket):** El cliente frontend debe reconectarse automáticamente al servidor WebSocket cada 4 segundos ante cortes transitorios de red.

### 4.4 Seguridad y Cumplimiento Normativo
- **RNF-009 (Autenticación JWT):** Toda petición a la API administrativa debe viajar firmada con un token JSON Web Token con algoritmo HS256 y expiración en 24 horas.
- **RNF-010 (Cifrado de Contraseñas):** Las contraseñas del personal administrativo y celadores deben almacenarse mediante hash seguro con `bcrypt` (factor de costo 10).
- **RNF-011 (Habeas Data - Ley 1581 de 2012):** El tratamiento de fotografías, nombres y documentos de identidad de la comunidad universitaria se rige por la Ley de Protección de Datos Personales en Colombia.

### 4.5 Restricciones de Hardware y Entorno
- **RNF-012 (Voltaje de Operación RFID):** El lector MFRC522 debe energizarse estrictamente a **3.3 V**.
- **RNF-013 (Compatibilidad Edge):** El firmware del microcontrolador debe compilar para arquitecturas ESP32 Xtensa dual-core, y el cliente Python debe operar sobre Raspberry Pi OS (Debian Linux).

---

## 5. Matriz de Trazabilidad de Requisitos

| Requisito de Usuario | Requisito Funcional | Caso de Uso | Historia de Usuario |
| :--- | :--- | :--- | :--- |
| **RU-001** | RF-001, RF-002, RF-005 | CU-002 | US-001, US-004 |
| **RU-002** | RF-006, RF-007 | CU-003 | US-002 |
| **RU-003** | RF-010 | CU-001 | US-007 |
| **RU-004** | RF-011, RF-012, RF-013 | CU-006 | US-008 |
| **RU-005** | RF-003, RF-015 | CU-004 | US-005, US-009 |
| **RU-006** | RF-004 | CU-002 | US-003 |
| **RU-007** | RF-016, RF-017 | CU-005 | US-006 |
| **RU-008** | RF-014 | CU-007 | US-010 |
| **RU-009** | RF-009 | CU-003 | US-002 |
| **RU-010** | RF-008 | CU-003 | US-002 |
