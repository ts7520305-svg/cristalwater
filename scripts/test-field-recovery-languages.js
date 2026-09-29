'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),fs=require('node:fs'),jwt=require('jsonwebtoken'),{chromium}=require('playwright');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const words={
 pt:{banner:'2 registo(s) antigo(s) aguardam recuperação.',button:'Guardar cópia dos registos'},
 en:{banner:'2 old record(s) await recovery.',button:'Save a copy of the records'},
 fr:{banner:'2 ancien(s) enregistrement(s) attendent une récupération.',button:'Enregistrer une copie des données'},
 es:{banner:'2 registro(s) antiguo(s) esperan recuperación.',button:'Guardar una copia de los registros'},
 de:{banner:'2 alte Datensätze warten auf Wiederherstellung.',button:'Kopie der Datensätze speichern'}
};
let browser,completed=false;const deadline=setTimeout(()=>{console.error('Recovery language assertions did not finish');process.exit(1);},60000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
 const tech=await prisma.technician.create({data:{name:'Recovery language owner',active:true}}),other=await prisma.technician.create({data:{name:'Recovery language other',active:true}});
 const sign=(person,role='TECHNICIAN')=>jwt.sign({id:person.id,role},getJwtSecret(),{expiresIn:'1h'}),token=sign(tech),otherToken=sign(other);
 const originalText='{"notes":"Guardar <img src=x onerror=window.qaInjected=true> — José 17,25 € {count}","requestId":"original-uuid"}';
 const binary=Array.from({length:32017},(_,i)=>(i*37)%256),stamp='2026-09-28T10:15:30.000Z';
 const entries=[
  {store:'PayloadQueue',id:1,url:base+'/api/core/visits/123/complete',method:'POST',createdAt:stamp,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:Array.from(Buffer.from(originalText))},
  {store:'MediaQueue',id:4,url:base+'/api/visits/123/photos',method:'POST',createdAt:stamp,headers:{Authorization:'Bearer '+token,'content-type':'image/jpeg'},body:binary},
  {store:'PayloadQueue',id:2,url:base+'/api/core/visits/999/complete',method:'POST',createdAt:stamp,headers:{authorization:'Bearer '+otherToken,'content-type':'application/json'},body:[1,2,3]},
  {store:'PayloadQueue',id:3,url:base+'/api/admin-only',method:'POST',createdAt:stamp,headers:{authorization:'Bearer '+sign(tech,'ADMIN'),'content-type':'application/json'},body:[4,5]},
  {store:'MediaQueue',id:5,url:base+'/api/invalid',method:'POST',createdAt:stamp,headers:{authorization:'invalid'},body:[6,7]},
  {store:'MediaQueue',id:6,url:base+'/api/missing',method:'POST',createdAt:stamp,headers:{},body:[8,9]}
 ];
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:900},timezoneId:'Europe/Lisbon'});
 await context.addInitScript(({token,tech,origin})=>{
  if(top!==window||location.origin!==origin)return;
  if(!localStorage.getItem('qaRecoveryLanguage')){for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));localStorage.setItem('qaRecoveryLanguage','1');}
  window.qaRecoveryReads=0;window.qaRecoveryOpen=IDBFactory.prototype.open;IDBFactory.prototype.open=function(name,...args){if(name==='cristalwater-v22-offline')qaRecoveryReads++;return qaRecoveryOpen.call(this,name,...args);};
  const interval=setInterval;window.setInterval=(fn,delay,...args)=>[15000,30000,60000].includes(delay)?0:interval(fn,delay,...args);
  Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});window.alert=()=>{};
 },{token,tech,origin:new URL(base).origin});
 const page=await context.newPage();page.setDefaultTimeout(7000);const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push({path:new URL(r.url()).pathname,method:r.method(),body:r.postData()});});
 const banner=page.locator('#cwFieldRecovery'),button=banner.locator('button');
 const snapshot=()=>page.evaluate(async()=>{
  const request=qaRecoveryOpen.call(indexedDB,'cristalwater-v22-offline'),db=await new Promise((yes,no)=>{request.onsuccess=()=>yes(request.result);request.onerror=()=>no(request.error);});
  try{const result=[];for(const store of ['PayloadQueue','MediaQueue']){const rows=await new Promise((yes,no)=>{const read=db.transaction(store).objectStore(store).getAll();read.onsuccess=()=>yes(read.result);read.onerror=()=>no(read.error);});result.push(...rows.map(row=>({...row,store,body:Array.from(new Uint8Array(row.body))})));}return result;}finally{db.close();}
 });
 const locale=language=>page.evaluate(language=>CristalI18n.applyLanguage(language),language);
 function languageOnly(index){for(const r of requests.slice(index)){assert.equal(r.path,'/api/settings/language/me',JSON.stringify(r));assert.equal(r.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(r.body)),['language']);assert(Object.hasOwn(words,JSON.parse(r.body).language));}}
 await page.goto(base+'/technician-field-mode',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.CWFieldRecovery&&window.CristalI18n);
 assert.equal(await banner.count(),0);
 await page.evaluate(async entries=>{
  const request=qaRecoveryOpen.call(indexedDB,'cristalwater-v22-offline',2);
  const db=await new Promise((yes,no)=>{request.onupgradeneeded=()=>{for(const name of ['PayloadQueue','MediaQueue'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id',autoIncrement:true});};request.onsuccess=()=>yes(request.result);request.onerror=()=>no(request.error);});
  await new Promise((yes,no)=>{const tx=db.transaction(['PayloadQueue','MediaQueue'],'readwrite');for(const {store,body,...entry} of entries)tx.objectStore(store).add({...entry,body:Uint8Array.from(body).buffer});tx.oncomplete=yes;tx.onerror=()=>no(tx.error);});db.close();await CWFieldRecovery.refresh();
 },entries);
 await locale('en');assert.equal(await button.textContent(),words.en.button);
 const original=await snapshot(),beforeRequests=requests.length,reads=await page.evaluate(()=>qaRecoveryReads);
 assert.equal(original.length,6);
 await page.evaluate(()=>{window.qaRecoveryNodes=Array.from(document.querySelectorAll('#cwFieldRecovery,#cwFieldRecovery *'));document.querySelector('#cwFieldRecovery button').focus();});
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});for(const [language,w] of Object.entries(words)){
  await locale(language);assert.equal(await button.textContent(),w.button);assert((await banner.textContent()).startsWith(w.banner));assert.equal(await banner.getAttribute('role'),'alert');
  assert.deepEqual(await snapshot(),original);assert(await page.evaluate(()=>qaRecoveryNodes.every(node=>node.isConnected)&&document.activeElement===qaRecoveryNodes[1]));
  assert(await page.evaluate(()=>{const box=document.querySelector('#cwFieldRecovery button').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth+1&&box.left>=-1&&box.right<=innerWidth+1;}));
 }}
 assert.equal(await page.evaluate(()=>qaRecoveryReads),reads);languageOnly(beforeRequests);
 if(process.env.CW_CAPTURE_UI){await page.setViewportSize({width:320,height:900});fs.mkdirSync('reports/field-ui',{recursive:true});await banner.screenshot({path:'reports/field-ui/RECOVERY_DE_320.png'});}
 console.log('PASS actual route, five languages/320/390/1440, account-filtered count, unchanged nodes/focus and all six original records without rereading or operational requests');
 const expected=entries.slice(0,2).map(({store,id,url,method,createdAt,headers,body})=>({store,id,url,method,createdAt,contentType:headers['content-type'],bodyBase64:Buffer.from(body).toString('base64')}));
 async function download(){const [file]=await Promise.all([page.waitForEvent('download'),button.click()]);assert.equal(file.suggestedFilename(),'cristalwater-registos-por-recuperar.json');const data=JSON.parse(fs.readFileSync(await file.path(),'utf8'));assert.deepEqual(Object.keys(data).sort(),['entries','exportedAt']);assert(Number.isFinite(Date.parse(data.exportedAt)));assert.deepEqual(data.entries,expected);assert(!JSON.stringify(data).includes(token));assert(!JSON.stringify(data).includes(otherToken));return data;}
 const exportRequests=requests.length;
 for(const language of Object.keys(words)){await locale(language);const exported=await download();assert.equal(Buffer.from(exported.entries[0].bodyBase64,'base64').toString(),originalText);assert.deepEqual(Array.from(Buffer.from(exported.entries[1].bodyBase64,'base64')),binary);assert.deepEqual(await snapshot(),original);}
 languageOnly(exportRequests);assert.equal(await prisma.fieldWriteRequest.count({where:{owner:'TECH:'+tech.id}}),0);
 console.log('PASS five real downloads preserve JSON and 32017 binary bytes, original IDs/URLs/methods/timestamps and filename, exclude credentials/foreign records and never send or remove an operation');
 await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await banner.waitFor();await page.waitForFunction(()=>document.documentElement.lang==='de');
 assert.equal(await button.textContent(),words.de.button);await download();assert.deepEqual(await snapshot(),original);
 const cacheName=fs.readFileSync('frontend/sw.js','utf8').match(/const CACHE = '([^']+)'/)[1];assert(await page.evaluate(name=>caches.keys().then(keys=>keys.includes(name)),cacheName));
 const noEvent=await page.evaluate(async()=>{document.documentElement.lang='en';await new Promise(requestAnimationFrame);return document.querySelector('#cwFieldRecovery button').textContent;});assert.equal(noEvent,words.en.button);await locale('de');
 // Preserve the original filtering contract: an explicit refresh uses the current identity.
 await page.evaluate(async({other,token})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:other.id,name:other.name,role:'TECHNICIAN'}));await CWFieldRecovery.refresh();},{other,token:otherToken});
 assert((await banner.textContent()).startsWith('1 '));const [foreignFile]=await Promise.all([page.waitForEvent('download'),button.click()]);const foreign=JSON.parse(fs.readFileSync(await foreignFile.path(),'utf8'));assert.deepEqual(foreign.entries.map(x=>[x.store,x.id]),[['PayloadQueue',2]]);assert.deepEqual(await snapshot(),original);
 await page.evaluate(async()=>{for(const key of ['token','cristalwater_jwt','user','cristalwater_user'])localStorage.removeItem(key);await CWFieldRecovery.refresh();});assert.equal(await banner.count(),0);assert.deepEqual(await snapshot(),original);
 assert.equal(await page.evaluate(()=>window.qaInjected),undefined);assert.deepEqual(errors,[]);
 console.log('PASS cached offline reload/export, direct language attribute change and explicit account refresh/removal keep original bytes and export only the current account');completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();await prisma.$disconnect();clearTimeout(deadline);});
