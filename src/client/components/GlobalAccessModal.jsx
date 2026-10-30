// ===================================================================
// Pop-up Global de Escáner y Validación de Acceso RFID Institucional
// Corporación Universitaria Lasallista — Alta Prioridad Visual
// ===================================================================
import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { apiClient } from '../api/client';
import {
  CheckCircle2,
  XCircle,
  X,
  CreditCard,
  DoorClosed,
  GraduationCap,
  IdCard,
  Clock,
  AlertTriangle,
  MapPin,
  Volume2,
  VolumeX,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

const DURATION_MS = 6500;

export const GlobalAccessModal = () => {
  const [scanEvent, setScanEvent] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  const closeTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const startTimeRef = useRef(0);
  const remainingTimeRef = useRef(DURATION_MS);
  const audioCtxRef = useRef(null);
  const lastSeenLogIdRef = useRef(null);

  // Reproducción de tono sonoro de confirmación o alerta
  const playSound = (granted) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (granted) {
        // Tono armónico ascendente Lasallista (Acceso Concedido)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.12); // A5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.start(now);
        osc.stop(now + 0.38);
      } else {
        // Tono grave de advertencia (Acceso Denegado)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220.00, now); // A3
        osc.frequency.setValueAtTime(164.81, now + 0.14); // E3
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (e) {}
  };

  const showModal = (data) => {
    setScanEvent(data);
    setIsVisible(true);
    setProgress(100);
    remainingTimeRef.current = DURATION_MS;
    startTimeRef.current = Date.now();
    playSound(Boolean(data.granted));

    // Limpiar temporizadores anteriores
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    // Barra de tiempo progresiva
    progressIntervalRef.current = setInterval(() => {
      if (!isPaused) {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, DURATION_MS - elapsed);
        const pct = (remaining / DURATION_MS) * 100;
        setProgress(pct);
        if (remaining <= 0) {
          clearInterval(progressIntervalRef.current);
          setIsVisible(false);
        }
      }
    }, 40);

    closeTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, DURATION_MS);
  };

  const handleClose = () => {
    setIsVisible(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  // 1. Escuchar eventos en vivo desde WebSocket (Raspberry Pi, CrowPi, ESP32, o llamadas API)
  const handleWsEvent = (event) => {
    if (event.type === 'access_attempt' && event.data) {
      const d = event.data;
      lastSeenLogIdRef.current = d.logId || d.id;
      showModal({
        id: d.logId || d.id,
        granted: Boolean(d.granted),
        denial_reason: d.denialReason || d.denial_reason,
        timestamp: d.timestamp || new Date().toISOString(),
        uid: d.uid,
        user: d.user,
        door: d.door,
        room: d.room,
        alarm_triggered: Boolean(d.alarmTriggered || d.alarm_triggered)
      });
    }
  };

  const { isConnected: isWsConnected } = useWebSocket(handleWsEvent);

  // 2. Polling reactivo para entornos sin WebSocket directo (ej. Vercel Serverless)
  useEffect(() => {
    if (isWsConnected) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiClient('/access/latest');
        if (res.success && res.data && res.data.id) {
          const scan = res.data;
          if (lastSeenLogIdRef.current === null) {
            lastSeenLogIdRef.current = scan.id;
            return;
          }
          if (scan.id !== lastSeenLogIdRef.current) {
            lastSeenLogIdRef.current = scan.id;
            const scanTime = new Date(scan.timestamp).getTime();
            // Solo abrir modal si el evento ocurrió hace menos de 20 segundos
            if (Date.now() - scanTime < 20000) {
              showModal({
                id: scan.id,
                granted: Boolean(scan.granted),
                denial_reason: scan.denial_reason,
                timestamp: scan.timestamp,
                uid: scan.uid,
                user: scan.user,
                door: scan.door,
                room: scan.room,
                alarm_triggered: Boolean(scan.alarm_triggered)
              });
            }
          }
        }
      } catch (err) {}
    }, 1200);

    return () => clearInterval(interval);
  }, [isWsConnected]);

  // Cerrar con la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isVisible) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  // Si no está visible, no renderizar overlay
  if (!isVisible || !scanEvent) return null;

  const granted = Boolean(scanEvent.granted);
  const user = scanEvent.user;
  const door = scanEvent.door;
  const room = scanEvent.room;

  // Formato de hora exacta
  const formatTime = (ts) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    } catch (e) {
      return '--:--:--';
    }
  };

  // Texto legible de motivos de denegación
  const getDenialText = (reason) => {
    switch (reason) {
      case 'denegado_no_registrado':
        return 'Tarjeta RFID no registrada en la base de datos institucional';
      case 'denegado_tarjeta_inactiva':
        return 'Tarjeta deshabilitada o revocada por administración';
      case 'denegado_sin_usuario_asignado':
        return 'Tarjeta activa pero sin estudiante ni usuario asignado';
      case 'denegado_usuario_inactivo':
        return 'Estudiante o usuario suspendido temporalmente por decanatura';
      case 'denegado_acceso_expirado':
        return 'Vigencia de acceso institucional expirada';
      case 'denegado_area_no_autorizada':
        return 'Área no autorizada para el rol institucional';
      case 'denegado_horario_no_valido':
        return 'Fuera del horario de clases asignado en la articulación horaria';
      default:
        return reason || 'Acceso denegado por políticas de seguridad';
    }
  };

  // Iniciales para avatar fallback
  const getInitials = (first, last) => {
    const f = (first || '?')[0];
    const l = (last || '')[0] || '';
    return (f + l).toUpperCase();
  };

  // Avatar institucional o foto
  const studentName = user ? (user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim()) : 'Usuario no Registrado';
  const avatarUrl = user?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=${granted ? '065f46' : '991b1b'}&color=ffffff&size=200&bold=true`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(10, 16, 30, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => {
          setIsPaused(false);
          startTimeRef.current = Date.now() - (DURATION_MS * (1 - progress / 100));
        }}
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: granted
            ? '0 25px 60px -15px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(16, 185, 129, 0.25)'
            : '0 25px 60px -15px rgba(239, 68, 68, 0.45), 0 0 0 1px rgba(239, 68, 68, 0.25)',
          border: `2px solid ${granted ? '#10b981' : '#ef4444'}`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* ============================================================== */}
        {/* 1. CABECERA GIGANTE: ACCESO CONCEDIDO (VERDE) / DENEGADO (ROJO) */}
        {/* ============================================================== */}
        <div
          style={{
            background: granted
              ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
              : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
            color: '#ffffff',
            padding: '24px 24px 20px 24px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          {/* Botones de control (Silenciar / Cerrar) */}
          <div style={{ position: 'absolute', top: '14px', right: '14px', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Silenciar alertas' : 'Activar sonido'}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease'
              }}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={handleClose}
              title="Cerrar pop-up (Esc)"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease'
              }}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* Icono Monumental */}
          <div
            style={{
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.22)',
              border: '3px solid rgba(255, 255, 255, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
            }}
          >
            {granted ? (
              <CheckCircle2 size={46} color="#ffffff" strokeWidth={2.6} />
            ) : (
              <XCircle size={46} color="#ffffff" strokeWidth={2.6} />
            )}
          </div>

          {/* TEXTO ENORME: ACCESO CONCEDIDO / DENEGADO */}
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              margin: '0 0 6px 0',
              lineHeight: 1.1,
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.25)'
            }}
          >
            {granted ? 'ACCESO CONCEDIDO' : 'ACCESO DENEGADO'}
          </h1>

          <div
            style={{
              fontSize: '13.5px',
              fontWeight: 600,
              opacity: 0.95,
              maxWidth: '440px',
              lineHeight: 1.35
            }}
          >
            {granted
              ? 'Apertura electromecánica autorizada · Cerradura desbloqueada'
              : getDenialText(scanEvent.denial_reason)}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. DATOS DEL ESTUDIANTE (UN ESTUDIANTE SOLO TIENE UN UID)      */}
        {/* ============================================================== */}
        <div style={{ padding: '22px 24px', backgroundColor: 'var(--bg-card, #ffffff)' }}>
          {user ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-tertiary, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                marginBottom: '16px'
              }}
            >
              {/* Foto del Estudiante */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={avatarUrl}
                  alt={studentName}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=002855&color=ffffff&size=200&bold=true`;
                  }}
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: `3px solid ${granted ? '#10b981' : '#ef4444'}`,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '9.5px',
                    fontWeight: 800,
                    backgroundColor: granted ? '#10b981' : '#ef4444',
                    color: '#ffffff',
                    border: '2px solid #ffffff'
                  }}
                >
                  {granted ? 'VÁLIDO' : 'RECHAZO'}
                </span>
              </div>

              {/* Información Personal y Académica */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--accent-soft, rgba(0, 40, 85, 0.08))',
                      color: 'var(--accent, #002855)'
                    }}
                  >
                    {user.role || 'Estudiante'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>·</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    C.C. {user.document_id || '—'}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '19px',
                    fontWeight: 800,
                    color: 'var(--text-primary, #0f172a)',
                    lineHeight: 1.25,
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={studentName}
                >
                  {studentName}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--accent, #002855)'
                  }}
                >
                  <GraduationCap size={15} />
                  <span>{user.program || 'Programa Académico General'}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Tarjeta desconocida / No asociada */
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                marginBottom: '16px'
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0
                }}
              >
                <ShieldAlert size={28} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#dc2626' }}>
                  Carnet no asignado a ningún estudiante
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, #334155)', marginTop: '2px' }}>
                  El UID escaneado no pertenece a la Corporación Universitaria Lasallista o fue bloqueado preventivamente.
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 3. PARÁMETROS DE HARDWARE: UID, PUERTA Y HORA                  */}
          {/* ============================================================== */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              fontSize: '12px'
            }}
          >
            {/* UID Tarjeta */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-tertiary, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <CreditCard size={18} style={{ color: 'var(--accent, #002855)', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  UID Tarjeta RFID
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>
                  {scanEvent.uid || '—'}
                </div>
              </div>
            </div>

            {/* Hora Transacción */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-tertiary, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <Clock size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Hora del Escaneo
                </div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(scanEvent.timestamp)}
                </div>
              </div>
            </div>

            {/* Puerta y Ubicación */}
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-tertiary, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <DoorClosed size={18} style={{ color: 'var(--accent, #002855)', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Punto de Acceso & Ubicación Institucional
                </div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                  {door?.name || `Puerta #${door?.id || '—'}`}
                  {room?.name && (
                    <span style={{ fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                      · {room.name} {room.block_name ? `(${room.block_name})` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Alerta Perimetral Si Aplica */}
          {scanEvent.alarm_triggered && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              <AlertTriangle size={18} color="#dc2626" />
              <span>🚨 Alerta perimetral activada: la sala tiene alarma armada y se reportó el incidente.</span>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* 4. BARRA DE TIEMPO REGRESIVA (CIERRE AUTOMÁTICO EN 6.5s)       */}
        {/* ============================================================== */}
        <div style={{ height: '4px', width: '100%', backgroundColor: 'var(--border, #e2e8f0)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: granted ? '#10b981' : '#ef4444',
              transition: isPaused ? 'none' : 'width 0.05s linear'
            }}
          />
        </div>
      </div>
    </div>
  );
};
