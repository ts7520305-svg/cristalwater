'use strict';
// A real production router with read faults confined to an isolated QA child.
require('../../src/loadEnv')();
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || !process.send) throw Error('Isolated QA child required');
const express = require('express');
const { prisma } = require('../../src/prismaClient');
const transaction = prisma.$transaction.bind(prisma);
let fault = null;
prisma.$transaction = (work, options) => transaction(async db => {
  const methods = {payment:'findMany',invoice:'findMany',monthlyReport:'groupBy',communicationLog:'count'};
  if (fault && methods[fault]) db[fault][methods[fault]] = async () => { throw Error('QA_PRIVATE_DATABASE_FAILURE'); };
  return work(db);
}, options);
const app = express();
app.use('/api/admin', require('../../src/routes/adminReportsRoutes'));
const server = app.listen(0,'127.0.0.1',() => process.send({port:server.address().port}));
process.on('message',message => { fault=message.fault;process.send({configured:true}); });
process.on('SIGTERM',() => server.close(async () => { await prisma.$disconnect();process.exit(0); }));
