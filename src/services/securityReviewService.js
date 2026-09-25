'use strict';
const {prisma}=require('../prismaClient'),jwt=require('jsonwebtoken'),bcrypt=require('bcrypt'),{createHmac,randomUUID}=require('node:crypto'),{getJwtSecret}=require('../utils/jwtSecret'),R=require('../../frontend/cw-security-rules');
const accountSelect={id:true,name:true,email:true,role:true,active:true},reviewSelect={...accountSelect,mustChangePassword:true,lockedUntil:true,updatedAt:true,passwordChangedAt:true,password:true},action='PASSWORD_RESET_REVIEWED',audience='cristalwater-password-review-v1';
const fail=(code,statusCode)=>{throw Object.assign(Error(code),{code,statusCode});};
function owner(actor){const id=Number(actor?.userId||actor?.id);if(actor?.role!=='ADMIN'||!R.positive(id)||actor.principalType==='ENV_ADMIN')fail('SECURITY_ADMIN_REQUIRED',403);return 'ADMIN:'+id;}
const envelope=actor=>({ok:true,version:1,owner:owner(actor),asOf:new Date().toISOString()});
function targetId(raw){const id=R.id(raw);if(!id)fail('SECURITY_INVALID_REQUEST',400);return id;}
function noQuery(q){if(!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).length)fail('SECURITY_INVALID_REQUEST',400);}
function revision(row){return createHmac('sha256',getJwtSecret()).update('security-review\0'+JSON.stringify(row)).digest('hex');}
function publicTarget(row){const {password,...safe}=row;return {...safe,updatedAt:safe.updatedAt.toISOString(),lockedUntil:safe.lockedUntil?.toISOString()||null,passwordChangedAt:safe.passwordChangedAt?.toISOString()||null};}
async function read(actor,query={},database=prisma){
 owner(actor);const page=R.page(query);if(!page)fail('SECURITY_INVALID_REQUEST',400);
 return database.$transaction(async tx=>{const asOf=new Date(),[users,active,locked,audit]=await Promise.all([tx.user.count(),tx.user.count({where:{active:true}}),tx.user.count({where:{lockedUntil:{gt:asOf}}}),tx.userAuditLog.count()]);
  const rows=await tx.user.findMany({select:accountSelect,orderBy:{id:'asc'},skip:(page-1)*25,take:25}),logs=await tx.userAuditLog.findMany({select:{id:true,createdAt:true,action:true,actor:true,entity:true,entityId:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:20});
  return {...envelope(actor),asOf:asOf.toISOString(),page,size:25,totals:{users,active,locked,audit},users:rows,audit:logs.map(r=>({...r,createdAt:r.createdAt.toISOString()}))};
 },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:15000});
}
async function review(actor,rawId,query={},database=prisma){
 const subject=owner(actor),id=targetId(rawId);noQuery(query);const row=await database.user.findUnique({where:{id},select:reviewSelect});if(!row)fail('SECURITY_ACCOUNT_NOT_FOUND',404);
 const requestId=randomUUID(),reviewToken=jwt.sign({targetId:id,revision:revision(row)},getJwtSecret(),{algorithm:'HS256',subject,audience,jwtid:requestId,expiresIn:300}),claims=jwt.decode(reviewToken);
 return {...envelope(actor),target:publicTarget(row),requestId,reviewToken,expiresAt:new Date(claims.exp*1000).toISOString()};
}
async function receipt(database,subject,id,requestId){
 const row=await database.userAuditLog.findFirst({where:{action,actor:subject,entity:'User',entityId:String(id),metadata:{path:['requestId'],equals:requestId}},select:{id:true,createdAt:true,actor:true,metadata:true}});
 return row?{auditId:row.id,changedAt:row.createdAt.toISOString(),actor:row.actor,requestDigest:row.metadata?.requestDigest}:null;
}
const result=(actor,id,requestId,record)=>({...envelope(actor),targetId:id,requestId,status:record?'CONFIRMED':'UNCONFIRMED',receipt:record?{auditId:record.auditId,changedAt:record.changedAt,actor:record.actor}:null});
async function readResult(actor,rawId,requestId,query={},database=prisma){const subject=owner(actor),id=targetId(rawId);noQuery(query);if(!R.uuid(requestId))fail('SECURITY_INVALID_REQUEST',400);return result(actor,id,requestId,await receipt(database,subject,id,requestId));}
async function reset(actor,rawId,body={},database=prisma){
 const subject=owner(actor),id=targetId(rawId);
 if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.reviewToken!=='string')fail('SECURITY_REVIEW_REQUIRED',409);
 if(Object.keys(body).some(k=>!['reviewToken','newPassword'].includes(k))||!R.password(body.newPassword)||body.reviewToken.length>2000)fail('SECURITY_INVALID_REQUEST',400);
 let claims;try{claims=jwt.verify(body.reviewToken,getJwtSecret(),{algorithms:['HS256'],audience,subject,ignoreExpiration:true});}catch(_){fail('SECURITY_REVIEW_REQUIRED',409);}
 if(claims.targetId!==id||!R.uuid(claims.jti)||typeof claims.revision!=='string'||!Number.isInteger(claims.exp))fail('SECURITY_REVIEW_REQUIRED',409);
 const requestDigest=createHmac('sha256',getJwtSecret()).update('security-password-request\0'+claims.jti+'\0'+body.newPassword).digest('hex');
 const replay=record=>{if(record.requestDigest!==requestDigest)fail('SECURITY_REQUEST_CONFLICT',409);return result(actor,id,claims.jti,record);};
 const known=await receipt(database,subject,id,claims.jti);if(known)return replay(known);
 if(claims.exp*1000<=Date.now())fail('SECURITY_REVIEW_EXPIRED',409);
 // Hash only after identity/proof validation. The password is never logged or
 // stored in a review, receipt, token, or browser persistence.
 const password=await bcrypt.hash(body.newPassword,12);
 try{return await database.$transaction(async tx=>{
  const previous=await receipt(tx,subject,id,claims.jti);if(previous)return replay(previous);
  const row=await tx.user.findUnique({where:{id},select:reviewSelect});if(!row||revision(row)!==claims.revision)fail('SECURITY_ACCOUNT_CHANGED',409);
  if(claims.exp*1000<=Date.now())fail('SECURITY_REVIEW_EXPIRED',409);
  const changedAt=new Date(),saved=await tx.user.updateMany({where:{id,password:row.password,updatedAt:row.updatedAt},data:{password,passwordChangedAt:changedAt}});
  if(saved.count!==1)fail('SECURITY_ACCOUNT_CHANGED',409);
  const record=await tx.userAuditLog.create({data:{userId:id,actor:subject,action,entity:'User',entityId:String(id),createdAt:changedAt,metadata:{version:1,requestId:claims.jti,requestDigest}},select:{id:true,createdAt:true,actor:true}});
  return result(actor,id,claims.jti,{auditId:record.id,changedAt:record.createdAt.toISOString(),actor:record.actor});
 },{maxWait:15000,timeout:15000});}catch(error){
  // A concurrent retry may have committed while this transaction was waiting.
  const recovered=await receipt(database,subject,id,claims.jti);if(recovered)return replay(recovered);
  if(error.code==='P2034')fail('SECURITY_ACCOUNT_CHANGED',409);throw error;
 }
}
module.exports={read,review,readResult,reset,owner};
