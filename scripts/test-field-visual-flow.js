'use strict';
// Real pages, real forms and the isolated API: no browser API/script mocks.
require('../src/loadEnv')();
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') {
  throw new Error('Visual flow requires NODE_ENV=test, QA_MODE=true and QA_ENVIRONMENT_SAFE=true');
}
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
const stamp = Date.now();
const output = path.resolve(__dirname, '../reports/field-visual', String(stamp));
const results = [];
let browser;
function redact(message) {
  return String(message).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/eyJ[A-Za-z0-9_.-]+/g, '[token]').slice(0, 1500);
}
async function seed() {
  const password = crypto.randomUUID();
  let pin;
  do { pin = String(crypto.randomInt(100000, 999999)); } while (await prisma.technician.findFirst({where:{pin}}));
  const tech = await prisma.technician.create({data:{name:'Rui Martins · Demonstração',email:`visual-tech-${stamp}@qa.test`,pin,active:true}});
  const client = await prisma.client.create({data:{name:'Casa das Amendoeiras · Demonstração',email:`visual-client-${stamp}@qa.test`,password:await bcrypt.hash(password,10),zone:'Praia da Luz',active:true}});
  const round = await prisma.round.create({data:{name:'Luz e Burgau · Demonstração',dayOfWeek:new Date().getDay(),active:true,technicians:{create:{technicianId:tech.id}}}});
  const pools = [];
  for (const [index, name, zone, latitude, longitude] of [
    [0,'Casa das Amendoeiras','Praia da Luz',37.087,-8.731],
    [1,'Quinta da Brisa','Burgau',37.073,-8.775],
    [2,'Villa do Farol','Lagos',37.089,-8.677],
  ]) {
    const pool = await prisma.pool.create({data:{clientId:client.id,name,zone,active:true,volumeM3:45+index*10,latitude,longitude,notes:'Demonstração: verificar cestos, linha de água e registar medições.'}});
    await prisma.roundPool.create({data:{roundId:round.id,poolId:pool.id,order:index}});
    const visit = await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:tech.id,roundId:round.id,date:new Date(),plannedDate:new Date(),status:'PLANNED'}});
    pools.push({pool,visit});
  }
  await prisma.notification.create({data:{clientId:client.id,role:'CLIENT',title:'Manutenção agendada',message:'A sua piscina está na ronda de hoje. Dados de demonstração.',eventType:'QA_VISUAL'}});
  const api = async (url, token, method, body) => {
    const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
    const data=await response.json();assert.equal(response.status,200,`QA fixture API ${url}: ${response.status}`);return data;
  };
  const admin=await api('/api/auth/login',null,'POST',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD});
  assert(admin.token,'QA administrator login failed');
  const repair=await prisma.repair.create({data:{poolId:pools[0].pool.id,problem:'Substituição da bomba de circulação'}});
  await api(`/api/repairs/${repair.id}/quote`,admin.token,'PUT',{lines:[{type:'MATERIAL',description:'Bomba de circulação eficiente',quantity:1,unitCost:280,marginPercent:20},{type:'LABOR',description:'Instalação e ensaio de funcionamento',quantity:2,unitCost:30,marginPercent:25}],taxPercent:23,expectedVersion:0,terms:'Demonstração: instalação após aprovação e confirmação da data.'});
  const quote=await prisma.repairQuote.findFirst({where:{repairId:repair.id}});
  await api(`/api/repairs/${repair.id}/quotes/${quote.id}/publish`,admin.token,'POST',{});
  return {tech,client,password,pools,repair,quote};
}
async function capture(page, name) {
  // Clear credential controls before any failure capture on a login screen.
  await page.locator('input[type="password"], input#pin, input#email').evaluateAll(inputs=>inputs.forEach(input=>{input.value='';}));
  await page.screenshot({path:path.join(output, name+'.png'),fullPage:true});
}
async function runPersona(fixture, persona) {
  const context = await browser.newContext({viewport:persona.role==='ADMIN'?{width:1440,height:1000}:{width:390,height:844},isMobile:persona.role!=='ADMIN',hasTouch:persona.role!=='ADMIN',geolocation:{latitude:37.087,longitude:-8.731},permissions:['geolocation']});
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const pageErrors = [], apiErrors = [];
  page.on('pageerror', error=>pageErrors.push(redact(error.message)));
  page.on('response',response=>{const url=new URL(response.url());if(url.origin===new URL(base).origin && url.pathname.startsWith('/api/') && response.status()>=500)apiErrors.push({path:url.pathname,status:response.status()});});
  const record = {profile:persona.role,passed:false,screenshots:[],pageErrors,apiErrors};
  results.push(record);
  try {
    await page.goto(base+persona.login,{waitUntil:'domcontentloaded'});
    await capture(page, persona.role.toLowerCase()+'-login');record.screenshots.push(persona.role.toLowerCase()+'-login.png');
    if(persona.role==='TECHNICIAN') {
      await page.locator('#pin').fill(fixture.tech.pin);
      await page.locator('#loginBox button').first().click();
    } else {
      await page.locator('#email').fill(persona.role==='ADMIN'?process.env.ADMIN_EMAIL:fixture.client.email);
      await page.locator('#password').fill(persona.role==='ADMIN'?process.env.ADMIN_PASSWORD:fixture.password);
      await page.locator('#loginBtn').click();
    }
    await page.waitForURL(url=>!url.pathname.includes('login'),{timeout:20000});
    if(persona.role==='ADMIN')await page.goto(base+'/admin-master-control',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.CristalAuth?.getToken());
    assert.equal(await page.evaluate(()=>CristalAuth.parseUser().role),persona.role);
    if(persona.role==='TECHNICIAN')await page.locator('#fieldFocusNow').filter({hasText:fixture.pools[0].pool.name}).waitFor();
    if(persona.role==='CLIENT')await page.locator('#clientName').filter({hasText:fixture.client.name}).waitFor();
    if(persona.role==='ADMIN')await page.locator('#todayList').filter({hasText:fixture.pools[0].pool.name}).waitFor();
    if(persona.role==='ADMIN') {
      const icons=page.locator('#metrics .metric-icon svg[aria-hidden="true"][focusable="false"]');
      assert.equal(await icons.count(),4,'All four management KPI icons must use accessible decorative SVG');
      assert.equal(await page.locator('#metrics .metric-icon').allTextContents().then(values=>values.every(value=>!value.trim())),true,'KPI icons must not depend on emoji fonts');
    }
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).visibility),'visible');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Horizontal overflow');
    await capture(page,persona.role.toLowerCase()+'-working');record.screenshots.push(persona.role.toLowerCase()+'-working.png');
    if(persona.role==='CLIENT') {
      const panel=page.locator('#clientQuotesPanel');
      await panel.getByText('Aguarda a sua decisão',{exact:true}).waitFor();
      const approve=panel.getByRole('button',{name:'Aprovar orçamento',exact:true});
      assert.equal(await approve.isDisabled(),true,'Approval must require explicit acknowledgement');
      await page.setViewportSize({width:390,height:1200});
      await panel.screenshot({path:path.join(output,'client-quote-pending.png')});record.screenshots.push('client-quote-pending.png');
      await panel.locator('input[type="checkbox"]').check();
      page.once('dialog',dialog=>dialog.accept());
      await approve.click();
      await panel.getByText('Aprovado',{exact:true}).waitFor();
      assert.equal((await prisma.repair.findUnique({where:{id:fixture.repair.id}})).status,'APPROVED');
      await panel.screenshot({path:path.join(output,'client-quote-approved.png')});record.screenshots.push('client-quote-approved.png');
      await page.setViewportSize({width:390,height:844});
      record.quoteApproval='Confirmed by real portal controls and persisted in database';
      console.log('PASS real client portal published quote, explicit approval and persisted repair status');
    }
    assert.deepEqual(apiErrors,[],'Unexpected API server errors');
    assert.deepEqual(pageErrors,[],'Unhandled browser errors');
    // A blocked, technician-owned pending record is retained on logout and cannot auto-submit.
    const queueKey=`cwFieldOutbox:${fixture.tech.id}`;
    const pending=JSON.stringify({[fixture.pools[0].visit.id]:{visitId:fixture.pools[0].visit.id,body:{notes:'Demonstração: registo pendente preservado'},blocked:true,error:'Aguardar revisão'}});
    if(persona.role==='TECHNICIAN')await page.evaluate(({queueKey,pending})=>localStorage.setItem(queueKey,pending),{queueKey,pending});
    const logoutButton=page.locator('#portalLogoutBtn, #fieldLogoutBtn, [data-cw-logout]').first();
    if(await logoutButton.count()) {record.logoutMethod='visible-button';await logoutButton.click();}
    else {record.logoutMethod='CristalAuth.logout API (no dedicated button found)';await page.evaluate(()=>CristalAuth.logout());}
    await page.waitForURL(url=>url.pathname.includes('login'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('cristalwater_jwt')),null);
    assert.equal(await page.evaluate(()=>localStorage.getItem('token')),null);
    if(persona.role==='TECHNICIAN')assert.equal(await page.evaluate(key=>localStorage.getItem(key),queueKey),pending,'Logout discarded pending work');
    await page.goto(base+persona.destination,{waitUntil:'domcontentloaded'});
    await page.waitForURL(url=>url.pathname.includes('login'));
    record.passed=true;console.log('PASS visual real form, profile data, logout and protected return:',persona.role);
  } catch(error) {
    record.error=redact(error.message);
    await capture(page,persona.role.toLowerCase()+'-failure').catch(()=>{});
    record.screenshots.push(persona.role.toLowerCase()+'-failure.png');
    console.error('FAIL visual flow',persona.role,record.error);
  } finally {await context.close();}
}
(async()=>{
  assert(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD,'QA administrator credentials required');
  fs.mkdirSync(output,{recursive:true});
  const fixture = await seed();
  browser=await chromium.launch({headless:true,...(process.env.CW_CHROMIUM_PATH?{executablePath:process.env.CW_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const persona of [
    {role:'TECHNICIAN',login:'/technician-login',destination:'/technician-field-mode'},
    {role:'CLIENT',login:'/client-login',destination:'/client-portal'},
    {role:'ADMIN',login:'/admin-login',destination:'/admin-master-control'},
  ])await runPersona(fixture,persona);
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({environment:'ISOLATED_QA',realForms:true,apiMocks:false,createdAt:new Date().toISOString(),results},null,2)+'\n');
  console.log('Visual evidence:',output);
  if(results.some(result=>!result.passed))process.exitCode=1;
})().catch(error=>{console.error(redact(error.message));process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();await prisma.$disconnect();});
