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
 const aliases=['/admin-command-center','/admin-core-flow','/admin-operational-flow'];assert.deepEqual(R.aliases,aliases);
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
 console.log('PASS legacy entry: '+checked+' actual alias HTML cases, extension/slash variants, four roles and identity/expiry/storage refusal, one fixed same-origin destination, only supported language forwarded, no API calls or stored-byte changes; two actual client menus open the portal without self-loop, 320/390/1440');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});
