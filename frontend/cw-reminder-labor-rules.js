(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./cw-reminder-resource-rules'));
  else root.CWReminderLaborRules=factory(root.CWReminderResourceRules);
})(typeof globalThis!=='undefined'?globalThis:this,function(resources){
  'use strict';
  const basis='CONFIRMED_INDEPENDENT_REMINDER_WORK',type='MAINTENANCE_REMINDER';
  const {positive,sha,iso}=resources;
  const fields=['type','id','clientId','poolId','status','startAt','endAt','executionBasis','decisionId','decisionFingerprint','executionFingerprint','originVisitType','originVisitId'];
  const facts=t=>t?Object.fromEntries(fields.map(k=>[k,t[k]])):null;
  const fail=()=>{throw Error('O intervalo ou a base paga não corresponde à declaração revista do lembrete.');};
  const paid=b=>b?Object.fromEntries(['id','expenseId','technicianId','periodStart','periodEnd','paidMinutes'].map(k=>[k,b[k]])):null;
  const within=(s,b)=>!!b&&positive(b.id)&&positive(b.expenseId)&&positive(b.paidMinutes)&&b.technicianId===s.technicianId&&Date.parse(s.startedAt)>=Date.parse(b.periodStart+'T00:00:00Z')&&Date.parse(s.endedAt)<=Date.parse(b.periodEnd+'T00:00:00Z')+86400000;
  async function work(value,target,hash){
    const s=value?.snapshot,d=s?.declaration,e=d?.event,p=e?.preview;
    if(!positive(value?.id)||!sha(value.fingerprint)||!s||!d||!e||![1,2].includes(s.version)||s.basis!==basis||target?.type!==type||s.reminderId!==target.id||s.clientId!==target.clientId||s.poolId!==target.poolId||!positive(s.technicianId)||s.technicianName!=='Técnico #'+s.technicianId||!positive(s.durationSeconds)||!iso(s.startedAt)||!iso(s.endedAt)||!iso(s.createdAt)||Date.parse(s.createdAt)<Date.parse(s.endedAt)||await hash(s)!==value.fingerprint)fail();
    await resources.response(d,d.envelope,e.owner,s.reminderId,hash);
    const times=resources.intervals(p.proposed);
    if(!d.applied||e.recordId!==value.id||p.action!=='DECLARE'||!times.length||s.version!==p.schema||p.origin.technicianId!==s.technicianId||p.origin.clientId!==s.clientId||p.origin.poolId!==s.poolId||times[0].startedAt!==s.startedAt||times[times.length-1].endedAt!==s.endedAt||p.durationSeconds!==s.durationSeconds||s.version===2&&await hash(s.workIntervals)!==await hash(p.proposed.workIntervals)||s.version===1&&s.workIntervals!==undefined||s.createdAt!==e.createdAt||s.createdBy!==e.owner||s.reason!==e.reason||await hash(s.source)!==s.sourceHash||s.sourceHash!==p.targetHash||await hash(facts(target))!==s.sourceHash)fail();
    return s;
  }
  async function source(value,target,expectedId,expectedBasis,hash){
    const version=value?.workInterval?.snapshot?.version===2?(value?.laborDistribution?10:9):(value?.laborDistribution?7:6);
    if(value?.version!==version||value.kind!=='LABOR'||value.workBasis!==basis||value.workInterval?.id!==expectedId||await hash(value.service)!==await hash(facts(target)))fail();
    const s=await work(value.workInterval,target,hash);
    if(!positive(value.expenseAmountCents)||!within(s,value.basis)||expectedBasis&&await hash(value.basis)!==await hash(paid(expectedBasis)))fail();
    return s;
  }
  const units=v=>typeof v==='string'&&/^\d{1,12}(\.\d{1,6})?$/.test(v)?BigInt(v.split('.')[0])*1000000n+BigInt((v.split('.')[1]||'').padEnd(6,'0')):null;
  function calculation(value,s,b,amountCents){
    const c=value?.calculation,q=units(value?.quantity),base=BigInt(b.paidMinutes)*60000000n,before=units(c?.poolQuantityBefore);
    if(!c||value.quantity!==String(s.durationSeconds)||value.quantityUnit!=='SECOND'||value.availableQuantity!==undefined&&value.availableQuantity!==value.quantity||q===null||q<=0n||before===null||before<0n||before+q>base||c.quantity!==value.quantity||c.quantityUnit!=='SECOND'||c.method!=='CONFIRMED_EXPENSE_PAID_TIME'||c.baseQuantity!==String(b.paidMinutes*60)||c.baseAmountCents!==amountCents||!positive(amountCents)||c.measuredQuantityBefore!=='0'||!Number.isSafeInteger(c.poolAmountBeforeCents)||c.poolAmountBeforeCents<0||c.poolAmountBeforeCents>=amountCents||!positive(value.amountCents)||c.amountCents!==value.amountCents)fail();
    const final=before+q===base,amount=Number(final?BigInt(amountCents-c.poolAmountBeforeCents):(2n*q*BigInt(amountCents)+base)/(2n*base));
    if(c.rounding!==(final?'FINAL_POOL_REMAINDER':'NEAREST_CENT')||value.amountCents!==amount||value.amountCents+c.poolAmountBeforeCents>amountCents)fail();
    return c;
  }
  const describe=s=>s.workIntervals?s.workIntervals.map(w=>w.startedAt+' a '+w.endedAt).join(' · ')+' · '+s.durationSeconds+' segundos efetivos; pausas excluídas':s.startedAt+' a '+s.endedAt;
  return {basis,type,fields,facts,paid,within,work,source,calculation,describe};
});
