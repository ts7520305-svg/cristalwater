(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./cw-vehicle-consumption-rules'));else root.CWTransportGuideRules=factory(root.CWVehicleConsumptionRules);}(typeof globalThis==='object'?globalThis:this,function(B){
 'use strict';
 const {object,positive,id,iso,uuid,keys,text,base,units}=B;
 const quantity=v=>typeof v==='string'&&/^(?:0|[1-9]\d{0,6})(?:\.\d{1,6})?$/.test(v)&&Number(v)<=1000000?Number(v):null;
 function input(v){
  if(!keys(v,['vehicleId','workGuideId','technicianId','startKm','codeAT','origin','destination','notes','validFrom','validUntil','isDraft','items'])||!positive(v.vehicleId)||![v.workGuideId,v.technicianId].every(x=>x===null||positive(x))||v.startKm!==null&&(typeof v.startKm!=='number'||!Number.isFinite(v.startKm)||v.startKm<0||v.startKm>1000000000)||!iso(v.validFrom)||v.validUntil!==null&&(!iso(v.validUntil)||Date.parse(v.validUntil)<Date.parse(v.validFrom))||typeof v.isDraft!=='boolean')return null;
  for(const [k,max]of [['codeAT',200],['origin',500],['destination',500],['notes',2000]])if(!text(v[k],max))return null;
  if(!v.origin.trim()||!v.destination.trim()||!v.notes.trim()||!v.isDraft&&!v.codeAT.trim()||!Array.isArray(v.items)||!v.items.length||v.items.length>100)return null;
  const mapped=[];for(const row of v.items){if(!keys(row,['workItemId','name','type','unit','quantity'])||row.workItemId!==null&&!positive(row.workItemId)||!text(row.name,300)||!row.name.trim()||row.type!==null&&(!text(row.type,100)||!row.type.trim())||!text(row.unit,30)||!row.unit.trim()||quantity(row.quantity)===null||row.workItemId===null&&(quantity(row.quantity)<=0||row.type===null))return null;mapped.push({...row,name:row.name.trim(),type:row.type===null?null:row.type.trim(),unit:row.unit.trim(),quantity:String(quantity(row.quantity))});}
  const ids=mapped.filter(i=>i.workItemId!==null).map(i=>i.workItemId);if(new Set(ids).size!==ids.length||v.workGuideId===null&&ids.length)return null;
  return {...v,codeAT:v.codeAT.trim(),origin:v.origin.trim(),destination:v.destination.trim(),notes:v.notes.trim(),items:mapped};
 }
 function query(v={}){if(!object(v)||Object.keys(v).some(k=>!['page','q','vehicleId'].includes(k)))return null;const page=v.page===undefined?1:id(v.page),q=v.q===undefined?'':v.q,vehicleId=v.vehicleId===undefined?null:id(v.vehicleId);return page&&page<=1000000&&text(q,200)&&(v.vehicleId===undefined||vehicleId)?{page,q:q.trim(),vehicleId}:null;}
 const unique=rows=>Array.isArray(rows)&&new Set(rows.map(r=>r.id)).size===rows.length;
 function choice(v){return object(v)&&positive(v.id)&&text(v.plate,200)&&v.active===true&&v.deletedAt===null&&iso(v.updatedAt)&&unique(v.technicians)&&v.technicians.every(t=>positive(t.id)&&text(t.name,10000)&&t.vehicleId===v.id)&&unique(v.workGuides)&&v.workGuides.every(w=>positive(w.id)&&w.vehicleId===v.id&&w.status==='OPEN'&&iso(w.updatedAt)&&unique(w.items)&&w.items.every(i=>B.item(i)&&i.workGuideId===w.id))&&unique(v.transportGuides)&&v.transportGuides.every(g=>positive(g.id)&&g.vehicleId===v.id&&g.status==='ACTIVE'&&iso(g.updatedAt));}
 function plan(p,c){
  if(!input(p)||!choice(c)||p.vehicleId!==c.id||p.technicianId!==null&&!c.technicians.some(t=>t.id===p.technicianId))return null;
  const work=p.workGuideId===null?null:c.workGuides.find(w=>w.id===p.workGuideId&&w.guideId===null);
  if(p.workGuideId!==null&&(!work||work.technicianId!==p.technicianId||work.startKm!==p.startKm))return null;
  const rows=[];for(const i of p.items){const old=i.workItemId===null?null:work?.items.find(r=>r.id===i.workItemId);if(i.workItemId!==null&&(!old||old.name!==i.name||old.type!==i.type||old.unit!==i.unit))return null;const n=units(Number(i.quantity)),used=old?units(old.usedQty):0;if(n===null||used===null||n<used)return null;rows.push({...i,before:old?{initialQty:old.initialQty,quantity:old.quantity,usedQty:old.usedQty}:null,after:{initialQty:n/1e6,quantity:(n-used)/1e6,usedQty:used/1e6}});}
  if(work&&work.items.some(i=>!p.items.some(r=>r.workItemId===i.id)))return null;
  return {linkedWorkGuideId:work?.id||null,rows,closeWorkGuideIds:c.workGuides.filter(w=>w.id!==work?.id).map(w=>w.id),closeTransportGuideIds:c.transportGuides.map(g=>g.id)};
 }
 function listPacket(v,owner,page){return Boolean(base(v,owner)&&v.page===page&&v.size===25&&Number.isSafeInteger(v.total)&&v.total>=0&&unique(v.vehicles)&&v.vehicles.length===Math.min(25,Math.max(0,v.total-(page-1)*25))&&v.vehicles.every(choice));}
 function reviewPacket(v,owner,p){return Boolean(base(v,owner)&&uuid(v.requestId)&&typeof v.reviewToken==='string'&&v.reviewToken.length>80&&v.reviewToken.length<4000&&iso(v.expiresAt)&&Date.parse(v.expiresAt)>Date.parse(v.asOf)&&Date.parse(v.expiresAt)-Date.parse(v.asOf)<=300000&&input(p)&&JSON.stringify(input(v.proposal))===JSON.stringify(input(p))&&plan(p,v.choice)&&JSON.stringify(v.plan)===JSON.stringify(plan(p,v.choice)));}
 function pending(raw,owner){if(raw===null)return null;try{const p=JSON.parse(raw);return keys(p,['version','owner','vehicleId','requestId'])&&p.version===1&&p.owner===owner&&positive(p.vehicleId)&&uuid(p.requestId)?p:false;}catch(_){return false;}}
 function resultPacket(v,owner,p){
  if(!base(v,owner)||v.requestId!==p.requestId||!['CONFIRMED','UNCONFIRMED','CANCELLED'].includes(v.status))return false;
  const r=v.result;if(v.status==='UNCONFIRMED')return r===null;
  if(!object(r)||r.vehicleId!==p.vehicleId||!positive(r.auditId)||r.receipt?.owner!==owner||r.receipt.requestId!==p.requestId||r.receipt.scope!=='TRANSPORT_GUIDE_CREATE'||r.receipt.resourceId!==p.vehicleId||!iso(r.receipt.confirmedAt))return false;
  if(v.status==='CANCELLED')return r.cancelled===true&&r.guide===null;
  return positive(r.guide?.id)&&r.guide.vehicleId===p.vehicleId&&positive(r.workGuide?.id)&&r.workGuide.vehicleId===p.vehicleId&&r.workGuide.guideId===r.guide.id&&Array.isArray(r.movementIds)&&r.movementIds.length===r.guide.items?.length&&r.movementIds.every(positive)&&new Set(r.movementIds).size===r.movementIds.length&&unique(r.guide.items)&&r.guide.items.length>0&&r.guide.items.every(i=>positive(i.id)&&i.guideId===r.guide.id&&text(i.name,300)&&i.name.trim()&&text(i.unit,30)&&i.unit.trim()&&units(i.quantity)!==null)&&unique(r.workGuide.items)&&r.workGuide.items.every(i=>B.item(i)&&i.workGuideId===r.workGuide.id)&&r.workGuide.items.length===r.guide.items.length&&[r.closedWorkGuideIds,r.closedTransportGuideIds].every(ids=>Array.isArray(ids)&&ids.every(positive)&&new Set(ids).size===ids.length);
 }
 return {...B,quantity,input,query,choice,plan,listPacket,reviewPacket,pending,resultPacket};
}));
