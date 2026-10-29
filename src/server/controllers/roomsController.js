// ===================================================================
// Controlador de Salas / Espacios — Control de Acceso RFID
// ===================================================================
const db = require('../config/db');

const getRooms = async (req, res) => {
  try {
    const { block_id } = req.query;
    let rooms = db.memoryDb.rooms.map(r => {
      const block = db.memoryDb.blocks.find(b => b.id === r.block_id);
      const doorsCount = db.memoryDb.doors.filter(d => d.room_id === r.id).length;
      return {
        ...r,
        block_name: block ? block.name : 'Sin Bloque',
        doors_count: doorsCount
      };
    });

    if (block_id) {
      rooms = rooms.filter(r => r.block_id === parseInt(block_id, 10));
    }

    return res.json({ success: true, data: rooms });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener salas' });
  }
};

const getRoomById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const room = db.memoryDb.rooms.find(r => r.id === id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Sala no encontrada' });
    }
    const block = db.memoryDb.blocks.find(b => b.id === room.block_id);
    const doors = db.memoryDb.doors.filter(d => d.room_id === room.id);
    const alarmZone = db.memoryDb.alarm_zones.find(az => az.room_id === room.id);

    return res.json({
      success: true,
      data: {
        ...room,
        block_name: block ? block.name : 'Sin Bloque',
        doors,
        alarm_zone: alarmZone || null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener sala' });
  }
};

const createRoom = async (req, res) => {
  try {
    const { block_id, name, floor, room_type, has_alarm, has_camera, motion_sensors, door_sensors, description } = req.body;

    if (!block_id || !name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Bloque y nombre de la sala son obligatorios' });
    }

    const block = db.memoryDb.blocks.find(b => b.id === parseInt(block_id, 10));
    if (!block) {
      return res.status(404).json({ success: false, error: 'El bloque asignado no existe' });
    }

    const newRoom = {
      id: db.nextIds.rooms++,
      block_id: parseInt(block_id, 10),
      name: name.trim(),
      floor: parseInt(floor || 1, 10),
      room_type: room_type || 'general',
      has_alarm: Boolean(has_alarm),
      has_camera: Boolean(has_camera),
      motion_sensors: parseInt(motion_sensors || 0, 10),
      door_sensors: parseInt(door_sensors || 0, 10),
      security_status: has_alarm ? 'armed' : 'normal',
      description: description ? description.trim() : '',
      is_active: true,
      created_at: new Date().toISOString()
    };

    db.memoryDb.rooms.push(newRoom);

    // Si tiene alarma, crear zona de alarma automática
    if (newRoom.has_alarm) {
      db.memoryDb.alarm_zones.push({
        id: db.nextIds.alarm_zones++,
        room_id: newRoom.id,
        zone_name: `Zona Alarma — ${newRoom.name}`,
        requires_security_clearance: true,
        is_armed: true,
        armed_at: new Date().toISOString()
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        ...newRoom,
        block_name: block.name,
        doors_count: 0
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al crear la sala' });
  }
};

const updateRoom = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const room = db.memoryDb.rooms.find(r => r.id === id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Sala no encontrada' });
    }

    const { block_id, name, floor, room_type, has_alarm, has_camera, motion_sensors, door_sensors, security_status, description, is_active } = req.body;

    if (block_id) room.block_id = parseInt(block_id, 10);
    if (name) room.name = name.trim();
    if (floor !== undefined) room.floor = parseInt(floor, 10);
    if (room_type) room.room_type = room_type;
    if (has_alarm !== undefined) room.has_alarm = Boolean(has_alarm);
    if (has_camera !== undefined) room.has_camera = Boolean(has_camera);
    if (motion_sensors !== undefined) room.motion_sensors = parseInt(motion_sensors, 10);
    if (door_sensors !== undefined) room.door_sensors = parseInt(door_sensors, 10);
    if (security_status) room.security_status = security_status;
    if (description !== undefined) room.description = description.trim();
    if (is_active !== undefined) room.is_active = is_active;

    const block = db.memoryDb.blocks.find(b => b.id === room.block_id);
    const doorsCount = db.memoryDb.doors.filter(d => d.room_id === room.id).length;

    return res.json({
      success: true,
      data: {
        ...room,
        block_name: block ? block.name : 'Sin Bloque',
        doors_count: doorsCount
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al actualizar sala' });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const index = db.memoryDb.rooms.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Sala no encontrada' });
    }

    // Eliminar puertas dependientes o advertir
    const doors = db.memoryDb.doors.filter(d => d.room_id === id);
    if (doors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'No se puede eliminar la sala porque tiene puertas registradas. Elimine las puertas primero.'
      });
    }

    db.memoryDb.rooms.splice(index, 1);
    return res.json({ success: true, message: 'Sala eliminada correctamente' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al eliminar sala' });
  }
};

module.exports = { getRooms, getRoomById, createRoom, updateRoom, deleteRoom };
