import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useRfidSensor } from '../hooks/useRfidSensor';
import { Modal } from '../components/ui/Modal';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Radio,
  Check,
  X
} from 'lucide-react';

export const Users = () => {
  const { canManageInfrastructure } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    document_id: '',
    role_id: '3',
    program: '',
    phone: '',
    rfid_tag: ''
  });

  const { scannedUid, sensorStatus, reset: resetSensor } = useRfidSensor({
    active: isModalOpen,
    onScan: (uid) => setFormData((prev) => ({ ...prev, rfid_tag: uid }))
  });

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('radar-enrollment-state', { detail: { active: isModalOpen } })
    );

    return () => {
      if (isModalOpen) {
        window.dispatchEvent(
          new CustomEvent('radar-enrollment-state', { detail: { active: false } })
        );
      }
    };
  }, [isModalOpen]);

  const loadData = async () => {
    try {
      const [usersRes, rolesRes, programsRes] = await Promise.all([
        apiClient('/users'),
        apiClient('/roles'),
        apiClient('/programs')
      ]);

      if (usersRes.success) setUsers(usersRes.data);
      if (rolesRes.success) setRoles(rolesRes.data);
      if (programsRes.success) {
        setPrograms(programsRes.data);
        setFaculties(programsRes.faculties || []);
      }
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const defaultRoleId = () => {
    const studentRole = roles.find((role) => role.name === 'student');
    return studentRole ? studentRole.id.toString() : (roles[0]?.id.toString() || '5');
  };

  const getRoleName = (roleId) => (
    roles.find((role) => role.id.toString() === roleId?.toString())?.name || ''
  );

  const selectedRoleName = getRoleName(formData.role_id);
  const isStudentRole = selectedRoleName === 'student';
  const isProfessorRole = selectedRoleName === 'professor';
  const showAcademicField = isStudentRole || isProfessorRole;

  const handleRoleChange = (roleId) => {
    setFormData(prev => ({
      ...prev,
      role_id: roleId,
      program: ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isStudentRole && !formData.program) {
      alert('Seleccione un programa académico para el estudiante.');
      return;
    }

    if (isProfessorRole && !formData.program) {
      alert('Seleccione la facultad a la que pertenece el docente.');
      return;
    }

    try {
      const res = await apiClient(editingUser ? `/users/${editingUser.id}` : '/users', {
        method: editingUser ? 'PUT' : 'POST',
        body: {
          ...formData,
          program: showAcademicField ? formData.program : ''
        }
      });

      if (res.success) {
        resetSensor();
        setIsModalOpen(false);
        loadData();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    resetSensor();
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      document_id: '',
      role_id: defaultRoleId(),
      program: '',
      phone: '',
      rfid_tag: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    const roleName = user.role_name || getRoleName(user.role_id);
    let program = user.program || '';

    if (roleName === 'professor' && !faculties.includes(program)) program = '';
    if (roleName !== 'student' && roleName !== 'professor') program = '';

    setEditingUser(user);
    resetSensor();
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      document_id: user.document_id,
      role_id: user.role_id.toString(),
      program,
      phone: user.phone || '',
      rfid_tag: user.rfid_tag || ''
    });
    setIsModalOpen(true);
  };

  const clearCard = () => {
    if (editingUser && formData.rfid_tag && !window.confirm('¿Desvincular la tarjeta RFID de esta persona?')) {
      return;
    }
    resetSensor();
    setFormData((prev) => ({ ...prev, rfid_tag: '' }));
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

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre Completo</th>
              <th>Documento</th>
              <th>Rol Institucional</th>
              <th>Programa / Facultad</th>
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

          <div style={{ display: 'grid', gridTemplateColumns: showAcademicField ? '1fr 1fr' : '1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Rol Institucional</label>
              <select
                className="form-select"
                value={formData.role_id}
                onChange={e => handleRoleChange(e.target.value)}
                required
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.display_name}</option>
                ))}
              </select>
            </div>
            {isStudentRole && (
              <div className="form-group">
                <label className="form-label">Programa</label>
                <select
                  className="form-select"
                  value={formData.program}
                  onChange={e => setFormData({ ...formData, program: e.target.value })}
                  required
                >
                  <option value="">Seleccione un programa</option>
                  {formData.program && !programs.includes(formData.program) && (
                    <option value={formData.program}>{formData.program}</option>
                  )}
                  {programs.map(program => (
                    <option key={program} value={program}>{program}</option>
                  ))}
                </select>
              </div>
            )}
            {isProfessorRole && (
              <div className="form-group">
                <label className="form-label">Facultad</label>
                <select
                  className="form-select"
                  value={formData.program}
                  onChange={e => setFormData({ ...formData, program: e.target.value })}
                  required
                >
                  <option value="">Seleccione una facultad</option>
                  {formData.program && !faculties.includes(formData.program) && (
                    <option value={formData.program}>{formData.program}</option>
                  )}
                  {faculties.map(faculty => (
                    <option key={faculty} value={faculty}>{faculty}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Tarjeta RFID (Opcional)</label>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '10px' }}>
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1.5px dashed ${sensorStatus === 'detected' ? '#10b981' : 'var(--border)'}`,
                backgroundColor: sensorStatus === 'detected' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-tertiary)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  backgroundColor: sensorStatus === 'detected' ? 'rgba(16, 185, 129, 0.18)' : 'var(--accent-soft)',
                  color: sensorStatus === 'detected' ? '#10b981' : 'var(--accent)'
                }}>
                  {sensorStatus === 'detected'
                    ? <Check size={17} />
                    : <Radio size={17} className="spinner" />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: sensorStatus === 'detected' ? '#10b981' : 'var(--text)'
                  }}>
                    {sensorStatus === 'detected'
                      ? 'Tarjeta detectada por el sensor'
                      : (formData.rfid_tag ? 'Tarjeta actual vinculada' : 'Esperando lectura del sensor')}
                  </div>
                  <div
                    className="font-mono"
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {scannedUid || formData.rfid_tag || 'Acerque la tarjeta al lector RFID'}
                  </div>
                </div>
              </div>
              {(scannedUid || formData.rfid_tag) && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={clearCard}
                  title="Quitar tarjeta"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>
              La tarjeta es opcional. Puede registrarla ahora o asignarla después desde Tarjetas RFID.
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
