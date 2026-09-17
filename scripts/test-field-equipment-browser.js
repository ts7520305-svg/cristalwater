'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto'), { chromium } = require('playwright');
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])) : v;
const hash = v => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const context=await browser.newContext({viewport:{width:320,height:844}}), page=await context.newPage();page.setDefaultTimeout(7000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const html=fs.readFileSync(path.join(__dirname,'../frontend/technician-field-mode.html'),'utf8'),start=html.indexOf('    <section class="card field-panel field-panel-agora" id="fieldEquipmentMaintenance"');assert(start>=0);
  const section=html.slice(start,html.indexOf('</section>',start)+10);
  const token='qa.'+Buffer.from(JSON.stringify({id:12,role:'TECHNICIAN'})).toString('base64url')+'.qa';
  await context.addInitScript(token=>{if(!localStorage.getItem('token'))localStorage.setItem('token',token);window.CristalAuth={getToken:()=>localStorage.getItem('token'),isSessionExpired:()=>false};},token);
  let posts=[],mode='reject',unavailable=false,hold=false,release,writes=0;
  const receipts=new Map();
  const makePlan=(id,title)=>({id,poolId:3,component:'PUMP',title,instructions:'Rever ruído e anotar observações.',intervalUnit:'MONTHS',intervalCount:1,nextDue:'2001-01-01',active:true,version:1,lastCompletedAt:null,completedInVisit:false,canComplete:true});
  const plan=makePlan(7,'Inspeção <img src=x onerror=alert(1)>'),draftPlan=makePlan(9,'Rascunho entre janelas');
  const paused={...makePlan(8,'Pausado'),active:false,canComplete:false};
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/test')return route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{padding:10px;margin:0}#cwEquipmentSyncStatus{overflow-wrap:anywhere}</style>${section}<script src="/cw-field-write-store.js"></script><script src="/field-equipment-maintenance.js"></script>`});
   if(['/field-equipment-maintenance.js','/cw-field-write-store.js'].includes(url.pathname))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend',url.pathname),'utf8')});
   assert.equal(route.request().headers().authorization,'Bearer '+token);
   if(url.pathname.endsWith('/complete')){
    const body=route.request().postDataJSON();posts.push(body);assert.equal(body.confirmed,true);assert.equal(body.visitId,1);assert.equal(body.visitType,'REGULAR');assert.equal(body.poolId,3);
    if(mode==='unavailable')return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"Indisponível"}'});
    let result=receipts.get(body.requestId);
    if(!result){
      const {requestId,...payload}=body,context={planId:7,visitType:'REGULAR',visitId:1,poolId:3,expectedVersion:body.expectedVersion};
      result={ok:true,applied:mode!=='reject',context,receipt:{owner:'TECH:12',requestId,scope:'EQUIPMENT_MAINTENANCE',resourceId:7,payloadHash:hash({v:1,scope:'EQUIPMENT_MAINTENANCE',resourceId:7,payload}),confirmedAt:new Date().toISOString()}};
      if(mode==='reject')Object.assign(result,{code:'EQUIPMENT_STALE',message:'Versão alterada; reveja as instruções.'});
      else{writes++;plan.version++;plan.completedInVisit=true;plan.canComplete=false;plan.nextDue='2099-12-01';plan.lastCompletedAt=new Date().toISOString();Object.assign(result,{plan:JSON.parse(JSON.stringify(plan)),completedAt:plan.lastCompletedAt,completion:{id:55,planId:7,visitType:'REGULAR',visitId:1,poolId:3,version:body.expectedVersion,requestId,notes:body.notes,completedAt:plan.lastCompletedAt}});}
      receipts.set(body.requestId,result);
    }
    if(mode==='bare')return route.fulfill({contentType:'application/json',body:'{"ok":true}'});
    const response=JSON.parse(JSON.stringify(result));if(mode==='wrong')response.completion.visitType='EXTRA';
    return route.fulfill({status:mode==='accepted'?202:200,contentType:'application/json',body:JSON.stringify(response)});
   }
   if(hold && url.pathname.endsWith('/1') && url.searchParams.get('visitType')==='REGULAR')await new Promise(resolve=>{release=resolve;});
   if(unavailable)return route.abort('internetdisconnected');
   const visitId=Number(url.pathname.split('/').pop()),visitType=url.searchParams.get('visitType');
   return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,visitId,visitType,poolId:3,plans:visitId===3?[draftPlan]:visitType==='EXTRA'?[]:[plan,paused],canComplete:true})});
  });
  const select=(target=page,id=1,type='REGULAR')=>target.evaluate(({visitId,visitType})=>window.dispatchEvent(new CustomEvent('cw:field-visit-selected',{detail:{visitId,visitType,poolId:3}})),{visitId:id,visitType:type});
  const action=()=>page.getByRole('button',{name:'Registar revisão realizada',exact:true});
  const pending=()=>page.evaluate(()=>CWFieldWriteStore.records('EQUIPMENT_MAINTENANCE').then(rows=>rows.length));
  const retry=async()=>{await page.getByRole('button',{name:'Repetir a mesma confirmação',exact:true}).click();await page.waitForFunction(()=>![...document.querySelectorAll('#cwEquipmentSyncStatus button')].some(button=>button.textContent==='Repetir a mesma confirmação'&&button.disabled));};
  await page.goto('https://equipment.test/test');assert.equal(posts.length,0);await select();await action().waitFor();assert(await action().isDisabled());
  assert.equal(await page.getByText('Pausado',{exact:true}).count(),0);assert.equal(await page.locator('#fieldEquipmentList img').count(),0);assert.match(await page.locator('#fieldEquipmentList').textContent(),/Em atraso/);assert.equal(await page.getByText('Bomba',{exact:true}).count(),1);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await page.locator('textarea').fill('Revisão feita');assert(await action().isDisabled());await page.locator('input[type=checkbox]').check();await action().click();
  await page.waitForFunction(()=>document.getElementById('fieldEquipmentStatus').textContent.includes('Revisão não aplicada'));assert.equal(posts.length,1);assert.equal(writes,0);
  await page.getByRole('button',{name:'Tomei conhecimento da recusa'}).click();await page.locator('#fieldEquipmentRefresh').click();await action().waitFor();assert.equal(await page.locator('textarea').inputValue(),'Revisão feita');assert.equal(await page.locator('input[type=checkbox]').isChecked(),false);
  mode='unavailable';await page.locator('input[type=checkbox]').check();await action().click();await page.waitForFunction(()=>document.getElementById('fieldEquipmentStatus').textContent.includes('Resultado incerto'));assert.equal(await pending(),1);
  const original=posts.at(-1);assert.notEqual(original.requestId,posts[0].requestId);posts=[];
  await page.reload();await select(page,1,'EXTRA');await page.getByText('Sem revisões preventivas ativas para esta visita.').waitFor();assert.equal(await pending(),1);assert.equal(await action().count(),0);
  await select();await page.getByText(/O pedido original foi preservado/).waitFor();
  mode='bare';await retry();assert.equal(await pending(),1);assert.equal(writes,1);
  await page.locator('#fieldEquipmentRefresh').click();await page.getByText(/O pedido original foi preservado/).waitFor();assert.equal(await pending(),1,'A changed server plan cannot acknowledge the original request');
  for(const next of ['accepted','wrong']){mode=next;await retry();assert.equal(await pending(),1);}
  mode='success';await retry();await page.waitForFunction(()=>CWFieldWriteStore.records('EQUIPMENT_MAINTENANCE').then(rows=>rows.length===0));
  assert(posts.length>=4);for(const body of posts)assert.deepEqual(body,original);assert.equal(writes,1);
  await page.getByText('Revisão já registada nesta visita.').waitFor();assert.equal(await action().count(),0);assert.match(await page.locator('#fieldEquipmentStatus').textContent(),/registada no servidor/);
  assert.equal(await page.evaluate(()=>CWFieldEquipment.pendingSummary().then(rows=>rows.length)),0);
  unavailable=true;await page.locator('#fieldEquipmentRefresh').click();await page.waitForFunction(()=>document.getElementById('fieldEquipmentStatus').textContent.includes('Consulta guardada'));assert.equal(await action().count(),0);unavailable=false;
  hold=true;await page.locator('#fieldEquipmentRefresh').click();await page.waitForFunction(()=>document.getElementById('fieldEquipmentRefresh').disabled);await page.waitForTimeout(50);await select(page,1,'EXTRA');await page.getByText('Sem revisões preventivas ativas para esta visita.').waitFor();release();await page.waitForTimeout(50);hold=false;assert.equal(await page.locator('.field-equipment-plan').count(),0);
  console.log('PASS exact typed receipts, persisted refusal, HTTP 202/bare/wrong acknowledgements rejected, durable identical retry after reload and changed plan, dated offline cache and equal-ID isolation');
  await select(page,3);await page.locator('textarea').fill('Notas de rascunho');await page.waitForFunction(()=>document.getElementById('fieldEquipmentStatus').textContent.includes('Notas guardadas'));
  await page.reload();await select(page,3);await action().waitFor();assert.equal(await page.locator('textarea').inputValue(),'Notas de rascunho');assert.equal(await page.locator('input[type=checkbox]').isChecked(),false);
  const second=await context.newPage();await second.goto('https://equipment.test/test');await select(second,3);await second.locator('textarea').waitFor();
  await page.locator('textarea').fill('Notas da primeira janela');await page.waitForFunction(()=>document.getElementById('fieldEquipmentStatus').textContent.includes('Notas guardadas'));
  await second.locator('textarea').fill('Não substituir rascunho recente');await second.waitForFunction(()=>document.getElementById('fieldEquipmentStatus').textContent.includes('Outra janela'));assert(await second.getByRole('button',{name:'Registar revisão realizada'}).isDisabled());await second.close();
  const storageKey='cwEquipmentDraft:v1:TECH:12:REGULAR:3:9',raw=await page.evaluate(key=>localStorage.getItem(key),storageKey);assert.equal(JSON.parse(raw).notes,'Notas da primeira janela');
  await page.evaluate(()=>{window.qaSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('cwEquipmentDraft:'))throw Error('QA draft quota');return window.qaSet.call(this,key,value);};});
  await page.locator('textarea').fill('Não perder por falta de espaço');await page.waitForFunction(()=>document.getElementById('fieldEquipmentStatus').textContent.includes('QA draft quota'));assert(await action().isDisabled());assert.equal(await page.evaluate(key=>localStorage.getItem(key),storageKey),raw);
  await page.evaluate(()=>{Storage.prototype.setItem=window.qaSet;});await page.evaluate(key=>localStorage.setItem(key,'{broken'),storageKey);await page.reload();await select(page,3);await page.getByText('Rascunho de revisão ilegível. Preserve os dados e peça apoio ao escritório.',{exact:true}).first().waitFor();assert.equal(await action().count(),0);assert.equal(await page.evaluate(key=>localStorage.getItem(key),storageKey),'{broken');
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:storageKey,raw});await page.reload();await select(page,3);await action().waitFor();
  assert.equal((await page.evaluate(()=>CWFieldEquipment.pendingSummary())).length,1);
  await page.evaluate(()=>{localStorage.setItem('token','another-account');window.dispatchEvent(new StorageEvent('storage',{key:'token'}));});assert.equal(await page.locator('#fieldEquipmentMaintenance').isVisible(),false);assert.equal(await page.locator('#cwEquipmentSyncStatus').isVisible(),false);assert.deepEqual(errors,[]);
  console.log('PASS persistent explicit drafts, two-window CAS, quota/corruption preservation, day-review pending notes, safe literal titles, account isolation and responsive widths');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
