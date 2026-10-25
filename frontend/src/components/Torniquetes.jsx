import React, { useState } from 'react';
import { DoorClosed, Plus, CheckCircle, X, AlertCircle } from 'lucide-react';
import { sbInsert } from '../services/supabase';

export default function Torniquetes({
  torniquetes,
  currentTorniquete,
  setCurrentTorniquete,
  loadData
}) {
  const [showModal, setShowModal] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [formError, setFormError] = useState('');
  const [hasVibrated, setHasVibrated] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !ubicacion.trim()) {
      setFormError('Nombre y ubicación son obligatorios.');
      setHasVibrated(true);
      setTimeout(() => setHasVibrated(false), 600);
      return;
    }

    try {
      await sbInsert('torniquetes', {
        nombre: nombre.trim(),
        ubicacion: ubicacion.trim(),
        activo: true
      });
      setShowModal(false);
      setNombre('');
      setUbicacion('');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
          Gestión de puntos de acceso físico y torniquetes del campus universitario.
        </p>

        <button className="btn btn-primary" onClick={() => { setFormError(''); setShowModal(true); }}>
          <Plus size={16} /> Agregar Torniquete
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {torniquetes.map((t) => {
          const isSelected = t.id_torniquete === currentTorniquete;
          return (
            <div
              key={t.id_torniquete}
              style={{
                background: 'var(--bg-card)',
                border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
                boxShadow: isSelected ? '0 0 0 3px var(--accent-soft)' : 'var(--card-shadow)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="pill pill-ok">En Línea</span>
                  {isSelected && (
                    <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle size={13} /> Activo en Escáner
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{t.nombre}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>{t.ubicacion}</p>
              </div>

              <button
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                style={{ width: '100%' }}
                onClick={() => setCurrentTorniquete(t.id_torniquete)}
              >
                {isSelected ? 'Torniquete Seleccionado' : 'Establecer como Activo'}
              </button>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Nuevo Torniquete de Acceso</h3>
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
                  <label className="field-label">Nombre del Torniquete *</label>
                  <input
                    type="text"
                    className={`input-text ${formError && !nombre ? 'input-error' : ''}`}
                    placeholder="Ej. Torniquete 1 — Portería Principal"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Ubicación Física *</label>
                  <input
                    type="text"
                    className={`input-text ${formError && !ubicacion ? 'input-error' : ''}`}
                    placeholder="Ej. Carrera 51 #118 Sur 57"
                    value={ubicacion}
                    onChange={(e) => setUbicacion(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear Torniquete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
