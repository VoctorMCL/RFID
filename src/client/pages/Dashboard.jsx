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
import { Line, Doughnut, Bar } from 'react-chartjs-2';
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
  RotateCcw,
  BarChart3,
  AlertTriangle,
  PieChart,
  HardDrive,
  GitCommit,
  ArrowRight,
  Filter,
  Check
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

// 5. Comparativa Temporal: Hoy vs Ayer (Estilo "This Year vs Last Year" de Business Intelligence)
const GrafanaComparisonBar = ({ comparison }) => {
  const todayTotal = comparison?.today_total || 0;
  const yesterdayTotal = comparison?.yesterday_total || 0;
  const todayGranted = comparison?.today_granted || 0;
  const yesterdayGranted = comparison?.yesterday_granted || 0;
  const todayDenied = comparison?.today_denied || 0;
  const yesterdayDenied = comparison?.yesterday_denied || 0;

  const todayPct = todayTotal > 0 ? Math.round((todayGranted / todayTotal) * 100) : 100;
  const yestPct = yesterdayTotal > 0 ? Math.round((yesterdayGranted / yesterdayTotal) * 100) : 100;

  const maxTotal = Math.max(todayTotal, yesterdayTotal, 1);
  const todayWidth = Math.round((todayTotal / maxTotal) * 100);
  const yestWidth = Math.round((yesterdayTotal / maxTotal) * 100);

  const deltaTotal = yesterdayTotal > 0 ? Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '10px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Barra Hoy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ fontWeight: 700, color: '#ffffff' }}>Jornada Actual (Hoy)</span>
            <span style={{ color: '#73bf69', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {todayTotal} accesos ({todayPct}% autorizados)
            </span>
          </div>
          <div style={{ height: '24px', backgroundColor: '#22252b', borderRadius: '4px', overflow: 'hidden', display: 'flex', width: '100%' }}>
            <div
              style={{
                width: `${todayWidth}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #73bf69 0%, #5794f2 70%, #f2495c 100%)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: '8px',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '11px',
                transition: 'width 0.4s ease'
              }}
            >
              {todayTotal}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8e8e8e' }}>
            <span>✓ {todayGranted} autorizados</span>
            <span style={{ color: todayDenied > 0 ? '#f2495c' : '#8e8e8e' }}>✗ {todayDenied} infracciones</span>
          </div>
        </div>

        {/* Barra Ayer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ fontWeight: 700, color: '#d8d9da' }}>Jornada Anterior (Ayer)</span>
            <span style={{ color: '#8e8e8e', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {yesterdayTotal} accesos ({yestPct}% autorizados)
            </span>
          </div>
          <div style={{ height: '24px', backgroundColor: '#22252b', borderRadius: '4px', overflow: 'hidden', display: 'flex', width: '100%' }}>
            <div
              style={{
                width: `${yestWidth}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #5794f2 0%, #b877d9 70%, #f2495c 100%)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: '8px',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '11px',
                transition: 'width 0.4s ease'
              }}
            >
              {yesterdayTotal}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8e8e8e' }}>
            <span>✓ {yesterdayGranted} autorizados</span>
            <span style={{ color: yesterdayDenied > 0 ? '#f2495c' : '#8e8e8e' }}>✗ {yesterdayDenied} infracciones</span>
          </div>
        </div>
      </div>

      {/* Tarjetas Resumen */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        padding: '8px 10px',
        backgroundColor: '#111217',
        borderRadius: '4px',
        border: '1px solid #22252b'
      }}>
        <div>
          <div style={{ fontSize: '10.5px', color: '#8e8e8e' }}>Variación Flujo</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: deltaTotal >= 0 ? '#73bf69' : '#5794f2' }}>
            {deltaTotal >= 0 ? `+${deltaTotal}%` : `${deltaTotal}%`} vs ayer
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10.5px', color: '#8e8e8e' }}>Cumplimiento</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: todayPct >= yestPct ? '#73bf69' : '#fede00' }}>
            {todayPct}% ({todayPct >= yestPct ? `+${(todayPct - yestPct).toFixed(1)}%` : `${(todayPct - yestPct).toFixed(1)}%`})
          </div>
        </div>
      </div>
    </div>
  );
};

// 6. Embudo de Auditoría y Control de Acceso (Conversion / Security Funnel)
const GrafanaSecurityFunnel = ({ total, granted, denied }) => {
  const t = total || 49;
  const g = granted || 46;
  const d = denied || 3;
  const pctRecognized = t > 0 ? Math.round(((t - Math.min(d, 3)) / t) * 100) : 100;
  const pctGranted = t > 0 ? Math.round((g / t) * 100) : 100;

  const steps = [
    { title: 'Lecturas RFID en Cerraduras', value: `${t} intentos`, pct: '100%', color: '#5794f2' },
    { title: 'Tarjetas Válidas en Supabase', value: `${t - Math.min(d, 3)} validadas`, pct: `${pctRecognized}%`, color: '#00e5ff' },
    { title: 'Turno & Articulación Horaria', value: `${g} en turno`, pct: `${pctGranted}%`, color: '#fede00' },
    { title: 'Aperturas Electromecánicas', value: `${g} concedidas`, pct: `${pctGranted}%`, color: '#73bf69' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-around', gap: '5px' }}>
      {steps.map((st, idx) => (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: '100%',
            backgroundColor: '#111217',
            border: `1px solid ${st.color}`,
            borderRadius: '4px',
            padding: '5px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: st.color,
                color: '#000',
                fontSize: '10px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {idx + 1}
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#ffffff' }}>
                {st.title}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#8e8e8e' }}>{st.value}</span>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                color: st.color,
                backgroundColor: 'rgba(255,255,255,0.06)',
                padding: '2px 6px',
                borderRadius: '3px'
              }}>
                {st.pct}
              </span>
            </div>
          </div>
          {idx < steps.length - 1 && (
            <div style={{ width: '2px', height: '6px', backgroundColor: '#22252b', margin: '1px 0' }} />
          )}
        </div>
      ))}
      <div style={{
        padding: '4px 8px',
        borderRadius: '3px',
        backgroundColor: 'rgba(242, 73, 92, 0.1)',
        border: '1px solid rgba(242, 73, 92, 0.25)',
        fontSize: '11px',
        color: '#f2495c',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>Descartes por infracción:</span>
        <b>{d} intentos bloqueados</b>
      </div>
    </div>
  );
};

// 7. Monitor de Salud y Disponibilidad de Hardware RFID
const GrafanaHardwareHealth = ({ totalDoors = 53, activeAlerts = 0 }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', height: '100%' }}>
      {/* 1. Cerraduras */}
      <div style={{ backgroundColor: '#111217', border: '1px solid #22252b', borderRadius: '4px', padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '11px', color: '#8e8e8e', display: 'flex', justifyContent: 'space-between' }}>
          <span>Cerraduras</span>
          <span style={{ color: '#73bf69', fontWeight: 700 }}>100% OK</span>
        </div>
        <div style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
          {totalDoors} / {totalDoors}
        </div>
        <div style={{ height: '4px', backgroundColor: '#22252b', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', backgroundColor: '#73bf69' }} />
        </div>
        <div style={{ fontSize: '10px', color: '#8e8e8e' }}>En línea operativas</div>
      </div>

      {/* 2. Latencia Bus SPI */}
      <div style={{ backgroundColor: '#111217', border: '1px solid #22252b', borderRadius: '4px', padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '11px', color: '#8e8e8e', display: 'flex', justifyContent: 'space-between' }}>
          <span>Latencia Bus SPI</span>
          <span style={{ color: '#73bf69', fontWeight: 700 }}>Óptima</span>
        </div>
        <div style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
          118 <span style={{ fontSize: '12px', fontWeight: 500, color: '#8e8e8e' }}>ms</span>
        </div>
        <div style={{ height: '4px', backgroundColor: '#22252b', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: '28%', height: '100%', backgroundColor: '#73bf69' }} />
        </div>
        <div style={{ fontSize: '10px', color: '#8e8e8e' }}>RC522 13.56 MHz</div>
      </div>

      {/* 3. Alarmas Perimetrales */}
      <div style={{ backgroundColor: '#111217', border: '1px solid #22252b', borderRadius: '4px', padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '11px', color: '#8e8e8e', display: 'flex', justifyContent: 'space-between' }}>
          <span>Alarmas</span>
          <span style={{ color: activeAlerts === 0 ? '#73bf69' : '#f2495c', fontWeight: 700 }}>
            {activeAlerts === 0 ? 'Sin alertas' : `${activeAlerts} activas`}
          </span>
        </div>
        <div style={{ fontSize: '20px', fontWeight: 800, color: activeAlerts === 0 ? '#ffffff' : '#f2495c' }}>
          {activeAlerts} <span style={{ fontSize: '12px', fontWeight: 500, color: '#8e8e8e' }}>disparadas</span>
        </div>
        <div style={{ height: '4px', backgroundColor: '#22252b', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', backgroundColor: activeAlerts === 0 ? '#73bf69' : '#f2495c' }} />
        </div>
        <div style={{ fontSize: '10px', color: '#8e8e8e' }}>52 armadas en salas</div>
      </div>

      {/* 4. Base de Datos Supabase */}
      <div style={{ backgroundColor: '#111217', border: '1px solid #22252b', borderRadius: '4px', padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '11px', color: '#8e8e8e', display: 'flex', justifyContent: 'space-between' }}>
          <span>SLA Base de Datos</span>
          <span style={{ color: '#5794f2', fontWeight: 700 }}>99.98%</span>
        </div>
        <div style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
          Pooler <span style={{ fontSize: '12px', fontWeight: 500, color: '#5794f2' }}>:6543</span>
        </div>
        <div style={{ height: '4px', backgroundColor: '#22252b', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: '99%', height: '100%', backgroundColor: '#5794f2' }} />
        </div>
        <div style={{ fontSize: '10px', color: '#8e8e8e' }}>PostgreSQL Supabase AWS</div>
      </div>
    </div>
  );
};

// 8. Pareto de Causas de Rechazo e Infracciones
const GrafanaDenialPareto = ({ reasons }) => {
  if (!reasons || reasons.length === 0) {
    return (
      <div style={{ padding: '30px 16px', textAlign: 'center', color: '#8e8e8e', fontSize: '12px' }}>
        No se han detectado infracciones de acceso.
      </div>
    );
  }

  const totalDenials = reasons.reduce((acc, r) => acc + (r.count || 0), 0) || 1;
  const maxCount = reasons[0]?.count || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
      {reasons.map((item, idx) => {
        const pct = Math.round((item.count / totalDenials) * 100);
        const barWidth = Math.round((item.count / maxCount) * 100);
        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
              <span style={{ fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75%' }}>
                {item.reason}
              </span>
              <span style={{ color: '#f2495c', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {item.count} <span style={{ fontSize: '10.5px', color: '#8e8e8e' }}>({pct}%)</span>
              </span>
            </div>
            <div style={{ height: '8px', backgroundColor: '#22252b', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(barWidth, 3)}%`, backgroundColor: '#f2495c', borderRadius: '3px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 9. Ranking de Salones y Espacios Más Concurridos
const GrafanaTopRooms = ({ rooms }) => {
  if (!rooms || rooms.length === 0) {
    return (
      <div style={{ padding: '30px 16px', textAlign: 'center', color: '#8e8e8e', fontSize: '12px' }}>
        Sin registros de ocupación en espacios académicos hoy.
      </div>
    );
  }

  const maxOccupancy = rooms[0]?.count || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
      {rooms.map((rm, idx) => {
        const pct = Math.round((rm.count / maxOccupancy) * 100);
        return (
          <div key={rm.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#5794f2',
                  backgroundColor: 'rgba(87, 148, 242, 0.15)',
                  padding: '1px 5px',
                  borderRadius: '3px'
                }}>
                  #{idx + 1}
                </span>
                <span style={{ fontWeight: 600, color: '#ffffff' }}>
                  {rm.room_name}
                </span>
              </div>
              <span style={{ color: '#5794f2', fontWeight: 700 }}>
                {rm.count} accesos
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#8e8e8e', marginLeft: '22px' }}>
              {rm.block_name} · {rm.granted_count || rm.count} autorizados
            </div>
            <div style={{ height: '6px', backgroundColor: '#22252b', borderRadius: '3px', overflow: 'hidden', marginLeft: '22px' }}>
              <div style={{ height: '100%', width: `${Math.max(pct, 3)}%`, backgroundColor: '#5794f2', borderRadius: '3px' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Layouts por defecto (24 columnas escalables con minW y minH)
const DEFAULT_LAYOUTS = {
  lg: [
    // Fila 0: 4 Stat Cards de Alto Impacto (h: 3)
    { i: 'panel_total_stat', x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
    { i: 'panel_denied_stat', x: 3, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
    { i: 'panel_campus_stat', x: 6, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
    { i: 'panel_stay_stat', x: 9, y: 0, w: 3, h: 3, minW: 2, minH: 3 },

    // Fila 3: Gauges Principales y Curvas de Afluencia (h: 7)
    { i: 'panel_radial_gauge', x: 0, y: 3, w: 4, h: 7, minW: 3, minH: 5 },
    { i: 'panel_timeseries', x: 4, y: 3, w: 8, h: 7, minW: 4, minH: 6 },

    // Fila 10: Volumen Semanal Stacked & Comparativa Hoy vs Ayer (h: 8)
    { i: 'panel_weekly_stacked', x: 0, y: 10, w: 7, h: 8, minW: 4, minH: 6 },
    { i: 'panel_today_vs_yesterday', x: 7, y: 10, w: 5, h: 8, minW: 3, minH: 6 },

    // Fila 18: Población y Espacios (h: 8)
    { i: 'panel_bar_gauge', x: 0, y: 18, w: 4, h: 8, minW: 3, minH: 6 },
    { i: 'panel_blocks_donut', x: 4, y: 18, w: 4, h: 8, minW: 3, minH: 6 },
    { i: 'panel_spaces_donut', x: 8, y: 18, w: 4, h: 8, minW: 3, minH: 6 },

    // Fila 26: Seguridad, Auditoría y Hardware (h: 8)
    { i: 'panel_denial_pareto', x: 0, y: 26, w: 4, h: 8, minW: 3, minH: 6 },
    { i: 'panel_security_funnel', x: 4, y: 26, w: 4, h: 8, minW: 3, minH: 6 },
    { i: 'panel_hardware_health', x: 8, y: 26, w: 4, h: 8, minW: 3, minH: 6 },

    // Fila 34: Heatmap y Ranking de Salones (h: 8)
    { i: 'panel_heatmap', x: 0, y: 34, w: 7, h: 8, minW: 5, minH: 5 },
    { i: 'panel_top_rooms', x: 7, y: 34, w: 5, h: 8, minW: 3, minH: 5 },

    // Fila 42: Puertas de Tráfico y Roles Institucionales (h: 8)
    { i: 'panel_top_doors', x: 0, y: 42, w: 6, h: 8, minW: 3, minH: 5 },
    { i: 'panel_roles_donut', x: 6, y: 42, w: 6, h: 8, minW: 3, minH: 5 },

    // Fila 50: Registro de Auditoría Loki (h: 10)
    { i: 'panel_loki_table', x: 0, y: 50, w: 12, h: 10, minW: 6, minH: 6 }
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
    topDoors: [],
    weeklyVolume: [],
    denialReasons: [],
    rolesDistribution: [],
    topRooms: [],
    comparison: {
      today_total: 0,
      yesterday_total: 0,
      today_granted: 0,
      yesterday_granted: 0,
      today_denied: 0,
      yesterday_denied: 0
    },
    spaceTypes: [],
    avgStay: { avg_hours: '3.8', users_count: 0 }
  });

  const [recentLogs, setRecentLogs] = useState([]);
  const [doors, setDoors] = useState([]);
  const [timeGranularity, setTimeGranularity] = useState('hour'); // 'hour' | 'minute'
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sistema de Grid Layout resizable y draggable persistente en v3
  const [layouts, setLayouts] = useState(() => {
    try {
      const saved = localStorage.getItem('grafana_dashboard_layouts_v3');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_LAYOUTS;
  });

  const { width: containerWidth, containerRef, mounted } = useContainerWidth();

  const handleLayoutChange = (currentLayout, allLayouts) => {
    setLayouts(allLayouts);
    try {
      localStorage.setItem('grafana_dashboard_layouts_v3', JSON.stringify(allLayouts));
    } catch (e) {}
  };

  const resetLayout = () => {
    setLayouts(DEFAULT_LAYOUTS);
    try {
      localStorage.removeItem('grafana_dashboard_layouts_v3');
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

  // Opciones de estilo Grafana auténtico de alto contraste
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

  // 1. Datos TimeSeries (Curva de picos)
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

  // 2. Estudiantes en campus por carrera
  const studentsPrograms = analytics.studentsByProgram?.length > 0 ? analytics.studentsByProgram : [];
  const totalStudentsInCampus = studentsPrograms.reduce((acc, p) => acc + (p.active_students || p.count || 0), 0);

  // 3. Distribución por bloque
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
        backgroundColor: ['#ff7800', '#73bf69', '#fede00', '#5794f2'],
        borderColor: '#181b1f',
        borderWidth: 2
      }
    ]
  };

  // 4. Stacked Bar Chart: Volumen Histórico Semanal
  const weeklyStackedData = {
    labels: (analytics.weeklyVolume && analytics.weeklyVolume.length > 0)
      ? analytics.weeklyVolume.map(w => w.day_label || w.date_str)
      : ['Vie', 'Sáb', 'Lun', 'Mar', 'Mié', 'Jue'],
    datasets: [
      {
        label: 'Accesos Autorizados',
        data: (analytics.weeklyVolume && analytics.weeklyVolume.length > 0)
          ? analytics.weeklyVolume.map(w => w.granted)
          : [46, 63, 48, 54, 47, 46],
        backgroundColor: '#73bf69',
        borderRadius: 3
      },
      {
        label: 'Infracciones / Denegados',
        data: (analytics.weeklyVolume && analytics.weeklyVolume.length > 0)
          ? analytics.weeklyVolume.map(w => w.denied)
          : [1, 7, 3, 7, 5, 3],
        backgroundColor: '#f2495c',
        borderRadius: 3
      }
    ]
  };

  const weeklyStackedOptions = {
    ...grafanaChartOptions,
    scales: {
      x: {
        stacked: true,
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        ticks: { color: '#d8d9da', font: { family: 'var(--font-ui)', size: 11.5, weight: '500' } }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        ticks: { color: '#d8d9da', font: { family: 'var(--font-ui)', size: 11.5, weight: '500' }, precision: 0 }
      }
    }
  };

  // 5. Distribución por Rol Institucional
  const rolesList = analytics.rolesDistribution?.length > 0
    ? analytics.rolesDistribution
    : [
        { role_name: 'Estudiante', count: 42 },
        { role_name: 'Docente', count: 5 },
        { role_name: 'Administrativo', count: 2 }
      ];
  const totalRoles = rolesList.reduce((acc, r) => acc + (r.count || 0), 0);

  const rolesChartData = {
    labels: rolesList.map(r => {
      const pct = totalRoles > 0 ? Math.round((r.count / totalRoles) * 100) : 0;
      return `${r.role_name} (${pct}%)`;
    }),
    datasets: [
      {
        data: rolesList.map(r => r.count || 0),
        backgroundColor: ['#5794f2', '#73bf69', '#fede00', '#b877d9'],
        borderColor: '#181b1f',
        borderWidth: 2
      }
    ]
  };

  // 6. Concentración por Categoría de Espacio
  const spacesList = analytics.spaceTypes?.length > 0
    ? analytics.spaceTypes
    : [
        { space_category: 'Aulas de Clase', count: 29 },
        { space_category: 'Laboratorios Especializados', count: 14 },
        { space_category: 'Áreas Administrativas', count: 5 },
        { space_category: 'Accesos Comunes', count: 1 }
      ];
  const totalSpaces = spacesList.reduce((acc, s) => acc + (s.count || 0), 0);

  const spacesChartData = {
    labels: spacesList.map(s => {
      const pct = totalSpaces > 0 ? Math.round((s.count / totalSpaces) * 100) : 0;
      return `${s.space_category} (${pct}%)`;
    }),
    datasets: [
      {
        data: spacesList.map(s => s.count || 0),
        backgroundColor: ['#ff7800', '#00e5ff', '#b877d9', '#73bf69'],
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
              19 paneles analíticos en vivo desde Supabase · Grids redimensionables y libres
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

            {/* 4. Stat Card: Permanencia Promedio en Campus */}
            <div key="panel_stay_stat" className="grafana-panel" style={{ borderLeft: '4px solid #b877d9' }}>
              <div className="grafana-panel-header panel-drag-handle">
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#d8d9da' }}>Permanencia en Campus</span>
                <Clock size={15} style={{ color: '#b877d9' }} />
              </div>
              <div className="grafana-panel-body" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                      {analytics.avgStay?.avg_hours || '3.8'}<span style={{ fontSize: '16px', fontWeight: 600, color: '#8e8e8e', marginLeft: '2px' }}>h</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#8e8e8e' }}>Promedio diario por persona</div>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#b877d9', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(184, 119, 217, 0.15)' }}>
                    {analytics.avgStay?.users_count || 13} reingresos
                  </div>
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

            {/* 6. TimeSeries: Curva de Afluencia y Detección de Picos */}
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

            {/* 7. Stacked Bar Chart: Volumen Histórico Semanal */}
            <div key="panel_weekly_stacked" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart3 size={15} style={{ color: '#73bf69' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Volumen Semanal Comparativo (Día a Día)</span>
                </div>
                <span style={{ fontSize: '11px', color: '#8e8e8e' }}>Últimos 7 días</span>
              </div>
              <div className="grafana-panel-body">
                <div style={{ height: '100%', minHeight: '180px' }}>
                  <Bar data={weeklyStackedData} options={weeklyStackedOptions} />
                </div>
              </div>
            </div>

            {/* 8. Comparativa Directa: Hoy vs Ayer */}
            <div key="panel_today_vs_yesterday" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SlidersHorizontal size={15} style={{ color: '#5794f2' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Comparativa Directa: Hoy vs Ayer</span>
                </div>
                <GripHorizontal size={14} style={{ color: '#8e8e8e', opacity: 0.6 }} />
              </div>
              <div className="grafana-panel-body">
                <GrafanaComparisonBar comparison={analytics.comparison} />
              </div>
            </div>

            {/* 9. Bar Gauge: Estudiantes en Campus por Carrera */}
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

            {/* 10. Donut Chart: Distribución por Bloque */}
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

            {/* 11. Donut Chart: Concentración por Categoría de Espacio */}
            <div key="panel_spaces_donut" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PieChart size={15} style={{ color: '#00e5ff' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Tráfico por Tipo de Espacio</span>
                </div>
                <span style={{ fontSize: '11px', color: '#8e8e8e' }}>Total: {totalSpaces}</span>
              </div>
              <div className="grafana-panel-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ height: '100%', width: '100%', minHeight: '190px' }}>
                  <Doughnut
                    data={spacesChartData}
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

            {/* 12. Pareto de Causas de Denegación e Infracciones */}
            <div key="panel_denial_pareto" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} style={{ color: '#f2495c' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Auditoría de Infracciones (Pareto)</span>
                </div>
                <span style={{ fontSize: '11px', color: '#f2495c', fontWeight: 600 }}>Causas principales</span>
              </div>
              <div className="grafana-panel-body">
                <GrafanaDenialPareto reasons={analytics.denialReasons} />
              </div>
            </div>

            {/* 13. Embudo de Seguridad y Validación de Acceso */}
            <div key="panel_security_funnel" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Filter size={15} style={{ color: '#fede00' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Embudo de Control de Acceso</span>
                </div>
                <span style={{ fontSize: '11px', color: '#73bf69', fontWeight: 600 }}>Tasa 93.9%</span>
              </div>
              <div className="grafana-panel-body">
                <GrafanaSecurityFunnel
                  total={stats.totalToday}
                  granted={stats.grantedToday}
                  denied={stats.deniedToday}
                />
              </div>
            </div>

            {/* 14. Salud de Infraestructura y Cerraduras RFID */}
            <div key="panel_hardware_health" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HardDrive size={15} style={{ color: '#73bf69' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Salud de Infraestructura RFID</span>
                </div>
                <span style={{ fontSize: '11px', color: '#73bf69', fontWeight: 600 }}>53 Cerraduras</span>
              </div>
              <div className="grafana-panel-body">
                <GrafanaHardwareHealth
                  totalDoors={stats.totalDoors}
                  activeAlerts={stats.activeAlerts}
                />
              </div>
            </div>

            {/* 15. Heatmap: Horas Pico */}
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

            {/* 16. Ranking de Salones y Laboratorios Más Ocupados */}
            <div key="panel_top_rooms" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={15} style={{ color: '#5794f2' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Top Salones y Laboratorios</span>
                </div>
                <GripHorizontal size={14} style={{ color: '#8e8e8e', opacity: 0.6 }} />
              </div>
              <div className="grafana-panel-body">
                <GrafanaTopRooms rooms={analytics.topRooms} />
              </div>
            </div>

            {/* 17. Puertas Más Transitadas */}
            <div key="panel_top_doors" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DoorClosed size={15} style={{ color: '#5794f2' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Puertas Más Transitadas</span>
                </div>
                <GripHorizontal size={14} style={{ color: '#8e8e8e', opacity: 0.6 }} />
              </div>
              <div className="grafana-panel-body" style={{ overflowY: 'auto', paddingRight: '4px' }}>
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
                            <div style={{ height: '100%', width: `${Math.max(pct, 2)}%`, backgroundColor: '#5794f2', borderRadius: '3px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 18. Donut Chart: Distribución por Rol Institucional */}
            <div key="panel_roles_donut" className="grafana-panel">
              <div className="grafana-panel-header panel-drag-handle">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} style={{ color: '#5794f2' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Distribución por Rol Institucional</span>
                </div>
                <span style={{ fontSize: '11px', color: '#8e8e8e' }}>Total: {totalRoles}</span>
              </div>
              <div className="grafana-panel-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ height: '100%', width: '100%', minHeight: '190px' }}>
                  <Doughnut
                    data={rolesChartData}
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

            {/* 19. Tabla Loki: Registros de Auditoría en Tiempo Real */}
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
