(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cw-reminder-resource-rules'), require('./cw-maintenance-material-rules'));
  else root.CWReminderMaterialRules = factory(root.CWReminderResourceRules, root.CWMaintenanceMaterialRules);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (resources, material) {
  'use strict';
  const { fields, uuid, sha, iso, owner, reason } = resources;
  const positive = n => Number.isSafeInteger(n) && n > 0 && n <= 2147483647;
  const { quantity, decimal, normalize } = material;
  const targetFields=['type','id','clientId','poolId','status','startAt','endAt','executionBasis','decisionId','decisionFingerprint','executionFingerprint','originVisitType','originVisitId'];
  const scope = 'REMINDER_MATERIAL_CONSUMPTION', basis = 'CONFIRMED_INDEPENDENT_REMINDER_CONSUMPTION';
  const fail = () => { throw Error('O consumo ou o comprovativo dos materiais precisa de revisão. Conserve o pedido original.'); };
  function input(body) {
    if (!fields(body, ['action','recordId','declarationId','items']) || !['CONSUME','REVERSE'].includes(body.action)) fail();
    if (body.action === 'REVERSE') { if (!uuid(body.recordId) || body.declarationId !== null || body.items !== null) fail(); return body; }
    if (body.recordId !== null || !positive(body.declarationId) || !Array.isArray(body.items) || !body.items.length || body.items.length > 20 || body.items.some((i,n) => !fields(i,['itemIndex','balanceId']) || i.itemIndex !== n + 1 || !positive(i.balanceId)) || new Set(body.items.map(i => i.balanceId)).size !== body.items.length) fail();
    return body;
  }
  const facts = p => { const { available, hash, ...value } = p; return value; };
  async function declaration(d, reminderId, hash) {
    await resources.response(d,d?.envelope,d?.event?.owner,reminderId,hash);
    if (!d.applied || d.event.preview.action !== 'DECLARE' || d.event.preview.proposed.materials?.mode !== 'DECLARED') fail();
    return d.event.preview.proposed.materials.items;
  }
  function balance(b) {
    return fields(b,['id','scope','vehicleId','productId','productName','category','unit','quantity']) && positive(b.id) && ['CENTRAL','VEHICLE'].includes(b.scope) && (b.scope === 'VEHICLE' ? positive(b.vehicleId) : b.vehicleId === null) && (b.productId === null || positive(b.productId)) && typeof b.productName === 'string' && !!normalize(b.productName) && typeof b.unit === 'string' && !!normalize(b.unit) && (b.category === null || typeof b.category === 'string') && quantity(b.quantity) !== null;
  }
  async function preview(p, hash) {
    if (p?.available !== true || p.schema !== 1 || p.basis !== basis || !positive(p.reminderId) || !resources.origin(p.origin) || p.origin.reminderId !== p.reminderId || !sha(p.contextHash) || p.previousHash !== null && !sha(p.previousHash) || !sha(p.hash) || await hash(facts(p)) !== p.hash) fail();
    input(p.selection);
    if (p.selection.action === 'REVERSE') {
      if (p.original?.event?.preview?.selection?.action !== 'CONSUME') fail();
      await response(p.original,p.original?.envelope,p.original?.event?.owner,p.reminderId,hash);
      if (!p.original.applied || p.original.event.id !== p.selection.recordId || p.declaration !== null || !Array.isArray(p.items) || p.items.length !== p.original.event.preview.items.length || await hash(p.origin) !== await hash(p.original.event.preview.origin) || !Array.isArray(p.affectedCosts) || p.affectedCosts.some((c,n,a) => !fields(c,['allocationId','expenseId','amountCents','allocationHash']) || !positive(c.allocationId) || !positive(c.expenseId) || !positive(c.amountCents) || !sha(c.allocationHash) || n > 0 && c.allocationId <= a[n-1].allocationId)) fail();
      for (const [n,row] of p.items.entries()) {
        const previous=p.original.event.preview.items[n];
        if (!fields(row,['itemIndex','balance','quantity','afterQuantity']) || row.itemIndex!==n+1 || !balance(row.balance) || row.quantity!==previous.quantity || Object.keys(row.balance).filter(k=>k!=='quantity').some(k=>row.balance[k]!==previous.balance[k]) || quantity(row.afterQuantity)===null || quantity(row.balance.quantity)+quantity(row.quantity)!==quantity(row.afterQuantity)) fail();
      }
      return p;
    }
    const declared = await declaration(p.declaration,p.reminderId,hash), d = p.declaration.event;
    if (p.original !== null || p.affectedCosts !== null || d.recordId !== p.selection.declarationId || await hash(p.origin) !== await hash(d.preview.origin) || !Array.isArray(p.items) || p.items.length !== declared.length || p.items.length !== p.selection.items.length) fail();
    for (const [n,row] of p.items.entries()) {
      if (!fields(row,['itemIndex','balance','quantity','afterQuantity','reservedQuantity','reservationHash']) || row.itemIndex !== n+1 || !balance(row.balance) || row.balance.id !== p.selection.items[n].balanceId || normalize(row.balance.productName) !== declared[n].productName || normalize(row.balance.unit) !== declared[n].unit || row.quantity !== declared[n].quantity || quantity(row.afterQuantity) === null || quantity(row.balance.quantity) - quantity(row.quantity) !== quantity(row.afterQuantity) || quantity(row.reservedQuantity)===null || !sha(row.reservationHash) || quantity(row.afterQuantity)<quantity(row.reservedQuantity)) fail();
    }
    return p;
  }
  const movementFields = ['id','movementType','scopeFrom','scopeTo','vehicleId','productId','productName','category','unit','quantity','purchaseId','transportGuideId','workGuideId','extraVisitId','visitId','clientId','poolId','technicianId','documentPath','notes','createdBy','createdAt'];
  function movement(m, item, origin, event, reverse, previous) {
    const b = item.balance;
    if (!fields(m,movementFields) || !positive(m.id) || m.movementType !== (reverse ? 'RETURN' : 'CONSUMPTION') || m.scopeFrom !== (reverse ? 'REMINDER' : b.scope) || m.scopeTo !== (reverse ? b.scope : 'REMINDER') || m.vehicleId !== b.vehicleId || m.productId !== b.productId || m.productName !== b.productName || m.category !== b.category || m.unit !== b.unit || m.quantity !== item.quantity || m.clientId !== origin.clientId || m.poolId !== origin.poolId || m.technicianId !== origin.technicianId || m.createdBy !== event.owner || m.createdAt !== event.createdAt || ['purchaseId','transportGuideId','workGuideId','extraVisitId','visitId','documentPath'].some(k => m[k] !== null) || m.notes !== (reverse ? 'Anulação do consumo '+previous : 'Consumo próprio')+' · Lembrete #'+event.reminderId+' · '+event.id) fail();
  }
  async function response(value, body, actor, reminderId, hash) {
    const { requestId, ...payload } = body || {}, receipt = value?.receipt;
    if (value?.ok !== true || typeof value.applied !== 'boolean' || !uuid(requestId) || !owner(actor) || !positive(reminderId) || receipt?.scope !== scope || receipt.resourceId !== reminderId || receipt.owner !== actor || receipt.requestId !== requestId || !iso(receipt.confirmedAt) || receipt.payloadHash !== await hash({v:1,scope,resourceId:reminderId,payload}) || await hash(value.envelope) !== await hash(body)) fail();
    if (!value.applied) { if (typeof value.code !== 'string' || typeof value.message !== 'string' || value.event !== undefined || value.eventHash !== undefined) fail(); return value; }
    const e = value.event, p = await preview(e?.preview,hash);
    if (!fields(e,['schema','basis','id','owner','reminderId','reason','createdAt','preview','movements']) || e.schema !== 1 || e.basis !== basis || e.id !== requestId || e.owner !== actor || e.reminderId !== reminderId || !iso(e.createdAt) || !reason(e.reason) || e.reason !== body.reason || body.confirmed !== true || p.reminderId !== reminderId || p.hash !== body.previewHash || await hash(p.selection) !== await hash({action:body.action,recordId:body.recordId,declarationId:body.declarationId,items:body.items}) || await hash(e) !== value.eventHash) fail();
    const reverse = body.action === 'REVERSE', items = reverse ? p.original.event.preview.items : p.items;
    if(Date.parse(e.createdAt)<Date.parse(reverse?p.original.event.createdAt:p.declaration.event.createdAt)||!reverse&&Date.parse(e.createdAt)<Date.parse(p.declaration.event.preview.source.completedAt))fail();
    if (!Array.isArray(e.movements) || e.movements.length !== items.length || new Set(e.movements.map(m => m.id)).size !== items.length) fail();
    for (const [n,m] of e.movements.entries()) movement(m,items[n],p.origin,e,reverse,p.selection.recordId);
    return value;
  }
  async function source(s, target, hash) {
    if (s?.version !== 8 || s.kind !== 'MATERIAL' || s.materialBasis !== basis || !target || target.type !== 'MAINTENANCE_REMINDER' || await hash(s.service) !== await hash(Object.fromEntries(targetFields.map(k => [k,target[k]])))) fail();
    await response(s.consumption,s.consumption?.envelope,s.consumption?.event?.owner,target.id,hash);
    const e = s.consumption.event, p = e.preview;
    if (!s.consumption.applied || p.selection.action !== 'CONSUME' || await hash(s.service) !== p.declaration.event.preview.targetHash || p.origin.clientId !== target.clientId || p.origin.poolId !== target.poolId || !s.item) fail();
    const date=s.item.purchase?.invoiceDate;
    if(!positive(s.item.id)||!positive(s.item.purchaseId)||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||Date.parse(date+'T00:00:00Z')>Date.parse(target.endAt)||['CANCELLED','CANCELED','VOID'].includes(String(s.item.purchase.status).trim().toUpperCase()))fail();
    const selected = e.movements.filter(m => normalize(m.productName) === normalize(s.item.productName) && normalize(m.unit) === normalize(s.item.unit));
    if (selected.length !== 1 || await hash(s.movements) !== await hash(selected) || selected[0].productId !== null && s.item.productId !== null && selected[0].productId !== s.item.productId) fail();
    return s;
  }
  function calculation(c,s) {
    const item=s?.item, q=quantity(c?.quantity), base=quantity(c?.baseQuantity), used=quantity(c?.poolQuantityBefore), measured=quantity(c?.measuredQuantityBefore);
    const total=typeof item?.quantity==='number'&&Number.isFinite(item.quantity)?quantity(item.quantity.toFixed(6).replace(/0+$/,'').replace(/\.$/,'')):null;
    const consumed=Array.isArray(s?.movements)?s.movements.reduce((n,m)=>{const v=quantity(m.quantity);return n===null||v===null?null:n+v;},0n):null;
    if(!item||[q,base,used,measured,total,consumed].some(x=>x===null)||q<=0n||base<=0n||base!==total||used+q>base||measured+q>consumed||!positive(c.baseAmountCents)||c.baseAmountCents!==Math.round(item.totalCost*100)||!Number.isFinite(item.unitCost)||item.unitCost<=0||Math.round(item.quantity*item.unitCost*100)!==c.baseAmountCents||!Number.isSafeInteger(c.poolAmountBeforeCents)||c.poolAmountBeforeCents<0||c.poolAmountBeforeCents>=c.baseAmountCents||c.quantityUnit!==normalize(item.unit)||c.method!=='CONFIRMED_PURCHASE_LINE'||!positive(c.amountCents))fail();
    const final=used+q===base,amount=final?BigInt(c.baseAmountCents-c.poolAmountBeforeCents):(2n*q*BigInt(c.baseAmountCents)+base)/(2n*base);
    if(c.rounding!==(final?'FINAL_POOL_REMAINDER':'NEAREST_CENT')||BigInt(c.amountCents)!==amount||c.poolAmountBeforeCents+c.amountCents>c.baseAmountCents)fail();
    return c;
  }
  return { scope,basis,fields,positive,uuid,sha,iso,owner,reason,quantity,decimal,normalize,input,facts,balance,declaration,preview,response,source,calculation,movementFields };
});
