const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(5000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const visits=[{id:1,status:'DONE',pool:{name:'Concluída',latitude:37,longitude:-8}},{id:2,status:'PLANNED',pool:{name:'Sem GPS',address:'Burgau'}},{id:3,status:'PLANNED',pool:{name:'Piscina selecionada',latitude:37.1,longitude:-8.1}},{id:4,status:'CANCELLED',pool:{name:'Cancelada',latitude:37.2,longitude:-8.2}}];
  let mode='normal',release,started;
  await page.addInitScript(()=>{
   localStorage.setItem('cristalwater_user',JSON.stringify({id:41,role:'TECHNICIAN'}));localStorage.setItem('token','A');
   window.CristalAuth={requireAuth:()=>true,getToken:()=>localStorage.getItem('token')};
   window.opened=[];window.removed=[];
   window.L={map:()=>({setView(){return this;},fitBounds(){}}),tileLayer:()=>({addTo(){}}),marker:coords=>({addTo(){return this;},bindPopup(){},bindTooltip(){},on(){},openPopup(){window.opened.push(coords);},closePopup(){},remove(){window.removed.push(coords);}})};
  });
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/technician/today'){
    assert.equal(route.request().headers().authorization,'Bearer A');
    if(mode==='held'){started();await new Promise(resolve=>release=resolve);}
    if(mode==='error')return route.fulfill({status:503,contentType:'application/json',body:'{}'});
    return route.fulfill({contentType:'application/json',body:JSON.stringify({complete:true,total:visits.length,visits})});
   }
   if(url.pathname==='/technician-map')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../frontend/technician-map.html'),'utf8')});
   if(url.pathname==='/technician-map.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../frontend/technician-map.js'),'utf8')});
   return route.fulfill({contentType:url.pathname.endsWith('.css')?'text/css':'text/javascript',body:''});
  });
  await page.goto('http://field.test/technician-map?selectedVisitId=3');
  await page.waitForFunction(()=>document.querySelector('#infoBox').textContent.includes('Piscina selecionada'));
  assert.deepEqual(await page.evaluate(()=>opened.at(-1)),[37.1,-8.1]);
  await page.locator('#nextBtn').click();assert.match(await page.locator('#infoBox').textContent(),/Sem GPS/);
  assert.equal(await page.locator('#wazeLink').getAttribute('aria-disabled'),'true');assert.match(await page.locator('#googleLink').getAttribute('href'),/Burgau/);
  await page.locator('#nextBtn').click();assert.match(await page.locator('#infoBox').textContent(),/Piscina selecionada/);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  console.log('PASS selected visit, correct sparse GPS marker, unfinished-only navigation and responsive map list');
  mode='error';await page.locator('#loadBtn').click();await page.waitForFunction(()=>document.querySelector('#statusBox').dataset.tone==='error');
  assert.equal(await page.locator('#visitList button').count(),0);assert.equal(await page.locator('#googleLink').getAttribute('aria-disabled'),'true');assert.equal(await page.evaluate(()=>removed.length),3);
  console.log('PASS failed refresh clears old markers and navigation destinations');
  mode='normal';visits.push({id:3,visitType:'EXTRA',status:'PLANNED',pool:{name:'Extra with same number',latitude:38,longitude:-9}});
  await page.goto('http://field.test/technician-map?selectedVisitId=3&selectedVisitType=EXTRA');await page.waitForFunction(()=>document.querySelector('#infoBox').textContent.includes('Extra with same number'));assert.deepEqual(await page.evaluate(()=>opened.at(-1)),[38,-9]);
  assert.match(await page.evaluate(()=>returnUrlWithContext()),/selectedVisitType=EXTRA/);
  await page.goto('http://field.test/technician-map?selectedVisitId=3');await page.waitForFunction(()=>document.querySelector('#statusBox').dataset.tone==='error');assert.equal(await page.locator('#googleLink').getAttribute('aria-disabled'),'true');
  console.log('PASS map destinations and return links distinguish EXTRA from REGULAR; an ambiguous number cannot choose an unrelated pool');
  mode='held';const ready=new Promise(resolve=>started=resolve);await page.locator('#loadBtn').click();await ready;
  await page.evaluate(()=>{localStorage.setItem('token','B');localStorage.setItem('cristalwater_user',JSON.stringify({id:42,role:'TECHNICIAN'}));window.dispatchEvent(new StorageEvent('storage',{key:'token'}));});release();
  await page.waitForFunction(()=>!document.querySelector('#loadBtn').disabled);assert.equal(await page.locator('#visitList button').count(),0);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS delayed map response cannot display another account route');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
