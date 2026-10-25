# ⚡ Diagramas de Actividad del Sistema

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**

---

## AD-001: Motor Central de Decisión y Validación de Acceso RFID

Representa la lógica de bifurcación ejecutada en milisegundos cuando una tarjeta física toca un lector en cualquier puerta del campus.

```mermaid
flowchart TD
    Inicio([Inicio: Tarjeta detectada en lector]) --> CapturaUID[Capturar UID Hexadecimal por SPI]
    CapturaUID --> EnviarPOST[Enviar POST /api/access/validate al Backend]
    EnviarPOST --> BuscarTarjeta{¿Tarjeta existe en el sistema?}

    BuscarTarjeta -- No --> DenegarNoRegistrado[denial_reason = 'denegado_no_registrado']
    BuscarTarjeta -- Sí --> CheckActiva{¿Tarjeta está activa?}

    CheckActiva -- No --> DenegarInactiva[denial_reason = 'denegado_tarjeta_inactiva']
    CheckActiva -- Sí --> BuscarUsuario{¿Tiene usuario asignado y activo?}

    BuscarUsuario -- No --> DenegarUsuarioInactivo[denial_reason = 'denegado_usuario_inactivo']
    BuscarUsuario -- Sí --> CheckPrivilegioGlobal{¿Es Rectoría o Ficha Maestra?}

    CheckPrivilegioGlobal -- Sí --> AutorizarAcceso[granted = TRUE: Acceso Concedido]
    CheckPrivilegioGlobal -- No --> CheckEsAdminStaff{¿Es Administrativo en bloque admin?}

    CheckEsAdminStaff -- Sí --> AutorizarAcceso
    CheckEsAdminStaff -- No --> ValidarHorario{¿Tiene clase activa en tabla schedules?}

    ValidarHorario -- Sí --> AutorizarAcceso
    ValidarHorario -- No --> DenegarHorario[denial_reason = 'denegado_horario_no_valido']

    %% Lógica de Apertura
    AutorizarAcceso --> ActivarRele[Activar Relé de Cerradura por 5s]
    ActivarRele --> WSGranted[Broadcast WebSocket: Acceso Autorizado]
    WSGranted --> LogOK[INSERT INTO access_logs con granted = TRUE]
    LogOK --> Fin([Fin: Puerta Abierta])

    %% Lógica de Denegación y Alarma
    DenegarNoRegistrado --> CheckSalaArmada
    DenegarInactiva --> CheckSalaArmada
    DenegarUsuarioInactivo --> CheckSalaArmada
    DenegarHorario --> CheckSalaArmada

    CheckSalaArmada{¿La sala tiene alarma y está armada?}
    CheckSalaArmada -- Sí --> DispararAlarmaCritica[🚨 DISPARAR ALARMA CRÍTICA<br/>Cambiar sala a 'alert'<br/>Buzzer físico ON<br/>Email a seguridad]
    CheckSalaArmada -- No --> MantenerCerrada[Mantener cerradura bloqueada]

    DispararAlarmaCritica --> WSDenied[Broadcast WebSocket: Acceso Denegado + Alarma]
    MantenerCerrada --> WSDenied
    WSDenied --> LogDenegado[INSERT INTO access_logs con granted = FALSE]
    LogDenegado --> AlertaVibracion[Frontend: Ejecuta animación de vibración y tono de error]
    AlertaVibracion --> FinDenegado([Fin: Acceso Bloqueado])
```

---

## AD-002: Ciclo de Vida y Protocolo de Resolución de Alarmas Críticas

Modela el protocolo de seguridad física desplegado para la protección de la Sala de Informática 1 y espacios restringidos.

```mermaid
flowchart TD
    EstadoNormal[Estado: Sala Normal / Desarmada<br/>Clases regulares activas] --> FinClase[Finalización de jornada o comando de celador]
    FinClase --> ArmarSala[Estado: Sala ARMADA<br/>Sensores PIR y magnéticos vigilantes]

    ArmarSala --> EventoApertura{¿Se detecta apertura o intrusión?}
    EventoApertura -- No --> ArmarSala
    EventoApertura -- Sí --> CheckFichaMaestra{¿Se presentó Ficha Maestra previamente?}

    CheckFichaMaestra -- Sí --> DesarmeTemporal[Desarme temporal autorizado para ronda]
    DesarmeTemporal --> ArmarSala

    CheckFichaMaestra -- No --> ALARMA_DISPARADA[🚨 ALARMA CRÍTICA ACTIVADA<br/>security_status = 'alert']
    ALARMA_DISPARADA --> SirenaLocal[Buzzer continuo en ESP32]
    ALARMA_DISPARADA --> EnviarCorreo[Email a vigilancia@lasallista.edu.co]
    ALARMA_DISPARADA --> NotificarMonitor[Panel web celador: Sirena visual roja titilante]

    NotificarMonitor --> Desplazamiento[Guardia verifica presencialmente la sala]
    Desplazamiento --> IngresoConsola[Guardia accede a /alerts en consola web]
    IngresoConsola --> RegistrarResolucion[Pulsar 'Resolver Alarma' e ingresar nota de inspección]
    RegistrarResolucion --> APIResolve[POST /api/alerts/:id/resolve]
    APIResolve --> SilenciarBuzzer[Apagar sirena local del hardware]
    SilenciarBuzzer --> RestablecerSala[Restablecer sala a estado 'normal' / 'armed']
    RestablecerSala --> FinAlarma([Fin: Incidente cerrado y auditado])
```

---

## AD-003: Proceso de Enrolamiento y Categorización de Tarjetas RFID

Describe el flujo de captura y vinculación de carnets para nuevos integrantes del campus.

```mermaid
flowchart TD
    InicioEnrolamiento([Inicio: Enrolamiento de nueva tarjeta]) --> AdminLogin[Administrador inicia sesión en /rfid-cards]
    AdminLogin --> LecturaAntena[Acercar tarjeta al lector maestro o ingresar UID Hex]
    LecturaAntena --> ValidarUnicidad{¿El UID ya existe en rfid_cards?}

    ValidarUnicidad -- Sí --> ErrorDuplicado[Mostrar error: 'UID ya registrado para otro titular']
    ErrorDuplicado --> LecturaAntena

    ValidarUnicidad -- No --> SeleccionarUsuario[Seleccionar usuario universitario de la lista]
    SeleccionarUsuario --> ElegirCategoria{¿Categoría de la tarjeta?}

    ElegirCategoria -- Estándar --> AsignarStandard[card_type = 'standard'<br/>Sujeta a horarios y permisos ordinarios]
    ElegirCategoria -- Maestra --> AsignarMaster[card_type = 'master'<br/>Ficha maestra con permiso de anulación para vigilancia]

    AsignarStandard --> GuardarDB[POST /api/rfid-cards]
    AsignarMaster --> GuardarDB
    GuardarDB --> ConfirmacionExitosa[Tarjeta activa y asociada al usuario]
    ConfirmacionExitosa --> FinEnrolado([Fin: Carnet listo para ingreso en puertas])
```
