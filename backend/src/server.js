// ===================================================================
// Punto de Entrada del Servidor Backend (HTTP + WebSockets)
// Control de Acceso RFID y Monitoreo Institucional
// ===================================================================
require('dotenv').config();
const http = require('http');
const app = require('./app');
const wsService = require('./services/wsService');

const PORT = process.env.PORT || 4000;

// Crear servidor HTTP
const server = http.createServer(app);

// Inicializar WebSocket Server
wsService.init(server);

// Iniciar escucha
server.listen(PORT, () => {
  console.log('================================================================');
  console.log('🔒 Ecosistema Inteligente de Control de Acceso RFID');
  console.log('🏛️  Corporación Universitaria Lasallista');
  console.log(`🚀 Servidor ejecutándose en: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket Server activo en: ws://localhost:${PORT}`);
  console.log('================================================================');
});
