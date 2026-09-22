'use strict';
require('../../src/loadEnv')();
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false' || !process.send) throw Error('Isolated QA child with real email disabled required');
const express = require('express'), path = require('node:path');
const { prisma } = require('../../src/prismaClient');
const email = require('../../src/services/emailService'), integrations = require('../../src/config/externalIntegrations');
let calls = [], behavior = 'accepted', fault = null, delay = 0, enabled = true;
integrations.isEmailEnabled = integrations.areExternalNotificationsEnabled = () => enabled;
email.sendEmail = async payload => {
  if (!payload.to.endsWith('@qa.invalid')) throw Error('Only synthetic recipients allowed');
  calls.push(payload);
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  if (behavior === 'throw') throw Error('QA response lost');
  if (behavior === 'unknown') return {};
  if (behavior === 'rejected') return { accepted: [], rejected: [payload.to] };
  return { accepted: [{ address: payload.to.toUpperCase() }], rejected: [] };
};
const transaction = prisma.$transaction.bind(prisma);
prisma.$transaction = (work, options) => transaction(async db => {
  const targets = { reviewAudit:['auditTrail','create'], reviewReceipt:['fieldWriteRequest','create'], retryResult:['emailLog','updateMany'], logCreate: ['emailLog','create'], reservation: ['monthlyReportDelivery','create'], logUpdate: ['emailLog','update'], resultUpdate: ['monthlyReportDelivery','update'] };
  if (targets[fault]) { const [model, method] = targets[fault]; db[model][method] = async () => { throw Error('QA_PRIVATE persistence failure'); }; }
  return work(db);
}, options);
const app = express(); app.use(express.json());
app.use('/api/admin', require('../../src/routes/adminReportRoutes'));
app.use('/api/admin', require('../../src/routes/adminEmailRetryRoutes'));
app.use('/api/admin', require('../../src/routes/adminReportsRoutes'));
app.get('/admin-reports', (req,res) => res.sendFile(path.resolve(__dirname,'../../frontend/admin-reports.html')));
app.use(express.static(path.resolve(__dirname,'../../frontend')));
const server = app.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
process.on('message', message => {
  if (message.reset) calls=[];
  if (message.behavior) behavior=message.behavior;
  if ('fault' in message) fault=message.fault;
  if ('delay' in message) delay=message.delay;
  if ('enabled' in message) enabled=message.enabled;
  process.send({ configured:true, calls });
});
process.on('SIGTERM', () => server.close(async () => { await prisma.$disconnect(); process.exit(0); }));
