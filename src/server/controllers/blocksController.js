// ===================================================================
// Controlador de Bloques Institucionales — PostgreSQL
// ===================================================================
const db = require('../config/db');

/**
 * Consulta la lista de bloques institucionales y el conteo de salas en cada uno
 * @route GET /api/blocks
 * @param {import('express').Request} req - Petición
 * @param {import('express').Response} res - Listado de bloques
 */
const getBlocks = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.*, COUNT(r.id)::int as rooms_count
       FROM blocks b
       LEFT JOIN rooms r ON r.block_id = b.id
       GROUP BY b.id
       ORDER BY b.id ASC`
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al consultar bloques: ' + error.message });
  }
};

/**
 * Consulta el detalle de un bloque institucional por su ID
 * @route GET /api/blocks/:id
 * @param {import('express').Request} req - Petición con ID en params
 * @param {import('express').Response} res - Datos del bloque
 */
const getBlockById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(`SELECT * FROM blocks WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bloque no encontrado' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Registra un nuevo bloque en el campus universitario
 * @route POST /api/blocks
 * @param {import('express').Request} req - Datos del bloque
 * @param {import('express').Response} res - Bloque creado
 */
const createBlock = async (req, res) => {
  try {
    const { name, description, location_info } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Nombre de bloque requerido' });
    }
    const result = await db.query(
      `INSERT INTO blocks (name, description, location_info) VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), description, location_info]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Actualiza los datos de un bloque institucional
 * @route PUT /api/blocks/:id
 * @param {import('express').Request} req - Petición con ID y campos a actualizar
 * @param {import('express').Response} res - Bloque actualizado
 */
const updateBlock = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, location_info, is_active } = req.body;
    const result = await db.query(
      `UPDATE blocks
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           location_info = COALESCE($3, location_info),
           is_active = COALESCE($4, is_active)
       WHERE id = $5 RETURNING *`,
      [name, description, location_info, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bloque no encontrado' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Elimina un bloque institucional de la base de datos
 * @route DELETE /api/blocks/:id
 * @param {import('express').Request} req - Petición con ID en params
 * @param {import('express').Response} res - Confirmación de eliminación
 */
const deleteBlock = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(`DELETE FROM blocks WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bloque no encontrado' });
    }
    return res.json({ success: true, message: 'Bloque eliminado' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getBlocks, getBlockById, createBlock, updateBlock, deleteBlock };
