const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const html=fs.readFileSync(path.join(__dirname,'../frontend/admin-client-settings.html'),'utf8'),styles=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[0]).join('');
  const panel=html.slice(html.indexOf('<section id="ratePanel"'),html.indexOf('</section>',html.indexOf('<section id="ratePanel"'))+10);
  let plan=null,saves=0,hold=false,started,release;
  await page.addInitScript(()=>localStorage.setItem('token','ADMIN-A'));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url()),body=route.request().postDataJSON();
   if(url.pathname==='/test')return route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<label>Cliente<select id="clientId"><option value="">Escolher cliente</option></select></label>${panel}<script src="/admin-client-rates.js"></script>`});
   if(url.pathname==='/admin-client-rates.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/admin-client-rates.js'),'utf8')});
   let data={ok:true};
   if(url.pathname==='/api/core/clients')data.clients=[{id:1,name:'Cliente Algarve'},{id:2,name:'Outro cliente'}];
   else if(url.pathname.endsWith('client-rates-preview'))data.preview={monthRef:'2028-02',amount:100.69,daysInMonth:29,segments:[{startsOn:'2028-02-01',endsOn:'2028-02-14',days:14,monthlyAmount:80,label:'Base'},{startsOn:'2028-02-15',endsOn:'2028-02-29',days:15,monthlyAmount:120,label:'Verão <img>'}]};
   else if(route.request().method()==='PUT'){assert.equal(body.expectedVersion,0);assert.equal(body.periods[0].monthlyAmount,120);saves++;plan={version:1,snapshot:{baseCents:8000,periods:[{startsOn:'2028-02-15',endsOn:'2028-02-29',monthlyCents:12000,label:'Verão <img>'}]}};data.plan=plan;}
   else {if(hold){started();await new Promise(resolve=>release=resolve);}data={ok:true,clientName:'Cliente Algarve',legacyBaseAmount:80,plan};}
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('http://rates.test/test');await page.locator('#clientId').selectOption('1');await page.locator('#rateLoad').click();await page.waitForFunction(()=>document.querySelector('#rateBase').value==='80');
  await page.locator('#rateAdd').click();await page.locator('[data-key=startsOn]').fill('2028-02-15');await page.locator('[data-key=endsOn]').fill('2028-02-29');await page.locator('[data-key=monthlyAmount]').fill('120');await page.locator('#rateMonth').fill('2028-02');
  await page.locator('#rateForm button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#ratePreview').textContent.includes('100,69'));assert.equal(saves,0);assert.equal(await page.locator('#ratePreview img').count(),0);
  await page.locator('#rateSave').click();await page.waitForFunction(()=>document.querySelector('#rateStatus').textContent.includes('Nova versão guardada'));assert.equal(saves,1);
  await page.locator('#clientId').selectOption('2');await page.locator('#rateSave').click();assert.equal(saves,1);assert.equal(await page.locator('#rateBase').inputValue(),'');assert.match(await page.locator('#rateStatus').textContent(),/Carregue/);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  hold=true;const ready=new Promise(resolve=>started=resolve);await page.locator('#rateLoad').click();await ready;await page.evaluate(()=>{localStorage.setItem('token','TECH-B');window.dispatchEvent(new StorageEvent('storage',{key:'token'}));});release();await page.waitForFunction(()=>document.querySelector('#ratePanel').hidden);
  assert.equal(await page.locator('#rateBase').inputValue(),'');assert.equal(await page.locator('#clientId option').count(),0);assert.deepEqual(errors,[]);
  console.log('PASS rate editor monthly simulation, explicit save, safe labels, client switch, responsive layout and delayed response after account switch');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
