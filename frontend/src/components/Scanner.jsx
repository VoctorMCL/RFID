import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  User,
  AlertTriangle,
  Play
} from 'lucide-react';
import {
  normUid,
  colorFromString,
  getInitials,
  playAccessSound,
  triggerHapticFeedback,
  sbInsert
} from '../services/supabase';

export default function Scanner({
  personas,
  tarjetas,
  torniquetes,
  currentTorniquete,
  setCurrentTorniquete,
  lastScan,
  setLastScan
}) {
  const [isVibrating, setIsVibrating] = useState(false);
  const timerRef = useRef(null);

  // Cada vez que cambia lastScan
  useEffect(() => {
    if (!lastScan) {
      setIsVibrating(false);
      return;
    }

    if (!lastScan.ok) {
      // Disparar animación de vibración en errores
      setIsVibrating(false);
      setTimeout(() => setIsVibrating(true), 10);
      playAccessSound(false);
      triggerHapticFeedback(true);
    } else {
      setIsVibrating(false);
      playAccessSound(true);
      triggerHapticFeedback(false);
    }

    // Mantener en pantalla 5 segundos para que el celador valide visualmente
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLastScan(null);
      setIsVibrating(false);
    }, 5000);

    return () => clearTimeout(timerRef.current);
  }, [lastScan, setLastScan]);

  // Función de simulación para pruebas interactivas
  const simulateScan = async (tipoSimulacion) => {
    let uid = 'A1B2C3D4';
    let motivo = 'permitido';

    if (tipoSimulacion === 'valido_victor') {
      const t = tarjetas.find((x) => x.activa && x.id_persona);
      uid = t ? t.uid : 'A1B2C3D4';
    } else if (tipoSimulacion === 'revocada') {
      const t = tarjetas.find((x) => !x.activa);
      uid = t ? t.uid : '99887766';
      motivo = 'denegado_revocada';
    } else if (tipoSimulacion === 'desconocida') {
      uid = 'FF' + Math.floor(Math.random() * 899999 + 100000);
      motivo = 'denegado_no_registrado';
    } else if (tipoSimulacion === 'expirada') {
      uid = '55667788';
      motivo = 'denegado_expirada';
    }

    // Buscar tarjeta y persona
    const tarjeta = tarjetas.find((t) => normUid(t.uid) === normUid(uid));
    let persona = null;
    let ok = false;
    let resultado = motivo;

    if (tarjeta && tarjeta.id_persona) {
      persona = personas.find((p) => p.id_persona === tarjeta.id_persona);
      if (!tarjeta.activa) {
        ok = false;
        resultado = 'denegado_revocada';
      } else if (persona && persona.fecha_expiracion && new Date(persona.fecha_expiracion) < new Date()) {
        ok = false;
        resultado = 'denegado_expirada';
      } else {
        ok = true;
        resultado = 'permitido';
      }
    } else {
      ok = false;
      resultado = 'denegado_no_registrado';
    }

    // Registrar en Supabase
    try {
      await sbInsert('accesos', {
        uid_leido: uid,
        id_tarjeta: tarjeta ? tarjeta.id_tarjeta : null,
        id_torniquete: currentTorniquete,
        resultado: resultado,
        tiempo_respuesta_ms: Math.floor(Math.random() * 80 + 80)
      });
    } catch (e) {
      console.warn('Simulación local registrada sin red:', e);
    }

    setLastScan({
      ok,
      acceso: {
        resultado,
        uid_leido: uid,
        fecha_hora: new Date().toISOString()
      },
      persona,
      tarjeta
    });
  };

  const formatHora = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return '';
    }
  };

  const getMotivoLabel = (res) => {
    switch (res) {
      case 'denegado_no_registrado':
        return 'Tarjeta no registrada en el sistema';
      case 'denegado_revocada':
      case 'denegado_revocado':
        return 'Tarjeta revocada / reportada por extravío';
      case 'denegado_expirada':
        return 'Pase temporal de visitante vencido';
      case 'denegado_inactivo':
        return 'Titular inactivo en la institución';
      default:
        return 'Acceso no autorizado';
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '20px' }}>
      {/* Panel Principal del Escáner y Validación Visual */}
      <div>
        <div
          className={`scan-stage ${lastScan ? (lastScan.ok ? 'state-ok' : 'state-fail') : ''} ${isVibrating ? 'vibrate-error' : ''}`}
          style={{
            background: lastScan
              ? lastScan.ok
                ? 'var(--ok-soft)'
                : 'var(--danger-soft)'
              : 'var(--bg-card)',
            border: `2px solid ${
              lastScan
                ? lastScan.ok
                  ? 'var(--ok)'
                  : 'var(--danger)'
                : 'var(--border)'
            }`,
            borderRadius: '16px',
            minHeight: '460px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '30px',
            position: 'relative',
            boxShadow: 'var(--card-shadow)',
            transition: 'background 0.3s ease, border-color 0.3s ease'
          }}
        >
          {!lastScan ? (
            /* Estado de Espera */
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: 'var(--bg-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  border: '1px dashed var(--border)'
                }}
              >
                <Radio size={42} style={{ color: 'var(--text-dim)' }} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
                Esperando tarjeta RFID/NFC
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '380px', margin: '0 auto' }}>
                Acerca el carnet estudiantil al lector RC522 en la estación CrowPi 3 o usa los botones de simulación.
              </p>
            </div>
          ) : lastScan.ok ? (
            /* Estado Acceso Permitido */
            <div style={{ textAlign: 'center', width: '100%', maxWidth: '440px' }}>
              <div
                style={{
                  background: 'var(--ok)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  letterSpacing: '1px',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '20px'
                }}
              >
                <CheckCircle2 size={16} /> ACCESO PERMITIDO
              </div>

              {/* Fotografía de Validación Visual */}
              <div style={{ position: 'relative', width: '150px', height: '150px', margin: '0 auto 16px' }}>
                {lastScan.persona?.foto_path ? (
                  <img
                    src={lastScan.persona.foto_path}
                    alt="Foto del titular"
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '4px solid var(--ok)',
                      boxShadow: '0 8px 16px rgba(22, 163, 74, 0.25)'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: colorFromString(lastScan.persona?.documento_identidad || 'A'),
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '44px',
                      fontWeight: 800,
                      border: '4px solid var(--ok)'
                    }}
                  >
                    {getInitials(lastScan.persona?.nombre, lastScan.persona?.apellido)}
                  </div>
                )}
              </div>

              <span className="pill pill-info" style={{ marginBottom: '8px' }}>
                {lastScan.persona?.tipo_persona || 'Estudiante'}
              </span>

              <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px' }}>
                {lastScan.persona
                  ? `${lastScan.persona.nombre} ${lastScan.persona.apellido}`
                  : 'Usuario Autorizado'}
              </h2>

              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--text-muted)', marginTop: '4px' }}>
                CC {lastScan.persona?.documento_identidad || '—'} • {lastScan.persona?.programa || 'Comunidad Lasallista'}
              </p>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '16px',
                  color: 'var(--text-dim)',
                  fontSize: '13px'
                }}
              >
                <Clock size={14} /> {formatHora(lastScan.acceso?.fecha_hora)}
              </div>
            </div>
          ) : (
            /* Estado Acceso Denegado (CON ANIMACIÓN DE VIBRACIÓN) */
            <div
              style={{
                textAlign: 'center',
                width: '100%',
                maxWidth: '440px'
              }}
            >
              <div
                className="status-banner fail"
                style={{
                  background: 'var(--danger)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  letterSpacing: '1px',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '20px'
                }}
              >
                <XCircle size={16} /> ACCESO DENEGADO
              </div>

              {/* Ícono grande Denegado que vibra */}
              <div
                className="denied-icon-wrap big"
                style={{
                  width: '110px',
                  height: '110px',
                  borderRadius: '50%',
                  background: 'var(--danger-soft)',
                  border: '3px solid var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: 'var(--danger)'
                }}
              >
                <ShieldAlert size={56} />
              </div>

              <h2
                className="verdict fail"
                style={{
                  fontSize: '38px',
                  fontWeight: 900,
                  color: 'var(--danger)',
                  letterSpacing: '2px'
                }}
              >
                DENEGADO
              </h2>

              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginTop: '14px',
                  display: 'inline-block'
                }}
              >
                <span
                  style={{
                    color: 'var(--danger)',
                    fontWeight: 700,
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <AlertTriangle size={15} /> {getMotivoLabel(lastScan.acceso?.resultado)}
                </span>
                {lastScan.acceso?.uid_leido && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--text-dim)',
                      display: 'block',
                      marginTop: '4px'
                    }}
                  >
                    UID: {lastScan.acceso.uid_leido}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '16px',
                  color: 'var(--text-dim)',
                  fontSize: '13px'
                }}
              >
                <Clock size={14} /> {formatHora(lastScan.acceso?.fecha_hora)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panel Lateral: Selector de Torniquete y Simulador de Tarjetas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Punto de Acceso Activo */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Punto de Acceso</h3>
          <div className="field-group">
            <label className="field-label">Torniquete Activo</label>
            <select
              value={currentTorniquete || ''}
              onChange={(e) => setCurrentTorniquete(Number(e.target.value))}
            >
              {torniquetes.map((t) => (
                <option key={t.id_torniquete} value={t.id_torniquete}>
                  {t.nombre} ({t.ubicacion})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lector de Hardware */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'var(--ok)',
                boxShadow: '0 0 8px var(--ok)'
              }}
            />
            <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Lector CrowPi 3 · RC522</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', lineHeight: 1.5 }}>
            El lector físico en la Raspberry Pi 5 valida por SPI contra Supabase. El resultado se refleja aquí en &lt; 3 s.
          </p>
        </div>

        {/* Simulador Interactivo con Vibración en Errores */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Play size={15} style={{ color: 'var(--accent)' }} /> Simular Tarjeta RFID
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' }}>
            Prueba la validación visual y las <b>animaciones de vibración</b> al instante:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="btn btn-outline btn-sm"
              style={{ justifyContent: 'flex-start', color: 'var(--ok)', borderColor: 'var(--ok-soft)' }}
              onClick={() => simulateScan('valido_victor')}
            >
              <CheckCircle2 size={14} /> Tarjeta Válida (Estudiante)
            </button>
            <button
              className="btn btn-outline btn-sm"
              style={{ justifyContent: 'flex-start', color: 'var(--danger)', borderColor: 'var(--danger-soft)' }}
              onClick={() => simulateScan('revocada')}
            >
              <XCircle size={14} /> Tarjeta Revocada (Vibra)
            </button>
            <button
              className="btn btn-outline btn-sm"
              style={{ justifyContent: 'flex-start', color: 'var(--danger)', borderColor: 'var(--danger-soft)' }}
              onClick={() => simulateScan('desconocida')}
            >
              <ShieldAlert size={14} /> Tarjeta Desconocida (Vibra)
            </button>
            <button
              className="btn btn-outline btn-sm"
              style={{ justifyContent: 'flex-start', color: 'var(--warning)', borderColor: 'var(--warning-soft)' }}
              onClick={() => simulateScan('expirada')}
            >
              <AlertTriangle size={14} /> Visitante Expirado (Vibra)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
