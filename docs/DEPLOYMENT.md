# 🚀 Guía de Despliegue y Puesta en Producción

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**

---

## 1. Requisitos de Infraestructura y Software

### 1.1 Servidor Central o Raspberry Pi 5
- **Sistema Operativo:** Ubuntu Server 22.04 / 24.04 LTS o Raspberry Pi OS (Debian 12 Bookworm de 64 bits).
- **CPU:** Mínimo 2 núcleos (ARM Cortex-A76 en RPi 5 o x86-64).
- **Memoria RAM:** Mínimo 2 GB (4 GB recomendados).
- **Almacenamiento:** 16 GB de espacio libre (tarjeta MicroSD Clase 10 / SSD NVMe).
- **Red:** Conexión Ethernet cableada Gigabit o WiFi institucional en banda de 5 GHz.

### 1.2 Entorno de Ejecución
- **Node.js:** Versión `>= 20.10.0 LTS`.
- **NPM:** Versión `>= 10.0.0`.
- **Python:** Versión `>= 3.10` (con `python3-pip` y `python3-venv`).
- **PostgreSQL (Opcional):** Versión 15 o 16 (el sistema opera con o sin Postgres gracias a su fallback de resiliencia en memoria).

---

## 2. Variables de Entorno ([`backend/.env`](file:///home/victormcl/Documents/RFID/backend/.env))

El archivo de configuración se encuentra en `backend/.env`:

```ini
# Puerto del servidor HTTP y WebSockets
PORT=4000

# Conexión a Base de Datos PostgreSQL
DATABASE_URL=postgresql://victormcl:rfid2026@localhost:5432/rfid_db

# Seguridad y Criptografía JWT
JWT_SECRET=rfid_secret_key_lasallista_2026
JWT_EXPIRES_IN=24h

# Orígenes Permitidos para CORS
CORS_ORIGIN=http://localhost:5173

# Servicio de Correo Electrónico para Alarmas Críticas (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notificaciones@lasallista.edu.co
SMTP_PASS=tu_password_de_aplicacion
ALERT_EMAIL=vigilancia@lasallista.edu.co
```

---

## 3. Puesta en Marcha Rápida (Desarrollo y Demostración)

Desde la raíz del repositorio:

```bash
# 1. Otorgar permisos de ejecución
chmod +x start.sh setup-db.sh

# 2. Iniciar Backend y Frontend en paralelo
./start.sh
```

El script inicia simultáneamente:
- **Backend API REST + WebSockets:** `http://localhost:4000` (PID registrado).
- **Frontend SPA React 19:** `http://localhost:5173`.
- **Captura de Ctrl+C:** Al presionar `Ctrl+C`, el script termina ambos procesos de forma limpia.

---

## 4. Configuración de Base de Datos PostgreSQL

Si se desea utilizar PostgreSQL como motor persistente principal:

```bash
# 1. Ejecutar el script automatizado
sudo bash setup-db.sh
```

El script realiza:
1. Creación del rol `victormcl` con contraseña `rfid2026`.
2. Creación de la base de datos `rfid_db`.
3. Ejecución del esquema DDL [`backend/src/config/schema.sql`](file:///home/victormcl/Documents/RFID/backend/src/config/schema.sql).
4. Carga de los datos semilla institucionales [`backend/seeds/seed.sql`](file:///home/victormcl/Documents/RFID/backend/seeds/seed.sql).

---

## 5. Compilación del Frontend para Producción

Para compilar la aplicación React optimizada para producción:

```bash
cd frontend
npm run build
```
Los artefactos estáticos (HTML minificado, CSS purgado y bundles JS con gzip < 108 kB) se generan en la carpeta `frontend/dist/`.

---

## 6. Despliegue Permanente como Servicio de Sistema (`systemd`)

Para garantizar que el backend se inicie automáticamente tras reinicios del servidor o cortes de fluido eléctrico:

### 6.1 Crear el archivo de unidad de servicio:
```bash
sudo nano /etc/systemd/system/acceso-rfid.service
```

### 6.2 Contenido de la configuración:
```ini
[Unit]
Description=Ecosistema de Control de Acceso RFID Lasallista
After=network.target postgresql.service

[Service]
Type=simple
User=victormcl
WorkingDirectory=/home/victormcl/Documents/RFID/backend
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=4000

[Install]
WantedBy=multi-user.target
```

### 6.3 Habilitar y arrancar el servicio:
```bash
sudo systemctl daemon-reload
sudo systemctl enable acceso-rfid.service
sudo systemctl start acceso-rfid.service
sudo systemctl status acceso-rfid.service
```

---

## 7. Configuración de Proxy Inverso Nginx (Opcional para Red Institucional)

Para publicar el sistema en el puerto estándar 80 o con certificado SSL/TLS en el 443:

```nginx
server {
    listen 80;
    server_name acceso.lasallista.edu.co;

    # Frontend estático compilado
    location / {
        root /home/victormcl/Documents/RFID/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API REST Backend
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSockets en Tiempo Real
    location /ws {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }
}
```

---

## 8. Procedimiento de Rollback y Contingencia

1. **Fallo de Base de Datos:** Si PostgreSQL entra en estado de fallo, el backend conmuta automáticamente a memoria sin intervención manual.
2. **Reinicio de Emergencia:**
   ```bash
   sudo systemctl restart acceso-rfid.service
   ```
3. **Restauración de Datos Semilla:**
   ```bash
   psql -U victormcl -d rfid_db -f backend/seeds/seed.sql
   ```
