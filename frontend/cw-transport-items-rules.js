(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./cw-transport-guide-rules'));else root.CWTransportItemsRules=factory(root.CWTransportGuideRules);}(typeof globalThis==='object'?globalThis:this,function(B){
  'use strict';
  const {object,positive,id,iso,uuid,keys,text,base,units,quantity}=B;
  const unique=rows=>Array.isArray(rows)&&new Set(rows.map(r=>r.id)).size===rows.length;
  const material=i=>object(i)&&positive(i.id)&&text(i.name,10000)&&!!i.name.trim()&&(i.type===null||text(i.type,1000))&&text(i.unit,1000)&&!!i.unit.trim()&&units(i.quantity)!==null;
  function input(v){
    if(!keys(v,['guideId','notes','items'])||!positive(v.guideId)||!text(v.notes,2000)||v.notes.trim().length<3||!Array.isArray(v.items)||!v.items.length||v.items.length>100)return null;
    const items=[];
    for(const i of v.items){
      if(!keys(i,['id','workItemId','name','type','unit','quantity'])||i.id!==null&&!positive(i.id)||i.workItemId!==null&&!positive(i.workItemId)||((i.id===null)!==(i.workItemId===null))||!text(i.name,i.id?10000:300)||!i.name.trim()||(i.type===null?i.id===null:!text(i.type,i.id?1000:100))||!text(i.unit,i.id?1000:30)||!i.unit.trim()||quantity(i.quantity)===null||i.id===null&&(quantity(i.quantity)<=0||!i.type.trim()))return null;
      items.push({...i,name:i.id?i.name:i.name.trim(),type:i.id?i.type:i.type.trim(),unit:i.id?i.unit:i.unit.trim(),quantity:String(quantity(i.quantity))});
    }
    for(const k of ['id','workItemId']){const ids=items.filter(i=>i[k]!==null).map(i=>i[k]);if(new Set(ids).size!==ids.length)return null;}
    return {guideId:v.guideId,notes:v.notes.trim(),items};
  }
  function query(v={}){if(!object(v)||Object.keys(v).some(k=>!['page','q','guideId'].includes(k)))return null;const page=v.page===undefined?1:id(v.page),q=v.q===undefined?'':v.q,guideId=v.guideId===undefined?null:id(v.guideId);return page&&page<=1000000&&text(q,200)&&(v.guideId===undefined||guideId)?{page,q:q.trim(),guideId}:null;}
  function choice(c){return object(c)&&positive(c.id)&&positive(c.vehicleId)&&c.vehicle?.id===c.vehicleId&&text(c.vehicle.plate,200)&&iso(c.vehicle.updatedAt)&&iso(c.updatedAt)&&unique(c.items)&&c.items.length<=100&&c.items.every(i=>material(i)&&i.guideId===c.id)&&unique(c.workGuides)&&c.workGuides.length<=100&&c.workGuides.every(w=>positive(w.id)&&w.guideId===c.id&&w.vehicleId===c.vehicleId&&iso(w.updatedAt)&&unique(w.items)&&w.items.length<=100&&w.items.every(i=>B.item(i)&&i.workGuideId===w.id));}
  function editable(c){return choice(c)&&c.status==='ACTIVE'&&c.vehicle.active===true&&c.vehicle.deletedAt===null&&c.workGuides.length===1&&c.workGuides[0].status==='OPEN'&&c.items.length===c.workGuides[0].items.length;}
  function plan(p,c){
    p=input(p);if(!p||!editable(c)||p.guideId!==c.id)return null;
    const work=c.workGuides[0],rows=[];let changed=false;
    for(const row of p.items){
      const old=row.id===null?null:c.items.find(i=>i.id===row.id),stock=row.workItemId===null?null:work.items.find(i=>i.id===row.workItemId);
      if(row.id!==null&&(!old||!stock||['name','type','unit'].some(k=>row[k]!==old[k]||row[k]!==stock[k])))return null;
      const total=units(Number(row.quantity)),used=stock?units(stock.usedQty):0,previous=stock?units(stock.initialQty):0,available=stock?units(stock.quantity):0;
      if([total,used,previous,available].some(n=>n===null)||total<used||previous!==used+available)return null;
      const delta=(total-previous)/1e6;
      if(!old||old.quantity!==Number(row.quantity)||delta!==0)changed=true;
      rows.push({...row,before:old?{transportQuantity:old.quantity,initialQty:stock.initialQty,quantity:stock.quantity,usedQty:stock.usedQty}:null,after:{initialQty:total/1e6,quantity:(total-used)/1e6,usedQty:used/1e6},delta});
    }
    if(!changed||c.items.some(i=>!p.items.some(r=>r.id===i.id))||work.items.some(i=>!p.items.some(r=>r.workItemId===i.id)))return null;
    return {workGuideId:work.id,vehicleId:c.vehicleId,rows};
  }
  function listPacket(v,owner,page){return Boolean(base(v,owner)&&v.page===page&&v.size===25&&Number.isSafeInteger(v.total)&&v.total>=0&&unique(v.guides)&&v.guides.length===Math.min(25,Math.max(0,v.total-(page-1)*25))&&v.guides.every(choice));}
  function reviewPacket(v,owner,p){return Boolean(base(v,owner)&&uuid(v.requestId)&&typeof v.reviewToken==='string'&&v.reviewToken.length>80&&v.reviewToken.length<4000&&iso(v.expiresAt)&&Date.parse(v.expiresAt)>Date.parse(v.asOf)&&Date.parse(v.expiresAt)-Date.parse(v.asOf)<=300000&&input(p)&&JSON.stringify(input(v.proposal))===JSON.stringify(input(p))&&plan(p,v.choice)&&JSON.stringify(v.plan)===JSON.stringify(plan(p,v.choice)));}
  function pending(raw,owner){if(raw===null)return null;try{const p=JSON.parse(raw);return keys(p,['version','owner','guideId','requestId'])&&p.version===1&&p.owner===owner&&positive(p.guideId)&&uuid(p.requestId)?p:false;}catch(_){return false;}}
  function resultPacket(v,owner,p){
    if(!base(v,owner)||v.requestId!==p.requestId||!['CONFIRMED','UNCONFIRMED','CANCELLED'].includes(v.status))return false;
    const r=v.result;if(v.status==='UNCONFIRMED')return r===null;
    if(!object(r)||r.guideId!==p.guideId||!positive(r.auditId)||r.receipt?.owner!==owner||r.receipt.requestId!==p.requestId||r.receipt.scope!=='TRANSPORT_GUIDE_ITEMS'||r.receipt.resourceId!==p.guideId||!iso(r.receipt.confirmedAt))return false;
    if(v.status==='CANCELLED')return r.cancelled===true&&r.guide===null;
    if(!choice(r.guide)||r.guide.id!==p.guideId||!positive(r.workGuideId)||r.guide.workGuides.length!==1||r.guide.workGuides[0].id!==r.workGuideId||!Array.isArray(r.rows)||!r.rows.length||!Array.isArray(r.movementIds)||r.movementIds.some(id=>!positive(id))||new Set(r.movementIds).size!==r.movementIds.length)return false;
    if(r.rows.length!==r.guide.items.length||r.rows.length!==r.guide.workGuides[0].items.length||new Set(r.rows.map(i=>i.id)).size!==r.rows.length||new Set(r.rows.map(i=>i.workItemId)).size!==r.rows.length)return false;
    if(r.movementIds.length!==r.rows.filter(row=>row.delta!==0).length)return false;
    return r.rows.every(row=>{const g=r.guide.items.find(i=>i.id===row.id),w=r.guide.workGuides[0].items.find(i=>i.id===row.workItemId);return g&&w&&units(row.after?.initialQty)!==null&&units(row.after?.usedQty)!==null&&units(row.after?.quantity)!==null&&units(row.after.initialQty)===units(row.after.usedQty)+units(row.after.quantity)&&Number.isFinite(row.delta)&&row.delta===(units(row.after.initialQty)-(row.before?units(row.before.initialQty):0))/1e6&&['name','type','unit'].every(k=>g[k]===row[k]&&w[k]===row[k])&&g.quantity===row.after?.initialQty&&['initialQty','quantity','usedQty'].every(k=>w[k]===row.after?.[k]);});
  }
  return {...B,input,query,choice,editable,plan,listPacket,reviewPacket,pending,resultPacket};
}));
