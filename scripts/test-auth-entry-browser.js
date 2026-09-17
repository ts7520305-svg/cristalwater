/* Real login scripts under Chromium: repeated input, password fidelity, invalid session and socket logout. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const source=file=>fs.readFileSync(path.join(__dirname,'../frontend',file),'utf8');
async function clientGuardCases(browser){
 // These unsigned fixtures exercise browser entry only; API signature/ownership tests run separately.
 const jwt=payload=>Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.browser-fixture';
 const client={id:7,clientId:7,role:'CLIENT',name:'Cliente João'},exp=Math.floor(Date.now()/1000)+3600;
 const work={'cwFieldOutbox:41':'[{"visitId":42,"pending":true}]','cwFieldDocuments:v2:TECH:41:TECHNICIAN:9:2026-09-17':'saved-guide','cwFieldAlertJournal:v2:USER:41:TEAM_LEADER:2026-09-17':'{unreadable-preserve','offline_visits':'legacy-unattributed-bytes','cw_language':'es'};
 const cases=[
  {name:'missing session',token:null,reason:'no_session'},
  {name:'malformed credential',token:'broken',reason:'invalid_token'},
  {name:'missing expiry',payload:{...client,exp:undefined},reason:'invalid_token'},
  {name:'expired session',payload:{...client,exp:1},reason:'session_expired',shared:true},
  {name:'malformed identity',userRaw:'{broken',reason:'invalid_session'},
  {name:'null identity',userRaw:'null',reason:'invalid_session'},
  {name:'different role',payload:{id:41,role:'TECHNICIAN',exp},reason:'invalid_session'},
  {name:'different client',payload:{...client,clientId:8,exp},reason:'invalid_session'},
  {name:'missing client identity',payload:{role:'CLIENT',exp},user:{role:'CLIENT'},reason:'invalid_session'},
  {name:'unknown role',user:{id:7,role:'UNKNOWN'},payload:{id:7,role:'UNKNOWN',exp},reason:'invalid_session'},
  {name:'valid legacy client',aliases:'legacy'},
  {name:'valid canonical client',aliases:'canonical',shared:true},
  {name:'valid settings page',route:'/settings',actual:true,shared:true},
  {name:'failed storage read',storage:'read',reason:'guard_error'},
  {name:'quota storing aliases',aliases:'canonical',storage:'quota',reason:'guard_error'},
  {name:'silent lost alias write',aliases:'canonical',storage:'noop',reason:'guard_error'},
  ...['TECHNICIAN','TEAM_LEADER','ADMIN'].map(role=>({name:'forbidden '+role,user:{id:41,role},payload:{id:41,role,exp},destination:role==='ADMIN'?'/admin-master-control':'/technician-field-mode'})),
  ...['/client-portal','/client-portal.html','/client-portal/'].map(route=>({name:'administrator preview '+route,route,user:{id:1,role:'ADMIN'},payload:{id:1,role:'ADMIN',exp}})),
  ...['/client_chat','/client_chat.html'].map(route=>({name:'administrator chat '+route,route,user:{id:1,role:'ADMIN'},payload:{id:1,role:'ADMIN',exp},destination:'/chat'})),
 ];
 for(const item of cases){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push(error.message));
  const route=item.route||'/client-payments',expected=item.reason?'/client-login?reason='+item.reason:item.destination||route;
  const token=item.token===undefined?jwt(item.payload||{...client,exp}):item.token,userRaw=item.userRaw===undefined?JSON.stringify(item.user||client):item.userRaw;
  const identity={adminToken:'old-admin-credential',cw_client_id:'999',clientId:'999'};
  if(item.aliases!=='legacy'){if(token)identity.cristalwater_jwt=token;identity.cristalwater_user=userRaw;}
  if(item.aliases!=='canonical'){if(token)identity.token=token;identity.user=userRaw;}
  await context.route('http://guard.test/**',request=>{
   const url=new URL(request.request().url());
   if(url.pathname==='/client-auth-guard.js')return request.fulfill({contentType:'application/javascript',body:source('client-auth-guard.js')});
   if(url.pathname==='/cw-auth.js'&&item.shared)return request.fulfill({contentType:'application/javascript',body:source('cw-auth.js')});
   if(url.pathname.startsWith('/api/'))return request.fulfill({json:{ok:true,settings:[]}});
   if(/\.(?:js|css)$/.test(url.pathname))return request.fulfill({contentType:url.pathname.endsWith('.js')?'application/javascript':'text/css',body:''});
   let body='<body>Destination</body>';
   if(url.pathname===route)body=item.actual?source('settings.html'):'<html><head>'+(item.shared?'<script src="/cw-auth.js"></script>':'')+'<script src="/client-auth-guard.js"></script></head><body><p id="protected">Client</p><script>const user = {}; window.pageReady = true;</script></body></html>';
   return request.fulfill({contentType:'text/html',body});
  });
  await page.goto('http://guard.test/seed');
  await page.evaluate(seed=>{for(const [key,value]of Object.entries(seed))localStorage.setItem(key,value);},{...work,...identity});
  if(item.storage)await page.addInitScript(({route,mode})=>{
   if(location.pathname!==route)return;
   const originalGet=Storage.prototype.getItem,originalSet=Storage.prototype.setItem;
   Storage.prototype.getItem=function(key){if(mode==='read'&&key==='cristalwater_jwt')throw new DOMException('Unavailable','SecurityError');return originalGet.call(this,key);};
   Storage.prototype.setItem=function(key,value){if(key==='token'){if(mode==='quota')throw new DOMException('Full','QuotaExceededError');if(mode==='noop')return;}return originalSet.call(this,key,value);};
  },{route,mode:item.storage});
  await page.goto('http://guard.test'+route);await page.waitForURL('http://guard.test'+expected);
  if(expected===route){
   if(item.actual)await page.locator('#list input').first().waitFor();else await page.waitForFunction(()=>window.pageReady===true);
   assert.notEqual(await page.evaluate(()=>document.documentElement.style.visibility),'hidden',item.name);
   const aliases=await page.evaluate(()=>['token','cristalwater_jwt','user','cristalwater_user'].map(key=>localStorage.getItem(key)));
   assert.equal(aliases[0],token,item.name);assert.equal(aliases[1],token,item.name);assert.deepEqual(JSON.parse(aliases[2]),JSON.parse(aliases[3]));
   if((item.user||client).role==='CLIENT')assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('cw_client_id'),localStorage.getItem('clientId')]),['7','7']);
  }else if(item.reason){
   assert.deepEqual(await page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),['token','cristalwater_jwt','user','cristalwater_user','adminToken','cw_client_id','clientId']),Array(7).fill(null),item.name);
  }else{
   assert.equal(await page.evaluate(()=>localStorage.getItem('token')),token,item.name+' must keep the valid session');
  }
  assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),Object.keys(work)),work,item.name+' must preserve every work byte');
  assert.deepEqual(errors,[],item.name);await context.close();
 }
 console.log('PASS client guard: '+cases.length+' entry cases, preserved drafts/documents/corrupt legacy bytes, expiry/identity validation, storage failure, administrator preview/chat and real settings script');
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CW_CHROMIUM_PATH?{executablePath:process.env.CW_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  await clientGuardCases(browser);
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
  const admin=await browser.newPage();admin.setDefaultTimeout(5000);let adminLogoutNavigation=0;const adminErrors=[];
  admin.on('pageerror',error=>adminErrors.push(error.message));
  const adminWork={'cwFieldOutbox:41':'pending-field-work','cwFieldDocuments:qa':'saved-guide','offline_visits':'unattributed-legacy-bytes','cw_language':'pt'};
  await admin.addInitScript(work=>{
   if(location.pathname!=='/admin-visits-dashboard')return;
   const user=JSON.stringify({id:1,role:'ADMIN'}),token=btoa('{"alg":"HS256"}')+'.'+btoa(JSON.stringify({id:1,role:'ADMIN',exp:Math.floor(Date.now()/1000)+3600}))+'.browser-fixture';
   for(const key of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(key,token);
   for(const key of ['user','cristalwater_user'])localStorage.setItem(key,user);
   localStorage.setItem('clientId','7');localStorage.setItem('cw_client_id','7');
   for(const [key,value]of Object.entries(work))localStorage.setItem(key,value);
   Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{register:async()=>({}),getRegistration:()=>new Promise(resolve=>{window.finishAdminLogout=()=>resolve(null);})}});
  },adminWork);
  await admin.route('http://admin.test/**',route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/login'){adminLogoutNavigation++;return route.fulfill({contentType:'text/html',body:'<p>Login</p>'});}
   if(pathname==='/admin-visits-dashboard')return route.fulfill({contentType:'text/html',body:source('admin-visits-dashboard.html')});
   if(['/cw-auth.js','/admin-auth-guard.js','/admin-visits-dashboard.js'].includes(pathname))return route.fulfill({contentType:'application/javascript',body:source(pathname.slice(1))});
   if(pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,visits:[]}});
   return route.fulfill({contentType:pathname.endsWith('.css')?'text/css':'application/javascript',body:''});
  });
  await admin.goto('http://admin.test/admin-visits-dashboard');await admin.locator('#visits').getByRole('heading',{name:'Sem visitas'}).waitFor();
  const adminLogout=admin.locator('#logoutBtn');await adminLogout.click();assert(await adminLogout.isDisabled());assert.equal(await adminLogout.getAttribute('aria-busy'),'true');
  await adminLogout.dispatchEvent('click');assert.equal(adminLogoutNavigation,0);
  await admin.evaluate(()=>window.finishAdminLogout());await admin.waitForURL('**/login');assert.equal(adminLogoutNavigation,1);
  assert.deepEqual(await admin.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),Object.keys(adminWork)),adminWork);
  assert.deepEqual(await admin.evaluate(()=>['token','cristalwater_jwt','adminToken','user','cristalwater_user','clientId','cw_client_id'].map(key=>localStorage.getItem(key))),Array(7).fill(null));
  assert.deepEqual(adminErrors,[]);await admin.close();
  console.log('PASS actual administrative visits page: shared logout, disabled repeated action, awaited cleanup, session removed and all saved work preserved');
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
