'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), jwt = require('jsonwebtoken');
const { chromium } = require('playwright'), { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
// Check every translation tuple and template placeholder, including states not
// forced through the browser fixture. This does not replace the UI assertions.
const copySource = fs.readFileSync(require('node:path').join(__dirname,'../frontend/cw-legacy-technician-copy.js'),'utf8');
const dictionary = require('node:vm').runInNewContext(copySource.slice(0,copySource.indexOf('  const spec =')) + 'return copy; })();');
for (const [key,values] of Object.entries(dictionary)) {
  assert.equal(values.length,5,key);
  const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort().join(',');
  for (const value of values) { assert(typeof value === 'string' && value.trim(),key); assert.equal(placeholders(value),placeholders(values[0]),key); }
}
console.log('PASS translation tuples: '+Object.keys(dictionary).length+' keys, five languages and identical template parameters');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const copy = {
  pt: ['Ronda do Técnico','Cloro','📸 Antes','✔ Concluir','Planeada','Concluída','Confirmar envio guardado','Sem visitas hoje','A sessão mudou.'],
  en: ['Technician route','Chlorine','📸 Before','✔ Complete','Planned','Completed','Confirm saved submission','No visits today','The session has changed.'],
  fr: ['Tournée du technicien','Chlore','📸 Avant','✔ Terminer','Planifiée','Terminée','Confirmer l’envoi enregistré','Aucune visite aujourd’hui','La session a changé.'],
  es: ['Ruta del técnico','Cloro','📸 Antes','✔ Completar','Planificada','Completada','Confirmar envío guardado','No hay visitas hoy','La sesión ha cambiado.'],
  de: ['Technikerroute','Chlor','📸 Vorher','✔ Abschließen','Geplant','Abgeschlossen','Gespeicherten Versand bestätigen','Heute keine Besuche','Die Sitzung hat sich geändert.'],
};
const originalName = 'Guardar <b>José</b> — Online', originalNotes = 'Concluído <script>window.qaInjection=1</script> · 17,25 €';
const fields = ['notes','ph','chlorine','alkalinity','salt','products'];
let browser, completed = false;
const deadline = setTimeout(() => { console.error('Legacy page language assertions did not finish'); process.exit(1); }, 90000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const tech = await prisma.technician.create({ data: { name: 'Language route owner', active: true } });
  const other = await prisma.technician.create({ data: { name: 'Language route other', active: true } });
  const client = await prisma.client.create({ data: { name: originalName, active: true } });
  const pool = await prisma.pool.create({ data: { name: originalName, clientId: client.id, active: true, latitude: 38.7, longitude: -9.1 } });
  const blankPool = await prisma.pool.create({ data: { name: 'Pool without coordinates', clientId: client.id, active: true } });
  const common = { clientId: client.id, poolId: pool.id, technicianId: tech.id, plannedDate: new Date(), date: new Date() };
  const visit = await prisma.serviceVisit.create({ data: { ...common, status: 'PLANNED', startAt: new Date('2026-09-28T09:15:00Z') } });
  const second = await prisma.serviceVisit.create({ data: { ...common, poolId: blankPool.id, status: 'PLANNED' } });
  const done = await prisma.serviceVisit.create({ data: { ...common, status: 'DONE', endAt: new Date('2026-09-28T10:45:00Z') } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const otherToken = jwt.sign({ id: other.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await context.addInitScript(({ token, tech, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaLegacyLanguageSession')) {
      for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      localStorage.setItem('qaLegacyLanguageSession','1');
    }
    const interval = setInterval; window.setInterval = (fn, delay, ...args) => delay === 15000 ? 0 : interval(fn, delay, ...args);
    Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } });
    window.qaAlerts = []; window.alert = value => qaAlerts.push(value);
  }, { token, tech, origin: new URL(base).origin });
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  const errors = [], operational = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/') && url.pathname !== '/api/settings/language/me') operational.push({ path: url.pathname, method: request.method(), body: request.postData() }); });
  await page.goto(base + '/technician.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(id => document.getElementById('notes-' + id), visit.id);
  assert.equal(await page.locator('#cwLanguageSelect').count(), 1, 'Legacy page must expose its language selector');
  await page.locator('#cwLanguageSelect').selectOption('en');
  await page.waitForFunction(() => document.querySelector('header h2')?.textContent === 'Technician route');
  const values = { notes: originalNotes, ph: '7.4', chlorine: '1.5', alkalinity: '90', salt: '3500', products: 'Nota original Guardar' };
  const draftKey = 'cwLegacyVisitDraft:v1:TECH:' + tech.id + ':' + visit.id;
  const draftReady = ({ key, id, values }) => {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')?.fields;
    return !!saved && Object.keys(saved).length === Object.keys(values).length &&
      Object.entries(values).every(([field,value]) => saved[field] === value) &&
      document.getElementById('legacyDraftStatus-' + id)?.getAttribute('data-cw-legacy-text') === 'draftSaved';
  };
  const draftState = { key: draftKey, id: visit.id, values };
  // Every input queues a real save. Hold only the final Web Lock callback to
  // reproduce the partial baseline that previously passed the notes-only wait.
  await page.evaluate(({ key, count }) => {
    const original = navigator.locks.request;
    const state = window.qaLegacyDraftSaveGate = { original, entered: 0, held: false, release: null };
    const hold = new Promise(resolve => { state.release = resolve; });
    navigator.locks.request = function (name, ...args) {
      if (name !== key) return original.call(this, name, ...args);
      const callback = args.pop();
      return original.call(this, name, ...args, async lock => {
        if (++state.entered === count) { state.held = true; await hold; }
        return callback(lock);
      });
    };
  }, { key: draftKey, count: fields.length });
  let partialDraft;
  try {
    await page.evaluate(({ id, values }) => { for (const [field,value] of Object.entries(values)) { const node = document.getElementById(field + '-' + id); node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); } }, { id: visit.id, values });
    await page.waitForFunction(() => qaLegacyDraftSaveGate.held);
    partialDraft = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey);
    assert.deepEqual(partialDraft.fields, { ...values, products: '' });
    assert.equal(await page.evaluate(draftReady, draftState), false, 'A partial queued save must not become the language baseline');
    assert.equal(await page.locator('#legacyDraftStatus-' + visit.id).getAttribute('data-cw-legacy-text'), 'draftSaving');
  } finally {
    await page.evaluate(() => { navigator.locks.request = qaLegacyDraftSaveGate.original; qaLegacyDraftSaveGate.release(); });
  }
  await page.waitForFunction(draftReady, draftState);
  const savedDraft = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey);
  assert.deepEqual(savedDraft.fields, values); assert.deepEqual(savedDraft.baseline, partialDraft.baseline);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  console.log('PASS queued draft regression: notes-only partial save rejected; all six fields and saved state required before language baseline');
  const pending = await page.evaluate(async ({ label }) => { const record = await CWFieldWriteStore.prepare('VISIT_COMPLETION', 424242, { notes: 'Original pending notes', products: [] }, { label }); await updateOfflineBar(); return record; }, { label: originalName });
  const snapshot = () => page.evaluate(async () => {
    const local = Object.fromEntries(Object.keys(localStorage).filter(key => /^(cwLegacy|cwWorkday|cwField|offline)/.test(key)).sort().map(key => [key,localStorage.getItem(key)]));
    const rows = await new Promise((resolve,reject) => { const open = indexedDB.open('cw-field-writes',1); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result, tx = db.transaction('requests'), get = tx.objectStore('requests').getAll(); tx.oncomplete = () => { db.close(); resolve(get.result); }; tx.onerror = () => reject(tx.error); }; });
    return JSON.stringify({ local, rows });
  });
  await page.evaluate(id => { window.qaOriginalNodes = ['notes','ph','chlorine','alkalinity','salt','products'].map(field => document.getElementById(field + '-' + id)); const notes = qaOriginalNodes[0]; notes.focus(); notes.setSelectionRange(3,12,'forward'); }, visit.id);
  const stable = await snapshot(), requestsBefore = operational.length;
  for (const width of [320,390,1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [language, expected] of Object.entries(copy)) {
      await page.evaluate(language => CristalI18n.applyLanguage(language), language);
      await page.waitForFunction(expected => document.querySelector('header h2')?.textContent === expected, expected[0]);
      assert.equal(await page.locator('#chlorine-' + visit.id).getAttribute('placeholder'), expected[1]);
      assert.equal((await page.locator(`[data-action="before"][data-visit-id="${visit.id}"]`).textContent()).trim(), expected[2]);
      assert.equal((await page.locator(`[data-action="complete"][data-visit-id="${visit.id}"]`).textContent()).trim(), expected[3]);
      assert.equal(await page.locator(`[data-visit-status="${visit.id}"]`).textContent(), expected[4]);
      assert.equal(await page.locator(`[data-visit-status="${done.id}"]`).textContent(), expected[5]);
      assert.equal(await page.locator('#legacyFieldRecovery button').textContent(), expected[6]);
      assert.equal(await page.locator('#list h3').first().textContent().then(x => x.trim()), originalName);
      assert.equal(await page.locator('#list h3 b, #list h3 script').count(), 0);
      assert(await page.locator(`[data-action="complete"][data-visit-id="${second.id}"]`).isDisabled());
      assert(await page.locator(`[data-action="map"][data-lat=""]`).isDisabled());
      const inspection = await page.evaluate(({ id, fields }) => ({ same: qaOriginalNodes.every((node,index) => node === document.getElementById(fields[index] + '-' + id)), values: Object.fromEntries(fields.map(field => [field,document.getElementById(field + '-' + id).value])), caret: [qaOriginalNodes[0].selectionStart, qaOriginalNodes[0].selectionEnd], focused: document.activeElement === qaOriginalNodes[0], overflow: document.documentElement.scrollWidth > innerWidth + 1, date: document.querySelector('[data-visit-time="' + id + '"]').textContent, expectedDate: new Date('2026-09-28T09:15:00Z').toLocaleString({pt:'pt-PT',en:'en-GB',fr:'fr-FR',es:'es-ES',de:'de-DE'}[document.documentElement.lang]) }), { id: visit.id, fields });
      assert(inspection.same && inspection.focused); assert.deepEqual(inspection.values,values); assert.deepEqual(inspection.caret,[3,12]); assert(!inspection.overflow, language + '/' + width); assert.equal(inspection.date,inspection.expectedDate);
      assert.equal(await snapshot(),stable,'Language must preserve operational storage bytes');
      assert.equal(operational.length,requestsBefore,'Language must not initiate operational reads or writes');
      for (const selector of ['#cwLanguageSelect',`[data-action="before"][data-visit-id="${visit.id}"]`,'#legacyFieldRecovery button']) { const box = await page.locator(selector).boundingBox(); assert(box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1,selector); }
    }
  }
  console.log('PASS five languages ×320/390/1440: original form nodes, focus/caret, six values, storage bytes, names, disabled states, date locale and zero operational requests');
  await page.evaluate(() => { document.documentElement.lang = 'fr'; });
  await page.waitForFunction(() => document.querySelector('header h2').textContent === 'Tournée du technicien');
  assert.equal(await snapshot(),stable);
  await page.evaluate(() => CristalI18n.applyLanguage('de'));
  if (process.env.CW_CAPTURE_UI) { fs.mkdirSync('reports/field-ui',{recursive:true}); await page.setViewportSize({width:320,height:1000}); await page.screenshot({path:'reports/field-ui/LEGACY_PAGE_DE_320.png',fullPage:true}); await page.locator('header:has(#cwLanguageSelect)').screenshot({path:'reports/field-ui/LEGACY_PAGE_DE_HEADER_320.png'}); await page.locator('#list .card').first().screenshot({path:'reports/field-ui/LEGACY_PAGE_DE_CARD_320.png'}); }
  const routeError = {pt:'Não foi possível confirmar',en:'The complete route',fr:'Impossible de confirmer',es:'No se pudo confirmar',de:'Die vollständige Route'};
  await page.route('**/api/visits/today?*',route=>route.fulfill({status:503,json:{error:'QA route unavailable'}}));
  await page.evaluate(()=>loadRoute());
  for (const [language,expected] of Object.entries(routeError)) { await page.evaluate(language=>CristalI18n.applyLanguage(language),language); assert((await page.locator('#status').textContent()).startsWith(expected)); assert.equal(await page.locator('#notes-'+visit.id).inputValue(),originalNotes); }
  assert.equal(await snapshot(),stable); await page.unroute('**/api/visits/today?*');
  console.log('PASS unavailable route remains an error in all five languages while original route/draft bytes stay intact');
  // Both real selectors must share the current preference once the global
  // engine is loaded; its delayed repaint must not revert a product choice.
  await page.locator('#legacyProducts-'+visit.id+' [data-product-language]').selectOption('en');
  await page.waitForFunction(()=>document.querySelector('header h2').textContent==='Technician route' && document.getElementById('cwLanguageSelect').value==='en');
  await page.waitForTimeout(600); // More than two 180ms translation-observer cycles.
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#cwLanguageSelect').inputValue(),'en');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftKey),JSON.parse(stable).local[draftKey]);
  assert.equal((await page.evaluate(id=>CWFieldWriteStore.get(id,CWFieldWriteStore.session()),pending.requestId)).payloadHash,pending.payloadHash);
  await page.locator('#legacyProducts-'+visit.id+' [data-product-language]').selectOption('de');
  await page.waitForFunction(()=>document.getElementById('cwLanguageSelect').value==='de');
  console.log('PASS the product language selector shares the global preference without delayed reversal or operational byte changes');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true); await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(id => document.getElementById('notes-' + id)?.value.includes('17,25'), visit.id);
  assert.equal(await page.locator('header h2').textContent(),copy.de[0]);
  assert.equal(await page.evaluate(key => localStorage.getItem(key),draftKey),JSON.parse(stable).local[draftKey]);
  assert.equal((await page.evaluate(id => CWFieldWriteStore.get(id,CWFieldWriteStore.session()),pending.requestId)).payloadHash,pending.payloadHash);
  for (const language of Object.keys(copy)) { await page.evaluate(language => CristalI18n.applyLanguage(language),language); assert.equal(await page.locator('#notes-' + visit.id).inputValue(),originalNotes); assert((await page.locator('#status').textContent()).length > 20); }
  console.log('PASS cached offline reload keeps selected language, draft bytes and original pending UUID/payload; offline copy updates without rebuilding inputs');
  // Keep a real send in flight across language changes; only its original UUID may be sent.
  let held;
  await page.route('**/api/core/visits/424242/complete',route => { held = route; });
  // Avoid online-triggered autosync while testing the explicit saved-request control.
  await page.evaluate(() => { Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false}); });
  await context.setOffline(false);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => { Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true}); });
  if (!held) await page.locator('#legacyFieldRecovery button').click();
  for (let i=0;!held && i<100;i++) await new Promise(resolve=>setTimeout(resolve,10)); assert(held);
  const heldWrites = operational.filter(row=>row.path.endsWith('/424242/complete')).length;
  const retryNode = await page.locator('#legacyFieldRecovery button').elementHandle();
  for (const language of ['en','de','fr']) { await page.evaluate(language=>CristalI18n.applyLanguage(language),language); assert(await retryNode.evaluate(node=>node.isConnected && node.disabled)); }
  assert.equal(operational.filter(row=>row.path.endsWith('/424242/complete')).length,heldWrites);
  assert.equal(held.request().postDataJSON().requestId,pending.requestId);
  await held.fulfill({status:503,json:{error:'Guardar <b>Original server evidence</b>'}});
  await page.waitForFunction(()=>document.getElementById('legacyFieldRecovery').textContent.includes('Original server evidence'));
  for (const language of Object.keys(copy)) { await page.evaluate(language=>CristalI18n.applyLanguage(language),language); assert((await page.locator('#legacyFieldRecovery').textContent()).includes('Guardar <b>Original server evidence</b>')); assert.equal(await page.locator('#legacyFieldRecovery b').count(),0); }
  const failed = await page.evaluate(id=>CWFieldWriteStore.get(id,CWFieldWriteStore.session()),pending.requestId); assert.equal(failed.requestId,pending.requestId); assert.deepEqual(failed.payload,pending.payload); assert.equal(failed.payloadHash,pending.payloadHash);
  console.log('PASS delayed send stays disabled across languages, retains original UUID/content and displays server failure literally');
  const preserved = await page.evaluate(key=>localStorage.getItem(key),draftKey);
  await page.evaluate(({token,person})=>CristalAuth.persistSession(token,{id:person.id,role:'TECHNICIAN',name:person.name}),{token:otherToken,person:other});
  await page.waitForFunction(()=>document.querySelectorAll('#list .card').length===0);
  for (const [language,expected] of Object.entries(copy)) { await page.evaluate(language=>CristalI18n.applyLanguage(language),language); assert((await page.locator('#status').textContent()).startsWith(expected[8])); assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftKey),preserved); }
  await page.reload({waitUntil:'networkidle'});
  for (const [language,expected] of Object.entries(copy)) { await page.evaluate(language=>CristalI18n.applyLanguage(language),language); await page.waitForFunction(expected=>document.querySelector('#list .card')?.textContent.trim()===expected,expected[7]); }
  await page.evaluate(async id=>{ await CWFieldWriteStore.prepare('TECHNICIAN_ALERT',id,{message:'Original alert Guardar',priority:'NORMAL',visitId:null},{label:'Original alert label'}); },other.id);
  const alertsPending={pt:'Alertas por confirmar',en:'Alerts awaiting confirmation',fr:'Alertes à confirmer',es:'Alertas por confirmar',de:'Meldungen warten auf Bestätigung'};
  for (const [language,expected] of Object.entries(alertsPending)) { await page.evaluate(async language=>{CristalI18n.applyLanguage(language);await updateOfflineBar('synced');},language); assert.equal(await page.locator('#offlineNetwork').textContent(),expected); }
  console.log('PASS pending alerts prevent a false synced state in every language using a stable state identifier');
  assert.equal(await page.evaluate(()=>window.qaInjection),undefined); assert.deepEqual(errors,[]);
  console.log('PASS changed account clears old route, preserves the original draft, and localizes session/empty states');
  completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{try{await browser?.close();await prisma.$disconnect();}finally{clearTimeout(deadline);}});
