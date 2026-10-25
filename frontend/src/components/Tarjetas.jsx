import React, { useState } from 'react';
import { CreditCard, Link as LinkIcon, AlertOctagon, Check, X, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';
import { sbInsert, sbUpdate, sbDelete, normUid } from '../services/supabase';

export default function Tarjetas({ tarjetas, personas, accesos, loadData }) {
  const [showModal, setShowModal] = useState(false);
  const [uid, setUid] = useState('');
  const [idPersona, setIdPersona] = useState('');
  const [tipoTarjeta, setTipoTarjeta] = useState('carnet_estudiantil');
  const [formError, setFormError] = useState('');
  const [hasVibrated, setHasVibrated] = useState(false);

  // Vincular último UID no registrado leído por la Raspberry Pi
  const handleCapturarUltimoUid = () => {
    const ultimoAccesoNoReg = accesos.find(
      (a) => a.resultado === 'denegado_no_registrado' && a.uid_leido
    );
    if (ultimoAccesoNoReg) {
      setUid(ultimoAccesoNoReg.uid_leido);
    } else {
      setFormError('No se han detectado tarjetas no registradas recientemente en el lector.');
      setHasVibrated(true);
      setTimeout(() => setHasVibrated(false), 600);
    }
  };

  const handleToggleEstado = async (tarjeta) => {
    try {
      await sbUpdate('tarjetas_rfid', 'id_tarjeta', tarjeta.id_tarjeta, {
        activa: !tarjeta.activa
      });
      loadData();
    } catch (err) {
      alert('Error al cambiar estado de la tarjeta: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Deseas desvincular o eliminar esta tarjeta?')) {
      try {
        await sbDelete('tarjetas_rfid', 'id_tarjeta', id);
        loadData();
      } catch (err) {
        alert('Error al eliminar: ' + err.message);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUid = normUid(uid);
    if (!cleanUid) {
      setFormError('El código UID de la tarjeta RFID es obligatorio.');
      setHasVibrated(true);
      setTimeout(() => setHasVibrated(false), 600);
      return;
    }

    // Verificar si ya existe
    const existe = tarjetas.some((t) => normUid(t.uid) === cleanUid);
    if (existe) {
      setFormError(`El UID ${cleanUid} ya se encuentra registrado en el sistema.`);
      setHasVibrated(true);
      setTimeout(() => setHasVibrated(false), 600);
      return;
    }

    try {
      await sbInsert('tarjetas_rfid', {
        uid: cleanUid,
        id_persona: idPersona ? Number(idPersona) : null,
        tipo_tarjeta: tipoTarjeta,
        activa: true
      });
      setShowModal(false);
      setUid('');
      setIdPersona('');
      setFormError('');
      loadData();
    } catch (err) {
      setFormError('Error al guardar: ' + err.message);
      setHasVibrated(true);
      setTimeout(() => setHasVibrated(false), 600);
    }
  };

  return (
    <div>
      {/* Barra Superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
          Gestión de credenciales RFID/NFC (Mifare Classic 1K / 13.56 MHz).
        </p>

        <button className="btn btn-primary" onClick={() => { setFormError(''); setShowModal(true); }}>
          <CreditCard size={16} /> Vincular Nueva Tarjeta
        </button>
      </div>

      {/* Tabla de Tarjetas */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>UID de Tarjeta</th>
              <th>Titular Asignado</th>
              <th>Tipo de Credencial</th>
              <th>Estado</th>
              <th>Fecha de Emisión</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tarjetas.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                  No hay tarjetas registradas en el sistema.
                </td>
              </tr>
            ) : (
              tarjetas.map((t) => {
                const persona = personas.find((p) => p.id_persona === t.id_persona);
                return (
                  <tr key={t.id_tarjeta}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '1px' }}>
                      {t.uid}
                    </td>
                    <td>
                      {persona ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{persona.nombre} {persona.apellido}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>CC {persona.documento_identidad}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Sin asignar</span>
                      )}
                    </td>
                    <td>{t.tipo_tarjeta || 'Carnet Estudiantil'}</td>
                    <td>
                      <span className={`pill ${t.activa ? 'pill-ok' : 'pill-fail'}`}>
                        {t.activa ? 'Activa' : 'Revocada'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                      {t.fecha_emision ? new Date(t.fecha_emision).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          className={`btn btn-sm ${t.activa ? 'btn-danger' : 'btn-outline'}`}
                          onClick={() => handleToggleEstado(t)}
                        >
                          {t.activa ? 'Revocar' : 'Reactivar'}
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleDelete(t.id_tarjeta)}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Vincular Tarjeta con Animación de Vibración */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Vincular Tarjeta RFID/NFC</h3>
              <button onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div
                    className={`alert-box error ${hasVibrated ? 'vibrate-error' : ''}`}
                    style={{
                      background: 'var(--danger-soft)',
                      border: '1px solid var(--danger)',
                      color: 'var(--danger)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <AlertCircle size={16} /> {formError}
                  </div>
                )}

                <div className="field-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="field-label">Código UID (Hexadecimal) *</label>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--accent)' }}
                      onClick={handleCapturarUltimoUid}
                    >
                      <Sparkles size={12} /> Usar último UID leído
                    </button>
                  </div>
                  <input
                    type="text"
                    className={`input-text ${formError && !uid ? 'input-error' : ''}`}
                    style={{ fontFamily: 'var(--font-mono)' }}
                    placeholder="Ej. A1B2C3D4"
                    value={uid}
                    onChange={(e) => setUid(e.target.value.toUpperCase())}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Persona Titular</label>
                  <select value={idPersona} onChange={(e) => setIdPersona(e.target.value)}>
                    <option value="">-- Dejar sin asignar temporalmente --</option>
                    {personas.map((p) => (
                      <option key={p.id_persona} value={p.id_persona}>
                        {p.nombre} {p.apellido} (CC {p.documento_identidad}) - {p.tipo_persona}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label">Tipo de Credencial</label>
                  <select value={tipoTarjeta} onChange={(e) => setTipoTarjeta(e.target.value)}>
                    <option value="carnet_estudiantil">Carnet Estudiantil</option>
                    <option value="carnet_docente">Carnet Docente</option>
                    <option value="pase_visitante">Pase Temporal de Visitante</option>
                    <option value="llavero_rfid">Llavero / Token RFID</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Vincular Tarjeta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
