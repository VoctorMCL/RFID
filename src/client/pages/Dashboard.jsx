import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
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
  SlidersHorizontal,
  GraduationCap,
  TrendingUp,
  Calendar,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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

  const [analytics, setAnalytics] = useState({
    hourly: [],
    minute: [],
    studentsByProgram: [],
    weeklyByProgram: [],
    byBlock: []
  });

  const [recentLogs, setRecentLogs] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [doors, setDoors] = useState([]);
  const [timeGranularity, setTimeGranularity] = useState('hour'); // 'hour' | 'minute'
  const [loading, setLoading] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selector de Visibilidad de Paneles / Gráficas de Grafana
  const [visiblePanels, setVisiblePanels] = useState(() => {
    try {
      const saved = localStorage.getItem('grafana_visible_panels');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      picos: true,
      carreras: true,
      semanal: true,
      bloques: true
    };
  });

  // URL de servidor Grafana externo opcional (iframe embed)
  const [grafanaEmbedUrl, setGrafanaEmbedUrl] = useState(() => localStorage.getItem('grafana_embed_url') || '');
  const [showEmbedModal, setShowEmbedModal] = useState(false);

  const togglePanel = (panelKey) => {
    setVisiblePanels(prev => {
      const updated = { ...prev, [panelKey]: !prev[panelKey] };
      localStorage.setItem('grafana_visible_panels', JSON.stringify(updated));
      return updated;
    });
  };

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

      // Refrescar analítica en vivo
      loadAnalytics();
    } else if (event.type === 'new_alert') {
      setActiveAlerts(prev => [event.data, ...prev]);
      setStats(prev => ({ ...prev, activeAlerts: prev.activeAlerts + 1 }));
    } else if (event.type === 'alert_resolved') {
      setActiveAlerts(prev => prev.filter(a => a.id !== event.data.alertId));
      setStats(prev => ({ ...prev, activeAlerts: Math.max(0, prev.activeAlerts - 1) }));
    }
  };

  useWebSocket(handleWsEvent);

  const loadAnalytics = async () => {
    try {
      const res = await apiClient('/access/analytics');
      if (res.success && res.data) {
        setAnalytics(res.data);
      }
    } catch (e) {
      console.warn('Error cargando analítica de acceso:', e);
    }
  };

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setIsRefreshing(true);
      const [statsRes, logsRes, alertsRes, doorsRes] = await Promise.all([
        apiClient('/access/logs/stats'),
        apiClient('/access/logs?limit=12'),
        apiClient('/alerts?is_resolved=false'),
        apiClient('/doors')
      ]);

      if (statsRes.success) setStats(prev => ({ ...prev, ...statsRes.data }));
      if (logsRes.success) setRecentLogs(logsRes.data || []);
      if (alertsRes.success) setActiveAlerts(alertsRes.data || []);
      if (doorsRes.success) setDoors(doorsRes.data || []);
      await loadAnalytics();
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
    const interval = setInterval(() => loadData(true), 4000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const isHardwareSensorOnline = stats.activeSensors > 0 || doors.some(d => d.is_hardware_active);
  const successRateColor = stats.successRate >= 95 ? '#10b981' : stats.successRate >= 80 ? '#f59e0b' : '#ef4444';

  // =========================================================================
  // CONFIGURACIÓN DE GRÁFICAS CHART.JS (ESTILO Y ESTÉTICA GRAFANA OFICIAL)
  // =========================================================================

  const grafanaChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { family: 'var(--font-mono)', size: 11, weight: 'bold' }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: '#334155',
        borderWidth: 1,
        titleFont: { family: 'var(--font-mono)', size: 12 },
        bodyFont: { family: 'var(--font-mono)', size: 11 }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.08)' },
        ticks: { color: '#94a3b8', font: { family: 'var(--font-mono)', size: 10 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.08)' },
        ticks: {
          color: '#94a3b8',
          font: { family: 'var(--font-mono)', size: 10 },
          precision: 0
        }
      }
    }
  };

  // 1. Datos Gráfica de Picos (TimeSeries: Por Hora o Por Minuto)
  const timeSeriesSource = timeGranularity === 'minute' ? analytics.minute : analytics.hourly;
  const timeSlots = timeSeriesSource.length > 0
    ? timeSeriesSource.map(d => d.time_slot)
    : (timeGranularity === 'minute' ? ['--:--'] : ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']);

  const picosData = {
    labels: timeSlots,
    datasets: [
      {
        label: 'Accesos Autorizados',
        data: timeSeriesSource.length > 0 ? timeSeriesSource.map(d => d.granted) : new Array(timeSlots.length).fill(0),
        borderColor: '#2563eb', // Azul Unilasallista activo
        backgroundColor: 'rgba(37, 99, 235, 0.18)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: timeGranularity === 'minute' ? 1.5 : 3
      },
      {
        label: 'Accesos Denegados (Picos de Alarma)',
        data: timeSeriesSource.length > 0 ? timeSeriesSource.map(d => d.denied) : new Array(timeSlots.length).fill(0),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: timeGranularity === 'minute' ? 1.5 : 3
      }
    ]
  };

  // 2. Datos Gráfica: Estudiantes Actualmente en Campus por Carrera
  const studentsPrograms = analytics.studentsByProgram?.length > 0
    ? analytics.studentsByProgram
    : [];

  const carrerasData = {
    labels: studentsPrograms.length > 0 ? studentsPrograms.map(p => p.program) : ['Sin registros de carrera'],
    datasets: [
      {
        label: 'Estudiantes en Campus Ahora',
        data: studentsPrograms.length > 0 ? studentsPrograms.map(p => p.active_students) : [0],
        backgroundColor: [
          '#002855', // Azul Oscuro Unilasallista
          '#1d4ed8',
          '#2563eb',
          '#3b82f6',
          '#60a5fa',
          '#10b981',
          '#8b5cf6'
        ],
        borderColor: '#1e293b',
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };

  // 3. Datos Gráfica: Afluencia Semanal por Carrera
  // Agrupar días y programas únicos
  const weeklyDays = Array.from(new Set(analytics.weeklyByProgram?.map(w => w.day_label) || []));
  const uniquePrograms = Array.from(new Set(analytics.weeklyByProgram?.map(w => w.program) || []));

  const weeklyDatasets = uniquePrograms.slice(0, 4).map((prog, idx) => {
    const palette = ['#002855', '#2563eb', '#10b981', '#8b5cf6'];
    const dataPoints = weeklyDays.map(day => {
      const match = analytics.weeklyByProgram?.find(w => w.day_label === day && w.program === prog);
      return match ? match.count : 0;
    });
    return {
      label: prog,
      data: dataPoints,
      backgroundColor: palette[idx % palette.length],
      borderRadius: 4
    };
  });

  const semanalData = {
    labels: weeklyDays.length > 0 ? weeklyDays : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    datasets: weeklyDatasets.length > 0 ? weeklyDatasets : [
      {
        label: 'Afluencia Semanal',
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: '#002855',
        borderRadius: 4
      }
    ]
  };

  // 4. Datos Gráfica: Tráfico por Bloque
  const blockStats = analytics.byBlock?.length > 0
    ? analytics.byBlock
    : [
        { block_name: 'Bloque A', count: 0 },
        { block_name: 'Bloque B', count: 0 },
        { block_name: 'Bloque C', count: 0 },
        { block_name: 'Bloque Administrativo', count: 0 }
      ];

  const bloquesData = {
    labels: blockStats.map(b => b.block_name),
    datasets: [
      {
        data: blockStats.map(b => b.count > 0 ? b.count : 0),
        backgroundColor: ['#002855', '#2563eb', '#38bdf8', '#8b5cf6'],
        borderColor: '#1e293b',
        borderWidth: 2
      }
    ]
  };

  return (
    <div style={{ paddingBottom: '36px' }}>
      {/* Barra de Herramientas Estilo Grafana con Paleta Unilasallista */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
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
            <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px', color: 'var(--text-primary)' }}>
              TELEMETRÍA GRAFANA UNILASALLISTA
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              AZUL UNILASALLISTA
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              POSTGRESQL REAL
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: isHardwareSensorOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: isHardwareSensorOnline ? '#10b981' : '#ef4444', border: `1px solid ${isHardwareSensorOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
              {isHardwareSensorOnline ? '● CROWPI EN LÍNEA' : '○ CROWPI DESCONECTADO'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Auto-refresh: <b>4s</b> ({formatTime(lastRefreshTime)})
          </div>

          {/* Botón para Configurar Servidor Grafana Externo */}
          <button
            onClick={() => setShowEmbedModal(!showEmbedModal)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}
          >
            <ExternalLink size={13} />
            <span>{grafanaEmbedUrl ? 'Ver Servidor Grafana' : 'Conectar Grafana Externo'}</span>
          </button>

          <button
            onClick={() => loadData()}
            className="btn btn-secondary btn-sm"
            disabled={isRefreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            <span>Refrescar</span>
          </button>

          <Link to="/monitor" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px' }}>
            <Radio size={14} />
            <span>Escáner en Vivo</span>
          </Link>
        </div>
      </div>

      {/* Modal/Panel de Conexión de Servidor Grafana Externo */}
      {showEmbedModal && (
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '16px 20px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
              🔌 Conexión con Servidor Oficial de Grafana (Embed de Paneles)
            </div>
            <button onClick={() => setShowEmbedModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '3px 8px' }}>✕</button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
            Puedes incrustar un dashboard completo de tu servidor <b>Grafana (Cloud o Local)</b> conectado a tu PostgreSQL en Supabase. Pega la URL pública o con <code>kiosk</code>:
          </p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            <input
              type="text"
              placeholder="https://tu-grafana.com/d-solo/xxx/rfid?orgId=1&kiosk"
              value={grafanaEmbedUrl}
              onChange={(e) => {
                setGrafanaEmbedUrl(e.target.value);
                localStorage.setItem('grafana_embed_url', e.target.value);
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px'
              }}
            />
            {grafanaEmbedUrl && (
              <button
                onClick={() => {
                  setGrafanaEmbedUrl('');
                  localStorage.removeItem('grafana_embed_url');
                }}
                className="btn btn-secondary btn-sm"
              >
                Limpiar
              </button>
            )}
          </div>

          {grafanaEmbedUrl && (
            <div style={{ height: '420px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <iframe
                src={grafanaEmbedUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                title="Servidor Grafana Oficial"
              />
            </div>
          )}
        </div>
      )}

      {/* Selector de Visibilidad de Gráficas (Show/Hide individual panels) */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '10px 16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
          <SlidersHorizontal size={15} style={{ color: 'var(--accent)' }} />
          <span>Paneles de Grafana Activos:</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'picos', label: 'Picos por Hora/Minuto' },
            { key: 'carreras', label: 'Estudiantes por Carrera' },
            { key: 'semanal', label: 'Afluencia Semanal' },
            { key: 'bloques', label: 'Tráfico por Bloque' }
          ].map(p => (
            <button
              key={p.key}
              onClick={() => togglePanel(p.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                border: visiblePanels[p.key] ? '1px solid var(--accent)' : '1px solid var(--border)',
                backgroundColor: visiblePanels[p.key] ? 'var(--accent-soft)' : 'var(--bg-tertiary)',
                color: visiblePanels[p.key] ? 'var(--accent)' : 'var(--text-muted)'
              }}
            >
              {visiblePanels[p.key] ? <Eye size={12} /> : <EyeOff size={12} />}
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* FILA 1: Paneles de Métricas Clave (Grafana Stat Cards) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid #002855', // Azul Oscuro Unilasallista
          borderRadius: '6px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Accesos Hoy
            </span>
            <Activity size={16} style={{ color: '#002855' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            {stats.totalToday}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Registros reales en PostgreSQL
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: `4px solid ${successRateColor}`,
          borderRadius: '6px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Tasa Aprobación
            </span>
            <CheckCircle2 size={16} style={{ color: successRateColor }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: successRateColor, fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            {stats.totalToday > 0 ? `${stats.successRate}%` : '100%'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {stats.grantedToday} autorizados de {stats.totalToday}
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: stats.deniedToday > 0 ? '4px solid #ef4444' : '4px solid var(--border-light)',
          borderRadius: '6px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Denegados
            </span>
            <XCircle size={16} style={{ color: stats.deniedToday > 0 ? '#ef4444' : 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: stats.deniedToday > 0 ? '#ef4444' : 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            {stats.deniedToday}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Infracciones reales registradas
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid #002855',
          borderRadius: '6px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Puntos de Acceso
            </span>
            <DoorClosed size={16} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            {stats.totalDoors}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            En {stats.totalRooms} salas y 4 bloques
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: `4px solid ${isHardwareSensorOnline ? '#10b981' : 'var(--text-muted)'}`,
          borderRadius: '6px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Sensor RFID (CrowPi)
            </span>
            <Cpu size={16} style={{ color: isHardwareSensorOnline ? '#10b981' : 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: '19px', fontWeight: 800, color: isHardwareSensorOnline ? '#10b981' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '12px' }}>
            {isHardwareSensorOnline ? 'EN LÍNEA' : 'OFFLINE'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isHardwareSensorOnline ? 'Pulsos de hardware activos' : 'Sin latidos en <30s'}
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid #1d4ed8',
          borderRadius: '6px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Usuarios Matriculados
            </span>
            <Users size={16} style={{ color: '#1d4ed8' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
            {stats.activeUsers}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Enrolados en la institución
          </div>
        </div>
      </div>

      {/* GRÁFICAS INTERACTIVAS DE GRAFANA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>

        {/* GRÁFICA 1: Picos de Acceso en Tiempo Real (Por Minuto / Por Hora) */}
        {visiblePanels.picos && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '18px 20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={17} style={{ color: 'var(--accent)' }} />
                  <span>Curva de Afluencia y Detección de Picos (Grafana TimeSeries)</span>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Visualiza las horas pico y el tráfico minuto a minuto en puertas y torniquetes
                </div>
              </div>

              {/* Selector de Granularidad: Por Minuto vs Por Hora */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setTimeGranularity('hour')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: timeGranularity === 'hour' ? '1px solid var(--accent)' : '1px solid var(--border)',
                    backgroundColor: timeGranularity === 'hour' ? 'var(--accent-soft)' : 'var(--bg-tertiary)',
                    color: timeGranularity === 'hour' ? 'var(--accent)' : 'var(--text-muted)'
                  }}
                >
                  Por Hora (Hoy)
                </button>
                <button
                  onClick={() => setTimeGranularity('minute')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: timeGranularity === 'minute' ? '1px solid var(--accent)' : '1px solid var(--border)',
                    backgroundColor: timeGranularity === 'minute' ? 'var(--accent-soft)' : 'var(--bg-tertiary)',
                    color: timeGranularity === 'minute' ? 'var(--accent)' : 'var(--text-muted)'
                  }}
                >
                  Por Minuto (Última Hora)
                </button>
              </div>
            </div>

            <div style={{ height: '260px' }}>
              <Line data={picosData} options={grafanaChartOptions} />
            </div>
            {timeSeriesSource.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
                ℹ️ Base de datos lista: sin lecturas de acceso aún para graficar picos hoy.
              </div>
            )}
          </div>
        )}

        {/* FILA DE 2 GRÁFICAS: Estudiantes por Carrera + Tráfico por Bloque */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: visiblePanels.carreras && visiblePanels.bloques ? '1.4fr 1fr' : '1fr',
          gap: '20px'
        }}>
          {/* GRÁFICA 2: Estudiantes Actualmente en Campus por Carrera */}
          {visiblePanels.carreras && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '18px 20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GraduationCap size={17} style={{ color: 'var(--accent)' }} />
                    <span>Estudiantes Actualmente en Campus por Carrera</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Censo en tiempo real de población estudiantil presente según carnet RFID
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>
                  Tiempo Real
                </span>
              </div>

              <div style={{ height: '230px' }}>
                <Bar
                  data={carrerasData}
                  options={{
                    ...grafanaChartOptions,
                    indexAxis: 'y'
                  }}
                />
              </div>
              {studentsPrograms.length === 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '6px' }}>
                  ℹ️ 0 estudiantes dentro del campus en este momento.
                </div>
              )}
            </div>
          )}

          {/* GRÁFICA 3: Tráfico Acumulado por Bloque Institucional */}
          {visiblePanels.bloques && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '18px 20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={17} style={{ color: 'var(--accent)' }} />
                    <span>Distribución por Bloque</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Volumen de entradas en los 4 bloques
                  </div>
                </div>
              </div>

              <div style={{ height: '230px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={bloquesData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          color: '#94a3b8',
                          font: { family: 'var(--font-mono)', size: 10 }
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* GRÁFICA 4: Comparativa de Afluencia Semanal por Día y Carrera */}
        {visiblePanels.semanal && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '18px 20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={17} style={{ color: 'var(--accent)' }} />
                  <span>Afluencia Semanal por Día y Carrera (Grafana Multi-Bar)</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Identifica qué carrera asiste más a la universidad según el día de la semana
                </div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Últimos 7 Días
              </span>
            </div>

            <div style={{ height: '240px' }}>
              <Bar data={semanalData} options={grafanaChartOptions} />
            </div>
            {weeklyDays.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '6px' }}>
                ℹ️ Sin registros en la última semana para generar la comparativa diaria.
              </div>
            )}
          </div>
        )}
      </div>

      {/* FILA: Tabla de Logs de Auditoría en Tiempo Real (Grafana Live Stream) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '16px 20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} style={{ color: 'var(--accent)' }} />
              <span>Registro de Eventos y Auditoría en Vivo (Loki Stream)</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Últimas transacciones capturadas por el lector RFID
            </div>
          </div>
          <Link to="/logs" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>Abrir Auditoría Completa</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px' }}>
                <th style={{ padding: '8px 10px' }}>TIMESTAMP</th>
                <th style={{ padding: '8px 10px' }}>ESTADO</th>
                <th style={{ padding: '8px 10px' }}>PUNTO DE ACCESO</th>
                <th style={{ padding: '8px 10px' }}>ESPACIO & BLOQUE</th>
                <th style={{ padding: '8px 10px' }}>PERSONA / DOCUMENTO</th>
                <th style={{ padding: '8px 10px' }}>CARRERA / PROGRAMA</th>
                <th style={{ padding: '8px 10px' }}>ROL</th>
                <th style={{ padding: '8px 10px' }}>UID RAW</th>
                <th style={{ padding: '8px 10px' }}>OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No hay eventos de acceso registrados en la base de datos hoy.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log, idx) => (
                  <tr
                    key={log.id || idx}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)'
                    }}
                  >
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatTime(log.timestamp)}
                    </td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '3px',
                          backgroundColor: log.granted ? 'var(--status-ok-bg)' : 'var(--status-denied-bg)',
                          color: log.granted ? 'var(--status-ok-text)' : 'var(--status-denied-text)',
                          border: `1px solid ${log.granted ? 'var(--status-ok-border)' : 'var(--status-denied-border)'}`
                        }}
                      >
                        {log.granted ? 'GRANTED' : 'DENIED'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {log.door_name || `Acceso #${log.door_id}`}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {log.room_name || '—'}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {log.user_name || 'No enrolado'} {log.user_document && log.user_document !== '—' ? `[${log.user_document}]` : ''}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {log.user_program && log.user_program !== '—' ? log.user_program : 'General'}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                      {log.role_name || 'Estudiante'}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {log.rfid_uid_raw || '—'}
                    </td>
                    <td style={{ padding: '8px 10px', color: log.granted ? 'var(--text-muted)' : 'var(--status-denied-text)', fontSize: '11px' }}>
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
