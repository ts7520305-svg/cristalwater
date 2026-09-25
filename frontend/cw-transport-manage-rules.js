(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./cw-transport-items-rules'));else root.CWTransportManageRules=factory(root.CWTransportItemsRules);}(typeof globalThis==='object'?globalThis:this,function(B){
 'use strict';
 const {object,positive,iso,keys,text}=B,fields=['codeAT','origin','destination','notes','validFrom','validUntil','isDraft'],actions=['EDIT','CLOSE','CANCEL','REOPEN'];
 const nullable=(v,max)=>v===null||text(v,max),date=v=>v===null||iso(v),unique=a=>Array.isArray(a)&&a.length<=100&&a.every(v=>object(v)&&positive(v.id))&&new Set(a.map(v=>v.id)).size===a.length;
 function input(v){
  if(!keys(v,['guideId','action','reason','changes','workGuideId'])||!positive(v.guideId)||!actions.includes(v.action)||!text(v.reason,2000)||v.reason.trim().length<3||v.workGuideId!==null&&!positive(v.workGuideId)||!object(v.changes)||Object.keys(v.changes).some(k=>!fields.includes(k)))return null;
  const changes={};for(const k of fields)if(Object.hasOwn(v.changes,k)){const x=v.changes[k];if(k==='isDraft'?typeof x!=='boolean':k==='validFrom'?!iso(x):k==='validUntil'?!date(x):!nullable(x,{codeAT:200,origin:500,destination:500,notes:2000}[k]))return null;if(k==='codeAT'&&x!==null&&!x.trim())return null;changes[k]=k==='codeAT'&&x!==null?x.trim():x;}
  if(v.action==='EDIT'?v.workGuideId!==null||!Object.keys(changes).length:Object.keys(changes).length||v.action!=='REOPEN'&&v.workGuideId!==null)return null;
  return {guideId:v.guideId,action:v.action,reason:v.reason.trim(),changes,workGuideId:v.workGuideId};
 }
 const canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 const metadata=c=>Object.fromEntries(fields.map(k=>[k,c[k]]));
 function choice(c){return object(c)&&positive(c.id)&&(c.vehicleId===null?c.vehicle===null:positive(c.vehicleId)&&c.vehicle?.id===c.vehicleId&&text(c.vehicle.plate,200)&&typeof c.vehicle.active==='boolean'&&date(c.vehicle.deletedAt)&&iso(c.vehicle.updatedAt))&&['ACTIVE','CLOSED','CANCELLED'].includes(c.status)&&nullable(c.codeAT,10000)&&nullable(c.origin,10000)&&nullable(c.destination,10000)&&nullable(c.notes,100000)&&iso(c.validFrom)&&date(c.validUntil)&&date(c.closedAt)&&typeof c.isDraft==='boolean'&&iso(c.updatedAt)&&unique(c.items)&&c.items.every(i=>i.guideId===c.id&&text(i.name,10000)&&B.units(i.quantity)!==null)&&unique(c.workGuides)&&c.workGuides.every(w=>w.guideId===c.id&&(w.technicianId===null?w.technician===null:positive(w.technicianId)&&w.technician?.id===w.technicianId&&text(w.technician.name,10000)&&typeof w.technician.active==='boolean'&&date(w.technician.deletedAt)&&Number.isSafeInteger(w.technician.authVersion))&&(w.vehicleId===null||positive(w.vehicleId))&&['OPEN','CLOSED'].includes(w.status)&&iso(w.updatedAt)&&date(w.closedAt)&&unique(w.items)&&w.items.every(i=>B.item(i)&&i.workGuideId===w.id))&&unique(c.otherActiveGuides)&&c.otherActiveGuides.every(g=>g.id!==c.id&&g.vehicleId===c.vehicleId&&g.status==='ACTIVE'&&iso(g.updatedAt))&&unique(c.otherOpenWorks)&&c.otherOpenWorks.every(w=>w.guideId!==c.id&&w.vehicleId===c.vehicleId&&w.status==='OPEN'&&iso(w.updatedAt))&&unique(c.pendingLocks)&&c.pendingLocks.every(l=>c.workGuides.some(w=>w.id===l.entityId)&&iso(l.updatedAt));}
 function plan(raw,c){
  const p=input(raw);if(!p||!choice(c)||p.guideId!==c.id)return null;
  const before=metadata(c),after={...before,...p.changes};let status=c.status,closeWorkGuideIds=[],reopenWorkGuideId=null;
  if(p.action==='EDIT'){
   if(!fields.some(k=>before[k]!==after[k]))return null;
   if(['validFrom','validUntil'].some(k=>Object.hasOwn(p.changes,k))&&after.validUntil!==null&&Date.parse(after.validUntil)<Date.parse(after.validFrom))return null;
   if(['codeAT','isDraft'].some(k=>Object.hasOwn(p.changes,k))&&!after.isDraft&&!after.codeAT?.trim())return null;
  }else{
   if(c.workGuides.some(w=>w.vehicleId!==c.vehicleId))return null;
   if(p.action==='CLOSE'){if(c.status!=='ACTIVE')return null;status='CLOSED';}
   if(p.action==='CANCEL'){if(!['ACTIVE','CLOSED'].includes(c.status))return null;status='CANCELLED';}
   if(p.action==='REOPEN'){
    if(c.status==='ACTIVE'||!c.vehicle?.active||c.vehicle.deletedAt!==null||c.otherActiveGuides.length||c.otherOpenWorks.length||c.workGuides.some(w=>w.status==='OPEN'))return null;
    if(c.workGuides.length?(p.workGuideId===null||!c.workGuides.some(w=>w.id===p.workGuideId)):p.workGuideId!==null)return null;
    const work=c.workGuides.find(w=>w.id===p.workGuideId);if(work?.technician&&(!work.technician.active||work.technician.deletedAt!==null||work.technician.vehicleId!==c.vehicleId))return null;
    status='ACTIVE';reopenWorkGuideId=p.workGuideId;
   }else closeWorkGuideIds=c.workGuides.filter(w=>w.status==='OPEN').map(w=>w.id);
  }
  const openIds=p.action==='REOPEN'?[reopenWorkGuideId]:c.workGuides.filter(w=>w.status==='OPEN').map(w=>w.id);
  const resolveLockIds=status==='ACTIVE'&&!after.isDraft&&!!after.codeAT?.trim()&&(p.action==='REOPEN'||Object.hasOwn(p.changes,'codeAT')||Object.hasOwn(p.changes,'isDraft'))?c.pendingLocks.filter(l=>openIds.includes(l.entityId)).map(l=>l.id):[];
  return {before,after,status,closeWorkGuideIds,reopenWorkGuideId,resolveLockIds};
 }
 function listPacket(v,owner,page){return Boolean(B.base(v,owner)&&v.page===page&&v.size===25&&Number.isSafeInteger(v.total)&&v.total>=0&&unique(v.guides)&&v.guides.length===Math.min(25,Math.max(0,v.total-(page-1)*25))&&v.guides.every(choice));}
 function reviewPacket(v,owner,p){return Boolean(B.base(v,owner)&&B.uuid(v.requestId)&&typeof v.reviewToken==='string'&&v.reviewToken.length>80&&v.reviewToken.length<4000&&iso(v.expiresAt)&&Date.parse(v.expiresAt)>Date.parse(v.asOf)&&Date.parse(v.expiresAt)-Date.parse(v.asOf)<=300000&&input(p)&&JSON.stringify(input(v.proposal))===JSON.stringify(input(p))&&plan(p,v.choice)&&JSON.stringify(v.plan)===JSON.stringify(plan(p,v.choice)));}
 function resultPacket(v,owner,p){
  if(!B.base(v,owner)||v.requestId!==p.requestId||!['CONFIRMED','UNCONFIRMED','CANCELLED'].includes(v.status))return false;
  const r=v.result;if(v.status==='UNCONFIRMED')return r===null;
  if(!object(r)||r.guideId!==p.guideId||!positive(r.auditId)||r.receipt?.owner!==owner||r.receipt.requestId!==p.requestId||r.receipt.scope!=='TRANSPORT_GUIDE_MANAGE'||r.receipt.resourceId!==p.guideId||!iso(r.receipt.confirmedAt))return false;
  if(v.status==='CANCELLED')return r.cancelled===true&&r.guide===null;
  const expected=plan(r.proposal,r.before),g=r.guide;if(!iso(r.appliedAt)||!expected||!choice(g)||g.id!==p.guideId||!same(expected,r.plan)||fields.some(k=>g[k]!==expected.after[k])||g.status!==expected.status||g.vehicleId!==r.before.vehicleId||JSON.stringify(g.items)!==JSON.stringify(r.before.items)||g.workGuides.length!==r.before.workGuides.length)return false;
  if(r.proposal.action==='REOPEN'?g.closedAt!==null:r.proposal.action==='EDIT'?g.closedAt!==r.before.closedAt:g.closedAt!==(r.before.status==='CLOSED'&&r.before.closedAt?r.before.closedAt:r.appliedAt))return false;
  if(expected.resolveLockIds.some(id=>g.pendingLocks.some(l=>l.id===id)))return false;
  return r.before.workGuides.every(w=>{const after=g.workGuides.find(a=>a.id===w.id),reopen=expected.reopenWorkGuideId===w.id,close=expected.closeWorkGuideIds.includes(w.id);if(!after||after.status!==(reopen?'OPEN':close?'CLOSED':w.status)||after.closedAt!==(reopen?null:close?r.appliedAt:w.closedAt))return false;return Object.keys(w).filter(k=>!['status','closedAt','updatedAt'].includes(k)).every(k=>JSON.stringify(w[k])===JSON.stringify(after[k]));});
 }
 return {...B,fields,actions,input,metadata,choice,editable:choice,plan,listPacket,reviewPacket,resultPacket};
}));
