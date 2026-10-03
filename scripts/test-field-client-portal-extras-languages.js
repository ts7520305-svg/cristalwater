'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), { randomInt } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { chromium } = require('playwright'), jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const retryLabels = ['Tentar novamente', 'Try again', 'Réessayer', 'Reintentar', 'Erneut versuchen'];
const errorLabels = ['Nao foi possivel carregar dados', 'Unable to load data', 'Impossible de charger les donnees', 'No se pudieron cargar los datos', 'Daten konnten nicht geladen werden'];
const quoteTitles = ['Orçamentos', 'Quotes', 'Devis', 'Presupuestos', 'Angebote'], quoteRefresh = ['Atualizar', 'Refresh', 'Actualiser', 'Actualizar', 'Aktualisieren'];
const quoteLoadErrors = ['Não foi possível carregar.', 'Could not load.', 'Chargement impossible.', 'No se pudo cargar.', 'Laden fehlgeschlagen.'];
let quoteLanguageCases = 0;
async function quotePresentation(page, index) {
  await page.waitForFunction(expected => document.getElementById('clientQuotesTitle').textContent === expected, quoteTitles[index]);
  assert.equal(await page.locator('#clientQuotesRefresh').textContent(), quoteRefresh[index]);
  const geometry = await page.evaluate(() => ['clientQuotesTitle', 'clientQuotesRefresh'].map(id => { const item = document.getElementById(id), range = document.createRange(); range.selectNodeContents(item); return { id, lines: range.getClientRects().length, height: item.getBoundingClientRect().height, text: [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right })) }; }));
  for (const item of geometry) { assert.equal(item.lines, 1, 'Quote heading/refresh words must remain whole: ' + item.id); assert(item.text.every(rect => rect.left >= 0 && rect.right <= page.viewportSize().width)); }
  assert(geometry[1].height >= 44); quoteLanguageCases++;
}
const deadline = setTimeout(() => { console.error('Client portal extras language QA deadline'); process.exit(1); }, 150000);
let browser, client, notice, originalLanguage, complete = false, checks = 0;
const legacyChatUploads = [];
async function legacyChatLanguages(context, token) {
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  for (const text of ['Atualizar', 'Enviar <b>{literal}</b>']) {
    const response = await fetch(base + '/api/client-messages', { method: 'POST', headers, body: JSON.stringify({ clientId: client.id, text }) });
    assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  }
  const bytes = Buffer.from('Native client attachment language QA\n'), form = new FormData();
  form.append('clientId', String(client.id)); form.append('fileName', 'Atualizar'); form.append('file', new Blob([bytes]), 'Atualizar');
  const uploaded = await fetch(base + '/api/client-messages/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
  assert.equal(uploaded.status, 200); const upload = await uploaded.json(); assert.equal(upload.ok, true);
  const filePath = path.join(require('../src/config/uploadPath').resolveUploadBaseDir(), 'documents/client-chat', path.basename(upload.message.fileUrl));
  legacyChatUploads.push(filePath); assert.deepEqual(await fs.readFile(filePath), bytes);
  const fallback = await prisma.clientMessage.create({ data: { clientId: client.id, senderType: 'ADMIN', text: 'Attachment without a stored name', fileUrl: upload.message.fileUrl, fileName: null, messageType: 'FILE' } });
  const history = await prisma.clientMessage.create({ data: { clientId: client.id, senderType: 'LEGACY', text: 'Mensagem <b>{literalHistory}</b>', fileUrl: '/uploads/documents/guessed-private.pdf' } });
  const before = await prisma.clientMessage.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }); await prisma.$disconnect();
  const ctx = await context(), page = await ctx.newPage(), errors = [], requests = []; page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/')) requests.push({ path: url.pathname, method: request.method() }); });
  const titles = ['Cristal Water - Mensagens do Cliente', 'Cristal Water - Client messages', 'Cristal Water - Messages du client', 'Cristal Water - Mensajes del cliente', 'Cristal Water - Kundennachrichten'];
  const headings = ['Conversa com a administração', 'Conversation with the office', 'Conversation avec l’administration', 'Conversación con la administración', 'Gespräch mit der Verwaltung'];
  const messageLabels = ['Mensagem', 'Message', 'Message', 'Mensaje', 'Nachricht'];
  const attachments = ['Abrir anexo', 'Open attachment', 'Ouvrir la pièce jointe', 'Abrir adjunto', 'Anhang öffnen'];
  const historyLabels = ['Mensagem antiga · autor não confirmado', 'Earlier message · author unconfirmed', 'Ancien message · auteur non confirmé', 'Mensaje anterior · autor sin confirmar', 'Frühere Nachricht · Verfasser unbestätigt'];
  const row = id => page.locator('#messages .msg[data-message-id="' + id + '"]');
  try {
    await page.goto(base + '/client_chat?lang=pt', { waitUntil: 'networkidle' }); await page.locator('#cwLanguageSelect').waitFor(); await row(history.id).waitFor();
    await page.waitForFunction(() => !document.getElementById('text').disabled);
    assert.equal(await row(history.id).locator('a').count(), 0, 'Imported messages cannot infer access to an attachment');
    await page.locator('#text').fill('Draft <b>{languageDraft}</b>'); await page.evaluate(() => document.getElementById('text').setSelectionRange(2, 8));
    await page.evaluate(() => { window.qaLegacyNodes = [...document.querySelectorAll('title, .header h1, #text, #messages .msg > div, #messages .msg > a, #messages .msg > strong')]; window.qaLegacyLeaves = qaLegacyNodes.map(node => node.firstChild); window.qaLegacyHandlers = [document.getElementById('sendBtn').onclick, document.querySelector('.header button').onclick]; });
    const state = () => page.evaluate(() => ({ token: localStorage.getItem('token'), credential: localStorage.getItem('cristalwater_jwt'), value: document.getElementById('text').value, disabled: document.getElementById('text').disabled, sendDisabled: document.getElementById('sendBtn').disabled, selection: [document.getElementById('text').selectionStart, document.getElementById('text').selectionEnd], drafts: Object.fromEntries(Object.keys(sessionStorage).filter(key => key.startsWith('cwClientChatDraft:')).map(key => [key, sessionStorage.getItem(key)])) }));
    const initial = await state(), reads = requests.filter(request => request.path === '/api/chat/client/' + client.id).length; let languageCases = 0;
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [index, language] of languages.entries()) {
        await page.locator('#cwLanguageSelect').selectOption(language); await settle(page);
        assert.equal(await page.title(), titles[index]); assert.equal(await page.locator('.header h1').textContent(), headings[index]); assert.equal(await page.locator('#text').getAttribute('aria-label'), messageLabels[index]);
        assert.equal(await row(fallback.id).locator('a').textContent(), attachments[index]); assert.equal(await row(history.id).locator('strong').textContent(), historyLabels[index]);
        for (const message of before) assert.equal(await row(message.id).locator('div').textContent(), message.text || message.message || '', 'The API message body must remain literal in ' + language);
        assert.equal(await row(upload.message.id).locator('a').textContent(), 'Atualizar', 'The stored attachment name must remain literal');
        assert.equal(await row(upload.message.id).locator('a').getAttribute('href'), '/api/client-messages/attachments/' + upload.message.id); assert.equal(await row(upload.message.id).locator('a').getAttribute('data-auth-download'), '');
        assert.equal(await page.locator('#messages b, #messages img').count(), 0); assert.deepEqual(await state(), initial);
        assert.equal(requests.filter(request => request.path === '/api/chat/client/' + client.id).length, reads, 'Changing language must not reload the conversation');
        assert.equal(requests.filter(request => request.method !== 'GET' && request.path !== '/api/settings/language/me').length, 0, 'Changing language must not send or mark messages read');
        assert(await page.evaluate(() => qaLegacyNodes.every((node, index) => node.isConnected && node.firstChild === qaLegacyLeaves[index]) && document.getElementById('sendBtn').onclick === qaLegacyHandlers[0] && document.querySelector('.header button').onclick === qaLegacyHandlers[1]));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        for (const selector of ['#sendBtn', '.header button']) { const rect = await page.locator(selector).boundingBox(); assert(rect.x >= 0 && rect.x + rect.width <= width && rect.height >= 44); assert(await page.locator(selector).evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); const bounds = node.getBoundingClientRect(); return [...range.getClientRects()].every(rect => rect.left >= bounds.left && rect.right <= bounds.right); }), 'The complete button label must fit in ' + language); }
        languageCases++;
      }
    }
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => document.title === 'Cristal Water - Kundennachrichten');
    assert.equal(await page.locator('.header h1').textContent(), headings[4]); assert.equal(await page.locator('#text').getAttribute('aria-label'), messageLabels[4]); assert.equal(await page.locator('#text').inputValue(), initial.value);
    assert.equal(await row(fallback.id).locator('a').textContent(), attachments[4]); assert.equal(await row(history.id).locator('strong').textContent(), historyLabels[4]);
    for (const message of before) assert.equal(await row(message.id).locator('div').textContent(), message.text || message.message || '');
    assert.equal(await row(upload.message.id).locator('a').textContent(), 'Atualizar');
    await page.setViewportSize({ width: 320, height: 900 }); await capture(page, 'legacy-chat-de-320', '.header');
    await page.evaluate(() => { document.querySelector('title').firstChild.nodeValue = 'Foreign title <b>{literal}</b>'; document.querySelector('.header h1').append(document.createElement('span')); document.getElementById('text').removeAttribute('aria-label'); const original = document.querySelector('#messages .msg > a'); const clone = original.cloneNode(true); clone.id = 'qaForeignChatLink'; document.body.append(clone); });
    const foreign = await page.locator('#qaForeignChatLink').textContent(), heading = await page.locator('.header h1').innerHTML(); let ownershipCases = 0;
    for (const language of languages) {
      await page.locator('#cwLanguageSelect').selectOption(language); await settle(page);
      assert.equal(await page.title(), 'Foreign title <b>{literal}</b>'); assert.equal(await page.locator('.header h1').innerHTML(), heading); assert.equal(await page.locator('#text').getAttribute('aria-label'), null); assert.equal(await page.locator('#qaForeignChatLink').textContent(), foreign); ownershipCases += 4;
    }
    const response = await fetch(base + '/api/client-messages/attachments/' + upload.message.id, { headers: { Authorization: 'Bearer ' + token } }); assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.deepEqual(await prisma.clientMessage.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }), before); await prisma.$disconnect(); assert.deepEqual(errors, []);
    console.log('PASS legacy client chat language integration ' + JSON.stringify({ languageCases, ownershipCases, widths: [320, 390, 1440], languages: 5, nativeTextPosts: 2, nativeUpload: 1, nativeAuthenticatedDownloadBytes: true, literalApiBodies: before.length, literalAttachmentName: true, retainedDraftNodesHandlers: true, conversationReadsUnchanged: true, retainedLanguageOnReload: true, sqlRowsUnchanged: true }));
  } finally { await ctx.close(); }
}
async function legacyAccountLanguages(context, token) {
  const ctx = await context(), page = await ctx.newPage(), errors = [], requests = []; page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/')) requests.push({ path: url.pathname, method: request.method() }); });
  const titles = ['Cristal Water - Conta do Cliente','Cristal Water - Client account','Cristal Water - Compte client','Cristal Water - Cuenta del cliente','Cristal Water - Kundenkonto'];
  const headings = ['Conta do cliente','Client account','Compte client','Cuenta del cliente','Kundenkonto'];
  const intros = ['Consulte os seus serviços, mensagens e documentos no portal do cliente.','View your services, messages and documents in the client portal.','Consultez vos services, messages et documents dans le portail client.','Consulte sus servicios, mensajes y documentos en el portal del cliente.','Sehen Sie Ihre Leistungen, Nachrichten und Dokumente im Kundenportal ein.'];
  const portals = ['Abrir portal do cliente','Open client portal','Ouvrir le portail client','Abrir portal del cliente','Kundenportal öffnen'];
  const accountNavigation = ['Conta e dados','Account and details','Compte et données','Cuenta y datos','Konto und Daten'];
  const breadcrumbs = ['Cliente / Portal do cliente / Conta e dados','Client / Client portal / Account and details','Client / Portail client / Compte et données','Cliente / Portal del cliente / Cuenta y datos','Kunde / Kundenportal / Konto und Daten'];
  const requestsNavigation = ['Pedidos','Requests','Demandes','Solicitudes','Anfragen'];
  const primaryLabels={pt:['Piscina','Visitas','Pagamentos','Pedidos','Menu'],en:['Pool','Visits','Payments','Requests','Menu'],fr:['Piscine','Visites','Paiements','Demandes','Menu'],es:['Piscina','Visitas','Pagos','Solicitudes','Menú'],de:['Pool','Besuche','Zahlungen','Anfragen','Menü']};
  const accountNavigationSelectors = ['.cw-v2-shell-topbar .cw-v2-context-title','.cw-v2-shell-topbar [data-cw-breadcrumb]','.cw-v2-shell-sidebar a[href="/client"]','[data-cw-drawer] a[href="/client"]','.cw-v2-mobile-primary a[href="/client-menu"]'];
  let navigationTextAssertions = 0, navigationOwnershipCases = 0;
  const before = await database();
  try {
    await page.goto(base + '/client', { waitUntil: 'networkidle' }); await page.locator('#cwLanguageSelect').waitFor();
    assert.equal(await page.locator('#clientAccountPortal').getAttribute('href'), '/client-portal');
    assert.equal(await page.locator('#list, [onclick]').count(), 0, 'The CLIENT account must not expose administrative client or invoice controls');
    await page.evaluate(() => { localStorage.setItem('cwFieldAccount519', '{original-unattributed-work'); sessionStorage.setItem('cwPortalAccount519', 'original draft'); window.qaAccountNodes = [...document.querySelectorAll('title,#clientAccountTitle,#clientAccountIntro,#clientAccountPortal')]; window.qaAccountLeaves = qaAccountNodes.map(node => node.firstChild); });
    await page.evaluate(selectors => { window.qaAccountNavigationNodes = selectors.map(selector => document.querySelector(selector)); window.qaAccountNavigationLeaves = qaAccountNavigationNodes.map(node => node.firstChild); }, accountNavigationSelectors);
    const savedWork = await work(page); let languageCases = 0;
    for (const width of [320,390,1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [index,language] of languages.entries()) {
        await page.locator('#cwLanguageSelect').selectOption(language); await settle(page);
        assert.equal(await page.title(), titles[index]); assert.equal(await page.locator('#clientAccountTitle').textContent(), headings[index]); assert.equal(await page.locator('#clientAccountIntro').textContent(), intros[index]); assert.equal(await page.locator('#clientAccountPortal').textContent(), portals[index]);
        for (const [position,selector] of accountNavigationSelectors.entries()) { assert.equal(await page.locator(selector).textContent(), position === 1 ? breadcrumbs[index] : position === 4 ? requestsNavigation[index] : accountNavigation[index]); navigationTextAssertions++; if (position === 2 || position === 3) { assert.equal(await page.locator(selector).getAttribute('data-shell-search'), accountNavigation[index]); navigationTextAssertions++; } }
        assert(await page.evaluate(() => qaAccountNavigationNodes.every((node,index) => node.isConnected && node.firstChild === qaAccountNavigationLeaves[index])));
        assert.equal(await page.locator(accountNavigationSelectors[4]).getAttribute('href'), '/client-menu');
        assert(await page.locator(accountNavigationSelectors[0]).evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); const heading = node.getBoundingClientRect(), selector = document.getElementById('cwLanguageSelect').closest('label').getBoundingClientRect(); return node.scrollWidth <= node.clientWidth + 1 && [...range.getClientRects()].every(rect => rect.left >= heading.left && rect.right <= heading.right + 1 && (rect.bottom <= selector.top || rect.top >= selector.bottom || rect.right <= selector.left || rect.left >= selector.right)); }), 'The complete account heading must fit without overlapping the language selector');
        if (width < 900) { assert(await page.locator(accountNavigationSelectors[4]).evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); const bounds = node.getBoundingClientRect(), rects = [...range.getClientRects()]; return bounds.height >= 44 && rects.length === 1 && rects.every(rect => rect.left >= bounds.left && rect.right <= bounds.right); }), 'The complete requests label must fit the mobile navigation target: ' + language + '/' + width); assert(await page.locator('.cw-v2-mobile-primary > a,.cw-v2-mobile-primary > button').evaluateAll(nodes => nodes.every(node => { const rect = node.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44 && rect.left >= 0 && rect.right <= innerWidth; })), 'Every mobile navigation target must retain at least 44px in both dimensions'); }
        if (width < 900) { const mobile = page.locator('.cw-v2-mobile-primary > a,.cw-v2-mobile-primary > button'); assert.equal(await mobile.count(),5); assert.deepEqual(await mobile.allTextContents(),primaryLabels[language]); assert(await mobile.evaluateAll(nodes => nodes.every(node => { const bounds=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);const lines=[...range.getClientRects()];return lines.length===1 && lines.every(rect=>rect.left>=bounds.left && rect.right<=bounds.right); })), 'All five native CLIENT navigation labels remain whole: '+language+'/'+width); }
        assert.equal(await page.locator('#clientAccountPortal').getAttribute('href'), '/client-portal'); assert.equal(await page.evaluate(() => localStorage.getItem('token')), token); assert.equal(await page.evaluate(() => localStorage.getItem('cristalwater_jwt')), token); assert.deepEqual(await work(page), savedWork);
        assert(await page.evaluate(() => qaAccountNodes.every((node,index) => node.isConnected && node.firstChild === qaAccountLeaves[index]))); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const rect = await page.locator('#clientAccountPortal').boundingBox(); assert(rect.x >= 0 && rect.x + rect.width <= width && rect.height >= 44);
        assert(await page.locator('#clientAccountPortal').evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); const bounds = node.getBoundingClientRect(); return [...range.getClientRects()].every(rect => rect.left >= bounds.left && rect.right <= bounds.right); })); languageCases++;
      }
    }
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => document.title === 'Cristal Water - Kundenkonto'); assert.equal(await page.locator('#clientAccountTitle').textContent(), headings[4]); assert.deepEqual(await work(page), savedWork);
    await page.setViewportSize({ width: 320, height: 900 }); await capture(page, 'legacy-account-de-320', '.client-account');
    assert(requests.every(request => request.path === '/api/settings/language/me'), 'The account launch page must not read administrative clients, generate invoices or invoke business APIs');
    await page.locator('#clientAccountPortal').click(); await page.waitForURL(base + '/client-portal'); await page.waitForFunction(() => loadedClientId === clientId); assert.equal(await page.evaluate(() => clientId), client.id);
    assert.equal(await page.evaluate(() => localStorage.getItem('cristalwater_jwt')), token); assert.deepEqual(await database(), before);
    await page.goBack({ waitUntil: 'networkidle' }); await page.locator('#clientAccountPortal').waitFor();
    await page.evaluate(() => { document.querySelector('title').firstChild.nodeValue = 'Foreign account title'; document.getElementById('clientAccountTitle').firstChild.nodeValue = 'Foreign account heading <b>{literal}</b>'; document.getElementById('clientAccountIntro').append(document.createElement('span')); const clone = document.getElementById('clientAccountPortal').cloneNode(true); clone.id = 'qaForeignAccountLink'; document.querySelector('.client-account').append(clone); });
    const intro = await page.locator('#clientAccountIntro').innerHTML(), foreign = await page.locator('#qaForeignAccountLink').textContent(); let ownershipCases = 0;
    for (const language of languages) { await page.locator('#cwLanguageSelect').selectOption(language); await settle(page); assert.equal(await page.title(), 'Foreign account title'); assert.equal(await page.locator('#clientAccountTitle').textContent(), 'Foreign account heading <b>{literal}</b>'); assert.equal(await page.locator('#clientAccountIntro').innerHTML(), intro); assert.equal(await page.locator('#qaForeignAccountLink').textContent(), foreign); ownershipCases += 4; }
    await page.evaluate(selectors => { document.querySelector(selectors[0]).firstChild.nodeValue = 'Foreign shell heading <b>{literal}</b>'; document.querySelector(selectors[1]).append(document.createElement('span')); document.querySelector(selectors[2]).setAttribute('data-shell-search','Foreign search metadata'); document.querySelector(selectors[3]).removeAttribute('data-shell-search'); const clone = document.querySelector(selectors[4]).cloneNode(true); clone.id = 'qaForeignNavigationLink'; document.body.append(clone); }, accountNavigationSelectors);
    const foreignNavigation = await Promise.all(accountNavigationSelectors.map(selector => page.locator(selector).innerHTML())), cloneText = await page.locator('#qaForeignNavigationLink').textContent();
    for (const language of languages) { await page.locator('#cwLanguageSelect').selectOption(language); await settle(page); for (const [position,selector] of accountNavigationSelectors.entries()) { if (position < 4) assert.equal(await page.locator(selector).innerHTML(), foreignNavigation[position]); } assert.equal(await page.locator(accountNavigationSelectors[2]).getAttribute('data-shell-search'),'Foreign search metadata'); assert.equal(await page.locator(accountNavigationSelectors[3]).getAttribute('data-shell-search'),null); assert.equal(await page.locator('#qaForeignNavigationLink').textContent(),cloneText); navigationOwnershipCases += 5; }
    assert.deepEqual(errors, []); assert.deepEqual(await database(), before);
    console.log('PASS legacy client account language integration ' + JSON.stringify({ languageCases, textAssertions: 60, ownershipCases, widths: [320,390,1440], languages: 5, noAdministrativeApiOrControls: true, realPortalNavigationWithSameClient: true, storedWorkAndSqlUnchanged: true, retainedLanguageOnReload: true }));
    console.log('PASS shared client navigation copy ' + JSON.stringify({ navigationTextAssertions, navigationOwnershipCases, languages: 5, widths: [320,390,1440], originalNodesDestinationsRetained: true, ownedSearchMetadataLocalized: true, noAccountApiOrSqlChanges: true }));
  } finally { await ctx.close(); }
}
process.on('exit', code => { if (!code && !complete) process.exitCode = 1; });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const pending = page => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('cw-client-portal-requests-v1', 1); request.onerror = () => reject(request.error);
  request.onsuccess = () => { const db = request.result, read = db.transaction('pending').objectStore('pending').getAll(); read.onsuccess = () => { db.close(); resolve(read.result.sort((a, b) => a.kind.localeCompare(b.kind))); }; read.onerror = () => reject(read.error); };
}));
const work = page => page.evaluate(() => ({ local: Object.fromEntries(Object.keys(localStorage).filter(key => /^cwField|^cw:tech|^cwPortal/.test(key)).sort().map(key => [key, localStorage.getItem(key)])), session: Object.fromEntries(Object.keys(sessionStorage).filter(key => /^cwPortal|^cwClientChat/.test(key)).sort().map(key => [key, sessionStorage.getItem(key)])) }));
const fields = page => page.evaluate(() => ({ values: ['messageInput', 'visitRequestInput', 'paymentNoticeAmount', 'paymentNoticeMethod', 'paymentNoticeNote'].map(id => ({ id, value: document.getElementById(id).value, disabled: document.getElementById(id).disabled })), focus: document.activeElement.id, selection: [document.getElementById('messageInput').selectionStart, document.getElementById('messageInput').selectionEnd] }));
const capture = async (page, name, section = '#permissionsPanel') => {
  if (!process.env.CW_PORTAL_EXTRAS_CAPTURE) return;
  await fs.mkdir(process.env.CW_PORTAL_EXTRAS_CAPTURE, { recursive: true }); await page.locator(section).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(process.env.CW_PORTAL_EXTRAS_CAPTURE, name + '.png') });
};
async function database() {
  // Separate fixture-inspection phases from the application's connections;
  // each still uses the actual database and all assertions remain active.
  await prisma.$disconnect();
  try { return await Promise.all([prisma.client.findUnique({ where: { id: client.id } }), prisma.notification.findUnique({ where: { id: notice.id } }), prisma.clientMessage.count({ where: { clientId: client.id } }), prisma.fieldWriteRequest.count(), prisma.stockMovement.count(), prisma.serviceVisit.count(), prisma.extraVisit.count()]); }
  finally { await prisma.$disconnect(); }
}
(async () => {
  client = await prisma.client.create({ data: { id: randomInt(1500000000, 1600000000), name: 'Portal labels <b>{retryExtras}</b>', active: true } });
  const languageKey = 'LANGUAGE:CLIENT:' + client.id; originalLanguage = await prisma.systemSetting.findUnique({ where: { key: languageKey } });
  notice = await prisma.notification.create({ data: { clientId: client.id, role: 'CLIENT', title: 'Tentar novamente', message: '{"key":"retryExtras"} <b>literal source</b>', isRead: false } });
  const user = { id: client.id, clientId: client.id, role: 'CLIENT' }, token = jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  await prisma.$disconnect();
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  async function context(serviceWorkers = 'block') {
    const result = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers, timezoneId: 'Europe/Lisbon' });
    await result.route('https://cdn.socket.io/**', route => route.abort());
    await result.addInitScript(({ user, token }) => { if (localStorage.getItem('qaPortal503')) return; for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); localStorage.setItem('cw_language', 'pt'); localStorage.setItem('qaPortal503', 'true'); }, { user, token });
    return result;
  }
  const ctx = await context(), page = await ctx.newPage(), errors = [], requests = []; page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/')) requests.push({ path: url.pathname, method: request.method() }); });
  const endpoints = { notificationList: 'notifications', permissionsList: 'permissions' };
  let faults = new Set(Object.keys(endpoints)), malformed = false, responseStatus = 503;
  for (const [id, endpoint] of Object.entries(endpoints)) await page.route(base + '/api/client-portal/' + client.id + '/' + endpoint, route => faults.has(id) ? route.fulfill(malformed ? { status: 200, contentType: 'application/json', body: '{broken' } : { status: responseStatus, json: { ok: false, error: '{"key":"retryExtras"} <b>server literal</b>' } }) : route.continue());
  const posts = requests => requests.filter(request => request.method !== 'GET' && request.path !== '/api/settings/language/me');
  await page.goto(base + '/client-portal?lang=pt'); await page.waitForFunction(() => loadedClientId === clientId); await page.waitForLoadState('networkidle');
  await page.locator('#visitRequestInput').fill('Visit preserved <b>{key}</b>');
  await page.route(base + '/api/client-portal/' + client.id + '/visit-requests', route => route.abort('failed'));
  await page.locator('#visitRequestBtn').click(); await page.waitForFunction(() => document.getElementById('visitRequestRecovery').getAttribute('aria-busy') === 'false' && !document.getElementById('visitRequestRetry').hidden);
  await page.locator('#paymentNoticeAmount').fill('123.45'); await page.locator('#paymentNoticeMethod').selectOption('MBWay'); await page.locator('#paymentNoticeNote').fill('Payment note literal {key}');
  await page.route(base + '/api/client-portal/' + client.id + '/payment-notice', route => route.abort('failed'));
  await page.locator('#paymentNoticeBtn').click(); await page.waitForFunction(() => document.getElementById('paymentNoticeRecovery').getAttribute('aria-busy') === 'false' && !document.getElementById('paymentNoticeRetry').hidden);
  await page.locator('#messageInput').fill('Message draft <b>{key}</b>'); await page.locator('#messageInput').focus(); await page.evaluate(() => document.getElementById('messageInput').setSelectionRange(2, 8));
  await page.evaluate(() => { localStorage.setItem('cwFieldLegacyCorrupt:keep', '{broken source bytes'); localStorage.setItem('cwFieldRouteCache:v2:TECH:503', '{"literal":"unrelated route"}'); });
  const originalPending = await pending(page), originalWork = await work(page), savedDatabase = await database();
  assert.equal(originalPending.length, 2); assert.notEqual(originalPending[0].requestId, originalPending[1].requestId);
  assert(originalPending.every(row => row.owner === 'CLIENT:' + client.id && row.payloadHash.length === 64));
  assert.equal(savedDatabase[2], 0, 'Aborted producer requests created no client messages');
  const phasePosts = posts(requests).length;
  async function preserve() { assert.deepEqual(await pending(page), originalPending); assert.deepEqual(await work(page), originalWork); assert.equal(posts(requests).length, phasePosts, 'Labels/retries must not send pending work or acknowledge notices'); }
  async function holdCore() {
    const routes = [];
    const handler = route => routes.push(route);
    await page.route(base + '/api/client-portal/' + client.id + '?*', handler);
    return async () => { await page.unroute(base + '/api/client-portal/' + client.id + '?*', handler); for (const route of routes) await route.continue(); await page.waitForFunction(() => loadedClientId === clientId); await page.waitForLoadState('networkidle'); };
  }
  async function matrix(name, ids) {
    const release = await holdCore();
    await page.locator('#messageInput').focus(); await page.evaluate(() => { document.getElementById('messageInput').setSelectionRange(2, 8); window.qaExtraNodes = [...document.querySelectorAll('#notificationList > p[role=alert], #notificationList > button, #permissionsList > p[role=alert], #permissionsList > button')]; window.qaExtraTextNodes = qaExtraNodes.map(node => node.firstChild); });
    await page.locator('#cwLanguageSelect').selectOption('pt'); await page.waitForFunction(() => loadedClientId === 0 && document.getElementById('messageInput').disabled); await settle(page);
    const before = await fields(page);
    const quoteReads = requests.filter(request => request.path.endsWith('/quotes')).length;
    try {
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [index, language] of languages.entries()) {
          await page.locator('#cwLanguageSelect').selectOption(language); await settle(page);
          assert.equal(await page.evaluate(() => portalLanguage), language);
          await quotePresentation(page, index); assert.equal(requests.filter(request => request.path.endsWith('/quotes')).length, quoteReads);
          for (const id of ids) { assert.equal(await page.locator('#' + id + ' > button').textContent(), retryLabels[index]); assert.equal(await page.locator('#' + id + ' > p[role=alert]').textContent(), errorLabels[index]); }
          assert(await page.evaluate(() => qaExtraNodes.every((node, index) => node.isConnected && node.firstChild === qaExtraTextNodes[index])));
          assert.deepEqual(await fields(page), before); await preserve();
          for (const id of ids) { const rect = await page.locator('#' + id + ' > button').boundingBox(); assert(rect.x >= 0 && rect.x + rect.width <= width && rect.height >= 44, JSON.stringify({ name, id, width, language, rect })); }
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); checks++;
        }
      }
      await page.setViewportSize({ width: 320, height: 900 }); await capture(page, name + '-de-320');
    } finally { await release(); }
    assert.deepEqual(await database(), savedDatabase); await preserve();
    console.log('PASS portal extras labels ' + JSON.stringify({ name, widths: [320, 390, 1440], languages: 5, originalLabelsFocusDraftsAndPendingPreserved: true, pendingRequests: 2 }));
  }
  // Pure repaint retains a focused composer. Actual selector reloads below
  // retain the original busy guard, which disables it while its read is held.
  await page.locator('#messageInput').focus(); await page.evaluate(() => document.getElementById('messageInput').setSelectionRange(2, 8));
  const idleFields = await fields(page), coreReads = () => requests.filter(request => request.path === '/api/client-portal/' + client.id).length, idleReads = coreReads();
  const idleQuoteReads = requests.filter(request => request.path.endsWith('/quotes')).length;
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 900 }); for (const [index, language] of languages.entries()) {
    await page.evaluate(language => { queryLanguage = language; applyLanguage(language); }, language); await settle(page);
    await quotePresentation(page, index); assert.equal(requests.filter(request => request.path.endsWith('/quotes')).length, idleQuoteReads);
    for (const id of Object.keys(endpoints)) { assert.equal(await page.locator('#' + id + ' > button').textContent(), retryLabels[index]); assert.equal(await page.locator('#' + id + ' > p[role=alert]').textContent(), errorLabels[index]); }
    assert.deepEqual(await fields(page), idleFields); assert.equal(coreReads(), idleReads); await preserve(); checks++;
  } }
  console.log('PASS pure portal extras repaint: original focused composer and selection preserved without a core reload');
  // Inspect the private attribute painter without a core reload, then keep
  // the original selector's primary-read busy guard while its requests wait.
  const accessibleSelectors = ['.cw-v2-sidebar', '.cw-v2-mobile-nav', '#cwLanguageSelect', '#adminClientSelect', '.portal-title', '#serviceHistoryPool', '#serviceHistoryPeriod', '#serviceHistoryDate', '#mensagens', '.cw-v2-search [data-cw-search-input]'];
  const accessibleNames = [
    ['Navegação do cliente', 'Client navigation', 'Navigation du client', 'Navegación del cliente', 'Kundennavigation'],
    ['Navegação móvel', 'Mobile navigation', 'Navigation mobile', 'Navegación móvil', 'Mobile Navigation'],
    ['Idioma', 'Language', 'Langue', 'Idioma', 'Sprache'],
    ['Escolher cliente', 'Choose client', 'Choisir un client', 'Seleccionar cliente', 'Kunde auswählen'],
    ['Resumo principal do cliente', 'Main client summary', 'Résumé principal du client', 'Resumen principal del cliente', 'Kundenübersicht'],
    ['Piscina', 'Pool', 'Piscine', 'Piscina', 'Pool'],
    ['Período', 'Period', 'Période', 'Período', 'Zeitraum'],
    ['Data de referência', 'Reference date', 'Date de référence', 'Fecha de referencia', 'Bezugsdatum'],
    ['Mensagens com administração', 'Messages with administration', 'Messages avec l’administration', 'Mensajes con la administración', 'Nachrichten mit der Verwaltung'],
    ['Pesquisar relatório, fatura, mensagem ou visita', 'Search for a report, invoice, message or visit', 'Rechercher un rapport, une facture, un message ou une visite', 'Buscar informe, factura, mensaje o visita', 'Bericht, Rechnung, Nachricht oder Besuch suchen'],
  ];
  let accessibleLabelCases = 0, accessibleOwnershipControls = 0;
  const search = page.locator('.cw-v2-search [data-cw-search-input]'), originalSearchValue = await search.inputValue();
  await search.fill('Search draft <b>{portalSearchPlaceholder}</b>');
  await page.evaluate(selectors => { window.qaAccessibleNodes = selectors.map(selector => document.querySelector(selector)); window.qaAccessibleSearch = qaAccessibleNodes.at(-1); }, accessibleSelectors);
  async function accessibleLabels(index) {
    for (const [position, selector] of accessibleSelectors.entries()) {
      assert.equal(await page.locator(selector).getAttribute(position === 9 ? 'placeholder' : 'aria-label'), accessibleNames[position][index]); accessibleLabelCases++;
    }
    assert(await page.evaluate(selectors => selectors.every((selector, index) => document.querySelector(selector) === qaAccessibleNodes[index]), accessibleSelectors));
    assert.equal(await search.inputValue(), 'Search draft <b>{portalSearchPlaceholder}</b>'); await preserve();
  }
  const accessibleReadCount = requests.length;
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 900 }); for (const [index, language] of languages.entries()) {
    const focus = await page.evaluate(language => {
      const originalLanguage = portalLanguage; portalLanguage = language; qaAccessibleSearch.focus(); qaAccessibleSearch.setSelectionRange(2, 8);
      const snapshot = () => ({ focused: document.activeElement === qaAccessibleSearch, value: qaAccessibleSearch.value, start: qaAccessibleSearch.selectionStart, end: qaAccessibleSearch.selectionEnd, disabled: qaAccessibleSearch.disabled });
      const before = snapshot(); portalExtrasLabels.paint(); const after = snapshot(); portalLanguage = originalLanguage; return { before, after };
    }, language);
    assert.equal(focus.before.focused, true); assert.deepEqual(focus.after, focus.before); await accessibleLabels(index);
    assert.equal(requests.length, accessibleReadCount, 'Private attribute painting must not read or submit');
  } }
  const releaseAccessibleCore = await holdCore();
  try { for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 900 }); for (const [index, language] of languages.entries()) {
    await page.locator('#cwLanguageSelect').selectOption(language); await page.waitForFunction(() => loadedClientId === 0 && document.getElementById('messageInput').disabled); await settle(page);
    await accessibleLabels(index); assert.equal(posts(requests).length, phasePosts);
  } } } finally { await releaseAccessibleCore(); }
  for (const kind of ['changed-attribute', 'removed-attribute', 'foreign-clone']) {
    const foreignPage = await ctx.newPage(), foreignRequests = [];
    foreignPage.on('request', request => foreignRequests.push({ method: request.method(), path: new URL(request.url()).pathname }));
    await foreignPage.goto(base + '/client-portal?lang=pt'); await foreignPage.waitForFunction(() => loadedClientId === clientId); await foreignPage.waitForLoadState('networkidle'); const foreignWork = await work(foreignPage);
    await foreignPage.evaluate(kind => {
      const node = document.getElementById('serviceHistoryDate');
      if (kind === 'changed-attribute') node.setAttribute('aria-label', 'Operator literal <b>{portalHistoryDateAria}</b>');
      else if (kind === 'removed-attribute') node.removeAttribute('aria-label');
      else { const clone = node.cloneNode(true); clone.setAttribute('aria-label', 'Foreign literal {portalHistoryDateAria}'); clone.dataset.cwI18n = 'portalHistoryDateAria'; node.replaceWith(clone); }
      window.qaForeignAccessible = document.getElementById('serviceHistoryDate'); window.qaForeignAccessibleLabel = qaForeignAccessible.getAttribute('aria-label');
    }, kind);
    for (const language of languages) {
      await foreignPage.evaluate(language => { const originalLanguage = portalLanguage; portalLanguage = language; portalExtrasLabels.paint(); portalLanguage = originalLanguage; }, language);
      assert(await foreignPage.evaluate(() => document.getElementById('serviceHistoryDate') === qaForeignAccessible && qaForeignAccessible.getAttribute('aria-label') === qaForeignAccessibleLabel)); accessibleOwnershipControls++;
    }
    assert.equal(posts(foreignRequests).filter(request => request.path !== '/api/client-messages/seen/' + client.id).length, 0); assert.deepEqual(await pending(foreignPage), originalPending); assert.deepEqual(await work(foreignPage), foreignWork); await foreignPage.close();
  }
  await search.fill(originalSearchValue); await page.locator('#messageInput').focus(); await page.evaluate(() => document.getElementById('messageInput').setSelectionRange(2, 8));
  assert.deepEqual(await database(), savedDatabase);
  console.log('PASS portal accessible attributes ' + JSON.stringify({ accessibleLabelCases, accessibleOwnershipControls, labels: 10, languages: 5, widths: [320, 390, 1440], privatePaintRetainsSearchFocusValueSelectionAndNodes: true, noPrivatePaintReadsOrWrites: true, originalSelectorPrimaryBusyGuardRetained: true, pendingRequests: 2 }));
  // The two original sidebar leaves own their copy independently of the
  // global translator; changing language never changes their destinations.
  const sidebarSelectors = ['.cw-v2-nav a[href="#permissionsPanel"]', '.cw-v2-sidebar > .small'];
  const sidebarNames = [
    ['Pedidos', 'Requests', 'Demandes', 'Solicitudes', 'Anfragen'],
    ['Experiência premium simples e calma.', 'A simple, calm premium experience.', 'Une expérience premium simple et sereine.', 'Una experiencia premium sencilla y tranquila.', 'Ein einfaches, entspanntes Premium-Erlebnis.'],
  ];
  let sidebarTextCases = 0, sidebarMetadataCases = 0, sidebarOwnershipControls = 0;
  await page.evaluate(selectors => {
    window.qaSidebarNodes = selectors.map(selector => document.querySelector(selector)); window.qaSidebarLeaves = qaSidebarNodes.map(node => node.firstChild);
    window.qaSidebarDestinations = Array.from(document.querySelectorAll('.cw-v2-nav a,.cw-v2-mobile-nav a')).map(node => node.getAttribute('href'));
  }, sidebarSelectors);
  async function sidebarLabels(index) {
    for (const [position, selector] of sidebarSelectors.entries()) { assert.equal(await page.locator(selector).textContent(), sidebarNames[position][index]); sidebarTextCases++; }
    assert.equal(await page.locator(sidebarSelectors[0]).getAttribute('data-shell-search'), sidebarNames[0][index]); sidebarMetadataCases++;
    assert.equal(await page.locator(sidebarSelectors[0]).getAttribute('href'), '#permissionsPanel');
    assert.equal(await page.locator(sidebarSelectors[0]).getAttribute('aria-label'), null, 'The original visible link text remains its accessible name');
    assert(await page.evaluate(selectors => selectors.every((selector, index) => document.querySelector(selector) === qaSidebarNodes[index] && qaSidebarNodes[index].firstChild === qaSidebarLeaves[index]), sidebarSelectors));
    assert(await page.evaluate(() => JSON.stringify(Array.from(document.querySelectorAll('.cw-v2-nav a,.cw-v2-mobile-nav a')).map(node => node.getAttribute('href'))) === JSON.stringify(qaSidebarDestinations)));
    if (page.viewportSize().width === 1440) {
      for (const selector of sidebarSelectors) { const rect = await page.locator(selector).boundingBox(); assert(rect && rect.x >= 0 && rect.x + rect.width <= 1440); }
      const rect = await page.locator(sidebarSelectors[0]).boundingBox(); assert(rect.height >= 44);
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await preserve();
  }
  const sidebarReadCount = requests.length;
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 900 }); for (const [index, language] of languages.entries()) {
    const focus = await page.evaluate(language => {
      const originalLanguage = portalLanguage; portalLanguage = language; const input = document.getElementById('messageInput'); input.focus(); input.setSelectionRange(2, 8);
      const snapshot = () => ({ focus: document.activeElement === input, value: input.value, start: input.selectionStart, end: input.selectionEnd, disabled: input.disabled });
      const before = snapshot(); portalExtrasLabels.paint(); const after = snapshot(); portalLanguage = originalLanguage; return { before, after };
    }, language);
    assert.equal(focus.before.focus, true); assert.deepEqual(focus.after, focus.before); await sidebarLabels(index);
    assert.equal(requests.length, sidebarReadCount, 'Private sidebar painting must not read or submit');
  } }
  const releaseSidebarCore = await holdCore();
  try { for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 900 }); for (const [index, language] of languages.entries()) {
    await page.locator('#cwLanguageSelect').selectOption(language); await page.waitForFunction(() => loadedClientId === 0 && document.getElementById('messageInput').disabled); await settle(page);
    await sidebarLabels(index); assert.equal(posts(requests).length, phasePosts);
  } } } finally { await releaseSidebarCore(); }
  const sidebarPathname = new URL(page.url()).pathname;
  await page.locator(sidebarSelectors[0]).click(); assert.equal(new URL(page.url()).pathname, sidebarPathname); assert.equal(new URL(page.url()).hash, '#permissionsPanel'); await preserve();
  await capture(page, 'sidebar-de-1440', '.cw-v2-sidebar');
  for (const kind of ['changed-request-leaf', 'foreign-request-clone', 'changed-tagline-leaf', 'foreign-tagline-clone', 'changed-metadata', 'removed-metadata']) {
    const foreignPage = await ctx.newPage(), foreignRequests = [];
    foreignPage.on('request', request => foreignRequests.push({ method: request.method(), path: new URL(request.url()).pathname }));
    await foreignPage.goto(base + '/client-portal?lang=pt'); await foreignPage.waitForFunction(() => loadedClientId === clientId); await foreignPage.waitForLoadState('networkidle'); const foreignWork = await work(foreignPage);
    await foreignPage.evaluate(kind => {
      const selector = kind.includes('tagline') ? '.cw-v2-sidebar > .small' : '.cw-v2-nav a[href="#permissionsPanel"]'; let node = document.querySelector(selector);
      if (kind === 'changed-metadata') node.setAttribute('data-shell-search', 'Operator metadata literal <b>{portalRequestsNavigation}</b>');
      else if (kind === 'removed-metadata') node.removeAttribute('data-shell-search');
      else if (kind.startsWith('changed-')) node.firstChild.nodeValue = 'Operator sidebar literal <b>{portalSidebarTagline}</b>';
      else { const clone = node.cloneNode(true); clone.textContent = 'Foreign sidebar literal {portalSidebarTagline}'; clone.dataset.cwI18n = 'portalSidebarTagline'; if (!kind.includes('tagline')) clone.setAttribute('data-shell-search', 'Foreign metadata literal {portalRequestsNavigation}'); node.replaceWith(clone); node = clone; }
      window.qaForeignSidebar = node; window.qaForeignSidebarLeaf = node.firstChild; window.qaForeignSidebarText = node.textContent; window.qaForeignSidebarMetadata = node.getAttribute('data-shell-search');
    }, kind);
    for (const language of languages) {
      const retained = await foreignPage.evaluate(({ kind, language }) => {
        const originalLanguage = portalLanguage; portalLanguage = language; portalExtrasLabels.paint(); portalLanguage = originalLanguage;
        const selector = kind.includes('tagline') ? '.cw-v2-sidebar > .small' : '.cw-v2-nav a[href="#permissionsPanel"]';
        return document.querySelector(selector) === qaForeignSidebar && qaForeignSidebar.firstChild === qaForeignSidebarLeaf &&
          (kind.endsWith('metadata') ? qaForeignSidebar.getAttribute('data-shell-search') === qaForeignSidebarMetadata : qaForeignSidebar.textContent === qaForeignSidebarText) &&
          (kind !== 'foreign-request-clone' || qaForeignSidebar.getAttribute('data-shell-search') === qaForeignSidebarMetadata);
      }, { kind, language });
      assert(retained); sidebarOwnershipControls++;
    }
    assert.equal(posts(foreignRequests).filter(request => request.path !== '/api/client-messages/seen/' + client.id).length, 0); assert.deepEqual(await pending(foreignPage), originalPending); assert.deepEqual(await work(foreignPage), foreignWork); await foreignPage.close();
  }
  assert.deepEqual(await database(), savedDatabase);
  console.log('PASS portal sidebar ' + JSON.stringify({ sidebarTextCases, sidebarMetadataCases, sidebarOwnershipControls, leaves: 2, dictionaryVariants: 10, languages: 5, widths: [320, 390, 1440], originalNodesAndTextLeavesRetained: true, privatePaintRetainsDraftFocusSelectionAndDisabledState: true, noPrivatePaintReadsOrWrites: true, originalSelectorPrimaryBusyGuardRetained: true, canonicalHashNavigation: true, pendingRequests: 2 }));
  await matrix('both-503', Object.keys(endpoints));
  for (const [name, selectedFaults] of [['notification-503', ['notificationList']], ['permissions-503', ['permissionsList']], ['both-invalid-ok', Object.keys(endpoints)], ['both-malformed', Object.keys(endpoints)]]) {
    faults = new Set(selectedFaults); responseStatus = name === 'both-invalid-ok' ? 200 : 503; malformed = name === 'both-malformed';
    await page.evaluate(() => loadCustomerExtras()); await page.waitForLoadState('networkidle'); await matrix(name, selectedFaults);
    if (!faults.has('notificationList')) { assert.equal(await page.locator('#notificationList .service-title').textContent(), notice.title); assert((await page.locator('#notificationList').textContent()).includes(notice.message)); assert.equal(await page.locator('#notificationList .service-title b').count(), 0); }
  }
  // Actual retries keep the existing two-section callback and native responses.
  faults = new Set(); malformed = false;
  const beforeRetry = requests.length; await page.locator('#permissionsList > button').click(); await page.locator('#permissionsList > button').waitFor({ state: 'detached' }); await page.locator('#notificationList > button').waitFor({ state: 'detached' }); await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('#notificationList > button').count(), 0); assert.equal(await page.locator('#permissionsList > button').count(), 0);
  for (const endpoint of Object.values(endpoints)) assert.equal(requests.slice(beforeRetry).filter(request => request.path === '/api/client-portal/' + client.id + '/' + endpoint).length, 1);
  assert.equal(await page.locator('#notificationList .service-title').textContent(), notice.title); assert((await page.locator('#notificationList').textContent()).includes(notice.message));
  await preserve(); assert.deepEqual(await database(), savedDatabase); checks++;
  faults = new Set(Object.keys(endpoints)); responseStatus = 503; await page.evaluate(() => loadCustomerExtras()); await page.waitForLoadState('networkidle');
  for (const kind of ['changed-leaf', 'replaced-node']) {
    await page.evaluate(kind => { const button = document.querySelector('#permissionsList > button'); if (kind === 'changed-leaf') button.firstChild.nodeValue = 'Operator literal <b>{retryExtras}</b>'; else { const clone = button.cloneNode(); clone.textContent = 'Foreign retry literal {retryExtras}'; button.replaceWith(clone); } window.qaForeignExtra = document.querySelector('#permissionsList > button'); }, kind);
    const release = await holdCore();
    try { for (const language of languages) { await page.locator('#cwLanguageSelect').selectOption(language); await settle(page); assert.equal(await page.locator('#permissionsList > button').textContent(), kind === 'changed-leaf' ? 'Operator literal <b>{retryExtras}</b>' : 'Foreign retry literal {retryExtras}'); assert(await page.evaluate(() => document.querySelector('#permissionsList > button') === qaForeignExtra)); await preserve(); checks++; } }
    finally { await release(); }
    await page.evaluate(() => loadCustomerExtras()); await page.waitForLoadState('networkidle');
  }
  assert.deepEqual(errors, []); await ctx.close();
  // Compare the real worker shell with current source before warm and cold
  // offline cases; both retain the original producer guards and pending work.
  const offline = await context('allow'), offlinePage = await offline.newPage(); offlinePage.setDefaultTimeout(12000);
  await offlinePage.goto(base + '/admin-login'); await offlinePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await offlinePage.goto(base + '/client-portal?lang=de'); await offlinePage.waitForFunction(() => loadedClientId === clientId); await offlinePage.waitForLoadState('networkidle');
  for (const [url, file] of [['/client-portal?lang=de', 'client-portal.html'], ['/client-portal.js', 'client-portal.js'], ['/cw-auth.js', 'cw-auth.js'], ['/client-quotes.js', 'client-quotes.js'], ['/cw-professional-portals.css', 'cw-professional-portals.css']]) {
    await offlinePage.waitForFunction(async url => Boolean(await (await caches.open('cristalwater-field-20261003-v333')).match(url)), url);
    assert.equal(await offlinePage.evaluate(async url => (await (await caches.open('cristalwater-field-20261003-v333')).match(url)).text(), url), await fs.readFile(path.join(__dirname, '../frontend', file), 'utf8'));
  }
  await offlinePage.route(base + '/api/client-portal/' + client.id + '/visit-requests', route => route.abort('failed'));
  await offlinePage.route(base + '/api/client-portal/' + client.id + '/payment-notice', route => route.abort('failed'));
  await offlinePage.locator('#visitRequestInput').fill('Cold visit pending <b>{retryExtras}</b>'); await offlinePage.locator('#visitRequestBtn').click(); await offlinePage.waitForFunction(() => document.getElementById('visitRequestRecovery').getAttribute('aria-busy') === 'false' && !document.getElementById('visitRequestRetry').hidden);
  await offlinePage.locator('#paymentNoticeAmount').fill('98.76'); await offlinePage.locator('#paymentNoticeMethod').selectOption('MBWay'); await offlinePage.locator('#paymentNoticeNote').fill('Cold payment pending exact'); await offlinePage.locator('#paymentNoticeBtn').click(); await offlinePage.waitForFunction(() => document.getElementById('paymentNoticeRecovery').getAttribute('aria-busy') === 'false' && !document.getElementById('paymentNoticeRetry').hidden);
  await offlinePage.locator('#messageInput').fill('Offline message draft exact');
  const coldPending = await pending(offlinePage); assert.equal(coldPending.length, 2); assert.notEqual(coldPending[0].requestId, coldPending[1].requestId); assert(coldPending.every(row => row.owner === 'CLIENT:' + client.id && row.payloadHash.length === 64));
  const coldValues = (await fields(offlinePage)).values.map(({ id, value }) => ({ id, value }));
  const coldSession = await offlinePage.evaluate(() => Object.fromEntries(['token', 'cristalwater_jwt', 'user', 'cristalwater_user'].map(key => [key, localStorage.getItem(key)])));
  const coldRequests = []; offlinePage.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/')) coldRequests.push({ path: url.pathname, method: request.method() }); });
  const offlineWork = await work(offlinePage); await offline.setOffline(true); await offlinePage.evaluate(() => loadCustomerExtras());
  for (const [index, language] of languages.entries()) { await offlinePage.locator('#cwLanguageSelect').selectOption(language); await settle(offlinePage); await quotePresentation(offlinePage, index); for (const id of Object.keys(endpoints)) assert.equal(await offlinePage.locator('#' + id + ' > button').textContent(), retryLabels[index]); assert.equal(await offlinePage.locator('#messageInput').inputValue(), 'Offline message draft exact'); assert.deepEqual(await work(offlinePage), offlineWork); checks++; }
  await offlinePage.setViewportSize({ width: 320, height: 900 }); await capture(offlinePage, 'offline-de-320');
  // A real cached-document reload must replace the original HTML loaders even
  // though the primary read fails before the extra-section requests are made.
  await offlinePage.reload({ waitUntil: 'domcontentloaded' });
  await offlinePage.locator('#notificationList > p[role=alert]').waitFor(); await offlinePage.locator('#permissionsList > p[role=alert]').waitFor();
  await offlinePage.waitForFunction(() => document.getElementById('messageInput').value === 'Offline message draft exact'); await offlinePage.waitForLoadState('networkidle');
  async function coldPreserve() {
    assert.deepEqual(await pending(offlinePage), coldPending); assert.deepEqual(await work(offlinePage), offlineWork);
    assert.deepEqual((await fields(offlinePage)).values.map(({ id, value }) => ({ id, value })), coldValues);
    assert.deepEqual(await offlinePage.evaluate(() => Object.fromEntries(['token', 'cristalwater_jwt', 'user', 'cristalwater_user'].map(key => [key, localStorage.getItem(key)]))), coldSession);
    assert.equal(coldRequests.filter(request => request.method !== 'GET' && request.path !== '/api/settings/language/me' && request.path !== '/api/client-messages/seen/' + client.id).length, 0, 'Cold labels and primary retries cannot send any producer or notification acknowledgement');
  }
  async function coldLabels() {
    const index = languages.indexOf(await offlinePage.evaluate(() => portalLanguage)), width = await offlinePage.evaluate(() => innerWidth);
    await quotePresentation(offlinePage, index); assert((await offlinePage.locator('#clientQuotesStatus').textContent()).startsWith(quoteLoadErrors[index]));
    for (const id of Object.keys(endpoints)) {
      assert.equal(await offlinePage.locator('#' + id + ' > p[role=alert]').textContent(), errorLabels[index]); assert.equal(await offlinePage.locator('#' + id + ' > button').textContent(), retryLabels[index]);
      const rect = await offlinePage.locator('#' + id + ' > button').boundingBox(); assert(rect.x >= 0 && rect.x + rect.width <= width && rect.height >= 44);
    }
    assert.equal(await offlinePage.evaluate(() => loadedClientId), 0);
    for (const id of ['messageInput', 'sendBtn', 'photoBtn', 'visitRequestBtn', 'paymentNoticeBtn', 'visitRequestRetry', 'paymentNoticeRetry']) assert.equal(await offlinePage.locator('#' + id).isDisabled(), true);
    assert(await offlinePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await coldPreserve();
  }
  async function coldMatrix(name) {
    const guardedReads = () => coldRequests.filter(request => request.method === 'GET' && (request.path === '/api/client-portal/' + client.id || Object.values(endpoints).some(endpoint => request.path === '/api/client-portal/' + client.id + '/' + endpoint))).length;
    const fieldsBeforePaint = await fields(offlinePage), reads = guardedReads();
    await offlinePage.evaluate(() => { window.qaColdNodes = [...document.querySelectorAll('#notificationList > p[role=alert],#notificationList > button,#permissionsList > p[role=alert],#permissionsList > button')]; window.qaColdTextNodes = qaColdNodes.map(node => node.firstChild); });
    for (const width of [320, 390, 1440]) { await offlinePage.setViewportSize({ width, height: 900 }); for (const language of languages) {
      await offlinePage.evaluate(language => { queryLanguage = language; applyLanguage(language); }, language); await settle(offlinePage); await coldLabels();
      assert.deepEqual(await fields(offlinePage), fieldsBeforePaint); assert.equal(guardedReads(), reads); assert(await offlinePage.evaluate(() => qaColdNodes.every((node, index) => node.isConnected && node.firstChild === qaColdTextNodes[index]))); checks++;
    } }
    for (const width of [320, 390, 1440]) { await offlinePage.setViewportSize({ width, height: 900 }); for (const language of languages) {
      await offlinePage.evaluate(() => { window.qaColdPrevious = document.querySelector('#notificationList > button'); });
      await offlinePage.locator('#cwLanguageSelect').selectOption(language); await offlinePage.waitForFunction(() => !qaColdPrevious.isConnected); await offlinePage.waitForLoadState('networkidle'); await coldLabels(); checks++;
    } }
    await offlinePage.setViewportSize({ width: 320, height: 900 }); await capture(offlinePage, 'cold-' + name + '-de-320');
    console.log('PASS cold portal extras ' + JSON.stringify({ name, languages: 5, widths: [320, 390, 1440], pureAndActualSelectorCases: 30, originalBusyGuard: true, exactPendingRequests: 2 }));
  }
  await coldMatrix('offline-cache-reload');
  // Direct producer calls remain blocked by the existing primary-read guard.
  await offlinePage.evaluate(() => Promise.all([requestVisit(), notifyPayment(), sendMessage()])); await coldLabels();
  const corePath = '/api/client-portal/' + client.id, coldCoreReads = () => coldRequests.filter(request => request.method === 'GET' && request.path === corePath).length;
  let beforeCore = coldCoreReads(); await offlinePage.evaluate(() => { window.qaColdPrevious = document.querySelector('#notificationList > button'); });
  await offlinePage.locator('#notificationList > button').click(); await offlinePage.waitForFunction(() => !qaColdPrevious.isConnected); await offlinePage.waitForLoadState('networkidle');
  assert.equal(coldCoreReads(), beforeCore + 1); await coldLabels(); checks++;
  // These are primary-read faults; otherwise native extra endpoints stay live.
  await offline.setOffline(false); let coreFault = '503';
  const serverLiteral = '{"key":"retryExtras"} <b>primary source literal</b>';
  await offlinePage.route(base + corePath + '?*', route => coreFault ? route.fulfill(coreFault === 'malformed' ? { status: 200, contentType: 'application/json', body: '{broken' } : { status: coreFault === '503' ? 503 : 200, json: { ok: false, error: serverLiteral } }) : route.continue());
  for (const name of ['503', 'ok-false', 'malformed']) {
    coreFault = name; const beforeExtras = coldRequests.filter(request => Object.values(endpoints).some(endpoint => request.path === corePath + '/' + endpoint)).length;
    await offlinePage.evaluate(() => { window.qaColdPrevious = document.querySelector('#notificationList > button'); });
    await offlinePage.locator('#permissionsList > button').click(); await offlinePage.waitForFunction(() => !qaColdPrevious.isConnected); await offlinePage.waitForLoadState('networkidle');
    await coldMatrix(name);
    assert.equal(coldRequests.filter(request => Object.values(endpoints).some(endpoint => request.path === corePath + '/' + endpoint)).length, beforeExtras, 'Primary failure must not launch extra reads');
    if (name !== 'malformed') { assert.equal(await offlinePage.locator('#poolsList .empty').textContent(), serverLiteral); assert.equal(await offlinePage.locator('#poolsList b').count(), 0); }
    assert.deepEqual(await database(), savedDatabase);
  }
  // Recovery reuses the original primary loader and its two native extra reads.
  coreFault = null; beforeCore = coldCoreReads(); const beforeRecovery = coldRequests.length;
  await offlinePage.locator('#notificationList > button').click(); await offlinePage.waitForFunction(() => loadedClientId === clientId); await offlinePage.locator('#permissionsList > button').waitFor({ state: 'detached' }); await offlinePage.locator('#notificationList > button').waitFor({ state: 'detached' }); await offlinePage.waitForLoadState('networkidle');
  assert.equal(coldCoreReads(), beforeCore + 1); for (const endpoint of Object.values(endpoints)) assert.equal(coldRequests.slice(beforeRecovery).filter(request => request.path === corePath + '/' + endpoint).length, 1);
  assert.equal(await offlinePage.locator('#notificationList .service-title').textContent(), notice.title); assert((await offlinePage.locator('#notificationList').textContent()).includes(notice.message));
  await coldPreserve(); assert.equal(await offlinePage.locator('#messageInput').isDisabled(), false); assert.deepEqual(await database(), savedDatabase); checks++;
  // Healthy responses must render Spanish notifications instead of presenting
  // the extra-section error view. Only an explicit read acknowledgement may
  // change the fixture; every pending producer record remains unchanged.
  const noticeReadPath = '/api/notifications/' + notice.id + '/read', noticeStart = coldRequests.length;
  const noticeLabels = {
    heading: ['Notificações', 'Notifications', 'Notifications', 'Notificaciones', 'Mitteilungen'], updates: ['Atualizações', 'Updates', 'Actualités', 'Actualizaciones', 'Neuigkeiten'], support: ['Suporte', 'Support', 'Assistance', 'Asistencia', 'Hilfe'],
    mark: ['Marcar como lida', 'Mark as read', 'Marquer comme lue', 'Marcar como leída', 'Als gelesen markieren'], unread: ['Por ler', 'Unread', 'Non lue', 'Sin leer', 'Ungelesen'], read: ['Lida', 'Read', 'Lue', 'Leída', 'Gelesen'],
    error: ['Não foi possível confirmar a leitura. Tente novamente.', 'Could not confirm reading. Please try again.', 'Impossible de confirmer la lecture. Réessayez.', 'No se pudo confirmar la lectura. Vuelve a intentarlo.', 'Lesebestätigung fehlgeschlagen. Bitte erneut versuchen.'],
  };
  let healthyNoticeCases = 0, stationaryNoticeTargets = 0;
  async function stationaryNoticeTarget(state, language) {
    const button = offlinePage.locator('#notificationList [data-notice-read]');
    await button.scrollIntoViewIfNeeded(); await offlinePage.mouse.move(0, 0); await settle(offlinePage);
    const before = await button.boundingBox();
    await offlinePage.mouse.move(before.x + before.width / 2, before.y + before.height / 2); await settle(offlinePage);
    const hovered = await button.boundingBox();
    const motion = await button.evaluate(node => ({ transform: getComputedStyle(node).transform, hovered: node.matches(':hover') }));
    assert.equal(motion.hovered, true, 'Native pointer must reach the notification target');
    assert.equal(motion.transform, 'none', 'Notification target must remain stationary: ' + JSON.stringify({ state, language, before, hovered, motion }));
    assert.deepEqual(hovered, before, 'Notification hover cannot move or resize its target');
    assert(hovered.height >= 44 && hovered.x >= 0 && hovered.x + hovered.width <= offlinePage.viewportSize().width);
    await offlinePage.mouse.move(0, 0); await settle(offlinePage);
    assert.deepEqual(await button.boundingBox(), before, 'Notification target must remain stationary when the pointer leaves'); stationaryNoticeTargets++;
  }
  async function noticePreserve() {
    assert.deepEqual(await pending(offlinePage), coldPending); assert.deepEqual(await work(offlinePage), offlineWork);
    assert.deepEqual((await fields(offlinePage)).values.map(({ id, value }) => ({ id, value })), coldValues);
    assert.deepEqual(await offlinePage.evaluate(() => Object.fromEntries(['token', 'cristalwater_jwt', 'user', 'cristalwater_user'].map(key => [key, localStorage.getItem(key)]))), coldSession);
    assert.equal(coldRequests.filter(request => request.method !== 'GET' && request.path !== '/api/settings/language/me' && request.path !== '/api/client-messages/seen/' + client.id && request.path !== noticeReadPath).length, 0, 'Notification labels/read acknowledgement cannot send pending producers');
  }
  async function noticeNodes() { await offlinePage.evaluate(() => { window.qaNoticeNodes = [...document.querySelectorAll('#notificationsTitle,#notificationsPill,#notificationList .service-title,#notificationList .pill,#notificationList button,#notificationList [role=status]')]; window.qaNoticeLeaves = qaNoticeNodes.map(node => node.firstChild); }); }
  async function healthyLabels(index, state, retainedButton = true) {
    for (const [id, key] of [['notificationsTitle', 'heading'], ['notificationsPill', 'updates'], ['permissionsPill', 'support']]) assert.equal(await offlinePage.locator('#' + id).textContent(), noticeLabels[key][index]);
    const headingLines = await offlinePage.evaluate(() => ['notificationsTitle', 'notificationsPill', 'permissionsPill'].map(id => { const range = document.createRange(); range.selectNodeContents(document.getElementById(id)); return { id, lines: range.getClientRects().length }; }));
    for (const item of headingLines) assert.equal(item.lines, 1, 'Notification/support words must remain whole: ' + item.id);
    assert.equal(await offlinePage.locator('#notificationList .service-title').textContent(), notice.title); assert((await offlinePage.locator('#notificationList').textContent()).includes(notice.message)); assert.equal(await offlinePage.locator('#notificationList .service-title b').count(), 0);
    assert.equal(await offlinePage.locator('#notificationList .pill').textContent(), noticeLabels[state === 'read' ? 'read' : 'unread'][index]);
    if (retainedButton) { assert.equal(await offlinePage.locator('#notificationList [data-notice-read]').textContent(), noticeLabels[state === 'read' ? 'read' : 'mark'][index]); assert.equal(await offlinePage.locator('#notificationList [data-notice-read]').isDisabled(), state === 'busy' || state === 'read'); const rect = await offlinePage.locator('#notificationList [data-notice-read]').boundingBox(); assert(rect.height >= 44 && rect.x >= 0 && rect.x + rect.width <= offlinePage.viewportSize().width); }
    else assert.equal(await offlinePage.locator('#notificationList [data-notice-read]').count(), 0);
    if (state === 'failed') assert.equal(await offlinePage.locator('#notificationList [role=status]').textContent(), noticeLabels.error[index]);
    assert.equal(await offlinePage.locator('#notificationList > p[role=alert]').count(), 0); assert.equal(await offlinePage.locator('#permissionsList > p[role=alert]').count(), 0); await noticePreserve();
  }
  async function healthyMatrix(state) {
    const guardedReads = () => coldRequests.filter(request => request.method === 'GET' && (request.path === corePath || Object.values(endpoints).some(endpoint => request.path === corePath + '/' + endpoint))).length;
    const readsBefore = guardedReads(), writesBefore = coldRequests.filter(request => request.path === noticeReadPath).length;
    await offlinePage.locator('#messageInput').focus(); await offlinePage.evaluate(() => document.getElementById('messageInput').setSelectionRange(2, 8)); const before = await fields(offlinePage); await noticeNodes();
    for (const width of [320, 390, 1440]) { await offlinePage.setViewportSize({ width, height: 900 }); for (const [index, language] of languages.entries()) {
      await offlinePage.evaluate(language => { queryLanguage = language; applyLanguage(language); }, language); await settle(offlinePage); await healthyLabels(index, state);
      await stationaryNoticeTarget(state, language);
      assert.deepEqual(await fields(offlinePage), before); assert.equal(guardedReads(), readsBefore); assert.equal(coldRequests.filter(request => request.path === noticeReadPath).length, writesBefore);
      assert(await offlinePage.evaluate(() => qaNoticeNodes.every((node, index) => node.isConnected && node.firstChild === qaNoticeLeaves[index]))); assert(await offlinePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); healthyNoticeCases++;
    } }
    await offlinePage.setViewportSize({ width: 320, height: 900 }); await capture(offlinePage, 'notice-' + state + '-de-320', '#notificationsPanel');
  }
  await offlinePage.evaluate(() => { queryLanguage = 'es'; applyLanguage('es'); }); await offlinePage.evaluate(() => loadCustomerExtras()); await offlinePage.waitForLoadState('networkidle'); await healthyLabels(3, 'unread'); await healthyMatrix('unread');
  await offlinePage.route(base + noticeReadPath, route => route.abort('failed'));
  await offlinePage.locator('#notificationList [data-notice-read]').click(); await offlinePage.waitForFunction(() => document.querySelector('#notificationList [role=status]').textContent.length > 0); await healthyMatrix('failed'); assert.deepEqual(await database(), savedDatabase);
  await offlinePage.unroute(base + noticeReadPath); let heldNotice;
  await offlinePage.route(base + noticeReadPath, route => { assert.equal(route.request().headers().authorization, 'Bearer ' + token); assert.equal(route.request().postData(), null); heldNotice = route; });
  const pendingNoticeRequest = offlinePage.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === noticeReadPath);
  await offlinePage.locator('#notificationList [data-notice-read]').click(); await pendingNoticeRequest; await offlinePage.waitForFunction(() => document.querySelector('#notificationList [data-notice-read]').disabled); await healthyMatrix('busy'); assert(heldNotice); assert.deepEqual(await database(), savedDatabase);
  const noticeBeforeConfirm = Date.now(); await heldNotice.continue(); await offlinePage.unroute(base + noticeReadPath); await offlinePage.waitForFunction(() => document.querySelector('#notificationList [data-notice-read]').textContent === 'Gelesen'); await healthyMatrix('read');
  const afterNotice = await database(); assert.equal(afterNotice[1].isRead, true); for (const key of ['readAt', 'updatedAt']) assert(afterNotice[1][key] instanceof Date && afterNotice[1][key].getTime() >= noticeBeforeConfirm && afterNotice[1][key].getTime() <= Date.now());
  const finalDatabaseExpected = savedDatabase.map((row, index) => index === 1 ? { ...row, isRead: true, readAt: afterNotice[1].readAt, updatedAt: afterNotice[1].updatedAt } : row); assert.deepEqual(afterNotice, finalDatabaseExpected);
  await offlinePage.evaluate(() => document.querySelector('#notificationList [data-notice-read]').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await noticePreserve();
  for (const width of [320, 390, 1440]) { await offlinePage.setViewportSize({ width, height: 900 }); for (const [index, language] of languages.entries()) {
    await offlinePage.locator('#cwLanguageSelect').selectOption(language); await offlinePage.waitForFunction(() => loadedClientId === clientId); await offlinePage.waitForLoadState('networkidle'); await healthyLabels(index, 'read', false); healthyNoticeCases++;
  } }
  assert.equal(coldRequests.slice(noticeStart).filter(request => request.path === noticeReadPath).length, 2, 'One failed attempt and one explicit native confirmation; repaint/selector/disabled handler cannot retry automatically'); assert.deepEqual(await database(), finalDatabaseExpected);
  assert.equal(stationaryNoticeTargets, 60);
  console.log('PASS healthy portal notifications ' + JSON.stringify({ healthyNoticeCases, stationaryNoticeTargets, languages: 5, widths: [320, 390, 1440], spanishNativeResponseRendered: true, explicitReadAttempts: 2, nativeSqlConfirmations: 1, pendingRequests: 2, originalNodesFocusAndGuardRetained: true }));
  console.log('PASS primary portal retry: exact core GET, native two-section reload, restored guard, literal notification and immutable pending work'); await offline.close();
  assert.deepEqual(await database(), finalDatabaseExpected);
  console.log('PASS portal extras result ' + JSON.stringify({ checks, languageCases: 210, nativeRetry: true, literalNativeNotification: true, ownershipControls: 2, pendingRequests: 2, currentWorkerShellBytes: true, actualPageContinuedOffline: true, actualColdOfflineReload: true, primaryFailureStates: 4, primaryRetry: true }));
  console.log('PASS actual portal quote presentation ' + JSON.stringify({ quoteLanguageCases, cachedQuotesJsBytesEqualSource: true, coldOfflineQuoteErrors: true, realLanguageSelector: true, pureQuotePaintDoesNotReloadQuotes: true }));
  await legacyChatLanguages(context, token); await legacyAccountLanguages(context, token); complete = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  clearTimeout(deadline); await browser?.close(); await prisma.$disconnect();
  if (client) { if (notice) await prisma.notification.delete({ where: { id: notice.id } }); await prisma.clientMessage.deleteMany({ where: { clientId: client.id } }); const key = 'LANGUAGE:CLIENT:' + client.id; await prisma.systemSetting.deleteMany({ where: { key } }); if (originalLanguage) await prisma.systemSetting.create({ data: originalLanguage }); await prisma.client.delete({ where: { id: client.id } }); assert.equal(await prisma.client.count({ where: { id: client.id } }), 0); assert.deepEqual(await prisma.systemSetting.findUnique({ where: { key } }), originalLanguage); console.log('PASS portal extras fixtures removed and previous language setting restored'); }
  for (const file of legacyChatUploads) await fs.rm(file, { force: true });
  await prisma.$disconnect();
});
