# 🔌 Integración de Hardware RFID y Sensores Físicos

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**

---

## 1. Visión del Subsistema de Hardware

El subsistema de hardware se encarga de la detección por radiofrecuencia de las tarjetas de proximidad institucionales, el accionamiento de cerraduras electromagnéticas y la captura de señales de intrusión provenientes de sensores magnéticos y de movimiento.

El ecosistema cuenta con dos alternativas de integración completamente desarrolladas y funcionales:
1. **Alternativa 1 — ESP32 Standalone (C++ / WiFi):** Diseñada para instalación embebida en marcos de puertas inteligentes autónomas.
2. **Alternativa 2 — Raspberry Pi 5 / CrowPi 3 (Python 3 / SPI):** Diseñada para estaciones de torniquetes peatonales, módulos de portería y puestos de enrolamiento de tarjetas.

---

## 2. Especificaciones del Lector RFID MFRC522

- **Frecuencia de Operación:** 13.56 MHz (Alta Frecuencia - HF).
- **Estándar Soportado:** ISO/IEC 14443-A (Mifare Classic 1K/4K, Mifare Ultralight, NTAG213/215/216).
- **Distancia de Lectura:** 2 a 5 cm del plano de la antena integrada.
- **Tensión de Alimentación:** **3.3 V DC** (¡Peligro: conectar a 5V quema el circuito integrado MFRC522!).
- **Consumo de Corriente:** 13 a 26 mA en lectura activa; 10 µA en modo reposo.
- **Protocolo de Comunicación:** SPI (Serial Peripheral Interface) hasta 10 Mbps.

---

## 3. Alternativa 1: Microcontrolador ESP32 Standalone

El ESP32 opera de manera autónoma conectado a la red WiFi del campus y controla directamente los actuadores locales de la puerta.

### 3.1 Diagrama de Conexiones de Pines (Pinout)

| Pin MFRC522 | Pin ESP32 (GPIO) | Color Habitual | Función Técnica |
| :--- | :--- | :--- | :--- |
| **3.3V** | `3V3` | Rojo | Alimentación obligatoria a 3.3V. |
| **GND** | `GND` | Negro | Tierra común de referencia. |
| **RST** | `GPIO 22` | Blanco | Reset por hardware del transceptor RFID. |
| **SDA (SS)** | `GPIO 5` | Amarillo | Chip Select / Slave Select del bus SPI. |
| **SCK** | `GPIO 18` | Naranja | Reloj síncrono del bus SPI (Serial Clock). |
| **MISO** | `GPIO 19` | Verde | Master In Slave Out (Datos hacia el ESP32). |
| **MOSI** | `GPIO 23` | Azul | Master Out Slave In (Datos hacia el RC522). |

### 3.2 Pines de Actuadores y Sensores en ESP32

| Componente | Pin ESP32 | Modo GPIO | Comportamiento |
| :--- | :--- | :--- | :--- |
| **Módulo Relé (Electroimán)** | `GPIO 2` | `OUTPUT` | Pulso en `HIGH` durante 5 segundos para liberar cerradura al conceder acceso. |
| **Buzzer Activo (Alarma)** | `GPIO 4` | `OUTPUT` | Tono continuo de 2.4 kHz en caso de intrusión o alarma crítica. |
| **LED Indicador de Estado** | `GPIO 15` | `OUTPUT` | Parpadeo rápido en lectura; encendido fijo en reposo. |
| **Sensor Magnético Puerta** | `GPIO 21` | `INPUT_PULLUP` | Detección de apertura de hoja (Normalmente Cerrado). |
| **Sensor de Movimiento PIR** | `GPIO 34` | `INPUT` | Entrada digital de presencia en sala asegurada. |

### 3.3 Circuito de Protección de la Cerradura Electromagnética
> [!CAUTION]
> **Diodo Flyback Obligatorio:** Las cerraduras electromagnéticas y cantoneras eléctricas de 12V DC generan picos inductivos de alta tensión al desenergizarse (fuerza contraelectromotriz). Es imperativo colocar un diodo **1N4007 en paralelo inverso** con los bornes de la bobina del electroimán para evitar dañar el transistor o relé del circuito.

### 3.4 Firmware Arduino/C++ ([`esp32_rfid_firmware.ino`](file:///home/victormcl/Documents/RFID/hardware/esp32_rfid_firmware.ino))
- **Librerías requeridas:** `MFRC522` (por miguelbalboa) y `ArduinoJson` (v6 o v7).
- Al capturar una tarjeta, el ESP32 genera una trama JSON y la envía por HTTP POST:
  ```json
  {
    "rfid_uid": "A1B2C3D4",
    "door_id": 1,
    "access_method": "rfid"
  }
  ```
- Si la respuesta indica `granted: true`, activa `digitalWrite(RELAY_PIN, HIGH)` durante 5 segundos.

---

## 4. Alternativa 2: Raspberry Pi 5 / CrowPi 3

En la estación de portería o torniquete con pantalla, el lector RC522 se conecta al cabezal GPIO de 40 pines de la Raspberry Pi 5 / CrowPi 3.

### 4.1 Diagrama de Conexiones (Raspberry Pi GPIO)

| Pin MFRC522 | Pin Físico Raspberry Pi | Nombre en BCM |
| :--- | :--- | :--- |
| **3.3V** | Pin 1 | `3V3 Power` |
| **GND** | Pin 6 | `Ground` |
| **RST** | Pin 22 | `GPIO 25` |
| **SDA (SS)** | Pin 24 | `GPIO 8 (SPI0_CE0_N)` |
| **SCK** | Pin 23 | `GPIO 11 (SPI0_SCLK)` |
| **MISO** | Pin 21 | `GPIO 9 (SPI0_MISO)` |
| **MOSI** | Pin 19 | `GPIO 10 (SPI0_MOSI)` |

### 4.2 Habilitación del Bus SPI en Raspberry Pi OS
```bash
sudo raspi-config
# Navegar a: Interfacing Options -> SPI -> Enable -> Finish
ls -l /dev/spidev0.* # Debe listar /dev/spidev0.0 y /dev/spidev0.1
```

### 4.3 Instalación de Dependencias Python
```bash
pip3 install spidev mfrc522 RPi.GPIO
```

### 4.4 Ejecución del Cliente Python ([`hardware/lector_rfid.py`](file:///home/victormcl/Documents/RFID/hardware/lector_rfid.py))

```bash
# 1. Modo Estándar conectado al Backend (en la nube o local)
python3 hardware/lector_rfid.py

# 2. Asignar a una Puerta específica (ej. Puerta 2: Taller de Ingeniería)
python3 hardware/lector_rfid.py --door 2

# 3. Conectar a un Servidor en la Red Local del Campus
python3 hardware/lector_rfid.py --server http://192.168.1.100:4000/api/access/validate

# 4. Modo Diagnóstico Offline (Solo imprime UID sin enviar HTTP)
python3 hardware/lector_rfid.py --uid
```

> 💓 **Telemetría Automática (Heartbeat):** El cliente Python arranca un hilo en segundo plano que envía un pulso periódico cada 8 segundos a `POST /api/doors/<door_id>/heartbeat`, manteniendo la puerta con indicador verde `🟢 Sensor RFID Conectado` en la consola de monitoreo del celador.

### 4.5 Modo Simulación en Consola
Si el script se ejecuta en una máquina de desarrollo sin cabezal GPIO o sin bus SPI activo, conmuta de forma automática a **modo consola interactiva**:
```
ℹ️ Librerías RPi.GPIO / mfrc522 no detectadas en este host.
   Para simular lecturas en modo consola, escribe un UID Hex (ej. A1B2C3D4):
Simular UID > 11223344
  ❌ [ACCESO DENEGADO] Causa: denegado_area_no_autorizada
```
Permitiendo probar el ecosistema completo incluso sin tener los cables conectados físicamente.
