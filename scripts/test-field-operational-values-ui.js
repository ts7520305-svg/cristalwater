'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));let browser;
(async()=>{
 const stamp=Date.now(),admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}}),user={id:admin.id,userId:admin.id,role:'ADMIN',principalType:'USER'},token=jwt.sign(user,getJwtSecret(),{expiresIn:'1h'});
 const monthRef='2035-07',when=new Date('2035-07-15T12:00:00Z'),name='<img src=x onerror=alert(1)> Technician '+stamp;
 const tech=await prisma.technician.create({data:{name,active:false,costPerVisit:32}}),missing=await prisma.technician.create({data:{name:'QA unknown cost '+stamp}});
 const client=await prisma.client.create({data:{name:'QA values UI '+stamp}}),pool=await prisma.pool.create({data:{name:'QA values UI pool',clientId:client.id}});
 await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:tech.id,status:'DONE',startAt:new Date(when-180000),endAt:when}});
 const extra=await prisma.extraVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:tech.id,status:'DONE',scheduledAt:when,endAt:when}});
 await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:missing.id,status:'DONE',endAt:when}});
 await prisma.stockMovement.create({data:{movementType:'RETURN',productName:'<b>Returned product</b>',quantity:2,unit:'L',technicianId:tech.id,clientId:client.id,createdAt:when}});
 await prisma.invoice.create({data:{clientId:client.id,monthRef,status:'ISSUED',total:100.1,lines:{create:{type:'EXTRA_VISIT',referenceId:extra.id,description:'Source line',total:100.1,lineTotal:100.1}}}});
 const api=await fetch(base+'/api/billing/technician-profit?monthRef='+monthRef,{headers:{Authorization:'Bearer '+token}}),data=await api.json();assert.equal(api.status,200);
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 await context.addInitScript(({user,token})=>{
  for(const k of ['token','cristalwater_jwt'])localStorage.setItem(k,token);for(const k of ['user','cristalwater_user'])localStorage.setItem(k,JSON.stringify(user));localStorage.setItem('cw_language','pt');localStorage.setItem('qaValueDraft','preserved');
  const later=window.setTimeout;window.setTimeout=(fn,ms,...args)=>later(fn,window.qaTimeout&&ms===20000?120:ms,...args);
 },{user,token});
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const state=s=>page.waitForFunction(s=>document.getElementById('reportStatus').dataset.state===s,s),card=id=>page.locator('#reportList [data-technician-id="'+id+'"]');
 for(const url of ['/technician-profit-dashboard','/technician-profit']){
  await page.goto(base+url,{waitUntil:'networkidle'});assert.equal(await page.locator('#reportMonth').inputValue(),new Date().toISOString().slice(0,7));
  await page.locator('#reportMonth').fill(monthRef);await page.locator('#reportLoad').click();await state('ready');
  assert.match(await card(tech.id).locator('h2').textContent(),new RegExp(stamp));assert.match(await card(tech.id).locator('h2').textContent(),/inativo/);
  assert.match(await card(tech.id).textContent(),/64,00/);assert.match(await card(tech.id).textContent(),/100,10/);assert.match(await card(missing.id).textContent(),/Mão de obra estimada: Por apurar/);
  assert.match(await card(tech.id).textContent(),/devolução 2; diferença -2/);assert.equal(await card(tech.id).locator('img,b').count(),0);
  assert.equal(await page.locator('canvas,script[src*="cdn.jsdelivr.net"]').count(),0);
  await card(tech.id).locator('summary').click();assert.match(await card(tech.id).locator('details').textContent(),new RegExp('extra #'+extra.id));
  const count=await page.locator('#reportList article').count();await page.locator('#reportActiveOnly').uncheck();assert((await page.locator('#reportList article').count())>=count);await page.locator('#reportActiveOnly').check();
 }
 const visual=path.join(__dirname,'../reports/field-visual/operational-values-'+stamp);fs.mkdirSync(visual,{recursive:true});
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
  assert(await page.locator('.report-controls input,.report-controls button,#reportList article').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth+1&&n.scrollWidth<=n.clientWidth+1;})));
  await page.screenshot({path:path.join(visual,'values-'+width+'.png')});
 }
 console.log('PASS both value report pages: actual API, current month, inactive identity, typed visits, unknown versus estimated cost, documentary source amounts, literal stock/names and three widths without external chart');
 const endpoint='**/api/billing/technician-profit?*';let payload=data,code=200;await page.route(endpoint,r=>r.fulfill({status:code,json:payload}));
 const altered=mutate=>{const copy=structuredClone(data);mutate(copy);return copy;};
 for(const bad of [{ok:true,ranking:[]},altered(d=>d.complete=false),altered(d=>d.monthRef='2035-08'),altered(d=>d.financialComplete=true),altered(d=>{d.technicians=[d.technicians[0],d.technicians[0]];d.total=d.returned=2;}),altered(d=>d.technicians.find(t=>t.id===tech.id).profit=0),altered(d=>d.technicians.find(t=>t.id===tech.id).confirmedExtraLinesAmount++),altered(d=>{const t=d.technicians.find(t=>t.id===tech.id);t.extraLineEvidence.push(t.extraLineEvidence[0]);t.extraLinesAmount=t.confirmedExtraLinesAmount*=2;})]){
  payload=bad;await page.locator('#reportLoad').click();await state('error');assert.equal(await page.locator('#reportList article').count(),0);assert.equal(await page.locator('#reportWarnings').textContent(),'');
 }
 for(const status of [202,503]){code=status;payload=data;await page.locator('#reportLoad').click();await state('error');}
 code=200;payload={...data,technicians:[],ranking:[],total:0,returned:0};await page.locator('#reportLoad').click();await state('empty');await page.unroute(endpoint);
 await page.locator('#reportMonth').fill('');await page.locator('#reportLoad').click();await state('error');await page.locator('#reportMonth').fill(monthRef);await page.locator('#reportLoad').click();await state('ready');
 let entered,release,finished;let arrival=new Promise(r=>entered=r),gate=new Promise(r=>release=r),handled=new Promise(r=>finished=r);
 await page.route(endpoint,async r=>{entered();await gate;await r.fulfill({json:data});finished();});
 await page.locator('#reportLoad').click();await arrival;await page.locator('#reportMonth').fill('2035-08');release();await handled;await state('idle');assert.equal(await page.locator('#reportList article').count(),0);await page.unroute(endpoint);
 await page.locator('#reportMonth').fill(monthRef);await page.evaluate(()=>window.qaTimeout=true);gate=new Promise(r=>release=r);handled=new Promise(r=>finished=r);
 await page.route(endpoint,async r=>{await gate;await r.fulfill({json:data});finished();});await page.locator('#reportLoad').click();await state('error');assert.match(await page.locator('#reportStatus').textContent(),/demorou demasiado/);assert(await page.locator('#reportLoad').isEnabled());release();await handled;await page.unroute(endpoint);await page.evaluate(()=>window.qaTimeout=false);
 await page.locator('#reportLoad').click();await state('ready');
 arrival=new Promise(r=>entered=r);gate=new Promise(r=>release=r);handled=new Promise(r=>finished=r);await page.route(endpoint,async r=>{entered();await gate;await r.fulfill({json:data});finished();});
 await page.locator('#reportLoad').click();await arrival;await page.evaluate(()=>localStorage.setItem('cristalwater_user','changed'));release();await handled;await state('session');
 assert.equal(await page.locator('#reportList article').count(),0);assert.equal(await page.locator('#reportWarnings').textContent(),'');assert(await page.locator('#reportLoad').isDisabled());assert.equal(await page.evaluate(()=>localStorage.getItem('qaValueDraft')),'preserved');assert.deepEqual(errors,[]);
 console.log('PASS value report recovery: incomplete/old-period/duplicate/contradictory money refused, no false zeros, empty/invalid period, stale response, timeout retry and session change; evidence '+visual);
 await context.close();
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();await prisma.$disconnect();});
