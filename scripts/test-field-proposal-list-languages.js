'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises');
const jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ["pt", "en", "fr", "es", "de"], words = {"proposalEmpty": ["Sem propostas desta piscina nesta sessão.", "No proposals for this pool in this session.", "Aucune proposition pour cette piscine dans cette session.", "No hay propuestas para esta piscina en esta sesión.", "In dieser Sitzung gibt es keine Vorschläge für diesen Pool."], "proposalLoading": ["A consultar propostas...", "Loading proposals...", "Chargement des propositions…", "Consultando propuestas...", "Vorschläge werden geladen…"], "proposalLoadFailed": ["Não foi possível consultar as propostas. Atualize antes de repetir um envio.", "Could not load the proposals. Refresh before sending again.", "Impossible de charger les propositions. Actualisez avant de renvoyer.", "No se pudieron consultar las propuestas. Actualiza antes de volver a enviar.", "Die Vorschläge konnten nicht geladen werden. Aktualisieren Sie, bevor Sie erneut senden."], "proposalNoReason": ["Sem motivo", "No reason", "Sans motif", "Sin motivo", "Kein Grund"], "proposalSummary": ["{date} | {changes} alteração(ões) | {photos} foto(s)", "{date} | {changes} change(s) | {photos} photo(s)", "{date} | {changes} modification(s) | {photos} photo(s)", "{date} | {changes} cambio(s) | {photos} foto(s)", "{date} | {changes} Änderung(en) | {photos} Foto(s)"], "accessNoDate": ["Sem data definida", "No date set", "Aucune date définie", "Sin fecha definida", "Kein Datum festgelegt"]};
const fieldIds = ['notes','ph','chlorine','alkalinity','salt','orp','temperature','cleaned','vacuumed','basketCleaned','brushed','waterlineClean','backwashDone'];
const proposalIds = ['proposalRiskLevel','proposalFieldName','proposalBeforeValue','proposalAfterValue','proposalReason','proposalPhotos'];
let browser,completed = false,checks = 0,scenarios = 0;
const deadline = setTimeout(() => { console.error('Proposal list language scenario incomplete'); process.exit(1); },110000);
process.on('exit',code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const now = Date.now(), parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const day = ['year','month','day'].map(name => parts.find(part => part.type === name).value).join('-'), scheduledAt = new Date(day + 'T12:00:00.000Z');
  const vehicle = await prisma.vehicle.create({ data: { plate: 'PROPOSAL-LANG-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Proposal owner <b>{day}</b>', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Proposal language client', active: true } });
  const pools = await Promise.all(['REGULAR','EXTRA'].map(type => prisma.pool.create({ data: { clientId: client.id, name: type + ' proposal <b>{date}</b>', createdByTechnicianId: type === 'EXTRA' ? tech.id : null, active: true } })));
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(row => row._max.id || 0)) + 1, common = { id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date(now) };
  await prisma.serviceVisit.create({ data: { ...common, poolId: pools[0].id, date: scheduledAt, plannedDate: scheduledAt } });
  await prisma.extraVisit.create({ data: { ...common, poolId: pools[1].id, scheduledAt } });
  for (const table of ['ServiceVisit','ExtraVisit']) await prisma.$queryRawUnsafe('SELECT setval(pg_get_serial_sequence(\'"' + table + '"\',\'id\'),' + id + ',true)');
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'AT-NET-' + vehicle.id, status: 'ACTIVE', validUntil: new Date(now + 30 * 86400000), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE','INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(now + 30 * 86400000) } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }), legacyKey = 'cwFieldVisitDrafts:' + tech.id;

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } }),adminToken = jwt.sign({ id: admin.id,role: 'ADMIN' },getJwtSecret(),{ expiresIn: '1h' });
  const call = async (pool,body,credential = token) => { const response = await fetch(base + '/api/core/pools/' + pool + '/technical-change-proposals' + (body ? '' : '?onlyPending=true'),{ method: body ? 'POST' : 'GET',headers: { Authorization: 'Bearer ' + credential,'Content-Type': 'application/json' },...(body ? { body: JSON.stringify(body) } : {}) });const json = await response.json();assert.equal(response.status,body ? 201 : 200);return json; };
  for (const [poolIndex,pool] of pools.entries()) for (let index = 0;index < (poolIndex ? 2 : 5);index++) await call(pool.id,{ reason: index === (poolIndex ? 0 : 4) ? 'Sem motivo' : 'Source reason ' + poolIndex + '/' + index + ' <b>{date}</b>',changes: [{ field: 'pumpPower',before: '1 CV',after: '1.5 CV' },...(index % 2 ? [{ field: 'pumpType',before: 'Old',after: 'New' }] : [])],photos: Array.from({ length: index % 3 },(_,photo) => 'https://example.invalid/qa-' + poolIndex + '-' + index + '-' + photo + '.png'),riskLevel: 'LOW' });
  await call(pools[0].id,{ reason: 'PRIVATE ADMIN PROPOSAL',changes: [{ field: 'pumpPower',after: '2 CV' }] },adminToken);
  const sourceRows = await Promise.all(pools.map(pool => call(pool.id)));
  assert.deepEqual(sourceRows.map(source => source.proposals.length),[5,2]);assert(!JSON.stringify(sourceRows).includes('PRIVATE ADMIN PROPOSAL'));
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 1400 }, timezoneId: 'Europe/Lisbon' }), requests = [], errors = [];
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, tech, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaProposalListLanguages')) {
      for (const key of ['token','cristalwater_jwt','adminToken']) localStorage.setItem(key, token);
      for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      localStorage.setItem('qaProposalListLanguages','1');
    }
    // Keep the tab click real while removing animated movement from snapshot timing.
    const scrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(options) { return scrollIntoView.call(this, options && typeof options === 'object' ? { ...options,behavior: 'instant' } : options); };
    const interval = window.setInterval;
    window.setInterval = (callback, delay, ...args) => [15000,30000,60000].includes(delay) ? 0 : interval(callback, delay, ...args);
    Object.defineProperty(navigator,'geolocation',{ value: { watchPosition: () => 1, clearWatch() {} } });
  }, { token, tech, origin: base });
  const page = await context.newPage(); page.setDefaultTimeout(10000); await page.clock.setFixedTime(now);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/')) requests.push({ path, method: request.method(), body: request.postData(), auth: request.headers().authorization }); });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const locale = async language => { await settle(); await page.evaluate(() => window.scrollTo({ top: 0,behavior: 'instant' })); await settle(); await page.locator('#cwLanguageSelect').selectOption(language); await settle(); };
  const ready = async type => {
    await page.waitForFunction(({ id, type }) => window.CWFieldVisitContext?.()?.id === id && CWFieldVisitContext().visitType === type && ['transportGuideBox','workGuideBox','insuranceBox'].every(key => ['live','cache'].includes(document.getElementById(key).dataset.source)) && !['…',''].includes(document.getElementById('fieldPhotosValue')?.textContent), { id, type });
    await page.locator('[data-field-tab-button=docs]').click(); await settle();
  };
  const open = async type => { await page.goto(base + '/technician-field-mode?selectedVisitId=' + id + '&selectedVisitType=' + type, { waitUntil: 'domcontentloaded' }); await ready(type); };
  const fill = async type => { await page.locator('[data-field-tab-button=agora]').click();
    for (const [field,value] of Object.entries({ notes: type + ' proposal list draft <b>{date}</b>', ph: type === 'REGULAR' ? '7.4' : '7.1', chlorine: '1.2', alkalinity: '90', salt: '3.2', orp: '680', temperature: '24' })) await page.locator('#' + field).fill(value);
    for (const [field,value] of Object.entries({ cleaned: true, vacuumed: false, basketCleaned: true, brushed: false, waterlineClean: true, backwashDone: false })) await page.locator('#' + field).setChecked(value);
    await page.waitForFunction(({ id,owner,type }) => { const raw = localStorage.getItem('cwFieldVisitDrafts:v2:' + owner); return document.getElementById('fieldSaveStatus').dataset.state === 'saved' && raw && JSON.parse(raw).drafts['visit-' + type + '-' + id]?.values.notes === type + ' proposal list draft <b>{date}</b>'; },{ id,owner: 'TECH:' + tech.id,type });
  };
  const raw = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => /^cwField|^cw:tech/.test(key)).sort().map(key => [key,localStorage.getItem(key)])));
  const pending = () => page.evaluate(() => new Promise((resolve,reject) => {
    const request = indexedDB.open('cw-field-writes',1); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, read = db.transaction('requests').objectStore('requests').getAll(); read.onsuccess = () => { db.close(); resolve(read.result.sort((a,b) => a.key.localeCompare(b.key))); }; read.onerror = () => reject(read.error); };
  }));

  const proposalRecords = () => page.evaluate(() => new Promise((resolve,reject) => { const open = indexedDB.open('cw-technical-proposal-requests-v1',1);open.onerror = () => reject(open.error);open.onsuccess = () => { const db = open.result,read = db.transaction('requests').objectStore('requests').getAll();read.onsuccess = () => { db.close();resolve(read.result); };read.onerror = () => reject(read.error); }; }));
  const database = () => Promise.all([prisma.serviceVisit.findUnique({ where: { id } }),prisma.extraVisit.findUnique({ where: { id } }),prisma.transportGuide.findUnique({ where: { id: guide.id } }),prisma.workGuide.findMany({ where: { vehicleId: vehicle.id },orderBy: { id: 'asc' } }),prisma.fieldWriteRequest.count(),prisma.stockMovement.count(),prisma.technicalHistory.findMany({ where: { poolId: { in: pools.map(pool => pool.id) } },orderBy: { id: 'asc' } }),prisma.notification.findMany({ orderBy: { id: 'asc' } }),prisma.pool.findMany({ where: { id: { in: pools.map(pool => pool.id) } },orderBy: { id: 'asc' } })]);
  const track = () => page.evaluate(() => {
    window.qaNetworkCalls = {};
    if (window.qaNetworkTracking) return;
    window.qaNetworkTracking = true; window.qaNetworkReads = 0;
    for (const [group,api,names] of [['route',CWFieldRouteCache,['read','save','update','fromResponse']],['documents',CWFieldDocuments,['load']],['photos',CWFieldPhotos,['list','save','sync']],['draft',CWFieldVisitDrafts,['save','prepare','load']],['writes',CWFieldWriteStore,['prepare','attempt','acknowledge']]]) for (const name of names) {
      const original = api?.[name]; if (typeof original !== 'function') continue;
      api[name] = (...args) => { const key = group + ':' + name; qaNetworkCalls[key] = (qaNetworkCalls[key] || 0) + 1; const result = original(...args); if (result?.then) { qaNetworkReads++; result.then(() => qaNetworkReads--,() => qaNetworkReads--); } return result; };
    }
  });
  const waitReads = () => page.waitForFunction(() => !window.qaNetworkReads);
  const state = () => page.evaluate(async () => {
    const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value || '')))].map(byte => byte.toString(16).padStart(2,'0')).join('');
    const session = Object.fromEntries(Object.keys(sessionStorage).sort().map(key => { const raw = sessionStorage.getItem(key); if (key === 'cw:ctx:/technician-field-mode') { const copy = JSON.parse(raw); delete copy.fields?.cwLanguageSelect; return [key,copy]; } return [key,raw]; }));
    return { day: CWFieldDaySnapshot(), visit: CWFieldVisitContext(), calls: qaNetworkCalls, tokens: await Promise.all(['token','cristalwater_jwt','adminToken'].map(key => digest(localStorage.getItem(key)))), users: ['user','cristalwater_user'].map(key => { const user = JSON.parse(localStorage.getItem(key)); delete user.language; return user; }), session, fields: qaNetworkFields.map(node => [node.id,node.value,node.checked,node.disabled,node.readOnly,node.hidden]), badge: { offline: qaNetworkBadge.dataset.offline, hidden: qaNetworkBadge.hidden, className: qaNetworkBadge.className }, history: { hidden: qaNetworkHistory.hidden, role: qaNetworkHistory.getAttribute('role'), manual: qaNetworkHistory.getAttribute('data-cw-state-managed') }, controls: qaNetworkControls.map(node => [node.id,node.hidden,node.disabled]) };
  });

  const text = (key,index,params = {}) => words[key][index].replace(/\{(\w+)\}/g,(_,name) => params[name]);
  const proposalState = () => page.evaluate(() => ({ fields: qaProposalFields.map(node => [node.id,node.value,node.checked,node.disabled,node.readOnly,node.hidden]),button: [qaProposalButton.disabled,qaProposalButton.hidden],draft: Object.fromEntries(Object.keys(sessionStorage).filter(key => key.startsWith('cw-technical-proposal-')).sort().map(key => [key,sessionStorage.getItem(key)])) }));
  const rowDisplay = () => page.locator('#technicalProposalList').evaluate(list => [...list.querySelectorAll('[data-tech-proposal-id]')].map(node => ({ id: node.dataset.techProposalId,risk: node.querySelector('strong').textContent,reason: node.querySelector('strong + div').textContent,summary: node.querySelector('.muted').textContent })));
  let profile = 'native',releaseLoading,heldRequests = 0;
  const endpoint = '**/api/core/pools/*/technical-change-proposals?onlyPending=true';
  const routeHandler = async route => {
    if (profile === 'native') return route.continue();
    const pool = Number(new URL(route.request().url()).pathname.split('/')[4]),poolIndex = pools.findIndex(row => row.id === pool);assert(poolIndex >= 0);const json = structuredClone(sourceRows[poolIndex]);
    if (profile === 'loading') { heldRequests++;await new Promise(resolve => { const previous = releaseLoading;releaseLoading = () => { previous?.();resolve(); }; }); }
    if (profile === 'empty') json.proposals = [];
    if (profile === 'error') return route.fulfill({ status: 503,json: { ok: false,error: 'External server detail <b>{date}</b>' } });
    if (profile === 'fallbacks') for (const [position,row] of json.proposals.entries()) {
      if (position === 0) { row.reason = '';row.riskLevel = null;row.submittedAt = null;row.createdAt = null;row.changes = null;row.photos = {}; }
      if (position === 1) { row.submittedAt = 'invalid-date';row.createdAt = 'invalid-date';row.riskLevel = 'UNKNOWN <b>{date}</b>'; }
    }
    await route.fulfill({ status: 200,json });
  };
  await page.route(endpoint,routeHandler);
  const waitList = async type => { const count = sourceRows[type === 'REGULAR' ? 0 : 1].proposals.length;await page.waitForFunction(({ count,profile }) => profile === 'loading' ? document.getElementById('technicalProposalList').textContent === 'A consultar propostas...' : ['empty','error'].includes(profile) ? !document.querySelector('#technicalProposalList [data-tech-proposal-id]') && document.getElementById('technicalProposalList').textContent !== 'A consultar propostas...' : document.querySelectorAll('#technicalProposalList [data-tech-proposal-id]').length === Math.min(4,count),{ count,profile });await settle(); };
  const openProfile = async (next,type = 'REGULAR') => { profile = next;releaseLoading = null;await open(type);await locale('pt');await waitList(type); };
  const fillProposal = async type => { await page.locator('[data-field-tab-button=docs]').click();for (const [key,value] of Object.entries({ proposalFieldName: 'pumpPower',proposalBeforeValue: '1 CV',proposalAfterValue: type + ' proposed <b>{date}</b>',proposalReason: type + ' unsent reason <b>{changes}</b>',proposalPhotos: 'https://example.invalid/unsent.png' })) await page.locator('#' + key).fill(value);await page.locator('#proposalRiskLevel').selectOption('MEDIUM');await settle(); };
  async function matrix({ name,type = 'REGULAR',widths = [320,390,1440],pendingCount = 0,foreign = false,offlineUnavailable = false }) {
    await waitReads();await page.locator('[data-field-tab-button=docs]').click();await page.locator('#cwLanguageSelect').focus();await locale('pt');await track();await settle();assert(await page.locator('#technicalProposalList').isVisible());
    await page.evaluate(({ ids,proposalIds }) => { window.qaNetworkBadge = document.getElementById('connectionState');window.qaNetworkHistory = document.getElementById('fieldDraftHistory');window.qaNetworkFields = ids.map(id => document.getElementById(id));window.qaNetworkControls = ['startBtn','finishBtn','fieldReloadBtn'].map(id => document.getElementById(id));window.qaNetworkHandlers = qaNetworkControls.map(node => node.onclick);window.qaNetworkFocus = document.activeElement;window.qaProposalFields = proposalIds.map(id => document.getElementById(id));window.qaProposalButton = document.getElementById('submitTechnicalProposalBtn');window.qaProposalHandler = qaProposalButton.onclick;window.qaProposalNodes = [...document.querySelectorAll('#technicalProposalList,#technicalProposalList *')]; },{ ids: fieldIds,proposalIds });
    const before = await state(),proposalBefore = await proposalState(),stored = await raw(),records = await pending(),requestsBefore = await proposalRecords(),db = await database(),first = requests.length;
    assert.equal(records.length,pendingCount);assert(records.every(row => !row.response));assert.equal(requestsBefore.length,0);
    const expected = structuredClone(sourceRows[type === 'REGULAR' ? 0 : 1].proposals).slice(0,4);
    const shownProfile = offlineUnavailable ? 'error' : profile;
    if (shownProfile === 'fallbacks') { Object.assign(expected[0],{ reason: '',riskLevel: null,submittedAt: null,createdAt: null,changes: null,photos: {} });Object.assign(expected[1],{ submittedAt: 'invalid-date',createdAt: 'invalid-date',riskLevel: 'UNKNOWN <b>{date}</b>' }); }
    const dates = await page.evaluate(rows => rows.map(row => { const raw = row.submittedAt || row.createdAt;return !raw || Number.isNaN(new Date(raw).getTime()) ? null : new Date(raw).toLocaleString('pt-PT',{ dateStyle: 'short',timeStyle: 'short' }); }),expected);
    for (const width of widths) { await page.setViewportSize({ width,height: 1400 });for (const [index,language] of languages.entries()) {
      await locale(language);
      if (['loading','empty','error'].includes(shownProfile)) assert.equal(await page.locator('#technicalProposalList').textContent(),text({ loading: 'proposalLoading',empty: 'proposalEmpty',error: 'proposalLoadFailed' }[shownProfile],foreign ? 0 : index));
      else { const rows = await rowDisplay();assert.equal(rows.length,expected.length);for (const [position,item] of expected.entries()) {
        assert.equal(rows[position].id,String(item.id));assert.equal(rows[position].risk,item.riskLevel || 'MEDIUM');assert.equal(rows[position].reason,item.reason || text('proposalNoReason',index));
        assert.equal(rows[position].summary,text('proposalSummary',foreign && position === 0 ? 0 : index,{ date: dates[position] || text('accessNoDate',foreign && position === 0 ? 0 : index),changes: Array.isArray(item.changes) ? item.changes.length : 0,photos: Array.isArray(item.photos) ? item.photos.length : 0 }));
      }}
      assert.deepEqual(await state(),before);assert.deepEqual(await proposalState(),proposalBefore);assert.deepEqual(await raw(),stored);assert.deepEqual(await pending(),records);assert.deepEqual(await proposalRecords(),requestsBefore);assert.deepEqual(await database(),db);
      assert(await page.evaluate(() => qaProposalNodes.every(node => node.isConnected) && qaNetworkFields.every(node => node === document.getElementById(node.id)) && qaProposalFields.every(node => node === document.getElementById(node.id)) && qaNetworkControls.every((node,index) => node.onclick === qaNetworkHandlers[index]) && qaProposalButton.onclick === qaProposalHandler && document.activeElement === qaNetworkFocus));
      assert.equal(await page.locator('#technicalProposalList b,#technicalProposalList script,#technicalProposalList img').count(),0);assert(!(await page.locator('#technicalProposalList').textContent()).includes('PRIVATE'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));assert(await page.locator('#technicalProposalList').evaluate(node => node.scrollWidth <= node.clientWidth + 1));checks++;
    }}
    if (process.env.CW_PROPOSAL_LIST_CAPTURE && !foreign) { await fs.mkdir(process.env.CW_PROPOSAL_LIST_CAPTURE,{ recursive: true });await page.setViewportSize({ width: 320,height: 1400 });await page.locator('#technicalProposalList').screenshot({ path: process.env.CW_PROPOSAL_LIST_CAPTURE + '/' + name + '-de-320.png' });await page.locator('#cwLanguageSelect').focus();await page.evaluate(() => window.scrollTo({ top: 0,behavior: 'instant' }));await settle(); }
    for (const request of requests.slice(first)) { assert.equal(request.path,'/api/settings/language/me');assert.equal(request.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']);assert(request.auth === 'Bearer ' + token); }
    scenarios++;console.log('PASS proposal list languages ' + JSON.stringify({ name,checks,scenarios,pendingCount,fullSourceCount: sourceRows[type === 'REGULAR' ? 0 : 1].proposals.length,unchangedTechnicalDraft: true,noOperationalWrites: true }));
  }
  await openProfile('native');await fill('REGULAR');await fillProposal('REGULAR');await matrix({ name: 'regular-real-five-source-four-cards' });
  await openProfile('native','EXTRA');await fill('EXTRA');await fillProposal('EXTRA');await matrix({ name: 'extra-same-id-other-pool-two-cards',type: 'EXTRA' });
  await openProfile('fallbacks');await matrix({ name: 'missing-and-invalid-source-fields',widths: [320] });
  await locale('pt');await page.locator('#technicalProposalList [data-tech-proposal-id] .muted').first().evaluate(node => node.replaceChildren(document.createTextNode(node.textContent)));await matrix({ name: 'foreign-identical-owned-summary',foreign: true,widths: [320] });
  await openProfile('empty');await matrix({ name: 'empty',widths: [320] });
  await locale('pt');await page.locator('#technicalProposalList').evaluate(node => node.replaceChildren(document.createTextNode(node.textContent)));await matrix({ name: 'foreign-identical-empty',foreign: true,widths: [320] });
  await openProfile('error');await matrix({ name: 'original-error-producer',widths: [320] });
  await openProfile('loading');assert(heldRequests > 0);await matrix({ name: 'loading',widths: [320] });releaseLoading();await page.waitForFunction(() => document.querySelectorAll('#technicalProposalList [data-tech-proposal-id]').length === 4);profile = 'native';
  await openProfile('native');await track();await locale('en');
  await page.evaluate(async id => { await CWFieldWriteStore.prepare('VISIT_COMPLETION',id,{ visitId: id,notes: 'REGULAR proposal list pending <b>{date}</b>' });await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION',id,{ visitType: 'EXTRA',notes: 'EXTRA proposal list pending <b>{date}</b>' }); },id);
  const originalPending = await pending(),originalDb = await database();assert.deepEqual(originalPending.map(row => row.scope).sort(),['EXTRA_VISIT_COMPLETION','VISIT_COMPLETION']);assert(originalPending.every(row => row.resourceId === id && row.owner === 'TECH:' + tech.id && row.payloadHash.length === 64 && !row.response));assert.notEqual(originalPending[0].requestId,originalPending[1].requestId);
  await page.evaluate(() => navigator.serviceWorker.ready);await page.waitForFunction(() => !!navigator.serviceWorker.controller);await context.setOffline(true);await page.waitForFunction(() => document.getElementById('connectionState').dataset.offline === 'true');await matrix({ name: 'in-memory-real-list-offline',pendingCount: 2 });
  await open('EXTRA');await locale('pt');await page.waitForFunction(() => document.getElementById('technicalProposalList').textContent.includes('Não foi possível'));await track();assert.equal(await page.locator('#notes').inputValue(),'EXTRA proposal list draft <b>{date}</b>');assert.equal(await page.evaluate(() => CWFieldDaySnapshot().confirmedAt),null);await matrix({ name: 'extra-cached-shell-list-unavailable',type: 'EXTRA',widths: [320],pendingCount: 2,offlineUnavailable: true });
  assert.deepEqual(await pending(),originalPending);assert.deepEqual(await database(),originalDb);assert.deepEqual(errors,[]);assert(requests.filter(request => !['GET','HEAD'].includes(request.method)).every(request => request.path === '/api/settings/language/me' && request.method === 'PUT'));
  console.log('PASS proposal list language result ' + JSON.stringify({ checks,scenarios,ownedEntries: 5,languages: 5,typedDraftFields: 13,technicalDraftFields: 6,immutablePending: 2,fourCardLimit: true,realTechnicianApiScope: true,originalReasonsRiskCodesAndDates: true,foreignLeavesLiteral: true,noOperationalWrites: true }));completed = true;
})().catch(error => { console.error(error);process.exitCode = 1; }).finally(async () => { clearTimeout(deadline);await browser?.close();await prisma.$disconnect(); });
