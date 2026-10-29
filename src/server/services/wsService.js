// ===================================================================
// Servicio de WebSocket para eventos en tiempo real
// Control de Acceso RFID y Validación Visual
// ===================================================================
const { WebSocketServer } = require('ws');

let wss = null;

/**
 * Inicializa el servidor WebSocket sobre un servidor HTTP existente
 * @param {import('http').Server} server
 */
const init = (server) => {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`🔌 WebSocket: Cliente conectado desde ${clientIp}`);

    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      console.log(`🔌 WebSocket: Cliente desconectado (${clientIp})`);
    });

    ws.on('error', (err) => {
      console.error('❌ WebSocket error:', err.message);
    });
  });

  // Ping cada 30 segundos para mantener conexiones vivas
  const interval = setInterval(() => {
    if (!wss) {
      clearInterval(interval);
      return;
    }
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('🔌 Servidor WebSocket inicializado');
};

/**
 * Difunde un evento a todos los clientes conectados
 * @param {string} eventType - Tipo de evento (access_attempt, new_alert, door_status)
 * @param {object} data - Datos del evento
 */
const broadcast = (eventType, data) => {
  if (!wss) return;

  const message = JSON.stringify({
    type: eventType,
    data,
    timestamp: new Date().toISOString(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
};

/**
 * Retorna el número de clientes conectados
 */
const getClientCount = () => {
  if (!wss) return 0;
  return wss.clients.size;
};

module.exports = { init, broadcast, getClientCount };
