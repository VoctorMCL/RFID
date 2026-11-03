const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const apiRoutes = require('./routes');
const healthController = require('./controllers/healthController');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

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
  console.error('Error no controlado en la aplicación:', err);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
