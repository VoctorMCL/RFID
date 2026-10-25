# 📖 Glosario de Términos

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**

---

## 1. Términos de Hardware y Radiofrecuencia (RFID)

- **UID (Unique Identifier):** Secuencia única de 4 a 7 bytes en formato hexadecimal (ej. `A1B2C3D4`) grabada de fábrica en la memoria no volátil del chip RFID. Identifica unívocamente al carnet físico en el sistema.
- **MFRC522:** Circuito integrado transceptor de lectura y escritura por radiofrecuencia que opera a la frecuencia estándar de 13.56 MHz, ampliamente utilizado en prototipos IoT y sistemas embebidos.
- **Mifare Classic (1K / 4K):** Estándar de tarjetas inteligentes sin contacto ampliamente utilizado en carnets universitarios y transporte público, basado en la norma internacional ISO/IEC 14443-A.
- **Bus SPI (Serial Peripheral Interface):** Protocolo síncrono de comunicación serie de cuatro hilos (`MOSI`, `MISO`, `SCK`, `SS/SDA`) que conecta a alta velocidad el microcontrolador o microprocesador con el lector RFID.
- **Cerradura Electromagnética (Electroimán):** Dispositivo de retención mecánica que opera bajo el principio de electromagnetismo continuo (12V DC). Al interrumpirse el suministro eléctrico mediante un relé, la puerta se destraba permitiendo el paso.
- **CrowPi 3:** Plataforma educativa de experimentación basada en placa base Raspberry Pi con sensores, actuadores y bus SPI integrados, utilizada para la estación de portería peatonal.
- **ESP32:** Familia de microcontroladores de bajo costo y bajo consumo con conectividad WiFi y Bluetooth integrada, ideal para operar de forma autónoma en marcos de puertas inteligentes.
- **Sensor Magnético (Contacto Seco / Reed Switch):** Sensor colocado en el marco y hoja de una puerta que detecta de inmediato la separación física de la hoja (apertura).
- **Sensor PIR (Passive Infrared):** Sensor piroeléctrico que mide la radiación infrarroja emitida por cuerpos en movimiento, utilizado para detectar presencia física dentro de una sala asegurada.

---

## 2. Términos de Control de Acceso Institucional

- **Articulación Horaria:** Mecanismo algorítmico que cruza en tiempo real el reloj del sistema con la tabla de horarios de clase programados por Decanatura y RRHH para autorizar o bloquear el ingreso de un docente o grupo de estudiantes a un laboratorio determinado.
- **Ficha Maestra (Master Card):** Tarjeta RFID con atributos especiales de anulación de seguridad (`card_type == 'master'`), entregada al personal de vigilancia para realizar rondas nocturnas o responder ante emergencias sin disparar alarmas ni requerir horarios asignados.
- **Torniquete Peatonal:** Mecanismo electromecánico giratorio de tres brazos instalado en la entrada principal del campus universitario para dosificar y registrar el ingreso individual de personas.
- **Sala Armada (`armed`):** Estado de seguridad perimetral de un laboratorio en el cual cualquier apertura de puerta o movimiento detectado es catalogado como una intrusión no autorizada.
- **Alarma Crítica:** Estado de emergencia activado en la Sala de Informática 1 que dispara una sirena local, despacha alertas por correo y notifica a los monitores de seguridad, y que **únicamente puede desarmarse desde la consola web del celador**.
- **Desarme de Alarma:** Procedimiento formal mediante el cual un guardia de seguridad, tras corroborar la integridad física del recinto, silencia la alerta y restablece el laboratorio al estado seguro mediante la consola web.

---

## 3. Términos de Software y Arquitectura

- **RBAC (Role-Based Access Control):** Modelo de seguridad que restringe el acceso a funciones y endpoints basándose en el rol institucional asignado al usuario (`admin`, `celador`, `rector`, `professor`, `student`).
- **JWT (JSON Web Token):** Estándar abierto (RFC 7519) que define un mecanismo compacto y autónomo para transmitir información de forma segura entre cliente y servidor mediante una firma criptográfica HS256.
- **WebSocket:** Protocolo de comunicación bidireccional continuo sobre una única conexión TCP, utilizado para reflejar las lecturas de carnets en el monitor de portería en menos de 300 milisegundos.
- **Dual Engine (Resiliencia en Memoria):** Arquitectura de base de datos tolerante a fallos que utiliza PostgreSQL 16 como motor primario y un almacén en RAM (`memoryDb`) sincronizado como motor de contingencia transparente.
- **Paleta Monocromática Técnica:** Filosofía de diseño de interfaz de usuario basada en una escala estricta de tonos grises oscuros (`#121214` a `#34343d`), eliminando distracciones visuales y fatiga ocular en centros de monitoreo.
- **Animación de Vibración (`vibrate-shake`):** Efecto visual CSS combinado con la API de vibración física del navegador (`navigator.vibrate`) que sacude el contenedor del carnet ante un intento denegado para alertar inmediatamente al celador.
- **Campus Dinámico (Cero Hardcoding):** Principio arquitectónico que garantiza que ningún bloque, laboratorio o puerta esté quemado en el código fuente, permitiendo crearlos y administrarlos dinámicamente desde la base de datos.
