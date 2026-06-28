// ===============================================
// Cristal Water - Client Chat Routes
// Cliente <-> Administrador
// ===============================================

const express = require('express');
const router = express.Router();

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'clientChatMessages.json');

function loadMessages() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveMessages(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// -----------------------------------------------
// GET /api/client-chat/unread-count
//  -> mensagens de CLIENTE ainda não lidas pelo ADMIN
// -----------------------------------------------
router.get('/unread-count', (req, res) => {
  const all = loadMessages();

  const unreadForAdmin = all.filter(
    (m) => m.from === 'CLIENT' && !m.readByAdmin
  ).length;

  res.json({ unreadCount: unreadForAdmin });
});

// -----------------------------------------------
// GET /api/client-chat/:clientId/messages
//  -> histórico de chat desse cliente
// -----------------------------------------------
router.get('/:clientId/messages', (req, res) => {
  const clientId = String(req.params.clientId);
  const all = loadMessages();

  const messages = all
    .filter((m) => String(m.clientId) === clientId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  res.json(messages);
});

// -----------------------------------------------
// POST /api/client-chat/:clientId/messages
// body: { from: 'CLIENT' | 'ADMIN', text: string }
// -----------------------------------------------
router.post('/:clientId/messages', (req, res) => {
  const clientId = String(req.params.clientId);
  const { from, text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Mensagem vazia.' });
  }

  const validFrom = from === 'CLIENT' ? 'CLIENT' : 'ADMIN';

  const all = loadMessages();

  const msg = {
    id: Date.now(),
    clientId,
    from: validFrom,            // CLIENT ou ADMIN
    text: text.trim(),
    created_at: new Date().toISOString(),
    readByAdmin: validFrom === 'ADMIN',   // se o admin enviar, já está lida para ele
    readByClient: validFrom === 'CLIENT', // se o cliente enviar, já está lida para ele
  };

  all.push(msg);
  saveMessages(all);

  res.status(201).json(msg);
});

// -----------------------------------------------
// POST /api/client-chat/:clientId/mark-read
// body: { role: 'ADMIN' | 'CLIENT' }
// -----------------------------------------------
router.post('/:clientId/mark-read', (req, res) => {
  const clientId = String(req.params.clientId);
  const { role } = req.body;

  const all = loadMessages();

  const updated = all.map((m) => {
    if (String(m.clientId) !== clientId) return m;

    if (role === 'ADMIN') {
      return { ...m, readByAdmin: true };
    }
    if (role === 'CLIENT') {
      return { ...m, readByClient: true };
    }
    return m;
  });

  saveMessages(updated);

  res.json({ ok: true });
});

module.exports = router;