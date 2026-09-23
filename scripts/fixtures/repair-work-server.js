'use strict';
require('../../src/loadEnv')();
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false' || !process.send) throw Error('Isolated QA child required');
const express = require('express'), { prisma } = require('../../src/prismaClient');
let fault = null;
const transaction = prisma.$transaction.bind(prisma);
prisma.$transaction = (work, options) => transaction(async db => {
  for (const [model,method,match] of [['repairWorkInterval','create','after-create'],['repairWorkInterval','update','after-update'],['auditTrail','create','after-audit'],['fieldWriteRequest','create','receipt']]) {
    const original = db[model][method].bind(db[model]);
    db[model][method] = async (...args) => { const result = await original(...args); if (fault === match) throw Error('QA_PRIVATE_WORK_FAILURE'); return result; };
  }
  return work(db);
}, options);
const app = express(); app.use(express.json({ limit: '32kb' })); app.use('/api/repairs', require('../../src/routes/repairRoutes'));
const server = app.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
process.on('message', message => { fault=message.fault||null; process.send({ configured:true }); });
process.on('SIGTERM', () => server.close(async () => { await prisma.$disconnect(); process.exit(0); }));
