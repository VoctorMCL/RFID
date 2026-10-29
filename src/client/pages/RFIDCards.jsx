import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Radio,
  Trash2,
  Power
} from 'lucide-react';

export const RFIDCards = () => {
  const { canManageInfrastructure, canManageSecurity } = useAuth();
  const [cards, setCards] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    uid: '',
    user_id: '',
    card_type: 'standard',
    label: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [cardsRes, usersRes] = await Promise.all([
        apiClient('/rfid-cards'),
        apiClient('/users')
      ]);

      if (cardsRes.success) setCards(cardsRes.data);
      if (usersRes.success) setUsers(usersRes.data);
    } catch (err) {
      console.error('Error cargando tarjetas RFID:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEnroll = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient('/rfid-cards/enroll', {
        method: 'POST',
        body: formData
      });
      if (res.success) {
        loadData();
        setIsModalOpen(false);
        setFormData({ uid: '', user_id: '', card_type: 'standard', label: '' });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (card) => {
    try {
      const res = await apiClient(`/rfid-cards/${card.id}`, {
        method: 'PUT',
        body: { is_active: !card.is_active }
      });
      if (res.success) {
        setCards(prev => prev.map(c => c.id === card.id ? { ...c, is_active: !card.is_active } : c));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Desea eliminar esta tarjeta RFID del ecosistema?')) return;
    try {
      const res = await apiClient(`/rfid-cards/${id}`, { method: 'DELETE' });
      if (res.success) {
        setCards(prev => prev.filter(c => c.id !== id));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredCards = cards.filter(c =>
    c.uid.toLowerCase().includes(search.toLowerCase()) ||
    (c.user_name && c.user_name.toLowerCase().includes(search.toLowerCase())) ||
    (c.label && c.label.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Puerto de Programación y Enrolamiento RFID</h1>
          <p className="page-subtitle">
            Gestión centralizada de credenciales físicas, tarjetas maestras y fichas de anulación
          </p>
        </div>
        {(canManageInfrastructure || canManageSecurity) && (
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />
            <span>Enrolar Nueva Tarjeta</span>
          </button>
        )}
      </div>

      {/* Puerto de Estado */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)'
            }}>
              <Radio size={20} />
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 600 }}>
                Puerto Maestro de Configuración y Enrolamiento: ACTIVO
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Ubicación Física: Portería Principal / Puesto de Control de Seguridad
              </div>
            </div>
          </div>
          <span className="badge badge-ok">LISTO PARA LECTURA</span>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="form-input font-mono"
            style={{ paddingLeft: '36px' }}
            placeholder="Buscar por UID Hex, nombre de titular o etiqueta..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
      </div>

      {/* Tabla de Tarjetas */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>UID (Código Físico)</th>
              <th>Titular Asignado</th>
              <th>Rol Institucional</th>
              <th>Tipo de Credencial</th>
              <th>Estado</th>
              <th>Fecha de Enrolamiento</th>
              {(canManageInfrastructure || canManageSecurity) && <th style={{ textAlign: 'right' }}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filteredCards.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No se encontraron tarjetas RFID registradas.
                </td>
              </tr>
            ) : (
              filteredCards.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="font-mono" style={{ fontWeight: 700, fontSize: '13.5px' }}>
                      {c.uid}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {c.label || 'Tarjeta estándar'}
                    </div>
                  </td>
                  <td>
                    {c.user_name ? (
                      <div>
                        <div style={{ fontWeight: 600 }}>{c.user_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Doc: {c.user_document}</div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Sin titular vinculado</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-neutral">
                      {c.user_role || 'No asignado'}
                    </span>
                  </td>
                  <td>
                    {c.card_type === 'master' ? (
                      <span className="badge badge-alert" style={{ fontSize: '10.5px' }}>
                        <ShieldCheck size={11} /> FICHA MAESTRA
                      </span>
                    ) : (
                      <span className="badge badge-neutral">ESTÁNDAR</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${c.is_active ? 'badge-ok' : 'badge-denied'}`}>
                      {c.is_active ? 'ACTIVA' : 'DESACTIVADA'}
                    </span>
                  </td>
                  <td className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {c.enrolled_at ? new Date(c.enrolled_at).toLocaleDateString('es-CO') : '—'}
                  </td>
                  {(canManageInfrastructure || canManageSecurity) && (
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => handleToggleActive(c)}
                          className="btn btn-secondary btn-sm"
                          title={c.is_active ? 'Desactivar tarjeta' : 'Activar tarjeta'}
                        >
                          <Power size={13} style={{ color: c.is_active ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--text-muted)' }}
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Enrolar Tarjeta */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Enrolar Nueva Tarjeta en el Puerto Maestro">
        <form onSubmit={handleEnroll}>
          <div className="form-group">
            <label className="form-label">UID Hexadecimal del Chip RFID</label>
            <input
              type="text"
              className="form-input font-mono"
              placeholder="Ej. A1B2C3D4 o captura directa del lector"
              value={formData.uid}
              onChange={e => setFormData({ ...formData, uid: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Asignar a Titular (Opcional)</label>
            <select
              className="form-select"
              value={formData.user_id}
              onChange={e => setFormData({ ...formData, user_id: e.target.value })}
            >
              <option value="">-- Sin asignar (Almacén de tarjetas) --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} ({u.document_id}) · {u.role_display}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Tipo de Credencial</label>
              <select
                className="form-select"
                value={formData.card_type}
                onChange={e => setFormData({ ...formData, card_type: e.target.value })}
              >
                <option value="standard">Estándar (Condicionada a Horario)</option>
                <option value="master">Ficha Maestra (Privilegios de Anulación)</option>
                <option value="temporary">Temporal (Visitantes)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Etiqueta Identificadora</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Carnet Docente 2026"
                value={formData.label}
                onChange={e => setFormData({ ...formData, label: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ margin: '14px -20px -20px', padding: '14px 20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Registrar en el Ecosistema</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
