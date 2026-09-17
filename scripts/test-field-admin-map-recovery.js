'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright'), { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
let browser;
(async()=>{
 const stamp=Date.now(), admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}});
 const user={id:admin.id,userId:admin.id,role:'ADMIN',principalType:'USER'}, token=jwt.sign(user,getJwtSecret(),{expiresIn:'1h'});
 const client=await prisma.client.create({data:{name:'QA map '+stamp,active:true}});
 const pools=await Promise.all([
  {name:'<img src=x onerror=alert(1)> zero '+stamp,latitude:0,longitude:0},
  {name:'QA near '+stamp,latitude:37.1,longitude:-8.6},
  {name:null},
  {name:'QA invalid '+stamp,latitude:91,longitude:0}
 ].map(p=>prisma.pool.create({data:{...p,clientId:client.id}})));
 const a=await prisma.technician.create({data:{name:'QA route A '+stamp,active:true}}),b=await prisma.technician.create({data:{name:'QA route B '+stamp,active:true}});
 const day='2026-09-19';
 for(const [i,pool] of pools.entries())await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:a.id,status:'PLANNED',plannedDate:new Date(day+'T12:00:00Z')}});
 await prisma.serviceVisit.create({data:{poolId:pools[1].id,clientId:client.id,technicianId:b.id,status:'PLANNED',plannedDate:new Date(day+'T12:00:00Z')}});
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
 await context.route('**/crystal-os-v2-nav.js',async route=>{await new Promise(r=>setTimeout(r,200));await route.continue();});
 await context.addInitScript(({user,token})=>{
  for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);
  for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(user));
  localStorage.setItem('cw_language','pt');localStorage.setItem('cwMapDraftPreserved','keep');
  window.qaGeoMode='ready';
  Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(ok,fail){
   const reply=()=>ok({coords:{latitude:37.1,longitude:-8.6},timestamp:Date.now()});
   if(window.qaGeoMode==='hold')window.qaReleaseGeo=reply;
   else if(window.qaGeoMode==='deny')fail({code:1});
   else reply();
  }}});
 },{user,token});
 const goto=url=>page.goto(base+url,{waitUntil:'networkidle'}),state=async s=>{
  try { await page.waitForFunction(s=>document.getElementById('mapStatus').dataset.state===s,s); }
  catch(error){console.error('MAP STATE',await page.evaluate(()=>({path:location.pathname,status:document.getElementById('mapStatus')?.outerHTML})),errors);throw error;}
 };
 await goto('/admin-map');await state('ready');
 assert.equal(await page.locator('#mapNotice').getAttribute('data-state'),'unavailable');
 const card=id=>page.locator('#mapList [data-record-id="'+id+'"]');
 assert.equal(await card(pools[0].id).locator('h2').textContent(),pools[0].name);assert.equal(await card(pools[0].id).locator('img').count(),0);
 assert.equal(await card(pools[0].id).locator('a').first().getAttribute('href'),'https://www.google.com/maps?q=0,0');
 for(const pool of pools.slice(2))assert.equal(await card(pool.id).locator('a').count(),0);
 assert.equal(await card(pools[2].id).locator('h2').textContent(),'Piscina #'+pools[2].id);
 await page.locator('#mapNearby').click();await state('ready');
 const ordered=await page.locator('#mapList article').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.recordId)));
 assert(ordered.indexOf(pools[1].id)<ordered.indexOf(pools[0].id));
 await page.evaluate(()=>window.qaGeoMode='deny');await page.locator('#mapNearby').click();await state('error');
 assert.equal(await page.locator('#mapList a').count(),0);await page.evaluate(()=>window.qaGeoMode='ready');
 for(const [status,json]of [[503,{}],[202,{ok:true,pools:[]}],[200,[]],[200,{ok:true,pools:[{id:1,name:'a'},{id:1,name:'b'}]}]]){
  await page.route('**/api/pools',r=>r.fulfill({status,json}));await page.locator('#mapLoad').click();await state('error');assert.equal(await page.locator('#mapList article').count(),0);await page.unroute('**/api/pools');
 }
 await page.route('**/api/pools',r=>r.fulfill({json:{ok:true,pools:[]}}));await page.locator('#mapLoad').click();await state('empty');await page.unroute('**/api/pools');
 await page.locator('#mapLoad').click();await state('ready');
 const visual=path.join(__dirname,'../reports/field-visual/admin-map-'+stamp);fs.mkdirSync(visual,{recursive:true});
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});
  assert(await page.locator('#mapList article').evaluateAll(nodes=>nodes.every(n=>n.clientWidth>=240&&n.scrollWidth<=n.clientWidth+1)));
  await page.screenshot({path:path.join(visual,'pools-'+width+'.png')});
 }
 console.log('PASS pools: actual object response, literal names, zero/missing/invalid coordinates, proximity/GPS failure, failed/malformed/empty reads and three widths without external map');
 await goto('/route-map');await state('idle');await page.locator('#mapDate').fill(day);await page.locator('#mapTechnician').selectOption(String(a.id));
 await page.locator('#mapLoad').click();await state('ready');assert.equal(await page.locator('#mapList article').count(),4);
 assert.equal(await page.locator('#mapList a').count(),4);
 await page.locator('#mapTechnician').selectOption(String(b.id));await state('idle');assert.equal(await page.locator('#mapList a').count(),0);
 await page.locator('#mapLoad').click();await state('ready');assert.equal(await page.locator('#mapList article').count(),1);
 await page.locator('#mapDate').fill('2026-09-20');assert.equal(await page.locator('#mapList a').count(),0);await page.locator('#mapLoad').click();await state('empty');
 await page.locator('#mapDate').fill(day);
 await page.route('**/api/route/optimize?**',async r=>{const response=await r.fetch();await r.fulfill({response,headers:{...response.headers(),'x-cw-route-technician':String(a.id)}});});
 await page.locator('#mapLoad').click();await state('error');await page.unroute('**/api/route/optimize?**');
 await page.evaluate(()=>window.qaGeoMode='hold');await page.locator('#mapLoad').click();
 await page.waitForFunction(()=>!!window.qaReleaseGeo);await page.locator('#mapDate').fill('2026-09-20');await page.evaluate(()=>window.qaReleaseGeo());
 await page.waitForTimeout(100);assert.equal(await page.locator('#mapStatus').getAttribute('data-state'),'idle');assert.equal(await page.locator('#mapList a').count(),0);
 await page.evaluate(()=>window.qaGeoMode='ready');await page.locator('#mapDate').fill(day);await page.locator('#mapLoad').click();await state('ready');
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
  assert(await page.locator('.map-controls input,.map-controls select,.map-controls button').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth+1;})));
  await page.screenshot({path:path.join(visual,'route-'+width+'.png')});
 }
 console.log('PASS route: existing endpoint, selected technician/date, regular planned visits, unknown coordinates, response scope validation and stale GPS after selection change');
 let entered,release;const arrival=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 await page.route('**/api/route/optimize?**',async route=>{const response=await route.fetch();entered();await gate;await route.fulfill({response});});
 await page.locator('#mapLoad').click();await arrival;await page.evaluate(()=>localStorage.setItem('cristalwater_user','changed'));release();await state('session');
 assert.equal(await page.locator('#mapList a').count(),0);assert.equal(await page.locator('#mapTechnician option').count(),0);assert(await page.locator('#mapLoad').isDisabled());
 assert.equal(await page.evaluate(()=>localStorage.getItem('cwMapDraftPreserved')),'keep');assert.deepEqual(errors,[]);await context.close();
 // Controlled Leaflet contract tests exercise layers and tile errors; the
 // preceding checks use the real API with all external resources unavailable.
 const mapped=await browser.newContext({serviceWorkers:'block'});await mapped.addInitScript(({user,token})=>{
  for(const k of ['token','cristalwater_jwt'])localStorage.setItem(k,token);
  for(const k of ['user','cristalwater_user'])localStorage.setItem(k,JSON.stringify(user));
  window.qaLayers=[];window.qaPopups=[];
  const layer={addTo(){return this},clearLayers(){window.qaLayers=[]}};
  window.L={map(){return{setView(){return this},fitBounds(){},invalidateSize(){},remove(){window.qaLayers=[]}}},layerGroup(){return layer},tileLayer(){return{on(_,fn){window.qaTileError=fn;return this},addTo(){return this}}},marker(coords){return{bindPopup(node){window.qaPopups.push({text:node.textContent,children:node.children.length});return this},addTo(){window.qaLayers.push(coords);return this}}},polyline(coords){return{addTo(){window.qaLayers.push(coords);return this}}}};
 },{user,token});
 await mapped.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 const mapPage=await mapped.newPage();await mapPage.goto(base+'/admin-map',{waitUntil:'networkidle'});await mapPage.waitForFunction(()=>document.getElementById('mapStatus').dataset.state==='ready');
 const n=await mapPage.evaluate(()=>qaLayers.length);assert(n>=2);
 assert(await mapPage.evaluate(()=>qaLayers.some(p=>p[0]===0&&p[1]===0)));
 assert(await mapPage.evaluate(()=>qaPopups.every(p=>p.children===0)));
 await mapPage.locator('#mapLoad').click();await mapPage.waitForFunction(()=>document.getElementById('mapStatus').dataset.state==='ready');
 assert.equal(await mapPage.evaluate(()=>qaLayers.length),n,'Reload replaces markers');
 await mapPage.evaluate(()=>qaTileError());assert(await mapPage.locator('#map').isHidden());assert((await mapPage.locator('#mapList article').count())>=4);
 await mapped.close();console.log('PASS map layers: reload replaces markers, literal popup nodes and tile failure preserves usable list; evidence '+visual);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();await prisma.$disconnect();});
