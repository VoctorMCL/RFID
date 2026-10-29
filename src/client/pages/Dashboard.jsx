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
  Activity,
  CheckCircle2,
  XCircle,
  Users,
  Building2,
  DoorClosed,
  Radio,
  Cpu,
  RefreshCw,
  SlidersHorizontal,
  GraduationCap,
  TrendingUp,
  Calendar,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertCircle
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

  // Visibilidad de paneles de analítica
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

  const [grafanaEmbedUrl, setGrafanaEmbedUrl] = useState(() => localStorage.getItem('grafana_embed_url') || '');
  const [showEmbedModal, setShowEmbedModal] = useState(false);

  const togglePanel = (panelKey) => {
    setVisiblePanels(prev => {
      const updated = { ...prev, [panelKey]: !prev[panelKey] };
      localStorage.setItem('grafana_visible_panels', JSON.stringify(updated));
      return updated;
    });
  };

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
          user_name: data.user ? `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim() : 'No registrado',
          user_document: data.user?.document_id || '—',
          user_program: data.user?.program || '—',
          role_name: data.user?.role || 'Estudiante',
          rfid_uid_raw: data.uid,
          door_id: data.door?.id,
          door_name: data.door ? data.door.name : 'Punto de acceso',
          room_name: data.room ? data.room.name : 'Espacio institucional',
          granted: data.granted,
          denial_reason: data.denialReason || null,
          timestamp: data.timestamp || new Date().toISOString()
        },
        ...prev.slice(0, 11)
      ]);

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
      console.warn('Error al cargar analítica:', e);
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
      console.error('Error cargando datos del dashboard:', err);
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
  const successRateColor = stats.successRate >= 95 ? 'var(--status-ok-text)' : stats.successRate >= 80 ? 'var(--status-alert-text)' : 'var(--status-denied-text)';

  // Opciones de estilo limpias y tipografía legible para Chart.js
  const chartCommonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        labels: {
          color: 'var(--text-secondary)',
          font: { family: 'var(--font-ui)', size: 12.5, weight: '500' },
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'var(--bg-secondary)',
        titleColor: 'var(--text-primary)',
        bodyColor: 'var(--text-secondary)',
        borderColor: 'var(--border)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        cornerRadius: 6,
        titleFont: { family: 'var(--font-ui)', size: 13, weight: '600' },
        bodyFont: { family: 'var(--font-ui)', size: 12 }
      }
    },
    scales: {
      x: {
        grid: { color: 'var(--border)' },
        ticks: { color: 'var(--text-muted)', font: { family: 'var(--font-ui)', size: 12 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'var(--border)' },
        ticks: {
          color: 'var(--text-muted)',
          font: { family: 'var(--font-ui)', size: 12 },
          precision: 0
        }
      }
    }
  };

  // 1. Datos gráfica de picos (Por hora o Por minuto)
  const timeSeriesSource = timeGranularity === 'minute' ? analytics.minute : analytics.hourly;
  const timeSlots = timeSeriesSource.length > 0
    ? timeSeriesSource.map(d => d.time_slot)
    : (timeGranularity === 'minute' ? ['--:--'] : ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']);

  const picosData = {
    labels: timeSlots,
    datasets: [
      {
        label: 'Accesos autorizados',
        data: timeSeriesSource.length > 0 ? timeSeriesSource.map(d => d.granted) : new Array(timeSlots.length).fill(0),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: timeGranularity === 'minute' ? 1.5 : 3
      },
      {
        label: 'Intentos denegados',
        data: timeSeriesSource.length > 0 ? timeSeriesSource.map(d => d.denied) : new Array(timeSlots.length).fill(0),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.06)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: timeGranularity === 'minute' ? 1.5 : 3
      }
    ]
  };

  // 2. Datos gráfica de estudiantes en campus por carrera
  const studentsPrograms = analytics.studentsByProgram?.length > 0
    ? analytics.studentsByProgram
    : [];

  const carrerasData = {
    labels: studentsPrograms.length > 0 ? studentsPrograms.map(p => p.program) : ['Sin registros de carrera'],
    datasets: [
      {
        label: 'Estudiantes presentes',
        data: studentsPrograms.length > 0 ? studentsPrograms.map(p => p.active_students) : [0],
        backgroundColor: [
          '#002855',
          '#1d4ed8',
          '#2563eb',
          '#3b82f6',
          '#60a5fa',
          '#10b981',
          '#8b5cf6'
        ],
        borderRadius: 4
      }
    ]
  };

  // 3. Afluencia semanal
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
        label: 'Afluencia semanal',
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: '#002855',
        borderRadius: 4
      }
    ]
  };

  // 4. Tráfico por bloque
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
        borderWidth: 1,
        borderColor: 'var(--border)'
      }
    ]
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Barra superior de estado y acciones */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Panel de control y analítica
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Monitoreo en tiempo real del campus institucional
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 500,
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: isHardwareSensorOnline ? 'var(--status-ok-bg)' : 'var(--status-denied-bg)',
              color: isHardwareSensorOnline ? 'var(--status-ok-text)' : 'var(--status-denied-text)',
              border: `1px solid ${isHardwareSensorOnline ? 'var(--status-ok-border)' : 'var(--status-denied-border)'}`
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isHardwareSensorOnline ? '#10b981' : '#ef4444'
              }} />
              {isHardwareSensorOnline ? 'Lector RFID en línea' : 'Lector RFID desconectado'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
            Actualización: 4s ({formatTime(lastRefreshTime)})
          </span>

          <button
            onClick={() => setShowEmbedModal(!showEmbedModal)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '12.5px', padding: '6px 12px' }}
          >
            <ExternalLink size={14} />
            <span>{grafanaEmbedUrl ? 'Servidor Grafana' : 'Integrar Grafana'}</span>
          </button>

          <button
            onClick={() => loadData()}
            className="btn btn-secondary btn-sm"
            disabled={isRefreshing}
            style={{ fontSize: '12.5px', padding: '6px 12px' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>Refrescar</span>
          </button>

          <Link to="/monitor" className="btn btn-primary btn-sm" style={{ fontSize: '12.5px', padding: '6px 14px' }}>
            <Radio size={14} />
            <span>Escáner en vivo</span>
          </Link>
        </div>
      </div>

      {/* Modal de Servidor Grafana Externo */}
      {showEmbedModal && (
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '18px 20px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
              Integración con servidor de Grafana
            </div>
            <button onClick={() => setShowEmbedModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }}>✕</button>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
            Pegue la URL pública o con parámetro <code>kiosk</code> de su panel de Grafana conectado a PostgreSQL:
          </p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            <input
              type="text"
              placeholder="https://su-grafana.com/d-solo/xxx/rfid?orgId=1&kiosk"
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
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px'
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
                Quitar enlace
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
                title="Servidor Grafana"
              />
            </div>
          )}
        </div>
      )}

      {/* Selector de Paneles Visibles */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '10px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          <SlidersHorizontal size={15} style={{ color: 'var(--accent)' }} />
          <span>Gráficas en pantalla:</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'picos', label: 'Picos de acceso' },
            { key: 'carreras', label: 'Estudiantes por carrera' },
            { key: 'semanal', label: 'Afluencia semanal' },
            { key: 'bloques', label: 'Tráfico por bloque' }
          ].map(p => (
            <button
              key={p.key}
              onClick={() => togglePanel(p.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
                border: visiblePanels[p.key] ? '1px solid var(--accent)' : '1px solid var(--border)',
                backgroundColor: visiblePanels[p.key] ? 'var(--accent-soft)' : 'var(--bg-primary)',
                color: visiblePanels[p.key] ? 'var(--accent)' : 'var(--text-muted)'
              }}
            >
              {visiblePanels[p.key] ? <Eye size={13} /> : <EyeOff size={13} />}
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas de Métricas Clave (KPIs) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Accesos de hoy
            </span>
            <Activity size={17} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px', fontVariantNumeric: 'tabular-nums' }}>
            {stats.totalToday}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Registros totales del día
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Tasa de aprobación
            </span>
            <CheckCircle2 size={17} style={{ color: successRateColor }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: successRateColor, marginTop: '8px', fontVariantNumeric: 'tabular-nums' }}>
            {stats.totalToday > 0 ? `${stats.successRate}%` : '100%'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {stats.grantedToday} autorizados de {stats.totalToday}
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Accesos denegados
            </span>
            <XCircle size={17} style={{ color: stats.deniedToday > 0 ? 'var(--status-denied-text)' : 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: stats.deniedToday > 0 ? 'var(--status-denied-text)' : 'var(--text-primary)', marginTop: '8px', fontVariantNumeric: 'tabular-nums' }}>
            {stats.deniedToday}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Intentos no autorizados hoy
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Puntos de control
            </span>
            <DoorClosed size={17} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px', fontVariantNumeric: 'tabular-nums' }}>
            {stats.totalDoors}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            En {stats.totalRooms} salas y 4 bloques
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Sensor RFID
            </span>
            <Cpu size={17} style={{ color: isHardwareSensorOnline ? 'var(--status-ok-text)' : 'var(--text-muted)' }} />
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: 700,
            color: isHardwareSensorOnline ? 'var(--status-ok-text)' : 'var(--text-muted)',
            marginTop: '12px'
          }}>
            {isHardwareSensorOnline ? 'En línea' : 'Desconectado'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isHardwareSensorOnline ? 'Pulsos de hardware recibidos' : 'Sin comunicación en <30s'}
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Usuarios registrados
            </span>
            <Users size={17} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px', fontVariantNumeric: 'tabular-nums' }}>
            {stats.activeUsers}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Personal y estudiantes activos
          </div>
        </div>
      </div>

      {/* Gráficas de analítica */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>

        {/* Gráfica 1: Picos de acceso por hora / minuto */}
        {visiblePanels.picos && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px 22px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
                  <span>Curva de afluencia y picos de tráfico</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Comportamiento del flujo de ingreso a lo largo del tiempo
                </div>
              </div>

              {/* Selector de Granularidad */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setTimeGranularity('hour')}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: timeGranularity === 'hour' ? '1px solid var(--accent)' : '1px solid var(--border)',
                    backgroundColor: timeGranularity === 'hour' ? 'var(--accent-soft)' : 'var(--bg-primary)',
                    color: timeGranularity === 'hour' ? 'var(--accent)' : 'var(--text-muted)'
                  }}
                >
                  Por hora (hoy)
                </button>
                <button
                  onClick={() => setTimeGranularity('minute')}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: timeGranularity === 'minute' ? '1px solid var(--accent)' : '1px solid var(--border)',
                    backgroundColor: timeGranularity === 'minute' ? 'var(--accent-soft)' : 'var(--bg-primary)',
                    color: timeGranularity === 'minute' ? 'var(--accent)' : 'var(--text-muted)'
                  }}
                >
                  Por minuto (reciente)
                </button>
              </div>
            </div>

            <div style={{ height: '260px' }}>
              <Line data={picosData} options={chartCommonOptions} />
            </div>
            {timeSeriesSource.length === 0 && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px' }}>
                Sin lecturas registradas aún para graficar la curva de hoy.
              </div>
            )}
          </div>
        )}

        {/* Fila de 2 Gráficas: Estudiantes por Carrera + Tráfico por Bloque */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: visiblePanels.carreras && visiblePanels.bloques ? '1.3fr 1fr' : '1fr',
          gap: '20px'
        }}>
          {/* Gráfica 2: Estudiantes presentes por carrera */}
          {visiblePanels.carreras && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '20px 22px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GraduationCap size={18} style={{ color: 'var(--accent)' }} />
                    <span>Estudiantes en campus por carrera</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Población estudiantil actualmente dentro de las instalaciones
                  </div>
                </div>
              </div>

              <div style={{ height: '240px' }}>
                <Bar
                  data={carrerasData}
                  options={{
                    ...chartCommonOptions,
                    indexAxis: 'y'
                  }}
                />
              </div>
              {studentsPrograms.length === 0 && (
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px' }}>
                  No hay estudiantes registrados dentro del campus en este momento.
                </div>
              )}
            </div>
          )}

          {/* Gráfica 3: Tráfico por Bloque */}
          {visiblePanels.bloques && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '20px 22px'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={18} style={{ color: 'var(--accent)' }} />
                  <span>Distribución por bloque</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Volumen de accesos en los 4 bloques
                </div>
              </div>

              <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={bloquesData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          color: 'var(--text-secondary)',
                          font: { family: 'var(--font-ui)', size: 12 },
                          boxWidth: 12,
                          boxHeight: 12,
                          usePointStyle: true
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Gráfica 4: Afluencia semanal */}
        {visiblePanels.semanal && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px 22px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} style={{ color: 'var(--accent)' }} />
                  <span>Afluencia semanal por día y carrera</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Comparativa de asistencia en los últimos 7 días
                </div>
              </div>
            </div>

            <div style={{ height: '240px' }}>
              <Bar data={semanalData} options={chartCommonOptions} />
            </div>
            {weeklyDays.length === 0 && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px' }}>
                Sin registros durante la última semana para generar la comparativa diaria.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabla de Registros de Acceso Recientes */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '18px 20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Últimos registros de acceso
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Transacciones capturadas en tiempo real por el sistema de control
            </p>
          </div>
          <Link
            to="/logs"
            style={{
              fontSize: '13px',
              color: 'var(--accent)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>Ver historial completo</span>
            <ChevronRight size={15} />
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Estado</th>
                <th>Punto de acceso</th>
                <th>Ubicación</th>
                <th>Persona</th>
                <th>Carrera / Área</th>
                <th>Rol</th>
                <th>Tarjeta RFID</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={28} style={{ opacity: 0.5 }} />
                      <div style={{ fontSize: '13.5px', fontWeight: 500 }}>No hay eventos de acceso registrados hoy</div>
                      <div style={{ fontSize: '12.5px' }}>Pase una tarjeta por el lector o abra el escáner para comenzar.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                recentLogs.map((log, idx) => (
                  <tr key={log.id || idx}>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatTime(log.timestamp)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className={`badge ${log.granted ? 'badge-ok' : 'badge-denied'}`}>
                        {log.granted ? 'Autorizado' : 'Denegado'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {log.door_name || `Acceso #${log.door_id}`}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {log.room_name || '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 500 }}>{log.user_name || 'No enrolado'}</span>
                      {log.user_document && log.user_document !== '—' && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '6px' }}>
                          ({log.user_document})
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--accent)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {log.user_program && log.user_program !== '—' ? log.user_program : 'General'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                      {log.role_name || 'Estudiante'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {log.rfid_uid_raw || '—'}
                    </td>
                    <td style={{ color: log.granted ? 'var(--text-muted)' : 'var(--status-denied-text)', fontSize: '13px' }}>
                      {log.granted ? 'Ingreso permitido' : (log.denial_reason || 'Rechazado')}
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
