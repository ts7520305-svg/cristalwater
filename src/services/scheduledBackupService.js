'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const statusName='scheduled-backup-status.json',lockName='scheduled-backup.lock';
function readStatus(directory){
  const file=path.join(directory,statusName);if(!fs.existsSync(file))return null;
  try{
    const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>16384)throw Error();
    const value=JSON.parse(fs.readFileSync(file,'utf8'));
    if(value?.schema!==1||!['RUNNING','SUCCESS','FAILED'].includes(value.state)||typeof value.attemptId!=='string'||!Number.isFinite(Date.parse(value.startedAt))||value.state!=='RUNNING'&&!Number.isFinite(Date.parse(value.completedAt)))throw Error();
    if(value.state==='SUCCESS'&&(!value.backup||typeof value.backup.name!=='string'||path.basename(value.backup.name)!==value.backup.name||!/^cristalwater-db-.*\.sql$/.test(value.backup.name)||!Number.isSafeInteger(value.backup.sizeBytes)||value.backup.sizeBytes<=0||!/^[a-f0-9]{64}$/.test(value.backup.sha256)))throw Error();
    if(value.completedAt&&Date.parse(value.completedAt)<Date.parse(value.startedAt))throw Error();
    return {schema:1,attemptId:value.attemptId,state:value.state,startedAt:value.startedAt,completedAt:value.completedAt||null,code:['SQL_REQUIRED','CREATE_FAILED','INVALID_OUTPUT','BUSY'].includes(value.code)?value.code:null,backup:value.backup&&/^cristalwater-db-.*\.sql$/.test(value.backup.name)&&Number.isSafeInteger(value.backup.sizeBytes)&&/^[a-f0-9]{64}$/.test(value.backup.sha256)?{name:value.backup.name,sizeBytes:value.backup.sizeBytes,sha256:value.backup.sha256}:null};
  }catch{return {state:'UNREADABLE'};}
}
function writeStatus(directory,value){
  const temp=path.join(directory,statusName+'.'+randomUUID()+'.partial');
  try{fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});fs.renameSync(temp,path.join(directory,statusName));}finally{fs.rmSync(temp,{force:true});}
}
async function run({directory,createBackup,now=()=>new Date()}={}){
  if(!directory||typeof createBackup!=='function')throw Error('Configuração da cópia agendada inválida.');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const lock=path.join(directory,lockName);
  try{fs.mkdirSync(lock,{mode:0o700});}catch(error){if(error.code==='EEXIST')return {ok:false,code:'BUSY'};throw error;}
  const attempt={schema:1,attemptId:randomUUID(),state:'RUNNING',startedAt:now().toISOString(),completedAt:null,code:null,backup:null};
  try{
    writeStatus(directory,attempt);
    const result=await createBackup();
    if(result?.fallback===true)throw Object.assign(Error(),{backupCode:'SQL_REQUIRED'});
    const file=result?.backup?.file;
    if(result?.ok!==true||typeof file!=='string'||path.dirname(path.resolve(file))!==path.resolve(directory)||!/^cristalwater-db-.*\.sql$/.test(path.basename(file)))throw Object.assign(Error(),{backupCode:'INVALID_OUTPUT'});
    const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||!stat.size)throw Object.assign(Error(),{backupCode:'INVALID_OUTPUT'});
    const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);
    const after=fs.lstatSync(file);if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||after.ino!==stat.ino)throw Object.assign(Error(),{backupCode:'INVALID_OUTPUT'});
    Object.assign(attempt,{state:'SUCCESS',completedAt:now().toISOString(),backup:{name:path.basename(file),sizeBytes:stat.size,sha256:hash.digest('hex')}});
    writeStatus(directory,attempt);return {ok:true,...attempt,scope:'LOCAL_DATABASE_ONLY',uploadsIncluded:false,offsiteVerified:false,restoreVerified:false};
  }catch(error){
    Object.assign(attempt,{state:'FAILED',completedAt:now().toISOString(),code:error.backupCode||'CREATE_FAILED',backup:null});
    writeStatus(directory,attempt);return {ok:false,...attempt};
  }finally{fs.rmdirSync(lock);}
}
module.exports={run,readStatus,statusName,lockName};
