import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { apiClient } from '../../api/client';
import { Cpu, Sun, Moon, Laptop } from 'lucide-react';

const routeTitles = {
  '/dashboard': 'Panel Principal de Telemetría (Grafana)',
  '/monitor': 'Escáner RFID y Validación Visual',
  '/map': 'Mapa Institucional — Bloques, Salas y Puertas',
  '/users': 'Gestión de Personas y Usuarios',
  '/rfid-cards': 'Administración de Tarjetas RFID',
  '/schedules': 'Articulación Horaria',
  '/logs': 'Historial de Auditoría de Accesos',
  '/alerts': 'Centro de Alarmas de Seguridad'
};

export const Topbar = () => {
  const location = useLocation();
  const [activeSensorDoor, setActiveSensorDoor] = useState(null);
  const [isSensorActive, setIsSensorActive] = useState(false);
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('rfid_theme_mode') || 'auto');

  useEffect(() => {
    if (themeMode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (themeMode === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('rfid_theme_mode', themeMode);
  }, [themeMode]);

  const cycleTheme = () => {
    if (themeMode === 'auto') setThemeMode('dark');
    else if (themeMode === 'dark') setThemeMode('light');
    else setThemeMode('auto');
  };

  const lastActivityRef = React.useRef(0);

  const handleWsEvent = (event) => {
    if (event.type === 'hardware_heartbeat' || event.type === 'access_attempt') {
      lastActivityRef.current = Date.now();
      setIsSensorActive(true);
      if (event.data?.door?.name) {
        setActiveSensorDoor(event.data.door.name);
      } else if (event.data?.doorName) {
        setActiveSensorDoor(event.data.doorName);
      }
    }
  };

  useWebSocket(handleWsEvent);

  useEffect(() => {
    let isMounted = true;
    const checkSensorStatus = async () => {
      try {
        const res = await apiClient('/doors');
        if (!isMounted) return;
        if (res.success && Array.isArray(res.data)) {
          // Un sensor de hardware está activo si alguna puerta reportó actividad reciente
          const activeDoor = res.data.find(d => d.is_hardware_active);
          if (activeDoor) {
            lastActivityRef.current = Date.now();
            setIsSensorActive(true);
            setActiveSensorDoor(activeDoor.name);
          } else {
            const hasRecentActivity = (Date.now() - lastActivityRef.current) < 90000;
            if (!hasRecentActivity) {
              setIsSensorActive(false);
              setActiveSensorDoor(null);
            }
          }
        }
      } catch (e) {
        if (isMounted) {
          const hasRecentActivity = (Date.now() - lastActivityRef.current) < 90000;
          if (!hasRecentActivity) {
            setIsSensorActive(false);
          }
        }
      }
    };

    checkSensorStatus();
    const interval = setInterval(checkSensorStatus, 3500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const currentTitle = routeTitles[location.pathname] || 'Ecosistema de Control de Acceso';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="breadcrumb" style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Control de Acceso</span>
          &nbsp;›&nbsp;
          <span style={{ color: 'var(--text-primary)' }}>{currentTitle}</span>
        </div>
      </div>

      <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Selector de Modo Claro / Oscuro / Auto por Dispositivo */}
        <button
          onClick={cycleTheme}
          className="btn btn-secondary btn-sm"
          title={`Tema: ${themeMode === 'auto' ? 'Automático (según tu dispositivo)' : themeMode === 'light' ? 'Modo Claro' : 'Modo Oscuro'}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12.5px',
            padding: '6px 12px'
          }}
        >
          {themeMode === 'auto' && <Laptop size={14} style={{ color: 'var(--accent)' }} />}
          {themeMode === 'light' && <Sun size={14} style={{ color: '#f59e0b' }} />}
          {themeMode === 'dark' && <Moon size={14} style={{ color: '#38bdf8' }} />}
          <span>
            {themeMode === 'auto' ? 'Tema automático' : themeMode === 'light' ? 'Tema claro' : 'Tema oscuro'}
          </span>
        </button>

        {/* Indicador de Hardware Sensor RFID Real (Sin datos ficticios) */}
        <div
          className="live-indicator"
          title={isSensorActive ? `Lector MFRC522 activo en: ${activeSensorDoor || 'CrowPi'}` : 'Sin comunicación de hardware MFRC522 / CrowPi reciente'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12.5px',
            fontWeight: 500,
            padding: '6px 14px',
            borderRadius: '6px',
            backgroundColor: isSensorActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.08)',
            color: isSensorActive ? 'var(--status-ok-text)' : 'var(--status-denied-text)',
            border: `1px solid ${isSensorActive ? 'var(--status-ok-border)' : 'var(--status-denied-border)'}`
          }}
        >
          <div
            className={isSensorActive ? 'pulse-dot' : ''}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isSensorActive ? '#10b981' : '#ef4444',
              boxShadow: isSensorActive ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none'
            }}
          />
          <Cpu size={14} style={{ opacity: 0.85 }} />
          <span>
            {isSensorActive
              ? `Lector en línea ${activeSensorDoor ? `(${activeSensorDoor})` : ''}`
              : 'Lector desconectado'}
          </span>
        </div>
      </div>
    </header>
  );
};
