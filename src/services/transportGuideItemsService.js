'use strict';
const {prisma}=require('../prismaClient');
const jwt=require('jsonwebtoken');
const {createHmac,randomUUID}=require('node:crypto');
const {getJwtSecret}=require('../utils/jwtSecret');
const requests=require('./fieldWriteRequestService');
const {owner,lockVehicle}=require('./transportGuideCreationService');
const R=require('../../frontend/cw-transport-items-rules');
const scope='TRANSPORT_GUIDE_ITEMS',audience='cristalwater-transport-items-v1';
const fail=(code,statusCode=400)=>{throw Object.assign(Error(code),{code,statusCode});};
const envelope=a=>({ok:true,version:1,owner:owner(a),asOf:new Date().toISOString()});
const digest=v=>createHmac('sha256',getJwtSecret()).update('transport-items\0'+JSON.stringify(v)).digest('hex');
const select={id:true,vehicleId:true,codeAT:true,status:true,isDraft:true,updatedAt:true,vehicle:{select:{id:true,plate:true,name:true,active:true,deletedAt:true,updatedAt:true}},items:{orderBy:{id:'asc'},take:101,select:{id:true,guideId:true,name:true,type:true,unit:true,quantity:true}},workGuides:{orderBy:{id:'asc'},take:101,select:{id:true,vehicleId:true,guideId:true,status:true,updatedAt:true,items:{orderBy:{id:'asc'},take:101,select:{id:true,workGuideId:true,name:true,type:true,unit:true,initialQty:true,quantity:true,usedQty:true,updatedAt:true}}}}};
const noQuery=q=>{if(!R.keys(q,[]))fail('TRANSPORT_INVALID_REQUEST');};
async function choices(db,id,lock=false){
  if(lock){
    const source=await db.transportGuide.findUnique({where:{id},select:{vehicleId:true}});
    if(!source)fail('TRANSPORT_NOT_FOUND',404);
    await lockVehicle(db,source.vehicleId);
    // Same vehicle -> work -> vehicle row -> transport -> item order as creation.
    await db.$queryRaw`SELECT id FROM "WorkGuide" WHERE "guideId"=${id} ORDER BY id FOR UPDATE`;
    await db.$queryRaw`SELECT id FROM "Vehicle" WHERE id=${source.vehicleId} FOR UPDATE`;
    await db.$queryRaw`SELECT id FROM "TransportGuide" WHERE id=${id} FOR UPDATE`;
    await db.$queryRaw`SELECT i.id FROM "WorkGuideItem" i JOIN "WorkGuide" w ON w.id=i."workGuideId" WHERE w."guideId"=${id} ORDER BY i.id FOR UPDATE OF i`;
    await db.$queryRaw`SELECT id FROM "TransportGuideItem" WHERE "guideId"=${id} ORDER BY id FOR UPDATE`;
  }
  const guide=await db.transportGuide.findUnique({where:{id},select});
  if(!guide)fail('TRANSPORT_NOT_FOUND',404);
  if(guide.items.length>100||guide.workGuides.length>100||guide.workGuides.some(w=>w.items.length>100))fail('TRANSPORT_VOLUME_REVIEW',409);
  const value=JSON.parse(JSON.stringify(guide));if(!R.choice(value))fail('TRANSPORT_DATA_REVIEW',409);return value;
}
async function list(a,raw={},db=prisma){
  owner(a);const q=R.query(raw);if(!q)fail('TRANSPORT_INVALID_QUERY');
  return db.$transaction(async tx=>{
    const where={...(q.guideId?{id:q.guideId}:{status:'ACTIVE'}),...(q.q?{OR:[{codeAT:{contains:q.q,mode:'insensitive'}},{vehicle:{plate:{contains:q.q,mode:'insensitive'}}}]}:{})};
    const rows=await tx.transportGuide.findMany({where,select:{id:true},orderBy:{id:'desc'},skip:(q.page-1)*25,take:25}),guides=[];
    for(const row of rows)guides.push(await choices(tx,row.id));
    return {...envelope(a),page:q.page,size:25,total:await tx.transportGuide.count({where}),guides};
  },{isolationLevel:'RepeatableRead',timeout:20000});
}
async function review(a,body={},q={},db=prisma){
  const subject=owner(a);noQuery(q);const p=R.input(body);if(!p)fail('TRANSPORT_INVALID_FIELDS');
  const choice=await db.$transaction(tx=>choices(tx,p.guideId),{isolationLevel:'RepeatableRead',timeout:15000});
  const plan=R.plan(p,choice);if(!plan)fail('TRANSPORT_MATERIAL_REVIEW',409);
  const requestId=randomUUID(),reviewToken=jwt.sign({proposalDigest:digest(p),choiceDigest:digest(choice)},getJwtSecret(),{algorithm:'HS256',audience,subject,jwtid:requestId,expiresIn:300});
  return {...envelope(a),requestId,reviewToken,expiresAt:new Date(jwt.decode(reviewToken).exp*1000).toISOString(),proposal:p,choice,plan};
}
const packet=(a,id,result)=>({...envelope(a),requestId:id,status:result?.cancelled?'CANCELLED':result?'CONFIRMED':'UNCONFIRMED',result:result||null});
async function result(a,id,q={},db=prisma){
  const subject=owner(a);noQuery(q);if(!R.uuid(id))fail('TRANSPORT_INVALID_REQUEST');
  return db.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`field-request:${subject}:${id}`}))::text`;const saved=await tx.fieldWriteRequest.findUnique({where:{owner_requestId:{owner:subject,requestId:id}}});return packet(a,id,saved?.scope===scope?saved.response:null);},{timeout:15000});
}
async function commit(a,body={},q={},db=prisma){
  const subject=owner(a);noQuery(q);
  if(!R.keys(body,['proposal','requestId','reviewToken'])||!R.uuid(body.requestId)||typeof body.reviewToken!=='string'||body.reviewToken.length>4000)fail('TRANSPORT_INVALID_REQUEST');
  const p=R.input(body.proposal);if(!p)fail('TRANSPORT_INVALID_FIELDS');
  let claims;try{claims=jwt.verify(body.reviewToken,getJwtSecret(),{algorithms:['HS256'],audience,subject,ignoreExpiration:true});}catch(_){fail('TRANSPORT_REVIEW_REQUIRED',409);}
  if(claims.jti!==body.requestId||claims.proposalDigest!==digest(p)||typeof claims.choiceDigest!=='string'||!Number.isInteger(claims.exp))fail('TRANSPORT_REVIEW_REQUIRED',409);
  const request=requests.context(a,scope,p.guideId,body.requestId,{proposalDigest:claims.proposalDigest,reviewToken:body.reviewToken});
  try{return await db.$transaction(async tx=>{
    const saved=await requests.recover(tx,request);if(saved)return packet(a,body.requestId,saved);
    if(claims.exp*1000<=Date.now())fail('TRANSPORT_REVIEW_EXPIRED',409);
    const c=await choices(tx,p.guideId,true);if(digest(c)!==claims.choiceDigest)fail('TRANSPORT_CHANGED',409);
    const plan=R.plan(p,c);if(!plan)fail('TRANSPORT_MATERIAL_REVIEW',409);
    const movementIds=[],rows=[];
    for(const row of plan.rows){
      let guideItem,workItem;
      if(row.id){
        guideItem=await tx.transportGuideItem.update({where:{id:row.id},data:{quantity:row.after.initialQty}});
        workItem=await tx.workGuideItem.update({where:{id:row.workItemId},data:{initialQty:row.after.initialQty,quantity:row.after.quantity,updatedAt:new Date(Math.max(Date.now(),Date.parse(c.workGuides[0].items.find(i=>i.id===row.workItemId).updatedAt)+1))}});
      }else{
        guideItem=await tx.transportGuideItem.create({data:{guideId:c.id,name:row.name,type:row.type,unit:row.unit,quantity:row.after.initialQty}});
        workItem=await tx.workGuideItem.create({data:{workGuideId:plan.workGuideId,name:row.name,type:row.type,unit:row.unit,...row.after}});
      }
      if(row.delta!==0){const movement=await tx.vehicleStockMovement.create({data:{vehicleId:c.vehicleId,transportGuideId:c.id,workGuideId:plan.workGuideId,itemName:row.name,itemType:row.type,unit:row.unit,quantity:row.delta,movementType:'ADJUSTMENT',source:'REVIEWED_GUIDE_ITEMS',notes:JSON.stringify({requestId:body.requestId,owner:subject,guideItemId:guideItem.id,workItemId:workItem.id,reason:p.notes,before:row.before,after:row.after})}});movementIds.push(movement.id);}
      rows.push({...row,id:guideItem.id,workItemId:workItem.id});
    }
    await tx.transportGuide.update({where:{id:c.id},data:{updatedAt:new Date(Math.max(Date.now(),Date.parse(c.updatedAt)+1))}});
    const guide=await choices(tx,c.id);
    const audit=await tx.userAuditLog.create({data:{userId:Number(a.userId||a.id),actor:subject,action:scope,entity:'TransportGuide',entityId:String(c.id),metadata:{requestId:body.requestId,vehicleId:c.vehicleId,workGuideId:plan.workGuideId,reason:p.notes,rows,movementIds}}});
    return packet(a,body.requestId,await requests.confirm(tx,request,{guideId:c.id,guide,workGuideId:plan.workGuideId,rows,movementIds,auditId:audit.id}));
  },{maxWait:15000,timeout:30000});}catch(e){if(e.code==='FIELD_REQUEST_REUSED')fail('TRANSPORT_REQUEST_CONFLICT',409);throw e;}
}
async function cancel(a,id,body={},q={},db=prisma){
  const subject=owner(a);noQuery(q);if(!R.uuid(id)||!R.keys(body,['guideId'])||!R.positive(body.guideId))fail('TRANSPORT_INVALID_REQUEST');
  return db.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`field-request:${subject}:${id}`}))::text`;const saved=await tx.fieldWriteRequest.findUnique({where:{owner_requestId:{owner:subject,requestId:id}}});if(saved){if(saved.scope!==scope||saved.resourceId!==body.guideId)fail('TRANSPORT_REQUEST_CONFLICT',409);return packet(a,id,saved.response);}const audit=await tx.userAuditLog.create({data:{userId:Number(a.userId||a.id),actor:subject,action:'TRANSPORT_ITEMS_CANCELLED',entity:'FieldWriteRequest',entityId:id,metadata:body}});return packet(a,id,await requests.confirm(tx,{owner:subject,scope,requestId:id,resourceId:body.guideId,payloadHash:'cancelled'},{guideId:body.guideId,guide:null,cancelled:true,auditId:audit.id}));},{timeout:15000});
}
module.exports={owner,list,review,commit,result,cancel};
