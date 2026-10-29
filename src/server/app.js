// ===================================================================
// Configuración de la aplicación Express — Control de Acceso RFID
// Servidor unificado: API REST + WebSockets + Frontend SPA (React)
// ===================================================================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const apiRoutes = require('./routes');

const app = express();

// Middlewares de seguridad y utilidad
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true, // Permitir cualquier origen local o de red LAN (localhost, 10.55.98.145, etc.)
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Ruta a los estáticos compilados de React en la raíz
const frontendDist = path.join(__dirname, '../../dist');
app.use(express.static(frontendDist));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Control de Acceso RFID Institucional',
    institution: 'Corporación Universitaria Lasallista',
    timestamp: new Date().toISOString()
  });
});

// Rutas de la API (soporta /api/* y rutas directas reescritas por Vercel Serverless)
app.use('/api', apiRoutes);
app.use('/', apiRoutes);

// Manejador SPA: Redirigir cualquier otra ruta al index.html de React
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// Manejador de rutas no encontradas (para peticiones a la API inexistentes)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('❌ Error no controlado en la aplicación:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
