# ADR-006: Paleta Monocromática Técnica en Grises y Animación de Vibración

## Status
Aceptada

## Fecha
2026-10-20

## Contexto
Los puestos de control de seguridad y porterías universitarias operan frecuentemente en turnos nocturnos o en garitas con iluminación tenue. Las interfaces convencionales llenas de colores azules, morados o degradados brillantes generan fatiga visual extrema ("fatiga por pantallas") y hacen que el vigilante pierda atención.

Además, cuando un celador está revisando mochilas o hablando con un visitante, no siempre está fijando la mirada en el monitor en el milisegundo exacto en que alguien pasa un carnet no autorizado.

## Decisión
1. **Paleta Monocromática Oscura Estricta:**
   - La totalidad de la interfaz de usuario de React se diseña en una escala estricta de tonos grises técnicos (`#121214`, `#1a1a1e`, `#222227`, `#2b2b32`, `#34343d`), libre de azules, violetas o colores saturados distractores.
   - Los únicos acentos de color permitidos se reservan para los estados operacionales: verde sobrio para acceso autorizado y rojo sobrio para denegación/alerta.
2. **Animación de Vibración Visual y Háptica:**
   - Ante cualquier acceso denegado o error de autenticación, la interfaz ejecuta una animación CSS de sacudida lateral (`@keyframes vibrate-shake`) sobre la tarjeta de datos.
   - En dispositivos móviles o terminales táctiles con motor de vibración, el sistema activa la API nativa `navigator.vibrate([120, 60, 120, 60, 200])` para alertar físicamente al guardia al tacto.

## Consecuencias
- Ambiente de trabajo ergonómico y profesional para el personal de portería.
- Detección inmediata e inequívoca de intentos de intrusión mediante estímulos visuales, sonoros y hápticos coordinados.
