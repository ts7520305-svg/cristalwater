'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),fs=require('node:fs'),jwt=require('jsonwebtoken'),{chromium}=require('playwright');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const words={
 pt:{history:'Existem fotografias antigas sem conta confirmada. Os ficheiros foram preservados; peça revisão ao escritório antes de enviar.',pending:'Pendente: ',restore:'Falha ao recuperar fotografias: '},
 en:{history:'There are older photographs without a confirmed account. The files were preserved; ask the office to review them before sending.',pending:'Pending: ',restore:'Failed to recover photographs: '},
 fr:{history:'Des photographies anciennes n’ont pas de compte confirmé. Les fichiers ont été conservés ; demandez une vérification au bureau avant de les envoyer.',pending:'En attente : ',restore:'Impossible de récupérer les photographies : '},
 es:{history:'Hay fotografías antiguas sin una cuenta confirmada. Los archivos se han conservado; pida una revisión a la oficina antes de enviarlos.',pending:'Pendiente: ',restore:'No se pudieron recuperar las fotografías: '},
 de:{history:'Es gibt ältere Fotos ohne bestätigtes Konto. Die Dateien bleiben erhalten; bitten Sie das Büro vor dem Senden um Prüfung.',pending:'Ausstehend: ',restore:'Fotos konnten nicht wiederhergestellt werden: '}
};
const photoBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tAAAAABJRU5ErkJggg==','base64');
let browser,completed=false;const deadline=setTimeout(()=>{console.error('Photo error language assertions did not finish');process.exit(1);},90000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
 const tech=await prisma.technician.create({data:{name:'Photo language owner',active:true}}),other=await prisma.technician.create({data:{name:'Photo language other',active:true}});
 const client=await prisma.client.create({data:{name:'Photo language client',active:true}}),pool=await prisma.pool.create({data:{name:'Piscina original {detail}',clientId:client.id,active:true}});
 const maxima=await Promise.all([prisma.serviceVisit.aggregate({_max:{id:true}}),prisma.extraVisit.aggregate({_max:{id:true}})]),id=Math.max(...maxima.map(x=>x._max.id||0))+1;
 const common={id,clientId:client.id,poolId:pool.id,technicianId:tech.id,status:'PLANNED'};
 await prisma.serviceVisit.create({data:{...common,date:new Date(),plannedDate:new Date()}});await prisma.extraVisit.create({data:{...common,scheduledAt:new Date(),execution:{notes:'Original execution'}}});
 for(const table of ['ServiceVisit','ExtraVisit'])await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),${id},true)`);
 const token=jwt.sign({id:tech.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'});
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:900},timezoneId:'Europe/Lisbon'});
 await context.addInitScript(({token,tech,origin})=>{
  if(top!==window||location.origin!==origin)return;
  if(!localStorage.getItem('qaPhotoLanguages')){for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));localStorage.setItem('qaPhotoLanguages','1');}
  const interval=setInterval;window.setInterval=(fn,delay,...args)=>[15000,30000,60000].includes(delay)?0:interval(fn,delay,...args);
  Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});window.alert=()=>{};
 },{token,tech,origin:new URL(base).origin});
 const page=await context.newPage();page.setDefaultTimeout(7000);const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push({path:new URL(r.url()).pathname,method:r.method(),body:r.postData()});});
 const locale=language=>page.locator('#cwLanguageSelect').selectOption(language),warning=page.locator('#cwFieldStorageError');
 const history=add=>page.evaluate(async({add,owner})=>{
  const request=indexedDB.open('cw-field-media',1),db=await new Promise((yes,no)=>{request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'key'});request.onsuccess=()=>yes(request.result);request.onerror=()=>no(request.error);});
  await new Promise((yes,no)=>{const tx=db.transaction('photos','readwrite');if(add)tx.objectStore('photos').put({key:'qa-historical',owner:String(owner),file:new Blob(['original historical bytes']),notes:'Literal <b>Guardar</b>'});else tx.objectStore('photos').delete('qa-historical');tx.oncomplete=yes;tx.onerror=()=>no(tx.error);});db.close();await CWFieldOffline.render();
 },{add,owner:tech.id});
 await page.goto(base+`/technician-field-mode?selectedVisitId=${id}&selectedVisitType=REGULAR`,{waitUntil:'networkidle'});
 await page.waitForFunction(id=>CWFieldVisitContext()?.id===id&&CWFieldVisitContext()?.visitType==='REGULAR',id);
 await history(true);await locale('en');
 await page.waitForFunction(expected=>document.querySelector('#cwFieldStorageError')?.textContent===expected,words.en.history);
 assert.equal(await warning.textContent(),words.en.history);
 console.log('PASS owned historical photograph warning uses the selected language on the actual route');
 const snapshot=()=>page.evaluate(async()=>{
  const result={storage:Object.fromEntries(Object.keys(localStorage).filter(k=>/^(cwField|cwWater|cwPump)/.test(k)).sort().map(k=>[k,localStorage.getItem(k)]))};
  for(const [name,store] of [['cw-field-media','photos'],['cw-field-writes','requests']]){
   const request=indexedDB.open(name,1),db=await new Promise((yes,no)=>{request.onsuccess=()=>yes(request.result);request.onerror=()=>no(request.error);});
   const rows=await new Promise((yes,no)=>{const read=db.transaction(store).objectStore(store).getAll();read.onsuccess=()=>yes(read.result);read.onerror=()=>no(read.error);});db.close();
   result[store]=await Promise.all(rows.map(async row=>({...row,...(row.file?{file:{type:row.file.type,bytes:Array.from(new Uint8Array(await row.file.arrayBuffer()))}}:{})})));
  }return result;
 });
 function onlyLanguageSince(index){for(const r of requests.slice(index)){assert.equal(r.path,'/api/settings/language/me',JSON.stringify(r));assert.equal(r.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(r.body)),['language']);assert(Object.hasOwn(words,JSON.parse(r.body).language));}}
 async function checkCopy(operation,expected){const result=await page.evaluate(async({operation,expected,id})=>{
  const captured=CWFieldWriteStore.session(),row=(await CWFieldWriteStore.records('VISIT_PHOTO',captured,true))[0];let error;
  try{
   if(operation==='session')await CWFieldPhotos.assertHistory({...captured,token:'different-token'});
   if(operation==='history')await CWFieldPhotos.assertHistory(captured);
   if(operation==='empty')await CWFieldPhotos.save(id,{file:new Blob([])},captured);
   if(operation==='large')await CWFieldPhotos.save(id,{file:new Blob([new Uint8Array(25*1024*1024+1)])},captured);
   if(operation==='visit')await CWFieldPhotos.send(id,row.requestId,captured,{},'EXTRA');
   if(operation==='id')await CWFieldPhotos.send(id+1,row.requestId,captured);
   if(operation==='remove')await CWFieldPhotos.remove(id,row.requestId,captured,'EXTRA');
   if(operation==='confirmed')await CWFieldPhotos.remove(id,row.requestId,captured);
  }catch(e){error=e;}
  if(!error)return null;const copy=CWFieldPhotos.errorCopy(error);return {message:error.message,copy,frozen:Object.isFrozen(copy),enumerable:Object.keys(error),clone:CWFieldPhotos.errorCopy(new Error(error.message))??null,json:CWFieldPhotos.errorCopy(JSON.parse(JSON.stringify({message:error.message})))??null};
 },{operation,expected,id});assert(result,operation);assert.equal(result.copy.en,expected,operation);assert.equal(result.message,result.copy.pt);assert.equal(result.frozen,true);assert.deepEqual(result.enumerable,[]);assert.equal(result.clone,null);assert.equal(result.json,null);assert.deepEqual(Object.keys(result.copy),Object.keys(words));for(const text of Object.values(result.copy))assert(text.length>10);return result;}
 await checkCopy('session','The session changed. Reopen the page with the original account.');await checkCopy('history',words.en.history);
 const archived=await snapshot(),archiveRequests=requests.length;
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});for(const [language,w] of Object.entries(words)){
  await locale(language);await page.waitForFunction(expected=>document.querySelector('#cwFieldStorageError')?.textContent===expected,w.history);
  assert.equal(await warning.getAttribute('role'),'alert');assert.deepEqual(await snapshot(),archived);
  assert(await warning.evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&node.scrollWidth<=node.clientWidth+1;}));
 }}onlyLanguageSince(archiveRequests);
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(expected=>document.querySelector('#toast')?.textContent===expected,words.de.restore+words.de.history);
 for(const [language,w] of Object.entries(words)){await locale(language);assert.equal(await page.locator('#toast').textContent(),w.restore+w.history);}
 await page.evaluate(()=>document.querySelector('#syncPhotosBtn').onclick());assert.equal(await page.locator('#toast').getAttribute('data-cw-photo-error-copy'),null);
 await locale('en');assert(!(await page.locator('#toast').textContent()).includes(words.en.history));
 await history(false);assert.equal(await warning.count(),0);
 console.log('PASS five languages/320/390/1440 preserve historical bytes; real restore toast translates and a later ordinary toast clears its binding');
 const notes='Notas originais <b>Guardar</b> {detail} 17,25 €',fileName='Foto original {detail}.png';
 await page.locator('[data-field-tab-button=agora]').click();await page.locator('#notes').fill(notes);await context.setOffline(true);
 await page.locator('#photosCard details summary').click();const chooserPromise=page.waitForEvent('filechooser');await page.locator('#galleryPhotoBtn').click();await (await chooserPromise).setFiles({name:fileName,mimeType:'image/png',buffer:photoBytes});
 await page.waitForFunction(()=>document.querySelector('.photo-status')?.textContent.startsWith('Pending: '));
 await history(true);await page.evaluate(()=>document.querySelector('#syncPhotosBtn').onclick());
 assert.equal(await page.locator('.photo-status').textContent(),words.en.pending+words.en.history);
 await page.evaluate(()=>{window.qaPhotoCalls={};for(const name of ['save','list','send','remove','sync','pendingSummary']){const fn=CWFieldPhotos[name];CWFieldPhotos[name]=function(...args){qaPhotoCalls[name]=(qaPhotoCalls[name]||0)+1;return fn.apply(this,args);};}window.qaPhotoNodes=Array.from(document.querySelectorAll('#photoList,#photoList *'));document.querySelector('[data-photo-retry]').focus();});
 const pending=await snapshot(),beforeLanguages=requests.length,calls=await page.evaluate(()=>({...qaPhotoCalls}));
 const row=pending.requests.find(row=>row.scope==='VISIT_PHOTO');assert(row);assert.equal(row.resourceId,id);assert.equal(row.owner,'TECH:'+tech.id);assert.deepEqual(row.file.bytes,Array.from(photoBytes));assert.equal(row.fileName,fileName);assert.equal(row.payload.size,photoBytes.length);assert.equal(row.payload.sha256,require('node:crypto').createHash('sha256').update(photoBytes).digest('hex'));
 const preview=await page.locator('.photo-thumb').getAttribute('src');
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});for(const [language,w] of Object.entries(words)){
  await locale(language);assert.equal(await page.locator('.photo-status').textContent(),w.pending+w.history);
  assert.equal(await page.locator('.photo-thumb').getAttribute('src'),preview);assert.equal(await page.locator('.photo-meta > .muted').textContent(),fileName);assert.equal(await page.locator('#notes').inputValue(),notes);
  assert(await page.evaluate(()=>qaPhotoNodes.every(n=>n.isConnected)&&document.activeElement===document.querySelector('[data-photo-retry]')));
  assert.deepEqual(await snapshot(),pending);assert(await page.locator('.photo-status').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&node.scrollWidth<=node.clientWidth+1;}));
 }}assert.deepEqual(await page.evaluate(()=>({...qaPhotoCalls})),calls);onlyLanguageSince(beforeLanguages);
 await page.evaluate(()=>{document.documentElement.lang='fr';});await page.waitForFunction(expected=>document.querySelector('.photo-status').textContent===expected,words.fr.pending+words.fr.history);
 await locale('de');
 if(process.env.CW_CAPTURE_UI){await page.setViewportSize({width:320,height:900});fs.mkdirSync('reports/field-ui',{recursive:true});await page.locator('.photo-item').screenshot({path:'reports/field-ui/PHOTO_ERROR_DE_320.png'});}
 await history(false);const beforeGuards=await snapshot();await checkCopy('empty','Choose a photograph up to 25 MB.');await checkCopy('large','Choose a photograph up to 25 MB.');await checkCopy('visit','The photograph belongs to another visit. Preserve the submission.');await checkCopy('id','The photograph belongs to another visit. Preserve the submission.');await checkCopy('remove','This photograph has already been confirmed or belongs to another visit. Ask the office to review it.');assert.deepEqual(await snapshot(),beforeGuards);
 assert.equal(await prisma.fieldWriteRequest.count({where:{owner:'TECH:'+tech.id}}),0);
 console.log('PASS actual offline gallery photograph, five languages, nodes/focus/preview/draft and exact Blob/UUID/hash preserved; locale invokes no photo producer/send; typed visit, file and identity guards keep literal Error.message');
 let external=words.pt.history;const photoPath=`**/api/visits/${id}/photo`;
 await page.route(photoPath,route=>route.fulfill({status:403,json:{error:external}}));await context.setOffline(false);await page.waitForLoadState('networkidle');await page.evaluate(()=>document.querySelector('#syncPhotosBtn').onclick());
 for(const [language,w] of Object.entries(words)){await locale(language);assert.equal(await page.locator('.photo-status').textContent(),w.pending+external);}
 external+=' <img src=x onerror=window.qaInjected=true> {detail}';await page.evaluate(()=>document.querySelector('#syncPhotosBtn').onclick());
 assert.equal((await snapshot()).requests[0].failure.message,external);assert.equal(await page.locator('.photo-status img').count(),0);
 await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(expected=>document.querySelector('.photo-status')?.textContent===expected,words.de.pending+external);
 assert.equal(await page.locator('#notes').inputValue(),notes);assert.deepEqual((await snapshot()).requests[0].file.bytes,Array.from(photoBytes));
 for(const [language,w] of Object.entries(words)){await locale(language);assert.equal(await page.locator('.photo-status').textContent(),w.pending+external);}
 const cacheName=fs.readFileSync('frontend/sw.js','utf8').match(/const CACHE = '([^']+)'/)[1];assert(await page.evaluate(name=>caches.keys().then(keys=>keys.includes(name)),cacheName));
 console.log('PASS identical-text server errors are not reclassified; markup stays text; cached offline reload retains original persisted failure, photograph and notes');
 await page.unroute(photoPath);let release,ready;const held=new Promise(resolve=>release=resolve),received=new Promise(resolve=>ready=resolve),uploads=[];
 await page.route(photoPath,async route=>{
  const request=route.request();uploads.push({headers:request.headers(),body:request.postDataBuffer()});const response=await route.fetch(),data=await response.json();assert.equal(response.status(),200);assert.equal(data.receipt.requestId,row.requestId);
  if(uploads.length===1){ready();await held;await route.abort('connectionfailed');}else await route.fulfill({response});
 });
 await context.setOffline(false);await page.waitForLoadState('networkidle');await page.evaluate(()=>{window.qaPhotoSend=document.querySelector('#syncPhotosBtn').onclick();});await received;
 const sending=await snapshot(),heldRequests=requests.length;await page.evaluate(()=>{window.qaSendingNodes=Array.from(document.querySelectorAll('#photoList,#photoList *'));});
 for(const language of Object.keys(words)){await locale(language);assert(await page.evaluate(()=>qaSendingNodes.every(n=>n.isConnected)));assert.deepEqual((await snapshot()).requests,sending.requests);}
 onlyLanguageSince(heldRequests);assert.equal(await prisma.visitPhoto.count({where:{visitId:id}}),1);release();await page.evaluate(()=>qaPhotoSend);
 const lost=(await snapshot()).requests[0];assert(!lost.response);assert.deepEqual(lost.file.bytes,Array.from(photoBytes));
 await page.evaluate(()=>document.querySelector('#syncPhotosBtn').onclick());assert.equal(uploads.length,2);
 for(const upload of uploads){assert.equal(upload.headers['x-cw-field-request'],row.requestId);assert.equal(upload.headers.authorization,'Bearer '+token);assert(upload.body.includes(photoBytes));assert(upload.body.includes(Buffer.from(row.requestId)));assert(upload.body.includes(Buffer.from('name="type"\r\n\r\nAFTER')));assert(upload.body.includes(Buffer.from(fileName)));}
 const confirmed=(await snapshot()).requests[0];assert.equal(confirmed.requestId,row.requestId);assert.equal(confirmed.payloadHash,row.payloadHash);assert.deepEqual(confirmed.payload,row.payload);assert.equal(confirmed.attemptedAt,lost.attemptedAt);assert.equal(confirmed.file,undefined);assert.equal(confirmed.failure,undefined);assert.equal(confirmed.response.receipt.requestId,row.requestId);assert.equal(confirmed.response.receipt.payloadHash,row.payloadHash);
 assert.equal(await prisma.visitPhoto.count({where:{visitId:id}}),1);assert.equal(await prisma.extraVisitPhoto.count({where:{extraVisitId:id}}),0);assert.equal(await prisma.fieldWriteRequest.count({where:{owner:'TECH:'+tech.id,scope:'VISIT_PHOTO',resourceId:id}}),1);
 await checkCopy('confirmed','This photograph has already been confirmed or belongs to another visit. Ask the office to review it.');assert.deepEqual((await snapshot()).requests,[confirmed]);
 assert.equal((await prisma.serviceVisit.findUnique({where:{id}})).status,'PLANNED');assert.deepEqual((await prisma.extraVisit.findUnique({where:{id}})).execution,{notes:'Original execution'});
 assert.equal(await page.evaluate(()=>window.qaInjected),undefined);assert.deepEqual(errors,[]);
 console.log('PASS real server upload with held/lost response and actual retry keeps exact request/Blob/hash, one photo/receipt and unchanged regular/extra visit state');
 completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();await prisma.$disconnect();clearTimeout(deadline);});
