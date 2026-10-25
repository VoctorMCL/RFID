#!/bin/bash
# ===================================================================
# Lanzador del Ecosistema Completo (Backend + Frontend React)
# Control de Acceso RFID — Corporación Universitaria Lasallista
# ===================================================================

echo "================================================================"
echo "🔒 Ecosistema Inteligente de Control de Acceso RFID"
echo "🏛️  Corporación Universitaria Lasallista"
echo "================================================================"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Función para terminar procesos al presionar Ctrl+C
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

# 1. Iniciar Backend
echo "🚀 Iniciando Backend (Node.js + Express + WebSockets) en puerto 4000..."
cd "$ROOT_DIR/backend"
node src/server.js &
BACKEND_PID=$!

sleep 2

# 2. Iniciar Frontend
echo "⚛️  Iniciando Frontend (React + Vite) en puerto 5173..."
cd "$ROOT_DIR/frontend"
npx vite --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

sleep 2

echo ""
echo "================================================================"
echo "✅ ECOSISTEMA ACTIVO Y OPERATIVO:"
echo "   💻 Frontend (React):  http://localhost:5173"
echo "   📡 Backend REST API:  http://localhost:4000/api"
echo "   🔌 WebSockets Live:   ws://localhost:4000"
echo ""
echo "🔑 Credenciales de Acceso a Plataforma Web (Contraseña: acceso2026):"
echo "   • Administrador:  admin@lasallista.edu.co (o usuario: admin)"
echo "   • Celador/Portero: celador@lasallista.edu.co (o usuario: celador)"
echo "   ℹ️  Estudiantes y profesores NO inician sesión web (validan por tarjeta RFID)"
echo "================================================================"
echo "Presione [Ctrl+C] para detener todos los servicios."

wait
