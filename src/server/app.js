const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const apiRoutes = require('./routes');
const healthController = require('./controllers/healthController');
const { apiLimiter } = require('./config/security');

const app = express();

// Ocultar firma del servidor para dificultar reconocimiento de tecnologías
app.disable('x-powered-by');

// Confiar en el proxy inverso (Vercel / Nginx) para lectura segura de IPs
app.set('trust proxy', 1);

// Cabeceras de seguridad HTTP robustas
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

// Lista blanca estricta de orígenes autorizados
const allowedOrigins = [
  'https://rfid.victormcl.me',
  'http://localhost:5173',
  'http://localhost:4000',
  'http://localhost:3000',
  ...(process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*'
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : []),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir lectores hardware (Raspberry Pi / ESP32) o peticiones server-to-server sin origen
    if (!origin) return callback(null, true);

    const isMatch = process.env.CORS_ORIGIN === '*' ||
      allowedOrigins.includes(origin) ||
      allowedOrigins.some(o => o.includes('localhost') && origin.includes('localhost'));

    if (isMatch) {
      return callback(null, true);
    }
    return callback(new Error(`Bloqueado por política de seguridad CORS: Origen ${origin} no autorizado.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Device-Id']
}));

// Limitar tamaño de payloads para prevenir ataques DoS por agotamiento de memoria
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));
app.use(morgan('dev'));

// Rate limiting general para la API
app.use('/api', apiLimiter);

const frontendDist = path.join(__dirname, '../../dist');
const indexFile = path.join(frontendDist, 'index.html');

app.use(express.static(frontendDist));
app.get('/health', healthController.getHealth);

app.use('/api', apiRoutes);

const isBackendPath = (req) => req.path.startsWith('/api') || req.path === '/health';

app.get('*', (req, res, next) => {
  if (isBackendPath(req) || !req.accepts('html') || path.extname(req.path)) {
    return next();
  }
  return res.sendFile(indexFile, (err) => {
    if (err) next(err);
  });
});

app.use('/', apiRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, req, res, next) => {
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      error: err.message
    });
  }
  console.error('Error no controlado en la aplicación:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
