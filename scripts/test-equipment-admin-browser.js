const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(5000);page.on('dialog',d=>d.accept());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const html=fs.readFileSync(path.join(__dirname,'../frontend/admin-operational-settings.html'),'utf8');
  const start=html.indexOf('    <section class="panel" id="equipmentMaintenancePanel"'),section=html.slice(start,html.indexOf('</section>',start)+10);
  let writes=0,stale=false,release,hold=false;
  let plans=[];
  await page.addInitScript(()=>localStorage.setItem('token','ADMIN-A'));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/test')return route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{padding:12px;margin:0}</style>${section}<script src="/admin-equipment-maintenance.js"></script>`});
   if(u.pathname==='/admin-equipment-maintenance.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/admin-equipment-maintenance.js'),'utf8')});
   let body={ok:true};
   if(u.pathname==='/api/core/pools')body.pools=[{id:1,name:'Piscina Luz',client:{name:'Cliente teste'}},{id:2,name:'Outra piscina',client:{name:'Outro'}}];
   else if(route.request().method()==='GET'){if(hold)await new Promise(r=>release=r);body.plans=plans;}
   else {writes++;const p=route.request().postDataJSON();assert.equal(route.request().headers().authorization,'Bearer ADMIN-A');if(stale)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({ok:false,error:'Versão alterada'})});plans=[{...p,id:7,poolId:1,version:2}];}
   return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('http://maintenance.test/test');assert.equal(writes,0);
  await page.locator('#emLoadPools').click();await page.locator('#emPool').selectOption('1');await page.waitForFunction(()=>!document.querySelector('#emNew').disabled);
  await page.locator('#emNew').click();await page.locator('#emTitle').fill('<img src=x onerror=alert(1)>');await page.locator('#emInstructions').fill('Verificar condições e pressão conforme fabricante.');await page.locator('#emCount').fill('3');await page.locator('#emUnit').selectOption('MONTHS');await page.locator('#emDue').fill('2027-01-31');await page.locator('#emSave').click();await page.waitForFunction(()=>document.querySelector('#emStatus').textContent.includes('Plano guardado'));assert.equal(writes,1);assert.equal(await page.locator('#emPlans img').count(),0);
  await page.getByRole('button',{name:'Editar / pausar'}).click();await page.locator('#emActive').uncheck();await page.locator('#emSave').click();await page.waitForFunction(()=>document.querySelector('#emPlans').textContent.includes('Pausado'));assert.equal(writes,2);assert.equal(plans[0].expectedVersion,2);
  stale=true;await page.getByRole('button',{name:'Editar / pausar'}).click();await page.locator('#emTitle').fill('Outra descrição');await page.locator('#emSave').click();await page.waitForFunction(()=>document.querySelector('#emStatus').textContent.includes('Versão alterada'));assert.equal(await page.locator('#emNew').isDisabled(),true);assert.equal(await page.locator('#emForm').isVisible(),false);
  stale=false;await page.locator('#emRefresh').click();await page.waitForFunction(()=>!document.querySelector('#emNew').disabled);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  hold=true;await page.locator('#emRefresh').click();await page.waitForTimeout(30);await page.evaluate(()=>{localStorage.setItem('token','TECH-B');window.dispatchEvent(new StorageEvent('storage',{key:'token'}));});release();await page.waitForTimeout(30);assert.equal(await page.locator('#equipmentMaintenancePanel').isVisible(),false);assert.deepEqual(errors,[]);
  console.log('PASS maintenance plan explicit create/update/pause, optimistic version, lost/stale write recovery, safe text, responsive widths and account change');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
