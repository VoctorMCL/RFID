require('dotenv').config();
const http = require('http');
const os = require('os');
const app = require('./app');
const wsService = require('./services/wsService');

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`El puerto ${PORT} ya está en uso por otro proceso.`);
    console.error(`Ejecute: fuser -k ${PORT}/tcp  o  kill -9 $(lsof -ti :${PORT})`);
  } else {
    console.error('Error en el servidor HTTP/WS:', err);
  }
  process.exit(1);
});

wsService.init(server);

const getNetworkIps = () => Object.values(os.networkInterfaces())
  .flat()
  .filter((net) => net && net.family === 'IPv4' && !net.internal)
  .map((net) => net.address);

server.listen(PORT, HOST, () => {
  console.log('Control de Acceso RFID - Corporación Universitaria Lasallista');
  console.log(`Local: http://localhost:${PORT}`);
  getNetworkIps().forEach((ip) => {
    console.log(`LAN: http://${ip}:${PORT}`);
  });
  console.log(`WebSocket: ws://localhost:${PORT}`);
});
