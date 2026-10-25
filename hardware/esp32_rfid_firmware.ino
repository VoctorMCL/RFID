/*
 ===================================================================
 Firmware para ESP32 con Lector RFID RC522 y Conexión WiFi
 Control de Acceso Institucional — Corporación Universitaria Lasallista
 ===================================================================
 Conecta el ESP32 a la red institucional, lee tarjetas Mifare RC522
 y valida el acceso en tiempo real contra el Backend vía HTTP POST.
 
 Pines de Conexión (ESP32 <-> MFRC522):
   SDA (SS)   -> GPIO 5
   SCK        -> GPIO 18
   MOSI       -> GPIO 23
   MISO       -> GPIO 19
   RST        -> GPIO 22
   3.3V & GND -> 3.3V & GND
   
 Pines de Salida:
   RELAY_PIN  -> GPIO 2 (Electroimán / Cerrojo de Puerta)
   BUZZER_PIN -> GPIO 4 (Buzzer de Alarma)
   LED_STATUS -> GPIO 15
 ===================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// Configuración de Red WiFi
const char* WIFI_SSID     = "Lasallista_Campus";
const char* WIFI_PASSWORD = "PasswordSeguro2026";

// Configuración de Backend de Control de Acceso
const char* BACKEND_URL   = "http://192.168.1.50:4000/api/access/validate";
const int   DOOR_ID       = 1; // 1 = Puerta Principal Sala Informática 1

// Pines
#define SS_PIN     5
#define RST_PIN    22
#define RELAY_PIN  2
#define BUZZER_PIN 4

MFRC522 rfid(SS_PIN, RST_PIN);
unsigned long lastReadTime = 0;
const unsigned long READ_DELAY = 1500; // ms

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // Puerta bloqueada
  digitalWrite(BUZZER_PIN, LOW);

  SPI.begin();
  rfid.PCD_Init();

  Serial.println("\n--- Control de Acceso RFID ESP32 ---");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando a WiFi...");

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Conectado! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nModo Offline / Sin conexión WiFi.");
  }

  Serial.println("Lector RFID RC522 listo.");
}

void loop() {
  // Comprobar presencia de tarjeta
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  if (millis() - lastReadTime < READ_DELAY) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  lastReadTime = millis();

  // Convertir UID a String Hexadecimal
  String uidHex = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uidHex += "0";
    uidHex += String(rfid.uid.uidByte[i], HEX);
  }
  uidHex.toUpperCase();

  Serial.println("\n[RFID] UID Detectado: " + uidHex);

  if (WiFi.status() == WL_CONNECTED) {
    validarAccesoBackend(uidHex);
  } else {
    Serial.println("[ERROR] Sin conexión a la red de control de acceso.");
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

void validarAccesoBackend(String uid) {
  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["rfid_uid"] = uid;
  doc["door_id"] = DOOR_ID;
  doc["access_method"] = "rfid";

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);

  if (httpCode > 0) {
    String response = http.getString();
    StaticJsonDocument<1024> resDoc;
    DeserializationError error = deserializeJson(resDoc, response);

    if (!error && resDoc["success"]) {
      bool granted = resDoc["data"]["granted"];
      bool alarm = resDoc["data"]["alarm_triggered"];

      if (granted) {
        Serial.println(">>> ACCESO PERMITIDO - DESBLOQUEANDO CERRADURA <<<");
        digitalWrite(RELAY_PIN, HIGH); // Abrir cerradura
        tone(BUZZER_PIN, 1000, 200);   // Beep de confirmación
        delay(5000);                   // Mantener abierta 5 segundos
        digitalWrite(RELAY_PIN, LOW);  // Volver a bloquear
      } else {
        Serial.println(">>> ACCESO DENEGADO <<<");
        tone(BUZZER_PIN, 300, 500);    // Tono grave de denegación

        if (alarm) {
          Serial.println("!!! ALERTA DE SEGURIDAD CRÍTICA ACTIVADA !!!");
          for (int i = 0; i < 5; i++) {
            tone(BUZZER_PIN, 1500, 300);
            delay(400);
          }
        }
      }
    }
  } else {
    Serial.printf("[HTTP] Error en petición: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}
