import React, { useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSimulatedClock } from '../../hooks/useSimulatedClock';

const TZ = 'America/Bogota';

const toInputValue = (date) =>
  date.toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T').slice(0, 16);

const fmtTime = (date) =>
  date.toLocaleTimeString('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDate = (date) =>
  date.toLocaleDateString('es-CO', { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short' });

export const SimulatedClock = ({ isCollapsed }) => {
  const { isAdmin } = useAuth();
  const { now, simulated, setSimulation } = useSimulatedClock();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ left: 0, bottom: 0 });

  const toggle = () => {
    if (!open) {
      setValue(toInputValue(now));
      setError('');
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ left: r.left, bottom: Math.max(8, window.innerHeight - r.top + 8) });
    }
    setOpen(!open);
  };

  const run = async (dt) => {
    setBusy(true);
    setError('');
    try {
      await setSimulation(dt);
      setOpen(false);
    } catch (e) {
      setError(e.message || 'No se pudo cambiar la hora');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="btn btn-secondary btn-sm"
        title={simulated ? 'Hora SIMULADA para pruebas de horarios' : 'Hora del sistema (clic para simular otra)'}
        style={{
          flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 10px',
          ...(simulated ? { borderColor: '#d97706', color: '#d97706' } : {})
        }}
      >
        <Clock size={15} style={{ flexShrink: 0 }} />
        {!isCollapsed && (
          <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {fmtTime(now)} · {fmtDate(now)}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', left: pos.left, bottom: pos.bottom, zIndex: 1000, width: 270, padding: 14,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: 10
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            {simulated ? 'Hora simulada activa' : 'Simular fecha y hora'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Afecta la validación de horarios de acceso (zona Bogotá). La hora sigue avanzando desde el momento elegido.
          </div>
          {isAdmin ? (
            <>
              <input
                type="datetime-local"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
              {error && <div style={{ fontSize: 11, color: '#ef4444' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" disabled={busy || !value} onClick={() => run(value)} style={{ flex: 1 }}>
                  Aplicar
                </button>
                <button className="btn btn-secondary btn-sm" disabled={busy || !simulated} onClick={() => run(null)} style={{ flex: 1 }}>
                  Hora real
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11 }}>Solo un administrador puede cambiar la hora.</div>
          )}
        </div>
      )}
    </>
  );
};
