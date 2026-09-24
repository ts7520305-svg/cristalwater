const business = require('../business/equipment/EquipmentMaintenanceBusiness');
const reminders = require('../business/equipment/EquipmentMaintenanceReminderBusiness');
const billing = require('../business/equipment/MaintenanceBillingBusiness');
const materials = require('../services/equipmentMaterialReviewService');
const resources = require('../services/reminderResourceService');
const reminderMaterials = require('../services/reminderMaterialService');
const reminderVisits = require('../services/reminderVisitService');
const resourceHandle = fn => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || e.statusCode || 503).json({ ok:false,error:e.status || e.statusCode ? e.message : 'Não foi possível confirmar os recursos do lembrete. Conserve o pedido e consulte o resultado.' }); } };
const materialHandle = fn => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || e.statusCode || 503).json({ ok: false, error: e.status || e.statusCode ? e.message : 'Não foi possível confirmar os materiais. Conserve o pedido e consulte o resultado antes de repetir.' }); } };
const handle = fn => async (req, res, next) => { try { res.json(await fn(req)); } catch (e) { if (e.code === 'P2002') return res.status(409).json({ ok: false, error: 'Já existe um plano com este título nesta piscina. Atualize a lista ou escolha outro título.' }); if (e.status || e.statusCode) return res.status(e.status || e.statusCode).json({ ok: false, error: e.message }); next(e); } };
module.exports = {
  reminderVisits: resourceHandle(req => reminderVisits.detail(req.user, req.params.id)),
  reminderVisitCandidates: resourceHandle(req => reminderVisits.candidates(req.user, req.params.id, req.query)),
  previewReminderVisit: resourceHandle(req => reminderVisits.preview(req.user, req.params.id, req.body)),
  associateReminderVisit: resourceHandle(req => reminderVisits.command(req.user, req.params.id, req.body)),
  recoverReminderVisit: resourceHandle(req => reminderVisits.recover(req.user, req.params.requestId)),
  reminderMaterials: resourceHandle(req => reminderMaterials.detail(req.user, req.params.id)),
  previewReminderMaterials: resourceHandle(req => reminderMaterials.preview(req.user, req.params.id, req.body)),
  consumeReminderMaterials: resourceHandle(req => reminderMaterials.command(req.user, req.params.id, req.body)),
  recoverReminderMaterials: resourceHandle(req => reminderMaterials.recover(req.user, req.params.requestId)),
  reminderResources: resourceHandle(req => resources.detail(req.user, req.params.id)),
  previewReminderResources: resourceHandle(req => resources.preview(req.user, req.params.id, req.body)),
  declareReminderResources: resourceHandle(req => resources.command(req.user, req.params.id, req.body)),
  recoverReminderResources: resourceHandle(req => resources.recover(req.user, req.params.requestId)),
  materials: materialHandle(req => materials.detail(req.user, req.params.id)),
  previewMaterials: materialHandle(req => materials.preview(req.user, req.params.id, req.body)),
  reviewMaterials: materialHandle(req => materials.command(req.user, req.params.id, req.body)),
  recoverMaterials: materialHandle(req => materials.recover(req.user, req.params.requestId)),
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
