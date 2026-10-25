# ADR-004: Mapeo Dinámico de la Infraestructura del Campus (Cero Hardcoding)

## Status
Aceptada

## Fecha
2026-10-10

## Contexto
Los sistemas de control de acceso convencionales a menudo programan de forma fija (hardcodeada) las puertas en el código fuente (ej. `if (door == 1) ...`). Esto impide que el software escale a otras universidades o que la institución pueda añadir nuevos laboratorios, bloques o puertas sin tener que contratar desarrolladores para modificar el código.

## Decisión
Implementar un modelo relacional dinámico de 3 niveles:
- **`blocks` (Bloques):** Edificios o pabellones institucionales.
- **`rooms` (Salas / Laboratorios):** Espacios físicos pertenecientes a un bloque, con metadatos de piso, tipo de aula y seguridad (alarmas y sensores).
- **`doors` (Puertas Inteligentes):** Dispositivos físicos con IP y MAC address vinculados a una sala.

El frontend incorpora una interfaz visual de gestión en `/map` ("Mapa Institucional") que permite a los directores del campus crear, editar y estructurar salas y puertas en caliente. El motor de validación RFID (`accessController.js`) resuelve las consultas relacionando dinámicamente el `door_id` con su sala y bloque.

## Consecuencias
- Cero código hardcodeado: las puertas y salas se crean y se eliminan desde la base de datos y la interfaz gráfica.
- El software es universal y aplicable a cualquier institución educativa o corporativa con diferentes mapas edilicios.
