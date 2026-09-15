const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:320,height:844}});page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const html=fs.readFileSync(path.join(__dirname,'../frontend/admin-operational-settings.html'),'utf8'),start=html.indexOf('    <section class="panel" id="equipmentMaintenancePanel"');
  const section=html.slice(start,html.indexOf('</section>',start)+10);
  let enabled=false,failGET=true,malformed=false,hold=false,release,writes=0,checks=0;
  await page.addInitScript(()=>localStorage.setItem('token','ADMIN-A'));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url()),method=route.request().method();
   if(url.pathname==='/test')return route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{padding:12px;margin:0}</style>${section}<script src="/admin-equipment-maintenance.js"></script><script src="/admin-equipment-reminders.js"></script>`});
   if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend',url.pathname.slice(1)),'utf8')});
   assert.equal(route.request().headers().authorization,'Bearer ADMIN-A');
   if(url.pathname.endsWith('/config')){
    if(method==='PUT'){writes++;enabled=route.request().postDataJSON().enabled;if(hold)await new Promise(resolve=>release=resolve);if(malformed)return route.fulfill({contentType:'text/html',body:'Not JSON'});}
    else if(failGET)return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"Servidor indisponível"}'});
    return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,enabled,automaticChecksEnabled:false})});
   }
   if(url.pathname.endsWith('/check')){checks++;return route.fulfill({contentType:'application/json',body:'{"ok":true,"created":2,"superseded":1}'});}
   return route.fulfill({contentType:'application/json',body:'{"ok":true,"pools":[]}'});
  });
  const save=page.locator('#equipmentRemindersSave'),check=page.locator('#equipmentRemindersCheck'),box=page.locator('#equipmentRemindersEnabled'),reload=page.locator('#equipmentRemindersReload');
  await page.goto('https://reminder.test/test');await page.waitForFunction(()=>document.getElementById('equipmentRemindersStatus').textContent.includes('Não foi possível confirmar'));assert.equal(writes,0);assert.equal(checks,0);assert(await save.isDisabled());assert(await box.isDisabled());assert(await check.isDisabled());
  // The parent plan editor must not accidentally enable these controls.
  await page.locator('#emLoadPools').click();await page.waitForFunction(()=>document.getElementById('emStatus').textContent.includes('Selecione'));assert(await box.isDisabled());
  failGET=false;await reload.click();await page.waitForFunction(()=>document.getElementById('equipmentRemindersStatus').textContent==='Configuração atualizada.');assert.equal(await box.isChecked(),false);assert(await save.isDisabled());
  assert.match(await page.locator('#equipmentRemindersAutomatic').textContent(),/não está ativa/);
  await box.check();assert(await check.isDisabled());await save.click();await page.waitForFunction(()=>document.getElementById('equipmentRemindersStatus').textContent.includes('guardada e confirmada'));assert.equal(writes,1);assert(await box.isChecked());
  await check.click();await page.waitForFunction(()=>document.getElementById('equipmentRemindersStatus').textContent.includes('Avisos criados: 2'));assert.equal(checks,1);
  malformed=true;await box.uncheck();await save.click();await page.waitForFunction(()=>document.getElementById('equipmentRemindersStatus').textContent.includes('Não foi possível confirmar'));assert(await box.isChecked());assert(await box.isDisabled());assert(await save.isDisabled());
  malformed=false;await reload.click();await page.waitForFunction(()=>!document.getElementById('equipmentRemindersEnabled').disabled);assert.equal(await box.isChecked(),false);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  hold=true;await box.check();await save.click();await page.waitForTimeout(100);assert(await reload.isDisabled());assert(await check.isDisabled());
  await page.evaluate(()=>{localStorage.setItem('token','ADMIN-B');window.dispatchEvent(new StorageEvent('storage',{key:'token'}));});assert.equal(await page.locator('#equipmentReminderControls').isVisible(),false);release();await page.waitForTimeout(100);assert.equal(await page.locator('#equipmentRemindersStatus').textContent(),'');assert.deepEqual(errors,[]);
  console.log('PASS reminder configuration read-only startup, failed load guard, isolated editor controls, explicit save/check, malformed response rollback, forced refresh, delayed account change and responsive widths');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
