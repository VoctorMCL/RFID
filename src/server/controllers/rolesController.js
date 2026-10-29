// ===================================================================
// Controlador de Roles Institucionales — PostgreSQL
// ===================================================================
const db = require('../config/db');

const getRoles = async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM roles ORDER BY id ASC`);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al consultar roles: ' + error.message });
  }
};

const getRoleById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(`SELECT * FROM roles WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Rol no encontrado' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getRoles, getRoleById };
