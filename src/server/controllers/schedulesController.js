// ===================================================================
// Controlador de Articulación Horaria (RRHH / Decanatura) — Control de Acceso RFID
// ===================================================================
const db = require('../config/db');

const getSchedules = async (req, res) => {
  try {
    const { user_id, room_id, day_of_week } = req.query;

    let schedules = db.memoryDb.schedules.map(s => {
      const user = db.memoryDb.users.find(u => u.id === s.user_id);
      const room = db.memoryDb.rooms.find(r => r.id === s.room_id);
      const block = room ? db.memoryDb.blocks.find(b => b.id === room.block_id) : null;
      return {
        ...s,
        user_name: user ? `${user.first_name} ${user.last_name}` : 'Usuario desconocido',
        user_email: user ? user.email : '',
        user_document: user ? user.document_id : '',
        room_name: room ? room.name : 'Sala desconocida',
        block_name: block ? block.name : 'Sin Bloque'
      };
    });

    if (user_id) {
      schedules = schedules.filter(s => s.user_id === parseInt(user_id, 10));
    }
    if (room_id) {
      schedules = schedules.filter(s => s.room_id === parseInt(room_id, 10));
    }
    if (day_of_week !== undefined) {
      schedules = schedules.filter(s => s.day_of_week === parseInt(day_of_week, 10));
    }

    return res.json({ success: true, data: schedules });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener horarios' });
  }
};

const getScheduleById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const schedule = db.memoryDb.schedules.find(s => s.id === id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Horario no encontrado' });
    }
    const user = db.memoryDb.users.find(u => u.id === schedule.user_id);
    const room = db.memoryDb.rooms.find(r => r.id === schedule.room_id);

    return res.json({
      success: true,
      data: {
        ...schedule,
        user_name: user ? `${user.first_name} ${user.last_name}` : '',
        room_name: room ? room.name : ''
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener horario' });
  }
};

const createSchedule = async (req, res) => {
  try {
    const { user_id, room_id, day_of_week, start_time, end_time, semester, subject_name } = req.body;

    if (!user_id || !room_id || day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ success: false, error: 'Todos los campos requeridos deben ser completados' });
    }

    const newSchedule = {
      id: db.nextIds.schedules++,
      user_id: parseInt(user_id, 10),
      room_id: parseInt(room_id, 10),
      day_of_week: parseInt(day_of_week, 10),
      start_time,
      end_time,
      semester: semester || '2026-2',
      subject_name: subject_name ? subject_name.trim() : 'Clase Programada',
      is_active: true,
      created_at: new Date().toISOString()
    };

    db.memoryDb.schedules.push(newSchedule);

    const user = db.memoryDb.users.find(u => u.id === newSchedule.user_id);
    const room = db.memoryDb.rooms.find(r => r.id === newSchedule.room_id);

    return res.status(201).json({
      success: true,
      data: {
        ...newSchedule,
        user_name: user ? `${user.first_name} ${user.last_name}` : '',
        room_name: room ? room.name : ''
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al crear horario' });
  }
};

const updateSchedule = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const schedule = db.memoryDb.schedules.find(s => s.id === id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Horario no encontrado' });
    }

    const { user_id, room_id, day_of_week, start_time, end_time, semester, subject_name, is_active } = req.body;
    if (user_id) schedule.user_id = parseInt(user_id, 10);
    if (room_id) schedule.room_id = parseInt(room_id, 10);
    if (day_of_week !== undefined) schedule.day_of_week = parseInt(day_of_week, 10);
    if (start_time) schedule.start_time = start_time;
    if (end_time) schedule.end_time = end_time;
    if (semester) schedule.semester = semester;
    if (subject_name !== undefined) schedule.subject_name = subject_name;
    if (is_active !== undefined) schedule.is_active = is_active;

    const user = db.memoryDb.users.find(u => u.id === schedule.user_id);
    const room = db.memoryDb.rooms.find(r => r.id === schedule.room_id);

    return res.json({
      success: true,
      data: {
        ...schedule,
        user_name: user ? `${user.first_name} ${user.last_name}` : '',
        room_name: room ? room.name : ''
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al actualizar horario' });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const index = db.memoryDb.schedules.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Horario no encontrado' });
    }

    db.memoryDb.schedules.splice(index, 1);
    return res.json({ success: true, message: 'Horario eliminado correctamente' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al eliminar horario' });
  }
};

module.exports = { getSchedules, getScheduleById, createSchedule, updateSchedule, deleteSchedule };
