import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Clock,
  DoorOpen,
  VolumeX,
  Mail,
  Shield
} from 'lucide-react';

export const Alerts = () => {
  const { canManageSecurity } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');

  // Escuchar WebSocket para nuevas alertas o resoluciones
  const handleWsEvent = (event) => {
    if (event.type === 'new_alert') {
      setAlerts(prev => [event.data, ...prev]);
    } else if (event.type === 'alert_resolved') {
      setAlerts(prev => prev.map(a => a.id === event.data.alertId ? { ...a, is_resolved: true } : a));
    }
  };

  useWebSocket(handleWsEvent);

  const loadData = async () => {
    try {
      setLoading(true);
      const [alertsRes, roomsRes] = await Promise.all([
        apiClient('/alerts'),
        apiClient('/rooms')
      ]);

      if (alertsRes.success) setAlerts(alertsRes.data);
      if (roomsRes.success) setRooms(roomsRes.data);
    } catch (err) {
      console.error('Error cargando alertas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openResolveModal = (alert) => {
    setSelectedAlert(alert);
    setResolutionNote('');
    setIsModalOpen(true);
  };

  const handleResolveAlert = async (e) => {
    e.preventDefault();
    if (!selectedAlert) return;

    try {
      const res = await apiClient(`/alerts/${selectedAlert.id}/resolve`, {
        method: 'PUT',
        body: { resolution_note: resolutionNote }
      });

      if (res.success) {
        setIsModalOpen(false);
        loadData();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Desarmar manualmente la alarma de una sala desde el centro de control
  const handleDisarmRoom = async (roomId) => {
    if (!window.confirm('¿Confirmar desactivación manual de alarma para esta sala desde el centro de control?')) return;
    try {
      const res = await apiClient(`/alerts/disarm-room/${roomId}`, { method: 'POST' });
      if (res.success) {
        alert(res.message);
        loadData();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredAlerts = alerts.filter(a =>
    severityFilter ? a.severity === severityFilter : true
  );

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.toLocaleDateString('es-CO')} ${d.toLocaleTimeString('es-CO', { hour12: false })}`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Centro de Monitoreo de Seguridad y Alarmas Críticas</h1>
          <p className="page-subtitle">
            Cuarto de control central para la gestión, resolución de incidentes y desarmado de salas aseguradas
          </p>
        </div>
      </div>

      {/* SECCIÓN PROTOTIPO: SALA DE INFORMÁTICA 1 Y SALAS ASEGURADAS */}
      <div className="card" style={{ marginBottom: '24px', border: '1px solid var(--accent-border)' }}>
        <div className="card-header">
          <div className="card-title">
            <ShieldAlert size={18} />
            <span>Panel de Control de Alarmas Físicas — Sala de Informática 1 y Áreas Críticas</span>
          </div>
          <span className="badge badge-alert">CENTRO DE CONTROL ACTIVO</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
          {rooms.filter(r => r.has_alarm).map(r => (
            <div
              key={r.id}
              style={{
                padding: '16px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                  {r.name}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {r.block_name} · 2 Sensores Mov. · 1 Sensor Puerta
                </div>
                <div style={{ marginTop: '6px' }}>
                  <span className={`badge ${r.security_status === 'alert' ? 'badge-alert' : 'badge-neutral'}`}>
                    {r.security_status === 'alert' ? '🚨 ALARMA DISPARADA' : 'SISTEMA ARMADO'}
                  </span>
                </div>
              </div>

              {canManageSecurity && (
                <button
                  onClick={() => handleDisarmRoom(r.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                >
                  <VolumeX size={14} />
                  <span>Desarmar / Silenciar</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Filtrar Severidad:</span>
            <select
              className="form-select"
              style={{ width: '180px' }}
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
            >
              <option value="">Todas las Severidades</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Notificaciones por correo electrónico: <b>Activas (SMTP)</b>
          </div>
        </div>
      </div>

      {/* Lista de Alertas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredAlerts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No hay alertas de seguridad en el historial.
          </div>
        ) : (
          filteredAlerts.map(a => (
            <div
              key={a.id}
              style={{
                backgroundColor: a.is_resolved ? 'var(--bg-card)' : 'var(--bg-secondary)',
                border: `1px solid ${!a.is_resolved && a.severity === 'critical' ? 'var(--status-alert-border)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: a.severity === 'critical' ? 'var(--status-alert-text)' : 'var(--text-primary)',
                  flexShrink: 0
                }}>
                  <AlertTriangle size={18} />
                </div>

                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <span className={`badge ${
                      a.severity === 'critical' ? 'badge-alert' :
                      a.severity === 'high' ? 'badge-alert' : 'badge-neutral'
                    }`}>
                      {a.severity.toUpperCase()}
                    </span>
                    <span className={`badge ${a.is_resolved ? 'badge-ok' : 'badge-denied'}`}>
                      {a.is_resolved ? 'RESUELTA' : 'PENDIENTE'}
                    </span>
                    <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDate(a.timestamp)}
                    </span>
                  </div>

                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {a.message}
                  </div>

                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Ubicación: <b>{a.room_name}</b> ({a.door_name}) · Tipo de sensor: <b>{a.sensor_type}</b>
                  </div>

                  {a.is_resolved && (
                    <div style={{
                      marginTop: '8px',
                      fontSize: '11.5px',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-tertiary)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      display: 'inline-block'
                    }}>
                      Resuelta por: <b>{a.resolver_name || 'Seguridad'}</b> · {a.resolution_note || 'Sin nota'}
                    </div>
                  )}
                </div>
              </div>

              {!a.is_resolved && canManageSecurity && (
                <button
                  onClick={() => openResolveModal(a)}
                  className="btn btn-secondary btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <CheckCircle size={14} />
                  <span>Marcar Resuelta</span>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Resolver Alerta */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Resolución de Alerta de Seguridad">
        <form onSubmit={handleResolveAlert}>
          <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Se registrará su usuario como el responsable de la atención y resolución de este incidente en el cuarto de control.
          </div>

          <div className="form-group">
            <label className="form-label">Nota de Resolución / Acciones Tomadas</label>
            <textarea
              className="form-textarea"
              rows="4"
              placeholder="Ej. Se verificó en cámaras de seguridad y con la patrulla de vigilancia. Se trató de una apertura accidental durante mantenimiento..."
              value={resolutionNote}
              onChange={e => setResolutionNote(e.target.value)}
              required
            />
          </div>

          <div className="modal-footer" style={{ margin: '14px -20px -20px', padding: '14px 20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Registrar Resolución</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
