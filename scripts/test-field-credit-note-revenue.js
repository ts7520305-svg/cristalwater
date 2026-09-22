'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
const { prisma } = require('../src/prismaClient'), financial = require('../src/services/aiFinancialContextService');
const notes = require('../src/business/finance/InvoiceCreditNoteBusiness');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
(async () => {
  const month = '2004-06', admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Credit revenue <img src=x> ' + randomUUID(), active: false } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Historical client pool' } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, status: 'DONE', endAt: new Date('2004-05-31T23:59:59Z') } });
  const invoice = await prisma.invoice.create({ data: { clientId: client.id, monthRef: month, status: 'PAID', amount: 100, total: 100, totalAmount: 100, amountPaid: 100,
    lines: { create: { type: 'SERVICE', lineType: 'SERVICE', referenceId: visit.id, description: 'Original service', quantity: 1, unitPrice: 100, total: 100, lineTotal: 100 } },
    payments: { create: { amount: 100, amountCents: 10000, method: 'CASH', paidAt: new Date(month + '-15T12:00:00Z') } } } });
  const before = await financial.snapshot(month);
  const first = await notes.create(invoice.id, { requestId: randomUUID(), amount: 20, reason: 'Service correction <img src=x onerror=alert(1)>', notes: 'QA evidence' }, 'QA', admin);
  let result = await financial.snapshot(month), r = result.revenueCoverage;
  assert.notEqual(result.state, 'UNAVAILABLE');
  assert.equal(r.linkedServiceAmountCents, before.revenueCoverage.linkedServiceAmountCents, 'An authenticated credit must preserve the gross original service amount');
  assert.equal(r.creditNotes.amountCents, 2000);
  assert.equal(r.reconciledDocumentAmountCents, before.revenueCoverage.reconciledDocumentAmountCents - 2000);
  assert.equal(result.cash.amountCents, before.cash.amountCents);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).creditBalance, 20);
  const payload = { requestId:randomUUID(), amount:15, reason:'Second correction', notes:'' };
  await notes.create(invoice.id,payload,'QA',admin);
  await notes.create(invoice.id,payload,'QA',admin);
  result = await financial.snapshot(month); r=result.revenueCoverage;
  assert.equal(r.creditNotes.total,2); assert.equal(r.creditNotes.amountCents,3500); assert.equal(r.creditNotes.creditReleasedCents,3500);
  assert.equal(r.grossDocumentAmountCents,10000); assert.equal(r.reconciledDocumentAmountCents,6500);
  assert.equal(r.linkedServices.rows[0].serviceMonth,'2004-05');
  assert(r.creditNotes.examples.rows.every(x=>x.recordedAt.slice(0,7)!==month));
  assert.equal(result.cash.amountCents,10000); assert.equal(result.customerCredit.amountCents-before.customerCredit.amountCents,3500);
  assert.equal(r.completeRevenueAllocation,false); assert.equal(r.profit,null); assert.equal(r.creditNotes.serviceAllocation,'PARTIAL');
  assert(financial.recommendations(result).some(x=>x.code==='REVIEW_CREDIT_NOTE_ALLOCATION'));
  const answer=financial.localAnswer('Créditos e margem dos serviços',result);
  assert.match(answer,/antes das notas de crédito/);assert.match(answer,/Reduções atribuídas:.*por atribuir:/);assert.match(answer,/Não posso calcular lucro/);
  console.log('PASS documented credit preserves original service, exact reduction and cash');

  const doc = () => prisma.invoice.findUniqueOrThrow({where:{id:invoice.id},include:{lines:true,payments:true}});
  const original = await doc(), creditLine=original.lines.find(l=>l.id===first.creditNoteId), serviceLine=original.lines.find(l=>l.type==='SERVICE');
  const originalAudit=await prisma.auditTrail.findFirstOrThrow({where:{entity:'Invoice',entityId:invoice.id,eventType:'FINANCE_CREDIT_NOTE_CREATED'},orderBy:{id:'asc'}});
  const originalReceipt=await prisma.operationalReminder.findUniqueOrThrow({where:{sourceKey:'invoice-payment:'+originalAudit.metadata.requestId}});
  async function rejected(expected) {
    const f=await financial.snapshot(month); assert.notEqual(f.state,'UNAVAILABLE');
    assert.equal(f.revenueCoverage.creditNotes.total,0); assert.equal(f.revenueCoverage.reconciledDocumentAmountCents,0);
    assert(f.revenueCoverage.issues.rows.some(i=>i.invoiceId===invoice.id&&i.reason===expected),JSON.stringify(f.revenueCoverage.issues));
  }
  // Current ownership does not change the client stored on the original service.
  const other=await prisma.client.create({data:{name:'New pool owner '+randomUUID()}});
  await prisma.pool.update({where:{id:pool.id},data:{clientId:other.id}});
  assert.equal((await financial.snapshot(month)).revenueCoverage.linkedServiceAmountCents,10000);
  for(const patch of [{description:'Edited original service'},{total:99,lineTotal:99},{referenceId:2147483000}]) {
    await prisma.invoiceLine.update({where:{id:serviceLine.id},data:patch});await rejected('CREDIT_NOTE_SOURCE_CHANGED');
    await prisma.invoiceLine.update({where:{id:serviceLine.id},data:{description:serviceLine.description,total:serviceLine.total,lineTotal:serviceLine.lineTotal,referenceId:serviceLine.referenceId}});
  }
  for(const patch of [{type:'SERVICE',lineType:'SERVICE'},{total:-19,lineTotal:-19},{description:'Edited reason'},{sourceMonth:month}]){
    await prisma.invoiceLine.update({where:{id:creditLine.id},data:patch});await rejected(patch.type?'CREDIT_NOTE_ORIGIN_UNCONFIRMED':'CREDIT_NOTE_SOURCE_CHANGED');
    await prisma.invoiceLine.update({where:{id:creditLine.id},data:{type:creditLine.type,lineType:creditLine.lineType,total:creditLine.total,lineTotal:creditLine.lineTotal,description:creditLine.description,sourceMonth:creditLine.sourceMonth}});
  }
  await prisma.invoice.update({where:{id:invoice.id},data:{clientId:other.id}});await rejected('CREDIT_NOTE_ORIGIN_UNCONFIRMED');await prisma.invoice.update({where:{id:invoice.id},data:{clientId:client.id}});
  await prisma.invoice.update({where:{id:invoice.id},data:{month:'historical-alias-changed'}});await rejected('CREDIT_NOTE_SOURCE_CHANGED');await prisma.invoice.update({where:{id:invoice.id},data:{month:original.month}});
  for(const patch of [{amount:0},{amountCents:0},{totalCents:0}]){await prisma.invoice.update({where:{id:invoice.id},data:patch});await rejected('CREDIT_NOTE_SOURCE_CHANGED');await prisma.invoice.update({where:{id:invoice.id},data:{amount:65,amountCents:6500,totalCents:6500}});}
  for(const mutate of [m=>m.amountCents++,m=>m.lineId=2147483000,m=>m.requestId=randomUUID(),m=>m.creditCents++,m=>m.kind='CASH']){
    const metadata=structuredClone(originalAudit.metadata);mutate(metadata);await prisma.auditTrail.update({where:{id:originalAudit.id},data:{metadata}});await rejected('CREDIT_NOTE_ORIGIN_UNCONFIRMED');
    await prisma.auditTrail.update({where:{id:originalAudit.id},data:{metadata:originalAudit.metadata}});
  }
  for(const mutate of [m=>m.fingerprint='broken',m=>m.result.requestReceipt.actorId++,m=>m.result.requestReceipt.creditCents++,m=>m.result.invoice.lines.find(l=>l.id===serviceLine.id).referenceId++,m=>m.result.invoice.clientId++,m=>m.result.invoice.total++,m=>m.result.creditNoteAmount++]){
    const metadata=structuredClone(originalReceipt.metadata);mutate(metadata);await prisma.operationalReminder.update({where:{id:originalReceipt.id},data:{metadata}});
    const f=await financial.snapshot(month);assert.notEqual(f.state,'UNAVAILABLE');assert.equal(f.revenueCoverage.creditNotes.total,0);assert.equal(f.revenueCoverage.documents.review,1);
    await prisma.operationalReminder.update({where:{id:originalReceipt.id},data:{metadata:originalReceipt.metadata}});
  }
  await prisma.operationalReminder.update({where:{id:originalReceipt.id},data:{sourceKey:'qa-hidden:'+randomUUID()}});await rejected('CREDIT_NOTE_ORIGIN_UNCONFIRMED');await prisma.operationalReminder.update({where:{id:originalReceipt.id},data:{sourceKey:originalReceipt.sourceKey}});
  const {id:ignored,...duplicateData}=originalAudit,duplicate=await prisma.auditTrail.create({data:duplicateData});await rejected('CREDIT_NOTE_ORIGIN_UNCONFIRMED');await prisma.auditTrail.delete({where:{id:duplicate.id}});
  // A removed line and restored gross totals do not erase the original audit.
  const savedNotes=original.lines.filter(l=>l.type==='CREDIT_NOTE');await prisma.invoiceLine.deleteMany({where:{id:{in:savedNotes.map(l=>l.id)}}});
  await prisma.invoice.update({where:{id:invoice.id},data:{total:100,totalAmount:100,amount:100,totalCents:10000,amountCents:10000}});await rejected('CREDIT_NOTE_ORIGIN_UNCONFIRMED');
  await prisma.invoiceLine.createMany({data:savedNotes});await prisma.invoice.update({where:{id:invoice.id},data:{total:65,totalAmount:65,amount:65,totalCents:6500,amountCents:6500}});
  assert.equal((await financial.snapshot(month)).revenueCoverage.creditNotes.total,2);
  for(const status of ['DRAFT','VOID','CANCELLED','ARCHIVED']){await prisma.invoice.update({where:{id:invoice.id},data:{status}});const x=(await financial.snapshot(month)).revenueCoverage;assert.equal(x.documents.excluded,1);assert.equal(x.creditNotes.total,0);assert.equal(x.grossDocumentAmountCents,0);}
  await prisma.invoice.update({where:{id:invoice.id},data:{status:'PAID'}});
  console.log('PASS changed or absent lines, aliases, client, period, audit, receipt and duplicate proofs require review; retired documents remain excluded');

  async function make(total,paid=0,type='SERVICE') {
    const service=await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,status:'DONE',endAt:new Date(month+'-15T12:00:00Z'),...(type==='MONTHLY'?{contractService:{billing:'INCLUDED_MONTHLY'}}:{})}});
    const created = await prisma.invoice.create({data:{clientId:client.id,month,year:2004,status:paid?'PARTIAL':'ISSUED',amount:total,total,totalAmount:total,amountPaid:paid,amountOpen:total-paid}});
    await prisma.invoiceLine.create({data:{invoiceId:created.id,type,lineType:type,referenceId:type==='SERVICE'?service.id:null,description:'Gross amount',total,lineTotal:total,quantity:1,unitPrice:total}});
    if(paid)await prisma.payment.create({data:{invoiceId:created.id,amount:paid,amountCents:Math.round(paid*100),method:'CASH',paidAt:new Date(month+'-02T00:00:00Z')}});
    return prisma.invoice.findUniqueOrThrow({where:{id:created.id},include:{lines:true}});
  }
  const partial=await make(100,80);await notes.create(partial.id,{requestId:randomUUID(),amount:30,reason:'Partly paid correction'},'QA',admin);
  const tiny=await make(.31);for(const n of [.10,.21])await notes.create(tiny.id,{requestId:randomUUID(),amount:n,reason:'Exact cent correction'},'QA',admin);
  const monthly=await make(50,0,'MONTHLY'),allocationService=require('../src/services/monthlyRevenueService'),lineId=monthly.lines[0].id;
  const state=(await allocationService.detail(lineId)).source,target=(await allocationService.candidates(lineId,{})).rows[0];
  const allocation=await allocationService.command(admin,{requestId:randomUUID(),command:'ALLOCATE',lineId,expectedStateHash:state.stateHash,data:{targetType:target.type,targetId:target.id,targetHash:target.hash,amountCents:5000,reason:'Original monthly contract',confirmed:true}});assert.equal(allocation.applied,true);
  await notes.create(monthly.id,{requestId:randomUUID(),amount:5,reason:'Monthly correction'},'QA',admin);
  const changedMonthly=(await allocationService.detail(lineId)).source;assert.equal(changedMonthly.valid,false);assert.equal(changedMonthly.reviewCount,1);assert.equal(changedMonthly.reservedAmountCents,5000);
  assert.equal((await allocationService.candidates(lineId,{})).total,0);
  r=(await financial.snapshot(month)).revenueCoverage;assert.equal(r.monthlyAllocatedAmountCents,0);assert.equal(r.serviceReviewAmountCents,5000);assert.equal(r.monthlyAllocations.reviewCount,1);assert.equal(r.creditNotes.amountCents,7031);assert.equal(r.creditNotes.creditReleasedCents,4500);assert.equal(r.grossDocumentAmountCents,25031);assert.equal(r.reconciledDocumentAmountCents,18000);
  for(let i=0;i<11;i++)await notes.create(invoice.id,{requestId:randomUUID(),amount:.01,reason:'Small confirmed reduction '+i},'QA',admin);
  result=await financial.snapshot(month);r=result.revenueCoverage;assert.equal(r.creditNotes.total,17);assert.equal(r.creditNotes.examples.total,17);assert.equal(r.creditNotes.examples.rows.length,10);assert.equal(r.creditNotes.examples.sampleOnly,true);assert.equal(r.creditNotes.amountCents,7042);assert.equal(r.reconciledDocumentAmountCents,17989);assert.equal(result.cash.amountCents,18000);
  // Pure reads cannot repair proof, allocate a reduction or mutate any financial history.
  const frozen=async()=>JSON.stringify(await Promise.all([prisma.invoice.findMany({where:{clientId:client.id},include:{lines:true,payments:true},orderBy:{id:'asc'}}),prisma.auditTrail.findMany({where:{clientId:client.id},orderBy:{id:'asc'}}),prisma.client.findUnique({where:{id:client.id}}),prisma.revenueAllocation.findMany({where:{clientId:client.id},orderBy:{id:'asc'}}),prisma.operationalReminder.findMany({where:{sourceKey:{startsWith:'invoice-payment:'}},orderBy:{id:'asc'}})]));
  const frozenBefore=await frozen();await financial.snapshot(month);financial.localAnswer('Ajustes e créditos',result);assert.equal(await frozen(),frozenBefore);
  const transaction=prisma.$transaction.bind(prisma);
  prisma.$transaction=(work,options)=>transaction(async db=>{db.operationalReminder.findMany=async()=>{throw Error('QA_PRIVATE_CREDIT_PROOF_FAILURE');};return work(db);},options);
  const unavailable=await financial.snapshot(month);assert.equal(unavailable.state,'UNAVAILABLE');assert.equal(unavailable.revenueCoverage,null);assert.equal(unavailable.cash,null);assert(!JSON.stringify(unavailable).includes('QA_PRIVATE'));prisma.$transaction=transaction;
  await prisma.revenueEvent.deleteMany({where:{lineId}});await prisma.revenueAllocation.deleteMany({where:{lineId}});
  console.log('PASS paid, partial, unpaid and zero-net documents; exact cents and full totals beyond samples; monthly allocation invalidation; read-only sources and truthful failure');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
