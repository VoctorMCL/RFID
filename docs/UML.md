# 📐 Diagramas UML del Sistema

## Ecosistema Inteligente de Control de Acceso RFID y Monitoreo Institucional
**Corporación Universitaria Lasallista — Caldas, Antioquia**

---

## 1. Diagrama de Clases del Dominio (Mermaid)

Modelado orientado a objetos de las entidades del ecosistema institucional, sus relaciones de agregación y los controladores centrales del negocio.

```mermaid
classDiagram
    class Role {
        +int id
        +string name
        +string display_name
        +boolean global_access
        +string description
        +isAuthorizedForWeb() boolean
    }

    class User {
        +int id
        +string first_name
        +string last_name
        +string email
        +string password_hash
        +string document_id
        +string program
        +string status
        +getFullName() string
        +hasValidExpiry() boolean
    }

    class RFIDCard {
        +int id
        +string uid
        +int user_id
        +string card_type
        +boolean is_active
        +string label
        +isMaster() boolean
        +revoke() void
    }

    class Block {
        +int id
        +string name
        +string description
        +string location_info
        +boolean is_active
        +getRoomsCount() int
    }

    class Room {
        +int id
        +int block_id
        +string name
        +int floor
        +string room_type
        +boolean has_alarm
        +string security_status
        +armAlarm() void
        +disarmAlarm() void
    }

    class Door {
        +int id
        +int room_id
        +string name
        +string door_type
        +string hardware_ip
        +string mac_address
        +string status
        +boolean is_locked
        +unlockForSeconds(int seconds) void
    }

    class Schedule {
        +int id
        +int user_id
        +int room_id
        +int day_of_week
        +time start_time
        +time end_time
        +string subject_name
        +isCurrentTimeWithin() boolean
    }

    class AccessLog {
        +int id
        +int user_id
        +int door_id
        +string rfid_uid_raw
        +timestamp timestamp
        +string access_method
        +boolean granted
        +string denial_reason
    }

    class Alert {
        +int id
        +int door_id
        +int room_id
        +string severity
        +string message
        +boolean is_resolved
        +int resolved_by
        +resolve(int userId, string note) void
    }

    class AccessValidationEngine {
        +validateAccess(string uid, int doorId) ValidationResult
        -checkSchedule(User user, Room room) boolean
        -evaluateAlarmState(Room room, boolean granted) void
    }

    class WsService {
        +init(httpServer) void
        +broadcast(string event, object payload) void
    }

    %% Relaciones de Dominio
    Role "1" -- "0..*" User : clasifica a
    User "1" -- "0..*" RFIDCard : posee
    User "1" -- "0..*" Schedule : tiene asignado
    User "1" -- "0..*" AccessLog : genera

    Block "1" *-- "1..*" Room : contiene
    Room "1" *-- "1..*" Door : tiene instaladas
    Room "1" -- "0..*" Schedule : hospeda
    Room "1" -- "0..*" Alert : registra
    Door "1" -- "0..*" AccessLog : audita

    AccessValidationEngine ..> User : consulta
    AccessValidationEngine ..> RFIDCard : verifica
    AccessValidationEngine ..> Schedule : evalua
    AccessValidationEngine ..> AccessLog : persiste
    AccessValidationEngine ..> WsService : emite telemetria
```

---

## 2. Diagrama de Componentes del Sistema

Representa la modularidad de los subsistemas y los protocolos de comunicación que los interconectan.

```mermaid
graph LR
    subgraph FrontendComponent ["Componente de Presentación (React 19)"]
        UI_Login["Módulo Login & Auth"]
        UI_Monitor["Módulo Escáner en Vivo"]
        UI_Map["Módulo Mapa de Campus"]
        UI_Alerts["Módulo de Alarmas"]
        ApiClient["Cliente API REST (client.js)"]
        WsHook["useWebSocket Hook"]
    end

    subgraph BackendComponent ["Componente de Servicios API (Node.js / Express)"]
        RESTRouter["Enrutador REST (/api)"]
        JWTMiddleware["Middleware JWT Guard"]
        ValEngineComponent["Motor de Validación RFID"]
        AlarmComponent["Gestor de Alarmas Críticas"]
        WSServerComponent["Servidor WebSocket (:4000)"]
    end

    subgraph PersistenceComponent ["Componente de Persistencia"]
        PGDriver["Driver pg (Node-Postgres)"]
        PGDatabase[("PostgreSQL rfid_db")]
        MemoryFallback["Almacén en Memoria de Resiliencia"]
    end

    subgraph HardwareComponent ["Componente Edge / Lector Físico"]
        ESP32Firmware["Firmware C++ (esp32_rfid_firmware.ino)"]
        PythonReader["Daemon Python (lector_rfid.py)"]
        RC522Chip["Transceptor MFRC522 (SPI)"]
        RelayDriver["Driver Relé de Cerradura"]
    end

    %% Flujos entre componentes
    ApiClient -->|HTTP REST JSON| RESTRouter
    WsHook <-->|Eventos TCP en Vivo| WSServerComponent

    RC522Chip -->|SPI Bus| ESP32Firmware
    RC522Chip -->|SPI Bus| PythonReader
    ESP32Firmware -->|HTTP POST /api/access/validate| RESTRouter
    PythonReader -->|HTTP POST /api/access/validate| RESTRouter
    ESP32Firmware -->|Pulso 5s GPIO 2| RelayDriver

    RESTRouter --> JWTMiddleware
    JWTMiddleware --> ValEngineComponent
    ValEngineComponent --> AlarmComponent
    ValEngineComponent --> WSServerComponent

    ValEngineComponent --> PGDriver
    PGDriver --> PGDatabase
    PGDriver -.->|Falla de Red/Auth| MemoryFallback
```

---

## 3. Diagrama de Despliegue Físico en el Campus

Ilustra la distribución física de los nodos de hardware, el servidor de aplicaciones y las estaciones de seguridad en la Corporación Universitaria Lasallista.

```mermaid
graph TD
    subgraph PorteriaPeatonal ["Nodo 1: Portería Principal (Entrada Campus)"]
        PC_Celador["PC Estación de Guardia<br/>(Navegador Firefox / Linux)"]
        Torniquete["Torniquete Peatonal con CrowPi 3<br/>(Lector RFID MFRC522)"]
    end

    subgraph SalaInformatica1 ["Nodo 2: Prototipo Sala de Informática 1 (Bloque A)"]
        P1_ESP32["Controlador Puerta Principal<br/>(ESP32 + RC522 + Relé + Buzzer)"]
        P2_ESP32["Controlador Puerta Lateral Taller<br/>(ESP32 + Relé)"]
        SensoresSala["Sensores PIR x2 + Sensor Magnético"]
    end

    subgraph CentroDatos ["Nodo 3: Servidor Institucional (Cuarto de Servidores)"]
        ServerApp["Servidor de Aplicación Node.js (:4000)<br/>WebSockets + REST API Engine"]
        PostgresSrv["Servidor de Base de Datos PostgreSQL (:5432)"]
    end

    subgraph Decanatura ["Nodo 4: Bloque Administrativo"]
        PC_Admin["PC de Administración / Decanatura<br/>(Gestión de Horarios y Campus)"]
    end

    %% Conexiones físicas de red
    Torniquete -->|LAN Cableada / HTTP| ServerApp
    P1_ESP32 -->|WiFi Institucional (WPA2) / HTTP| ServerApp
    P2_ESP32 -->|WiFi Institucional (WPA2) / HTTP| ServerApp
    SensoresSala -->|Línea física de señal| P1_ESP32

    PC_Celador <-->|HTTP :5173 + WebSockets :4000| ServerApp
    PC_Admin <-->|HTTP :5173| ServerApp

    ServerApp <-->|TCP Socket :5432| PostgresSrv
```
