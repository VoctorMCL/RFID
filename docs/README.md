# 📚 Índice de Documentación — Control de Acceso RFID Institucional

Documentación técnica, arquitectónica y de usuario del **Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional** de la **Corporación Universitaria Lasallista (Caldas, Antioquia)**.

---

## 🗺️ Mapa de Documentación

| Documento | Para quién | Qué contiene |
| :--- | :--- | :--- |
| [👤 Manual de Usuario](./USER_MANUAL.md) | Celadores, Administradores | Guía paso a paso: ingreso web, monitor en vivo, enrolamiento, asignación de horarios, gestión de alarmas. |
| [📖 README Principal](../README.md) | Todos (puerta de entrada) | Visión global, características clave, arquitectura rápida, stack tecnológico, arranque con `./start.sh`. |
| [🏛️ Arquitectura del Sistema](./ARCHITECTURE.md) | Arquitectos, Evaluadores | Modelo de 4 capas (C4), flujo de validación, escalabilidad modular de campus, WebSockets y resiliencia. |
| [📑 Especificación de Requisitos (SRS)](./REQUIREMENTS.md) | Analistas, Docentes, PO | Requisitos de Usuario (RU), Funcionales (RF-001..018) y No Funcionales (RNF-001..016) con matriz de trazabilidad. |
| [🎯 Casos de Uso](./USE_CASES.md) | Desarrolladores, QA | CU-001 a CU-010 detallados con actores, precondiciones, flujos principales, alternos y postcondiciones. |
| [📋 Historias de Usuario](./USER_STORIES.md) | Product Owner, Scrum Team | US-001 a US-012 categorizadas por rol institucional (Admin, Celador, Rectoría, Profesor, Estudiante). |
| [🗄️ Base de Datos y Persistencia](./DATABASE.md) | DBAs, Desarrolladores | Modelo relacional PostgreSQL, 10 entidades, diagrama ER en Mermaid, índices, triggers y fallback en memoria. |
| [📖 Diccionario de Datos](./DATA-DICTIONARY.md) | DBAs, Integradores | Especificación exhaustiva campo por campo de todas las tablas con tipos, restricciones y valores de ejemplo. |
| [📡 Referencia de Endpoints API](./ENDPOINTS.md) | Integradores, Frontend | Documentación de rutas REST (`/api/*`), payloads JSON, códigos de respuesta, comandos `curl` y eventos WebSocket. |
| [🔐 Autenticación y RBAC](./AUTH.md) | Seguridad, Devs | Jerarquía de roles, JWT seguro, restricción de acceso web (solo Admin y Celador), bloqueo a estudiantes y bcrypt. |
| [🛡️ Seguridad Física y Alarmas](./SECURITY.md) | Seguridad, Mantenimiento | Protocolo de alarma en Sala de Informática 1, fichas maestras, notificación por correo y Ley 1581 de 2012. |
| [🔌 Integración de Hardware](./HARDWARE.md) | Técnicos de Hardware, IoT | Lector MFRC522 (13.56 MHz), conexión SPI en Raspberry Pi 5 / CrowPi 3, firmware ESP32 con relé y buzzer. |
| [🚀 Despliegue y Operación](./DEPLOYMENT.md) | DevOps, SysAdmins | Puesta en producción, configuración de variables `.env`, scripts `start.sh` y `setup-db.sh`, servicio systemd. |
| [🔄 Diagramas de Secuencia](./SEQUENCE_DIAGRAMS.md) | Desarrolladores, Arquitectos | SD-001 a SD-004 en Mermaid: validación exitosa, denegación horaria, alarma crítica y login web. |
| [⚡ Diagramas de Actividad](./ACTIVITIES.md) | Analistas, QA | AD-001 a AD-003 en Mermaid: motor de decisión de acceso, enrolamiento de tarjetas y ciclo de vida de alertas. |
| [📐 Diagramas UML](./UML.md) | Evaluadores, Docentes | Diagrama de clases del dominio y diagrama de componentes del sistema en Mermaid. |
| [🧪 Plan de Pruebas y QA](./TESTING.md) | QA, Evaluadores | Casos de prueba E2E, validación de latencia (< 3 s), simulación de cortes de red y checklist de release. |
| [🔧 Solución de Problemas](./TROUBLESHOOTING.md) | Soporte técnico, Operarios | Guía de diagnóstico rápido ante fallas de lectura RFID, alertas de sensor desconectado, caídas de red y DB. |
| [📖 Glosario de Términos](./GLOSSARY.md) | Todos | Definición de conceptos clave: UID, Mifare, SPI, Electroimán, Articulación Horaria, Ficha Maestra. |
| [📜 Historial de Cambios](./CHANGELOG.md) | Todos | Registro cronológico de versiones y mejoras implementadas desde v1.0.0 a v2.0.0. |
| [🤝 Guía de Contribución](./CONTRIBUTING.md) | Equipo de Desarrollo | Estándares de código, convenciones de Git, creación de ramas y definición de terminado (DoD). |
| [🏛️ Registro de Decisiones (ADR)](./decisions/) | Arquitectos, Evaluadores | ADR-001 al ADR-006: Justificación técnica de las decisiones de diseño arquitectónico y tecnológico. |

---

## 🏛️ Contexto Institucional
- **Institución:** Corporación Universitaria Lasallista — Caldas, Antioquia.
- **Programa:** Ingeniería de Software / Facultad de Ingenierías.
- **Asignatura:** Proyecto de Ingeniería de Software.
- **Periodo Académico:** 2026-2.
- **Prototipo Físico Inicial:** Sala de Informática 1 (2 puertas inteligentes, sensores de movimiento y puerta, alarma integrada).
