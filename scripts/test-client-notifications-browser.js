const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let mode='ok',started,release, acknowledgements=0;const requests=[];
  page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/'))requests.push({path:url.pathname,method:request.method()});});
  await page.route('http://client.test/**',async route=>{
   if(new URL(route.request().url()).pathname==='/api/notifications/7/read'){
    acknowledgements++;assert.equal(route.request().method(),'POST');assert.equal(route.request().postData(),null);
    assert.equal(route.request().headers().authorization,'Bearer A');
    if(mode==='held'){started();await new Promise(r=>release=r);}
    return route.fulfill({status:mode==='offline'?503:200,contentType:'application/json',body:JSON.stringify({ok:mode!=='offline'})});
   }
   return route.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><meta name="viewport" content="width=device-width"><div id="notificationList"></div>'});
  });
  await page.goto('http://client.test/');
  await page.evaluate(()=>{localStorage.setItem('token','A');localStorage.setItem('cw_client_id','1');localStorage.setItem('cristalwater_user',JSON.stringify({id:1,clientId:1,role:'CLIENT'}));});
  // This isolated notification fixture has no chat composer. Real sender/portal
  // integration is covered by test-field-client-chat-recovery-ui.js.
  await page.evaluate(()=>{window.CWClientChat={create:()=>({active:()=>true,render(){},sendText(){throw Error('Unexpected chat send in notification test');}})};});
  await page.evaluate(()=>{window.CWClientPortalRequest={create:()=>({render(){},active:()=>true,send(){throw Error('Unexpected portal request in notification test');}})};});
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../frontend/client-portal.js'),'utf8')});
  async function render(){await page.evaluate(()=>{loadedClientId=clientId;portalLanguage='pt';renderNotifications([{id:7,isRead:false,title:'Manutenção concluída',message:'O relatório está disponível no portal.'}]);});}
  await render();await page.getByRole('button',{name:'Marcar como lida'}).click();await page.waitForFunction(()=>document.querySelector('.pill').textContent==='Lida');
  assert(await page.getByRole('button',{name:'Lida',exact:true}).isDisabled());console.log('PASS client explicitly confirms reading through the authenticated endpoint');
  mode='offline';await render();await page.getByRole('button',{name:'Marcar como lida'}).click();await page.getByRole('status').filter({hasText:'Tente novamente'}).waitFor();assert.equal(await page.locator('.pill').textContent(),'Por ler');assert(await page.getByRole('button',{name:'Marcar como lida'}).isEnabled());console.log('PASS failed delivery of acknowledgement preserves unread state and offers retry');
  mode='held';await render();const ready=new Promise(r=>started=r);await page.getByRole('button',{name:'Marcar como lida'}).click();await ready;
  await page.evaluate(()=>{clientId=2;++clientSelectionRevision;document.querySelector('#notificationList').textContent='Conta atual';});const received=page.waitForResponse('**/api/notifications/7/read');release();await (await received).finished();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.locator('#notificationList').textContent(),'Conta atual');
  await page.evaluate(()=>{isAdminUser=()=>true;renderNotifications([{id:7,isRead:false,title:'Consulta da gestão'}]);});assert.equal(await page.locator('#notificationList button').count(),0);console.log('PASS account changes and administrator preview cannot falsely confirm client reading');
  const languages=['pt','en','fr','es','de'],widths=[320,390,1280];
  const mark=['Marcar como lida','Mark as read','Marquer comme lue','Marcar como leída','Als gelesen markieren'],unread=['Por ler','Unread','Non lue','Sin leer','Ungelesen'],read=['Lida','Read','Lue','Leída','Gelesen'];
  const fallback=['Notificação','Notification','Notification','Notificación','Mitteilung'],empty=['Sem notificações recentes.','No recent notifications.','Aucune notification récente.','No hay notificaciones recientes.','Keine aktuellen Mitteilungen.'];
  const failed=['Não foi possível confirmar a leitura. Tente novamente.','Could not confirm reading. Please try again.','Impossible de confirmer la lecture. Réessayez.','No se pudo confirmar la lectura. Vuelve a intentarlo.','Lesebestätigung fehlgeschlagen. Bitte erneut versuchen.'];
  const literal={id:7,isRead:false,title:'Título literal <b>{mark}</b>',message:'Mensagem literal {read} <b>source</b>'};let cases=0,controls=0;
  async function setup(data=literal,admin=false){await page.evaluate(({data,admin})=>{clientId=1;++clientSelectionRevision;loadedClientId=clientId;isAdminUser=()=>admin;portalLanguage='es';window.qaNotice={...data};renderNotifications([qaNotice]);},{data,admin});}
  // A healthy Spanish response previously threw while reading labels.unread.
  await setup();assert.equal(await page.locator('.pill').textContent(),'Sin leer');assert.equal(await page.locator('[data-notice-read]').textContent(),'Marcar como leída');
  async function language(index){await page.evaluate(language=>{portalLanguage=language;portalExtrasLabels.paint();},languages[index]);}
  async function matrix(check){const before=requests.length;for(const width of widths){await page.setViewportSize({width,height:844});for(let index=0;index<languages.length;index++){
    await language(index);await check(index);assert.equal(requests.length,before,'Notification repaint must not read or acknowledge');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));cases++;
  }}await language(0);}
  async function saveNodes(){await page.evaluate(()=>{window.qaNoticeNodes=[...document.querySelectorAll('#notificationList article,#notificationList button,#notificationList .pill,#notificationList .service-title')];window.qaNoticeLeaves=qaNoticeNodes.map(item=>item.firstChild);});}
  const originalNodes=()=>page.evaluate(()=>qaNoticeNodes.every((item,index)=>item.isConnected&&item.firstChild===qaNoticeLeaves[index]));
  await page.locator('[data-notice-read]').focus();await saveNodes();
  await matrix(async index=>{assert.equal(await page.locator('.pill').textContent(),unread[index]);assert.equal(await page.locator('[data-notice-read]').textContent(),mark[index]);assert(await page.evaluate(()=>document.activeElement===document.querySelector('[data-notice-read]')));assert(await originalNodes());assert.equal(await page.locator('.service-title').textContent(),literal.title);assert((await page.locator('#notificationList').textContent()).includes(literal.message));assert.equal(await page.locator('#notificationList b').count(),0);});
  await setup({...literal,title:''});await matrix(async index=>assert.equal(await page.locator('.service-title').textContent(),fallback[index]));
  await page.evaluate(()=>renderNotifications([]));await matrix(async index=>assert.equal(await page.locator('#notificationList .empty').textContent(),empty[index]));
  await setup(literal,true);await matrix(async index=>{assert.equal(await page.locator('.pill').textContent(),unread[index]);assert.equal(await page.locator('[data-notice-read]').count(),0);});
  for(let index=0;index<languages.length;index++){
    mode='offline';await setup();await language(index);await page.locator('[data-notice-read]').click();await page.waitForFunction(()=>document.querySelector('#notificationList [role=status]').textContent.length>0);await saveNodes();
    await matrix(async next=>{assert.equal(await page.locator('[role=status]').textContent(),failed[next]);assert.equal(await page.locator('.pill').textContent(),unread[next]);assert(await page.locator('[data-notice-read]').isEnabled());assert(await originalNodes());assert.equal(await page.evaluate(()=>qaNotice.isRead),false);});controls++;
    mode='ok';await page.locator('[data-notice-read]').click();await page.waitForFunction(()=>qaNotice.isRead);await saveNodes();
    await matrix(async next=>{assert.equal(await page.locator('.pill').textContent(),read[next]);assert.equal(await page.locator('[data-notice-read]').textContent(),read[next]);assert(await page.locator('[data-notice-read]').isDisabled());assert(await originalNodes());assert.equal(await page.evaluate(()=>qaNotice.isRead),true);});controls++;
  }
  mode='held';await setup();const busyReady=new Promise(resolve=>started=resolve);await page.locator('[data-notice-read]').click();await busyReady;await saveNodes();
  await matrix(async index=>{assert.equal(await page.locator('[data-notice-read]').textContent(),mark[index]);assert.equal(await page.locator('.pill').textContent(),unread[index]);assert(await page.locator('[data-notice-read]').isDisabled());assert(await originalNodes());});mode='ok';release();await page.waitForFunction(()=>qaNotice.isRead);controls++;
  for(const kind of ['changed-leaf','replaced-text','foreign-clone']){
    await setup();await page.evaluate(kind=>{const button=document.querySelector('[data-notice-read]');if(kind==='changed-leaf')button.firstChild.nodeValue='Operador literal {mark}';else if(kind==='replaced-text')button.replaceChildren(document.createTextNode(button.textContent));else{const clone=button.cloneNode(true);clone.textContent='Foreign literal {mark}';clone.dataset.cwI18n='mark';button.replaceWith(clone);}window.qaForeign=document.querySelector('[data-notice-read]');window.qaForeignBytes=qaForeign.textContent;},kind);
    await matrix(async()=>assert(await page.evaluate(()=>document.querySelector('[data-notice-read]')===qaForeign&&qaForeign.textContent===qaForeignBytes)));controls++;
  }
  mode='ok';await setup();const beforeGuard=acknowledgements;
  await page.evaluate(()=>{loadedClientId=0;return markPortalNotificationRead(qaNotice,document.querySelector('[data-notice-read]'),document.querySelector('[role=status]'));});assert.equal(acknowledgements,beforeGuard);controls++;
  assert.equal(acknowledgements,14);console.log('PASS notification languages '+JSON.stringify({cases,controls,languages,widths,acknowledgements,originalReadEndpointAndEmptyBody:true,unreadRetainedUntilConfirmed:true,paintNoRequests:true,literalDataAndPrivateOwnership:true,originalCasesRetained:true}));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
