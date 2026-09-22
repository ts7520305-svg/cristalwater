'use strict';
const {prisma}=require('../prismaClient'),writes=require('./fieldWriteRequestService');
const review=require('./monthlyEmailReviewService'),{prepareMonthlyReportEmails}=require('./reportEmailService');
const email=require('./emailService'),integrations=require('../config/externalIntegrations');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
async function inspect(db,logId){
 const s=await review.state(db,logId);
 if(!review.publicRow(s).canRetry)fail('É necessária uma revisão válida de não envio. Reservas pendentes há menos de 30 minutos não permitem reenvio.');
 const plan=await prepareMonthlyReportEmails({monthRef:s.report.month,clientOnly:true,manual:true,db});
 const message=plan.messages.find(m=>m.reportId===s.report.id);
 if(!plan.enabled||!message)fail('Reveja o relatório, as regras e o destinatário antes de preparar um reenvio.');
 if(await review.legacyReview(db,s.report.month))fail('Existem outros envios antigos por rever neste mês.');
 const loaded=await review.context(db);
 for(const log of loaded.logs.values()){const other=await review.state(db,log.id,undefined,loaded);if(other.report?.id!==s.report.id||other.log.id===logId||other.retries.length)continue;if(!review.publicRow(other).canRetry)fail('Outro envio deste relatório ainda está aceite, pendente ou por rever.');}

 return {s,message,version:writes.hash({v:1,sourceVersion:s.version,contentHash:message.contentHash}),enabled:integrations.isEmailEnabled()&&integrations.areExternalNotificationsEnabled()};
}
async function preview(actor,logId){review.admin(actor);if(!review.positive(logId))fail('Registo inválido.',400);return prisma.$transaction(async db=>{const {s,message,version,enabled}=await inspect(db,logId);return {ok:true,emailLogId:logId,reportId:s.report.id,reviewId:s.review.id,monthRef:s.report.month,version,enabled,...message.payload};},{isolationLevel:'RepeatableRead',timeout:30000});}
async function send(actor,logId,body){
 review.admin(actor);
 if(!review.positive(logId)||!body||Object.keys(body).sort().join(',')!=='confirmed,expectedVersion,reportId,requestId,reviewId'||body.confirmed!==true||!review.positive(body.reportId)||!review.positive(body.reviewId)||!/^[a-f0-9]{64}$/.test(body.expectedVersion))fail('Reveja e confirme o destinatário e o conteúdo exatos do reenvio.',400);
 const {requestId,...payload}=body,request=writes.context(actor,'MONTHLY_EMAIL_RETRY',logId,requestId,payload);
 const claimed=await prisma.$transaction(async db=>{
  const saved=await writes.recover(db,request);if(saved)return {result:saved};
  await db.$queryRaw`SELECT id FROM "EmailLog" WHERE id=${logId} FOR UPDATE`;
  await db.$queryRaw`SELECT id FROM "MonthlyReport" WHERE id=${body.reportId} FOR UPDATE`;
  let prepared;try{prepared=await inspect(db,logId);}catch(e){if(e.status!==409)throw e;}
  if(!prepared||prepared.version!==body.expectedVersion||prepared.s.report.id!==body.reportId||prepared.s.review.id!==body.reviewId)return {result:await writes.confirm(db,request,{ok:true,applied:false,context:payload,message:'O envio, a revisão ou o conteúdo mudou. Consulte novamente.',sent:0})};
  if(!prepared.enabled)fail('O envio de email está desativado.',503);
  const {s,message}=prepared;
  const log=await db.emailLog.create({data:{...message.payload,eventType:'MONTHLY_REPORT',mode:'MANUAL',status:'PENDING'}});
  const snapshot={schema:1,emailLogId:logId,retryEmailLogId:log.id,reportId:body.reportId,reviewId:s.review.id,actorId:review.admin(actor),requestId:request.requestId,payload:message.payload,contentHash:message.contentHash,sourceVersion:s.version};
  await db.auditTrail.create({data:{eventType:review.RETRY,action:review.RETRY,entity:'EmailLog',entityId:logId,clientId:s.report.clientId,message:'Novo contacto reservado após revisão e confirmação explícitas.',metadata:{...snapshot,fingerprint:writes.hash(snapshot)}}});
  const result=await writes.confirm(db,request,{ok:true,applied:true,context:payload,emailLogId:logId,retryEmailLogId:log.id,reportId:body.reportId,sent:0});
  return {result,log,payload:message.payload};
 },{maxWait:15000,timeout:30000});
 // A recovered reservation never invokes the provider a second time.
 if(!claimed.log)return {ok:true,result:claimed.result,replayed:true};
 let status='UNKNOWN',error=null;
 try{const response=await email.sendEmail(claimed.payload),addresses=v=>Array.isArray(v)?v.map(x=>String(x?.address||x).toLowerCase()):[],recipient=claimed.payload.to.toLowerCase(),accepted=addresses(response?.accepted).includes(recipient),rejected=addresses(response?.rejected).includes(recipient);
  if(accepted&&!rejected)status='SENT';else if(rejected&&!accepted){status='FAILED';error='Destinatário recusado pelo serviço de email.';}else error='Aceitação do destinatário não confirmada.';
 }catch{error='Resultado incerto; rever antes de qualquer novo contacto.';}
 try{const updated=await prisma.$transaction(db=>db.emailLog.updateMany({where:{id:claimed.log.id,status:'PENDING',eventType:'MONTHLY_REPORT',...claimed.payload},data:{status,error}}));if(updated.count!==1)status='PENDING';}catch{status='PENDING';}
 return {ok:true,result:claimed.result,replayed:false,delivery:{emailLogId:claimed.log.id,status,deliveryConfirmed:false}};
}
module.exports={preview,send};
