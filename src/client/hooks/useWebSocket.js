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
        let wsUrl = '';
        const customWs = localStorage.getItem('rfid_ws_url');
        const customApi = localStorage.getItem('rfid_api_url');

        // En dominios en la nube como rfid.victormcl.me o vercel.app, la sincronización
        // en tiempo real opera mediante el motor serverless de alta velocidad de Monitor
        const isCloudDeployment = typeof window !== 'undefined' && (
          window.location.hostname.includes('victormcl.me') ||
          window.location.hostname.includes('vercel.app')
        );
        if (isCloudDeployment && !customWs) {
          if (isMounted) setIsConnected(false);
          return;
        }

        if (customWs && customWs.trim()) {
          wsUrl = customWs.trim();
        } else if (customApi && customApi.trim()) {
          const apiClean = customApi.trim().replace(/\/api\/?$/, '');
          const proto = apiClean.startsWith('https') ? 'wss:' : 'ws:';
          const hostPart = apiClean.replace(/^https?:\/\//, '');
          wsUrl = `${proto}//${hostPart}`;
        } else {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const port = window.location.port;
          // En entorno Vite (5173) conectamos a puerto 4000; en servidor integrado usamos el mismo host:port
          const wsHost = (port === '5173')
            ? `${window.location.hostname}:4000`
            : (window.location.host || `${window.location.hostname}:4000`);
          wsUrl = `${protocol}//${wsHost}`;
        }

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
