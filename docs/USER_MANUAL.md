# 👤 Manual de Usuario y Operación del Sistema

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**  
**Acceso Web:** [http://localhost:4000](http://localhost:4000) (o puerto de red LAN asignado)

---

## 1. Introducción y Acceso a la Plataforma

El sistema de control de acceso cuenta con una interfaz web técnica diseñada con paleta oscura en tonos grises para evitar la fatiga visual del personal de seguridad en jornadas continuas.

> [!IMPORTANT]
> **POLÍTICA DE ACCESO A LA PLATAFORMA WEB:**  
> La consola web es de uso **exclusivo para el Administrador del Sistema y el Celador / Personal de Seguridad**.  
> Los estudiantes y docentes no inician sesión en la web; su identificación y acceso se realiza únicamente aproximando su carnet físico a los lectores instalados en puertas y torniquetes.

---

## 2. Terminal RADAR de Acceso ([`/login`](http://localhost:4000/login))

La pantalla de bienvenida opera como una **Terminal RADAR** inteligente con interfaz Split-Screen inmersiva:

1. **Autenticación Física Directa por Tarjeta:**  
   Al aproximar una tarjeta física autorizada al sensor RFID (MFRC522 o lector USB), el sistema detecta el UID, reproduce un acorde ascendente Lasallista y activa una animación fluida de onda líquida que revela la identidad, cargo y credencial del funcionario, redirigiéndolo de inmediato a su panel operativo.
2. **Acceso Rápido de Prueba (Demo):**  
   Para auditorías o revisiones donde no se tenga un lector físico conectado, se dispone del botón interactivo:  
   **"Entrar como administrador (demo)"**, el cual valida instantáneamente los privilegios de administración sin trabas.
3. **Credenciales Alternativas / Soporte:**  
   Si se requiere ingreso manual por teclado:
   - **Administrador:** `admin@lasallista.edu.co` (o alias `admin`) | Contraseña: `acceso2026`.
   - **Celador / Vigilancia:** `celador@lasallista.edu.co` (o alias `celador`) | Contraseña: `acceso2026`.
4. **Política de Sesión Única y Cierre por Inactividad:**  
   - Solo se permite **1 sesión activa simultánea** por estación; si el usuario inicia sesión en otro puesto, la sesión previa finaliza automáticamente.
   - Tras **15 minutos sin interacción**, el sistema cierra la sesión por seguridad.

---

## 3. Guía de Operación para el Celador / Guardia

### 3.1 Pantalla del Escáner en Vivo ([`/monitor`](http://localhost:4000/monitor))
Es la herramienta principal de trabajo en el puesto de control de portería o torniquetes peatonales.

#### A. Monitoreo del Estado del Sensor RFID
En la parte superior derecha de la pantalla se ubica el panel de diagnóstico de hardware:
- **Caja en ROJO (`🔴 Sensor RFID Desconectado / No Detectado`):** Indica que el lector CrowPi 3 o ESP32 no tiene comunicación con la computadora o el cable SPI/red está desconectado.
- **Caja en VERDE (`🟢 Sensor RFID Conectado / Confirmado`):** Indica que el enlace físico está verificado y listo para capturar carnets.
- **Botón "Comprobar Enlace":** Permite forzar un ping hacia el hardware para verificar su funcionamiento en cualquier instante.

#### B. Validación Visual de una Persona Autorizada
Cuando un estudiante o docente acerca su carnet:
1. El marco central se ilumina en **tono verde institucional**.
2. Se reproduce un **tono sonoro discreto de autorización**.
3. Se despliega en pantalla completa:
   - Fotografía oficial del titular.
   - Nombre y Apellidos completos.
   - Número de Cédula o Documento de Identidad.
   - Programa Académico o Dependencia (ej. *Ingeniería de Software*).
   - Puerta y Sala donde se solicita el ingreso.
4. El celador compara visualmente la fotografía con la persona que se encuentra físicamente en el torniquete.
5. Tras 6 segundos, el visor retorna automáticamente al estado pasivo de espera.

#### C. Detección de Acceso Denegado y Alerta con Vibración
Si una persona intenta ingresar con un carnet no registrado, vencido o fuera del horario de su clase:
1. La pantalla se ilumina en **tono rojo de alerta**.
2. Se activa una **animación de vibración visual (`vibrate-shake`)** que sacude el recuadro del carnet.
3. En terminales táctiles o dispositivos móviles, el equipo ejecuta una **vibración háptica física**.
4. Se reproduce un **tono sonoro grave de advertencia**.
5. Se expone en texto claro el motivo del rechazo:
   - *Área no autorizada para el titular*.
   - *Horario de clase no válido en este momento*.
   - *Tarjeta inactiva o suspendida*.

#### D. Desbloqueo Remoto de Emergencia
Si una persona autorizada no porta su tarjeta por contingencia o se requiere evacuar, el celador puede pulsar el botón **"Desbloqueo de Emergencia"** para liberar la cerradura electromagnética durante 5 segundos.

---

### 3.2 Pases de Visitantes y Préstamos Temporales RFID ([`/rfid-cards`](http://localhost:4000/rfid-cards))
Permite gestionar el ingreso seguro de personas que no cuentan con carnet institucional oficial:

#### A. Emisión de un Pase Temporal con Tarjeta Física:
1. El celador acerca una tarjeta de préstamo al sensor RFID o selecciona la pestaña **Pases de Visitantes**.
2. Hace clic en **"Nuevo Pase de Visitante"**.
3. Selecciona el tipo de solicitante: `Visitante General`, `Contratista / Proveedor` o `Estudiante Sin Carnet`.
4. Diligencia nombres completos, número de documento oficial, teléfono y área de destino.
5. Para estudiantes sin carnet, es obligatorio indicar el motivo por el cual no porta el carnet institucional.
6. Vincula la tarjeta física leída y pulsa **"Emitir Pase"**.
7. La tarjeta queda activa inmediatamente para el tránsito autorizado en las puertas del campus.

#### B. Registro de Devolución y Salida del Campus:
1. Al salir del campus, la persona entrega la tarjeta física en la portería.
2. El celador localiza el registro en la lista de pases activos y hace clic en **"Registrar Devolución"**.
3. El sistema estampa la fecha/hora de salida (`exit_time`), desactiva la tarjeta para su custodia y genera la trazabilidad completa.

---

### 3.3 Consola de Alarmas Críticas ([`/alerts`](http://localhost:4000/alerts))
Utilizada para monitorear incidentes perimetrales y alarmas en laboratorios asegurados (como la Sala de Informática 1).

#### Cómo resolver y silenciar una alarma crítica:
1. Al producirse una apertura indebida en la Sala de Informática 1, la consola web emitirá una señal visual de alarma crítica titilante.
2. El personal de seguridad acude presencialmente a inspeccionar el recinto.
3. Una vez verificado que el espacio está seguro, el celador se dirige a `/alerts`.
4. Ubica la alerta activa y hace clic en el botón **"Resolver Alarma"**.
5. Ingresa una breve nota de inspección (ej. *"Verificado presencialmente. Falsa alarma por personal de aseo"*).
6. El sistema silencia el buzzer físico del laboratorio, restablece la sala al estado normal y archiva el registro con el nombre del guardia responsable.

---

## 4. Guía de Operación para el Administrador

### 4.1 Panel de Métricas y Resumen ([`/dashboard`](http://localhost:4000/dashboard))
Ofrece una vista panorámica del campus en tiempo real:
- Total de accesos registrados en el día de hoy.
- Porcentaje de ingresos aprobados vs. denegados.
- Cantidad de usuarios activos y carnets en circulación.
- Puertas inteligentes en línea y estado de sus electroimanes.
- Registro cronológico en vivo de las últimas entradas.
- Telemetría en tiempo real de la base de datos PostgreSQL y enlaces de red.

---

### 4.2 Mapa Institucional Dinámico ([`/map`](http://localhost:4000/map))
Permite estructurar las edificaciones de la universidad sin necesidad de programar:

#### A. Crear un Nuevo Bloque:
1. Haga clic en **"+ Nuevo Bloque"**.
2. Ingrese el nombre (ej. *"Bloque D"*), descripción y orientación en el campus.
3. Pulse **"Guardar Bloque"**.

#### B. Agregar una Sala o Laboratorio:
1. Seleccione el bloque correspondiente en la columna izquierda.
2. Haga clic en **"+ Nueva Sala"**.
3. Configure los parámetros:
   - Nombre: ej. *"Laboratorio de Inteligencia Artificial"*.
   - Tipo: Laboratorio, Aula, Biblioteca o Administrativo.
   - Piso: 1, 2, 3, etc.
   - Seguridad: Marque si posee alarma perimetral y sensores de presencia.
4. Pulse **"Guardar Sala"**.

#### C. Registrar una Puerta Inteligente:
1. Seleccione la sala deseada.
2. Haga clic en **"+ Nueva Puerta"**.
3. Indique la función (`Principal`, `Lateral` o `Torniquete`), su dirección IP (ej. `192.168.1.150`) y la dirección física MAC del controlador ESP32.
4. Al guardar, la puerta queda lista de inmediato para recibir lecturas de tarjetas.

---

### 4.3 Gestión de Personas y Usuarios ([`/users`](http://localhost:4000/users))
Permite mantener actualizado el censo de la comunidad universitaria:
1. Utilice el buscador para localizar personas por nombre, documento o correo.
2. Para ingresar un nuevo integrante, pulse **"Registrar Persona"**.
3. Diligencie nombres, documento de identidad, programa académico y asigne su rol institucional (`Profesor`, `Estudiante`, `Personal Administrativo`).
4. Si una persona se retira de la institución, cambie su estado a **"Inactivo"** para bloquear de inmediato todas sus tarjetas físicas asociadas.

---

### 4.4 Enrolamiento de Tarjetas RFID ([`/rfid-cards`](http://localhost:4000/rfid-cards))
Permite emitir y asignar carnets físicos por radiofrecuencia:
1. Acerque la nueva tarjeta al lector o digite su código UID hexadecimal (ej. `B1C2D3E4`).
2. Seleccione a la persona titular de la lista desplegable.
3. Seleccione la **Categoría de Tarjeta**:
   - **Estándar:** Carnet para alumnos y docentes sujeto a validación de horarios de clase.
   - **Maestra:** Ficha con privilegio de anulación para vigilantes o alta dirección.
   - **Temporal:** Ficha asignada a pases de visitantes y contingencias.
4. Pulse **"Enrolar Tarjeta"**. La tarjeta comenzará a operar en el instante.

---

### 4.5 Articulación Horaria Docente ([`/schedules`](http://localhost:4000/schedules))
Define en qué momento los profesores tienen permiso de abrir las salas de informática:
1. Haga clic en **"+ Nueva Asignación Horaria"**.
2. Seleccione al profesor (ej. *Carlos Andrés López*).
3. Seleccione el laboratorio (ej. *Sala de Informática 1*).
4. Indique el día de la semana (ej. *Lunes*) y la franja de clase (ej. *07:00* a *09:00*).
5. Especifique el semestre (ej. *2026-2*) y la asignatura (*Programación Orientada a Objetos*).
6. Al guardar, el motor de validación permitirá el acceso al docente única y exclusivamente en esa ventana horaria.

---

### 4.6 Historial de Auditoría y Exportación ([`/logs`](http://localhost:4000/logs))
1. Visualice cada intento con su sello de tiempo (`timestamp`), UID, titular y decisión.
2. Aplique filtros por resultado (*Solo Concedidos* o *Solo Denegados*) o por puerta específica.
3. Pulse el botón **"Exportar a CSV"** para descargar una copia del reporte en formato de hoja de cálculo para auditorías forenses.

---

## 5. Tablero de Telemetría en Grafana (`grafana-dashboard.json`)
El sistema incluye la definición formal de tablero para Grafana:
1. Importe el archivo `grafana-dashboard.json` en su servidor de Grafana institucional.
2. Configure la fuente de datos apuntando al endpoint `/api/access/analytics`.
3. El panel visualiza métricas de afluencia por hora, minuto, carrera, mapa de calor y pareto de causas de denegación en tiempo real.

---

## 6. Uso de la Barra Lateral Comprimible (Sidebar)
Para maximizar el espacio útil en pantallas de portería o monitores de dimensiones reducidas:
- Haga clic en el botón de colapsar (**icono de flechas / menú**) en la parte superior de la barra lateral.
- La barra se comprimirá a modo compacto (68 px) mostrando únicamente los iconos de navegación.
- Su preferencia se recordará automáticamente en su navegador mediante `rfid_sidebar_collapsed`.
- Haga clic nuevamente para expandir la barra y visualizar los rótulos completos.
