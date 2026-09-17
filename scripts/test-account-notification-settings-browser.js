'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { chromium } = require('playwright');
const source = file => fs.readFileSync(path.join(__dirname, '../frontend', file), 'utf8');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }), page = await context.newPage(), errors = [];
    page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(error.message));
    let readMode = 'forbidden', writeMode = 'ok', held, posts = 0, records = [], holdReady;
    const owner = { id: 7, userId: 7, role: 'ADMIN', principalType: 'USER' };
    const token = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ ...owner, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.browser-fixture';
    await context.route('http://preferences.test/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/settings/7') {
        assert.equal(route.request().headers().authorization, 'Bearer ' + token);
        if (readMode === 'held') { held = route; holdReady(); return; }
        if (readMode === 'forbidden') return route.fulfill({ status: 403, contentType: 'text/html', body: 'Forbidden' });
        if (readMode === 'offline') return route.abort('failed');
        if (readMode === 'invalid') return route.fulfill({ json: { ok: true } });
        return route.fulfill({ json: { ok: true, settings: readMode === 'foreign' ? [{ userId: 8, type: 'CHAT', sound: true }] : records } });
      }
      if (url.pathname === '/api/settings' && route.request().method() === 'POST') {
        posts++; const body = route.request().postDataJSON(); assert.equal(body.userId, 7);
        assert.equal(route.request().headers().authorization, 'Bearer ' + token);
        if (writeMode === 'held') { held = route; holdReady(); return; }
        if (writeMode === 'forbidden') return route.fulfill({ status: 403, json: { ok: false } });
        if (writeMode === 'lost') { records = [body]; return route.abort('failed'); }
        if (writeMode === 'empty') return route.fulfill({ json: { ok: true } });
        if (writeMode === 'foreign') return route.fulfill({ json: { ok: true, setting: { ...body, userId: 8 } } });
        if (writeMode === 'wrongValue') return route.fulfill({ json: { ok: true, setting: { ...body, sound: !body.sound } } });
        if (writeMode === 'accepted') return route.fulfill({ status: 202, json: { ok: true, setting: body } });
        records = [body]; return route.fulfill({ json: { ok: true, setting: body } });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { ok: true } });
      if (url.pathname === '/settings') return route.fulfill({ contentType: 'text/html', body: source('settings.html') });
      if (['/cw-auth.js', '/client-auth-guard.js', '/account-notification-settings.js', '/crystal-os-v2-nav.js'].includes(url.pathname)) return route.fulfill({ contentType: 'application/javascript', body: source(url.pathname.slice(1)) });
      if (url.pathname.endsWith('.css')) return route.fulfill({ contentType: 'text/css', body: source(url.pathname.slice(1)) });
      return route.fulfill({ contentType: 'application/javascript', body: '' });
    });
    await page.goto('http://preferences.test/seed');
    await page.evaluate(({ owner, token }) => {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(owner));
      localStorage.setItem('cwFieldOutbox:qa', 'pending-work');
    }, { owner, token });
    const state = value => page.waitForFunction(value => document.getElementById('settingsStatus')?.dataset.state === value, value);
    const reload = async () => { await page.locator('#settingsReload').click(); };
    await page.goto('http://preferences.test/settings'); await state('unavailable');
    assert.equal(await page.locator('#list select').count(), 0); assert.equal(await page.locator('#settingsNotices').getAttribute('href'), '/admin-notifications');
    for (const mode of ['offline', 'invalid', 'foreign']) { readMode = mode; await reload(); await state('error'); assert.equal(await page.locator('#list select').count(), 0); }
    readMode = 'ok'; await reload(); await state('ready'); assert.equal(await page.locator('#list select').count(), 5);
    const setting = page.locator('[data-setting-type="CHAT"]'); assert.equal(await setting.inputValue(), '', 'Missing preferences must not be invented as enabled');
    for (const mode of ['empty', 'foreign', 'wrongValue', 'accepted', 'lost', 'forbidden']) {
      writeMode = mode; await setting.selectOption('true'); await state(mode === 'forbidden' ? 'unavailable' : 'unconfirmed');
      assert.equal(await page.locator('#list select').count(), 0, mode + ' cannot expose an unconfirmed control');
      await reload(); await state('ready');
      if (mode === 'lost') assert.equal(await setting.inputValue(), 'true', 'Refresh must recover a committed change after response loss');
    }
    writeMode = 'held'; const pending = new Promise(resolve => { holdReady = resolve; });
    await setting.selectOption('false'); await pending; await state('saving'); const count = posts;
    assert(await setting.isDisabled()); assert.equal(await setting.inputValue(), 'true', 'Do not show the requested value before confirmation');
    await setting.dispatchEvent('change'); assert.equal(posts, count); assert(await page.locator('#settingsReload').isDisabled());
    records = [{ userId: 7, type: 'CHAT', sound: false }]; await held.fulfill({ json: { ok: true, setting: records[0] } }); await state('saved'); assert.equal(await setting.inputValue(), 'false');
    const titles = { pt: 'Preferências de som', en: 'Sound preferences', es: 'Preferencias de sonido', fr: 'Préférences sonores', de: 'Toneinstellungen' };
    for (const [language, title] of Object.entries(titles)) {
      await page.evaluate(language => window.dispatchEvent(new CustomEvent('cw-language-change', { detail: { language } })), language);
      assert.equal(await page.locator('#settingsTitle').textContent(), title);
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const selector of ['#settingsReload', '#settingsNotices', '[data-setting-type="CHAT"]']) {
          const bounds = await page.locator(selector).boundingBox(); assert(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, language + ': ' + selector + ' must fit at ' + width);
        }
      }
    }
    readMode = 'held'; const waiting = new Promise(resolve => { holdReady = resolve; }); await reload(); await waiting;
    const other = await context.newPage(); await other.goto('http://preferences.test/seed');
    await other.evaluate(() => { localStorage.setItem('token', 'other-token'); localStorage.setItem('cristalwater_jwt', 'other-token'); });
    await state('changed'); await held.fulfill({ json: { ok: true, settings: [{ userId: 7, type: 'CHAT', sound: true }] } });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('#settingsStatus').getAttribute('data-state'), 'changed'); assert.equal(await page.locator('#list select').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('cwFieldOutbox:qa')), 'pending-work'); assert.deepEqual(errors, []);
    await context.close(); console.log('PASS account preferences: refusals and read recovery, exact write confirmation, response loss, duplicate action, five languages/three widths and delayed account switch');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
