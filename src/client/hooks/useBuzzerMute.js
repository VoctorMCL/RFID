import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useWebSocket } from './useWebSocket';

// Estado de silencio compartido: lo guarda el servidor y lo respetan tanto el
// audio del navegador como el buzzer físico de la CrowPi.
export const useBuzzerMute = (pollMs = 5000) => {
  const [muted, setMuted] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await apiClient('/doors/buzzer-mute');
      if (res?.data && typeof res.data.muted === 'boolean') setMuted(res.data.muted);
    } catch (e) {}
  }, []);

  useWebSocket((event) => {
    if (event.type === 'buzzer_mute_change' && typeof event.data?.muted === 'boolean') {
      setMuted(event.data.muted);
    }
  });

  // En la nube el WebSocket está deshabilitado, así que también se consulta por polling.
  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refresh();
    }, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  const toggle = useCallback(async () => {
    const next = !muted;
    setMuted(next); // optimista
    try {
      await apiClient('/doors/buzzer-mute', { method: 'PUT', body: { muted: next } });
    } catch (e) {
      setMuted(!next);
    }
  }, [muted]);

  return { muted, soundEnabled: !muted, toggle };
};
