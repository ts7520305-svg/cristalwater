const assert=require('node:assert/strict');
const fs=require('node:fs');
require('../src/loadEnv')();
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw new Error('Isolated QA environment required');
const {Prisma}=require('@prisma/client');
const {prisma}=require('../src/prismaClient');
const backup=require('../src/services/databaseBackupService');
(async()=>{
 const previousPath=process.env.PATH,previousDump=process.env.PG_DUMP_PATH;
 let result;
 try{
  // Force the documented fallback in this isolated child; never invoke a real provider.
  process.env.PATH='';process.env.PG_DUMP_PATH='/__cw_qa_missing__/pg_dump';
  result=await backup.createDatabaseBackup();assert.equal(result.fallback,true);
  const snapshot=JSON.parse(fs.readFileSync(result.backup.file,'utf8'));
  assert.equal(snapshot.format,'prisma-json-fallback');
  for(const model of Prisma.dmmf.datamodel.models)assert(Array.isArray(snapshot.data[model.name]),model.name);
  assert.equal(snapshot.data.Client.length,await prisma.client.count());
  assert.equal(snapshot.data.ServiceVisit.length,await prisma.serviceVisit.count());
  assert.equal(fs.statSync(result.backup.file).mode&0o777,0o600);
  assert(!fs.existsSync(result.backup.file+'.partial'));
  console.log('PASS consistent JSON fallback exports every Prisma model with protected permissions; native SQL restore remains a production check');
 }finally{
  if(previousPath===undefined)delete process.env.PATH;else process.env.PATH=previousPath;
  if(previousDump===undefined)delete process.env.PG_DUMP_PATH;else process.env.PG_DUMP_PATH=previousDump;
  if(result?.backup?.file)fs.rmSync(result.backup.file,{force:true});
  await backup.disconnectDatabaseBackupService();await prisma.$disconnect();
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
