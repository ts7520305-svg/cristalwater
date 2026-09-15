const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let releaseRead,readStarted,releaseWrite,writeStarted;const writes=[];let holdWrite=true;
  const ready=new Promise(r=>readStarted=r),firstWrite=new Promise(r=>writeStarted=r);
  await page.addInitScript(()=>{localStorage.setItem('token','TECH-A');localStorage.setItem('cw_language','pt');localStorage.setItem('cristalwater_user',JSON.stringify({id:1,role:'TECHNICIAN',language:'pt'}));});
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/test')return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><p id="water">Água aberta</p><p id="state">Em curso</p><button id="save">Guardar</button><input id="note" value="Guardar"><p data-cw-no-i18n>Guardar</p><select id="reason" data-cw-i18n-options><option value="CHEMICAL_MISSING">Falta de produtos químicos</option></select><script src="/cw-i18n.js"></script>'});
   if(u.pathname==='/cw-i18n.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/cw-i18n.js'),'utf8')});
   if(route.request().method()==='GET'){assert.equal(route.request().headers().authorization,'Bearer TECH-A');readStarted();await new Promise(r=>releaseRead=r);return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,language:'de'})});}
   const p=route.request().postDataJSON();writes.push(p.language);assert.equal(route.request().headers().authorization,'Bearer TECH-A');
   if(holdWrite){holdWrite=false;writeStarted();await new Promise(r=>releaseWrite=r);}
   return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,language:p.language})});
  });
  await page.goto('http://language.test/test');await ready;
  await page.locator('#cwLanguageSelect').selectOption('es');await firstWrite;
  assert.equal(await page.locator('#water').textContent(),'Agua abierta');assert.equal(await page.locator('#save').textContent(),'Guardar');assert.equal(await page.locator('#reason').inputValue(),'CHEMICAL_MISSING');assert.equal(await page.locator('#reason option').textContent(),'Faltan productos químicos');
  assert.equal(await page.locator('#note').inputValue(),'Guardar');assert.equal(await page.locator('[data-cw-no-i18n]').textContent(),'Guardar');
  releaseRead();await page.waitForTimeout(250);assert.equal(await page.locator('html').getAttribute('lang'),'es');
  await page.evaluate(()=>document.querySelector('#state').firstChild.nodeValue='Concluído');await page.waitForFunction(()=>document.querySelector('#state').textContent==='Finalizado');
  await page.locator('#cwLanguageSelect').selectOption('fr');assert.deepEqual(writes,['es']);releaseWrite();await page.waitForFunction(()=>document.querySelector('#save').textContent==='Enregistrer');
  await page.waitForTimeout(200);assert.deepEqual(writes,['es','fr']);
  await page.locator('#cwLanguageSelect').selectOption('pt');assert.equal(await page.locator('#state').textContent(),'Concluído');
  // An old server reply must never write language into another account.
  await page.reload();await page.waitForFunction(()=>document.querySelector('#cwLanguageSelect'));await page.evaluate(()=>{localStorage.setItem('token','TECH-B');localStorage.setItem('cristalwater_user',JSON.stringify({id:2,role:'TECHNICIAN',language:'es'}));});releaseRead();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cristalwater_user')).language),'es');assert.deepEqual(errors,[]);
  console.log('PASS Spanish field labels, stable option values, user text protection, fresh live states, ordered preference writes and delayed read after choice/account change');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
