'use strict';
const chat = require('../business/chat/InternalChatBusiness');
function error(res, err) {
  return res.status(err.statusCode || 500).json({ ok: false, error: err.statusCode ? err.message : 'Não foi possível aceder ao histórico da conversa. Conserve o pedido para tentar novamente.' });
}
function list(envelope = false) {
  return async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try { const messages = await chat.list(req.user); return res.json(envelope ? { ok: true, messages } : messages); }
    catch (err) { return error(res, err); }
  };
}
function create(envelope = false) {
  return async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const result = await chat.create(req.user, req.body);
      return res.status(result.replayed ? 200 : 201).json(envelope ? { ok: true, ...result } : { ...result.message, replayed: result.replayed });
    } catch (err) { return error(res, err); }
  };
}
module.exports = { list, create };
