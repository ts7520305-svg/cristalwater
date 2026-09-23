(function () {
  'use strict';
  const types = ['MAINTENANCE_EQUIPMENT','MAINTENANCE_REMINDER'];
  const fields = ['executionBasis','decisionId','decisionFingerprint','executionFingerprint','originVisitType','originVisitId'];
  const positive = n => Number.isSafeInteger(n) && n > 0, sha = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
  const targetId = a => a.targetType === 'MAINTENANCE_EQUIPMENT' ? a.maintenanceCompletionId : a.serviceReminderId;
  function facts(t) {
    const s=t?.snapshot;
    if(!s || !types.includes(t.type) || s.type!==t.type || !positive(t.id) || s.id!==t.id || !positive(t.clientId) || s.clientId!==t.clientId || !positive(s.poolId) || s.status!=='CONFIRMED' || s.startAt!==null || typeof s.endAt!=='string' || !Number.isFinite(Date.parse(s.endAt)) || new Date(s.endAt).toISOString()!==s.endAt || s.executionBasis!=='CONFIRMED_MAINTENANCE_EXECUTION_AND_DECISION' || !positive(s.decisionId) || !sha(s.decisionFingerprint) || !sha(s.executionFingerprint) || s.label!==t.label || s.clientName!==t.clientName || typeof s.label!=='string' || typeof s.clientName!=='string' || (t.type==='MAINTENANCE_EQUIPMENT' ? !['REGULAR','EXTRA'].includes(s.originVisitType)||!positive(s.originVisitId) : s.originVisitType!==null||s.originVisitId!==null))throw Error('Origem histórica da manutenção não confirmada.');
    return Object.fromEntries(['type','id','clientId','poolId','status','startAt','endAt',...fields].map(k=>[k,s[k]]));
  }
  async function verifyTarget(t,hash) { if(t.valid!==true || await hash(facts(t))!==t.hash)throw Error('A origem recebida não corresponde à manutenção selecionada.');return t; }
  function allocation(a) {
    if(!a || !types.includes(a.targetType) || a.valuationType!=='MANUAL' || !positive(targetId(a)) || a.visitId!==null || a.extraVisitId!==null || a.repairId!==null || (a.targetType==='MAINTENANCE_EQUIPMENT'?a.serviceReminderId!==null:a.maintenanceCompletionId!==null))throw Error('Atribuição da manutenção não confirmada.');
    return {type:a.targetType,id:targetId(a),clientId:a.clientId,valid:true,hash:a.targetHash,label:a.targetSnapshot?.label,clientName:a.targetSnapshot?.clientName,snapshot:a.targetSnapshot};
  }
  async function receipt(result,record,hash) {
    const e=record.envelope,a=result.allocation;
    if(!result.applied || !['ALLOCATE_COST','REVIEW_COST','VOID_COST'].includes(e.command) || !types.includes(a?.targetType))return;
    await verifyTarget(allocation(a),hash);
    if(result.version!==e.expectedVersion+1 || e.command!=='VOID_COST' && (a.voidedAt!==null || !a.activeKey) || e.command==='ALLOCATE_COST' && (a.targetType!==e.data.targetType||targetId(a)!==e.data.targetId) || ['REVIEW_COST','VOID_COST'].includes(e.command) && !['id','expenseId','clientId','targetType','visitId','extraVisitId','repairId','maintenanceCompletionId','serviceReminderId','monthRef','amountCents','valuationType'].every(k=>a[k]===result.allocationBefore?.[k]))throw Error('O recibo não conserva a atribuição original da manutenção.');
  }
  window.CWExpenseMaintenance={types,fields,targetId,facts,verifyTarget,allocation,receipt};
})();
