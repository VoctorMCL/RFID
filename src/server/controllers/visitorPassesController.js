// ===================================================================
// Controlador de Pases de Visitantes y Asignación Temporal RFID — PostgreSQL
// Control de Acceso Institucional — Corporación Universitaria Lasallista
// ===================================================================
const db = require('../config/db');
const wsService = require('../services/wsService');

/**
 * Obtener listado de pases de visitantes y préstamos temporales
 * GET /api/visitor-passes
 */
const getPasses = async (req, res) => {
  try {
    const { status, search } = req.query;

    let queryText = `
      SELECT vp.*,
             u.first_name as issuer_first_name,
             u.last_name as issuer_last_name,
             (u.first_name || ' ' || u.last_name) as issuer_name,
             c.is_active as card_is_active
      FROM visitor_passes vp
      LEFT JOIN users u ON u.id = vp.issued_by
      LEFT JOIN rfid_cards c ON c.uid = vp.card_uid
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      queryText += ` AND vp.status = $${params.length}`;
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term);
      queryText += ` AND (
        LOWER(vp.full_name) LIKE $${params.length} OR
        LOWER(vp.document_id) LIKE $${params.length} OR
        LOWER(vp.card_uid) LIKE $${params.length} OR
        LOWER(COALESCE(vp.destination, '')) LIKE $${params.length} OR
        LOWER(COALESCE(vp.reason, '')) LIKE $${params.length}
      )`;
    }

    queryText += ` ORDER BY vp.entry_time DESC`;

    const result = await db.query(queryText, params);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error obteniendo pases de visitantes:', error);
    return res.status(500).json({ success: false, error: 'Error al consultar pases de visitantes: ' + error.message });
  }
};

/**
 * Registrar un nuevo pase/préstamo de tarjeta física (vínculo obligatorio por sensor)
 * POST /api/visitor-passes
 */
const createPass = async (req, res) => {
  try {
    const {
      card_uid,
      person_type,
      full_name,
      document_id,
      phone,
      destination,
      reason,
      missing_card_reason,
      notes
    } = req.body;

    if (!card_uid || !card_uid.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Es OBLIGATORIO vincular una tarjeta física leída por el sensor.'
      });
    }

    if (!person_type || !full_name || !document_id || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Los campos Tipo de Persona, Nombre, Documento y Motivo son requeridos.'
      });
    }

    if (person_type === 'student' && (!missing_card_reason || !missing_card_reason.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Para estudiantes es obligatorio registrar el motivo por el cual no porta su carnet institucional.'
      });
    }

    const cleanUid = card_uid.trim().replace(/[\s:\-]/g, '').toUpperCase();
    const issuerId = req.user?.id || null;

    // Verificar si esta tarjeta ya tiene un pase activo sin devolver
    const activeCheck = await db.query(
      `SELECT id, full_name FROM visitor_passes WHERE card_uid = $1 AND status = 'active' LIMIT 1`,
      [cleanUid]
    );

    if (activeCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: `La tarjeta física [${cleanUid}] ya se encuentra en uso activo asignada a ${activeCheck.rows[0].full_name}. Debe registrar su devolución antes de reasignarla.`
      });
    }

    // 1. Asegurar la tarjeta en rfid_cards como 'temporary' y activa
    await db.query(
      `INSERT INTO rfid_cards (uid, user_id, card_type, is_active, label, enrolled_at)
       VALUES ($1, NULL, 'temporary', true, $2, NOW())
       ON CONFLICT (uid) DO UPDATE
       SET card_type = 'temporary', is_active = true, label = $2`,
      [cleanUid, `Pase Temporal: ${full_name}`]
    );

    // 2. Registrar el pase en visitor_passes
    const insertResult = await db.query(
      `INSERT INTO visitor_passes (
         card_uid, person_type, full_name, document_id, phone,
         destination, reason, missing_card_reason, issued_by,
         entry_time, status, notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'active', $10)
       RETURNING *`,
      [
        cleanUid,
        person_type,
        full_name.trim(),
        document_id.trim(),
        phone ? phone.trim() : null,
        destination ? destination.trim() : 'Campus General',
        reason.trim(),
        person_type === 'student' ? missing_card_reason.trim() : null,
        issuerId,
        notes ? notes.trim() : null
      ]
    );

    const newPass = insertResult.rows[0];

    // Emitir evento WebSocket para actualización instantánea
    wsService.broadcast('visitor_pass_created', newPass);

    return res.status(201).json({
      success: true,
      message: 'Pase de seguridad y tarjeta vinculada exitosamente.',
      data: newPass
    });
  } catch (error) {
    console.error('Error registrando pase de visitante:', error);
    return res.status(500).json({ success: false, error: 'Error al registrar pase: ' + error.message });
  }
};

/**
 * Registrar devolución de la tarjeta y salida del campus
 * PUT /api/visitor-passes/:id/return
 */
const returnPass = async (req, res) => {
  try {
    const passId = parseInt(req.params.id, 10);

    const checkPass = await db.query(
      `SELECT * FROM visitor_passes WHERE id = $1`,
      [passId]
    );

    if (checkPass.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Registro de pase no encontrado.' });
    }

    const pass = checkPass.rows[0];

    if (pass.status === 'returned') {
      return res.status(400).json({ success: false, error: 'Este pase ya fue devuelto anteriormente.' });
    }

    // Actualizar estado del pase a 'returned'
    const updateResult = await db.query(
      `UPDATE visitor_passes
       SET status = 'returned',
           exit_time = NOW()
       WHERE id = $1
       RETURNING *`,
      [passId]
    );

    const updatedPass = updateResult.rows[0];

    // Desactivar temporalmente la tarjeta física para que no quede activa sin titular
    await db.query(
      `UPDATE rfid_cards
       SET is_active = false,
           label = 'Pase Temporal Disponible'
       WHERE uid = $1`,
      [pass.card_uid]
    );

    // Emitir evento WebSocket
    wsService.broadcast('visitor_pass_returned', updatedPass);

    return res.json({
      success: true,
      message: `Devolución registrada exitosamente. Tarjeta [${pass.card_uid}] liberada al almacén de portería.`,
      data: updatedPass
    });
  } catch (error) {
    console.error('Error registrando devolución de pase:', error);
    return res.status(500).json({ success: false, error: 'Error al registrar devolución: ' + error.message });
  }
};

/**
 * Eliminar registro de pase (solo admin)
 * DELETE /api/visitor-passes/:id
 */
const deletePass = async (req, res) => {
  try {
    const passId = parseInt(req.params.id, 10);
    await db.query(`DELETE FROM visitor_passes WHERE id = $1`, [passId]);
    return res.json({ success: true, message: 'Registro eliminado exitosamente.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getPasses,
  createPass,
  returnPass,
  deletePass
};
