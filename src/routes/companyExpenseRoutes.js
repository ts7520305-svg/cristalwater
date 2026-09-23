'use strict';
const express = require('express'), multer = require('multer');
const { prisma } = require('../prismaClient'), service = require('../services/expenseLedgerService'), rules = require('../services/expenseLedgerRules');
const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); }, require('../middlewares/authMiddleware')('ADMIN'));
const handle = work => (req, res, next) => Promise.resolve(work(req, res)).catch(next);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: rules.maxEvidence, files: 1, fields: 1, fieldSize: 16000 } });
router.get('/', handle(async (req, res) => res.json(await service.list(req.query))));
router.get('/costs', handle(async (req, res) => res.json(await service.costReport(req.query))));
router.get('/labor-technicians', handle(async (req, res) => { rules.object(req.query, []); res.json({ ok: true, technicians: await prisma.technician.findMany({ select: { id: true, name: true, active: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }) }); }));
router.get('/:id/repair-work-intervals', handle(async (req, res) => res.json(await service.repairWorkIntervals(rules.queryId(req.params.id), req.query))));
router.get('/:id/maintenance-labor-candidates', handle(async (req, res) => res.json(await service.maintenanceLabor(rules.queryId(req.params.id), req.query))));
router.get('/:id/maintenance-labor-preview', handle(async (req, res) => res.json(await service.maintenanceLabor(rules.queryId(req.params.id), req.query, true))));
router.get('/:id/cost-period-preview', handle(async (req, res) => res.json(await service.costPeriodPreview(rules.queryId(req.params.id), req.query))));
router.get('/:id/valuation-preview', handle(async (req, res) => res.json(await service.valuationPreview(rules.queryId(req.params.id), req.query))));
router.post('/:id/labor-distribution-preview', handle(async (req,res) => { rules.object(req.query,[]); res.json(await service.laborDistributionPreview(rules.queryId(req.params.id),req.body)); }));
router.get('/targets', handle(async (req, res) => res.json(await prisma.$transaction(db => service.costs.targets.list(db, req.query), { isolationLevel: 'RepeatableRead', timeout: 30000 }))));
router.get('/targets/:type/:id', handle(async (req, res) => {
  rules.object(req.query, []); const id = req.params.type === 'COMPANY' && req.params.id === '0' ? null : rules.queryId(req.params.id);
  const target = await service.costs.targets.get(prisma, req.params.type, id);
  if (!target) rules.fail('Destino não encontrado.', 404); res.json({ ok: true, target });
}));
router.get('/suppliers', handle(async (req, res) => {
  rules.object(req.query, []);
  res.json({ ok: true, suppliers: await prisma.supplierAccount.findMany({ select: { id: true, name: true, active: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }) });
}));
router.get('/sources', handle(async (req, res) => {
  rules.object(req.query, ['type', 'q', 'page']);
  const result = await prisma.$transaction(db => service.sources.list(db, { type: req.query.type, q: req.query.q || '', page: rules.queryId(req.query.page === undefined ? '1' : req.query.page) }), { isolationLevel: 'RepeatableRead', timeout: 30000 });
  res.json({ ok: true, ...result });
}));
router.get('/sources/:type/:id', handle(async (req, res) => {
  rules.object(req.query, []);
  const source = await service.sources.source(prisma, req.params.type, rules.queryId(req.params.id));
  if (!source) rules.fail('Origem não encontrada.', 404); res.json({ ok: true, source });
}));
router.get('/requests/:requestId', handle(async (req, res) => res.json(await service.receipt(req.user, req.params.requestId))));
router.post('/commands', handle(async (req, res) => res.json(await service.command(req.user, req.body))));
router.post('/commands/cancel', handle(async (req, res) => res.json(await service.command(req.user, req.body, null, true))));
router.post('/evidence', upload.single('file'), handle(async (req, res) => {
  rules.object(req.body, ['envelope']); let body;
  try { body = JSON.parse(req.body.envelope); } catch { rules.fail('Pedido de comprovativo inválido.'); }
  if (body.command !== 'ADD_EVIDENCE') rules.fail('Pedido de comprovativo inválido.');
  res.json(await service.command(req.user, body, req.file));
}));
router.get('/:id/evidence/:evidenceId', handle(async (req, res) => {
  const item = await service.evidence(rules.queryId(req.params.id), rules.queryId(req.params.evidenceId));
  res.attachment(item.name); res.type(item.mime); res.set('X-Content-Type-Options', 'nosniff'); res.set('Content-Security-Policy', "sandbox; default-src 'none'");
  res.set('X-Expense-Evidence-Id', String(item.id)); res.set('X-Expense-Id', String(item.expenseId)); res.set('X-Content-SHA256', item.sha256);
  res.send(Buffer.from(item.bytes));
}));
router.get('/:id', handle(async (req, res) => res.json(await service.detail(rules.queryId(req.params.id)))));
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error instanceof multer.MulterError ? 400 : [400, 401, 403, 404, 409, 503].includes(error.status) ? error.status : 503;
  res.status(status).json({ ok: false, error: error instanceof multer.MulterError ? 'Anexe um único ficheiro até 5 MB.' : error.status ? error.message : 'Não foi possível confirmar a operação. Consulte o resultado do pedido antes de repetir.' });
});
module.exports = router;
