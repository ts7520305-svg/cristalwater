'use strict';
const { prisma } = require('../prismaClient');
const { isReceivableInvoice } = require('./clientCreditService');
const { INTERNAL_PAYMENT_METHODS } = require('./invoicePaymentRequestService');
const internalPayments = new Set(INTERNAL_PAYMENT_METHODS);
const doneStates = new Set(['DONE','COMPLETED','CONCLUIDA','CONCLUIDO']);
const stockTypes = new Set(['CONSUMPTION','RETURN','EMERGENCY_DISTRIBUTED_CONSUMPTION']);
const normalize = value => String(value || '').trim().toUpperCase();
const isCompletedVisitStatus = value => doneStates.has(normalize(value));
const validId = value => Number.isSafeInteger(value) && value > 0;
const cents = value => typeof value === 'number' && Number.isFinite(value) && Number.isSafeInteger(Math.round(value * 100)) ? Math.round(value * 100) : null;
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
function period(query = {}) {
  if (query.limit !== undefined && (typeof query.limit !== 'string' || !/^[1-9]\d*$/.test(query.limit))) fail('Limite inválido. O relatório agregado não é truncado.');
  let monthRef = query.monthRef;
  if (query.month !== undefined || query.year !== undefined) {
    if (monthRef !== undefined || typeof query.month !== 'string' || typeof query.year !== 'string' || !/^(0?[1-9]|1[0-2])$/.test(query.month) || !/^(20|21)\d{2}$/.test(query.year)) fail('Indique um mês e um ano válidos.');
    monthRef = query.year+'-'+query.month.padStart(2,'0');
  }
  if (monthRef === undefined) monthRef = new Date().toISOString().slice(0,7);
  if (typeof monthRef !== 'string' || !/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(monthRef)) fail('Mês inválido; use AAAA-MM.');
  const start = new Date(monthRef+'-01T00:00:00Z'), end = new Date(start); end.setUTCMonth(end.getUTCMonth()+1);
  return { monthRef, start, end };
}
const visitSelect = { id:true, technicianId:true, clientId:true, poolId:true, status:true, startAt:true, endAt:true, pool:{select:{clientId:true}} };
// A full monthRef takes precedence over the two historical month formats.
function documentMonthWhere(monthRef) {
  return {OR:[{monthRef},{monthRef:null,month:monthRef},{monthRef:null,year:Number(monthRef.slice(0,4)),month:{in:[monthRef.slice(5),String(Number(monthRef.slice(5)))]}}]};
}
// A current pool owner cannot establish the customer of historical work.
const clientOf = visit => visit.clientId || null;
function baseRow(id, name, active) {
  return { id, name, active, regularDone:0, extraDone:0, visitsDone:0, undatedCompleted:0, minutes:0, unknownDurations:0,
    stock:[], stockMovementCount:0, stockReviewCount:0, extraLinesAmount:0, confirmedExtraLinesAmount:0, extraLinesReviewCount:0, extraLineEvidence:[],
    laborEstimate:null, laborEstimateBasis:'NOT_APPLICABLE', revenue:null, estimatedRevenue:null, stockCost:null, laborCost:null, cost:null, profit:null, profitability:null,
    financialStatus:'NOT_ESTABLISHED', unavailableReasons:['FULL_REVENUE_ALLOCATION','HISTORICAL_STOCK_COST','ACTUAL_LABOR_COST','OTHER_OPERATING_COSTS'] };
}
async function build(query, kind) {
  const { monthRef, start, end } = period(query), between = { gte:start, lt:end };
  return prisma.$transaction(async db => {
    const [technicians, clients, regular, extras, undatedRegular, undatedExtras, movements, invoices, payments] = await Promise.all([
      db.technician.findMany({select:{id:true,name:true,active:true,costPerVisit:true,hourlyCost:true},orderBy:{id:'asc'}}),
      db.client.findMany({select:{id:true,name:true,active:true},orderBy:{id:'asc'}}),
      db.serviceVisit.findMany({where:{endAt:between},select:visitSelect}),
      db.extraVisit.findMany({where:{endAt:between},select:visitSelect}),
      db.serviceVisit.findMany({where:{endAt:null,OR:[{plannedDate:between},{plannedDate:null,date:between}]},select:visitSelect}),
      db.extraVisit.findMany({where:{endAt:null,scheduledAt:between},select:visitSelect}),
      db.stockMovement.findMany({where:{createdAt:between},orderBy:{id:'asc'}}),
      db.invoice.findMany({where:documentMonthWhere(monthRef),include:{lines:true}}),
      kind === 'client' ? db.payment.findMany({where:{paidAt:between},select:{id:true,amount:true,method:true,invoice:{select:{clientId:true}}}}) : []
    ]);
    const expenseCosts = kind === 'client' ? await require('./expenseLedgerService').clientCosts(db, monthRef) : [];
    const masters = kind === 'technician' ? technicians : clients, masterIds = new Set(masters.map(row=>row.id));
    const rows = new Map(masters.map(row=>[row.id,baseRow(row.id,row.name || (kind === 'technician'?'Técnico':'Cliente')+' #'+row.id,row.active)]));
    const quality = { undatedCompleted:0, excludedVisitStates:0, unallocatedMovements:0, invalidStockQuantities:0, excludedStockMovements:0, excludedDocuments:0, unallocatedDocumentLines:0, extraLinesNeedingReview:0, invalidPayments:0 };
    function rowFor(id) {
      const key = masterIds.has(id) ? id : null;
      if (!rows.has(key)) rows.set(key,baseRow(null,kind === 'technician'?'Sem técnico confirmado':'Sem cliente confirmado',null));
      return rows.get(key);
    }
    const owner = visit => kind === 'technician' ? visit.technicianId : clientOf(visit);
    for (const [type, visits] of [['REGULAR',regular],['EXTRA',extras]]) for (const visit of visits) {
      if (!isCompletedVisitStatus(visit.status)) { quality.excludedVisitStates++; continue; }
      const row = rowFor(owner(visit)); row.visitsDone++; row[type === 'REGULAR'?'regularDone':'extraDone']++;
      const minutes = visit.startAt && visit.endAt ? (visit.endAt-visit.startAt)/60000 : NaN;
      if (Number.isFinite(minutes) && minutes >= 0) row.minutes += minutes; else row.unknownDurations++;
    }
    for (const visit of [...undatedRegular,...undatedExtras]) if (isCompletedVisitStatus(visit.status)) { rowFor(owner(visit)).undatedCompleted++; quality.undatedCompleted++; }

    // Resolve typed source identities; never join the two visit tables by an untyped number.
    const regularIds = [...new Set(movements.map(m=>m.visitId).filter(validId))];
    const extraIds = [...new Set([...movements.map(m=>m.extraVisitId),...invoices.flatMap(i=>i.lines.filter(l=>normalize(l.type)==='EXTRA_VISIT').map(l=>l.referenceId))].filter(validId))];
    const [referencedRegular, referencedExtra, extraLines] = await Promise.all([
      db.serviceVisit.findMany({where:{id:{in:regularIds}},select:visitSelect}),
      db.extraVisit.findMany({where:{id:{in:extraIds}},select:visitSelect}),
      db.invoiceLine.findMany({where:{type:'EXTRA_VISIT',referenceId:{in:extraIds}},select:{id:true,referenceId:true,invoice:{select:{status:true}}}})
    ]);
    const regularById = new Map(referencedRegular.map(v=>[v.id,v])), extraById = new Map(referencedExtra.map(v=>[v.id,v]));
    const referenceCounts = new Map();
    for (const line of extraLines) if (isReceivableInvoice(line.invoice)) referenceCounts.set(line.referenceId,(referenceCounts.get(line.referenceId)||0)+1);
    for (const movement of movements) {
      const type = normalize(movement.movementType);
      if (!stockTypes.has(type)) { quality.excludedStockMovements++; continue; }
      const source = movement.visitId && movement.extraVisitId ? null : movement.extraVisitId ? extraById.get(movement.extraVisitId) : movement.visitId ? regularById.get(movement.visitId) : null;
      const direct = kind === 'technician' ? movement.technicianId : movement.clientId, linked = source ? owner(source) : null;
      const conflicting = (movement.visitId && movement.extraVisitId) || ((movement.visitId || movement.extraVisitId) && !source) || (direct && linked && direct !== linked);
      const row = rowFor(conflicting ? null : direct || linked);
      if (row.id === null) quality.unallocatedMovements++;
      row.stockMovementCount++;
      if (conflicting || !Number.isFinite(movement.quantity) || movement.quantity <= 0 || !movement.unit?.trim() || !movement.productName?.trim()) {
        row.stockReviewCount++; quality.invalidStockQuantities++; continue;
      }
      const unit = normalize(movement.unit), key = JSON.stringify([movement.productId || null,movement.productName.trim().toLowerCase(),unit]);
      let item = row.stock.find(item=>item.key===key);
      if (!item) { item={key,productId:movement.productId,product:movement.productName,unit,consumed:0,returned:0,net:0}; row.stock.push(item); }
      item[type==='RETURN'?'returned':'consumed'] += movement.quantity;
    }
    for (const invoice of invoices) {
      if (!isReceivableInvoice(invoice)) { quality.excludedDocuments++; continue; }
      const adjusted = invoice.lines.some(line=>normalize(line.type).includes('CREDIT') || normalize(line.lineType).includes('CREDIT') || (cents(line.total) ?? -1) < 0 || (cents(line.lineTotal) ?? -1) < 0);
      for (const line of invoice.lines) {
        if (normalize(line.type) !== 'EXTRA_VISIT') { quality.unallocatedDocumentLines++; continue; }
        const visit = extraById.get(line.referenceId), knownOwner = visit ? owner(visit) : null, row = rowFor(knownOwner);
        const amount = cents(line.total), other = cents(line.lineTotal);
        const valid = visit && doneStates.has(normalize(visit.status)) && clientOf(visit) === invoice.clientId && (!visit.clientId || !visit.pool?.clientId || visit.clientId===visit.pool.clientId) && !adjusted && referenceCounts.get(line.referenceId) === 1 && (line.lineType === null || normalize(line.lineType)==='EXTRA_VISIT') && amount !== null && amount >= 0 && amount === other && row.id !== null;
        if (!valid) { row.extraLinesReviewCount++; quality.extraLinesNeedingReview++; continue; }
        row.confirmedExtraLinesAmount += amount;
        row.extraLineEvidence.push({invoiceId:invoice.id,lineId:line.id,extraVisitId:visit.id,amount:amount/100});
      }
    }
    if (kind === 'client') for (const row of rows.values()) row.cashReceived = 0;
    for (const payment of payments) {
      if (internalPayments.has(normalize(payment.method))) continue;
      const row = rowFor(payment.invoice.clientId); if (row.cashReceived === undefined) row.cashReceived = 0;
      const amount = cents(payment.amount);
      if (amount === null) { quality.invalidPayments++; row.cashReceived = null; }
      else if (row.cashReceived !== null) row.cashReceived += amount;
    }
    for (const row of rows.values()) {
      const measuredMinutes = row.minutes; row.minutes = Math.round(measuredMinutes*100)/100;
      row.confirmedExtraLinesAmount /= 100;
      row.extraLinesAmount = row.extraLinesReviewCount ? null : row.confirmedExtraLinesAmount;
      row.stock.forEach(item=>{item.consumed=Number(item.consumed.toFixed(6));item.returned=Number(item.returned.toFixed(6));item.net=Number((item.consumed-item.returned).toFixed(6));delete item.key;});
      if (kind === 'client') {
        row.clientId=row.id;row.clientName=row.name;
        const attributed = row.id === null ? null : expenseCosts.find(c => c.clientId === row.id);
        row.registeredExpenseAmountCents = row.id === null ? null : attributed ? attributed.amountCents : 0; row.registeredExpenseReviewCount = attributed?.reviewCount || 0; row.registeredExpenseAllocationCount = attributed?.allocationCount || 0;
        row.expenseCostCoverage = 'REGISTERED_EXPENSE_ATTRIBUTION';
        if (row.cashReceived !== null) row.cashReceived=(row.cashReceived||0)/100;
      } else {
        row.technicianId=row.id;row.technicianName=row.name;row.technician=row.name;row.visits=row.visitsDone;
        const master = technicians.find(t=>t.id===row.id), perVisit=master?.costPerVisit, hourly=master?.hourlyCost;
        const perVisitSet=Number.isFinite(perVisit)&&perVisit>0, hourlySet=Number.isFinite(hourly)&&hourly>0;
        row.laborEstimateBasis=perVisitSet&&hourlySet?'AMBIGUOUS_RATE':perVisitSet?'CURRENT_RATE_PER_VISIT':hourlySet?'CURRENT_HOURLY_RATE':'MISSING_RATE';
        if (perVisitSet&&!hourlySet) row.laborEstimate=Math.round(row.visitsDone*perVisit*100)/100;
        if (hourlySet&&!perVisitSet&&!row.unknownDurations) row.laborEstimate=Math.round(measuredMinutes/60*hourly*100)/100;
        if (!Number.isFinite(row.laborEstimate)) row.laborEstimate=null;
      }
    }
    const result=[...rows.values()];
    return {ok:true,reportVersion:1,monthRef,generatedAt:new Date().toISOString(),complete:true,total:result.length,returned:result.length,limitApplied:null,financialComplete:false,
      basis:{expenseAttribution:'EXPLICIT_ALLOCATION_MONTH_NOT_FULL_COST',visits:'COMPLETED_END_AT_UTC',undatedVisits:'PLANNED_MONTH_WITHOUT_END_AT',stock:'STOCK_MOVEMENT_CREATED_AT_UTC',extraLines:'DOCUMENT_MONTH_REFERENCE_STORED_LINE_VALUE',cash:'PAYMENT_PAID_AT_UTC',labor:'CURRENT_CONFIGURED_RATE_ESTIMATE'},
      dataQuality:quality, ...(kind==='technician'?{technicians:result,ranking:result}:{clients:result})};
  },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:30000});
}
module.exports = { period, documentMonthWhere, isCompletedVisitStatus, technicians:query=>build(query||{},'technician'), clients:query=>build(query||{},'client') };
