'use strict';
const r = require('./expenseLedgerRules'), source = require('./financialMaintenanceRevenueService');
const types = { MAINTENANCE_EQUIPMENT: 'EQUIPMENT', MAINTENANCE_REMINDER: 'REMINDER' };
const basis = 'CONFIRMED_MAINTENANCE_EXECUTION_AND_DECISION';
const proofFields = ['executionBasis','decisionId','decisionFingerprint','executionFingerprint','originVisitType','originVisitId'];
const positive = n => Number.isSafeInteger(n) && n > 0;
const json = value => JSON.parse(JSON.stringify(value));
const equipmentSelect = { id:true,planId:true,version:true,visitId:true,extraVisitId:true,notes:true,completedAt:true,result:true,plan:{select:{id:true,poolId:true}},visit:{select:source.visitSelect},extraVisit:{select:source.visitSelect} };
const reminderSelect = { id:true,title:true,description:true,category:true,status:true,completedAt:true,clientId:true,poolId:true };
async function read(db, type, ids) {
  if (!ids.length) return [];
  const kind = types[type]; if (!kind) r.fail('Tipo de manutenção inválido.');
  const [rows, decisions, associations] = await Promise.all([
    kind === 'EQUIPMENT' ? db.equipmentMaintenanceCompletion.findMany({where:{id:{in:ids}},select:equipmentSelect}) : db.generalReminder.findMany({where:{id:{in:ids}},select:reminderSelect}),
    db.operationalReminder.findMany({where:{sourceKey:{in:ids.map(id=>source.key(kind,id))}},select:{id:true,sourceKey:true,metadata:true}}),
    kind === 'REMINDER' ? require('./reminderVisitJournal').read(db,ids) : new Map()
  ]);
  const receipts = new Map(decisions.map(d=>[d.sourceKey,d])), clientIds = [...new Set(decisions.map(d=>d.metadata?.source?.clientId).filter(positive))];
  const clients = new Map((await db.client.findMany({where:{id:{in:clientIds}},select:{id:true,name:true}})).map(c=>[c.id,c]));
  return rows.map(row=>{
    const decision=receipts.get(source.key(kind,row.id)), proof=decision?.metadata, s=proof?.source, result=proof?.result, client=clients.get(s?.clientId);
    const approved=source.confirmedDecision(proof,kind,row.id) && /^ADMIN:[1-9]\d*$/.test(result?.actor) && (result.mode==='INCLUDED' ? result.amountCents===0 && result.amount===0 && result.status==='INCLUDED' && result.invoiceId===null && result.invoiceLineId===null : result.mode==='EXTRA' && positive(result.amountCents) && Math.round(result.amount*100)===result.amountCents && result.status==='DRAFT' && positive(result.invoiceId) && positive(result.invoiceLineId));
    // Associated reminders cannot receive a second independent cost. Existing
    // receipts keep their original shapes; only current eligibility changes.
    const association=associations.get(row.id), associated=!!association?.active, associationReview=association?.valid===false;
    const valid=!!client && approved && !source.sourceIssue(row,s) && !associated && !associationReview;
    // The parent visit contributes identity only. Its duration, consumption,
    // selling price and later completion state are never copied as this cost.
    const execution = json(row); for(const k of ['visit','extraVisit']) if(execution[k]) execution[k] = {id:execution[k].id,poolId:execution[k].poolId,clientId:execution[k].clientId};
    const facts={type,id:row.id,clientId:client?.id||null,poolId:s?.poolId||null,status:valid?'CONFIRMED':'REVIEW',startAt:null,endAt:valid?row.completedAt.toISOString():null,executionBasis:valid?basis:null,decisionId:decision?.id||null,decisionFingerprint:approved?r.hash(proof):null,executionFingerprint:valid?r.hash(execution):null,originVisitType:s?.visitType||null,originVisitId:s?.visitId||null};
    const label=(kind==='EQUIPMENT'?'Manutenção de equipamento #':'Lembrete de serviço #')+row.id+' · '+(s?.title||'Origem por confirmar')+' · '+(facts.endAt?.slice(0,10)||'Execução por confirmar');
    return {type,id:row.id,clientId:facts.clientId,clientName:client?.name||null,label,valid,hash:r.hash(facts),snapshot:{...facts,label,clientName:client?.name||null},warning:associated||associationReview?'Reveja a associação deste lembrete à visita. Os custos próprios estão bloqueados para evitar dupla atribuição.':valid?'Confirme a parcela e o mês desta despesa. O preço comercial e os custos da visita são registos separados.':'Reveja a execução e a decisão histórica da manutenção antes de atribuir despesas.'};
  });
}
async function get(db,type,id,lock=false) {
  if (!lock) return (await read(db,type,[id]))[0]||null;
  const kind=types[type]; if(!kind)r.fail('Tipo de manutenção inválido.');
  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${source.key(kind,id)}))::text`;
  // Match the commercial review order: source -> parent visit/plan -> pool.
  let row;
  if(kind==='EQUIPMENT') {
    await db.$queryRaw`SELECT id FROM "EquipmentMaintenanceCompletion" WHERE id=${id} FOR SHARE`;
    row=await db.equipmentMaintenanceCompletion.findUnique({where:{id},select:equipmentSelect});
    if(row?.visitId)await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${row.visitId} FOR SHARE`;
    if(row?.extraVisitId)await db.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${row.extraVisitId} FOR SHARE`;
    if(row)await db.$queryRaw`SELECT id FROM "EquipmentMaintenancePlan" WHERE id=${row.planId} FOR SHARE`;
  } else {
    await db.$queryRaw`SELECT id FROM "GeneralReminder" WHERE id=${id} FOR SHARE`;
    row=await db.generalReminder.findUnique({where:{id},select:reminderSelect});
  }
  const poolId=kind==='EQUIPMENT'?row?.plan?.poolId:row?.poolId;
  if(poolId)await db.$queryRaw`SELECT id FROM "Pool" WHERE id=${poolId} FOR SHARE`;
  await db.$queryRaw`SELECT id FROM "OperationalReminder" WHERE "sourceKey"=${source.key(kind,id)} FOR SHARE`;
  return (await read(db,type,[id]))[0]||null;
}
async function list(db,type,clientId) {
  const prefix='maintenance-billing:'+types[type]+':';
  const decisions=await db.operationalReminder.findMany({where:{sourceKey:{startsWith:prefix},metadata:{path:['source','clientId'],equals:clientId}},select:{metadata:true}});
  return (await read(db,type,[...new Set(decisions.map(d=>d.metadata?.source?.sourceId).filter(positive))])).sort((a,b)=>b.id-a.id);
}
module.exports={types,basis,proofFields,get,read,list};
