// ===================================================================
// Punto de Entrada del Servidor Backend (HTTP + WebSockets)
// Control de Acceso RFID y Monitoreo Institucional
// ===================================================================
require('dotenv').config();
const http = require('http');
const os = require('os');
const app = require('./app');
const wsService = require('./services/wsService');

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

// Crear servidor HTTP
const server = http.createServer(app);

// Manejador de errores del servidor (ej. puerto ocupado EADDRINUSE)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: El puerto ${PORT} ya está en uso por otro proceso.`);
    console.error(`👉 Ejecute: fuser -k ${PORT}/tcp  o  kill -9 $(lsof -ti :${PORT}) para liberarlo.\n`);
    process.exit(1);
  } else {
    console.error('❌ Error en el servidor HTTP/WS:', err);
    process.exit(1);
  }
});

// Inicializar WebSocket Server
wsService.init(server);

// Obtener direcciones IP locales de la máquina
const getNetworkIps = () => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
};

// Iniciar escucha en 0.0.0.0 para acceso local y remoto
server.listen(PORT, HOST, () => {
  const ips = getNetworkIps();
  console.log('================================================================');
  console.log('🔒 Ecosistema Inteligente de Control de Acceso RFID');
  console.log('🏛️  Corporación Universitaria Lasallista');
  console.log('----------------------------------------------------------------');
  console.log(`🚀 Acceso Local:      http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(`🌐 Acceso en Red LAN: http://${ip}:${PORT}`);
  });
  console.log(`🔌 WebSockets Live:   ws://localhost:${PORT}`);
  console.log('----------------------------------------------------------------');
  console.log('🔑 Credenciales Web (Contraseña: acceso2026):');
  console.log('   • Administrador:  admin@lasallista.edu.co  (o: admin)');
  console.log('   • Celador/Porter: celador@lasallista.edu.co (o: celador)');
  console.log('================================================================');
});
