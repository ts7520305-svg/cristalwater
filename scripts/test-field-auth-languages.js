'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),jwt=require('jsonwebtoken'),{chromium}=require('playwright');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const languages=['pt','en','fr','es','de'],words={"expiredMessage":["Sessão expirada. Os registos locais continuam neste telemóvel. Volte a entrar com a mesma conta para enviar os dados pendentes.","Session expired. Local records remain on this phone. Sign in again with the same account to send pending data.","Session expirée. Les enregistrements locaux restent sur ce téléphone. Reconnectez-vous avec le même compte pour envoyer les données en attente.","Sesión caducada. Los registros locales permanecen en este móvil. Inicia sesión de nuevo con la misma cuenta para enviar los datos pendientes.","Sitzung abgelaufen. Lokale Einträge bleiben auf diesem Handy. Melden Sie sich erneut mit demselben Konto an, um ausstehende Daten zu senden."],"expiredLink":["Voltar a entrar","Sign in again","Se reconnecter","Volver a entrar","Erneut anmelden"],"connection":["Ligação instável. A sessão foi mantida e os dados serão preservados.","Unstable connection. Your session was retained and your data will be preserved.","Connexion instable. La session a été conservée et les données seront préservées.","Conexión inestable. Se ha mantenido la sesión y se conservarán los datos.","Instabile Verbindung. Die Sitzung wurde beibehalten und Ihre Daten bleiben erhalten."],"logout":["Não foi possível terminar a sessão. Tente novamente.","Could not sign out. Try again.","Impossible de se déconnecter. Réessayez.","No se ha podido cerrar la sesión. Vuelve a intentarlo.","Abmelden war nicht möglich. Versuchen Sie es erneut."]};
let browser,completed=false,checks=0;
const deadline=setTimeout(()=>{console.error('Auth language scenario incomplete');process.exit(1);},110000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
  const now = Date.now(), vehicle = await prisma.vehicle.create({ data: { plate: 'AUTH-LANG-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Auth <b>{owner}</b>', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Auth language client', active: true } });
  const pools = await Promise.all(['REGULAR', 'EXTRA'].map(type => prisma.pool.create({ data: { clientId: client.id, name: type + ' auth', active: true } })));
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(row => row._max.id || 0)) + 1, common = { id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date() };
  await prisma.serviceVisit.create({ data: { ...common, poolId: pools[0].id, date: new Date(), plannedDate: new Date() } });
  await prisma.extraVisit.create({ data: { ...common, poolId: pools[1].id, scheduledAt: new Date() } });
  for (const table of ['ServiceVisit', 'ExtraVisit']) await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),${id},true)`);
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'AT-AUTH-LANG-' + vehicle.id, status: 'ACTIVE', validUntil: new Date(now + 30 * 86400000), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(now + 30 * 86400000) } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const draft = { v: 2, owner: 'TECH:' + tech.id, drafts: Object.fromEntries(['REGULAR', 'EXTRA'].map(type => ['visit-' + type + '-' + id, { values: { notes: type + ' auth draft <b>{owner}</b>' }, checks: {} }])) };

  browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  const database=()=>Promise.all([prisma.serviceVisit.findUnique({where:{id}}),prisma.extraVisit.findUnique({where:{id}}),prisma.transportGuide.findUnique({where:{id:guide.id}}),prisma.workGuide.findMany({where:{vehicleId:vehicle.id}}),prisma.fieldWriteRequest.count(),prisma.stockMovement.count()]);
  async function scenario(name,type='REGULAR',widths=[320,390,1440]){
    const context=await browser.newContext({viewport:{width:390,height:1400},timezoneId:'Europe/Lisbon'}),requests=[],errors=[];
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    await context.addInitScript(({token,tech,draft,now,origin})=>{
      if(top!==window||location.origin!==origin)return;
      for(const key of ['token','cristalwater_jwt'])localStorage.setItem(key,token);
      for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id:tech.id,role:'TECHNICIAN',name:tech.name}));
      localStorage.setItem('cwFieldVisitDrafts:v2:TECH:'+tech.id,JSON.stringify(draft));Date.now=()=>now;
      const interval=window.setInterval;window.setInterval=(callback,delay,...args)=>[15000,30000,60000].includes(delay)?0:interval(callback,delay,...args);
      Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});
      const native=window.fetch.bind(window),timeout=window.setTimeout.bind(window);
      window.qaAuthTimers=[];window.setTimeout=(callback,delay,...args)=>{const timer=timeout(callback,delay,...args);if(delay===4200)qaAuthTimers.push(timer);return timer;};
      window.qaAuthMode='expired';window.qaAuthCalls=[];
      window.fetch=(input,options)=>{
        const target=new URL(typeof input==='string'?input:input.url,location.href);
        if(target.pathname!=='/api/qa-auth-languages')return native(input,options);
        qaAuthCalls.push({method:options?.method||'GET',authorization:new Headers(options?.headers).get('Authorization')});
        if(qaAuthMode==='network'||qaAuthMode==='abort'){window.qaAuthRawError=qaAuthMode==='abort'?new DOMException('QA original abort','AbortError'):new TypeError('QA original <b>{owner}</b>');return Promise.reject(qaAuthRawError);}
        if(qaAuthMode==='held')return new Promise(resolve=>{window.qaAuthRelease=resolve;});
        return Promise.resolve(new Response('{}',{status:401,headers:{'Content-Type':'application/json'}}));
      };
    },{token,tech,draft,now,origin:base});
    const page=await context.newPage();page.setDefaultTimeout(9000);page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/api/'))requests.push({path,method:request.method(),body:request.postData()});});
    await page.goto(base+'/technician-field-mode?selectedVisitId='+id+'&selectedVisitType='+type,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(type=>CWFieldVisitContext()?.visitType===type&&['transportGuideBox','workGuideBox','insuranceBox'].every(id=>document.getElementById(id).dataset.source==='live')&&!['…',''].includes(document.getElementById('fieldPhotosValue')?.textContent),type);
    await page.locator('[data-field-tab-button=more]').click();
    const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const locale=async language=>{await page.locator('#cwLanguageSelect').selectOption(language);await page.waitForFunction(language=>document.documentElement.lang===language,language);await settle();};
    await locale('en');
    if(name==='expired'){
      assert.equal(await page.evaluate(()=>fetch('/api/qa-auth-languages').then(r=>r.status)),401);
      assert.equal(await page.locator('#cwSessionExpired p').textContent(),words.expiredMessage[1],'Expiry follows actual language selector');
      assert.equal(await page.locator('#cwSessionExpired a').getAttribute('href'),'/technician-login');assert.equal(await page.locator('#cwSessionExpired').getAttribute('role'),'alert');
    }else if(name==='connection'){
      assert(await page.evaluate(async()=>{qaAuthMode='network';try{await fetch('/api/qa-auth-languages');return false;}catch(error){return error===qaAuthRawError&&error.message==='QA original <b>{owner}</b>';}}),'Original rejection identity/message survive');
    }else{
      await page.evaluate(()=>{window.qaAuthRemove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(key==='cristalwater_jwt')throw Error('QA original logout failure');return qaAuthRemove.call(this,key);};});
      await page.locator('[data-cw-logout]').click();await page.waitForFunction(()=>document.getElementById('cw-v21-toast')?.style.display==='block');
      await page.evaluate(()=>{Storage.prototype.removeItem=qaAuthRemove;});
      assert.equal(await page.locator('[data-cw-logout]').isDisabled(),false);assert.equal(await page.locator('[data-cw-logout]').getAttribute('aria-busy'),null);
    }
    const selectors=name==='expired'?['#cwSessionExpired','#cwSessionExpired p','#cwSessionExpired a']:['#cw-v21-toast'];
    await page.evaluate(selectors=>{window.qaAuthNodes=selectors.map(selector=>document.querySelector(selector));window.qaAuthTimer=document.getElementById('cw-v21-toast')?._t;},selectors);
    await page.locator('[data-field-tab-button=more]').focus();await settle();
    const state=()=>page.evaluate(async()=>({context:CWFieldVisitContext(),expired:CristalAuth.isSessionExpired(),calls:qaAuthCalls,tokens:['token','cristalwater_jwt','adminToken'].map(key=>localStorage.getItem(key)),users:['user','cristalwater_user'].map(key=>{const user=JSON.parse(localStorage.getItem(key));delete user.language;return user;}),stored:Object.keys(localStorage).filter(key=>/^cwField|^cw:tech/.test(key)).sort().map(key=>[key,localStorage.getItem(key)]),writes:await CWFieldWriteStore.records(null,CWFieldWriteStore.session(),true),fields:['notes','ph','chlorine','vehicleId','technicianId','startBtn','finishBtn'].map(id=>{const node=document.getElementById(id);return [id,node.value,node.disabled,node.readOnly,node.hidden];}),focus:document.activeElement.dataset.fieldTabButton,timers:qaAuthTimers,href:document.querySelector('#cwSessionExpired a')?.getAttribute('href')||null}));
    const before=await state(),db=await database(),first=requests.length;
    for(const width of widths){await page.setViewportSize({width,height:1400});for(const [i,language]of languages.entries()){
      await locale(language);
      for(const [key,selector]of name==='expired'?[['expiredMessage','#cwSessionExpired p'],['expiredLink','#cwSessionExpired a']]:[[name==='connection'?'connection':'logout','#cw-v21-toast']]){
        assert.equal(await page.locator(selector).textContent(),words[key][i]);assert(await page.locator(selector).evaluate(node=>node.scrollWidth<=node.clientWidth+1),key+' fits '+width+' '+language);
      }
      assert.deepEqual(await state(),before);assert.deepEqual(await database(),db);assert(await page.evaluate(()=>qaAuthNodes.every(node=>node.isConnected)&&document.getElementById('cw-v21-toast')?._t===qaAuthTimer));assert.equal(new URL(page.url()).pathname,'/technician-field-mode');
      for(const key of ['user','cristalwater_user'])assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).language,key),language);
      checks++;
      if(process.env.CW_AUTH_CAPTURE&&language==='de'&&width===320){await fs.mkdir(process.env.CW_AUTH_CAPTURE,{recursive:true});await page.locator(selectors[0]).screenshot({path:process.env.CW_AUTH_CAPTURE+'/'+name+'-'+type+'-de-320.png'});}
    }}
    for(const request of requests.slice(first)){assert.equal(request.path,'/api/settings/language/me');assert.equal(request.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']);}
    const drafts=await page.evaluate(()=>CWFieldDraftSnapshot());for(const type of ['REGULAR','EXTRA'])assert.equal(drafts['visit-'+type+'-'+id].values.notes,type+' auth draft <b>{owner}</b>');
    const draftBytes=await page.evaluate(key=>localStorage.getItem(key),'cwFieldVisitDrafts:v2:TECH:'+tech.id);
    if(name!=='expired'){
      assert.equal(before.expired,false);assert.equal(before.timers.length,1);assert.equal(await page.locator('#cwSessionExpired').count(),0);
      await page.evaluate(()=>{clearTimeout(qaAuthTimer);qaAuthNodes[0].style.display='none';});await locale('en');assert.equal(await page.locator('#cw-v21-toast').isVisible(),false);
      await page.evaluate(text=>CristalAuth.toast(text),words.connection[0]);await locale('de');assert.equal(await page.locator('#cw-v21-toast').textContent(),words.connection[0],'Foreign producer with identical Portuguese text stays literal');
      await page.evaluate(()=>{clearTimeout(document.getElementById('cw-v21-toast')._t);document.getElementById('cw-v21-toast').style.display='none';});
      assert(await page.evaluate(async()=>{qaAuthMode='abort';try{await fetch('/api/qa-auth-languages');return false;}catch(error){return error===qaAuthRawError;}}));assert.equal(await page.locator('#cw-v21-toast').isVisible(),false,'Abort does not show connection failure');
    }else{
      const renewed=jwt.sign({id:tech.id,role:'TECHNICIAN',nonce:'renewed'},getJwtSecret(),{expiresIn:'1h'});
      await page.evaluate(({renewed,tech})=>CristalAuth.persistSession(renewed,{id:tech.id,role:'TECHNICIAN',name:tech.name}),{renewed,tech});
      assert.equal(await page.locator('#cwSessionExpired').count(),0);assert.equal(await page.evaluate(()=>CristalAuth.isSessionExpired()),false);
      await page.evaluate(()=>{qaAuthMode='held';window.qaAuthDelayed=fetch('/api/qa-auth-languages').then(r=>r.status);});await page.waitForFunction(()=>typeof qaAuthRelease==='function');
      const newer=jwt.sign({id:tech.id,role:'TECHNICIAN',nonce:'newer'},getJwtSecret(),{expiresIn:'1h'});
      await page.evaluate(({newer,tech})=>CristalAuth.persistSession(newer,{id:tech.id,role:'TECHNICIAN',name:tech.name}),{newer,tech});
      await page.evaluate(()=>qaAuthRelease(new Response('{}',{status:401})));assert.equal(await page.evaluate(()=>qaAuthDelayed),401);assert.equal(await page.evaluate(()=>CristalAuth.isSessionExpired()),false);assert.equal(await page.locator('#cwSessionExpired').count(),0);
    }
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),'cwFieldVisitDrafts:v2:TECH:'+tech.id),draftBytes,'Account/token changes preserve both typed drafts byte for byte');
    assert.deepEqual(errors,[]);assert(requests.filter(request=>!['GET','HEAD'].includes(request.method)).every(request=>request.path==='/api/settings/language/me'&&request.method==='PUT'));
    console.log('PASS auth languages '+JSON.stringify({name,type,widths,originalTimer:true,originalSessionRules:true,operationalWrites:0}));await context.close();
  }
  await scenario('expired');await scenario('connection');await scenario('logout');await scenario('expired','EXTRA',[320]);
  console.log('PASS auth language result '+JSON.stringify({checks,typedDrafts:true,noOperationalWrites:true,originalErrors:true,noRedirectOnFieldExpiry:true}));completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{clearTimeout(deadline);await browser?.close();await prisma.$disconnect();});
