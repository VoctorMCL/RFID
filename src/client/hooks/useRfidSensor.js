import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { useWebSocket } from './useWebSocket';

const normalizeUid = (uid) => String(uid || '').trim().replace(/[\s:\-]/g, '').toUpperCase();

export const useRfidSensor = ({
  active,
  onScan,
  onEvent,
  pollMs = 1200,
  freshnessMs = 4000
}) => {
  const [scannedUid, setScannedUid] = useState('');
  const [sensorStatus, setSensorStatus] = useState('waiting');
  const lastSeenScanIdRef = useRef(null);
  const lastKeyTimeRef = useRef(0);
  const wedgeBufferRef = useRef('');
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const reset = useCallback(() => {
    setScannedUid('');
    setSensorStatus('waiting');
    lastSeenScanIdRef.current = null;
    wedgeBufferRef.current = '';
  }, []);

  const handlePhysicalScan = useCallback((uid) => {
    const clean = normalizeUid(uid);
    if (clean.length < 4) return;

    setScannedUid(clean);
    setSensorStatus('detected');
    onScanRef.current?.(clean);
  }, []);

  const handleWsEvent = useCallback((event) => {
    onEvent?.(event);

    if (active && event.type === 'access_attempt' && event.data?.uid) {
      handlePhysicalScan(event.data.uid);
    }
  }, [active, handlePhysicalScan, onEvent]);

  useWebSocket(handleWsEvent);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let interval = null;

    const startPolling = async () => {
      try {
        const res = await apiClient('/access/latest');
        if (!cancelled && res.success && res.data?.id) {
          lastSeenScanIdRef.current = res.data.id;
        }
      } catch (error) {
      }

      if (cancelled) return;

      interval = setInterval(async () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        try {
          const res = await apiClient('/access/latest');
          const scan = res.data;
          if (!res.success || !scan?.uid) return;

          const isFresh = Date.now() - new Date(scan.timestamp).getTime() < freshnessMs;
          if (!isFresh || scan.id === lastSeenScanIdRef.current) return;

          lastSeenScanIdRef.current = scan.id;
          handlePhysicalScan(scan.uid);
        } catch (error) {
        }
      }, pollMs);
    };

    startPolling();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [active, handlePhysicalScan, pollMs, freshnessMs]);

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (event.key === 'Enter') {
        const potential = wedgeBufferRef.current.trim();
        wedgeBufferRef.current = '';
        if (gap <= 100 && /^[0-9A-F]{6,}$/i.test(potential)) {
          handlePhysicalScan(potential);
        }
        return;
      }

      if (gap > 100) wedgeBufferRef.current = '';
      if (event.key.length === 1) wedgeBufferRef.current += event.key;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, handlePhysicalScan]);

  useEffect(() => {
    if (!active) reset();
  }, [active, reset]);

  return { scannedUid, sensorStatus, reset };
};
