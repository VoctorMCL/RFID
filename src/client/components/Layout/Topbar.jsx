import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Radio } from 'lucide-react';

const routeTitles = {
  '/dashboard': 'Panel Principal de Seguridad',
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
  const [time, setTime] = useState(new Date());
  const { isConnected } = useWebSocket();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentTitle = routeTitles[location.pathname] || 'Ecosistema de Control de Acceso';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="breadcrumb" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Acceso RFID</span>
          &nbsp;›&nbsp;
          <span style={{ color: 'var(--text-primary)' }}>{currentTitle}</span>
        </div>
      </div>

      <div className="topbar-right">
        <div
          className="live-indicator"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11.5px',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: '16px',
            backgroundColor: isConnected ? 'var(--status-ok-bg)' : 'var(--status-denied-bg)',
            color: isConnected ? 'var(--status-ok-text)' : 'var(--status-denied-text)',
            border: `1px solid ${isConnected ? 'var(--status-ok-border)' : 'var(--status-denied-border)'}`
          }}
        >
          <div
            className="pulse-dot"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? 'var(--accent)' : 'var(--text-muted)'
            }}
          />
          <span>{isConnected ? 'EN VIVO (WS ACTIVO)' : 'CONECTANDO WS...'}</span>
        </div>

        <div className="clock-display" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {time.toLocaleTimeString('es-CO', { hour12: false })}
        </div>
      </div>
    </header>
  );
};
