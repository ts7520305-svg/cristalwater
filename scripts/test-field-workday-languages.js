'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), jwt = require('jsonwebtoken');
const { chromium } = require('playwright'), { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
// Independent expected UI fragments; do not read expectations from the dictionary.
const copy = {
  pt: { refresh:'Consultar jornada', retry:'Confirmar pedido guardado', confirmed:'Estado confirmado no servidor', stale:'Sem confirmação atual', none:'não iniciada', active:'em trabalho', closed:'terminada', busy:'A consultar/confirmar a jornada…', start:'Início', end:'Fim', pending:'guardado, por confirmar. Use o pedido original.', error:'Estado da jornada por confirmar.', previous:'Último estado consultado:', incomplete:'Resposta incompleta ou de outra jornada.', unreadable:'Pedido de jornada ilegível.', invalid:'Pedido de jornada inválido ou de outra conta.', session:'A sessão mudou.', fallback:'Sem confirmação do servidor.' },
  en: { refresh:'Check workday', retry:'Confirm saved request', confirmed:'Status confirmed on the server', stale:'No current confirmation', none:'not started', active:'working', closed:'ended', busy:'Checking/confirming the workday…', start:'Start', end:'End', pending:'saved, awaiting confirmation. Use the original request.', error:'Workday status awaiting confirmation.', previous:'Last checked status:', incomplete:'Incomplete response or a different workday.', unreadable:'Unreadable workday request.', invalid:'Invalid workday request or a request from another account.', session:'The session has changed.', fallback:'No server confirmation.' },
  fr: { refresh:'Consulter la journée', retry:'Confirmer la demande enregistrée', confirmed:'État confirmé sur le serveur', stale:'Aucune confirmation actuelle', none:'non commencée', active:'en cours', closed:'terminée', busy:'Consultation/confirmation de la journée…', start:'Début', end:'Fin', pending:'demande enregistrée, à confirmer. Utilisez la demande d’origine.', error:'État de la journée à confirmer.', previous:'Dernier état consulté :', incomplete:'Réponse incomplète ou correspondant à une autre journée.', unreadable:'Demande de journée illisible.', invalid:'Demande de journée invalide ou liée à un autre compte.', session:'La session a changé.', fallback:'Aucune confirmation du serveur.' },
  es: { refresh:'Consultar jornada', retry:'Confirmar solicitud guardada', confirmed:'Estado confirmado en el servidor', stale:'Sin confirmación actual', none:'no iniciada', active:'en curso', closed:'terminada', busy:'Consultando/confirmando la jornada…', start:'Inicio', end:'Fin', pending:'guardado, por confirmar. Use la solicitud original.', error:'Estado de la jornada por confirmar.', previous:'Último estado consultado:', incomplete:'Respuesta incompleta o de otra jornada.', unreadable:'Solicitud de jornada ilegible.', invalid:'Solicitud de jornada no válida o de otra cuenta.', session:'La sesión ha cambiado.', fallback:'Sin confirmación del servidor.' },
  de: { refresh:'Arbeitstag abfragen', retry:'Gespeicherte Anfrage bestätigen', confirmed:'Status auf dem Server bestätigt', stale:'Keine aktuelle Bestätigung', none:'nicht begonnen', active:'in Arbeit', closed:'beendet', busy:'Arbeitstag wird abgefragt/bestätigt…', start:'Beginn', end:'Ende', pending:'gespeichert, Bestätigung ausstehend. Verwenden Sie die ursprüngliche Anfrage.', error:'Status des Arbeitstags noch nicht bestätigt.', previous:'Zuletzt abgefragter Status:', incomplete:'Unvollständige Antwort oder anderer Arbeitstag.', unreadable:'Anfrage zum Arbeitstag ist unlesbar.', invalid:'Ungültige Anfrage zum Arbeitstag oder Anfrage eines anderen Kontos.', session:'Die Sitzung hat sich geändert.', fallback:'Keine Bestätigung vom Server.' },
};
const ids = ['dayStatus','startDayBtn','endDayBtn','dayRefreshBtn','dayRecoveryBtn'];
let browser, completed = false;
const releases = [], deadline = setTimeout(() => { console.error('Workday language assertions did not finish'); process.exit(1); }, 90000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const email = 'workday-language-' + Date.now() + '@qa.test';
  let user = await prisma.user.create({ data: { name:'Language workday account', email, password:'qa-unused', role:'TECHNICIAN', active:true } });
  const tech = await prisma.technician.create({ data: { name:'Language workday technician', email, active:true } });
  if (user.id === tech.id) {
    user = await prisma.user.create({ data: { name:'Distinct workday account', email:'distinct-' + email, password:'qa-unused', role:'TECHNICIAN', active:true } });
    await prisma.technician.update({ where:{id:tech.id}, data:{email:user.email} });
  }
  assert.notEqual(user.id, tech.id);
  const token = jwt.sign({ id:tech.id, role:'TECHNICIAN' }, getJwtSecret(), { expiresIn:'1h' });
  browser = await chromium.launch({ headless:true, executablePath:process.env.CW_CHROMIUM_PATH, args:['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport:{width:390,height:900} });
  await context.addInitScript(({token,tech,origin}) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaWorkdayLanguageSession')) {
      for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key,token);
      for (const key of ['user','cristalwater_user']) localStorage.setItem(key,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));
      localStorage.setItem('qaWorkdayLanguageSession','1');
    }
    // Keep this fixture about deliberate language actions; the separate recovery
    // suite exercises the unchanged page including its periodic sync.
    const interval = setInterval; window.setInterval = (fn,delay,...args) => delay === 15000 ? 0 : interval(fn,delay,...args);
    Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});
    window.alert = () => {};
  }, {token,tech,origin:new URL(base).origin});
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/workday/')) requests.push({method:request.method(),url:request.url(),body:request.postData()}); });
  const key = 'cwWorkdayPending:v1:TECH:' + tech.id;
  const raw = () => page.evaluate(key => localStorage.getItem(key),key);
  const posts = () => requests.filter(request => request.method === 'POST');
  const statusUrl = '**/api/workday/status*', startUrl = base + '/api/workday/start', endUrl = base + '/api/workday/end';
  const ready = () => page.waitForFunction(() => { const button = document.getElementById('dayRefreshBtn'); return button && !button.disabled; });
  const choose = async lang => {
    await page.locator('#cwLanguageSelect').selectOption(lang);
    await page.waitForFunction(text => document.getElementById('dayRefreshBtn')?.textContent === text,copy[lang].refresh);
  };
  const rememberNodes = () => page.evaluate(ids => { window.qaWorkdayNodes = ids.map(id => document.getElementById(id)); },ids);
  async function cycle(fragments, widths = [320,390,1440]) {
    const before = await raw(), count = requests.length;
    const gates = await page.evaluate(ids => ids.slice(1).map(id => { const node = document.getElementById(id); return [node.disabled,node.hidden]; }),ids);
    for (const width of widths) {
      await page.setViewportSize({width,height:900});
      for (const [lang,words] of Object.entries(copy)) {
        await choose(lang);
        const text = await page.locator('#dayStatus').textContent();
        for (const fragment of fragments(words)) assert(text.includes(fragment),lang + ': ' + fragment + ' in ' + text);
        assert.equal(await page.locator('#dayRecoveryBtn').textContent(),words.retry);
        assert.equal(await raw(),before,'Language changes must preserve the exact original request bytes');
        const result = await page.evaluate(ids => ({
          same:ids.every((id,index) => document.getElementById(id) === qaWorkdayNodes[index]),
          gates:ids.slice(1).map(id => { const node = document.getElementById(id); return [node.disabled,node.hidden]; }),
          overflow:document.documentElement.scrollWidth > innerWidth + 1,
          controls:ids.slice(1).map(id => document.getElementById(id)).filter(node => !node.hidden).every(node => { const box = node.getBoundingClientRect(); return box.height >= 44 && node.scrollWidth <= node.clientWidth + 1 && box.left >= -1 && box.right <= innerWidth + 1; }),
        }),ids);
        assert(result.same,'Language changes must not rebuild the workday controls');
        assert.deepEqual(result.gates,gates,'Language changes must not change operation guards');
        if (result.overflow || !result.controls) {
          console.error('Workday layout',await page.evaluate(ids => ({page:[innerWidth,document.documentElement.scrollWidth],nodes:ids.map(id=>{const node=document.getElementById(id),box=node.getBoundingClientRect();return{id,hidden:node.hidden,width:box.width,height:box.height,left:box.left,right:box.right,scroll:node.scrollWidth,client:node.clientWidth};})}),ids));
          if (process.env.CW_CAPTURE_UI) { fs.mkdirSync('reports/field-ui',{recursive:true}); await page.screenshot({path:'reports/field-ui/LEGACY_WORKDAY_LANGUAGE_FAILURE.png',fullPage:false}); }
        }
        assert(!result.overflow && result.controls,'Workday controls must fit at ' + width + '/' + lang);
      }
    }
    assert.equal(requests.length,count,'Changing language must not start, end, refresh or recover the workday');
  }
  await page.goto(base + '/technician.html',{waitUntil:'networkidle'});
  await page.waitForFunction(() => !document.getElementById('startDayBtn').disabled); await rememberNodes();
  await cycle(words => [words.confirmed,words.none]);
  console.log('PASS workday controls and not-started state in five languages at 320/390/1440; same nodes, guards and zero workday requests');

  let entered, release;
  let enteredPromise = new Promise(resolve => { entered = resolve; }), gate = new Promise(resolve => { release = resolve; releases.push(resolve); });
  await page.route(statusUrl,async route => { const response = await route.fetch(); entered(); await gate; await route.fulfill({response}).catch(()=>{}); });
  await page.evaluate(() => { window.qaWorkdayHeld = CWLegacyWorkday.refresh(); }); await enteredPromise;
  await cycle(words => [words.busy],[320]); release(); await page.evaluate(() => qaWorkdayHeld); await page.unroute(statusUrl);

  enteredPromise = new Promise(resolve => { entered = resolve; }); gate = new Promise(resolve => { release = resolve; releases.push(resolve); });
  await page.route(startUrl,async route => {
    const response = await route.fetch(), data = await response.json(); entered(); await gate;
    await route.fulfill({status:response.status(),json:{...data,scope:{...data.scope,owner:'TECH:999999'}}}).catch(()=>{});
  });
  await page.locator('#startDayBtn').click(); await enteredPromise;
  const originalStart = await raw(), attempt = JSON.parse(originalStart);
  assert.equal(attempt.userId,user.id); assert.equal(attempt.workDayId,null); assert.equal(attempt.owner,'TECH:' + tech.id); assert(!originalStart.includes(token));
  await cycle(words => [words.start,attempt.date,words.pending],[320]);
  assert.equal(posts().length,1); assert.equal(await prisma.technicianWorkDay.count({where:{userId:user.id}}),1);
  release(); await ready(); await page.unroute(startUrl);
  await cycle(words => [words.error,words.incomplete,words.previous,words.none,attempt.date]);
  assert.equal(await raw(),originalStart);
  await page.locator('#dayRecoveryBtn').click(); await ready();
  assert.equal(await raw(),null); assert.equal(posts().length,1);
  await cycle(words => [words.confirmed,words.active,attempt.date]);
  console.log('PASS language changes during GET and saved start preserve the in-flight request; wrong-owner acknowledgement stays pending; read-only recovery confirms one linked User row');

  const serverText = 'Guardar <script>window.qaWorkdayInjection=1</script> · 17,25 €';
  await page.route(statusUrl,route => route.fulfill({status:503,json:{error:serverText}}));
  await page.locator('#dayRefreshBtn').click(); await ready();
  await cycle(words => [words.error,serverText,words.previous,words.active,attempt.date]);
  assert.equal(await page.locator('#dayStatus script').count(),0); assert.equal(await page.evaluate(() => window.qaWorkdayInjection),undefined);
  assert(await page.locator('#endDayBtn').isDisabled());
  await page.unroute(statusUrl);
  await page.route(statusUrl,route => route.fulfill({status:503,json:{}}));
  await page.locator('#dayRefreshBtn').click(); await ready();
  await cycle(words => [words.error,words.fallback],[320]);
  await page.unroute(statusUrl); await page.locator('#dayRefreshBtn').click(); await ready();
  await context.setOffline(true); await cycle(words => [words.stale,words.active,attempt.date],[320]);
  await context.setOffline(false); await page.waitForFunction(() => !document.getElementById('endDayBtn').disabled);
  console.log('PASS translated error/stale states preserve literal server evidence and last known day; missing server message uses a translated fallback');

  enteredPromise = new Promise(resolve => { entered = resolve; }); gate = new Promise(resolve => { release = resolve; releases.push(resolve); });
  await page.route(endUrl,async route => { await route.fetch(); entered(); await gate; await route.abort('failed'); });
  await page.locator('#endDayBtn').click(); await enteredPromise;
  await cycle(words => [words.end,attempt.date,words.pending],[320]);
  if (process.env.CW_CAPTURE_UI) {
    fs.mkdirSync('reports/field-ui',{recursive:true});
    await page.locator('#dayStatus').scrollIntoViewIfNeeded();
    await page.screenshot({path:'reports/field-ui/LEGACY_WORKDAY_PENDING_DE_320.png',fullPage:false});
  }
  release(); await ready();
  const originalEnd = await raw(), closed = await prisma.technicianWorkDay.findFirstOrThrow({where:{userId:user.id}});
  assert.equal(closed.status,'CLOSED'); assert.equal(posts().length,2); assert.equal(JSON.parse(originalEnd).workDayId,closed.id);
  await page.unroute(endUrl); await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true); await page.reload({waitUntil:'domcontentloaded'}); await ready(); await rememberNodes();
  assert.equal(await page.locator('#cwLanguageSelect').inputValue(),'de');
  await cycle(words => [words.error],[320]); assert.equal(await raw(),originalEnd);
  assert(await page.locator('#dayRecoveryBtn').isDisabled()); assert(await page.locator('#endDayBtn').isDisabled());
  await page.route(statusUrl,route => route.fulfill({status:503,json:{error:serverText}}));
  await context.setOffline(false); await page.waitForFunction(text => document.getElementById('dayStatus')?.textContent.includes(text) && !document.getElementById('dayRecoveryBtn').disabled,serverText);
  await cycle(words => [words.error,serverText],[320]); assert.equal(await raw(),originalEnd);
  await page.unroute(statusUrl); await page.locator('#dayRecoveryBtn').click(); await ready();
  await cycle(words => [words.confirmed,words.closed,attempt.date]);
  assert.equal(await raw(),null); assert.equal(posts().length,2);
  assert.equal((await prisma.technicianWorkDay.findUniqueOrThrow({where:{id:closed.id}})).endAt.toISOString(),closed.endAt.toISOString());
  console.log('PASS lost end acknowledgement, real service-worker offline reload and five-language recovery preserve original bytes/day/row/end time and issue no duplicate POST');

  for (const [stored,fragment] of [['{corrupt','unreadable'],[JSON.stringify({...JSON.parse(originalEnd),owner:'TECH:999999'}),'invalid']]) {
    await page.evaluate(({key,stored}) => localStorage.setItem(key,stored),{key,stored});
    await page.reload({waitUntil:'networkidle'}); await ready(); await rememberNodes();
    await cycle(words => [words.error,words[fragment]],[320]); assert.equal(await raw(),stored);
    assert(await page.locator('#startDayBtn').isDisabled()); assert(await page.locator('#endDayBtn').isDisabled());
  }
  await page.evaluate(({key,stored}) => localStorage.setItem(key,stored),{key,stored:originalEnd});
  const other = await prisma.technician.create({data:{name:'Other language workday account',active:true}});
  const otherToken = jwt.sign({id:other.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'});
  await page.evaluate(({token,other}) => {
    for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key,token);
    for (const key of ['user','cristalwater_user']) localStorage.setItem(key,JSON.stringify({id:other.id,name:other.name,role:'TECHNICIAN'}));
    window.dispatchEvent(new Event('offline'));
  },{token:otherToken,other});
  await cycle(words => [words.session],[320]); assert.equal(await raw(),originalEnd);
  assert.equal(await page.evaluate(key => localStorage.getItem(key),'cwWorkdayPending:v1:TECH:' + other.id),null);
  assert(await page.locator('#dayRefreshBtn').isDisabled()); assert(await page.locator('#dayRecoveryBtn').isDisabled());
  if (process.env.CW_CAPTURE_UI) {
    fs.mkdirSync('reports/field-ui',{recursive:true});
    await page.locator('#dayStatus').evaluate(node => node.closest('.card')?.scrollIntoView());
    await page.screenshot({path:'reports/field-ui/LEGACY_WORKDAY_LANGUAGES_DE_320.png',fullPage:false});
  }
  assert.deepEqual(errors,[]); assert.equal(posts().length,2);
  console.log('PASS unreadable/foreign attempts and session changes stay localized, blocked and byte-preserving; no script injection or browser errors');
  completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); for (const release of releases) release(); await browser?.close(); await prisma.$disconnect(); });
