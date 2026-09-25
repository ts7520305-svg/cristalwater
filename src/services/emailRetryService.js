"use strict";
const {prisma}=require('../prismaClient');
// Kept for legacy callers. Generic logs cannot prove the complete original
// message (including attachments), so only the reviewed source may resend.
async function retryFailedEmails(){
  const logs=await prisma.emailLog.findMany({where:{status:'FAILED',OR:[{eventType:null},{eventType:{not:'MONTHLY_REPORT'}}]},select:{id:true}});
  return {total:logs.length,success:0,failed:0,blocked:logs.length,code:'SOURCE_REVIEW_REQUIRED',sent:0};
}
module.exports={retryFailedEmails};
