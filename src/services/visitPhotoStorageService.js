const fs=require('fs');
const path=require('path');
const {createHash}=require('crypto');
const {prisma}=require('../prismaClient');
const {resolveUploadBaseDir,toPublicUploadUrl}=require('../config/uploadPath');
async function storeVisitPhoto(visitId,file,type){
  const hash=createHash('sha256').update(await fs.promises.readFile(file.path)).digest('hex');
  const category=['BEFORE','AFTER','PROBLEM','ACCESS','GENERAL'].includes(type)?type:'AFTER';
  const extension=path.extname(file.filename).replace(/[^a-z0-9.]/gi,'').slice(0,12);
  const filename=`visit-${visitId}-${category}-${hash}${extension}`;
  await fs.promises.rename(file.path,path.join(resolveUploadBaseDir(),filename));
  const url=toPublicUploadUrl(filename), key=`photo:${visitId}:${category}:${hash}`;
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
    const existing=await tx.visitPhoto.findFirst({where:{visitId,url,type:category}});
    if(existing)return existing;
    return tx.visitPhoto.create({data:{visitId,url,type:category}});
  });
}
module.exports={storeVisitPhoto};
