# 🎯 Casos de Uso del Sistema

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**

---

### CU-001: Autenticación en Plataforma Web
- **ID:** CU-001
- **Actores:** Administrador, Celador / Personal de Seguridad (Primarios); Servidor Backend (Secundario).
- **Descripción:** Permite a los usuarios autorizados (exclusivamente Administrador y Celador) iniciar sesión para acceder a las pantallas operativas y de gestión.
- **Precondiciones:** El usuario debe tener una cuenta registrada con rol `admin`, `rector` o `security`/`celador`.
- **Disparador:** El usuario accede a la URL `/login`.
- **Flujo Principal:**
  1. El usuario visualiza la pantalla de inicio de sesión con paleta oscura en grises.
  2. El usuario selecciona uno de los botones de acceso rápido ("Administrador" o "Celador / Guardia") o ingresa sus credenciales manuales (`email`/`usuario` y `password`).
  3. El sistema envía una petición `POST /api/auth/login`.
  4. El servidor verifica el rol: confirma que pertenezca a los perfiles web permitidos.
  5. El servidor valida la contraseña contra el hash `bcrypt` o la contraseña institucional.
  6. El servidor genera un token JWT firmado y lo retorna junto a la información del usuario.
  7. El cliente almacena el token en `localStorage` (`rfid_token`).
  8. Si el rol es Celador, el sistema redirige automáticamente a la vista `/monitor` (Escáner). Si es Administrador, redirige a `/dashboard`.
- **Flujos Alternativos:**
  - **4a. Intento de ingreso de estudiante o profesor:**
    - Si se ingresan credenciales de un estudiante o docente, el backend rechaza con `403 Forbidden`: *"Acceso denegado: Los estudiantes y profesores no inician sesión en la plataforma web. Su acceso se valida únicamente mediante carnet RFID en las puertas."*
    - El formulario muestra el mensaje en color rojo y ejecuta la animación de vibración (`vibrate-error`).
  - **4b. Contraseña incorrecta o usuario inexistente:**
    - El backend retorna `401 Unauthorized`. La interfaz notifica *"Credenciales inválidas"* con vibración.
- **Postcondiciones:** Sesión web activa con token JWT persistente; navegación habilitada según los privilegios del rol.

---

### CU-002: Ingreso Físico por Puerta / Torniquete con Carnet RFID
- **ID:** CU-002
- **Actores:** Titular de la tarjeta (Estudiante, Docente, Funcionario); Lector RFID Físico (ESP32 o CrowPi 3); Backend.
- **Descripción:** Un usuario acerca su carnet a la antena del lector en la entrada para que el sistema abra la puerta si el acceso es legítimo.
- **Precondiciones:** Lector encendido y enlazado con la red; cerradura electromagnética armada y asegurada.
- **Disparador:** Aproximación de la tarjeta Mifare al campo de radiofrecuencia (13.56 MHz).
- **Flujo Principal:**
  1. El lector captura el UID de la tarjeta por SPI.
  2. El microcontrolador o script envía `POST /api/access/validate` con `{ rfid_uid, door_id, access_method: 'rfid' }`.
  3. El motor de validación localiza la tarjeta y verifica que `is_active == TRUE`.
  4. El motor verifica los permisos del titular (rol global o ficha maestra).
  5. El sistema determina que el acceso es concedido (`granted: true`).
  6. El backend activa la orden de apertura y el relé libera el cerrojo por 5 segundos.
  7. El backend emite el evento WebSocket `access_attempt` a los monitores conectados.
  8. Se registra la entrada en `access_logs` con `granted: true`.
- **Flujos Alternativos:**
  - **3a. Tarjeta no registrada en base de datos:**
    - `granted: false`, `denial_reason: 'denegado_no_registrado'`. La puerta permanece cerrada.
  - **3b. Tarjeta revocada o inactiva:**
    - `granted: false`, `denial_reason: 'denegado_tarjeta_inactiva'`.
- **Postcondiciones:** Auditoría almacenada; puerta abierta durante 5 segundos si fue concedido; estado emitido en vivo por WebSocket.

---

### CU-003: Monitoreo y Verificación Visual en Escáner de Portería
- **ID:** CU-003
- **Actores:** Celador / Guardia de Seguridad; Servidor WebSocket.
- **Descripción:** El guardia observa en tiempo real los eventos de acceso que ocurren en las puertas y torniquetes para comparar visualmente la fotografía del titular con la persona física.
- **Precondiciones:** Celador autenticado en la consola web en la ruta `/monitor`.
- **Disparador:** Recepción de un evento `access_attempt` por el canal WebSocket.
- **Flujo Principal:**
  1. El escáner mantiene conexión abierta con `ws://localhost:4000`.
  2. El sensor muestra el estado de hardware: **VERDE** (`Conectado / Confirmado`) o **ROJO** (`Desconectado`).
  3. Al llegar un evento de acceso, la interfaz despliega de inmediato la fotografía oficial, nombre, documento, programa académico y puerta consultada.
  4. Si el acceso fue concedido, el marco y tipografía destacan en verde claro y suena un tono positivo de confirmación.
  5. El guardia compara la foto con la persona en el torniquete.
  6. El registro se agrega a la cola cronológica de accesos recientes en la parte inferior.
  7. Tras 6 segundos sin lecturas, el panel regresa a su estado pasivo de espera.
- **Flujos Alternativos:**
  - **4a. Acceso Denegado:**
    - El marco se tiñe de rojo/gris crítico y la tarjeta del titular ejecuta la animación de vibración (`vibrate-error`).
    - El sistema activa la API de vibración háptica `navigator.vibrate([120, 60, 120])`.
    - Se reproduce un tono grave de alerta y se expone la causa del rechazo (ej. *Área no autorizada*, *Horario no válido*).
- **Postcondiciones:** Verificación visual completada; registro visible en el historial del celador.

---

### CU-004: Validación con Articulación Horaria Docente
- **ID:** CU-004
- **Actores:** Docente; Lector RFID de Laboratorio / Sala; Motor de Validación.
- **Descripción:** Un docente intenta acceder a una sala de cómputo o aula especializada; el sistema verifica si tiene clase programada en ese espacio en el momento exacto.
- **Precondiciones:** El docente tiene carnet activo y un horario asignado en `schedules`.
- **Disparador:** El docente acerca su carnet a la puerta del laboratorio (ej. Puerta Principal — Sala de Informática 1).
- **Flujo Principal:**
  1. El lector transmite el UID y el ID de la puerta al backend.
  2. El backend identifica al docente y detecta que su rol no posee acceso global irrestricto.
  3. El sistema extrae el día actual (1 = Lunes, 2 = Martes, etc.) y la hora del servidor (`HH:MM:SS`).
  4. Se consulta la tabla `schedules` buscando un registro activo donde coincidan `user_id`, `room_id`, `day_of_week` y donde `start_time <= hora_actual <= end_time`.
  5. Se encuentra coincidencia (ej. Profesor López tiene Programación Orientada a Objetos en Sala 1 de 07:00 a 09:00).
  6. El sistema autoriza el ingreso, destraba la puerta y notifica por WebSocket.
- **Flujos Alternativos:**
  - **5a. Docente intenta ingresar fuera de su horario:**
    - No existe horario coincidente para la hora actual.
    - El sistema deniega el acceso con causa `'denegado_horario_no_valido'`. La puerta permanece asegurada y se alerta al monitor con vibración.
- **Postcondiciones:** Acceso registrado en auditoría con su respectivo resultado.

---

### CU-005: Detección, Disparo y Desarme de Alarma Crítica en Sala de Informática 1
- **ID:** CU-005
- **Actores:** Intruso / Usuario no autorizado; Celador / Seguridad; Motor de Alarmas.
- **Descripción:** Al presentarse una apertura forzada o no autorizada en la Sala de Informática 1 con el sistema armado, se dispara una alarma crítica que solo puede apagarse desde el cuarto de seguridad.
- **Precondiciones:** Sala de Informática 1 con `has_alarm = TRUE` y `security_status = 'armed'`.
- **Disparador:** Sensor magnético de puerta o sensor de movimiento activado sin previa autorización, o lectura denegada en una puerta asegurada.
- **Flujo Principal:**
  1. El backend detecta el evento de violación en la sala armada.
  2. El estado de la sala cambia a `security_status = 'alert'`.
  3. Se genera un registro de alarma en `alerts` con `severity: 'critical'`.
  4. El servidor difunde el evento WebSocket `new_alert` con máxima prioridad.
  5. El servicio de correo (`emailService.js`) remite notificación de emergencia a `vigilancia@lasallista.edu.co`.
  6. El panel web de la celaduría muestra una alerta roja titilante con sonido continuo y vibración de emergencia.
  7. El guardia en portería se desplaza a verificar o ingresa a `/alerts` en su consola.
  8. El guardia hace clic en "Resolver Alarma", ingresa la nota de resolución y el sistema desarma la alerta, restableciendo la sala a estado normal.
- **Flujos Alternativos:**
  - **7a. Desarme manual previo por guardia:** Si el guardia pasa su Ficha Maestra antes de la apertura, la alarma no se dispara.
- **Postcondiciones:** Alarma resuelta y registrada con fecha, hora y usuario responsable; sala restablecida.

---

### CU-006: Gestión Dinámica de la Infraestructura del Campus
- **ID:** CU-006
- **Actores:** Administrador del Sistema.
- **Descripción:** Permite crear y estructurar jerárquicamente Bloques, Salas y Puertas Inteligentes de forma completamente dinámica sin tocar el código.
- **Precondiciones:** Administrador autenticado con rol `admin` o `rector`.
- **Disparador:** El administrador accede a `/map` ("Mapa Institucional").
- **Flujo Principal:**
  1. El administrador visualiza los bloques actuales (Bloque A, B, C, Administrativo).
  2. Hace clic en "Nuevo Bloque" e ingresa nombre, descripción y ubicación física.
  3. Selecciona un bloque y pulsa "Nueva Sala/Laboratorio", configurando piso, tipo (laboratorio, aula, biblioteca, oficina) e indicadores de seguridad (`has_alarm`, número de sensores).
  4. Selecciona la sala y agrega una "Puerta Inteligente", indicando nombre, tipo (`main` o `lateral`), IP de hardware y MAC address.
  5. Los cambios se persisten en PostgreSQL (o fallback en memoria) y quedan inmediatamente operativos para validación RFID.
- **Postcondiciones:** Nueva infraestructura registrada y lista para recibir lecturas de hardware.

---

### CU-007: Enrolamiento de Tarjeta RFID y Categorización
- **ID:** CU-007
- **Actores:** Administrador del Sistema; Titular de la Tarjeta.
- **Descripción:** Permite enrolar una nueva tarjeta física por su UID y vincularla a un usuario del campus, definiendo si es de uso estándar o ficha maestra.
- **Precondiciones:** Tarjeta física disponible; usuario previamente registrado en el sistema.
- **Disparador:** El administrador navega a `/rfid-cards`.
- **Flujo Principal:**
  1. El administrador acerca la tarjeta al lector de programación o digita su UID Hexadecimal (ej. `B3A4F102`).
  2. Selecciona al usuario titular de la lista desplegable.
  3. Define la categoría de la tarjeta: `standard` (sujeta a horarios y permisos ordinarios) o `master` (ficha maestra con permiso de anulación para seguridad).
  4. Asigna una etiqueta descriptiva y confirma el guardado (`POST /api/rfid-cards`).
  5. La tarjeta queda activa inmediatamente en el sistema.
- **Postcondiciones:** Tarjeta vinculada y habilitada para abrir las puertas autorizadas.

---

### CU-008: Configuración de Articulación Horaria
- **ID:** CU-008
- **Actores:** Administrador del Sistema / Coordinación de Decanatura.
- **Descripción:** Asigna los bloques de horario en los que docentes o estudiantes pueden ingresar a laboratorios o salas específicas.
- **Precondiciones:** Docente registrado y sala física creada.
- **Disparador:** El administrador accede a `/schedules`.
- **Flujo Principal:**
  1. El administrador pulsa "Nuevo Horario".
  2. Selecciona al docente (ej. Carlos Andrés López Mejía).
  3. Selecciona la sala (ej. Sala de Informática 1).
  4. Especifica el día de la semana (Lunes a Sábado), hora de inicio (ej. 07:00), hora de fin (ej. 09:00), semestre y nombre de la materia.
  5. Guarda la asignación (`POST /api/schedules`).
- **Postcondiciones:** Horario en vigor; el motor de validación permitirá el acceso al docente únicamente en esa ventana de tiempo.

---

### CU-009: Auditoría y Exportación de Registros a CSV
- **ID:** CU-009
- **Actores:** Administrador del Sistema.
- **Descripción:** Consulta y descarga el historial cronológico de todas las interacciones físicas registradas en las puertas del campus.
- **Precondiciones:** Administrador autenticado en `/logs`.
- **Disparador:** Solicitud de reporte de seguridad o auditoría académica.
- **Flujo Principal:**
  1. El administrador visualiza la tabla paginada con fecha/hora, UID, titular, puerta, método y estado (concedido/denegado).
  2. Aplica filtros por rango de fechas, puerta específica o estado de acceso.
  3. Pulsa el botón "Exportar a CSV".
  4. El sistema compila el dataset filtrado en formato delimitado por comas y descarga el archivo con codificación UTF-8.
- **Postcondiciones:** Archivo CSV generado para análisis externo o entrega a directivas.

---

### CU-010: Conmutación de Emergencia a Modo de Resiliencia en Memoria
- **ID:** CU-010
- **Actores:** Servidor Backend; Motor PostgreSQL (Secundario).
- **Descripción:** Ante una caída imprevista del servicio PostgreSQL o fallo de conectividad de red, el sistema conmuta automáticamente al almacén en memoria sin interrumpir el servicio.
- **Precondiciones:** Servidor Node.js activo.
- **Disparador:** Excepción o timeout en una consulta a `pg.pool`.
- **Flujo Principal:**
  1. El bloque `try...catch` de la consulta captura el error de PostgreSQL.
  2. El manejador ejecuta `db.setUseMemory(true)`.
  3. Se emite un aviso en consola: *"Fallo en consulta PG, recurriendo a memoria"*.
  4. La consulta se reintenta inmediatamente contra las estructuras JavaScript en RAM (`memoryDb`).
  5. La petición HTTP responde con código `200 OK` y los datos correspondientes.
  6. La validación en torniquete y la apertura de puerta se completan en menos de 3 segundos sin error para el usuario final.
- **Postcondiciones:** Continuidad operativa garantizada (cero tiempo fuera de servicio).
