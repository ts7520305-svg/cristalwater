'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),{randomUUID}=require('node:crypto'),{fork}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
const {generate}=require('../src/business/client/ClientMonthlyReportBusiness');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true'||process.env.EMAIL_ENABLED!=='false'||process.env.EXTERNAL_NOTIFICATIONS_ENABLED!=='false')throw Error('Isolated QA required');
let browser,child,rule,rules=[];
(async()=>{
 const stamp=randomUUID(),month='2004-05',admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}}),user={id:admin.id,userId:admin.id,role:'ADMIN',principalType:'USER'},token=jwt.sign(user,getJwtSecret(),{expiresIn:'1h'});
 rules=await prisma.notificationRule.findMany({where:{eventType:'MONTHLY_REPORT'},select:{id:true,active:true}});await prisma.notificationRule.updateMany({where:{eventType:'MONTHLY_REPORT'},data:{active:false}});
 rule=await prisma.notificationRule.create({data:{eventType:'MONTHLY_REPORT',roles:'CLIENT',channels:'EMAIL',active:true,defaultEmail:true}});
 const fixtures=[];
 for(let i=0;i<8;i++){
  const client=await prisma.client.create({data:{name:i?'Cliente mensal '+i+' '+stamp:'Cliente <img src=x onerror=alert(1)> '+('Nome comprido '.repeat(5)),email:'monthly-ui-'+i+'-'+stamp+'@qa.invalid',active:true,status:'ACTIVE'}});
  await prisma.pool.create({data:{clientId:client.id,name:'Piscina principal '+i,active:true}});
  fixtures.push({client,report:await generate(client.id,month)});
 }
 child=fork(require.resolve('./fixtures/monthly-email-server'),[],{stdio:['ignore','ignore','inherit','ipc']});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('QA browser child timeout')),15000);child.once('message',m=>{clearTimeout(timer);resolve('http://127.0.0.1:'+m.port);});child.once('error',reject);});
 const configure=message=>new Promise(resolve=>{child.once('message',resolve);child.send(message);});
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await context.addInitScript(({user,token})=>{if(top!==window)return;window.CW_API_ORIGIN=location.origin;for(const key of ['cristalwater_jwt','token','adminToken'])localStorage.setItem(key,token);for(const key of ['cristalwater_user','user'])localStorage.setItem(key,JSON.stringify(user));localStorage.setItem('qaMailDraft','preserved');const timer=window.setTimeout;window.setTimeout=(fn,ms,...args)=>timer(fn,window.qaMailTimeout&&ms===20000?120:ms,...args);},{user,token});
 const page=await context.newPage(),errors=[],writes=[];page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>{if(req.method()==='POST'&&new URL(req.url()).pathname==='/api/admin/reports/send-now')writes.push(req.postDataJSON());});
 const state=expected=>page.waitForFunction(expected=>document.getElementById('mailStatus').dataset.state===expected,expected);
 const card=index=>page.locator('article[data-report-id="'+fixtures[index].report.id+'"]');
 async function load(){await page.locator('#mailLoad').click();await state('ready').catch(async error=>{console.error('Mail UI state',await page.locator('#mailStatus').textContent(),await page.locator('#mailStatus').getAttribute('data-state'),errors);throw error;});}
 async function select(){await page.locator('#reportMonth').fill(month);await load();}
 await page.goto(base+'/admin-reports',{waitUntil:'networkidle'});await select();
 assert.equal(await page.locator('#mailList article').count(),6);assert.equal(await page.locator('#mailList img').count(),0);assert.match(await card(0).textContent(),/img src=x/);
 assert(await card(0).locator('button').isDisabled());assert.match(await card(0).locator('pre').textContent(),/Mês: 2004-05/);
 const snapshot=await prisma.monthlyReport.findMany({where:{id:{in:fixtures.map(f=>f.report.id)}},orderBy:{id:'asc'}});
 const visual=path.resolve('reports/field-visual/monthly-email-'+Date.now());fs.mkdirSync(visual,{recursive:true});
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});await page.locator('#mailPanel').evaluate(node=>node.scrollIntoView({block:'start'}));
  const sizes=await page.locator('#mailPanel,#mailPanel article,#mailPanel pre,#mailPanel p,#mailPanel label,#mailPanel button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return {x:r.x,right:r.right,overflow:n.scrollWidth-n.clientWidth};}));
  assert(sizes.every(r=>r.x>=0&&r.right<=width+1&&r.overflow<=1),JSON.stringify({width,sizes}));
  await page.screenshot({path:path.join(visual,'review-'+width+'.png')});
  if(width===320){const confirm=card(0).locator('button');await confirm.scrollIntoViewIfNeeded();assert(await confirm.evaluate(n=>{const r=n.getBoundingClientRect();return r.height>=44&&n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));/* Flush Chromium's first scroll capture, then retain the repainted disabled control. */await page.screenshot();await page.waitForTimeout(400);await page.screenshot({path:path.join(visual,'confirmation-320.png')});}
 }
 await page.setViewportSize({width:390,height:900});await page.emulateMedia({colorScheme:'dark'});await page.locator('#mailPanel').evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(visual,'review-dark-390.png')});
 const contrast=await page.locator('#mailPanel h2,#mailPanel h3,#mailPanel p,#mailPanel pre,#mailPanel label').evaluateAll(nodes=>{
  const rgb=color=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number),light=color=>rgb(color).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  return nodes.filter(n=>n.getClientRects().length).map(n=>{let p=n,bg;while(p){bg=getComputedStyle(p).backgroundColor;if(!['transparent','rgba(0, 0, 0, 0)'].includes(bg))break;p=p.parentElement;}const a=light(getComputedStyle(n).color),b=light(bg||'rgb(255, 255, 255)');return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
 });assert(contrast.every(v=>v>=4.5),JSON.stringify(contrast));await page.emulateMedia({colorScheme:'light'});
 await card(0).locator('input').check();await page.locator('#mailNext').click();assert.equal(await page.locator('#mailList article').count(),2);await page.locator('#mailPrevious').click();assert(!await card(0).locator('input').isChecked());
 await configure({enabled:false});await page.locator('#mailLoad').click();await state('blocked');assert(await card(0).locator('button').isDisabled());assert.equal((await configure({enabled:true})).calls.length,0);await load();
 const shown=await card(0).locator('pre').textContent();await card(0).locator('input').check();await card(0).locator('button').evaluate(button=>{button.click();button.click();});
 await page.waitForFunction(id=>document.querySelector('article[data-report-id="'+id+'"]')?.textContent.includes('Aceite pelo serviço'),fixtures[0].report.id);await state('ready');
 assert.equal(writes.length,1);assert.equal((await configure({})).calls.length,1);assert.equal((await configure({})).calls[0].text,shown);assert.equal(await card(0).locator('button').count(),0);
 // The actual server accepts the message; the browser loses only its response.
 await page.route('**/api/admin/reports/send-now',async route=>{await route.fetch();await route.abort('failed');});
 await card(1).locator('input').check();await card(1).locator('button').click();await state('uncertain');assert.equal(await page.locator('#mailList article').count(),0);await page.unroute('**/api/admin/reports/send-now');await load();
 assert.match(await card(1).textContent(),/Aceite pelo serviço/);assert.equal(await card(1).locator('button').count(),0);assert.equal((await configure({})).calls.length,2);
 await prisma.client.update({where:{id:fixtures[2].client.id},data:{email:'changed-'+stamp+'@qa.invalid'}});await card(2).locator('input').check();await card(2).locator('button').click();await state('uncertain');assert.equal((await configure({})).calls.length,2);await load();assert.match(await card(2).textContent(),new RegExp('changed-'+stamp));assert(!await card(2).locator('input').isChecked());
 await configure({behavior:'rejected'});await card(3).locator('input').check();await card(3).locator('button').click();await page.waitForFunction(id=>document.querySelector('article[data-report-id="'+id+'"]')?.textContent.includes('Destinatário recusado'),fixtures[3].report.id);await state('ready');assert.equal(await card(3).locator('button').count(),0);
 await configure({behavior:'accepted',fault:'logUpdate'});await card(4).locator('input').check();await card(4).locator('button').click();await page.waitForFunction(id=>document.querySelector('article[data-report-id="'+id+'"]')?.textContent.includes('Envio reservado'),fixtures[4].report.id);await state('ready');await configure({fault:null});assert.equal(await card(4).locator('button').count(),0);
 await page.locator('#mailPanel').evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(visual,'outcomes-390.png')});
 assert.deepEqual(await prisma.monthlyReport.findMany({where:{id:{in:fixtures.map(f=>f.report.id)}},orderBy:{id:'asc'}}),snapshot);
 console.log('PASS real monthly email UI: review text/recipient/month, literal content, six-per-page, responsive/dark contrast, explicit confirmation, disabled email, double click, lost response, changed recipient, rejected provider and unrecorded result without repeat');
 const endpoint='**/api/admin/reports/email-preview?*';
 const good=await fetch(base+'/api/admin/reports/email-preview?monthRef='+month,{headers:{Authorization:'Bearer '+token}}).then(r=>r.json());
 for(const mutate of [b=>b.monthRef='2004-06',b=>b.rows.push(b.rows[0]),b=>b.deliveryConfirmed=true,b=>b.rows[5].to='unreviewed@qa.invalid']){
  const bad=structuredClone(good);mutate(bad);await page.route(endpoint,r=>r.fulfill({json:bad}));await page.locator('#mailLoad').click();await state('error');assert.equal(await page.locator('#mailList article').count(),0);await page.unroute(endpoint);
 }
 for(const response of [{status:503,json:{ok:false}},{status:202,json:good},{status:200,contentType:'text/html',body:'unavailable'}]){await page.route(endpoint,r=>r.fulfill(response));await page.locator('#mailLoad').click();await state('error');assert.equal(await page.locator('#mailList article').count(),0);await page.unroute(endpoint);}
 await load();await context.setOffline(true);assert(await page.locator('#mailLoad').isDisabled());assert(await card(5).locator('button').isDisabled());await context.setOffline(false);await load();
 async function delayed(work){let enter,release,finish;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r),done=new Promise(r=>finish=r);await page.route(endpoint,async route=>{enter();await gate;try{await route.fulfill({json:good});}finally{finish();}});await page.locator('#mailLoad').click();await entered;await work();release();await done;await page.unroute(endpoint);}
 await delayed(async()=>{await page.locator('#reportMonth').fill('2004-06');await state('idle');await page.locator('#reportMonth').fill(month);});await state('idle');assert.equal(await page.locator('#mailList article').count(),0);await load();
 await page.evaluate(()=>window.qaMailTimeout=true);await delayed(async()=>{await state('error');});await page.evaluate(()=>window.qaMailTimeout=false);await state('error');assert.equal(await page.locator('#mailList article').count(),0);await load();
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await state('idle');assert.equal(await page.locator('#mailList article').count(),0);await load();
 const fresh=await prisma.client.create({data:{name:'Missing monthly '+stamp,email:'new-'+stamp+'@qa.invalid',active:true,status:'ACTIVE'}}),callsBefore=(await configure({})).calls.length;
 await page.locator('#mailPrepare').click();await state('ready');assert.match(await page.locator('#mailStatus').textContent(),/Nenhum email foi enviado/);assert.equal(await prisma.monthlyReport.count({where:{month,clientId:fresh.id,type:'CLIENT'}}),1);assert.equal((await configure({})).calls.length,callsBefore);
 await delayed(async()=>{await page.evaluate(()=>{const saved=localStorage.getItem('cristalwater_user');localStorage.setItem('cristalwater_user',JSON.stringify({id:999999,role:'ADMIN'}));localStorage.setItem('cristalwater_user',saved);});await state('session');});await state('session');assert.equal(await page.locator('#mailList').textContent(),'');assert.equal(await page.evaluate(()=>localStorage.getItem('qaMailDraft')),'preserved');
 await page.reload({waitUntil:'networkidle'});await select();const other=await context.newPage();await other.goto(base+'/admin-reports',{waitUntil:'networkidle'});await other.evaluate(()=>localStorage.setItem('user','changed'));await state('session');assert.equal(await page.locator('#mailList').textContent(),'');assert.deepEqual(errors,[]);
 console.log('PASS malformed/partial/old/duplicate replies, unavailable source, offline, late A–B–A month/session responses, timeout, BFCache, cross-tab session, missing-report generation without emails and preserved local draft');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();child?.kill('SIGTERM');if(rule)await prisma.notificationRule.delete({where:{id:rule.id}});for(const old of rules)await prisma.notificationRule.update({where:{id:old.id},data:{active:old.active}});await prisma.$disconnect();});
