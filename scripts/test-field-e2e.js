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
  const tech = await prisma.technician.create({ data: { name: 'Rui · Técnico QA', email: `e2e-${suffix}@qa.test`, pin: '762948', active: true } });
  const vehicle = await prisma.vehicle.create({data:{plate:`QA-${suffix}`,name:'Viatura E2E',active:true}});
  await prisma.technician.update({where:{id:tech.id},data:{vehicleId:vehicle.id}});
  const guide = await prisma.transportGuide.create({data:{vehicleId:vehicle.id,codeAT:`QA-${suffix}`,status:'ACTIVE',validUntil:new Date(Date.now()+86400000),isDraft:false}});
  await prisma.transportGuideItem.create({data:{guideId:guide.id,name:'Cloro E2E',type:'CHEMICAL',unit:'KG',quantity:10}});
  const work = await prisma.workGuide.create({data:{vehicleId:vehicle.id,technicianId:tech.id,guideId:guide.id,status:'OPEN',isDraft:false}});
  const product = await prisma.workGuideItem.create({data:{workGuideId:work.id,name:'Cloro E2E',type:'CHEMICAL',unit:'KG',quantity:10,initialQty:10,usedQty:0}});
  for(const type of ['INSURANCE','INSPECTION']) await prisma.vehicleMaintenanceRecord.create({data:{vehicleId:vehicle.id,type,title:type,status:'ACTIVE',dueDate:new Date(Date.now()+86400000*30)}});
  const client = await prisma.client.create({ data: { name: 'Cliente de demonstração', email: `client-${suffix}@qa.test`, password: await bcrypt.hash(password,10), active: true } });
  const pool = await prisma.pool.create({ data: { name: 'Piscina da Quinta', clientId: client.id, volumeM3: 45, active: true, latitude: 38.7, longitude: -9.1 } });
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
        if(persona.role==='TECHNICIAN') await page.waitForFunction(()=>document.querySelector('#fieldDocsValue')?.textContent==='Válidos');
        if(process.env.CW_CAPTURE_UI){require('fs').mkdirSync('reports/field-ui',{recursive:true});await page.screenshot({path:`reports/field-ui/${persona.role}.png`,fullPage:true});}
        if(persona.role==='ADMIN') {
          await page.route('**/api/technicians',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Unavailable"}'}));
          await page.locator('#refreshBtn').click();
          await page.waitForFunction(()=>document.querySelector('#syncState').textContent==='Dados parciais');
          await page.unroute('**/api/technicians');
          await page.locator('#refreshBtn').click();
          await page.waitForFunction(()=>document.querySelector('#syncState').textContent==='Sincronizado');
          assert(!(await page.locator('#metricsHint').textContent()).includes('estrutura'));
          console.log('PASS management partial technician data is visible and refresh restores complete status');
          const otherClient = await prisma.client.create({data:{name:'Cliente B · Isolamento QA',active:true}});
          await page.goto(`${base}/client-portal?clientId=${client.id}`,{waitUntil:'networkidle'});
          assert(await page.locator('#messageInput').isDisabled(),'Administrator preview must not compose client messages');
          await page.locator('#visitRequestInput').fill('Rascunho do cliente A');
          let releaseOld, oldStarted;
          const started = new Promise(resolve=>{oldStarted=resolve;});
          const released = new Promise(resolve=>{releaseOld=resolve;});
          await page.route(`**/api/client-portal/${client.id}?*`,async route=>{
            const response=await route.fetch();oldStarted();await released;await route.fulfill({response});
          });
          await page.evaluate(()=>{window.oldPortalLoad=loadPortal();});
          await started;
          await page.locator('#adminClientSelect').selectOption(String(otherClient.id));
          await page.waitForFunction(()=>document.querySelector('#clientName').textContent==='Cliente B · Isolamento QA');
          assert(await page.locator('#sendBtn').isDisabled(),'Administrator preview must remain read-only');
          assert(await page.locator('#messageInput').isDisabled(),'Administrator preview must remain read-only after switching clients');
          assert.equal(await page.locator('#visitRequestInput').inputValue(),'');
          await page.locator('#visitRequestInput').fill('Rascunho do cliente B');
          releaseOld();
          await page.evaluate(()=>window.oldPortalLoad);
          assert.equal(await page.locator('#clientName').textContent(),'Cliente B · Isolamento QA');
          assert(!(await page.locator('#poolsList').textContent()).includes('Piscina da Quinta'));
          await page.unroute(`**/api/client-portal/${client.id}?*`);
          await page.locator('#adminClientSelect').selectOption(String(client.id));
          await page.waitForFunction(()=>document.querySelector('#clientName').textContent==='Cliente de demonstração');
          assert.equal(await page.locator('#visitRequestInput').inputValue(),'Rascunho do cliente A');
          assert.equal(errors.length,0,errors.join('\n'));
          console.log('PASS admin client switch ignores late responses and isolates/restores drafts');
          await prisma.stockBalance.createMany({data:[{scope:'CENTRAL',productName:'LEGACY TRANSFER UI QA',unit:'L',quantity:10},{scope:'CENTRAL',productName:'LEGACY TRANSFER UI QA',unit:'KG',quantity:6}]});
          await page.goto(base+'/admin-inventory',{waitUntil:'networkidle'});await page.locator('#transferVehicleId').selectOption(String(vehicle.id));await page.locator('#transferProductName').selectOption(JSON.stringify(['LEGACY TRANSFER UI QA','L']));assert.equal(await page.locator('#transferUnit').inputValue(),'L');await page.locator('#transferQuantity').fill('2');
          let droppedInventory=false,droppedInventoryCalls=0;await page.route('**/api/inventory/transfer-to-vehicle',async route=>{droppedInventoryCalls++;if(!droppedInventory){droppedInventory=true;await route.fetch();await route.abort('failed');}else await route.continue();});
          await page.locator('#transferForm button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('inventoryStatus').classList.contains('error'));await page.reload({waitUntil:'networkidle'});await page.locator('#transferForm [data-inventory-pending]').waitFor();await page.locator('#transferForm button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('inventoryStatus').textContent==='Transferência de stock confirmada.');assert.equal(droppedInventoryCalls,2);
          assert.equal(await prisma.stockMovement.count({where:{productName:'LEGACY TRANSFER UI QA',vehicleId:vehicle.id,movementType:'TRANSFER_TO_VEHICLE'}}),1);assert.equal((await prisma.stockBalance.findFirst({where:{scope:'VEHICLE',vehicleId:vehicle.id,productName:'LEGACY TRANSFER UI QA'}})).quantity,2);
          assert.equal((await prisma.stockBalance.findFirst({where:{scope:'CENTRAL',productName:'LEGACY TRANSFER UI QA',unit:'KG'}})).quantity,6);
          console.log('PASS inventory distinguishes product units and replays a lost transfer after reload once');
          await page.waitForFunction(()=>document.getElementById('inventoryStatus').classList.contains('ok'));await page.locator('#consumeVehicleId').selectOption(String(vehicle.id));await page.locator('#consumeProductName').selectOption(JSON.stringify(['LEGACY TRANSFER UI QA','L']));assert.equal(await page.locator('#consumeUnit').inputValue(),'L');await page.locator('#consumeQuantity').fill('1');
          let droppedManual=false,droppedManualCalls=0;await page.route('**/api/inventory/consume',async route=>{droppedManualCalls++;if(!droppedManual){droppedManual=true;await route.fetch();await route.abort('failed');}else await route.continue();});
          await page.locator('#consumeForm button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('inventoryStatus').classList.contains('error'));await page.reload({waitUntil:'networkidle'});await page.locator('#consumeForm [data-inventory-pending]').waitFor();await page.locator('#consumeForm button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('inventoryStatus').textContent==='Consumo de stock confirmado.');assert.equal(droppedManualCalls,2);
          assert.equal((await prisma.stockBalance.findFirst({where:{scope:'VEHICLE',vehicleId:vehicle.id,productName:'LEGACY TRANSFER UI QA'}})).quantity,1);
          await page.locator('#supplierName').fill('QA browser supplier');await page.locator('#invoiceNumber').fill('QA-UI-ENTRY');await page.locator('#items [data-k=productName]').fill('ENTRY UI QA');await page.locator('#items [data-k=quantity]').fill('4');await page.locator('#items [data-k=unit]').fill('L');await page.locator('#items [data-k=unitCost]').fill('2');
          const invoiceDir=require('../src/config/uploadPath').resolveUploadSubdir('inventory');const invoiceFilesBefore=require('fs').readdirSync(invoiceDir).filter(name=>name.endsWith('-qa-invoice.pdf')).length;
          await page.locator('#document').setInputFiles({name:'qa-invoice.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 QA invoice fixture')});
          let droppedEntry=false,droppedEntryCalls=0;await page.route('**/api/inventory/purchases',async route=>{droppedEntryCalls++;if(!droppedEntry){droppedEntry=true;await route.fetch();await route.abort('failed');}else await route.continue();});
          await page.locator('#purchaseForm button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('inventoryStatus').classList.contains('error'));await page.reload({waitUntil:'networkidle'});await page.locator('#purchaseForm [data-inventory-pending]').waitFor();await page.locator('#purchaseForm button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('inventoryStatus').textContent==='Entrada de stock confirmada.');assert.equal(droppedEntryCalls,2);
          assert.equal(await prisma.stockPurchase.count({where:{invoiceNumber:'QA-UI-ENTRY'}}),1);assert.equal((await prisma.stockBalance.findFirst({where:{scope:'CENTRAL',productName:'ENTRY UI QA'}})).quantity,4);
          assert.equal(require('fs').readdirSync(invoiceDir).filter(name=>name.endsWith('-qa-invoice.pdf')).length,invoiceFilesBefore+1);
          const invoiceFile=require('fs').readdirSync(invoiceDir).find(name=>name.endsWith('-qa-invoice.pdf'));assert.deepEqual(require('fs').readFileSync(require('path').join(invoiceDir,invoiceFile)),Buffer.from('%PDF-1.4 QA invoice fixture'));
          console.log('PASS manual consumption and purchase recover after reload with identical attachment and no duplicate stock');
          assert.equal(await page.locator('[data-inventory-feedback]').count(),0);
          for(const width of [320,390,1280]){
            await page.setViewportSize({width,height:844});
            const outside=await page.locator('#purchaseForm input,#purchaseForm button,#transferForm input,#transferForm select,#transferForm button,#consumeForm input,#consumeForm select,#consumeForm button').evaluateAll(nodes=>nodes.filter(node=>{const r=node.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;}).map(node=>node.id||node.name||node.textContent));
            assert.deepEqual(outside,[],`Inventory controls outside viewport at ${width}px`);
            if(width===390&&process.env.CW_CAPTURE_UI){await page.locator('#transferForm').scrollIntoViewIfNeeded();await page.screenshot({path:'reports/field-ui/ADMIN_INVENTORY_MOBILE.png',fullPage:false});}
          }
          console.log('PASS inventory controls remain fully visible at 320, 390 and 1280px');



        }
        if(persona.role==='CLIENT') {
          assert.equal(await page.locator('.ds-bottom-nav').count(),0);
          for(const width of [320,390,768]){
            await page.setViewportSize({width,height:844});
            assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Client horizontal overflow at ${width}`);
          }
          await page.setViewportSize({width:390,height:844});
          await page.locator('#cwLanguageSelect').selectOption('pt');
          await page.waitForFunction(()=>document.documentElement.lang==='pt');
          assert.equal(await page.locator('#cwLanguageSelect').inputValue(),'pt');
          assert.equal(await page.locator('.cw-v2-mobile-nav a[aria-label=Pagamentos]').textContent(),'Conta');
          if(process.env.CW_CAPTURE_UI)await page.screenshot({path:'reports/field-ui/CLIENT_VIEWPORT.png',fullPage:false});
          await page.route('**/api/client-portal/*/documents',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Unavailable"}'}));
          await page.reload({waitUntil:'domcontentloaded'});
          await page.locator('#documentList [role=alert]').waitFor({state:'visible'});
          assert(await page.locator('#documentList [role=alert]').isVisible());
          assert.match(await page.locator('#poolsList').textContent(),/Piscina da Quinta/);
          await page.unroute('**/api/client-portal/*/documents');
          await page.locator('#documentList button').click();
          await page.waitForFunction(()=>!document.querySelector('#documentList [role=alert]'));
          let originalRequest;
          await page.route('**/api/client-messages',route=>{if(route.request().method()==='POST'){originalRequest=route.request().postDataJSON();return route.abort('failed');}return route.continue();});
          await page.locator('#messageInput').fill('Mensagem preservada após falha');
          await page.locator('#sendBtn').click();
          await page.waitForFunction(()=>!document.querySelector('#clientChatRetry').hidden&&!document.querySelector('#clientChatRetry').disabled);
          assert.equal(await page.locator('#messageInput').inputValue(),'Mensagem preservada após falha');
          assert.match(await page.locator('#clientChatSendStatus').textContent(),/Envio não confirmado/);
          assert(await page.locator('#sendBtn').isDisabled(),'An uncertain send must use its original request');
          assert(originalRequest?.requestId,'The first attempt must carry a persisted request identity');
          assert.equal(await prisma.clientMessage.count({where:{clientId:client.id,text:'Mensagem preservada após falha'}}),0);
          await page.unroute('**/api/client-messages');
          await page.reload({waitUntil:'networkidle'});
          await page.waitForFunction(()=>!document.querySelector('#clientChatRetry').hidden&&!document.querySelector('#clientChatRetry').disabled);
          assert.equal(await page.locator('#messageInput').inputValue(),'Mensagem preservada após falha');
          let posts=0;
          const retriedRequests=[];
          await page.route('**/api/client-messages',async route=>{if(route.request().method()==='POST'){posts++;retriedRequests.push(route.request().postDataJSON());await new Promise(r=>setTimeout(r,150));}await route.continue()});
          await page.evaluate(()=>{document.querySelector('#clientChatRetry').click();document.querySelector('#clientChatRetry').click()});
          await page.waitForFunction(()=>document.querySelector('#messageInput').value==='');
          assert.equal(posts,1);
          assert.deepEqual(retriedRequests,[originalRequest],'Retry must retain the exact UUID, recipient and content across reload');
          assert.equal(await prisma.clientMessage.count({where:{clientId:client.id,text:'Mensagem preservada após falha'}}),1);
          await page.locator('#photoInput').setInputFiles({name:'client-attachment.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tAAAAABJRU5ErkJggg==','base64')});
          await page.waitForFunction(()=>document.querySelector('#photoInput').value==='');
          assert.equal(await prisma.clientMessage.count({where:{clientId:client.id,fileName:'client-attachment.png'}}),1);
          console.log('PASS client partial failure recovery, retained message, double-click guard and persisted attachment');
        }
        if(persona.role==='TECHNICIAN') {
          await page.waitForFunction(() => document.querySelector('#nextTitle')?.textContent.includes('Piscina da Quinta'));
          await page.locator('[data-field-tab-button=hoje]').click();
          await page.route('**/api/technician/water-reminders',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"QA unavailable"}'}));
          await page.locator('#dayReviewBtn').click();
          await page.waitForFunction(()=>document.querySelector('#dayReviewResult').getAttribute('aria-busy')==='false');
          assert.match(await page.locator('#dayReviewResult').textContent(),/Água aberta: não foi possível confirmar/);
          await page.unroute('**/api/technician/water-reminders');
          const remoteReminder=await prisma.operationalReminder.create({data:{title:'Agua aberta - QA outro dispositivo',sourceKey:`water:${tech.id}:review-${suffix}`,assignedToTechnicianId:tech.id,poolId:pool.id,clientId:client.id,dueDate:new Date(Date.now()+3600000),metadata:{localId:`review-${suffix}`,visitId:visit.id,poolName:'Piscina registada noutro dispositivo'}}});
          await page.locator('#dayReviewBtn').click();
          await page.waitForFunction(()=>document.querySelector('#dayReviewResult').getAttribute('aria-busy')==='false');
          assert.match(await page.locator('#dayReviewResult .day-review-critical').textContent(),/Piscina registada noutro dispositivo/);
          assert.equal(await page.locator('#dayReviewResult').getAttribute('role'),'status');
          assert.equal(await page.locator('#dayReviewResult').getAttribute('data-cw-state'),null);
          assert.equal(await page.locator('#dayReviewBtn').evaluate(node=>getComputedStyle(node).color),'rgb(255, 255, 255)');
          for(const width of [320,390,768]){
            await page.setViewportSize({width,height:844});
            assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Day review overflow at ${width}`);
            assert(await page.evaluate(()=>Array.from(document.querySelectorAll('#dayReviewResult .day-review-group')).every(node=>node.getBoundingClientRect().width>=220)),`Day review readable width at ${width}`);
          }
          await page.setViewportSize({width:390,height:844});
          if(process.env.CW_CAPTURE_UI){await page.locator('#dayReviewCard').scrollIntoViewIfNeeded();await page.screenshot({path:'reports/field-ui/TECHNICIAN_DAY_REVIEW.png',fullPage:false});}
          await prisma.operationalReminder.update({where:{id:remoteReminder.id},data:{isCompleted:true}});
          await page.evaluate(id=>{const key=`cwWaterReminders:${id}`;const rows=JSON.parse(localStorage.getItem(key)||'[]');localStorage.setItem(key,JSON.stringify(rows.filter(row=>!String(row.localId).startsWith('review-'))));},tech.id);
          console.log('PASS review queries server reminders, detects partial failure and fits 320/390/768px');
          const receivingTech=await prisma.technician.create({data:{name:'Colega de passagem QA',pin:'762950',active:true}});
          const transferReminder=await prisma.operationalReminder.create({data:{title:'Bomba QA passagem',sourceKey:`pump:${tech.id}:transfer-${suffix}`,assignedToTechnicianId:tech.id,poolId:pool.id,clientId:client.id,dueDate:new Date(Date.now()+3600000),metadata:{localId:`transfer-${suffix}`,visitId:visit.id,poolName:pool.name}}});
          await page.locator('#handoverRefresh').click();
          const transferCard=page.locator(`[data-handover-reminder="${transferReminder.id}"]`);
          await transferCard.locator('select').selectOption(String(receivingTech.id));
          await transferCard.locator('textarea').fill('Fim de turno, colega assume a bomba');
          await transferCard.getByRole('button',{name:'Pedir passagem'}).click();
          await page.waitForFunction(id=>document.querySelector(`[data-handover-reminder="${id}"]`)?.textContent.includes('Continua responsável'),transferReminder.id);
          assert((await transferCard.boundingBox()).width>=220);
          assert.equal(await transferCard.locator('button').evaluate(node=>getComputedStyle(node).color),'rgb(255, 255, 255)');
          if(process.env.CW_CAPTURE_UI){await transferCard.scrollIntoViewIfNeeded();await page.screenshot({path:'reports/field-ui/TECHNICIAN_HANDOVER.png',fullPage:false});}
          assert.equal((await prisma.operationalReminder.findUnique({where:{id:transferReminder.id}})).assignedToTechnicianId,tech.id);
          const receiverLogin=await fetch(base+'/api/technician-auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:receivingTech.pin})}).then(r=>r.json());
          assert(receiverLogin.token);
          const receiverContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
          try {
            await receiverContext.addInitScript(({token,user,id})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({...user,role:'TECHNICIAN',technicianId:id}));localStorage.setItem('cwTechnicianId',String(id));},{token:receiverLogin.token,user:receiverLogin.user||{},id:receivingTech.id});
            const receiverPage=await receiverContext.newPage();
            await receiverPage.goto(base+'/technician-field-mode',{waitUntil:'networkidle'});
            await receiverPage.locator('[data-field-tab-button=hoje]').click();
            receiverPage.once('dialog',dialog=>dialog.accept());
            await receiverPage.locator(`[data-handover-reminder="${transferReminder.id}"]`).getByRole('button',{name:'Aceitar responsabilidade'}).click();
            await receiverPage.waitForFunction(id=>document.querySelector(`[data-handover-reminder="${id}"]`)?.textContent.includes('Escolha quem pode assumir'),transferReminder.id);
            assert.equal((await prisma.operationalReminder.findUnique({where:{id:transferReminder.id}})).assignedToTechnicianId,receivingTech.id);
          } finally {await receiverContext.close();}
          await page.locator('#handoverRefresh').click();
          await page.waitForFunction(id=>!document.querySelector(`[data-handover-reminder="${id}"]`),transferReminder.id);
          const transferClosed=await fetch(`${base}/api/technician/pump-reminders/${transferReminder.id}/close`,{method:'POST',headers:{Authorization:`Bearer ${receiverLogin.token}`}});
          assert.equal(transferClosed.status,200);
          console.log('PASS two technicians request and accept responsibility in separate mobile sessions');
          assert.equal(await page.locator('.field-tabs').count(),1);
          assert.equal(await page.locator('.ds-bottom-nav, .cw-v2-mobile-primary, [data-cw-drawer]').count(),0);
          assert.equal(await page.locator('#interruptCard').isVisible(),false,'Valid documents must not leave false operational alerts');
          for(const width of [320,390,768]){
            await page.setViewportSize({width,height:844});
            assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Horizontal overflow at ${width}px`);
            const targets=await page.locator('.field-tabs button').evaluateAll(buttons=>buttons.map(button=>({w:button.getBoundingClientRect().width,h:button.getBoundingClientRect().height})));
            assert(targets.every(target=>target.w>=44&&target.h>=44),`Navigation targets too small at ${width}px`);
          }
          await page.setViewportSize({width:390,height:844});
          await page.locator('[data-field-tab-button=agora]').first().click();
          assert.equal(await page.locator('[data-field-tab-button=agora]').getAttribute('aria-current'),'page');
          assert.equal(await page.locator('.crew-card').isVisible(),false,'Detailed vehicle documents belong in the Vehicle tab');
          await page.getByRole('button',{name:'Serviço',exact:true}).click();
          assert.equal(await page.locator('.check input:checked').count(),0,'New visits must not claim tasks were already performed');
          await page.locator('#basketCleaned').check();
          for(const id of ['ph','chlorine','alkalinity','orp'])assert.equal(await page.locator(`#${id}Status`).textContent(),'Por medir');
          for(const [value,status] of [['7,4','OK'],['0','Baixo'],['9','Alto'],['','Por medir']]){
            await page.locator('#ph').fill(value);
            assert.equal(await page.locator('#phStatus').textContent(),status);
          }
          if(process.env.CW_CAPTURE_UI)await page.screenshot({path:'reports/field-ui/TECHNICIAN_VISIT.png',fullPage:false});
          await page.evaluate(()=>{window.__storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('cwFieldVisitDrafts:'))throw new DOMException('Quota exceeded','QuotaExceededError');return window.__storageSet.call(this,key,value)}});
          await page.locator('#notes').fill('Teste de memória cheia');
          assert.equal(await page.locator('#fieldSaveStatus').getAttribute('data-state'),'error');
          await page.evaluate(()=>{Storage.prototype.setItem=window.__storageSet;delete window.__storageSet});
          console.log('PASS one navigation, 320/390/768px layout, touch targets and explicit local storage failure');

          await page.locator('#photoInput').dispatchEvent('cancel');
          assert.match(await page.locator('#photoFeedback').textContent(),/Nenhuma fotografia/);
          await page.locator('#photoInput').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('not a photo')});
          assert.match(await page.locator('#photoFeedback').textContent(),/imagem válida/);
          assert.equal(await page.evaluate(async id=>(await CWFieldPhotos.list(id)).length,visit.id),0);
          await page.evaluate(()=>{window.__photoSave=CWFieldPhotos.save;CWFieldPhotos.save=async()=>{throw new DOMException('Quota exceeded','QuotaExceededError')}});
          await page.locator('#photoInput').setInputFiles({name:'quota.png',mimeType:'image/png',buffer:Buffer.from('photo')});
          await page.waitForFunction(()=>document.querySelector('#photoFeedback').textContent.includes('Liberte espaço'));
          await page.evaluate(()=>{CWFieldPhotos.save=window.__photoSave;delete window.__photoSave});
          assert.equal(await page.evaluate(async id=>(await CWFieldPhotos.list(id)).length,visit.id),0);
          console.log('PASS photo cancellation, invalid file and storage failure do not claim a saved photograph');

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
          await page.locator('#incompleteVisitCard summary').click();
          await page.locator('#incompleteReason').selectOption('CHEMICAL_MISSING');
          await page.locator('#shortageProduct').fill('Hipoclorito de sódio');
          await page.locator('#shortageQuantity').fill('25');
          await page.locator('#shortageUnit').selectOption('L');
          await page.locator('#incompleteNextStep').fill('Confirmar reposição de química e terminar o tratamento');
          assert.equal(await page.locator('#incompleteSave').evaluate(node=>getComputedStyle(node).color),'rgb(255, 255, 255)');
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Incomplete form must fit mobile viewport');
          if(process.env.CW_CAPTURE_UI){await page.locator('#incompleteVisitCard').scrollIntoViewIfNeeded();await page.screenshot({path:'reports/field-ui/TECHNICIAN_INCOMPLETE.png',fullPage:false});}
          await page.locator('#incompleteSave').click();
          assert.match(await page.locator('#incompleteStatus').textContent(),/por confirmar no escritório/);
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>document.querySelector('#nextTitle')?.textContent.includes('Piscina da Quinta'));
          await page.locator('[data-field-tab-button=agora]').click();
          assert.match(await page.locator('#incompleteStatus').textContent(),/por confirmar no escritório/);
          await page.route('**/api/technician/visits/*/incomplete',route=>route.fulfill({status:403,contentType:'application/json',body:'{"ok":false,"error":"QA atribuição por confirmar"}'}));
          await context.setOffline(false);
          await page.waitForFunction(()=>document.querySelector('#incompleteStatus').textContent.includes('Confirme a situação com o escritório'));
          assert(await page.evaluate(id=>Object.values(JSON.parse(localStorage.getItem(`cwIncompleteVisits:${id}`))).some(row=>row.blocked),tech.id));
          await page.unroute('**/api/technician/visits/*/incomplete');
          page.once('dialog',dialog=>dialog.accept());
          await page.locator('#incompleteRetry').click();
          await page.waitForFunction(()=>document.querySelector('#incompleteStatus').textContent.includes('registada no servidor'));
          assert.equal((await prisma.serviceVisit.findUnique({where:{id:visit.id}})).status,'INCOMPLETE');
          const shortage=await prisma.operationalReminder.findFirst({where:{sourceKey:{startsWith:`incomplete:${visit.id}:`}}});
          assert.deepEqual(shortage.metadata.chemicalShortage,{productName:'Hipoclorito de sódio',quantity:25,unit:'L'});
          await page.locator('[data-field-tab-button=hoje]').click();await page.locator('#shortageRefresh').click();
          await page.waitForFunction(()=>document.getElementById('shortageList').textContent.includes('25 L'));
          assert.match(await page.locator('#shortageList').textContent(),/Hipoclorito de sódio/);
          assert.equal(await page.locator('#shortageRefresh').evaluate(node=>getComputedStyle(node).color),'rgb(255, 255, 255)');
          if(process.env.CW_CAPTURE_UI)await page.locator('#fieldShortagePreparation').screenshot({path:'reports/field-ui/TECHNICIAN_CHEMICAL_PREPARATION.png'});
          await prisma.stockBalance.create({data:{scope:'CENTRAL',productName:'HIPOCLORITO DE SÓDIO',unit:'L',quantity:30}});
          const warehouseLogin=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})}).then(r=>r.json());
          assert(warehouseLogin.token);
          const warehouseContext=await browser.newContext({viewport:{width:1440,height:1000}});
          try{
            await warehouseContext.addInitScript(({token,user})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(user));},{token:warehouseLogin.token,user:warehouseLogin.user});
            const warehousePage=await warehouseContext.newPage();await warehousePage.goto(base+'/admin-alerts',{waitUntil:'networkidle'});
            const loadForm=warehousePage.locator(`.chemical-load-form[data-shortage="${shortage.id}"]`);
            await loadForm.locator('input[name=quantity]').fill('8');
            if(process.env.CW_CAPTURE_UI)await warehousePage.locator('#shortagePreparation').screenshot({path:'reports/field-ui/ADMIN_CHEMICAL_LOAD.png'});
            let droppedLoad=false;await warehousePage.route('**/api/equipment-stock-os/stock/transfers',async route=>{if(!droppedLoad){droppedLoad=true;await route.fetch();await route.abort('failed');}else await route.continue();});
            warehousePage.once('dialog',dialog=>dialog.accept());await loadForm.getByRole('button',{name:'Registar carga na viatura'}).click();
            await warehousePage.waitForFunction(()=>document.querySelector('.chemical-load-form [role=status]')?.textContent.includes('Pode repetir'));
            warehousePage.once('dialog',dialog=>dialog.accept());await loadForm.getByRole('button',{name:'Registar carga na viatura'}).click();
            await warehousePage.waitForFunction(()=>document.getElementById('followupStatus').textContent.includes('Carga registada'));
            assert.match(await warehousePage.locator('#shortagePreparation').textContent(),/Cargas associadas: 8 L/);
            assert.equal(await prisma.stockMovement.count({where:{vehicleId:vehicle.id,productName:'HIPOCLORITO DE SÓDIO',movementType:'TRANSFER_TO_VEHICLE'}}),1);
            console.log('PASS management records warehouse load with lost response retry and no duplicate debit');
          }finally{await warehouseContext.close();}
          const deliveryCard=page.locator(`[data-shortage="${shortage.id}"]`);
          await deliveryCard.getByRole('button',{name:'Confirmar receção de química'}).click();
          await deliveryCard.locator('input[name=quantity]').fill('5');
          await page.evaluate(()=>window.dispatchEvent(new Event('online')));
          assert.equal(await deliveryCard.locator('input[name=quantity]').inputValue(),'5');
          assert.equal(await deliveryCard.getByRole('button',{name:'Recebi esta quantidade'}).evaluate(node=>getComputedStyle(node).color),'rgb(255, 255, 255)');
          if(process.env.CW_CAPTURE_UI)await page.locator('#fieldShortagePreparation').screenshot({path:'reports/field-ui/TECHNICIAN_CHEMICAL_DELIVERY.png'});
          let droppedDelivery=false;
          await page.route(`**/api/technician/chemical-shortages/${shortage.id}/deliveries`,async route=>{
            if(route.request().method()==='POST'&&!droppedDelivery){droppedDelivery=true;await route.fetch();await route.abort('failed');}else await route.continue();
          });
          await deliveryCard.getByRole('button',{name:'Recebi esta quantidade'}).click();
          await page.waitForFunction(id=>document.querySelector(`[data-shortage="${id}"] form [role=status]`)?.textContent.includes('Pode repetir'),shortage.id);
          assert(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('cwChemicalDelivery:'))));
          await deliveryCard.getByRole('button',{name:'Recebi esta quantidade'}).click();
          await page.waitForFunction(id=>document.querySelector(`[data-shortage="${id}"]`)?.textContent.includes('Recebido na sua viatura: 5 L'),shortage.id);
          await page.unroute(`**/api/technician/chemical-shortages/${shortage.id}/deliveries`);
          assert.match(await deliveryCard.textContent(),/Falta receber: 20 L/);
          const deliveryReceipts=await prisma.operationalReminder.findMany({where:{sourceKey:{startsWith:'chemical-delivery:'},metadata:{path:['shortageId'],equals:shortage.id}}});
          assert.equal(deliveryReceipts.length,1);assert.equal(deliveryReceipts[0].metadata.quantity,5);
          assert.equal((await prisma.stockBalance.findFirst({where:{scope:'VEHICLE',vehicleId:vehicle.id,productName:'HIPOCLORITO DE SÓDIO'}})).quantity,8);
          assert.equal((await prisma.serviceVisit.findUnique({where:{id:visit.id}})).status,'INCOMPLETE');
          console.log('PASS mobile chemical reception with partial quantity, lost response retry and unchanged stock');
          const returnsContext=await browser.newContext({viewport:{width:1440,height:1000}});
          try{
            await returnsContext.addInitScript(({token,user})=>{for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(user));},{token:warehouseLogin.token,user:warehouseLogin.user});
            const returnPage=await returnsContext.newPage();await returnPage.goto(base+'/admin-alerts',{waitUntil:'networkidle'});
            const returnForm=returnPage.locator(`.chemical-return-form[data-movement="${deliveryReceipts[0].metadata.movementId}"]`);
            await returnForm.locator('input[name=quantity]').fill('5');
            if(process.env.CW_CAPTURE_UI)await returnPage.locator('#shortagePreparation').screenshot({path:'reports/field-ui/ADMIN_CHEMICAL_RETURN.png'});
            let droppedReturn=false;await returnPage.route('**/api/equipment-stock-os/stock/transfers',async route=>{if(!droppedReturn){droppedReturn=true;await route.fetch();await route.abort('failed');}else await route.continue();});
            returnPage.once('dialog',dialog=>dialog.accept());await returnForm.getByRole('button',{name:'Registar devolução'}).click();
            await returnPage.waitForFunction(()=>document.querySelector('.chemical-return-form [role=status]')?.textContent.includes('Pode repetir'));
            returnPage.once('dialog',dialog=>dialog.accept());await returnForm.getByRole('button',{name:'Registar devolução'}).click();
            await returnPage.waitForFunction(()=>document.getElementById('followupStatus').textContent.includes('Devolução registada'));
            assert.match(await returnPage.locator('#shortagePreparation').textContent(),/5 L devolvidos/);
          }finally{await returnsContext.close();}
          await page.locator('#shortageRefresh').click();
          await page.waitForFunction(id=>document.querySelector(`[data-shortage="${id}"]`)?.textContent.includes('Recebido na sua viatura: 3 L'),shortage.id);
          assert.match(await deliveryCard.textContent(),/Devolvido ao armazém: 5 L/);assert.match(await deliveryCard.textContent(),/Falta receber: 22 L/);
          assert.equal((await prisma.stockBalance.findFirst({where:{scope:'VEHICLE',vehicleId:vehicle.id,productName:'HIPOCLORITO DE SÓDIO'}})).quantity,3);
          assert.equal(await prisma.stockMovement.count({where:{vehicleId:vehicle.id,productName:'HIPOCLORITO DE SÓDIO',movementType:'RETURN_TO_WAREHOUSE'}}),1);
          assert.equal((await prisma.operationalReminder.findUnique({where:{id:deliveryReceipts[0].id}})).metadata.quantity,5);
          console.log('PASS warehouse return UI replay, technician net receipt and preserved original confirmation');


          await page.locator('[data-field-tab-button=agora]').click();

          assert.equal(await prisma.notification.count({where:{eventType:'VISIT_INCOMPLETE',metadata:{path:['visitId'],equals:visit.id}}}),1);
          await context.setOffline(true);
          const photoBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tAAAAABJRU5ErkJggg==','base64');
          await page.getByText('Câmara indisponível? Escolher do telemóvel',{exact:true}).click();
          assert.equal(await page.locator('#galleryPhotoInput').getAttribute('capture'),null);
          const chooserPromise=page.waitForEvent('filechooser');
          await page.locator('#galleryPhotoBtn').click();
          await (await chooserPromise).setFiles({name:'field.png',mimeType:'image/png',buffer:photoBytes});
          await page.waitForFunction(async id=>(await window.CWFieldPhotos.list(id)).length===1,visit.id);
          await page.locator('#pumpReminderMinutes').fill('1');
          await page.locator('#pumpReminderCreate').click();
          assert.equal(await page.locator('#pumpReminderBanner [data-pump-reminder]').count(),1);
          await page.locator('#finishBtn').click();
          await page.waitForFunction(id => Boolean(window.CWFieldOffline.pending(id)), visit.id);
          const pendingBody = await page.evaluate(id => Object.values(JSON.parse(localStorage.getItem(`cwFieldOutbox:${id}`)))[0].body, tech.id);
          assert.notEqual((await prisma.serviceVisit.findUnique({where:{id:visit.id}})).status,'DONE');
          await page.reload({waitUntil:'domcontentloaded',timeout:10000});
          await page.waitForFunction(() => document.querySelector('#nextTitle')?.textContent.includes('Piscina da Quinta'));
          assert.equal(await page.locator('#notes').inputValue(),'Rascunho guardado no campo');
          assert.equal(await page.evaluate(async id=>(await window.CWFieldPhotos.list(id))[0].file.size,visit.id),photoBytes.length);
          console.log('PASS technician offline reload preserves route and draft');
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Offline reload must not overflow horizontally');
          await page.locator('[data-field-tab-button=hoje]').click();
          await page.locator('#dayReviewBtn').click();
          await page.waitForFunction(()=>document.querySelector('#dayReviewResult').textContent.includes('fotografia(s) por enviar'));
          const dayReview=await page.locator('#dayReviewResult').textContent();
          assert.match(dayReview,/bomba em manual/);
          assert.match(dayReview,/conclusão por confirmar no servidor/);
          assert.match(dayReview,/Ronda sem confirmação atual/);
          const savedPump=await page.evaluate(id=>localStorage.getItem(`cwPumpReminders:${id}`),tech.id);
          await page.evaluate(id=>localStorage.setItem(`cwPumpReminders:${id}`,'{invalid'),tech.id);
          await page.locator('#dayReviewBtn').click();
          await page.waitForFunction(()=>document.querySelector('#dayReviewResult').textContent.includes('Não considere o dia conferido'));
          assert.equal(await page.evaluate(id=>localStorage.getItem(`cwPumpReminders:${id}`),tech.id),'{invalid');
          await page.evaluate(({id,value})=>localStorage.setItem(`cwPumpReminders:${id}`,value),{id:tech.id,value:savedPump});
          console.log('PASS day review identifies offline completion, pending photo and manual pump; unreadable data never appears clear');
          assert.equal(await page.locator('#pumpReminderBanner [data-pump-reminder]').count(),1);
          page.once('dialog',dialog=>dialog.accept());
          await page.getByRole('button',{name:'Já coloquei em automático'}).click();
          assert.match(await page.locator('#pumpReminderBanner').textContent(),/envio pendente/);
          await context.setOffline(false);
          await page.waitForFunction(()=>document.querySelector('#pumpReminderBanner').hidden);
          const pump=await prisma.operationalReminder.findFirst({where:{sourceKey:{startsWith:`pump:${tech.id}:`}}});
          assert(pump?.isCompleted,'Offline pump creation and return to automatic must both reach the server');
          console.log('PASS pump manual reminder survives offline reload and reconciles automatic confirmation');
          await page.waitForFunction(id=>!window.CWFieldOffline.pending(id),visit.id,{timeout:15000});
          const persisted=await prisma.serviceVisit.findUnique({where:{id:visit.id}});
          assert.equal(persisted.status,'DONE');
          assert.equal(persisted.notes,'Rascunho guardado no campo');
          assert.equal(persisted.basketCleaned,true);
          assert.equal(persisted.cleaned,false);
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
          assert.equal(await prisma.operationalReminder.count({where:{sourceKey:{startsWith:`incomplete:${visit.id}:`},isCompleted:false}}),0);
          assert.equal(await prisma.notification.count({where:{eventType:'VISIT_INCOMPLETE',status:'PENDING',metadata:{path:['visitId'],equals:visit.id}}}),0);
          console.log('PASS incomplete visit survives offline reload, notifies once and resolves follow-up only after actual completion');
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
          await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('cwFieldRoute:'))localStorage.removeItem(key)});
          await page.route('**/api/technician/today?*',route=>route.abort('failed'));
          await page.reload({waitUntil:'networkidle'});
          await page.waitForFunction(()=>!document.querySelector('#fieldLoadError').hidden);
          assert((await page.locator('#fieldLoadErrorText').innerText()).includes('Sem ronda guardada'));
          assert(await page.locator('#fieldReloadBtn').isVisible());
          await page.unroute('**/api/technician/today?*');
          await page.locator('#fieldReloadBtn').click();
          await page.waitForFunction(()=>document.querySelector('#fieldLoadError').hidden);
          console.log('PASS missing route cache shows a recoverable error and retry restores the route');
          await prisma.pool.update({where:{id:pool.id},data:{latitude:null,longitude:null,address:null,location:null,zone:null}});
          await context.clearPermissions();
          await page.reload({waitUntil:'networkidle'});
          await page.locator('[data-field-tab-button=hoje]').click();
          assert.equal(await page.locator('#navLink').getAttribute('href'),null);
          assert.equal(await page.locator('#navLink').getAttribute('aria-disabled'),'true');
          assert.match(await page.locator('#mapBox').textContent(),/Peça a localização ao escritório/);
          await prisma.pool.update({where:{id:pool.id},data:{address:'Rua de ensaio, Lagos'}});
          await page.reload({waitUntil:'networkidle'});
          await page.locator('[data-field-tab-button=hoje]').click();
          const mapUrl=new URL(await page.locator('#mapsLink').getAttribute('href'));
          assert.equal(mapUrl.searchParams.get('query'),'Rua de ensaio, Lagos');
          assert.equal(await page.locator('#mapsLink').getAttribute('aria-disabled'),null);
          console.log('PASS missing GPS and address prevents guessed navigation; address-only destination works without geolocation permission');



        }
      } catch(e) { const state=await page.evaluate(()=>({toast:document.querySelector('#toast')?.textContent,documents:document.querySelector('#documentCenterBox')?.innerText})).catch(()=>null); failures.push({persona:persona.name,error:e.message,stack:e.stack,state,errors,apiErrors});console.error('FAIL',persona.name,e.stack); }
      console.log('CLOSE',persona.name);
      await context.close();
      console.log('CLOSED',persona.name);
    }
    console.log(JSON.stringify({failures},null,2));
    if(failures.length)process.exitCode=1;
  } finally {clearTimeout(timer);await browser.close();await prisma.$disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
