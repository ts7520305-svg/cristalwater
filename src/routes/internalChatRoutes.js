const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'internalChat.json');

function loadMessages() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveMessages(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

router.get('/messages', (req, res) => {
  res.json(loadMessages());
});

router.post('/messages', (req, res) => {
  const messages = loadMessages();
  const msg = {
    id: Date.now(),
    author: req.body.author || 'ADMIN',
    text: req.body.text || '',
    created_at: new Date().toISOString()
  };
  messages.push(msg);
  saveMessages(messages);
  res.status(201).json(msg);
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;