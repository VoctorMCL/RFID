# 🔧 Guía de Solución de Problemas (Troubleshooting)

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**

---

## Matriz Rápida de Diagnóstico

| Síntoma Observado | Causa Más Probable | Solución Rápida |
| :--- | :--- | :--- |
| **Caja en ROJO: "Sensor RFID No Detectado"** | Lector SPI desconectado o script Python inactivo. | Ejecutar `python3 hardware/lector_rfid.py` o pulsar "Comprobar Enlace". |
| **Bucle de regreso a `/login` al entrar** | Token corrupto en navegador o backend apagado. | Abrir consola (`F12`), `localStorage.clear()`, recargar y loguear. |
| **"NetworkError when attempting to fetch..."** | Backend no está corriendo en puerto 4000. | Verificar con `lsof -i :4000` y arrancar con `./start.sh`. |
| **"Firefox can't establish connection to ws://"** | Servicio WebSocket no inicializado en backend. | Reiniciar backend: `node src/server.js`. |
| **Acceso Concedido pero el electroimán no abre** | Falla de alimentación a 12V DC en la cerradura. | Revisar fuente del electroimán y cableado del relé. |
| **Alarma crítica sonando en Sala 1 sin cesar** | Intrusión detectada con sala armada. | Ir a `/alerts` en la consola web del celador y pulsar "Resolver Alarma". |

---

## 1. Síntoma: Sensor RFID en Rojo ("No Detectado")

### Diagnóstico en Raspberry Pi / CrowPi 3:
1. Verifique si el bus SPI está habilitado a nivel de kernel:
   ```bash
   ls -l /dev/spidev0.*
   ```
   Si no aparece `/dev/spidev0.0`, habilítelo con `sudo raspi-config` $\rightarrow$ `Interfacing Options` $\rightarrow$ `SPI` $\rightarrow$ `Yes` y reinicie la Raspberry Pi.
2. Compruebe si el script de lectura está en ejecución:
   ```bash
   ps aux | grep lector_rfid.py
   ```
   Si no está activo, inícielo:
   ```bash
   python3 hardware/lector_rfid.py --door 1
   ```
3. Verifique el cableado físico:
   - Asegúrese de que el pin `3.3V` del RC522 esté conectado al Pin 1 (3.3V) de la Raspberry Pi y **nunca a 5V**.
   - Compruebe la continuidad de los cables `SCK` (Pin 23), `MISO` (Pin 21) y `MOSI` (Pin 19).

---

## 2. Síntoma: El Sistema me Devuelve al Login ("Sesión Expirada")

### Explicación Técnica:
Ocurre cuando el navegador conserva un token antiguo o malformado en el almacenamiento local que es rechazado por el backend.

### Procedimiento de Resolución:
1. En el navegador web, presione `F12` para abrir las Herramientas de Desarrollador.
2. Vaya a la pestaña **Consola** (Console) y ejecute:
   ```javascript
   localStorage.clear();
   location.href = '/login';
   ```
3. Haga clic en el botón de acceso rápido **"Administrador"** o **"Celador / Guardia"**. El sistema generará una nueva sesión limpia y válida.

---

## 3. Síntoma: Falla de Conexión de Red o WebSockets (Puertos 4000 y 5173)

### Diagnóstico de Puertos en Linux:
1. Verifique si los puertos necesarios están escuchando:
   ```bash
   lsof -i :4000 -i :5173
   ```
2. Si el puerto 4000 no responde:
   ```bash
   cd /home/victormcl/Documents/RFID/backend
   node src/server.js
   ```
3. Si el puerto 5173 no responde:
   ```bash
   cd /home/victormcl/Documents/RFID/frontend
   npx vite --host 0.0.0.0 --port 5173
   ```
4. O inicie todo de forma orquestada con:
   ```bash
   ./start.sh
   ```

---

## 4. Síntoma: La Puerta no Abre Físicamente tras "Acceso Concedido"

### Verificación del Circuito de Potencia:
1. Compruebe si el relé hace el sonido de "clic" mecánico característico cuando el sistema aprueba la tarjeta.
2. Si el relé hace clic pero el electroimán no libera la puerta:
   - Mida con un multímetro la tensión en los bornes de la cerradura: debe registrar 12V DC en reposo y 0V DC durante los 5 segundos de apertura (contacto normalmente cerrado).
   - Compruebe que la fuente de poder de 12V 2A esté encendida.
3. Si el relé no hace clic:
   - Verifique que la señal de control esté conectada al `GPIO 2` del microcontrolador.
   - Verifique que la tierra (`GND`) de la fuente del relé esté unida a la tierra (`GND`) del ESP32.

---

## 5. Síntoma: Alarma Crítica Disparada en Sala de Informática 1

### Explicación:
La Sala de Informática 1 está protegida por un sistema de alarma perimetral. Si se abre la puerta principal o lateral sin que un vigilante haya pasado su Ficha Maestra o desarmado la sala previamente, la sirena física y virtual se bloquearán en modo de alerta.

### Procedimiento de Desarme y Restablecimiento:
1. Inicie sesión en la plataforma con el rol de **Celador** o **Administrador**.
2. Diríjase en la barra lateral a la opción **"Alarmas"** ([`/alerts`](http://localhost:5173/alerts)).
3. Localice la alerta activa que indica *"🚨 ALERTA CRÍTICA: Intento de apertura no autorizada..."*.
4. Haga clic en el botón **"Resolver Alarma"**.
5. Escriba una nota descriptiva de la verificación (ej. *"Comprobación visual realizada por seguridad"*).
6. Al confirmar, la sirena física en el laboratorio se apagará de inmediato y la sala volverá a su estado normal de operación.

---

## 6. Síntoma: Aviso de PostgreSQL no Conectado en Consola

```
⚠️ PostgreSQL no conectado (ejecute setup-db.sh para configurarlo).
🔄 Activando modo Storage en Memoria con datos institucionales completos.
```

### ¿Es esto un error grave?
**No.** El sistema fue diseñado con una arquitectura de alta disponibilidad. Cuando este mensaje aparece, el servidor conmuta de manera transparente a su almacén en memoria RAM (`memoryDb`) precargado con todas las salas, docentes, estudiantes y tarjetas de prueba. El sistema continuará funcionando al 100%.

### Si desea aprovisionar la base de datos PostgreSQL local:
```bash
sudo bash setup-db.sh
```
El script creará automáticamente el rol `victormcl`, la base de datos `rfid_db` y cargará todas las tablas y datos semilla.
