# 🔄 Diagrama de Actividades UML

**Proceso:** Ingreso peatonal mediante RFID/NFC con validación visual en tiempo real  
**Fuente:** Figura 1 del Documento de Especificación del Proyecto (Lasallista, 2026-2)

```mermaid
flowchart TD
    START([● Inicio]) --> ACERCA[La persona acerca el carnet al lector NFC]
    ACERCA --> CAPTURA[El lector captura el UID de la tarjeta]
    CAPTURA --> CONSULTA[El sistema consulta el UID en la base de datos PostgreSQL]
    
    CONSULTA --> COND_REG{¿UID registrado?}
    
    %% Si NO está registrado
    COND_REG -- No --> REG_NO_REG[Registrar intento: denegado_no_registrado]
    REG_NO_REG --> SHOW_DENIED[Mostrar Acceso denegado con vibración y alertar al celador]
    
    %% Si SÍ está registrado
    COND_REG -- Sí --> COND_ACT{¿Tarjeta activa?}
    
    %% Si NO está activa
    COND_ACT -- No --> REG_REV[Registrar intento: denegado_revocado]
    REG_REV --> SHOW_DENIED
    
    %% Si SÍ está activa
    COND_ACT -- Sí --> COND_VIG{¿Acceso vigente?}
    
    %% Si NO está vigente (expirada)
    COND_VIG -- No --> REG_EXP[Registrar intento: denegado_expirado]
    REG_EXP --> SHOW_DENIED
    
    %% Si SÍ está vigente -> ACCIONES EN PARALELO
    COND_VIG -- Sí --> PARALELO_REG[Registrar acceso: permitido]
    COND_VIG -- Sí --> PARALELO_FOTO[Mostrar en pantalla al celador la foto y datos del titular]
    
    PARALELO_REG --> COND_CELADOR{¿El celador confirma que la persona coincide?}
    PARALELO_FOTO --> COND_CELADOR
    
    COND_CELADOR -- Sí --> LIBERAR[Liberar el torniquete: permitir el paso]
    COND_CELADOR -- No --> NEGAR[Denegar el paso físicamente y notificar al personal]
    
    LIBERAR --> END([◉ Fin])
    NEGAR --> END
    SHOW_DENIED --> END
```
