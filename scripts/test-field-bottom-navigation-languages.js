'use strict';
// Source-backed component QA. Page business/auth scripts are excluded here;
// native login, session and pending-work journeys have their own integration QA.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { chromium } = require('playwright');
const root = path.join(__dirname,'../frontend'), origin = 'http://bottom-navigation.test';
const languages = ['pt','en','fr','es','de'];
const labels = {
  TECHNICIAN: [['Hoje','Today','Aujourd’hui','Hoy','Heute'],['Ronda','Route','Tournée','Ruta','Route'],['Visitas','Visits','Visites','Visitas','Besuche'],['Docs','Docs','Docs','Docs','Dok.'],['Perfil','Profile','Profil','Perfil','Profil']],
  CLIENT: [['Inicio','Home','Accueil','Inicio','Start'],['Piscina','Pool','Piscine','Piscina','Pool'],['Historico','History','Historique','Historial','Verlauf'],['Pedidos','Requests','Demandes','Pedidos','Anfragen'],['Perfil','Profile','Profil','Perfil','Profil']],
};
const aria = { TECHNICIAN: ['Navegacao rapida tecnico','Technician quick navigation','Navigation rapide du technicien','Navegación rápida del técnico','Techniker-Schnellnavigation'],CLIENT: ['Navegacao rapida cliente','Client quick navigation','Navigation rapide du client','Navegación rápida del cliente','Kunden-Schnellnavigation'] };
const documents = ['Documentos','Documents','Documents','Documentos','Dokumente'];
const targets = { TECHNICIAN: ['/technician-field-mode','/technician-route','/technician-visit','/technician-guide','/technician-profile'],CLIENT: ['/client-portal','/client','/client-history','/client-notifications','/client-profile'] };
const work = { 'cwFieldVisitDrafts:nav': '{"REGULAR":"keep <b>{name}</b>","EXTRA":"separate same resource"}','cwFieldOutbox:nav': 'original queue UUID/hash bytes','cwFieldRouteCache:nav': 'original route bytes','cwFieldLegacyCorrupt:nav': '{broken bytes' };
let browser, completed = false,checks = 0,controls = 0;
const deadline = setTimeout(() => { console.error('Bottom navigation language QA deadline'); process.exit(1); },90000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  browser = await chromium.launch({ headless: true,executablePath: process.env.CW_CHROMIUM_PATH,args: ['--no-sandbox','--disable-dev-shm-usage'] });
  for (const [name,role] of [['technician-login','TECHNICIAN'],['technician-profile','TECHNICIAN'],['technician-login','TEAM_LEADER'],['client-login','CLIENT']]) {
    const profile = role === 'CLIENT' ? 'CLIENT' : 'TECHNICIAN',context = await browser.newContext({ viewport: { width: 390,height: 900 },serviceWorkers: 'block' }),page = await context.newPage();
    page.setDefaultTimeout(6000);const errors = [],requests = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push({ url: request.url(),method: request.method() }));
    await context.addInitScript(({ role,work,origin }) => {
      if (location.origin !== origin) return;
      if (!localStorage.getItem('qaBottomNavigation')) {
        for (const [key,value] of Object.entries(work)) localStorage.setItem(key,value);
        for (const key of ['token','cristalwater_jwt','adminToken']) localStorage.setItem(key,'component-session-' + role);
        for (const key of ['user','cristalwater_user']) localStorage.setItem(key,JSON.stringify({ id: 41,technicianId: 41,role,name: 'Literal Ronda {name}',language: 'pt' }));
        localStorage.setItem('qaBottomNavigation','1');
      }
      window.CristalAuth = { getToken: () => localStorage.getItem('cristalwater_jwt'),parseUser: () => JSON.parse(localStorage.getItem('cristalwater_user')) };
    },{ role,work,origin });
    const original = await fs.readFile(path.join(root,name + '.html'),'utf8');
    const html = original.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace('</body>','<script src="/cw-i18n.js"></script><script src="/ui/design-system.js"></script></body>');
    await context.route('**/*',async route => {
      const url = new URL(route.request().url()); if (url.origin !== origin) return route.abort();
      if (url.pathname === '/' + name) return route.fulfill({ contentType: 'text/html',body: html });
      if (url.pathname.startsWith('/api/settings/language/')) return route.fulfill({ json: { ok: true,language: route.request().method() === 'GET' ? 'pt' : route.request().postDataJSON().language } });
      if (/\.(js|css)$/.test(url.pathname)) return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'application/javascript' : 'text/css',body: await fs.readFile(path.join(root,url.pathname.slice(1)),'utf8') });
      return route.fulfill({ contentType: 'text/html',body: '<!doctype html><title>Destination</title><body>Destination</body>' });
    });
    await page.goto(origin + '/' + name);await page.locator('#cwLanguageSelect').waitFor();await page.locator('.ds-bottom-nav').waitFor();
    await page.evaluate(() => {
      const input = document.createElement('input');input.id = 'qaNavTyped';input.value = 'typed PIN <b>{name}</b>';input.setAttribute('data-cw-no-i18n','');document.body.append(input);
      const literal = document.createElement('span');literal.id = 'qaNavLiteral';literal.textContent = 'Ronda Perfil';literal.setAttribute('data-cw-no-i18n','');document.body.append(literal);
      window.qaBottomNodes = [document.querySelector('.ds-bottom-nav'),...document.querySelectorAll('.ds-bottom-nav a')];window.qaBottomTexts = qaBottomNodes.slice(1).map(node => node.firstChild);
      window.qaBottomHandlerCalls = 0;qaBottomNodes[2].addEventListener('click',() => { qaBottomHandlerCalls++;sessionStorage.setItem('qaBottomHandlerCalls',String(qaBottomHandlerCalls)); });
    });
    const raw = () => page.evaluate(keys => Object.fromEntries(keys.map(key => [key,localStorage.getItem(key)])),Object.keys(work));
    const state = () => page.evaluate(() => ({ tokens: ['token','cristalwater_jwt','adminToken'].map(key => localStorage.getItem(key)),users: ['user','cristalwater_user'].map(key => { const user = JSON.parse(localStorage.getItem(key)); delete user.language;return user; }),typed: document.getElementById('qaNavTyped').value,focus: document.activeElement.getAttribute('href') || document.activeElement.id,hrefs: [...document.querySelectorAll('.ds-bottom-nav a')].map(node => node.getAttribute('href')),classes: [...document.querySelectorAll('.ds-bottom-nav a')].map(node => node.className),literal: document.getElementById('qaNavLiteral').textContent }));
    assert.deepEqual((await state()).hrefs,targets[profile]);
    assert.deepEqual(await page.locator('.ds-bottom-nav a.is-active').evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))),name === 'technician-profile' ? ['/technician-profile'] : []);
    for (const width of [320,390,1440]) {
      await page.setViewportSize({ width,height: 900 });
      if (await page.locator('.ds-bottom-nav').isVisible()) await page.locator('.ds-bottom-nav a').nth(1).focus(); else await page.locator('#qaNavTyped').focus();
      const before = await state();
      for (const [i,language] of languages.entries()) {
        await page.locator('#cwLanguageSelect').selectOption(language);await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.evaluate(() => document.documentElement.lang),language);
        assert.deepEqual(await page.locator('.ds-bottom-nav a').allTextContents(),labels[profile].map(words => words[i]));assert.equal(await page.locator('.ds-bottom-nav').getAttribute('aria-label'),aria[profile][i]);
        if (profile === 'TECHNICIAN') assert.equal(await page.locator('.ds-bottom-nav a').nth(3).getAttribute('aria-label'),documents[i]);
        assert.deepEqual(await state(),before);assert.deepEqual(await raw(),work);assert(await page.evaluate(() => qaBottomNodes.every(node => node.isConnected) && qaBottomTexts.every((node,index) => node === qaBottomNodes[index + 1].firstChild)));
        if (width < 900) assert(await page.locator('.ds-bottom-nav a').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1 && node.getBoundingClientRect().left >= 0 && node.getBoundingClientRect().right <= innerWidth + 1 && node.getBoundingClientRect().width >= 44 && node.getBoundingClientRect().height >= 44)),'All five labels fit their touch targets: ' + profile + '/' + language + '/' + width);
        checks++;
        if (process.env.CW_BOTTOM_NAV_CAPTURE && width === 320 && ['fr','de'].includes(language)) { await fs.mkdir(process.env.CW_BOTTOM_NAV_CAPTURE,{ recursive: true });await page.locator('.ds-bottom-nav').screenshot({ path: path.join(process.env.CW_BOTTOM_NAV_CAPTURE,name + '-' + role + '-' + language + '-320.png') }); }
      }
    }
    await page.setViewportSize({ width: 320,height: 900 });await page.locator('.ds-bottom-nav a').nth(1).focus();await page.keyboard.press('Enter');await page.waitForURL(origin + targets[profile][1]);assert.deepEqual(await raw(),work);assert.equal(await page.evaluate(() => localStorage.getItem('cristalwater_jwt')),'component-session-' + role);assert.equal(await page.evaluate(() => sessionStorage.getItem('qaBottomHandlerCalls')),'1');
    assert(requests.filter(request => !['GET','HEAD'].includes(request.method)).every(request => new URL(request.url).pathname === '/api/settings/language/me'));
    assert.deepEqual(errors,[]);await context.close();console.log('PASS fallback navigation ' + JSON.stringify({ name,role,languages: 5,widths: [320,390,1440],nodesAndFocusAndDestinationsPreserved: true,keyboardDestination: targets[profile][1] }));
  }
  // Production guard conditions and foreign ownership, using a minimal page
  // and the original component. These are component fixtures, not auth gates.
  for (const content of ['<div class="field-tabs">Owned field tabs</div>','<nav class="cw-v2-mobile-nav">Owned mobile menu</nav>','<nav class="ds-bottom-nav"><a href="/foreign" data-cw-no-i18n>Ronda Perfil</a></nav>']) {
    const page = await browser.newPage();await page.route('**/*',route => route.fulfill({ contentType: 'text/html',body: '<!doctype html><html lang="pt"><body>' + content + '</body></html>' }));await page.goto(origin + '/technician-profile');
    const before = await page.locator('body').innerHTML();await page.addScriptTag({ content: await fs.readFile(path.join(root,'ui/design-system.js'),'utf8') });
    for (const language of languages) { await page.evaluate(language => { document.documentElement.lang = language;dispatchEvent(new CustomEvent('cw-language-change')); },language);await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
    assert.equal(await page.locator('.ds-bottom-nav').count(),content.includes('ds-bottom-nav') ? 1 : 0);assert.equal(await page.locator('body').innerHTML(),before + await page.locator('body > script').evaluateAll(nodes => nodes.map(node => node.outerHTML).join('')));controls++;await page.close();
  }
  console.log('PASS fallback navigation language result ' + JSON.stringify({ checks,controls,languages: 5,profiles: ['TECHNICIAN','TEAM_LEADER','CLIENT'],ownedLeavesOnly: true,noOperationalWrites: true,componentOnly: true }));completed = true;
})().catch(error => { console.error(error);process.exitCode = 1; }).finally(async () => { clearTimeout(deadline);await browser?.close(); });
