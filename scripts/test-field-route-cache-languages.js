'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),jwt=require('jsonwebtoken'),{chromium}=require('playwright');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const languages=['pt','en','fr','es','de'],words={"routeCacheSaveFailed":["A ronda não ficou guardada para uso offline. {detail}","The round was not saved for offline use. {detail}","La tournée n’a pas été enregistrée pour une utilisation hors ligne. {detail}","La ronda no se ha guardado para usarla sin conexión. {detail}","Die Tour wurde nicht für die Offline-Nutzung gespeichert. {detail}"],"routeCacheUnconfirmed":["Ronda de {day}, consultada no servidor em {date}. Sem confirmação atual; alterações do escritório por verificar.","Round for {day}, checked on the server at {date}. No current confirmation; office changes still need checking.","Tournée du {day}, consultée sur le serveur le {date}. Pas de confirmation actuelle ; les modifications du bureau restent à vérifier.","Ronda del {day}, consultada en el servidor el {date}. Sin confirmación actual; los cambios de la oficina están por comprobar.","Tour vom {day}, auf dem Server abgerufen am {date}. Keine aktuelle Bestätigung; Änderungen des Büros müssen noch geprüft werden."]};
const text=(key,index,params)=>words[key][index].replace(/\{(\w+)\}/g,(_,key)=>params[key]);
let browser,completed=false,checks=0;
const deadline=setTimeout(()=>{console.error('Route cache language scenario incomplete');process.exit(1);},110000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
  const now=Date.now(),vehicle=await prisma.vehicle.create({data:{plate:'CACHE-LANG-'+now,active:true}});
  const tech=await prisma.technician.create({data:{name:'Cache owner <b>{day}</b>',vehicleId:vehicle.id,active:true}});
  const client=await prisma.client.create({data:{name:'Cache language client',active:true}});
  const pools=await Promise.all(['REGULAR','EXTRA'].map(type=>prisma.pool.create({data:{clientId:client.id,name:type+' cache <b>{day}</b>',active:true}})));
  const maxima=await Promise.all([prisma.serviceVisit.aggregate({_max:{id:true}}),prisma.extraVisit.aggregate({_max:{id:true}})]);
  const id=Math.max(...maxima.map(row=>row._max.id||0))+1,common={id,clientId:client.id,technicianId:tech.id,status:'PLANNED'};
  await prisma.serviceVisit.create({data:{...common,poolId:pools[0].id,date:new Date(),plannedDate:new Date()}});
  await prisma.extraVisit.create({data:{...common,poolId:pools[1].id,scheduledAt:new Date()}});
  for(const table of ['ServiceVisit','ExtraVisit'])await prisma.$queryRawUnsafe('SELECT setval(pg_get_serial_sequence(\'"'+table+'"\',\'id\'),'+id+',true)');
  const guide=await prisma.transportGuide.create({data:{vehicleId:vehicle.id,codeAT:'AT-CACHE-LANG-'+vehicle.id,status:'ACTIVE',validUntil:new Date(now+30*86400000),isDraft:false}});
  await prisma.workGuide.create({data:{vehicleId:vehicle.id,technicianId:tech.id,guideId:guide.id,status:'OPEN',isDraft:false}});
  for(const type of ['INSURANCE','INSPECTION'])await prisma.vehicleMaintenanceRecord.create({data:{vehicleId:vehicle.id,type,title:type,status:'ACTIVE',dueDate:new Date(now+30*86400000)}});
  const token=jwt.sign({id:tech.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'}),legacyKey='cwFieldRoute:'+tech.id;
  browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:390,height:1400},timezoneId:'Europe/Lisbon'}),requests=[],errors=[];
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await context.addInitScript(({token,tech,origin,now,legacyKey})=>{
    if(top!==window||location.origin!==origin)return;
    if(!localStorage.getItem('qaRouteCacheLanguages')){
      for(const key of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(key,token);
      for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));
      localStorage.setItem(legacyKey,'{"private":"UNATTRIBUTED CACHE HISTORY <b>{day}</b>"}');localStorage.setItem('qaRouteCacheLanguages','1');
    }
    Date.now=()=>now;const interval=window.setInterval;window.setInterval=(callback,delay,...args)=>[15000,30000,60000].includes(delay)?0:interval(callback,delay,...args);
    Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});
  },{token,tech,origin:base,now,legacyKey});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/api/'))requests.push({path,method:request.method(),body:request.postData(),auth:request.headers().authorization});});
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const locale=async language=>{await page.locator('#cwLanguageSelect').selectOption(language);await settle();};
  const ready=async type=>{await page.waitForFunction(({id,type})=>window.CWFieldVisitContext?.()?.id===id&&CWFieldVisitContext().visitType===type&&['transportGuideBox','workGuideBox','insuranceBox'].every(key=>['live','cache'].includes(document.getElementById(key).dataset.source))&&!['…',''].includes(document.getElementById('fieldPhotosValue')?.textContent),{id,type});await page.locator('[data-field-tab-button=agora]').click();await settle();};
  const open=async type=>{await page.goto(base+'/technician-field-mode?selectedVisitId='+id+'&selectedVisitType='+type,{waitUntil:'domcontentloaded'});await ready(type);};
  const fill=async type=>{await page.locator('#notes').fill(type+' cache draft <b>{day}</b>');await page.locator('#ph').fill('7.4');await page.locator('#chlorine').fill('1.2');await page.locator('#cleaned').check();await page.locator('#vacuumed').check();await page.waitForFunction(()=>document.getElementById('fieldSaveStatus').dataset.state==='saved');};
  const raw=()=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(key=>/^cwField|^cw:tech/.test(key)).sort().map(key=>[key,localStorage.getItem(key)])));
  const pending=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('cw-field-writes',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,read=db.transaction('requests').objectStore('requests').getAll();read.onsuccess=()=>{db.close();resolve(read.result.sort((a,b)=>a.key.localeCompare(b.key)));};read.onerror=()=>reject(read.error);};}));
  const database=()=>Promise.all([prisma.serviceVisit.findUnique({where:{id}}),prisma.extraVisit.findUnique({where:{id}}),prisma.transportGuide.findUnique({where:{id:guide.id}}),prisma.workGuide.findMany({where:{vehicleId:vehicle.id},orderBy:{id:'asc'}}),prisma.fieldWriteRequest.count(),prisma.stockMovement.count()]);
  const installCalls=()=>page.evaluate(()=>{window.qaCacheCalls={};for(const [group,api,names]of [['route',CWFieldRouteCache,['read','save','update']],['documents',CWFieldDocuments,['load']],['photos',CWFieldPhotos,['list','save','sync']],['draft',CWFieldVisitDrafts,['save','prepare','load']]])for(const name of names){const fn=api?.[name];if(typeof fn!=='function')continue;api[name]=(...args)=>{const key=group+':'+name;qaCacheCalls[key]=(qaCacheCalls[key]||0)+1;return fn(...args);};}});
  const state=()=>page.evaluate(()=>({day:CWFieldDaySnapshot(),visit:CWFieldVisitContext(),calls:qaCacheCalls,tokens:['token','cristalwater_jwt','adminToken'].map(key=>localStorage.getItem(key)),users:['user','cristalwater_user'].map(key=>{const user=JSON.parse(localStorage.getItem(key));delete user.language;return user;}),fields:qaCacheFields.map(node=>{assertField(node);return[node.id,node.value,node.checked,node.disabled,node.readOnly,node.hidden];}),warning:{hidden:qaCacheNode.hidden,role:qaCacheNode.getAttribute('role')},controls:qaCacheControls.map(node=>[node.id,node.hidden,node.disabled]),quota:window.qaQuota?[qaQuota.name,qaQuota.message,window.qaLastQuota===qaQuota]:null}));
  async function matrix({name,key,params={},literal,widths=[320,390,1440]}){
    await settle();await installCalls();await page.locator('#cwLanguageSelect').focus();
    await page.evaluate(()=>{window.assertField=node=>{if(!node)throw Error('Missing protected field');};window.qaCacheNode=document.getElementById('fieldRouteAge');window.qaCacheFields=['notes','ph','chlorine','alkalinity','salt','orp','temperature','cleaned','vacuumed','basketCleaned','brushed','waterlineClean','backwashDone'].map(id=>document.getElementById(id));window.qaCacheControls=['startBtn','finishBtn','fieldReloadBtn'].map(id=>document.getElementById(id));window.qaCacheHandlers=qaCacheControls.map(node=>node.onclick);window.qaCacheFocus=document.activeElement;});
    const before=await state(),stored=await raw(),writes=await pending(),db=await database(),first=requests.length;
    assert.equal(writes.length,2);assert(writes.every(row=>!row.response));assert.equal(before.warning.role,'status');assert.equal(before.warning.hidden,false);
    for(const width of widths){await page.setViewportSize({width,height:1400});for(const [index,language]of languages.entries()){
      await locale(language);assert.equal(await page.locator('#fieldRouteAge').textContent(),literal===undefined?text(key,index,params):literal);
      assert.deepEqual(await state(),before);assert.deepEqual(await raw(),stored);assert.deepEqual(await pending(),writes);assert.deepEqual(await database(),db);
      assert(await page.evaluate(()=>qaCacheNode===document.getElementById('fieldRouteAge')&&qaCacheNode.isConnected&&qaCacheFields.every(node=>node.isConnected)&&qaCacheControls.every((node,index)=>node.isConnected&&node.onclick===qaCacheHandlers[index])&&document.activeElement===qaCacheFocus));
      assert.equal(await page.locator('#fieldRouteAge b').count(),0);assert(await page.locator('#fieldRouteAge').evaluate(node=>node.scrollWidth<=node.clientWidth+1));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      checks++;if(process.env.CW_ROUTE_CACHE_CAPTURE&&language==='de'&&width===320&&literal===undefined){await fs.mkdir(process.env.CW_ROUTE_CACHE_CAPTURE,{recursive:true});await page.locator('#fieldRouteAge').screenshot({path:process.env.CW_ROUTE_CACHE_CAPTURE+'/'+name+'-de-320.png'});}
    }}
    for(const request of requests.slice(first)){assert.equal(request.path,'/api/settings/language/me');assert.equal(request.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']);assert.equal(request.auth,'Bearer '+token);}
    console.log('PASS route cache languages '+JSON.stringify({name,widths,typedDrafts:true,immutablePending:2,literalDateAndDetails:true}));
  }
  const reload=async()=>{const previous=await page.evaluate(()=>CWFieldDaySnapshot().confirmedAt);await page.locator('#fieldReloadBtn').evaluate(button=>button.click());await page.waitForFunction(previous=>CWFieldDaySnapshot().confirmedAt&&CWFieldDaySnapshot().confirmedAt!==previous,previous);await ready('REGULAR');};
  const expect=async(key,params)=>{const language=await page.locator('html').getAttribute('lang'),expected=text(key,languages.indexOf(language),params);await page.waitForFunction(expected=>document.getElementById('fieldRouteAge').textContent===expected,expected);};
  await open('REGULAR');await fill('REGULAR');await open('EXTRA');await fill('EXTRA');await open('REGULAR');await locale('en');
  const cacheKey=await page.evaluate(()=>CWFieldRouteCache.key(CWFieldRouteCache.scope()));
  const routeRaw=()=>page.evaluate(key=>localStorage.getItem(key),cacheKey);
  await page.evaluate(async id=>{await CWFieldWriteStore.prepare('VISIT_COMPLETION',id,{visitId:id,notes:'REGULAR cache pending <b>{day}</b>'});await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION',id,{visitType:'EXTRA',notes:'EXTRA cache pending <b>{day}</b>'});},id);
  const originalPending=await pending();assert.deepEqual(originalPending.map(row=>row.scope).sort(),['EXTRA_VISIT_COMPLETION','VISIT_COMPLETION']);assert(originalPending.every(row=>row.resourceId===id&&row.owner==='TECH:'+tech.id&&row.payloadHash.length===64&&!row.response));assert.notEqual(originalPending[0].requestId,originalPending[1].requestId);
  const originalDb=await database(),quotaDetail='Raw <b>{day}</b> — A ronda não ficou guardada para uso offline.';
  const quota=()=>page.evaluate(({key,detail})=>{window.qaQuota=new DOMException(detail,'QuotaExceededError');window.qaSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key){window.qaLastQuota=qaQuota;throw qaQuota;}return qaSet.call(this,k,v);};},{key:cacheKey,detail:quotaDetail});
  const restoreQuota=()=>page.evaluate(()=>{Storage.prototype.setItem=qaSet;});
  const original=await routeRaw();await quota();await reload();
  assert.equal(await page.locator('#fieldRouteAge').textContent(),text('routeCacheSaveFailed',1,{detail:quotaDetail}),'Save warning follows the real language selector');
  assert.equal(await routeRaw(),original);assert(await page.evaluate(()=>Number.isFinite(Date.parse(CWFieldDaySnapshot().confirmedAt))));assert.equal(await page.locator('#notes').inputValue(),'REGULAR cache draft <b>{day}</b>');
  await matrix({name:'save-quota-online',key:'routeCacheSaveFailed',params:{detail:quotaDetail}});
  const foreign=text('routeCacheSaveFailed',0,{detail:quotaDetail});await page.evaluate(value=>document.getElementById('fieldRouteAge').textContent=value,foreign);
  await matrix({name:'foreign-identical',literal:foreign});assert.equal(await page.locator('#fieldRouteAge').getAttribute('data-cw-alert-copy'),null);
  await restoreQuota();await reload();assert(await page.locator('#fieldRouteAge').evaluate(node=>node.hidden));
  const valid=await routeRaw(),corrupt='{corrupt cache <b>{day}</b>';
  await page.evaluate(({key,corrupt})=>localStorage.setItem(key,corrupt),{key:cacheKey,corrupt});await reload();
  const corruptDetail='A ronda guardada está ilegível. Os dados foram preservados; peça apoio ao escritório.';
  await expect('routeCacheSaveFailed',{detail:corruptDetail});assert.equal(await routeRaw(),corrupt);assert(await page.evaluate(()=>Number.isFinite(Date.parse(CWFieldDaySnapshot().confirmedAt))));
  await matrix({name:'save-corrupt-online',key:'routeCacheSaveFailed',params:{detail:corruptDetail}});
  await page.evaluate(({key,valid})=>localStorage.setItem(key,valid),{key:cacheKey,valid});await reload();assert(await page.locator('#fieldRouteAge').evaluate(node=>node.hidden));
  const beforeOffline=await routeRaw();await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await ready('REGULAR');
  const fallback=JSON.parse(beforeOffline),date=await page.evaluate(raw=>new Date(raw).toLocaleString('pt-PT'),fallback.serverConfirmedAt),params={day:fallback.day,date};
  await expect('routeCacheUnconfirmed',params);assert.equal(await routeRaw(),beforeOffline);assert.equal(await page.evaluate(()=>CWFieldDaySnapshot().confirmedAt),null);assert.equal(await page.locator('#notes').inputValue(),'REGULAR cache draft <b>{day}</b>');assert.deepEqual(await pending(),originalPending);
  await matrix({name:'cached-offline',key:'routeCacheUnconfirmed',params});
  await locale('en');await quota();const beforeLocalStart=await routeRaw();
  await page.locator('#startBtn').click();await page.locator('#cwFieldCheckinOverlay').waitFor({state:'visible'});await page.locator('#cwFieldCheckinConfirm').click();await expect('routeCacheSaveFailed',{detail:quotaDetail});
  assert.equal(await routeRaw(),beforeLocalStart);assert.equal(await page.evaluate(()=>CWFieldDaySnapshot().confirmedAt),null);assert.equal(await page.locator('#toast').textContent(),'Start is only in memory: the round was not saved. Do not close the page.');assert.deepEqual(await database(),originalDb);assert.deepEqual(await pending(),originalPending);
  await matrix({name:'update-quota-offline',key:'routeCacheSaveFailed',params:{detail:quotaDetail}});await restoreQuota();
  await open('EXTRA');assert(await page.locator('#fieldRouteAge').evaluate(node=>!node.hidden));await locale('en');const extraOriginal=await routeRaw();
  await page.reload({waitUntil:'domcontentloaded'});await ready('EXTRA');
  const extra=JSON.parse(extraOriginal),extraDate=await page.evaluate(raw=>new Date(raw).toLocaleString('pt-PT'),extra.serverConfirmedAt);
  assert.equal(await page.locator('#notes').inputValue(),'EXTRA cache draft <b>{day}</b>');assert.equal(await routeRaw(),extraOriginal);assert.equal(await page.evaluate(()=>CWFieldDaySnapshot().confirmedAt),null);
  await matrix({name:'extra-cached-offline',key:'routeCacheUnconfirmed',params:{day:extra.day,date:extraDate},widths:[320]});
  assert.deepEqual(await pending(),originalPending);assert.deepEqual(await database(),originalDb);assert.deepEqual(errors,[]);
  assert(requests.filter(request=>!['GET','HEAD'].includes(request.method)).every(request=>request.path==='/api/settings/language/me'&&request.method==='PUT'));
  console.log('PASS route cache language result '+JSON.stringify({checks,typedDrafts:true,immutablePendingRequests:2,noOperationalWrites:true,originalQuotaError:true,offlineStartMemoryOnly:true,rawDatesAndDetails:true}));completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{clearTimeout(deadline);await browser?.close();await prisma.$disconnect();});
