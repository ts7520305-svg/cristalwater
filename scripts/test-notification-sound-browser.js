'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process'), { chromium } = require('playwright');
const root = path.join(__dirname, '..'), baseline = process.env.CW_SOUND_BASELINE_SHA;
if (baseline && !/^[0-9a-f]{40}$/.test(baseline)) throw Error('Use a full historical commit SHA');
const source = file => baseline ? execFileSync('git', ['show', baseline + ':frontend/' + file], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, 'frontend', file), 'utf8');
const fixture = role => {
  const user = { id: 7, role, principalType: role === 'ADMIN' ? 'USER' : role === 'CLIENT' ? 'CLIENT' : 'TECHNICIAN' };
  const token = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.browser-fixture';
  return { user, token };
};
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const entry of baseline ? ['/notifications'] : ['/notifications', '/admin-notifications']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }), page = await context.newPage(), errors = [];
      const owner = fixture('ADMIN');
      page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(error.message));
      let mode = baseline ? 'forbidden' : 'ok', records = [{ userId: 7, type: 'CHAT', sound: true }], reads = 0, held, holdReady;
      await context.addInitScript(() => {
        window.soundStarts = 0; window.audioCloses = 0; window.rejectAudio = false;
        window.AudioContext = class {
          constructor() { this.state = 'suspended'; this.destination = {}; this.currentTime = 1; window.latestAudio = this; }
          async resume() { if (window.rejectAudio) throw Error('Audio denied'); this.state = 'running'; }
          async close() { this.state = 'closed'; window.audioCloses++; }
          createOscillator() { return { frequency: {}, connect() {}, start() { window.soundStarts++; }, stop() {} }; }
          createGain() { return { gain: {}, connect() {} }; }
        };
        window.Audio = class { async play() { window.soundStarts++; } };
        if (window.Notification) window.Notification.requestPermission = async () => 'denied';
      });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url()); if (url.origin !== 'http://sound.test') return route.abort();
        const pathname = url.pathname;
        if (pathname === '/api/settings/7') {
          reads++; assert.equal(route.request().headers().authorization, 'Bearer ' + owner.token);
          if (mode === 'held') { held = route; holdReady(); return; }
          if (mode === 'offline') return route.abort('failed');
          if (mode === 'forbidden') return route.fulfill({ status: 403, contentType: 'text/html', body: 'Forbidden' });
          if (mode === 'invalid') return route.fulfill({ json: { ok: true } });
          if (mode === 'accepted') return route.fulfill({ status: 202, json: { ok: true, settings: records } });
          return route.fulfill({ json: { ok: true, settings: mode === 'foreign' ? [{ userId: 8, type: 'CHAT', sound: true }] : records } });
        }
        if (pathname === '/api/notifications') return route.fulfill({ json: { ok: true, notifications: [] } });
        if (pathname === '/api/notifications/unread-count') return route.fulfill({ json: { ok: true, count: 0 } });
        if (pathname.startsWith('/api/')) return route.fulfill({ json: { ok: true } });
        if (pathname === '/socket.io/socket.io.js') return route.fulfill({ contentType: 'application/javascript', body: 'window.socketHandlers={};window.io=()=>({on(name,fn){(socketHandlers[name]||=[]).push(fn);return this;},emit(){},disconnect(){}});' });
        if (pathname === entry) return route.fulfill({ contentType: 'text/html', body: source(entry.slice(1) + '.html') });
        const file = path.join(root, 'frontend', pathname);
        if (pathname.endsWith('.js') && fs.existsSync(file)) return route.fulfill({ contentType: 'application/javascript', body: source(pathname.slice(1)) });
        if (pathname.endsWith('.css') && fs.existsSync(file)) return route.fulfill({ contentType: 'text/css', body: source(pathname.slice(1)) });
        return route.fulfill({ contentType: 'text/html', body: '<body>Destination</body>' });
      });
      await page.goto('http://sound.test/seed');
      await page.evaluate(({ user, token }) => {
        for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
        for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
        localStorage.setItem('sound_CHAT', 'true'); localStorage.setItem('cwFieldOutbox:qa', 'pending-work'); localStorage.setItem('cw_language', 'pt');
      }, owner);
      await page.goto('http://sound.test' + entry); await page.waitForLoadState('networkidle');
      if (baseline) { assert.equal(await page.evaluate(() => isSoundEnabled('CHAT')), false, 'An unowned legacy preference must not enable sound for the next account'); continue; }
      const state = value => page.waitForFunction(value => document.getElementById('notificationSoundStatus')?.dataset.state === value, value);
      const tones = () => page.evaluate(() => soundStarts);
      const emit = notification => page.evaluate(notification => socketHandlers['new-notification'].forEach(fn => fn(notification)), notification);
      let id = 1;
      const notice = type => ({ id: id++, type: type || 'CHAT', message: 'QA notice', createdAt: new Date(1000 * id).toISOString(), isRead: false });
      await state('idle'); assert.equal(await tones(), 0); assert.equal(reads, 0);
      await emit(notice()); assert.equal(await tones(), 0, 'A notification cannot activate sound');
      await page.evaluate(() => { window.rejectAudio = true; }); await page.locator('#notificationSoundToggle').click(); await state('device'); assert.equal(await tones(), 0);
      await page.evaluate(() => { window.rejectAudio = false; }); await page.locator('#notificationSoundToggle').click(); await state('ready');
      await page.locator('#notificationSoundTest').click(); await state('tested'); assert.equal(await tones(), 1); assert.equal(reads, 0, 'The explicit sound test does not change account preferences');
      const first = notice(); await emit(first); await state('ready'); assert.equal(await tones(), 2);
      const beforeDuplicate = reads; await emit(first); assert.equal(await tones(), 2); assert.equal(reads, beforeDuplicate);
      for (const rows of [[{ userId: 7, type: 'CHAT', sound: false }], []]) { records = rows; await emit(notice()); await state('ready'); assert.equal(await tones(), 2, 'Disabled and absent preferences remain silent despite legacy true'); }
      records = [{ userId: 7, type: 'CHAT', sound: true }];
      for (const value of ['offline', 'forbidden', 'invalid', 'accepted', 'foreign']) { mode = value; await emit(notice()); await state(value === 'forbidden' ? 'unavailable' : 'error'); assert.equal(await tones(), 2, value + ' must not play sound'); }
      mode = 'ok';
      await page.evaluate(() => { latestAudio.state = 'suspended'; });
      await emit(notice()); await state('device'); assert.equal(await tones(), 2);
      await page.locator('#notificationSoundToggle').click(); await state('ready');
      for (const createdAt of ['2026-09-17T08:00:00Z', '2026-09-17T08:01:00Z']) { await emit({ id: 'chat-7', type: 'CHAT_MESSAGE', message: 'QA chat', createdAt }); await state('ready'); }
      assert.equal(await tones(), 4, 'Two distinct chat messages in one conversation can both sound');
      const count = reads; await emit(notice('UNKNOWN')); await emit({ ...notice(), isRead: true }); assert.equal(reads, count); assert.equal(await tones(), 4);
      mode = 'held'; let waiting = new Promise(resolve => { holdReady = resolve; }); await emit(notice()); await waiting; const stale = held;
      await page.locator('#notificationSoundToggle').click(); await state('idle');
      await page.locator('#notificationSoundToggle').click(); await state('ready');
      mode = 'ok'; await emit(notice()); await state('ready'); assert.equal(await tones(), 5);
      await stale.fulfill({ json: { ok: true, settings: records } });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); assert.equal(await tones(), 5, 'A preference read from a previous activation cannot produce a late sound');
      const titles = { pt: 'Som das notificações', en: 'Notification sound', es: 'Sonido de notificaciones', fr: 'Son des notifications', de: 'Benachrichtigungston' };
      for (const [language, title] of Object.entries(titles)) {
        await page.evaluate(language => dispatchEvent(new CustomEvent('cw-language-change', { detail: { language } })), language);
        assert.equal(await page.locator('#notificationSoundPanel h2').textContent(), title);
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          for (const selector of ['#notificationSoundToggle', '#notificationSoundTest', '#notificationSoundPanel a']) {
            const bounds = await page.locator(selector).boundingBox(); assert(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, entry + '/' + language + '/' + width + ': control must fit');
          }
        }
      }
      mode = 'held'; waiting = new Promise(resolve => { holdReady = resolve; }); await emit(notice()); await waiting;
      const other = await context.newPage(); await other.goto('http://sound.test/seed');
      await other.evaluate(key => localStorage.setItem(key, 'different-account'), entry === '/notifications' ? 'token' : 'cristalwater_jwt');
      await state('changed'); await held.fulfill({ json: { ok: true, settings: records } });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await tones(), 5); assert(await page.locator('#notificationSoundToggle').isDisabled());
      await emit({ ...notice(), message: 'Old account confidential event' }); assert(!(await page.locator('body').textContent()).includes('Old account confidential event'));
      assert.deepEqual(await page.evaluate(() => [localStorage.getItem('sound_CHAT'), localStorage.getItem('cwFieldOutbox:qa')]), ['true', 'pending-work']);
      assert.deepEqual(errors, []); await context.close();
      console.log('PASS ' + entry + ': explicit activation, confirmed own preferences, no legacy fallback, aliases, duplicates, stale activation/session, audio denial and five languages/three widths');
    }
    if (!baseline) for (const role of ['ADMIN', 'CLIENT', 'TECHNICIAN', 'TEAM_LEADER']) {
      const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage(), owner = fixture(role), errors = [];
      page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(error.message));
      await context.route('**/*', route => {
        const url = new URL(route.request().url()); if (url.origin !== 'http://alias.test') return route.abort();
        const pathname = url.pathname;
        if (pathname === '/api/settings/7') return route.fulfill({ status: role === 'ADMIN' ? 200 : 403, json: role === 'ADMIN' ? { ok: true, settings: [] } : { ok: false } });
        if (pathname.startsWith('/api/')) { assert.equal(route.request().method(), 'GET', 'The alias must not write preferences'); return route.fulfill({ json: { ok: true } }); }
        if (['/config-notifications', '/config-notifications.html', '/settings'].includes(pathname)) return route.fulfill({ contentType: 'text/html', body: source(pathname.includes('config-notifications') ? 'config-notifications.html' : 'settings.html') });
        if (pathname.endsWith('.js') && fs.existsSync(path.join(root, 'frontend', pathname))) return route.fulfill({ contentType: 'application/javascript', body: source(pathname.slice(1)) });
        if (pathname.endsWith('.css')) return route.fulfill({ contentType: 'text/css', body: source(pathname.slice(1)) });
        return route.fulfill({ contentType: 'text/html', body: '<body>Seed</body>' });
      });
      await page.goto('http://alias.test/seed');
      await page.evaluate(({ user, token }) => {
        for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
        for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
        localStorage.setItem('sound_CHAT', 'true'); localStorage.setItem('cwFieldOutbox:qa', 'pending-work');
      }, owner);
      for (const route of ['/config-notifications', '/config-notifications.html']) {
        await page.goto('http://alias.test' + route); await page.waitForURL('http://alias.test/settings');
        await page.waitForFunction(state => document.getElementById('settingsStatus')?.dataset.state === state, role === 'ADMIN' ? 'ready' : 'unavailable');
        assert.deepEqual(await page.evaluate(() => [localStorage.getItem('sound_CHAT'), localStorage.getItem('cwFieldOutbox:qa'), localStorage.getItem('cristalwater_jwt')]), ['true', 'pending-work', owner.token]);
        assert.equal(await page.locator('#list select').count(), role === 'ADMIN' ? 5 : 0);
      }
      assert.deepEqual(errors, []); await context.close();
      console.log('PASS legacy settings alias ' + role + ': both routes, current ownership, no preference writes and preserved session/work/legacy values');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
