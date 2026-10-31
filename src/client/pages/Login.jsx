// ===================================================================
// Terminal RADAR — Red de Acceso y Detección mediante Autenticación RFID
// Corporación Universitaria Lasallista — Caldas, Antioquia
// Diseño Split-Screen Inmersivo con Animación Líquida de Identificación
// ===================================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { apiClient } from '../api/client';
import { RadarLogo } from '../components/RadarLogo';
import logo from '../assets/logo.svg';
import {
  CreditCard,
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Lock,
  Wifi,
  Volume2,
  VolumeX,
  Shield,
  ShieldCheck,
  User,
  Clock,
  IdCard,
  Building,
  KeyRound,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export const Login = () => {
  const { loginWithCard, login, isAuthenticated, isCelador, authNotice, clearAuthNotice } = useAuth();
  const navigate = useNavigate();

  // Estados del sistema
  const [status, setStatus] = useState('idle'); // 'idle' | 'scanning' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState('Aproxime su carnet al sensor físico para ingresar');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastScannedUid, setLastScannedUid] = useState(null);
  const [authorizedUser, setAuthorizedUser] = useState(null);
  const [entryTimestamp, setEntryTimestamp] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('rfid_sound_enabled') !== 'false');
  const [demoLoading, setDemoLoading] = useState(false);

  const lastProcessedIdRef = useRef(null);
  const isProcessingRef = useRef(false);
  const audioCtxRef = useRef(null);
  const wedgeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Reloj institucional en vivo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      navigate(isCelador ? '/monitor' : '/dashboard', { replace: true });
    }
  }, [isAuthenticated, isCelador, navigate]);

  // Alternar sonido y persistir en localStorage
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('rfid_sound_enabled', String(next));
      return next;
    });
  };

  // Sonidos de confirmación y denegación por Web Audio API
  const playSound = useCallback((granted) => {
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
        // Acorde armónico ascendente Lasallista (Acceso Concedido)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // Re5
        osc.frequency.setValueAtTime(880.00, now + 0.12); // La5
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else {
        // Tono grave de alerta de seguridad (Acceso Denegado)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220.00, now); // La3
        osc.frequency.setValueAtTime(146.83, now + 0.15); // Re3
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {}
  }, [soundEnabled]);

  // Procesar intento de autenticación física por UID
  const handleCardAuthentication = useCallback(async (uidRaw) => {
    if (!uidRaw || isProcessingRef.current) return;

    const cleanUid = String(uidRaw).trim().replace(/[\s:\-]/g, '').toUpperCase();
    if (cleanUid.length < 4) return;

    isProcessingRef.current = true;
    setLastScannedUid(cleanUid);
    setStatus('scanning');
    setStatusMessage(`Leyendo chip RFID [${cleanUid}]...`);
    setErrorMessage('');

    try {
      const res = await loginWithCard(cleanUid);

      if (res.success && res.user) {
        playSound(true);
        setStatus('success');
        setAuthorizedUser(res.user);
        setEntryTimestamp(new Date());
        setStatusMessage(`¡Bienvenido(a), ${res.user.first_name} ${res.user.last_name}!`);

        // Transición fluida tras mostrar la tarjeta y la animación líquida
        setTimeout(() => {
          const userRole = (res.user.role?.name || '').toLowerCase();
          if (userRole === 'celador' || userRole === 'security') {
            navigate('/monitor', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }, 2200);
      } else {
        playSound(false);
        setStatus('error');
        setErrorMessage(res.error || 'Tarjeta no autorizada para operar el sistema web.');
        setStatusMessage('Acceso no autorizado');

        setTimeout(() => {
          setStatus('idle');
          setStatusMessage('Aproxime su carnet al sensor físico para ingresar');
          isProcessingRef.current = false;
        }, 3600);
      }
    } catch (err) {
      playSound(false);
      setStatus('error');
      setErrorMessage(err.message || 'Error de conexión con la base de datos.');
      setStatusMessage('Fallo de conexión');

      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('Aproxime su carnet al sensor físico para ingresar');
        isProcessingRef.current = false;
      }, 3600);
    }
  }, [loginWithCard, navigate, playSound]);

  // Acceso de prueba (solo para revisar los diseños sin lector RFID)
  const handleDemoAdminLogin = useCallback(async () => {
    if (demoLoading || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setDemoLoading(true);
    setStatus('scanning');
    setStatusMessage('Acceso de prueba: autenticando administrador...');
    setErrorMessage('');

    try {
      const res = await login('admin', 'acceso2026');

      if (res.success && res.user) {
        playSound(true);
        setStatus('success');
        setAuthorizedUser(res.user);
        setEntryTimestamp(new Date());
        setStatusMessage(`¡Bienvenido(a), ${res.user.first_name}!`);

        setTimeout(() => navigate('/dashboard', { replace: true }), 900);
      } else {
        playSound(false);
        setStatus('error');
        setErrorMessage(res.error || 'No se pudo iniciar la sesión de prueba.');
        setStatusMessage('Acceso de prueba fallido');
        isProcessingRef.current = false;
        setDemoLoading(false);

        setTimeout(() => {
          setStatus('idle');
          setStatusMessage('Aproxime su carnet al sensor físico para ingresar');
        }, 3600);
      }
    } catch (err) {
      playSound(false);
      setStatus('error');
      setErrorMessage(err.message || 'Error de conexión con la base de datos.');
      setStatusMessage('Fallo de conexión');
      isProcessingRef.current = false;
      setDemoLoading(false);

      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('Aproxime su carnet al sensor físico para ingresar');
      }, 3600);
    }
  }, [login, navigate, playSound, demoLoading]);

  // 1. Escuchar eventos de escaneo físico en tiempo real por WebSocket
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

  // 2. Polling de respaldo para lector físico en caso de desconexión momentánea
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
    }, 1200);

    return () => clearInterval(pollInterval);
  }, [handleCardAuthentication]);

  // 3. Soporte universal de lectura: Detectores USB tipo teclado cuña
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

  return (
    <div className="radar-login-container">
      {/* ========================================================================= */}
      {/* LADO IZQUIERDO: STAGE VISUAL RADAR + REVELACIÓN LÍQUIDA DE IDENTIDAD      */}
      {/* ========================================================================= */}
      <div className="radar-login-left">
        {/* Grilla Cibernética de Fondo */}
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

        {/* Resplandor Neón Central */}
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
            : 'radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, transparent 65%)',
          pointerEvents: 'none',
          transition: 'all 0.6s ease'
        }} />

        {/* ======================================================== */}
        {/* CAPA DE ANIMACIÓN LÍQUIDA (Surge cuando se pone el RFID)  */}
        {/* ======================================================== */}
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10,
          transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease',
          transform: status === 'success' || status === 'scanning' ? 'translateY(0%)' : 'translateY(105%)',
          opacity: status === 'success' || status === 'scanning' ? 1 : 0
        }}>
          {/* Ondas Líquidas Multicapa SVG */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <svg
              className="liquid-wave-layer liquid-wave-1"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                top: 0,
                height: '140px',
                fill: 'rgba(56, 189, 248, 0.22)'
              }}
            >
              <path d="M0,0 C150,90 350,-40 500,40 C650,120 900,10 1200,60 L1200,120 L0,120 Z" />
            </svg>
            <svg
              className="liquid-wave-layer liquid-wave-2"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                top: '20px',
                height: '160px',
                fill: 'rgba(14, 165, 233, 0.35)'
              }}
            >
              <path d="M0,40 C200,10 400,90 600,30 C800,-30 1000,70 1200,20 L1200,120 L0,120 Z" />
            </svg>
            <div style={{
              position: 'absolute',
              top: '120px',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(180deg, rgba(7, 21, 54, 0.94) 0%, rgba(3, 11, 29, 0.98) 100%)',
              backdropFilter: 'blur(12px)'
            }} />
          </div>
        </div>

        {/* Barra Superior Izquierda: Logos y Controles */}
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
                fontSize: '15px',
                fontWeight: 900,
                letterSpacing: '0.8px',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                RADAR
                <span style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#7dd3fc',
                  letterSpacing: '0.5px'
                }}>
                  v2.4
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Corporación Universitaria Lasallista
              </div>
            </div>
          </div>

          {/* Botones de Control y Sonido (Como en el diseño del usuario) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={toggleSound}
              className="sound-toggle-btn"
              title={soundEnabled ? 'Silenciar confirmaciones sonoras' : 'Activar confirmaciones sonoras'}
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
        {/* CONTENIDO CENTRAL: RADAR EN REPOSO vs REVELACIÓN LÍQUIDA */}
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
          padding: '20px 0'
        }}>
          {status === 'success' && authorizedUser ? (
            /* ====================================================== */
            /* REVELACIÓN LÍQUIDA DE DATOS DEL TITULAR (RFID DETECTADO) */
            /* ====================================================== */
            <div style={{
              width: '100%',
              maxWidth: '460px',
              animation: 'liquidFadeInContent 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}>
              {/* Badge de Verificación Exitoso */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 16px',
                borderRadius: '30px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.6px',
                marginBottom: '24px',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)'
              }}>
                <ShieldCheck size={16} />
                <span>IDENTIFICACIÓN EXITOSA • ACCESO CONCEDIDO</span>
              </div>

              {/* Foto / Avatar con Anillo Neón */}
              <div style={{
                position: 'relative',
                width: '130px',
                height: '130px',
                margin: '0 auto 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: '-8px',
                  borderRadius: '50%',
                  border: `2px solid ${isAdminRole ? '#38bdf8' : '#34d399'}`,
                  opacity: 0.85,
                  animation: 'pulseHaloGlow 2.5s ease-in-out infinite'
                }} />

                <div style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  backgroundColor: '#0b193d',
                  border: `3px solid ${isAdminRole ? '#38bdf8' : '#34d399'}`,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 35px ${isAdminRole ? 'rgba(56, 189, 248, 0.4)' : 'rgba(52, 211, 153, 0.4)'}`
                }}>
                  {authorizedUser.photo_url ? (
                    <img
                      src={authorizedUser.photo_url}
                      alt={authorizedUser.first_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      fontSize: '38px',
                      fontWeight: 800,
                      color: isAdminRole ? '#38bdf8' : '#34d399',
                      letterSpacing: '1px'
                    }}>
                      {initials}
                    </div>
                  )}
                </div>
              </div>

              {/* Nombre y Cargo */}
              <h2 style={{
                fontSize: '26px',
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
                fontSize: '12.5px',
                fontWeight: 700,
                marginBottom: '20px'
              }}>
                {authorizedUser.role?.display_name || 'Operador Autorizado'}
              </div>

              {/* Tarjeta de Metadatos de Ingreso */}
              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '12px',
                padding: '16px 20px',
                textAlign: 'left',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                marginBottom: '20px'
              }}>
                <div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Documento de Identidad
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>
                    {authorizedUser.document_id}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Tarjeta RFID Física
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    UID: {authorizedUser.rfid_tag || lastScannedUid}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Hora de Ingreso
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                    {entryTimestamp ? entryTimestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : 'Ahora'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Área / Dependencia
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                    {authorizedUser.program || 'Seguridad Campus'}
                  </div>
                </div>
              </div>

              {/* Barra de Progreso de Acceso */}
              <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', height: '4px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  backgroundColor: '#38bdf8',
                  borderRadius: '4px',
                  width: '100%',
                  animation: 'shimmerGleam 2s linear infinite'
                }} />
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '8px' }}>
                Concediendo acceso al entorno institucional...
              </div>
            </div>
          ) : (
            /* ====================================================== */
            /* MODO REPOSO: RADAR INSTITUCIONAL Y TELEMETRÍA EN VIVO  */
            /* ====================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                position: 'relative',
                width: '260px',
                height: '260px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '26px'
              }}>
                {/* Ondas Neón concéntricas expansivas */}
                <div style={{
                  position: 'absolute',
                  inset: '-20px',
                  borderRadius: '50%',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  animation: 'pulseHaloGlow 4s ease-in-out infinite'
                }} />
                <div style={{
                  position: 'absolute',
                  inset: '-45px',
                  borderRadius: '50%',
                  border: '1px dashed rgba(56, 189, 248, 0.15)',
                  animation: 'radarSweepSpin 20s linear infinite'
                }} />

                {/* Logotipo Vectorial Radar Oficial */}
                <RadarLogo size={220} animated />
              </div>

              {/* Indicadores de Telemetría Flotante */}
              <div style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                justifyContent: 'center',
                maxWidth: '440px'
              }}>
                <div style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  fontSize: '11.5px',
                  color: '#94a3b8'
                }}>
                  Frecuencia: <strong style={{ color: '#38bdf8' }}>13.56 MHz (ISO 14443A)</strong>
                </div>
                <div style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  fontSize: '11.5px',
                  color: '#94a3b8'
                }}>
                  Lector: <strong style={{ color: '#10b981' }}>SPI MFRC522 Online</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Barra Inferior Izquierda: Branding Institucional */}
        <div style={{ position: 'relative', zIndex: 20 }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 900,
            letterSpacing: '1px',
            color: '#38bdf8',
            margin: '0 0 6px',
            textShadow: '0 0 30px rgba(56, 189, 248, 0.4)'
          }}>
            RADAR
          </h1>
          <p style={{
            fontSize: '14.5px',
            fontWeight: 600,
            color: '#f8fafc',
            margin: '0 0 4px',
            lineHeight: 1.4
          }}>
            Red de Acceso y Detección mediante Autenticación RFID
          </p>
          <p style={{
            fontSize: '12px',
            color: '#94a3b8',
            margin: 0
          }}>
            Plataforma Institucional para la Seguridad y Gestión de Espacios Físicos Universitarios.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LADO DERECHO: CONSOLA DE ESCANEO Y DETECCIÓN DEL SENSOR FÍSICO            */}
      {/* ========================================================================= */}
      <div className="radar-login-right">
        {/* Encabezado Superior Derecho */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '20px'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
              Terminal de Seguridad y Portería
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>
              Estación de Autenticación Activa
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '20px',
            backgroundColor: isWsConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
            border: `1px solid ${isWsConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
            fontSize: '11.5px',
            fontWeight: 600,
            color: isWsConnected ? '#34d399' : '#38bdf8'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isWsConnected ? '#10b981' : '#38bdf8',
              boxShadow: `0 0 10px ${isWsConnected ? '#10b981' : '#38bdf8'}`
            }} />
            <span>{isWsConnected ? 'Hardware Conectado' : 'Sincronización Polling'}</span>
          </div>
        </div>

        {/* Notificación de Seguridad / Sesión Expirada */}
        {authNotice && (
          <div style={{
            margin: '20px 0 0',
            padding: '14px 18px',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#fbbf24',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            lineHeight: 1.4
          }}>
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{authNotice}</div>
          </div>
        )}

        {/* Centro de la Consola: Target Sensible al RFID */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '24px 0'
        }}>
          {/* Pad / Diana de Lectura RFID */}
          <div style={{
            position: 'relative',
            width: '210px',
            height: '210px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '28px'
          }}>
            {/* Ondas del Sensor */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px solid ${status === 'error' ? 'rgba(239, 68, 68, 0.35)' : status === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.35)'}`,
              animation: 'pulseHaloGlow 2.5s ease-in-out infinite'
            }} />
            <div style={{
              position: 'absolute',
              inset: '-16px',
              borderRadius: '50%',
              border: `1px dashed ${status === 'error' ? 'rgba(239, 68, 68, 0.25)' : status === 'success' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.2)'}`,
              animation: 'radarSweepSpin 12s linear infinite'
            }} />

            {/* Núcleo Sensible al Contacto */}
            <div style={{
              width: '135px',
              height: '135px',
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
                ? '0 0 35px rgba(239, 68, 68, 0.4)'
                : status === 'success'
                ? '0 0 40px rgba(16, 185, 129, 0.45)'
                : '0 0 35px rgba(56, 189, 248, 0.3)',
              transition: 'all 0.3s ease'
            }}>
              {status === 'scanning' ? (
                <Loader2 size={54} className="spinner" style={{ color: '#38bdf8' }} />
              ) : status === 'success' ? (
                <CheckCircle2 size={58} style={{ color: '#10b981' }} />
              ) : status === 'error' ? (
                <XCircle size={58} style={{ color: '#ef4444' }} />
              ) : (
                <CreditCard size={56} style={{ color: '#38bdf8' }} />
              )}
            </div>
          </div>

          <h2 style={{
            fontSize: '22px',
            fontWeight: 800,
            color: status === 'error' ? '#ef4444' : status === 'success' ? '#10b981' : '#f8fafc',
            margin: '0 0 8px'
          }}>
            {statusMessage}
          </h2>

          <p style={{
            fontSize: '13.5px',
            color: '#94a3b8',
            maxWidth: '380px',
            margin: '0 auto 20px',
            lineHeight: 1.5
          }}>
            {status === 'idle' && 'No requiere contraseña. El lector físico MFRC522 detectará su credencial automáticamente al aproximarla.'}
            {status === 'scanning' && 'Verificando firma criptográfica en base de datos PostgreSQL...'}
            {status === 'success' && 'Sesión única establecida. Redirigiendo a la consola de mando.'}
            {status === 'error' && errorMessage}
          </p>

          {/* Acceso de prueba — solo para revisar los diseños sin lector RFID */}
          <button
            type="button"
            onClick={handleDemoAdminLogin}
            disabled={demoLoading || status === 'scanning'}
            className="demo-admin-btn"
            title="Sesión de prueba con rol administrador (no requiere carnet)"
          >
            {demoLoading ? <Loader2 size={16} className="spinner" /> : <Shield size={16} />}
            <span>{demoLoading ? 'Autenticando...' : 'Entrar como administrador (demo)'}</span>
            {!demoLoading && <ArrowRight size={15} />}
          </button>

          {lastScannedUid && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              fontSize: '12.5px',
              fontFamily: 'var(--font-mono)',
              color: '#38bdf8'
            }}>
              <Radio size={14} style={{ color: '#38bdf8' }} />
              <span>UID Detectado: <strong>{lastScannedUid}</strong></span>
            </div>
          )}
        </div>

        {/* Políticas de Seguridad y Telemetría Inferior (Llena el espacio armónicamente) */}
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '18px'
          }}>
            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '12px 14px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Concurrencia
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#f1f5f9', marginTop: '2px' }}>
                1 Sesión
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                Por estación activa
              </div>
            </div>

            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '12px 14px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Inactividad
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#f1f5f9', marginTop: '2px' }}>
                15 Minutos
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                Cierre automático
              </div>
            </div>

            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '12px 14px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Turno Máximo
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#f1f5f9', marginTop: '2px' }}>
                4 Horas
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                Token JWT Seguro
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11.5px',
            color: '#64748b',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={12} style={{ color: '#38bdf8' }} />
              <span>Autenticación por Hardware Criptográfico</span>
            </div>
            <span>Lasallista © 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
};
