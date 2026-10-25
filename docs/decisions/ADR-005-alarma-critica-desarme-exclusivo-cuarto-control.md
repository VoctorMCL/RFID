# ADR-005: Alarma Crítica en Sala de Informática 1 con Desarme Exclusivo desde Seguridad

## Status
Aceptada

## Fecha
2026-10-15

## Contexto
El piloto físico del proyecto se despliega en la **Sala de Informática 1**, la cual alberga equipos de cómputo de alto valor y cuenta con dos puertas (Puerta Principal que da al pasillo del Bloque A, y Puerta Lateral que comunica con el Taller de Ingeniería). 

Se requería un protocolo de alarma estricto que evitara que un intruso pudiera forzar la puerta, silenciar la alarma localmente con un botón en la pared y sustraer equipos sin que el centro de control se enterara.

## Decisión
1. **Lógica de Alarma Integrada:** Si la sala está en estado armado (`security_status = 'armed'`) y se detecta una apertura física o lectura denegada sin aviso previo a seguridad, el sistema conmuta la sala a `security_status = 'alert'` y dispara una **alarma crítica**.
2. **Desarme Restringido al Cuarto de Control:**
   - La alarma activa el buzzer en el microcontrolador local y envía una alerta visual y sonora titilante a la consola web de los celadores.
   - **La alarma ÚNICAMENTE se puede desarmar desde la interfaz web del celador** en la ruta `/alerts` mediante el endpoint `POST /api/alerts/:id/resolve`.
   - El celador debe ingresar obligatoriamente una nota de inspección antes de que el servidor ordene al hardware apagar el buzzer.
3. **Excepción por Ficha Maestra:** Si un vigilante aproxima su Ficha Maestra (`card_type == 'master'`), la alarma se suspende automáticamente para permitir la ronda de inspección sin generar pánico.

## Consecuencias
- Se asegura que cualquier incidente de intrusión requiera la verificación presencial y la firma digital de un guardia de seguridad en el sistema de auditoría.
- No existen botones físicos de pánico o silenciamiento dentro del laboratorio que puedan ser saboteados.
