// ===================================================================
// RADAR — Control de Acceso RFID Institucional
// Consola de Acceso y Monitoreo v1.0
// ===================================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { apiClient } from '../api/client';
import { RadarLogo } from '../components/RadarLogo';
import {
  CreditCard,
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Lock,
  Volume2,
  VolumeX,
  ShieldCheck,
  Clock,
  X
} from 'lucide-react';

export const Login = () => {
  const { loginWithCard, isAuthenticated, isCelador, authNotice, clearAuthNotice } = useAuth();
  const navigate = useNavigate();

  // Estados del escáner RFID
  const [status, setStatus] = useState('idle'); // 'idle' | 'scanning' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState('Acerque su carnet al lector para ingresar');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastScannedUid, setLastScannedUid] = useState(null);
  const [authorizedUser, setAuthorizedUser] = useState(null);
  const [entryTimestamp, setEntryTimestamp] = useState(null);

  // Configuración general
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('rfid_sound_enabled') !== 'false');

  const lastProcessedIdRef = useRef(null);
  const isProcessingRef = useRef(false);
  const audioCtxRef = useRef(null);
  const wedgeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Redirigir si el usuario ya cuenta con sesión activa
  useEffect(() => {
    if (isAuthenticated) {
      navigate(isCelador ? '/monitor' : '/dashboard', { replace: true });
    }
  }, [isAuthenticated, isCelador, navigate]);

  // Obtener o desbloquear AudioContext asegurando que esté en estado 'running'
  const getAudioContext = useCallback(async () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      return ctx;
    } catch (e) {
      return null;
    }
  }, []);

  // Desbloqueo proactivo ante cualquier interacción (click, toque o tecla)
  useEffect(() => {
    const unlock = () => {
      try {
        if (!audioCtxRef.current) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            audioCtxRef.current = new AudioCtx();
          }
        }
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      } catch (e) {}
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  // Alternar audio, persistir en localStorage y emitir tono de prueba al activar
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('rfid_sound_enabled', String(next));
      if (next) {
        getAudioContext().then(ctx => {
          if (ctx && ctx.state === 'running') {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
          }
        }).catch(() => {});
      }
      return next;
    });
  };

  // Tonos sonoros de validación Web Audio API (asíncrono y tolerante a suspensión)
  const playSound = useCallback(async (granted) => {
    if (!soundEnabled) return;
    try {
      const ctx = await getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      if (granted) {
        // Tono ascendente de confirmación (D5 -> A5)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.12); // A5

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.start(now);
        osc.stop(now + 0.45);
      } else {
        // Tono grave de alerta (A3 -> D3)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220.00, now); // A3
        osc.frequency.setValueAtTime(146.83, now + 0.15); // D3

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.26, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn('Audio no disponible:', e);
    }
  }, [soundEnabled, getAudioContext]);

  // Procesar autenticación física por UID de tarjeta RFID
  const handleCardAuthentication = useCallback(async (uidRaw) => {
    if (!uidRaw || isProcessingRef.current) return;

    const cleanUid = String(uidRaw).trim().replace(/[\s:\-]/g, '').toUpperCase();
    if (cleanUid.length < 4) return;

    isProcessingRef.current = true;
    setLastScannedUid(cleanUid);
    setStatus('scanning');
    setStatusMessage(`Leyendo carnet [${cleanUid}]...`);
    setErrorMessage('');

    try {
      const res = await loginWithCard(cleanUid);

      if (res.success && res.user) {
        playSound(true);
        setStatus('success');
        setAuthorizedUser(res.user);
        setEntryTimestamp(new Date());
        setStatusMessage(`Bienvenido, ${res.user.first_name} ${res.user.last_name}`);

        setTimeout(() => {
          const userRole = (res.user.role?.name || '').toLowerCase();
          if (userRole === 'celador' || userRole === 'security') {
            navigate('/monitor', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }, 1800);
      } else {
        playSound(false);
        setStatus('error');
        setErrorMessage(res.error || 'Tarjeta no autorizada para acceder al sistema.');
        setStatusMessage('Acceso no autorizado');

        setTimeout(() => {
          setStatus('idle');
          setStatusMessage('Acerque su carnet al lector para ingresar');
          isProcessingRef.current = false;
        }, 3200);
      }
    } catch (err) {
      playSound(false);
      setStatus('error');
      setErrorMessage(err.message || 'Error de conexión con el servidor.');
      setStatusMessage('Error de conexión');

      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('Acerque su carnet al lector para ingresar');
        isProcessingRef.current = false;
      }, 3200);
    }
  }, [loginWithCard, navigate, playSound]);

  // 1. Escuchar lecturas en vivo desde WebSocket
  const handleWsEvent = useCallback((event) => {
    if (isProcessingRef.current) return;

    if (event.type === 'access_attempt' && event.data?.uid) {
      const scanUid = event.data.uid;
      const logId = event.data.logId || event.data.id;
      if (logId && logId === lastProcessedIdRef.current) return;
      lastProcessedIdRef.current = logId;
      handleCardAuthentication(scanUid);
    }
  }, [handleCardAuthentication]);

  const { isConnected: isWsConnected } = useWebSocket(handleWsEvent);

  // 2. Polling de respaldo para lecturas de hardware
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      if (isProcessingRef.current) return;

      try {
        const res = await apiClient('/access/latest');
        if (res.success && res.data && res.data.uid) {
          const scan = res.data;
          const scanTime = new Date(scan.timestamp).getTime();
          const isFresh = (Date.now() - scanTime) < 3000;

          if (isFresh && scan.id !== lastProcessedIdRef.current) {
            lastProcessedIdRef.current = scan.id;
            handleCardAuthentication(scan.uid);
          }
        }
      } catch (e) {}
    }, 280);

    return () => clearInterval(pollInterval);
  }, [handleCardAuthentication]);

  // 3. Captura directa de lectores USB (teclado cuña)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      if (now - lastKeyTimeRef.current > 150) {
        wedgeBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const potentialUid = wedgeBufferRef.current.trim();
        wedgeBufferRef.current = '';
        if (potentialUid.length >= 4) {
          handleCardAuthentication(potentialUid);
        }
      } else if (e.key.length === 1) {
        wedgeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCardAuthentication]);

  const initials = authorizedUser
    ? `${(authorizedUser.first_name || '?')[0]}${(authorizedUser.last_name || '')[0]}`.toUpperCase()
    : 'ID';

  const userRoleName = (authorizedUser?.role?.name || '').toLowerCase();
  const isAdminRole = userRoleName === 'admin' || userRoleName === 'rector';

  const hasValidAuthNotice = Boolean(
    authNotice &&
    typeof authNotice === 'string' &&
    authNotice !== '[object Object]' &&
    authNotice.trim().length > 0
  );

  return (
    <div className="radar-login-container">
      {/* ========================================================================= */}
      {/* PANEL IZQUIERDO: STAGE VISUAL RADAR E IDENTIFICACIÓN DEL USUARIO          */}
      {/* ========================================================================= */}
      <div className="radar-login-left">
        {/* Grilla sutil de fondo */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(56, 189, 248, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56, 189, 248, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, transparent 80%)',
          pointerEvents: 'none'
        }} />

        {/* Resplandor central dinámico */}
        <div style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '560px',
          height: '560px',
          borderRadius: '50%',
          background: status === 'success'
            ? 'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, transparent 65%)'
            : status === 'error'
            ? 'radial-gradient(circle, rgba(239, 68, 68, 0.22) 0%, transparent 65%)'
            : 'radial-gradient(circle, rgba(14, 165, 233, 0.16) 0%, transparent 65%)',
          pointerEvents: 'none',
          transition: 'all 0.5s ease'
        }} />

        {/* Cabecera superior izquierda */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.25)'
            }}>
              <RadarLogo size={28} animated />
            </div>
            <div>
              <div style={{
                fontSize: '16px',
                fontWeight: 900,
                letterSpacing: '0.8px',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                RADAR
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#7dd3fc',
                  letterSpacing: '0.5px'
                }}>
                  v1.0
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                Control de Acceso y Gestión de Espacios
              </div>
            </div>
          </div>

          {/* Controles de sonido y reloj en vivo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={toggleSound}
              title={soundEnabled ? 'Silenciar alertas' : 'Activar sonido'}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: `1px solid ${soundEnabled ? 'rgba(56, 189, 248, 0.4)' : 'rgba(148, 163, 184, 0.2)'}`,
                color: soundEnabled ? '#38bdf8' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: soundEnabled ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none'
              }}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontSize: '11.5px',
              fontFamily: 'var(--font-mono)',
              color: '#38bdf8'
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 8px #10b981'
              }} />
              <span>{currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* ÁREA CENTRAL: REPOSO RADAR O TARJETA DE USUARIO VALIDADO */}
        {/* ======================================================== */}
        <div style={{
          position: 'relative',
          zIndex: 25,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '24px 0'
        }}>
          {status === 'success' && authorizedUser ? (
            /* Vista de usuario verificado con éxito */
            <div style={{
              width: '100%',
              maxWidth: '440px',
              animation: 'liquidFadeInContent 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '30px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                marginBottom: '20px',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)'
              }}>
                <ShieldCheck size={16} />
                <span>ACCESO AUTORIZADO</span>
              </div>

              {/* Foto o Iniciales del Usuario */}
              <div style={{
                position: 'relative',
                width: '120px',
                height: '120px',
                margin: '0 auto 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: '-6px',
                  borderRadius: '50%',
                  border: `2px solid ${isAdminRole ? '#38bdf8' : '#34d399'}`,
                  opacity: 0.85,
                  animation: 'pulseHaloGlow 2.5s ease-in-out infinite'
                }} />

                <div style={{
                  width: '112px',
                  height: '112px',
                  borderRadius: '50%',
                  backgroundColor: '#0b193d',
                  border: `3px solid ${isAdminRole ? '#38bdf8' : '#34d399'}`,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 30px ${isAdminRole ? 'rgba(56, 189, 248, 0.4)' : 'rgba(52, 211, 153, 0.4)'}`
                }}>
                  {authorizedUser.photo_url ? (
                    <img
                      src={authorizedUser.photo_url}
                      alt={authorizedUser.first_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      fontSize: '36px',
                      fontWeight: 800,
                      color: isAdminRole ? '#38bdf8' : '#34d399'
                    }}>
                      {initials}
                    </div>
                  )}
                </div>
              </div>

              {/* Nombre completo */}
              <h2 style={{
                fontSize: '24px',
                fontWeight: 800,
                color: '#ffffff',
                margin: '0 0 6px',
                letterSpacing: '-0.3px'
              }}>
                {authorizedUser.first_name} {authorizedUser.last_name}
              </h2>

              <div style={{
                display: 'inline-block',
                padding: '4px 14px',
                borderRadius: '6px',
                backgroundColor: isAdminRole ? 'rgba(56, 189, 248, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                border: `1px solid ${isAdminRole ? 'rgba(56, 189, 248, 0.35)' : 'rgba(52, 211, 153, 0.35)'}`,
                color: isAdminRole ? '#38bdf8' : '#34d399',
                fontSize: '12px',
                fontWeight: 700,
                marginBottom: '18px'
              }}>
                {authorizedUser.role?.display_name || 'Usuario Autorizado'}
              </div>

              {/* Datos del acceso */}
              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '12px',
                padding: '14px 18px',
                textAlign: 'left',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                marginBottom: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Documento
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>
                    {authorizedUser.document_id || '—'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Tarjeta RFID
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    {authorizedUser.rfid_tag || lastScannedUid}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Hora de Ingreso
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                    {entryTimestamp ? entryTimestamp.toLocaleTimeString('es-CO') : 'Ahora'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Programa / Área
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                    {authorizedUser.program || 'General'}
                  </div>
                </div>
              </div>

              {/* Barra de progreso de redirección */}
              <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', height: '4px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  backgroundColor: '#38bdf8',
                  borderRadius: '4px',
                  width: '100%',
                  animation: 'shimmerGleam 1.8s linear infinite'
                }} />
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '8px' }}>
                Ingresando al sistema...
              </div>
            </div>
          ) : (
            /* Vista en reposo: Logotipo Radar con anillos */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                position: 'relative',
                width: '240px',
                height: '240px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: '-16px',
                  borderRadius: '50%',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  animation: 'pulseHaloGlow 4s ease-in-out infinite'
                }} />
                <div style={{
                  position: 'absolute',
                  inset: '-36px',
                  borderRadius: '50%',
                  border: '1px dashed rgba(56, 189, 248, 0.12)',
                  animation: 'radarSweepSpin 20s linear infinite'
                }} />

                <RadarLogo size={200} animated />
              </div>

              <div style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}>
                <div style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  fontSize: '11.5px',
                  color: '#94a3b8'
                }}>
                  Frecuencia: <strong style={{ color: '#38bdf8' }}>13.56 MHz</strong>
                </div>
                <div style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  fontSize: '11.5px',
                  color: '#94a3b8'
                }}>
                  Lector: <strong style={{ color: '#10b981' }}>RC522 Activo</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie inferior izquierdo */}
        <div style={{ position: 'relative', zIndex: 20 }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 900,
            letterSpacing: '0.5px',
            color: '#38bdf8',
            margin: '0 0 4px',
            textShadow: '0 0 25px rgba(56, 189, 248, 0.35)'
          }}>
            RADAR
          </h1>
          <p style={{
            fontSize: '13.5px',
            fontWeight: 500,
            color: '#cbd5e1',
            margin: 0
          }}>
            Sistema Institucional de Control de Acceso y Gestión de Espacios Físicos.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANEL DERECHO: CONSOLA DE ACCESO (RFID O CREDENCIALES)                   */}
      {/* ========================================================================= */}
      <div className="radar-login-right">
        {/* Cabecera superior derecha */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '16px'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
              Terminal de Ingreso
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>
              Control de Acceso
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            borderRadius: '20px',
            backgroundColor: isWsConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
            border: `1px solid ${isWsConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
            fontSize: '11.5px',
            fontWeight: 600,
            color: isWsConnected ? '#34d399' : '#38bdf8'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isWsConnected ? '#10b981' : '#38bdf8',
              boxShadow: `0 0 8px ${isWsConnected ? '#10b981' : '#38bdf8'}`
            }} />
            <span>{isWsConnected ? 'En línea' : 'Sincronizado'}</span>
          </div>
        </div>

        {/* Notificación de seguridad / Sesión expirada (descartable) */}
        {hasValidAuthNotice && (
          <div style={{
            margin: '16px 0 0',
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#fbbf24',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            lineHeight: 1.4
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{authNotice}</span>
            </div>
            <button
              onClick={clearAuthNotice}
              title="Cerrar aviso"
              style={{
                background: 'none',
                border: 'none',
                color: '#fbbf24',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                opacity: 0.8
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 0' }}>
          {/* ====================================================== */}
          {/* ESCANEO DE CARNET RFID — ÚNICO MÉTODO DE INGRESO      */}
          {/* ====================================================== */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            {/* Pad de lectura RFID */}
            <div style={{
              position: 'relative',
              width: '190px',
              height: '190px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '22px'
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: `2px solid ${status === 'error' ? 'rgba(239, 68, 68, 0.35)' : status === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.35)'}`,
                animation: 'pulseHaloGlow 2.5s ease-in-out infinite'
              }} />
              <div style={{
                position: 'absolute',
                inset: '-14px',
                borderRadius: '50%',
                border: `1px dashed ${status === 'error' ? 'rgba(239, 68, 68, 0.25)' : status === 'success' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.2)'}`,
                animation: 'radarSweepSpin 12s linear infinite'
              }} />

              <div style={{
                width: '125px',
                height: '125px',
                borderRadius: '50%',
                backgroundColor: status === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : status === 'success'
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'rgba(15, 23, 42, 0.85)',
                border: `2.5px solid ${
                  status === 'error' ? '#ef4444' : status === 'success' ? '#10b981' : '#38bdf8'
                }`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: status === 'error'
                  ? '0 0 30px rgba(239, 68, 68, 0.4)'
                  : status === 'success'
                  ? '0 0 35px rgba(16, 185, 129, 0.45)'
                  : '0 0 30px rgba(56, 189, 248, 0.3)',
                transition: 'all 0.3s ease'
              }}>
                {status === 'scanning' ? (
                  <Loader2 size={48} className="spinner" style={{ color: '#38bdf8' }} />
                ) : status === 'success' ? (
                  <CheckCircle2 size={52} style={{ color: '#10b981' }} />
                ) : status === 'error' ? (
                  <XCircle size={52} style={{ color: '#ef4444' }} />
                ) : (
                  <CreditCard size={50} style={{ color: '#38bdf8' }} />
                )}
              </div>
            </div>

            <h2 style={{
              fontSize: '20px',
              fontWeight: 800,
              color: status === 'error' ? '#ef4444' : status === 'success' ? '#10b981' : '#f8fafc',
              margin: '0 0 6px'
            }}>
              {statusMessage}
            </h2>

            <p style={{
              fontSize: '13px',
              color: '#94a3b8',
              maxWidth: '360px',
              margin: '0 auto 16px',
              lineHeight: 1.5
            }}>
              {status === 'idle' && 'Aproxime su tarjeta al lector físico o escáner USB para iniciar sesión.'}
              {status === 'scanning' && 'Validando carnet en el sistema...'}
              {status === 'success' && 'Sesión establecida correctamente. Redirigiendo...'}
              {status === 'error' && errorMessage}
            </p>

            {lastScannedUid && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: '#38bdf8'
              }}>
                <Radio size={14} style={{ color: '#38bdf8' }} />
                <span>UID Detectado: <strong>{lastScannedUid}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Políticas de sesión y pie inferior */}
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            marginBottom: '16px'
          }}>
            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '10px 12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>
                Sesión
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#f1f5f9', marginTop: '2px' }}>
                Única
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>
                Por estación
              </div>
            </div>

            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '10px 12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>
                Inactividad
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#f1f5f9', marginTop: '2px' }}>
                15 min
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>
                Cierre automático
              </div>
            </div>

            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '10px 12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>
                Seguridad
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#f1f5f9', marginTop: '2px' }}>
                JWT
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>
                Token seguro
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11.5px',
            color: '#64748b',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={12} style={{ color: '#38bdf8' }} />
              <span>Sistema de Control de Acceso</span>
            </div>
            <span>RADAR v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
