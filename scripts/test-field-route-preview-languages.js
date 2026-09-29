'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
// Independent expectations: never derive expected translations from production.
const words = {
 pt:{title:'Sugestão por proximidade',intro:'Distâncias em linha reta',day:'Dia',refresh:'Calcular com a posição atual',close:'Fechar sugestão',visit:'Visita',navigate:'Navegar até esta visita',missing:'Sem coordenadas válidas',plural:'4 visitas em',singular:'1 visita em',empty:'Sem visitas planeadas por iniciar',locating:'A obter a posição atual…',loading:'A consultar as visitas do dia…',deny:'Permita o acesso à localização',failed:'Não foi possível obter a posição atual',invalid:'A posição recebida é inválida ou antiga',absent:'Localização indisponível',choose:'Escolha o dia da rota.',changed:'Dia alterado.',connect:'Ligue à rede',offline:'Sem ligação.',mismatch:'A resposta não corresponde',server:'Não foi possível consultar a rota.',interrupted:'Consulta interrompida.',session:'A sessão mudou.',locale:'pt-PT'},
 en:{title:'Proximity suggestion',intro:'Straight-line distances',day:'Day',refresh:'Calculate from current location',close:'Close suggestion',visit:'Visit',navigate:'Navigate to this visit',missing:'No valid coordinates',plural:'4 visits on',singular:'1 visit on',empty:'No planned visits waiting to start',locating:'Getting the current location…',loading:'Checking the day’s visits…',deny:'Allow location access',failed:'The current location could not be obtained',invalid:'The received location is invalid or outdated',absent:'Location is unavailable',choose:'Choose the route day.',changed:'Day changed.',connect:'Connect to check',offline:'No connection.',mismatch:'The response does not match',server:'The route could not be checked.',interrupted:'Request interrupted.',session:'The session has changed.',locale:'en-GB'},
 fr:{title:'Suggestion par proximité',intro:'Distances à vol d’oiseau',day:'Jour',refresh:'Calculer depuis la position actuelle',close:'Fermer la suggestion',visit:'Visite',navigate:'Itinéraire vers cette visite',missing:'Aucune coordonnée valide',plural:'4 visites le',singular:'1 visite le',empty:'Aucune visite planifiée à commencer',locating:'Obtention de la position actuelle…',loading:'Consultation des visites du jour…',deny:'Autorisez l’accès à la localisation',failed:'Impossible d’obtenir la position actuelle',invalid:'La position reçue est invalide ou ancienne',absent:'La localisation est indisponible',choose:'Choisissez le jour de la tournée.',changed:'Jour modifié.',connect:'Connectez-vous pour consulter',offline:'Aucune connexion.',mismatch:'La réponse ne correspond pas',server:'Impossible de consulter la tournée.',interrupted:'Consultation interrompue.',session:'La session a changé.',locale:'fr-FR'},
 es:{title:'Sugerencia por proximidad',intro:'Distancias en línea recta',day:'Día',refresh:'Calcular desde la posición actual',close:'Cerrar sugerencia',visit:'Visita',navigate:'Navegar hasta esta visita',missing:'Sin coordenadas válidas',plural:'4 visitas el',singular:'1 visita el',empty:'No hay visitas planificadas pendientes de iniciar',locating:'Obteniendo la posición actual…',loading:'Consultando las visitas del día…',deny:'Permita el acceso a la ubicación',failed:'No se ha podido obtener la posición actual',invalid:'La posición recibida no es válida o está desactualizada',absent:'La ubicación no está disponible',choose:'Elija el día de la ruta.',changed:'Día cambiado.',connect:'Conéctese para consultar',offline:'Sin conexión.',mismatch:'La respuesta no corresponde',server:'No se ha podido consultar la ruta.',interrupted:'Consulta interrumpida.',session:'La sesión ha cambiado.',locale:'es-ES'},
 de:{title:'Vorschlag nach Entfernung',intro:'Luftlinienentfernungen',day:'Tag',refresh:'Mit aktuellem Standort berechnen',close:'Vorschlag schließen',visit:'Besuch',navigate:'Zu diesem Besuch navigieren',missing:'Keine gültigen Koordinaten',plural:'4 Besuche am',singular:'1 Besuch am',empty:'Keine geplanten, noch nicht begonnenen Besuche',locating:'Aktueller Standort wird ermittelt…',loading:'Besuche des Tages werden abgefragt…',deny:'Erlauben Sie den Standortzugriff',failed:'Der aktuelle Standort konnte nicht ermittelt werden',invalid:'Der empfangene Standort ist ungültig oder veraltet',absent:'Der Standort ist auf diesem Gerät nicht verfügbar',choose:'Wählen Sie den Tag der Route.',changed:'Tag geändert.',connect:'Stellen Sie eine Verbindung her',offline:'Keine Verbindung.',mismatch:'Die Antwort stimmt nicht',server:'Die Route konnte nicht abgefragt werden.',interrupted:'Abfrage unterbrochen.',session:'Die Sitzung hat sich geändert.',locale:'de-DE'},
};
const fields = ['notes','ph','chlorine','alkalinity','salt','products'];
const controls = ['optimizeRouteBtn','routePreviewDate','routePreviewRefresh','routePreviewClose'];
const day = value => [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
let browser, completed = false; const releases = [];
const deadline = setTimeout(() => { console.error('Route preview language assertions did not finish'); process.exit(1); }, 90000);
process.on('exit',code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
 const tech = await prisma.technician.create({data:{name:'Preview language owner',active:true}}), other = await prisma.technician.create({data:{name:'Preview language other',active:true}});
 const clientName = 'Cliente original <b>Guardar</b>', client = await prisma.client.create({data:{name:clientName,active:true}});
 const today = new Date(), tomorrow = new Date(today), emptyDay = new Date(today); tomorrow.setDate(today.getDate()+1); emptyDay.setDate(today.getDate()+5);
 const make = overrides => prisma.serviceVisit.create({data:{clientId:client.id,technicianId:tech.id,date:today,plannedDate:today,status:'PLANNED',...overrides}});
 const rows = [];
 for (const [name,lat] of [['Far original',0.1],['Near <img src=x onerror=qaPreviewInjected=1>',0.01],['Missing original',null]]) {
  const pool = await prisma.pool.create({data:{clientId:client.id,name,latitude:lat,longitude:lat === null ? null : 0,active:true}}); rows.push(await make({poolId:pool.id}));
 }
 const noPool = await make({poolId:null}); await make({poolId:rows[0].poolId,startAt:today});
 const future = await make({poolId:null,plannedDate:tomorrow});
 const dbSnapshot = () => prisma.serviceVisit.findMany({where:{clientId:client.id},orderBy:{id:'asc'}}), databaseBefore = await dbSnapshot();
 const credential = person => jwt.sign({id:person.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'}), token = credential(tech), otherToken = credential(other);
 browser = await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context = await browser.newContext({viewport:{width:390,height:1000}});
 await context.addInitScript(({token,tech,origin}) => {
  if (top !== window || location.origin !== origin) return;
  if (!localStorage.getItem('qaPreviewLanguageSession')) {
   for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key,token);
   for (const key of ['user','cristalwater_user']) localStorage.setItem(key,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));
   localStorage.setItem('qaPreviewLanguageSession','1');
  }
  const interval = setInterval; window.setInterval = (fn,delay,...args) => delay === 15000 ? 0 : interval(fn,delay,...args);
  window.qaGeo = {mode:'allow',pending:[],calls:0};
  window.qaPosition = (success,failure) => {
   ++qaGeo.calls;
   if (qaGeo.mode === 'hold') qaGeo.pending.push(success);
   else if (qaGeo.mode === 'deny') failure({code:1});
   else if (qaGeo.mode === 'fail') failure({code:2});
   else success({coords:{latitude:qaGeo.mode === 'invalid' ? 91 : 0,longitude:0},timestamp:Date.now()-(qaGeo.mode === 'stale' ? 61000 : 0)});
  };
  Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){},getCurrentPosition:qaPosition}});
  window.alert = () => {};
 },{token,tech,origin:new URL(base).origin});
 const page = await context.newPage(); page.setDefaultTimeout(7000); const errors = [], http = [];
 page.on('pageerror',error => errors.push(error.message));
 page.on('request',request => { const u = new URL(request.url()); if (u.pathname.startsWith('/api/') && u.pathname !== '/api/settings/language/me') http.push({path:u.pathname,query:u.search,method:request.method(),body:request.postData()}); });
 page.on('dialog',dialog => dialog.accept());
 await page.goto(base+'/technician.html',{waitUntil:'networkidle'});
 await page.waitForFunction(id => document.getElementById('notes-'+id)?.readOnly === false,rows[0].id);
 const original = {notes:'Rascunho original <script>qaPreviewInjected=1</script>',ph:'7.4',chlorine:'1.2',alkalinity:'90',salt:'3.5',products:'Produto original 0,25 L'};
 await page.evaluate(({id,values}) => { for (const [field,value] of Object.entries(values)) { const node = document.getElementById(field+'-'+id); node.value=value; node.dispatchEvent(new Event('input',{bubbles:true})); } },{id:rows[0].id,values:original});
 await page.waitForFunction(id => document.getElementById('legacyDraftStatus-'+id)?.getAttribute('data-cw-legacy-text') === 'draftSaved',rows[0].id);
 const storage = () => page.evaluate(async () => {
  const local = Object.fromEntries(Object.keys(localStorage).filter(k => /^(cwLegacy|cwField|cwWorkday|offline)/.test(k)).sort().map(k => [k,localStorage.getItem(k)]));
  const rows = await new Promise((resolve,reject) => { const open=indexedDB.open('cw-field-writes',1); open.onerror=()=>reject(open.error); open.onsuccess=()=>{const db=open.result,tx=db.transaction('requests'),get=tx.objectStore('requests').getAll();tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);}; });
  return JSON.stringify({local,rows});
 });
 const operation = () => page.evaluate(({id,fields}) => ({route:visits.map(v=>v.id),active:activeVisitId(),fields:Object.fromEntries(fields.map(f=>[f,document.getElementById(f+'-'+id)?.value]))}),{id:rows[0].id,fields});
 const originalOperation = await operation(), originalStorage = await storage();
 const status = () => page.locator('#routePreviewStatus').textContent(), list = page.locator('#routePreviewList li');
 const state = key => page.waitForFunction(key => document.getElementById('routePreviewStatus')?.getAttribute('data-cw-legacy-text') === key,key);
 const guards = () => page.evaluate(ids=>ids.map(id=>{const n=document.getElementById(id);return [n.disabled,n.hidden];}),controls);
 async function cycle(kind,widths=[320,390,1440],full=false) {
  const before=await storage(), beforeOperation=await operation(), beforeGuards=await guards(), count=http.length;
  const params=await page.locator('#routePreviewStatus').getAttribute('data-cw-legacy-params');
  const date=await page.locator('#routePreviewDate').inputValue(), links=await page.locator('#routePreviewList a').evaluateAll(nodes=>nodes.map(n=>n.href));
  const calls=await page.evaluate(()=>qaGeo.calls);
  await page.evaluate(()=>{window.qaPreviewNodes=[document.getElementById('fieldRoutePreview'),...document.querySelectorAll('#fieldRoutePreview *')];});
  for (const width of widths) { await page.setViewportSize({width,height:1000}); for (const [language,w] of Object.entries(words)) {
   await page.evaluate(({language,id})=>{const n=document.getElementById('notes-'+id);n.focus();n.setSelectionRange(3,12);CristalI18n.applyLanguage(language);},{language,id:rows[0].id});
   assert.equal(await page.locator('#fieldRoutePreview h2').textContent(),w.title);assert((await page.locator('#fieldRoutePreview > p').first().textContent()).includes(w.intro));
   assert.equal((await page.locator('#fieldRoutePreview label').textContent()).trim(),w.day);assert.equal(await page.locator('#routePreviewRefresh').textContent(),w.refresh);assert.equal(await page.locator('#routePreviewClose').textContent(),w.close);
   assert((await status()).includes(w[kind] || kind),language+': '+kind+' in '+await status());
   if (full) {
    assert.deepEqual(await list.locator('strong').allTextContents(),['Near <img src=x onerror=qaPreviewInjected=1>','Far original','Missing original',w.visit+' '+noPool.id]);
    assert.deepEqual(await page.locator('#routePreviewList a').allTextContents(),[w.navigate,w.navigate]);
    for (const row of await list.all()) assert((await row.textContent()).includes(clientName));
    for (const n of [2,3]) assert((await list.nth(n).textContent()).includes(w.missing));
    const at=JSON.parse(params).at.params.iso;assert((await status()).includes(new Date(at).toLocaleTimeString(w.locale)));assert((await status()).includes('2 '));assert((await status()).includes(date));
   }
   assert.deepEqual(await guards(),beforeGuards);assert.deepEqual(await operation(),beforeOperation);assert.equal(await storage(),before);
   assert.equal(await page.locator('#routePreviewDate').inputValue(),date);assert.equal(await page.locator('#routePreviewStatus').getAttribute('data-cw-legacy-params'),params);assert.deepEqual(await page.locator('#routePreviewList a').evaluateAll(ns=>ns.map(n=>n.href)),links);
   const layout=await page.evaluate(id=>{const n=document.getElementById('notes-'+id);return{same:qaPreviewNodes.every(n=>n.isConnected),focus:document.activeElement===n,selection:[n.selectionStart,n.selectionEnd],width:innerWidth,scroll:document.documentElement.scrollWidth,controls:Array.from(document.querySelectorAll('#fieldRoutePreview input,#fieldRoutePreview button,#fieldRoutePreview a')).filter(n=>!n.hidden).map(n=>{const b=n.getBoundingClientRect();return{id:n.id,text:n.textContent,height:b.height,layoutHeight:n.offsetHeight,left:b.left,right:b.right};})};},rows[0].id);
   assert(layout.same&&layout.focus,'Locale replaced nodes or moved focus');assert.deepEqual(layout.selection,[3,12]);
   assert(layout.scroll<=width+1&&layout.controls.every(b=>b.layoutHeight>=44&&b.height>=43.99&&b.left>=-1&&b.right<=width+1),'Preview controls must fit '+language+': '+JSON.stringify(layout));
   for (const button of await page.locator('#fieldRoutePreview button,#fieldRoutePreview a').all()) assert(await button.evaluate(n=>{n.scrollIntoView({block:'center',behavior:'instant'});const b=n.getBoundingClientRect();return n.contains(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2));}),'Scrolled preview control must be reachable');
  }}
  assert.equal(http.length,count,'Locale must not initiate operational requests');assert.equal(await page.evaluate(()=>qaGeo.calls),calls,'Locale must not acquire another GPS fix');
 }
 const recalculate=async key=>{await page.locator('#routePreviewRefresh').click();await state(key);};
 await page.locator('#cwLanguageSelect').selectOption('en');await page.locator('#optimizeRouteBtn').click();await state('previewSummary');
 assert.equal(await list.count(),4);await cycle('plural',undefined,true);
 assert.equal(await list.first().locator('a').getAttribute('href'),'https://www.google.com/maps/dir/?api=1&destination=0.01%2C0');assert.equal(await page.locator('#routePreviewList img,#routePreviewList b').count(),0);
 if(process.env.CW_CAPTURE_UI){fs.mkdirSync('reports/field-ui',{recursive:true});await page.setViewportSize({width:320,height:1000});await page.locator('#routePreviewStatus').evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:'reports/field-ui/ROUTE_PREVIEW_LANGUAGES_SUMMARY_DE_320.png'});}
 assert.deepEqual(await operation(),originalOperation);assert.equal(await storage(),originalStorage);
 console.log('PASS five languages at320/390/1440: literal pool/client names, unchanged preview order/links/day/timestamp, stable nodes and focus, reachable controls, unchanged operational route/draft/storage and no locale-triggered GPS or HTTP');
 await page.locator('#routePreviewDate').fill(day(tomorrow));await state('previewDayChanged');await cycle('changed',[320]);await recalculate('previewSummaryOne');assert.equal(await list.count(),1);assert((await list.first().textContent()).includes(String(future.id)));await cycle('singular');
 await page.locator('#routePreviewDate').fill(day(emptyDay));await recalculate('previewEmpty');assert.equal(await list.count(),0);await cycle('empty');
 await page.locator('#routePreviewDate').fill('');await recalculate('previewChooseDay');await cycle('choose',[320]);await page.locator('#routePreviewDate').fill(day(today));
 for(const [mode,key,kind] of [['deny','previewPermission','deny'],['fail','previewPositionFailed','failed'],['invalid','previewPositionInvalid','invalid'],['stale','previewPositionInvalid','invalid']]){await page.evaluate(mode=>qaGeo.mode=mode,mode);await recalculate(key);await cycle(kind,[320]);assert.equal(await list.count(),0);}
 await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=undefined;});await recalculate('previewNoLocation');await cycle('absent',[320]);await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=qaPosition;qaGeo.mode='allow';});
 console.log('PASS selected day, singular and empty routes, missing date, denied/unavailable/failed/invalid/stale GPS in five languages; every failure leaves drafts and SQL untouched');
 const endpoint='**/api/route/optimize?*', literal='QA <b>original server evidence</b> '+('X'.repeat(320));
 await page.route(endpoint,route=>route.fulfill({status:503,json:{error:literal}}));await recalculate('literal');await cycle(literal);assert.equal(await status(),literal);assert.equal(await page.locator('#routePreviewStatus b').count(),0);await page.unroute(endpoint);
 await page.route(endpoint,route=>route.fulfill({status:503,json:{}}));await recalculate('previewFailed');await cycle('server',[320]);await page.unroute(endpoint);
 for(const mutation of ['date','mode','owner','duplicate','started','finished','rowOwner','notArray']){
  await page.route(endpoint,async route=>{const response=await route.fetch(),headers={...response.headers()};let json=await response.json();if(mutation==='date')headers['x-cw-route-date']='2000-01-01';if(mutation==='mode')headers['x-cw-route-mode']='wrong';if(mutation==='owner')headers['x-cw-route-technician']=String(other.id);if(mutation==='duplicate')json.push(json[0]);if(mutation==='started')json[0].startAt=new Date().toISOString();if(mutation==='finished')json[0].endAt=new Date().toISOString();if(mutation==='rowOwner')json[0].technicianId=other.id;if(mutation==='notArray')json={};await route.fulfill({response,headers,json});});
  await recalculate('previewMismatch');await cycle('mismatch',[320]);assert.equal(await list.count(),0);await page.unroute(endpoint);
 }
 // Inject the browser's abort rejection without changing the production timer.
 await page.evaluate(()=>{window.qaOriginalFetch=fetch;window.fetch=(url,...args)=>String(url).startsWith('/api/route/optimize?')?Promise.reject(new DOMException('QA abort','AbortError')):qaOriginalFetch(url,...args);});await recalculate('previewInterrupted');await cycle('interrupted',[320]);await page.evaluate(()=>{window.fetch=qaOriginalFetch;delete window.qaOriginalFetch;});
 console.log('PASS literal long server error, missing server message, abort rejection and eight mismatched response variants stay truthful and block stale results in five languages');
 await page.evaluate(()=>qaGeo.mode='hold');await page.locator('#routePreviewRefresh').click();await state('previewLocating');await cycle('locating',[320]);await page.locator('#routePreviewDate').fill(day(tomorrow));await page.evaluate(()=>qaGeo.pending.shift()({coords:{latitude:0,longitude:0},timestamp:Date.now()}));await state('previewDayChanged');await cycle('changed',[320]);assert.equal(await list.count(),0);await page.evaluate(()=>qaGeo.mode='allow');
 async function holdResponse(){let entered,release;const started=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>{release=resolve;releases.push(resolve);});await page.route(endpoint,async route=>{const response=await route.fetch();entered();await gate;await route.fulfill({response}).catch(()=>{});});await page.locator('#routePreviewRefresh').click();await started;return release;}
 let release=await holdResponse();await state('previewLoading');await cycle('loading',[320]);await page.locator('#routePreviewClose').click();release();await page.unroute(endpoint);assert(await page.locator('#fieldRoutePreview').isHidden());assert.equal(await page.evaluate(()=>document.activeElement.id),'optimizeRouteBtn');assert.equal(await list.count(),0);
 await page.locator('#optimizeRouteBtn').click();await state('previewSummaryOne');release=await holdResponse();await context.setOffline(true);await state('previewOffline');release();await page.unroute(endpoint);await cycle('offline',[320]);assert.equal(await list.count(),0);await recalculate('previewConnect');await cycle('connect',[320]);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(id=>document.getElementById('notes-'+id),rows[0].id);assert.equal(await page.evaluate(()=>document.documentElement.lang),'de');await page.locator('#optimizeRouteBtn').click();await state('previewConnect');await cycle('connect',[320]);assert.equal(await storage(),originalStorage);
 // The service-worker offline navigation can retain unrelated asset requests.
 // Wait for the actual online route render and saved fields, not global silence.
 await page.evaluate(id=>{window.qaBeforeOnlineRoute=document.getElementById('notes-'+id);},rows[0].id);
 await context.setOffline(false);await page.waitForFunction(({id,notes})=>!isSyncing&&document.getElementById('notes-'+id)!==qaBeforeOnlineRoute&&document.getElementById('notes-'+id)?.value===notes,{id:rows[0].id,notes:original.notes});await page.locator('#routePreviewDate').fill(day(today));await recalculate('previewSummary');
 console.log('PASS language changes during GPS/HTTP waits, late GPS after day change, close-focus return, in-flight offline cancellation and service-worker offline reload; no stale result is painted');
 const beforeAccount=await storage();release=await holdResponse();
 await page.evaluate(({token,person})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:person.id,name:person.name,role:'TECHNICIAN'}));},{token:otherToken,person:other});
 release();await page.unroute(endpoint);await state('daySession');
 for(const [language,w] of Object.entries(words)){await page.evaluate(lang=>CristalI18n.applyLanguage(lang),language);assert((await status()).includes(w.session));assert.equal(await list.count(),0);assert(await page.locator('#routePreviewRefresh').isDisabled());assert(await page.locator('#routePreviewDate').isDisabled());assert.equal(await storage(),beforeAccount);}
 assert.equal(await page.locator('#notes-'+rows[0].id).count(),0);assert.deepEqual(await dbSnapshot(),databaseBefore);assert.equal(await prisma.auditTrail.count({where:{visitId:{in:databaseBefore.map(x=>x.id)}}}),0);assert.deepEqual(http.filter(r=>r.method!=='GET'),[]);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.qaPreviewInjected),undefined);
 console.log('PASS changed account rejects the late response, clears private form and keeps stored evidence; original SQL visits unchanged, zero operational writes/audits and no script injection');
 completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const release of releases)release();await browser?.close();await prisma.$disconnect();clearTimeout(deadline);});
