'use strict';
const chat = require('../business/chat/ResourceChatBusiness');
async function respond(req, res, writing) {
  try {
    const result = writing ? await chat.send('pool', req.user, req.params.poolId, req.body) : await chat.list('pool', req.user, req.params.poolId);
    res.set('Cache-Control', 'private, no-store');
    return res.json(result);
  } catch (error) { return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erro no chat da piscina.' }); }
}
module.exports = {
  listPoolMessages: (req, res) => respond(req, res, false),
  sendPoolMessage: (req, res) => respond(req, res, true)
};
