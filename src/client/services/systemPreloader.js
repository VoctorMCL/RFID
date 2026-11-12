import { getApiBase } from '../api/client';

const COMMON_ENDPOINTS = ['/health', '/doors', '/rooms', '/blocks', '/alerts'];
const ADMIN_ENDPOINTS = [
  '/access/analytics',
  '/access/logs/stats',
  '/access/logs?limit=15'
];
const SECURITY_ENDPOINTS = [
  '/access/latest',
  '/access/logs?limit=15',
  '/visitor-passes',
  '/rfid-cards'
];

const requestsInFlight = new Set();

const fetchEndpoint = async (apiBase, endpoint, token) => {
  if (requestsInFlight.has(endpoint)) return null;
  requestsInFlight.add(endpoint);

  try {
    const response = await fetch(`${apiBase}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Bypass-Tunnel-Reminder': 'true'
      }
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    return null;
  } finally {
    requestsInFlight.delete(endpoint);
  }
};

export const preloadSystemData = ({ roleName, photoUrl }) => {
  const token = localStorage.getItem('rfid_token');
  if (!token) return;

  const apiBase = getApiBase();
  const isSecurity = roleName === 'celador' || roleName === 'security';
  const endpoints = [
    ...COMMON_ENDPOINTS,
    ...(isSecurity ? SECURITY_ENDPOINTS : ADMIN_ENDPOINTS)
  ];

  endpoints.forEach((endpoint) => {
    fetchEndpoint(apiBase, endpoint, token);
  });

  if (photoUrl) {
    const image = new Image();
    image.src = photoUrl;
  }
};
