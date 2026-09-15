const business = require('../business/equipment/EquipmentMaintenanceBusiness');
const reminders = require('../business/equipment/EquipmentMaintenanceReminderBusiness');
const handle = fn => async (req, res, next) => { try { res.json(await fn(req)); } catch (e) { if (e.code === 'P2002') return res.status(409).json({ ok: false, error: 'Já existe um plano com este título nesta piscina. Atualize a lista ou escolha outro título.' }); if (e.status) return res.status(e.status).json({ ok: false, error: e.message }); next(e); } };
module.exports = {
  reminderConfiguration: handle(() => reminders.configuration()),
  configureReminders: handle(req => reminders.configure(req.user, req.body?.enabled)),
  checkReminders: handle(() => reminders.run()),
  listPool: handle(req => business.listPool(req.user, req.params.poolId)),
  create: handle(req => business.create(req.user, req.params.poolId, req.body)),
  update: handle(req => business.update(req.user, req.params.id, req.body)),
  listVisit: handle(req => business.listVisit(req.user, req.params.visitId)),
  complete: handle(req => business.complete(req.user, req.params.id, req.body)),
};
