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
