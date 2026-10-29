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
  ChevronRight,
  ShieldCheck,
  PieChart,
  BarChart3,
  Clock
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

  // Selector de Visibilidad de Paneles Grafana
  const [visiblePanels, setVisiblePanels] = useState(() => {
    try {
      const saved = localStorage.getItem('grafana_visible_panels');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      picos: true,
      carreras: true,
      bloques: true,
      semanal: true
    };
  });

  const togglePanel = (panelKey) => {
    setVisiblePanels(prev => {
      const updated = { ...prev, [panelKey]: !prev[panelKey] };
      localStorage.setItem('grafana_visible_panels', JSON.stringify(updated));
      return updated;
    });
  };

  // Escuchar eventos en vivo por WebSocket
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
  const successRateColor = stats.successRate >= 95 ? '#10b981' : stats.successRate >= 80 ? '#f59e0b' : '#ef4444';

  // Opciones de estilo Grafana auténtico para Chart.js
  const grafanaChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350 },
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
          pointStyle: 'circle',
          padding: 16
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

  // 1. Datos de la gráfica de picos (Por hora o Por minuto)
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
        borderColor: '#2563eb', // Azul Unilasallista
        backgroundColor: 'rgba(37, 99, 235, 0.15)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: timeGranularity === 'minute' ? 1.5 : 3
      },
      {
        label: 'Accesos denegados (alertas)',
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

  // 2. Datos gráfica: Estudiantes actualmente en campus por carrera
  const studentsPrograms = analytics.studentsByProgram?.length > 0
    ? analytics.studentsByProgram
    : [];

  const totalStudentsInCampus = studentsPrograms.reduce((acc, p) => acc + (p.active_students || 0), 0);

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

  // 3. Tráfico por bloque institucional con cálculo de porcentajes
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

  // 4. Afluencia semanal por día y carrera
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
            { key: 'picos', label: 'Picos de acceso' },
            { key: 'carreras', label: 'Estudiantes por carrera' },
            { key: 'bloques', label: 'Tráfico por bloque' },
            { key: 'semanal', label: 'Afluencia semanal' }
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

      {/* Fila de Stat Panels de Grafana (KPIs con acento institucional) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        {/* Accesos de hoy */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid #002855',
          borderRadius: 'var(--radius)',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Accesos de hoy
            </span>
            <Activity size={17} style={{ color: '#002855' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px', fontVariantNumeric: 'tabular-nums' }}>
            {stats.totalToday}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Registros totales del día
          </div>
        </div>

        {/* Tasa de aprobación */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: `4px solid ${successRateColor}`,
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

        {/* Denegados / Infracciones */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: stats.deniedToday > 0 ? '4px solid #ef4444' : '4px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Accesos denegados
            </span>
            <XCircle size={17} style={{ color: stats.deniedToday > 0 ? '#ef4444' : 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: stats.deniedToday > 0 ? '#ef4444' : 'var(--text-primary)', marginTop: '8px', fontVariantNumeric: 'tabular-nums' }}>
            {stats.deniedToday}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Infracciones detectadas hoy
          </div>
        </div>

        {/* Puntos de acceso */}
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
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px', fontVariantNumeric: 'tabular-nums' }}>
            {stats.totalDoors}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            En {stats.totalRooms} salas y 4 bloques
          </div>
        </div>

        {/* Estado del sensor RFID físico */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: `4px solid ${isHardwareSensorOnline ? '#10b981' : 'var(--text-muted)'}`,
          borderRadius: 'var(--radius)',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Sensor RFID
            </span>
            <Cpu size={17} style={{ color: isHardwareSensorOnline ? '#10b981' : 'var(--text-muted)' }} />
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: 700,
            color: isHardwareSensorOnline ? '#10b981' : 'var(--text-muted)',
            marginTop: '12px'
          }}>
            {isHardwareSensorOnline ? 'En línea' : 'Desconectado'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isHardwareSensorOnline ? 'Pulsos de hardware activos' : 'Sin latidos en <30s'}
          </div>
        </div>

        {/* Población activa */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid #1d4ed8',
          borderRadius: 'var(--radius)',
          padding: '16px 18px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Población en campus
            </span>
            <Users size={17} style={{ color: '#1d4ed8' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px', fontVariantNumeric: 'tabular-nums' }}>
            {totalStudentsInCampus}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Estudiantes dentro del campus
          </div>
        </div>
      </div>

      {/* Paneles de Gráficas de Grafana */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>

        {/* Panel 1: Curva de Afluencia y Picos de Acceso (Grafana TimeSeries) */}
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
                  <span>Curva de afluencia y picos de acceso</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Identifica las horas pico y el tráfico en puertas minuto a minuto
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
              <Line data={picosData} options={grafanaChartOptions} />
            </div>
            {timeSeriesSource.length === 0 && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px' }}>
                Sin lecturas registradas aún para graficar la curva de hoy.
              </div>
            )}
          </div>
        )}

        {/* Fila de 2 Paneles: Estudiantes por Carrera + Tráfico por Bloque */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: visiblePanels.carreras && visiblePanels.bloques ? '1.3fr 1fr' : '1fr',
          gap: '20px'
        }}>
          {/* Panel 2: Estudiantes presentes por carrera (Bar Gauge) */}
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
                    Censo en tiempo real de población estudiantil por carnet RFID
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
                  {totalStudentsInCampus} presentes
                </span>
              </div>

              <div style={{ height: '240px' }}>
                <Bar
                  data={carrerasData}
                  options={{
                    ...grafanaChartOptions,
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

          {/* Panel 3: Tráfico por Bloque (Donut con porcentajes) */}
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
                  Volumen de accesos y porcentajes en los 4 bloques
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

        {/* Panel 4: Afluencia semanal por día y carrera */}
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
                  Comparativa de qué carreras asisten más según el día de la semana
                </div>
              </div>
            </div>

            <div style={{ height: '240px' }}>
              <Bar data={semanalData} options={grafanaChartOptions} />
            </div>
            {weeklyDays.length === 0 && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px' }}>
                Sin registros durante la última semana para generar la comparativa diaria.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabla de Registros en Vivo (Estilo Grafana Loki) */}
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
