'use strict';
const chat = require('../business/chat/ResourceChatBusiness');
async function respond(req, res, writing) {
  try {
    const result = writing ? await chat.send('service', req.user, req.params.serviceId, req.body) : await chat.list('service', req.user, req.params.serviceId);
    res.set('Cache-Control', 'private, no-store');
    return res.json(result);
  } catch (error) { return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erro no chat do serviço.' }); }
}
module.exports = {
  getServiceChat: (req, res) => respond(req, res, false),
  sendServiceMessage: (req, res) => respond(req, res, true)
};
