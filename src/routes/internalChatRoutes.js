const express = require('express');
const router = express.Router();
const chat = require('../business/chat/InternalChatBusiness');
router.use(require('../middlewares/authMiddleware')('TECHNICIAN'));
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
function error(res, err) { return res.status(err.statusCode || 500).json({ ok: false, error: err.statusCode ? err.message : 'Não foi possível aceder ao histórico da conversa.' }); }

router.get('/messages', (req, res) => {
  try { res.json(chat.list(req.user)); } catch (err) { error(res, err); }
});

router.post('/messages', (req, res) => {
  try { res.status(201).json(chat.create(req.user, req.body)); } catch (err) { error(res, err); }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;
