// ===================================================================
// Controlador de Tarjetas RFID — Control de Acceso
// ===================================================================
const db = require('../config/db');

const getCards = async (req, res) => {
  try {
    const cards = db.memoryDb.rfid_cards.map(c => {
      const user = c.user_id ? db.memoryDb.users.find(u => u.id === c.user_id) : null;
      const role = user ? db.memoryDb.roles.find(r => r.id === user.role_id) : null;
      return {
        ...c,
        user_name: user ? `${user.first_name} ${user.last_name}` : null,
        user_email: user ? user.email : null,
        user_document: user ? user.document_id : null,
        user_role: role ? role.display_name : null
      };
    });
    return res.json({ success: true, data: cards });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener tarjetas' });
  }
};

const getCardById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const card = db.memoryDb.rfid_cards.find(c => c.id === id);
    if (!card) {
      return res.status(404).json({ success: false, error: 'Tarjeta no encontrada' });
    }
    const user = card.user_id ? db.memoryDb.users.find(u => u.id === card.user_id) : null;
    return res.json({ success: true, data: { ...card, user } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener tarjeta' });
  }
};

const enrollCard = async (req, res) => {
  try {
    const { uid, user_id, card_type, label } = req.body;
    if (!uid || !uid.trim()) {
      return res.status(400).json({ success: false, error: 'El UID de la tarjeta RFID es obligatorio' });
    }

    const cleanUid = uid.trim().replace(/[\s:\-]/g, '').toUpperCase();

    // Comprobar si ya existe
    let existing = db.memoryDb.rfid_cards.find(c => c.uid === cleanUid);
    if (existing) {
      if (user_id) {
        existing.user_id = parseInt(user_id, 10);
      }
      if (card_type) existing.card_type = card_type;
      if (label) existing.label = label;
      existing.is_active = true;
      existing.deactivated_at = null;
      return res.json({ success: true, message: 'Tarjeta ya existía, actualizada y reasignada', data: existing });
    }

    const newCard = {
      id: db.nextIds.rfid_cards++,
      uid: cleanUid,
      user_id: user_id ? parseInt(user_id, 10) : null,
      card_type: card_type || 'standard',
      is_active: true,
      label: label ? label.trim() : `Tarjeta ${cleanUid}`,
      enrolled_at: new Date().toISOString(),
      deactivated_at: null
    };

    db.memoryDb.rfid_cards.push(newCard);

    const user = newCard.user_id ? db.memoryDb.users.find(u => u.id === newCard.user_id) : null;
    return res.status(201).json({
      success: true,
      data: {
        ...newCard,
        user_name: user ? `${user.first_name} ${user.last_name}` : null
      }
    });
  } catch (error) {
    console.error('Error al enrolar tarjeta:', error);
    return res.status(500).json({ success: false, error: 'Error al registrar tarjeta' });
  }
};

const updateCard = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const card = db.memoryDb.rfid_cards.find(c => c.id === id);
    if (!card) {
      return res.status(404).json({ success: false, error: 'Tarjeta no encontrada' });
    }

    const { user_id, card_type, label, is_active } = req.body;
    if (user_id !== undefined) card.user_id = user_id ? parseInt(user_id, 10) : null;
    if (card_type) card.card_type = card_type;
    if (label !== undefined) card.label = label.trim();
    if (is_active !== undefined) {
      card.is_active = is_active;
      if (!is_active) {
        card.deactivated_at = new Date().toISOString();
      } else {
        card.deactivated_at = null;
      }
    }

    return res.json({ success: true, data: card });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al actualizar tarjeta' });
  }
};

const deactivateCard = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const card = db.memoryDb.rfid_cards.find(c => c.id === id);
    if (!card) {
      return res.status(404).json({ success: false, error: 'Tarjeta no encontrada' });
    }

    card.is_active = false;
    card.deactivated_at = new Date().toISOString();
    return res.json({ success: true, message: 'Tarjeta desactivada', data: card });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al desactivar tarjeta' });
  }
};

const deleteCard = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const index = db.memoryDb.rfid_cards.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Tarjeta no encontrada' });
    }

    db.memoryDb.rfid_cards.splice(index, 1);
    return res.json({ success: true, message: 'Tarjeta eliminada exitosamente' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al eliminar tarjeta' });
  }
};

module.exports = { getCards, getCardById, enrollCard, updateCard, deactivateCard, deleteCard };
