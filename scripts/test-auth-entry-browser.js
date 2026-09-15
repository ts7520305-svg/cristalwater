/* Real login scripts under Chromium: repeated input, password fidelity, invalid session and socket logout. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const source=file=>fs.readFileSync(path.join(__dirname,'../frontend',file),'utf8');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CW_CHROMIUM_PATH?{executablePath:process.env.CW_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const file of ['login.js','admin-login.js','client-login.js','technician-login.js']){
   const page=await browser.newPage();let held;const bodies=[];const logs=[];page.on('console',msg=>logs.push(msg.text()));
   await page.route('http://localhost/**',route=>{
    if(new URL(route.request().url()).pathname.startsWith('/api/')){bodies.push(route.request().postDataJSON());held=route;return;}
    return route.fulfill({contentType:'text/html',body:'<div id="loginBox"><input id="email"><input id="password"><input id="pin"><button id="loginBtn">Entrar</button><p id="error"></p><p id="loginError"></p></div><div id="sessionBox"></div><p id="welcome"></p>'});
   });
   await page.goto('http://localhost/'+file.replace('.js','.html'));
   await page.addScriptTag({content:source(file)});
   await page.locator('#email').fill(' user@example.test ');await page.locator('#password').fill(' space password ');await page.locator('#pin').fill('1234');
   await page.evaluate(()=>{login();login();login();});
   await page.waitForFunction(()=>document.querySelector('#loginBtn').disabled);
   await page.waitForTimeout(50);assert.equal(bodies.length,1,file+' must serialize login');
   if(file!=='technician-login.js')assert.equal(bodies[0].password,' space password ');
   await held.fulfill({status:401,json:{ok:false,error:'Credenciais inválidas',message:'Credenciais inválidas'}});
   await page.waitForFunction(()=>!document.querySelector('#loginBtn').disabled);
   await page.evaluate(()=>{void login();});await page.waitForTimeout(50);assert.equal(bodies.length,2,'Retry must work');
   await held.fulfill({status:200,json:{ok:true,token:'private-test-token',user:{id:1,role:'UNKNOWN'}}});
   await page.waitForTimeout(50);
   assert(!logs.some(log=>log.includes('private-test-token')),'Credential must never reach console');
   if(file==='login.js'||file==='admin-login.js')assert.equal(await page.evaluate(()=>localStorage.getItem('token')),null,'Invalid role must not create session');
   await page.close();console.log('PASS '+file+' repeated login, retry, exact password and no token logging');
  }
  const context=await browser.newContext();const page=await context.newPage();
  await context.route('http://localhost/**',route=>route.fulfill({contentType:new URL(route.request().url()).pathname.endsWith('.js')?'application/javascript':'text/html',body:new URL(route.request().url()).pathname.endsWith('.js')?'':'<body></body>'}));
  await page.goto('http://localhost/client-login.html');
  await page.addScriptTag({content:source('cw-auth.js')});
  assert.equal(await page.evaluate(()=>CristalAuth.requireAuth()),true,'HTML public login must stay public');
  await page.evaluate(async()=>{
   window.disconnected=0;window.io=()=>({disconnect(){disconnected++;}});
   await CristalAuth.persistSession('account-a-token',{id:1,role:'CLIENT'});io();
   localStorage.setItem('cwFieldOutbox:41','keep-field-work');
   await CristalAuth.persistSession('account-b-token',{id:2,role:'CLIENT'});
  });
  assert.equal(await page.evaluate(()=>disconnected),1,'Switch account must disconnect previous private socket');
  await page.evaluate(async()=>{io();localStorage.setItem('clientId','2');localStorage.setItem('cw_client_id','2');await CristalAuth.clearSession();});
  assert.equal(await page.evaluate(()=>disconnected),2,'Logout disconnects live notifications');
  assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('token'),localStorage.getItem('clientId'),localStorage.getItem('cw_client_id'),localStorage.getItem('cwFieldOutbox:41')]),[null,null,null,'keep-field-work']);
  await page.evaluate(async()=>{await CristalAuth.persistSession('account-a-token',{id:1,role:'CLIENT'});io();});
  const other=await context.newPage();await other.goto('http://localhost/login');await other.evaluate(()=>localStorage.removeItem('cristalwater_jwt'));
  await page.waitForFunction(()=>disconnected===3);
  console.log('PASS HTML login, account switch and cross-tab session change disconnect private sockets; logout preserves field outbox');
  await context.close();
  const field=await browser.newPage({viewport:{width:320,height:844}});let logoutNavigation=0;
  await field.addInitScript(()=>{
   if(location.pathname!=='/technician-field-mode')return;
   localStorage.setItem('cristalwater_jwt','field-account-token');
   localStorage.setItem('cristalwater_user',JSON.stringify({id:41,role:'TECHNICIAN'}));
   localStorage.setItem('cwFieldOutbox:41','pending-field-work');localStorage.setItem('cw_language','es');
   Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:()=>new Promise(resolve=>{window.finishLogout=()=>resolve(null);})}});
  });
  await field.route('http://field.test/**',route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/login'){logoutNavigation++;return route.fulfill({contentType:'text/html',body:'<p>Login</p>'});}
   if(pathname==='/technician-field-mode')return route.fulfill({contentType:'text/html',body:source('technician-field-mode.html')});
   if(['/cw-auth.js','/cw-i18n.js'].includes(pathname))return route.fulfill({contentType:'application/javascript',body:source(pathname.slice(1))});
   if(pathname.endsWith('.css')){const css=path.join(__dirname,'../frontend',pathname.slice(1));return route.fulfill({contentType:'text/css',body:fs.existsSync(css)?fs.readFileSync(css,'utf8'):''});}
   if(pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,language:'es'}});
   return route.fulfill({contentType:'application/javascript',body:''});
  });
  await field.goto('http://field.test/technician-field-mode');
  await field.waitForFunction(()=>document.querySelector('#cwLanguageSelect')?.value==='es');
  const logoutButton=field.locator('#fieldLogoutBtn');assert(await logoutButton.isVisible());
  const logoutBounds=await logoutButton.boundingBox(),languageBounds=await field.locator('#cwLanguageSelect').boundingBox(),networkBounds=await field.locator('#connectionState').boundingBox();
  for(const bounds of [logoutBounds,languageBounds]){assert(bounds.x>=0&&bounds.x+bounds.width<=320);assert(bounds.y>=networkBounds.y+networkBounds.height,'Header actions must not cover network state');}
  assert(logoutBounds.height>=44);assert(logoutBounds.x+logoutBounds.width<=languageBounds.x||languageBounds.x+languageBounds.width<=logoutBounds.x||logoutBounds.y+logoutBounds.height<=languageBounds.y||languageBounds.y+languageBounds.height<=logoutBounds.y);
  await logoutButton.click();assert(await logoutButton.isDisabled());assert.equal(await logoutButton.getAttribute('aria-busy'),'true');
  await field.evaluate(()=>document.querySelector('#fieldLogoutBtn').click());
  assert.equal(logoutNavigation,0);await field.evaluate(()=>window.finishLogout());await field.waitForURL('**/login');assert.equal(logoutNavigation,1);
  assert.equal(await field.evaluate(()=>localStorage.getItem('cwFieldOutbox:41')),'pending-field-work');assert.equal(await field.evaluate(()=>localStorage.getItem('cristalwater_jwt')),null);
  await field.close();console.log('PASS actual technician page: visible logout, 320px Spanish header, no network overlap, busy guard and preserved pending work');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
