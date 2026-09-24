'use strict';
require('../src/loadEnv')();
async function main(){
  if(process.env.SCHEDULED_BACKUP_ENABLED!=='true'){console.error(JSON.stringify({ok:false,code:'NOT_ENABLED'}));process.exitCode=2;return;}
  const backup=require('../src/services/databaseBackupService');
  try{const result=await require('../src/services/scheduledBackupService').run({directory:backup.backupDir,createBackup:backup.createDatabaseBackup});console.log(JSON.stringify(result));process.exitCode=result.ok?0:1;}
  finally{await backup.disconnectDatabaseBackupService();}
}
if(require.main===module)main().catch(()=>{console.error(JSON.stringify({ok:false,code:'SCHEDULED_BACKUP_FAILED'}));process.exitCode=1;});
module.exports={main};
