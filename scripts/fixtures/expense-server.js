'use strict';
require('../../src/loadEnv')();
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false' || !process.send) throw Error('Isolated QA child required');
process.env.ENABLE_ADMIN_AI_OPENAI = 'false'; process.env.ENABLE_ADMIN_AI_WEB = 'false';
const express = require('express'), path = require('node:path'), { prisma } = require('../../src/prismaClient');
let fault = null;
const transaction = prisma.$transaction.bind(prisma);
prisma.$transaction = (work, options) => transaction(async db => {
  for (const [model, method, match] of [['expenseAllocation', 'create', 'period-create'], ['expenseEvent', 'create', 'audit'], ['companyExpense', 'update', 'after-payment'], ['companyExpense', 'findMany', 'read'], ['laborCostValuationPart', 'create', 'composition-part'], ['fieldWriteRequest', 'create', 'composition-receipt'], ['userAuditLog', 'create', 'equipment-audit'], ['technicalHistory', 'create', 'material-history']]) {
    const original = db[model][method].bind(db[model]); db[model][method] = (...args) => { if (fault === match) throw Error('QA_PRIVATE_EXPENSE_FAILURE'); return original(...args); };
  }
  return work(db);
}, options);
const app = express(); app.use(express.json({ limit: '32kb' })); app.use('/api/expenses', require('../../src/routes/companyExpenseRoutes')); app.use('/api/labor-cost-bases', require('../../src/routes/laborCostCompositionRoutes')); app.use('/api/ai-admin', require('../../src/routes/aiAdminRoutes'));
app.use('/api/equipment-maintenance', require('../../src/routes/equipmentMaintenanceRoutes'));
for (const page of ['admin-expenses', 'admin-ai', 'labor-cost-bases', 'equipment-material-review', 'reminder-resources']) app.get('/' + page, (req, res) => res.sendFile(path.resolve(__dirname, '../../frontend/' + page + '.html')));
app.use(express.static(path.resolve(__dirname, '../../frontend')));
const server = app.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
process.on('message', message => { fault = message.fault || null; process.send({ configured: true }); });
process.on('SIGTERM', () => server.close(async () => { await prisma.$disconnect(); process.exit(0); }));
