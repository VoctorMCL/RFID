// ===================================================================
// Controlador de Bloques Institucionales — Control de Acceso RFID
// ===================================================================
const db = require('../config/db');

const getBlocks = async (req, res) => {
  try {
    const blocksWithCounts = db.memoryDb.blocks.map(b => {
      const roomCount = db.memoryDb.rooms.filter(r => r.block_id === b.id).length;
      return {
        ...b,
        rooms_count: roomCount
      };
    });
    return res.json({ success: true, data: blocksWithCounts });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener bloques' });
  }
};

const getBlockById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const block = db.memoryDb.blocks.find(b => b.id === id);
    if (!block) {
      return res.status(404).json({ success: false, error: 'Bloque no encontrado' });
    }
    const rooms = db.memoryDb.rooms.filter(r => r.block_id === block.id);
    return res.json({ success: true, data: { ...block, rooms } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener bloque' });
  }
};

const createBlock = async (req, res) => {
  try {
    const { name, description, location_info } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre del bloque es obligatorio' });
    }

    const newBlock = {
      id: db.nextIds.blocks++,
      name: name.trim(),
      description: description ? description.trim() : '',
      location_info: location_info ? location_info.trim() : '',
      is_active: true,
      created_at: new Date().toISOString()
    };

    db.memoryDb.blocks.push(newBlock);
    return res.status(201).json({ success: true, data: { ...newBlock, rooms_count: 0 } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al crear bloque' });
  }
};

const updateBlock = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const block = db.memoryDb.blocks.find(b => b.id === id);
    if (!block) {
      return res.status(404).json({ success: false, error: 'Bloque no encontrado' });
    }

    const { name, description, location_info, is_active } = req.body;
    if (name) block.name = name.trim();
    if (description !== undefined) block.description = description.trim();
    if (location_info !== undefined) block.location_info = location_info.trim();
    if (is_active !== undefined) block.is_active = is_active;

    const rooms_count = db.memoryDb.rooms.filter(r => r.block_id === block.id).length;
    return res.json({ success: true, data: { ...block, rooms_count } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al actualizar bloque' });
  }
};

const deleteBlock = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const index = db.memoryDb.blocks.findIndex(b => b.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Bloque no encontrado' });
    }

    // Verificar si tiene salas asociadas
    const hasRooms = db.memoryDb.rooms.some(r => r.block_id === id);
    if (hasRooms) {
      return res.status(400).json({
        success: false,
        error: 'No se puede eliminar el bloque porque tiene salas asignadas. Elimine o mueva las salas primero.'
      });
    }

    db.memoryDb.blocks.splice(index, 1);
    return res.json({ success: true, message: 'Bloque eliminado correctamente' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al eliminar bloque' });
  }
};

module.exports = { getBlocks, getBlockById, createBlock, updateBlock, deleteBlock };
