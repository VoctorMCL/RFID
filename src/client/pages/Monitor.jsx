import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  Radio,
  XCircle,
  Clock,
  DoorClosed,
  Volume2,
  VolumeX,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react';

const ENTRANCE_NAME = 'Ingreso a la Universidad';

const isEntranceDoor = (door) => {
  const label = `${door.room_name || ''} ${door.name || ''}`.toLowerCase();
  return label.includes(ENTRANCE_NAME.toLowerCase());
};

export const Monitor = () => {
  const [doors, setDoors] = useState([]);
  const [selectedDoorId, setSelectedDoorId] = useState('');
  const [lastScan, setLastScan] = useState(null);
  const [liveStream, setLiveStream] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVibrating, setIsVibrating] = useState(false);

  const [hardwareSensors, setHardwareSensors] = useState({});

  const resetTimerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const lastSeenLogIdRef = useRef(null);
  const seenScanKeysRef = useRef(new Set());
  const keyBufferRef = useRef('');
  const lastKeyTimeRef = useRef(Date.now());

  const playBeep = (granted) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      if (granted) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880.00, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(220.00, now);
        gain1.gain.setValueAtTime(0.14, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc1.start(now);
        osc1.stop(now + 0.15);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(164.81, now + 0.19);
        gain2.gain.setValueAtTime(0.0001, now);
        gain2.gain.linearRampToValueAtTime(0.12, now + 0.20);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc2.start(now + 0.19);
        osc2.stop(now + 0.35);

        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.type = 'sawtooth';
        osc3.frequency.setValueAtTime(130.81, now + 0.38);
        gain3.gain.setValueAtTime(0.0001, now);
        gain3.gain.linearRampToValueAtTime(0.10, now + 0.39);
        gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc3.start(now + 0.38);
        osc3.stop(now + 0.55);
      }
    } catch (e) {
      console.warn('Audio no disponible:', e);
    }
  };

  const handleScanResult = (result) => {
    const logId = result.logId ?? result.id;
    const scanKey = logId !== undefined && logId !== null
      ? `log:${logId}`
      : `scan:${result.uid || result.rfid_uid_raw || ''}:${result.timestamp || ''}:${result.door?.id ?? result.door_id ?? ''}`;

    if (scanKey && seenScanKeysRef.current.has(scanKey)) return;
    if (scanKey) {
      seenScanKeysRef.current.add(scanKey);
      if (seenScanKeysRef.current.size > 500) {
        const oldest = seenScanKeysRef.current.values().next().value;
        seenScanKeysRef.current.delete(oldest);
      }
    }

    setLastScan(result);
    playBeep(result.granted);

    if (result.door?.id) {
      setHardwareSensors(prev => ({ ...prev, [result.door.id]: true }));
    }

    if (!result.granted) {
      setIsVibrating(false);
      setTimeout(() => setIsVibrating(true), 15);

      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate([120, 60, 120, 60, 200]);
        } catch (e) {}
      }
    } else {
      setIsVibrating(false);
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate(80);
        } catch (e) {}
      }
    }

    setLiveStream(prev => [
      {
        id: scanKey || Date.now(),
        timestamp: result.timestamp || new Date().toISOString(),
        ...result
      },
      ...prev.slice(0, 19)
    ]);

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setLastScan(null);
      setIsVibrating(false);
    }, 6000);
  };

  const handleWsEvent = (event) => {
    if (event.type === 'access_attempt') {
      const data = event.data;
      const wsLogId = data.logId ?? data.id;
      if (wsLogId !== undefined && wsLogId !== null) {
        const prev = Number(lastSeenLogIdRef.current);
        const next = Number(wsLogId);
        if (!Number.isFinite(prev) || !Number.isFinite(next) || next > prev) {
          lastSeenLogIdRef.current = wsLogId;
        }
      }
      const doorId = data.door?.id || (data.door ? parseInt(data.door.id, 10) : null);
      if (doorId) {
        setHardwareSensors(prev => ({ ...prev, [doorId]: true }));
      }
      handleScanResult({
        id: data.logId ?? data.id,
        logId: data.logId ?? data.id,
        granted: data.granted,
        denial_reason: data.denialReason || data.denial_reason,
        timestamp: data.timestamp,
        uid: data.uid,
        user: data.user ? {
          first_name: data.user.name?.split(' ')[0] || '',
          last_name: data.user.name?.split(' ').slice(1).join(' ') || '',
          document_id: data.user.document_id,
          program: data.user.program,
          role: data.user.role
        } : null,
        door: data.door,
        room: data.room,
        alarm_triggered: data.alarmTriggered
      });
    }

    if (event.type === 'hardware_heartbeat' || event.type === 'door_status') {
      const doorId = event.data?.doorId || (event.data?.door?.id);
      if (doorId) {
        setHardwareSensors(prev => ({ ...prev, [doorId]: true }));
      }
    }
  };

  const { isConnected: isWsConnected } = useWebSocket(handleWsEvent);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) {
        return;
      }

      const now = Date.now();
      if (now - lastKeyTimeRef.current > 400) {
        keyBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const rawUid = keyBufferRef.current.trim().toUpperCase();
        keyBufferRef.current = '';
        const fallbackDoor = doors.find(isEntranceDoor) || doors[0];
        const targetDoorId = parseInt(selectedDoorId, 10) || fallbackDoor?.id;

        if (targetDoorId && rawUid.length >= 4 && rawUid.length <= 16 && /^[0-9A-F]+$/i.test(rawUid)) {
          console.log('[RFID-USB] Lector detectado:', rawUid);
          setIsProcessing(true);
          apiClient('/access/validate', {
            method: 'POST',
            body: {
              rfid_uid: rawUid,
              door_id: targetDoorId,
              access_method: 'rfid_usb'
            }
          }).then(res => {
            if (res.success && res.data) {
              handleScanResult(res.data);
            }
          }).catch(console.error)
            .finally(() => setIsProcessing(false));
        }
      } else if (e.key && e.key.length === 1 && /^[0-9a-zA-Z]$/.test(e.key)) {
        keyBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDoorId, doors]);

  useEffect(() => {
    if (isWsConnected) return;

    let inFlight = false;
    let cancelled = false;

    const isNewerLog = (id) => {
      if (lastSeenLogIdRef.current === null) return false;
      const prev = Number(lastSeenLogIdRef.current);
      const next = Number(id);
      if (Number.isFinite(prev) && Number.isFinite(next)) return next > prev;
      return String(id) !== String(lastSeenLogIdRef.current);
    };

    const poll = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;

      try {
        const latestRes = await apiClient('/access/latest');
        if (cancelled) return;
        if (latestRes.success && latestRes.data && latestRes.data.id) {
          const scan = latestRes.data;
          if (lastSeenLogIdRef.current === null) {
            lastSeenLogIdRef.current = scan.id;
          } else if (isNewerLog(scan.id)) {
            lastSeenLogIdRef.current = scan.id;
            const scanTime = new Date(scan.timestamp).getTime();
            if (Date.now() - scanTime < 90000) {
              const doorId = scan.door?.id || scan.door_id;
              if (doorId) {
                setHardwareSensors(prev => ({ ...prev, [doorId]: true }));
              }
              handleScanResult(scan);
              return;
            }
          }
        }

        const res = await apiClient('/access/logs?limit=1');
        if (cancelled) return;
        if (res.success && res.data && res.data.length > 0) {
          const latest = res.data[0];
          if (latest.id) {
            if (lastSeenLogIdRef.current === null) {
              lastSeenLogIdRef.current = latest.id;
            } else if (isNewerLog(latest.id)) {
              lastSeenLogIdRef.current = latest.id;
              const logTime = new Date(latest.timestamp).getTime();
              if (Date.now() - logTime < 90000) {
                if (latest.door_id) {
                  setHardwareSensors(prev => ({ ...prev, [latest.door_id]: true }));
                }
                handleScanResult({
                  id: latest.id,
                  logId: latest.id,
                  granted: latest.granted,
                  denial_reason: latest.denial_reason,
                  timestamp: latest.timestamp,
                  uid: latest.rfid_uid_raw,
                  user: latest.user_name && latest.user_name !== 'Desconocido' ? {
                    first_name: latest.user_name.split(' ')[0] || '',
                    last_name: latest.user_name.split(' ').slice(1).join(' ') || '',
                    document_id: latest.user_document,
                    program: latest.user_program || '',
                    role: latest.role_name || ''
                  } : null,
                  door: { id: latest.door_id, name: latest.door_name },
                  room: { id: latest.room_id, name: latest.room_name },
                  alarm_triggered: !latest.granted && latest.room_has_alarm
                });
              }
            }
          }
        }
      } catch (err) {
      } finally {
        inFlight = false;
      }
    };

    poll();
    const interval = setInterval(poll, 280);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isWsConnected]);

  useEffect(() => {
    let isMounted = true;
    const fetchDoorsAndStatus = async () => {
      try {
        const res = await apiClient('/doors');
        if (!isMounted) return;
        if (res.success && res.data.length > 0) {
          setDoors(res.data);
          setSelectedDoorId(prev => {
            if (prev && res.data.some(d => d.id.toString() === prev)) return prev;
            const entrance = res.data.find(isEntranceDoor);
            return (entrance || res.data[0]).id.toString();
          });

          setHardwareSensors(prev => {
            const next = { ...prev };
            res.data.forEach(d => {
              next[d.id] = Boolean(d.is_hardware_active);
            });
            return next;
          });
        }

        try {
          const latestRes = await apiClient('/access/latest');
          if (!isMounted) return;
          if (latestRes.success && latestRes.data && latestRes.data.door?.id) {
            const scanTime = new Date(latestRes.data.timestamp).getTime();
            if (Date.now() - scanTime < 90000) {
              setHardwareSensors(prev => ({ ...prev, [latestRes.data.door.id]: true }));
            }
          }
        } catch (e) {}
      } catch (err) {
        console.error('Error cargando puertas:', err);
      }
    };

    fetchDoorsAndStatus();
    const interval = setInterval(fetchDoorsAndStatus, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };

    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const getReasonText = (reason) => {
    switch (reason) {
      case 'denegado_no_registrado': return 'Tarjeta no registrada en el sistema institucional';
      case 'denegado_tarjeta_inactiva': return 'Tarjeta deshabilitada o revocada por administración';
      case 'denegado_sin_usuario_asignado': return 'Tarjeta no asignada a ningún estudiante o funcionario';
      case 'denegado_usuario_inactivo': return 'Usuario suspendido temporalmente por decanatura';
      case 'denegado_acceso_expirado': return 'Vigencia de acceso institucional expirada';
      case 'denegado_area_no_autorizada': return 'Área no autorizada para el rol institucional';
      case 'denegado_horario_no_valido': return 'Fuera del horario de clases asignado en la articulación horaria';
      default: return reason || 'Acceso no permitido';
    }
  };

  const getInitials = (firstName, lastName) => {
    return `${(firstName || '?')[0]}${(lastName || '')[0]}`.toUpperCase();
  };

  const selectedDoor = doors.find(d => d.id.toString() === selectedDoorId);
  const currentDoorId = selectedDoor ? selectedDoor.id : null;
  const isSensorDetected = Boolean(
    currentDoorId && hardwareSensors[currentDoorId] ||
    selectedDoor?.is_hardware_active
  );

  const doorGroups = doors.reduce((groups, door) => {
    const block = door.block_name || 'Campus';
    if (!groups[block]) groups[block] = [];
    groups[block].push(door);
    return groups;
  }, {});

  const roomDoorCounts = doors.reduce((counts, door) => {
    counts[door.room_id] = (counts[door.room_id] || 0) + 1;
    return counts;
  }, {});

  const getDoorLabel = (door) => {
    const roomName = door.room_name || door.name;
    return roomDoorCounts[door.room_id] > 1 ? `${roomName} — ${door.name}` : roomName;
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '20px', fontWeight: 800 }}>
            Escáner RFID y Validación Visual
          </h1>
          <p className="page-subtitle" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Registro de ingresos en la entrada y espacios del campus
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="btn btn-secondary btn-sm"
            title="Activar/desactivar audio"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>{soundEnabled ? 'Audio Activado' : 'Silenciado'}</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>

        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <DoorClosed size={19} />
              </div>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <label className="form-label" htmlFor="access-destination" style={{ marginBottom: '4px' }}>
                  Salón o punto de acceso
                </label>
                <select
                  id="access-destination"
                  className="form-select"
                  value={selectedDoorId}
                  onChange={(e) => setSelectedDoorId(e.target.value)}
                  disabled={doors.length === 0}
                >
                  {selectedDoorId === '' && <option value="">Cargando espacios...</option>}
                  {Object.entries(doorGroups).map(([block, blockDoors]) => (
                    <optgroup key={block} label={block}>
                      {blockDoors.map(door => (
                        <option key={door.id} value={door.id}>{getDoorLabel(door)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div
            className={lastScan !== null && !lastScan.granted && isVibrating ? 'vibrate-error' : ''}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: `2px solid ${
                lastScan === null ? 'var(--border)' :
                lastScan.granted ? 'var(--status-ok-border)' : 'var(--status-denied-border)'
              }`,
              borderRadius: 'var(--radius-lg)',
              padding: '36px',
              minHeight: '440px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              position: 'relative',
              boxShadow: 'var(--shadow)',
              transition: 'all 0.2s ease'
            }}
          >

            {lastScan === null && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  border: '2px solid var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '18px',
                  backgroundColor: 'var(--accent-soft)'
                }}>
                  <Radio size={36} style={{ color: 'var(--accent)' }} />
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Esperando Carnet RFID
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', marginTop: '6px' }}>
                  Acerque el carnet institucional al lector físico de la puerta para registrar el ingreso.
                </p>

                <div style={{
                  marginTop: '20px',
                  padding: '6px 14px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '20px',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: isSensorDetected ? '#22c55e' : '#ef4444'
                  }} />
                  {isSensorDetected ? 'Lector activo' : 'Lector desconectado'}
                </div>
              </div>
            )}

            {lastScan !== null && lastScan.granted && (
              <div style={{ width: '100%' }}>
                <div style={{
                  padding: '12px 20px',
                  backgroundColor: 'var(--status-ok-bg)',
                  border: '1px solid var(--status-ok-border)',
                  color: 'var(--status-ok-text)',
                  borderRadius: 'var(--radius)',
                  fontWeight: 700,
                  fontSize: '15px',
                  marginBottom: '24px'
                }}>
                  Acceso Autorizado
                </div>

                <div style={{
                  width: '92px',
                  height: '92px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '2px solid var(--status-ok-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: '0 auto 16px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {getInitials(lastScan.user?.first_name, lastScan.user?.last_name)}
                </div>

                <div style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 600 }}>
                  {lastScan.user?.role || 'Personal Institucional'}
                </div>

                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {lastScan.user?.first_name} {lastScan.user?.last_name}
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Documento: {lastScan.user?.document_id} · {lastScan.user?.program || 'Sin programa'}
                </div>

                <div style={{
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  textAlign: 'left'
                }}>
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Punto de acceso</div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{lastScan.door?.name}</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Espacio / Sala</div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{lastScan.room?.name}</div>
                  </div>
                </div>
              </div>
            )}

            {lastScan !== null && !lastScan.granted && (
              <div style={{ width: '100%' }}>
                <div style={{
                  padding: '12px 20px',
                  backgroundColor: 'var(--status-denied-bg)',
                  border: '1px solid var(--status-denied-border)',
                  color: 'var(--status-denied-text)',
                  borderRadius: 'var(--radius)',
                  fontWeight: 700,
                  fontSize: '15px',
                  marginBottom: '24px'
                }}>
                  Acceso Denegado
                </div>

                <div
                  className="denied-icon-wrap"
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '2px solid var(--status-denied-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    color: 'var(--status-denied-text)'
                  }}
                >
                  <XCircle size={40} />
                </div>

                <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Restricción de Acceso
                </div>

                <div style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  maxWidth: '380px',
                  margin: '8px auto 0',
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)'
                }}>
                  {getReasonText(lastScan.denial_reason)}
                </div>

                {lastScan.alarm_triggered && (
                  <div style={{
                    marginTop: '16px',
                    padding: '10px 14px',
                    backgroundColor: 'var(--status-alert-bg)',
                    border: '1px solid var(--status-alert-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    color: 'var(--status-alert-text)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertTriangle size={16} />
                    <span>Alarma crítica disparada: apertura en sala asegurada. Solo deshabilitable desde el cuarto de control.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: '16px',
              padding: '14px 18px',
              backgroundColor: 'var(--bg-card)',
              border: `1px solid ${isSensorDetected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: isSensorDetected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `2px solid ${isSensorDetected ? '#22c55e' : '#ef4444'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isSensorDetected ? '#22c55e' : '#ef4444'
                }}
              >
                {isSensorDetected ? <Wifi size={18} /> : <WifiOff size={18} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: isSensorDetected ? '#22c55e' : '#ef4444',
                      boxShadow: isSensorDetected ? '0 0 8px #22c55e' : '0 0 8px #ef4444'
                    }}
                  />
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {isSensorDetected
                      ? 'Sensor RFID (CrowPi 3 · RC522) — Conectado y Confirmado'
                      : 'Sensor RFID (CrowPi 3 · RC522) — Esperando Lectura en Puerta'}
                  </h4>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {isSensorDetected
                    ? 'Hardware MFRC522 enlazado por SPI a 13.56 MHz en esta puerta. Captura lista.'
                    : 'Esperando señal del lector de tarjetas en esta puerta.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '680px' }}>
          <div className="card-header">
            <div className="card-title">
              <Clock size={18} />
              <span>Flujo de Accesos en Vivo</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{liveStream.length} eventos</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {liveStream.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                Esperando eventos de lectura desde microcontroladores o emulador...
              </div>
            ) : (
              liveStream.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: item.granted ? 'var(--text-primary)' : 'var(--text-muted)'
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '12.5px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {item.user ? `${item.user.first_name} ${item.user.last_name}` : 'Tarjeta Desconocida'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {item.door?.name || 'Puerta'} · {new Date(item.timestamp).toLocaleTimeString('es-CO')}
                      </div>
                    </div>
                  </div>

                  <span className={`badge ${item.granted ? 'badge-ok' : 'badge-denied'}`}>
                    {item.granted ? 'Autorizado' : 'Denegado'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
