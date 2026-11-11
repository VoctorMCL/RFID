import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { apiClient } from '../../api/client';
import { Cpu, Menu, Maximize2, Minimize2 } from 'lucide-react';

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

export const Topbar = ({ isCollapsed, onToggleSidebar }) => {
  const location = useLocation();
  const [isSensorActive, setIsSensorActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const lastActivityRef = React.useRef(0);

  const handleWsEvent = (event) => {
    if (event.type === 'hardware_heartbeat' || event.type === 'access_attempt') {
      lastActivityRef.current = Date.now();
      setIsSensorActive(true);
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
          const activeDoor = res.data.find(d => d.is_hardware_active);
          if (activeDoor) {
            lastActivityRef.current = Date.now();
            setIsSensorActive(true);
          } else {
            const hasRecentActivity = (Date.now() - lastActivityRef.current) < 90000;
            if (!hasRecentActivity) {
              setIsSensorActive(false);
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
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      checkSensorStatus();
    }, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const currentTitle = routeTitles[location.pathname] || 'Ecosistema de Control de Acceso';

  return (
    <header className="topbar">
      <div className="topbar-left" style={{ minWidth: 0, flex: 1 }}>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="topbar-sidebar-toggle"
            title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            aria-label="Alternar barra lateral"
          >
            <Menu size={18} />
          </button>
        )}
        <div className="breadcrumb" style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          <span style={{ color: '#38bdf8', fontWeight: 700, letterSpacing: '0.5px' }}>RADAR</span>
          &nbsp;›&nbsp;
          <span style={{ color: 'var(--text-primary)' }}>{currentTitle}</span>
        </div>
      </div>

      <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>

        <div
          className="live-indicator"
          title={isSensorActive ? 'Lector RFID activo' : 'Sin comunicación de hardware RFID reciente'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12.5px',
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: '9999px',
            backgroundColor: isSensorActive ? 'var(--status-ok-bg)' : 'var(--status-denied-bg)',
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
              backgroundColor: isSensorActive ? '#16a34a' : '#dc2626',
              boxShadow: isSensorActive ? '0 0 8px rgba(22, 163, 74, 0.5)' : 'none'
            }}
          />
          <Cpu size={14} style={{ opacity: 0.9 }} />
          <span>
            {isSensorActive ? 'Lector activo' : 'Lector desconectado'}
          </span>
        </div>

        <button
          onClick={toggleFullscreen}
          className="topbar-sidebar-toggle"
          title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla entera (Kiosco / Fullscreen)'}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla entera'}
          style={{ width: '34px', height: '34px' }}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </header>
  );
};
