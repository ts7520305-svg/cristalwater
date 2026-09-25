(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CWVehicleConsumptionRules=value;}(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),positive=v=>Number.isInteger(v)&&v>0&&v<=2147483647;
 const id=v=>typeof v==='string'&&/^[1-9]\d{0,9}$/.test(v)&&positive(Number(v))?Number(v):null;
 const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
 const keys=(v,names)=>object(v)&&Object.keys(v).sort().join(',')===[...names].sort().join(',');
 const text=(v,max)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v)&&!Array.from(v).some(c=>c.codePointAt(0)>=0xd800&&c.codePointAt(0)<=0xdfff);
 function quantity(v){if(typeof v!=='string'||! /^(?:0|[1-9]\d{0,6})(?:\.\d{1,6})?$/.test(v))return null;const n=Number(v);return n>0&&n<=1000000?n:null;}
 const units=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&Number.isSafeInteger(Math.round(v*1e6))&&Math.abs(v*1e6-Math.round(v*1e6))<=Math.max(1,Math.abs(v*1e6))*Number.EPSILON*4?Math.round(v*1e6):null;
 function after(item,quantity){const a=units(item.quantity),b=units(item.usedQty),n=units(Number(quantity));return a!==null&&b!==null&&n!==null&&n>0&&a>=n&&Number.isSafeInteger(b+n)?{quantity:(a-n)/1e6,usedQty:(b+n)/1e6}:null;}
 function input(v){if(!keys(v,['workGuideId','itemId','quantity','visitId','location','notes'])||!positive(v.workGuideId)||!positive(v.itemId)||quantity(v.quantity)===null||v.visitId!==null&&!positive(v.visitId)||!text(v.location,500)||!text(v.notes,2000)||v.notes.trim().length<3)return null;return {...v,quantity:String(quantity(v.quantity)),location:v.location.trim(),notes:v.notes.trim()};}
 function query(v={}){if(!object(v)||Object.keys(v).some(k=>!['page','q','workGuideId'].includes(k)))return null;const page=v.page===undefined?1:id(v.page),q=v.q===undefined?'':v.q,workGuideId=v.workGuideId===undefined?null:id(v.workGuideId);if(!page||page>1000000||!text(q,200)||v.workGuideId!==undefined&&!workGuideId)return null;return {page,q:q.trim(),workGuideId};}
 const base=(p,owner)=>object(p)&&p.ok===true&&p.version===1&&p.owner===owner&&iso(p.asOf);
 const item=v=>object(v)&&positive(v.id)&&positive(v.workGuideId)&&text(v.name,10000)&&v.name.trim().length>0&&text(v.unit,1000)&&v.unit.trim().length>0&&[v.quantity,v.usedQty,v.initialQty].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)&&iso(v.updatedAt);
 const work=v=>object(v)&&positive(v.id)&&positive(v.vehicleId)&&v.vehicle?.id===v.vehicleId&&text(v.vehicle.plate,10000)&&iso(v.updatedAt)&&v.status==='OPEN'&&Array.isArray(v.items)&&v.items.every(i=>item(i)&&i.workGuideId===v.id)&&new Set(v.items.map(i=>i.id)).size===v.items.length;
 function listPacket(p,owner,page){return Boolean(base(p,owner)&&p.page===page&&p.size===25&&Number.isSafeInteger(p.total)&&p.total>=0&&Array.isArray(p.guides)&&p.guides.length===Math.min(25,Math.max(0,p.total-(page-1)*25))&&p.guides.every(work)&&new Set(p.guides.map(g=>g.id)).size===p.guides.length);}
 function reviewPacket(p,owner,proposal){const c=p?.choice,n=quantity(proposal?.quantity);return Boolean(input(proposal)&&input(p?.proposal)&&base(p,owner)&&uuid(p.requestId)&&typeof p.reviewToken==='string'&&p.reviewToken.length>80&&p.reviewToken.length<4000&&iso(p.expiresAt)&&Date.parse(p.expiresAt)>Date.parse(p.asOf)&&Date.parse(p.expiresAt)-Date.parse(p.asOf)<=300000&&JSON.stringify(input(p.proposal))===JSON.stringify(input(proposal))&&c?.work?.id===proposal.workGuideId&&c.work.status==='OPEN'&&item(c.item)&&c.item.id===proposal.itemId&&c.item.workGuideId===proposal.workGuideId&&c.vehicle?.id===c.work.vehicleId&&text(c.vehicle.plate,10000)&&(proposal.visitId===null?c.visit===null:c.visit?.id===proposal.visitId)&&n!==null&&after(c.item,proposal.quantity)&&p.after?.quantity===after(c.item,proposal.quantity).quantity&&p.after.usedQty===after(c.item,proposal.quantity).usedQty);}
 function resultPacket(p,owner,pending){
  if(!base(p,owner)||p.requestId!==pending.requestId||!['CONFIRMED','UNCONFIRMED','CANCELLED'].includes(p.status))return false;
  const r=p.result;if(p.status==='UNCONFIRMED')return r===null;
  if(!object(r)||r.workGuideId!==pending.workGuideId||r.itemId!==pending.itemId||!positive(r.auditId)||r.receipt?.owner!==owner||r.receipt.requestId!==pending.requestId||r.receipt.scope!=='VEHICLE_MANUAL_CONSUMPTION'||r.receipt.resourceId!==pending.workGuideId||!iso(r.receipt.confirmedAt))return false;
  return p.status==='CANCELLED'?r.cancelled===true&&r.item===null:item(r.item)&&r.item.id===pending.itemId&&r.item.workGuideId===pending.workGuideId&&positive(r.vehicleMovementId)&&positive(r.stockMovementId)&&quantity(r.quantity)!==null;
 }

 function pending(raw,owner){if(raw===null)return null;try{const p=JSON.parse(raw);return keys(p,['version','owner','workGuideId','itemId','requestId'])&&p.version===1&&p.owner===owner&&positive(p.workGuideId)&&positive(p.itemId)&&uuid(p.requestId)?p:false;}catch(_){return false;}}
 return {object,positive,id,iso,uuid,keys,text,quantity,units,after,input,query,base,item,work,listPacket,reviewPacket,resultPacket,pending};
}));
