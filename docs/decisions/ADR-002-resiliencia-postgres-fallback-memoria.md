# ADR-002: Resiliencia con Base de Datos PostgreSQL y Fallback Transparente en Memoria

## Status
Aceptada

## Fecha
2026-09-18

## Contexto
El control de acceso físico en torniquetes y laboratorios universitarios es una operación de misión crítica: si la base de datos se congela, se reinicia o pierde conexión de red, **las puertas no pueden quedar bloqueadas ni los estudiantes pueden quedar varados en la portería**.

En entornos de pruebas, ferias de proyectos y salas de clase, no siempre se dispone de un servidor PostgreSQL previamente configurado con credenciales de superusuario o conectividad constante.

## Decisión
Diseñar una arquitectura de datos de **Doble Motor (Dual Engine)** con conmutación transparente:
1. **Motor Primario (PostgreSQL 16):** Persistencia relacional formal con índices B-Tree, integridad referencial y soporte transaccional completo (`rfid_db`).
2. **Motor Secundario (In-Memory Store):** Estructura en memoria RAM precargada (`memoryDb` en `db.js`) con los datos institucionales completos (Bloques A-D, Salas 1-6, puertas, usuarios de demostración, horarios y tarjetas).
3. **Conmutación Silenciosa:** Todo método del controlador envuelve las consultas de PostgreSQL en bloques `try...catch`. Si la consulta a Postgres falla o el pool no puede conectarse, el sistema conmuta automáticamente a memoria (`db.setUseMemory(true)`), respondiendo la validación de acceso en menos de 20 milisegundos sin arrojar errores `500` ni interrumpir la sesión del celador.

## Alternativas Consideradas

### Base de Datos Exclusiva en PostgreSQL sin Fallback
- **Ventajas:** Código más simple al asumir que la base de datos siempre existe.
- **Desventajas:** Cualquier error de autenticación, puerto ocupado o caída del servicio detiene de inmediato el torniquete físico y genera errores en la pantalla del guardia.
- **Rechazado:** Inaceptable para un sistema de acceso físico en tiempo real.

### SQLite en Archivo Local
- **Ventajas:** No requiere servicio daemon de base de datos.
- **Desventajas:** Problemas de concurrencia y bloqueos de archivo (`database is locked`) al recibir escrituras simultáneas de múltiples puertas por segundo; incompatibilidad con extensiones de red centralizada.
- **Rechazado:** No escala de forma natural cuando múltiples microcontroladores escriben logs concurrentemente.

## Consecuencias
- El sistema funciona "de fábrica" inmediatamente tras clonar el repositorio, incluso antes de ejecutar `setup-db.sh`.
- Los datos modificados en modo memoria se conservan durante el ciclo de vida del proceso de Node.js, y se consolidan en PostgreSQL cuando este se encuentra conectado.
