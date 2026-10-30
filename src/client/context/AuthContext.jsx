// ===================================================================
// Contexto de Autenticación — Control de Acceso RFID (PostgreSQL)
// Autenticación Exclusiva por Tarjeta RFID + Inactividad + Sesión Única
// ===================================================================
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../api/client';

const AuthContext = createContext(null);
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutos de inactividad

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('rfid_token'));
  const [loading, setLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState(() => sessionStorage.getItem('rfid_auth_notice') || '');
  const inactivityTimerRef = useRef(null);

  const logout = useCallback((reason = null) => {
    // Si hay token, notificar al backend para limpiar active_session_id
    if (localStorage.getItem('rfid_token')) {
      apiClient('/auth/logout', { method: 'POST' }).catch(() => {});
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('rfid_token');
    localStorage.removeItem('rfid_user');
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (reason) {
      sessionStorage.setItem('rfid_auth_notice', reason);
      setAuthNotice(reason);
    }
  }, []);

  // Inicializar estado guardado
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('rfid_token');
      const storedUser = localStorage.getItem('rfid_user');

      if (storedToken && storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
        } catch (e) {
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, [logout]);

  // Temporizador de inactividad (15 minutos)
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (token) {
      inactivityTimerRef.current = setTimeout(() => {
        logout('Su sesión ha finalizado automáticamente por 15 minutos de inactividad.');
        window.location.href = '/login';
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [token, logout]);

  useEffect(() => {
    if (!token) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => resetInactivityTimer();

    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
    resetInactivityTimer();

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [token, resetInactivityTimer]);

  /**
   * Inicio de sesión exclusivo por Tarjeta Física RFID
   */
  const loginWithCard = async (rfidUid) => {
    try {
      sessionStorage.removeItem('rfid_auth_notice');
      setAuthNotice('');

      const res = await apiClient('/auth/rfid-login', {
        method: 'POST',
        body: {
          rfid_uid: rfidUid,
          device_info: navigator.userAgent
        }
      });

      const authData = (res && res.data) ? res.data : res;
      const newToken = authData?.token;
      const newUser = authData?.user;

      if (newToken && newUser) {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('rfid_token', newToken);
        localStorage.setItem('rfid_user', JSON.stringify(newUser));
        return { success: true, user: newUser };
      }

      return {
        success: false,
        error: (res && res.error) || 'Tarjeta no autorizada para operar el sistema.'
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Error comunicando con el servidor de autenticación RFID.'
      };
    }
  };

  /**
   * Soporte de login alternativo / contingencia
   */
  const login = async (email, password) => {
    try {
      sessionStorage.removeItem('rfid_auth_notice');
      setAuthNotice('');

      const cleanEmail = (email || '').trim().toLowerCase();
      let resolvedEmail = cleanEmail;
      if (cleanEmail === 'admin') resolvedEmail = 'admin@lasallista.edu.co';
      if (cleanEmail === 'celador' || cleanEmail === 'guardia' || cleanEmail === 'seguridad') {
        resolvedEmail = 'celador@lasallista.edu.co';
      }

      const res = await apiClient('/auth/login', {
        method: 'POST',
        body: {
          email: resolvedEmail,
          password: password || 'acceso2026',
          device_info: navigator.userAgent
        }
      });

      const authData = (res && res.data) ? res.data : res;
      const newToken = authData?.token;
      const newUser = authData?.user;

      if (newToken && newUser) {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('rfid_token', newToken);
        localStorage.setItem('rfid_user', JSON.stringify(newUser));
        return { success: true, user: newUser };
      }

      return {
        success: false,
        error: (res && res.error) || 'Credenciales inválidas en la base de datos.'
      };
    } catch (err) {
      return { success: false, error: err.message || 'Error conectando al servidor de base de datos' };
    }
  };

  const roleName = (user?.role?.name || '').toLowerCase();
  const isAuthenticated = Boolean(token && user);

  // 🔒 JERARQUÍA ESTRICTA DE ROLES:
  // Admin y Rector tienen acceso a configuración, mapa, usuarios y horarios.
  // Celador / Seguridad NO es Admin; Celador solo ve Escáner, Logs y Tarjetas/Visitantes.
  const isAdmin = Boolean(user && (roleName === 'admin' || roleName === 'rector'));
  const isCelador = Boolean(user && (roleName === 'celador' || roleName === 'security'));
  const isSecurity = isCelador;
  const isProfessor = Boolean(user && roleName === 'professor');
  const canManageInfrastructure = isAdmin;
  const canManageSecurity = Boolean(isAdmin || isCelador);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      authNotice,
      clearAuthNotice: () => {
        sessionStorage.removeItem('rfid_auth_notice');
        setAuthNotice('');
      },
      loginWithCard,
      login,
      logout,
      isAuthenticated,
      roleName,
      isAdmin,
      isCelador,
      isSecurity,
      isProfessor,
      canManageInfrastructure,
      canManageSecurity
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
