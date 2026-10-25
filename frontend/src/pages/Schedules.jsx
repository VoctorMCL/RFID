import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import {
  Calendar,
  Plus,
  Clock,
  BookOpen,
  User,
  Building,
  Trash2,
  Filter
} from 'lucide-react';

const DAYS_OF_WEEK = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado'
];

export const Schedules = () => {
  const { canManageInfrastructure, user: currentUser, isProfessor } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    user_id: '',
    room_id: '',
    day_of_week: '1', // Lunes
    start_time: '07:00',
    end_time: '09:00',
    semester: '2026-2',
    subject_name: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [schedulesRes, usersRes, roomsRes] = await Promise.all([
        apiClient('/schedules'),
        apiClient('/users'),
        apiClient('/rooms')
      ]);

      if (schedulesRes.success) setSchedules(schedulesRes.data);
      if (usersRes.success) setUsers(usersRes.data);
      if (roomsRes.success) setRooms(roomsRes.data);
    } catch (err) {
      console.error('Error cargando articulación horaria:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient('/schedules', {
        method: 'POST',
        body: formData
      });
      if (res.success) {
        loadData();
        setIsModalOpen(false);
        setFormData({
          user_id: '',
          room_id: '',
          day_of_week: '1',
          start_time: '07:00',
          end_time: '09:00',
          semester: '2026-2',
          subject_name: ''
        });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('¿Desea remover este horario asignado?')) return;
    try {
      const res = await apiClient(`/schedules/${id}`, { method: 'DELETE' });
      if (res.success) {
        setSchedules(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredSchedules = schedules.filter(s => {
    // Si es docente viendo la pantalla, filtrar solo sus horarios a menos que sea rector/admin
    if (isProfessor && !canManageInfrastructure && s.user_id !== currentUser?.id) {
      return false;
    }
    const matchesUser = userFilter ? s.user_id.toString() === userFilter : true;
    const matchesRoom = roomFilter ? s.room_id.toString() === roomFilter : true;
    const matchesDay = dayFilter !== '' ? s.day_of_week.toString() === dayFilter : true;
    return matchesUser && matchesRoom && matchesDay;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Articulación Horaria y Control Académico</h1>
          <p className="page-subtitle">
            Habilitación de acceso condicionado para docentes y estudiantes (RRHH y Decanatura)
          </p>
        </div>
        {canManageInfrastructure && (
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />
            <span>Asignar Horario de Clase</span>
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div>
            <label className="form-label">Filtrar por Persona</label>
            <select
              className="form-select"
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
            >
              <option value="">Todas las Personas</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Filtrar por Sala</label>
            <select
              className="form-select"
              value={roomFilter}
              onChange={e => setRoomFilter(e.target.value)}
            >
              <option value="">Todas las Salas</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.block_name})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Día de la Semana</label>
            <select
              className="form-select"
              value={dayFilter}
              onChange={e => setDayFilter(e.target.value)}
            >
              <option value="">Todos los Días</option>
              {DAYS_OF_WEEK.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Horarios */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Día</th>
              <th>Horario Asignado</th>
              <th>Docente / Estudiante</th>
              <th>Sala y Ubicación</th>
              <th>Asignatura / Actividad</th>
              <th>Semestre</th>
              {canManageInfrastructure && <th style={{ textAlign: 'right' }}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filteredSchedules.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No se encontraron horarios articulados con los criterios seleccionados.
                </td>
              </tr>
            ) : (
              filteredSchedules.map(s => (
                <tr key={s.id}>
                  <td>
                    <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                      {DAYS_OF_WEEK[s.day_of_week] || 'Día'}
                    </span>
                  </td>
                  <td className="font-mono" style={{ fontSize: '13px' }}>
                    {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.user_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Doc: {s.user_document}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.room_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.block_name}</div>
                  </td>
                  <td>
                    <span className="badge badge-ok">{s.subject_name || 'Clase General'}</span>
                  </td>
                  <td className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {s.semester || '2026-2'}
                  </td>
                  {canManageInfrastructure && (
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteSchedule(s.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--text-muted)' }}
                        title="Remover"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Asignar Horario */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Asignar Articulación Horaria">
        <form onSubmit={handleCreateSchedule}>
          <div className="form-group">
            <label className="form-label">Persona (Docente / Estudiante)</label>
            <select
              className="form-select"
              value={formData.user_id}
              onChange={e => setFormData({ ...formData, user_id: e.target.value })}
              required
            >
              <option value="">-- Seleccione una persona --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} ({u.role_display})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Sala Autorizada</label>
            <select
              className="form-select"
              value={formData.room_id}
              onChange={e => setFormData({ ...formData, room_id: e.target.value })}
              required
            >
              <option value="">-- Seleccione un espacio físico --</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.block_name} (Piso {r.floor})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Día</label>
              <select
                className="form-select"
                value={formData.day_of_week}
                onChange={e => setFormData({ ...formData, day_of_week: e.target.value })}
                required
              >
                {DAYS_OF_WEEK.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Hora Inicio</label>
              <input
                type="time"
                className="form-input"
                value={formData.start_time}
                onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Hora Fin</label>
              <input
                type="time"
                className="form-input"
                value={formData.end_time}
                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Materia / Asignatura</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Programación Orientada a Objetos"
                value={formData.subject_name}
                onChange={e => setFormData({ ...formData, subject_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Semestre</label>
              <input
                type="text"
                className="form-input font-mono"
                value={formData.semester}
                onChange={e => setFormData({ ...formData, semester: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="modal-footer" style={{ margin: '14px -20px -20px', padding: '14px 20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Vincular Horario a BD</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
