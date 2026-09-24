'use strict';
const calendar=require('./clientServicePlan'),writes=require('./fieldWriteRequestService');
const fail=()=>{throw Object.assign(Error('O preço acordado ou o comprovativo da visita precisa de revisão antes de faturar.'),{status:409,code:'SERVICE_PRICE_REVIEW'});};
const positive=n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647;
const cents=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&Math.abs(n*100-Math.round(n*100))<0.000001?Math.round(n*100):null;
function confirmed(plan,receipts){
 if(!plan||plan.snapshot?.servicePlan?.schema!==2||!/^ADMIN:[1-9]\d*$/.test(plan.createdBy)||!positive(plan.id)||!positive(plan.clientId)||!positive(plan.version))return false;
 const rows=receipts.filter(r=>r.scope==='CLIENT_SERVICE_PLAN'&&r.resourceId===plan.clientId&&r.owner===plan.createdBy&&r.response?.planId===plan.id);if(rows.length!==1)return false;
 const r=rows[0],v=r.response,p=v.pricingProof,receipt=v.receipt;
 if(v.ok!==true||v.clientId!==plan.clientId||v.planVersion!==plan.version||p?.schema!==1||p.planHash!==writes.hash(plan.snapshot)||!/^[a-f0-9]{64}$/.test(p.reviewToken||'')||!/^\d{4}-(0[1-9]|1[0-2])$/.test(v.monthRef||'')||receipt?.owner!==r.owner||receipt.scope!==r.scope||receipt.resourceId!==r.resourceId||receipt.requestId!==r.requestId||receipt.payloadHash!==r.payloadHash||!Number.isFinite(Date.parse(receipt.confirmedAt)))return false;
 return r.payloadHash===writes.hash({v:1,scope:r.scope,resourceId:plan.clientId,payload:{expectedVersion:plan.version-1,monthRef:v.monthRef,snapshot:plan.snapshot,reviewToken:p.reviewToken}});
}
async function plans(db,rows){
 const ids=[...new Set(rows.map(v=>v.contractService?.planId).filter(positive))];if(!ids.length)return new Map();const found=await db.clientRatePlan.findMany({where:{id:{in:ids}}}),clientIds=[...new Set(found.map(p=>p.clientId))];
 const receipts=await db.fieldWriteRequest.findMany({where:{scope:'CLIENT_SERVICE_PLAN',resourceId:{in:clientIds}},orderBy:{id:'asc'}});return new Map(found.map(p=>[p.id,{plan:p,valid:confirmed(p,receipts)}]));
}
async function verify(db,plan){if(plan?.snapshot?.servicePlan?.schema!==2)return;const receipts=await db.fieldWriteRequest.findMany({where:{scope:'CLIENT_SERVICE_PLAN',resourceId:plan.clientId,owner:plan.createdBy},orderBy:{id:'asc'}});if(!confirmed(plan,receipts))fail();}
function price(visit,sources){
 const c=visit?.contractService,entry=sources.get(c?.planId),p=entry?.plan;if(!calendar.perVisit(visit))return null;
 if(!entry?.valid||c.schema!==2||c.billing!=='PER_VISIT'||visit.reason!=='AUTO_CLIENT_SERVICE'||visit.clientId!==p.clientId||c.planVersion!==p.version||typeof c.day!=='string'||!c.origin||!Number.isFinite(Date.parse(c.origin.plannedDate)))fail();
 const season=calendar.onDay(p.snapshot.servicePlan,c.day),rule=calendar.rulesForDay(p.snapshot.servicePlan,c.day).find(s=>s.poolId===visit.poolId);if(!season||!rule||!positive(c.origin.technicianId)||c.origin.roundId!==null&&!positive(c.origin.roundId)||rule.technicianId&&rule.technicianId!==c.origin.technicianId||(rule.roundId||null)!==c.origin.roundId||!calendar.due(rule,c.day).some(s=>calendar.localDate(c.day,s.at)?.toISOString()===c.origin.plannedDate)||season.billing!=='PER_VISIT'||!Number.isSafeInteger(season.visitCents)||season.visitCents<0||season.visitCents>1000000000||calendar.localDay(new Date(c.origin.plannedDate))!==c.day||writes.hash(c)!==writes.hash(calendar.serviceData(p,season,c.day,c.origin,rule.exception))||cents(visit.revenue)!==season.visitCents)fail();
 return season.visitCents;
}
async function collect(db,clientId,monthRef){
 const start=new Date(monthRef+'-01T00:00:00Z'),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
 let rows=await db.serviceVisit.findMany({where:{clientId,billed:false,status:{in:['DONE','COMPLETED','CONCLUIDA','CONCLUIDO']},endAt:{gte:start,lt:end},OR:[{contractService:{path:['billing'],equals:'PER_VISIT'}},{contractService:{path:['schema'],equals:2}}]},include:{pool:{select:{name:true}}},orderBy:{id:'asc'}});
 if(rows.length>10000)fail();for(const row of rows)await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${row.id} FOR UPDATE`;
 if(rows.length)rows=await db.serviceVisit.findMany({where:{id:{in:rows.map(r=>r.id)},clientId,billed:false,status:{in:['DONE','COMPLETED','CONCLUIDA','CONCLUIDO']},endAt:{gte:start,lt:end}},include:{pool:{select:{name:true}}},orderBy:{id:'asc'}});
 const sources=await plans(db,rows),reserved=new Set((await db.invoiceLine.findMany({where:{referenceId:{in:rows.map(r=>r.id)},OR:[{type:'SERVICE'},{lineType:'SERVICE'}]},select:{referenceId:true}})).map(l=>l.referenceId)),lines=[],ids=[];let amountCents=0;
 for(const row of rows){const value=price(row,sources);if(value===null)fail();if(reserved.has(row.id))continue;if(value===0)continue;ids.push(row.id);amountCents+=value;if(!Number.isSafeInteger(amountCents))fail();lines.push({type:'SERVICE',description:'Visita contratada: '+(row.pool?.name||'#'+row.id),referenceId:row.id,quantity:1,unitPrice:value/100,total:value/100,lineTotal:value/100,serviceDate:row.endAt,sourceMonth:monthRef,notes:row.notes||null});}
 return {ids,lines,amountCents};
}
async function claim(db,ids){if(!ids.length)return;const changed=await db.serviceVisit.updateMany({where:{id:{in:ids},billed:false},data:{billed:true,billedAt:new Date()}});if(changed.count!==ids.length)fail();}
module.exports={confirmed,plans,verify,price,collect,claim};

async function validateLines(db,clientId,items){
 const selected=items.filter(l=>String(l.type||l.lineType||'SERVICE').trim().toUpperCase()==='SERVICE'&&l.referenceId!=null),ids=selected.map(l=>Number(l.referenceId)),visits=await db.serviceVisit.findMany({where:{id:{in:ids}}}),priced=visits.filter(calendar.perVisit);if(!priced.length)return;
 const sources=await plans(db,priced),reserved=await db.invoiceLine.findMany({where:{referenceId:{in:priced.map(v=>v.id)},OR:[{type:'SERVICE'},{lineType:'SERVICE'}]},select:{referenceId:true}});if(reserved.length)fail();
 for(const visit of priced){const rows=selected.filter(l=>Number(l.referenceId)===visit.id),value=price(visit,sources);if(rows.length!==1||visit.clientId!==clientId||visit.billed||!['DONE','COMPLETED','CONCLUIDA','CONCLUIDO'].includes(visit.status)||!visit.endAt)fail();const l=rows[0],unit=Number(l.unitPrice),quantity=Number(l.quantity??1),amount=l.total==null?unit*quantity:Number(l.total);if(quantity!==1||cents(unit)!==value||cents(amount)!==value||l.lineType&&String(l.lineType).trim().toUpperCase()!=='SERVICE')fail();}
}
module.exports.validateLines=validateLines;
