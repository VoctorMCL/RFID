// ===================================================================
// Cliente de API REST — Control de Acceso RFID Institucional
// Comunicación Directa contra la API y PostgreSQL / Supabase
// ===================================================================

/**
 * Obtiene la URL base de la API REST respetando configuraciones manuales o variables de entorno
 * @returns {string} URL base sin barra final
 */
export const getApiBase = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('rfid_api_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/$/, '');
    }
  }
  return import.meta.env.VITE_API_URL || '/api';
};

/**
 * Roles autorizados para operar la consola administrativa y de monitoreo web
 */
export const ALLOWED_WEB_ROLES = ['admin', 'celador', 'security', 'rector'];

/**
 * Cliente HTTP unificado con inyección automática de JWT, soporte de túneles y manejo de 401
 * @param {string} endpoint - Ruta relativa del endpoint (ej. '/access/logs')
 * @param {RequestInit} [options] - Opciones de fetch (method, body, headers)
 * @returns {Promise<any>} Respuesta deserializada en formato JSON
 */
export const apiClient = async (endpoint, options = {}) => {
  const token = localStorage.getItem('rfid_token');

  const headers = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}${endpoint}`, config);

  const rawText = await response.text();
  let data = null;

  if (rawText && rawText.trim().length > 0) {
    try {
      data = JSON.parse(rawText);
    } catch (jsonErr) {
      console.warn(`Respuesta no-JSON de ${endpoint}:`, rawText.substring(0, 80));
    }
  }

  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/rfid-login')) {
    localStorage.removeItem('rfid_token');
    localStorage.removeItem('rfid_user');
    const msg = (data && data.error) || 'Sesión expirada o cerrada desde otro dispositivo';
    try {
      sessionStorage.setItem('rfid_auth_notice', msg);
    } catch (e) {}
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new Error(msg);
  }

  if (!response.ok) {
    const errorMessage = (data && data.error) || `Error ${response.status}: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data || { success: true };
};
