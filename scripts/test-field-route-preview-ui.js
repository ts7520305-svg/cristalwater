'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
let browser; const releases = [];
(async () => {
  const tech = await prisma.technician.create({ data: { name: 'Route preview UI owner', active: true } }), other = await prisma.technician.create({ data: { name: 'Route preview UI other', active: true } });
  const client = await prisma.client.create({ data: { name: 'Route preview UI client', active: true } });
  const visits = []; const today = new Date(), tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  for (const [name, latitude, plannedDate] of [['Far destination',0.1,today],['Near <img src=x onerror=window.qaRouteXss=true>',0.01,today],['Missing coordinates',null,today],['Future destination',0.001,tomorrow]]) {
    const pool = await prisma.pool.create({ data: { name, latitude, longitude: latitude === null ? null : 0, active: true, clientId: client.id } });
    visits.push(await prisma.serviceVisit.create({ data: { technicianId: tech.id, poolId: pool.id, clientId: client.id, plannedDate, date: today, status: 'PLANNED' } }));
  }
  const token = jwt.sign({ id:tech.id,role:'TECHNICIAN' },getJwtSecret(),{expiresIn:'1h'}), otherToken = jwt.sign({ id:other.id,role:'TECHNICIAN' },getJwtSecret(),{expiresIn:'1h'});
  browser = await chromium.launch({ headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport:{width:390,height:844} });
  await context.addInitScript(({token,tech,origin})=>{
    if (location.origin!==origin||top!==window) return;
    for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);
    for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));
    window.qaGeo={mode:'allow',pending:[]};
    Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){},getCurrentPosition(success,failure){if(qaGeo.mode==='hold')qaGeo.pending.push(success);else if(qaGeo.mode==='deny')failure({code:1});else success({coords:{latitude:0,longitude:0,accuracy:10},timestamp:Date.now()});}}});
    window.alert=message=>{window.qaAlert=message;};
  },{token,tech,origin:new URL(base).origin});
  const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/technician.html',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelectorAll('#list .card').length>0);
  const field=page.locator('#notes-'+visits[0].id);await field.fill('Observações em curso conservadas');
  const snapshot=()=>page.evaluate(id=>({visits:visits.map(row=>row.id),active:activeVisitId(),draft:document.getElementById('notes-'+id)?.value}),visits[0].id);
  const before=await snapshot();
  const preview=page.locator('#routePreviewList li'),status=()=>page.locator('#routePreviewStatus').textContent();
  await page.locator('#optimizeRouteBtn').click();await page.waitForFunction(()=>document.querySelectorAll('#routePreviewList li').length===3);
  assert.match(await preview.nth(0).textContent(),/Near <img/);assert.match(await preview.nth(1).textContent(),/Far destination/);assert.match(await preview.nth(2).textContent(),/Sem coordenadas/);assert.equal(await preview.nth(2).locator('a').count(),0);assert.equal(await page.locator('#routePreviewList img').count(),0);assert.equal(await page.evaluate(()=>window.qaRouteXss),undefined);
  assert.equal(await preview.nth(0).locator('a').getAttribute('href'),'https://www.google.com/maps/dir/?api=1&destination=0.01%2C0');assert.deepEqual(await snapshot(),before);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:Array.from(document.querySelectorAll('body *')).filter(node=>node.getBoundingClientRect().right>innerWidth+1).map(node=>({tag:node.tagName,id:node.id,class:node.className,text:node.textContent.slice(0,100),right:node.getBoundingClientRect().right})).slice(-8)}));assert(layout.scroll<=width+1,JSON.stringify(layout));}
  await page.setViewportSize({width:390,height:844});
  if(process.env.CW_CAPTURE_UI){require('node:fs').mkdirSync('reports/field-ui',{recursive:true});await page.locator('#fieldRoutePreview').screenshot({path:'reports/field-ui/ROUTE_PREVIEW.png'});}
  console.log('PASS actual legacy button shows a day-scoped proximity preview with literal names, valid navigation and missing-coordinate explanation; form values/current visit/route order stay intact at three widths');
  const day=value=>[value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
  await page.locator('#routePreviewDate').fill(day(tomorrow));assert.equal(await preview.count(),0);await page.locator('#routePreviewRefresh').click();await page.waitForFunction(()=>document.querySelectorAll('#routePreviewList li').length===1);assert.match(await preview.first().textContent(),/Future destination/);
  const future=new Date(tomorrow);future.setDate(future.getDate()+5);await page.locator('#routePreviewDate').fill(day(future));await page.locator('#routePreviewRefresh').click();await page.waitForFunction(()=>document.getElementById('routePreviewStatus').textContent.startsWith('Sem visitas'));
  await page.evaluate(()=>{qaGeo.mode='deny';});await page.locator('#routePreviewRefresh').click();await page.waitForFunction(()=>document.getElementById('routePreviewStatus').textContent.startsWith('Permita'));assert.equal(await preview.count(),0);
  await page.evaluate(()=>{qaGeo.mode='allow';});const endpoint='**/api/route/optimize?*';
  await page.route(endpoint,route=>route.fulfill({status:503,json:{error:'QA route unavailable'}}));await page.locator('#routePreviewRefresh').click();await page.waitForFunction(()=>document.getElementById('routePreviewStatus').textContent==='QA route unavailable');assert.equal(await preview.count(),0);await page.unroute(endpoint);
  await page.route(endpoint,async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'x-cw-route-date':'2000-01-01'}});});await page.locator('#routePreviewRefresh').click();await page.waitForFunction(()=>document.getElementById('routePreviewStatus').textContent.includes('não corresponde'));await page.unroute(endpoint);
  await context.setOffline(true);await page.locator('#routePreviewRefresh').click();assert.match(await status(),/Ligue à rede/);assert.equal(await preview.count(),0);await context.setOffline(false);
  console.log('PASS selected day/empty route, denied geolocation, server failure, mismatched day and offline state produce truthful messages without changing operational forms');
  await page.evaluate(()=>{qaGeo.mode='hold';});await page.locator('#routePreviewDate').fill(day(today));await page.locator('#routePreviewRefresh').click();await page.waitForFunction(()=>qaGeo.pending.length===1);await page.locator('#routePreviewDate').fill(day(tomorrow));await page.evaluate(()=>qaGeo.pending.shift()({coords:{latitude:0,longitude:0},timestamp:Date.now()}));assert.equal(await preview.count(),0);assert.match(await status(),/Dia alterado/);
  await page.evaluate(()=>{qaGeo.mode='allow';});let entered,release;const started=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;releases.push(resolve);});
  await page.route(endpoint,async route=>{const response=await route.fetch();entered();await gate;await route.fulfill({response}).catch(()=>{});});await page.locator('#routePreviewRefresh').click();await started;
  await page.evaluate(({token,other})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:other.id,name:other.name,role:'TECHNICIAN'}));},{token:otherToken,other});release();await page.unroute(endpoint);await page.waitForFunction(()=>document.getElementById('routePreviewStatus').textContent.includes('sessão mudou'));assert.equal(await preview.count(),0);assert(await page.locator('#routePreviewRefresh').isDisabled());assert.deepEqual(errors,[]);
  console.log('PASS late GPS after date change and late response after account change cannot render a stale or other-account suggestion');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const release of releases)release();await browser?.close();await prisma.$disconnect();});
