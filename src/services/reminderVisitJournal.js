'use strict';
const writes=require('./fieldWriteRequestService'),rules=require('../../frontend/cw-reminder-visit-rules');
// This layer only reads its own receipts. Cost targets and resource services can
// inspect associations without recursively loading one another's projections.
async function read(db,ids) {
  const result=new Map([...new Set(ids)].map(id=>[id,{valid:true,headHash:null,records:[],active:null}]));
  if(!result.size)return result;
  const rows=await db.fieldWriteRequest.findMany({where:{scope:rules.scope,resourceId:{in:[...result.keys()]}},orderBy:{id:'asc'}});
  for(const row of rows) {
    const state=result.get(row.resourceId);
    try {
      const v=await rules.response(row.response,row.response?.envelope,row.owner,row.resourceId,writes.hash);
      if(row.requestId!==v.receipt.requestId || row.payloadHash!==v.receipt.payloadHash)throw Error('Receipt changed');
      if(!v.applied)continue;
      const e=v.event,p=e.preview;
      if(p.previousHash!==state.headHash)throw Error('Association history changed');
      if(p.selection.action==='LINK') {
        if(state.active)throw Error('Multiple active associations');
        state.active={id:e.id,result:v,hash:v.eventHash,voidResult:null,state:'CONFIRMED'};state.records.push(state.active);
      } else {
        if(!state.active || p.selection.associationId!==state.active.id || writes.hash(p.original)!==writes.hash(state.active.result))throw Error('Original association changed');
        state.active.voidResult=v;state.active.state='VOIDED';state.active=null;
      }
      state.headHash=v.eventHash;
    } catch (_) { state.valid=false; }
  }
  return result;
}
async function journal(db,id) { return (await read(db,[id])).get(id); }
module.exports={read,journal,rules};
