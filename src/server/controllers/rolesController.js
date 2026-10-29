// ===================================================================
// Controlador de Roles — Jerarquía RBAC Control de Acceso RFID
// ===================================================================
const db = require('../config/db');

const getRoles = async (req, res) => {
  try {
    return res.json({ success: true, data: db.memoryDb.roles });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener roles' });
  }
};

const getRoleById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const role = db.memoryDb.roles.find(r => r.id === id);
    if (!role) {
      return res.status(404).json({ success: false, error: 'Rol no encontrado' });
    }
    return res.json({ success: true, data: role });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener rol' });
  }
};

module.exports = { getRoles, getRoleById };
