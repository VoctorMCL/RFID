import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  Activity,
  CheckCircle,
  XCircle,
  Users,
  AlertTriangle,
  Building,
  DoorClosed,
  ArrowRight,
  Radio
} from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalToday: 0,
    grantedToday: 0,
    deniedToday: 0,
    activeUsers: 0,
    activeAlerts: 0,
    totalDoors: 0,
    totalRooms: 0,
    totalBlocks: 0
  });
  const [recentLogs, setRecentLogs] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Escuchar eventos WebSocket en tiempo real
  const handleWsEvent = (event) => {
    if (event.type === 'access_attempt') {
      const data = event.data;
      // Actualizar estadísticas en vivo
      setStats(prev => ({
        ...prev,
        totalToday: prev.totalToday + 1,
        grantedToday: data.granted ? prev.grantedToday + 1 : prev.grantedToday,
        deniedToday: !data.granted ? prev.deniedToday + 1 : prev.deniedToday,
      }));

      // Agregar a la lista de accesos recientes
      setRecentLogs(prev => [
        {
          id: data.logId || Date.now(),
          user_name: data.user ? data.user.name : 'Desconocido',
          user_program: data.user ? data.user.program : '—',
          rfid_uid_raw: data.uid,
          door_name: data.door ? data.door.name : 'Puerta',
          room_name: data.room ? data.room.name : 'Sala',
          granted: data.granted,
          timestamp: data.timestamp
        },
        ...prev.slice(0, 9)
      ]);
    } else if (event.type === 'new_alert') {
      setActiveAlerts(prev => [event.data, ...prev]);
      setStats(prev => ({ ...prev, activeAlerts: prev.activeAlerts + 1 }));
    } else if (event.type === 'alert_resolved') {
      setActiveAlerts(prev => prev.filter(a => a.id !== event.data.alertId));
      setStats(prev => ({ ...prev, activeAlerts: Math.max(0, prev.activeAlerts - 1) }));
    }
  };

  useWebSocket(handleWsEvent);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, logsRes, alertsRes, roomsRes] = await Promise.all([
        apiClient('/access/logs/stats'),
        apiClient('/access/logs?limit=8'),
        apiClient('/alerts?is_resolved=false'),
        apiClient('/rooms')
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (logsRes.success) setRecentLogs(logsRes.data);
      if (alertsRes.success) setActiveAlerts(alertsRes.data);
      if (roomsRes.success) setRooms(roomsRes.data);
    } catch (err) {
      console.error('Error cargando datos del dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <div>
      {/* Encabezado */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Bienvenido, {user?.first_name} {user?.last_name}</h1>
          <p className="page-subtitle">
            Rol: <b>{user?.role?.display_name}</b> · Corporación Universitaria Lasallista
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/monitor" className="btn btn-primary">
            <Radio size={16} />
            <span>Abrir Escáner en Vivo</span>
          </Link>
        </div>
      </div>

      {/* Alerta de Seguridad Activa Destacada */}
      {activeAlerts.length > 0 && (
        <div style={{
          backgroundColor: 'var(--status-alert-bg)',
          border: '1px solid var(--status-alert-border)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <AlertTriangle size={24} style={{ color: 'var(--status-alert-text)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--status-alert-text)' }}>
                {activeAlerts.length} ALERTA(S) CRÍTICA(S) PENDIENTE(S) DE RESOLUCIÓN
              </div>
              <div style={{ fontSize: '12.5px', color: '#c8ba98', marginTop: '2px' }}>
                {activeAlerts[0]?.message}
              </div>
            </div>
          </div>
          <Link to="/alerts" className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>
            <span>Gestionar en Sala de Control</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Tarjetas de Métricas Estadísticas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Accesos Hoy
            </span>
            <Activity size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {stats.totalToday}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Registros en torniquetes y puertas
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Concedidos
            </span>
            <CheckCircle size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {stats.grantedToday}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '4px' }}>
            {stats.totalToday > 0 ? `${Math.round((stats.grantedToday / stats.totalToday) * 100)}% de efectividad` : 'Sin lecturas'}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Denegados
            </span>
            <XCircle size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {stats.deniedToday}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Violaciones de horario o tarjetas no válidas
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Usuarios Activos
            </span>
            <Users size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {stats.activeUsers}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Estudiantes, docentes y personal
          </div>
        </div>
      </div>

      {/* Sección Dividida: Accesos Recientes + Estado de Salas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        {/* Tabla de Intentos Recientes */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={18} />
              <span>Flujo de Accesos en Vivo</span>
            </div>
            <Link to="/logs" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
              Ver todos →
            </Link>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Persona</th>
                  <th>Ubicación</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No hay registros recientes.
                    </td>
                  </tr>
                ) : (
                  recentLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {formatDate(log.timestamp)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{log.user_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.user_program}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12.5px' }}>{log.door_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.room_name}</div>
                      </td>
                      <td>
                        <span className={`badge ${log.granted ? 'badge-ok' : 'badge-denied'}`}>
                          {log.granted ? 'CONCEDIDO' : 'DENEGADO'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Estado de Seguridad por Salas — Laboratorios y Campus */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Building size={18} />
              <span>Estado de Espacios Sensibles</span>
            </div>
            <Link to="/map" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
              Gestionar →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rooms.slice(0, 6).map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {r.block_name} · Piso {r.floor} {r.has_alarm ? '· Alarma Física Activa' : ''}
                  </div>
                </div>
                <div>
                  <span className={`badge ${
                    r.security_status === 'alert' ? 'badge-alert' :
                    r.security_status === 'armed' ? 'badge-neutral' : 'badge-ok'
                  }`}>
                    {r.security_status === 'alert' ? 'EN ALERTA' :
                     r.security_status === 'armed' ? 'ARMADA' : 'NORMAL'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
