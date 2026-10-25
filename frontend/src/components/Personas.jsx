import React, { useState } from 'react';
import { UserPlus, Search, Trash2, User, Check, X, AlertCircle } from 'lucide-react';
import { sbInsert, sbDelete, colorFromString, getInitials } from '../services/supabase';

export default function Personas({ personas, loadData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [hasVibrated, setHasVibrated] = useState(false);

  // Form State
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [documento, setDocumento] = useState('');
  const [tipo, setTipo] = useState('estudiante');
  const [programa, setPrograma] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [fechaExp, setFechaExp] = useState('');

  const filteredPersonas = personas.filter((p) => {
    const text = `${p.nombre} ${p.apellido} ${p.documento_identidad} ${p.programa || ''}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !apellido.trim() || !documento.trim()) {
      setFormError('Nombre, apellido y documento de identidad son obligatorios');
      setHasVibrated(true);
      setTimeout(() => setHasVibrated(false), 600);
      return;
    }

    try {
      await sbInsert('personas', {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        documento_identidad: documento.trim(),
        tipo_persona: tipo,
        programa: programa.trim() || null,
        foto_path: fotoUrl.trim() || null,
        fecha_expiracion: tipo === 'visitante' && fechaExp ? fechaExp : null,
        activo: true
      });
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err) {
      setFormError('Error al guardar: ' + err.message);
      setHasVibrated(true);
      setTimeout(() => setHasVibrated(false), 600);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Deseas eliminar esta persona del sistema?')) {
      try {
        await sbDelete('personas', 'id_persona', id);
        loadData();
      } catch (err) {
        alert('No se pudo eliminar: ' + err.message);
      }
    }
  };

  const resetForm = () => {
    setNombre('');
    setApellido('');
    setDocumento('');
    setTipo('estudiante');
    setPrograma('');
    setFotoUrl('');
    setFechaExp('');
    setFormError('');
  };

  return (
    <div>
      {/* Barra Superior con Búsqueda y Botón Registrar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="input-text"
            style={{ width: '100%', paddingLeft: '36px' }}
            placeholder="Buscar por nombre, documento o programa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <UserPlus size={16} /> Registrar Persona
        </button>
      </div>

      {/* Tabla de Personas */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '60px' }}>Foto</th>
              <th>Nombre Completo</th>
              <th>Documento</th>
              <th>Rol / Tipo</th>
              <th>Programa o Dependencia</th>
              <th>Vigencia</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPersonas.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                  No se encontraron personas registradas.
                </td>
              </tr>
            ) : (
              filteredPersonas.map((p) => (
                <tr key={p.id_persona}>
                  <td>
                    {p.foto_path ? (
                      <img
                        src={p.foto_path}
                        alt="Avatar"
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: colorFromString(p.documento_identidad),
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '12px'
                        }}
                      >
                        {getInitials(p.nombre, p.apellido)}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.nombre} {p.apellido}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{p.documento_identidad}</td>
                  <td>
                    <span className={`pill ${p.tipo_persona === 'docente' ? 'pill-info' : p.tipo_persona === 'visitante' ? 'pill-fail' : 'pill-ok'}`}>
                      {p.tipo_persona}
                    </span>
                  </td>
                  <td>{p.programa || '—'}</td>
                  <td>
                    {p.fecha_expiracion ? (
                      <span style={{ fontSize: '12px', color: new Date(p.fecha_expiracion) < new Date() ? 'var(--danger)' : 'inherit' }}>
                        {p.fecha_expiracion}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>Indefinida</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn btn-danger btn-sm"
                      title="Eliminar"
                      onClick={() => handleDelete(p.id_persona)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Persona con Animación de Vibración en Errores */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Registrar Nueva Persona</h3>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="field-group">
                    <label className="field-label">Nombre *</label>
                    <input
                      type="text"
                      className={`input-text ${formError && !nombre ? 'input-error' : ''}`}
                      placeholder="Ej. Victor Manuel"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Apellido *</label>
                    <input
                      type="text"
                      className={`input-text ${formError && !apellido ? 'input-error' : ''}`}
                      placeholder="Ej. Cordoba Larez"
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="field-group">
                    <label className="field-label">Documento de Identidad *</label>
                    <input
                      type="text"
                      className={`input-text ${formError && !documento ? 'input-error' : ''}`}
                      placeholder="Cédula / Documento"
                      value={documento}
                      onChange={(e) => setDocumento(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Tipo de Persona</label>
                    <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                      <option value="estudiante">Estudiante</option>
                      <option value="docente">Docente</option>
                      <option value="administrativo">Administrativo</option>
                      <option value="visitante">Visitante</option>
                    </select>
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">Programa Académico o Dependencia</label>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="Ej. Ingeniería de Software"
                    value={programa}
                    onChange={(e) => setPrograma(e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">URL de Fotografía (Para Validación Visual)</label>
                  <input
                    type="url"
                    className="input-text"
                    placeholder="https://ejemplo.com/foto.jpg"
                    value={fotoUrl}
                    onChange={(e) => setFotoUrl(e.target.value)}
                  />
                </div>

                {tipo === 'visitante' && (
                  <div className="field-group">
                    <label className="field-label">Fecha Límite de Expiración</label>
                    <input
                      type="date"
                      className="input-text"
                      value={fechaExp}
                      onChange={(e) => setFechaExp(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Persona
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
