# Acceso — Control de Acceso Peatonal RFID con Validación Visual

<p>
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Raspberry%20Pi-A22846?style=for-the-badge&logo=raspberrypi&logoColor=white" alt="Raspberry Pi">
  <img src="https://img.shields.io/badge/RFID-MFRC522-6b7280?style=for-the-badge" alt="RFID MFRC522">
  <img src="https://img.shields.io/badge/UML-PlantUML-blue?style=for-the-badge" alt="PlantUML">
</p>

Prototipo de control de acceso peatonal para la **Corporación Universitaria Lasallista** que combina lectura de tarjetas RFID con una capa de verificación visual, para reducir el tiempo de ingreso sin sacrificar seguridad frente a la suplantación de identidad.

## Contenido

- [Problema que resuelve](#problema-que-resuelve)
- [Cómo funciona](#cómo-funciona)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Puesta en marcha](#puesta-en-marcha)
- [Contexto académico](#contexto-académico)

## Problema que resuelve

El ingreso peatonal actual depende de autenticación biométrica por huella, que es lenta en horas de alta afluencia. Reemplazar la huella por un carnet RFID agiliza el ingreso, pero abre el riesgo de suplantación mediante préstamo o clonación de tarjeta. Este proyecto resuelve ese riesgo mostrando en pantalla, en tiempo real, la foto y los datos de la persona registrada a cada tarjeta, para que el personal de seguridad confirme visualmente la coincidencia sin detener la fila.

## Cómo funciona

1. El estudiante, docente o visitante acerca su carnet al lector RFID (MFRC522) en el torniquete.
2. El sistema lee el UID de la tarjeta y lo valida contra la base de datos en tiempo real.
3. La pantalla muestra el resultado: foto, nombre y estado (permitido / denegado) para verificación visual del celador.
4. Cada intento —exitoso o no— queda registrado en el historial de accesos para auditoría.

## Stack tecnológico

| Capa | Tecnología | Uso |
|---|---|---|
| Hardware de prueba | Raspberry Pi (CrowPi 3) + lector RFID MFRC522 | Lectura de tarjetas Mifare Classic 1K |
| Base de datos | PostgreSQL | Modelo relacional de personas, tarjetas, torniquetes y accesos |
| Backend as a Service | Supabase | API REST automática sobre PostgreSQL, sin servidor propio |
| Frontend | HTML, CSS y JavaScript vanilla | Panel de escáner, administración e historial |
| Documentación técnica | PlantUML | Diagrama de clases UML del sistema |

## Estructura del proyecto

```
├── index.html                              # Panel principal (escáner, personas, tarjetas, torniquetes, historial)
├── landing.html                            # Landing page de presentación del proyecto
└── README.md
```

## Puesta en marcha

1. Abre `index.html` en el navegador — no requiere instalación ni servidor, es un archivo estático.
2. Para simular lecturas sin un lector físico conectado, usa el panel "Simular lectura" dentro de la pestaña Escáner.
3. Si tienes un lector RFID USB tipo teclado conectado, simplemente acerca una tarjeta con la pestaña Escáner abierta: el UID se captura automáticamente.

## Contexto académico

Proyecto desarrollado por **Victor Manuel Cordoba Larez** para la asignatura a cargo del docente **Feibert Alirio Guzmán Pérez**, Corporación Universitaria Lasallista, Caldas — Antioquia (2026-2). Prototipo académico; no representa una instalación de seguridad certificada para producción.
