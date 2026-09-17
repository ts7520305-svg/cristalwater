'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process'), { chromium } = require('playwright');
const root = path.join(__dirname, '..'), baseline = process.env.CW_HELP_BASELINE_SHA;
if (baseline && !/^[0-9a-f]{40}$/.test(baseline)) throw Error('Use a full commit SHA for historical help reproduction');
const visual = path.join(root, 'reports/field-visual', 'role-help-' + Date.now());
const source = file => baseline ? execFileSync('git', ['show', baseline + ':frontend/' + file], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, 'frontend', file), 'utf8');
const fixture = role => {
  const user = { id: 7, role, principalType: role === 'ADMIN' ? 'USER' : role === 'CLIENT' ? 'CLIENT' : 'TECHNICIAN' };
  const token = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.browser-fixture';
  return { user, token };
};
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    fs.mkdirSync(visual, { recursive: true });
    for (const role of ['ADMIN', 'CLIENT', 'TECHNICIAN', 'TEAM_LEADER']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }), page = await context.newPage(), errors = [];
      page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(error.message));
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin !== 'http://help.test') return route.abort();
        const pathname = new URL(route.request().url()).pathname;
        if (['/help-center', '/help-center.html'].includes(pathname)) return route.fulfill({ contentType: 'text/html', body: source('help-center.html') });
        if (['/cw-auth.js', '/client-auth-guard.js', '/cristal-help-data.js', '/cristal-assist.js', '/help-center.js', '/crystal-os-v2-nav.js'].includes(pathname)) return route.fulfill({ contentType: 'application/javascript', body: source(pathname.slice(1)) });
        if (pathname.endsWith('.css')) return route.fulfill({ contentType: 'text/css', body: source(pathname.slice(1)) });
        const asset = path.join(root, 'frontend', pathname);
        if (pathname.endsWith('.js') && fs.existsSync(asset)) return route.fulfill({ contentType: 'application/javascript', body: source(pathname.slice(1)) });
        if (/\.(png|webp|ico)$/.test(pathname) && fs.existsSync(asset)) return route.fulfill({ contentType: pathname.endsWith('.png') ? 'image/png' : pathname.endsWith('.webp') ? 'image/webp' : 'image/x-icon', body: fs.readFileSync(asset) });
        if (pathname.startsWith('/api/')) return route.fulfill({ json: { ok: true } });
        return route.fulfill({ contentType: 'text/html', body: '<body>Destination</body>' });
      });
      await page.goto('http://help.test/seed');
      await page.evaluate(({ user, token }) => {
        for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
        for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
        localStorage.setItem('cwFieldOutbox:qa', 'pending-work'); localStorage.setItem('sound_CHAT', 'false'); localStorage.setItem('cw_language', 'pt');
      }, fixture(role));
      await page.goto('http://help.test/help-center?topic=aiAdmin');
      await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).pathname, '/help-center', role + ' must enter its own help without redirect');
      const field = ['TECHNICIAN', 'TEAM_LEADER'].includes(role);
      assert.equal(await page.locator('body').getAttribute('data-cw-role'), field ? 'TECHNICIAN' : role);
      const allowed = new Set(role === 'CLIENT' ? ['/help-center', '/client-portal', '/client-history', '/client-payments', '/client_chat', '/client-notifications'] : ['/help-center', '/technician-field-mode', '/technician-guide', '/technician-chat', '/technician-chat#noticesTitle', '/technician-profile']);
      async function checkLinks(selector) {
        const links = await page.locator(selector).evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
        assert(links.length > 0, role + ' must have useful links');
        for (const href of links) {
          if (role !== 'ADMIN') assert(allowed.has(href), role + ' cannot advertise ' + href);
          assert(fs.existsSync(path.join(root, 'frontend', href.split(/[?#]/)[0].slice(1) + '.html')), 'Destination must exist: ' + href);
        }
        return links;
      }
      await checkLinks('#helpActions a');
      if (role !== 'ADMIN') {
        assert.equal(await page.locator('#helpStatus').getAttribute('data-state'), 'unavailable');
        assert.equal(await page.locator('#topics [data-topic="aiAdmin"]').count(), 0);
        assert(!/administrador|emitir fatura|criar técnico/i.test(await page.locator('#detail').textContent()));
      } else assert.equal(await page.locator('#helpStatus').getAttribute('data-state'), 'ready');
      if (role === 'ADMIN') {
        await page.goto('http://help.test/help-center?topic=aiOps');
        assert.equal(await page.locator('#helpStatus').getAttribute('data-state'), 'ready');
        assert.equal(await page.locator('#topics [data-topic="aiOps"]').count(), 0, 'A legacy contextual alias must not duplicate a guide');
        assert.equal(await page.locator('#topics [data-topic="aiAdmin"]').getAttribute('aria-pressed'), 'true');
      }
      for (const query of ['constructor', '__proto__', '<img src=x onerror=alert(1)>']) {
        await page.goto('http://help.test/help-center?topic=' + encodeURIComponent(query));
        assert.equal(await page.locator('#helpStatus').getAttribute('data-state'), 'unavailable');
        assert.equal(await page.locator('#detail img').count(), 0);
      }
      await page.locator('#search').fill('notificacoes'); assert((await page.locator('#topics [data-topic]').count()) > 0);
      await page.locator('#search').fill('no-such-help-xyz'); assert(await page.locator('#emptyTopics').isVisible()); assert.equal(await page.locator('#topics button').count(), 0);
      await page.locator('#search').fill('');
      const selected = role === 'ADMIN' ? 'vehicles' : role === 'CLIENT' ? 'finance' : 'safety';
      await page.locator('#topics [data-topic="' + selected + '"]').click();
      assert.equal(new URL(page.url()).searchParams.get('topic'), selected); await checkLinks('#detail a');
      assert.equal(await page.locator('#detail').evaluate(node => node === document.activeElement), true, 'Mobile topic selection must bring the guide into focus');
      await page.waitForFunction(() => {
        const detail = document.getElementById('detail').getBoundingClientRect(), bar = document.querySelector('.cw-v2-shell-topbar').getBoundingClientRect();
        return detail.top >= bar.bottom - 1 && detail.top < innerHeight - 150;
      });
      await page.keyboard.press('Control+k'); await page.locator('.cw-command').waitFor(); await checkLinks('.cw-command-results a');
      await page.locator('.cw-command-search').fill('no-such-command-xyz'); assert.equal(await page.locator('.cw-command-results a').count(), 0); assert(await page.locator('.cw-command-results [role=status]').isVisible());
      await page.keyboard.press('Escape'); assert.equal(await page.locator('.cw-command').count(), 0);
      await page.keyboard.press('Alt+h'); await page.locator('.cw-drawer').waitFor();
      assert.equal(await page.locator('.cw-topic-list [data-topic="aiAdmin"]').count(), role === 'ADMIN' ? 1 : 0);
      await page.locator('.cw-topic-list [data-topic="' + selected + '"]').click();
      assert.equal(await page.locator('.cw-help-full-link').getAttribute('href'), '/help-center?topic=' + selected);
      await page.keyboard.press('Escape');
      const titles = { pt: 'Centro de Ajuda Cristal Water', en: 'Cristal Water Help Centre', es: 'Centro de ayuda Cristal Water', fr: 'Centre d’aide Cristal Water', de: 'Cristal Water Hilfezentrum' };
      for (const [language, title] of Object.entries(titles)) {
        await page.evaluate(language => window.dispatchEvent(new CustomEvent('cw-language-change', { detail: { language } })), language);
        assert.equal(await page.locator('#helpTitle').textContent(), title);
        if (role === 'ADMIN') {
          const fleetTitles = { pt: 'Frota, guias e stock', en: 'Fleet, guides and stock', es: 'Flota, guías y existencias', fr: 'Flotte, guides et stock', de: 'Fuhrpark, Belege und Bestand' };
          assert.equal(await page.locator('#detail h2').textContent(), fleetTitles[language]);
          const guides = await page.evaluate(() => ({ topics: CristalHelp.topics(), actions: CristalHelp.actions() }));
          for (const guide of Object.values(guides.topics)) {
            assert(guide.title && guide.summary && guide.detail && guide.href, 'Every administrative guide needs complete copy and a real destination');
            assert(fs.existsSync(path.join(root, 'frontend', guide.href.split(/[?#]/)[0].slice(1) + '.html')), 'Administrative destination must exist: ' + guide.href);
          }
          for (const action of guides.actions) assert.equal(action.label, guides.topics[action.topic].title, 'Quick command labels must follow the selected language');
          assert(!/futuramente|no futuro|evolução ideal|marcar paga/i.test(JSON.stringify(guides)), 'Help must not present roadmap ideas or bypass receipts');
          assert.equal(guides.topics.priorities.href, '/admin-priority');
        }
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate(() => scrollTo(0, 0));
          await page.waitForFunction(() => parseFloat(getComputedStyle(document.body).paddingTop) >= document.querySelector('.cw-v2-shell-topbar').getBoundingClientRect().height);
          for (const selector of ['#helpTitle', '#search', '#topics .topic', '#detail', '#helpActions a']) {
            const bounds = await page.locator(selector).first().boundingBox(); assert(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, role + '/' + language + ': ' + selector + ' must fit at ' + width);
          }
          const heading = await page.locator('#helpTitle').boundingBox(), topbar = await page.locator('.cw-v2-shell-topbar').boundingBox();
          assert(heading.y >= topbar.y + topbar.height - 1 && heading.y < 260, role + '/' + language + '/' + width + ': help heading must be below the header: ' + JSON.stringify({ heading, topbar }));
          if (width === 1440) {
            const sidebar = await page.locator('.cw-v2-sidebar').boundingBox();
            assert(heading.x >= sidebar.x + sidebar.width - 1, 'Desktop help must sit beside the navigation');
          }
          if (width === 320) assert(await page.locator('.cw-v2-mobile-primary a').evaluateAll(nodes => nodes.length > 0 && nodes.every(node => node.scrollWidth <= node.clientWidth + 1)), 'Mobile navigation labels must exist and fit');
          if (language === 'pt' && [320, 1440].includes(width)) await page.screenshot({ path: path.join(visual, role.toLowerCase() + '-' + width + '.png'), fullPage: true });
        }
        await page.keyboard.press('Control+k'); await checkLinks('.cw-command-results a'); await page.keyboard.press('Escape');
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('[data-cw-open-drawer]').first().click();
      assert(await page.locator('.cw-v2-drawer.is-open').isVisible());
      await page.locator('.cw-v2-drawer-close').click();
      assert.equal(await page.locator('.cw-v2-drawer.is-open').count(), 0);
      await page.keyboard.press('Control+k');
      const other = await context.newPage(); await other.goto('http://help.test/seed');
      await other.evaluate(() => localStorage.setItem('cristalwater_user', '{invalid-json'));
      await page.waitForFunction(() => document.getElementById('helpStatus').dataset.state === 'session');
      assert.equal(await page.locator('#topics button,#helpActions a,#detail a,.cw-command,.cw-drawer,.cw-command-fab').count(), 0);
      await page.keyboard.press('Control+k'); assert.equal(await page.locator('.cw-command').count(), 0);
      assert.deepEqual(await page.evaluate(() => [localStorage.getItem('cwFieldOutbox:qa'), localStorage.getItem('sound_CHAT')]), ['pending-work', 'false']);
      const next = fixture(role === 'ADMIN' ? 'CLIENT' : 'ADMIN');
      await other.evaluate(({ user, token }) => {
        for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
        for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
      }, next);
      await page.waitForFunction(role => window.CristalHelp.session()?.role === role && document.querySelectorAll('#helpActions a').length > 0, next.user.role);
      await page.keyboard.press('Alt+h');
      assert.equal(await page.locator('.cw-topic-list [data-topic="aiAdmin"]').count(), next.user.role === 'ADMIN' ? 1 : 0);
      assert.deepEqual(errors, []); await context.close();
      console.log('PASS help ' + role + ': entry, destinations, forbidden/unknown topics, search, keyboard, five languages/three widths and changed session');
    }
    console.log('Help visual evidence: ' + visual);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
