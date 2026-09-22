'use strict';
const {prisma}=require('../prismaClient');
const writes=require('./fieldWriteRequestService');
const {reportMonth}=require('./monthlyReportMonth');
const REVIEW='MONTHLY_EMAIL_REVIEWED',RETRY='MONTHLY_EMAIL_RETRY_RESERVED';
const positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647;
const json=v=>JSON.parse(JSON.stringify(v));
const text=v=>typeof v==='string'&&v===v.trim()&&v.length>=5&&v.length<=1000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
function admin(actor){if(actor?.role!=='ADMIN'||!positive(actor.userId||actor.id))fail('Acesso administrativo obrigatório.',403);return actor.userId||actor.id;}
const source=log=>json({id:log.id,to:log.to,toEmail:log.toEmail,subject:log.subject,eventType:log.eventType,mode:log.mode,status:log.status,error:log.error,text:log.text,html:log.html,createdAt:log.createdAt,updatedAt:log.updatedAt});
const reportSource=r=>json({id:r.id,month:r.month,type:r.type,clientId:r.clientId,data:r.data,createdAt:r.createdAt});
const period=subject=>typeof subject==='string'&&/^Relatório Mensal(?: ADMIN)? - (20|21)\d{2}-(0[1-9]|1[0-2])$/.test(subject)?subject.slice(-7):null;
async function context(db){
 const [logs,proofs]=await Promise.all([db.emailLog.findMany({where:{eventType:'MONTHLY_REPORT'},include:{monthlyDelivery:true}}),db.auditTrail.findMany({where:{eventType:{in:[REVIEW,RETRY]}},orderBy:{id:'desc'}})]);
 const ids=[...new Set([...logs.map(l=>l.monthlyDelivery?.reportId),...proofs.map(p=>p.metadata?.reportId)].filter(positive))];
 const reports=await db.monthlyReport.findMany({where:{id:{in:ids}}});
 return {logs:new Map(logs.map(l=>[l.id,l])),reports:new Map(reports.map(r=>[r.id,r])),proofs};
}
async function state(db,logId,reportId,loaded){
 const log=loaded?loaded.logs.get(logId):await db.emailLog.findUnique({where:{id:logId},include:{monthlyDelivery:true}});
 if(!log||log.eventType!=='MONTHLY_REPORT')fail('Registo mensal não encontrado.',404);
 const proofs=loaded?loaded.proofs.filter(p=>p.eventType===REVIEW&&p.entity==='EmailLog'&&p.entityId===logId):await db.auditTrail.findMany({where:{eventType:REVIEW,entity:'EmailLog',entityId:logId},orderBy:{id:'desc'}});
 const retries=loaded?loaded.proofs.filter(p=>p.eventType===RETRY&&p.entity==='EmailLog'&&p.entityId===logId):await db.auditTrail.findMany({where:{eventType:RETRY,entity:'EmailLog',entityId:logId},orderBy:{id:'desc'}});
 const incoming=loaded?loaded.proofs.filter(p=>p.eventType===RETRY):await db.auditTrail.findMany({where:{eventType:RETRY}});
 const parent=incoming.filter(p=>p.metadata?.retryEmailLogId===logId);
 const link=parent[0]?.metadata;const parentValid=parent.length===1&&link?.schema===1&&parent[0].action===RETRY&&parent[0].entity==='EmailLog'&&positive(link.reportId)&&(()=>{const {fingerprint,...snapshot}=link;return writes.hash(snapshot)===fingerprint&&writes.hash(link.payload)===writes.hash({to:log.to,subject:log.subject,text:log.text});})();
 const linkedId=log.monthlyDelivery?.reportId??(parentValid?link.reportId:null);
 const targetId=reportId??linkedId??proofs[0]?.metadata?.reportId;
 const report=positive(targetId)?(loaded?loaded.reports.get(targetId):await db.monthlyReport.findUnique({where:{id:targetId}})):null;
 if(reportId!==undefined&&(!report||linkedId&&linkedId!==reportId))fail('O relatório escolhido não corresponde ao envio.',400);
 const known=period(log.subject);
 const associationMatches=!report||!known||known===report.month;
 if(reportId!==undefined&&!associationMatches)fail('O mês do relatório não corresponde ao assunto original.',400);
 const version=writes.hash({v:1,log:source(log),report:report?reportSource(report):null,delivery:json(log.monthlyDelivery),reviews:proofs.map(p=>({id:p.id,metadata:p.metadata})),retries:retries.map(p=>({id:p.id,metadata:p.metadata}))});
 const latest=proofs[0],m=latest?.metadata;let review=null;
 if(m){const {fingerprint,...snapshot}=m;const valid=associationMatches&&m.schema===1&&writes.hash(snapshot)===fingerprint&&m.logHash===writes.hash(source(log))&&report&&m.reportId===report.id&&m.reportHash===writes.hash(reportSource(report))&&['ACCEPTED','NOT_SENT'].includes(m.decision)&&text(m.reason)&&text(m.evidence)&&positive(m.actorId)&&latest.action===REVIEW;
  review={id:latest.id,valid:!!valid,decision:m.decision,reason:m.reason,evidence:m.evidence,reviewedAt:latest.createdAt};
 }
 return {log,report,known,linkedId,version,review,retries,parent,parentValid,associationMatches};
}
async function reviewedReports(db,ids){
 const proofs=await db.auditTrail.findMany({where:{eventType:REVIEW,entity:'EmailLog'},select:{entityId:true,metadata:true}});
 // Even changed or incomplete decisions block ordinary/automatic sends.
 return new Set(proofs.filter(p=>ids.includes(p.metadata?.reportId)).map(p=>p.metadata.reportId));
}
async function legacyReview(db,month){
 const loaded=await context(db),logs=[...loaded.logs.values()].filter(log=>!log.monthlyDelivery);
 for(const log of logs){
  if(period(log.subject)&&period(log.subject)!==month)continue;
  let s;try{s=await state(db,log.id,undefined,loaded);}catch{return true;}
  if(s.parentValid)continue; // Retry remains reserved through its immutable parent audit.
  if(!s.review?.valid)return true;
 }
 return false;
}
const publicRow=s=>({emailLogId:s.log.id,reportId:s.report?.id??null,monthRef:s.report?.month??s.known,recipient:s.log.to||s.log.toEmail||'',subject:s.log.subject||'',text:s.log.text||'',status:s.log.status,createdAt:s.log.createdAt,version:s.version,review:s.review,reviewIssue:s.associationMatches?'':'O mês do assunto não corresponde ao relatório associado. Confira a origem deste registo antes de o rever ou reenviar.',retryReserved:s.retries.length>0,canReview:s.associationMatches&&['SENT','FAILED','UNKNOWN','PENDING'].includes(s.log.status)&&!s.retries.length,canRetry:s.associationMatches&&s.review?.valid===true&&s.review.decision==='NOT_SENT'&&!s.retries.length&&(['FAILED','UNKNOWN'].includes(s.log.status)||s.log.status==='PENDING'&&Date.now()-new Date(s.log.createdAt).getTime()>=30*60*1000)});
async function list(actor,monthRef){
 admin(actor);const month=reportMonth(monthRef,{required:true});
 return prisma.$transaction(async db=>{
  const reports=await db.monthlyReport.findMany({where:{month},orderBy:{id:'asc'},select:{id:true,clientId:true,type:true,data:true}});
  const loaded=await context(db),logs=[...loaded.logs.values()].sort((a,b)=>b.id-a.id),rows=[];
  for(const log of logs){const s=await state(db,log.id,undefined,loaded);if((s.report?.month??s.known??month)!==month)continue;rows.push(publicRow(s));}
  return {ok:true,monthRef:month,rows,reports:reports.map(r=>({id:r.id,type:r.type,clientId:r.clientId,label:r.type==='CLIENT'?(typeof r.data?.client==='string'?r.data.client:'Cliente #'+r.clientId):'Administração'})),sent:0};
 },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:30000});
}
async function detail(actor,logId,reportId){admin(actor);if(!positive(logId)||!positive(reportId))fail('Identificadores inválidos.',400);return prisma.$transaction(async db=>({ok:true,row:publicRow(await state(db,logId,reportId))}),{isolationLevel:'RepeatableRead'});}
async function review(actor,logId,body){
 const actorId=admin(actor);
 if(!positive(logId)||!body||Object.keys(body).sort().join(',')!=='confirmed,decision,evidence,expectedVersion,reason,reportId,requestId'||body.confirmed!==true||!positive(body.reportId)||!['ACCEPTED','NOT_SENT'].includes(body.decision)||!text(body.reason)||!text(body.evidence)||!/^[a-f0-9]{64}$/.test(body.expectedVersion))fail('Confirme o relatório, a decisão, o motivo e a evidência consultada.',400);
 const {requestId,...payload}=body,request=writes.context(actor,'MONTHLY_EMAIL_REVIEW',logId,requestId,payload);
 return prisma.$transaction(async db=>{
  const saved=await writes.recover(db,request);if(saved)return saved;
  await db.$queryRaw`SELECT id FROM "EmailLog" WHERE id=${logId} FOR UPDATE`;
  await db.$queryRaw`SELECT id FROM "MonthlyReport" WHERE id=${body.reportId} FOR SHARE`;
  const s=await state(db,logId,body.reportId);
  if(s.version!==body.expectedVersion||s.retries.length||!['SENT','FAILED','UNKNOWN','PENDING'].includes(s.log.status)||body.decision==='NOT_SENT'&&s.log.status==='SENT')return writes.confirm(db,request,{ok:true,applied:false,context:payload,message:'O envio ou a revisão mudou. Consulte novamente. Um envio aceite não pode ser declarado não enviado.',sent:0});
  const snapshot={schema:1,emailLogId:logId,reportId:body.reportId,monthRef:s.report.month,decision:body.decision,reason:body.reason,evidence:body.evidence,actorId,logHash:writes.hash(source(s.log)),reportHash:writes.hash(reportSource(s.report)),source:source(s.log),report:reportSource(s.report)};
  const record=await db.auditTrail.create({data:{eventType:REVIEW,action:REVIEW,entity:'EmailLog',entityId:logId,clientId:s.report.clientId,message:'Revisão administrativa do resultado de envio; nenhum contacto realizado.',metadata:{...snapshot,fingerprint:writes.hash(snapshot)}}});
  return writes.confirm(db,request,{ok:true,applied:true,context:payload,reviewId:record.id,emailLogId:logId,decision:body.decision,sent:0});
 },{maxWait:15000,timeout:30000});
}
async function lookup(actor,logId,requestId,payloadHash){
 admin(actor);if(!positive(logId)||typeof requestId!=='string'||!/^[a-f0-9]{64}$/.test(payloadHash))fail('Pedido inválido.',400);
 const saved=await prisma.fieldWriteRequest.findUnique({where:{owner_requestId:{owner:writes.owner(actor),requestId}}});if(!saved)return {ok:true,found:false};
 if(!['MONTHLY_EMAIL_REVIEW','MONTHLY_EMAIL_RETRY'].includes(saved.scope)||saved.resourceId!==logId||saved.payloadHash!==payloadHash)fail('O pedido não corresponde ao registo guardado.');
 return {ok:true,found:true,result:saved.response};
}
module.exports={REVIEW,RETRY,context,state,source,reportSource,publicRow,admin,positive,legacyReview,reviewedReports,list,detail,review,lookup};
