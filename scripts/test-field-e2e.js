const assert = require('node:assert/strict');
const { chromium } = require('playwright');
require('../src/loadEnv')();
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true') throw new Error('Use an isolated test environment');
const { prisma } = require('../src/prismaClient');
const bcrypt = require('bcryptjs');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
(async () => {
  const suffix = Date.now();
  const password = `Qa-${suffix}-Only!`;
  const tech = await prisma.technician.create({ data: { name: `Campo QA ${suffix}`, email: `e2e-${suffix}@qa.test`, pin: '762948', active: true } });
  const vehicle = await prisma.vehicle.create({data:{plate:`QA-${suffix}`,name:'Viatura E2E',active:true}});
  await prisma.technician.update({where:{id:tech.id},data:{vehicleId:vehicle.id}});
  const guide = await prisma.transportGuide.create({data:{vehicleId:vehicle.id,codeAT:`QA-${suffix}`,status:'ACTIVE',validUntil:new Date(Date.now()+86400000),isDraft:false}});
  await prisma.transportGuideItem.create({data:{guideId:guide.id,name:'Cloro E2E',type:'CHEMICAL',unit:'KG',quantity:10}});
  const work = await prisma.workGuide.create({data:{vehicleId:vehicle.id,technicianId:tech.id,guideId:guide.id,status:'OPEN',isDraft:false}});
  const product = await prisma.workGuideItem.create({data:{workGuideId:work.id,name:'Cloro E2E',type:'CHEMICAL',unit:'KG',quantity:10,initialQty:10,usedQty:0}});
  for(const type of ['INSURANCE','INSPECTION']) await prisma.vehicleMaintenanceRecord.create({data:{vehicleId:vehicle.id,type,title:type,status:'ACTIVE',dueDate:new Date(Date.now()+86400000*30)}});
  const client = await prisma.client.create({ data: { name: `Cliente E2E ${suffix}`, email: `client-${suffix}@qa.test`, password: await bcrypt.hash(password,10), active: true } });
  const pool = await prisma.pool.create({ data: { name: 'Piscina Campo E2E', clientId: client.id, volumeM3: 45, active: true, latitude: 38.7, longitude: -9.1 } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, plannedDate: new Date(), date: new Date(), status: 'PLANNED' } });
  const browser = await chromium.launch({ headless:true, ...(process.env.CW_CHROMIUM_PATH ? {executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']} : {}) });
  const failures=[];
  const timer=setTimeout(()=>{console.error('E2E deadline exceeded');process.exit(1)},100000);
  try {
    for (const persona of [
      {name:'Técnico móvel',login:'/api/technician-auth/login',body:{pin:tech.pin},page:'/technician-field-mode',role:'TECHNICIAN'},
      {name:'Cliente móvel',login:'/api/client-auth/login',body:{email:client.email,password},page:'/client-portal',role:'CLIENT'},
      {name:'Administrador desktop',login:'/api/auth/login',body:{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD},page:'/admin-master-control',role:'ADMIN'},
    ]) {
      console.log('START',persona.name);
      const login=await fetch(base+persona.login,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(persona.body)}).then(r=>r.json());
      assert(login.token,`login ${persona.name}`);
      const user=login.user || login.client || {id:tech.id,technicianId:tech.id,role:persona.role};
      user.role=persona.role;
      const context=await browser.newContext({viewport:persona.role==='ADMIN'?{width:1440,height:1000}:{width:390,height:844},geolocation:{latitude:38.7,longitude:-9.1},permissions:['geolocation'],isMobile:persona.role!=='ADMIN'});
      await context.addInitScript(({token,user,techId,clientId})=>{ localStorage.setItem('cristalwater_jwt',token);localStorage.setItem('cristalwater_user',JSON.stringify(user));localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify(user));if(user.role==='TECHNICIAN')localStorage.setItem('cwTechnicianId',techId);if(user.role==='CLIENT')localStorage.setItem('clientId',clientId); },{token:login.token,user,techId:String(tech.id),clientId:String(client.id)});
      const page=await context.newPage();page.setDefaultTimeout(7000);
      const errors=[], apiErrors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)apiErrors.push({url:new URL(r.url()).pathname,status:r.status()});});
      try {
        await page.goto(base+persona.page,{waitUntil:'networkidle',timeout:20000});
        assert(!/login/.test(new URL(page.url()).pathname),'unexpected login redirect');
        assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).visibility),'visible');
        assert.equal(errors.length,0,errors.join('\n'));
        console.log('PASS',persona.name,'online',JSON.stringify({apiErrors}));
        if(persona.role==='TECHNICIAN') {
          await page.waitForFunction(() => document.querySelector('#nextTitle')?.textContent.includes('Piscina Campo E2E'));
          await page.locator('[data-field-tab-button=agora]').first().click();
          const notes=page.locator('#notes');
          await notes.fill('Rascunho guardado no campo');
          await page.locator('#ph').fill('7.4');
          await page.locator('#chlorine').fill('1.5');
          await page.locator('#addDoseBtn').click();
          await page.locator('[data-dose-field=name]').last().selectOption('Cloro E2E');
          await page.locator('[data-dose-field=quantity]').last().fill('1');
          await page.waitForTimeout(200);
          // Cold reload must keep both the assigned route and entered measurements.
          await page.evaluate(() => navigator.serviceWorker.ready);
          await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
          await context.setOffline(true);
          const photoBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tAAAAABJRU5ErkJggg==','base64');
          await page.locator('#photoInput').setInputFiles({name:'field.png',mimeType:'image/png',buffer:photoBytes});
          await page.waitForFunction(async id=>(await window.CWFieldPhotos.list(id)).length===1,visit.id);
          await page.locator('#finishBtn').click();
          await page.waitForFunction(id => Boolean(window.CWFieldOffline.pending(id)), visit.id);
          const pendingBody = await page.evaluate(id => Object.values(JSON.parse(localStorage.getItem(`cwFieldOutbox:${id}`)))[0].body, tech.id);
          assert.notEqual((await prisma.serviceVisit.findUnique({where:{id:visit.id}})).status,'DONE');
          await page.reload({waitUntil:'domcontentloaded',timeout:10000});
          await page.waitForFunction(() => document.querySelector('#nextTitle')?.textContent.includes('Piscina Campo E2E'));
          assert.equal(await page.locator('#notes').inputValue(),'Rascunho guardado no campo');
          assert.equal(await page.evaluate(async id=>(await window.CWFieldPhotos.list(id))[0].file.size,visit.id),photoBytes.length);
          console.log('PASS technician offline reload preserves route and draft');
          await context.setOffline(false);
          await page.waitForFunction(id=>!window.CWFieldOffline.pending(id),visit.id,{timeout:15000});
          const persisted=await prisma.serviceVisit.findUnique({where:{id:visit.id}});
          assert.equal(persisted.status,'DONE');
          assert.equal(persisted.notes,'Rascunho guardado no campo');
          const used=await prisma.workGuideItem.findUnique({where:{id:product.id}});
          assert.equal(used.quantity,9);assert.equal(used.usedQty,1);
          const replay=await fetch(`${base}/api/core/visits/${visit.id}/complete`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${login.token}`},body:JSON.stringify(pendingBody)});
          assert.equal(replay.status,200);
          assert.equal((await prisma.workGuideItem.findUnique({where:{id:product.id}})).quantity,9);
          assert.equal(await prisma.vehicleStockMovement.count({where:{visitId:visit.id,movementType:'CONSUMPTION'}}),1);
          assert.equal(await prisma.visitPhoto.count({where:{visitId:visit.id}}),1);
          const duplicatePhoto=new FormData();duplicatePhoto.append('type','AFTER');duplicatePhoto.append('photo',new Blob([photoBytes],{type:'image/png'}),'field.png');
          assert.equal((await fetch(`${base}/api/visits/${visit.id}/photo`,{method:'POST',headers:{Authorization:`Bearer ${login.token}`},body:duplicatePhoto})).status,200);
          assert.equal(await prisma.visitPhoto.count({where:{visitId:visit.id}}),1);
          console.log('PASS offline completion and response replay consume stock exactly once, with persisted photograph');
          const concurrentVisits = await Promise.all([1,2].map(()=>prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:tech.id,date:new Date(),plannedDate:new Date(),status:'PLANNED'}})));
          const consume = (id,products) => fetch(`${base}/api/core/visits/${id}/complete`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${login.token}`},body:JSON.stringify({ph:7.4,chlorine:1.5,workGuideId:work.id,products:JSON.stringify(products)})});
          const replies=await Promise.all(concurrentVisits.map(v=>consume(v.id,[{name:'Cloro E2E',quantity:6,unit:'KG'}])));
          assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
          assert.equal((await prisma.workGuideItem.findUnique({where:{id:product.id}})).quantity,3);
          const remaining=concurrentVisits[replies.findIndex(r=>r.status===409)];
          const excessive=await consume(remaining.id,[{name:'Cloro E2E',quantity:2,unit:'KG'},{name:'Cloro E2E',quantity:2,unit:'KG'}]);
          assert.equal(excessive.status,409);
          assert.equal((await prisma.workGuideItem.findUnique({where:{id:product.id}})).quantity,3);
          console.log('PASS concurrent visits and repeated product lines cannot overspend stock');
          const correct=quantity=>fetch(`${base}/api/technician/visits/${visit.id}/correction`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${login.token}`},body:JSON.stringify({ph:7.4,chlorine:1.5,products:JSON.stringify([{name:'Cloro E2E',quantity,unit:'KG'}])})});
          assert.equal((await correct(2)).status,200);
          assert.equal((await prisma.workGuideItem.findUnique({where:{id:product.id}})).quantity,2);
          assert.equal((await correct(2)).status,200);
          assert.equal((await prisma.workGuideItem.findUnique({where:{id:product.id}})).quantity,2);
          assert.equal((await correct(0.5)).status,200);
          assert.equal((await prisma.workGuideItem.findUnique({where:{id:product.id}})).quantity,3.5);
          assert.equal((await correct(99)).status,409);
          assert.equal((await prisma.workGuideItem.findUnique({where:{id:product.id}})).quantity,3.5);
          assert.equal((await prisma.chemicalUsage.findFirst({where:{visitId:visit.id}})).quantity,0.5);
          console.log('PASS corrections reconcile quantity differences once and reject insufficient stock atomically');
          await page.evaluate(async token=>{
            const request=indexedDB.open('cristalwater-v22-offline',2);
            const db=await new Promise((resolve,reject)=>{request.onupgradeneeded=()=>{request.result.createObjectStore('PayloadQueue',{keyPath:'id',autoIncrement:true});request.result.createObjectStore('MediaQueue',{keyPath:'id',autoIncrement:true})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
            await new Promise((resolve,reject)=>{const tx=db.transaction('PayloadQueue','readwrite');tx.objectStore('PayloadQueue').add({url:location.origin+'/api/core/visits/1/complete',method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:new TextEncoder().encode('{"notes":"Registo antigo"}').buffer});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();await window.CWFieldRecovery.refresh();
          },login.token);
          assert(await page.locator('#cwFieldRecovery').isVisible());
          const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Guardar cópia dos registos'}).click()]);
          const backup=JSON.parse(require('fs').readFileSync(await download.path(),'utf8'));
          assert.equal(backup.entries.length,1);assert(!JSON.stringify(backup).includes(login.token));assert.equal(Buffer.from(backup.entries[0].bodyBase64,'base64').toString(),'{"notes":"Registo antigo"}');
          await page.evaluate(()=>window.CWFieldRecovery.refresh());assert(await page.locator('#cwFieldRecovery').isVisible());
          console.log('PASS older pending records remain preserved and export excludes authentication tokens');


        }
      } catch(e) { const state=await page.evaluate(()=>({toast:document.querySelector('#toast')?.textContent,documents:document.querySelector('#documentCenterBox')?.innerText})).catch(()=>null); failures.push({persona:persona.name,error:e.message,state,errors,apiErrors});console.error('FAIL',persona.name,e.message); }
      console.log('CLOSE',persona.name);
      await context.close();
      console.log('CLOSED',persona.name);
    }
    console.log(JSON.stringify({failures},null,2));
    if(failures.length)process.exitCode=1;
  } finally {clearTimeout(timer);await browser.close();await prisma.$disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
