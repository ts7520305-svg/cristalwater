'use strict';
const router = require('express').Router();
const service = require('../services/companyClosureService');
const writes = require('../services/fieldWriteRequestService');
router.use(require('../middlewares/authMiddleware')('ADMIN'));
router.use((req, res, next) => { res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-CW-Module': 'company-closures-v2', 'X-CW-Owner': writes.owner(req.user) }); next(); });
const route = (work, status = 200) => async (req, res) => {
  try { res.status(status).json(await work(req)); }
  catch (error) { const known = [400, 403, 404, 409, 428].includes(error.statusCode); res.status(known ? error.statusCode : 503).json({ ok: false, error: known ? error.message : 'Não foi possível confirmar o encerramento. Conserve o pedido e tente confirmar novamente.' }); }
};
router.get('/templates', (req, res) => res.json({ ok: true, version: 2, templates: [
  { id: 'NATAL', closureType: 'CHRISTMAS', title: 'Encerramento de Natal', messageTitle: 'Aviso de encerramento de Natal', messageBody: 'Informamos que a Cristal Water estará encerrada entre {startDate} e {endDate}. Em caso urgente, contacte o número habitual. Boas festas.' },
  { id: 'FERIAS_VERAO', closureType: 'SUMMER_BREAK', title: 'Férias de verão', messageTitle: 'Aviso de férias da equipa', messageBody: 'Informamos que estaremos encerrados entre {startDate} e {endDate}. Consulte a administração sobre serviços críticos previamente acordados.' },
  { id: 'FERIADO', closureType: 'PUBLIC_HOLIDAY', title: 'Feriado / encerramento pontual', messageTitle: 'Aviso de encerramento temporário', messageBody: 'A Cristal Water estará encerrada entre {startDate} e {endDate}. Em caso urgente, contacte o número habitual.' },
] }));
router.get('/', route(req => service.list(req.user, req.query)));
router.get('/active', route(req => service.active(req.user)));
router.get('/requests/:requestId', route(req => service.recover(req.user, req.params.requestId)));
router.get('/:id/route-impact', route(req => service.impact(req.user, req.params.id)));
router.get('/:id', route(req => service.read(req.user, req.params.id)));
router.post('/commands', route(req => service.write(req.user, req.body)));
// Legacy URLs retain their operation and target, but require a reviewed,
// recoverable command instead of an unidentifiable mutation.
const command = operation => req => {
  if (req.body?.requestId && (req.body.operation !== operation || req.body.closureId !== (operation === 'CREATE' ? null : service.id(req.params.id)))) writes.fail('O pedido não corresponde a esta operação.', 400);
  return service.write(req.user, req.body);
};
router.post('/', route(command('CREATE'), 201));
router.put('/:id', route(command('UPDATE')));
router.post('/:id/activate', route(command('ACTIVATE')));
router.post('/:id/cancel', route(command('CANCEL')));
router.post('/:id/generate-notifications', route(command('NOTIFY')));
module.exports = router;
