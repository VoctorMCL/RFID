import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { apiClient } from '../../api/client';
import { Cpu } from 'lucide-react';

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

  const handleWsEvent = (event) => {
    if (event.type === 'hardware_heartbeat' || event.type === 'access_attempt') {
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
          // Un sensor de hardware está activo si alguna puerta reportó actividad en los últimos 30s
          const activeDoor = res.data.find(d => d.is_hardware_active);
          if (activeDoor) {
            setIsSensorActive(true);
            setActiveSensorDoor(activeDoor.name);
          } else {
            setIsSensorActive(false);
            setActiveSensorDoor(null);
          }
        }
      } catch (e) {
        if (isMounted) {
          setIsSensorActive(false);
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
        <div className="breadcrumb" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Acceso RFID</span>
          &nbsp;›&nbsp;
          <span style={{ color: 'var(--text-primary)' }}>{currentTitle}</span>
        </div>
      </div>

      <div className="topbar-right">
        {/* Indicador de Hardware Sensor RFID Real (Sin datos ficticios) */}
        <div
          className="live-indicator"
          title={isSensorActive ? `Lector MFRC522 activo en: ${activeSensorDoor || 'CrowPi'}` : 'Sin comunicación de hardware MFRC522 / CrowPi reciente'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11.5px',
            fontWeight: 700,
            letterSpacing: '0.3px',
            padding: '5px 12px',
            borderRadius: '6px',
            fontFamily: 'var(--font-mono)',
            backgroundColor: isSensorActive ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: isSensorActive ? '#4ade80' : '#f87171',
            border: `1px solid ${isSensorActive ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
          }}
        >
          <div
            className={isSensorActive ? 'pulse-dot' : ''}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isSensorActive ? '#4ade80' : '#ef4444',
              boxShadow: isSensorActive ? '0 0 8px rgba(74, 222, 128, 0.6)' : 'none'
            }}
          />
          <Cpu size={14} style={{ opacity: 0.9 }} />
          <span>
            {isSensorActive
              ? `SENSOR RFID: EN LÍNEA ${activeSensorDoor ? `(${activeSensorDoor})` : ''}`
              : 'SENSOR RFID: DESCONECTADO'}
          </span>
        </div>
      </div>
    </header>
  );
};
