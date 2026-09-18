const business = require('../business/equipment/EquipmentMaintenanceBusiness');
const reminders = require('../business/equipment/EquipmentMaintenanceReminderBusiness');
const billing = require('../business/equipment/MaintenanceBillingBusiness');
const handle = fn => async (req, res, next) => { try { res.json(await fn(req)); } catch (e) { if (e.code === 'P2002') return res.status(409).json({ ok: false, error: 'Já existe um plano com este título nesta piscina. Atualize a lista ou escolha outro título.' }); if (e.status || e.statusCode) return res.status(e.status || e.statusCode).json({ ok: false, error: e.message }); next(e); } };
module.exports = {
  listBilling: handle(req => billing.list(req.user, req.params.poolId, req.query)),
  reviewBilling: handle(req => billing.review(req.user, req.params.kind, req.params.id, req.body)),
  reminderConfiguration: handle(() => reminders.configuration()),
  configureReminders: handle(req => reminders.configure(req.user, req.body?.enabled)),
  checkReminders: handle(() => reminders.run()),
  listPool: handle(req => business.listPool(req.user, req.params.poolId)),
  create: handle(req => business.create(req.user, req.params.poolId, req.body)),
  update: handle(req => business.update(req.user, req.params.id, req.body)),
  listVisit: handle(req => business.listVisit(req.user, req.params.visitId, req.query.visitType)),
  complete: handle(req => business.complete(req.user, req.params.id, req.body)),
};
