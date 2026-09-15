const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(5000);page.on('dialog',d=>d.accept());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const html=fs.readFileSync(path.join(__dirname,'../frontend/admin-operational-settings.html'),'utf8');
  const start=html.indexOf('    <section class="panel" id="dataProtectionPanel"'),section=html.slice(start,html.indexOf('</section>',start)+10);
  let executes=0,stale=false;
  await page.addInitScript(()=>localStorage.setItem('token','ADMIN-A'));
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/test')return route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}button,input{min-height:44px;max-width:100%}body{padding:12px;overflow-wrap:anywhere}</style>${section}<script src="/admin-data-protection.js"></script>`});
   if(u.pathname==='/admin-data-protection.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/admin-data-protection.js'),'utf8')});
   let body={ok:true};
   if(u.pathname.endsWith('/release-safety'))body.backupHealth={state:'MISSING',latest:null};
   if(u.pathname.endsWith('/preview'))body={ok:true,cutoff:'2025-09-15T00:00:00Z',counts:{total:2,technicianTracks:1,locationLogs:1},previewToken:'SIGNED-QA'};
   if(u.pathname.endsWith('/execute')){executes++;const p=route.request().postDataJSON();assert.equal(p.confirmation,'ELIMINAR GPS ANTIGO');assert.equal(p.previewToken,'SIGNED-QA');if(stale)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({ok:false,error:'Os registos mudaram. Volte a rever.'})});body.deleted={total:2};}
   return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('http://protection.test/test');assert.equal(executes,0);assert.equal(await page.locator('#applyGpsRetention').isDisabled(),true);
  await page.locator('#checkBackupHealth').click();await page.waitForFunction(()=>document.querySelector('#backupHealthText').textContent.includes('Não existe'));
  await page.locator('#reviewGpsRetention').click();await page.waitForFunction(()=>!document.querySelector('#applyGpsRetention').disabled);await page.locator('#applyGpsRetention').click();assert.equal(executes,0);
  await page.locator('#retentionReason').fill('Retenção anual revista');await page.locator('#retentionConfirm').fill('ELIMINAR GPS ANTIGO');await page.locator('#applyGpsRetention').click();await page.waitForFunction(()=>document.querySelector('#retentionStatus').textContent.includes('Limpeza concluída'));assert.equal(executes,1);assert.equal(await page.locator('#applyGpsRetention').isDisabled(),true);
  stale=true;await page.locator('#reviewGpsRetention').click();await page.waitForFunction(()=>!document.querySelector('#applyGpsRetention').disabled);await page.locator('#retentionConfirm').fill('ELIMINAR GPS ANTIGO');await page.locator('#applyGpsRetention').click();await page.waitForFunction(()=>document.querySelector('#retentionStatus').textContent.includes('Volte a rever'));assert.equal(await page.locator('#applyGpsRetention').isDisabled(),true);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await page.evaluate(()=>{localStorage.setItem('token','TECH-B');window.dispatchEvent(new StorageEvent('storage',{key:'token'}));});assert.equal(await page.locator('#dataProtectionPanel').isVisible(),false);assert.deepEqual(errors,[]);
  console.log('PASS backup status, review before retention, explicit confirmation, invalidated stale review, responsive controls and account change');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
