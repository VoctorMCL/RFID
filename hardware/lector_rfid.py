#!/usr/bin/env python3
"""
Cliente de Hardware para Lector RFID MFRC522 (Raspberry Pi / CrowPi 3)
Control de Acceso Institucional — Corporación Universitaria Lasallista

Uso:
    python3 lector_rfid.py                  # Modo normal conectado al Backend
    python3 lector_rfid.py --door 2         # Asignar a Puerta 2
    python3 lector_rfid.py --server http://192.168.1.50:4000
    python3 lector_rfid.py --uid            # Solo leer y mostrar UID (diagnóstico)
"""
import argparse
import json
import os
import ssl
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime

try:
    import RPi.GPIO as GPIO
    from mfrc522 import MFRC522
    HARDWARE_DISPONIBLE = True
except ImportError:
    HARDWARE_DISPONIBLE = False

# ============================ BUZZER CrowPi 3 ============================
# El buzzer pasivo de la CrowPi 3 está conectado al GPIO 18 (PWM capaz).
# Se controla mediante PWM para generar tonos de frecuencia variable.
BUZZER_PIN = 18
buzzer_pwm = None
buzzer_habilitado = True  # Controlable con --mute


def inicializar_buzzer():
    """Configura el pin del buzzer en modo PWM si el hardware GPIO está disponible."""
    global buzzer_pwm
    if not HARDWARE_DISPONIBLE:
        return
    try:
        GPIO.setwarnings(False)
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(BUZZER_PIN, GPIO.OUT)
        buzzer_pwm = GPIO.PWM(BUZZER_PIN, 440)  # Frecuencia inicial de referencia
    except Exception as e:
        print(f"  ⚠️ No se pudo inicializar el buzzer en GPIO {BUZZER_PIN}: {e}")
        buzzer_pwm = None


def buzzer_tono(frecuencia, duracion):
    """Emite un tono simple en el buzzer pasivo.
    Args:
        frecuencia: Hz del tono (ej. 1000 para agudo, 300 para grave)
        duracion: Segundos que dura el tono
    """
    global buzzer_pwm
    if not buzzer_pwm or not buzzer_habilitado:
        return
    try:
        buzzer_pwm.ChangeFrequency(frecuencia)
        buzzer_pwm.start(50)  # Duty cycle al 50% para volumen óptimo
        time.sleep(duracion)
        buzzer_pwm.stop()
    except Exception:
        pass


def buzzer_acceso_concedido():
    """Secuencia de pitido para ACCESO CONCEDIDO: dos tonos ascendentes cortos y alegres.
    Sincronizado con la animación verde del frontend (~0.35s total)."""
    if not buzzer_pwm or not buzzer_habilitado:
        return
    try:
        # Tono 1: D5 (587 Hz) — 120ms
        buzzer_pwm.ChangeFrequency(587)
        buzzer_pwm.start(50)
        time.sleep(0.12)
        # Tono 2: A5 (880 Hz) — 200ms (ascendente, confirmación positiva)
        buzzer_pwm.ChangeFrequency(880)
        time.sleep(0.20)
        buzzer_pwm.stop()
    except Exception:
        pass


def buzzer_acceso_denegado():
    """Secuencia de pitido para ACCESO DENEGADO: tres tonos descendentes graves y largos.
    Sincronizado con la animación roja de vibración del frontend (~0.55s total)."""
    if not buzzer_pwm or not buzzer_habilitado:
        return
    try:
        # Tono 1: A3 (220 Hz) — 140ms
        buzzer_pwm.ChangeFrequency(220)
        buzzer_pwm.start(50)
        time.sleep(0.14)
        buzzer_pwm.stop()
        time.sleep(0.05)
        # Tono 2: E3 (165 Hz) — 160ms (descendente, rechazo)
        buzzer_pwm.ChangeFrequency(165)
        buzzer_pwm.start(50)
        time.sleep(0.16)
        buzzer_pwm.stop()
        time.sleep(0.05)
        # Tono 3: C3 (131 Hz) — 180ms (grave final, denegación definitiva)
        buzzer_pwm.ChangeFrequency(131)
        buzzer_pwm.start(50)
        time.sleep(0.18)
        buzzer_pwm.stop()
    except Exception:
        pass

# ============================ CONFIGURACIÓN ============================
# Por defecto conecta directamente a la plataforma en la nube (rfid.victormcl.me)
# Sin necesidad de correr servidores locales en tu laptop o en la CrowPi.
DEFAULT_API_URL = os.environ.get(
    "RFID_SERVER_URL",
    "https://rfid.victormcl.me/api/access/validate"
)
DEFAULT_DOOR_ID = 1  # 1 = Puerta Principal — Sala de Informática 1
SEGUNDOS_ENTRE_LECTURAS = 1.5
# =======================================================================


def bucle_heartbeat(api_url, door_id):
    """Mantiene el estado del sensor activo en el Dashboard enviando latidos cada 8s"""
    url = api_url.strip().rstrip('/')
    base = url.replace('/access/validate', '')
    if not base.endswith('/api'):
        base = f"{base}/api" if '/api' not in base else base
    heartbeat_url = f"{base}/doors/{int(door_id)}/heartbeat"

    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    while True:
        try:
            req = urllib.request.Request(
                heartbeat_url,
                data=b"{}",
                headers={"Content-Type": "application/json", "User-Agent": "CrowPi3-Heartbeat/1.0"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=4, context=ssl_ctx) as resp:
                pass
        except Exception:
            pass
        time.sleep(8)


def norm_uid(uid_bytes):
    b = bytes(uid_bytes[:4])
    return b.hex().upper()


def enviar_al_backend(api_url, door_id, uid_hex):
    # Formatear URL de forma inteligente si solo se pasa el host o dominio base
    url = api_url.strip().rstrip('/')
    if not url.endswith('/access/validate'):
        if url.endswith('/api'):
            url = f"{url}/access/validate"
        else:
            url = f"{url}/api/access/validate"

    payload = {
        "rfid_uid": uid_hex,
        "door_id": int(door_id),
        "access_method": "rfid"
    }

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "CrowPi3-RFID-Reader/1.0"
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    # Contexto SSL tolerante para Raspberry Pi / CrowPi con ca-certificates embebidos
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, timeout=6, context=ssl_ctx) as response:
            res_body = response.read().decode("utf-8")
            result = json.loads(res_body)

            if result.get("success"):
                d = result.get("data", {})
                granted = d.get("granted")
                user = d.get("user")
                door = d.get("door", {})
                room = d.get("room", {})
                user_name = f"{user.get('first_name')} {user.get('last_name')}" if user else "Desconocido"

                if granted:
                    print(f"  🟢 [ACCESO CONCEDIDO] Puerta: {door.get('name', 'Principal')} ({room.get('name', 'Sala')})")
                    print(f"     👤 Titular: {user_name} | Doc: {user.get('document_id')} | Rol: {user.get('role')}")
                    # 🔊 Buzzer: pitido de confirmación sincronizado con la animación verde
                    buzzer_acceso_concedido()
                else:
                    reason = d.get("denial_reason")
                    print(f"  🔴 [ACCESO DENEGADO] Causa: {reason}")
                    # 🔊 Buzzer: pitido de alerta sincronizado con la animación roja de vibración
                    buzzer_acceso_denegado()
                    if d.get("alarm_triggered"):
                        print("  🚨 [ALARMA CRÍTICA DISPARADA] Notificación de apertura no autorizada enviada.")
            else:
                print("  ⚠️ Error del backend:", result.get("error"))

    except urllib.error.URLError as e:
        print(f"  ❌ Error de conexión al servidor ({url}): {e.reason}")
    except Exception as e:
        print(f"  ❌ Error inesperado:", e)


def main():
    parser = argparse.ArgumentParser(description="Lector RFID RC522 — Control de Acceso")
    parser.add_argument("--server", default=DEFAULT_API_URL, help="URL del endpoint de validación")
    parser.add_argument("--door", default=DEFAULT_DOOR_ID, type=int, help="ID de la puerta asociada")
    parser.add_argument("--uid", action="store_true", help="Solo leer y mostrar UID (modo offline)")
    parser.add_argument("--mute", action="store_true", help="Desactivar el buzzer (sin pitidos)")
    args = parser.parse_args()

    # Configurar estado global del buzzer
    global buzzer_habilitado
    buzzer_habilitado = not args.mute

    print("================================================================")
    print("🔒 Cliente de Lectura RFID (Hardware MFRC522)")
    print(f"📡 Backend: {args.server}")
    print(f"🚪 Puerta ID: {args.door}")
    print("================================================================")

    # Inicializar buzzer del CrowPi 3
    inicializar_buzzer()
    if buzzer_habilitado and buzzer_pwm:
        print(f"🔊 Buzzer activo en GPIO {BUZZER_PIN} — Tonos de confirmación/alerta habilitados")
    elif not buzzer_habilitado:
        print("🔇 Buzzer desactivado por flag --mute")
    else:
        print("🔇 Buzzer no disponible (GPIO no detectado en este host)")

    # Iniciar latido en segundo plano para notificar presencia al dashboard
    threading.Thread(target=bucle_heartbeat, args=(args.server, args.door), daemon=True).start()
    print(f"💓 Telemetría activa: enviando pulsos de hardware a puerta {args.door}")

    if not HARDWARE_DISPONIBLE:
        print("ℹ️  Librerías RPi.GPIO / mfrc522 no detectadas en este host.")
        print("   Para simular lecturas en modo consola, escribe un UID Hex (ej. A1B2C3D4):")
        try:
            while True:
                uid_in = input("Simular UID > ").strip()
                if uid_in:
                    enviar_al_backend(args.server, args.door, uid_in.upper())
        except (KeyboardInterrupt, EOFError):
            print("\nFinalizado.")
            return

    lector = MFRC522()
    ultimo_uid, ultimo_t = None, 0.0

    try:
        while True:
            estado, _ = lector.MFRC522_Request(lector.PICC_REQIDL)
            if estado == lector.MI_OK:
                estado, uid_bytes = lector.MFRC522_Anticoll()
                if estado == lector.MI_OK and uid_bytes:
                    ahora = time.time()
                    uid_hex = norm_uid(uid_bytes)
                    if uid_hex != ultimo_uid or (ahora - ultimo_t) > SEGUNDOS_ENTRE_LECTURAS:
                        ultimo_uid = uid_hex
                        ultimo_t = ahora
                        hora = datetime.now().strftime("%H:%M:%S")
                        print(f"[{hora}] Tarjeta detectada: {uid_hex}")

                        if not args.uid:
                            enviar_al_backend(args.server, args.door, uid_hex)

            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nSaliendo...")
    finally:
        if buzzer_pwm:
            buzzer_pwm.stop()
        GPIO.cleanup()


if __name__ == "__main__":
    main()
