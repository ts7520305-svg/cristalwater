const { prisma } = require('../../prismaClient');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../../utils/jwtSecret');
function yearsBefore(now, years) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw Error('Data inválida');
  const month = date.getUTCMonth(); date.setUTCFullYear(date.getUTCFullYear()-years);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date;
}
function fail(message,status=409){const error=new Error(message);error.status=status;throw error;}
async function counts(db,cutoff){
  const [technicianTracks,locationLogs]=await Promise.all([
    db.technicianTrack.count({where:{createdAt:{lt:cutoff}}}),
    db.locationLog.count({where:{timestamp:{lt:cutoff},createdAt:{lt:cutoff}}}),
  ]);
  return {technicianTracks,locationLogs,total:technicianTracks+locationLogs};
}
async function preview(actor,{now=new Date(),db=prisma}={}){
  const cutoff=yearsBefore(now,1),eligible=await counts(db,cutoff);
  const payload={purpose:'GPS_RETENTION_PREVIEW',actor,cutoff:cutoff.toISOString(),counts:eligible};
  const previewToken=jwt.sign(payload,getJwtSecret(),{algorithm:'HS256',expiresIn:300});
  return {ok:true,mode:'PREVIEW',cutoff:cutoff.toISOString(),counts:eligible,previewToken,expiresInSeconds:300,
    preserved:['TechnicianLocation','ServiceVisit','Visit','TechnicalHistory','Invoice','Payment','Attachment'],
    criticalHistoryMinimumYears:10,criticalHistoryDeletionEnabled:false,automaticDeletionEnabled:false,
    scope:'Apenas históricos GPS na base de dados. Backups e cópias externas não são alterados.'};
}
async function execute(actor,payload={}){
  if(payload.confirmation!=='ELIMINAR GPS ANTIGO')fail('Confirmação explícita em falta',400);
  const reason=String(payload.reason||'').trim();if(reason.length<5||reason.length>1000)fail('Indique o motivo da limpeza (5 a 1000 caracteres)',400);
  let review;try{review=jwt.verify(payload.previewToken,getJwtSecret(),{algorithms:['HS256']});}catch{fail('Pré-visualização inválida ou expirada. Volte a rever os registos.');}
  if(review.purpose!=='GPS_RETENTION_PREVIEW'||review.actor!==actor)fail('Pré-visualização pertence a outra sessão administrativa',403);
  const cutoff=new Date(review.cutoff);
  if(!Number.isFinite(cutoff.getTime())||cutoff>yearsBefore(new Date(),1))fail('Limite de retenção inválido');
  return prisma.$transaction(async tx=>{
    const [lock]=await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(93615002::bigint) AS acquired`;
    if(!lock.acquired)fail('Já existe uma limpeza em curso. Volte a rever antes de repetir.');
    const current=await counts(tx,cutoff);
    if(current.technicianTracks!==review.counts.technicianTracks||current.locationLogs!==review.counts.locationLogs)fail('Os registos mudaram desde a pré-visualização. Volte a rever antes de eliminar.');
    const tracks=await tx.technicianTrack.deleteMany({where:{createdAt:{lt:cutoff}}});
    const logs=await tx.locationLog.deleteMany({where:{timestamp:{lt:cutoff},createdAt:{lt:cutoff}}});
    const deleted={technicianTracks:tracks.count,locationLogs:logs.count,total:tracks.count+logs.count};
    await tx.userAuditLog.create({data:{actor,action:'GPS_RETENTION_APPLIED',entity:'GPS_HISTORY',metadata:{cutoff:review.cutoff,deleted,reason}}});
    return {ok:true,cutoff:review.cutoff,deleted};
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
module.exports={yearsBefore,preview,execute};
