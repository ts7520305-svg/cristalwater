const { prisma } = require('../prismaClient');
const { normalizeRole } = require('../utils/roles');
const { sendPush } = require('./pushService');
const { randomUUID } = require('crypto');
const fieldRequests = require('./fieldWriteRequestService');

function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
const privileged = user => normalizeRole(user?.role) === 'ADMIN';
const techId = user => Number(user?.technicianId || user?.id || 0);
const isWater = row => row && (row.sourceKey?.startsWith('water:') || row.sourceKey?.startsWith('pump:') || /^Agua aberta - /i.test(row.title));
const kindFor = row => row?.sourceKey?.startsWith('pump:') ? 'PUMP_MANUAL' : 'WATER_OPEN';
const labelFor = row => kindFor(row)==='PUMP_MANUAL' ? 'Bomba em manual' : 'Água aberta';
function authorize(user, row) {
  if (!isWater(row)) fail(404, 'Lembrete de água não encontrado');
  if (!privileged(user) && row.assignedToTechnicianId !== techId(user)) fail(403, 'Lembrete de outro técnico');
}
async function contextForVisit(tx, user, body) {
  const id = Number(body.visitId);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) fail(400, 'Indique a visita associada à água');
  const visitType = body.visitType === undefined ? 'REGULAR' : body.visitType;
  if (!['REGULAR','EXTRA'].includes(visitType)) fail(400, 'Tipo de visita inválido');
  if (visitType === 'EXTRA' && (!Number.isSafeInteger(body.poolId) || body.poolId <= 0)) fail(400, 'Confirme a piscina da visita extra');
  if (visitType === 'EXTRA') await tx.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${id} FOR UPDATE`;
  else await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${id} FOR UPDATE`;
  const model = visitType === 'EXTRA' ? tx.extraVisit : tx.serviceVisit;
  const visit = await model.findUnique({ where: { id }, include: { pool: true, client: true, technician: true } });
  if (!visit) fail(404, 'Visita não encontrada');
  if (normalizeRole(user?.role) !== 'ADMIN' && visit.technicianId !== techId(user)) fail(403, 'Visita de outro técnico');
  if (!visit.poolId) fail(400, 'Visita sem piscina');
  if (visit.clientId && visit.clientId !== visit.pool?.clientId) fail(409, 'Cliente e piscina da visita não correspondem');
  for (const field of ['poolId', 'clientId', 'technicianId']) {
    if (body[field] && Number(body[field]) !== Number(visit[field] || (field === 'clientId' ? visit.pool?.clientId : 0))) fail(400, 'Contexto da visita inválido');
  }
  return { ...visit, visitType };
}
function dueDateFor(body) {
  let due = body.dueAt ? new Date(body.dueAt) : null;
  const minutes = Number(body.minutes || body.delayMinutes || body.afterMinutes || body.closeInMinutes);
  if (!due && minutes > 0 && minutes <= 1440) due = new Date(Date.now() + minutes * 60000);
  if (!due && /^\d{1,2}:\d{2}$/.test(body.time || '')) {
    const [h, m] = body.time.split(':').map(Number);
    if (h < 24 && m < 60) { due = new Date(); due.setHours(h, m, 0, 0); if (due <= new Date()) due.setDate(due.getDate() + 1); }
  }
  // Past dates must be accepted for a reminder first uploaded after an offline period.
  if (!due || !Number.isFinite(due.getTime()) || due > new Date(Date.now() + 86400000)) fail(400, 'Indique um prazo válido, até 24 horas');
  return due;
}
async function trace(tx, reminder, status) {
  const meta = reminder.metadata || {};
  const line = `[${labelFor(reminder)} ${status}] ${new Date().toISOString()} - ${reminder.title}`;
  if (meta.visitId) {
    const extra = meta.visitType === 'EXTRA', id = Number(meta.visitId), field = extra ? 'internalNote' : 'internalNotes';
    if (extra) await tx.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${id} FOR UPDATE`;
    else await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${id} FOR UPDATE`;
    const model = extra ? tx.extraVisit : tx.serviceVisit;
    const visit = await model.findUnique({ where: { id } });
    if (visit && visit.poolId === reminder.poolId) await model.update({ where: { id }, data: { [field]: [visit[field], line].filter(Boolean).join('\n').slice(-6000) } });
  }
  if (reminder.poolId) await tx.technicalHistory.create({ data: { poolId: reminder.poolId, type: kindFor(reminder), component: labelFor(reminder), message: status, description: line, performedAt: new Date(), status, nextSuggested: status === 'CLOSED' ? null : reminder.dueDate } });
}
async function notify(tx, reminder, eventType, role) {
  return tx.notification.create({ data: {
    clientId: reminder.clientId, role, type: kindFor(reminder), eventType,
    title: `${labelFor(reminder)} — ${eventType.endsWith('_OVERDUE') ? 'confirmar agora' : 'lembrete registado'}`,
    message: `${reminder.title}. ${kindFor(reminder)==='PUMP_MANUAL' ? 'Verificar e confirmar o regresso da bomba a automático.' : 'Verificar e confirmar o fecho da torneira.'}`,
    severity: eventType.endsWith('_OVERDUE') ? 'CRITICAL' : 'WARNING', status: 'PENDING',
    metadata: { ...reminder.metadata, reminderId: reminder.id, poolId: reminder.poolId, technicianId: reminder.assignedToTechnicianId, dueAt: reminder.dueDate.toISOString(), href: role === 'ADMIN' ? '/admin-alerts?origin=water-open' : '/technician-field-mode' }
  } });
}
async function create(user, body = {}, kind = "WATER_OPEN") {
  const pump=kind==='PUMP_MANUAL';
  const dueDate = dueDateFor(body);
  const localId = String(body.localId || randomUUID());
  if (!localId.trim() || localId.length > 160) fail(400, 'Identificador de lembrete inválido');
  const owner = body.owner === undefined ? null : fieldRequests.owner(user);
  if (owner && body.owner !== owner) fail(403, 'A conta do pedido mudou. Conserve o registo original');
  let requestPayload, payloadHash;
  if (owner) {
    requestPayload = Object.fromEntries(['visitType','visitId','poolId','clientId','dueAt','note','flowState','openedAt'].map(key => [key, body[key]]));
    if (!['REGULAR','EXTRA'].includes(body.visitType) || !['visitId','poolId','clientId'].every(key=>Number.isSafeInteger(body[key])&&body[key]>0&&body[key]<=2147483647) || typeof body.note !== 'string' || body.note.length>4000 || !['DRIP','HALF','FULL'].includes(body.flowState) || !Number.isFinite(Date.parse(body.openedAt)) || !Number.isFinite(Date.parse(body.dueAt))) fail(400, 'Conserve os dados originais do lembrete');
    payloadHash = fieldRequests.hash({kind, ...requestPayload});
  }
  const result = await prisma.$transaction(async tx => {
    const visit = await contextForVisit(tx, user, body);
    const sourceKey = `${pump ? 'pump' : 'water'}:${owner || visit.technicianId || 'admin'}:${localId}`;
    // A transaction lock also protects the absence of a row during concurrent retries.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))::text`;
    const existing = await tx.operationalReminder.findUnique({ where: { sourceKey } });
    if (existing) {
      authorize(user, existing);
      if (existing.metadata?.visitId !== visit.id || (existing.metadata?.visitType || 'REGULAR') !== visit.visitType || existing.poolId !== visit.poolId || (owner && existing.metadata?.payloadHash !== payloadHash)) fail(409, 'Identificador já usado noutro pedido. Conserve o registo original');
      return { reminder: existing, idempotent: true };
    }
    if (['CANCELLED','CANCELED','VOID','CANCELADA'].includes(String(visit.status).toUpperCase())) fail(409, 'Visita cancelada. Contacte o escritório para registar a situação');
    const reminder = await tx.operationalReminder.create({ data: {
      title: `${pump ? 'Bomba manual' : 'Agua aberta'} - ${visit.pool?.name || 'Piscina'}`, description: String(body.note || '').slice(0, 4000), dueDate,
      clientId: visit.clientId || visit.pool?.clientId, poolId: visit.poolId, assignedToTechnicianId: visit.technicianId,
      sourceKey, metadata: { kind, ...(owner ? {owner,payloadHash} : {}), technicianName: visit.technician?.name || '', localId, visitId: visit.id, visitType:visit.visitType, poolName: visit.pool?.name || '', clientName: visit.client?.name || '', flowState: ['DRIP','HALF','FULL'].includes(body.flowState) ? body.flowState : 'FULL', openedAt: body.openedAt && Number.isFinite(Date.parse(body.openedAt)) ? new Date(body.openedAt).toISOString() : new Date().toISOString() }
    } });
    await trace(tx, reminder, 'OPEN');
    return { reminder, notification: await notify(tx, reminder, `${kind}_CREATED`, 'ADMIN') };
  });
  return { ok: true, ...result };
}
async function transition(user, value, action, { automatic = false, now = new Date() } = {}) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) fail(404, 'Lembrete de água não encontrado');
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "OperationalReminder" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.operationalReminder.findUnique({ where: { id } });
    authorize(user, current);
    const meta = current.metadata || {};
    if (action === 'close') {
      if (current.isCompleted) return { reminder: current, idempotent: true };
      const reminder = await tx.operationalReminder.update({ where: { id }, data: { isCompleted: true, metadata: { ...meta, closedAt: now.toISOString() } } });
      if (meta.alertId) await tx.technicalAlert.updateMany({ where: { id: meta.alertId, poolId: reminder.poolId, type: kindFor(current)==='PUMP_MANUAL'?'BOMBA_MANUAL':'AGUA_ABERTA' }, data: { status: 'RESOLVED', resolvedAt: now } });
      await tx.notification.updateMany({ where: { eventType: `${kindFor(current)}_OVERDUE`, metadata: { path: ['reminderId'], equals: id } }, data: { status: 'RESOLVED' } });
      await trace(tx, reminder, 'CLOSED');
      return { reminder };
    }
    if (current.isCompleted || meta.alarmedAt || (automatic && current.dueDate > now)) return { reminder: current, idempotent: true };
    const alert = await tx.technicalAlert.create({ data: { poolId: current.poolId, type: kindFor(current)==='PUMP_MANUAL'?'BOMBA_MANUAL':'AGUA_ABERTA', message: `${labelFor(current)} por confirmar: ${current.title}`, priority: 'CRITICAL', status: 'OPEN' } });
    const reminder = await tx.operationalReminder.update({ where: { id }, data: { metadata: { ...meta, alarmedAt: now.toISOString(), alertId: alert.id } } });
    await trace(tx, reminder, 'OVERDUE');
    const notifications = [];
    for (const role of ['ADMIN', 'TECHNICIAN']) notifications.push(await notify(tx, reminder, `${kindFor(reminder)}_OVERDUE`, role));
    return { reminder, alert, notifications };
  });
  // Durable notification rows are committed before any external delivery is attempted.
  return { ok: true, ...result };
}
async function list(user, kind = "WATER_OPEN") {
  const where = kind==='PUMP_MANUAL' ? {sourceKey:{startsWith:'pump:'}} : { OR: [{ sourceKey: { startsWith: 'water:' } }, { title: { startsWith: 'Agua aberta - ' } }] };
  if (!privileged(user)) where.assignedToTechnicianId = techId(user);
  const [active, closed] = await Promise.all([
    prisma.operationalReminder.findMany({ where: { ...where, isCompleted: false }, orderBy: { dueDate: 'asc' } }),
    prisma.operationalReminder.findMany({ where: { ...where, isCompleted: true }, orderBy: { updatedAt: 'desc' }, take: 100 })
  ]);
  const transferred = privileged(user) ? [] : await prisma.operationalReminder.findMany({where:{AND:[kind==='PUMP_MANUAL'?{sourceKey:{startsWith:'pump:'}}:{sourceKey:{startsWith:'water:'}}, {metadata:{path:['previousOwners'],array_contains:[techId(user)]}},{assignedToTechnicianId:{not:techId(user)}}]}});
  return { ok: true, reminders: [...active, ...closed, ...transferred.map(row=>({...row,transferredAway:true}))] };
}
async function handoverTargets() {
  return {ok:true,technicians:await prisma.technician.findMany({where:{active:true},select:{id:true,name:true},orderBy:{name:'asc'}})};
}
async function incomingHandovers(user) {
  const reminders=await prisma.operationalReminder.findMany({where:{isCompleted:false,AND:[{metadata:{path:['handover','to'],equals:techId(user)}},{metadata:{path:['handover','status'],equals:'PENDING'}}]},orderBy:{dueDate:'asc'}});
  return {ok:true,reminders};
}
async function handover(user, value, action, body = {}) {
  const id=Number(value);
  if(!Number.isSafeInteger(id)||id<=0)fail(404,'Lembrete não encontrado');
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "OperationalReminder" WHERE id = ${id} FOR UPDATE`;
    const current=await tx.operationalReminder.findUnique({where:{id}});
    if(!isWater(current))fail(404,'Lembrete não encontrado');
    const meta=current.metadata||{}, previous=meta.handover;
    if(action==='request') {
      authorize(user,current);
      if(current.isCompleted)fail(409,'Lembrete já resolvido');
      if(previous?.status==='PENDING')fail(409,'Já existe uma passagem por aceitar');
      const to=Number(body.technicianId),reason=String(body.reason||'').trim();
      if(!Number.isSafeInteger(to)||to<=0||to===current.assignedToTechnicianId||reason.length<3||reason.length>1000)fail(400,'Escolha outro técnico e indique o motivo (3–1000 caracteres)');
      const target=await tx.technician.findUnique({where:{id:to},select:{active:true,name:true}});
      if(!target?.active)fail(400,'Técnico indisponível');
      const proposal={id:randomUUID(),from:current.assignedToTechnicianId,to,toName:target.name,reason,status:'PENDING',requestedAt:new Date().toISOString(),requestedBy:techId(user),requestedByRole:normalizeRole(user?.role)};
      const reminder=await tx.operationalReminder.update({where:{id},data:{metadata:{...meta,handover:proposal}}});
      await trace(tx,reminder,`HANDOVER_REQUESTED ${proposal.from} → ${to}: ${reason}`);
      return {ok:true,reminder};
    }
    if(!previous||body.handoverId!==previous.id)fail(409,'Pedido alterado. Atualize a lista');
    if(action==='accept') {
      if(!['TECHNICIAN','TECNICO'].includes(normalizeRole(user?.role))||techId(user)!==previous.to)fail(403,'Só o técnico destinatário pode aceitar');
      if(previous.status==='ACCEPTED'&&current.assignedToTechnicianId===techId(user))return {ok:true,reminder:current,idempotent:true};
      if(current.isCompleted||previous.status!=='PENDING'||current.assignedToTechnicianId!==previous.from)fail(409,'A passagem já não está disponível');
      const target=await tx.technician.findUnique({where:{id:previous.to},select:{active:true,name:true}});
      if(!target?.active)fail(403,'Técnico inativo');
      const reminder=await tx.operationalReminder.update({where:{id},data:{assignedToTechnicianId:previous.to,metadata:{...meta,previousOwners:[...new Set([...(meta.previousOwners||[]),previous.from])],technicianName:target.name,handover:{...previous,status:'ACCEPTED',acceptedAt:new Date().toISOString()}}}});
      // Existing overdue delivery follows the newly accepted responsibility.
      await tx.notification.updateMany({where:{eventType:`${kindFor(current)}_OVERDUE`,role:'TECHNICIAN',status:{in:['PENDING','SENT']},metadata:{path:['reminderId'],equals:id}},data:{status:'RESOLVED'}});
      if(meta.alarmedAt)await notify(tx,reminder,`${kindFor(current)}_OVERDUE`,'TECHNICIAN');
      await trace(tx,reminder,`HANDOVER_ACCEPTED ${previous.from} → ${previous.to}`);
      return {ok:true,reminder};
    }
    if(action==='cancel') {
      authorize(user,current);
      if(previous.status!=='PENDING')fail(409,'A passagem já não pode ser cancelada');
      const reminder=await tx.operationalReminder.update({where:{id},data:{metadata:{...meta,handover:{...previous,status:'CANCELLED',cancelledAt:new Date().toISOString()}}}});
      await trace(tx,reminder,`HANDOVER_CANCELLED ${previous.from} → ${previous.to}`);
      return {ok:true,reminder};
    }
    fail(400,'Ação inválida');
  });
}
const REPEAT_INTERVAL_MS = 15 * 60000;
async function repeatOverdue(id, now = new Date()) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "OperationalReminder" WHERE id = ${Number(id)} FOR UPDATE`;
    const current = await tx.operationalReminder.findUnique({where:{id:Number(id)}});
    if (!isWater(current) || current.isCompleted || current.dueDate > now || !current.metadata?.alarmedAt) return {repeated:false};
    const meta=current.metadata,last=Date.parse(meta.lastRepeatedAt || meta.alarmedAt);
    if (!Number.isFinite(last) || now.getTime()-last < REPEAT_INTERVAL_MS) return {repeated:false};
    // Replace delivery attempts, never the unresolved operational reminder or alert.
    await tx.notification.updateMany({where:{eventType:`${kindFor(current)}_OVERDUE`,status:{in:['PENDING','SENT']},metadata:{path:['reminderId'],equals:current.id}},data:{status:'SUPERSEDED'}});
    const reminder=await tx.operationalReminder.update({where:{id:current.id},data:{metadata:{...meta,lastRepeatedAt:now.toISOString(),repeatCount:Number(meta.repeatCount||0)+1}}});
    for (const role of ['ADMIN','TECHNICIAN']) await notify(tx,reminder,`${kindFor(reminder)}_OVERDUE`,role);
    return {repeated:true};
  });
}
let processing = false;
async function processOverdue(now = new Date()) {
  if (processing) return { skipped: true };
  processing = true;
  let result;
  try {
    const pending = await prisma.operationalReminder.findMany({ where: { isCompleted: false, dueDate: { lte: now }, OR: [{ sourceKey: { startsWith: 'water:' } }, {sourceKey:{startsWith:'pump:'}}, { title: { startsWith: 'Agua aberta - ' } }] }, orderBy: { dueDate: 'asc' } });
    let escalated = 0, repeated = 0;
    for (const row of pending) {
      if (!row.poolId) continue;
      if(row.metadata?.alarmedAt){if((await repeatOverdue(row.id,now)).repeated)repeated++;continue;}
      await transition({ role: 'ADMIN' }, row.id, 'alarm', { automatic: true, now }); escalated++;
    }
    result={escalated,repeated};
  } finally { processing=false; }
  await deliverCriticalNotifications();
  return result;
}
let delivering=false;
async function deliverCriticalNotifications(){
  if(delivering)return {skipped:true};
  delivering=true;
  try {
    // Admin push only: legacy DeviceToken has no technician identity. Never broadcast client details to every technician.
    const notifications = await prisma.notification.findMany({ where: { eventType: {in:['WATER_OPEN_OVERDUE','PUMP_MANUAL_OVERDUE']}, role: 'ADMIN', status: 'PENDING' }, take: 100 });
    const tokens = notifications.length ? await prisma.deviceToken.findMany({ where: { role: 'ADMIN', active: true } }) : [];
    for (const notification of notifications) {
      const deliveries=[];
      for(const token of tokens){
        if(!await require('./browserPushService').stillCurrent(notification))break;
        deliveries.push(await sendPush(token.token,notification.title,notification.message,{notificationId:notification.id,href:'/admin-alerts?origin=water-open'}));
      }
      if(deliveries.length===tokens.length&&deliveries.length&&deliveries.every(d=>d.ok))await prisma.notification.updateMany({where:{id:notification.id,status:'PENDING'},data:{status:'SENT'}});
    }
    await require('./browserPushService').deliverWaterNotifications();
  } finally { delivering=false; }
}
function startScheduler() {
  // Field safety monitoring is independent of optional billing/AI jobs.
  if (process.env.NODE_ENV === 'test' || process.env.QA_MODE === 'true') return null;
  const run = () => processOverdue().catch(e => console.error('WATER_REMINDER_JOB_ERROR', e.message));
  run(); const timer = setInterval(run, 60000); timer.unref(); return timer;
}
module.exports = { create, transition, list, processOverdue, startScheduler, handoverTargets, incomingHandovers, handover, repeatOverdue, REPEAT_INTERVAL_MS };
