const clockService = require('../services/clockService');

const getClock = async (req, res) => {
  try {
    const { date, simulated } = await clockService.getNow();
    return res.json({ success: true, data: { now: date.toISOString(), simulated, real_now: new Date().toISOString() } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al consultar el reloj: ' + error.message });
  }
};

const setClock = async (req, res) => {
  try {
    await clockService.setSimulation(req.body?.datetime ?? null);
    const { date, simulated } = await clockService.getNow();
    return res.json({ success: true, data: { now: date.toISOString(), simulated, real_now: new Date().toISOString() } });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

module.exports = { getClock, setClock };
