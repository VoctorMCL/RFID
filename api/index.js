// ===================================================================
// Vercel Serverless Function Entry Point — Control de Acceso RFID
// Permite que la API de Express corra como Serverless en Vercel
// ===================================================================
const app = require('../backend/src/app');

module.exports = (req, res) => {
  return app(req, res);
};
