import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {inspectBackups}=require('../src/services/backupHealthService');
it('detects missing, empty, stale, fallback and future backups without claiming restoration',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cw-backup-health-')),now=new Date('2030-01-15T12:00:00Z');
 const inspect=()=>inspectBackups({directory,now,maxAgeHours:48});
 const write=(name,text,age)=>{const p=path.join(directory,name);fs.writeFileSync(p,text);const date=new Date(now.getTime()-age*3600000);fs.utimesSync(p,date,date);return p;};
 try{
  expect(inspect().state).toBe('MISSING');write('unrelated.json','{}',0);write('cristalwater-db-incomplete.sql.partial','SQL',0);expect(inspect().state).toBe('MISSING');
  const sql=write('cristalwater-db-test.sql','',0);expect(inspect().state).toBe('EMPTY');
  write('cristalwater-db-test.sql','SQL',49);expect(inspect().state).toBe('STALE');
  write('cristalwater-db-test.sql','SQL',2);const fresh=inspect();expect(fresh.state).toBe('RECENT_LOCAL_SQL');expect(fresh.restoreVerified).toBe(false);expect(fresh.offsiteVerified).toBe(false);expect(fresh.uploadsIncluded).toBe(false);
  write('cristalwater-db-fallback.json','{}',1);expect(inspect().state).toBe('JSON_FALLBACK');
  write('cristalwater-db-test.sql','SQL',-1);expect(inspect().state).toBe('FUTURE_TIMESTAMP');
  expect(inspectBackups({directory,now,maxAgeHours:0}).state).toBe('CONFIG_ERROR');
  fs.unlinkSync(sql);fs.unlinkSync(path.join(directory,'cristalwater-db-fallback.json'));fs.symlinkSync(path.join(directory,'unrelated.json'),sql);expect(inspect().state).toBe('MISSING');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

it('records a completed SQL attempt with restrictive permissions and never claims offsite or restore coverage',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cw-scheduled-')),scheduled=require('../src/services/scheduledBackupService'),now=new Date('2030-01-15T12:00:00Z');
 try{
  const file=path.join(directory,'cristalwater-db-test.sql');
  const result=await scheduled.run({directory,now:()=>now,createBackup:async()=>{expect(scheduled.readStatus(directory).state).toBe('RUNNING');fs.writeFileSync(file,'SQL BACKUP',{mode:0o600});fs.utimesSync(file,now,now);return{ok:true,fallback:false,backup:{file}};}});
  expect(result.ok).toBe(true);expect(result.backup.sha256).toMatch(/^[a-f0-9]{64}$/);expect(result.uploadsIncluded).toBe(false);expect(result.offsiteVerified).toBe(false);expect(result.restoreVerified).toBe(false);
  expect(fs.statSync(path.join(directory,scheduled.statusName)).mode&0o777).toBe(0o600);expect(fs.existsSync(path.join(directory,scheduled.lockName))).toBe(false);
  expect(inspectBackups({directory,now}).state).toBe('RECENT_LOCAL_SQL');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

it('keeps a failed attempt visible despite a recent SQL and does not record raw errors or database credentials',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cw-scheduled-failure-')),scheduled=require('../src/services/scheduledBackupService'),now=new Date('2030-01-15T12:00:00Z');
 try{
  const file=path.join(directory,'cristalwater-db-old.sql');fs.writeFileSync(file,'previous SQL');fs.utimesSync(file,now,now);
  const result=await scheduled.run({directory,now:()=>now,createBackup:async()=>{throw Error('postgresql://private:secret@server/db');}});
  expect(result.ok).toBe(false);expect(result.code).toBe('CREATE_FAILED');expect(inspectBackups({directory,now}).state).toBe('SCHEDULE_FAILED');
  expect(fs.readFileSync(path.join(directory,scheduled.statusName),'utf8')).not.toMatch(/private|secret|server/);expect(fs.readFileSync(file,'utf8')).toBe('previous SQL');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

it('refuses fallback, missing, empty, symlink and foreign outputs without deleting rescue data',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cw-scheduled-invalid-')),scheduled=require('../src/services/scheduledBackupService');
 try{
  const json=path.join(directory,'cristalwater-db-rescue.json');fs.writeFileSync(json,'{}');
  const empty=path.join(directory,'cristalwater-db-empty.sql');fs.writeFileSync(empty,'');const link=path.join(directory,'cristalwater-db-link.sql');fs.symlinkSync(json,link);
  for(const output of [{ok:true,fallback:true,backup:{file:json}},...['missing.sql',empty,link,path.join(directory,'../foreign.sql')].map(file=>({ok:true,fallback:false,backup:{file}}))]){
   const result=await scheduled.run({directory,createBackup:async()=>output});expect(result.ok).toBe(false);expect(fs.existsSync(path.join(directory,scheduled.lockName))).toBe(false);
  }
  expect(fs.readFileSync(json,'utf8')).toBe('{}');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

it('prevents simultaneous attempts and identifies interrupted or unreadable scheduling records',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cw-scheduled-lock-')),scheduled=require('../src/services/scheduledBackupService'),now=new Date('2030-01-15T12:00:00Z');
 let release;const gate=new Promise(resolve=>{release=resolve;});
 try{
  const first=scheduled.run({directory,now:()=>now,createBackup:async()=>{await gate;throw Error('QA');}});
  const second=await scheduled.run({directory,createBackup:async()=>{throw Error('Must never run');}});expect(second.code).toBe('BUSY');expect(scheduled.readStatus(directory).state).toBe('RUNNING');
  expect(inspectBackups({directory,now}).state).toBe('SCHEDULE_RUNNING');expect(inspectBackups({directory,now:new Date(+now+2*3600000)}).state).toBe('SCHEDULE_INTERRUPTED');release();await first;
  fs.writeFileSync(path.join(directory,scheduled.statusName),'invalid');expect(inspectBackups({directory,now}).state).toBe('SCHEDULE_UNREADABLE');
 }finally{release();fs.rmSync(directory,{recursive:true,force:true});}
});
