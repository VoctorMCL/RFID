# ADR-001: Arquitectura Desacoplada SPA (React 19 + Vite) y Backend (Node.js + WebSockets)

## Status
Aceptada

## Fecha
2026-09-10

## Contexto
El sistema de control de acceso institucional requiere actualizar en tiempo real el monitor del personal de portería cuando los estudiantes y profesores aproximan su carnet en los torniquetes o puertas de laboratorios. Se evaluó si desarrollar una aplicación monolítica con Server-Side Rendering (SSR) o una arquitectura desacoplada basada en Single Page Application (SPA) con una API REST y un canal persistente de WebSockets.

Requisitos críticos:
- Latencia de refresco visual en pantalla menor a 3 segundos tras la lectura RFID.
- Capacidad de operar interfaces gráficas locales en la estación del celador (Raspberry Pi / PC) mientras el backend se ejecuta en un servidor local o centralizado.
- Facilidad de integración de microcontroladores (ESP32) que transmiten vía HTTP POST directo.

## Decisión
Implementar una arquitectura desacoplada:
1. **Frontend:** React 19 empaquetado con Vite 8 en el puerto 5173, utilizando `useWebSocket` para telemetría instantánea y componentes desacoplados.
2. **Backend:** Node.js con Express 4.21 y el módulo `ws` en el puerto 4000, unificando la API REST para los microcontroladores y el canal de difusión WebSocket hacia los monitores de celaduría.

## Alternativas Consideradas

### Monolito SSR (Next.js / Astro)
- **Ventajas:** Un solo proyecto y despliegue unificado.
- **Desventajas:** Mayor complejidad para mantener conexiones WebSockets puras de larga duración multiplexadas en servidores locales o microcontroladores embebidos; sobrecarga de runtime innecesaria para un panel de seguridad privado.
- **Rechazado:** El desacoplamiento permite que los microcontroladores ESP32 hablen con la API REST sin pasar por capas de renderizado de vistas.

### Arquitectura de Microservicios Distribuidos
- **Ventajas:** Aislamiento extremo de cada puerta y servicio de autenticación.
- **Desventajas:** Sobrediseño masivo para el alcance de un campus universitario; complejidad de orquestación y mayor consumo de recursos en hardware modesto (Raspberry Pi).
- **Rechazado:** La arquitectura de capas desacopladas pero cohesionadas en un backend liviano cubre el 100% de los requerimientos con mínimo consumo de CPU y memoria.

## Consecuencias
- Se requiere gestionar la comunicación entre puertos (`5173` y `4000`) en desarrollo, resuelta mediante el proxy inverso integrado en `vite.config.js`.
- La orquestación de arranque se simplifica con el script unificado `start.sh`.
- El frontend puede compilarse como archivos estáticos (`npm run build`) y servirse desde cualquier servidor web estático o CDN local.
