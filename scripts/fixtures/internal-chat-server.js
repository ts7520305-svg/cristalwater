'use strict';
// A second real HTTP process, available only to isolated integration tests.
require('../../src/loadEnv')();
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || !process.send) throw Error('Isolated QA child required');
const express = require('express');
const { prisma } = require('../../src/prismaClient');
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = body => {
    // Destroy the HTTP response only after the production handler has committed.
    if (req.headers['x-cw-qa-drop-response'] === 'true' && [200, 201].includes(res.statusCode)) { res.destroy(); return res; }
    return json(body);
  };
  next();
});
app.use('/api/internal-chat', require('../../src/routes/internalChatRoutes'));
app.use('/api/chat', require('../../src/routes/chatRoutes'));
app.use('/api/clientChat', require('../../src/routes/clientChatRoutes'));
app.use('/api/client-chat', require('../../src/routes/clientChatRoutes'));
app.use('/api/client-portal', require('../../src/routes/clientPortalRoutes'));
app.use('/api/client-messages', require('../../src/routes/clientMessageRoutes'));
app.use('/api/clients', require('../../src/routes/clientRoutes'));
const server = app.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
process.on('SIGTERM', () => server.close(async () => { await prisma.$disconnect(); process.exit(0); }));
