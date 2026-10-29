// ===================================================================
// Controlador de Usuarios — Control de Acceso RFID
// ===================================================================
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const getUsers = async (req, res) => {
  try {
    const { role_id, status, search } = req.query;

    let users = db.memoryDb.users.map(u => {
      const role = db.memoryDb.roles.find(r => r.id === u.role_id);
      const card = db.memoryDb.rfid_cards.find(c => c.user_id === u.id && c.is_active);
      return {
        ...u,
        password_hash: undefined,
        role_name: role ? role.name : 'desconocido',
        role_display: role ? role.display_name : 'Desconocido',
        global_access: role ? role.global_access : false,
        rfid_tag: card ? card.uid : null,
        rfid_card_id: card ? card.id : null
      };
    });

    if (role_id) {
      users = users.filter(u => u.role_id === parseInt(role_id, 10));
    }
    if (status) {
      users = users.filter(u => u.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      users = users.filter(u =>
        u.first_name.toLowerCase().includes(q) ||
        u.last_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.document_id.includes(q) ||
        (u.rfid_tag && u.rfid_tag.toLowerCase().includes(q))
      );
    }

    return res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

const getUserById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = db.memoryDb.users.find(u => u.id === id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    const role = db.memoryDb.roles.find(r => r.id === user.role_id);
    const cards = db.memoryDb.rfid_cards.filter(c => c.user_id === user.id);

    return res.json({
      success: true,
      data: {
        ...user,
        password_hash: undefined,
        role,
        cards
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

const createUser = async (req, res) => {
  try {
    const { first_name, last_name, email, password, document_id, role_id, program, phone, rfid_uid, access_expiry } = req.body;

    if (!first_name || !last_name || !email || !document_id || !role_id) {
      return res.status(400).json({ success: false, error: 'Campos requeridos incompletos' });
    }

    // Verificar unicidad de email o documento
    const exists = db.memoryDb.users.some(u => u.email.toLowerCase() === email.toLowerCase() || u.document_id === document_id);
    if (exists) {
      return res.status(400).json({ success: false, error: 'Ya existe un usuario con este correo o documento' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password || 'acceso2026', salt);

    const newId = db.nextIds.users++;
    const newUser = {
      id: newId,
      first_name,
      last_name,
      email: email.toLowerCase(),
      password_hash,
      document_id,
      role_id: parseInt(role_id, 10),
      program: program || null,
      phone: phone || null,
      status: 'active',
      access_expiry: access_expiry || null,
      created_at: new Date().toISOString()
    };

    db.memoryDb.users.push(newUser);

    // Si se especificó una tarjeta RFID
    if (rfid_uid && rfid_uid.trim()) {
      const cleanUid = rfid_uid.trim().toUpperCase();
      let existingCard = db.memoryDb.rfid_cards.find(c => c.uid === cleanUid);
      if (existingCard) {
        existingCard.user_id = newId;
        existingCard.is_active = true;
      } else {
        const cardId = db.nextIds.rfid_cards++;
        db.memoryDb.rfid_cards.push({
          id: cardId,
          uid: cleanUid,
          user_id: newId,
          card_type: newUser.role_id === 1 || newUser.role_id === 4 ? 'master' : 'standard',
          is_active: true,
          label: `Tarjeta ${first_name} ${last_name}`,
          enrolled_at: new Date().toISOString()
        });
      }
    }

    const role = db.memoryDb.roles.find(r => r.id === newUser.role_id);
    return res.status(201).json({
      success: true,
      data: {
        ...newUser,
        password_hash: undefined,
        role_name: role ? role.name : 'desconocido',
        role_display: role ? role.display_name : 'Desconocido',
        rfid_tag: rfid_uid || null
      }
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return res.status(500).json({ success: false, error: 'Error al registrar usuario' });
  }
};

const updateUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = db.memoryDb.users.find(u => u.id === id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const { first_name, last_name, email, document_id, role_id, program, phone, status, rfid_uid, password } = req.body;

    if (first_name) user.first_name = first_name;
    if (last_name) user.last_name = last_name;
    if (email) user.email = email.toLowerCase();
    if (document_id) user.document_id = document_id;
    if (role_id) user.role_id = parseInt(role_id, 10);
    if (program !== undefined) user.program = program;
    if (phone !== undefined) user.phone = phone;
    if (status) user.status = status;

    if (password && password.trim()) {
      user.password_hash = await bcrypt.hash(password, 10);
    }

    if (rfid_uid !== undefined) {
      if (rfid_uid && rfid_uid.trim()) {
        const cleanUid = rfid_uid.trim().toUpperCase();
        let card = db.memoryDb.rfid_cards.find(c => c.user_id === user.id && c.is_active);
        if (card) {
          card.uid = cleanUid;
        } else {
          db.memoryDb.rfid_cards.push({
            id: db.nextIds.rfid_cards++,
            uid: cleanUid,
            user_id: user.id,
            card_type: user.role_id === 1 || user.role_id === 4 ? 'master' : 'standard',
            is_active: true,
            label: `Tarjeta ${user.first_name}`,
            enrolled_at: new Date().toISOString()
          });
        }
      }
    }

    return res.json({
      success: true,
      data: {
        ...user,
        password_hash: undefined
      }
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return res.status(500).json({ success: false, error: 'Error al actualizar usuario' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const index = db.memoryDb.users.findIndex(u => u.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    // Desvincular tarjetas asociadas
    db.memoryDb.rfid_cards.forEach(c => {
      if (c.user_id === id) {
        c.user_id = null;
        c.is_active = false;
      }
    });

    db.memoryDb.users.splice(index, 1);
    return res.json({ success: true, message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al eliminar usuario' });
  }
};

module.exports = { getUsers, getUserById, createUser, updateUser, deleteUser };
