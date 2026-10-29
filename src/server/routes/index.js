// ===================================================================
// Definición Central de Rutas de la API REST — Control de Acceso RFID
// ===================================================================
const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../middleware/auth');

// Controladores
const authController = require('../controllers/authController');
const usersController = require('../controllers/usersController');
const rolesController = require('../controllers/rolesController');
const blocksController = require('../controllers/blocksController');
const roomsController = require('../controllers/roomsController');
const doorsController = require('../controllers/doorsController');
const rfidCardsController = require('../controllers/rfidCardsController');
const schedulesController = require('../controllers/schedulesController');
const accessController = require('../controllers/accessController');
const alertsController = require('../controllers/alertsController');

// -------------------------------------------------------------
// 1. RUTAS PÚBLICAS (Sin token de autenticación)
// -------------------------------------------------------------
// Autenticación
router.post('/auth/login', authController.login);

// Validación de acceso RFID desde hardware físico (ESP32 / Pi)
router.post('/access/validate', accessController.validateAccess);

// Último escaneo RFID para monitores en tiempo real (Soporte Vercel Serverless / Polling)
router.get('/access/latest', accessController.getLatestScan);

// Heartbeat de hardware para puertas
router.post('/doors/:id/heartbeat', doorsController.heartbeat);

// -------------------------------------------------------------
// 2. RUTAS PROTEGIDAS (Requieren Token JWT)
// -------------------------------------------------------------
router.use(authenticate);

// Perfil de usuario autenticado
router.get('/auth/me', authController.me);
router.put('/auth/change-password', authController.changePassword);

// Roles
router.get('/roles', rolesController.getRoles);
router.get('/roles/:id', rolesController.getRoleById);

// Usuarios
router.get('/users', usersController.getUsers);
router.get('/users/:id', usersController.getUserById);
router.post('/users', authorize('rector', 'admin_staff'), usersController.createUser);
router.put('/users/:id', authorize('rector', 'admin_staff'), usersController.updateUser);
router.delete('/users/:id', authorize('rector', 'admin_staff'), usersController.deleteUser);

// Bloques Institucionales
router.get('/blocks', blocksController.getBlocks);
router.get('/blocks/:id', blocksController.getBlockById);
router.post('/blocks', authorize('rector', 'admin_staff'), blocksController.createBlock);
router.put('/blocks/:id', authorize('rector', 'admin_staff'), blocksController.updateBlock);
router.delete('/blocks/:id', authorize('rector', 'admin_staff'), blocksController.deleteBlock);

// Salas / Espacios
router.get('/rooms', roomsController.getRooms);
router.get('/rooms/:id', roomsController.getRoomById);
router.post('/rooms', authorize('rector', 'admin_staff'), roomsController.createRoom);
router.put('/rooms/:id', authorize('rector', 'admin_staff'), roomsController.updateRoom);
router.delete('/rooms/:id', authorize('rector', 'admin_staff'), roomsController.deleteRoom);

// Puertas
router.get('/doors', doorsController.getDoors);
router.get('/doors/:id', doorsController.getDoorById);
router.post('/doors', authorize('rector', 'admin_staff'), doorsController.createDoor);
router.put('/doors/:id', authorize('rector', 'admin_staff'), doorsController.updateDoor);
router.delete('/doors/:id', authorize('rector', 'admin_staff'), doorsController.deleteDoor);
router.post('/doors/:id/unlock', authorize('rector', 'security'), doorsController.unlockDoor);

// Tarjetas RFID y Enrolamiento
router.get('/rfid-cards', rfidCardsController.getCards);
router.get('/rfid-cards/:id', rfidCardsController.getCardById);
router.post('/rfid-cards/enroll', authorize('rector', 'security', 'admin_staff'), rfidCardsController.enrollCard);
router.post('/rfid-cards', authorize('rector', 'security', 'admin_staff'), rfidCardsController.enrollCard);
router.put('/rfid-cards/:id', authorize('rector', 'security', 'admin_staff'), rfidCardsController.updateCard);
router.put('/rfid-cards/:id/deactivate', authorize('rector', 'security', 'admin_staff'), rfidCardsController.deactivateCard);
router.delete('/rfid-cards/:id', authorize('rector', 'security', 'admin_staff'), rfidCardsController.deleteCard);

// Articulación Horaria (Schedules)
router.get('/schedules', schedulesController.getSchedules);
router.get('/schedules/:id', schedulesController.getScheduleById);
router.post('/schedules', authorize('rector', 'admin_staff'), schedulesController.createSchedule);
router.put('/schedules/:id', authorize('rector', 'admin_staff'), schedulesController.updateSchedule);
router.delete('/schedules/:id', authorize('rector', 'admin_staff'), schedulesController.deleteSchedule);

// Auditoría y Métricas de Acceso
router.get('/access/logs', accessController.getAccessLogs);
router.get('/access/logs/stats', accessController.getStats);
router.get('/access/analytics', accessController.getAnalytics);

// Alertas de Seguridad
router.get('/alerts', alertsController.getAlerts);
router.post('/alerts', alertsController.createAlert);
router.put('/alerts/:id/resolve', authorize('rector', 'security'), alertsController.resolveAlert);
router.post('/alerts/disarm-room/:roomId', authorize('rector', 'security'), alertsController.disarmRoomAlarm);

module.exports = router;
