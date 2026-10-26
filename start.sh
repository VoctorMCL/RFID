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

# Manejar cierre de procesos limpios
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios del ecosistema..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

# 1. Asegurar compilación del frontend si no existe dist/
if [ ! -d "$ROOT_DIR/frontend/dist" ] || [ ! -f "$ROOT_DIR/frontend/dist/index.html" ]; then
    echo "📦 Compilando assets del frontend para modo servidor..."
    cd "$ROOT_DIR/frontend" && npm run build
fi

# 2. Iniciar Backend (Puerto 4000: API + WebSockets + Servidor Web SPA)
echo "🚀 Iniciando Servidor Unificado (Puerto 4000)..."
cd "$ROOT_DIR/backend"
node src/server.js &
BACKEND_PID=$!

sleep 2

# 3. Iniciar opcionalmente Frontend Vite (Puerto 5173 para Hot-Reload en desarrollo)
if [ "$1" == "--dev" ] || [ "$MODE" == "dev" ]; then
    echo "⚛️  Iniciando servidor Vite de desarrollo en puerto 5173..."
    cd "$ROOT_DIR/frontend"
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
echo "     ejecute: nohup npm run serve > server.log 2>&1 &"
echo "Presione [Ctrl+C] para detener el servidor."

wait
