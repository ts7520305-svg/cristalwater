'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret'), wait = require('./fixtures/wait-browser-state');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
// Independent expected wording, never obtained from the production dictionary.
const copy = {
  pt:{send:'Enviar alerta à administração',confirm:'Confirmar alerta guardado',clear:'Limpar rascunho confirmado',visit:'Visita',priority:'Prioridade',none:'Sem visita associada',normal:'Normal',urgent:'Urgente',local:'O texto fica guardado neste dispositivo até enviar.',draft:'Rascunho guardado neste dispositivo; ainda não enviado.',empty:'Escreva o alerta antes de enviar.',unsent:'O alerta não foi enviado.',notSaved:'O texto não ficou guardado.',pending:'Alerta guardado neste dispositivo, por confirmar.',savedError:'Alerta guardado, por confirmar.',unread:'A leitura ainda não está confirmada.',already:'Alerta já confirmado; o rascunho foi preservado.',conflict:'O rascunho mudou noutra janela.',corrupt:'Rascunho do alerta ilegível.',missing:'O pedido do rascunho não foi encontrado.',mismatch:'O rascunho difere do alerta guardado.',session:'A sessão mudou.',unknown:'confirmar contexto com o escritório'},
  en:{send:'Send alert to administration',confirm:'Confirm saved alert',clear:'Clear confirmed draft',visit:'Visit',priority:'Priority',none:'No linked visit',normal:'Normal',urgent:'Urgent',local:'The text stays saved on this device until you send it.',draft:'Draft saved on this device; not sent yet.',empty:'Write the alert before sending.',unsent:'The alert was not sent.',notSaved:'The text was not saved.',pending:'Alert saved on this device, awaiting confirmation.',savedError:'Alert saved, awaiting confirmation.',unread:'Reading has not yet been confirmed.',already:'Alert already confirmed; the draft was preserved.',conflict:'The draft changed in another window.',corrupt:'Unreadable alert draft.',missing:'The draft request was not found.',mismatch:'The draft differs from the saved alert.',session:'The session has changed.',unknown:'confirm context with the office'},
  fr:{send:'Envoyer l’alerte à l’administration',confirm:'Confirmer l’alerte enregistrée',clear:'Effacer le brouillon confirmé',visit:'Visite',priority:'Priorité',none:'Aucune visite associée',normal:'Normale',urgent:'Urgente',local:'Le texte reste enregistré sur cet appareil jusqu’à l’envoi.',draft:'Brouillon enregistré sur cet appareil ; pas encore envoyé.',empty:'Rédigez l’alerte avant de l’envoyer.',unsent:'L’alerte n’a pas été envoyée.',notSaved:'Le texte n’a pas été enregistré.',pending:'Alerte enregistrée sur cet appareil, à confirmer.',savedError:'Alerte enregistrée, à confirmer.',unread:'La lecture n’est pas encore confirmée.',already:'Alerte déjà confirmée ; le brouillon a été conservé.',conflict:'Le brouillon a changé dans une autre fenêtre.',corrupt:'Brouillon d’alerte illisible.',missing:'La demande du brouillon est introuvable.',mismatch:'Le brouillon diffère de l’alerte enregistrée.',session:'La session a changé.',unknown:'confirmer le contexte avec le bureau'},
  es:{send:'Enviar alerta a administración',confirm:'Confirmar alerta guardada',clear:'Borrar borrador confirmado',visit:'Visita',priority:'Prioridad',none:'Sin visita asociada',normal:'Normal',urgent:'Urgente',local:'El texto queda guardado en este dispositivo hasta enviarlo.',draft:'Borrador guardado en este dispositivo; aún no enviado.',empty:'Escriba la alerta antes de enviarla.',unsent:'La alerta no se ha enviado.',notSaved:'El texto no se ha guardado.',pending:'Alerta guardada en este dispositivo, por confirmar.',savedError:'Alerta guardada, por confirmar.',unread:'La lectura aún no está confirmada.',already:'Alerta ya confirmada; se ha conservado el borrador.',conflict:'El borrador ha cambiado en otra ventana.',corrupt:'Borrador de alerta ilegible.',missing:'No se ha encontrado la solicitud del borrador.',mismatch:'El borrador difiere de la alerta guardada.',session:'La sesión ha cambiado.',unknown:'confirmar el contexto con la oficina'},
  de:{send:'Meldung an die Verwaltung senden',confirm:'Gespeicherte Meldung bestätigen',clear:'Bestätigten Entwurf löschen',visit:'Besuch',priority:'Priorität',none:'Kein zugeordneter Besuch',normal:'Normal',urgent:'Dringend',local:'Der Text bleibt bis zum Senden auf diesem Gerät gespeichert.',draft:'Entwurf auf diesem Gerät gespeichert; noch nicht gesendet.',empty:'Schreiben Sie die Meldung vor dem Senden.',unsent:'Die Meldung wurde nicht gesendet.',notSaved:'Der Text wurde nicht gespeichert.',pending:'Meldung auf diesem Gerät gespeichert, Bestätigung ausstehend.',savedError:'Meldung gespeichert, Bestätigung ausstehend.',unread:'Das Lesen wurde noch nicht bestätigt.',already:'Meldung bereits bestätigt; der Entwurf bleibt erhalten.',conflict:'Der Entwurf wurde in einem anderen Fenster geändert.',corrupt:'Der Meldungsentwurf ist unlesbar.',missing:'Die Anfrage des Entwurfs wurde nicht gefunden.',mismatch:'Der Entwurf weicht von der gespeicherten Meldung ab.',session:'Die Sitzung hat sich geändert.',unknown:'Kontext mit dem Büro klären'},
};
const ids = ['internalAlert','internalAlertVisit','internalAlertPriority','sendAlertBtn','internalAlertStatus'];
let browser, completed=false; const releases=[];
const deadline=setTimeout(()=>{console.error('Internal-alert language assertions did not finish');process.exit(1);},90000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
  const tech=await prisma.technician.create({data:{name:'Alert language owner',active:true}}), other=await prisma.technician.create({data:{name:'Alert language other',active:true}});
  const client=await prisma.client.create({data:{name:'Alert language client',active:true}}), pool=await prisma.pool.create({data:{name:'Piscina Original <b>Azul</b>',clientId:client.id,active:true}});
  const visit=await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:tech.id,date:new Date(),plannedDate:new Date(),status:'PLANNED'}});
  const credential=person=>jwt.sign({id:person.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'}), token=credential(tech), otherToken=credential(other);
  browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:390,height:900}});
  await context.addInitScript(({token,tech,origin})=>{
    if(top!==window||location.origin!==origin)return;
    // Alert recovery, the pageshow refresh and offline route hydration read
    // independently. An enabled button alone does not mean boot has finished.
    window.qaAlertBoot={pageshow:false,reads:0};
    window.addEventListener('pageshow',()=>{qaAlertBoot.pageshow=true;},{once:true});
    let writeStore;
    Object.defineProperty(window,'CWFieldWriteStore',{configurable:true,get:()=>writeStore,set(value){
      writeStore=value;const records=value.records;
      value.records=async function(...args){qaAlertBoot.reads++;try{return await records.apply(this,args);}finally{qaAlertBoot.reads--;}};
    }});
    if(!localStorage.getItem('qaAlertLanguageSession')){
      for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);
      for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));
      localStorage.setItem('qaAlertLanguageSession','1');
    }
    // Keep language-only assertions independent of the unrelated periodic route
    // reload. The original alert UI group retains the unmodified page interval.
    const interval=setInterval;window.setInterval=(fn,delay,...args)=>delay===15000?0:interval(fn,delay,...args);
    Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});window.alert=()=>{};
  },{token,tech,origin:new URL(base).origin});
  const page=await context.newPage();page.setDefaultTimeout(7000);const errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  const endpoint=base+'/api/visits/internal-alert';
  page.on('request',request=>{if(request.url()===endpoint)requests.push(request.postDataJSON());});
  const key='cwFieldInternalAlertDraft:TECH:'+tech.id;
  const raw=()=>page.evaluate(key=>localStorage.getItem(key),key);
  const rows=()=>page.evaluate(()=>CWFieldWriteStore.records('TECHNICIAN_ALERT',CWFieldWriteStore.session(),true));
  const status=()=>page.locator('#internalAlertStatus').textContent();
  const ready=()=>page.waitForFunction(()=>!document.getElementById('sendAlertBtn').disabled);
  const remember=()=>page.evaluate(ids=>{window.qaAlertNodes=ids.map(id=>document.getElementById(id));window.qaAlertOptions=Array.from(document.querySelectorAll('#internalAlertVisit option,#internalAlertPriority option'));},ids);
  const open=async()=>{await page.goto(base+'/technician.html',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.getElementById('internalAlertStatus')?.textContent.length>0);await remember();};
  async function cycle(fragments,button='send',widths=[320,390,1440], options={}){
    const before={raw:await raw(),rows:JSON.stringify(await rows()),requests:requests.length};
    const form=()=>page.evaluate(()=>{const input=document.getElementById('internalAlert'),visit=document.getElementById('internalAlertVisit'),priority=document.getElementById('internalAlertPriority');return{message:input.value,visit:visit.value,priority:priority.value,gates:[input.readOnly,visit.disabled,priority.disabled,document.getElementById('sendAlertBtn').disabled]};});
    const initial=await form();
    for(const width of widths){await page.setViewportSize({width,height:900});for(const [lang,words] of Object.entries(copy)){
      await page.evaluate(lang=>{const input=document.getElementById('internalAlert');input.focus();input.setSelectionRange(2,7);CristalI18n.applyLanguage(lang);},lang);
      await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);
      const text=await status();for(const fragment of fragments(words))assert(text.includes(fragment),lang+': '+fragment+' in '+text);
      assert.equal(await page.locator('#sendAlertBtn').textContent(),words[button]);
      assert.deepEqual(await page.locator('#internalAlertPriority option').allTextContents(),[words.normal,words.urgent]);
      assert.equal(await page.locator('label').filter({has:page.locator('#internalAlertPriority')}).locator('span').textContent(),words.priority);
      assert.equal(await page.locator('label').filter({has:page.locator('#internalAlertVisit')}).locator('span').textContent(),words.visit);
      if(!options.noVisits)assert.equal(await page.locator('#internalAlertVisit option').first().textContent(),words.none);
      if(options.unknown)assert((await page.locator('#internalAlertVisit option:checked').textContent()).includes(words.unknown));
      else if(initial.visit){const label=await page.locator('#internalAlertVisit option:checked').textContent();assert(label.startsWith(words.visit+' '+initial.visit+' · '));assert(label.includes(pool.name),'Pool name must remain literal in every language');}
      assert.deepEqual(await form(),initial,'Locale must preserve values and every guard');
      assert.equal(await raw(),before.raw,'Locale must preserve exact draft bytes');
      assert.equal(JSON.stringify(await rows()),before.rows,'Locale must preserve UUID, payload, hash, owner, failures and receipts');
      const layout=await page.evaluate(ids=>({same:ids.every((id,i)=>document.getElementById(id)===qaAlertNodes[i]),options:qaAlertOptions.every(node=>node.isConnected),focus:document.activeElement===qaAlertNodes[0],selection:[qaAlertNodes[0].selectionStart,qaAlertNodes[0].selectionEnd],overflow:document.documentElement.scrollWidth>innerWidth+1,controls:ids.slice(0,4).map(id=>{const node=document.getElementById(id),b=node.getBoundingClientRect();return{id,height:b.height,layoutHeight:node.offsetHeight,left:b.left,right:b.right};})}),ids);
      assert(layout.same&&layout.options,'Locale must retain original form and option nodes');assert(layout.focus,'Locale must retain textarea focus');
      assert.deepEqual(layout.selection,[Math.min(2,initial.message.length),Math.min(7,initial.message.length)],'Locale must retain caret/selection');
      // translateY hover can report 43.99994px for a real 44px control. Allow
      // only 0.01px of paint rounding, while still requiring 44px of layout.
      assert(!layout.overflow&&layout.controls.every(b=>b.layoutHeight>=44&&b.height>=43.99&&b.left>=-1&&b.right<=width+1),'Alert controls must fit '+width+'/'+lang+': '+JSON.stringify(layout));
    }}
    assert.equal(requests.length,before.requests,'Changing language must never send/recover an alert');
  }
  await open();await ready();
  await page.locator('#cwLanguageSelect').selectOption('en');
  await page.waitForFunction(()=>document.getElementById('sendAlertBtn').textContent==='Send alert to administration');
  await cycle(words=>[words.local]);
  await page.locator('#sendAlertBtn').click();await cycle(words=>[words.unsent,words.empty],'send',[320]);assert.equal(requests.length,0);
  console.log('PASS actual alert controls and local validation in five languages at 320/390/1440; stable nodes, focus, guards and zero submissions');
  await page.evaluate(()=>{window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('cwFieldInternalAlertDraft:'))throw new DOMException('QA draft quota','QuotaExceededError');return qaSetItem.call(this,key,value);};});
  await page.locator('#internalAlert').fill('Rascunho sem espaço');
  await cycle(words=>[words.notSaved,'QA draft quota'],'send',[320]);
  await page.locator('#sendAlertBtn').click();await cycle(words=>[words.unsent,'QA draft quota'],'send',[320]);assert.equal(requests.length,0);
  await page.evaluate(()=>{Storage.prototype.setItem=qaSetItem;delete window.qaSetItem;});
  const message='Avaria original <img src=x onerror=window.qaInjected=true> — manter água';
  await page.locator('#internalAlert').fill(message);await page.locator('#internalAlertVisit').selectOption(String(visit.id));await page.locator('#internalAlertPriority').selectOption('HIGH');
  await cycle(words=>[words.draft]);
  assert((await page.locator('#internalAlertVisit option:checked').textContent()).includes(pool.name));
  await page.evaluate(()=>CWFieldInternalAlert.setVisits([]));await remember();
  await cycle(words=>[words.draft],'send',[320],{unknown:true});
  await page.evaluate(visit=>CWFieldInternalAlert.setVisits([visit]),{...visit,pool});await remember();
  console.log('PASS draft quota blocks submissions; editable draft and missing visit context keep exact text, visit, HIGH enum, selection and bytes in five languages');

  await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);
  await page.locator('#sendAlertBtn').click();await ready();
  await wait(page,()=>CWFieldWriteStore.records('TECHNICIAN_ALERT').then(rows=>rows.length===1));
  const original=(await rows())[0], pendingRaw=await raw();
  assert.deepEqual(original.payload,{message,visitId:visit.id,priority:'HIGH'});assert.equal(original.label,'Alerta para a administração');assert.equal(requests.length,0);
  await page.reload({waitUntil:'domcontentloaded'});await ready();
  await page.waitForFunction(()=>qaAlertBoot.pageshow&&qaAlertBoot.reads===0&&routeViewSource==='offline');
  await remember();
  assert.equal(await raw(),pendingRaw);assert.equal(await page.locator('#internalAlert').inputValue(),message);
  assert.equal(await page.evaluate(()=>document.documentElement.lang),'de');assert.equal(await page.locator('#sendAlertBtn').textContent(),copy.de.confirm);
  await cycle(words=>[words.pending],'confirm');
  if(process.env.CW_CAPTURE_UI){fs.mkdirSync('reports/field-ui',{recursive:true});await page.setViewportSize({width:320,height:900});await page.locator('.card').filter({has:page.locator('#internalAlert')}).screenshot({path:'reports/field-ui/INTERNAL_ALERT_LANGUAGES_PENDING_DE_320.png'});}
  console.log('PASS real service-worker offline reload retains original alert UUID/payload/hash/owner and exact draft bytes; five-language pending state at three widths');

  // Retain complete server evidence as text; changing language must not retry it.
  const serverMessage='Original <script>qaInjected=1</script> evidence';
  await page.route(endpoint,route=>route.fulfill({status:503,json:{error:serverMessage}}));
  // Cached options already satisfy a presence check. Online recovery starts
  // two real route loads; wait for both to finish before remembering nodes.
  await page.evaluate(()=>{
    window.qaAlertOnlineRoutes={started:0,pending:0};window.qaAlertLoadRoute=window.loadRoute;
    window.loadRoute=async function(...args){qaAlertOnlineRoutes.started++;qaAlertOnlineRoutes.pending++;try{return await qaAlertLoadRoute.apply(this,args);}finally{qaAlertOnlineRoutes.pending--;}};
  });
  await context.setOffline(false);
  await page.waitForFunction(id=>qaAlertOnlineRoutes.started>0&&qaAlertOnlineRoutes.pending===0&&!isSyncing&&routeViewSource==='server'&&document.querySelector('#internalAlertVisit option[value="'+id+'"]'),visit.id);
  await page.evaluate(()=>{window.loadRoute=qaAlertLoadRoute;delete window.qaAlertLoadRoute;delete window.qaAlertOnlineRoutes;});await remember();
  await page.locator('#sendAlertBtn').click();await ready();await page.waitForFunction(text=>document.getElementById('internalAlertStatus').textContent.includes(text),serverMessage);await remember();
  await cycle(words=>[words.savedError,serverMessage],'confirm');
  assert.equal(await page.locator('#internalAlertStatus script').count(),0);assert.equal(await page.evaluate(()=>window.qaInjected),undefined);
  await page.unroute(endpoint);
  let entered, release;const started=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;releases.push(resolve);});
  await page.route(endpoint,async route=>{await route.fetch();entered();await gate;await route.abort('failed').catch(()=>{});});
  await page.locator('#sendAlertBtn').click();await started;
  assert(await page.locator('#sendAlertBtn').isDisabled());
  await cycle(words=>[words.savedError,serverMessage],'confirm',[320]);
  release();await ready();await page.unroute(endpoint);await remember();
  const notificationWhere={eventType:'TECHNICIAN_INTERNAL_ALERT',metadata:{path:['requestId'],equals:original.requestId}};
  assert.equal(await prisma.notification.count({where:notificationWhere}),1);
  const afterLoss=(await rows())[0];assert.equal(afterLoss.requestId,original.requestId);assert.equal(afterLoss.payloadHash,original.payloadHash);assert.deepEqual(afterLoss.payload,original.payload);assert(!afterLoss.response);
  await cycle(words=>[words.savedError],'confirm',[320]);
  console.log('PASS literal server error and language changes during a committed POST with lost acknowledgement preserve one SQL alert and the original pending request');

  await page.evaluate(()=>{window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,raw){if(key.startsWith('cwFieldInternalAlertDraft:')&&JSON.parse(raw).message==='')throw new DOMException('QA confirmed draft quota','QuotaExceededError');return qaSetItem.call(this,key,raw);};});
  await page.locator('#sendAlertBtn').click();await ready();await page.waitForFunction(()=>document.getElementById('sendAlertBtn').getAttribute('data-cw-legacy-text')==='alertClear');await remember();
  await cycle(words=>[words.already,'QA confirmed draft quota'],'clear');
  const receipt=(await rows())[0].response;assert.equal(receipt.receipt.owner,original.owner);assert.equal(receipt.receipt.requestId,original.requestId);assert.equal(receipt.receipt.payloadHash,original.payloadHash);
  assert.equal(await page.locator('#internalAlert').inputValue(),message);
  const beforeClear=requests.length;await page.evaluate(()=>{Storage.prototype.setItem=qaSetItem;delete window.qaSetItem;});
  await page.locator('#sendAlertBtn').click();await ready();await remember();await cycle(words=>[words.unread,String(receipt.alert.id)]);
  assert.equal(requests.length,beforeClear);assert.equal(await page.locator('#internalAlert').inputValue(),'');assert.deepEqual((await rows())[0].response,receipt);
  const notice=await prisma.notification.findUniqueOrThrow({where:{id:receipt.alert.id}});assert.equal(notice.isRead,false);assert.equal(notice.role,'ADMIN');assert.equal(notice.message,message);assert.equal(await prisma.notification.count({where:notificationWhere}),1);
  for(const body of requests)assert.deepEqual(body,{...original.payload,requestId:original.requestId});
  console.log('PASS receipt plus failed draft cleanup stays translated and recoverable; clear sends nothing, original receipt remains exact, ADMIN alert exists once and reading is not claimed');

  await page.locator('#internalAlert').fill('Texto desta janela');
  const second=await context.newPage();await second.goto(base+'/technician.html',{waitUntil:'networkidle'});await second.waitForFunction(()=>!document.getElementById('internalAlert').readOnly);
  await second.locator('#internalAlert').fill('Texto diferente noutra janela');await page.waitForFunction(()=>document.getElementById('sendAlertBtn').disabled);await remember();
  await cycle(words=>[words.conflict],'send',[320]);assert.equal(await page.locator('#internalAlert').inputValue(),'Texto desta janela');assert.equal(JSON.parse(await raw()).message,'Texto diferente noutra janela');await second.close();
  for(const [value,fragment] of [['{interrupted','corrupt'],[JSON.stringify({v:1,message:'Original malformed',visitId:null,priority:'WRONG',requestId:null}),'corrupt'],[JSON.stringify({v:1,message:'Original missing',visitId:null,priority:'NORMAL',requestId:require('node:crypto').randomUUID()}),'missing']]){
    await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key,value});await open();
    await cycle(words=>[words[fragment]],'send',[320]);assert.equal(await raw(),value);assert(await page.locator('#sendAlertBtn').isDisabled());
  }
  await page.evaluate(({key,original})=>localStorage.setItem(key,JSON.stringify({v:1,...original.payload,message:'Different local draft',requestId:original.requestId})),{key,original});await open();
  await cycle(words=>[words.mismatch],'send',[320]);assert.deepEqual((await rows())[0].response,receipt);
  console.log('PASS real cross-tab conflict, corrupt/invalid draft, missing request and conflicting draft remain blocked, translated and byte-preserving');

  await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({v:1,message:'Original account draft',visitId:null,priority:'NORMAL',requestId:null})),key);await open();await ready();
  const ownerRaw=await raw();
  await page.evaluate(({token,person})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:person.id,name:person.name,role:'TECHNICIAN'}));}, {token:otherToken,person:other});
  await page.waitForFunction(()=>document.getElementById('internalAlertStatus').getAttribute('data-cw-legacy-text')==='alertSession');await remember();
  await cycle(words=>[words.session],'send',[320],{noVisits:true});assert.equal(await page.locator('#internalAlert').inputValue(),'');assert.equal(await raw(),ownerRaw);assert.deepEqual(await rows(),[]);
  if(process.env.CW_CAPTURE_UI){await page.locator('.card').filter({has:page.locator('#internalAlert')}).screenshot({path:'reports/field-ui/INTERNAL_ALERT_LANGUAGES_SESSION_DE_320.png'});}
  assert.equal(await page.locator('#internalAlert').evaluate(node=>node.querySelector('img')),null);assert.equal(await page.evaluate(()=>window.qaInjected),undefined);assert.deepEqual(errors,[]);
  console.log('PASS changed account cannot expose/send the original draft or receipt; translated session guard preserves the original bytes; no injected markup or browser errors');
  completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const release of releases)release();await browser?.close();await prisma.$disconnect();clearTimeout(deadline);});
