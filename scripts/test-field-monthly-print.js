'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), {fork} = require('node:child_process');
const {chromium} = require('playwright'), {prisma} = require('../src/prismaClient'), {getJwtSecret} = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
let browser, child;
(async () => {
  const stamp = Date.now(), monthRef = '2094-06', start = new Date(monthRef + '-01T00:00:00Z'), end = new Date('2094-07-01T00:00:00Z');
  const admin = await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}});
  const token = jwt.sign({id:admin.id,userId:admin.id,role:'ADMIN',principalType:'USER'},getJwtSecret(),{expiresIn:'1h'});
  const clients = await Promise.all(['A','B','C','D','E','F'].map((name,index) => prisma.client.create({data:{name:'QA_MONTHLY_'+name+'_'+stamp,requiresInvoice:index===1||index===5}})));
  const a = await prisma.invoice.create({data:{clientId:clients[0].id,monthRef,status:'PARTIAL',total:100,amountPaid:67,amountOpen:33,requiresInvoice:true,invoiceNumber:'QA_NUMBER_<img src=x onerror="window.injected=1">_'+stamp}});
  const legacy = await prisma.invoice.create({data:{clientId:clients[0].id,monthRef:null,month:'6',year:2094,status:'ISSUED',total:50,amountOpen:50,requiresInvoice:true}});
  const legacyFull = await prisma.invoice.create({data:{clientId:clients[0].id,monthRef:null,month:monthRef,year:1970,status:'PENDING',total:20,amountOpen:20,requiresInvoice:true}});
  const draft = await prisma.invoice.create({data:{clientId:clients[1].id,monthRef,status:'DRAFT',total:900,amountOpen:900,requiresInvoice:false}});
  const alias = await prisma.invoice.create({data:{clientId:clients[2].id,monthRef,status:'ISSUED',amount:25,amountOpen:25,requiresInvoice:true}});
  const canceled = await prisma.invoice.create({data:{clientId:clients[3].id,monthRef,status:'CANCELLED',total:400,amountPaid:10,amountOpen:390,requiresInvoice:true}});
  const deposit = await prisma.invoice.create({data:{clientId:clients[4].id,monthRef:null,month:'06',year:2094,status:'PAID',amountPaid:20,requiresInvoice:true,lines:{create:{lineType:' credit_deposit ',description:'QA deposit',total:0,lineTotal:0}}}});
  const previous = await prisma.invoice.create({data:{clientId:clients[5].id,monthRef:'2094-05',month:monthRef,status:'PARTIAL',total:90,amountPaid:40,amountOpen:50,requiresInvoice:false}});
  const inputs = [
    {invoiceId:a.id,amount:20,method:'CASH',paidAt:start},
    {invoiceId:a.id,amount:0,method:'MANUAL',paidAt:new Date(start.getTime()+1000)},
    {invoiceId:deposit.id,amount:20,method:'BANK_TRANSFER',paidAt:new Date(start.getTime()+2000)},
    {invoiceId:canceled.id,amount:10,method:'CASH',paidAt:new Date(start.getTime()+3000)},
    {invoiceId:previous.id,amount:40,method:'BANK_TRANSFER',paidAt:new Date(end-1)},
    {invoiceId:a.id,amount:30,method:'CASH',paidAt:new Date(start-1)},
    {invoiceId:a.id,amount:7,method:'CASH',paidAt:end},
    ...[' credit ','CREDIT_NOTE','ADJUSTMENT','credit_adjustment'].map(method=>({invoiceId:a.id,amount:2.5,method,paidAt:start}))
  ];
  const payments=[]; for (const data of inputs) payments.push(await prisma.payment.create({data}));
  browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage(); const network=[],errors=[];
  await page.route('**/*',route=>{network.push(route.request().url());return route.abort();});page.on('pageerror',error=>errors.push(error.message));
  const snapshot=()=>Promise.all(['invoice','payment','clientReportSetting','monthlyReport','userAuditLog'].map(model=>prisma[model].count()));
  async function call(filter=false, origin=base, month=monthRef, lang) {
    const before=await snapshot();
    const response=await fetch(origin+'/api/reports/monthly-print?'+new URLSearchParams({monthRef:month,onlyRequiresInvoice:String(filter),...(lang===undefined?{}:{lang})}),{headers:{Authorization:'Bearer '+token}});
    const body=await response.text();assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.deepEqual(await snapshot(),before,'Report reads must not create records');
    if(response.status===200){assert.equal(response.headers.get('content-language'),lang||'pt');assert.equal(response.headers.get('x-cw-report-version'),'2');assert.equal(response.headers.get('x-cw-month-ref'),month);assert.equal(response.headers.get('x-cw-invoice-filter'),String(filter));await page.setContent(body);assert.equal(await page.locator('script,img,b').count(),0);}
    return {response,body};
  }
  const metric=async id=>(await page.locator('#metric-'+id).textContent()).replace(/\s+/g,' ').trim();
  const ids=selector=>page.locator(selector).evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.documentId||node.dataset.paymentId)));
  async function normal() {
    const r=await call();assert.equal(r.response.status,200);
    assert.equal(await metric('client-count'),'5');assert.equal(await metric('document-count'),'7');assert.equal(await metric('document-amount'),'195,00 €');assert.equal(await metric('current-open'),'128,00 €');assert.equal(await metric('cash-amount'),'90,00 €');assert.equal(await metric('payment-count'),'5');
    assert.deepEqual(await ids('[data-document-id]'),[a.id,legacy.id,legacyFull.id,draft.id,alias.id,canceled.id,deposit.id]);
    assert.deepEqual(await ids('[data-payment-id]'),payments.slice(0,5).map(row=>row.id));
    assert.equal(await page.locator(`[data-document-id="${draft.id}"]`).getAttribute('data-classification'),'EXCLUDED');
    assert.equal(await page.locator(`[data-document-id="${canceled.id}"] [data-field="status"]`).textContent(),'CANCELLED');
    assert.equal(await page.locator(`[data-document-id="${deposit.id}"]`).getAttribute('data-classification'),'EXCLUDED');
    assert.equal((await page.locator(`[data-document-id="${alias.id}"] [data-field="amount"]`).textContent()).replace(/\s+/g,' '),'25,00 €');
    assert((await page.locator('body').textContent()).includes('QA_NUMBER_<img src=x onerror="window.injected=1">_'+stamp));
    const api=await (await fetch(base+'/api/admin/reports/summary?monthRef='+monthRef+'&section=financial',{headers:{Authorization:'Bearer '+token}})).json();
    assert.deepEqual(api.data.documents,{total:7,receivableCount:4,excludedCount:3,unknownStatusCount:0,invalidAmountCount:0,amountCents:19500,openAmountCents:12800});
    assert.deepEqual(api.data.cash,{amountCents:9000,paymentCount:5,invalidAmountCount:0});
  }
  await normal();
  const languages = {
    pt: {title:'Relatório mensal',review:'Por rever',amount:'195,00 €',open:'128,00 €',cash:'90,00 €',filtered:'50,00 €',warning:'Total de recebimentos por rever',document:'Totais documentais por rever'},
    en: {title:'Monthly report',review:'To be reviewed',amount:'€195.00',open:'€128.00',cash:'€90.00',filtered:'€50.00',warning:'Receipt total needs review',document:'Document totals need review'},
    fr: {title:'Rapport mensuel',review:'À vérifier',amount:'195,00 €',open:'128,00 €',cash:'90,00 €',filtered:'50,00 €',warning:'Total des encaissements à vérifier',document:'Totaux des documents à vérifier'},
    es: {title:'Informe mensual',review:'Por revisar',amount:'195,00 €',open:'128,00 €',cash:'90,00 €',filtered:'50,00 €',warning:'Total de cobros por revisar',document:'Totales de documentos por revisar'},
  };
  const evidence=require('node:path').join(process.cwd(),'reports/field-visual/monthly-language-'+stamp);require('node:fs').mkdirSync(evidence,{recursive:true});
  const originalNote='Saldo atual <script>window.injected=1</script> & "Por rever"';
  await prisma.client.update({where:{id:clients[0].id},data:{name:'Por rever'}});
  await prisma.payment.update({where:{id:payments[0].id},data:{notes:originalNote+' '+('Nota original sobre o recebimento. '.repeat(80))+' NOTE_END'}});
  const records=()=>Promise.all([prisma.invoice.findMany({where:{clientId:{in:clients.map(c=>c.id)}},orderBy:{id:'asc'}}),prisma.payment.findMany({where:{invoiceId:{in:[a,legacy,legacyFull,draft,alias,canceled,deposit,previous].map(d=>d.id)}},orderBy:{id:'asc'}})]);
  for(const [lang, expected] of Object.entries(languages)){
    for(const filter of [false,true]){
      const beforeRead=await records();
      const translated=await call(filter,base,monthRef,lang);assert.deepEqual(await records(),beforeRead);assert.equal(translated.response.status,200);assert.equal(translated.response.headers.get('content-language'),lang);assert.equal(await page.locator('html').getAttribute('lang'),lang);
      assert.equal(await page.locator('h1').textContent(),expected.title+' - '+monthRef);
      assert.equal(await metric('document-amount'),expected.amount);assert.equal(await metric('current-open'),expected.open);assert.equal(await metric('cash-amount'),filter?expected.filtered:expected.cash);
      assert.equal(await metric('client-count'),filter?'4':'5');assert.equal(await metric('document-count'),filter?'6':'7');assert.equal(await metric('payment-count'),filter?'4':'5');
      assert.deepEqual(await ids('[data-payment-id]'),payments.slice(0,filter?4:5).map(row=>row.id));
      assert.equal(await page.locator(`[data-document-id="${a.id}"] h2`).textContent(),'Por rever');
      assert.equal(await page.locator(`[data-document-id="${canceled.id}"] [data-field="status"]`).textContent(),'CANCELLED');
      assert((await page.locator('.notes').first().textContent()).includes(originalNote));assert.equal(await page.evaluate(()=>window.injected),undefined);
      assert((await page.locator('.basis').textContent()).includes(start.toISOString()));assert((await page.locator('.basis').textContent()).includes(end.toISOString()));
      if(!filter){await page.emulateMedia({media:'print'});await page.pdf({path:require('node:path').join(evidence,lang+'.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});await page.emulateMedia({media:'screen'});}
    }
    // Neither an invalid document nor invalid cash may turn into a partial confirmed total in another language.
    await prisma.invoice.update({where:{id:a.id},data:{totalAmount:101}});
    const bad=await prisma.payment.create({data:{invoiceId:a.id,amount:-1,method:'CASH',paidAt:start}});
    await call(false,base,monthRef,lang);assert.equal(await metric('document-amount'),expected.review);assert.equal(await metric('current-open'),expected.review);assert.equal(await metric('cash-amount'),expected.review);
    assert((await page.locator('#document-review').textContent()).startsWith(expected.document));assert((await page.locator('#cash-review').textContent()).startsWith(expected.warning));
    if(lang==='fr'){await page.emulateMedia({media:'print'});await page.pdf({path:require('node:path').join(evidence,'fr-review.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});await page.emulateMedia({media:'screen'});}
    await prisma.invoice.update({where:{id:a.id},data:{totalAmount:a.totalAmount}});await prisma.payment.delete({where:{id:bad.id}});
    const empty=await call(false,base,'2198-11',lang);assert.equal(empty.response.status,200);assert.equal(await page.locator('#empty-documents,#empty-payments').count(),2);
    for(const auth of [null,jwt.sign({id:clients[0].id,clientId:clients[0].id,role:'CLIENT',principalType:'CLIENT'},getJwtSecret(),{expiresIn:'1h'})]){
      const denied=await fetch(base+'/api/reports/monthly-print?monthRef='+monthRef+'&lang='+lang,{headers:auth?{Authorization:'Bearer '+auth}:{}});assert([401,403].includes(denied.status));assert.equal(denied.headers.get('content-language'),null);
    }
  }

  for(const value of ['', 'EN','en-GB','de','__proto__','constructor','en&lang=fr','en&lang[x]=fr']){
    const invalid=await fetch(base+'/api/reports/monthly-print?monthRef='+monthRef+'&lang='+value,{headers:{Authorization:'Bearer '+token}});assert.equal(invalid.status,400,value);assert.equal(invalid.headers.get('content-language'),null);
  }
  await prisma.client.update({where:{id:clients[0].id},data:{name:clients[0].name}});await prisma.payment.update({where:{id:payments[0].id},data:{notes:null}});
  console.log('PASS monthly PT/EN/FR/ES preserve exact amounts, populations, filters, warnings, UTC boundaries, literal notes, no writes, role restrictions and strict language validation');
  console.log('MONTHLY_LANGUAGE_EVIDENCE '+evidence);
  await call(true);assert.equal(await metric('client-count'),'4');assert.equal(await metric('document-count'),'6');assert.equal(await metric('document-amount'),'195,00 €');assert.equal(await metric('current-open'),'128,00 €');assert.equal(await metric('cash-amount'),'50,00 €');assert.equal(await metric('payment-count'),'4');
  assert.deepEqual(await ids('[data-payment-id]'),payments.slice(0,4).map(row=>row.id));assert(!(await ids('[data-document-id]')).includes(draft.id));
  await prisma.invoice.update({where:{id:a.id},data:{totalAmount:101}});await call();assert.equal(await metric('document-amount'),'Por rever');assert.equal(await metric('current-open'),'Por rever');assert.equal(await metric('cash-amount'),'90,00 €');assert.equal(await page.locator('#document-review').count(),1);
  await prisma.invoice.update({where:{id:a.id},data:{totalAmount:100,status:'UNKNOWN_<img src=x>'}});await call();assert.equal(await metric('document-amount'),'Por rever');assert.equal(await page.locator(`[data-document-id="${a.id}"] [data-field="status"]`).textContent(),'UNKNOWN_<img src=x>');
  await prisma.invoice.update({where:{id:a.id},data:{status:'PARTIAL',amountOpen:-1}});await call();assert.equal(await metric('current-open'),'Por rever');
  await prisma.invoice.update({where:{id:a.id},data:{amountOpen:33}});
  for(const amount of [-1,0.001]){const bad=await prisma.payment.create({data:{invoiceId:a.id,amount,method:'CASH',paidAt:start}});await call();assert.equal(await metric('cash-amount'),'Por rever');assert.equal(await metric('document-amount'),'195,00 €');assert.equal(await page.locator('#cash-review').count(),1);await prisma.payment.delete({where:{id:bad.id}});}
  await prisma.payment.createMany({data:[1,2].map(()=>({invoiceId:a.id,amount:90000000000000,method:'CASH',paidAt:start}))});await call();assert.equal(await metric('cash-amount'),'Por rever');await prisma.payment.deleteMany({where:{invoiceId:a.id,amount:90000000000000}});
  const huge=[];for(let i=0;i<2;i++)huge.push(await prisma.invoice.create({data:{clientId:clients[0].id,monthRef:null,month:monthRef,status:'ISSUED',total:90000000000000,amountOpen:90000000000000}}));
  await call();assert.equal(await metric('document-amount'),'Por rever');assert.equal(await metric('current-open'),'Por rever');assert.equal(await metric('cash-amount'),'90,00 €');await prisma.invoice.deleteMany({where:{id:{in:huge.map(row=>row.id)}}});
  await normal();
  await call(false,base,'2198-11');for(const key of ['client-count','document-count','payment-count'])assert.equal(await metric(key),'0');for(const key of ['document-amount','current-open','cash-amount'])assert.equal(await metric(key),'0,00 €');assert.equal(await page.locator('#empty-documents,#empty-payments').count(),2);
  child=fork(require.resolve('./fixtures/admin-report-server'),[],{stdio:['ignore','ignore','ignore','ipc']});
  const origin=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('QA child timeout')),15000);child.once('error',reject);child.once('message',({port})=>{clearTimeout(timer);resolve('http://127.0.0.1:'+port);});});
  const fault=model=>new Promise(resolve=>{child.once('message',resolve);child.send({fault:model});});
  for(const model of ['invoice','payment']){await fault(model);const failed=await call(false,origin);assert.equal(failed.response.status,503);assert.match(failed.response.headers.get('content-type'),/^application\/json/);assert.equal(failed.response.headers.get('x-cw-report-version'),null);assert.doesNotMatch(failed.body,/QA_|metric-|195|90,00/);await fault(null);assert.equal((await call(false,origin)).response.status,200);}
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  console.log('PASS monthly print sources: distinct clients/documents, canonical and legacy month precedence, cash on exact UTC boundaries independent of document month/status, prepaid cash and internal credit, invoice-level filters, aliases, canceled/draft/deposit exclusions, unknown/negative/fractional/overflow amounts, empty month, shared API totals, escaped identities, read-only snapshots and real read-fault recovery');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{child?.kill('SIGTERM');await browser?.close();await prisma.$disconnect();});
