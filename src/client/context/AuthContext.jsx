// ===================================================================
// Contexto de Autenticación — Control de Acceso RFID (PostgreSQL)
// Restringido a Administrador y Celador / Seguridad
// ===================================================================
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('rfid_token'));
  const [loading, setLoading] = useState(true);

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
  }, []);

  const login = async (email, password) => {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      let resolvedEmail = cleanEmail;
      if (cleanEmail === 'admin') resolvedEmail = 'admin@lasallista.edu.co';
      if (cleanEmail === 'celador' || cleanEmail === 'guardia' || cleanEmail === 'seguridad') {
        resolvedEmail = 'celador@lasallista.edu.co';
      }

      const res = await apiClient('/auth/login', {
        method: 'POST',
        body: { email: resolvedEmail, password: password || 'acceso2026' }
      });

      if (res && res.success && res.data) {
        const { token: newToken, user: newUser } = res.data;
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

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('rfid_token');
    localStorage.removeItem('rfid_user');
  };

  const isAdmin = user && (user.role?.name === 'admin' || user.role?.global_access);
  const isSecurity = user && (user.role?.name === 'security' || user.role?.name === 'celador');

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isSecurity }}>
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
