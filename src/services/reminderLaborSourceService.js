'use strict';
const resources=require('./reminderResourceService'),writes=require('./fieldWriteRequestService');
const rules=require('../../frontend/cw-reminder-labor-rules');
// The projection has its own fingerprint and embeds the exact administrative
// declaration. It never rebrands a current technician name as a historical one.
function snapshot(row){
  const e=row.snapshot,p=e?.preview,d=p?.proposed;
  if(!d?.workTime)return null;
  return {version:1,basis:rules.basis,reminderId:row.reminderId,clientId:row.clientId,poolId:row.poolId,technicianId:row.technicianId,technicianName:'Técnico #'+row.technicianId,startedAt:row.startedAt,endedAt:row.endedAt,durationSeconds:p.durationSeconds,sourceHash:p.targetHash,source:p.target,reason:e.reason,createdBy:e.owner,createdAt:e.createdAt,declaration:row.result};
}
async function read(db,ids){
  const contexts=await Promise.all([...new Set(ids)].map(async id=>[id,await resources.context(db,id)])),rows=new Map();
  for(const [id,c]of contexts){if(!c.available)continue;for(const row of c.records.filter(r=>r.startedAt||r.endedAt)){
    const s=snapshot(row);let valid=row.state==='CONFIRMED'&&c.journalValid&&!!s;
    const value={id:row.id,fingerprint:s?writes.hash(s):row.fingerprint,snapshot:s};
    if(valid){try{await rules.work(value,c.target,writes.hash);}catch(_){valid=false;}}
    rows.set(row.id,{...value,reminderId:id,clientId:row.clientId,poolId:row.poolId,technicianId:row.technicianId,technicianName:c.technicians.find(t=>t.id===row.technicianId)?.name||'Técnico #'+row.technicianId,startedAt:row.startedAt,endedAt:row.endedAt,sourceHash:s?.sourceHash||null,state:valid?'CONFIRMED':row.state==='VOIDED'?'VOIDED':'REVIEW',reviewReasons:row.reasons,voidedAt:row.voidedAt});
  }}return rows;
}
module.exports={read,snapshot,rules,basis:rules.basis};
