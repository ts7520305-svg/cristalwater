'use strict';
const { prisma } = require('../prismaClient');
const writes = require('./fieldWriteRequestService'), targets = require('./expenseMaintenanceTargets');
const rules = require('../../frontend/cw-reminder-resource-rules'), { roleMatches } = require('../utils/roles');
const json = v => JSON.parse(JSON.stringify(v));
const refuse = (code, message) => ({ available:false,code,message });
const sourceSelect = { id:true,title:true,description:true,category:true,status:true,completedAt:true,clientId:true,poolId:true,technicianId:true };
const facts = t => t ? Object.fromEntries(Object.entries(t.snapshot).filter(([k]) => !['label','clientName'].includes(k))) : null;
function admin(actor) { if (!roleMatches(actor?.role, 'ADMIN')) writes.fail('Só a administração pode confirmar recursos dos lembretes.', 403); return writes.owner(actor); }
function id(value) { const n = Number(value); if (!rules.positive(n) || typeof value !== 'number' && String(n) !== value) writes.fail('Identificador de lembrete inválido.'); return n; }
function parse(body, command = false) {
  if (!rules.fields(body, command ? ['requestId','action','recordId','data','previewHash','reason','confirmed'] : ['action','recordId','data']) || !['DECLARE','VOID'].includes(body.action)) writes.fail('Reveja os campos da declaração.');
  if (body.action === 'VOID') { if (!rules.positive(body.recordId) || body.data !== null) writes.fail('Identifique a declaração a anular.'); }
  else { let data; try { data=rules.input(body.data); } catch (_) { writes.fail('Reveja o técnico, os recursos e os horários da declaração.'); } if (body.recordId !== null || writes.hash(data) !== writes.hash(body.data)) writes.fail('Reveja os recursos e as quantidades normalizadas.'); }
  if (command && (!rules.uuid(body.requestId) || !rules.sha(body.previewHash) || !rules.reason(body.reason) || body.confirmed !== true)) writes.fail('Indique o motivo e confirme expressamente os recursos.');
}
async function intact(row, receipts) {
  try {
    const saved = receipts.find(r => r.owner === row.owner && r.requestId === row.requestId), result = row.result;
    if (!saved || writes.hash(saved.response) !== writes.hash(result) || saved.scope !== rules.scope || saved.resourceId !== row.reminderId || saved.payloadHash !== result.receipt?.payloadHash) return false;
    await rules.response(result, result.envelope, row.owner, row.reminderId, writes.hash);
    const e = result.event, p = e.preview, d = p.proposed;
    if (!result.applied || p.action !== 'DECLARE' || e.recordId !== row.id || writes.hash(row.snapshot) !== row.fingerprint || row.fingerprint !== result.eventHash || writes.hash(row.snapshot) !== writes.hash(e) || row.createdAt.toISOString() !== e.createdAt || row.clientId !== p.origin.clientId || row.poolId !== p.origin.poolId || row.technicianId !== d.technicianId || (row.startedAt?.toISOString() || null) !== (d.workTime?.startedAt || null) || (row.endedAt?.toISOString() || null) !== (d.workTime?.endedAt || null)) return false;
    const voids = receipts.filter(r => r.response?.applied === true && r.response?.event?.preview?.action === 'VOID' && r.response.event.recordId === row.id);
    if (!row.voidedAt) return row.activeKey === 'REMINDER:' + row.reminderId && row.voidedBy === null && row.voidReason === null && voids.length === 0;
    if (row.activeKey !== null || voids.length !== 1) return false;
    const v = voids[0], ve = v.response.event;
    await rules.response(v.response, v.response.envelope, v.owner, row.reminderId, writes.hash);
    return v.scope === rules.scope && v.resourceId === row.reminderId && v.payloadHash === v.response.receipt.payloadHash && v.requestId === ve.id && v.response.event.preview.recordHash === row.fingerprint && writes.hash(ve.preview.origin) === writes.hash(p.origin) && row.voidedAt.toISOString() === ve.createdAt && row.voidedBy === ve.owner && row.voidReason === ve.reason;
  } catch (_) { return false; }
}
const workRow = row => ({ type:'REMINDER_RESOURCE',id:row.id,technicianId:row.technicianId,startAt:row.startedAt,endAt:row.endedAt });
async function context(db, reminderId, lock = false, input = null) {
  if (lock) await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'reminder-resources:' + reminderId }))::text`;
  const target = await targets.get(db, 'MAINTENANCE_REMINDER', reminderId, lock);
  if (lock) {
    await db.$queryRaw`SELECT id FROM "ReminderResourceDeclaration" WHERE "reminderId"=${reminderId} FOR UPDATE`;
    const old = input?.action === 'VOID' ? await db.reminderResourceDeclaration.findUnique({ where:{ id:input.recordId } }) : null;
    const tech = old?.technicianId || input?.data?.technicianId;
    if (tech) { await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'repair-work-technician:' + tech }))::text`; await db.$queryRaw`SELECT id FROM "Technician" WHERE id=${tech} FOR SHARE`; }
    await db.$queryRaw`SELECT id FROM "FieldWriteRequest" WHERE scope=${rules.scope} AND "resourceId"=${reminderId} FOR SHARE`;
  }
  const [reminder, rows, receipts, technicians] = await Promise.all([
    db.generalReminder.findUnique({ where:{ id:reminderId },select:sourceSelect }),
    db.reminderResourceDeclaration.findMany({ where:{ reminderId },orderBy:{ id:'asc' } }),
    db.fieldWriteRequest.findMany({ where:{ scope:rules.scope,resourceId:reminderId },orderBy:{ id:'asc' } }),
    db.technician.findMany({ select:{ id:true,name:true,active:true },orderBy:[{ name:'asc' },{ id:'asc' }] })
  ]);
  if (!reminder && !rows.length) return refuse('NOT_FOUND', 'Lembrete ou histórico não encontrado.');
  const source = reminder ? json(reminder) : null, targetFacts = facts(target), known = new Set(technicians.map(t => t.id));
  const overlaps = await require('./recordedWorkTimeService').conflicts(db, rows.filter(r => !r.voidedAt && r.startedAt).map(workRow));
  const records = await Promise.all(rows.map(async row => {
    const valid = await intact(row, receipts), reasons = [];
    if (!valid) reasons.push('DECLARATION_EVIDENCE_CHANGED');
    if (!target?.valid || target.hash !== row.snapshot?.preview?.targetHash || writes.hash(source) !== row.snapshot?.preview?.sourceHash) reasons.push('EXECUTION_EVIDENCE_CHANGED');
    if (!known.has(row.technicianId)) reasons.push('TECHNICIAN_MISSING');
    if (!row.voidedAt && overlaps.has('REMINDER_RESOURCE:' + row.id)) reasons.push('RECORDED_TIME_OVERLAP');
    const voidResult = receipts.find(r => r.response?.applied === true && r.response?.event?.preview?.action === 'VOID' && r.response.event.recordId === row.id)?.response || null;
    return { ...json(row),voidResult,intact:valid,state:!valid ? 'REVIEW' : row.voidedAt ? 'VOIDED' : reasons.length ? 'REVIEW' : 'CONFIRMED',reasons,canVoid:valid && !row.voidedAt };
  }));
  const poolId = source?.poolId || rows[0]?.poolId;
  const pool = poolId ? await db.pool.findUnique({ where:{ id:poolId },select:{ name:true } }) : null;
  let journalValid = records.every(r => r.intact);
  for (const receipt of receipts) {
    try { await rules.response(receipt.response,receipt.response.envelope,receipt.owner,reminderId,writes.hash);
      if (receipt.requestId!==receipt.response.receipt.requestId || receipt.payloadHash!==receipt.response.receipt.payloadHash || receipt.response.applied && !records.some(row=>row.id===receipt.response.event.recordId)) journalValid=false;
    } catch (_) { journalValid=false; }
  }
  const active = records.filter(r => !r.voidedAt);
  const contextHash = writes.hash({ source,target:target?.hash || null,journalValid,records:records.map(r => ({ id:r.id,fingerprint:r.fingerprint,voidedAt:r.voidedAt,voidedBy:r.voidedBy,voidReason:r.voidReason,state:r.state,reasons:r.reasons })),technicians:[...technicians].sort((a,b) => a.id-b.id) });
  return { available:true,reminderId,source,target:targetFacts,targetHash:target?.hash || null,sourceHash:writes.hash(source),contextHash,title:source?.title || 'Lembrete removido — histórico preservado',clientName:target?.clientName || '',poolName:pool?.name || '',technicians,records,active,journalValid,canDeclare:!!target?.valid && !!source && ['TECHNICAL_PERIODIC_SERVICE','POOL_SERVICE_REMINDER'].includes(source.category) && journalValid && active.length === 0 };
}
async function calculate(db, reminderId, body, lock = false) {
  parse(body); const c = await context(db, reminderId, lock, body); if (!c.available) return c;
  let origin, proposed = null, recordHash = null, source = null, target = null, targetHash = null, sourceHash = null, durationSeconds = null;
  if (body.action === 'VOID') {
    const row = c.records.find(r => r.id === body.recordId);
    if (!row?.canVoid) return refuse('DECLARATION_REVIEW', 'A declaração mudou, já foi anulada ou o comprovativo precisa de revisão.');
    origin = row.snapshot.preview.origin; recordHash = row.fingerprint;
  } else {
    if (!c.canDeclare) return refuse('REMINDER_SOURCE_REVIEW', c.active.length ? 'Já existe uma declaração ativa. Reveja e anule a declaração anterior antes de a substituir.' : 'Confirme a conclusão e a decisão comercial do lembrete. Reveja os comprovativos existentes.');
    proposed = rules.input(body.data); source = c.source; target = c.target; targetHash = c.targetHash; sourceHash = c.sourceHash;
    if (!c.technicians.some(t => t.id === proposed.technicianId) || source.technicianId !== null && source.technicianId !== proposed.technicianId) return refuse('TECHNICIAN_REVIEW', 'Identifique o técnico da execução. Tem de corresponder ao técnico atribuído ao lembrete.');
    origin = { reminderId,clientId:source.clientId,poolId:source.poolId,technicianId:proposed.technicianId };
    if (!rules.origin(origin)) return refuse('REMINDER_ORIGIN_REVIEW', 'Confirme o cliente, a piscina e o técnico da execução.');
    if (proposed.workTime) {
      const startedAt = new Date(proposed.workTime.startedAt), endedAt = new Date(proposed.workTime.endedAt);
      if (endedAt > new Date(source.completedAt) || endedAt > new Date()) return refuse('WORK_TIME_BOUNDS', 'O trabalho deve terminar até à conclusão do lembrete e não pode estar no futuro.');
      if ((await require('./recordedWorkTimeService').conflicts(db, [{ type:'REMINDER_RESOURCE',id:null,technicianId:proposed.technicianId,startAt:startedAt,endAt:endedAt }])).size) return refuse('WORK_TIME_CONFLICT', 'Este técnico já tem trabalho registado nesse intervalo. Exclua tempos de outras intervenções.');
      durationSeconds = (endedAt-startedAt)/1000;
    }
  }
  const value = { schema:1,basis:rules.basis,reminderId,action:body.action,recordId:body.recordId,recordHash,origin,contextHash:c.contextHash,source,sourceHash,target,targetHash,proposed,durationSeconds };
  return rules.preview({ available:true,...value,hash:writes.hash(value) }, writes.hash);
}
async function detail(actor, value) { admin(actor); const rid=id(value); return prisma.$transaction(async db => ({ ok:true,detail:await context(db,rid) }), { isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000 }); }
async function preview(actor, value, body) { admin(actor); const rid=id(value); parse(body); return prisma.$transaction(async db => ({ ok:true,preview:await calculate(db,rid,body) }), { isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000 }); }
async function command(actor, value, body) {
  const owner=admin(actor), reminderId=id(value); parse(body,true); const { requestId,...payload }=body, request=writes.context(actor,rules.scope,reminderId,requestId,payload);
  return prisma.$transaction(async db => {
    const saved=await writes.recover(db,request); if(saved)return saved;
    const p=await calculate(db,reminderId,{ action:body.action,recordId:body.recordId,data:body.data },true);
    if(!p.available || p.hash!==body.previewHash)return writes.confirm(db,request,{ ok:true,applied:false,envelope:body,code:p.code || 'PREVIEW_CHANGED',message:p.message || 'A execução, o técnico ou o histórico mudou. Atualize e confirme novamente.' });
    const createdAt=new Date(); let recordId=body.recordId;
    if(body.action==='DECLARE') {
      const d=p.proposed;
      const row=await db.reminderResourceDeclaration.create({ data:{ reminderId,clientId:p.origin.clientId,poolId:p.origin.poolId,technicianId:d.technicianId,owner,requestId,fingerprint:'0'.repeat(64),snapshot:{},result:{},createdAt,activeKey:'REMINDER:'+reminderId,startedAt:d.workTime ? new Date(d.workTime.startedAt) : null,endedAt:d.workTime ? new Date(d.workTime.endedAt) : null } }); recordId=row.id;
    } else await db.reminderResourceDeclaration.update({ where:{ id:recordId },data:{ activeKey:null,voidedAt:createdAt,voidedBy:owner,voidReason:body.reason } });
    const event={ schema:1,basis:rules.basis,id:requestId,owner,reminderId,recordId,reason:body.reason,createdAt:createdAt.toISOString(),preview:p };
    const result=await writes.confirm(db,request,{ ok:true,applied:true,envelope:body,event,eventHash:writes.hash(event) });
    await rules.response(result,body,owner,reminderId,writes.hash);
    if(body.action==='DECLARE')await db.reminderResourceDeclaration.update({ where:{ id:recordId },data:{ snapshot:event,fingerprint:result.eventHash,result } });
    await db.technicalHistory.create({ data:{ poolId:p.origin.poolId,type:rules.scope,status:body.action==='DECLARE'?'CONFIRMED':'VOIDED',message:'Recursos do lembrete #'+reminderId+': '+body.reason,description:JSON.stringify({ requestId,recordId,eventHash:result.eventHash }),performedAt:createdAt } });
    await db.userAuditLog.create({ data:{ actor:owner,action:rules.scope,entity:'ReminderResourceDeclaration',entityId:String(recordId),metadata:{ requestId,reminderId,action:body.action,eventHash:result.eventHash } } });
    return result;
  },{ isolationLevel:'ReadCommitted',maxWait:15000,timeout:25000 });
}
async function recover(actor, requestId) { const owner=admin(actor); if(!rules.uuid(requestId))writes.fail('Identificador de pedido inválido.'); const row=await prisma.fieldWriteRequest.findUnique({ where:{ owner_requestId:{ owner,requestId } } }); if(!row || row.scope!==rules.scope)writes.fail('Não existe confirmação deste pedido para esta conta.',404); return row.response; }
module.exports={ detail,preview,command,recover,context,calculate,intact,workRow,rules };
