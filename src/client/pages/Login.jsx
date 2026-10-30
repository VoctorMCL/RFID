// ===================================================================
// Terminal de Autenticación RFID — Corporación Universitaria Lasallista
// Acceso 100% Exclusivo por Sensor Físico RFID (Sin campos manuales)
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
  Wifi,
  Sparkles
} from 'lucide-react';

export const Login = () => {
  const { loginWithCard, isAuthenticated, isCelador, authNotice, clearAuthNotice } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState('idle'); // 'idle' | 'scanning' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState('Aproxime su tarjeta al sensor físico para ingresar');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastScannedUid, setLastScannedUid] = useState(null);
  const [authorizedUser, setAuthorizedUser] = useState(null);

  const lastProcessedIdRef = useRef(null);
  const isProcessingRef = useRef(false);
  const audioCtxRef = useRef(null);
  const wedgeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      navigate(isCelador ? '/monitor' : '/dashboard', { replace: true });
    }
  }, [isAuthenticated, isCelador, navigate]);

  // Sonidos de confirmación y denegación por Web Audio API
  const playSound = (granted) => {
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
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // Re5
        osc.frequency.setValueAtTime(880.00, now + 0.12); // La5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220.00, now); // La3
        osc.frequency.setValueAtTime(146.83, now + 0.15); // Re3
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (e) {}
  };

  // Procesar intento de autenticación con UID de tarjeta
  const handleCardAuthentication = useCallback(async (uidRaw) => {
    if (!uidRaw || isProcessingRef.current) return;

    const cleanUid = String(uidRaw).trim().replace(/[\s:\-]/g, '').toUpperCase();
    if (cleanUid.length < 4) return;

    isProcessingRef.current = true;
    setLastScannedUid(cleanUid);
    setStatus('scanning');
    setStatusMessage(`Leyendo credencial [${cleanUid}]...`);
    setErrorMessage('');

    try {
      const res = await loginWithCard(cleanUid);

      if (res.success && res.user) {
        playSound(true);
        setStatus('success');
        setAuthorizedUser(res.user);
        setStatusMessage(`¡Bienvenido(a), ${res.user.first_name} ${res.user.last_name}!`);

        setTimeout(() => {
          const userRole = (res.user.role?.name || '').toLowerCase();
          if (userRole === 'celador' || userRole === 'security') {
            navigate('/monitor', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }, 1200);
      } else {
        playSound(false);
        setStatus('error');
        setErrorMessage(res.error || 'Tarjeta no autorizada para ingresar al sistema');
        setStatusMessage('Acceso no concedido');

        setTimeout(() => {
          setStatus('idle');
          setStatusMessage('Aproxime su tarjeta al sensor físico para ingresar');
          isProcessingRef.current = false;
        }, 3500);
      }
    } catch (err) {
      playSound(false);
      setStatus('error');
      setErrorMessage(err.message || 'Error en comunicación con el servidor');
      setStatusMessage('Fallo de conexión');

      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('Aproxime su tarjeta al sensor físico para ingresar');
        isProcessingRef.current = false;
      }, 3500);
    }
  }, [loginWithCard, navigate]);

  // 1. Escuchar eventos de escaneo físico en vivo por WebSocket
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

  // 2. Polling de contingencia para lector físico (en caso de red sin WebSockets continuos)
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

  // 3. Soporte físico universal: Detectar lectores RFID USB tipo teclado (teclado cuña)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar teclas modificadoras
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      // Los lectores USB tipean caracteres con < 50ms de intervalo
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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Luces de fondo ambientales */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: status === 'error'
          ? 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)'
          : status === 'success'
          ? 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
        transition: 'all 0.5s ease'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Encabezado Institucional RADAR */}
        <div style={{
          padding: '30px 28px 22px',
          textAlign: 'center',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'rgba(255,255,255,0.01)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            backgroundColor: 'rgba(30, 58, 138, 0.25)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 0 25px rgba(56, 189, 248, 0.2)'
          }}>
            <RadarLogo size={46} animated />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#38bdf8', letterSpacing: '0.8px', margin: 0 }}>
            RADAR
          </h1>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px', marginBottom: '2px' }}>
            Red de Acceso y Detección mediante Autenticación RFID
          </p>
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>
            Corporación Universitaria Lasallista — Caldas, Antioquia
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '14px',
            padding: '4px 10px',
            borderRadius: '20px',
            backgroundColor: isWsConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
            border: `1px solid ${isWsConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
            fontSize: '11px',
            color: isWsConnected ? '#10b981' : '#3b82f6',
            fontWeight: 600
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isWsConnected ? '#10b981' : '#3b82f6',
              boxShadow: `0 0 8px ${isWsConnected ? '#10b981' : '#3b82f6'}`
            }} />
            {isWsConnected ? 'Sensor en línea (WebSocket Activo)' : 'Sensor en escucha (Sincronización activa)'}
          </div>
        </div>

        {/* Notificación de Seguridad (Expiración o Sesión abierta en otro dispositivo) */}
        {authNotice && (
          <div style={{
            margin: '18px 24px 0',
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#f59e0b',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            lineHeight: 1.4
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>{authNotice}</div>
          </div>
        )}

        {/* Cuerpo del Radar y Sensor Físico */}
        <div style={{ padding: '36px 28px', textAlign: 'center' }}>
          {/* Círculo animado de radiofrecuencia (RFID) */}
          <div style={{
            position: 'relative',
            width: '180px',
            height: '180px',
            margin: '0 auto 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Ondas concéntricas de pulso */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px solid ${status === 'error' ? 'rgba(239,68,68,0.3)' : status === 'success' ? 'rgba(16,185,129,0.3)' : 'var(--accent)'}`,
              opacity: status === 'scanning' ? 1 : 0.4,
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }} />

            <div style={{
              position: 'absolute',
              inset: '-15px',
              borderRadius: '50%',
              border: `1px dashed ${status === 'error' ? 'rgba(239,68,68,0.2)' : status === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(37,99,235,0.3)'}`,
              animation: 'spin 14s linear infinite'
            }} />

            {/* Núcleo de la antena */}
            <div style={{
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              backgroundColor: status === 'error'
                ? 'rgba(239,68,68,0.15)'
                : status === 'success'
                ? 'rgba(16,185,129,0.18)'
                : 'var(--bg-tertiary)',
              border: `2px solid ${
                status === 'error'
                  ? '#ef4444'
                  : status === 'success'
                  ? '#10b981'
                  : 'var(--accent)'
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: status === 'error'
                ? '0 0 25px rgba(239,68,68,0.35)'
                : status === 'success'
                ? '0 0 30px rgba(16,185,129,0.45)'
                : '0 0 25px rgba(37,99,235,0.25)',
              transition: 'all 0.3s ease'
            }}>
              {status === 'scanning' ? (
                <Loader2 size={46} className="spinner" style={{ color: 'var(--accent)' }} />
              ) : status === 'success' ? (
                <CheckCircle2 size={50} style={{ color: '#10b981' }} />
              ) : status === 'error' ? (
                <XCircle size={50} style={{ color: '#ef4444' }} />
              ) : (
                <RadarLogo size={58} animated />
              )}
            </div>
          </div>

          {/* Estado en vivo */}
          <div style={{
            fontSize: '16px',
            fontWeight: 700,
            color: status === 'error' ? '#ef4444' : status === 'success' ? '#10b981' : 'var(--text-primary)',
            marginBottom: '8px'
          }}>
            {statusMessage}
          </div>

          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            maxWidth: '340px',
            margin: '0 auto 18px',
            lineHeight: 1.5
          }}>
            {status === 'idle' && 'Terminal configurada para lectura física en tiempo real. Pase su carnet por el lector RFID de la estación.'}
            {status === 'scanning' && 'Validando permisos institucionales y credenciales en base de datos PostgreSQL...'}
            {status === 'success' && authorizedUser && `Acceso concedido para rol ${authorizedUser.role?.display_name || 'Operador'}. Ingresando al entorno...`}
            {status === 'error' && (errorMessage || 'Credencial denegada.')}
          </p>

          {/* Información de Tarjeta Detectada */}
          {lastScannedUid && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)'
            }}>
              <Radio size={14} style={{ color: 'var(--accent)' }} />
              <span>UID Físico: <strong>{lastScannedUid}</strong></span>
            </div>
          )}
        </div>

        {/* Pie de Página */}
        <div style={{
          padding: '16px 24px',
          backgroundColor: 'var(--bg-tertiary)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11.5px',
          color: 'var(--text-dim)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={12} />
            <span>Sesión única por estación (4h)</span>
          </div>
          <span>v2.4 — Hardware MFRC522</span>
        </div>
      </div>
    </div>
  );
};
