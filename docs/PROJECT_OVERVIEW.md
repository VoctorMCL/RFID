# Guía de orientación del proyecto

## Propósito

RFID es una plataforma de control de acceso físico para la Corporación
Universitaria Lasallista. Integra lectores RFID, validación de permisos,
registro de auditoría, monitoreo en tiempo real y una consola web para
administradores y personal de seguridad.

El sistema combina tres superficies:

- **Consola web:** SPA React para autenticación, monitoreo, administración
  institucional, tarjetas, horarios, alertas y reportes.docs
- **API y tiempo real:** backend Express con endpoints REST y WebSocket para
  validar accesos, recibir heartbeats y notificar lecturas o alarmas.
- **Dispositivos físicos:** firmware ESP32 y lector Python para Raspberry
  Pi/CrowPi 3 con MFRC522.

## Arquitectura actual

```text
Lector RFID (ESP32 o Raspberry Pi)
              |
              | POST /api/access/validate
              v
Express + WebSocket (:4000)
       |                 |
       |                 +--> eventos de lecturas y alarmas
       v
PostgreSQL / Supabase
       ^
       |
React + Vite (dist/ o :5173)
```

### Backend

`src/server/server.js` crea el servidor HTTP y WebSocket. La aplicación
Express está en `src/server/app.js`, donde se configuran Helmet, CORS,
limitación de solicitudes, archivos estáticos y manejo de errores.

Las rutas se centralizan en `src/server/routes/index.js` y delegan la lógica a
controladores. Los grupos principales son:

| Grupo | Responsabilidad |
| --- | --- |
| `/auth` | Login RFID, sesión web, consulta del usuario y logout |
| `/access` | Validación de tarjetas, logs, estadísticas y analítica |
| `/doors` | Puertas, desbloqueo autorizado y heartbeat de lectores |
| `/rfid-cards` | Enrolamiento, actualización y desactivación de tarjetas |
| `/users`, `/roles` | Personas y roles de la plataforma |
| `/blocks`, `/rooms`, `/schedules` | Mapa institucional y articulación horaria |
| `/visitor-passes` | Pases temporales y devolución de tarjetas |
| `/alerts` | Alertas críticas, resolución y desarme de salas |

La autenticación web usa JWT y `X-Device-Id` para asociar la sesión al puesto
de trabajo. Las funciones de autorización se encuentran en
`src/server/middleware/auth.js`.

### Frontend

`src/client/main.jsx` monta la aplicación y `src/client/App.jsx` define las
rutas. `AuthContext` mantiene la sesión y `ProtectedRoute` aplica el control
de acceso por rol. Las páginas principales son:

- `/monitor`: lecturas RFID y estado del sensor.
- `/logs`: auditoría de accesos.
- `/rfid-cards`: gestión de credenciales.
- `/dashboard`, `/map`, `/users`, `/schedules` y `/alerts`: funciones
  administrativas protegidas.

Las llamadas HTTP pasan por `src/client/api/client.js`. La URL puede
configurarse con `VITE_API_URL` o mediante `rfid_api_url` en el navegador.
Los eventos en vivo se manejan en `src/client/hooks/useWebSocket.js`.
La pantalla `/login` solo autentica lecturas del lector local (incluido un
lector USB que actúa como teclado); no consume lecturas RFID globales de
otras puertas o Raspberry Pi, para evitar iniciar sesión accidentalmente en
otro equipo.

### Persistencia

El esquema y la configuración de PostgreSQL están en
`src/server/config/schema.sql`. Para Supabase se mantiene una definición
independiente en `supabase_schema.sql`, con datos iniciales en
`seed-supabase.js`. Las semillas locales están en `src/server/seeds/seed.sql`.

## Puesta en marcha

### Requisitos

- Node.js compatible con las dependencias del proyecto.
- PostgreSQL local o una instancia Supabase.
- Variables de entorno configuradas en `.env` (no se deben versionar).
- Python 3 y dependencias de `hardware/requirements-pi.txt` únicamente si se
  conecta un lector Raspberry Pi/CrowPi.

### Desarrollo

```bash
npm install
npm run dev
```

En otra terminal, para levantar la API:

```bash
npm run dev:server
```

### Servidor unificado

Para compilar el frontend y servirlo junto con la API en el puerto 4000:

```bash
npm run build
npm start
```

También se puede usar `./start.sh`; el script comprueba `dist/`, inicia el
backend y, con `--dev`, levanta Vite en el puerto 5173.

### Comprobación básica

```bash
curl http://localhost:4000/health
```

La respuesta de salud permite distinguir un problema de arranque del servidor
de un problema de autenticación o de conexión a la base de datos.

## Flujo de una lectura RFID

1. El lector obtiene el UID de la tarjeta y el identificador de la puerta.
2. El dispositivo envía `POST /api/access/validate`.
3. `accessController` comprueba la tarjeta, el usuario, la puerta y las
   restricciones horarias.
4. El backend registra el resultado en los logs de acceso.
5. El evento se publica al monitor mediante WebSocket.
6. Si corresponde, el dispositivo acciona el relé o la alarma.

El lector Raspberry Pi también envía un heartbeat periódico a
`POST /api/doors/:id/heartbeat`. El firmware ESP32 contiene la lógica
equivalente para operación autónoma por puerta.

## Integración de hardware

- **ESP32:** `hardware/esp32_rfid_firmware.ino`; comunicación Wi-Fi y SPI,
  lector MFRC522, relé, buzzer y LED.
- **Raspberry Pi/CrowPi:** `hardware/lector_rfid.py`; lectura SPI y envío HTTP.
- **Diagnóstico:** `python3 hardware/lector_rfid.py --uid` y
  `python3 hardware/lector_rfid.py --test-buzzer`.

El pinout, las librerías y las advertencias eléctricas están documentados en
`hardware/README.md` y `docs/HARDWARE.md`.

## Dónde continuar

| Necesidad | Documento |
| --- | --- |
| Entender decisiones técnicas | `docs/decisions/` |
| Integrar otro cliente | `docs/ENDPOINTS.md` |
| Modificar tablas o semillas | `docs/DATABASE.md` |
| Preparar producción | `docs/DEPLOYMENT.md` y `docs/VERCEL_DEPLOYMENT.md` |
| Operar lectores físicos | `hardware/README.md` |
| Ejecutar QA | `docs/TESTING.md` |
| Resolver incidentes | `docs/TROUBLESHOOTING.md` |

Antes de cambiar un comportamiento arquitectónico, actualizar el ADR
correspondiente o crear uno nuevo siguiendo `docs/CONTRIBUTING.md`.
