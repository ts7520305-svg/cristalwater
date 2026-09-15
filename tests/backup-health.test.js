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
