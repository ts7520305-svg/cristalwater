// Real PostgreSQL dump/restore drill, restricted to the disposable CI database.
require('../src/loadEnv')();
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const {createHash,randomUUID}=require('crypto');
const {PrismaClient,Prisma}=require('@prisma/client');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw new Error('Isolated QA required');
const sourceUrl=new URL(process.env.DATABASE_URL);
const sourceName=decodeURIComponent(sourceUrl.pathname.slice(1));
const container=process.env.CW_POSTGRES_CONTAINER||'';
if(sourceName!=='cristalwater_qa'||!/^\w{12,64}$/.test(container))throw new Error('Only the disposable PostgreSQL CI service is supported');
const restoredName=`cw_restore_qa_${Date.now()}`;
const restoredUrl=new URL(sourceUrl);restoredUrl.pathname='/'+restoredName;
const source=new PrismaClient(),restored=new PrismaClient({datasources:{db:{url:restoredUrl.href}}});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cw-restore-qa-'));
const evidence=path.resolve('reports/field-suite/restore-drill.json');
let attachmentProbe,guideProbe;
const probeBytes=Buffer.from([0,1,2,127,128,255,...Buffer.from('Cristal Water restore: versão oficial')]);
const report={startedAt:new Date().toISOString(),status:'RUNNING',tables:[],files:0};
function pg(command,args=[],input){
 const result=spawnSync('docker',['exec',...(input?['-i']:[]),'-e','PGPASSWORD',container,command,'-U',decodeURIComponent(sourceUrl.username),...args],{env:{...process.env,PGPASSWORD:decodeURIComponent(sourceUrl.password)},input,maxBuffer:64*1024*1024,timeout:120000});
 if(result.status!==0)throw new Error(`${command} failed: ${result.stderr?.toString()||result.error?.message||result.status}`);
 return result.stdout;
}
async function fingerprints(db){
 const rows=[];
 for(const model of Prisma.dmmf.datamodel.models){
  const name=model.dbName||model.name;
  const [result]=await db.$queryRawUnsafe(`SELECT count(*)::text AS count, md5(COALESCE(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text), '')) AS fingerprint FROM "${name.replaceAll('"','""')}" t`);
  rows.push({table:name,...result});
 }
 return rows;
}
function files(directory){
 if(!fs.existsSync(directory))return [];
 const result=[];
 function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const target=path.join(folder,entry.name);if(entry.isDirectory())walk(target);else if(entry.isFile())result.push({path:path.relative(directory,target),sha256:createHash('sha256').update(fs.readFileSync(target)).digest('hex')});else throw new Error('Unexpected link in QA uploads');}}
 walk(directory);return result.sort((a,b)=>a.path.localeCompare(b.path));
}
(async()=>{
 guideProbe=await source.transportGuide.create({data:{validFrom:new Date(),status:'CLOSED',notes:'QA attachment restore probe'}});
 attachmentProbe=await source.transportGuideAttachment.create({data:{guideId:guideProbe.id,kind:'FILE',originalName:'restore.txt',mimeType:'text/plain',size:probeBytes.length,sha256:createHash('sha256').update(probeBytes).digest('hex'),bytes:probeBytes,createdBy:'ADMIN:1',reason:'Binary restore probe',requestId:randomUUID()}});
 const before=await fingerprints(source);
 const dump=pg('pg_dump',['-Fc','--no-owner','--no-privileges',sourceName]);
 assert(dump.length>0);report.backupBytes=dump.length;report.backupSha256=createHash('sha256').update(dump).digest('hex');
 const dumpFile=path.join(temp,'database.dump');fs.writeFileSync(dumpFile,dump,{mode:0o600});
 pg('createdb',[restoredName]);
 pg('pg_restore',['--exit-on-error','--no-owner','--no-privileges','-d',restoredName],fs.readFileSync(dumpFile));
 const after=await fingerprints(restored);assert.deepEqual(after,before,'Restored data differs from source');report.tables=after;
 const recoveredAttachment=await restored.transportGuideAttachment.findUniqueOrThrow({where:{id:attachmentProbe.id}});
 assert.deepEqual(Buffer.from(recoveredAttachment.bytes),probeBytes);assert.equal(recoveredAttachment.sha256,attachmentProbe.sha256);report.guideAttachmentBytesVerified=true;
 // Verify restored serial sequences can allocate new IDs after existing data.
 const visit=await restored.serviceVisit.create({data:{notes:'Restore sequence probe'}});
 await restored.serviceVisit.delete({where:{id:visit.id}});
 const uploads=path.resolve(process.env.UPLOAD_DIR||'');
 const qaRoot=path.resolve('uploads/qa')+path.sep;
 assert(uploads.startsWith(qaRoot),'Only QA uploads may be copied');
 const beforeFiles=files(uploads);assert(beforeFiles.length>0,'Integration suite must produce real uploads first');
 const archive=path.join(temp,'uploads-backup'),recovered=path.join(temp,'uploads-restored');
 fs.cpSync(uploads,archive,{recursive:true});fs.cpSync(archive,recovered,{recursive:true});
 assert.deepEqual(files(recovered),beforeFiles);report.files=beforeFiles.length;
 report.status='PASS';report.completedAt=new Date().toISOString();report.elapsedMs=Date.parse(report.completedAt)-Date.parse(report.startedAt);
 console.log(`PASS restored ${after.length} tables and ${report.files} uploaded files; database rows and file hashes match`);
})().catch(error=>{report.status='FAIL';report.error=error.message;console.error(error);process.exitCode=1}).finally(async()=>{
 if(attachmentProbe)await source.transportGuideAttachment.delete({where:{id:attachmentProbe.id}});if(guideProbe)await source.transportGuide.delete({where:{id:guideProbe.id}});
 await source.$disconnect();await restored.$disconnect();
 try{pg('dropdb',['--if-exists',restoredName])}catch(error){report.cleanupError=error.message;process.exitCode=1;report.status='FAIL'}
 fs.mkdirSync(path.dirname(evidence),{recursive:true});fs.writeFileSync(evidence,JSON.stringify(report,null,2));fs.rmSync(temp,{recursive:true,force:true});
});
