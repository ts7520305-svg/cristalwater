'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const {resolveUploadBaseDir,getUploadsPublicBasePath}=require('../../src/config/uploadPath');
module.exports=async(prisma,label)=>{
 const f=await require('./transport-guide-items-fixture')(prisma,label),cleanup=f.cleanup;
 const document=async(text='Official original')=>new Promise(resolve=>{const pdf=new (require('pdfkit'))(),parts=[];pdf.on('data',p=>parts.push(p));pdf.on('end',()=>resolve(Buffer.concat(parts)));pdf.text(text);pdf.end();});
 const describe=(bytes,name='versão.pdf',mimeType='application/pdf')=>({name,mimeType,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 const directory=path.join(resolveUploadBaseDir(),'guides');await fs.mkdir(directory,{recursive:true});
 const filename='qa-version-'+randomUUID()+'.pdf',disk=path.join(directory,filename),oldBytes=await document(),fileUrl=getUploadsPublicBasePath()+'/guides/'+filename;
 await fs.writeFile(disk,oldBytes);const old=await prisma.systemSetting.create({data:{key:'transport_guide_at_document_'+f.transport.id,notes:'Original exact administrative note',value:JSON.stringify({guideId:f.transport.id,url:fileUrl,originalName:'oficial-antigo.pdf',mimeType:'application/pdf',extra:{keep:'original metadata'},uploadedAt:'2025-01-02T03:04:05.006Z'})}});
 f.attachmentGuides=[f.transport.id];f.testFiles=[disk];
 f.cleanup=async()=>{const records=await prisma.fieldWriteRequest.findMany({where:{scope:'TRANSPORT_GUIDE_DOCUMENT',resourceId:{in:f.attachmentGuides}},select:{requestId:true}});await prisma.fieldWriteRequest.deleteMany({where:{scope:'TRANSPORT_GUIDE_DOCUMENT',resourceId:{in:f.attachmentGuides}}});await prisma.userAuditLog.deleteMany({where:{OR:[{action:'TRANSPORT_GUIDE_DOCUMENT',entityId:{in:f.attachmentGuides.map(String)}},{action:'TRANSPORT_DOCUMENT_CANCELLED',entityId:{in:records.map(r=>r.requestId)}}]}});await prisma.transportGuideAttachment.deleteMany({where:{guideId:{in:f.attachmentGuides}}});await prisma.systemSetting.deleteMany({where:{key:{in:f.attachmentGuides.map(id=>'transport_guide_at_document_'+id)}}});await prisma.transportGuide.deleteMany({where:{id:{in:f.attachmentGuides.filter(id=>id!==f.transport.id)}}});for(const name of f.testFiles)await fs.rm(name,{force:true});await cleanup();};
 return Object.assign(f,{document,describe,directory,disk,fileUrl,old,oldBytes});
};
