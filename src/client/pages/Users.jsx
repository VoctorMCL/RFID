import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import {
  Users as UsersIcon,
  Plus,
  Search,
  Edit,
  Trash2,
  CreditCard,
  Shield,
  Filter
} from 'lucide-react';

export const Users = () => {
  const { canManageInfrastructure } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    document_id: '',
    role_id: '3', // Estudiante por defecto
    program: '',
    phone: '',
    rfid_uid: '',
    password: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        apiClient('/users'),
        apiClient('/roles')
      ]);

      if (usersRes.success) setUsers(usersRes.data);
      if (rolesRes.success) setRoles(rolesRes.data);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      document_id: '',
      role_id: roles[0] ? roles[0].id.toString() : '3',
      program: '',
      phone: '',
      rfid_uid: '',
      password: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      document_id: user.document_id,
      role_id: user.role_id.toString(),
      program: user.program || '',
      phone: user.phone || '',
      rfid_uid: user.rfid_tag || '',
      password: ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const res = await apiClient(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: formData
        });
        if (res.success) {
          loadData();
          setIsModalOpen(false);
        }
      } else {
        const res = await apiClient('/users', {
          method: 'POST',
          body: formData
        });
        if (res.success) {
          loadData();
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este usuario del sistema?')) return;
    try {
      const res = await apiClient(`/users/${id}`, { method: 'DELETE' });
      if (res.success) {
        setUsers(prev => prev.filter(u => u.id !== id));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.first_name.toLowerCase().includes(search.toLowerCase()) ||
      u.last_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.document_id.includes(search) ||
      (u.rfid_tag && u.rfid_tag.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter ? u.role_id.toString() === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Directorio Institucional y Recursos Humanos</h1>
          <p className="page-subtitle">
            Gestión de permisos, roles académicos y vinculación de tarjetas RFID
          </p>
        </div>
        {canManageInfrastructure && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} />
            <span>Registrar Persona</span>
          </button>
        )}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '14px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px' }}
              placeholder="Buscar por nombre, documento, correo institucional o UID RFID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <select
            className="form-select"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option value="">Todos los Roles</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.display_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre Completo</th>
              <th>Documento</th>
              <th>Rol Institucional</th>
              <th>Programa / Área</th>
              <th>Tarjeta RFID</th>
              <th>Estado</th>
              {canManageInfrastructure && <th style={{ textAlign: 'right' }}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No se encontraron usuarios coincidentes con los filtros.
                </td>
              </tr>
            ) : (
              filteredUsers.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email}</div>
                  </td>
                  <td className="font-mono">{u.document_id}</td>
                  <td>
                    <span className="badge badge-neutral">
                      {u.role_display}
                    </span>
                  </td>
                  <td>{u.program || '—'}</td>
                  <td className="font-mono">
                    {u.rfid_tag ? (
                      <span className="badge badge-ok">{u.rfid_tag}</span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '11.5px' }}>Sin asignar</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${u.status === 'active' ? 'badge-ok' : 'badge-denied'}`}>
                      {u.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {canManageInfrastructure && (
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => openEditModal(u)}
                          className="btn btn-secondary btn-sm"
                          title="Editar"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
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

      {/* Modal Crear / Editar Usuario */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? `Editar Usuario: ${editingUser.first_name}` : 'Registrar Nuevo Usuario'}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Nombre(s)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Carlos"
                value={formData.first_name}
                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Apellido(s)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Gómez"
                value={formData.last_name}
                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Correo Institucional</label>
              <input
                type="email"
                className="form-input"
                placeholder="usuario@lasallista.edu.co"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Documento de Identidad</label>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="1000000000"
                value={formData.document_id}
                onChange={e => setFormData({ ...formData, document_id: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Rol Institucional</label>
              <select
                className="form-select"
                value={formData.role_id}
                onChange={e => setFormData({ ...formData, role_id: e.target.value })}
                required
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.display_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Programa / Dependencia</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Ingeniería de Software"
                value={formData.program}
                onChange={e => setFormData({ ...formData, program: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">UID Tarjeta RFID (Opcional)</label>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="Ej. A1B2C3D4"
                value={formData.rfid_uid}
                onChange={e => setFormData({ ...formData, rfid_uid: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}</label>
              <input
                type="password"
                className="form-input"
                placeholder={editingUser ? 'Dejar en blanco para conservar' : 'acceso2026'}
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ margin: '14px -20px -20px', padding: '14px 20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">
              {editingUser ? 'Guardar Cambios' : 'Registrar Persona'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
