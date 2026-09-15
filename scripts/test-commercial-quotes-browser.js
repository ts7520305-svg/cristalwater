const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const html=fs.readFileSync(path.join(__dirname,'../frontend/admin-alerts.html'),'utf8');
  const section=html.slice(html.indexOf('    <style>#commercialQuotes'),html.indexOf('  </main>'));
  const q={lines:[{type:'MATERIAL',description:'Bomba <img src=x onerror=alert(1)>',quantity:1,unitCost:80,marginPercent:20}],taxPercent:23,discountPercent:0,validityDays:15,terms:'',net:100,tax:23,total:123,totalCost:80,profit:20};
  let versions=[],saves=0,approvals=0,publishes=0,publishFailure=false;
  await page.addInitScript(()=>{localStorage.setItem('token','ADMIN-A');window.authHeaders=()=>({Authorization:'Bearer '+localStorage.getItem('token')});window.fetchJSON=async(url,options={})=>{const r=await fetch(url,{...options,headers:{...authHeaders(),'Content-Type':'application/json'}});const d=await r.json();if(!r.ok)throw Error(d.message||'Falha');return d;};});
  page.on('dialog',dialog=>dialog.accept());
  await page.route('**/*',route=>{
   const url=new URL(route.request().url()),body=route.request().postDataJSON();
   if(url.pathname==='/test')return route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${section}<script src="/admin-commercial-quotes.js"></script>`});
   if(url.pathname==='/admin-commercial-quotes.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/admin-commercial-quotes.js'),'utf8')});
   let data={ok:true};
   if(url.pathname==='/api/core/repairs')data.repairs=[{id:1,problem:'Bomba',status:'PENDING',pool:{name:'Piscina QA'}}];
   else if(url.pathname.endsWith('/quotes'))data.quotes=versions;
   else if(url.pathname.endsWith('/quote-preview'))data.quote=q;
   else if(url.pathname.endsWith('/quote')){assert.equal(body.expectedVersion,0);assert.equal(body.taxPercent,23);saves++;versions=[{id:10,version:1,snapshot:q}];}
   else if(url.pathname.endsWith('/publish')){assert(url.pathname.endsWith('/1/quotes/10/publish'));publishes++;if(publishFailure)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'Versão substituída.'})});}
   else if(url.pathname.endsWith('/approve')){assert.equal(body.quoteId,10);assert.equal(body.approvalReference,'Email recebido QA');approvals++;}
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('http://quote.test/test');await page.locator('summary').click();await page.locator('#cqRepair').selectOption('1');
  await page.waitForFunction(()=>document.querySelector('.cq-line'));
  await page.locator('[data-key=description]').fill('Bomba');await page.locator('[data-key=unitCost]').fill('80');await page.locator('[data-key=marginPercent]').fill('20');await page.locator('#cqTax').fill('23');
  await page.locator('#cqForm button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#cqTotals').textContent.includes('123'));
  assert.equal(saves,0);await page.locator('#cqSave').click();await page.waitForFunction(()=>document.querySelector('#cqVersions').textContent.includes('Versão guardada: 1'));assert.equal(saves,1);
  assert.equal(await page.locator('#cqLines img').count(),0);
  await page.locator('[data-key=quantity]').fill('2');await page.locator('#cqApprove').click();assert.equal(approvals,0);assert.match(await page.locator('#cqStatus').textContent(),/Guarde/);
  await page.locator('#cqPublish').click();assert.equal(publishes,0);assert.match(await page.locator('#cqStatus').textContent(),/Guarde/);
  // Reloading retrieves the actual saved version; approval refers to that immutable snapshot.
  await page.reload();await page.locator('summary').click();await page.locator('#cqRepair').selectOption('1');await page.waitForFunction(()=>document.querySelector('#cqVersions').textContent.includes('Versão guardada: 1'));
  await page.locator('#cqPublish').click();await page.waitForFunction(()=>document.querySelector('#cqStatus').textContent.includes('Versão publicada'));assert.equal(publishes,1);
  publishFailure=true;await page.locator('#cqPublish').click();await page.waitForFunction(()=>document.querySelector('#cqStatus').textContent.includes('Versão substituída'));assert.equal(publishes,2);
  await page.locator('#cqApproval').fill('Email recebido QA');await page.locator('#cqApprove').click();await page.waitForFunction(()=>document.querySelector('#cqStatus').textContent.includes('Aprovação registada'));assert.equal(approvals,1);
  if(process.env.CW_QUOTE_SCREENSHOT) await page.screenshot({path:process.env.CW_QUOTE_SCREENSHOT,fullPage:true});
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');}
  await page.evaluate(()=>{localStorage.setItem('token','TECH-B');window.dispatchEvent(new StorageEvent('storage',{key:'token'}));});assert.equal(await page.locator('#commercialQuotes').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('PASS commercial editor preview, save, safe text, dirty approval guard, explicit approval, responsive widths and account switch');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
