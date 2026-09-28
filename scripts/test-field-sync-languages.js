'use strict';
// Real browser, auth and IndexedDB outbox; HTTP replies are isolated fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const token = (id, nonce) => 'x.' + Buffer.from(JSON.stringify({ id, role: 'TECHNICIAN', nonce })).toString('base64url') + '.x';
const copy = {
  en: { confirm: 'Confirm saved submission', offline: 'Offline', expired: 'Session expired', assignment: 'another technician', conflict: 'detected a conflict', historic: 'older or unreadable submissions', sending: 'Confirming' },
  pt: { confirm: 'Confirmar envio guardado', offline: 'Sem ligação', expired: 'Sessão expirada', assignment: 'outro técnico', conflict: 'detetou um conflito', historic: 'envios antigos ou ilegíveis', sending: 'A confirmar' },
  fr: { confirm: 'Confirmer l’envoi enregistré', offline: 'Hors ligne', expired: 'Session expirée', assignment: 'autre technicien', conflict: 'détecté un conflit', historic: 'envois anciens ou illisibles', sending: 'Confirmation' },
  es: { confirm: 'Confirmar envío guardado', offline: 'Sin conexión', expired: 'Sesión caducada', assignment: 'otro técnico', conflict: 'detectó un conflicto', historic: 'envíos antiguos o ilegibles', sending: 'Confirmando' },
  de: { confirm: 'Gespeicherten Versand bestätigen', offline: 'Offline', expired: 'Sitzung abgelaufen', assignment: 'anderen Techniker', conflict: 'Konflikt erkannt', historic: 'ältere oder unlesbare Sendungen', sending: 'Wird bestätigt' },
};
const label = 'Piscina Guardar — José <script>alert("original")</script>', notes = 'Concluído — Nota original 17,25 € / UUID não traduzido';
const acknowledgement = { pt: 'Tomei conhecimento da recusa', en: 'I have reviewed the rejection', fr: 'J’ai pris connaissance du refus', es: 'He revisado el rechazo', de: 'Ich habe die Ablehnung zur Kenntnis genommen' };
const rejectedMessage = 'Original da recusa: Guardar <b>17,25 €</b>';
let completed = false;
const deadline = setTimeout(() => { console.error('Sync language deadline exceeded'); process.exit(1); }, 40000);
process.on('exit', code => { if (!code && !completed) { console.error('Sync language assertions did not finish'); process.exitCode = 1; } });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    const errors = [], writes = []; let serverLanguage = 'pt', held = null, hold = false, status = 409;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { window.qaOnline = false; Object.defineProperty(navigator, 'onLine', { get: () => window.qaOnline }); });
    await page.route('http://localhost/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/settings/language/me') {
        if (route.request().method() === 'PUT') serverLanguage = route.request().postDataJSON().language;
        return route.fulfill({ json: { ok: true, language: serverLanguage } });
      }
      if (url.pathname.startsWith('/api/')) {
        writes.push({ path: url.pathname, body: route.request().postDataJSON(), authorization: route.request().headers().authorization });
        if (hold) { held = route; return; }
        if (url.pathname.endsWith('/correction')) {
          const row = await page.evaluate(id => CWFieldWriteStore.get(id, CWFieldWriteStore.session()), route.request().postDataJSON().requestId);
          return route.fulfill({ json: { ok: true, receipt: { owner: row.owner, requestId: row.requestId, scope: row.scope, resourceId: row.resourceId, payloadHash: row.payloadHash, confirmedAt: '2026-09-28T12:00:00.000Z' }, applied: false, code: 'EXTRA_CORRECTION_STOCK', message: rejectedMessage, version: 'b'.repeat(64), visit: { id: row.resourceId, visitType: 'EXTRA', poolId: row.payload.poolId } } });
        }
        return route.fulfill({ status, json: { error: 'Mensagem original do servidor <b>Guardar</b>' } });
      }
      if (url.pathname.endsWith('.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'frontend', path.basename(url.pathname)), 'utf8') });
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt"><meta charset="utf-8"><body style="margin:8px"><header class="top"><div class="cw-global-actions" style="display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin:8px 0"></div></header><textarea id="notes"></textarea><script src="/cw-auth.js"></script><script src="/cw-i18n.js"></script><script src="/cw-field-write-store.js"></script><script src="/cw-field-offline.js"></script></body></html>' });
    });
    await page.goto('http://localhost/technician-field-mode');
    const login = (id = 41, nonce = 1) => page.evaluate(({ id, credential }) => CristalAuth.persistSession(credential, { id, technicianId: id, role: 'TECHNICIAN' }), { id, credential: token(id, nonce) });
    await login(); await page.locator('#notes').fill(notes);
    const prepare = id => page.evaluate(async ({ id, label, notes }) => { const row = await CWFieldWriteStore.prepare('VISIT_COMPLETION', id, { notes, products: [] }, { label }); await CWFieldOffline.render(); return row; }, { id, label, notes });
    const original = await prepare(1);
    const snapshot = () => page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('cw-field-writes', 1); request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result, tx = db.transaction('requests'), rows = tx.objectStore('requests').getAll(); tx.oncomplete = () => { db.close(); resolve(JSON.stringify(rows.result)); }; tx.onerror = () => reject(tx.error); };
    }));
    const select = async language => {
      await page.locator('#cwLanguageSelect').selectOption(language);
      await page.waitForFunction(expected => {
        const warning = document.getElementById('cwFieldStorageError');
        if (warning) return warning.textContent.includes(expected.historic);
        const button = document.querySelector('[data-pending-visit="1"] button');
        if (button) return button.textContent === expected.confirm || button.disabled && button.textContent.includes(expected.sending);
        return document.querySelector('[data-pending-visit="401"]')?.textContent.includes(expected.expired);
      }, copy[language]);
    };
    const initial = await snapshot();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [language, expected] of Object.entries(copy)) {
        await select(language); await page.locator('#cwFieldSyncStatus details').evaluate(node => { node.open = true; });
        const item = page.locator('[data-pending-visit="1"]');
        assert.equal(await item.getByRole('button').textContent(), expected.confirm);
        assert((await item.textContent()).includes(expected.offline));
        assert.equal(await item.locator('strong').textContent(), label); assert.equal(await item.locator('script,b').count(), 0);
        assert.equal(await page.locator('#notes').inputValue(), notes);
        assert.equal(await snapshot(), initial, 'Language/layout must not rewrite the outbox');
        assert.equal(writes.length, 0, 'Language change must not send operational requests');
        const bounds = await item.getByRole('button').boundingBox(); assert(bounds.height >= 44 && bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      }
    }
    await page.evaluate(() => CristalI18n.applyLanguage('fr', { silent: true }));
    await page.waitForFunction(expected => document.querySelector('[data-pending-visit="1"] button')?.textContent === expected, copy.fr.confirm);
    assert.equal(await snapshot(), initial); assert.equal(writes.length, 0);
    console.log('PASS five languages ×320/390/1440, offline state, original labels/notes, no injection, byte-identical IndexedDB and zero operational writes');
    // Exercise real persisted failure records, renewing the same owner after the 401.
    await page.evaluate(() => { window.qaOnline = true; });
    for (const code of [401, 403, 404, 409, 503]) {
      status = code; await prepare(code);
      await page.evaluate(id => CWFieldOffline.retry(id).catch(() => {}), code);
      if (code === 401) await login(41, 2);
    }
    await page.evaluate(() => { window.qaOnline = false; });
    const failed = await snapshot(), beforeLanguage = writes.length;
    for (const [language, expected] of Object.entries(copy)) {
      await select(language);
      for (const [code, key] of [[401, 'expired'], [403, 'assignment'], [404, 'assignment'], [409, 'conflict']]) { const shown = await page.locator(`[data-pending-visit="${code}"]`).textContent(); assert(shown.includes(expected[key]), `${language}/${code}: ${shown}`); }
      assert((await page.locator('[data-pending-visit="503"]').textContent()).includes('Mensagem original do servidor <b>Guardar</b>'));
      assert.equal(await snapshot(), failed); assert.equal(writes.length, beforeLanguage);
    }
    await page.reload(); await page.waitForFunction(() => window.CWFieldOffline && document.querySelector('#cwLanguageSelect'));
    await page.evaluate(() => CWFieldOffline.render()); assert.equal(await snapshot(), failed);
    assert.equal(await page.locator('#cwLanguageSelect').inputValue(), 'de');
    await login(42); await page.evaluate(() => CWFieldOffline.render()); assert.equal(await page.locator('#cwFieldSyncStatus').isVisible(), false); assert.equal(await snapshot(), failed);
    await login(41, 3); await page.evaluate(() => CWFieldOffline.render()); assert.equal(await snapshot(), failed);
    console.log('PASS translated401/403/404/409, original503 evidence, reload and account isolation preserve all stored requests');
    // A language change while the receipt is held cannot expose an enabled duplicate-send button.
    await select('en'); await page.evaluate(() => { window.qaOnline = true; }); hold = true;
    await page.locator('[data-pending-visit="1"] button').click();
    await page.waitForFunction(() => document.querySelector('[data-pending-visit="1"] button')?.disabled);
    for (let i = 0; !held && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10)); assert(held);
    const heldCount = writes.length; await select('de');
    assert.equal(await page.locator('[data-pending-visit="1"] button').isDisabled(), true);
    assert((await page.locator('[data-pending-visit="1"] button').textContent()).includes(copy.de.sending));
    assert.equal(writes.length, heldCount); assert.equal(writes.at(-1).body.requestId, original.requestId);
    await held.fulfill({ json: { ok: true, receipt: { owner: original.owner, requestId: original.requestId, scope: original.scope, resourceId: original.resourceId, payloadHash: original.payloadHash, confirmedAt: '2026-09-28T12:00:00.000Z' }, visit: { id: 1, status: 'DONE', completionRequestId: original.requestId, endAt: '2026-09-28T12:00:00.000Z' } } }); hold = false; held = null;
    await page.waitForFunction(() => !document.querySelector('[data-pending-visit="1"]'));
    const confirmed = await page.evaluate(id => CWFieldWriteStore.get(id, CWFieldWriteStore.session()), original.requestId);
    assert.equal(confirmed.requestId, original.requestId); assert.deepEqual(confirmed.payload, original.payload); assert.equal(confirmed.payloadHash, original.payloadHash); assert(confirmed.response?.receipt);
    console.log('PASS delayed receipt during language change keeps retry disabled and confirms original UUID/content once');
    const renewedRequest = await prepare(700); hold = true;
    await page.locator('[data-pending-visit="700"] button').click();
    for (let i = 0; !held && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10)); assert(held);
    await login(41, 4); await page.evaluate(() => CWFieldOffline.render());
    await page.waitForFunction(() => document.querySelector('[data-pending-visit="700"] button')?.disabled === false);
    await held.fulfill({ status: 409, json: { error: 'Late reply to the old credential' } }); held = null; hold = false;
    const afterRenewal = await page.evaluate(id => CWFieldWriteStore.get(id, CWFieldWriteStore.session()), renewedRequest.requestId);
    assert.deepEqual(afterRenewal.payload, renewedRequest.payload); assert.equal(afterRenewal.payloadHash, renewedRequest.payloadHash); assert(!afterRenewal.response);
    console.log('PASS renewal aborts an older in-flight request and releases the visible retry without replacing its original content');
    const rejection = await page.evaluate(async ({ label, notes }) => {
      const row = await CWFieldWriteStore.prepare('EXTRA_VISIT_CORRECTION', 60, { visitType: 'EXTRA', poolId: 7, expectedVersion: 'a'.repeat(64), notes }, { label });
      await CWFieldWriteStore.send(row.requestId); await CWFieldOffline.render(); return CWFieldWriteStore.get(row.requestId, CWFieldWriteStore.session());
    }, { label, notes });
    const rejected = await snapshot(), rejectionWrites = writes.length;
    for (const language of Object.keys(copy)) {
      await select(language); const item = page.locator('[data-pending-visit="60"]');
      assert.equal(await item.getByRole('button').textContent(), acknowledgement[language]);
      assert((await item.textContent()).includes(rejectedMessage)); assert.equal(await item.locator('b').count(), 0);
      assert.equal(await snapshot(), rejected); assert.equal(writes.length, rejectionWrites);
    }
    await page.locator('[data-pending-visit="60"] button').click(); await page.waitForFunction(() => !document.querySelector('[data-pending-visit="60"]'));
    const reviewed = await page.evaluate(id => CWFieldWriteStore.get(id, CWFieldWriteStore.session()), rejection.requestId);
    assert(reviewed.reviewedAt); delete reviewed.reviewedAt; assert.deepEqual(reviewed, rejection); assert.equal(writes.length, rejectionWrites);
    console.log('PASS correction rejection translates its controls, preserves original evidence/receipt and acknowledgement only records reviewedAt');
    const raw = '{interrupted-write: original'; await page.evaluate(raw => localStorage.setItem('cwFieldOutbox:41', raw), raw);
    const preserved = await snapshot(), historicalWrites = writes.length;
    for (const [language, expected] of Object.entries(copy)) {
      await select(language); assert((await page.locator('#cwFieldStorageError').textContent()).includes(expected.historic));
      assert.equal(await page.evaluate(() => localStorage.getItem('cwFieldOutbox:41')), raw); assert.equal(await snapshot(), preserved); assert.equal(writes.length, historicalWrites);
    }
    assert.deepEqual(errors, []);
    if (process.env.CW_SYNC_LANGUAGE_SCREENSHOT) {
      await page.setViewportSize({ width: 320, height: 900 });
      const warning = await page.locator('#cwFieldStorageError').boundingBox(), selector = await page.locator('#cwLanguageSelect').boundingBox(); assert(selector.y >= warning.y + warning.height);
      await page.screenshot({ path: process.env.CW_SYNC_LANGUAGE_SCREENSHOT, fullPage: true });
    }
    console.log('PASS unreadable legacy history warns in five languages without replacing bytes or sending requests');
    completed = true;
  } finally { await browser.close(); }
})().then(() => { clearTimeout(deadline); console.log('SYNC LANGUAGE RESULT=PASS'); }).catch(error => { clearTimeout(deadline); console.error(error.stack); process.exitCode = 1; });
