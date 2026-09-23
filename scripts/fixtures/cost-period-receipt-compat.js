'use strict';
// A durable pending command may receive its pre-migration receipt after upgrade.
module.exports=async function(result,envelope,owner){
  const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{hash}=require('../../src/services/expenseLedgerRules');
  const scope={window:{},document:{querySelectorAll:()=>[]}};vm.createContext(scope);
  for(const name of ['cw-expense-maintenance.js','cw-expense-cost-period.js'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../frontend',name),'utf8'),scope);
  const ui=scope.window.CWExpenseCostPeriod.create({el:()=>({addEventListener(){}}),hash});
  await ui.verify(result,{envelope,owner});
  const old=JSON.parse(JSON.stringify(result)),e=JSON.parse(JSON.stringify(envelope));
  for(const row of [old.allocation,old.allocationBefore,old.allocationVoided,old.preview.allocationBefore])for(const key of ['maintenanceCompletionId','serviceReminderId'])delete row[key];
  old.preview.beforeHash=hash(old.preview.allocationBefore);const {available,hash:signature,...value}=old.preview;old.preview.hash=hash(value);e.data.previewHash=old.preview.hash;
  await ui.verify(old,{envelope:e,owner});
  const altered=structuredClone(old);altered.allocation.maintenanceCompletionId=1;
  await assert.rejects(()=>ui.verify(altered,{envelope:e,owner}),/não foi confirmado/);
};
