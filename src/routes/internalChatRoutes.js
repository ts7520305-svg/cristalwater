'use strict';
const router = require('express').Router();
const chat = require('../controllers/internalChatController');
router.use(require('../middlewares/authMiddleware')('TECHNICIAN'));
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/messages', chat.list());
router.post('/messages', chat.create());
router.get('/health', (req, res) => res.json({ status: 'ok' }));
module.exports = router;
