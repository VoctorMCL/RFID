import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

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
  ChevronRight,
  ShieldCheck,
  Flame,
  Gauge as GaugeIcon,
  Clock,
  Layers,
  GripHorizontal,
  RotateCcw
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
// COMPONENTES DE VISUALIZACIÓN GRAFANA (ESTÉTICA KUBERNETES & BI)
// =========================================================================

// 1. Radial Gauge de Grafana (Arcos vivos de alto contraste)
const GrafanaRadialGauge = ({ value, label = 'Tasa de aprobación' }) => {
  const clamped = Math.min(Math.max(value, 0), 100);
  const radius = 68;
  const strokeWidth = 14;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clamped / 100);

  // Colores vivos de Grafana (Verde neón #73bf69, Amarillo #fede00, Rojo #f2495c)
  const color = value >= 95 ? '#73bf69' : value >= 80 ? '#fede00' : '#f2495c';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
      <svg width="200" height="120" viewBox="0 0 200 120" style={{ overflow: 'visible' }}>
        {/* Pista de fondo */}
        <path
          d="M 25 105 A 68 68 0 0 1 175 105"
          fill="none"
          stroke="#22252b"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Arco de valor vivo */}
        <path
          d="M 25 105 A 68 68 0 0 1 175 105"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
        />
        {/* Valor central grande */}
        <text x="100" y="92" textAnchor="middle" fill="#ffffff" fontSize="30" fontWeight="800">
          {value}%
        </text>
        <text x="30" y="115" textAnchor="middle" fill="#8e8e8e" fontSize="10">0%</text>
        <text x="170" y="115" textAnchor="middle" fill="#8e8e8e" fontSize="10">100%</text>
      </svg>
      <div style={{ fontSize: '13px', color: '#d8d9da', fontWeight: 600, marginTop: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '11px', color: '#8e8e8e', marginTop: '2px' }}>
        {value >= 95 ? 'Nivel óptimo de seguridad (>95%)' : value >= 80 ? 'Infracciones moderadas' : 'Alerta de seguridad crítica'}
      </div>
    </div>
  );
};

// 2. Bar Gauge de Grafana (Barras horizontales de gradiente y porcentaje relativo)
const GrafanaBarGauge = ({ items, total }) => {
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '36px 20px', textAlign: 'center', color: '#8e8e8e', fontSize: '13px' }}>
        No hay estudiantes dentro del campus en este momento.
      </div>
    );
  }

  const colors = ['#73bf69', '#5794f2', '#fede00', '#ff7800', '#00e5ff', '#b877d9', '#f2495c'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
      {items.map((item, idx) => {
        const count = item.active_students || item.count || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const color = colors[idx % colors.length];

        return (
          <div key={item.program || idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
              <span style={{ fontWeight: 600, color: '#ffffff' }}>{item.program}</span>
              <span style={{ color: '#d8d9da', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                <b style={{ color: '#ffffff' }}>{count}</b> ({pct}%)
              </span>
            </div>
            <div style={{
              height: '10px',
              backgroundColor: '#22252b',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.max(pct, 2)}%`,
                backgroundColor: color,
                borderRadius: '3px',
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 3. Heatmap de Grafana (Matriz 2D de Horas Pico e Intensidad)
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
    if (!count || count === 0) return '#22252b';
    const ratio = count / maxCount;
    if (ratio < 0.25) return '#1d4ed8'; // Azul suave
    if (ratio < 0.5) return '#2563eb';  // Azul intenso
    if (ratio < 0.75) return '#00e5ff'; // Cian vibrante
    return '#fede00'; // Oro / Pico máximo
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '3px', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', color: '#8e8e8e', fontWeight: 500, paddingRight: '8px', paddingBottom: '4px' }}>Día</th>
              {hours.map(h => (
                <th key={h} style={{ textAlign: 'center', color: '#8e8e8e', fontWeight: 500, width: '28px', paddingBottom: '4px' }}>
                  {h}h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(d => (
              <tr key={d.dow}>
                <td style={{ color: '#d8d9da', fontWeight: 600, paddingRight: '8px', whiteSpace: 'nowrap' }}>
                  {d.label}
                </td>
                {hours.map(h => {
                  const count = matrix[`${d.dow}-${h}`] || 0;
                  return (
                    <td
                      key={h}
                      title={`${d.label} a las ${h}:00 — ${count} accesos`}
                      style={{
                        height: '22px',
                        backgroundColor: getHeatColor(count),
                        borderRadius: '2px',
                        textAlign: 'center',
                        color: count > 0 ? (getHeatColor(count) === '#fede00' ? '#000000' : '#ffffff') : 'transparent',
                        fontSize: '10px',
                        fontWeight: 700,
                        cursor: 'default'
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#8e8e8e' }}>
        <span>Mapa de calor de accesos por franja horaria</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>Tranquilo</span>
          <div style={{ width: '10px', height: '10px', backgroundColor: '#22252b', borderRadius: '2px' }} />
          <div style={{ width: '10px', height: '10px', backgroundColor: '#1d4ed8', borderRadius: '2px' }} />
          <div style={{ width: '10px', height: '10px', backgroundColor: '#2563eb', borderRadius: '2px' }} />
          <div style={{ width: '10px', height: '10px', backgroundColor: '#00e5ff', borderRadius: '2px' }} />
          <div style={{ width: '10px', height: '10px', backgroundColor: '#fede00', borderRadius: '2px' }} />
          <span>Hora pico</span>
        </div>
      </div>
    </div>
  );
};

// 4. Sparkline de Grafana para Stat Cards
const GrafanaSparkline = ({ data, color = '#5794f2' }) => {
  const points = (data && data.length > 0) ? data : [0, 0, 0, 0, 0, 0];
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const width = 80;
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

// Layouts por defecto (24 columnas escalables con minW y minH)
const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'panel_total_stat', x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
    { i: 'panel_denied_stat', x: 3, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
    { i: 'panel_campus_stat', x: 6, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
    { i: 'panel_doors_stat', x: 9, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
    { i: 'panel_radial_gauge', x: 0, y: 3, w: 4, h: 7, minW: 3, minH: 5 },
    { i: 'panel_timeseries', x: 4, y: 3, w: 8, h: 7, minW: 4, minH: 6 },
    { i: 'panel_bar_gauge', x: 0, y: 10, w: 7, h: 8, minW: 4, minH: 6 },
    { i: 'panel_blocks_donut', x: 7, y: 10, w: 5, h: 8, minW: 3, minH: 6 },
    { i: 'panel_heatmap', x: 0, y: 18, w: 8, h: 7, minW: 5, minH: 5 },
    { i: 'panel_top_doors', x: 8, y: 18, w: 4, h: 7, minW: 3, minH: 5 },
    { i: 'panel_loki_table', x: 0, y: 25, w: 12, h: 9, minW: 6, minH: 6 }
  ]
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
  const [doors, setDoors] = useState([]);
  const [timeGranularity, setTimeGranularity] = useState('hour'); // 'hour' | 'minute'
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sistema de Grid Layout resizable y draggable
  const [layouts, setLayouts] = useState(() => {
    try {
      const saved = localStorage.getItem('grafana_dashboard_layouts_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_LAYOUTS;
  });

  const { width: containerWidth, containerRef, mounted } = useContainerWidth();

  const handleLayoutChange = (currentLayout, allLayouts) => {
    setLayouts(allLayouts);
    try {
      localStorage.setItem('grafana_dashboard_layouts_v2', JSON.stringify(allLayouts));
    } catch (e) {}
  };

  const resetLayout = () => {
    setLayouts(DEFAULT_LAYOUTS);
    try {
      localStorage.removeItem('grafana_dashboard_layouts_v2');
    } catch (e) {}
  };

  // WebSocket en vivo
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
        ...prev.slice(0, 14)
      ]);

      loadAnalytics();
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
      setIsRefreshing(true);
      const [statsRes, logsRes, doorsRes] = await Promise.all([
        apiClient('/access/logs/stats'),
        apiClient('/access/logs?limit=15'),
        apiClient('/doors')
      ]);

      if (statsRes.success) setStats(prev => ({ ...prev, ...statsRes.data }));
      if (logsRes.success) setRecentLogs(logsRes.data || []);
      if (doorsRes.success) setDoors(doorsRes.data || []);
      await loadAnalytics();
      setLastRefreshTime(new Date());
    } catch (err) {
      console.error('Error cargando telemetría del dashboard:', err);
    } finally {
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

  // Opciones de estilo Grafana auténtico de alto contraste (Como en Kubernetes & BI)
  const grafanaChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: '#ffffff',
          font: { family: 'var(--font-ui)', size: 12, weight: '600' },
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: '#181b1f',
        titleColor: '#ffffff',
        bodyColor: '#d8d9da',
        borderColor: '#22252b',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 4,
        titleFont: { family: 'var(--font-ui)', size: 13, weight: '700' },
        bodyFont: { family: 'var(--font-ui)', size: 12 }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        ticks: { color: '#d8d9da', font: { family: 'var(--font-ui)', size: 11.5, weight: '500' } }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        ticks: {
          color: '#d8d9da',
          font: { family: 'var(--font-ui)', size: 11.5, weight: '500' },
          precision: 0
        }
      }
    }
  };

  // Datos TimeSeries (Curva de picos)
  const timeSeriesSource = timeGranularity === 'minute' ? analytics.minute : analytics.hourly;
  const timeSlots = timeSeriesSource.length > 0
    ? timeSeriesSource.map(d => d.time_slot)
    : (timeGranularity === 'minute' ? ['--:--'] : ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']);

  const picosData = {
    labels: timeSlots,
    datasets: [
      {
        label: 'Accesos autorizados',
        data: timeSeriesSource.length > 0 ? timeSeriesSource.map(d => d.granted) : new Array(timeSlots.length).fill(0),
        borderColor: '#fede00', // Amarillo Grafana vivo
        backgroundColor: 'rgba(254, 222, 0, 0.18)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointBackgroundColor: '#fede00',
        pointRadius: timeGranularity === 'minute' ? 1.5 : 3
      },
      {
        label: 'Infracciones / Denegados',
        data: timeSeriesSource.length > 0 ? timeSeriesSource.map(d => d.denied) : new Array(timeSlots.length).fill(0),
        borderColor: '#f2495c', // Rojo Grafana
        backgroundColor: 'rgba(242, 73, 92, 0.22)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointBackgroundColor: '#f2495c',
        pointRadius: timeGranularity === 'minute' ? 1.5 : 3
      }
    ]
  };

  // Estudiantes en campus por carrera
  const studentsPrograms = analytics.studentsByProgram?.length > 0 ? analytics.studentsByProgram : [];
  const totalStudentsInCampus = studentsPrograms.reduce((acc, p) => acc + (p.active_students || p.count || 0), 0);

  // Distribución por bloque
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
      return `${b.block_name || b.name} (${pct}%)`;
    }),
    datasets: [
      {
        data: blockStats.map(b => b.count || 0),
        backgroundColor: ['#ff7800', '#73bf69', '#fede00', '#5794f2'], // Naranja, Verde, Amarillo, Azul (Como en la foto BI)
        borderColor: '#181b1f',
        borderWidth: 2
      }
    ]
  };

  const hourlyCounts = analytics.hourly.map(h => h.total);
  const hourlyDenied = analytics.hourly.map(h => h.denied);

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Barra superior de Grafana (Top Bar) */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 18px',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Logo llama Grafana */}
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #ff7800 0%, #fede00 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000',
            fontWeight: 900,
            fontSize: '16px',
            boxShadow: '0 0 10px rgba(255, 120, 0, 0.4)'
          }}>
            🔥
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                Control de Acceso RFID y Telemetría Institucional
              </h1>
              <span style={{ fontSize: '11px', color: '#8e8e8e' }}>▾</span>
            </div>
            <div style={{ fontSize: '12px', color: '#8e8e8e', marginTop: '1px' }}>
              Paneles en vivo desde Supabase · Grids redimensionables
            </div>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '4px',
            backgroundColor: isHardwareSensorOnline ? 'rgba(115, 191, 105, 0.15)' : 'rgba(242, 73, 92, 0.15)',
            color: isHardwareSensorOnline ? '#73bf69' : '#f2495c',
            border: `1px solid ${isHardwareSensorOnline ? 'rgba(115, 191, 105, 0.4)' : 'rgba(242, 73, 92, 0.4)'}`
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isHardwareSensorOnline ? '#73bf69' : '#f2495c'
            }} />
            {isHardwareSensorOnline ? 'Lector RFID en línea' : 'Lector RFID desconectado'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#8e8e8e' }}>
            Refresco: <b>4s</b> ({formatTime(lastRefreshTime)})
          </span>

          <button
            onClick={resetLayout}
            className="btn btn-secondary btn-sm"
            title="Restablecer cuadrícula a tamaño y posición por defecto"
            style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <RotateCcw size={13} />
            <span>Restablecer Grids</span>
          </button>

          <button
            onClick={() => loadData()}
            className="btn btn-secondary btn-sm"
            disabled={isRefreshing}
            style={{ fontSize: '12px', padding: '5px 12px' }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            <span>Refrescar</span>
          </button>

          <Link to="/monitor" className="btn btn-primary btn-sm" style={{ fontSize: '12px', padding: '5px 14px' }}>
            <Radio size={14} />
            <span>Escáner en vivo</span>
          </Link>
        </div>
      </div>

      {/* CONTENEDOR REACT-GRID-LAYOUT RESIZABLE Y DRAGGABLE */}
      <div ref={containerRef} style={{ width: '100%' }}>
        {mounted && (
          <ResponsiveGridLayout
            width={containerWidth}
            className="grafana-grid"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={36}
            isDraggable={true}
            isResizable={true}
            draggableHandle=".panel-drag-handle"
            onLayoutChange={handleLayoutChange}
          >
            {/* 1. Stat Card: Accesos de Hoy */}
            <div key="panel_total_stat" className="grafana-panel" style={{ borderLeft: '4px solid #5794f2' }}>
              <div className="grafana-panel-header panel-drag-handle">
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#d8d9da' }}>Total Accesos Hoy</span>
                <Activity size={15} style={{ color: '#5794f2' }} />
              </div>
              <div className="grafana-panel-body" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                      {stats.totalToday}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8e8e8e' }}>Registros verificados</div>
                  </div>
                  <GrafanaSparkline data={hourlyCounts} color="#5794f2" />
                </div>
              </div>
            </div>

            {/* 2. Stat Card: Infracciones / Denegados */}
            <div key="panel_denied_stat" className="grafana-panel" style={{ borderLeft: stats.deniedToday > 0 ? '4px solid #f2495c' : '4px solid var(--border)' }}>
              <div className="grafana-panel-header panel-drag-handle">
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#d8d9da' }}>Infracciones / Denegados</span>
                <XCircle size={15} style={{ color: stats.deniedToday > 0 ? '#f2495c' : '#8e8e8e' }} />
              </div>
              <div className="grafana-panel-body" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: '32px', fontWeight: 800, color: stats.deniedToday > 0 ? '#f2495c' : '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                      {stats.deniedToday}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8e8e8e' }}>Infracciones detectadas</div>
                  </div>
                  <GrafanaSparkline data={hourlyDenied} color="#f2495c" />
                </div>
              </div>
            </div>

            {/* 3. Stat Card: Población en Campus */}
            <div key="panel_campus_stat" className="grafana-panel" style={{ borderLeft: '4px solid #73bf69' }}>
              <div className="grafana-panel-header panel-drag-handle">
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#d8d9da' }}>Población en Campus</span>
                <Users size={15} style={{ color: '#73bf69' }} />
              </div>
              <div className="grafana-panel-body" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                      {totalStudentsInCampus}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8e8e8e' }}>Estudiantes presentes</div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#73bf69', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(115, 191, 105, 0.15)' }}>
                    Censo en vivo
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Stat Card: Puntos de Control */}
            <div key="panel_doors_stat" className="grafana-panel" style={{ borderLeft: '4px solid #00e5ff' }}>
              <div className="grafana-panel-header panel-drag-handle">
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#d8d9da' }}>Puntos de Control</span>
                <DoorClosed size={15} style={{ color: '#00e5ff' }} />
              </div>
              <div className="grafana-panel-body">
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                  {stats.totalDoors}
                </div>
                <div style={{ fontSize: '11px', color: '#8e8e8e', marginTop: '2px' }}>
                  En {stats.totalRooms} salas y 4 bloques
                </div>
              </div>
            </div>

            {/* 5. Radial Gauge: Tasa de Aprobación */}
            <div key="panel_radial_gauge" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GaugeIcon size={15} style={{ color: '#73bf69' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Tasa de Aprobación</span>
                </div>
                <GripHorizontal size={14} style={{ color: '#8e8e8e', opacity: 0.6 }} />
              </div>
              <div className="grafana-panel-body">
                <GrafanaRadialGauge
                  value={stats.successRate}
                  label={`${stats.grantedToday} autorizados de ${stats.totalToday}`}
                />
              </div>
            </div>

            {/* 6. TimeSeries: Curva de Afluencia y Picos */}
            <div key="panel_timeseries" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={15} style={{ color: '#fede00' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Curva de Afluencia y Detección de Picos</span>
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => setTimeGranularity('hour')}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: timeGranularity === 'hour' ? '1px solid #fede00' : '1px solid #22252b',
                      backgroundColor: timeGranularity === 'hour' ? 'rgba(254, 222, 0, 0.2)' : '#181b1f',
                      color: timeGranularity === 'hour' ? '#fede00' : '#8e8e8e'
                    }}
                  >
                    Por hora
                  </button>
                  <button
                    onClick={() => setTimeGranularity('minute')}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: timeGranularity === 'minute' ? '1px solid #fede00' : '1px solid #22252b',
                      backgroundColor: timeGranularity === 'minute' ? 'rgba(254, 222, 0, 0.2)' : '#181b1f',
                      color: timeGranularity === 'minute' ? '#fede00' : '#8e8e8e'
                    }}
                  >
                    Por minuto
                  </button>
                </div>
              </div>
              <div className="grafana-panel-body">
                <div style={{ height: '100%', minHeight: '180px' }}>
                  <Line data={picosData} options={grafanaChartOptions} />
                </div>
              </div>
            </div>

            {/* 7. Bar Gauge: Estudiantes en Campus por Carrera */}
            <div key="panel_bar_gauge" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GraduationCap size={15} style={{ color: '#73bf69' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Estudiantes por Carrera (Bar Gauge)</span>
                </div>
                <span style={{ fontSize: '11.5px', color: '#73bf69', fontWeight: 600 }}>
                  {totalStudentsInCampus} alumnos en campus
                </span>
              </div>
              <div className="grafana-panel-body">
                <GrafanaBarGauge items={studentsPrograms} total={totalStudentsInCampus} />
              </div>
            </div>

            {/* 8. Donut Chart: Distribución por Bloque */}
            <div key="panel_blocks_donut" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={15} style={{ color: '#ff7800' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Distribución por Bloque</span>
                </div>
                <span style={{ fontSize: '11px', color: '#8e8e8e' }}>Total: {totalBlockAccesses}</span>
              </div>
              <div className="grafana-panel-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ height: '100%', width: '100%', minHeight: '190px' }}>
                  <Doughnut
                    data={bloquesData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            color: '#ffffff',
                            font: { family: 'var(--font-ui)', size: 11, weight: '600' },
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
            </div>

            {/* 9. Heatmap: Horas Pico */}
            <div key="panel_heatmap" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Flame size={15} style={{ color: '#fede00' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Mapa de Calor de Horas Pico (Heatmap)</span>
                </div>
                <GripHorizontal size={14} style={{ color: '#8e8e8e', opacity: 0.6 }} />
              </div>
              <div className="grafana-panel-body">
                <GrafanaHeatmap data={analytics.heatmap} />
              </div>
            </div>

            {/* 10. Ranking de Puertas */}
            <div key="panel_top_doors" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={15} style={{ color: '#5794f2' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Puertas Más Transitadas</span>
                </div>
                <GripHorizontal size={14} style={{ color: '#8e8e8e', opacity: 0.6 }} />
              </div>
              <div className="grafana-panel-body" style={{ overflowY: 'auto' }}>
                {(!analytics.topDoors || analytics.topDoors.length === 0) ? (
                  <div style={{ padding: '30px 16px', textAlign: 'center', color: '#8e8e8e', fontSize: '12px' }}>
                    Sin datos de puertas hoy
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {analytics.topDoors.map((door, idx) => {
                      const maxDoor = analytics.topDoors[0]?.count || 1;
                      const pct = maxDoor > 0 ? Math.round((door.count / maxDoor) * 100) : 0;
                      return (
                        <div key={door.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ fontWeight: 600, color: '#ffffff' }}>
                              #{idx + 1} {door.door_name || door.name}
                            </span>
                            <span style={{ color: '#5794f2', fontWeight: 700 }}>
                              {door.count} accesos
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#8e8e8e' }}>
                            {door.room_name} ({door.block_name})
                          </div>
                          <div style={{ height: '6px', backgroundColor: '#22252b', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#5794f2', borderRadius: '3px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 11. Tabla Loki: Registros de Auditoría en Tiempo Real */}
            <div key="panel_loki_table" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={15} style={{ color: '#5794f2' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Registro de Transacciones en Tiempo Real (Loki Table)</span>
                </div>
                <Link to="/logs" style={{ fontSize: '12px', color: '#5794f2', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <span>Auditoría completa</span>
                  <ChevronRight size={13} />
                </Link>
              </div>
              <div className="grafana-panel-body" style={{ overflowX: 'auto', padding: 0 }}>
                <table className="data-table" style={{ fontSize: '12.5px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px' }}>Hora</th>
                      <th style={{ padding: '8px 12px' }}>Estado</th>
                      <th style={{ padding: '8px 12px' }}>Punto de acceso</th>
                      <th style={{ padding: '8px 12px' }}>Ubicación</th>
                      <th style={{ padding: '8px 12px' }}>Persona</th>
                      <th style={{ padding: '8px 12px' }}>Carrera</th>
                      <th style={{ padding: '8px 12px' }}>Rol</th>
                      <th style={{ padding: '8px 12px' }}>UID Tarjeta</th>
                      <th style={{ padding: '8px 12px' }}>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map((log, idx) => (
                      <tr key={log.id || idx}>
                        <td style={{ padding: '8px 12px', color: '#8e8e8e', whiteSpace: 'nowrap' }}>
                          {formatTime(log.timestamp)}
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '3px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: log.granted ? 'rgba(115, 191, 105, 0.2)' : 'rgba(242, 73, 92, 0.2)',
                            color: log.granted ? '#73bf69' : '#f2495c',
                            border: `1px solid ${log.granted ? '#73bf69' : '#f2495c'}`
                          }}>
                            {log.granted ? 'AUTORIZADO' : 'DENEGADO'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap' }}>
                          {log.door_name || `Acceso #${log.door_id}`}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#d8d9da', whiteSpace: 'nowrap' }}>
                          {log.room_name || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#ffffff', whiteSpace: 'nowrap' }}>
                          {log.user_name || 'No enrolado'}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#5794f2', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {log.user_program && log.user_program !== '—' ? log.user_program : 'General'}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#8e8e8e', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                          {log.role_name || 'Estudiante'}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: '#fede00', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {log.rfid_uid_raw || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', color: log.granted ? '#8e8e8e' : '#f2495c', fontSize: '12px' }}>
                          {log.granted ? 'Acceso concedido' : (log.denial_reason || 'Rechazado')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ResponsiveGridLayout>
        )}
      </div>
    </div>
  );
};
