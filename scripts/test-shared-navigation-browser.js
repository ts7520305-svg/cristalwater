'use strict';
// Actual page markup/styles and navigation scripts, with page business scripts
// excluded. Auth/API journeys remain covered by the field integration suite.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process'), { chromium } = require('playwright');
const root = path.join(__dirname, '..'), baseline = process.env.CW_NAV_BASELINE_SHA;
if (baseline && !/^[0-9a-f]{40}$/.test(baseline)) throw Error('Use a full commit SHA for historical navigation reproduction');
const source = file => baseline ? execFileSync('git', ['show', baseline + ':frontend/' + file], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, 'frontend', file), 'utf8');
const visual = path.join(root, 'reports/field-visual', 'shared-navigation-' + Date.now());
let mobileChecks = 0, mobileOwnershipChecks = 0;
const primaryLabels = {
  ADMIN: {pt:['Início','Visitas','Clientes','Financeiro','Menu'],en:['Home','Visits','Clients','Finance','Menu'],fr:['Accueil','Visites','Clients','Finances','Menu'],es:['Inicio','Visitas','Clientes','Finanzas','Menú'],de:['Start','Besuche','Kunden','Finanzen','Menü']},
  TECHNICIAN: {pt:['Início','Rota','Visita','GPS','Menu'],en:['Home','Route','Visit','GPS','Menu'],fr:['Accueil','Tournée','Visite','GPS','Menu'],es:['Inicio','Ruta','Visita','GPS','Menú'],de:['Start','Route','Besuch','GPS','Menü']},
  CLIENT: {pt:['Piscina','Visitas','Pagamentos','Pedidos','Menu'],en:['Pool','Visits','Payments','Requests','Menu'],fr:['Piscine','Visites','Paiements','Demandes','Menu'],es:['Piscina','Visitas','Pagos','Solicitudes','Menú'],de:['Pool','Besuche','Zahlungen','Anfragen','Menü']},
};
const cases = [
  ['admin-vehicles', 'ADMIN'], ['help-center', 'ADMIN'], ['settings', 'ADMIN'],
  ['client-dashboard', 'CLIENT'], ['client-menu', 'CLIENT'],
  ['technician-new-client', 'TECHNICIAN'], ['technician-guide', 'TECHNICIAN'], ['technician-route', 'TEAM_LEADER'],
];
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    fs.mkdirSync(visual, { recursive: true });
    for (const [name, role] of baseline ? cases.slice(0, 1) : cases) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' }), page = await context.newPage(), errors = [];
      page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(role => {
        window.CristalAuth = { parseUser: () => ({ id: 1, role, principalType: role === 'ADMIN' ? 'USER' : role }) };
        window.CWV2StateAdapter = { start() {} };
        localStorage.setItem('cwFieldOutbox:navigation', 'preserve-work');
      }, role);
      const html = source(name + '.html').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, tag => /src=["']\/crystal-os-v2-(shell|nav)\.js["']/i.test(tag) ? tag : '');
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://navigation.test') return route.abort();
        if (url.pathname === '/' + name) return route.fulfill({ contentType: 'text/html', body: html });
        const file = path.join(root, 'frontend', url.pathname);
        if (/\.(js|css)$/.test(url.pathname) && fs.existsSync(file)) {
          if (url.pathname === '/crystal-os-v2-nav.js') await new Promise(resolve => setTimeout(resolve, 30));
          return route.fulfill({ contentType: url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript', body: source(url.pathname.slice(1)) });
        }
        if (/\.(png|webp|ico)$/.test(url.pathname) && fs.existsSync(file)) return route.fulfill({ body: fs.readFileSync(file) });
        return route.fulfill({ contentType: 'text/html', body: '<h1>Destination</h1>' });
      });
      await page.goto('http://navigation.test/' + name, { waitUntil: 'networkidle' });
      const expectedRole = role === 'TEAM_LEADER' ? 'TECHNICIAN' : role;
      assert.equal(await page.locator('body').getAttribute('data-cw-role'), expectedRole);
      if (baseline) {
        const position = await page.locator('.cw-v2-shell-sidebar').evaluate(node => getComputedStyle(node).position);
        const heading = await page.locator('h1').first().boundingBox();
        await page.locator('[data-cw-search-input]').fill('Ajuda');
        assert(position !== 'fixed' || heading.y > 600, 'Historical page must reproduce the displaced navigation');
        assert.equal(await page.locator('[data-cw-search-results] a').count(), 0, 'Historical late-built search must reproduce the missing binding');
        await page.screenshot({ path: path.join(visual, 'baseline-' + name + '.png') });
        console.log('REPRODUCED historical navigation: ' + JSON.stringify({ name, position, headingY: heading.y, searchResults: 0 }));
        await context.close(); continue;
      }
      for (const width of [320, 390, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForFunction(() => parseFloat(getComputedStyle(document.body).paddingTop) >= document.querySelector('.cw-v2-shell-topbar').getBoundingClientRect().height);
        const heading = await page.locator('h1').first().boundingBox(), topbar = await page.locator('.cw-v2-shell-topbar').boundingBox();
        assert(heading.y >= topbar.y + topbar.height - 1 && heading.y < 450, name + '/' + width + ': title must follow the header: ' + JSON.stringify({ heading, topbar }));
        assert.equal(await page.locator('.cw-v2-shell-sidebar').isVisible(), width > 1200);
        assert.equal(await page.locator('.cw-v2-mobile-primary').isVisible(), width <= 900);
        if (width <= 900) {
          const mobile = page.locator('.cw-v2-mobile-primary');
          assert.equal(await mobile.locator(':scope > a,:scope > button').count(), 5);
          const originalLanguage = await page.locator('html').getAttribute('lang');
          await mobile.evaluate(node => { window.qaPrimaryNodes = [...node.children]; window.qaPrimaryLeaves = qaPrimaryNodes.map(item => item.firstChild); window.qaPrimaryDestinations = qaPrimaryNodes.map(item => [item.getAttribute('href'),item.getAttribute('type'),item.hasAttribute('data-cw-open-drawer')]); });
          for (const language of ['pt','en','fr','es','de']) {
            await page.evaluate(language => { document.documentElement.lang = language; dispatchEvent(new CustomEvent('cw-language-change',{ detail: { language } })); }, language);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert.deepEqual(await mobile.locator(':scope > a,:scope > button').allTextContents(),primaryLabels[expectedRole][language],name+'/'+language+'/'+width+': native navigation copy');
            const geometry = await mobile.locator(':scope > a,:scope > button').evaluateAll(nodes => nodes.map(node => { const bounds = node.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(node); return { text: node.textContent,width: bounds.width,height: bounds.height,left: bounds.left,right: bounds.right,viewport: innerWidth,barLeft: node.parentElement.getBoundingClientRect().left,barRight: node.parentElement.getBoundingClientRect().right,lines: [...range.getClientRects()].map(rect => ({ left: rect.left,right: rect.right })) }; }));
            for (const item of geometry) { assert(item.width >= 44 && item.height >= 44 && item.left >= 0 && item.right <= item.viewport && item.left >= item.barLeft && item.right <= item.barRight, name + '/' + width + ': touch target fits ' + JSON.stringify(item)); assert.equal(item.lines.length, 1, name + '/' + language + '/' + width + ': complete navigation label ' + item.text); assert(item.lines.every(rect => rect.left >= item.left && rect.right <= item.right), 'Navigation text stays inside its button: ' + item.text); }
            assert(await mobile.evaluate(node => [...node.children].every((item,index) => item === qaPrimaryNodes[index] && item.firstChild === qaPrimaryLeaves[index] && JSON.stringify([item.getAttribute('href'),item.getAttribute('type'),item.hasAttribute('data-cw-open-drawer')]) === JSON.stringify(qaPrimaryDestinations[index]))));
            assert.equal(await page.evaluate(() => localStorage.getItem('cwFieldOutbox:navigation')), 'preserve-work'); mobileChecks++;
            if (width === 320 && ['pt','de'].includes(language)) await mobile.screenshot({ path: path.join(visual,name + '-' + language + '-mobile-320.png') });
          }
          await page.evaluate(language => { document.documentElement.lang = language; dispatchEvent(new CustomEvent('cw-language-change',{ detail: { language } })); }, originalLanguage);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        }
        if (width > 1200) {
          assert.equal(await page.locator('.cw-v2-shell-sidebar').evaluate(node => getComputedStyle(node).position), 'fixed');
          assert(heading.x >= 280, name + ': content must sit next to the sidebar');
        }
        const trigger = page.locator('.cw-v2-shell-topbar [data-cw-open-drawer]');
        await trigger.click();
        const drawer = page.locator('.cw-v2-drawer.is-open'), panel = drawer.locator('.cw-v2-drawer-panel');
        const bounds = await panel.boundingBox();
        assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.height <= 1001, name + ': drawer fits viewport');
        assert.equal(await page.locator('[data-cw-close-drawer]').evaluate(node => node === document.activeElement), true);
        await page.keyboard.press('Shift+Tab');
        assert.equal(await drawer.evaluate(node => document.activeElement === [...node.querySelectorAll('a[href],button,summary')].filter(item => item.getClientRects().length).at(-1)), true);
        await page.keyboard.press('Tab'); assert.equal(await page.locator('[data-cw-close-drawer]').evaluate(node => node === document.activeElement), true);
        await page.keyboard.press('Escape'); assert.equal(await page.locator('.cw-v2-drawer.is-open').count(), 0);
        assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
        if ([320, 1440].includes(width)) await page.screenshot({ path: path.join(visual, name + '-' + width + '.png') });
      }
      // The painter owns only its original text leaves; foreign changes and clones stay literal.
      await page.evaluate(() => { const nodes=[...document.querySelector('.cw-v2-mobile-primary').children],clone=nodes[0].cloneNode(true);clone.id='qaPrimaryClone';document.body.appendChild(clone);nodes[0].firstChild.nodeValue='Foreign navigation <b>{literal}</b>';nodes[1].append(document.createElement('span'));nodes[2].replaceChild(document.createTextNode(nodes[2].firstChild.nodeValue),nodes[2].firstChild);window.qaForeignPrimary=[nodes[0],nodes[1],nodes[2],clone];window.qaForeignPrimaryHtml=qaForeignPrimary.map(node=>node.innerHTML); });
      for (const language of ['pt','en','fr','es','de']) {
        await page.evaluate(language => { document.documentElement.lang=language;dispatchEvent(new CustomEvent('cw-language-change',{detail:{language}})); },language);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert(await page.evaluate(() => qaForeignPrimary.every((node,index)=>node.innerHTML===qaForeignPrimaryHtml[index])));
        assert.equal(await page.locator('.cw-v2-mobile-primary > button').textContent(),primaryLabels[expectedRole][language][4]);mobileOwnershipChecks+=4;
      }
      await page.evaluate(() => { document.documentElement.lang='pt';dispatchEvent(new CustomEvent('cw-language-change',{detail:{language:'pt'}})); });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const input = page.locator('[data-cw-search-input]'), results = page.locator('[data-cw-search-results]');
      await input.fill('Ajuda');
      assert.equal(await results.locator('a[href="/help-center"]').count(), 1, 'Duplicate sidebar/drawer destinations must appear once');
      await input.press('ArrowDown'); assert.equal(await results.locator('a').first().evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('Escape'); assert.equal(await results.isVisible(), false); assert.equal(await input.evaluate(node => node === document.activeElement), true);
      await input.fill('no-such-menu-item'); assert.equal(await results.locator('a').count(), 0); assert(await results.locator('[role=status]').isVisible());
      await page.evaluate(() => {
        for (const href of ['/safe-destination', '//external.invalid', 'javascript:void(0)']) {
          const a = document.createElement('a'); a.href = href; a.setAttribute('data-shell-search', '<img src=x onerror=alert(1)> menu-probe'); document.body.appendChild(a);
        }
      });
      await input.fill('menu-probe'); assert.equal(await results.locator('a').count(), 1); assert.equal(await results.locator('img').count(), 0);
      assert.equal(await results.locator('a').textContent(), '<img src=x onerror=alert(1)> menu-probe');
      await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); dispatchEvent(new Event('offline')); });
      assert.equal(await page.locator('[data-offline-indicator]').textContent(), 'Offline');
      await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); dispatchEvent(new Event('online')); });
      assert.equal(await page.locator('[data-offline-indicator]').textContent(), 'Online');
      await input.fill('Ajuda'); await input.press('Enter'); await page.waitForURL('http://navigation.test/help-center');
      assert.equal(await page.evaluate(() => localStorage.getItem('cwFieldOutbox:navigation')), 'preserve-work');
      assert.deepEqual(errors, []);
      console.log('PASS navigation ' + name + '/' + role + ': four widths, drawer focus, delayed binding, safe unique search, actual keyboard link and offline indicator');
      await context.close();
    }
    console.log('PASS shared mobile navigation: ' + JSON.stringify({ mobileChecks,mobileOwnershipChecks,languages: 5,widths: [320,390],profiles: ['ADMIN','CLIENT','TECHNICIAN','TEAM_LEADER'],fiveWholeLabels: true,targetsAtLeast44px: true,nodesAndDestinationsAndWorkRetained: true,componentOnly: true }));
    console.log('Navigation visual evidence: ' + visual);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
