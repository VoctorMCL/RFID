# 📑 Especificación de Requisitos de Software (SRS)

**Proyecto:** Sistema de Control de Acceso Peatonal mediante Tecnología RFID/NFC con Validación Visual  
**Institución:** Corporación Universitaria Lasallista — Caldas, Antioquia  
**Autores:** Victor Manuel Cordoba Larez & Jeronimo Arboleda Galeano  
**Docente:** Feibert Alirio Guzman Perez  
**Periodo:** 2026-2  

---

## 1. Requisitos de Usuario (RU)

| ID | Nombre | Descripción del Requisito | Usuario |
|---|---|---|---|
| **RU-001** | Ingresar con el carnet | La persona debe poder ingresar acercando su carnet RFID al lector, sin otra acción adicional. | Persona |
| **RU-002** | Verificar al titular | El celador debe ver la fotografía y los datos del titular en pantalla para compararlos con quien presenta el carnet. | Celador |
| **RU-003** | Gestionar personas y tarjetas | El administrador debe poder registrar personas y vincularles una tarjeta. | Administrador |
| **RU-004** | Revocar carnets | El administrador debe poder revocar de inmediato un carnet perdido, robado o de una persona retirada. | Administrador |
| **RU-005** | Registrar visitantes | El administrador debe poder dar acceso temporal con fecha de expiración automática. | Administrador |
| **RU-006** | Consultar el historial | El administrador debe poder consultar cada intento de acceso con su resultado. | Administrador |
| **RU-007** | Recibir alertas | El celador debe recibir una alerta inmediata y visual cuando el acceso sea denegado. | Celador |
| **RU-008** | Evaluar el desempeño | El equipo debe poder medir el tiempo de respuesta y la tasa de aciertos en la validación (< 3 segundos). | Administrador / Equipo |

---

## 2. Requisitos Funcionales (RF)

| ID | Nombre | Descripción de la Función | Actor | RU Asociado |
|---|---|---|---|---|
| **RF-001** | Leer carnet | Permite leer el UID de una tarjeta RFID de 13,56 MHz (ISO/IEC 14443-A) al acercarla al lector. | Persona | RU-001 |
| **RF-002** | Validar tarjeta | Permite verificar que el UID esté registrado, que la tarjeta esté activa y que el acceso esté vigente. | Sistema | RU-001 |
| **RF-003** | Autorizar o denegar | Permite autorizar o denegar el ingreso y mostrar el resultado en pantalla en verde/rojo. | Persona / Celador | RU-001 |
| **RF-004** | Registrar intento | Permite guardar cada intento (UID, tarjeta, torniquete, fecha y hora, resultado y tiempo de respuesta). | Sistema | RU-006, RU-008 |
| **RF-005** | Mostrar al titular | Permite mostrar al celador la fotografía, el nombre, documento y programa del titular. | Celador | RU-002 |
| **RF-006** | Alertar | Permite alertar visualmente (con animación de vibración) cuando la tarjeta no esté registrada, esté revocada o expirada. | Celador | RU-007 |
| **RF-007** | Registrar personas | Permite crear, modificar, consultar e inhabilitar estudiantes, docentes y visitantes, con fotografía. | Administrador | RU-003 |
| **RF-008** | Vincular tarjeta | Permite asociar una tarjeta física por su UID a una persona. | Administrador | RU-003 |
| **RF-009** | Revocar tarjeta | Permite desactivar una tarjeta de inmediato para bloquear el acceso en tiempo real. | Administrador | RU-004 |
| **RF-010** | Registrar visitante | Permite registrar un visitante con fecha límite de expiración automática. | Administrador | RU-005 |
| **RF-011** | Consultar historial | Permite consultar y filtrar los intentos por fecha, resultado o UID/nombre. | Administrador | RU-006 |
| **RF-012** | Iniciar sesión | Permite el acceso seguro al panel administrativo y de control. | Administrador / Celador | RU-003 |
| **RF-013** | Registrar confirmación | Permite registrar si el celador confirmó o no presencialmente la identidad visual. | Celador | RU-002 |
| **RF-014** | Medir desempeño | Permite calcular el tiempo de respuesta (latencia en ms) y la tasa de aciertos frente a la meta de 3 s. | Administrador / Equipo | RU-008 |

---

## 3. Requisitos No Funcionales (RNF)

### 3.1 Usabilidad e Interfaz
- **RNF-001:** La pantalla del celador debe mostrar en una sola vista la fotografía, el nombre, el rol y el resultado, sin desplazamiento.
- **RNF-002:** El resultado debe distinguirse por texto claro y por color (verde aceptado, rojo denegado), incorporando **animación de vibración** en los errores y denegaciones.
- **RNF-003:** Un administrador debe poder registrar una persona y vincularle una tarjeta en menos de 3 minutos.

### 3.2 Rendimiento
- **RNF-007:** El tiempo total entre la lectura del UID y la respuesta en pantalla debe ser **menor de 3 segundos**.
- **RNF-008:** El sistema debe procesar al menos 20 validaciones por minuto por lector.
- **RNF-009:** La consulta debe filtrar por UID en la base de datos indexada y no descargar toda la tabla.

### 3.3 Restricciones de Diseño
- **RNF-010:** Hardware de lectura basado en RC522 (13,56 MHz) conectado por SPI a una CrowPi 3 (Raspberry Pi 5).
- **RNF-011:** La lógica de validación se implementa en Python y la interfaz web en **React**.
- **RNF-012:** La base de datos es PostgreSQL alojada en Supabase.
- **RNF-013:** Herramientas de software libre y código abierto.

### 3.4 Seguridad y Protección de Datos
- **RNF-014:** Las tablas deben contar con Row Level Security (RLS) activo.
- **RNF-015:** Las credenciales y claves se leen de variables de entorno y no se queman en código público.
- **RNF-018:** Las fotografías y datos personales se procesan estrictamente bajo los lineamientos de la **Ley Estatutaria 1581 de 2012** de Protección de Datos Personales en Colombia.
