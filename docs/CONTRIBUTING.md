# 🤝 Guía de Contribución y Estándares de Desarrollo

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**

---

## 1. Convenciones de Ramas (Git Flow Simplificado)

- **`main` / `master`:** Código en producción, estable y verificado.
- **`develop`:** Rama de integración continua de nuevas características.
- **Ramas de funcionalidad:** `feature/<nombre-de-la-funcionalidad>` (ej. `feature/modulo-torniquete-biblioteca`).
- **Ramas de corrección:** `fix/<nombre-del-bug>` (ej. `fix/timeout-websocket-firefox`).
- **Ramas de documentación:** `docs/<modulo>` (ej. `docs/manual-operacion-celador`).

---

## 2. Convenciones de Mensajes de Commit (Conventional Commits)

Los commits deben redactarse en español o inglés siguiendo el formato estándar:

```
<tipo>(<ámbito>): <descripción corta en imperativo>

[cuerpo explicativo opcional]
```

### Tipos Permitidos:
- **`feat:`** Nueva funcionalidad (ej. `feat(hardware): soporte para doble antena en Puerta Lateral`).
- **`fix:`** Corrección de un defecto o bug (ej. `fix(auth): corregir bucle de redirección en client.js`).
- **`docs:`** Cambios exclusivos en archivos de documentación Markdown (ej. `docs: actualizar casos de uso CU-001 a CU-010`).
- **`refactor:`** Reestructuración de código sin alterar su comportamiento externo.
- **`test:`** Incorporación o ajuste de pruebas automatizadas o de integración.
- **`style:`** Formateo de código, estilos CSS o paleta de colores.
- **`chore:`** Tareas de mantenimiento de paquetes, scripts o build tooling.

---

## 3. Estándares de Código y Directrices de Diseño

1. **Regla de Integridad de Nomenclatura:**
   - **PROHIBIDO:** Utilizar el acrónimo o término "SISV" en cualquier archivo, comentario, log o variable. La denominación oficial del proyecto es **Control de Acceso RFID Institucional**.
2. **Paleta de Interfaz Monocromática Oscura:**
   - Todo componente en React debe apegarse a las variables CSS de [`App.css`](file:///home/victormcl/Documents/RFID/frontend/src/App.css) (`var(--bg-primary)`, `var(--bg-secondary)`, `var(--border)`, `var(--text-primary)`).
   - Se deben evitar colores saturados brillantes (azules, púrpuras, rojos fluorescentes) salvo en estados de alerta estricta (`--status-granted` y `--status-denied`).
3. **Manejo Resiliente de Peticiones:**
   - Todo llamado HTTP desde el frontend debe realizarse mediante `apiClient` ([`frontend/src/api/client.js`](file:///home/victormcl/Documents/RFID/frontend/src/api/client.js)) para heredar automáticamente la tolerancia a fallos y los datos en memoria.
4. **Protección de Puertos y Controladores:**
   - Toda consulta a la base de datos en el backend debe envolverse en bloques `try...catch` con conmutación transparente a `memoryDb` para garantizar cero caídas.

---

## 4. Definición de Terminado (Definition of Done - DoD)

Una tarea, pull request o entrega se considera formalmente **Terminada (Done)** cuando:
- [x] El código compila sin errores ni advertencias (`npm run build` en `frontend`).
- [x] El servidor backend levanta limpiamente sin fallos de inicio (`node src/server.js`).
- [x] Se respetan las políticas de seguridad RBAC (alumnos y docentes no pueden ingresar a la consola web).
- [x] Se mantiene el tiempo de respuesta de validación por debajo de los 3 segundos.
- [x] Los casos de uso y la documentación técnica asociada han sido actualizados en la carpeta `docs/`.
