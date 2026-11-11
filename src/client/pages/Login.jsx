import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { apiClient } from '../api/client';
import { preloadSystemData } from '../services/systemPreloader';
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
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';

const LOGIN_REDIRECT_DELAY_MS = 2600;

export const Login = () => {
  const { loginWithCard, isAuthenticated, isCelador, authNotice, clearAuthNotice } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('Acerque su carnet al lector para ingresar');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastScannedUid, setLastScannedUid] = useState(null);
  const [authorizedUser, setAuthorizedUser] = useState(null);
  const [entryTimestamp, setEntryTimestamp] = useState(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('rfid_sound_enabled') !== 'false');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
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

  const [health, setHealth] = useState({ database: null, reader: null });

  const lastProcessedIdRef = useRef(null);
  const isProcessingRef = useRef(false);
  const redirectTimerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const wedgeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const res = await apiClient('/health');
        if (!isMounted) return;
        setHealth({
          database: Boolean(res?.database?.connected),
          reader: Boolean(res?.reader?.connected)
        });
      } catch (e) {
        if (isMounted) {
          setHealth({ database: false, reader: false });
        }
      }
    };

    checkHealth();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      checkHealth();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && status !== 'success' && status !== 'scanning') {
      navigate(isCelador ? '/monitor' : '/dashboard', { replace: true });
    }
  }, [isAuthenticated, isCelador, navigate, status]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

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
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880.00, now + 0.12);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.start(now);
        osc.stop(now + 0.45);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220.00, now);
        osc.frequency.setValueAtTime(146.83, now + 0.15);

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

        const userRole = (res.user.role?.name || '').toLowerCase();
        const targetPath = userRole === 'celador' || userRole === 'security' ? '/monitor' : '/dashboard';

        preloadSystemData({ roleName: userRole, photoUrl: res.user.photo_url });

        redirectTimerRef.current = setTimeout(() => {
          navigate(targetPath, { replace: true });
        }, LOGIN_REDIRECT_DELAY_MS);
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

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      if (isProcessingRef.current || (typeof document !== 'undefined' && document.hidden)) return;

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
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [handleCardAuthentication]);

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

  const databaseKnown = health.database !== null;
  const databaseOnline = health.database === true;
  const readerKnown = health.reader !== null;
  const readerOnline = health.reader === true;

  return (
    <div className="radar-login-container">

      <div className="radar-login-left">

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

        <div className="login-left-header" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              border: '1.5px solid rgba(56, 189, 248, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 24px rgba(56, 189, 248, 0.3)'
            }}>
              <RadarLogo size={42} animated />
            </div>
            <div>
              <div style={{
                fontSize: '24px',
                fontWeight: 900,
                letterSpacing: '0.8px',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                RADAR
                <span style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(56, 189, 248, 0.18)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#7dd3fc',
                  letterSpacing: '0.5px'
                }}>
                  v1.0
                </span>
              </div>
              <div style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>
                Control de Acceso y Gestión de Espacios
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla entera (Kiosco / Fullscreen)'}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: `1px solid ${isFullscreen ? 'rgba(56, 189, 248, 0.5)' : 'rgba(148, 163, 184, 0.25)'}`,
                color: isFullscreen ? '#38bdf8' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isFullscreen ? '0 0 14px rgba(56, 189, 248, 0.35)' : 'none'
              }}
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>

            <button
              onClick={toggleSound}
              title={soundEnabled ? 'Silenciar alertas' : 'Activar sonido'}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: `1px solid ${soundEnabled ? 'rgba(56, 189, 248, 0.4)' : 'rgba(148, 163, 184, 0.2)'}`,
                color: soundEnabled ? '#38bdf8' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: soundEnabled ? '0 0 14px rgba(56, 189, 248, 0.25)' : 'none'
              }}
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '8px 18px',
              borderRadius: '24px',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '1.5px solid rgba(56, 189, 248, 0.3)',
              fontSize: '14.5px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: '#38bdf8'
            }}>
              <span style={{
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 10px #10b981'
              }} />
              <span>{currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
            </div>
          </div>
        </div>

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

            <div style={{
              width: '100%',
              maxWidth: '560px',
              animation: 'liquidFadeInContent 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 22px',
                borderRadius: '30px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.8px',
                marginBottom: 'clamp(16px, 2.6vh, 26px)',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)'
              }}>
                <ShieldCheck size={19} />
                <span>ACCESO AUTORIZADO</span>
              </div>

              <div style={{
                position: 'relative',
                width: 'clamp(140px, 19vh, 190px)',
                height: 'clamp(140px, 19vh, 190px)',
                margin: '0 auto clamp(16px, 2.6vh, 26px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: '-10px',
                  borderRadius: '50%',
                  border: `2px solid ${isAdminRole ? '#38bdf8' : '#34d399'}`,
                  opacity: 0.85,
                  animation: 'pulseHaloGlow 2.5s ease-in-out infinite'
                }} />

                <div style={{
                  width: 'clamp(132px, 18vh, 180px)',
                  height: 'clamp(132px, 18vh, 180px)',
                  borderRadius: '50%',
                  backgroundColor: '#0b193d',
                  border: `4px solid ${isAdminRole ? '#38bdf8' : '#34d399'}`,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 40px ${isAdminRole ? 'rgba(56, 189, 248, 0.4)' : 'rgba(52, 211, 153, 0.4)'}`
                }}>
                  {authorizedUser.photo_url ? (
                    <img
                      src={authorizedUser.photo_url}
                      alt={authorizedUser.first_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      fontSize: '56px',
                      fontWeight: 800,
                      color: isAdminRole ? '#38bdf8' : '#34d399'
                    }}>
                      {initials}
                    </div>
                  )}
                </div>
              </div>

              <h2 style={{
                fontSize: 'clamp(26px, 3.6vh, 36px)',
                fontWeight: 800,
                color: '#ffffff',
                margin: '0 0 10px',
                letterSpacing: '-0.6px',
                lineHeight: 1.15
              }}>
                {authorizedUser.first_name} {authorizedUser.last_name}
              </h2>

              <div style={{
                display: 'inline-block',
                padding: '7px 20px',
                borderRadius: '8px',
                backgroundColor: isAdminRole ? 'rgba(56, 189, 248, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                border: `1px solid ${isAdminRole ? 'rgba(56, 189, 248, 0.35)' : 'rgba(52, 211, 153, 0.35)'}`,
                color: isAdminRole ? '#38bdf8' : '#34d399',
                fontSize: 'clamp(13px, 1.8vh, 15px)',
                fontWeight: 700,
                marginBottom: 'clamp(16px, 2.4vh, 24px)'
              }}>
                {authorizedUser.role?.display_name || 'Usuario Autorizado'}
              </div>

              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '16px',
                padding: 'clamp(15px, 2.2vh, 22px) clamp(20px, 2vw, 26px)',
                textAlign: 'left',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'clamp(12px, 1.8vh, 18px) clamp(18px, 2vw, 24px)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                marginBottom: 'clamp(16px, 2.2vh, 22px)'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>
                    Documento
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>
                    {authorizedUser.document_id || '—'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>
                    Tarjeta RFID
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    {authorizedUser.rfid_tag || lastScannedUid}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>
                    Hora de Ingreso
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 600, color: '#f1f5f9' }}>
                    {entryTimestamp ? entryTimestamp.toLocaleTimeString('es-CO') : 'Ahora'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>
                    Programa / Facultad
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 600, color: '#f1f5f9' }}>
                    {authorizedUser.program || 'General'}
                  </div>
                </div>
              </div>

              <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', height: '5px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  backgroundColor: '#38bdf8',
                  borderRadius: '4px',
                  width: '100%',
                  animation: 'shimmerGleam 2.4s linear infinite'
                }} />
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '10px' }}>
                Cargando datos del sistema...
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                className="radar-hero-wrapper"
                style={{
                  position: 'relative',
                  width: 'clamp(280px, 46vh, 480px)',
                  height: 'clamp(280px, 46vh, 480px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 'clamp(18px, 3vh, 32px)'
                }}
              >
                <div style={{
                  position: 'absolute',
                  inset: '-20px',
                  borderRadius: '50%',
                  border: '2px solid rgba(56, 189, 248, 0.28)',
                  animation: 'pulseHaloGlow 4s ease-in-out infinite'
                }} />
                <div style={{
                  position: 'absolute',
                  inset: '-44px',
                  borderRadius: '50%',
                  border: '2px dashed rgba(56, 189, 248, 0.18)',
                  animation: 'radarSweepSpin 20s linear infinite'
                }} />

                <RadarLogo size={460} animated className="login-hero-logo" style={{ width: '100%', height: '100%' }} />
              </div>

              <div className="login-status-chips" style={{
                display: 'flex',
                gap: '14px',
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}>
                <div className="login-status-chip" style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  backgroundColor: databaseKnown && databaseOnline
                    ? 'rgba(16, 185, 129, 0.16)'
                    : databaseKnown
                    ? 'rgba(239, 68, 68, 0.16)'
                    : 'rgba(15, 23, 42, 0.7)',
                  border: `1.5px solid ${
                    databaseKnown && databaseOnline
                      ? 'rgba(16, 185, 129, 0.5)'
                      : databaseKnown
                      ? 'rgba(239, 68, 68, 0.5)'
                      : 'rgba(148, 163, 184, 0.3)'
                  }`,
                  fontSize: '15.5px',
                  color: '#94a3b8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: databaseKnown && databaseOnline ? '#10b981' : databaseKnown ? '#ef4444' : '#64748b',
                    boxShadow: databaseKnown && databaseOnline
                      ? '0 0 10px #10b981'
                      : databaseKnown
                      ? '0 0 10px rgba(239, 68, 68, 0.7)'
                      : 'none'
                  }} />
                  PostgreSQL:{' '}
                  <strong style={{
                    fontSize: '16px',
                    color: databaseKnown && databaseOnline ? '#34d399' : databaseKnown ? '#f87171' : '#94a3b8'
                  }}>
                    {databaseKnown ? (databaseOnline ? 'Conectado' : 'Desconectado') : 'Verificando...'}
                  </strong>
                </div>

                <div className="login-status-chip" style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  backgroundColor: readerKnown && readerOnline
                    ? 'rgba(16, 185, 129, 0.16)'
                    : readerKnown
                    ? 'rgba(239, 68, 68, 0.16)'
                    : 'rgba(15, 23, 42, 0.7)',
                  border: `1.5px solid ${
                    readerKnown && readerOnline
                      ? 'rgba(16, 185, 129, 0.5)'
                      : readerKnown
                      ? 'rgba(239, 68, 68, 0.5)'
                      : 'rgba(148, 163, 184, 0.3)'
                  }`,
                  fontSize: '15.5px',
                  color: '#94a3b8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: readerKnown && readerOnline ? '#10b981' : readerKnown ? '#ef4444' : '#64748b',
                    boxShadow: readerKnown && readerOnline
                      ? '0 0 10px #10b981'
                      : readerKnown
                      ? '0 0 10px rgba(239, 68, 68, 0.7)'
                      : 'none'
                  }} />
                  Lector:{' '}
                  <strong style={{
                    fontSize: '16px',
                    color: readerKnown && readerOnline ? '#34d399' : readerKnown ? '#f87171' : '#94a3b8'
                  }}>
                    {readerKnown ? (readerOnline ? 'RC522 Activo' : 'Desconectado') : 'Verificando...'}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative', zIndex: 20 }}>
          <h1 style={{
            fontSize: 'clamp(36px, 5.2vh, 52px)',
            fontWeight: 900,
            letterSpacing: '0.8px',
            color: '#38bdf8',
            margin: '0 0 6px',
            textShadow: '0 0 25px rgba(56, 189, 248, 0.4)'
          }}>
            RADAR
          </h1>
          <p style={{
            fontSize: 'clamp(14.5px, 2vh, 18px)',
            fontWeight: 500,
            color: '#cbd5e1',
            margin: 0,
            maxWidth: '560px',
            lineHeight: 1.45
          }}>
            Sistema Institucional de Control de Acceso y Gestión de Espacios Físicos.
          </p>
        </div>
      </div>

      <div className="radar-login-right">

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '18px'
        }}>
          <div>
            <div style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
              Terminal de Ingreso
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px', marginTop: '2px' }}>
              Control de Acceso
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 18px',
            borderRadius: '24px',
            backgroundColor: isWsConnected ? 'rgba(16, 185, 129, 0.14)' : 'rgba(56, 189, 248, 0.14)',
            border: `1.5px solid ${isWsConnected ? 'rgba(16, 185, 129, 0.45)' : 'rgba(56, 189, 248, 0.4)'}`,
            fontSize: '14px',
            fontWeight: 700,
            color: isWsConnected ? '#34d399' : '#38bdf8'
          }}>
            <span style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: isWsConnected ? '#10b981' : '#38bdf8',
              boxShadow: `0 0 10px ${isWsConnected ? '#10b981' : '#38bdf8'}`
            }} />
            <span>{isWsConnected ? 'En línea' : 'Sincronizado'}</span>
          </div>
        </div>

        {hasValidAuthNotice && (
          <div style={{
            margin: '18px 0 0',
            padding: '14px 18px',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.14)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#fbbf24',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            lineHeight: 1.45
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle size={22} style={{ flexShrink: 0 }} />
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
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                opacity: 0.85
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 0' }}>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}>

            <div className="login-scan-pad" style={{
              position: 'relative',
              width: 'clamp(260px, 44vh, 440px)',
              height: 'clamp(260px, 44vh, 440px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'clamp(20px, 3vh, 32px)'
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: `3px solid ${status === 'error' ? 'rgba(239, 68, 68, 0.45)' : status === 'success' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(56, 189, 248, 0.45)'}`,
                animation: 'pulseHaloGlow 2.5s ease-in-out infinite'
              }} />
              <div style={{
                position: 'absolute',
                inset: '-20px',
                borderRadius: '50%',
                border: `2px dashed ${status === 'error' ? 'rgba(239, 68, 68, 0.35)' : status === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.3)'}`,
                animation: 'radarSweepSpin 12s linear infinite'
              }} />

              <div className="login-scan-core" style={{
                width: 'clamp(170px, 28vh, 280px)',
                height: 'clamp(170px, 28vh, 280px)',
                borderRadius: '50%',
                backgroundColor: status === 'error'
                  ? 'rgba(239, 68, 68, 0.18)'
                  : status === 'success'
                  ? 'rgba(16, 185, 129, 0.22)'
                  : 'rgba(15, 23, 42, 0.9)',
                border: `4px solid ${
                  status === 'error' ? '#ef4444' : status === 'success' ? '#10b981' : '#38bdf8'
                }`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: status === 'error'
                  ? '0 0 45px rgba(239, 68, 68, 0.55)'
                  : status === 'success'
                  ? '0 0 55px rgba(16, 185, 129, 0.6)'
                  : '0 0 45px rgba(56, 189, 248, 0.45)',
                transition: 'all 0.3s ease'
              }}>
                {status === 'scanning' ? (
                  <Loader2 size={88} className="spinner" style={{ color: '#38bdf8' }} />
                ) : status === 'success' ? (
                  <CheckCircle2 size={96} style={{ color: '#10b981' }} />
                ) : status === 'error' ? (
                  <XCircle size={96} style={{ color: '#ef4444' }} />
                ) : (
                  <CreditCard size={92} style={{ color: '#38bdf8' }} />
                )}
              </div>
            </div>

            <h2 className="login-status-title" style={{
              fontSize: 'clamp(32px, 5vh, 48px)',
              fontWeight: 900,
              lineHeight: 1.15,
              color: status === 'error' ? '#ef4444' : status === 'success' ? '#10b981' : '#f8fafc',
              margin: '0 auto clamp(10px, 1.6vh, 18px)',
              maxWidth: '640px',
              letterSpacing: '-0.5px',
              textWrap: 'balance'
            }}>
              {statusMessage}
            </h2>

            <p style={{
              fontSize: 'clamp(17px, 2.5vh, 22px)',
              color: '#cbd5e1',
              maxWidth: '580px',
              margin: '0 auto 20px',
              lineHeight: 1.5,
              fontWeight: 450
            }}>
              {status === 'idle' && 'Aproxime su tarjeta al lector físico o escáner USB para iniciar sesión.'}
              {status === 'scanning' && 'Validando carnet en el sistema...'}
              {status === 'success' && 'Acceso confirmado. Preparando el sistema...'}
              {status === 'error' && errorMessage}
            </p>

            {lastScannedUid && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 18px',
                borderRadius: '10px',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                border: '1.5px solid rgba(56, 189, 248, 0.35)',
                fontSize: '15px',
                fontFamily: 'var(--font-mono)',
                color: '#38bdf8'
              }}>
                <Radio size={18} style={{ color: '#38bdf8' }} />
                <span>UID Detectado: <strong>{lastScannedUid}</strong></span>
              </div>
            )}
          </div>
        </div>

        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13.5px',
            color: '#94a3b8',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={15} style={{ color: '#38bdf8' }} />
              <span>Sistema de Control de Acceso</span>
            </div>
            <span style={{ fontWeight: 600 }}>RADAR v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
