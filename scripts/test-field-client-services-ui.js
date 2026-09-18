'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),fs=require('node:fs'),path=require('node:path');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret'),{chromium}=require('playwright');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));let browser;
(async()=>{
  const admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}}),user={id:admin.id,userId:admin.id,role:'ADMIN'},token=jwt.sign(user,getJwtSecret(),{expiresIn:'1h'});
  const client=await prisma.client.create({data:{name:'QA serviços <img src=x onerror=alert(1)> '+Date.now(),active:true,status:'ACTIVE'}}),other=await prisma.client.create({data:{name:'QA other services client',active:true}});
  const tech=await prisma.technician.create({data:{name:'QA serviços technician com nome longo para confirmar a atribuição',active:true}}),pool=await prisma.pool.create({data:{name:'Piscina principal QA com designação longa para confirmar a instalação',clientId:client.id,volumeM3:40,technicalSheet:{create:{volumeM3:40,disinfectionType:'SALT'}}}});
  const errors=[],writes=[];
  browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  await context.addInitScript(({user,token})=>{if(!localStorage.getItem('qaServiceInit')){for(const key of ['token','adminToken','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(user));localStorage.setItem('qaServiceInit','1');localStorage.setItem('cw_language','pt');}},{user,token});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR: '+e.message);});page.on('request',r=>{if(r.method()==='PUT'&&r.url().includes('/api/settings/client-services/'))writes.push(r.postDataJSON());});
  const state=value=>page.waitForFunction(value=>document.getElementById('serviceStatus')?.dataset.state===value,value);
  await page.goto(base+'/admin-client-settings?clientId='+client.id,{waitUntil:'networkidle'});await page.waitForFunction(id=>document.getElementById('clientId').value===String(id),client.id).catch(async error=>{console.error(await page.evaluate(()=>({url:location.href,rate:document.getElementById('rateStatus')?.textContent,services:document.getElementById('serviceStatus')?.textContent})));throw error;});
  assert(await page.locator('#serviceConfirm').isDisabled());await page.locator('#serviceLoad').click();await state('ready');await page.locator('#serviceStart').fill('2032-01-01');await page.locator('#serviceEnd').fill('2032-12-31');await page.locator('#serviceMonth').fill('2032-06');
  await page.locator('#serviceAddSeason').click();const season=page.locator('.serviceSeason');await season.locator('[data-season=label]').fill('Todo o ano');await season.locator('[data-season=fromMonth]').selectOption('1');await season.locator('[data-season=toMonth]').selectOption('12');await season.locator('[data-season=monthlyAmount]').fill('150');await season.locator('[data-season=services]').fill('Limpeza <img src=x onerror=alert(1)> e análises');await season.locator('.addRule').click();
  const rule=season.locator('.serviceRule');await rule.locator('[data-rule=poolId]').selectOption(String(pool.id));await rule.locator('[data-rule=count]').fill('6');await rule.locator('[data-rule=assignment]').selectOption('T:'+tech.id);
  for(const [day,at] of [[1,'08:00'],[1,'16:00'],[2,'08:00'],[3,'08:00'],[4,'08:00'],[5,'08:00']]){await rule.locator('.addSlot').click();const slot=rule.locator('.serviceSlot').last();await slot.locator('select').selectOption(String(day));await slot.locator('input').fill(at);}
  // Session drafts survive client switching and a page reload.
  await page.locator('#clientId').selectOption(String(other.id));await page.locator('#serviceLoad').click();await state('ready');await page.locator('#clientId').selectOption(String(client.id));await page.locator('#serviceLoad').click();await state('ready');assert.equal(await page.locator('[data-rule=count]').inputValue(),'6');
  assert.equal(await page.locator('.serviceSlot').count(),6,'All six draft slots survive changing client');
  assert.deepEqual(await page.locator('.serviceSelection').allTextContents(),[pool.name,'Técnico: '+tech.name],'The complete pool and assignment names remain visible outside the shortened control');
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(id=>document.getElementById('clientId').value===String(id),client.id);await page.locator('#serviceLoad').click();await page.waitForFunction(()=>!document.getElementById('serviceFields').disabled);assert.equal(await page.locator('.serviceSlot').count(),6);
  await page.locator('#servicePreview').click();await state('preview');assert.match(await page.locator('#serviceImpact').textContent(),/150/);assert.equal(await page.locator('#servicePanel img').count(),0);
  const visual=path.resolve('reports/field-visual/client-services-'+Date.now());fs.mkdirSync(visual,{recursive:true});
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:1000});await page.locator('#servicePanel').scrollIntoViewIfNeeded();
    const overflows=await page.locator('#servicePanel,#servicePanel fieldset,#servicePanel input,#servicePanel select,#servicePanel textarea,#servicePanel button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return{tag:n.tagName,field:n.dataset.rule||n.dataset.season||n.dataset.slot||n.id,x:r.x,right:r.right,overflow:n.scrollWidth-n.clientWidth};}));assert(overflows.every(r=>r.x>=0&&r.right<=width+1&&r.overflow<=1),JSON.stringify({width,overflows}));await page.screenshot({path:path.join(visual,'services-'+width+'.png'),fullPage:true});
  }
  await page.setViewportSize({width:390,height:900});
  for(const colorScheme of ['dark','light']){
    await page.emulateMedia({colorScheme});
    const ratios=await page.locator('#servicePanel label,#servicePanel legend,#servicePanel input,#servicePanel select,#servicePanel textarea').evaluateAll(nodes=>{
      const lum=color=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
      return nodes.filter(n=>n.getClientRects().length).map(n=>{let parent=n,bg;while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')break;parent=parent.parentElement;}const a=lum(getComputedStyle(n).color),b=lum(bg||'rgb(255,255,255)');return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
    });assert(ratios.every(r=>r>=4.5),JSON.stringify({colorScheme,ratios}));await page.locator('#serviceStart').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(visual,'editor-'+colorScheme+'-390.png')});
  }
  let lost;
  await page.route('**/api/settings/client-services/'+client.id,async route=>{if(route.request().method()!=='PUT')return route.continue();lost=await(await route.fetch()).json();await route.abort('failed');});
  await page.locator('#serviceConfirm').click();await state('pending');assert.equal(lost?.planVersion,1);assert.equal(await prisma.clientRatePlan.count({where:{clientId:client.id}}),1);
  await page.unroute('**/api/settings/client-services/'+client.id);await page.reload({waitUntil:'networkidle'});await page.waitForFunction(id=>document.getElementById('clientId').value===String(id),client.id);await page.locator('#serviceLoad').click();await state('pending');
  // A successful HTTP response for another client must never clear the queued request.
  await page.route('**/api/settings/client-services/'+client.id,async route=>{if(route.request().method()!=='PUT')return route.continue();await route.fulfill({status:200,json:{...lost,clientId:other.id}});});
  await page.locator('#serviceRetry').click();await state('pending');assert.notEqual(await page.locator('#serviceFields').getAttribute('disabled'),null);await page.unroute('**/api/settings/client-services/'+client.id);
  await page.locator('#serviceRetry').click();await state('confirmed');assert.equal(await prisma.clientRatePlan.count({where:{clientId:client.id}}),1);assert(writes.every(body=>body.requestId===writes[0].requestId));
  const visits=await prisma.serviceVisit.findMany({where:{clientId:client.id}});assert(visits.length>20);assert(visits.every(v=>v.contractService.planVersion===1&&v.revenue===0));
  console.log('PASS real editor, six weekly visits including two on one day, stored drafts by client, literal services, 320/390/1440 layout, committed response loss/reload, forged response rejected, exact replay without duplicates');
  await page.locator('#serviceLoad').click();await state('ready');assert(await page.locator('#rateForm').isHidden());await page.locator('#serviceMonth').fill('2032-07');await page.locator('#serviceCalendarPreview').click();await state('preview');await context.setOffline(true);await page.locator('#serviceConfirm').click();await state('pending');await context.setOffline(false);await page.locator('#serviceRetry').click();await state('confirmed');
  await page.locator('#serviceLoad').click();await state('ready');await page.locator('[data-season=monthlyAmount]').fill('151');await page.locator('#servicePreview').click();await state('preview');const beforeQuota=writes.length;
  await page.evaluate(()=>{window.qaServiceSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('cwClientServices:'))throw new DOMException('QA storage full','QuotaExceededError');return window.qaServiceSet.call(this,key,value);};});await page.locator('#serviceConfirm').click();await state('pending');assert.equal(writes.length,beforeQuota,'An unpersisted request is never sent');await page.evaluate(()=>{Storage.prototype.setItem=window.qaServiceSet;});
  await page.locator('#serviceLoad').click();await state('ready');await page.locator('[data-rule=count]').fill('7');await page.evaluate(()=>localStorage.setItem('user',JSON.stringify({id:999999,role:'ADMIN'})));await state('session');assert.equal(await page.locator('#serviceClient').textContent(),'');assert.notEqual(await page.locator('#serviceFields').getAttribute('disabled'),null);
  assert.deepEqual(errors,[]);console.log('PASS saved-plan calendar generation, offline intent/recovery, old price editor protected and account change clears customer data');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();await prisma.$disconnect();});
