'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),jwt=require('jsonwebtoken'),{chromium}=require('playwright');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const languages=['pt','en','fr','es','de'],words={"routeSessionChanged":["A sessão mudou. Os dados guardados foram preservados. Reabra o modo de campo com a conta atual.","The session changed. Saved data has been preserved. Reopen field mode with the current account.","La session a changé. Les données enregistrées ont été conservées. Rouvrez le mode terrain avec le compte actuel.","La sesión ha cambiado. Se han conservado los datos guardados. Vuelve a abrir el modo de campo con la cuenta actual.","Die Sitzung hat sich geändert. Gespeicherte Daten bleiben erhalten. Öffnen Sie den Außendienstmodus erneut mit dem aktuellen Konto."],"routeSessionReopen":["Reabrir modo de campo","Reopen field mode","Rouvrir le mode terrain","Volver a abrir el modo de campo","Außendienstmodus erneut öffnen"]};
let browser,completed=false,checks=0;const releases=[];
const deadline=setTimeout(()=>{console.error('Route session language scenario incomplete');process.exit(1);},110000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
  const now = Date.now(), vehicle = await prisma.vehicle.create({ data: { plate: 'SESSION-LANG-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Session <b>{owner}</b>', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Session language client', active: true } });
  const pools = await Promise.all(['REGULAR', 'EXTRA'].map(type => prisma.pool.create({ data: { clientId: client.id, name: type + ' session', active: true } })));
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(row => row._max.id || 0)) + 1, common = { id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date() };
  await prisma.serviceVisit.create({ data: { ...common, poolId: pools[0].id, date: new Date(), plannedDate: new Date() } });
  await prisma.extraVisit.create({ data: { ...common, poolId: pools[1].id, scheduledAt: new Date() } });
  for (const table of ['ServiceVisit', 'ExtraVisit']) await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),${id},true)`);
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'AT-SESSION-LANG-' + vehicle.id, status: 'ACTIVE', validUntil: new Date(now + 30 * 86400000), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(now + 30 * 86400000) } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });

  const otherVehicle=await prisma.vehicle.create({data:{plate:'SESSION-OTHER-'+now,active:true}});
  const other=await prisma.technician.create({data:{name:'Other session owner',vehicleId:otherVehicle.id,active:true}}),otherPool=await prisma.pool.create({data:{clientId:client.id,name:'B private pool <b>{owner}</b>',active:true}});
  const otherGuide=await prisma.transportGuide.create({data:{vehicleId:otherVehicle.id,codeAT:'AT-SESSION-OTHER-'+otherVehicle.id,status:'ACTIVE',validUntil:new Date(now+30*86400000),isDraft:false}});
  await prisma.workGuide.create({data:{vehicleId:otherVehicle.id,technicianId:other.id,guideId:otherGuide.id,status:'OPEN',isDraft:false}});
  for(const type of ['INSURANCE','INSPECTION'])await prisma.vehicleMaintenanceRecord.create({data:{vehicleId:otherVehicle.id,type,title:type,status:'ACTIVE',dueDate:new Date(now+30*86400000)}});
  const otherVisit=await prisma.serviceVisit.create({data:{clientId:client.id,poolId:otherPool.id,technicianId:other.id,date:new Date(),plannedDate:new Date(),status:'IN_PROGRESS',startAt:new Date()}});
  const otherToken=jwt.sign({id:other.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'}),renewed=jwt.sign({id:tech.id,role:'TECHNICIAN',nonce:'renewed'},getJwtSecret(),{expiresIn:'1h'});
  const cacheName=require('node:fs').readFileSync('frontend/sw.js','utf8').match(/const CACHE = '([^']+)'/)[1];
  browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  const database=()=>Promise.all([prisma.serviceVisit.findUnique({where:{id}}),prisma.extraVisit.findUnique({where:{id}}),prisma.serviceVisit.findUnique({where:{id:otherVisit.id}}),prisma.transportGuide.findMany({where:{id:{in:[guide.id,otherGuide.id]}},orderBy:{id:'asc'}}),prisma.workGuide.findMany({where:{vehicleId:{in:[vehicle.id,otherVehicle.id]}},orderBy:{id:'asc'}}),prisma.fieldWriteRequest.count(),prisma.stockMovement.count()]);
  async function scenario({name,mode='account',offline=false,type='REGULAR',widths=[320,390,1440],hold=false}){
    const context=await browser.newContext({viewport:{width:390,height:1400},timezoneId:'Europe/Lisbon'}),requests=[],errors=[];
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    await context.addInitScript(({token,person,origin,now,legacyKey})=>{
      if(top!==window||location.origin!==origin)return;
      if(!localStorage.getItem('qaRouteSessionLanguages')){
        for(const key of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(key,token);
        for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:person.id,name:person.name,role:'TECHNICIAN'}));
        localStorage.setItem(legacyKey,'{"private":"UNATTRIBUTED SESSION ROUTE"}');localStorage.setItem('qaRouteSessionLanguages','1');
      }
      Date.now=()=>now;const interval=window.setInterval;window.setInterval=(callback,delay,...args)=>[15000,30000,60000].includes(delay)?0:interval(callback,delay,...args);
      Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});
    },{token:otherToken,person:other,origin:base,now,legacyKey:'cwFieldRoute:'+tech.id});
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/api/'))requests.push({path,method:request.method(),body:request.postData(),auth:request.headers().authorization});});
    const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const open=async(visitId,visitType)=>{await page.goto(base+'/technician-field-mode?selectedVisitId='+visitId+'&selectedVisitType='+visitType,{waitUntil:'domcontentloaded'});await page.waitForFunction(({visitId,visitType})=>CWFieldVisitContext()?.id===visitId&&CWFieldVisitContext()?.visitType===visitType&&['transportGuideBox','workGuideBox','insuranceBox'].every(id=>document.getElementById(id).dataset.source==='live')&&!['…',''].includes(document.getElementById('fieldPhotosValue')?.textContent),{visitId,visitType});await page.locator('[data-field-tab-button=agora]').click();};
    const fill=async(label)=>{await page.locator('#notes').fill(label+' draft <b>{owner}</b>');await page.locator('#ph').fill('7.4');await page.locator('#chlorine').fill('1.2');await page.locator('#cleaned').check();await page.locator('#vacuumed').check();await page.waitForFunction(()=>document.getElementById('fieldSaveStatus').dataset.state==='saved');};
    await open(otherVisit.id,'REGULAR');await fill('B');
    await page.evaluate(({token,tech})=>CristalAuth.persistSession(token,{id:tech.id,name:tech.name,role:'TECHNICIAN'}),{token,tech});
    await open(id,'REGULAR');await fill('REGULAR');await open(id,'EXTRA');await fill('EXTRA');if(type==='REGULAR')await open(id,'REGULAR');
    await page.locator('#cwLanguageSelect').selectOption('en');await settle();
    await page.evaluate(async id=>{
      await CWFieldWriteStore.prepare('VISIT_COMPLETION',id,{visitId:id,notes:'REGULAR pending <b>{owner}</b>'});
      await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION',id,{visitType:'EXTRA',notes:'EXTRA pending <b>{owner}</b>'});
      window.qaRouteCalls={};
      for(const [group,api,names]of [['route',CWFieldRouteCache,['read','save','update']],['documents',CWFieldDocuments,['load']],['photos',CWFieldPhotos,['sync']]])for(const name of names){const fn=api[name];api[name]=(...args)=>{const key=group+':'+name;qaRouteCalls[key]=(qaRouteCalls[key]||0)+1;return fn(...args);};}
    },id);
    const rows=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('cw-field-writes',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,read=db.transaction('requests').objectStore('requests').getAll();read.onsuccess=()=>{db.close();resolve(read.result.sort((a,b)=>a.key.localeCompare(b.key)));};read.onerror=()=>reject(read.error);};}));
    const raw=()=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(key=>/^cwField|^cw:tech/.test(key)).sort().map(key=>[key,localStorage.getItem(key)])));
    const saved=await raw(),pending=await rows();assert.equal(pending.length,2);assert.deepEqual(pending.map(row=>row.scope).sort(),['EXTRA_VISIT_COMPLETION','VISIT_COMPLETION']);assert(pending.every(row=>row.owner==='TECH:'+tech.id&&row.resourceId===id&&!row.response&&row.payloadHash.length===64));assert.notEqual(pending[0].requestId,pending[1].requestId);
    let release,entered,heldWork;
    if(hold){
      const started=new Promise(resolve=>{entered=resolve;});heldWork=new Promise(resolve=>{release=resolve;releases.push(resolve);});
      await page.route(base+'/api/technician/today?*',async route=>{const response=await route.fetch();entered();await heldWork;await route.fulfill({response}).catch(()=>{});});
      await page.evaluate(()=>document.getElementById('fieldReloadBtn').click());await started;
    }
    await page.evaluate(()=>navigator.serviceWorker.ready);assert(await page.evaluate(name=>caches.keys().then(keys=>keys.includes(name)),cacheName));
    if(offline)await context.setOffline(true);
    if(mode==='missing')await page.evaluate(()=>{window.qaRouteToken=CristalAuth.getToken;CristalAuth.getToken=()=>null;window.dispatchEvent(new Event('storage'));});
    else await page.evaluate(async({credential,person})=>{await CristalAuth.persistSession(credential,{id:person.id,name:person.name,role:'TECHNICIAN'});window.dispatchEvent(new StorageEvent('storage',{key:'cristalwater_jwt'}));},{credential:mode==='renewal'?renewed:otherToken,person:mode==='renewal'?tech:other});
    await page.waitForSelector('#fieldRouteSessionChanged');
    if(hold){const finished=page.waitForResponse(response=>response.url().includes('/api/technician/today?'));release();await finished;await page.unroute(base+'/api/technician/today?*');}
    await settle();
    assert.equal(await page.locator('#fieldRouteSessionChanged p').textContent(),words.routeSessionChanged[1],'Blocked banner follows language chosen before account change');
    assert.equal(await page.locator('#fieldRouteSessionChanged a').getAttribute('href'),'/technician-field-mode');assert.equal(await page.locator('#fieldRouteSessionChanged').getAttribute('role'),'alert');assert.equal(await page.locator('#cwLanguageSelect').isVisible(),false);
    assert.deepEqual(await raw(),saved);assert.deepEqual(await rows(),pending);assert.deepEqual(await page.evaluate(()=>CWFieldDaySnapshot()),{confirmedAt:null,visits:[]});assert.equal(await page.evaluate(()=>CWFieldVisitContext()),null);
    await page.evaluate(()=>{window.qaRouteNodes=[...document.querySelectorAll('#fieldRouteSessionChanged,#fieldRouteSessionChanged p,#fieldRouteSessionChanged a')];window.qaRouteInputs=['notes','ph','chlorine','alkalinity','salt','orp','temperature','cleaned','vacuumed','basketCleaned','brushed','waterlineClean','backwashDone'].map(id=>document.getElementById(id));});await page.locator('#fieldRouteSessionChanged a').focus();
    const state=()=>page.evaluate(()=>({calls:qaRouteCalls,day:CWFieldDaySnapshot(),visit:CWFieldVisitContext(),tokens:['token','cristalwater_jwt','adminToken'].map(key=>localStorage.getItem(key)),users:['user','cristalwater_user'].map(key=>{const user=JSON.parse(localStorage.getItem(key));delete user.language;return user;}),fields:qaRouteInputs.map(node=>{if(!node)throw Error('Missing protected field');return [node.id,node.value,node.checked,node.disabled,node.readOnly,node.hidden];}),main:{inert:document.querySelector('main.field').inert,display:getComputedStyle(document.querySelector('main.field')).display,priority:document.querySelector('main.field').style.getPropertyPriority('display')},role:qaRouteNodes[0].getAttribute('role'),href:qaRouteNodes[2].getAttribute('href'),focus:document.activeElement===qaRouteNodes[2]}));
    const before=await state(),db=await database(),first=requests.length;assert(before.main.inert&&before.main.display==='none'&&before.main.priority==='important');
    for(const width of widths){await page.setViewportSize({width,height:1400});for(const [i,language]of languages.entries()){
      await page.evaluate(language=>CristalI18n.applyLanguage(language),language);await settle();
      assert.equal(await page.locator('#fieldRouteSessionChanged p').textContent(),words.routeSessionChanged[i]);assert.equal(await page.locator('#fieldRouteSessionChanged a').textContent(),words.routeSessionReopen[i]);assert.deepEqual(await state(),before);assert.deepEqual(await raw(),saved);assert.deepEqual(await rows(),pending);assert.deepEqual(await database(),db);
      assert(await page.evaluate(()=>qaRouteNodes.every(node=>node.isConnected)&&qaRouteInputs.every(node=>node.isConnected)&&document.documentElement.scrollWidth<=innerWidth+1));
      for(const selector of ['#fieldRouteSessionChanged p','#fieldRouteSessionChanged a'])assert(await page.locator(selector).evaluate(node=>node.scrollWidth<=node.clientWidth+1));
      checks++;if(process.env.CW_ROUTE_SESSION_CAPTURE&&width===320&&language==='de'){await fs.mkdir(process.env.CW_ROUTE_SESSION_CAPTURE,{recursive:true});await page.locator('#fieldRouteSessionChanged').screenshot({path:process.env.CW_ROUTE_SESSION_CAPTURE+'/'+name+'-de-320.png'});}
    }}
    for(const request of requests.slice(first)){assert.equal(request.path,'/api/settings/language/me');assert.equal(request.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']);assert.equal(request.auth,'Bearer '+(mode==='account'?otherToken:mode==='renewal'?renewed:token));}
    if(mode==='missing')await page.evaluate(()=>{CristalAuth.getToken=qaRouteToken;});
    if(mode!=='account'){assert(await page.locator('main.field').evaluate(node=>node.inert&&getComputedStyle(node).display==='none'));assert.deepEqual(await raw(),saved);assert.deepEqual(await rows(),pending);}
    await page.locator('#fieldRouteSessionChanged a').click();const expectedId=mode==='account'?otherVisit.id:id;
    await page.waitForFunction(expectedId=>window.CWFieldVisitContext?.()?.id===expectedId&&!document.querySelector('main.field').inert&&getComputedStyle(document.querySelector('main.field')).display!=='none',expectedId);
    assert.equal(await page.locator('#fieldRouteSessionChanged').count(),0);assert.equal(await page.locator('#notes').inputValue(),(mode==='account'?'B':type)+' draft <b>{owner}</b>');
    const reopened=await raw();
    if(mode==='account'&&!offline){
      const refreshedKey=Object.keys(saved).find(key=>key.startsWith('cwFieldRoute:v3:TECH:'+other.id+':'));
      assert(refreshedKey,'The other account already has its own typed route');
      const original=JSON.parse(saved[refreshedKey]),current=JSON.parse(reopened[refreshedKey]);
      assert.equal(current.owner,'TECH:'+other.id);assert(current.visits.every(visit=>visit.technician.id===other.id));
      assert(Number.isFinite(Date.parse(current.serverConfirmedAt))&&Date.parse(current.serverConfirmedAt)>=Date.parse(original.serverConfirmedAt));
      current.serverConfirmedAt=original.serverConfirmedAt;assert.deepEqual(current,original,'Only a new confirmation time is expected for the explicitly reopened current-account route');
      reopened[refreshedKey]=saved[refreshedKey];
    }
    const uiKey='cw:tech-field:ui-state:v1',ui=JSON.parse(reopened[uiKey]),previousUi=JSON.parse(saved[uiKey]);
    assert.deepEqual(Object.keys(ui).sort(),Object.keys(previousUi).sort());assert.equal(ui.activeTab,previousUi.activeTab);assert.equal(ui.activeFilter,previousUi.activeFilter);
    assert.equal(ui.selectedVisitId,String(expectedId));assert.equal(ui.selectedVisitType,mode==='account'?'REGULAR':type);assert.equal(ui.selectedVisitTitle,mode==='account'?otherPool.name:pools[type==='EXTRA'?1:0].name);
    assert(Number.isFinite(ui.scrollY)&&ui.scrollY>=0);assert(Number.isFinite(Date.parse(ui.savedAt))&&Date.parse(ui.savedAt)>=Date.parse(previousUi.savedAt));
    reopened[uiKey]=saved[uiKey];
    assert.deepEqual(reopened,saved,'Explicit navigation may update the selected visit and confirmation time, but preserves every draft, pending-work and former-account context byte');assert.deepEqual(await rows(),pending);assert.deepEqual(await database(),db);
    assert(requests.filter(request=>!['GET','HEAD'].includes(request.method)).every(request=>request.path==='/api/settings/language/me'&&request.method==='PUT'));assert.deepEqual(errors,[]);
    console.log('PASS route session languages '+JSON.stringify({name,mode,offline,type,widths,pending:2,heldReplyIgnored:hold,reopenedCurrentAccount:true,operationalWrites:0}));await context.close();
  }
  await scenario({name:'account-online',hold:true});await scenario({name:'renewal-offline',mode:'renewal',offline:true});await scenario({name:'missing-offline',mode:'missing',offline:true});await scenario({name:'extra-account-offline',offline:true,type:'EXTRA',widths:[320]});
  console.log('PASS route session language result '+JSON.stringify({checks,typedDrafts:true,immutablePendingRequests:2,hiddenSelectorKept:true,noOperationalWrites:true,recoveryLink:true}));completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const release of releases)release();clearTimeout(deadline);await browser?.close();await prisma.$disconnect();});
