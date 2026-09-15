import {describe,it,expect,vi} from 'vitest';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
function fixture({dump='ok',missing=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cw-backup-test-')),calls=[];
 const tx={alpha:{findMany:async()=>[{id:1,total:4n}]},beta:{findMany:async()=>[{id:2,alphaId:1}]}};
 if(missing)delete tx.beta;
 const transaction=vi.fn(async fn=>fn(tx));let release;
 const execute=(command,args,options,callback)=>{
  calls.push({command,args,options});
  const finish=()=>{
   const output=args[args.indexOf('--file')+1];
   if(dump==='fail'){fs.writeFileSync(output,'incomplete');return callback(new Error('Provider failed'));}
   if(dump!=='empty')fs.writeFileSync(output,'-- Complete SQL fixture\n');
   callback(null,'','');
  };
  if(dump==='held')release=finish;else queueMicrotask(finish);
 };
 const context={module:{exports:{}},__dirname:path.join(root,'src/services'),process:{env:{DATABASE_URL:'postgresql://qa:private-password@localhost/qa?schema=public',PG_DUMP_PATH:'fixture-pg-dump'}},require:name=>{
  if(name==='child_process')return {execFile:execute};
  if(name==='@prisma/client')return {Prisma:{dmmf:{datamodel:{models:[{name:'Alpha'},{name:'Beta'}]}}},PrismaClient:function(){return {$transaction:transaction,$disconnect:async()=>{}};}};
  return require(name);
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/services/databaseBackupService'),'utf8'),context);
 return {api:context.module.exports,calls,transaction,finish:()=>release(),cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
describe('database backup completion and availability',()=>{
 it('publishes complete SQL with credentials outside command arguments',async()=>{
  const f=fixture();try{
   const result=await f.api.createDatabaseBackup();expect(result.fallback).toBe(false);expect(result.backup.sizeBytes).toBeGreaterThan(0);
   expect(f.calls[0].args.join(' ')).not.toContain('private-password');expect(f.calls[0].options.env.PGDATABASE).not.toContain('schema=');expect(f.calls[0].options.timeout).toBe(120000);
   expect(fs.statSync(result.backup.file).mode&0o777).toBe(0o600);expect(f.api.listBackups()).toHaveLength(1);
  }finally{f.cleanup();}
 });
 it('keeps the event loop available and partial copies invisible while dumping',async()=>{
  const f=fixture({dump:'held'});try{
   const pending=f.api.createDatabaseBackup();await new Promise(r=>setImmediate(r));expect(f.api.listBackups()).toHaveLength(0);
   f.finish();expect((await pending).fallback).toBe(false);
  }finally{f.cleanup();}
 });
 it.each(['fail','empty'])('removes %s SQL output and exports one consistent JSON snapshot',async dump=>{
  const f=fixture({dump});try{
   const result=await f.api.createDatabaseBackup();expect(result.fallback).toBe(true);expect(f.api.listBackups()).toHaveLength(1);
   expect(fs.readdirSync(f.api.backupDir).some(name=>name.endsWith('.partial')||name.endsWith('.sql'))).toBe(false);
   expect(f.transaction.mock.calls[0][1]).toEqual({isolationLevel:'RepeatableRead',timeout:120000});
   const content=JSON.parse(fs.readFileSync(result.backup.file));expect(content.data.Alpha[0].total).toBe('4');expect(content.data.Beta[0].alphaId).toBe(1);
  }finally{f.cleanup();}
 });
 it('does not announce an incomplete export when a model is unavailable',async()=>{
  const f=fixture({dump:'fail',missing:true});try{await expect(f.api.createDatabaseBackup()).rejects.toThrow('Modelo indisponível');expect(f.api.listBackups()).toHaveLength(0);}finally{f.cleanup();}
 });
 it('gives simultaneous backups distinct files',async()=>{
  const f=fixture();try{const results=await Promise.all([f.api.createDatabaseBackup(),f.api.createDatabaseBackup()]);expect(results[0].backup.name).not.toBe(results[1].backup.name);expect(f.api.listBackups()).toHaveLength(2);}finally{f.cleanup();}
 });
});
