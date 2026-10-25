# 🍓 Guía de Instalación y Pruebas en CrowPi 3 / Raspberry Pi 5

**Proyecto:** Sistema de Control de Acceso Peatonal mediante Tecnología RFID/NFC con Validación Visual  
**Entorno de Pruebas:** CrowPi 3 / Raspberry Pi 5 con MFRC522  
**Institución:** Corporación Universitaria Lasallista (Caldas - Antioquia)  

---

## 1. Requisitos Previos

- Tarjeta Raspberry Pi 5 (o estación CrowPi 3) con **Raspberry Pi OS** (64-bit recomendado).
- Módulo lector RFID **RC522** (13.56 MHz, protocolo SPI).
- Conexión a Internet para comunicarse con la base de datos PostgreSQL en Supabase.
- Tarjetas o credenciales RFID/NFC tipo **Mifare Classic 1K**.

---

## 2. Configuración del Bus SPI

El lector RC522 se comunica con el procesador mediante el bus SPI (Serial Peripheral Interface). Para activarlo:

1. Abre la terminal de la Raspberry Pi:
   ```bash
   sudo raspi-config
   ```
2. Selecciona `3 Interface Options`.
3. Selecciona `I4 SPI`.
4. Elige `Yes` para habilitar el controlador del kernel SPI.
5. Sal del menú y reinicia si es solicitado:
   ```bash
   sudo reboot
   ```

---

## 3. Instalación de Dependencias

Ejecuta en la terminal de la Raspberry Pi:

```bash
# 1. Paquetes del sistema operativo
sudo apt update
sudo apt install -y python3-spidev python3-rpi-lgpio python3-pip git

# 2. Librería de lectura RFID
pip3 install mfrc522 --break-system-packages
```

---

## 4. Ejecución del Lector RFID

### Modo 1: Validación Normal en Tiempo Real
Lee las tarjetas físicas, consulta los permisos en Supabase y registra el acceso con su resultado:

```bash
python3 hardware/lector_rfid.py
# o directamente:
python3 lector_rfid.py
```

### Modo 2: Diagnóstico Local (Solo lectura de UID)
Prueba la antena y los transpondedores sin necesidad de conexión a internet ni Supabase:

```bash
python3 hardware/lector_rfid.py --uid
```

---

## 5. Medición de Tiempos y Rendimiento (< 3 segundos)

El sistema procesa la validación de la tarjeta en un hilo asíncrono para que el bucle de lectura nunca se congele. El tiempo promedio de respuesta obtenido en pruebas es de **110 a 160 milisegundos**, superando holgadamente la meta establecida de 3 segundos (RNF-007).
