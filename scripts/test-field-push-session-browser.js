const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const publicKey=require('web-push').generateVAPIDKeys().publicKey;
const deadline=setTimeout(()=>{console.error('Push session test timed out');process.exit(1)},40000);
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CW_CHROMIUM_PATH?{executablePath:process.env.CW_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 async function setup(options={}){
  const page=await browser.newPage();page.setDefaultTimeout(5000);const requests=[];let held,resolveHeld;const heldReady=new Promise(resolve=>{resolveHeld=resolve;});
  await page.route('http://localhost/**',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.pathname==='/cw-push-session.js')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/cw-push-session.js'),'utf8')});
   if(url.pathname==='/api/push/public-key')return route.fulfill({json:{configured:true,publicKey}});
   if(url.pathname==='/api/push/subscriptions'){
    requests.push({method:request.method(),authorization:request.headers().authorization,body:request.postDataJSON()});
    if(request.method()==='POST'&&options.holdPost){held=route;resolveHeld();return;}
    if(request.method()==='DELETE'&&options.offlineDelete)return route.abort('failed');
    return route.fulfill({status:request.method()==='DELETE'&&options.delete401?401:200,json:{ok:true}});
   }
   if(url.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'Offline fixture'}});
   return route.fulfill({contentType:'text/html',body:'<main><div class="water-card"></div></main>'});
  });
  await page.goto('http://localhost/technician-field-mode');
  await page.evaluate(({holdPermission,failUnsubscribe})=>{
   window.closedNotices=[];window.unsubscribed=[];
   window.makeSubscription=endpoint=>({endpoint,toJSON(){return {endpoint,keys:{}}},async unsubscribe(){window.unsubscribed.push(endpoint);if(failUnsubscribe)throw new Error('Offline');return true;}});
   window.currentSubscription=makeSubscription('https://fcm.googleapis.com/fcm/send/account-A');
   window.registrationMock={pushManager:{async getSubscription(){return currentSubscription;},async subscribe(){return currentSubscription;}},async getNotifications(){return [{data:{owner:'TECHNICIAN:41'},close(){closedNotices.push('A')}},{data:{owner:'TECHNICIAN:42'},close(){closedNotices.push('B')}}];}};
   Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>registrationMock,register:async()=>registrationMock,ready:Promise.resolve(registrationMock)}});
   window.PushManager=function(){};
   Object.defineProperty(window,'Notification',{configurable:true,value:{requestPermission:()=>holdPermission?new Promise(resolve=>{window.resolvePermission=resolve}):Promise.resolve('granted')}});
  },options);
  for(const file of ['cw-auth.js','cw-field-offline.js'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../frontend',file),'utf8')});
  await page.evaluate(()=>CristalAuth.persistSession('account-A-token',{id:41,technicianId:41,role:'TECHNICIAN'}));
  return {page,requests,heldReady,get held(){return held;}};
 }
 async function enable(page){await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../frontend/cw-browser-push.js'),'utf8')});await page.waitForFunction(()=>!document.querySelector('.water-card button').disabled);await page.locator('.water-card button').click();}
 try{
  {
   const {page,requests}=await setup();
   await page.evaluate(()=>CWFieldOffline.submitCompletion(5,{notes:'Trabalho feito em campo'}).catch(()=>null));
   const before=await page.evaluate(()=>localStorage.getItem('cwFieldOutbox:41'));assert(before);
   await page.evaluate(()=>CristalAuth.clearSession());
   assert.equal(await page.evaluate(()=>CristalAuth.getToken()),'');assert.deepEqual(await page.evaluate(()=>CWPushSession.read()),{known:true,owner:null});assert.equal(await page.evaluate(()=>localStorage.getItem('cwFieldOutbox:41')),before);
   assert.deepEqual(await page.evaluate(()=>unsubscribed),['https://fcm.googleapis.com/fcm/send/account-A']);assert.deepEqual(await page.evaluate(()=>closedNotices),['A','B']);
   assert.equal(requests[0].authorization,'Bearer account-A-token');assert.equal(requests[0].method,'DELETE');
   await page.close();console.log('PASS logout retires push and visible notices while preserving the actual field outbox');
  }
  {
   const {page,requests}=await setup({delete401:true});
   await page.evaluate(()=>CristalAuth.persistSession('account-B-token',{id:42,technicianId:42,role:'TECHNICIAN'}));
   await page.waitForFunction(()=>closedNotices.includes('A'));
   assert.equal(requests[0].authorization,'Bearer account-A-token');assert.equal(await page.evaluate(()=>CristalAuth.getToken()),'account-B-token');assert.deepEqual(await page.evaluate(()=>CWPushSession.read()),{known:true,owner:'TECHNICIAN:42'});assert.deepEqual(await page.evaluate(()=>closedNotices),['A']);assert.deepEqual(await page.evaluate(()=>unsubscribed),[]);
   assert.equal(await page.locator('#cwSessionExpired').count(),0);await page.close();console.log('PASS account switch retires only the previous account and ignores its late 401');
  }
  {
   const {page,requests}=await setup({holdPermission:true});await enable(page);
   await page.evaluate(()=>{CristalAuth.persistSession('account-B-token',{id:42,technicianId:42,role:'TECHNICIAN'});resolvePermission('granted');});
   await page.waitForFunction(()=>document.querySelector('.water-card [role=status]').textContent.includes('sessão mudou'));
   assert.equal(requests.filter(r=>r.method==='POST').length,0);assert.notEqual(await page.locator('.water-card button').textContent(),'Avisos ativados');await page.close();console.log('PASS a delayed permission cannot activate notifications in another account');
  }
  {
   const state=await setup({holdPost:true});const {page,requests}=state;await enable(page);
   await state.heldReady;
   assert(state.held,'Activation POST must be in flight');
   await page.evaluate(()=>{CristalAuth.persistSession('account-B-token',{id:42,technicianId:42,role:'TECHNICIAN'});currentSubscription=makeSubscription('https://fcm.googleapis.com/fcm/send/account-B');});
   await state.held.fulfill({json:{ok:true}});
   await page.waitForFunction(()=>document.querySelector('.water-card [role=status]').textContent.includes('sessão mudou'));
   assert(requests.some(r=>r.method==='DELETE'&&r.authorization==='Bearer account-A-token'&&r.body.endpoint.endsWith('/account-A')));assert.equal(requests.filter(r=>r.method==='POST').length,1);assert.deepEqual(await page.evaluate(()=>unsubscribed),[]);assert.equal(await page.evaluate(()=>CristalAuth.getToken()),'account-B-token');
   await page.close();console.log('PASS late activation is retired with its original credential without disabling the new subscription');
  }
  {
   const {page}=await setup({offlineDelete:true,failUnsubscribe:true});await page.evaluate(()=>CristalAuth.clearSession());assert.equal(await page.evaluate(()=>CristalAuth.getToken()),'');assert.deepEqual(await page.evaluate(()=>CWPushSession.read()),{known:true,owner:null});assert.equal(await page.locator('#cwSessionExpired').count(),0);await page.close();console.log('PASS offline cleanup failure does not restore a logged-out session');
  }
 }finally{await browser.close();}
})().then(()=>{clearTimeout(deadline);console.log('PUSH SESSION RESULT=PASS')}).catch(error=>{clearTimeout(deadline);console.error(error);process.exitCode=1});
