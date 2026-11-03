# 🔌 Módulo de Hardware RFID y Sensores Físicos
### Integración Física con ESP32 y Raspberry Pi (CrowPi 3)
**Corporación Universitaria Lasallista — Caldas, Antioquia**

---

## 📋 Resumen del Módulo

El subsistema de hardware se encarga de la captura física de tarjetas RFID Mifare (13.56 MHz), la interacción con sensores de presencia y cerraduras electromagnéticas, y la transmisión en tiempo real hacia la API REST del backend (`POST /api/access/validate`).

El sistema ofrece dos alternativas de hardware completamente implementadas:
1. **ESP32 Standalone (C++ / Arduino)**: Ideal para instalación permanente en cada puerta inteligente con conexión WiFi autónoma.
2. **Raspberry Pi / CrowPi 3 (Python 3)**: Ideal para torniquetes, laboratorios y estaciones de enrolamiento con interfaz gráfica local.

---

## 🛠️ Alternativa 1: Microcontrolador ESP32 (`esp32_rfid_firmware.ino`)

### Diagrama de Conexiones (ESP32 <-> MFRC522)

| Pin MFRC522 | Pin ESP32 (GPIO) | Descripción / Función |
|-------------|------------------|-----------------------|
| **3.3V**    | `3V3`            | Alimentación obligatoria (¡NO usar 5V!) |
| **GND**     | `GND`            | Tierra común |
| **RST**     | `GPIO 22`        | Reset del módulo RFID |
| **SDA (SS)**| `GPIO 5`         | SPI Chip Select (CS) |
| **SCK**     | `GPIO 18`        | SPI Clock |
| **MISO**    | `GPIO 19`        | SPI Master In Slave Out |
| **MOSI**    | `GPIO 23`        | SPI Master Out Slave In |
| **IRQ**     | *No conectado*   | Interrupción opcional |

### Pines de Actuadores y Alarma

| Componente | Pin ESP32 | Comportamiento |
|------------|-----------|----------------|
| **Cerradura / Relé** | `GPIO 2` | Pulso en HIGH durante 3 segundos al conceder acceso |
| **Buzzer Alarma**    | `GPIO 4` | Tono continuo de alerta si se fuerza apertura |
| **LED de Estado**    | `GPIO 15`| Parpadeo en lectura, verde/azul en autorización |

### Librerías Requeridas en Arduino IDE:
1. `MFRC522` de Github Community / miguelbalboa
2. `ArduinoJson` de Benoit Blanchon (versión 6.x o 7.x)

### Configuración en el Código (`esp32_rfid_firmware.ino`):
```cpp
const char* WIFI_SSID     = "Lasallista_Campus";
const char* WIFI_PASSWORD = "TuPasswordSeguro";
const char* BACKEND_URL   = "http://192.168.1.50:4000/api/access/validate";
const int   DOOR_ID       = 1; // 1 = Puerta Principal Sala Informática 1
```

---

## 🍓 Alternativa 2: Raspberry Pi / CrowPi 3 (`lector_rfid.py`)

### Requisitos y Dependencias
En Raspberry Pi OS / Linux con bus SPI habilitado (`sudo raspi-config` -> Interfacing Options -> SPI):

```bash
pip install spidev mfrc522 RPi.GPIO
```

> **Raspberry Pi 5 / CrowPi 3 con Pi 5:** `RPi.GPIO` no puede controlar los pines en
> Pi 5. Instala `gpiozero` y `lgpio`; el script los usa automáticamente como respaldo:
>
> ```bash
> sudo apt install -y python3-gpiozero python3-lgpio
> ```
>
> **Buzzer CrowPi 3:** la placa lo rotula como **`PI:IO01`**, que corresponde al
> **GPIO BCM 18** (pin físico 12 del header de 40 pines). Es un buzzer activo.
> Puedes probarlo sin arrancar el lector con `python3 hardware/lector_rfid.py --test-buzzer`.
> Si sigue sin sonar, usa el diagnóstico independiente:
> `python3 hardware/test_buzzer_crowpi3.py` (prueba RPi.GPIO, polaridad invertida y gpiozero).
>
> Recuerda que el **DIP switch de la CrowPi 3 debe estar en la posición 1 (Raspberry Pi)**
> para que los sensores y el buzzer queden conectados al GPIO de la Pi.

### Ejecución del Lector

```bash
# Modo normal conectado al servidor local
python3 hardware/lector_rfid.py

# Asignar a una puerta específica (ej. Puerta 2: Taller de Ingeniería)
python3 hardware/lector_rfid.py --door 2

# Conectar a servidor remoto en la red institucional
python3 hardware/lector_rfid.py --server http://192.168.1.100:4000

# Modo diagnóstico (solo lee y muestra el UID de tarjetas sin enviar HTTP)
python3 hardware/lector_rfid.py --uid

# Probar únicamente el buzzer de la CrowPi 3 (CrowPi PI:IO01 = BCM 18)
python3 hardware/lector_rfid.py --test-buzzer

# Silenciar el buzzer o cambiar su pin/tipo
python3 hardware/lector_rfid.py --mute
python3 hardware/lector_rfid.py --buzzer-pin 18 --buzzer-type active
```

### Opciones de Línea de Comandos

| Bandera | Descripción | Valor por Defecto |
|---------|-------------|-------------------|
| `--server <url>` | URL base del servidor backend o endpoint | `https://rfid.victormcl.me/api/access/validate` (o `http://localhost:4000`) |
| `--door <id>` | ID de la puerta según la base de datos | `1` |
| `--uid` | Diagnóstico: imprime UID sin enviar HTTP | `false` |
| `--mute` | Desactiva los pitidos del buzzer | `false` |
| `--buzzer-pin <bcm>` | GPIO BCM del buzzer (CrowPi 3: `18` = `PI:IO01`) | `18` (`RFID_BUZZER_PIN`) |
| `--buzzer-type <tipo>` | `active` (CrowPi 3) o `passive` (requiere PWM) | `active` (`RFID_BUZZER_TYPE`) |
| `--test-buzzer` | Emite las secuencias de prueba y sale | `false` |

### Telemetría de Presencia en Segundo Plano (Heartbeat)
El script `lector_rfid.py` inicia de forma autónoma un hilo en segundo plano (`threading.Thread`) que emite un pulso HTTP cada 8 segundos a:
`POST /api/doors/<door_id>/heartbeat`
Esto actualiza dinámicamente el campo `last_heartbeat` en PostgreSQL y activa el indicador verde `🟢 Sensor RFID Conectado` en la consola de monitoreo del celador.

---

## 🚪 Prototipo Sala de Informática 1 (Piloto Físico)

La Sala de Informática 1 está configurada con dos puertas inteligentes y lógica de alarma física:
1. **Puerta Principal (ID 1)**: Acceso directo desde el pasillo general del Bloque A.
2. **Puerta Lateral Derecha (ID 2)**: Comunicación interna con el Taller de Ingeniería.

**Protocolo de Seguridad Integrado:**
- Si un sensor de puerta o de movimiento detecta apertura física en horario no autorizado y sin desarmado previo desde la central de monitoreo, el backend emite un evento crítico WebSocket y genera un registro de alarma inmediata (`severity: critical`).
- La alarma solo puede ser silenciada y resuelta por el personal de vigilancia mediante su panel en el frontend.
