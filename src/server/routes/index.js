const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../middleware/auth');
const { authLimiter, accessValidateLimiter } = require('../config/security');

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
const visitorPassesController = require('../controllers/visitorPassesController');
const programsController = require('../controllers/programsController');
const healthController = require('../controllers/healthController');

router.get('/health', healthController.getHealth);

router.post('/auth/rfid-login', authLimiter, authController.loginWithCard);

router.post('/access/validate', accessValidateLimiter, accessController.validateAccess);

router.get('/access/latest', accessController.getLatestScan);

router.post('/doors/:id/heartbeat', doorsController.heartbeat);

router.use(authenticate);

router.get('/auth/me', authController.me);
router.post('/auth/logout', authController.logout);

router.get('/roles', rolesController.getRoles);
router.get('/roles/:id', rolesController.getRoleById);
router.get('/programs', programsController.getPrograms);

router.get('/users', usersController.getUsers);
router.get('/users/:id', usersController.getUserById);
router.post('/users', authorize('admin'), usersController.createUser);
router.put('/users/:id', authorize('admin'), usersController.updateUser);
router.delete('/users/:id', authorize('admin'), usersController.deleteUser);

router.get('/blocks', blocksController.getBlocks);
router.get('/blocks/:id', blocksController.getBlockById);
router.post('/blocks', authorize('admin'), blocksController.createBlock);
router.put('/blocks/:id', authorize('admin'), blocksController.updateBlock);
router.delete('/blocks/:id', authorize('admin'), blocksController.deleteBlock);

router.get('/rooms', roomsController.getRooms);
router.get('/rooms/:id', roomsController.getRoomById);
router.post('/rooms', authorize('admin'), roomsController.createRoom);
router.put('/rooms/:id', authorize('admin'), roomsController.updateRoom);
router.delete('/rooms/:id', authorize('admin'), roomsController.deleteRoom);

router.get('/doors/buzzer-mute', doorsController.getBuzzerMute);
router.put('/doors/buzzer-mute', doorsController.setBuzzerMute);
router.get('/doors', doorsController.getDoors);
router.get('/doors/:id', doorsController.getDoorById);
router.post('/doors', authorize('admin'), doorsController.createDoor);
router.put('/doors/:id', authorize('admin'), doorsController.updateDoor);
router.delete('/doors/:id', authorize('admin'), doorsController.deleteDoor);
router.post('/doors/:id/unlock', authorize('celador', 'security'), doorsController.unlockDoor);

router.get('/rfid-cards', rfidCardsController.getCards);
router.get('/rfid-cards/:id', rfidCardsController.getCardById);
router.post('/rfid-cards/enroll', authorize('celador', 'security'), rfidCardsController.enrollCard);
router.post('/rfid-cards', authorize('celador', 'security'), rfidCardsController.enrollCard);
router.put('/rfid-cards/:id', authorize('celador', 'security'), rfidCardsController.updateCard);
router.put('/rfid-cards/:id/deactivate', authorize('celador', 'security'), rfidCardsController.deactivateCard);
router.delete('/rfid-cards/:id', authorize('celador', 'security'), rfidCardsController.deleteCard);

router.get('/visitor-passes', visitorPassesController.getPasses);
router.post('/visitor-passes', authorize('celador', 'security'), visitorPassesController.createPass);
router.put('/visitor-passes/:id/return', authorize('celador', 'security'), visitorPassesController.returnPass);
router.delete('/visitor-passes/:id', authorize('admin'), visitorPassesController.deletePass);

router.get('/schedules', schedulesController.getSchedules);
router.get('/schedules/:id', schedulesController.getScheduleById);
router.post('/schedules', authorize('admin'), schedulesController.createSchedule);
router.put('/schedules/:id', authorize('admin'), schedulesController.updateSchedule);
router.delete('/schedules/:id', authorize('admin'), schedulesController.deleteSchedule);

router.get('/access/logs', accessController.getAccessLogs);
router.get('/access/logs/stats', accessController.getStats);
router.get('/access/analytics', accessController.getAnalytics);

router.get('/alerts', alertsController.getAlerts);
router.post('/alerts', alertsController.createAlert);
router.put('/alerts/:id/resolve', authorize('celador', 'security'), alertsController.resolveAlert);
router.post('/alerts/disarm-room/:roomId', authorize('celador', 'security'), alertsController.disarmRoomAlarm);

module.exports = router;
