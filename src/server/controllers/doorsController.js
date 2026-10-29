// ===================================================================
// Controlador de Puertas Inteligentes con Hardware RFID
// ===================================================================
const db = require('../config/db');
const wsService = require('../services/wsService');

const getDoors = async (req, res) => {
  try {
    const { room_id } = req.query;
    let doors = db.memoryDb.doors.map(d => {
      const room = db.memoryDb.rooms.find(r => r.id === d.room_id);
      const block = room ? db.memoryDb.blocks.find(b => b.id === room.block_id) : null;
      return {
        ...d,
        room_name: room ? room.name : 'Sin Sala',
        block_name: block ? block.name : 'Sin Bloque',
        room_has_alarm: room ? room.has_alarm : false,
        room_security_status: room ? room.security_status : 'normal'
      };
    });

    if (room_id) {
      doors = doors.filter(d => d.room_id === parseInt(room_id, 10));
    }

    return res.json({ success: true, data: doors });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener puertas' });
  }
};

const getDoorById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const door = db.memoryDb.doors.find(d => d.id === id);
    if (!door) {
      return res.status(404).json({ success: false, error: 'Puerta no encontrada' });
    }
    const room = db.memoryDb.rooms.find(r => r.id === door.room_id);
    const block = room ? db.memoryDb.blocks.find(b => b.id === room.block_id) : null;

    return res.json({
      success: true,
      data: {
        ...door,
        room_name: room ? room.name : 'Sin Sala',
        block_name: block ? block.name : 'Sin Bloque'
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener puerta' });
  }
};

const createDoor = async (req, res) => {
  try {
    const { room_id, name, door_type, hardware_ip, mac_address } = req.body;

    if (!room_id || !name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Sala y nombre de la puerta son obligatorios' });
    }

    const room = db.memoryDb.rooms.find(r => r.id === parseInt(room_id, 10));
    if (!room) {
      return res.status(404).json({ success: false, error: 'La sala especificada no existe' });
    }

    const newDoor = {
      id: db.nextIds.doors++,
      room_id: parseInt(room_id, 10),
      name: name.trim(),
      door_type: door_type || 'standard',
      hardware_ip: hardware_ip || '192.168.1.150',
      mac_address: mac_address || 'AA:BB:CC:DD:EE:FF',
      status: 'online',
      is_locked: true,
      last_heartbeat: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    db.memoryDb.doors.push(newDoor);

    wsService.broadcast('door_status', { doorId: newDoor.id, status: newDoor.status, isLocked: newDoor.is_locked });

    return res.status(201).json({
      success: true,
      data: {
        ...newDoor,
        room_name: room.name
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al registrar puerta' });
  }
};

const updateDoor = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const door = db.memoryDb.doors.find(d => d.id === id);
    if (!door) {
      return res.status(404).json({ success: false, error: 'Puerta no encontrada' });
    }

    const { room_id, name, door_type, hardware_ip, mac_address, status, is_locked } = req.body;

    if (room_id) door.room_id = parseInt(room_id, 10);
    if (name) door.name = name.trim();
    if (door_type) door.door_type = door_type;
    if (hardware_ip !== undefined) door.hardware_ip = hardware_ip;
    if (mac_address !== undefined) door.mac_address = mac_address;
    if (status) door.status = status;
    if (is_locked !== undefined) door.is_locked = is_locked;

    wsService.broadcast('door_status', { doorId: door.id, status: door.status, isLocked: door.is_locked });

    const room = db.memoryDb.rooms.find(r => r.id === door.room_id);
    return res.json({
      success: true,
      data: {
        ...door,
        room_name: room ? room.name : 'Sin Sala'
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al actualizar puerta' });
  }
};

const deleteDoor = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const index = db.memoryDb.doors.findIndex(d => d.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Puerta no encontrada' });
    }

    db.memoryDb.doors.splice(index, 1);
    return res.json({ success: true, message: 'Puerta eliminada exitosamente' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al eliminar puerta' });
  }
};

const unlockDoor = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const door = db.memoryDb.doors.find(d => d.id === id);
    if (!door) {
      return res.status(404).json({ success: false, error: 'Puerta no encontrada' });
    }

    door.is_locked = false;
    wsService.broadcast('door_status', { doorId: door.id, isLocked: false, action: 'unlocked' });

    // Auto-bloqueo simulado a los 5 segundos
    setTimeout(() => {
      door.is_locked = true;
      wsService.broadcast('door_status', { doorId: door.id, isLocked: true, action: 'locked' });
    }, 5000);

    return res.json({ success: true, message: 'Puerta desbloqueada temporalmente (5 segundos)', door });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al desbloquear puerta' });
  }
};

const heartbeat = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const door = db.memoryDb.doors.find(d => d.id === id);
    if (!door) {
      return res.status(404).json({ success: false, error: 'Puerta no encontrada' });
    }

    door.status = 'online';
    door.last_heartbeat = new Date().toISOString();
    return res.json({ success: true, status: 'ok' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error en heartbeat' });
  }
};

module.exports = { getDoors, getDoorById, createDoor, updateDoor, deleteDoor, unlockDoor, heartbeat };
