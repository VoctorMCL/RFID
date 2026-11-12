import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client';

// Hora efectiva del sistema (real o simulada) tal como la usa el servidor para validar horarios.
export const useSimulatedClock = () => {
  const [state, setState] = useState({ simulated: false, offsetMs: 0, loaded: false });
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const res = await apiClient('/clock');
      if (res?.data?.now) {
        setState({
          simulated: Boolean(res.data.simulated),
          offsetMs: new Date(res.data.now).getTime() - Date.now(),
          loaded: true
        });
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 30000);
    return () => clearInterval(poll);
  }, [refresh]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now() + state.offsetMs), 1000);
    setNowMs(Date.now() + state.offsetMs);
    return () => clearInterval(tick);
  }, [state.offsetMs]);

  const setSimulation = useCallback(async (localDateTime) => {
    await apiClient('/clock', { method: 'PUT', body: { datetime: localDateTime || null } });
    await refresh();
  }, [refresh]);

  return { now: new Date(nowMs), simulated: state.simulated, loaded: state.loaded, setSimulation };
};
