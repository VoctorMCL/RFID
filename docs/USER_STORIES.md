# 📋 Historias de Usuario (User Stories)

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**  
**Metodología:** Ágil / Scrum — Historias con Criterios de Aceptación (Gherkin: Dado - Cuando - Entonces)

---

## 1. Módulo: Celaduría, Portería y Seguridad Física

### US-001: Verificación Visual Instantánea en Portería
- **ID:** US-001
- **Prioridad:** Must Have | **Estimación:** 5 SP
- **Como** Celador en el puesto de portería,
- **Quiero** ver la fotografía y datos del titular en mi pantalla inmediatamente cuando alguien pase su carnet,
- **Para que** pueda corroborar que el carnet pertenece físicamente a la persona que va ingresando.
- **Criterios de Aceptación:**
  - **Escenario 1: Carnet válido con foto:**
    - **Dado** que el celador tiene abierto el Escáner (`/monitor`) y el sensor está en verde,
    - **Cuando** un estudiante o docente acerca su tarjeta al torniquete,
    - **Entonces** la pantalla muestra la foto, nombre, cédula y carrera en menos de 3 segundos, con marco verde y tono sonoro positivo.
  - **Escenario 2: Retorno a pantalla de espera:**
    - **Dado** que se mostró la información de un acceso,
    - **Cuando** transcurren 6 segundos sin nuevos intentos,
    - **Entonces** el panel vuelve al estado pasivo de espera *"Listo para escanear"*.

---

### US-002: Alerta Sensorial y Animación de Vibración ante Acceso Denegado
- **ID:** US-002
- **Prioridad:** Must Have | **Estimación:** 3 SP
- **Como** Celador de turno,
- **Quiero** que la pantalla vibre y suene una alarma grave cuando una tarjeta sea rechazada,
- **Para que** pueda reaccionar de inmediato aunque no esté mirando fijamente la pantalla en ese instante.
- **Criterios de Aceptación:**
  - **Escenario 1: Vibración visual y háptica:**
    - **Dado** que se presenta una tarjeta no registrada o sin horario válido,
    - **Cuando** el sistema procesa la denegación,
    - **Entonces** el marco se ilumina en rojo, el contenedor ejecuta la animación `@keyframes vibrate-shake` y el dispositivo activa la vibración háptica con `navigator.vibrate`.

---

### US-003: Monitoreo del Estado de Conexión del Lector RFID
- **ID:** US-003
- **Prioridad:** Must Have | **Estimación:** 3 SP
- **Como** Celador o Guardia,
- **Quiero** ver con claridad si el sensor RFID de la puerta está activo o desconectado,
- **Para que** no me confunda pensando que las personas no pasan el carnet cuando en realidad es un fallo de cable o hardware.
- **Criterios de Aceptación:**
  - **Escenario 1: Sensor ausente o desconectado:**
    - **Dado** que el lector CrowPi 3 o ESP32 pierde comunicación,
    - **Cuando** el celador observa el panel del escáner,
    - **Entonces** la caja de estado se muestra en color **ROJO** con el texto *"🔴 Sensor RFID Desconectado / No Detectado"*.
  - **Escenario 2: Sensor conectado y comprobado:**
    - **Dado** que el hardware envía lecturas o se pulsa el botón *"Comprobar Enlace Físico"*,
    - **Cuando** el canal responde positivamente,
    - **Entonces** la caja conmuta a color **VERDE** con el texto *"🟢 Sensor RFID Conectado / Confirmado"*.

---

### US-004: Fichas Maestras para Rondas de Seguridad y Emergencias
- **ID:** US-004
- **Prioridad:** Must Have | **Estimación:** 5 SP
- **Como** Guardia de seguridad en ronda nocturna,
- **Quiero** que mi tarjeta maestra me permita abrir cualquier puerta y laboratorio sin importar el horario,
- **Para que** pueda realizar rondas de inspección o evacuar un bloque ante emergencias.
- **Criterios de Aceptación:**
  - **Escenario 1: Apertura con Ficha Maestra:**
    - **Dado** que el vigilante posee una tarjeta catalogada como `master` (ej. UID `AABBCCDD`),
    - **Cuando** la acerca a la Sala de Informática 1 a las 02:00 AM (fuera de horario de clases),
    - **Entonces** el sistema valida `card_type == 'master'`, abre la puerta durante 5 segundos y no dispara la alarma de intrusión.

---

### US-005: Desarme Exclusivo de Alarmas Críticas desde Cuarto de Control
- **ID:** US-005
- **Prioridad:** Must Have | **Estimación:** 5 SP
- **Como** Celador o Encargado de Seguridad,
- **Quiero** silenciar y desarmar la alarma de la Sala de Informática 1 desde mi consola web tras verificar la zona,
- **Para que** la sirena física no siga sonando y el laboratorio regrese al estado seguro.
- **Criterios de Aceptación:**
  - **Escenario 1: Desarme de alarma por seguridad:**
    - **Dado** que la Sala 1 se encuentra en estado `alert` por apertura forzada,
    - **Cuando** el celador entra a `/alerts`, pulsa "Resolver Alarma" y registra el motivo,
    - **Entonces** la alarma se apaga, la sala vuelve a estado `armed`/`normal` y se registra el celador responsable en la auditoría.

---

## 2. Módulo: Administración, Campus y Decanatura

### US-006: Estructuración Dinámica de Bloques, Salas y Puertas
- **ID:** US-006
- **Prioridad:** Must Have | **Estimación:** 8 SP
- **Como** Administrador del Campus,
- **Quiero** poder crear nuevos bloques, salas y puertas inteligentes desde la interfaz sin tocar código,
- **Para que** la universidad pueda expandir la tecnología a nuevas edificaciones de forma ágil y autónoma.
- **Criterios de Aceptación:**
  - **Escenario 1: Creación de Bloque y Sala:**
    - **Dado** que el administrador está autenticado en `/map`,
    - **Cuando** crea el "Bloque D" y luego añade la "Sala de Robótica" con 1 puerta inteligente,
    - **Entonces** la puerta queda disponible en el backend para asociar lectores y validar tarjetas inmediatamente.

---

### US-007: Enrolamiento Centralizado de Tarjetas Físicas
- **ID:** US-007
- **Prioridad:** Must Have | **Estimación:** 5 SP
- **Como** Administrador del Sistema,
- **Quiero** registrar nuevas tarjetas mediante su UID hexadecimal y asignarlas al carnet de una persona,
- **Para que** un estudiante o docente nuevo reciba su acceso físico el mismo día de su matrícula.
- **Criterios de Aceptación:**
  - **Escenario 1: Enrolamiento exitoso:**
    - **Dado** que se tiene una nueva tarjeta con UID `C9D0E1F2`,
    - **Cuando** el administrador la ingresa y selecciona a la persona correspondiente en `/rfid-cards`,
    - **Entonces** el sistema confirma la vinculación y rechaza cualquier intento de duplicar el mismo UID para dos usuarios distintos.

---

### US-008: Articulación Horaria para Docentes y Asignaturas
- **ID:** US-008
- **Prioridad:** Must Have | **Estimación:** 5 SP
- **Como** Administrador o Coordinador de Decanatura,
- **Quiero** configurar las franjas horarias de las materias asignadas a cada docente en cada laboratorio,
- **Para que** los profesores solo puedan abrir las salas de cómputo en el horario exacto de sus clases.
- **Criterios de Aceptación:**
  - **Escenario 1: Asignación de horario semanal:**
    - **Dado** que el profesor Carlos López dicta clase los lunes de 07:00 a 09:00 en Sala 1,
    - **Cuando** se crea dicho registro en `/schedules`,
    - **Entonces** el motor de validación permitirá su acceso en esa ventana de tiempo y denegará la apertura a las 11:00 AM.

---

### US-009: Exclusión Estricta de Login Web para Estudiantes y Docentes
- **ID:** US-009
- **Prioridad:** Must Have | **Estimación:** 3 SP
- **Como** Administrador de Seguridad de la Información,
- **Quiero** que la plataforma web rechace explícitamente cualquier intento de login de alumnos o profesores,
- **Para que** la consola administrativa no sea vulnerable a accesos indebidos ni se confunda con un portal estudiantil.
- **Criterios de Aceptación:**
  - **Escenario 1: Intento de login de estudiante:**
    - **Dado** que se ingresa el correo de un alumno en `/login`,
    - **Cuando** se envía el formulario,
    - **Entonces** el backend responde con código HTTP `403` y el mensaje explicativo: *"Los estudiantes y profesores no inician sesión en la plataforma web. Su acceso se valida únicamente mediante carnet RFID en las puertas"*.

---

### US-010: Auditoría y Exportación de Registros de Acceso a CSV
- **ID:** US-010
- **Prioridad:** Should Have | **Estimación:** 3 SP
- **Como** Administrador o Director de Seguridad,
- **Quiero** filtrar el historial de entradas y descargarlo en formato CSV,
- **Para que** pueda entregar informes de aforo o evidencias a las directivas universitarias.
- **Criterios de Aceptación:**
  - **Escenario 1: Exportación con filtros:**
    - **Dado** que el administrador filtra los accesos de la Sala de Informática 1 del día de hoy,
    - **Cuando** hace clic en *"Exportar a CSV"*,
    - **Entonces** el navegador descarga automáticamente un archivo `.csv` con fecha, UID, titular, puerta y resultado.

---

## 3. Módulo: Rectoría, Docentes y Estudiantes

### US-011: Acceso Global e Irrestricto de Rectoría
- **ID:** US-011
- **Prioridad:** Must Have | **Estimación:** 2 SP
- **Como** Rectora de la institución,
- **Quiero** que mi carnet me permita ingresar a cualquier bloque, oficina o laboratorio a cualquier hora,
- **Para que** la alta dirección tenga libre tránsito en todo el campus sin trabas de articulación horaria.
- **Criterios de Aceptación:**
  - **Escenario 1: Validación de permiso global:**
    - **Dado** que la Rectora acerca su carnet a cualquier puerta registrada,
    - **Cuando** el sistema detecta su `role_id` con `global_access == TRUE`,
    - **Entonces** autoriza el acceso inmediato sin verificar horarios ni materias.

---

### US-012: Ingreso Rápido de Estudiantes a Áreas Comunes (Biblioteca)
- **ID:** US-012
- **Prioridad:** Should Have | **Estimación:** 3 SP
- **Como** Estudiante lasallista,
- **Quiero** aproximar mi carnet al torniquete de la Biblioteca Central en jornada de 07:00 a 20:00,
- **Para que** pueda ingresar a estudiar sin hacer filas ni firmar planillas manuales en papel.
- **Criterios de Aceptación:**
  - **Escenario 1: Ingreso a biblioteca:**
    - **Dado** que el estudiante está activo y se encuentra dentro de la franja horaria permitida para biblioteca,
    - **Cuando** pasa su carnet por el lector,
    - **Entonces** el torniquete se desbloquea en menos de 2 segundos y registra su asistencia en el sistema.
