(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./cw-reminder-visit-rules'),require('./cw-reminder-resource-rules'),require('./cw-maintenance-material-rules'));
  else root.CWReminderVisitResourceRules=factory(root.CWReminderVisitRules,root.CWReminderResourceRules,root.CWMaintenanceMaterialRules);
})(typeof globalThis!=='undefined'?globalThis:this,function(links,resources,material){
  'use strict';
  const {fields,positive,uuid,sha,iso,owner,reason}=links,{quantity,decimal,normalize}=material;
  const scope='REMINDER_VISIT_RESOURCES',basis='ADMIN_ASSOCIATED_REMINDER_RESOURCES';
  const fail=()=>{throw Error('Reveja as parcelas próprias, a visita e os comprovativos. Conserve o pedido original.');};
  const key=i=>JSON.stringify([normalize(i.productName),normalize(i.unit)]);
  const facts=p=>{const {available,hash,...value}=p;return value;};
  const select=v=>({action:v.action,recordId:v.recordId,data:v.data});
  function input(v){
    if(!fields(v,['action','recordId','data'])||!['DECLARE','VOID'].includes(v.action))fail();
    if(v.action==='VOID'){if(!uuid(v.recordId)||v.data!==null)fail();}
    else {if(v.recordId!==null)fail();const d=resources.input(v.data);if(d.materials&&d.materials.items.some((item,n)=>['productName','unit','quantity'].some(k=>item[k]!==v.data.materials.items[n][k])))fail();}
    return v;
  }
  function command(v){if(!fields(v,['requestId','action','recordId','data','previewHash','reason','confirmed'])||!uuid(v.requestId)||!sha(v.previewHash)||!reason(v.reason)||v.confirmed!==true)fail();input(select(v));return v;}
  const overlap=(a,b)=>Date.parse(a.startedAt)<Date.parse(b.endedAt)&&Date.parse(b.startedAt)<Date.parse(a.endedAt);
  function compare(data,parent,peers,movements){
    resources.input(data);if(!links.parent(parent)||data.technicianId!==parent.technicianId||!Array.isArray(peers)||!Array.isArray(movements))fail();
    const seen=new Set(),totals=new Map();
    for(const p of peers){
      if(!fields(p,['type','id','reminderId','hash','materials','workTime'])||!sha(p.hash)||(p.type==='EQUIPMENT'?!positive(p.id)||p.reminderId!==null:p.type!=='REMINDER'||!uuid(p.id)||!positive(p.reminderId))||seen.has(p.type+':'+p.id))fail();seen.add(p.type+':'+p.id);
      if(p.materials!==null){resources.input({technicianId:parent.technicianId,materials:p.materials,workTime:null});for(const i of p.materials.items)totals.set(key(i),(totals.get(key(i))||0n)+quantity(i.quantity));}
      if(p.workTime!==null){if(!fields(p.workTime,['startedAt','endedAt'])||!iso(p.workTime.startedAt)||!iso(p.workTime.endedAt)||Date.parse(p.workTime.endedAt)<=Date.parse(p.workTime.startedAt))fail();if(Date.parse(p.workTime.startedAt)<Date.parse(parent.startAt)||Date.parse(p.workTime.endedAt)>Date.parse(parent.endAt)||data.workTime&&overlap(data.workTime,p.workTime))fail();}
    }
    if(data.workTime&&(Date.parse(data.workTime.startedAt)<Date.parse(parent.startAt)||Date.parse(data.workTime.endedAt)>Date.parse(parent.endAt)))fail();
    const ids=new Set();for(const m of movements){if(!positive(m.id)||ids.has(m.id)||!iso(m.createdAt))fail();ids.add(m.id);}
    const lines=[];
    for(const item of data.materials?.items||[]){
      const selected=movements.filter(m=>key(m)===key(item)),products=new Set();let net=0n;
      for(const m of selected){
        const n=quantity(m.quantity),type=String(m.movementType).trim().toUpperCase();
        if(n===null||n<=0n||decimal(n)!==m.quantity||!['CONSUMPTION','RETURN','EMERGENCY_DISTRIBUTED_CONSUMPTION'].includes(type)||(parent.type==='REGULAR'?m.visitId!==parent.id||m.extraVisitId!==null:m.extraVisitId!==parent.id||m.visitId!==null)||['clientId','poolId','technicianId'].some(k=>m[k]!==null&&m[k]!==parent[k])||Date.parse(m.createdAt)<Date.parse(parent.startAt)||m.productId!==null&&!positive(m.productId))fail();
        if(m.productId!==null)products.add(m.productId);net+=type==='RETURN'?-n:n;
      }
      const reserved=totals.get(key(item))||0n,q=quantity(item.quantity);if(!selected.length||products.size>1||net<reserved+q)fail();
      lines.push({...item,visitQuantity:decimal(net),reservedQuantity:decimal(reserved),remainingQuantity:decimal(net-reserved-q)});
    }
    return {materials:lines,durationSeconds:data.workTime?(Date.parse(data.workTime.endedAt)-Date.parse(data.workTime.startedAt))/1000:null};
  }
  async function preview(p,hash){
    if(!fields(p,['available','schema','basis','reminderId','selection','contextHash','previousHash','origin','association','parent','peers','movements','comparison','affectedShares',...(p?.affectedCosts!==undefined?['affectedCosts']:[]),'original','hash'])||p.available!==true||p.schema!==1||p.basis!==basis||!positive(p.reminderId)||!sha(p.contextHash)||p.previousHash!==null&&!sha(p.previousHash)||!sha(p.hash)||await hash(facts(p))!==p.hash)fail();input(p.selection);
    const o=p.origin;if(!fields(o,['reminderId','clientId','poolId','technicianId','visitType','visitId','associationId'])||o.reminderId!==p.reminderId||!['REGULAR','EXTRA'].includes(o.visitType)||!uuid(o.associationId)||!['reminderId','clientId','poolId','technicianId','visitId'].every(k=>positive(o[k])))fail();
    if(!Array.isArray(p.affectedShares)||new Set(p.affectedShares.map(s=>s.id)).size!==p.affectedShares.length||p.affectedShares.some(s=>!uuid(s.id)||!sha(s.hash)||![s.expenseId,s.allocationId,s.amountCents].every(positive)||(s.reminderId===undefined?!positive(s.completionId):s.completionId!==null||!positive(s.reminderId))||quantity(s.quantity)===null||quantity(s.quantity)<=0n))fail();
    if(p.affectedCosts!==undefined&&(p.selection.action!=='VOID'||!Array.isArray(p.affectedCosts)||new Set(p.affectedCosts.map(s=>s.shareId)).size!==p.affectedCosts.length||p.affectedCosts.some(s=>!fields(s,['shareId','shareHash','reminderId','kind','expenseId','allocationId','amountCents'])||!uuid(s.shareId)||!sha(s.shareHash)||s.reminderId!==p.reminderId||!['MATERIAL','LABOR'].includes(s.kind)||![s.expenseId,s.allocationId,s.amountCents].every(positive))))fail();
    if(p.selection.action==='VOID'){
      if(p.original?.event?.preview?.selection?.action!=='DECLARE')fail();await response(p.original,p.original.envelope,p.original.event.owner,p.reminderId,hash);
      if(!p.original.applied||p.original.event.id!==p.selection.recordId||p.previousHash!==p.original.eventHash||await hash(o)!==await hash(p.original.event.preview.origin)||['association','parent','peers','movements','comparison'].some(k=>p[k]!==null))fail();return p;
    }
    const a=p.association;if(p.original!==null||a?.event?.preview?.selection?.action!=='LINK')fail();await links.response(a,a.envelope,a.event.owner,p.reminderId,hash);
    const ap=a.event.preview;if(!a.applied||a.event.id!==o.associationId||await hash(p.parent)!==ap.parentHash||o.visitType!==p.parent.type||o.visitId!==p.parent.id||['clientId','poolId','technicianId'].some(k=>o[k]!==ap.origin[k])||await hash(resources.input(p.selection.data))!==await hash(p.selection.data))fail();
    if(p.selection.data.workTime&&Date.parse(p.selection.data.workTime.endedAt)>Date.parse(ap.source.completedAt))fail();
    if(await hash(compare(p.selection.data,p.parent,p.peers,p.movements))!==await hash(p.comparison))fail();return p;
  }
  async function response(v,body,actor,reminderId,hash){
    command(body);const {requestId,...payload}=body,r=v?.receipt;
    if(v?.ok!==true||typeof v.applied!=='boolean'||!owner(actor)||!positive(reminderId)||!fields(r,['owner','requestId','scope','resourceId','payloadHash','confirmedAt'])||r.owner!==actor||r.requestId!==requestId||r.scope!==scope||r.resourceId!==reminderId||!iso(r.confirmedAt)||r.payloadHash!==await hash({v:1,scope,resourceId:reminderId,payload})||await hash(v.envelope)!==await hash(body))fail();
    if(!v.applied){if(typeof v.code!=='string'||typeof v.message!=='string'||v.event!==undefined||v.eventHash!==undefined)fail();return v;}
    const e=v.event,p=await preview(e?.preview,hash);
    if(!fields(e,['schema','basis','id','owner','reminderId','reason','createdAt','preview'])||e.schema!==1||e.basis!==basis||e.id!==requestId||e.owner!==actor||e.reminderId!==reminderId||!iso(e.createdAt)||Date.parse(r.confirmedAt)<Date.parse(e.createdAt)||e.reason!==body.reason||p.reminderId!==reminderId||p.hash!==body.previewHash||await hash(p.selection)!==await hash(select(body))||await hash(e)!==v.eventHash||Date.parse(e.createdAt)<Date.parse(p.association?.event.createdAt||p.original.event.createdAt))fail();return v;
  }
  return {scope,basis,fields,positive,uuid,sha,iso,owner,reason,input,command,select,facts,key,compare,preview,response,overlap,resources};
});
