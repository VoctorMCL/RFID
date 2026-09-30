#!/usr/bin/env python3
"""
Lector RFID para CrowPi3 (RC522) -> valida contra Supabase y registra el acceso.
La página index.html muestra ACEPTADO / DENEGADO leyendo la tabla "accesos".

Instalación (una sola vez, en la Raspberry Pi):
    sudo raspi-config            # Interface Options -> SPI -> Enable, y reiniciar
    sudo apt install -y python3-spidev python3-rpi-lgpio python3-pip
    pip3 install mfrc522 --break-system-packages

Uso:
    python3 lector_rfid.py          # modo normal: valida contra Supabase y registra el acceso
    python3 lector_rfid.py --uid    # solo LEE y muestra el UID (no usa internet ni Supabase)
"""
import argparse
import json
import re
import time
import urllib.error
import urllib.request
from datetime import date, datetime

import RPi.GPIO as GPIO          # en Raspberry Pi 5 lo provee python3-rpi-lgpio
from mfrc522 import MFRC522

# ============================ CONFIGURACIÓN ============================
SUPABASE_URL = "https://rebvmpptmwltrovsxqjb.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlYnZtcHB0bXdsdHJvdnN4cWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3Mjg1MjgsImV4cCI6MjEwNDMwNDUyOH0."
    "ZZ54_0qYxxgSiF3GcWaNE2jsljRJWHYdvr4GL7YFEyY"
)
# Número del torniquete (id_torniquete). Si lo dejas en None, se usa el primero
# que exista en la tabla "torniquetes" (muchas tablas exigen que este campo no sea NULL).
ID_TORNIQUETE = None
SEGUNDOS_ENTRE_LECTURAS = 2.0   # evita leer dos veces la misma tarjeta pegada al lector
# =======================================================================

ERRORES_RED = (urllib.error.URLError, OSError)


class ApiError(Exception):
    """Error devuelto por Supabase (incluye el mensaje real del servidor)."""


def api(method, tabla, query="", body=None):
    url = f"{SUPABASE_URL}/rest/v1/{tabla}{query}"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detalle = e.read().decode("utf-8", "replace")
        raise ApiError(f"{method} {tabla} -> HTTP {e.code}: {detalle}") from None


def norm(s):
    return re.sub(r"[\s:\-]", "", str(s or "")).upper()


# ------------------------------ UID ------------------------------
def uid_formatos(uid_bytes):
    """Todas las formas comunes en que el UID pudo quedar guardado en la base de datos."""
    b = bytes(uid_bytes[:4])
    return {
        "hex": b.hex().upper(),                                   # AABBCCDD  (recomendado)
        "hex_dos_puntos": ":".join(f"{x:02X}" for x in b),        # AA:BB:CC:DD
        "hex_inverso": b[::-1].hex().upper(),                     # DDCCBBAA
        "dec": str(int.from_bytes(b, "big")),
        "dec_inverso": str(int.from_bytes(b, "little")),
        "dec_5bytes": str(int.from_bytes(bytes(uid_bytes[:5]), "big")),
    }


def mostrar_uid(uid_bytes, detalle=False):
    f = uid_formatos(uid_bytes)
    hora = datetime.now().strftime("%H:%M:%S")
    print(f"[{hora}] UID {f['hex']}  ({f['hex_dos_puntos']})  decimal {f['dec']}")
    if detalle:
        print(f"           hex invertido {f['hex_inverso']}  |  decimal invertido {f['dec_inverso']}")
        print(f"           -> para registrarla en la web escribe:  {f['hex']}")


# ------------------------------ SUPABASE ------------------------------
_torniquete = "pendiente"


def torniquete_actual():
    global _torniquete
    if ID_TORNIQUETE is not None:
        return ID_TORNIQUETE
    if _torniquete == "pendiente":
        try:
            r = api("GET", "torniquetes", "?select=id_torniquete&order=id_torniquete.asc&limit=1")
            _torniquete = r[0]["id_torniquete"] if r else None
        except (ApiError, *ERRORES_RED) as e:
            print("  Aviso: no pude leer la tabla torniquetes:", e)
            return None          # vuelve a intentarlo en la próxima lectura
    return _torniquete


def decidir(uid_bytes):
    """Consulta la base de datos y decide el resultado. Devuelve (resultado, tarjeta)."""
    f = uid_formatos(uid_bytes)
    candidatos = {f["hex"], f["hex_inverso"], f["dec"], f["dec_inverso"], f["dec_5bytes"]}

    tarjeta = persona = None
    for t in api("GET", "tarjetas_rfid", "?select=*"):
        if norm(t.get("uid")) in candidatos:
            tarjeta = t
            break

    if tarjeta is None:
        return "denegado_no_registrado", None

    if tarjeta.get("id_persona") is not None:
        r = api("GET", "personas", f"?select=*&id_persona=eq.{tarjeta['id_persona']}")
        persona = r[0] if r else None

    if not tarjeta.get("activa"):
        return "denegado_revocado", tarjeta
    if persona and persona.get("fecha_expiracion") and persona["fecha_expiracion"] < date.today().isoformat():
        return "denegado_expirado", tarjeta
    return "permitido", tarjeta


def registrar_acceso(uid_bytes, tarjeta, resultado):
    """Guarda el intento en la tabla accesos (la web lee de aquí)."""
    uid_hex = uid_formatos(uid_bytes)["hex"]
    api("POST", "accesos", "", {
        "uid_leido": tarjeta["uid"] if tarjeta else uid_hex,
        "id_tarjeta": tarjeta["id_tarjeta"] if tarjeta else None,
        "id_torniquete": torniquete_actual(),
        "resultado": resultado,
    })


def procesar(uid_bytes):
    try:
        resultado, tarjeta = decidir(uid_bytes)
    except (ApiError, *ERRORES_RED) as e:
        print("           Error consultando Supabase:", e, "-> DENEGADO")
        return
    print(f"           -> {'ACEPTADO' if resultado == 'permitido' else 'DENEGADO'} ({resultado})")
    try:
        registrar_acceso(uid_bytes, tarjeta, resultado)
    except (ApiError, *ERRORES_RED) as e:
        print("           Aviso: NO se pudo guardar el acceso (la web no lo verá):", e)


# ------------------------------ LECTOR ------------------------------
def leer_uid(lector):
    estado, _ = lector.MFRC522_Request(lector.PICC_REQIDL)
    if estado != lector.MI_OK:
        return None
    estado, uid = lector.MFRC522_Anticoll()
    return uid if estado == lector.MI_OK else None


def main():
    ap = argparse.ArgumentParser(description="Lector RFID RC522 -> Supabase")
    ap.add_argument("--uid", "-u", action="store_true",
                    help="solo leer y mostrar el UID de cada tarjeta (sin Supabase)")
    args = ap.parse_args()

    lector = MFRC522()
    if args.uid:
        print("Modo UID: acerca una tarjeta para ver su UID (Ctrl+C para salir).")
    else:
        print("Lector RC522 listo. Acerca una tarjeta (Ctrl+C para salir).")

    ultimo_uid, ultimo_t = None, 0.0
    try:
        while True:
            uid = leer_uid(lector)
            if uid:
                ahora = time.time()
                repetida = uid == ultimo_uid and ahora - ultimo_t < SEGUNDOS_ENTRE_LECTURAS
                ultimo_uid, ultimo_t = uid, ahora
                if not repetida:
                    mostrar_uid(uid, detalle=args.uid)
                    if not args.uid:
                        procesar(uid)
            time.sleep(0.1)
    except KeyboardInterrupt:
        pass
    finally:
        GPIO.cleanup()


if __name__ == "__main__":
    main()
