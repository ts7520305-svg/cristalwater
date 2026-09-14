/* Real Chromium component regression. API responses are controlled test fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '../frontend/crystal-os-v2-shell.js'), 'utf8');
const html = `<meta charset="utf-8"><body><div id="nextTitle">Piscina de ensaio</div><div id="nextMeta">Cliente de ensaio</div><div id="accessList">Fechar o portão. Confirmar válvulas.</div><div class="water-card"><div class="muted"></div><div class="water-grid"><input id="waterMinutes"><input id="waterCloseTime"><input id="waterNote"></div></div><div id="toast"></div><button id="openWaterBtn">Água aberta</button><button id="startBtn">Iniciar visita</button><div id="waterReminderList"></div></body>`;
const deadline = setTimeout(() => { console.error('FAIL: browser did not remain responsive'); process.exit(1); }, 25000);
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CW_CHROMIUM_PATH ? { executablePath: process.env.CW_CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(5000);
    page.on('pageerror', e => console.error('PAGE', e.message));
    let mode = 'queued';
    const requests = [];
    await page.route('http://field.test/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) {
        requests.push({ path: url.pathname, body: route.request().postDataJSON() });
        return route.fulfill({ status: mode === 'queued' ? 202 : 200, contentType: 'application/json', body: JSON.stringify(mode === 'queued' ? { ok: true, offline: true, status: 'PENDING_SYNC' } : { ok: true, reminder: { id: 7 } }) });
      }
      return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'text/html', body: url.pathname.endsWith('.js') ? '' : html });
    });
    await page.goto('http://field.test/technician-field-mode');
    await page.evaluate(() => {
      localStorage.setItem('cwTechnicianId', '41');
      localStorage.setItem('cw:tech-field:ui-state:v1', JSON.stringify({ selectedVisitId: '5' }));
      window.CristalAuth = { parseUser: () => ({ id: 41, name: 'Técnico QA' }) };
      window.CWV2StateAdapter = { start() {} };
      window.starts = 0;
      document.querySelector('#startBtn').addEventListener('click', () => window.starts++);
    });
    await page.addScriptTag({ content: source });
    assert.equal(await page.evaluate(() => new Promise(r => setTimeout(() => r('responsive'), 50))), 'responsive');
    await page.getByRole('button', { name: 'Iniciar visita', exact: true }).click();
    assert.equal(await page.evaluate(() => window.starts), 0);
    assert.equal(await page.getByRole('dialog').isVisible(), true);
    await page.getByRole('button', { name: 'Li e vou iniciar a visita' }).click();
    assert.equal(await page.evaluate(() => window.starts), 1);
    assert.ok(await page.evaluate(() => sessionStorage.getItem('cw:field:checkin:5')));
    console.log('PASS responsive mobile field screen and explicit check-in');

    // A 202 from the service worker is queued locally, not acknowledged by the server.
    await page.getByRole('button', { name: 'Água aberta', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cwWaterReminders:41') || '[]').some(r => r.syncError));
    const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('cwWaterReminders:41'))[0]);
    assert.equal(pending.serverId == null, true);
    assert.ok(pending.syncError);
    console.log('PASS offline acknowledgement remains pending');

    // A close made offline without a server id must sync creation before closure.
    await page.waitForTimeout(200);
    mode = 'online'; requests.length = 0;
    await page.evaluate((item) => {
      item.status = 'CLOSED'; item.syncError = 'offline';
      localStorage.setItem('cwWaterReminders:41', JSON.stringify([item]));
      window.CristalAuth = { parseUser: () => ({ id: 41 }) };
      window.CWV2StateAdapter = { start() {} };
    }, pending);
    await page.addScriptTag({ content: source });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cwWaterReminders:41'))[0].closeSyncedAt);
    assert.deepEqual(requests.map(r => r.path), ['/api/technician/water-reminders', '/api/technician/water-reminders/7/close']);
    const closed = await page.evaluate(() => JSON.parse(localStorage.getItem('cwWaterReminders:41'))[0]);
    assert.equal(closed.status, 'CLOSED');
    assert.equal(closed.syncError, '');
    console.log('PASS offline close is replayed after creation');
  } finally { await browser.close(); }
})().then(() => { clearTimeout(deadline); console.log('RESULT=PASS'); }).catch(error => { clearTimeout(deadline); console.error(error); process.exitCode = 1; });
