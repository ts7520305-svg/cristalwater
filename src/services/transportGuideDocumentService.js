'use strict';
const {prisma}=require('../prismaClient');
const jwt=require('jsonwebtoken');
const {createHmac,randomUUID}=require('node:crypto');
const {getJwtSecret}=require('../utils/jwtSecret');
const requests=require('./fieldWriteRequestService');
const {owner}=require('./transportGuideCreationService');
const files=require('./transportGuideDocumentFiles');
const R=require('../../frontend/cw-transport-documents-rules');
const scope='TRANSPORT_GUIDE_DOCUMENT',audience='cristalwater-transport-documents-v1';
const fail=(code,statusCode=400)=>{throw Object.assign(Error(code),{code,statusCode});};
const envelope=a=>({ok:true,version:1,owner:owner(a),asOf:new Date().toISOString()});
const digest=v=>createHmac('sha256',getJwtSecret()).update('transport-documents\0'+JSON.stringify(v)).digest('hex');
const select={id:true,vehicleId:true,codeAT:true,status:true,isDraft:true,validFrom:true,validUntil:true,updatedAt:true,vehicle:{select:{id:true,plate:true,updatedAt:true}}};
const versionSelect={id:true,guideId:true,kind:true,originalName:true,mimeType:true,size:true,sha256:true,createdBy:true,reason:true,requestId:true,createdAt:true};
const serial=v=>JSON.parse(JSON.stringify(v)),version=v=>serial({...v,available:v.size!==null&&v.sha256!==null}),key=id=>'transport_guide_at_document_'+id;
const noQuery=q=>{if(!R.keys(q,[]))fail('TRANSPORT_INVALID_REQUEST');};
async function choices(db,id,lock=false,inspect=false){
 if(lock){await db.$queryRaw`SELECT id FROM "TransportGuide" WHERE id=${id} FOR UPDATE`;await db.$queryRaw`SELECT id FROM "SystemSetting" WHERE key=${key(id)} FOR UPDATE`;}
 const guide=await db.transportGuide.findUnique({where:{id},select});if(!guide)fail('TRANSPORT_NOT_FOUND',404);
 const setting=await db.systemSetting.findUnique({where:{key:key(id)}}),pointerHash=digest(serial(setting));let current={kind:'NONE',id:null,name:null,mimeType:null,size:null,sha256:null,available:false,pointerHash},legacy=null;
 if(setting){
  let pointer;try{pointer=JSON.parse(setting.value);}catch(_){}
  const v=pointer?.storage==='DATABASE'&&R.positive(pointer.versionId)?await db.transportGuideAttachment.findFirst({where:{id:pointer.versionId,guideId:id},select:versionSelect}):null;
  if(v&&v.kind==='FILE'&&R.version(version(v),id))current={kind:'VERSION',id:v.id,name:v.originalName,mimeType:v.mimeType,size:v.size,sha256:v.sha256,available:true,pointerHash};
  else {legacy=await files.legacy(setting,id,inspect);current={kind:'LEGACY',id:null,name:legacy.name,mimeType:legacy.mimeType,size:legacy.size,sha256:legacy.sha256,available:legacy.state==='AVAILABLE',state:legacy.state,pointerHash};}
 }
 const choice=serial({...guide,current});if(!R.choice(choice))fail('TRANSPORT_DATA_REVIEW',409);return {choice,setting,legacy};
}
async function list(a,raw={},db=prisma){
  owner(a);const q=R.query(raw);if(!q)fail('TRANSPORT_INVALID_QUERY');
  return db.$transaction(async tx=>{
    const where={...(q.guideId?{id:q.guideId}:{}),...(q.q?{OR:[{codeAT:{contains:q.q,mode:'insensitive'}},{vehicle:{plate:{contains:q.q,mode:'insensitive'}}}]}:{})};
    const rows=await tx.transportGuide.findMany({where,select:{id:true},orderBy:{id:'desc'},skip:(q.page-1)*25,take:25}),guides=[];
    for(const row of rows)guides.push((await choices(tx,row.id)).choice);
    return {...envelope(a),page:q.page,size:25,total:await tx.transportGuide.count({where}),guides};
  },{isolationLevel:'RepeatableRead',timeout:20000});
}
async function review(a,body={},file,q={},db=prisma){
 const subject=owner(a);noQuery(q);const p=R.input(body);if(!p)fail('TRANSPORT_INVALID_FIELDS');await files.validate(file,p.file);
 const {choice}=await db.$transaction(tx=>choices(tx,p.guideId,false,true),{isolationLevel:'RepeatableRead',timeout:20000});
 const requestId=randomUUID(),reviewToken=jwt.sign({proposalDigest:digest(p),choiceDigest:digest(choice)},getJwtSecret(),{algorithm:'HS256',audience,subject,jwtid:requestId,expiresIn:300});
 return {...envelope(a),requestId,reviewToken,expiresAt:new Date(jwt.decode(reviewToken).exp*1000).toISOString(),proposal:p,choice};
}
const packet=(a,id,result)=>({...envelope(a),requestId:id,status:result?.cancelled?'CANCELLED':result?'CONFIRMED':'UNCONFIRMED',result:result||null});
async function result(a,id,q={},db=prisma){
  const subject=owner(a);noQuery(q);if(!R.uuid(id))fail('TRANSPORT_INVALID_REQUEST');
  return db.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`field-request:${subject}:${id}`}))::text`;const saved=await tx.fieldWriteRequest.findUnique({where:{owner_requestId:{owner:subject,requestId:id}}});return packet(a,id,saved?.scope===scope?saved.response:null);},{timeout:15000});
}
async function commit(a,body={},file,q={},db=prisma){
  const subject=owner(a);noQuery(q);
  if(!R.keys(body,['proposal','requestId','reviewToken'])||!R.uuid(body.requestId)||typeof body.reviewToken!=='string'||body.reviewToken.length>4000)fail('TRANSPORT_INVALID_REQUEST');
  const p=R.input(body.proposal);if(!p)fail('TRANSPORT_INVALID_FIELDS');
  const bytes=await files.validate(file,p.file);
  let claims;try{claims=jwt.verify(body.reviewToken,getJwtSecret(),{algorithms:['HS256'],audience,subject,ignoreExpiration:true});}catch(_){fail('TRANSPORT_REVIEW_REQUIRED',409);}
  if(claims.jti!==body.requestId||claims.proposalDigest!==digest(p)||typeof claims.choiceDigest!=='string'||!Number.isInteger(claims.exp))fail('TRANSPORT_REVIEW_REQUIRED',409);
  const request=requests.context(a,scope,p.guideId,body.requestId,{proposalDigest:claims.proposalDigest,reviewToken:body.reviewToken});
  try{return await db.$transaction(async tx=>{
    const saved=await requests.recover(tx,request);if(saved)return packet(a,body.requestId,saved);
    if(claims.exp*1000<=Date.now())fail('TRANSPORT_REVIEW_EXPIRED',409);
    const context=await choices(tx,p.guideId,true,true),c=context.choice;if(digest(c)!==claims.choiceDigest)fail('TRANSPORT_CHANGED',409);
    let archived=null;
    if(c.current.kind==='LEGACY'){
      const l=context.legacy;archived=version(await tx.transportGuideAttachment.create({data:{guideId:c.id,kind:'LEGACY',originalName:l.name,mimeType:l.mimeType,size:l.size,sha256:l.sha256,bytes:l.bytes,legacyRecord:serial(context.setting),createdBy:subject,reason:p.reason,requestId:body.requestId},select:versionSelect}));
    }
    const document=version(await tx.transportGuideAttachment.create({data:{guideId:c.id,kind:'FILE',originalName:p.file.name,mimeType:p.file.mimeType,size:p.file.size,sha256:p.file.sha256,bytes,createdBy:subject,reason:p.reason,requestId:body.requestId},select:versionSelect}));
    const pointer={guideId:c.id,codeAT:c.codeAT,vehicleId:c.vehicleId,vehiclePlate:c.vehicle?.plate||null,storage:'DATABASE',versionId:document.id,url:'/api/transport-guide-documents/'+c.id+'/files/'+document.id,filename:p.file.name,originalName:p.file.name,mimeType:p.file.mimeType,size:p.file.size,sha256:p.file.sha256,uploadedAt:document.createdAt,uploadedBy:subject};
    await tx.systemSetting.upsert({where:{key:key(c.id)},create:{key:key(c.id),value:JSON.stringify(pointer),notes:'Documento interno revisto; versões anteriores preservadas.'},update:{value:JSON.stringify(pointer)}});
    await tx.transportGuide.update({where:{id:c.id},data:{updatedAt:new Date(Math.max(Date.now(),Date.parse(c.updatedAt)+1))}});
    const audit=await tx.userAuditLog.create({data:{userId:Number(a.userId||a.id),actor:subject,action:scope,entity:'TransportGuide',entityId:String(c.id),metadata:{requestId:body.requestId,proposal:p,previous:c.current,document,archived}}});
    return packet(a,body.requestId,await requests.confirm(tx,request,{guideId:c.id,proposal:p,previous:c.current,document,archived,auditId:audit.id}));
  },{maxWait:15000,timeout:30000});}catch(e){if(e.code==='FIELD_REQUEST_REUSED')fail('TRANSPORT_REQUEST_CONFLICT',409);throw e;}
}
async function cancel(a,id,body={},q={},db=prisma){
  const subject=owner(a);noQuery(q);if(!R.uuid(id)||!R.keys(body,['guideId'])||!R.positive(body.guideId))fail('TRANSPORT_INVALID_REQUEST');
  return db.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`field-request:${subject}:${id}`}))::text`;const saved=await tx.fieldWriteRequest.findUnique({where:{owner_requestId:{owner:subject,requestId:id}}});if(saved){if(saved.scope!==scope||saved.resourceId!==body.guideId)fail('TRANSPORT_REQUEST_CONFLICT',409);return packet(a,id,saved.response);}const audit=await tx.userAuditLog.create({data:{userId:Number(a.userId||a.id),actor:subject,action:'TRANSPORT_DOCUMENT_CANCELLED',entity:'FieldWriteRequest',entityId:id,metadata:body}});return packet(a,id,await requests.confirm(tx,{owner:subject,scope,requestId:id,resourceId:body.guideId,payloadHash:'cancelled'},{guideId:body.guideId,document:null,cancelled:true,auditId:audit.id}));},{timeout:15000});
}

async function history(a,id,raw={},db=prisma){owner(a);if(!R.positive(id)||!R.object(raw)||Object.keys(raw).some(k=>k!=='page'))fail('TRANSPORT_INVALID_QUERY');const page=raw.page===undefined?1:R.id(raw.page);if(!page||page>1000000)fail('TRANSPORT_INVALID_QUERY');return db.$transaction(async tx=>{if(!await tx.transportGuide.findUnique({where:{id},select:{id:true}}))fail('TRANSPORT_NOT_FOUND',404);const where={guideId:id},versions=await tx.transportGuideAttachment.findMany({where,select:versionSelect,orderBy:{id:'desc'},skip:(page-1)*25,take:25});return {...envelope(a),guideId:id,page,size:25,total:await tx.transportGuideAttachment.count({where}),versions:versions.map(version)};},{isolationLevel:'RepeatableRead',timeout:15000});}
async function authorized(db,a,id){
 if(!R.positive(id))fail('TRANSPORT_INVALID_REQUEST');
 if(a?.role==='ADMIN')owner(a);else if(!['TECHNICIAN','TEAM_LEADER'].includes(a?.role))fail('TRANSPORT_FORBIDDEN',403);
 const guide=await db.transportGuide.findUnique({where:{id},select:{id:true,vehicleId:true}});if(!guide)fail('TRANSPORT_NOT_FOUND',404);
 if(a.role!=='ADMIN'){const technician=await db.technician.findUnique({where:{id:Number(a.technicianId||a.id)},select:{active:true,deletedAt:true,vehicleId:true}});if(!technician?.active||technician.deletedAt||!technician.vehicleId||technician.vehicleId!==guide.vehicleId)fail('TRANSPORT_FORBIDDEN',403);}
 return guide;
}
async function download(a,id,versionId,q={},db=prisma){
 noQuery(q);return db.$transaction(async tx=>{
  const guide=await authorized(tx,a,id);let attachment;
  if(versionId!==null){if(!R.positive(versionId))fail('TRANSPORT_INVALID_REQUEST');attachment=await tx.transportGuideAttachment.findFirst({where:{id:versionId,guideId:id}});if(!attachment)fail('TRANSPORT_NOT_FOUND',404);}
  else {const row=await tx.systemSetting.findUnique({where:{key:key(id)}});if(!row)fail('TRANSPORT_NOT_FOUND',404);let pointer;try{pointer=JSON.parse(row.value);}catch(_){}if(pointer?.storage==='DATABASE'&&R.positive(pointer.versionId))attachment=await tx.transportGuideAttachment.findFirst({where:{id:pointer.versionId,guideId:id}});else{const l=await files.legacy(row,id);if(l?.bytes)attachment={id:'legacy',kind:'LEGACY',originalName:l.name,mimeType:l.mimeType,bytes:l.bytes,size:l.size,sha256:l.sha256};}if(!attachment)fail('TRANSPORT_NOT_FOUND',404);}
  const bytes=attachment.bytes?Buffer.from(attachment.bytes):null;if(!bytes||bytes.length!==attachment.size||files.hash(bytes)!==attachment.sha256)fail('TRANSPORT_FILE_UNAVAILABLE',409);
  return {guide,versionId:attachment.id,name:attachment.originalName,mimeType:attachment.kind==='LEGACY'?'application/octet-stream':attachment.mimeType,bytes,sha256:attachment.sha256,owner:requests.owner(a)};
 },{isolationLevel:'RepeatableRead',timeout:20000});
}
module.exports={owner,list,history,review,commit,result,cancel,download};
