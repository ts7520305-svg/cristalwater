'use strict';
// Exercise the same review/confirmation flow as the administrator, including its receipt.
module.exports=async function assignReviewedVehicle(call,input){
 const proposal={technicianId:input.technicianId,vehicleId:input.vehicleId,kmMode:input.startKm==null?'KEEP':'SET',km:input.startKm==null?null:String(input.startKm),reason:input.notes||'QA reviewed vehicle assignment'};
 const reviewed=await call('POST','/api/vehicle-assignment/review',proposal),review=reviewed.data||reviewed.body||reviewed;
 if(typeof reviewed.status==='number'&&reviewed.status!==200||!review.requestId||!review.reviewToken)throw Error('QA vehicle assignment review failed');
 const saved=await call('POST','/api/vehicle-assignment/commit',{proposal:review.proposal,requestId:review.requestId,reviewToken:review.reviewToken}),result=saved.data||saved.body||saved;
 if(typeof saved.status==='number'&&saved.status!==200||result.status!=='CONFIRMED'||result.result?.technicianId!==input.technicianId||result.result?.technician?.vehicleId!==input.vehicleId)throw Error('QA vehicle assignment not confirmed');
 return result.result;
};
