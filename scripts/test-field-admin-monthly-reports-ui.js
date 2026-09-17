'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));let browser;
(async()=>{
 const stamp=Date.now(),monthRef='2098-06',nextMonth='2098-07',admin=await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}}),user={id:admin.id,userId:admin.id,role:'ADMIN',principalType:'USER'},token=jwt.sign(user,getJwtSecret(),{expiresIn:'1h'});
 const client=await prisma.client.create({data:{name:'QA report UI '+stamp,active:false}});
 const invoice=await prisma.invoice.create({data:{clientId:client.id,monthRef,status:'PARTIAL',total:93.4,amount:93.4,totalAmount:93.4,amountPaid:15.9,amountOpen:77.5}});
 await prisma.payment.createMany({data:[{invoiceId:invoice.id,amount:12.34,method:'CASH',paidAt:new Date('2098-06-30T23:59:59.999Z')},{invoiceId:invoice.id,amount:3.56,method:'CASH',paidAt:new Date('2098-07-01T00:00:00Z')},{invoiceId:invoice.id,amount:500,method:'CREDIT',paidAt:new Date('2098-06-15T00:00:00Z')}]});
 await prisma.monthlyReport.createMany({data:[{month:monthRef,type:'ADMIN',data:{}},{month:monthRef,type:'CLIENT',clientId:client.id,data:{}},{month:nextMonth,type:'ADMIN',data:{}}]});
 const channel='<img src=x onerror=alert(1)> '+('CanalMuitoLongo'.repeat(12));
 await prisma.communicationLog.createMany({data:[...Array.from({length:6},(_,i)=>({channel:i?'EMAIL':'PORTAL',message:'QA_PRIVATE_CHANNEL_BODY',createdAt:new Date('2098-06-01T00:00:00Z')})),{channel,message:'QA_PRIVATE_CHANNEL_BODY',createdAt:new Date('2098-06-30T23:59:59.999Z')},{channel:'JULY_ONLY',message:'QA_PRIVATE_CHANNEL_BODY',createdAt:new Date('2098-07-01T00:00:00Z')}]});
 const data={};for(const section of ['financial','reports','communications']){const r=await fetch(base+'/api/admin/reports/summary?'+new URLSearchParams({monthRef,section}),{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);data[section]=await r.json();}
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 await context.addInitScript(({user,token})=>{
  if(top!==window)return;
  for(const key of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(user));localStorage.setItem('cw_language','pt');localStorage.setItem('qaReportDraft','preserved');
  const later=window.setTimeout;window.setTimeout=(fn,ms,...args)=>later(fn,window.qaTimeout&&ms===20000?120:ms,...args);
 },{user,token});
 const page=await context.newPage(),errors=[],requests=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/admin/reports/summary')requests.push({method:request.method(),month:url.searchParams.get('monthRef'),section:url.searchParams.get('section')});});
 const state=s=>page.waitForFunction(s=>document.getElementById('reportsStatus').dataset.state===s,s);
 const metric=key=>page.locator('[data-metric="'+key+'"]');
 async function refresh(){await page.locator('#refreshReports').click();}
 await page.goto(base+'/admin-reports',{waitUntil:'networkidle'});await page.waitForFunction(()=>['ready','review'].includes(document.getElementById('reportsStatus').dataset.state));
 assert.equal(await page.locator('#reportMonth').inputValue(),new Date().toISOString().slice(0,7));
 await page.locator('#reportMonth').fill(monthRef);await state('idle');assert.equal(await page.locator('#financial').textContent(),'');requests.length=0;await refresh();await state('ready');
 assert.deepEqual(new Set(requests.map(r=>r.section)),new Set(['financial','reports','communications']));assert(requests.every(r=>r.method==='GET'&&r.month===monthRef));
 assert.match(await metric('cash').textContent(),/12,34/);assert.match(await metric('documentsOpen').textContent(),/77,50/);assert.match(await metric('documentsAmount').textContent(),/93,40/);assert.equal(await metric('payments').textContent(),'1');assert.equal(await metric('adminReports').textContent(),'1');assert.equal(await metric('clientReports').textContent(),'1');assert.equal(await metric('communications').textContent(),'7');
 assert.equal(await page.locator('#communications li').count(),5);assert.match(await page.locator('#communications').textContent(),/Últimos 5 de 7/);assert.match(await page.locator('#communications').textContent(),/img src=x/);assert.equal(await page.locator('#communications img').count(),0);assert.doesNotMatch(await page.locator('main').textContent(),/JULY_ONLY|QA_PRIVATE/);
 assert.match(await page.locator('#financial').textContent(),/não o fecho histórico/);assert.match(await page.locator('#communications').textContent(),/Não confirmam entrega/);
 const visual=path.join(__dirname,'../reports/field-visual/admin-monthly-reports-'+stamp);fs.mkdirSync(visual,{recursive:true});
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
  const layout=await page.locator('.reports-main,.reports-main input,.reports-main select,.reports-main button:not([hidden]),.reports-main .panel,.reports-main dd,.reports-main li').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{x:r.x,right:r.right,overflow:node.scrollWidth-node.clientWidth};}));
  assert(layout.every(r=>r.x>=0&&r.right<=width+1&&r.overflow<=1),JSON.stringify({width,layout}));
  assert(await page.locator('.reports-main section').evaluateAll(nodes=>nodes.every(node=>{const title=node.querySelector('h2').getBoundingClientRect(),status=node.querySelector('.section-status').getBoundingClientRect(),content=node.querySelector('div').getBoundingClientRect();return title.bottom<=status.top+1&&status.bottom<=content.top+1;})));
  assert.equal(await page.locator('.reports-main .loading,.reports-main .cw-v2-state-loading').count(),0);
  await page.screenshot({path:path.join(visual,'ready-'+width+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:390,height:900});
 for(const colorScheme of ['dark','light']){
  await page.emulateMedia({colorScheme});
  const contrast=await page.locator('.reports-main .panel h2,.reports-main .panel p,.reports-main .panel dt,.reports-main .panel dd,.reports-main .field').evaluateAll(nodes=>{
   const rgb=color=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number),light=color=>rgb(color).map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
   return nodes.map(node=>{let parent=node,bg;while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')break;parent=parent.parentElement;}const a=light(getComputedStyle(node).color),b=light(bg||'rgb(255, 255, 255)');return(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);});
  });
  assert(contrast.every(value=>value>=4.5),JSON.stringify({colorScheme,contrast}));
  if(colorScheme==='dark')await page.screenshot({path:path.join(visual,'ready-dark-390.png'),fullPage:true});
 }
 await page.locator('#reportMonth').fill(nextMonth);await refresh();await state('ready');assert.match(await metric('cash').textContent(),/3,56/);assert.match(await metric('documentsOpen').textContent(),/0,00/);assert.match(await page.locator('#communications').textContent(),/JULY_ONLY/);assert.equal(await metric('communications').textContent(),'1');
 await page.locator('#reportMonth').fill('2199-12');await refresh();await state('ready');assert.match(await metric('cash').textContent(),/0,00/);assert.equal(await metric('communications').textContent(),'0');assert.match(await page.locator('#communications').textContent(),/Sem registos/);
 await page.locator('#reportMonth').fill(monthRef);await refresh();await state('ready');
 console.log('PASS actual ADMIN report: month transport and current UTC default, real monthly cash/current document balances, saved report types, literal channels/latest five, explicit provenance, separate months, true empty and three responsive widths');
 const endpoint='**/api/admin/reports/summary?*';let failing=new Set(['financial']),statusCode=503,mutations={};
 await page.route(endpoint,route=>{const section=new URL(route.request().url()).searchParams.get('section');if(failing.has(section))return route.fulfill({status:statusCode,json:{ok:false,error:'QA unavailable'}});if(mutations[section])return route.fulfill({status:200,json:mutations[section]});return route.continue();});
 await refresh();await state('partial');assert.equal(await page.locator('#financial').textContent(),'');assert.equal(await metric('communications').textContent(),'7');assert.equal(await metric('adminReports').textContent(),'1');assert(await page.locator('[data-report-retry=financial]').isVisible());
 failing.clear();requests.length=0;await page.locator('[data-report-retry=financial]').click();await state('ready');assert.deepEqual(requests.map(r=>r.section),['financial']);assert.match(await metric('cash').textContent(),/12,34/);
 failing=new Set(['financial','reports','communications']);await refresh();await state('error');assert.equal(await page.locator('#financial,#reports,#communications').allTextContents().then(a=>a.join('')),'');
 for(const section of failing)assert(await page.locator('[data-report-retry='+section+']').isVisible());
 failing.clear();await refresh();await state('ready');
 const bad=[];
 function malformed(section,edit){const payload=structuredClone(data[section]);edit(payload);bad.push([section,payload]);}
 malformed('financial',d=>d.monthRef=nextMonth);malformed('financial',d=>d.complete=false);malformed('financial',d=>delete d.data.cash.amountCents);malformed('financial',d=>d.data.cash.amountCents='12.34');malformed('financial',d=>d.data.basis.historicalClosingBalance=true);malformed('financial',d=>d.data.documents.total++);
 malformed('reports',d=>d.data.total++);malformed('communications',d=>d.data.latest[0].createdAt='2098-07-01T00:00:00.000Z');malformed('communications',d=>d.data.latest[1]=d.data.latest[0]);malformed('communications',d=>d.data.deliveryConfirmed=true);
 for(const [section,payload] of bad){mutations={[section]:payload};await refresh();await state('partial');assert.equal(await page.locator('#'+section).textContent(),'');assert(await page.locator('[data-report-retry='+section+']').isVisible());}
 mutations={};failing=new Set(['financial']);statusCode=202;await refresh();await state('partial');assert.equal(await page.locator('#financial').textContent(),'');failing.clear();statusCode=503;
 const review=structuredClone(data.financial);review.data.cash.amountCents=null;review.data.cash.invalidAmountCount=1;mutations={financial:review};await refresh();await state('review');assert.equal(await metric('cash').textContent(),'Por rever');assert.match(await metric('documentsOpen').textContent(),/77,50/);
 mutations={};await page.unroute(endpoint);await refresh();await state('ready');
 await page.route(endpoint,route=>route.fulfill({status:200,contentType:'text/html',body:'<html>unavailable</html>'}));await refresh();await state('error');assert.equal(await page.locator('#financial').textContent(),'');await page.unroute(endpoint);
 await context.setOffline(true);await refresh();await state('error');assert.equal(await page.locator('#financial').textContent(),'');await context.setOffline(false);await refresh();await state('ready');
 for(const invalid of ['', '1999-02']){await page.locator('#reportMonth').fill(invalid);requests.length=0;await refresh();await state('error');assert.equal(requests.length,0);assert.equal(await page.locator('#financial').textContent(),'');}
 await page.locator('#reportMonth').fill(monthRef);await refresh();await state('ready');
 await page.setViewportSize({width:320,height:900});await page.route(endpoint,route=>route.fulfill({status:503,json:{ok:false}}));await refresh();await state('error');
 for(const section of ['financial','reports','communications']){
  const retry=page.locator('[data-report-retry='+section+']');await retry.scrollIntoViewIfNeeded();assert(await retry.evaluate(node=>{const r=node.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.height>=44&&node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
 }
 await page.screenshot({path:path.join(visual,'failure-320.png'),fullPage:true});await page.unroute(endpoint);await refresh();await state('ready');
 console.log('PASS independent failed-source recovery, all-source outage without zeros, malformed/partial/old-month/duplicate/contradictory replies, unknown versus zero, HTML response, offline/reconnect, invalid period and visible mobile retry controls');
 async function delayed(work){
  let enter,release,finish;const arrived=new Promise(r=>enter=r),gate=new Promise(r=>release=r),handled=new Promise(r=>finish=r);
  await page.route(endpoint,async route=>{const section=new URL(route.request().url()).searchParams.get('section');if(section!=='financial')return route.continue();enter();await gate;try{await route.fulfill({json:data.financial});}finally{finish();}});
  await refresh();await arrived;await work();release();await handled;await page.unroute(endpoint);
 }
 await delayed(async()=>{await page.locator('#reportMonth').fill(nextMonth);await state('idle');});await state('idle');assert.equal(await page.locator('#financial').textContent(),'');
 await page.locator('#reportMonth').fill(monthRef);await refresh();await state('ready');
 await delayed(async()=>{await page.locator('#reportMode').selectOption('communications');await state('ready');});assert(await page.locator('#financialPanel').isHidden());assert.equal(await page.locator('#financial').textContent(),'');assert.equal(await metric('communications').textContent(),'7');
 await page.locator('#reportMode').selectOption('overview');await state('ready');
 await page.evaluate(()=>window.qaTimeout=true);await delayed(async()=>{await state('partial');assert.match(await page.locator('#financialStatus').textContent(),/demorou demasiado/);});await page.evaluate(()=>window.qaTimeout=false);await state('partial');assert.equal(await page.locator('#financial').textContent(),'');await page.locator('[data-report-retry=financial]').click();await state('ready');
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await state('idle');assert.equal(await page.locator('#financial').textContent(),'');await refresh();await state('ready');
 await delayed(async()=>{await page.evaluate(()=>localStorage.setItem('cristalwater_user',JSON.stringify({id:999999,role:'ADMIN'})));await state('session');});await state('session');assert.equal(await page.locator('#financial,#reports,#communications').allTextContents().then(a=>a.join('')),'');assert(await page.locator('#refreshReports').isDisabled());assert.equal(await page.evaluate(()=>localStorage.getItem('qaReportDraft')),'preserved');
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>['ready','review'].includes(document.getElementById('reportsStatus').dataset.state)).catch(async error=>{console.error('Reload diagnosis',await page.evaluate(()=>({path:location.pathname,month:document.getElementById('reportMonth')?.value,state:document.getElementById('reportsStatus')?.dataset.state,status:document.getElementById('reportsStatus')?.textContent,financial:document.getElementById('financialStatus')?.textContent})),requests.slice(-6),errors);throw error;});
 await page.locator('#reportMonth').fill(monthRef);await refresh();await state('ready');const otherPage=await context.newPage();await otherPage.goto(base+'/admin-reports',{waitUntil:'networkidle'});await otherPage.evaluate(()=>localStorage.setItem('user','changed'));await state('session');assert.equal(await page.locator('#financial').textContent(),'');
 assert.deepEqual(errors,[]);console.log('PASS late month/mode/account responses, bounded timeout, BFCache revalidation, cross-tab account change, preserved local draft and original account reload');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();await prisma.$disconnect();});
