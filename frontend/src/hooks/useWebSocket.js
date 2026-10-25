// ===================================================================
// Hook de Conexión en Tiempo Real vía WebSocket — Control de Acceso RFID
// ===================================================================
import { useState, useEffect, useRef } from 'react';

export const useWebSocket = (onMessageCallback) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const callbackRef = useRef(onMessageCallback);

  useEffect(() => {
    callbackRef.current = onMessageCallback;
  }, [onMessageCallback]);

  useEffect(() => {
    let isMounted = true;

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:4000`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (isMounted) setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (isMounted) setLastMessage(parsed);
            if (callbackRef.current) {
              callbackRef.current(parsed);
            }
          } catch (e) {
            // Silencioso ante mensajes no JSON
          }
        };

        ws.onclose = () => {
          if (isMounted) {
            setIsConnected(false);
            if (!reconnectTimeoutRef.current) {
              reconnectTimeoutRef.current = setTimeout(() => {
                reconnectTimeoutRef.current = null;
                connect();
              }, 4000);
            }
          }
        };

        ws.onerror = () => {
          // El cierre dispara onclose para reconectar
        };

        wsRef.current = ws;
      } catch (err) {
        if (isMounted && !reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 4000);
        }
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { isConnected, lastMessage };
};
