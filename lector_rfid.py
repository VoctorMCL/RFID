#!/usr/bin/env python3
"""
Lector RFID para CrowPi3 (RC522) -> valida contra Supabase y registra el acceso.
La página index.html muestra ACEPTADO / DENEGADO leyendo la tabla "accesos".

Instalación (una sola vez, en la Raspberry Pi):
    sudo raspi-config            # Interface Options -> SPI -> Enable, y reiniciar
    sudo apt install -y python3-spidev python3-rpi-lgpio python3-pip
    pip3 install mfrc522 --break-system-packages

Uso:
    python3 lector_rfid.py
"""
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

import RPi.GPIO as GPIO          # en Raspberry Pi 5 lo provee python3-rpi-lgpio
from mfrc522 import MFRC522

# ============================ CONFIGURACIÓN ============================
SUPABASE_URL = "https://rebvmpptmwltrovsxqjb.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlYnZtcHB0bXdsdHJvdnN4cWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3Mjg1MjgsImV4cCI6MjEwNDMwNDUyOH0."
    "ZZ54_0qYxxgSiF3GcWaNE2jsljRJWHYdvr4GL7YFEyY"
)
ID_TORNIQUETE = None     # número del torniquete (id_torniquete) o None si no aplica
SEGUNDOS_ENTRE_LECTURAS = 2.0   # evita leer dos veces la misma tarjeta pegada al lector
# =======================================================================


def api(method, tabla, query="", body=None):
    url = f"{SUPABASE_URL}/rest/v1/{tabla}{query}"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=8) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def norm(s):
    return re.sub(r"[\s:\-]", "", str(s or "")).upper()


def formatos_uid(uid_bytes):
    """Todas las formas comunes en que el UID pudo quedar guardado en la base de datos."""
    b = list(uid_bytes[:4])
    hex_normal = "".join(f"{x:02X}" for x in b)
    hex_inverso = "".join(f"{x:02X}" for x in reversed(b))
    dec_normal = str(int.from_bytes(bytes(b), "big"))
    dec_inverso = str(int.from_bytes(bytes(b), "little"))
    dec_5bytes = str(int.from_bytes(bytes(uid_bytes[:5]), "big"))
    return hex_normal, {hex_normal, hex_inverso, dec_normal, dec_inverso, dec_5bytes}


def validar(uid_bytes):
    uid_hex, candidatos = formatos_uid(uid_bytes)
    tarjeta = persona = None
    resultado = "denegado_no_registrado"

    tarjetas = api("GET", "tarjetas_rfid", "?select=*")
    for t in tarjetas:
        if norm(t["uid"]) in candidatos:
            tarjeta = t
            break

    if tarjeta:
        if tarjeta.get("id_persona") is not None:
            r = api("GET", "personas", f"?select=*&id_persona=eq.{tarjeta['id_persona']}")
            persona = r[0] if r else None
        if not tarjeta.get("activa"):
            resultado = "denegado_revocado"
        elif persona and persona.get("fecha_expiracion") and persona["fecha_expiracion"] < date.today().isoformat():
            resultado = "denegado_expirado"
        else:
            resultado = "permitido"

    api("POST", "accesos", "", {
        "uid_leido": tarjeta["uid"] if tarjeta else uid_hex,
        "id_tarjeta": tarjeta["id_tarjeta"] if tarjeta else None,
        "id_torniquete": ID_TORNIQUETE,
        "resultado": resultado,
    })
    return resultado, uid_hex


def main():
    lector = MFRC522()
    print("Lector RC522 listo. Acerca una tarjeta (Ctrl+C para salir).")
    ultimo_uid, ultimo_t = None, 0.0
    try:
        while True:
            estado, _ = lector.MFRC522_Request(lector.PICC_REQIDL)
            if estado == lector.MI_OK:
                estado, uid = lector.MFRC522_Anticoll()
                if estado == lector.MI_OK:
                    ahora = time.time()
                    if uid == ultimo_uid and ahora - ultimo_t < SEGUNDOS_ENTRE_LECTURAS:
                        ultimo_t = ahora
                        continue
                    ultimo_uid, ultimo_t = uid, ahora
                    try:
                        resultado, uid_hex = validar(uid)
                        print(f"{uid_hex}  ->  {'ACEPTADO' if resultado == 'permitido' else 'DENEGADO'} ({resultado})")
                    except (urllib.error.URLError, OSError) as e:
                        print("Error de conexión con Supabase:", e, "-> DENEGADO")
            time.sleep(0.1)
    except KeyboardInterrupt:
        pass
    finally:
        GPIO.cleanup()


if __name__ == "__main__":
    main()
