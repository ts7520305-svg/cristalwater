'use strict';
// Real entry HTML/script under Chromium; destination stubs isolate navigation from business pages.
// API authentication and real login/role journeys are checked by the existing companion groups.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright'),R=require('../frontend/cw-admin-legacy-entry');
const source=name=>fs.readFileSync(path.join(__dirname,'../frontend',name),'utf8'),origin='http://legacy-entry.test';
const token=claims=>Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.browser-fixture';
const work={'cwFieldOutbox:7':'[{"pending":true}]','cwPoolCalculator:v1:ADMIN:7':'{original-incomplete-bytes','cwFieldDocuments:v2:TECH:7':'original-guide','offline_visits':'unattributed-bytes','cw_language':'es'},drafts={'cwPoolCalculatorDraft:v1:ADMIN:7:3':'{original-draft'};
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});const cases=[
  {name:'legacy ADMIN',role:'ADMIN',target:'/admin-master-control?lang=fr'},
  {name:'canonical ADMIN',role:'ADMIN',canonical:true,target:'/admin-master-control?lang=fr'},
  {name:'CLIENT',role:'CLIENT',target:'/client-portal?lang=fr'},
  {name:'TECHNICIAN',role:'TECHNICIAN',target:'/technician-field-mode?lang=fr'},
  {name:'TEAM_LEADER',role:'TEAM_LEADER',target:'/technician-field-mode?lang=fr'},
  {name:'missing',missing:true,target:'/login?reason=no_session&lang=fr'},
  {name:'expired',role:'ADMIN',expired:true,target:'/login?reason=session_expired&lang=fr'},
  {name:'different identity',role:'ADMIN',other:true,target:'/login?reason=invalid_session&lang=fr'},
  {name:'conflicting token aliases',role:'ADMIN',conflict:true,target:'/login?reason=invalid_session&lang=fr'},
  {name:'storage unavailable',role:'ADMIN',storage:true,target:'/login?reason=guard_error'}
 ];
 let checked=0;
 const aliases=['/admin-command-center','/admin-core-flow','/admin-operational-flow','/client-wow','/splash','/admin-test-center'];assert.deepEqual(R.aliases,aliases);
 for(const alias of aliases)for(const item of cases){
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[],destinations=[],apiRequests=[];page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
  const claims={id:7,role:item.role,exp:item.expired?1:Math.floor(Date.now()/1000)+3600},credential=token(claims),user=JSON.stringify({id:item.other?8:7,role:item.role,name:'João'}),identity=item.missing?{}:item.canonical?{cristalwater_jwt:credential,cristalwater_user:user}:{token:credential,user};if(item.conflict)identity.adminToken=token({...claims,id:8});const expected={...work,...identity};
  await context.addInitScript(({origin,alias,expected,drafts,storage})=>{if(location.origin!==origin)return;if(location.pathname.replace(/\.html$/,'').replace(/\/$/,'')===alias){for(const [k,v] of Object.entries(expected))localStorage.setItem(k,v);for(const [k,v] of Object.entries(drafts))sessionStorage.setItem(k,v);if(storage){const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(this===localStorage)throw Error('QA unavailable');return get.call(this,k);};}}},{origin,alias,expected,drafts,storage:item.storage});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(url.pathname.startsWith('/api/'))apiRequests.push(url.pathname);if(url.pathname.replace(/\.html$/,'').replace(/\/$/,'')===alias)return route.fulfill({contentType:'text/html',body:source(alias.slice(1)+'.html')});if(url.pathname==='/cw-admin-legacy-entry.js')return route.fulfill({contentType:'application/javascript',body:source('cw-admin-legacy-entry.js')});if(url.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:''});if(route.request().isNavigationRequest())destinations.push(url.pathname+url.search);return route.fulfill({contentType:'text/html',body:'<!doctype html><p id="destination">Destination guard owns authentication</p>'});});
  const variant=checked%3===0?'.html':checked%3===1?'/':'';await page.goto(origin+alias+variant+'?lang=fr&clientId=999&returnTo=https%3A%2F%2Fbad.test&token=PRIVATE#untrusted',{waitUntil:'networkidle'});await page.waitForURL(origin+item.target);assert.deepEqual(destinations,[item.target],alias+' '+item.name);assert.deepEqual(apiRequests,[]);assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),expected);assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage))),drafts);await context.close();checked++;
 }
 // Actual client entry pages and guards: summary links must leave the menu and open the portal.
 const output=path.join(__dirname,'../reports/field-visual/legacy-entry');fs.mkdirSync(output,{recursive:true});
 for(const entry of ['/client-dashboard','/client-menu']){
  const name=entry.slice(1);
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await context.newPage(),credential=token({id:7,clientId:7,role:'CLIENT',exp:Math.floor(Date.now()/1000)+3600}),errors=[];page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({origin,credential,work,drafts})=>{if(location.origin!==origin)return;for(const [k,v] of Object.entries(work))localStorage.setItem(k,v);for(const [k,v] of Object.entries(drafts))sessionStorage.setItem(k,v);for(const key of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(key,credential);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:7,clientId:7,role:'CLIENT'}));},{origin,credential,work,drafts});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(url.pathname==='/'+name)return route.fulfill({contentType:'text/html',body:source(name+'.html')});const file=path.join(__dirname,'../frontend',url.pathname);if(/\.(js|css)$/.test(url.pathname)&&fs.existsSync(file))return route.fulfill({contentType:url.pathname.endsWith('.js')?'application/javascript':'text/css',body:fs.readFileSync(file)});if(url.pathname.startsWith('/api/'))return route.fulfill({contentType:'application/json',body:'{"ok":true}'});return route.fulfill({contentType:'text/html',body:'<!doctype html><p id="destination">Portal entry</p>'});});
  await page.goto(origin+'/'+name,{waitUntil:'networkidle'});assert.equal(await page.locator('body').getAttribute('data-required-role'),'CLIENT');const links=await page.locator('main .grid .card a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));assert.deepEqual(links,name==='client-dashboard'?['/client-portal','/client-payments','/client-notifications']:['/client-portal','/client-payments','/client-notifications','/client-history']);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert(await page.locator('main').evaluate(n=>n.scrollWidth<=n.clientWidth+1));await page.locator('main .grid .card').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,name+'-'+width+'.png')});}
  await page.locator('main .grid .card a').first().click();await page.waitForURL(origin+'/client-portal');assert.deepEqual(errors,[]);for(const [key,value] of Object.entries(work))assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),value);await context.close();
 }
 // No JavaScript must still leave a usable same-origin login link.
 for(const entry of ['/client-wow','/splash','/admin-test-center']){
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:700}}),page=await context.newPage();
  await context.route('**/*',route=>route.fulfill({contentType:route.request().resourceType()==='document'?'text/html':'text/css',body:route.request().resourceType()==='document'?source(entry.slice(1)+'.html'):''}));
  await page.goto(origin+entry);assert.equal(await page.locator('#legacyEntryLink').getAttribute('href'),'/login');assert(await page.locator('#legacyEntryLink').isVisible());assert((await page.locator('noscript').textContent()).includes('JavaScript'));assert(await page.locator('main').evaluate(n=>n.scrollWidth<=n.clientWidth+1));await context.close();
 }
 // The retained script for older cached HTML only forwards one supported language.
 for(const [query,target] of [['?lang=fr&clientId=999&token=PRIVATE&returnTo=https://bad.test','/client-portal?lang=fr'],['?lang=pt&lang=de','/client-portal'],['?lang=bad','/client-portal']]){
  const context=await browser.newContext(),page=await context.newPage();await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><a id="portalLink" href="/client-portal">Portal</a>'}));await page.goto(origin+'/client-wow'+query);await page.addScriptTag({content:source('client-wow.js')});assert.equal(await page.locator('#portalLink').getAttribute('href'),target);await context.close();
 }
 console.log('PASS client/splash fallback: login remains usable without JavaScript at 320px; old cached portal link strips arbitrary parameters and repeated/unknown languages');
 // Observe the real transient HTML while only the original deferred guard is held.
 const entryCopy={
  pt:['Cristal Water · Entrada','A abrir a área correspondente à sessão.','Continuar para a entrada'],
  en:['Cristal Water · Entry','Opening the area for your session.','Continue to sign in'],
  fr:['Cristal Water · Accès','Ouverture de l’espace correspondant à votre session.','Continuer vers la connexion'],
  es:['Cristal Water · Entrada','Abriendo el área correspondiente a su sesión.','Continuar al inicio de sesión'],
  de:['Cristal Water · Zugang','Der Bereich für Ihre Sitzung wird geöffnet.','Weiter zur Anmeldung']
 };
 const entryQueries=[...Object.keys(entryCopy).map(language=>({query:'?lang='+language,language})),...['','?lang=','?lang=xx','?lang=DE','?lang=pt&lang=de','?lang=constructor','?lang=%3Cb%3Ede%3C%2Fb%3E'].map(query=>({query,language:'pt'}))];
 let transientChecks=0;
 for(const {query,language} of entryQueries)for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[],apiRequests=[],destinations=[];page.setDefaultTimeout(6000);page.on('pageerror',error=>errors.push(error.message));
  const credential=token({id:7,clientId:7,role:'CLIENT',exp:Math.floor(Date.now()/1000)+3600}),user=JSON.stringify({id:7,clientId:7,role:'CLIENT',name:'João'}),stored={...work,token:credential,cristalwater_jwt:credential,adminToken:credential,user,cristalwater_user:user};
  await context.addInitScript(({origin,stored,drafts})=>{if(location.origin!==origin||location.pathname!=='/client-wow')return;for(const [key,value]of Object.entries(stored))localStorage.setItem(key,value);for(const [key,value]of Object.entries(drafts))sessionStorage.setItem(key,value);},{origin,stored,drafts});
  let release;
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
   if(url.pathname.startsWith('/api/'))apiRequests.push(url.pathname);
   if(url.pathname==='/client-wow')return route.fulfill({contentType:'text/html',body:source('client-wow.html')});
   if(url.pathname==='/cw-admin-legacy-entry.js'){await new Promise(resolve=>{release=resolve;});return route.fulfill({contentType:'application/javascript',body:source('cw-admin-legacy-entry.js')});}
   if(url.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:source(url.pathname.slice(1))});
   if(route.request().isNavigationRequest())destinations.push(url.pathname+url.search);
   return route.fulfill({contentType:'text/html',body:'<!doctype html><p id="destination">Destination guard owns authentication</p>'});
  });
  const search=query+(query?'&':'?')+'clientId=999&token=PRIVATE&returnTo=https%3A%2F%2Fbad.test';
  try{
   await page.goto(origin+'/client-wow'+search,{waitUntil:'commit'});await page.waitForFunction(()=>document.readyState==='interactive');
   assert.equal(await page.locator('html').getAttribute('lang'),language);assert.equal(await page.title(),entryCopy[language][0]);assert.equal(await page.locator('#legacyEntryStatus').textContent(),entryCopy[language][1]);assert.equal(await page.locator('#legacyEntryLink').textContent(),entryCopy[language][2]);
   assert.equal(await page.locator('h1').textContent(),'Cristal Water');assert.equal(await page.locator('body').getAttribute('data-required-role'),'CLIENT');assert.equal(await page.locator('#legacyEntryLink').getAttribute('href'),'/login');
   assert.equal(await page.locator('#legacyEntryStatus b,#legacyEntryLink b').count(),0);assert(await page.locator('main').evaluate(node=>node.scrollWidth<=node.clientWidth+1));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),stored);assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage))),drafts);assert.deepEqual(apiRequests,[]);assert.deepEqual(destinations,[]);
   if(language==='de'&&width===320&&query==='?lang=de'){const folder=process.env.CW_LEGACY_ENTRY_CAPTURE||output;fs.mkdirSync(folder,{recursive:true});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const cdp=await context.newCDPSession(page),capture=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(folder,'client-wow-de-320.png'),Buffer.from(capture.data,'base64'));await cdp.detach();}
   assert.equal(typeof release,'function');release();release=null;const destination=R.destination(R.keys.map(key=>stored[key]||null),search);await page.waitForURL(origin+destination);assert.deepEqual(destinations,[destination]);assert.deepEqual(apiRequests,[]);assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),stored);assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage))),drafts);transientChecks++;
  }finally{release?.();await context.close();}
 }
 assert.equal(transientChecks,36);console.log('PASS client entry transient copy: 36 real HTML cases, 108 texts, five languages and seven absent/rejected queries at 320/390/1440; unchanged deferred guard, native canonical destination, credentials and draft bytes');
 console.log('PASS legacy entry: '+checked+' actual alias HTML cases, extension/slash variants, four roles and identity/expiry/storage refusal, one fixed same-origin destination, only supported language forwarded, no API calls or stored-byte changes; two actual client menus open the portal without self-loop, 320/390/1440');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});
