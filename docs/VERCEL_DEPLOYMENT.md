# 🚀 Guía Oficial de Despliegue en Vercel y Conexión de Hardware RFID

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**

---

## 1. Arquitectura de Despliegue en Vercel

El proyecto está diseñado bajo una arquitectura híbrida y modular que permite que la aplicación funcione en la nube a través de **Vercel** mientras tu PC o la Raspberry Pi interactúan con el hardware físico:

```mermaid
flowchart TD
    subgraph VercelCloud ["Nube de Vercel (https://tu-proyecto.vercel.app)"]
        Frontend["Frontend SPA (React 19 + Vite)"]
        ServerlessAPI["API Serverless Node.js (api/index.js)"]
        MemoryStore["Almacén Institucional de Datos"]
        Frontend <--> ServerlessAPI
        ServerlessAPI <--> MemoryStore
    end

    subgraph HardwareLocal ["Hardware Físico / Laboratorio / Portería"]
        RPi["Raspberry Pi 5 / CrowPi 3 (RC522 SPI)"]
        USBReader["Lector RFID USB de Escritorio"]
        LocalPC["Tu PC (Servidor de Pruebas opcional :4000)"]
    end

    RPi -->|"HTTP POST /api/access/validate"| ServerlessAPI
    USBReader -->|"Entrada directa teclado/wedge"| Frontend
    LocalPC -.->|"Túnel opcional (ngrok / localtunnel)"| Frontend
```

---

## 2. Archivos de Configuración para Vercel Incluidos en el Repositorio

1. **[`vercel.json`](file:///home/victormcl/Documents/RFID/vercel.json):** Configuración declarativa que indica a Vercel compilar el frontend hacia `dist` y redirigir todas las llamadas `/api/*` hacia la función serverless de Express:
   ```json
   {
     "version": 2,
     "rewrites": [
       { "source": "/api/(.*)", "destination": "/api/index.js" },
       { "source": "/((?!api/).*)", "destination": "/index.html" }
     ]
   }
   ```
2. **[`api/index.js`](file:///home/victormcl/Documents/RFID/api/index.js):** Puente que ejecuta la aplicación de Express ([`src/server/app.js`](file:///home/victormcl/Documents/RFID/src/server/app.js)) dentro del entorno Serverless de Vercel.

---

## 3. Paso a Paso para Desplegar en Vercel

### Paso 1: Subir los cambios a GitHub
Desde la terminal en tu computadora:

```bash
cd /home/victormcl/Documents/RFID
git add .
git commit -m "feat: configuracion oficial de despliegue en vercel + captura rfid"
git push origin main
```

### Paso 2: Crear el Proyecto en Vercel
1. Ingresa a [https://vercel.com](https://vercel.com) e inicia sesión con tu cuenta de **GitHub**.
2. Haz clic en el botón azul **"Add New..."** → **"Project"**.
3. En la lista de repositorios, localiza `VoctorMCL/RFID` (o tu fork correspondiente) y pulsa **"Import"**.

### Paso 3: Configuración del Proyecto (Project Settings)
Vercel leerá automáticamente el archivo `vercel.json`, pero verifica los siguientes campos:

* **Framework Preset:** `Vite`
* **Root Directory:** `./` *(la raíz del proyecto)*
* **Build Command:** `npm run build`
* **Output Directory:** `dist`
* **Install Command:** `npm install`

### Paso 4: Variables de Entorno (Opcional)
Si cuentas con base de datos PostgreSQL en la nube (ej. Supabase, Neon o Render):
* `DATABASE_URL`: `postgresql://usuario:pass@host:5432/rfid_db`
* `JWT_SECRET`: `rfid_secret_key_lasallista_2026`

> ℹ️ **Nota de Resiliencia:** Si no configuras ninguna variable de entorno, el backend arranca automáticamente con su **motor en memoria institucional** con todas las personas, tarjetas, aulas, horarios y puertas precargadas.

### Paso 5: Desplegar
Pulsa **"Deploy"**. En aproximadamente 1 minuto tendrás tu URL lista:
`https://rfid-delta.vercel.app` (o similar).

---

## 4. Cómo Hacer que Vercel Lea las Tarjetas RFID

Para que la página del **Escáner y Validación (`/monitor`)** desplegada en Vercel refleje las lecturas de tarjetas en tiempo real, tienes tres alternativas según el hardware que estés usando:

### Método 1: Con Lector RFID USB en tu PC o Laptop
Muchos lectores de escritorio RC522 o USB operan como *Keyboard Wedge* (emulan teclado USB):
1. Conecta el lector RFID por puerto USB a tu computadora.
2. Abre la URL de Vercel en tu navegador: `https://tu-proyecto.vercel.app/monitor`.
3. Inicia sesión como Celador (`celador` / `acceso2026`) o Administrador (`admin` / `acceso2026`).
4. **Pasa cualquier carnet o llavero por el lector físico:**
   * La página detecta automáticamente los caracteres y el fin de lectura (`Enter`).
   * Valida en el backend, emite el pitido sonoro, ejecuta la animación de vibración si es denegado y pone el sensor en **VERDE**.

---

### Método 2: Con Raspberry Pi 5 / CrowPi 3 apuntando a Vercel
Si estás usando el lector RC522 por bus SPI en la Raspberry Pi:
1. En la Raspberry Pi, ejecuta el script cliente apuntando a la URL pública de Vercel:
   ```bash
   python3 hardware/lector_rfid.py --server https://tu-proyecto.vercel.app/api/access/validate
   ```
2. Al aproximar una tarjeta a los pines SPI del CrowPi 3, el script enviará la petición HTTP POST a Vercel.
3. La página web abierta en Vercel cuenta con un **sistema de sondeo inteligente (polling de 1.5s)** que detecta inmediatamente el nuevo registro de acceso, mostrando el resultado en pantalla en < 2 segundos.

---

### Método 3: Con tu PC como Servidor de Pruebas y Túnel Seguro (ngrok)
Si prefieres que Vercel se comunique directamente con el servidor Node.js que corre en tu laptop:

1. **Inicia el servidor en tu laptop:**
   ```bash
   ./start.sh
   ```
2. **Abre un túnel seguro HTTPS con ngrok o localtunnel:**
   ```bash
   npx localtunnel --port 4000
   # o si tienes ngrok:
   ngrok http 4000
   ```
   Obtendrás una URL pública segura como: `https://tu-tunel.loca.lt` o `https://tu-id.ngrok-free.app`.

3. **Enlazar Vercel con tu PC:**
   * Abre tu página de Vercel (`https://tu-proyecto.vercel.app/monitor`).
   * En la caja del sensor, haz clic en el botón **"Enlace Servidor"**.
   * Escribe la URL de tu túnel con el sufijo `/api` (ej. `https://tu-tunel.loca.lt/api`).
   * Haz clic en **"Guardar y Recargar"**.
   * ¡Listo! Ahora tu página en Vercel se conecta en vivo a tu PC con WebSockets directos y latencia menor a 50 ms.

---

## 5. Solución al Error `EADDRINUSE: 0.0.0.0:4000`

Si al ejecutar `./start.sh` ves el error:
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:4000
```
Significa que una instancia anterior de Node.js quedó en segundo plano ocupando el puerto 4000.

**El script [`start.sh`](file:///home/victormcl/Documents/RFID/start.sh) fue actualizado para solucionarlo automáticamente.** Al ejecutarlo, ahora detecta y termina cualquier proceso residual en el puerto 4000 antes de iniciar:

```bash
./start.sh
```

Si deseas liberarlo manualmente en cualquier momento:
```bash
kill -9 $(lsof -ti :4000)
```

---

## 6. Verificación de Despliegue Exitoso en Vercel

| Ruta Web | Verificación Esperada |
|---|---|
| `https://tu-proyecto.vercel.app/` | Carga el Login institucional con tema gris oscuro |
| `https://tu-proyecto.vercel.app/health` | Retorna JSON `{ status: 'ok', system: 'Control de Acceso RFID Institucional' }` |
| `https://tu-proyecto.vercel.app/api/doors` | Retorna catálogo de puertas y estado de seguridad |
| `https://tu-proyecto.vercel.app/monitor` | Consola del escáner con indicador de sensor, sonido y vibración |
