// Read-only probe for a future local scheduler/monitor. Does not create or delete backups.
require('../src/loadEnv')();
const {inspectBackups}=require('../src/services/backupHealthService');
const report=inspectBackups();console.log(JSON.stringify(report,null,2));process.exitCode=report.ok?0:1;
