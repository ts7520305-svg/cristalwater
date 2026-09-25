'use strict';
// Shared QA setup through the same reviewed API used by the administrative page.
module.exports=async function createReviewedTechnician(call,input,{response=false}={}){
 const fields={name:input.name,email:input.email||'',phone:input.phone||'',zone:input.zone||'',vehicleId:input.vehicleId||null,pin:input.pin||''},proposal={operation:'CREATE',technicianId:null,fields};
 const reviewed=await call('POST','/api/technicians/manage/review',proposal),review=reviewed.data||reviewed.body||reviewed;
 if(typeof reviewed.status==='number'&&reviewed.status!==200)throw Error('QA technician review failed: '+reviewed.status);
 const saved=await call('POST','/api/technicians/manage/commit',{...proposal,requestId:review.requestId,reviewToken:review.reviewToken}),result=saved.data||saved.body||saved;
 if(typeof saved.status==='number'&&saved.status!==200)throw Error('QA technician commit failed: '+saved.status);
 if(result.status!=='CONFIRMED'||!result.result?.technician?.id)throw Error('QA technician creation was not confirmed');return response?{status:saved.status,body:result.result.technician,receipt:result.result}:result.result.technician;
};
