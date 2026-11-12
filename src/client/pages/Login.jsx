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

  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('rfid_sound_enabled') !== 'false');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(timer);
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

  const healthItems = [
    {
      key: 'db',
      label: 'Base de datos',
      value: databaseKnown ? (databaseOnline ? 'En línea' : 'Sin conexión') : 'Verificando',
      state: databaseKnown ? (databaseOnline ? 'ok' : 'bad') : 'unknown'
    },
    {
      key: 'reader',
      label: 'Lector',
      value: readerKnown ? (readerOnline ? 'RC522' : 'Sin señal') : 'Verificando',
      state: readerKnown ? (readerOnline ? 'ok' : 'bad') : 'unknown'
    }
  ];

  const eyebrow =
    status === 'scanning'
      ? 'Verificando credencial'
      : status === 'error'
      ? 'Acceso denegado'
      : 'Terminal RFID · Esperando lectura';

  const subtitle =
    status === 'scanning'
      ? 'Comprobando credenciales y permisos en el sistema…'
      : status === 'error'
      ? errorMessage
      : 'Aproxime el carnet al lector físico o use el escáner USB. La validación es inmediata.';

  const clockDate = clock.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="login-shell" data-status={status}>

      {/* ───────────────────────── Terminal RFID (izquierda) ───────────────────────── */}
      <section className="login-terminal" aria-label="Terminal de ingreso RFID">

        <header className="login-terminal-head">
          <div className="login-brand">
            <div className="login-brand-mark">
              <RadarLogo size={26} animated />
            </div>
            <div className="login-brand-text">
              <span className="login-brand-name">RADAR</span>
              <span className="login-brand-sub">Control de acceso</span>
            </div>
          </div>

          <div className="login-head-actions">
            <button
              type="button"
              className={`login-icon-btn ${soundEnabled ? 'is-on' : ''}`}
              onClick={toggleSound}
              title={soundEnabled ? 'Silenciar alertas' : 'Activar sonido'}
              aria-label={soundEnabled ? 'Silenciar alertas' : 'Activar sonido'}
            >
              {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>

            <button
              type="button"
              className={`login-icon-btn ${isFullscreen ? 'is-on' : ''}`}
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa (kiosco)'}
              aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          </div>
        </header>

        {hasValidAuthNotice && (
          <div className="login-notice" role="alert">
            <AlertTriangle size={17} />
            <span>{authNotice}</span>
            <button
              type="button"
              className="login-notice-close"
              onClick={clearAuthNotice}
              aria-label="Cerrar aviso"
              title="Cerrar aviso"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <main className="login-stage">
          {status === 'success' && authorizedUser ? (

            <div className="login-success">
              <div className="login-success-badge">
                <ShieldCheck size={15} />
                <span>Acceso autorizado</span>
              </div>

              <div className={`login-success-avatar ${isAdminRole ? 'is-admin' : ''}`}>
                {authorizedUser.photo_url ? (
                  <img src={authorizedUser.photo_url} alt={`${authorizedUser.first_name} ${authorizedUser.last_name}`} />
                ) : (
                  <span>{initials}</span>
                )}
                <CheckCircle2 size={22} className="login-success-check" />
              </div>

              <div className="login-success-identity">
                <h2 className="login-success-name">
                  {authorizedUser.first_name} {authorizedUser.last_name}
                </h2>
                <span className="login-success-role">
                  {authorizedUser.role?.display_name || 'Usuario autorizado'}
                </span>
              </div>

              <dl className="login-success-meta">
                <div>
                  <dt>Documento</dt>
                  <dd>{authorizedUser.document_id || '—'}</dd>
                </div>
                <div>
                  <dt>Tarjeta RFID</dt>
                  <dd className="is-accent">{authorizedUser.rfid_tag || lastScannedUid}</dd>
                </div>
                <div>
                  <dt>Hora de ingreso</dt>
                  <dd>{entryTimestamp ? entryTimestamp.toLocaleTimeString('es-CO') : 'Ahora'}</dd>
                </div>
                <div>
                  <dt>Programa</dt>
                  <dd>{authorizedUser.program || 'General'}</dd>
                </div>
              </dl>

              <div className="login-success-progress">
                <span />
              </div>
              <p className="login-success-hint">Cargando datos del sistema…</p>
            </div>

          ) : (

            <>
              <div className="login-reader" aria-hidden="true">
                <div className="login-reader-halo" />
                <div className="login-reader-ticks" />
                <div className="login-reader-sweep" />
                <div className="login-reader-ring" />
                <div className="login-reader-core">
                  <span className="login-reader-scanline" />
                  {status === 'scanning' ? (
                    <Loader2 className="login-spin" size={64} />
                  ) : status === 'error' ? (
                    <XCircle size={64} />
                  ) : (
                    <CreditCard size={64} />
                  )}
                </div>
              </div>

              <div className="login-status" role="status" aria-live="polite">
                <span className="login-eyebrow">
                  <span className="login-eyebrow-dot" />
                  {eyebrow}
                </span>
                <h1 className="login-title">{statusMessage}</h1>
                <p className="login-sub">{subtitle}</p>

                {lastScannedUid && (
                  <span className="login-uid">
                    <Radio size={13} />
                    UID <strong>{lastScannedUid}</strong>
                  </span>
                )}
              </div>

              <ol className="login-steps">
                <li className="login-step">
                  <span className="login-step-num">1</span>
                  Acerque el carnet
                </li>
                <li className="login-step-sep" aria-hidden="true" />
                <li className="login-step">
                  <span className="login-step-num">2</span>
                  Validación automática
                </li>
                <li className="login-step-sep" aria-hidden="true" />
                <li className="login-step">
                  <span className="login-step-num">3</span>
                  Ingreso al sistema
                </li>
              </ol>
            </>
          )}
        </main>

        <footer className="login-terminal-foot">
          <div className="login-health">
            {healthItems.map(item => (
              <span key={item.key} className={`login-health-chip is-${item.state}`}>
                <span className="login-health-dot" />
                <span className="login-health-label">{item.label}</span>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>
          <span className="login-foot-version">RADAR v1.0</span>
        </footer>
      </section>

      {/* ───────────────────────── Panel de marca (derecha) ───────────────────────── */}
      <aside className="login-showcase" aria-hidden="true">
        <div className="login-showcase-head">
          <span className="login-showcase-pill">Acceso institucional</span>
          <span className="login-showcase-org">Corporación Universitaria Lasallista</span>
        </div>

        <div className="login-orbit">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="login-showcase-center">
          <div className="login-showcase-mark">
            <RadarLogo size={160} animated />
          </div>
          <h2 className="login-showcase-wordmark">RADAR</h2>
          <p className="login-showcase-acronym">
            Red de Acceso y Detección mediante Autenticación RFID
          </p>
          <span className="login-showcase-divider" />
          <p className="login-showcase-desc">
            Identificación por radiofrecuencia para el control de acceso institucional.
          </p>
        </div>

        <div className="login-showcase-foot">
          <div className="login-showcase-status">
            <span className={`login-showcase-dot ${isWsConnected ? 'is-ok' : 'is-bad'}`} />
            <span>{isWsConnected ? 'Sistema en línea' : 'Reconectando…'}</span>
          </div>
          <div className="login-clock">
            <span className="login-clock-date">{clockDate}</span>
          </div>
        </div>
      </aside>
    </div>
  );
};
