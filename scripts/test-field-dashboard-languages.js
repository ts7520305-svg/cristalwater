'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),{chromium}=require('playwright');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const languages=['pt','en','fr','es','de'];
const words={
  "dashSummary": [
    "Resumo do dia em campo",
    "Field day summary",
    "Résumé de la journée sur le terrain",
    "Resumen de la jornada en campo",
    "Übersicht des Arbeitstags vor Ort"
  ],
  "dashToday": [
    "Hoje",
    "Today",
    "Aujourd’hui",
    "Hoy",
    "Heute"
  ],
  "dashPreparing": [
    "A preparar ronda",
    "Preparing the route",
    "Préparation de la tournée",
    "Preparando la ruta",
    "Route wird vorbereitet"
  ],
  "dashInitial": [
    "Serviço atual e cliente aparecem aqui.",
    "The current service and client appear here.",
    "Le service et le client actuels s’affichent ici.",
    "El servicio y el cliente actuales aparecen aquí.",
    "Der aktuelle Auftrag und Kunde werden hier angezeigt."
  ],
  "dashProgress": [
    "Progresso",
    "Progress",
    "Progression",
    "Progreso",
    "Fortschritt"
  ],
  "dashProgressInitial": [
    "visitas feitas / total",
    "visits completed / total",
    "visites effectuées / total",
    "visitas realizadas / total",
    "erledigte Besuche / gesamt"
  ],
  "dashDocuments": [
    "Documentos",
    "Documents",
    "Documents",
    "Documentos",
    "Dokumente"
  ],
  "dashCheck": [
    "Verificar",
    "Check",
    "Vérifier",
    "Comprobar",
    "Prüfen"
  ],
  "dashDocsInitial": [
    "guia, AT e seguro",
    "work document, AT and insurance",
    "document de travail, AT et assurance",
    "documento de trabajo, AT y seguro",
    "Arbeitsdokument, AT und Versicherung"
  ],
  "dashSubmissions": [
    "Envios",
    "Submissions",
    "Envois",
    "Envíos",
    "Übermittlungen"
  ],
  "dashPhotosInitial": [
    "0 fotos",
    "0 photos",
    "0 photos",
    "0 fotos",
    "0 Fotos"
  ],
  "dashSubmissionInitial": [
    "fotos e notas da visita",
    "visit photos and notes",
    "photos et notes de la visite",
    "fotos y notas de la visita",
    "Fotos und Notizen zum Besuch"
  ],
  "dashPriority": [
    "Prioridade P0",
    "Priority P0",
    "Priorité P0",
    "Prioridad P0",
    "Priorität P0"
  ],
  "dashGreeting": [
    "Bom dia, {name}",
    "Good morning, {name}",
    "Bonjour, {name}",
    "Buenos días, {name}",
    "Guten Morgen, {name}"
  ],
  "dashTechnician": [
    "Técnico",
    "Technician",
    "Technicien",
    "Técnico",
    "Techniker"
  ],
  "dashWater": [
    "Água aberta",
    "Water running",
    "Eau ouverte",
    "Agua abierta",
    "Wasser läuft"
  ],
  "dashPump": [
    "Bomba em manual",
    "Pump in manual mode",
    "Pompe en mode manuel",
    "Bomba en modo manual",
    "Pumpe im Handbetrieb"
  ],
  "dashUnknown": [
    "Água e bombas por confirmar",
    "Water and pumps need confirmation",
    "Eau et pompes à confirmer",
    "Agua y bombas por confirmar",
    "Wasser und Pumpen noch zu bestätigen"
  ],
  "dashCritical": [
    "Alerta crítico",
    "Critical alert",
    "Alerte critique",
    "Alerta crítica",
    "Kritischer Alarm"
  ],
  "dashWaterActive": [
    "Água aberta ativa",
    "Water is still running",
    "L’eau est toujours ouverte",
    "El agua sigue abierta",
    "Wasser läuft weiterhin"
  ],
  "dashAlerts": [
    "Há alertas ativos",
    "There are active alerts",
    "Des alertes sont actives",
    "Hay alertas activas",
    "Es gibt aktive Alarme"
  ],
  "dashFree": [
    "Hoje está livre",
    "No visits today",
    "Aucune visite aujourd’hui",
    "Sin visitas hoy",
    "Heute keine Besuche"
  ],
  "dashCriticalMeta": [
    "Alerta crítico ativo. Trate primeiro e só depois continue a ronda.",
    "A critical alert is active. Deal with it before continuing the route.",
    "Une alerte critique est active. Traitez-la avant de poursuivre la tournée.",
    "Hay una alerta crítica activa. Atiéndala antes de continuar la ruta.",
    "Ein kritischer Alarm ist aktiv. Beheben Sie ihn, bevor Sie die Route fortsetzen."
  ],
  "dashLocation": [
    "local por confirmar",
    "location to be confirmed",
    "lieu à confirmer",
    "ubicación por confirmar",
    "Ort noch zu bestätigen"
  ],
  "dashVisitMeta": [
    "{client} - {location}",
    "{client} - {location}",
    "{client} - {location}",
    "{client} - {location}",
    "{client} - {location}"
  ],
  "dashPoolOne": [
    "{count} piscina",
    "{count} pool",
    "{count} piscine",
    "{count} piscina",
    "{count} Pool"
  ],
  "dashPoolMany": [
    "{count} piscinas",
    "{count} pools",
    "{count} piscines",
    "{count} piscinas",
    "{count} Pools"
  ],
  "dashAlertOne": [
    "{count} alerta",
    "{count} alert",
    "{count} alerte",
    "{count} alerta",
    "{count} Alarm"
  ],
  "dashAlertMany": [
    "{count} alertas",
    "{count} alerts",
    "{count} alertes",
    "{count} alertas",
    "{count} Alarme"
  ],
  "dashWaterCount": [
    "{count} água aberta",
    "{count} running-water alert",
    "{count} alerte d’eau ouverte",
    "{count} alerta de agua abierta",
    "{count} Alarm wegen laufenden Wassers"
  ],
  "dashPumpCount": [
    "{count} bomba manual",
    "{count} manual-pump alert",
    "{count} alerte de pompe en manuel",
    "{count} alerta de bomba en manual",
    "{count} Alarm wegen einer Pumpe im Handbetrieb"
  ],
  "dashFreeMeta": [
    "Não tens visitas atribuídas neste momento. {stats}.",
    "You have no assigned visits at the moment. {stats}.",
    "Aucune visite ne vous est attribuée actuellement. {stats}.",
    "No tiene visitas asignadas en este momento. {stats}.",
    "Ihnen sind derzeit keine Besuche zugewiesen. {stats}."
  ],
  "dashPendingVisits": [
    "{count} visita(s) por concluir",
    "{count} visit(s) to complete",
    "{count} visite(s) à terminer",
    "{count} visita(s) por completar",
    "{count} Besuche noch abzuschließen"
  ],
  "dashRoundReady": [
    "Ronda pronta para fechar",
    "Route ready to close",
    "Tournée prête à clôturer",
    "Ruta lista para cerrar",
    "Route kann abgeschlossen werden"
  ],
  "dashScheduleFree": [
    "Agenda livre neste momento",
    "No visits scheduled at the moment",
    "Aucune visite prévue actuellement",
    "Sin visitas programadas en este momento",
    "Derzeit keine Besuche geplant"
  ],
  "dashValidating": [
    "A validar",
    "Validating",
    "Validation en cours",
    "Validando",
    "Wird geprüft"
  ],
  "dashValid": [
    "Válidos",
    "Valid",
    "Valides",
    "Válidos",
    "Gültig"
  ],
  "dashReview": [
    "Rever",
    "Review",
    "À vérifier",
    "Revisar",
    "Prüfen"
  ],
  "dashVehicleConfirm": [
    "A confirmar a viatura",
    "Confirming the vehicle",
    "Confirmation du véhicule",
    "Confirmando el vehículo",
    "Fahrzeug wird bestätigt"
  ],
  "dashDocsConfirmed": [
    "Obrigatórios confirmados",
    "Required documents confirmed",
    "Documents obligatoires confirmés",
    "Documentos obligatorios confirmados",
    "Pflichtdokumente bestätigt"
  ],
  "dashDocsCached": [
    "Cópia de hoje por confirmar",
    "Today’s copy needs confirmation",
    "Copie du jour à confirmer",
    "Copia de hoy por confirmar",
    "Heutige Kopie noch zu bestätigen"
  ],
  "dashDocsMissing": [
    "Abra Viatura para ver o que falta",
    "Open Vehicle to see what is missing",
    "Ouvrez Véhicule pour voir ce qui manque",
    "Abra Vehículo para ver qué falta",
    "Öffnen Sie Fahrzeug, um fehlende Dokumente zu sehen"
  ],
  "dashCheckingSubmissions": [
    "A verificar envios guardados",
    "Checking saved submissions",
    "Vérification des envois enregistrés",
    "Comprobando envíos guardados",
    "Gespeicherte Übermittlungen werden geprüft"
  ],
  "dashVisitPending": [
    "visita por confirmar",
    "visit awaiting confirmation",
    "visite en attente de confirmation",
    "visita pendiente de confirmación",
    "Besuch wartet auf Bestätigung"
  ],
  "dashPhotosPending": [
    "fotos por enviar",
    "photos awaiting upload",
    "photos à envoyer",
    "fotos pendientes de envío",
    "Fotos warten auf Übermittlung"
  ],
  "dashPendingSubmissions": [
    "envios pendentes nesta visita",
    "pending submissions for this visit",
    "envois en attente pour cette visite",
    "envíos pendientes de esta visita",
    "ausstehende Übermittlungen für diesen Besuch"
  ],
  "dashSubmissionsUnknown": [
    "Envios por verificar; preserve os dados",
    "Submissions need checking; preserve the data",
    "Envois à vérifier ; conservez les données",
    "Envíos por comprobar; conserve los datos",
    "Übermittlungen müssen geprüft werden; bewahren Sie die Daten auf"
  ],
  "dashTreat": [
    "Tratar alerta",
    "Address alert",
    "Traiter l’alerte",
    "Atender alerta",
    "Alarm bearbeiten"
  ],
  "dashContinue": [
    "Continuar",
    "Continue",
    "Continuer",
    "Continuar",
    "Fortsetzen"
  ],
  "dashContact": [
    "Comunicar",
    "Contact",
    "Communiquer",
    "Contactar",
    "Kontakt aufnehmen"
  ],
  "dashRefresh": [
    "Atualizar",
    "Refresh",
    "Actualiser",
    "Actualizar",
    "Aktualisieren"
  ],
  "dashAgenda": [
    "Ver agenda",
    "View schedule",
    "Voir le planning",
    "Ver agenda",
    "Terminplan anzeigen"
  ],
  "dashExtra": [
    "Consultar visita extra",
    "View extra visit",
    "Consulter la visite supplémentaire",
    "Consultar visita extra",
    "Zusatzbesuch ansehen"
  ],
  "dashNavigate": [
    "Navegar",
    "Navigate",
    "Itinéraire",
    "Navegar",
    "Navigieren"
  ],
  "dashOpen": [
    "Abrir visita",
    "Open visit",
    "Ouvrir la visite",
    "Abrir visita",
    "Besuch öffnen"
  ],
  "sourcePool": [
    "Piscina",
    "Pool",
    "Piscine",
    "Piscina",
    "Pool"
  ]
};
let browser,completed=false;const deadline=setTimeout(()=>{console.error('Dashboard language scenario did not finish');process.exit(1);},110000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
 const vehicle=await prisma.vehicle.create({data:{plate:'QA-DASH-'+Date.now(),active:true}}),tech=await prisma.technician.create({data:{name:'Técnico literal',vehicleId:vehicle.id,active:true}}),emptyTech=await prisma.technician.create({data:{name:'',active:true}}),client=await prisma.client.create({data:{name:'Cliente',active:true}});
 const pool=await prisma.pool.create({data:{name:'Piscina',address:'local por confirmar',clientId:client.id,active:true}}),extraPool=await prisma.pool.create({data:{name:'Extra <b>{name}</b>',clientId:client.id,active:true}});
 const max=await Promise.all([prisma.serviceVisit.aggregate({_max:{id:true}}),prisma.extraVisit.aggregate({_max:{id:true}})]),id=Math.max(...max.map(x=>x._max.id||0))+1,planned=new Date();planned.setHours(23,59,59,0);
 const common={id,clientId:client.id,technicianId:tech.id,status:'PLANNED'};await prisma.serviceVisit.create({data:{...common,poolId:pool.id,date:new Date(),plannedDate:planned}});await prisma.extraVisit.create({data:{...common,poolId:extraPool.id,scheduledAt:new Date()}});for(const table of ['ServiceVisit','ExtraVisit'])await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),${id},true)`);
 const guide=await prisma.transportGuide.create({data:{vehicleId:vehicle.id,codeAT:'QA-DASH-'+Date.now(),status:'ACTIVE',validUntil:new Date(Date.now()+86400000),isDraft:false}});await prisma.workGuide.create({data:{vehicleId:vehicle.id,technicianId:tech.id,guideId:guide.id,status:'OPEN',isDraft:false}});for(const type of ['INSURANCE','INSPECTION'])await prisma.vehicleMaintenanceRecord.create({data:{vehicleId:vehicle.id,type,title:type,status:'ACTIVE',dueDate:new Date(Date.now()+30*86400000)}});
 const sign=t=>jwt.sign({id:t.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'}),token=sign(tech),draft={v:2,owner:'TECH:'+tech.id,drafts:{['visit-REGULAR-'+id]:{values:{notes:'Original <b>{name}</b>'},checks:{},pendingProblems:[{severity:'Urgente',visitId:id,message:'Problema original',createdAt:new Date().toISOString()}]}}};
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});const context=await browser.newContext({viewport:{width:390,height:900},timezoneId:'Europe/Lisbon'});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await context.addInitScript(({token,tech,vehicle,draft,origin})=>{if(top!==window||location.origin!==origin)return;if(!localStorage.getItem('qaDashboard')){for(const k of ['token','cristalwater_jwt'])localStorage.setItem(k,token);for(const k of ['user','cristalwater_user'])localStorage.setItem(k,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));localStorage.setItem('cwVehicleId',String(vehicle.id));localStorage.setItem('cwFieldVisitDrafts:v2:TECH:'+tech.id,JSON.stringify(draft));localStorage.setItem('qaDashboard','1');}const interval=setInterval;window.setInterval=(fn,delay,...args)=>[15000,30000,60000].includes(delay)?0:interval(fn,delay,...args);Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});},{token,tech,vehicle,draft,origin:base});
 const page=await context.newPage(),errors=[],requests=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))requests.push({path,method:r.method(),body:r.postData()});});
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))),locale=async lang=>{await page.locator('#cwLanguageSelect').selectOption(lang);await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);await settle();};
 const text=(key,i,params={})=>words[key][i].replace(/\{(\w+)\}/g,(_,key)=>String(params[key]??''));
 const database=()=>Promise.all([prisma.serviceVisit.findUnique({where:{id}}),prisma.extraVisit.findUnique({where:{id}}),prisma.operationalReminder.findMany({where:{assignedToTechnicianId:tech.id}}),prisma.technicalHistory.findMany({where:{poolId:{in:[pool.id,extraPool.id]}}})]);
 const instrument=()=>page.evaluate(()=>{window.qaDashCalls={};window.qaDashGuard=0;const same=CWFieldDocuments.same;CWFieldDocuments.same=(...args)=>{qaDashGuard++;return same(...args);};for(const [group,api,names]of [['reminder',CWFieldReminders,['list','create','mark','sync','context']],['journal',CWFieldAlertJournal,['scope','read','record','states']],['documents',CWFieldDocuments,['load','scope']],['offline',CWFieldOffline,['pending']],['photos',CWFieldPhotos,['list','save','sync']],['route',CWFieldRouteCache,['read','save','update']]])for(const name of names){const fn=api[name];api[name]=(...args)=>{const key=group+':'+name;qaDashCalls[key]=(qaDashCalls[key]||0)+1;return fn(...args);};}});
 const ready=async()=>{await page.waitForFunction(()=>/^(Válidos|Valid|Valides|Gültig)$/.test(document.getElementById('fieldDocsValue')?.textContent||''));await page.waitForFunction(()=>!['…',''].includes(document.getElementById('fieldPhotosValue')?.textContent));await settle();};
 const open=async(type='REGULAR',free=false)=>{await page.goto(base+`/technician-field-mode?selectedVisitId=${id}&selectedVisitType=${type}`,{waitUntil:'domcontentloaded'});await page.waitForFunction(({id,type,free})=>free?!CWFieldVisitContext()&&document.body.dataset.fieldMode==='free':CWFieldVisitContext()?.id===id&&CWFieldVisitContext().visitType===type,{id,type,free});await ready();await page.locator('[data-field-tab-button=hoje]').click();};
 const select=async(type,wait=true)=>{await page.locator('[data-field-tab-button=hoje]').click();const row=page.locator('#visitList [data-visit-index]').filter({hasText:type==='REGULAR'?pool.name:extraPool.name});let found=false;for(const filter of ['TODO','IN_PROGRESS','DONE']){await page.locator('[data-pool-filter='+filter+']').click();const count=await row.count();assert(count<=1);if(count){found=true;await row.click();break;}}assert(found,'Actual visit row is available in one of the three existing filters');await page.waitForFunction(type=>CWFieldVisitContext()?.visitType===type,type);if(wait)await ready();};
 const state=()=>page.evaluate(async()=>({focus:document.activeElement.id,tab:document.activeElement.dataset.fieldTabButton,notes:document.getElementById('notes').value,water:document.getElementById('waterNote').value,visit:CWFieldVisitContext(),calls:{...qaDashCalls},tokens:['token','cristalwater_jwt'].map(k=>localStorage.getItem(k)),stored:Object.keys(localStorage).filter(k=>k.startsWith('cwField')||k.startsWith('cwWater')||k.startsWith('cwPump')||k.startsWith('cw:tech')).sort().map(k=>[k,localStorage.getItem(k)]),writes:await CWFieldWriteStore.records(null,CWFieldWriteStore.session(),true),actions:[...document.querySelectorAll('#fieldHeroActions button')].map(n=>({action:n.dataset.heroAction,hidden:n.hidden,disabled:n.disabled,class:n.className})),mode:document.body.dataset.fieldMode,priority:document.body.dataset.fieldPriority,hidden:['fieldProgressTile','fieldDocsTile','fieldPhotosTile'].map(id=>document.getElementById(id).hidden)}));
 async function matrix({focus='dashCritical',literal='',clientName='Cliente',location='-',doc='dashValid',docMeta='dashDocsConfirmed',photos='0',photoMeta='dashPendingSubmissions',first='dashTreat',action='p0',free=false,alerts=0,total=2,done=0,name='Técnico'}={}){
  await settle();await page.locator('[data-field-tab-button=hoje]').click();await page.locator('[data-field-tab-button=hoje]').focus();await page.evaluate(()=>{window.qaDashNodes=[...document.querySelectorAll('#todayBoard,#todayBoard *')];});const before=await state(),db=await database(),start=requests.length;
  const p0=['dashCritical','dashUnknown','dashWater','dashPump'].includes(focus);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});for(const [i,lang]of languages.entries()){
   await locale(lang);
   const expected={fieldDashboardLabel:words.dashSummary[i],fieldHeroLabel:p0?words.dashPriority[i]:text('dashGreeting',i,{name:name||words.dashTechnician[i]}),fieldFocusNow:literal||(words[focus]?.[i]),fieldProgressValue:free?`${total} / ${total}`:`${done} / ${total}`,fieldProgressMeta:free?words.dashScheduleFree[i]:total-done?text('dashPendingVisits',i,{count:total-done}):words.dashRoundReady[i],fieldDocsValue:words[doc][i],fieldDocsMeta:words[docMeta][i],fieldPhotosValue:photos,fieldPhotosMeta:words[photoMeta][i]};
   expected.fieldFocusMeta=p0?words.dashCriticalMeta[i]:free?text('dashFreeMeta',i,{stats:[text(total===1?'dashPoolOne':'dashPoolMany',i,{count:total}),text(alerts===1?'dashAlertOne':'dashAlertMany',i,{count:alerts}),text('dashWaterCount',i,{count:0}),text('dashPumpCount',i,{count:0})].join(' · ')}):text('dashVisitMeta',i,{client:clientName||['Cliente','Client','Client','Cliente','Kunde'][i],location:location||words.dashLocation[i]});
   for(const [id,value]of Object.entries(expected))assert.equal(await page.locator('#'+id).textContent(),value,id+' '+lang+' '+width);
   for(const [id,key]of [['fieldProgressTile','dashProgress'],['fieldDocsTile','dashDocuments'],['fieldPhotosTile','dashSubmissions']])assert.equal(await page.locator('#'+id+' > span').textContent(),words[key][i]);
   const buttons=page.locator('#fieldHeroActions button'),buttonKeys=[first,free?'dashAgenda':p0?'dashContinue':'dashNavigate','dashContact'];assert.equal(await buttons.count(),3);for(let k=0;k<3;k++)assert.equal(await buttons.nth(k).textContent(),words[buttonKeys[k]][i]);assert.equal(await buttons.first().getAttribute('data-hero-action'),action);
   assert.equal(await page.locator('#todayBoard').getAttribute('aria-labelledby'),'fieldDashboardLabel');assert.deepEqual(await state(),before);assert.deepEqual(await database(),db);assert(await page.evaluate(()=>qaDashNodes.every(n=>n.isConnected)));assert(await page.locator('#todayBoard').evaluate(n=>n.scrollWidth<=n.clientWidth+1));assert(await buttons.evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44&&n.scrollWidth<=n.clientWidth+1)),'button text fits');
  }}
  for(const r of requests.slice(start)){assert.equal(r.path,'/api/settings/language/me');assert.equal(r.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(r.body)),['language']);}
 }
 await open();await locale('pt');assert.equal(await page.locator('#interruptList [data-exception-category=PUMP_MANUAL]').count(),0);assert.equal(await page.locator('#interruptList [data-exception-category=CRITICAL_PROBLEM]').count(),1);assert.equal(await page.locator('#fieldFocusNow').textContent(),words.dashCritical[0],'A critical problem without a pump must not claim manual-pump mode');
 await instrument();await matrix();
 await page.locator('#fieldHeroActions [data-hero-action=p0]').click();assert.equal(await page.locator('body').getAttribute('data-field-tab'),'hoje');await page.locator('#fieldHeroActions [data-hero-action=contact]').click();assert.equal(await page.locator('#adminAlertMessage').evaluate(n=>n===document.activeElement),true);await select('EXTRA');await matrix({focus:null,literal:extraPool.name,first:'dashOpen',action:'openVisit'});await page.locator('#fieldHeroActions [data-hero-action=openVisit]').click();assert.equal(await page.locator('body').getAttribute('data-field-tab'),'agora');
 // Hold an actual document refresh after it has read the valid server result.
 await page.evaluate(()=>{qaLoadDocs=CWFieldDocuments.load;CWFieldDocuments.load=async(...args)=>{const result=await qaLoadDocs(...args);return new Promise(resolve=>{qaReleaseDocs=()=>resolve(result);});};document.getElementById('loadGuidesBtn').click();});await page.waitForFunction(()=>typeof qaReleaseDocs==='function');await matrix({focus:null,literal:extraPool.name,first:'dashOpen',action:'openVisit',doc:'dashValidating',docMeta:'dashVehicleConfirm'});await page.evaluate(()=>{CWFieldDocuments.load=qaLoadDocs;qaReleaseDocs();});await ready();await matrix({focus:null,literal:extraPool.name,first:'dashOpen',action:'openVisit'});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);
 const routeKey=await page.evaluate(()=>CWFieldRouteCache.key(CWFieldRouteCache.scope())),routeRaw=await page.evaluate(k=>localStorage.getItem(k),routeKey),docKey=await page.evaluate(id=>CWFieldDocuments.key(CWFieldDocuments.scope(CWFieldWriteStore.session(),id)),vehicle.id),docRaw=await page.evaluate(k=>localStorage.getItem(k),docKey);
 await page.evaluate(()=>document.getElementById('loadGuidesBtn').click());await page.waitForFunction(()=>['Cópia de hoje por confirmar','Today’s copy needs confirmation','Copie du jour à confirmer','Copia de hoy por confirmar','Heutige Kopie noch zu bestätigen'].includes(document.getElementById('fieldDocsMeta').textContent));await matrix({focus:null,literal:extraPool.name,first:'dashOpen',action:'openVisit',docMeta:'dashDocsCached'});
 await page.evaluate(k=>{localStorage.removeItem(k);document.getElementById('loadGuidesBtn').click();},docKey);await page.waitForFunction(()=>document.getElementById('fieldDocsValue').textContent==='Prüfen');await matrix({focus:null,literal:extraPool.name,first:'dashOpen',action:'openVisit',doc:'dashReview',docMeta:'dashDocsMissing'});await page.evaluate(({key,raw})=>{localStorage.setItem(key,raw);document.getElementById('loadGuidesBtn').click();},{key:docKey,raw:docRaw});await ready();
 // Actual offline reminder records distinguish water, pump and unreadable-source priority.
 await page.evaluate(()=>CWFieldReminders.create('PUMP_MANUAL',{dueAt:new Date(Date.now()+30*60000).toISOString()}));await matrix({focus:'dashPump',docMeta:'dashDocsCached'});
 await page.evaluate(()=>CWFieldReminders.create('WATER_OPEN',{dueAt:new Date(Date.now()+30*60000).toISOString(),note:'Literal <b>{name}</b>'}));await matrix({focus:'dashWater',docMeta:'dashDocsCached'});
 const reminderKey='cwFieldReminders:v1:TECH:'+tech.id,reminderRaw=await page.evaluate(k=>localStorage.getItem(k),reminderKey);await page.evaluate(k=>{localStorage.setItem(k,'{broken');window.dispatchEvent(new Event('cw:water-state-updated'));},reminderKey);await matrix({focus:'dashUnknown',docMeta:'dashDocsCached'});assert.equal(await page.evaluate(k=>localStorage.getItem(k),reminderKey),'{broken');await page.evaluate(({key,raw})=>{localStorage.setItem(key,raw);window.dispatchEvent(new Event('cw:water-state-updated'));window.dispatchEvent(new Event('cw:reminders-updated'));},{key:reminderKey,raw:reminderRaw});
 const statuses=()=>page.evaluate(()=>['WATER_OPEN','PUMP_MANUAL'].flatMap(kind=>CWFieldReminders.list(kind)).map(r=>[r.localId,r.status]));const beforeRead=await statuses();await page.locator('#interruptList [data-exception-category=PUMP_MANUAL] [data-interrupt-action=confirm]').evaluate(n=>n.click());assert.deepEqual(await statuses(),beforeRead);
 // Restore only synthetic, never-sent reminders before subsequent read-only route fixtures.
 await page.evaluate(k=>localStorage.removeItem(k),reminderKey);
 for(const mode of ['ongoing','done','fallback','free']){const sample=JSON.parse(routeRaw),row=sample.visits.find(v=>v.visitType==='EXTRA'&&v.id===id);if(mode==='ongoing')row.status='IN_PROGRESS';if(mode==='done'){sample.visits.forEach(v=>{v.status='COMPLETED';v.endAt=new Date().toISOString();});}if(mode==='fallback'){row.pool.name='';row.pool.address='';row.pool.zone='';row.client.name='';}if(mode==='free')sample.visits=[];await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:routeKey,raw:JSON.stringify(sample)});await open('EXTRA',mode==='free');await instrument();await matrix(mode==='free'?{focus:'dashFree',free:true,total:0,first:'dashRefresh',action:'refresh',docMeta:'dashDocsCached'}:{focus:mode==='fallback'?'sourcePool':null,literal:mode==='fallback'?'':extraPool.name,clientName:mode==='fallback'?'':'Cliente',location:mode==='fallback'?'':'-',first:mode==='ongoing'?'dashContinue':mode==='done'?'dashExtra':'dashOpen',action:mode==='fallback'?'openVisit':'continue',done:mode==='done'?2:0,docMeta:'dashDocsCached'});}
 await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:routeKey,raw:routeRaw});await open('EXTRA');await instrument();assert.equal(await page.evaluate(k=>localStorage.getItem(k),routeKey),routeRaw);
 // Actual photo draft and fault-injected pending reads exercise asynchronous presentation only.
 await page.locator('[data-field-tab-button=agora]').click();await page.locator('#galleryPhotoInput').setInputFiles({name:'literal.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx2kAAAAASUVORK5CYII=','base64')});await page.waitForFunction(()=>document.getElementById('fieldPhotosValue').textContent==='1');await matrix({focus:null,literal:extraPool.name,first:'dashOpen',action:'openVisit',docMeta:'dashDocsCached',photos:'1',photoMeta:'dashPhotosPending'});
 await page.evaluate(()=>{qaPending=CWFieldOffline.pending;CWFieldOffline.pending=async(id,type)=>{qaPendingArgs=[id,type];return true;};});await select('REGULAR');await select('EXTRA');assert.deepEqual(await page.evaluate(()=>qaPendingArgs),[id,'EXTRA']);await matrix({focus:null,literal:extraPool.name,first:'dashOpen',action:'openVisit',docMeta:'dashDocsCached',photos:'2',photoMeta:'dashVisitPending'});
 await page.evaluate(()=>{CWFieldOffline.pending=async()=>{throw Error('PRIVATE <b>{name}</b>');};});await select('REGULAR');await select('EXTRA');await matrix({focus:null,literal:extraPool.name,first:'dashOpen',action:'openVisit',docMeta:'dashDocsCached',photos:'?',photoMeta:'dashSubmissionsUnknown'});
 await page.evaluate(()=>{qaHeldPending=[];CWFieldOffline.pending=(id,type)=>new Promise(resolve=>qaHeldPending.push({id,type,resolve}));});await select('REGULAR',false);
 // Selection itself stays real; do not wait for a deliberately held pending read.
 await select('EXTRA',false);await page.waitForFunction(()=>qaHeldPending.some(x=>x.type==='EXTRA'));await matrix({focus:null,literal:extraPool.name,first:'dashOpen',action:'openVisit',docMeta:'dashDocsCached',photos:'…',photoMeta:'dashCheckingSubmissions'});await page.evaluate(()=>qaHeldPending.filter(x=>x.type==='REGULAR').forEach(x=>x.resolve(true)));await settle();assert.equal(await page.locator('#fieldPhotosValue').textContent(),'…');await page.evaluate(()=>qaHeldPending.filter(x=>x.type==='EXTRA').forEach(x=>x.resolve(false)));await ready();await matrix({focus:null,literal:extraPool.name,first:'dashOpen',action:'openVisit',docMeta:'dashDocsCached',photos:'1',photoMeta:'dashPhotosPending'});await page.evaluate(()=>{CWFieldOffline.pending=qaPending;});
 if(process.env.CW_DASHBOARD_CAPTURE){await page.locator('[data-field-tab-button=hoje]').click();await locale('de');await page.setViewportSize({width:320,height:1400});await page.locator('#todayBoard').screenshot({path:process.env.CW_DASHBOARD_CAPTURE});}
 assert.equal(await page.locator('#todayBoard b b').count(),0);assert((await page.evaluate(()=>qaDashGuard))>0);assert.deepEqual((await database()).slice(2),[[],[]]);assert(!requests.some(r=>r.method==='POST'||r.method==='PATCH'||r.method==='DELETE'),'No operational API writes');
 console.log('PASS real dashboard in five languages/three widths: critical problem is not a manual pump; real water/pump/unreadable sources, private names/fallbacks, progress, live/cache/missing/held docs, free/ongoing/completed extra visit, read acknowledgement does not close reminders, actual photo draft, typed asynchronous pending/failure/late-reply protection; unchanged nodes/focus/actions/bytes/SQL and no producers on locale change');
 // A pending old-account reply must not repaint after session invalidation.
 await page.evaluate(()=>{qaAccountPending=[];CWFieldOffline.pending=()=>new Promise(resolve=>qaAccountPending.push(resolve));});await select('REGULAR',false);await page.waitForFunction(()=>qaAccountPending.length>0);
 await page.evaluate(({token,user})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(user));},{token:sign(emptyTech),user:{id:emptyTech.id,name:'',role:'TECHNICIAN'}});await page.waitForSelector('#fieldRouteSessionChanged');await settle();const beforeAccountReply=await page.locator('#fieldPhotosValue').textContent();await page.evaluate(()=>qaAccountPending.forEach(resolve=>resolve(true)));await settle();assert.equal(await page.locator('#fieldPhotosValue').textContent(),beforeAccountReply);
 await page.evaluate(()=>localStorage.removeItem('cwVehicleId'));await context.setOffline(false);await page.goto(base+'/technician-field-mode',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.fieldMode==='free'&&!CWFieldVisitContext());await page.locator('[data-field-tab-button=hoje]').click();
 for(const [i,lang]of languages.entries()){await locale(lang);assert.equal(await page.locator('#fieldHeroLabel').textContent(),text('dashGreeting',i,{name:words.dashTechnician[i]}));assert.equal(await page.locator('#fieldFocusNow').textContent(),words.dashAlerts[i]);assert.equal(await page.locator('#fieldProgressTile').evaluate(n=>n.hidden),true);assert.equal(await page.locator('#interruptList [data-exception-category=DOC_MISSING]').count(),1);assert.equal(await page.locator('#interruptList [data-exception-category=CRITICAL_PROBLEM],#interruptList [data-exception-category=PUMP_MANUAL],#interruptList [data-exception-category=WATER_OPEN]').count(),0);}
 assert.equal(await page.evaluate(async()=> (await CWFieldWriteStore.records(null,CWFieldWriteStore.session(),true)).length),0);await page.locator('#fieldHeroActions [data-hero-action=refresh]').click();await page.waitForFunction(()=>document.body.dataset.fieldMode==='free'&&!CWFieldVisitContext());await page.locator('#fieldHeroActions [data-hero-action=agenda]').click();await page.waitForURL('**/technician-route');
 assert(!requests.some(r=>r.method==='POST'||r.method==='PATCH'||r.method==='DELETE'),'Account switch/navigation sends no operational writes');
 console.log('PASS late pending replies cannot repaint after account changes; missing technician name translates, old account work is not inherited, and actual refresh/schedule buttons keep their read-only navigation');
 assert.deepEqual(errors,[]);completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{clearTimeout(deadline);await browser?.close();await prisma.$disconnect();});
