'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '../frontend/crystal-os-v2-shell.js'), 'utf8');
const html = '<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0}#accessList{white-space:pre-wrap}</style><div id="nextTitle">Piscina QA</div><div id="nextMeta">Cliente QA</div><div id="accessList">Fechar o portão.</div><button id="startBtn">Iniciar visita</button>';
let browser;
async function scenario(name, work) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://field.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('https://field.test/technician-field-mode');
  await page.evaluate(() => {
    localStorage.setItem('token', 'SESSION-A'); localStorage.setItem('user', JSON.stringify({ id: 41, role: 'TECHNICIAN' }));
    localStorage.setItem('cw:tech-field:ui-state:v1', JSON.stringify({ selectedVisitId: '5' }));
    window.CristalAuth = { parseUser: () => JSON.parse(localStorage.getItem('user')), getToken: () => localStorage.getItem('token') };
    window.CWV2StateAdapter = { start() {} }; window.CwUi = { info: message => { window.notice = message; } };
    window.starts = 0; document.querySelector('#startBtn').onclick = () => { window.starts++; };
  });
  await page.addScriptTag({ content: source });
  try { await work(page); assert.deepEqual(errors, []); console.log('PASS ' + name); }
  finally { await context.close(); }
}
const open = async page => { await page.locator('#startBtn').click(); await page.getByRole('dialog').waitFor(); };
const closed = page => page.locator('#cwFieldCheckinOverlay').waitFor({ state: 'hidden' });
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  await scenario('full instructions, safe text, mobile scrolling and one explicit start', async page => {
    const notes = 'Notas da piscina\n' + 'Verificar o fecho do portão. '.repeat(60) + '\nFINAL: <img src=x onerror=alert(1)> Não tocar na válvula.';
    await page.locator('#accessList').evaluate((node, text) => { node.textContent = text; }, notes);
    await open(page); assert.equal(await page.locator('#cwFieldCheckinNotices').textContent(), notes);
    assert.equal(await page.locator('#cwFieldCheckinNotices img').count(), 0); assert.equal(await page.evaluate(() => starts), 0);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.locator('#cwFieldCheckinNotices').evaluate(n => n.scrollWidth <= n.clientWidth + 1));
      assert(await page.locator('#cwFieldCheckinOverlay > div').evaluate(n => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.height <= innerHeight; }));
    }
    await page.locator('#cwFieldCheckinConfirm').evaluate(button => { button.click(); button.click(); });
    assert.equal(await page.evaluate(() => starts), 1); assert(await page.evaluate(() => sessionStorage.getItem('cw:field:checkin:5')));
  });
  await scenario('cancel never starts or records a confirmation', async page => {
    await open(page); await page.locator('#cwFieldCheckinCancel').click(); await closed(page);
    assert.equal(await page.evaluate(() => starts), 0); assert.equal(await page.evaluate(() => sessionStorage.getItem('cw:field:checkin:5')), null);
  });
  await scenario('changing only the selected visit cannot confirm the old instructions', async page => {
    await open(page);
    await page.evaluate(() => localStorage.setItem('cw:tech-field:ui-state:v1', JSON.stringify({ selectedVisitId: '6' })));
    await page.locator('#cwFieldCheckinConfirm').click(); await closed(page);
    assert.equal(await page.evaluate(() => starts), 0); assert.equal(await page.evaluate(() => sessionStorage.getItem('cw:field:checkin:6')), null);
    await open(page); await page.locator('#cwFieldCheckinConfirm').click(); assert.equal(await page.evaluate(() => starts), 1);
  });
  await scenario('changed instructions invalidate the open review and require reading again', async page => {
    await open(page); await page.locator('#accessList').evaluate(node => { node.textContent = 'Instrução nova: não abrir a água.'; });
    await closed(page); assert.equal(await page.evaluate(() => starts), 0);
    assert.equal(await page.locator('#cwFieldCheckinNotices').textContent(), '');
    await open(page); assert.match(await page.locator('#cwFieldCheckinNotices').textContent(), /Instrução nova/);
    await page.locator('#cwFieldCheckinConfirm').click(); assert.equal(await page.evaluate(() => starts), 1);
  });
  await scenario('session change clears the review and a late confirmation does nothing', async page => {
    await open(page);
    await page.evaluate(() => { localStorage.setItem('token', 'SESSION-B'); localStorage.setItem('user', JSON.stringify({ id: 42, role: 'TECHNICIAN' })); window.dispatchEvent(new StorageEvent('storage', { key: 'token' })); });
    await closed(page); await page.locator('#cwFieldCheckinConfirm').evaluate(button => button.click());
    assert.equal(await page.evaluate(() => starts), 0); assert.equal(await page.locator('#cwFieldCheckinNotices').textContent(), '');
  });
  await scenario('visit type changes invalidate review even with identical numeric IDs and labels', async page => {
    await page.locator('#startBtn').evaluate(button => { button.dataset.cwCheckinRequired = 'true'; button.dataset.cwCheckinTarget = 'REGULAR:5'; });
    await open(page); await page.locator('#startBtn').evaluate(button => { button.dataset.cwCheckinTarget = 'EXTRA:5'; });
    await closed(page); assert.equal(await page.evaluate(() => starts), 0);
    await open(page); await page.locator('#cwFieldCheckinCancel').click();
  });
  await scenario('disabled start cannot record a confirmation or bypass the next review', async page => {
    await open(page); await page.locator('#startBtn').evaluate(button => { button.disabled = true; });
    await page.locator('#cwFieldCheckinConfirm').click(); await closed(page);
    assert.equal(await page.evaluate(() => starts), 0); assert.equal(await page.evaluate(() => sessionStorage.getItem('cw:field:checkin:5')), null);
    await page.locator('#startBtn').evaluate(button => { button.disabled = false; }); await open(page); assert.equal(await page.evaluate(() => starts), 0);
  });
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
