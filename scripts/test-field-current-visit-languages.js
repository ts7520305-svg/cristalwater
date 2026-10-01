'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),{chromium}=require('playwright');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const languages=['pt','en','fr','es','de'];
const profile=process.env.CW_NOW_BOARD_SCENARIO||'states';assert(['states','time'].includes(profile));
const words={
  "nowCurrent": [
    "Visita atual",
    "Current visit",
    "Visite actuelle",
    "Visita actual",
    "Aktueller Besuch"
  ],
  "nowStateTODO": [
    "Por iniciar",
    "Not started",
    "À commencer",
    "Por iniciar",
    "Noch nicht begonnen"
  ],
  "nowStateTRAVEL": [
    "A caminho",
    "On the way",
    "En route",
    "En camino",
    "Unterwegs"
  ],
  "nowStateIN_PROGRESS": [
    "Em intervenção",
    "Work in progress",
    "Intervention en cours",
    "Intervención en curso",
    "Arbeiten im Gange"
  ],
  "nowStateWATER_OPEN": [
    "Água aberta",
    "Water running",
    "Eau ouverte",
    "Agua abierta",
    "Wasser läuft"
  ],
  "nowStateWAITING_MATERIAL": [
    "A aguardar material",
    "Waiting for materials",
    "En attente de matériel",
    "Esperando material",
    "Warten auf Material"
  ],
  "nowStateCRITICAL": [
    "Alerta crítico",
    "Critical alert",
    "Alerte critique",
    "Alerta crítica",
    "Kritischer Hinweis"
  ],
  "nowStateDONE": [
    "Concluída",
    "Completed",
    "Terminée",
    "Completada",
    "Abgeschlossen"
  ],
  "nowStateINCOMPLETE": [
    "Por concluir",
    "Incomplete",
    "À terminer",
    "Por completar",
    "Noch abzuschließen"
  ],
  "nowFree": [
    "Hoje está livre",
    "No visits pending today",
    "Aucune visite en attente aujourd’hui",
    "Sin visitas pendientes hoy",
    "Heute keine ausstehenden Besuche"
  ],
  "nowFreeAction": [
    "Ver agenda ou comunicar com o administrador",
    "View the schedule or contact the administrator",
    "Consulter le planning ou contacter l’administrateur",
    "Ver la agenda o contactar con el administrador",
    "Terminplan ansehen oder die Verwaltung kontaktieren"
  ],
  "nowFreeTiming": [
    "Sem intervenção ativa neste momento",
    "No active intervention at the moment",
    "Aucune intervention en cours actuellement",
    "Sin intervención activa en este momento",
    "Derzeit keine laufenden Arbeiten"
  ],
  "nowTechnician": [
    "Técnico por confirmar",
    "Technician to be confirmed",
    "Technicien à confirmer",
    "Técnico por confirmar",
    "Techniker noch zu bestätigen"
  ],
  "nowResponsible": [
    "Responsável por confirmar",
    "Responsible person to be confirmed",
    "Responsable à confirmer",
    "Responsable por confirmar",
    "Zuständige Person noch zu bestätigen"
  ],
  "nowRepair": [
    "Reparação",
    "Repair",
    "Réparation",
    "Reparación",
    "Reparatur"
  ],
  "nowMaintenance": [
    "Manutenção",
    "Maintenance",
    "Entretien",
    "Mantenimiento",
    "Wartung"
  ],
  "nowNoTime": [
    "Sem tempo em curso",
    "No timer running",
    "Aucun chronométrage en cours",
    "Sin tiempo en curso",
    "Keine laufende Zeitmessung"
  ],
  "nowElapsed": [
    "{minutes} minuto(s) em intervenção",
    "{minutes} minute(s) of work",
    "{minutes} minute(s) d’intervention",
    "{minutes} minuto(s) de intervención",
    "{minutes} Minute(n) im Einsatz"
  ]
};
let browser,completed=false;
const deadline=setTimeout(()=>{console.error('Current-visit language scenario did not finish');process.exit(1);},110000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
 const now=Date.now(),vehicle=await prisma.vehicle.create({data:{plate:'QA-NOW-'+now,active:true}}),tech=await prisma.technician.create({data:{name:'Técnico por confirmar',vehicleId:vehicle.id,active:true}}),emptyTech=await prisma.technician.create({data:{name:'',active:true}}),client=await prisma.client.create({data:{name:'Cliente literal',active:true}});
 const pool=await prisma.pool.create({data:{name:'Piscina',clientId:client.id,active:true}}),extraPool=await prisma.pool.create({data:{name:'Extra <b>{minutes}</b>',clientId:client.id,active:true}}),emptyPool=await prisma.pool.create({data:{name:'',clientId:client.id,active:true}});
 const max=await Promise.all([prisma.serviceVisit.aggregate({_max:{id:true}}),prisma.extraVisit.aggregate({_max:{id:true}})]),id=Math.max(...max.map(x=>x._max.id||0))+1,planned=new Date();planned.setHours(23,59,59,0);
 const common={id,clientId:client.id,technicianId:tech.id,status:'PLANNED'};await prisma.serviceVisit.create({data:{...common,poolId:pool.id,date:new Date(),plannedDate:planned}});await prisma.extraVisit.create({data:{...common,poolId:extraPool.id,scheduledAt:new Date()}});for(const table of ['ServiceVisit','ExtraVisit'])await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),${id},true)`);
 const emptyVisit=await prisma.serviceVisit.create({data:{clientId:client.id,technicianId:emptyTech.id,poolId:emptyPool.id,status:'PLANNED',date:new Date(),plannedDate:planned}});
 const guide=await prisma.transportGuide.create({data:{vehicleId:vehicle.id,codeAT:'QA-NOW-'+now,status:'ACTIVE',validUntil:new Date(now+86400000),isDraft:false}});await prisma.workGuide.create({data:{vehicleId:vehicle.id,technicianId:tech.id,guideId:guide.id,status:'OPEN',isDraft:false}});for(const type of ['INSURANCE','INSPECTION'])await prisma.vehicleMaintenanceRecord.create({data:{vehicleId:vehicle.id,type,title:type,status:'ACTIVE',dueDate:new Date(now+30*86400000)}});
 const sign=t=>jwt.sign({id:t.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'}),token=sign(tech),draft={v:2,owner:'TECH:'+tech.id,drafts:{['visit-REGULAR-'+id]:{values:{notes:'Nota literal <b>{minutes}</b>'},checks:{},startedAt:new Date(now-65*60000).toISOString(),pendingProblems:[{severity:'Normal',visitId:id,message:'Problema literal',createdAt:new Date(now).toISOString()}]}}};
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});const context=await browser.newContext({viewport:{width:390,height:900},timezoneId:'Europe/Lisbon'});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await context.addInitScript(({token,tech,vehicle,draft,origin,now})=>{if(top!==window||location.origin!==origin)return;if(!localStorage.getItem('qaNowBoard')){for(const k of ['token','cristalwater_jwt'])localStorage.setItem(k,token);for(const k of ['user','cristalwater_user'])localStorage.setItem(k,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));localStorage.setItem('cwVehicleId',String(vehicle.id));localStorage.setItem('cwFieldVisitDrafts:v2:TECH:'+tech.id,JSON.stringify(draft));localStorage.setItem('qaNowBoard','1');}window.qaNow=now;Date.now=()=>qaNow;const interval=setInterval;window.setInterval=(fn,delay,...args)=>[15000,30000,60000].includes(delay)?0:interval(fn,delay,...args);Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});},{token,tech,vehicle,draft,origin:base,now});
 const page=await context.newPage(),errors=[],requests=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))requests.push({path,method:r.method(),body:r.postData()});});
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))),locale=async lang=>{await page.locator('#cwLanguageSelect').selectOption(lang);await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);await settle();};
 const text=(key,i,params={})=>words[key][i].replace(/\{(\w+)\}/g,(_,key)=>String(params[key]??''));
 const database=()=>Promise.all([prisma.serviceVisit.findMany({where:{id:{in:[id,emptyVisit.id]}}}),prisma.extraVisit.findUnique({where:{id}}),prisma.operationalReminder.findMany({where:{assignedToTechnicianId:{in:[tech.id,emptyTech.id]}}}),prisma.technicalHistory.findMany({where:{poolId:{in:[pool.id,extraPool.id,emptyPool.id]}}})]);
 const instrument=()=>page.evaluate(()=>{window.qaNowCalls={};window.qaNowGuard=0;window.qaNowDocumentReads=0;window.qaNowDocumentPending=0;const same=CWFieldDocuments.same;CWFieldDocuments.same=(...args)=>{qaNowGuard++;return same(...args);};for(const [group,api,names]of [['reminder',CWFieldReminders,['list','create','mark','sync','context']],['journal',CWFieldAlertJournal,['scope','read','record','states']],['documents',CWFieldDocuments,['load','scope']],['offline',CWFieldOffline,['pending']],['photos',CWFieldPhotos,['list','save','sync']],['route',CWFieldRouteCache,['read','save','update']]])for(const name of names){const fn=api[name];api[name]=(...args)=>{const key=group+':'+name;qaNowCalls[key]=(qaNowCalls[key]||0)+1;if(group==='documents'&&name==='load'){qaNowDocumentReads++;qaNowDocumentPending++;return fn(...args).finally(()=>{qaNowDocumentPending--;});}return fn(...args);};}});
 const ready=async()=>{await page.waitForFunction(()=>!['…',''].includes(document.getElementById('fieldPhotosValue')?.textContent));await page.waitForFunction(()=>/^(Válidos|Valid|Valides|Gültig)$/.test(document.getElementById('fieldDocsValue')?.textContent||''));await settle();};
 const open=async(type='REGULAR',free=false)=>{await page.goto(base+`/technician-field-mode?selectedVisitId=${id}&selectedVisitType=${type}`,{waitUntil:'domcontentloaded'});await page.waitForFunction(({id,type,free})=>free?!CWFieldVisitContext()&&document.body.dataset.fieldMode==='free':CWFieldVisitContext()?.id===id&&CWFieldVisitContext().visitType===type,{id,type,free});await ready();await page.locator('[data-field-tab-button=agora]').click();await instrument();};
 // Exercise the existing bfcache restoration path for repeated cache fixtures.
 const refresh=async()=>{const reads=await page.evaluate(()=>qaNowDocumentReads);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.waitForFunction(reads=>qaNowDocumentReads>reads&&!qaNowDocumentPending,reads);await ready();await page.locator('[data-field-tab-button=agora]').click();};
 const select=async type=>{await page.locator('[data-field-tab-button=hoje]').click();const row=page.locator('#visitList [data-visit-index]').filter({hasText:type==='REGULAR'?pool.name:extraPool.name});let found=false;for(const filter of ['TODO','IN_PROGRESS','DONE']){await page.locator('[data-pool-filter='+filter+']').click();const count=await row.count();assert(count<=1);if(count){found=true;await row.click();break;}}assert(found);await page.waitForFunction(type=>CWFieldVisitContext()?.visitType===type,type);await ready();await page.locator('[data-field-tab-button=agora]').click();};
 const state=()=>page.evaluate(async()=>({focus:document.activeElement.id,tab:document.activeElement.dataset.fieldTabButton,notes:document.getElementById('notes').value,water:document.getElementById('waterNote').value,visit:CWFieldVisitContext(),calls:{...qaNowCalls},tokens:['token','cristalwater_jwt'].map(k=>localStorage.getItem(k)),stored:Object.keys(localStorage).filter(k=>k.startsWith('cwField')||k.startsWith('cwWater')||k.startsWith('cwPump')||k.startsWith('cw:tech')).sort().map(k=>[k,localStorage.getItem(k)]),writes:await CWFieldWriteStore.records(null,CWFieldWriteStore.session(),true),controls:['startBtn','finishBtn','openWaterBtn','pumpReminderCreate'].map(id=>{const n=document.getElementById(id);return{id,disabled:n.disabled,hidden:n.hidden,checkin:n.dataset.cwCheckinTarget};})}));
 async function matrix({code='TODO',poolName=pool.name,technician=tech.name,repair=false,minutes=null,free=false,widths=[390],locales=languages}={}){
  await settle();await page.locator('[data-field-tab-button=agora]').focus();await page.evaluate(()=>{window.qaNowNodes=['nowBoard','nowStateLine','nowResponsibleLine','nowTimingLine'].map(id=>document.getElementById(id));});const before=await state(),db=await database(),start=requests.length;
  for(const width of widths){await page.setViewportSize({width,height:900});for(const [i,lang]of languages.entries()){
   if(!locales.includes(lang))continue;await locale(lang);const expected=free?[words.nowFree[i],words.nowFreeAction[i],words.nowFreeTiming[i]]:[`${poolName||['Piscina','Pool','Piscine','Piscina','Pool'][i]} · ${words['nowState'+code][i]}`,`${technician||words.nowTechnician[i]} · ${words[repair?'nowRepair':'nowMaintenance'][i]}`,minutes===null?words.nowNoTime[i]:text('nowElapsed',i,{minutes})];
   for(const [index,id]of ['nowStateLine','nowResponsibleLine','nowTimingLine'].entries())assert.equal(await page.locator('#'+id).textContent(),expected[index],id+' '+code+' '+lang+' '+width);
   assert.equal(await page.locator('#nowBoardLabel').textContent(),words.nowCurrent[i]);assert.equal(await page.locator('#nowBoard').getAttribute('aria-labelledby'),'nowBoardLabel');assert.deepEqual(await state(),before);assert(await page.evaluate(()=>qaNowNodes.every(n=>n===document.getElementById(n.id))));assert(await page.locator('#nowBoard').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'now board fits');assert.equal(await page.locator('#nowStateLine b,#nowResponsibleLine b').count(),0);
  }}
  assert.deepEqual(await database(),db);
  for(const r of requests.slice(start)){assert.equal(r.path,'/api/settings/language/me');assert.equal(r.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(r.body)),['language']);}
  console.log('PASS now-board '+JSON.stringify({code,poolName,repair,minutes,free,widths,locales}));
 }
 console.log('Current-visit fixture ready');await open();console.log('Current-visit page ready');await locale('en');assert.equal(await page.locator('#nowStateLine').textContent(),'Piscina · Not started','Current state must translate without translating the literal pool name');await matrix({repair:true,minutes:65,widths:profile==='states'?[320,390,1440]:[390]});
 if(profile==='states'){await select('EXTRA');await matrix({poolName:extraPool.name});await select('REGULAR');await matrix({repair:true,minutes:65,locales:['de']});assert.equal(await page.locator('#notes').inputValue(),'Nota literal <b>{minutes}</b>');}
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await select('EXTRA');
 const routeKey=await page.evaluate(()=>CWFieldRouteCache.key(CWFieldRouteCache.scope())),routeRaw=await page.evaluate(k=>localStorage.getItem(k),routeKey),reminderKey='cwFieldReminders:v1:TECH:'+tech.id,reminderRaw=await page.evaluate(k=>localStorage.getItem(k),reminderKey);
 if(profile==='states'){await page.evaluate(()=>CWFieldReminders.create('WATER_OPEN',{dueAt:new Date(Date.now()+30*60000).toISOString(),note:'Água literal <b>{minutes}</b>'}));await matrix({code:'WATER_OPEN',poolName:extraPool.name});await select('REGULAR');await matrix({repair:true,minutes:65,locales:['de']});await select('EXTRA');await matrix({code:'WATER_OPEN',poolName:extraPool.name,locales:['de']});}
 const storedWater=await page.evaluate(k=>localStorage.getItem(k),reminderKey);
 // Controlled route-cache fixtures reach the real renderer offline; no operational writes.
 const cases=[
  {code:'TRAVEL',status:'ON_ROUTE'}, {code:'TRAVEL',status:'A_CAMINHO'},
  {code:'IN_PROGRESS',status:'STARTED'}, {code:'IN_PROGRESS',status:'ACTIVE'},
  {code:'IN_PROGRESS',status:'PLANNED',age:65*60000,minutes:65},
  {code:'INCOMPLETE',status:'INCOMPLETE'},
  {code:'WAITING_MATERIAL',status:'INCOMPLETE',notes:'A aguardar material'},
  {code:'WATER_OPEN',status:'IN_PROGRESS',notes:'A aguardar material',water:true},
  {code:'CRITICAL',status:'INCOMPLETE',notes:'Alerta crítico / bomba manual / aguardar material',water:true},
  {code:'DONE',status:'COMPLETED',notes:'bomba manual',water:true,endAt:new Date(now).toISOString()},
  {code:'DONE',status:'PLANNED',endAt:new Date(now).toISOString()},
  {code:'IN_PROGRESS',status:'PLANNED',startAt:'invalid-date'},
  {code:'TODO',status:'UNKNOWN',technicianName:'Responsável <b>{minutes}</b>'},
  {code:'TODO',status:'PLANNED',technicianName:'',poolName:''}
 ];
 const stateCases=new Set([0,2,5,6,7,8,9]);
 const statesSeen=new Set(profile==='states'?['TODO','WATER_OPEN']:['TODO','TRAVEL','IN_PROGRESS','WATER_OPEN','WAITING_MATERIAL','CRITICAL','DONE','INCOMPLETE']);
 for(const [sampleIndex,sample]of cases.entries()){if((profile==='states')!==stateCases.has(sampleIndex))continue;const cache=JSON.parse(routeRaw),row=cache.visits.find(v=>v.visitType==='EXTRA'&&v.id===id);Object.assign(row,{status:sample.status,notes:sample.notes||'',startAt:sample.startAt||(sample.age!==undefined?new Date(now-sample.age).toISOString():null),endAt:sample.endAt||null});if(sample.technicianName!==undefined)row.technician.name=sample.technicianName;if(sample.poolName!==undefined)row.pool.name=sample.poolName;
  await page.evaluate(({key,raw,reminderKey,water})=>{localStorage.setItem(key,raw);if(water)localStorage.setItem(reminderKey,water);else localStorage.removeItem(reminderKey);},{key:routeKey,raw:JSON.stringify(cache),reminderKey,water:sample.water?storedWater:null});await refresh();await matrix({code:sample.code,poolName:sample.poolName===undefined?extraPool.name:sample.poolName,technician:sample.technicianName===undefined?tech.name:sample.technicianName,minutes:sample.minutes??null,widths:sample.code==='CRITICAL'||sample.poolName===''?[320]:[390],locales:statesSeen.has(sample.code)&&sample.technicianName===undefined?['de']:languages});statesSeen.add(sample.code);
 }
 if(profile==='time'){
 // A language repaint retains the already calculated duration. The existing refresh still updates it.
 const timed=JSON.parse(routeRaw);timed.visits.find(v=>v.visitType==='EXTRA').startAt=new Date(now).toISOString();await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:routeKey,raw:JSON.stringify(timed)});await refresh();
 for(const [age,minutes]of [[29999,0],[30000,1],[89999,1],[90000,2],[-60000,0]]){await page.evaluate(value=>{qaNow=value;window.dispatchEvent(new Event('cw:water-state-updated'));},now+age);await matrix({code:'IN_PROGRESS',poolName:extraPool.name,minutes,locales:['de']});}
 await page.evaluate(value=>{qaNow=value;window.dispatchEvent(new Event('cw:water-state-updated'));},now+29999);await page.evaluate(()=>{qaNow+=1;});await matrix({code:'IN_PROGRESS',poolName:extraPool.name,minutes:0});await page.evaluate(()=>window.dispatchEvent(new Event('cw:water-state-updated')));await matrix({code:'IN_PROGRESS',poolName:extraPool.name,minutes:1,locales:['de']});await page.evaluate(value=>{qaNow=value;},now);
 const free=JSON.parse(routeRaw);free.visits=[];await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:routeKey,raw:JSON.stringify(free)});await refresh();await page.waitForFunction(()=>!CWFieldVisitContext()&&document.body.dataset.fieldMode==='free');await matrix({free:true,widths:[320]});
 }
 // Restore exact source bytes and return to the actual visits.
 await page.evaluate(({key,raw,reminderKey,reminderRaw})=>{localStorage.setItem(key,raw);if(reminderRaw===null)localStorage.removeItem(reminderKey);else localStorage.setItem(reminderKey,reminderRaw);},{key:routeKey,raw:routeRaw,reminderKey,reminderRaw});await open('REGULAR');assert.equal(await page.evaluate(k=>localStorage.getItem(k),routeKey),routeRaw);await matrix({repair:true,minutes:65,locales:['de']});await page.waitForFunction(()=>qaNowGuard>0);assert((await page.evaluate(()=>qaNowGuard))>0);
 if(profile==='states'&&process.env.CW_NOW_BOARD_CAPTURE){await locale('de');await page.setViewportSize({width:320,height:1400});await page.locator('#nowBoard').screenshot({path:process.env.CW_NOW_BOARD_CAPTURE});}
 assert.deepEqual((await database()).slice(2),[[],[]]);assert(!requests.some(r=>['POST','PATCH','DELETE'].includes(r.method)));
 console.log('PASS current-visit '+profile+' profile; real rendering, language selector, captured source values and exact route restoration verified');
 if(profile==='states'){assert.deepEqual(errors,[]);completed=true;return;}
 // Retain an actual old-account offline water reminder during the account switch.
 await page.evaluate(()=>CWFieldReminders.create('WATER_OPEN',{dueAt:new Date(Date.now()+30*60000).toISOString(),note:'Old account literal water'}));
 const oldAccountWater=await page.evaluate(k=>localStorage.getItem(k),reminderKey);
 await page.evaluate(({token,user})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(user));},{token:sign(emptyTech),user:{id:emptyTech.id,name:'',role:'TECHNICIAN'}});await page.waitForSelector('#fieldRouteSessionChanged');await page.evaluate(()=>localStorage.removeItem('cwVehicleId'));await context.setOffline(false);const freshAccountRequestsStart=requests.length;await page.goto(base+`/technician-field-mode?selectedVisitId=${emptyVisit.id}&selectedVisitType=REGULAR`,{waitUntil:'domcontentloaded'});await page.waitForFunction(id=>CWFieldVisitContext()?.id===id,emptyVisit.id);await page.waitForFunction(()=>!['…',''].includes(document.getElementById('fieldPhotosValue')?.textContent));await page.waitForFunction(()=>['Abra Viatura para ver o que falta','Open Vehicle to see what is missing','Ouvrez Véhicule pour voir ce qui manque','Abra Vehículo para ver qué falta','Öffnen Sie Fahrzeug, um fehlende Dokumente zu sehen'].includes(document.getElementById('fieldDocsMeta')?.textContent));await page.waitForFunction(()=>['Sem lembretes ativos ou pedidos de passagem.','No active reminders or handover requests.','Aucun rappel actif ni demande de transmission.','Sin recordatorios activos ni solicitudes de traspaso.','Keine aktiven Erinnerungen oder Übergabeanfragen.'].includes(document.getElementById('handoverStatus')?.textContent));await settle();await page.locator('[data-field-tab-button=agora]').click();await instrument();await matrix({poolName:'-',technician:'Tecnico',widths:[320]});assert.equal(await page.evaluate(async()=> (await CWFieldWriteStore.records(null,CWFieldWriteStore.session(),true)).length),0);assert.equal(await page.locator('#notes').inputValue(),'');assert.equal(await page.evaluate(k=>localStorage.getItem(k),reminderKey),oldAccountWater);assert.deepEqual(await page.evaluate(()=>CWFieldReminders.list('WATER_OPEN')),[]);assert.deepEqual(errors,[]);assert(!requests.some(r=>['POST','PATCH','DELETE'].includes(r.method)));
 // The actual empty handover result marks completed bootstrap reads and their native sync,
 // before measuring locale repaint. One HTTP response is not the complete bootstrap.
 // No assigned vehicle is a completed precondition check, not a document request in progress.
 // Invalid numeric IDs keep all real document sources unavailable, without loading another vehicle.
 assert.equal(await page.locator('#vehicleId').inputValue(),'');
 assert.equal(await page.locator('#technicianId').inputValue(),String(emptyTech.id));
 await page.locator('[data-field-tab-button=docs]').click();
 const absentBefore=await state(),absentVisit=await prisma.serviceVisit.findUnique({where:{id:emptyVisit.id}}),readsBefore=await page.evaluate(()=>qaNowDocumentReads);
 for(const value of ['0','-1','1.5','']){
  await page.locator('#vehicleId').fill(value);await page.locator('#refreshCrewStatus').click();
  await page.waitForFunction(()=>document.getElementById('fieldDocsMeta').textContent==='Öffnen Sie Fahrzeug, um fehlende Dokumente zu sehen');
  assert.equal(await page.locator('#fieldDocsValue').textContent(),'Prüfen');
  assert.equal(await page.locator('#interruptList [data-exception-category=DOC_MISSING]').count(),1);
  assert.deepEqual(await page.locator('#transportGuideBox,#workGuideBox,#insuranceBox').evaluateAll(nodes=>nodes.map(node=>node.dataset.source)),['unavailable','unavailable','unavailable']);
  assert.equal(await page.evaluate(()=>qaNowDocumentReads),readsBefore);
  const after=await state();assert.deepEqual(after.tokens,absentBefore.tokens);assert.deepEqual(after.writes,absentBefore.writes);assert.deepEqual(after.visit,absentBefore.visit);assert.equal(after.notes,absentBefore.notes);
  assert.deepEqual(after.stored.filter(([key])=>/^cwField(?:Documents:|Route:v3:|VisitDrafts:v2:)/.test(key)),absentBefore.stored.filter(([key])=>/^cwField(?:Documents:|Route:v3:|VisitDrafts:v2:)/.test(key)));
 }
 assert(!requests.slice(freshAccountRequestsStart).some(r=>r.path.startsWith('/api/guides/')),'Missing or invalid vehicle never requests documents');
 assert.deepEqual(await prisma.serviceVisit.findUnique({where:{id:emptyVisit.id}}),absentVisit);assert.deepEqual(errors,[]);
 console.log('PASS account/session guard and four missing/invalid vehicle boundaries; no inherited documents, document requests, draft loss, water state or operational writes');completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{clearTimeout(deadline);await browser?.close();await prisma.$disconnect();});
