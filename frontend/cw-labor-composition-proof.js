(() => {
  'use strict';
  const id=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647, cents=id;
  const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
  const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const hash=async v=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(v)))))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const check=(condition,message='A composição ou a confirmação precisa de revisão.')=>{if(!condition)throw Error(message);};
  const without=(value,...fields)=>Object.fromEntries(Object.entries(value).filter(([k])=>!fields.includes(k)));
  const raw=value=>without(value,'recordHash','state','reviewReasons');
  function basisFacts(s) {
    check(s?.version===1&&s.kind==='CONFIRMED_LABOR_COST_COMPOSITION'&&id(s.technicianId)&&id(s.paidMinutes)&&cents(s.amountCents)&&Array.isArray(s.components)&&s.components.length>=2&&s.components.length<=20);
    check([s.periodStart,s.periodEnd].every(d=>typeof d==='string'&&/^(20|21)\d\d-\d\d-\d\d$/.test(d)&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d)&&s.periodStart<=s.periodEnd&&s.paidMinutes<=(Date.parse(s.periodEnd)-Date.parse(s.periodStart))/60000+1440);
    let total=0;
    for(const [i,c] of s.components.entries()) {
      const e=c.expense,b=c.laborBasis;
      check(id(c.expenseId)&&(!i||c.expenseId>s.components[i-1].expenseId)&&e?.id===c.expenseId&&cents(e.amountCents)&&e.category==='LABOR'&&e.sourceType==='MANUAL'&&e.sourceId===null&&e.sourceHash===null&&typeof e.supplierName==='string'&&b?.expenseId===c.expenseId&&id(b.id)&&['technicianId','periodStart','periodEnd','paidMinutes'].every(k=>b[k]===s[k]));total+=e.amountCents;
    }
    check(total===s.amountCents);
  }
  async function basisPreview(p) {
    basisFacts(p?.snapshot);check(p.version===1&&p.fingerprint===await hash(p.snapshot)&&p.hash===await hash(without(p,'hash'))&&typeof p.technicianName==='string'&&p.expenseVersions?.length===p.snapshot.components.length);
    p.expenseVersions.forEach((v,i)=>check(v.expenseId===p.snapshot.components[i].expenseId&&id(v.version)));
  }
  async function basis(row) {
    basisFacts(row?.snapshot);check(id(row.id)&&row.fingerprint===await hash(row.snapshot)&&row.recordHash===await hash(raw(row))&&typeof row.technicianName==='string'&&typeof row.reason==='string'&&/^ADMIN:[1-9]\d*$/.test(row.createdBy)&&iso(row.createdAt));
    check(['CONFIRMED','REVIEW','VOIDED'].includes(row.state)&&Array.isArray(row.reviewReasons));
    if(row.voidedAt)check(row.state==='VOIDED'&&iso(row.voidedAt)&&row.activeKey===null&&typeof row.voidReason==='string');
    else check(row.state!=='VOIDED'&&row.activeKey===await hash(row.snapshot.components.map(c=>c.expenseId)));
  }
  const units=v=>typeof v==='string'&&/^\d{1,12}(\.\d{1,6})?$/.test(v)?BigInt(v.split('.')[0])*1000000n+BigInt((v.split('.')[1]||'').padEnd(6,'0')):null;
  async function valuePreview(p, selectedBasis, choice, target) {
    basisFacts(p?.basisSnapshot);
    check(p.version===1&&id(p.basisId)&&p.basisFingerprint===await hash(p.basisSnapshot)&&p.hash===await hash(without(p,'hash'))&&equal(p.choice,choice||p.choice));
    if(selectedBasis)check(p.basisId===selectedBasis.id&&p.basisFingerprint===selectedBasis.fingerprint&&equal(p.basisSnapshot,selectedBasis.snapshot));
    check(p.choice.kind==='LABOR'&&p.choice.quantity===null&&p.choice.purchaseItemId===null&&['REGULAR','EXTRA','REPAIR'].includes(p.targetType)&&p.targetType===p.choice.targetType&&id(p.targetId)&&p.targetId===p.choice.targetId&&id(p.clientId)&&/^(20|21)\d\d-\d\d$/.test(p.monthRef)&&p.quantityUnit==='SECOND'&&units(p.quantity)>0n&&cents(p.amountCents)&&p.components?.length===p.basisSnapshot.components.length);
    let total=0;
    for(const [i,c] of p.components.entries()) {
      const original=p.basisSnapshot.components[i],s=c.source,k=c.calculation,q=units(c.quantity),base=units(k?.baseQuantity),before=units(k?.poolQuantityBefore);
      check(c.version===1&&c.expenseId===original.expenseId&&id(c.expenseVersion)&&c.hash===await hash(without(c,'hash'))&&c.kind==='LABOR'&&c.purchaseItemId===null&&sha(c.targetHash)&&sha(c.valuationKey)&&c.valuationHash===await hash(s)&&['targetType','targetId','clientId','monthRef','quantity','quantityUnit'].every(key=>c[key]===p[key]));
      check(s?.kind==='LABOR'&&s.expenseAmountCents===original.expense.amountCents&&equal(s.basis,original.laborBasis)&&s.service?.id===p.targetId&&s.service.clientId===p.clientId&&iso(s.service.endAt)&&s.service.endAt.slice(0,7)===p.monthRef);
      if(target)check(c.targetHash===target.hash&&p.clientId===target.clientId&&p.targetType===target.type&&p.targetId===target.id);
      let start=s.service.startAt,end=s.service.endAt,tech=s.service.technicianId;
      if(p.targetType==='REPAIR') {
        const w=s.workInterval,t=w?.snapshot;
        check(s.version===3&&s.workBasis==='EXPLICIT_AUTHENTICATED_REPAIR_WORK_INTERVAL'&&id(w?.id)&&w.id===p.choice.workIntervalId&&c.workIntervalId===w.id&&w.fingerprint===await hash(t)&&t?.repairId===p.targetId&&t.clientId===p.clientId);
        start=t.startedAt;end=t.endedAt;tech=t.technicianId;
      }else check(s.version===1&&c.workIntervalId===undefined&&p.choice.workIntervalId===undefined);
      check(iso(start)&&iso(end)&&tech===p.basisSnapshot.technicianId&&Date.parse(end)>Date.parse(start)&&BigInt(Date.parse(end)-Date.parse(start))*1000n===q&&Date.parse(start)>=Date.parse(p.basisSnapshot.periodStart+'T00:00:00Z')&&Date.parse(end)<=Date.parse(p.basisSnapshot.periodEnd+'T00:00:00Z')+86400000);
      check(c.valuationKey===await hash({kind:'LABOR',targetType:p.targetType,id:p.targetId,...(p.targetType==='REPAIR'?{workIntervalId:p.choice.workIntervalId}:{})}));
      check(k&&k.quantity===c.quantity&&k.quantityUnit==='SECOND'&&k.method==='CONFIRMED_EXPENSE_PAID_TIME'&&k.baseAmountCents===original.expense.amountCents&&base===BigInt(p.basisSnapshot.paidMinutes)*60000000n&&before!==null&&before>=0n&&q<=base-before&&Number.isSafeInteger(k.poolAmountBeforeCents)&&k.poolAmountBeforeCents>=0&&k.poolAmountBeforeCents<=k.baseAmountCents&&k.measuredQuantityBefore==='0');
      const final=q===base-before,amount=final?BigInt(k.baseAmountCents-k.poolAmountBeforeCents):(2n*q*BigInt(k.baseAmountCents)+base)/(2n*base);
      check(k.rounding===(final?'FINAL_POOL_REMAINDER':'NEAREST_CENT')&&cents(c.amountCents)&&c.amountCents===Number(amount)&&k.amountCents===c.amountCents&&c.amountCents<=k.baseAmountCents-k.poolAmountBeforeCents);total+=c.amountCents;
    }
    check(total===p.amountCents);
  }
  async function group(row) {
    check(id(row?.id)&&id(row.basisId)&&row.fingerprint===await hash(row.snapshot)&&row.recordHash===await hash(raw(row))&&iso(row.createdAt)&&/^ADMIN:[1-9]\d*$/.test(row.createdBy));
    const s=row.snapshot,p=s.preview;await valuePreview(p);check(s.version===1&&s.basisId===row.basisId&&p.basisId===row.basisId&&s.basisFingerprint===p.basisFingerprint&&s.parts?.length===p.components.length);
    for(const [i,a] of s.parts.entries()) {
      const c=p.components[i],marker={version:1,basisId:row.basisId,basisFingerprint:p.basisFingerprint,groupId:row.id,primaryExpenseId:p.components[0].expenseId,expenseIds:p.components.map(c=>c.expenseId)},e=p.basisSnapshot.components[i].expense;
      check(id(a.id)&&a.expenseId===c.expenseId&&a.valuationType==='LABOR'&&a.purchaseItemId===null&&['monthRef','amountCents','targetType','clientId','targetHash','valuationKey','valuationHash','quantity','quantityUnit'].every(k=>a[k]===c[k])&&a.createdById===Number(row.createdBy.slice(6))&&a.reason===row.reason&&iso(a.createdAt)&&equal(a.expenseSnapshot,e)&&a.expenseHash===await hash(e)&&equal(a.valuationSnapshot,{source:c.source,calculation:c.calculation,composition:marker}));
      check(a.visitId===(c.targetType==='REGULAR'?c.targetId:null)&&a.extraVisitId===(c.targetType==='EXTRA'?c.targetId:null)&&a.repairId===(c.targetType==='REPAIR'?c.targetId:null));
      check(a.activeMeasurementKey==='LABOR:'+c.targetType+':'+c.targetId+(c.workIntervalId?':INTERVAL:'+c.workIntervalId:'')+(i?':COMPONENT:'+c.expenseId:''));
      check(a.activeKey===await hash({expenseId:c.expenseId,monthRef:c.monthRef,type:c.targetType,id:c.targetId,valuationType:'LABOR',purchaseItemId:null,...(c.workIntervalId?{workIntervalId:c.workIntervalId}:{})}));
    }
    if(row.voidedAt)check(iso(row.voidedAt)&&typeof row.voidReason==='string'&&/^ADMIN:[1-9]\d*$/.test(row.voidedBy));
  }
  async function pending(r,owner) {
    check(r?.owner===owner&&id(r.resourceId)&&typeof r.requestId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(r.requestId)&&iso(r.createdAt)&&r.payloadHash===await hash({v:1,scope:'LABOR_COST_COMPOSITION',resourceId:r.resourceId,payload:r.payload}));
    const {command,data:d}=r.payload;check(['CREATE','VALUE','VOID_BASIS','VOID_VALUE'].includes(command)&&d?.confirmed===true&&typeof d.reason==='string'&&d.reason.trim()===d.reason&&d.reason.length>0&&d.reason.length<=500);
    if(command==='CREATE') { await basisPreview(r.review);check(d.previewHash===r.review.hash&&equal(d.expenseIds,r.review.snapshot.components.map(c=>c.expenseId))&&r.resourceId===d.expenseIds[0]); }
    else if(command==='VALUE') { await valuePreview(r.review);check(d.previewHash===r.review.hash&&equal(d.choice,r.review.choice)&&r.resourceId===r.review.basisId); }
    else { const before=r.review;check(d.recordHash===await hash(before)&&before.voidedAt===null);if(command==='VOID_BASIS'){await basis({...before,recordHash:d.recordHash,state:'CONFIRMED',reviewReasons:[]});check(before.id===r.resourceId);}else{await group({...before,recordHash:d.recordHash});check(before.id===d.groupId&&before.basisId===r.resourceId);} }
  }
  async function receipt(result,r) {
    const receipt=result?.receipt,d=r.payload.data;check(result?.ok===true&&typeof result.applied==='boolean'&&equal(result.context,r.payload)&&receipt?.owner===r.owner&&receipt.requestId===r.requestId&&receipt.scope==='LABOR_COST_COMPOSITION'&&receipt.resourceId===r.resourceId&&receipt.payloadHash===r.payloadHash&&iso(receipt.confirmedAt));
    if(!result.applied){check(result.code==='COMPOSITION_REVIEW'&&typeof result.message==='string'&&result.message.length>0);return;}
    const command=r.payload.command,row=command==='CREATE'||command==='VOID_BASIS'?result.basis:result.group;
    check(result.recordHash===await hash(row));
    if(command==='CREATE'){await basis({...row,recordHash:result.recordHash,state:'CONFIRMED',reviewReasons:[]});check(equal(result.preview,r.review)&&equal(row.snapshot,r.review.snapshot)&&row.fingerprint===r.review.fingerprint&&row.technicianName===r.review.technicianName&&row.reason===d.reason&&row.createdBy===r.owner&&row.voidedAt===null);}
    if(command==='VALUE'){await group({...row,recordHash:result.recordHash});check(equal(result.preview,r.review)&&equal(row.snapshot.preview,r.review)&&row.basisId===r.resourceId&&row.reason===d.reason&&row.createdBy===r.owner&&row.voidedAt===null);}
    if(command.startsWith('VOID_')){check(equal(result.before,r.review)&&iso(row.voidedAt)&&equal(row,{...r.review,voidedAt:row.voidedAt,voidedBy:r.owner,voidReason:d.reason,...(command==='VOID_BASIS'?{activeKey:null}:{})}));}
  }
  window.CWLaborCompositionProof={id,sha,iso,equal,hash,check,raw,basisFacts,basisPreview,basis,valuePreview,group,pending,receipt};
})();
