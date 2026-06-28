// src/routes/locationLogRoutes.js
const express = require('express');
const router = express.Router();
const {
  listLocationLogs,
  listLocationLogsByUser,
  createLocationLog,
  seedLocationLogs
} = require('../controllers/locationLogController');

// SEED
// GET /api/location-logs/seed
router.get('/seed', seedLocationLogs);

// LISTAR TODOS
// GET /api/location-logs
router.get('/', listLocationLogs);

// LISTAR POR UTILIZADOR
// GET /api/location-logs/user/:userId
router.get('/user/:userId', listLocationLogsByUser);

// CRIAR LOG
// POST /api/location-logs
router.post('/', createLocationLog);

module.exports = router;