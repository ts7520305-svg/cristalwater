'use strict';
// QA creates through the reviewed fleet API; a repeated plate is never an upsert.
module.exports=async function createReviewedVehicle(call,input){
 const fields={plate:input.plate,name:input.name||'',brand:input.brand||'',model:input.model||'',year:input.year??null,currentKm:input.currentKm??null,notes:input.notes||'',status:input.status||'ACTIVE'},proposal={operation:'CREATE',vehicleId:null,fields};
 const reviewed=await call('POST','/api/fleet-management/review',proposal),review=reviewed.data||reviewed.body||reviewed;
 if(typeof reviewed.status==='number'&&reviewed.status!==200)throw Error('QA vehicle review failed: '+reviewed.status);
 const saved=await call('POST','/api/fleet-management/commit',{...proposal,requestId:review.requestId,reviewToken:review.reviewToken}),result=saved.data||saved.body||saved;
 if(typeof saved.status==='number'&&saved.status!==200)throw Error('QA vehicle commit failed: '+saved.status);
 if(result.status!=='CONFIRMED'||!result.result?.vehicle?.id)throw Error('QA vehicle creation was not confirmed');return result.result.vehicle;
};
