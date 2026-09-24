'use strict';
const writes=require('./fieldWriteRequestService'),rules=require('../../frontend/cw-reminder-visit-resource-rules'),links=require('./reminderVisitJournal');
const json=v=>JSON.parse(JSON.stringify(v));
async function read(db,ids){
  const result=new Map([...new Set(ids)].map(id=>[id,{valid:true,headHash:null,records:[],active:null}]));if(!result.size)return result;
  const rows=await db.fieldWriteRequest.findMany({where:{scope:rules.scope,resourceId:{in:[...result.keys()]}},orderBy:{id:'asc'}});
  for(const row of rows){const s=result.get(row.resourceId);try{
    const v=await rules.response(row.response,row.response?.envelope,row.owner,row.resourceId,writes.hash);
    if(row.requestId!==v.receipt.requestId||row.payloadHash!==v.receipt.payloadHash)throw Error('Receipt changed');if(!v.applied)continue;
    const p=v.event.preview;if(p.previousHash!==s.headHash)throw Error('Chain changed');
    if(p.selection.action==='DECLARE'){if(s.active)throw Error('Duplicate declaration');s.active={id:v.event.id,reminderId:row.resourceId,result:v,hash:v.eventHash,voidResult:null,state:'CONFIRMED'};s.records.push(s.active);}
    else {if(!s.active||p.selection.recordId!==s.active.id||writes.hash(p.original)!==writes.hash(s.active.result))throw Error('Original changed');s.active.voidResult=v;s.active.state='VOIDED';s.active=null;}
    s.headHash=v.eventHash;
  }catch(_){s.valid=false;}}
  return result;
}
async function journal(db,id){return (await read(db,[id])).get(id);}
async function forParent(db,visit,visitType){
  // Discover both sides of the original relationship: changing a later origin
  // cannot hide an earlier reservation from the parent visit.
  const candidates=await db.fieldWriteRequest.findMany({where:{OR:[
    {scope:links.rules.scope,AND:[{response:{path:['event','preview','parent','type'],equals:visitType}},{response:{path:['event','preview','parent','id'],equals:visit.id}}]},
    {scope:rules.scope,AND:[{response:{path:['event','preview','origin','visitType'],equals:visitType}},{response:{path:['event','preview','origin','visitId'],equals:visit.id}}]}
  ]},select:{resourceId:true}});
  return read(db,[...new Set(candidates.map(r=>r.resourceId))]);
}
async function reservations(db,visit,visitType){
  const states=await forParent(db,visit,visitType),ids=[...states.keys()],associations=await links.read(db,ids),records=[];let valid=true;
  const parent={type:visitType,...Object.fromEntries(links.rules.parentFields.filter(k=>k!=='type').map(k=>[k,json(visit[k])])),status:String(visit.status).trim().toUpperCase()};
  for(const [reminderId,s]of states){
    if(!s.valid)valid=false;
    const row=s.active;if(!row)continue;const p=row.result.event.preview;
    if(p.origin.visitType!==visitType||p.origin.visitId!==visit.id){const original=associations.get(reminderId)?.active?.result.event.preview.parent;if(original?.type===visitType&&original.id===visit.id)valid=false;continue;}
    const a=associations.get(reminderId),source=await db.generalReminder.findUnique({where:{id:reminderId},select:Object.fromEntries(links.rules.sourceFields.map(k=>[k,true]))}),target=await require('./expenseMaintenanceTargets').get(db,'MAINTENANCE_REMINDER',reminderId);
    const ap=p.association.event.preview,technician=await db.technician.findUnique({where:{id:p.origin.technicianId},select:{id:true}});
    const intact=s.valid&&a?.valid&&a.active?.id===p.origin.associationId&&writes.hash(a.active.result)===writes.hash(p.association)&&writes.hash(json(source))===ap.sourceHash&&writes.hash(parent)===ap.parentHash&&target?.snapshot.decisionFingerprint===ap.target.decisionFingerprint&&target.clientId===p.origin.clientId&&target.snapshot.poolId===p.origin.poolId&&!!technician;
    if(!intact)valid=false;
    const data=p.selection.data;
    records.push({type:'REMINDER',id:row.id,reminderId,hash:row.hash,materials:data.materials,...(data.workIntervals===undefined?{workTime:data.workTime}:{workIntervals:data.workIntervals})});
  }
  records.sort((a,b)=>a.id.localeCompare(b.id));return {valid,records};
}
module.exports={rules,read,journal,forParent,reservations};
