const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:320,height:844}});page.setDefaultTimeout(5000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const html=fs.readFileSync(path.join(__dirname,'../frontend/technician-field-mode.html'),'utf8');
  const start=html.indexOf('    <section class="card field-panel field-panel-agora" id="fieldEquipmentMaintenance"');
  assert(start>=0);const section=html.slice(start,html.indexOf('</section>',start)+10);
  let posts=[],failure=false,conflict=false,unavailable=false,hold=false,release,first;
  const plans=[{id:7,component:'PUMP',title:'Inspeção <img src=x onerror=alert(1)>',instructions:'Rever ruído e anotar observações.',intervalUnit:'MONTHS',intervalCount:1,nextDue:'2001-01-01',active:true,version:1,lastCompletedAt:null},{id:8,title:'Pausado',nextDue:'2000-01-01',active:false,version:1}];
  await page.addInitScript(()=>localStorage.setItem('token','TECH-A'));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/test')return route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{padding:10px;margin:0}</style>${section}<script src="/field-equipment-maintenance.js"></script>`});
   if(url.pathname==='/field-equipment-maintenance.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/field-equipment-maintenance.js'),'utf8')});
   assert.equal(route.request().headers().authorization,'Bearer TECH-A');
   if(url.pathname.endsWith('/complete')){
    const body=route.request().postDataJSON();posts.push(body);assert.equal(body.confirmed,true);assert.equal(body.visitId,1);
    if(conflict)return route.fulfill({status:409,contentType:'application/json',body:'{"ok":false,"error":"Versão alterada"}'});
    if(failure){first=body;return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"Indisponível"}'});}
    if(first)assert.deepEqual(body,first);
    plans[0].version++;plans[0].completedInVisit=true;plans[0].canComplete=false;plans[0].nextDue='2099-12-01';plans[0].lastCompletedAt=new Date().toISOString();
    return route.fulfill({contentType:'application/json',body:'{"ok":true}'});
   }
   if(hold && url.pathname.endsWith('/1'))await new Promise(resolve=>release=resolve);
   if(unavailable)return route.abort('internetdisconnected');
   return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,plans:url.pathname.endsWith('/2')?[]:plans,canComplete:true})});
  });
  const select=id=>page.evaluate(visitId=>window.dispatchEvent(new CustomEvent('cw:field-visit-selected',{detail:{visitId}})),id);
  await page.goto('https://equipment.test/test');assert.equal(posts.length,0);await select(1);
  const action=()=>page.getByRole('button',{name:'Registar revisão realizada'});
  await action().waitFor();assert(await action().isDisabled());assert.equal(await page.getByText('Pausado',{exact:true}).count(),0);assert.equal(await page.locator('#fieldEquipmentList img').count(),0);
  assert.match(await page.locator('#fieldEquipmentList').textContent(),/Em atraso/);assert.equal(await page.getByText('Bomba',{exact:true}).count(),1);assert.equal(await page.getByText('PUMP',{exact:true}).count(),0);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await page.locator('textarea').fill('Revisão feita');assert(await action().isDisabled());await page.locator('input[type=checkbox]').check();
  conflict=true;await action().click();await page.waitForFunction(()=>document.getElementById('fieldEquipmentStatus').textContent.includes('Revisão não confirmada'));assert.equal(posts.length,1);
  conflict=false;await page.locator('#fieldEquipmentRefresh').click();await action().waitFor();assert.equal(await page.locator('textarea').inputValue(),'Revisão feita');assert.equal(await page.locator('input[type=checkbox]').isChecked(),false);assert(await action().isDisabled());await page.locator('input[type=checkbox]').check();posts=[];
  failure=true;await action().click();await page.waitForFunction(()=>document.getElementById('fieldEquipmentStatus').textContent.includes('Resultado incerto'));assert.equal(posts.length,1);
  await page.locator('#fieldEquipmentRefresh').click();await page.getByRole('button',{name:'Repetir a mesma confirmação'}).waitFor();failure=false;
  await page.getByRole('button',{name:'Repetir a mesma confirmação'}).click();await page.waitForFunction(()=>document.getElementById('fieldEquipmentStatus').textContent.includes('registada no servidor'));assert.equal(posts.length,2);assert.deepEqual(posts[0],posts[1]);
  await page.waitForFunction(()=>document.getElementById('fieldEquipmentList').textContent.includes('Próxima revisão'));
  assert.equal(await action().count(),0);assert.match(await page.locator('#fieldEquipmentList').textContent(),/Revisão já registada nesta visita/);
  await page.locator('#fieldEquipmentRefresh').click();await page.getByText('Revisão já registada nesta visita.').waitFor();assert.equal(await action().count(),0);
  unavailable=true;await page.locator('#fieldEquipmentRefresh').click();await page.waitForFunction(()=>document.getElementById('fieldEquipmentStatus').textContent.includes('Consulta guardada'));assert.equal(await action().count(),0);assert.match(await page.locator('#fieldEquipmentStatus').textContent(),/visita 1/);unavailable=false;
  hold=true;await page.locator('#fieldEquipmentRefresh').click();await page.waitForTimeout(100);await select(2);await page.getByText('Sem revisões preventivas ativas para esta visita.').waitFor();release();await page.waitForTimeout(100);assert.equal(await page.locator('.field-equipment-plan').count(),0);assert.match(await page.locator('#fieldEquipmentStatus').textContent(),/visita 2/);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await page.evaluate(()=>{localStorage.setItem('token','TECH-B');window.dispatchEvent(new StorageEvent('storage',{key:'token'}));});assert.equal(await page.locator('#fieldEquipmentMaintenance').isVisible(),false);assert.deepEqual(errors,[]);
  console.log('PASS equipment field active/overdue plans, explicit notes/check, uncertain identical retry, server-confirmed completion, offline dated cache, visit/account isolation and responsive widths');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
