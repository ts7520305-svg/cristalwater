'use strict';
const router = require('express').Router();
const business = require('../business/chat/LegacyClientChatBusiness');
router.use(require('../middlewares/authMiddleware')('CLIENT'));
const handle = (operation, status = 200) => async (req, res) => {
  try { return res.status(status).json(await operation(req)); }
  catch (error) { return res.status(error.statusCode || 500).json({ ok: false, error: error.statusCode ? error.message : 'Não foi possível aceder à conversa. O histórico foi preservado.' }); }
};
router.get('/unread-count', handle(req => business.unread(req.user)));
router.get('/:clientId/messages', handle(req => business.list(req.user, req.params.clientId)));
router.post('/:clientId/messages', handle(req => business.create(req.user, req.params.clientId, req.body), 201));
router.post('/:clientId/mark-read', handle(req => business.markRead(req.user, req.params.clientId)));
module.exports = router;
