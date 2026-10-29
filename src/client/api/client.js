// ===================================================================
// Cliente de API REST — Control de Acceso RFID Institucional
// Comunicación Directa contra la API y PostgreSQL / Supabase
// ===================================================================

// Obtener URL base de la API
export const getApiBase = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('rfid_api_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/$/, '');
    }
  }
  return import.meta.env.VITE_API_URL || '/api';
};

// Roles permitidos en el portal web (solo administradores y seguridad)
export const ALLOWED_WEB_ROLES = ['admin', 'celador', 'security', 'rector'];

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

  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    localStorage.removeItem('rfid_token');
    localStorage.removeItem('rfid_user');
    window.location.href = '/login';
    throw new Error('Sesión expirada o no autorizada');
  }

  if (!response.ok) {
    const errorMessage = (data && data.error) || `Error ${response.status}: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data || { success: true };
};
