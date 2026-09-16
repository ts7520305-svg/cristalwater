const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let mode='ok',started,release;
  await page.route('http://client.test/**',async route=>{
   if(new URL(route.request().url()).pathname==='/api/notifications/7/read'){
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
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../frontend/client-portal.js'),'utf8')});
  async function render(){await page.evaluate(()=>{loadedClientId=clientId;portalLanguage='pt';renderNotifications([{id:7,isRead:false,title:'Manutenção concluída',message:'O relatório está disponível no portal.'}]);});}
  await render();await page.getByRole('button',{name:'Marcar como lida'}).click();await page.waitForFunction(()=>document.querySelector('.pill').textContent==='Lida');
  assert(await page.getByRole('button',{name:'Lida',exact:true}).isDisabled());console.log('PASS client explicitly confirms reading through the authenticated endpoint');
  mode='offline';await render();await page.getByRole('button',{name:'Marcar como lida'}).click();await page.getByRole('status').filter({hasText:'Tente novamente'}).waitFor();assert.equal(await page.locator('.pill').textContent(),'Por ler');assert(await page.getByRole('button',{name:'Marcar como lida'}).isEnabled());console.log('PASS failed delivery of acknowledgement preserves unread state and offers retry');
  mode='held';await render();const ready=new Promise(r=>started=r);await page.getByRole('button',{name:'Marcar como lida'}).click();await ready;
  await page.evaluate(()=>{clientId=2;++clientSelectionRevision;document.querySelector('#notificationList').textContent='Conta atual';});const received=page.waitForResponse('**/api/notifications/7/read');release();await (await received).finished();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.locator('#notificationList').textContent(),'Conta atual');
  await page.evaluate(()=>{isAdminUser=()=>true;renderNotifications([{id:7,isRead:false,title:'Consulta da gestão'}]);});assert.equal(await page.locator('#notificationList button').count(),0);console.log('PASS account changes and administrator preview cannot falsely confirm client reading');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
