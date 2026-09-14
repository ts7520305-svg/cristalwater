/* Chromium regression for session expiry and identity changes during field uploads. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const deadline=setTimeout(()=>{console.error('Session regression deadline exceeded');process.exit(1)},25000);
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CW_CHROMIUM_PATH?{executablePath:process.env.CW_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(5000);
  let status=401,held=null,hold=false,completions=0;const sentBodies=[];
  await page.route('http://localhost/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname.startsWith('/api/')){
    if(hold){held=route;return;}
    if(pathname.endsWith('/complete')){completions++;sentBodies.push(route.request().postDataJSON());}
    return route.fulfill({status,headers:status===429?{'Retry-After':'60'}:{},contentType:'application/json',body:JSON.stringify(status===401?{error:'Expired'}:{visit:{id:5},photo:{id:7,url:'/photo.jpg'}})});
   }
   return route.fulfill({contentType:'text/html',body:'<body><textarea id="notes">Trabalho em curso</textarea></body>'});
  });
  await page.goto('http://localhost/technician-field-mode');
  for(const file of ['cw-auth.js','cw-field-photos.js','cw-field-offline.js'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../frontend',file),'utf8')});
  await page.evaluate(()=>CristalAuth.persistSession('expired-token',{id:41,technicianId:41,role:'TECHNICIAN'}));
  const message=await page.evaluate(()=>CWFieldOffline.submitCompletion(5,{notes:'Trabalho em curso'}).catch(e=>e.message));
  assert.match(message,/guardada/);
  assert.equal(new URL(page.url()).pathname,'/technician-field-mode');
  assert.equal(await page.locator('#notes').inputValue(),'Trabalho em curso');
  assert.equal(await page.locator('#cwSessionExpired').isVisible(),true);
  assert.equal(await page.evaluate(()=>CWFieldOffline.pending(5)),true);
  const sent=completions;await page.evaluate(()=>CWFieldOffline.flush());assert.equal(completions,sent,'Expired sessions must not keep retrying');
  status=200;
  await page.evaluate(async()=>{CristalAuth.persistSession('renewed-token',{id:41,technicianId:41,role:'TECHNICIAN'});await CWFieldOffline.flush()});
  assert.equal(await page.evaluate(()=>CWFieldOffline.pending(5)),false);
  assert.equal(await page.locator('#cwSessionExpired').count(),0);
  console.log('PASS expiry preserves visible work and queued visit; same-account renewal resumes sync');

  hold=true;
  await page.evaluate(()=>{window.stale=fetch('/api/delayed').then(r=>r.status)});
  await page.waitForTimeout(50);assert(held);
  await page.evaluate(()=>CristalAuth.persistSession('newer-token',{id:41,technicianId:41,role:'TECHNICIAN'}));
  await held.fulfill({status:401,contentType:'application/json',body:'{}'});held=null;hold=false;
  assert.equal(await page.evaluate(()=>window.stale),401);
  assert.equal(await page.evaluate(()=>CristalAuth.isSessionExpired()),false,'Old responses must not expire renewed sessions');
  console.log('PASS delayed 401 cannot invalidate a newer login');

  await page.evaluate(async()=>{
   const photo={localId:'same-local-id',file:new Blob(['test'],{type:'image/png'}),fileName:'test.png'};
   await CWFieldPhotos.save(5,photo);
   CristalAuth.persistSession('second-account',{id:42,technicianId:42,role:'TECHNICIAN'});await CWFieldPhotos.save(5,photo);
   CristalAuth.persistSession('newer-token',{id:41,technicianId:41,role:'TECHNICIAN'});
  });
  hold=true;const countBefore=completions;
  await page.evaluate(()=>{window.upload=CWFieldOffline.submitCompletion(5,{notes:'Owner 41'}).catch(e=>e.message)});
  await page.waitForTimeout(100);assert(held);
  assert.equal(held.request().headers().authorization,'Bearer newer-token');
  await page.evaluate(()=>CristalAuth.persistSession('second-account',{id:42,technicianId:42,role:'TECHNICIAN'}));
  await held.fulfill({status:200,contentType:'application/json',body:JSON.stringify({photo:{id:7,url:'/photo.jpg'}})});held=null;hold=false;
  assert.match(await page.evaluate(()=>window.upload),/Sessão alterada/);
  assert.equal(completions,countBefore,'No completion may be sent with another account');
  assert.equal(await page.evaluate(async()=>(await CWFieldPhotos.list(5)).length),1,'Other account photo must remain');
  assert.equal(await page.evaluate(()=>CWFieldOffline.pending(5)),false);
  await page.evaluate(()=>CristalAuth.persistSession('newer-token',{id:41,technicianId:41,role:'TECHNICIAN'}));
  assert.equal(await page.evaluate(async()=>(await CWFieldPhotos.list(5)).length),1,'Original photo remains until confirmed under its owner');
  assert.equal(await page.evaluate(()=>CWFieldOffline.pending(5)),true);
  await page.evaluate(()=>CWFieldOffline.flush());
  assert.equal(await page.evaluate(()=>CWFieldOffline.pending(5)),false);
  console.log('PASS account switch preserves both photo queues and prevents cross-account completion');
  status=403;
  await page.evaluate(()=>CWFieldOffline.submitCompletion(6,{notes:'Registo antes de mudar a ronda'}).catch(()=>{}));
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('cwFieldOutbox:41'))[6]);
  assert.equal(original.blocked,true);
  assert.equal(original.body.notes,'Registo antes de mudar a ronda');
  const beforeBlocked=completions;await page.evaluate(()=>CWFieldOffline.flush());assert.equal(completions,beforeBlocked);
  assert.equal(await page.locator('#cwFieldSyncStatus details').getAttribute('open'),'');
  assert.match(await page.locator('[data-pending-visit="6"]').textContent(),/atribuída a outro técnico/);
  status=200;
  await page.getByRole('button',{name:'Confirmado pelo escritório — tentar novamente'}).click();
  await page.waitForFunction(()=>!CWFieldOffline.pending(6));
  assert.equal(sentBodies.at(-1).clientRequestId,original.body.clientRequestId);
  console.log('PASS reassignment rejection preserves the visit and manual confirmation can resume sending');
  status=429;
  await page.evaluate(()=>CWFieldOffline.submitCompletion(7,{notes:'Pausa temporária'}).catch(()=>{}));
  const rateLimited=await page.evaluate(()=>JSON.parse(localStorage.getItem('cwFieldOutbox:41'))[7]);
  assert.equal(rateLimited.blocked,false);assert(rateLimited.retryAt>Date.now()+45000);
  const beforeWait=completions;await page.evaluate(()=>CWFieldOffline.flush());await page.evaluate(()=>CWFieldOffline.submitCompletion(7,{notes:'Pausa temporária'}).catch(()=>{}));assert.equal(completions,beforeWait);
  status=200;
  await page.evaluate(()=>{const rows=JSON.parse(localStorage.getItem('cwFieldOutbox:41'));rows[7].retryAt=Date.now()-1;localStorage.setItem('cwFieldOutbox:41',JSON.stringify(rows));return CWFieldOffline.flush()});
  assert.equal(await page.evaluate(()=>CWFieldOffline.pending(7)),false);
  console.log('PASS rate limit honours Retry-After and resumes automatically without blocking the record');

 }finally{await browser.close()}
})().then(()=>{clearTimeout(deadline);console.log('SESSION RESULT=PASS')}).catch(e=>{clearTimeout(deadline);console.error(e);process.exitCode=1});
