#!/bin/bash
# ===================================================================
# Lanzador del Ecosistema de Control de Acceso RFID (Modo Servidor & Dev)
# Corporación Universitaria Lasallista
# ===================================================================

echo "================================================================"
echo "🔒 Ecosistema Inteligente de Control de Acceso RFID"
echo "🏛️  Corporación Universitaria Lasallista"
echo "================================================================"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detectar IP local en la red (LAN)
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$LAN_IP" ] && LAN_IP="127.0.0.1"

# Liberar puerto 4000 si ya estaba ocupado por una instancia anterior
BUSY_PID=$(lsof -ti :4000 2>/dev/null)
if [ -n "$BUSY_PID" ]; then
    echo "⚠️  Puerto 4000 ocupado por proceso(s) [PID $BUSY_PID]. Liberando puerto..."
    kill -9 $BUSY_PID 2>/dev/null || true
    sleep 1
fi

# Manejar cierre de procesos limpios
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios del ecosistema..."
    [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

# 1. Asegurar compilación del cliente si no existe dist/
if [ ! -d "$ROOT_DIR/dist" ] || [ ! -f "$ROOT_DIR/dist/index.html" ]; then
    echo "📦 Compilando assets del cliente en dist/..."
    cd "$ROOT_DIR" && npm run build
fi

# 2. Iniciar Servidor Unificado (Puerto 4000: API REST + WebSockets + Servidor SPA)
echo "🚀 Iniciando Servidor Unificado (Puerto 4000)..."
cd "$ROOT_DIR"
node src/server/server.js &
BACKEND_PID=$!

sleep 2

# Verificar si el servidor inició correctamente
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Error: El servidor en puerto 4000 no pudo iniciar."
    exit 1
fi

# 3. Iniciar opcionalmente Vite para Hot-Reload si se pasa --dev
if [ "$1" == "--dev" ] || [ "$MODE" == "dev" ]; then
    echo "⚛️  Iniciando Vite dev server en puerto 5173..."
    cd "$ROOT_DIR"
    npx vite --host 0.0.0.0 --port 5173 &
    FRONTEND_PID=$!
    sleep 2
fi

echo ""
echo "================================================================"
echo "✅ SERVIDOR ACTIVO Y LISTO PARA PRUEBAS (PC COMO SERVIDOR):"
echo "----------------------------------------------------------------"
echo "🌐 Plataforma Web (Acceso desde este PC):"
echo "   👉 http://localhost:4000"
echo ""
echo "📱 Acceso desde celulares, laptops u otros PCs en la misma red:"
echo "   👉 http://${LAN_IP}:4000"
echo ""
echo "🔌 WebSocket en tiempo real:"
echo "   👉 ws://${LAN_IP}:4000"
echo ""
echo "🔑 Credenciales de Acceso Web (Contraseña: acceso2026):"
echo "   • Administrador:  admin@lasallista.edu.co  (o usuario: admin)"
echo "   • Celador/Porter: celador@lasallista.edu.co (o usuario: celador)"
echo "   ℹ️  Estudiantes y profesores validan con carnet RFID en puertas."
echo "================================================================"
echo "Tip: Para dejar el servidor corriendo permanentemente en segundo plano,"
echo "     ejecute: nohup npm start > server.log 2>&1 &"
echo "Presione [Ctrl+C] para detener el servidor."

wait
