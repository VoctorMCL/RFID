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

# ============================ LIBRERÍAS DE HARDWARE ============================
# RPi.GPIO solo es compatible hasta Raspberry Pi 4. La CrowPi 3 puede venir con
# Raspberry Pi 5, donde el control GPIO se hace con gpiozero/lgpio. Por eso se
# detectan ambos backends por separado: el lector RFID y el buzzer son independientes.
try:
    import RPi.GPIO as GPIO
    GPIO_RPI_DISPONIBLE = True
except Exception:
    GPIO = None
    GPIO_RPI_DISPONIBLE = False

try:
    from mfrc522 import MFRC522
    RFID_DISPONIBLE = True
except Exception:
    MFRC522 = None
    RFID_DISPONIBLE = False

HARDWARE_DISPONIBLE = RFID_DISPONIBLE

# ============================ BUZZER CrowPi 3 ============================
# En la CrowPi 3 el buzzer está rotulado en la placa como "PI:IO01" y
# corresponde al GPIO BCM 18 (pin físico 12 del header de 40 pines).
# Se puede cambiar con RFID_BUZZER_PIN o con --buzzer-pin.
BUZZER_PIN = int(os.environ.get("RFID_BUZZER_PIN", "18"))
# "active"  = buzzer activo. En CrowPi 3 PI:IO01 normalmente es activo en bajo.
# "passive" = buzzer pasivo: requiere PWM para generar tonos de distinta frecuencia.
BUZZER_TYPE = os.environ.get("RFID_BUZZER_TYPE", "active").strip().lower()
BUZZER_ACTIVE_HIGH = os.environ.get("RFID_BUZZER_ACTIVE_HIGH", "0").strip().lower() in (
    "1", "true", "yes", "on"
)
buzzer_pwm = None        # Backend RPi.GPIO (PWM), solo para buzzer pasivo
buzzer_gpiozero = None   # Backend gpiozero/lgpio (Raspberry Pi 5)
buzzer_backend = None    # "rpi" | "gpiozero"
buzzer_habilitado = True # Controlable con --mute
buzzer_silenciado_remoto = False  # Botón de silencio de la plataforma web (vía backend)
LECTOR_VERSION = "mute-v2 (2026-11-11)"


def _modelo_raspberry():
    """Devuelve el modelo de Raspberry Pi desde el device-tree (si existe)."""
    try:
        with open("/proc/device-tree/model", "r", encoding="utf-8", errors="ignore") as f:
            return f.read().strip("\x00\n ")
    except Exception:
        return "modelo desconocido"


def inicializar_buzzer():
    """Configura el buzzer probando RPi.GPIO y, si falla, gpiozero/lgpio.

    En Raspberry Pi 5 RPi.GPIO no puede configurar pines; el fallback con
    gpiozero usa lgpio y permite controlar igualmente el GPIO BCM 18.
    """
    global buzzer_pwm, buzzer_gpiozero, buzzer_backend
    if not buzzer_habilitado:
        return

    modelo = _modelo_raspberry()

    # 1) Backend clásico RPi.GPIO (Raspberry Pi 1-4)
    if GPIO_RPI_DISPONIBLE:
        try:
            GPIO.setwarnings(False)
            GPIO.setmode(GPIO.BCM)
            inactive_level = GPIO.LOW if BUZZER_ACTIVE_HIGH else GPIO.HIGH
            GPIO.setup(BUZZER_PIN, GPIO.OUT, initial=inactive_level)
            if BUZZER_TYPE == "passive":
                buzzer_pwm = GPIO.PWM(BUZZER_PIN, 440)
            buzzer_backend = "rpi"
            return
        except Exception as e:
            print(f"  ⚠️ RPi.GPIO no pudo usar el GPIO {BUZZER_PIN} ({e}).")
            print("     Probando gpiozero/lgpio (necesario en Raspberry Pi 5)...")
            try:
                GPIO.cleanup(BUZZER_PIN)
            except Exception:
                pass

    # 2) Backend gpiozero (Raspberry Pi 5 con lgpio, o sistemas sin RPi.GPIO)
    try:
        if BUZZER_TYPE == "passive":
            from gpiozero import PWMOutputDevice
            buzzer_gpiozero = PWMOutputDevice(
                BUZZER_PIN,
                frequency=440,
                initial_value=0,
                active_high=BUZZER_ACTIVE_HIGH,
            )
        else:
            from gpiozero import DigitalOutputDevice
            buzzer_gpiozero = DigitalOutputDevice(
                BUZZER_PIN,
                initial_value=False,
                active_high=BUZZER_ACTIVE_HIGH,
            )
        buzzer_backend = "gpiozero"
        return
    except Exception as e:
        print(
            f"  ⚠️ No se pudo inicializar el buzzer en GPIO BCM {BUZZER_PIN} "
            f"(CrowPi PI:IO01, pin físico 12). Modelo detectado: {modelo}. Error: {e}"
        )
        print("     Instala el soporte GPIO con: sudo apt install -y python3-gpiozero python3-lgpio")
        print("     Si el error es de permisos, ejecuta: sudo python3 hardware/lector_rfid.py --test-buzzer")
        buzzer_pwm = None
        buzzer_gpiozero = None
        buzzer_backend = None


def buzzer_disponible():
    if buzzer_silenciado_remoto:
        return False
    return bool(buzzer_habilitado and (buzzer_pwm or buzzer_gpiozero or buzzer_backend == "rpi"))


def aplicar_mute_remoto(valor):
    """Sincroniza el silencio pedido desde la web. None = el backend no lo informó."""
    global buzzer_silenciado_remoto
    if valor is None:
        return
    valor = bool(valor)
    if valor != buzzer_silenciado_remoto:
        buzzer_silenciado_remoto = valor
        print("  🔇 Buzzer silenciado desde la plataforma" if valor else "  🔊 Buzzer reactivado desde la plataforma")
        if valor:
            silenciar_buzzer()


def _buzzer_on(frecuencia=440):
    """Enciende el buzzer con la frecuencia indicada según el backend activo."""
    if buzzer_pwm:
        buzzer_pwm.ChangeFrequency(frecuencia)
        buzzer_pwm.start(50)  # Duty cycle al 50% para volumen óptimo
    elif buzzer_gpiozero:
        if BUZZER_TYPE == "passive":
            buzzer_gpiozero.frequency = frecuencia
            buzzer_gpiozero.value = 0.5
        else:
            buzzer_gpiozero.on()
    elif buzzer_backend == "rpi":
        GPIO.output(BUZZER_PIN, GPIO.HIGH if BUZZER_ACTIVE_HIGH else GPIO.LOW)


def _buzzer_off():
    """Apaga el buzzer en cualquiera de los backends."""
    if buzzer_pwm:
        buzzer_pwm.stop()
    elif buzzer_gpiozero:
        buzzer_gpiozero.off()
    elif buzzer_backend == "rpi":
        GPIO.output(BUZZER_PIN, GPIO.HIGH if not BUZZER_ACTIVE_HIGH else GPIO.LOW)


def silenciar_buzzer():
    """Apaga inmediatamente cualquier tono activo recibido desde el backend."""
    try:
        _buzzer_off()
    except Exception as e:
        print(f"  ⚠️ No se pudo silenciar el buzzer: {e}")


def buzzer_cleanup():
    """Libera el pin y el backend del buzzer."""
    global buzzer_pwm, buzzer_gpiozero, buzzer_backend
    try:
        _buzzer_off()
    except Exception:
        pass
    if buzzer_pwm:
        try:
            buzzer_pwm.stop()
        except Exception:
            pass
    if buzzer_gpiozero:
        try:
            buzzer_gpiozero.close()
        except Exception:
            pass
    buzzer_pwm = None
    buzzer_gpiozero = None
    buzzer_backend = None
    if GPIO_RPI_DISPONIBLE:
        try:
            GPIO.cleanup()
        except Exception:
            pass


def buzzer_tono(frecuencia, duracion):
    """Emite un tono simple en el buzzer.
    Args:
        frecuencia: Hz del tono (ej. 1000 para agudo, 300 para grave)
        duracion: Segundos que dura el tono
    """
    if not buzzer_disponible():
        return
    try:
        _buzzer_on(frecuencia)
        time.sleep(duracion)
        _buzzer_off()
    except Exception:
        pass


def buzzer_acceso_concedido():
    """Secuencia de pitido para ACCESO CONCEDIDO: dos tonos ascendentes cortos y alegres.
    Sincronizado con la animación verde del frontend (~0.35s total)."""
    if not buzzer_disponible():
        return
    try:
        # Tono 1: D5 (587 Hz) — 120ms
        _buzzer_on(587)
        time.sleep(0.12)
        # Tono 2: A5 (880 Hz) — 200ms (ascendente, confirmación positiva)
        _buzzer_on(880)
        time.sleep(0.20)
        _buzzer_off()
    except Exception:
        pass


def buzzer_acceso_denegado():
    """Secuencia de pitido para ACCESO DENEGADO: tres tonos descendentes graves y largos.
    Sincronizado con la animación roja de vibración del frontend (~0.55s total)."""
    if not buzzer_disponible():
        return
    try:
        # Tono 1: A3 (220 Hz) — 140ms
        _buzzer_on(220)
        time.sleep(0.14)
        _buzzer_off()
        time.sleep(0.05)
        # Tono 2: E3 (165 Hz) — 160ms (descendente, rechazo)
        _buzzer_on(165)
        time.sleep(0.16)
        _buzzer_off()
        time.sleep(0.05)
        # Tono 3: C3 (131 Hz) — 180ms (grave final, denegación definitiva)
        _buzzer_on(131)
        time.sleep(0.18)
        _buzzer_off()
    except Exception:
        pass

# ============================ CONFIGURACIÓN ============================
# Por defecto conecta directamente a la plataforma en la nube (rfid.victormcl.me)
# Sin necesidad de correr servidores locales en tu laptop o en la CrowPi.
DEFAULT_API_URL = os.environ.get(
    "RFID_SERVER_URL",
    "https://rfid.victormcl.me/api/access/validate"
)
DEFAULT_DOOR_ID = int(os.environ.get("RFID_DOOR_ID", "54"))  # 54 = Ingreso a la Universidad
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
                body = resp.read().decode("utf-8")
                response = json.loads(body) if body else {}
                aplicar_mute_remoto(response.get("buzzer_muted"))
                commands = response.get("commands", [])
                if any(command.get("type") == "silence_buzzer" for command in commands):
                    silenciar_buzzer()
        except Exception:
            pass
        time.sleep(8)


def norm_uid(uid_bytes):
    b = bytes(uid_bytes[:4])
    return b.hex().upper()


# ==================== SESIÓN HTTP PERSISTENTE (KEEP-ALIVE) ====================
# Reutiliza el túnel TCP/TLS existente para eliminar la latencia de handshake (de 450ms a ~30ms)
_session_http = None

def get_http_session():
    global _session_http
    if _session_http is None:
        try:
            import requests
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            _session_http = requests.Session()
            _session_http.verify = False
            _session_http.headers.update({
                "Content-Type": "application/json",
                "User-Agent": "CrowPi3-RFID-Reader/1.0",
                "Connection": "keep-alive"
            })
        except ImportError:
            _session_http = False
    return _session_http


def procesar_respuesta_backend(result):
    if result.get("success"):
        d = result.get("data", {})
        granted = d.get("granted")
        user = d.get("user")
        door = d.get("door", {})
        room = d.get("room", {})
        user_name = f"{user.get('first_name')} {user.get('last_name')}" if user else "Desconocido"
        # El estado de silencio viaja en la misma respuesta: se aplica ANTES de pitar.
        print(f"  🔈 Servidor envió buzzer_muted={door.get('buzzer_muted')!r} (None = el backend no manda ese dato)")
        aplicar_mute_remoto(door.get("buzzer_muted"))

        if granted:
            print(f"  🟢 [ACCESO CONCEDIDO] Puerta: {door.get('name', 'Principal')} ({room.get('name', 'Sala')})")
            print(f"     👤 Titular: {user_name} | Doc: {user.get('document_id')} | Rol: {user.get('role')}")
            threading.Thread(target=buzzer_acceso_concedido, daemon=True).start()
        else:
            reason = d.get("denial_reason")
            print(f"  🔴 [ACCESO DENEGADO] Causa: {reason}")
            threading.Thread(target=buzzer_acceso_denegado, daemon=True).start()
            if d.get("alarm_triggered"):
                print("  🚨 [ALARMA CRÍTICA DISPARADA] Notificación de apertura no autorizada enviada.")
    else:
        print("  ⚠️ Error del backend:", result.get("error"))


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

    # 1. Intento prioritario con sesión persistente Keep-Alive (ultra rápido)
    session = get_http_session()
    if session:
        try:
            resp = session.post(url, json=payload, timeout=4)
            result = resp.json()
            procesar_respuesta_backend(result)
            return
        except Exception:
            pass  # Fallback a urllib si la conexión reutilizada expiró

    # 2. Fallback estándar con urllib
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "CrowPi3-RFID-Reader/1.0"
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, timeout=5, context=ssl_ctx) as response:
            res_body = response.read().decode("utf-8")
            result = json.loads(res_body)
            procesar_respuesta_backend(result)
    except urllib.error.URLError as e:
        print(f"  ❌ Error de conexión al servidor ({url}): {e.reason}")
    except Exception as e:
        print(f"  ❌ Error inesperado:", e)


def main():
    global buzzer_habilitado, BUZZER_PIN, BUZZER_TYPE

    parser = argparse.ArgumentParser(description="Lector RFID RC522 — Control de Acceso")
    parser.add_argument("--server", default=DEFAULT_API_URL, help="URL del endpoint de validación")
    parser.add_argument("--door", default=DEFAULT_DOOR_ID, type=int, help="ID de la puerta asociada")
    parser.add_argument("--uid", action="store_true", help="Solo leer y mostrar UID (modo offline)")
    parser.add_argument("--mute", action="store_true", help="Desactivar el buzzer (sin pitidos)")
    parser.add_argument(
        "--buzzer-pin", type=int, default=BUZZER_PIN,
        help="GPIO BCM del buzzer (CrowPi 3: 18 = etiqueta PI:IO01, pin físico 12)"
    )
    parser.add_argument(
        "--buzzer-type", choices=["active", "passive"], default=BUZZER_TYPE,
        help="Tipo de buzzer: active (CrowPi 3) o passive (requiere PWM)"
    )
    parser.add_argument(
        "--test-buzzer", action="store_true",
        help="Emitir la secuencia de prueba del buzzer y salir"
    )
    args = parser.parse_args()

    # Configurar estado global del buzzer
    buzzer_habilitado = not args.mute
    BUZZER_PIN = args.buzzer_pin
    BUZZER_TYPE = args.buzzer_type

    print("================================================================")
    print(f"🔒 Cliente de Lectura RFID (Hardware MFRC522) — versión {LECTOR_VERSION}")
    print(f"📡 Backend: {args.server}")
    print(f"🚪 Puerta ID: {args.door}")
    print("================================================================")

    # Inicializar buzzer del CrowPi 3
    inicializar_buzzer()
    if buzzer_disponible():
        print(
            f"🔊 Buzzer listo — CrowPi PI:IO01 / GPIO BCM {BUZZER_PIN} "
            f"(pin físico 12, tipo {BUZZER_TYPE}, backend {buzzer_backend})"
        )
    elif not buzzer_habilitado:
        print("🔇 Buzzer desactivado por flag --mute")
    else:
        print(f"🔇 Buzzer no disponible en GPIO BCM {BUZZER_PIN} (CrowPi PI:IO01)")

    # Modo diagnóstico: probar el buzzer y salir
    if args.test_buzzer:
        if buzzer_disponible():
            print("🎵 Probando secuencia de acceso concedido...")
            buzzer_acceso_concedido()
            time.sleep(0.4)
            print("🎵 Probando secuencia de acceso denegado...")
            buzzer_acceso_denegado()
            print("✅ Prueba de buzzer finalizada.")
        else:
            print("❌ No se pudo probar el buzzer: no hay backend GPIO disponible.")
        buzzer_cleanup()
        return

    # Iniciar latido en segundo plano para notificar presencia al dashboard
    threading.Thread(target=bucle_heartbeat, args=(args.server, args.door), daemon=True).start()
    print(f"💓 Telemetría activa: enviando pulsos de hardware a puerta {args.door}")

    if not HARDWARE_DISPONIBLE:
        print("ℹ️  Librería mfrc522 no detectada en este host (modo simulación).")
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
    ultimo_uid = None
    ausencia_inicio = None

    try:
        while True:
            estado, _ = lector.MFRC522_Request(lector.PICC_REQIDL)
            if estado == lector.MI_OK:
                estado, uid_bytes = lector.MFRC522_Anticoll()
                if estado == lector.MI_OK and uid_bytes:
                    ausencia_inicio = None
                    uid_hex = norm_uid(uid_bytes)
                    # Solo se procesa una vez por presentación física del carnet.
                    if uid_hex != ultimo_uid:
                        ultimo_uid = uid_hex
                        hora = datetime.now().strftime("%H:%M:%S")
                        print(f"[{hora}] Tarjeta detectada: {uid_hex}")

                        if not args.uid:
                            enviar_al_backend(args.server, args.door, uid_hex)
            else:
                # Permitir volver a leer el mismo carnet solo tras retirarlo
                # (se exige ausencia continua para evitar rebotes del lector)
                if ultimo_uid is not None:
                    if ausencia_inicio is None:
                        ausencia_inicio = time.time()
                    elif (time.time() - ausencia_inicio) > 0.5:
                        ultimo_uid = None
                        ausencia_inicio = None

            time.sleep(0.02)
    except KeyboardInterrupt:
        print("\nSaliendo...")
    finally:
        buzzer_cleanup()


if __name__ == "__main__":
    main()
