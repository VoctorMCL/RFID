#!/usr/bin/env python3
"""
Diagnóstico directo del buzzer de la CrowPi 3.

En la CrowPi 3 el buzzer está rotulado como "PI:IO01" y corresponde al
GPIO BCM 18 (pin físico 12 del header de 40 pines).

Este script no depende del lector RFID ni del resto del proyecto.
Prueba varias formas de controlar el pin para descartar problemas de librería,
permisos o polaridad.

Uso en la Raspberry Pi:
    python3 hardware/test_buzzer_crowpi3.py
    sudo python3 hardware/test_buzzer_crowpi3.py
    python3 hardware/test_buzzer_crowpi3.py --pin 18
    python3 hardware/test_buzzer_crowpi3.py --active-high
"""
import argparse
import os
import time


def modelo_raspberry():
    try:
        with open("/proc/device-tree/model", "r", encoding="utf-8", errors="ignore") as f:
            return f.read().strip("\x00\n ")
    except Exception:
        return "modelo desconocido"


def pitidos_gpiozero(pin, activo_en_alto=False):
    """Prueba digital segura con gpiozero/lgpio para un buzzer activo."""
    from gpiozero import DigitalOutputDevice

    buzzer = DigitalOutputDevice(
        pin,
        initial_value=False,
        active_high=activo_en_alto,
    )
    try:
        for _ in range(2):
            buzzer.on()
            time.sleep(0.20)
            buzzer.off()
            time.sleep(0.30)
    finally:
        buzzer.off()
        buzzer.close()


def probar(nombre, funcion):
    print(f"\n▶ {nombre} ...")
    try:
        funcion()
        print(f"  ✅ {nombre}: terminó sin errores. ¿Se escucharon los pitidos?")
        return True
    except Exception as e:
        print(f"  ❌ {nombre}: {type(e).__name__}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Diagnóstico del buzzer CrowPi 3 (PI:IO01)")
    parser.add_argument("--pin", type=int, default=int(os.environ.get("RFID_BUZZER_PIN", "18")),
                        help="GPIO BCM del buzzer (por defecto 18 = PI:IO01)")
    parser.add_argument(
        "--active-high",
        action="store_true",
        help="Usar polaridad activa en alto (por defecto: activa en bajo)",
    )
    args = parser.parse_args()

    print("================================================================")
    print("🔊 Diagnóstico del buzzer — CrowPi 3")
    print(f"📍 Modelo: {modelo_raspberry()}")
    print(f"📍 GPIO BCM: {args.pin} (etiqueta CrowPi PI:IO01, pin físico 12)")
    print("================================================================")
    print("Si no se escucha nada, revisa:")
    print("  1. Que el DIP switch de la CrowPi 3 esté en la posición 1 (Raspberry Pi).")
    print("  2. Que el buzzer no esté silenciado físicamente o por software.")
    print("  3. Ejecutar con sudo si hay errores de permisos.")
    print("================================================================")

    resultados = []

    polaridad = "alto" if args.active_high else "bajo"
    resultados.append(
        probar(
            f"gpiozero / lgpio (activo en {polaridad})",
            lambda: pitidos_gpiozero(args.pin, args.active_high),
        )
    )

    print("\n================================================================")
    if any(resultados):
        print("✅ Al menos un backend pudo controlar el GPIO.")
        print("   Si no se escuchó nada, el problema es eléctrico/físico:")
        print("   DIP switch, buzzer desconectado o pin distinto al esperado.")
    else:
        print("❌ Ningún backend pudo controlar el GPIO.")
        print("   Instala las librerías y vuelve a intentar:")
        print("   sudo apt install -y python3-gpiozero python3-lgpio")
        print("   y ejecuta con: sudo python3 hardware/test_buzzer_crowpi3.py")
    print("================================================================")


if __name__ == "__main__":
    main()
