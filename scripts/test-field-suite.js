// Integration runner for an explicitly isolated database with the schema already installed.
require('../src/loadEnv')();
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const {randomBytes}=require('crypto');
const {prisma}=require('../src/prismaClient');
const bcrypt=require('bcryptjs');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw new Error('Isolated test/QA environment required');
const root=path.resolve(__dirname,'..');
const evidence=path.join(root,'reports','field-suite',String(Date.now()));fs.mkdirSync(evidence,{recursive:true});
process.env.PORT=process.env.PORT||'3002';
process.env.CW_BASE_URL=`http://127.0.0.1:${process.env.PORT}`;
process.env.FCS_SEC_BASE_URL=process.env.CW_BASE_URL;
process.env.ADMIN_EMAIL=process.env.ADMIN_EMAIL||'field-admin@qa.test';
process.env.ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||randomBytes(24).toString('base64url');
process.env.JWT_SECRET=process.env.JWT_SECRET||randomBytes(48).toString('base64url');
process.env.ENABLE_BACKGROUND_JOBS='false';
const scripts=[
 'test-field-visual-flow.js','test-field-reminder-delete.js','test-field-crm-reminders.js','test-field-language-reload.js',
 'test-field-water-api.js','test-field-access-api.js','test-field-e2e.js',
 'test-fcs-sec-tech-auth.js','test-fcs-sec-tech-workday.js','test-fcs-technician-t1.js',
 'test-visit-os-operational.js','test-route-os-acceptance.js','test-customer-os-operational.js',
 'test-administration-os-operational.js','test-finance-os-operational.js','test-equipment-stock-os-operational.js',
 'test-repair-os-operational.js','test-system-interconnections.js','test-real-month-flow-api.js','test-field-preflight.js','test-field-backup.js','test-production-runtime-health.js','test-field-gps-flow.js','test-field-two-year-api.js','test-field-billing-automation.js','test-field-commercial-quotes.js','test-field-client-rates.js','test-field-retention.js','test-field-quote-portal.js','test-field-resilience.js','test-field-equipment-maintenance.js','test-field-equipment-flow.js','test-field-equipment-reminders.js','test-field-chemical-options.js','test-field-inventory-count-flow.js','test-field-visit-briefing.js','test-field-service-reminders.js','test-field-reminder-lifecycle.js','test-field-alert-visibility.js','test-field-alert-resolution.js','test-field-alert-billing.js','test-field-draft-payments.js','test-field-draft-visibility.js','test-invoice-draft-classification-browser.js','test-field-payment-retry.js','test-field-payment-retry-ui.js','test-field-client-receipts.js','test-field-client-receipts-ui.js','test-field-credit-allocation.js','test-field-monthly-credit.js'
];
scripts.push('test-field-surplus-ledger.js');
scripts.push('test-field-credit-adjustment.js');
scripts.push('test-field-monthly-rates.js');
scripts.push('test-field-invoice-regeneration.js');
scripts.push('test-field-invoice-page-generation.js');
scripts.push('test-field-repair-monthly-once.js');
scripts.push('test-field-repair-invoice-atomic.js');
scripts.push('test-field-contract-activation.js');
scripts.push('test-field-contract-activation-ui.js');
scripts.push('test-field-invoice-cancellation.js');
scripts.push('test-field-invoice-credit-note.js');
scripts.push('test-field-repair-payment.js');
scripts.push('test-field-cash-reports.js');
scripts.push('test-field-invoice-issue.js');
scripts.push('test-field-invoice-delivery.js');
scripts.push('test-field-invoice-pdf-access.js');
scripts.push('test-field-invoice-document.js');
scripts.push('test-field-legacy-alert-access.js');
scripts.push('test-field-invoice-chat.js');
scripts.push('test-field-chat-identity.js');
scripts.push('test-field-invoice-outbound.js');
scripts.push('test-field-cash-methods.js');
scripts.push('test-field-account-access.js');
scripts.push('test-field-legacy-admin-access.js');
scripts.push('test-field-resource-chat.js');
scripts.push('test-field-internal-profile-access.js');
scripts.push('test-field-route-privacy.js');
scripts.push('test-field-manual-invoice-reminder.js');
scripts.push('test-field-client-chat-privacy.js');
scripts.push('test-field-chat-attachments.js');
scripts.push('test-field-internal-chat-durability.js');
scripts.push('test-field-internal-chat-ui.js');
scripts.push('test-field-notification-confirmation.js');
scripts.push('test-field-client-chat-retry.js');
scripts.push('test-field-client-chat-recovery-ui.js');
scripts.push('test-field-client-chat-consolidation.js');
scripts.push('test-field-client-chat-history-ui.js');
scripts.push('test-field-client-portal-requests.js');
scripts.push('test-field-client-portal-requests-ui.js');
scripts.push('test-field-client-edit-preservation.js');
scripts.push('test-field-pool-edit-atomicity.js');
scripts.push('test-field-client-edit-recovery.js');
scripts.push('test-field-client-edit-recovery-ui.js');
scripts.push('test-field-pool-edit-recovery.js');
scripts.push('test-field-pool-edit-recovery-ui.js');
scripts.push('test-field-technical-sheet-atomicity.js', 'test-field-technical-sheet-recovery.js', 'test-field-technical-sheet-recovery-ui.js');
scripts.push('test-field-technical-proposals.js');
scripts.push('test-field-proposal-recovery.js');
scripts.push('test-field-proposal-recovery-ui.js');
scripts.push('test-field-gps-recovery.js');
scripts.push('test-field-write-recovery.js');
scripts.push('test-field-write-recovery-ui.js');
scripts.push('test-field-internal-alert.js');
scripts.push('test-field-internal-alert-ui.js');
scripts.push('test-field-stock-requests.js','test-field-stock-requests-ui.js');
scripts.push('test-field-problem-reports.js','test-field-problem-reports-ui.js');
scripts.push('test-field-client-intake.js','test-field-client-intake-ui.js');
scripts.push('test-field-admin-monthly-reports.js','test-field-admin-monthly-reports-ui.js');
scripts.push('test-field-monthly-print-access.js');
scripts.push('test-field-monthly-print.js','test-field-monthly-print-ui.js');
scripts.push('test-field-report-settings.js','test-field-report-settings-ui.js');
scripts.push('test-field-visit-report.js','test-field-report-opening-ui.js');
scripts.push('test-field-route-preview.js');
scripts.push('test-field-route-preview-ui.js');
scripts.push('test-field-legacy-route-recovery.js');
scripts.push('test-field-legacy-visit-drafts.js');
scripts.push('test-field-modern-route-recovery.js');
scripts.push('test-field-workday-recovery.js');
scripts.push('test-field-visit-types.js');
scripts.push('test-field-extra-execution.js');
scripts.push('test-field-extra-reminders.js');
scripts.push('test-field-extra-correction.js');
scripts.push('test-field-extra-equipment.js');
scripts.push('test-field-extra-incomplete.js');
scripts.push('test-field-modern-visit-drafts.js');
scripts.push('test-field-team-leader-entry.js');
scripts.push('test-field-complete-daily-route.js');
scripts.push('test-field-document-recovery.js');
scripts.push('test-field-alert-source.js');
scripts.push('test-field-key-scope.js');
scripts.push('test-field-operational-pages.js');
scripts.push('test-field-admin-map-recovery.js');
scripts.push('test-field-geographic-areas.js');
scripts.push('test-field-multi-map.js');
scripts.push('test-field-operational-values.js');
scripts.push('test-field-operational-values-ui.js');
scripts.push('test-field-planned-work.js');
scripts.push('test-field-client-services.js','test-field-client-services-ui.js');
scripts.push('test-field-alert-report-opening.js');
scripts.push('test-field-visit-report-photos.js');
scripts.push('test-field-extra-report.js');
scripts.push('test-field-maintenance-billing.js');
scripts.push('test-field-client-monthly-report-access.js');
scripts.push('test-field-client-monthly-generation.js');
scripts.push('test-field-client-monthly-reports-ui.js');
scripts.push('test-field-client-documents-access.js');
scripts.push('test-field-client-documents-ui.js');
scripts.push('test-field-external-invoice-registration.js');
scripts.push('test-field-external-reference-review.js');
scripts.push('test-field-external-invoice-summary.js');
scripts.push('test-field-monthly-email-period.js');
scripts.push('test-field-monthly-email-delivery.js','test-field-monthly-email-ui.js');
scripts.push('test-field-financial-ai.js','test-field-financial-ai-ui.js');
scripts.push('test-field-company-expenses.js','test-field-company-expenses-ui.js');
scripts.push('test-field-expense-costs.js','test-field-expense-costs-ui.js');
scripts.push('test-field-expense-valuations.js','test-field-expense-valuations-ui.js');
scripts.push('test-field-financial-cost-coverage.js');
scripts.push('test-field-financial-revenue-coverage.js');
scripts.push('test-field-monthly-revenue.js','test-field-monthly-revenue-ui.js');
scripts.push('test-field-maintenance-revenue.js');
scripts.push('test-field-repair-revenue.js');
scripts.push('test-field-repair-execution.js','test-field-repair-execution-revenue.js');
scripts.push('test-field-repair-execution-command.js','test-field-repair-execution-ui.js');
function run(script){return new Promise(resolve=>{
 const output=fs.createWriteStream(path.join(evidence,script+'.log'));
 const child=spawn(process.execPath,[path.join(__dirname,script)],{cwd:root,env:process.env,stdio:['ignore','pipe','pipe']});
 child.stdout.pipe(output);child.stderr.pipe(output);
 const start=Date.now(),timer=setTimeout(()=>child.kill('SIGKILL'),120000);
 child.once('error',error=>{clearTimeout(timer);output.end();resolve({script,code:1,error:error.message})});
 child.once('close',(code,signal)=>{clearTimeout(timer);output.end(()=>{const result={script,code,signal,ms:Date.now()-start};console.log(JSON.stringify(result));if(code!==0)console.error(fs.readFileSync(path.join(evidence,script+'.log'),'utf8').slice(-12000));resolve(result)})});
});}
(async()=>{
 await prisma.user.upsert({where:{email:process.env.ADMIN_EMAIL},create:{email:process.env.ADMIN_EMAIL,name:'Field QA Administrator',password:await bcrypt.hash(process.env.ADMIN_PASSWORD,10),role:'ADMIN',active:true,mustChangePassword:false},update:{password:await bcrypt.hash(process.env.ADMIN_PASSWORD,10),active:true,role:'ADMIN'}});
 await prisma.$disconnect();
 const output=fs.createWriteStream(path.join(evidence,'server.log'));
 const server=spawn(process.execPath,['--trace-uncaught',path.join(root,'src/server.js')],{cwd:root,env:process.env,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>fs.appendFileSync(path.join(evidence,'server-stdout.log'),data));
 server.stderr.on('data',data=>fs.appendFileSync(path.join(evidence,'server-stderr.log'),data));
 console.log('Evidence: '+evidence);
 server.once('exit',(code,signal)=>{const state={serverExit:code,signal}; console.log(JSON.stringify(state));fs.writeFileSync(path.join(evidence,'server-exit.json'),JSON.stringify(state))});
 try{
  let ready=false;
  for(let i=0;i<60;i++){
   if(server.exitCode!==null)break;
   try{const response=await fetch(process.env.CW_BASE_URL+'/api/core/health',{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break}}catch{}
   await new Promise(r=>setTimeout(r,250));
  }
  if(!ready)throw new Error('Backend failed to start; see reports/field-suite/server.log');
  const results=[];for(const script of scripts)results.push(await run(script));
  fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify({at:new Date().toISOString(),results},null,2));
  if(results.some(r=>r.code!==0))process.exitCode=1;
 }finally{
  server.kill('SIGTERM');
  if(server.exitCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>{server.kill('SIGKILL');resolve()},5000);server.once('exit',()=>{clearTimeout(timer);resolve()})});
  output.end();
 }
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>prisma.$disconnect());
