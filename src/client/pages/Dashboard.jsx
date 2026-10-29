import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  Activity,
  CheckCircle2,
  XCircle,
  Users,
  AlertTriangle,
  Building2,
  DoorClosed,
  Radio,
  Cpu,
  BarChart3,
  Layers,
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalToday: 0,
    grantedToday: 0,
    deniedToday: 0,
    successRate: 100,
    activeUsers: 0,
    activeAlerts: 0,
    totalDoors: 53,
    totalRooms: 52,
    totalBlocks: 4,
    activeSensors: 0,
    byBlock: [],
    byRole: [],
    byReason: []
  });
  const [recentLogs, setRecentLogs] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [doors, setDoors] = useState([]);
  const [selectedBlockFilter, setSelectedBlockFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Escuchar eventos en vivo vía WebSocket
  const handleWsEvent = (event) => {
    if (event.type === 'access_attempt') {
      const data = event.data;
      setStats(prev => {
        const newTotal = prev.totalToday + 1;
        const newGranted = data.granted ? prev.grantedToday + 1 : prev.grantedToday;
        const newDenied = !data.granted ? prev.deniedToday + 1 : prev.deniedToday;
        return {
          ...prev,
          totalToday: newTotal,
          grantedToday: newGranted,
          deniedToday: newDenied,
          successRate: Number(((newGranted / newTotal) * 100).toFixed(1))
        };
      });

      setRecentLogs(prev => [
        {
          id: data.logId || Date.now(),
          user_name: data.user ? `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim() : 'Desconocido',
          user_document: data.user?.document_id || '—',
          user_program: data.user?.program || '—',
          role_name: data.user?.role || 'Estudiante',
          rfid_uid_raw: data.uid,
          door_id: data.door?.id,
          door_name: data.door ? data.door.name : 'Punto de Acceso',
          room_name: data.room ? data.room.name : 'Espacio',
          granted: data.granted,
          denial_reason: data.denialReason || null,
          timestamp: data.timestamp || new Date().toISOString()
        },
        ...prev.slice(0, 11)
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

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setIsRefreshing(true);
      const [statsRes, logsRes, alertsRes, roomsRes, doorsRes] = await Promise.all([
        apiClient('/access/logs/stats'),
        apiClient('/access/logs?limit=12'),
        apiClient('/alerts?is_resolved=false'),
        apiClient('/rooms'),
        apiClient('/doors')
      ]);

      if (statsRes.success) setStats(prev => ({ ...prev, ...statsRes.data }));
      if (logsRes.success) setRecentLogs(logsRes.data || []);
      if (alertsRes.success) setActiveAlerts(alertsRes.data || []);
      if (roomsRes.success) setRooms(roomsRes.data || []);
      if (doorsRes.success) setDoors(doorsRes.data || []);
      setLastRefreshTime(new Date());
    } catch (err) {
      console.error('Error cargando telemetría del dashboard:', err);
    } finally {
      if (!silent) setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh cada 4 segundos estilo Grafana Live
    const interval = setInterval(() => loadData(true), 4000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  // Filtrado de salas por bloque para la matriz de topología
  const filteredRooms = rooms.filter(r => {
    if (selectedBlockFilter === 'all') return true;
    return r.block_id === parseInt(selectedBlockFilter, 10);
  });

  const isHardwareSensorOnline = stats.activeSensors > 0 || doors.some(d => d.is_hardware_active);

  // Calcular porcentaje de éxito para color de Grafana
  const successRateColor = stats.successRate >= 95 ? '#4ade80' : stats.successRate >= 80 ? '#fbbf24' : '#f87171';

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Barra de Herramientas Estilo Grafana */}
      <div style={{
        backgroundColor: '#181a1f',
        border: '1px solid #2b2f38',
        borderRadius: '8px',
        padding: '12px 18px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={20} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px', color: '#f3f4f6' }}>
              TELEMETRÍA GRAFANA
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#232730', color: '#9ca3af', border: '1px solid #374151' }}>
              PROD
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#232730', color: '#9ca3af', border: '1px solid #374151' }}>
              CAMPUS-LASALLISTA
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#232730', color: '#9ca3af', border: '1px solid #374151' }}>
              SUPABASE-POSTGRESQL
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: isHardwareSensorOnline ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: isHardwareSensorOnline ? '#4ade80' : '#f87171', border: `1px solid ${isHardwareSensorOnline ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
              {isHardwareSensorOnline ? '● CROWPI HARDWARE CONECTADO' : '○ CROWPI HARDWARE DESCONECTADO'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>
            Auto-refresh: <b>4s</b> (Últ: {formatTime(lastRefreshTime)})
          </div>
          <button
            onClick={() => loadData()}
            className="btn btn-secondary btn-sm"
            disabled={isRefreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', fontSize: '11px' }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            <span>Refrescar</span>
          </button>
          <Link to="/monitor" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', fontSize: '11.5px' }}>
            <Radio size={14} />
            <span>Escáner en Vivo</span>
          </Link>
        </div>
      </div>

      {/* Alerta Crítica (si existen) */}
      {activeAlerts.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(220, 38, 38, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} style={{ color: '#ef4444' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#fca5a5', letterSpacing: '0.3px' }}>
                {activeAlerts.length} ALERTA(S) DE SEGURIDAD DETECTADA(S) EN EL CAMPUS
              </div>
              <div style={{ fontSize: '11.5px', color: '#d1d5db', marginTop: '2px' }}>
                {activeAlerts[0]?.message}
              </div>
            </div>
          </div>
          <Link to="/alerts" className="btn btn-secondary btn-sm" style={{ fontSize: '11.5px' }}>
            Ver en Sala de Control →
          </Link>
        </div>
      )}

      {/* FILA 1: Paneles de Métricas Clave (Grafana Stat Panels) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        {/* Panel 1: Throughput Total */}
        <div style={{
          backgroundColor: '#181a1f',
          border: '1px solid #2b2f38',
          borderLeft: '4px solid #3b82f6',
          borderRadius: '6px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Accesos Hoy
            </span>
            <Activity size={16} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            {stats.totalToday}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            Validaciones en torniquetes y puertas
          </div>
        </div>

        {/* Panel 2: Tasa de Aprobación */}
        <div style={{
          backgroundColor: '#181a1f',
          border: '1px solid #2b2f38',
          borderLeft: `4px solid ${successRateColor}`,
          borderRadius: '6px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Tasa Aprobación (SLA)
            </span>
            <CheckCircle2 size={16} style={{ color: successRateColor }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: successRateColor, fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            {stats.totalToday > 0 ? `${stats.successRate}%` : '100%'}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            {stats.grantedToday} autorizados de {stats.totalToday}
          </div>
        </div>

        {/* Panel 3: Infracciones / Denegados */}
        <div style={{
          backgroundColor: '#181a1f',
          border: '1px solid #2b2f38',
          borderLeft: stats.deniedToday > 0 ? '4px solid #ef4444' : '4px solid #4b5563',
          borderRadius: '6px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Accesos Denegados
            </span>
            <XCircle size={16} style={{ color: stats.deniedToday > 0 ? '#ef4444' : '#6b7280' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: stats.deniedToday > 0 ? '#ef4444' : '#e5e7eb', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            {stats.deniedToday}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            Infracciones horarias o carnets inválidos
          </div>
        </div>

        {/* Panel 4: Puntos de Acceso / Cobertura */}
        <div style={{
          backgroundColor: '#181a1f',
          border: '1px solid #2b2f38',
          borderLeft: '4px solid #d4a853',
          borderRadius: '6px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Puntos de Acceso
            </span>
            <DoorClosed size={16} style={{ color: '#d4a853' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            {stats.totalDoors}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            En {stats.totalRooms} salas y 4 bloques
          </div>
        </div>

        {/* Panel 5: Hardware Sensor RFID */}
        <div style={{
          backgroundColor: '#181a1f',
          border: '1px solid #2b2f38',
          borderLeft: `4px solid ${isHardwareSensorOnline ? '#10b981' : '#6b7280'}`,
          borderRadius: '6px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Sensor MFRC522 (CrowPi)
            </span>
            <Cpu size={16} style={{ color: isHardwareSensorOnline ? '#10b981' : '#9ca3af' }} />
          </div>
          <div style={{ fontSize: '19px', fontWeight: 800, color: isHardwareSensorOnline ? '#10b981' : '#9ca3af', fontFamily: 'var(--font-mono)', marginTop: '12px' }}>
            {isHardwareSensorOnline ? 'EN LÍNEA' : 'OFFLINE'}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            {isHardwareSensorOnline ? 'Latidos recibidos en <30s' : 'Ejecuta lector_rfid.py'}
          </div>
        </div>

        {/* Panel 6: Usuarios Activos */}
        <div style={{
          backgroundColor: '#181a1f',
          border: '1px solid #2b2f38',
          borderLeft: '4px solid #8b5cf6',
          borderRadius: '6px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Usuarios Activos
            </span>
            <Users size={16} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            {stats.activeUsers}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            Registrados en PostgreSQL
          </div>
        </div>
      </div>

      {/* FILA 2: Paneles Gráficos y Porcentajes de Distribución (Grafana Gauges) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Panel A: Distribución de Accesos por Bloque Institucional */}
        <div style={{
          backgroundColor: '#181a1f',
          border: '1px solid #2b2f38',
          borderRadius: '6px',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={16} style={{ color: 'var(--accent)' }} />
              <span>Flujo de Accesos por Bloque</span>
            </div>
            <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>% Relativo</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { id: 1, name: 'Bloque A', salones: 14, desc: 'Aulas y Salas de PCs' },
              { id: 2, name: 'Bloque B', salones: 14, desc: 'Aulas y Salón de Inglés' },
              { id: 3, name: 'Bloque C', salones: 11, desc: 'Aula Máxima y Labs Hardware' },
              { id: 4, name: 'Bloque Administrativo', salones: 13, desc: 'Alimentos, PCs, Profesores y Cartera' }
            ].map(b => {
              const blockStat = stats.byBlock?.find(x => x.id === b.id);
              const count = blockStat ? blockStat.count : 0;
              const pct = stats.totalToday > 0 ? Math.round((count / stats.totalToday) * 100) : 0;
              return (
                <div key={b.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#e5e7eb' }}>{b.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#9ca3af' }}>
                      {count} accesos ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: '7px', backgroundColor: '#262930', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.max(pct, count > 0 ? 6 : 2)}%`,
                        backgroundColor: b.id === 1 ? '#3b82f6' : b.id === 2 ? '#10b981' : b.id === 3 ? '#d4a853' : '#8b5cf6',
                        borderRadius: '4px',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '2px' }}>
                    {b.salones} dependencias monitoreadas · {b.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel B: Distribución por Perfiles Institucionales (Roles) */}
        <div style={{
          backgroundColor: '#181a1f',
          border: '1px solid #2b2f38',
          borderRadius: '6px',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} style={{ color: 'var(--accent)' }} />
              <span>Distribución por Roles</span>
            </div>
            <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>Población</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { name: 'student', label: 'Estudiantes', color: '#3b82f6', fallbackPct: 65 },
              { name: 'professor', label: 'Docentes / Profesores', color: '#10b981', fallbackPct: 20 },
              { name: 'admin_staff', label: 'Personal Administrativo', color: '#f59e0b', fallbackPct: 10 },
              { name: 'celador', label: 'Seguridad y Celadores', color: '#8b5cf6', fallbackPct: 5 }
            ].map(r => {
              const roleStat = stats.byRole?.find(x => x.name === r.name);
              const count = roleStat ? roleStat.count : 0;
              const pct = stats.totalToday > 0 ? Math.round((count / stats.totalToday) * 100) : r.fallbackPct;
              return (
                <div key={r.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#e5e7eb' }}>{r.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#9ca3af' }}>
                      {count > 0 ? `${count} accesos (${pct}%)` : `${pct}% estimado`}
                    </span>
                  </div>
                  <div style={{ height: '7px', backgroundColor: '#262930', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: r.color,
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel C: Análisis Forense de Rechazos (Denial Causes) */}
        <div style={{
          backgroundColor: '#181a1f',
          border: '1px solid #2b2f38',
          borderRadius: '6px',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={16} style={{ color: 'var(--accent)' }} />
              <span>Causas de Rechazo</span>
            </div>
            <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {stats.deniedToday} Denegados
            </span>
          </div>

          {stats.deniedToday === 0 ? (
            <div style={{
              height: '160px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: '12px',
              textAlign: 'center'
            }}>
              <CheckCircle2 size={32} style={{ color: '#10b981', marginBottom: '8px' }} />
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>0 Infracciones Detectadas</span>
              <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                Todos los intentos de acceso de hoy han sido legítimos.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(stats.byReason?.length > 0 ? stats.byReason : [
                { reason: 'Fuera de horario asignado', count: stats.deniedToday }
              ]).map((dr, idx) => {
                const pct = stats.deniedToday > 0 ? Math.round((dr.count / stats.deniedToday) * 100) : 0;
                return (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '3px' }}>
                      <span style={{ color: '#fca5a5', fontWeight: 600 }}>{dr.reason}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#ef4444' }}>
                        {dr.count} ({pct}%)
                      </span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#262930', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#ef4444', borderRadius: '3px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FILA 3: Topología del Campus en Tiempo Real (Matriz de Nodos Grafana) */}
      <div style={{
        backgroundColor: '#181a1f',
        border: '1px solid #2b2f38',
        borderRadius: '6px',
        padding: '16px 18px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={17} style={{ color: 'var(--accent)' }} />
              <span>Matriz de Topología del Campus (52 Espacios Monitoreados)</span>
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              Visualización por nodos de seguridad institucional
            </div>
          </div>

          {/* Filtro de Bloque */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Todos (52)' },
              { id: '1', label: 'Bloque A (14)' },
              { id: '2', label: 'Bloque B (14)' },
              { id: '3', label: 'Bloque C (11)' },
              { id: '4', label: 'Administrativo (13)' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedBlockFilter(f.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: selectedBlockFilter === f.id ? '1px solid var(--accent)' : '1px solid #374151',
                  backgroundColor: selectedBlockFilter === f.id ? 'var(--accent-soft)' : '#232730',
                  color: selectedBlockFilter === f.id ? 'var(--accent)' : '#9ca3af'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grilla de Nodos */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: '10px',
          maxHeight: '290px',
          overflowY: 'auto',
          paddingRight: '4px'
        }}>
          {filteredRooms.map(room => {
            const blockNames = { 1: 'Bloque A', 2: 'Bloque B', 3: 'Bloque C', 4: 'Administrativo' };
            const bName = blockNames[room.block_id] || 'Campus';
            return (
              <div
                key={room.id}
                style={{
                  backgroundColor: '#1f2228',
                  border: '1px solid #2d323b',
                  borderRadius: '5px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.2s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
                      {bName} · P{room.floor}
                    </span>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        display: 'inline-block'
                      }}
                      title="Nodo seguro y en línea"
                    />
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#f3f4f6', lineHeight: 1.3 }}>
                    {room.name}
                  </div>
                </div>

                <div style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{room.doors_count || 1} acceso(s)</span>
                  <span style={{ textTransform: 'capitalize' }}>{room.room_type ? room.room_type.replace('_', ' ') : 'general'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FILA 4: Tabla de Logs de Auditoría en Tiempo Real (Grafana Live Stream) */}
      <div style={{
        backgroundColor: '#181a1f',
        border: '1px solid #2b2f38',
        borderRadius: '6px',
        padding: '16px 18px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} style={{ color: 'var(--accent)' }} />
              <span>Registro de Eventos y Auditoría en Vivo (Loki Stream)</span>
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              Últimas transacciones registradas por el ecosistema RFID
            </div>
          </div>
          <Link to="/logs" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>Abrir Auditoría Completa</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2d323b', textAlign: 'left', color: '#9ca3af', fontSize: '11px' }}>
                <th style={{ padding: '8px 10px' }}>TIMESTAMP</th>
                <th style={{ padding: '8px 10px' }}>ESTADO</th>
                <th style={{ padding: '8px 10px' }}>PUNTO DE ACCESO</th>
                <th style={{ padding: '8px 10px' }}>ESPACIO & BLOQUE</th>
                <th style={{ padding: '8px 10px' }}>PERSONA / DOCUMENTO</th>
                <th style={{ padding: '8px 10px' }}>ROL</th>
                <th style={{ padding: '8px 10px' }}>UID RAW</th>
                <th style={{ padding: '8px 10px' }}>OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '12px' }}>
                    No hay eventos de acceso registrados en la base de datos hoy.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log, idx) => (
                  <tr
                    key={log.id || idx}
                    style={{
                      borderBottom: '1px solid #232730',
                      backgroundColor: idx % 2 === 0 ? '#181a1f' : '#1b1e24'
                    }}
                  >
                    <td style={{ padding: '8px 10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {formatTime(log.timestamp)}
                    </td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '3px',
                          backgroundColor: log.granted ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: log.granted ? '#4ade80' : '#f87171',
                          border: `1px solid ${log.granted ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}
                      >
                        {log.granted ? 'GRANTED' : 'DENIED'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#e5e7eb', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {log.door_name || `Acceso #${log.door_id}`}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#d1d5db', whiteSpace: 'nowrap' }}>
                      {log.room_name || '—'} {log.block_name ? `(${log.block_name})` : ''}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#f3f4f6', whiteSpace: 'nowrap' }}>
                      {log.user_name || 'No enrolado'} {log.user_document && log.user_document !== '—' ? `[${log.user_document}]` : ''}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#9ca3af', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                      {log.role_name || 'Estudiante'}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {log.rfid_uid_raw || '—'}
                    </td>
                    <td style={{ padding: '8px 10px', color: log.granted ? '#9ca3af' : '#fca5a5', fontSize: '11px' }}>
                      {log.granted ? 'Acceso autorizado' : (log.denial_reason || 'Rechazado')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
