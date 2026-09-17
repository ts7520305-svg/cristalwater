/* Chromium regression for session expiry, immutable field requests and identity changes. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const waitBrowserState = require('./fixtures/wait-browser-state');
const token = (id, nonce) => 'x.' + Buffer.from(JSON.stringify({ id, role: 'TECHNICIAN', nonce })).toString('base64url') + '.x';
const tokens = { expired: token(41, 1), renewed: token(41, 2), newer: token(41, 3), second: token(42, 1) };
const deadline = setTimeout(() => { console.error('Session regression deadline exceeded'); process.exit(1); }, 30000);
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CW_CHROMIUM_PATH ? { executablePath: process.env.CW_CHROMIUM_PATH } : {}), args: ['--no-sandbox','--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    let status = 401, held = null, hold = false, completions = 0; const sentBodies = [];
    async function reply(route, responseStatus = status) {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      let response = { error: 'QA status ' + responseStatus };
      if (responseStatus === 200 && /\/(photo|complete)$/.test(pathname)) {
        const requestId = request.headers()['x-cw-field-request'] || request.postDataJSON().requestId;
        const row = await page.evaluate(id => CWFieldWriteStore.get(id, CWFieldWriteStore.session()), requestId);
        response = { ok: true, receipt: { owner: row.owner, requestId: row.requestId, scope: row.scope, resourceId: row.resourceId, payloadHash: row.payloadHash, confirmedAt: new Date().toISOString() },
          ...(row.scope === 'VISIT_PHOTO' ? { photo: { id: 7, visitId: row.resourceId, type: row.payload.type, url: '/uploads/visit-qa.png' }, sha256: row.payload.sha256, size: row.payload.size } : { visit: { id: row.resourceId, status: 'DONE', completionRequestId: row.requestId, endAt: new Date().toISOString() } }) };
      }
      return route.fulfill({ status: responseStatus, headers: responseStatus === 429 ? { 'Retry-After': '60' } : {}, json: response });
    }
    await page.route('http://localhost/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.startsWith('/api/')) {
        if (pathname.endsWith('/complete')) { completions++; sentBodies.push(route.request().postDataJSON()); }
        if (hold) { held = route; return; }
        return reply(route);
      }
      return route.fulfill({ contentType: 'text/html', body: '<body><textarea id="notes">Trabalho em curso</textarea></body>' });
    });
    await page.goto('http://localhost/technician-field-mode');
    for (const file of ['cw-auth.js','cw-field-write-store.js','cw-field-photos.js','cw-field-offline.js']) await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname,'../frontend',file),'utf8') });
    const login = (credential, id = 41) => page.evaluate(({ credential, id }) => CristalAuth.persistSession(credential, { id, technicianId: id, role: 'TECHNICIAN' }), { credential, id });
    const row = visitId => page.evaluate(async id => (await CWFieldOffline.entries()).find(row => row.resourceId === id), visitId);
    await login(tokens.expired);
    assert.match(await page.evaluate(() => CWFieldOffline.submitCompletion(5, { notes: 'Trabalho em curso' }).catch(e => e.message)), /guardada/);
    assert.equal(new URL(page.url()).pathname, '/technician-field-mode'); assert.equal(await page.locator('#notes').inputValue(), 'Trabalho em curso');
    assert.equal(await page.locator('#cwSessionExpired').isVisible(), true); assert.equal(await page.evaluate(() => CWFieldOffline.pending(5)), true);
    const sent = completions; await page.evaluate(() => CWFieldOffline.flush()); assert.equal(completions, sent, 'Expired sessions must not keep retrying');
    status = 200; await login(tokens.renewed); await page.evaluate(() => CWFieldOffline.flush());
    assert.equal(await page.evaluate(() => CWFieldOffline.pending(5)), false); assert.equal(await page.locator('#cwSessionExpired').count(), 0);
    const count = completions;
    await page.evaluate(() => CWFieldOffline.submitCompletion(5, { notes: 'Trabalho em curso' }));
    assert.equal(completions, count, 'Confirmed identical request is recovered locally');
    assert.match(await page.evaluate(() => CWFieldOffline.submitCompletion(5, { notes: 'Changed after confirmation' }).catch(e => e.message)), /correção/);
    console.log('PASS expiry preserves visible work; renewal recovers the original receipt and confirmed content cannot be replaced');

    hold = true; await page.evaluate(() => { window.stale = fetch('/api/delayed').then(r => r.status); });
    await page.waitForTimeout(50); assert(held); await login(tokens.newer);
    await held.fulfill({ status: 401, json: {} }); held = null; hold = false;
    assert.equal(await page.evaluate(() => window.stale), 401); assert.equal(await page.evaluate(() => CristalAuth.isSessionExpired()), false);
    console.log('PASS delayed 401 cannot invalidate a newer login');

    const photoId = randomUUID();
    const save = () => page.evaluate(async id => CWFieldPhotos.save(9, { localId: id, file: new Blob(['test'], { type: 'image/png' }), fileName: 'test.png' }), photoId);
    await save(); await login(tokens.second, 42); await save(); await login(tokens.newer);
    hold = true; const countBefore = completions;
    await page.evaluate(() => { window.upload = CWFieldOffline.submitCompletion(9, { notes: 'Owner 41' }).catch(e => e.message); });
    await page.waitForTimeout(100); assert(held); assert.equal(held.request().headers().authorization, 'Bearer ' + tokens.newer);
    await login(tokens.second, 42);
    // Wait for the session monitor to abort the held upload before any response.
    // A fast late response used to hide the raw AbortError in this path.
    const interruptedUpload = await page.evaluate(() => window.upload);
    await held.fulfill({ status: 200, json: { photo: { id: 7, url: '/wrong-photo.jpg' } } }); held = null; hold = false;
    assert.match(interruptedUpload, /sessão mudou/i); assert.equal(completions, countBefore);
    assert.equal(await page.evaluate(async () => (await CWFieldPhotos.list(9)).length), 1); assert.equal(await page.evaluate(() => CWFieldOffline.pending(9)), false);
    await login(tokens.newer); assert.equal(await page.evaluate(async () => (await CWFieldPhotos.list(9)).length), 1); assert.equal(await page.evaluate(() => CWFieldOffline.pending(9)), true);
    await page.evaluate(() => CWFieldOffline.flush()); assert.equal(await page.evaluate(() => CWFieldOffline.pending(9)), false);
    console.log('PASS account switch preserves both photo queues and prevents cross-account completion');

    status = 403; await page.evaluate(() => CWFieldOffline.submitCompletion(6, { notes: 'Registo antes de mudar a ronda' }).catch(() => {}));
    const original = await row(6); assert.equal(original.failure.blocked, true); assert.equal(original.payload.notes, 'Registo antes de mudar a ronda');
    const beforeBlocked = completions; await page.evaluate(() => CWFieldOffline.flush()); assert.equal(completions, beforeBlocked);
    assert.match(await page.evaluate(() => CWFieldOffline.submitCompletion(6, { notes: 'Overwrite conflict' }).catch(e => e.message)), /diferente por confirmar/);
    assert.deepEqual((await row(6)).payload, original.payload);
    assert.equal(await page.locator('#cwFieldSyncStatus details').getAttribute('open'), '');
    assert.match(await page.locator('[data-pending-visit="6"]').textContent(), /atribuída a outro técnico/);
    status = 200; await page.getByRole('button', { name: 'Confirmado pelo escritório — tentar novamente' }).click();
    await waitBrowserState(page, async () => !await CWFieldOffline.pending(6)); assert.equal(sentBodies.at(-1).requestId, original.requestId);
    console.log('PASS permanent rejection blocks automatic resends and replacement; manual review reuses the same UUID/content');

    status = 429; await page.evaluate(() => CWFieldOffline.submitCompletion(7, { notes: 'Pausa temporária' }).catch(() => {}));
    const limited = await row(7); assert.equal(limited.failure.blocked, false); assert(limited.failure.retryAt > Date.now() + 45000);
    const beforeWait = completions; await page.evaluate(() => CWFieldOffline.flush()); await page.evaluate(() => CWFieldOffline.submitCompletion(7, { notes: 'Pausa temporária' }).catch(() => {})); assert.equal(completions, beforeWait);
    status = 200;
    await page.evaluate(key => new Promise((resolve, reject) => {
      const open = indexedDB.open('cw-field-writes', 1); open.onerror = () => reject(open.error);
      open.onsuccess = () => { const db = open.result, tx = db.transaction('requests','readwrite'), store = tx.objectStore('requests'), read = store.get(key);
        read.onsuccess = () => store.put({ ...read.result, failure: { ...read.result.failure, retryAt: Date.now() - 1 } }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    }), limited.key);
    await page.evaluate(() => CWFieldOffline.flush()); assert.equal(await page.evaluate(() => CWFieldOffline.pending(7)), false);
    console.log('PASS Retry-After prevents early automatic and manual sends; original request resumes after the pause');

    for (const raw of ['{interrupted-write', JSON.stringify([{ visitId: 8, body: { notes: 'Keep me' } }]), JSON.stringify({ 8: { visitId: 9, body: { notes: 'Mismatched identity' } } }), JSON.stringify({ 8: { visitId: 8, body: { notes: 'Historical numeric owner' } } })]) {
      await page.evaluate(async raw => { localStorage.setItem('cwFieldOutbox:41', raw); await CWFieldOffline.render(); }, raw);
      assert.equal(await page.locator('#cwFieldStorageError').isVisible(), true);
      const callsBefore = completions;
      assert.match(await page.evaluate(() => CWFieldOffline.submitCompletion(8, { notes: 'New work' }).catch(e => e.message)), /não serão substituídos/);
      await page.evaluate(() => CWFieldOffline.flush()); assert.equal(completions, callsBefore);
      assert.equal(await page.evaluate(() => localStorage.getItem('cwFieldOutbox:41')), raw);
    }
    await page.evaluate(async () => { localStorage.setItem('cwFieldOutbox:41','{}'); await CWFieldOffline.render(); }); assert.equal(await page.locator('#cwFieldStorageError').count(), 0);
    console.log('PASS malformed and unattributed historical queues remain untouched and block accidental replacement');
  } finally { await browser.close(); }
})().then(() => { clearTimeout(deadline); console.log('SESSION RESULT=PASS'); }).catch(error => { clearTimeout(deadline); console.error(error); process.exitCode = 1; });
