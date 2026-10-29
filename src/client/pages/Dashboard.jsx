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
import { Line, Doughnut } from 'react-chartjs-2';
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
  ChevronRight,
  ShieldCheck,
  BarChart3,
  Flame,
  Gauge as GaugeIcon,
  Clock,
  Layers
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

// =========================================================================
// COMPONENTES DE VISUALIZACIÓN OFICIALES ESTILO GRAFANA
// =========================================================================

// 1. Grafana Radial Gauge Component (Semicírculo con umbrales verde/amarillo/rojo)
const GrafanaRadialGauge = ({ value, label = 'Tasa de aprobación' }) => {
  const clamped = Math.min(Math.max(value, 0), 100);
  const radius = 64;
  const strokeWidth = 12;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clamped / 100);
  const color = value >= 95 ? '#10b981' : value >= 80 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '190px' }}>
      <svg width="190" height="115" viewBox="0 0 190 115" style={{ overflow: 'visible' }}>
        {/* Pista de fondo */}
        <path
          d="M 25 105 A 64 64 0 0 1 165 105"
          fill="none"
          stroke="var(--bg-tertiary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Arco de valor */}
        <path
          d="M 25 105 A 64 64 0 0 1 165 105"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
        />
        {/* Valor central */}
        <text x="95" y="90" textAnchor="middle" fill="var(--text-primary)" fontSize="28" fontWeight="700">
          {value}%
        </text>
        <text x="32" y="112" textAnchor="middle" fill="var(--text-muted)" fontSize="10">0%</text>
        <text x="158" y="112" textAnchor="middle" fill="var(--text-muted)" fontSize="10">100%</text>
      </svg>
      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
        {value >= 95 ? 'Nivel óptimo (>95%)' : value >= 80 ? 'Precaución' : 'Atención crítica requerida'}
      </div>
    </div>
  );
};

// 2. Grafana Bar Gauge Component (Barras horizontales de progreso y porcentaje)
const GrafanaBarGauge = ({ items, total }) => {
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No hay estudiantes dentro del campus en este momento.
      </div>
    );
  }

  const palette = ['#002855', '#1d4ed8', '#2563eb', '#38bdf8', '#10b981', '#8b5cf6', '#f59e0b'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}>
      {items.map((item, idx) => {
        const count = item.active_students || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const color = palette[idx % palette.length];

        return (
          <div key={item.program || idx} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.program}</span>
              <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', fontSize: '12.5px' }}>
                <b style={{ color: 'var(--text-primary)' }}>{count}</b> estudiante{count === 1 ? '' : 's'} ({pct}%)
              </span>
            </div>
            <div style={{
              height: '11px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '5px',
              overflow: 'hidden',
              border: '1px solid var(--border)'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.max(pct, 2)}%`,
                backgroundColor: color,
                borderRadius: '5px',
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 3. Grafana Heatmap Component (Matriz de calor: Días vs Horas)
const GrafanaHeatmap = ({ data }) => {
  const days = [
    { dow: 1, label: 'Lunes' },
    { dow: 2, label: 'Martes' },
    { dow: 3, label: 'Miércoles' },
    { dow: 4, label: 'Jueves' },
    { dow: 5, label: 'Viernes' },
    { dow: 6, label: 'Sábado' }
  ];
  const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  const matrix = {};
  let maxCount = 1;
  (data || []).forEach(d => {
    const key = `${d.dow}-${d.hour}`;
    matrix[key] = d.count;
    if (d.count > maxCount) maxCount = d.count;
  });

  const getHeatColor = (count) => {
    if (!count || count === 0) return 'var(--bg-tertiary)';
    const ratio = count / maxCount;
    if (ratio < 0.25) return 'rgba(37, 99, 235, 0.25)';
    if (ratio < 0.5) return 'rgba(37, 99, 235, 0.55)';
    if (ratio < 0.75) return '#2563eb';
    return '#38bdf8'; // Pico más alto
  };

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '3px', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, paddingRight: '8px', paddingBottom: '6px' }}>Día</th>
              {hours.map(h => (
                <th key={h} style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500, width: '30px', paddingBottom: '6px' }}>
                  {h}h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(d => (
              <tr key={d.dow}>
                <td style={{ color: 'var(--text-secondary)', fontWeight: 600, paddingRight: '8px', whiteSpace: 'nowrap' }}>
                  {d.label}
                </td>
                {hours.map(h => {
                  const count = matrix[`${d.dow}-${h}`] || 0;
                  return (
                    <td
                      key={h}
                      title={`${d.label} a las ${h}:00 — ${count} accesos`}
                      style={{
                        height: '24px',
                        backgroundColor: getHeatColor(count),
                        borderRadius: '3px',
                        textAlign: 'center',
                        color: count > 0 ? '#ffffff' : 'transparent',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'default',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {count > 0 ? count : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
        <span>Mapa de calor de afluencia por franja horaria</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Tranquilo</span>
          <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', border: '1px solid var(--border)' }} />
          <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(37, 99, 235, 0.3)', borderRadius: '2px' }} />
          <div style={{ width: '12px', height: '12px', backgroundColor: '#2563eb', borderRadius: '2px' }} />
          <div style={{ width: '12px', height: '12px', backgroundColor: '#38bdf8', borderRadius: '2px' }} />
          <span>Hora pico</span>
        </div>
      </div>
    </div>
  );
};

// 4. Grafana Sparkline Component para Stat Cards
const GrafanaSparkline = ({ data, color = '#2563eb' }) => {
  const points = (data && data.length > 0) ? data : [0, 0, 0, 0, 0, 0];
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const width = 84;
  const height = 24;

  const pathPoints = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pathPoints.join(' ')}
      />
    </svg>
  );
};

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
    byBlock: [],
    heatmap: [],
    topDoors: []
  });

  const [recentLogs, setRecentLogs] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [doors, setDoors] = useState([]);
  const [timeGranularity, setTimeGranularity] = useState('hour'); // 'hour' | 'minute'
  const [loading, setLoading] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selector de Visibilidad de Paneles Grafana
  const [visiblePanels, setVisiblePanels] = useState(() => {
    try {
      const saved = localStorage.getItem('grafana_visible_panels');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      picos: true,
      gauge: true,
      carreras: true,
      bloques: true,
      heatmap: true,
      puertas: true
    };
  });

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
      console.warn('Error cargando analítica:', e);
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

  // Opciones de estilo Grafana auténtico para Chart.js
  const grafanaChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: 'var(--text-secondary)',
          font: { family: 'var(--font-ui)', size: 12, weight: '500' },
          boxWidth: 10,
          boxHeight: 10,
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
        cornerRadius: 6,
        titleFont: { family: 'var(--font-ui)', size: 13, weight: '600' },
        bodyFont: { family: 'var(--font-ui)', size: 12 }
      }
    },
    scales: {
      x: {
        grid: { color: 'var(--border)' },
        ticks: { color: 'var(--text-muted)', font: { family: 'var(--font-ui)', size: 11.5 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'var(--border)' },
        ticks: {
          color: 'var(--text-muted)',
          font: { family: 'var(--font-ui)', size: 11.5 },
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
        backgroundColor: 'rgba(37, 99, 235, 0.15)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: timeGranularity === 'minute' ? 1.5 : 3
      },
      {
        label: 'Accesos denegados (infracciones)',
        data: timeSeriesSource.length > 0 ? timeSeriesSource.map(d => d.denied) : new Array(timeSlots.length).fill(0),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: timeGranularity === 'minute' ? 1.5 : 3
      }
    ]
  };

  // 2. Estudiantes en campus por carrera
  const studentsPrograms = analytics.studentsByProgram?.length > 0
    ? analytics.studentsByProgram
    : [];
  const totalStudentsInCampus = studentsPrograms.reduce((acc, p) => acc + (p.active_students || 0), 0);

  // 3. Tráfico por bloque con cálculo de porcentajes
  const blockStats = analytics.byBlock?.length > 0
    ? analytics.byBlock
    : [
        { block_name: 'Bloque A', count: 0 },
        { block_name: 'Bloque B', count: 0 },
        { block_name: 'Bloque C', count: 0 },
        { block_name: 'Bloque Administrativo', count: 0 }
      ];

  const totalBlockAccesses = blockStats.reduce((acc, b) => acc + (b.count || 0), 0);

  const bloquesData = {
    labels: blockStats.map(b => {
      const pct = totalBlockAccesses > 0 ? Math.round((b.count / totalBlockAccesses) * 100) : 0;
      return `${b.block_name} (${pct}%)`;
    }),
    datasets: [
      {
        data: blockStats.map(b => b.count || 0),
        backgroundColor: ['#002855', '#2563eb', '#38bdf8', '#8b5cf6'],
        borderWidth: 1,
        borderColor: 'var(--border)'
      }
    ]
  };

  // Sparkline data arrays para las stat cards
  const hourlyCounts = analytics.hourly.map(h => h.total);
  const hourlyDenied = analytics.hourly.map(h => h.denied);

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Barra de cabecera Grafana */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={22} style={{ color: 'var(--accent)' }} />
            <div>
              <h1 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Panel de Telemetría Grafana · Unilasallista
              </h1>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Métricas, curvas de afluencia y control de accesos en tiempo real
              </p>
            </div>
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
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: isHardwareSensorOnline ? '#10b981' : '#ef4444'
              }} />
              {isHardwareSensorOnline ? 'Lector RFID en línea' : 'Lector RFID desconectado'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Refresco en vivo: <b>4s</b> ({formatTime(lastRefreshTime)})
          </span>

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

      {/* Selector de Paneles Grafana Visibles (Show / Hide) */}
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
          <span>Paneles de gráficas activas:</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'picos', label: 'Curva de picos' },
            { key: 'gauge', label: 'Medidor radial' },
            { key: 'carreras', label: 'Bar gauge carreras' },
            { key: 'heatmap', label: 'Mapa de calor' },
            { key: 'bloques', label: 'Tráfico por bloque' },
            { key: 'puertas', label: 'Ranking de puertas' }
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
                fontSize: '12px',
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

      {/* Fila de Stat Panels de Grafana (KPIs con Sparklines) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        {/* Accesos de hoy con Sparkline */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid #002855',
          borderRadius: 'var(--radius)',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Accesos de hoy
            </span>
            <Activity size={17} style={{ color: '#002855' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {stats.totalToday}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Registros reales
              </div>
            </div>
            <GrafanaSparkline data={hourlyCounts} color="#2563eb" />
          </div>
        </div>

        {/* Infracciones / Denegados con Sparkline */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: stats.deniedToday > 0 ? '4px solid #ef4444' : '4px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Accesos denegados
            </span>
            <XCircle size={17} style={{ color: stats.deniedToday > 0 ? '#ef4444' : 'var(--text-muted)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: stats.deniedToday > 0 ? '#ef4444' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {stats.deniedToday}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Infracciones hoy
              </div>
            </div>
            <GrafanaSparkline data={hourlyDenied} color="#ef4444" />
          </div>
        </div>

        {/* Puntos de control */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid #2563eb',
          borderRadius: 'var(--radius)',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Puntos de control
            </span>
            <DoorClosed size={17} style={{ color: '#2563eb' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '10px', fontVariantNumeric: 'tabular-nums' }}>
            {stats.totalDoors}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            En {stats.totalRooms} salas y 4 bloques
          </div>
        </div>

        {/* Población en campus */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid #10b981',
          borderRadius: 'var(--radius)',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Población en campus
            </span>
            <Users size={17} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '10px', fontVariantNumeric: 'tabular-nums' }}>
            {totalStudentsInCampus}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Estudiantes presentes ahora
          </div>
        </div>
      </div>

      {/* FILA 1: TimeSeries (Curva de Afluencia) + Radial Gauge (Tasa de Aprobación) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: visiblePanels.picos && visiblePanels.gauge ? '1.7fr 1fr' : '1fr',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Panel 1: Curva de Afluencia TimeSeries */}
        {visiblePanels.picos && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px 22px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
                  <span>Curva de afluencia y picos en tiempo real</span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Comportamiento del tráfico minuto a minuto y por horas
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setTimeGranularity('hour')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '5px',
                    fontSize: '12px',
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
                    padding: '4px 12px',
                    borderRadius: '5px',
                    fontSize: '12px',
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

            <div style={{ height: '240px' }}>
              <Line data={picosData} options={grafanaChartOptions} />
            </div>
          </div>
        )}

        {/* Panel 2: Grafana Radial Gauge */}
        {visiblePanels.gauge && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GaugeIcon size={18} style={{ color: 'var(--accent)' }} />
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Medidor de aprobación
              </div>
            </div>

            <GrafanaRadialGauge
              value={stats.successRate}
              label={`${stats.grantedToday} autorizados de ${stats.totalToday}`}
            />
          </div>
        )}
      </div>

      {/* FILA 2: Bar Gauge (Estudiantes por Carrera) + Donut (Tráfico por Bloque) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: visiblePanels.carreras && visiblePanels.bloques ? '1.4fr 1fr' : '1fr',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Panel 3: Grafana Bar Gauge */}
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
                  <span>Censo de estudiantes en campus por carrera</span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Bar gauge con conteo y porcentaje relativo de la población
                </div>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
                {totalStudentsInCampus} presentes
              </span>
            </div>

            <GrafanaBarGauge items={studentsPrograms} total={totalStudentsInCampus} />
          </div>
        )}

        {/* Panel 4: Grafana Donut Chart */}
        {visiblePanels.bloques && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px 22px'
          }}>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={18} style={{ color: 'var(--accent)' }} />
                <span>Distribución por bloque</span>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Afluencia y proporciones en los 4 bloques
              </div>
            </div>

            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                        font: { family: 'var(--font-ui)', size: 11.5 },
                        boxWidth: 10,
                        boxHeight: 10,
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

      {/* FILA 3: Heatmap de Horas Pico + Ranking de Puertas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: visiblePanels.heatmap && visiblePanels.puertas ? '1.5fr 1fr' : '1fr',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Panel 5: Grafana Heatmap */}
        {visiblePanels.heatmap && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px 22px'
          }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={18} style={{ color: '#f59e0b' }} />
                <span>Mapa de calor de horas pico</span>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Densidad histórica de concurrencia por día de la semana y hora del día
              </div>
            </div>

            <GrafanaHeatmap data={analytics.heatmap} />
          </div>
        )}

        {/* Panel 6: Ranking de Puertas con Mayor Tráfico */}
        {visiblePanels.puertas && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px 22px'
          }}>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: 'var(--accent)' }} />
                <span>Puntos de acceso más transitados</span>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Ranking de accesos registrados hoy
              </div>
            </div>

            {(!analytics.topDoors || analytics.topDoors.length === 0) ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                No hay movimientos registrados hoy en las puertas.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analytics.topDoors.map((door, idx) => {
                  const maxDoor = analytics.topDoors[0]?.count || 1;
                  const pct = maxDoor > 0 ? Math.round((door.count / maxDoor) * 100) : 0;
                  return (
                    <div key={door.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          #{idx + 1} {door.door_name}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          <b>{door.count}</b> accesos
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {door.room_name} ({door.block_name})
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#2563eb', borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabla de Registros en Vivo (Estilo Grafana Loki Table) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '18px 20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={17} style={{ color: 'var(--accent)' }} />
              <span>Registro de transacciones en tiempo real</span>
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
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
