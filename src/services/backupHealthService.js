const fs=require('node:fs'),path=require('node:path');
function inspectBackups({directory=path.resolve(process.env.BACKUP_DIRECTORY||path.join(__dirname,'../../backups')),now=new Date(),maxAgeHours=Number(process.env.BACKUP_MAX_AGE_HOURS||48)}={}){
 const base={scope:'LOCAL_DATABASE_FILES',restoreVerified:false,offsiteVerified:false,uploadsIncluded:false,maxAgeHours};
 if(!Number.isFinite(now.getTime())||!Number.isFinite(maxAgeHours)||maxAgeHours<1||maxAgeHours>720)return{...base,ok:false,state:'CONFIG_ERROR',latest:null};
 try{
  if(!fs.existsSync(directory))return{...base,ok:false,state:'MISSING',latest:null};
  const scheduled=require('./scheduledBackupService').readStatus(directory);
  if(scheduled){
    const age=(now.getTime()-Date.parse(scheduled.completedAt||scheduled.startedAt))/3600000;
    const failed=scheduled.state==='UNREADABLE'?'SCHEDULE_UNREADABLE':age< -5/60?'FUTURE_TIMESTAMP':scheduled.state==='FAILED'?'SCHEDULE_FAILED':scheduled.state==='RUNNING'?(age>0.25?'SCHEDULE_INTERRUPTED':'SCHEDULE_RUNNING'):null;
    if(failed)return{...base,ok:false,state:failed,latest:null,scheduled};
  }
  const files=fs.readdirSync(directory).filter(name=>/^cristalwater-db-.*\.(sql|json)$/i.test(name)).flatMap(name=>{
   const stat=fs.lstatSync(path.join(directory,name));if(!stat.isFile()||stat.isSymbolicLink())return[];
   return[{name,sizeBytes:stat.size,updatedAt:stat.mtime.toISOString(),type:path.extname(name).slice(1).toLowerCase()}];
  }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const latest=files[0];if(!latest)return{...base,ok:false,state:'MISSING',latest:null};
  const ageHours=(now.getTime()-new Date(latest.updatedAt).getTime())/3600000;
  const state=!latest.sizeBytes?'EMPTY':ageHours< -5/60?'FUTURE_TIMESTAMP':ageHours>maxAgeHours?'STALE':latest.type==='json'?'JSON_FALLBACK':'RECENT_LOCAL_SQL';
  return{...base,ok:state==='RECENT_LOCAL_SQL',state,latest:{...latest,ageHours:Math.round(ageHours*100)/100},...(scheduled?{scheduled}:{})};
 }catch{return{...base,ok:false,state:'UNREADABLE',latest:null};}
}
module.exports={inspectBackups};
