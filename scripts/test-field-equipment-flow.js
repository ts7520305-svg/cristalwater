'use strict';
require('../src/loadEnv')();
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA flags required');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const {prisma}=require('../src/prismaClient');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002',stamp=Date.now();
const output=path.resolve(__dirname,'../reports/equipment-flow',String(stamp));
const results={realForms:true,apiMocks:false,passed:false,pageErrors:[],apiErrors:[],screenshots:[]};
let browser;
const lisbonDay=date=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
function plusThreeMonths(day){const [y,m,d]=day.split('-').map(Number),target=new Date(Date.UTC(y,m-1+3,1));const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(d,last));return target.toISOString().slice(0,10);}
async function screenshot(page,name,selector){
 await page.locator('input[type=password],input#pin,input#email').evaluateAll(inputs=>inputs.forEach(input=>{input.value='';}));
 await (selector?page.locator(selector):page).screenshot({path:path.join(output,name+'.png'),...(selector?{}:{fullPage:true})});results.screenshots.push(name+'.png');
}
async function openContext(mobile){const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,geolocation:{latitude:37.087,longitude:-8.731},permissions:['geolocation']});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>results.pageErrors.push(e.message));page.on('response',r=>{const url=new URL(r.url());if(url.origin===new URL(base).origin&&url.pathname.startsWith('/api/')&&r.status()>=500)results.apiErrors.push({path:url.pathname,status:r.status()});});return{context,page};}
(async()=>{
 assert(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD,'QA admin required');fs.mkdirSync(output,{recursive:true});
 let pin;do{pin=String(crypto.randomInt(100000,999999));}while(await prisma.technician.findFirst({where:{pin}}));
 const tech=await prisma.technician.create({data:{name:'Rui · Revisões de demonstração',pin,active:true}});
 const client=await prisma.client.create({data:{name:'Casa da Brisa · Demonstração',zone:'Praia da Luz',active:true}});
 const pool=await prisma.pool.create({data:{clientId:client.id,name:'Piscina da Casa da Brisa',active:true,volumeM3:50,latitude:37.087,longitude:-8.731}});
 const visit=await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:tech.id,date:new Date(),plannedDate:new Date(),startAt:new Date(),status:'IN_PROGRESS'}});
 browser=await chromium.launch({headless:true,...(process.env.CW_CHROMIUM_PATH?{executablePath:process.env.CW_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const admin=await openContext(false);
 try{
  await admin.page.goto(base+'/admin-login',{waitUntil:'domcontentloaded'});await admin.page.locator('#email').fill(process.env.ADMIN_EMAIL);await admin.page.locator('#password').fill(process.env.ADMIN_PASSWORD);await admin.page.locator('#loginBtn').click();await admin.page.waitForURL(url=>!url.pathname.includes('login'));
  await admin.page.goto(base+'/admin-operational-settings',{waitUntil:'domcontentloaded'});
  await admin.page.locator('#emLoadPools').click();await admin.page.locator(`#emPool option[value="${pool.id}"]`).waitFor({state:'attached'});await admin.page.locator('#emPool').selectOption(String(pool.id));
  await admin.page.locator('#emNew').click();await admin.page.locator('#emComponent').selectOption('FILTER');await admin.page.locator('#emTitle').fill('Revisão do filtro principal');await admin.page.locator('#emCount').fill('3');await admin.page.locator('#emUnit').selectOption('MONTHS');await admin.page.locator('#emDue').fill(lisbonDay(new Date()));await admin.page.locator('#emInstructions').fill('Verificar vedação, manómetro e condição do filtro de acordo com o manual.');await admin.page.locator('#emSave').click();await admin.page.locator('#emStatus').filter({hasText:'Plano guardado.'}).waitFor();
  const plans=await prisma.equipmentMaintenancePlan.findMany({where:{poolId:pool.id}});assert.equal(plans.length,1);const plan=plans[0];assert.equal(plan.intervalCount,3);assert.equal(plan.intervalUnit,'MONTHS');assert.equal(plan.component,'FILTER');results.planId=plan.id;
  await screenshot(admin.page,'admin-plan','#equipmentMaintenancePanel');console.log('PASS preventive plan created through real administration form');
  const field=await openContext(true);
  try{
   await field.page.goto(base+'/technician-login',{waitUntil:'domcontentloaded'});await field.page.locator('#pin').fill(pin);await field.page.locator('#loginBox button').first().click();await field.page.waitForURL(url=>url.pathname.includes('technician-field-mode'));
   await field.page.getByRole('button',{name:'Visita',exact:true}).click();
   await field.page.locator('#nextTitle').filter({hasText:pool.name}).waitFor();
   const card=field.page.locator('#fieldEquipmentList .field-equipment-plan').filter({hasText:plan.title});await card.waitFor();
   const action=card.getByRole('button',{name:'Registar revisão realizada',exact:true});assert.equal(await action.isDisabled(),true,'Unconfirmed work cannot be submitted');
   await field.page.setViewportSize({width:390,height:1200});await screenshot(field.page,'technician-before','#fieldEquipmentMaintenance');await field.page.setViewportSize({width:390,height:844});
   await card.locator('textarea').fill('Vedação e manómetro verificados; filtro em condições de funcionamento.');assert.equal(await action.isDisabled(),true);await card.locator('input[type=checkbox]').check();await action.click();
   await field.page.locator('#fieldEquipmentStatus').filter({hasText:'Revisão registada no servidor.'}).waitFor();
   const completed=await prisma.equipmentMaintenanceCompletion.findMany({where:{planId:plan.id,visitId:visit.id}});assert.equal(completed.length,1);assert.equal(completed[0].notes,'Vedação e manómetro verificados; filtro em condições de funcionamento.');
   const updated=await prisma.equipmentMaintenancePlan.findUnique({where:{id:plan.id}});assert.equal(updated.version,plan.version+1);assert.equal(updated.nextDue.toISOString().slice(0,10),plusThreeMonths(lisbonDay(completed[0].completedAt)));assert(updated.lastCompletedAt);
   assert.equal(await prisma.technicalHistory.count({where:{poolId:pool.id,type:'EQUIPMENT_MAINTENANCE',message:plan.title}}),1);
   await field.page.locator('#fieldEquipmentRefresh').click();await card.getByText(new RegExp(updated.nextDue.toISOString().slice(0,10))).waitFor();assert.equal(await prisma.equipmentMaintenanceCompletion.count({where:{planId:plan.id}}),1,'Refresh must not repeat completion');
   assert(await field.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow');
   await field.page.setViewportSize({width:390,height:1200});await screenshot(field.page,'technician-after','#fieldEquipmentMaintenance');
   console.log('PASS technician real preventive completion, calendar advance, immutable execution/history once and refresh without duplicate');
  }catch(error){await screenshot(field.page,'technician-failure').catch(()=>{});throw error;}finally{await field.context.close();}
  await admin.page.locator('#emRefresh').click();await admin.page.locator('#emPlans').getByText(/Última execução:/).waitFor();await screenshot(admin.page,'admin-after','#equipmentMaintenancePanel');
  assert.deepEqual(results.pageErrors,[]);assert.deepEqual(results.apiErrors,[]);results.passed=true;
 }catch(error){await screenshot(admin.page,'admin-failure').catch(()=>{});throw error;}finally{await admin.context.close();}
})().catch(error=>{results.error=String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g,'[token]').slice(0,2000);console.error('FAIL equipment real flow',results.error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();await prisma.$disconnect();if(fs.existsSync(output)){fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2)+'\n');console.log('Equipment visual evidence:',output);}});
