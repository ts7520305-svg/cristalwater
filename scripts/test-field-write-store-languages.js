'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
// Independent wording checks for visible and newly thrown errors.
const words={
 pt:{receipt:'Resposta incompleta. O pedido original continua por confirmar.',offline:'Envio guardado neste dispositivo; aguarda ligação.',expired:'Sessão expirada. Volte a entrar com a mesma conta.',unconfirmed:'Envio por confirmar. Conserve o pedido original.',invalid:'Envio guardado inválido.',retry:'O servidor pediu uma pausa.'},
 en:{receipt:'Incomplete response. The original request is still awaiting confirmation.',offline:'Submission saved on this device; awaiting connection.',expired:'Session expired. Sign in again with the same account.',unconfirmed:'Submission awaiting confirmation. Keep the original request.',invalid:'Invalid saved submission.',retry:'The server requested a pause.'},
 fr:{receipt:'Réponse incomplète. La demande d’origine reste à confirmer.',offline:'Envoi enregistré sur cet appareil ; en attente de connexion.',expired:'Session expirée. Reconnectez-vous avec le même compte.',unconfirmed:'Envoi en attente de confirmation. Conservez la demande d’origine.',invalid:'Envoi enregistré invalide.',retry:'Le serveur a demandé une pause.'},
 es:{receipt:'Respuesta incompleta. La solicitud original sigue pendiente de confirmación.',offline:'Envío guardado en este dispositivo; pendiente de conexión.',expired:'Sesión caducada. Inicie sesión de nuevo con la misma cuenta.',unconfirmed:'Envío pendiente de confirmación. Conserve la solicitud original.',invalid:'Envío guardado no válido.',retry:'El servidor ha solicitado una pausa.'},
 de:{receipt:'Unvollständige Antwort. Die ursprüngliche Anfrage wartet weiterhin auf Bestätigung.',offline:'Sendung auf diesem Gerät gespeichert; Verbindung ausstehend.',expired:'Sitzung abgelaufen. Melden Sie sich mit demselben Konto erneut an.',unconfirmed:'Sendung wartet auf Bestätigung. Bewahren Sie die ursprüngliche Anfrage auf.',invalid:'Ungültige gespeicherte Sendung.',retry:'Der Server hat eine Pause angefordert.'},
};
const token=(id,role='TECHNICIAN')=>'x.'+Buffer.from(JSON.stringify({id,role})).toString('base64url')+'.x';
let browser,completed=false;const deadline=setTimeout(()=>{console.error('Write-store language assertions did not finish');process.exit(1);},60000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(7000);
 const errors=[],writes=[],receipts=new Map();let mode='empty',commits=0;
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.qaOnline=false;Object.defineProperty(navigator,'onLine',{get:()=>qaOnline});
  // The existing sync-language group covers automatic sends. This fixture
  // calls the store explicitly so locale-only checks cannot race the30s timer.
  const interval=setInterval;window.setInterval=(fn,delay,...args)=>delay===30000?0:interval(fn,delay,...args);
 });
 await page.route('http://localhost/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/settings/language/me')return route.fulfill({json:{ok:true,language:'pt'}});
  if(url.pathname.startsWith('/api/')){
   const body=route.request().postDataJSON();writes.push({path:url.pathname,body,authorization:route.request().headers().authorization});
   if(mode==='empty')return route.fulfill({status:503,json:{}});
   if(mode==='literal')return route.fulfill({status:503,json:{error:words.pt.receipt}});
   if(mode==='markup')return route.fulfill({status:503,json:{error:'Original <img src=x onerror=qaInjected=1> — conservar'}});
   if(mode==='429')return route.fulfill({status:429,headers:{'Retry-After':'60'},json:{}});
   if(mode==='409')return route.fulfill({status:409,json:{error:words.pt.receipt}});
   if(mode==='incomplete')return route.fulfill({json:{ok:true}});
   let result=receipts.get(body.requestId);
   if(!result){const row=await page.evaluate(id=>CWFieldWriteStore.get(id,CWFieldWriteStore.session()),body.requestId);result={ok:true,receipt:{owner:row.owner,requestId:row.requestId,scope:row.scope,resourceId:row.resourceId,payloadHash:row.payloadHash,confirmedAt:'2026-09-29T08:00:00.000Z'},visit:{id:row.resourceId,status:'DONE',completionRequestId:row.requestId,endAt:'2026-09-29T08:00:00.000Z'}};receipts.set(body.requestId,result);commits++;}
   if(mode==='lost')return route.abort('failed');
   return route.fulfill({json:result});
  }
  if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'frontend',path.basename(url.pathname)),'utf8')});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt"><meta charset="utf-8"><style>body{margin:12px;font:16px system-ui}p,aside{overflow-wrap:anywhere}textarea{box-sizing:border-box;width:100%;min-height:70px}.cw-global-actions{display:flex;flex-wrap:wrap}#storeError{padding:12px;background:#fff4ce}</style><header class="top"><div class="cw-global-actions"></div></header><textarea id="original"></textarea><p id="storeError" role="status" data-cw-state-managed="manual"></p><script src="/cw-auth.js"></script><script src="/cw-i18n.js"></script><script src="/cw-legacy-technician-copy.js"></script><script src="/cw-field-write-store.js"></script><script src="/cw-field-offline.js"></script></html>'});
 });
 await page.goto('http://localhost/technician-field-mode',{waitUntil:'networkidle'});
 await page.evaluate(credential=>CristalAuth.persistSession(credential,{id:77,role:'TECHNICIAN'}),token(77));
 const prepare=id=>page.evaluate(id=>CWFieldWriteStore.prepare('VISIT_COMPLETION',id,{notes:'Original <b>água</b> 1,25',products:[]},{label:'Piscina Guardar <b>Original</b>'}),id);
 const original=await prepare(1);
 const snapshot=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('cw-field-writes',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('requests'),request=tx.objectStore('requests').getAll();tx.oncomplete=()=>{db.close();resolve(JSON.stringify(request.result));};tx.onerror=()=>reject(tx.error);};}));
 const get=id=>page.evaluate(id=>CWFieldWriteStore.get(id,CWFieldWriteStore.session()),id);
 const send=(id,automatic=false)=>page.evaluate(async({id,automatic})=>{try{return{result:await CWFieldWriteStore.send(id,CWFieldWriteStore.session(),{automatic})};}catch(error){return{message:error.message,copy:error.copy,status:error.status,retryAt:error.retryAt};}},{id,automatic});
 const language=async lang=>{await page.evaluate(lang=>CristalI18n.applyLanguage(lang),lang);await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);};
 await language('pt');
 await page.locator('#original').fill('Observação original — manter 17,25');
 await page.evaluate(()=>{try{CWFieldWriteStore.confirmation({},{});}catch(error){window.qaOwnedError=error;CWLegacyTechnicianCopy.set(document.getElementById('storeError'),error.copy);}window.qaNodes=[document.getElementById('original'),document.getElementById('storeError')];});
 const before=await snapshot();
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});for(const [lang,w] of Object.entries(words)){
  await page.locator('#original').focus();await page.evaluate(()=>qaNodes[0].setSelectionRange(3,8));await language(lang);
  assert.equal(await page.locator('#storeError').textContent(),w.receipt);assert.equal((await send(original.requestId)).message,w.offline);
  const state=await page.evaluate(()=>({same:qaNodes[0]===document.getElementById('original')&&qaNodes[1]===document.getElementById('storeError'),focus:document.activeElement===qaNodes[0],selection:[qaNodes[0].selectionStart,qaNodes[0].selectionEnd],value:qaNodes[0].value,overflow:document.documentElement.scrollWidth>innerWidth+1,originalMessage:qaOwnedError.message}));
  assert(state.same&&state.focus&&!state.overflow);assert.deepEqual(state.selection,[3,8]);assert.equal(state.value,'Observação original — manter 17,25');assert.equal(state.originalMessage,words.pt.receipt);assert.equal(await snapshot(),before);assert.equal(writes.length,0);
 }}
 if(process.env.CW_CAPTURE_UI){fs.mkdirSync('reports/field-ui',{recursive:true});await page.setViewportSize({width:320,height:900});await page.screenshot({path:'reports/field-ui/WRITE_STORE_ERROR_DE_320.png'});}
 console.log('PASS owned error descriptor in legacy loading order, five languages at320/390/1440, stable nodes/focus/caret, byte-identical records and zero operational writes');
 // All guards below execute real store methods; valid data remains unchanged.
 for(const lang of Object.keys(words)){
  await language(lang);
  const guarded=await page.evaluate(async id=>{
   const s=CWFieldWriteStore,out={};const check=async(key,fn)=>{try{await fn();throw Error('Expected rejection: '+key);}catch(e){out[key]={message:e.message,copy:e.copy};}};
   await check('requestMissing',()=>s.get(crypto.randomUUID(),s.session()));
   await check('sessionPreserved',()=>s.records(null,{owner:'TECH:999',token:'wrong'}));
   await check('completionPending',()=>s.prepare('VISIT_COMPLETION',1,{notes:'Different',products:[]}));
   await check('acknowledgementInvalid',()=>s.acknowledgeRejection(id));
   await check('alertInvalid',()=>s.prepare('TECHNICIAN_ALERT',77,{message:'',visitId:null,priority:'NORMAL'}));
   await check('stockInvalid',()=>s.prepare('FIELD_STOCK_REQUEST',77,{}));
   await check('problemInvalid',()=>s.prepare('FIELD_PROBLEM_REPORT',77,{}));
   await check('intakeFields',()=>s.prepare('FIELD_CLIENT_INTAKE',77,{}));
   await check('maintenanceInvalid',()=>s.prepare('EQUIPMENT_MAINTENANCE',5,{}));
   await check('photoInvalid',()=>s.prepare('VISIT_PHOTO',5,{}));
   await check('incompleteContext',()=>s.prepare('VISIT_INCOMPLETE',5,{}));
   window.qaOnline=true;const expiry=CristalAuth.isSessionExpired;CristalAuth.isSessionExpired=()=>true;
   try{await check('expired',()=>s.send(id));}finally{CristalAuth.isSessionExpired=expiry;window.qaOnline=false;}
   let release;const gate=new Promise(resolve=>release=resolve);let acquired;const ready=new Promise(resolve=>acquired=resolve);
   const held=navigator.locks.request('cw-field-write:TECH:77:'+id,async()=>{acquired();await gate;});await ready;
   try{await check('lockBusy',()=>s.send(id));}finally{release();await held;}
   return out;
  },original.requestId);
  for(const [code,error] of Object.entries(guarded)){assert.equal(error.copy?.key,'fieldWriteError',lang+'/'+code);assert.equal(error.copy.params.code,code);assert(error.message.length>10);}
  assert.equal(guarded.expired.message,words[lang].expired);assert.equal(await snapshot(),before);assert.equal(writes.length,0);
 }
 console.log('PASS thirteen store guards in all five languages keep original UUID/payload/hash/label and create no requests or saved rows');
 await language('fr');await page.evaluate(()=>{qaOnline=true;});
 const fallback=await send(original.requestId);assert.equal(fallback.message,words.fr.unconfirmed);assert.equal(fallback.copy.params.code,'sendUnconfirmed');assert.equal(fallback.status,503);
 let saved=await get(original.requestId);assert.equal(saved.failure.message,words.pt.unconfirmed);assert.deepEqual(Object.keys(saved.failure).sort(),['blocked','message','retryAt','status']);assert.equal(saved.failure.blocked,false);
 mode='incomplete';const incomplete=await send(original.requestId);assert.equal(incomplete.message,words.fr.receipt);assert.equal(incomplete.copy.params.code,'receiptIncomplete');saved=await get(original.requestId);assert.equal(saved.failure.message,words.pt.receipt);
 mode='literal';const literal=await send(original.requestId);assert.equal(literal.message,words.pt.receipt);assert.equal(literal.copy,undefined);assert.equal(literal.status,503);
 mode='markup';const markup=await send(original.requestId);assert.equal(markup.copy,undefined);await page.evaluate(()=>{qaOnline=false;});
 const durable=await snapshot(),writeCount=writes.length;
 for(const lang of Object.keys(words)){await language(lang);await page.evaluate(()=>CWFieldOffline.render());assert((await page.locator('[data-pending-visit="1"]').textContent()).includes(markup.message));assert.equal(await page.locator('[data-pending-visit="1"] img,b').count(),0);assert.equal(await snapshot(),durable);assert.equal(writes.length,writeCount);}
 await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>CWFieldOffline.render());assert.equal(await snapshot(),durable);assert.equal(await page.locator('[data-pending-visit="1"] img').count(),0);
 console.log('PASS missing server error and incomplete receipt localize live errors while persisting original Portuguese evidence; identical server text and HTML-like errors remain literal across language changes and reload');
 await page.evaluate(()=>{qaOnline=true;});mode='429';await language('de');const limited=await send(original.requestId);assert.equal(limited.status,429);assert(limited.retryAt>Date.now()+30000&&limited.retryAt<=Date.now()+60000);
 const throttled=await snapshot(),after429=writes.length;
 for(const [lang,w] of Object.entries(words)){await language(lang);const blocked=await send(original.requestId);assert.equal(blocked.copy.params.code,'retryLater');assert(blocked.message.startsWith(w.retry));assert.equal(await snapshot(),throttled);assert.equal(writes.length,after429);}
 const second=await prepare(2);mode='409';await send(second.requestId);const after409=writes.length;
 for(const lang of Object.keys(words)){await language(lang);const blocked=await send(second.requestId,true);assert.equal(blocked.message,words.pt.receipt);assert.equal(blocked.copy,undefined);assert.equal(writes.length,after409);}
 console.log('PASS429 pause and blocked409 preserve retry timing/status/original text and cannot retry merely because the locale changed');
 // A corrupt record must remain readable as an error without rewriting it.
 await page.evaluate(async id=>{const row=await CWFieldWriteStore.get(id,CWFieldWriteStore.session());row.payload.notes='Corrupted original';await new Promise((resolve,reject)=>{const open=indexedDB.open('cw-field-writes',1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('requests','readwrite');tx.objectStore('requests').put(row);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},second.requestId);
 const corrupt=await snapshot();for(const [lang,w] of Object.entries(words)){await language(lang);await page.evaluate(()=>CWFieldOffline.render());assert((await page.locator('#cwFieldStorageError').textContent()).startsWith(w.invalid));assert.equal(await snapshot(),corrupt);assert.equal(writes.length,after409);}
 // Restore exactly the observed test fixture, not a production recovery path.
 await page.evaluate(async row=>{await new Promise((resolve,reject)=>{const open=indexedDB.open('cw-field-writes',1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('requests','readwrite');tx.objectStore('requests').put(row);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},second);
 const third=await prepare(3);mode='lost';const loss=await send(third.requestId);assert.equal(loss.copy,undefined);assert.equal(commits,1);assert(!(await get(third.requestId)).response);
 mode='valid';await language('en');const recovered=await send(third.requestId);assert.deepEqual(recovered.result,receipts.get(third.requestId));assert.equal(commits,1);
 const completedRow=await get(third.requestId);assert.deepEqual(completedRow.payload,third.payload);assert.equal(completedRow.payloadHash,third.payloadHash);assert.equal(completedRow.requestId,third.requestId);assert.equal(completedRow.failure,undefined);
 const duplicate=await page.evaluate(async()=>{try{await CWFieldWriteStore.prepare('VISIT_COMPLETION',3,{notes:'Changed'});}catch(e){return e.copy?.params.code;}});assert.equal(duplicate,'completionAlreadyConfirmed');
 const frozen=await snapshot(),lastWrites=writes.length;for(const lang of Object.keys(words)){await language(lang);assert.deepEqual((await send(third.requestId)).result,recovered.result);assert.equal(await snapshot(),frozen);assert.equal(writes.length,lastWrites);}
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.qaInjected),undefined);
 for(const request of writes){const row=[original,second,third].find(row=>row.requestId===request.body.requestId);assert(row);assert.deepEqual(request.body,{...row.payload,requestId:row.requestId});}
 console.log('PASS corrupt storage warning translates without data loss; lost acknowledgement reuses one mocked server confirmation, exact request/receipt and no resend after confirmation');
 completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();clearTimeout(deadline);});
