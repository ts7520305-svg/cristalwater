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
let headerChecks = 0, headerOwnershipChecks = 0, emptySearchChecks = 0;
let sidebarChecks = 0, sidebarOwnershipChecks = 0, multilingualSearchChecks = 0;
const languages = ['pt','en','fr','es','de'];
const roleLabels = {ADMIN:['Administrador','Administrator','Administrateur','Administrador','Administrator'],TECHNICIAN:['Técnico','Technician','Technicien','Técnico','Techniker'],CLIENT:['Cliente','Client','Client','Cliente','Kunde']};
const headerLabels = {
  'admin-vehicles': [['Técnicos e equipa','Technicians and team','Techniciens et équipe','Técnicos y equipo','Techniker und Team'],['Viaturas','Vehicles','Véhicules','Vehículos','Fahrzeuge']],
  'help-center': [['Ajuda','Help','Aide','Ayuda','Hilfe'],['Centro de ajuda','Help centre','Centre d’aide','Centro de ayuda','Hilfezentrum']],
  settings: [['Configurações','Settings','Paramètres','Configuración','Einstellungen'],['Configurações','Settings','Paramètres','Configuración','Einstellungen']],
  'client-dashboard': [['Portal do cliente','Client portal','Portail client','Portal del cliente','Kundenportal'],['Próximas e últimas visitas','Upcoming and recent visits','Visites à venir et récentes','Próximas y últimas visitas','Bevorstehende und letzte Besuche']],
  'client-menu': [['Portal do cliente','Client portal','Portail client','Portal del cliente','Kundenportal'],['Pedidos e orçamentos','Requests and quotes','Demandes et devis','Solicitudes y presupuestos','Anfragen und Angebote']],
  'technician-new-client': [['Técnico em campo','Field technician','Technicien sur le terrain','Técnico de campo','Techniker vor Ort'],['Novo cliente em campo','New client in the field','Nouveau client sur le terrain','Nuevo cliente en campo','Neuer Kunde vor Ort']],
  'technician-guide': [['Técnico em campo','Field technician','Technicien sur le terrain','Técnico de campo','Techniker vor Ort'],['Guias e logística','Guides and logistics','Bordereaux et logistique','Guías y logística','Begleitpapiere und Logistik']],
  'technician-route': [['Técnico em campo','Field technician','Technicien sur le terrain','Técnico de campo','Techniker vor Ort'],['Sequência da rota','Route sequence','Ordre de la tournée','Secuencia de la ruta','Routenfolge']],
};
const searchLabels = ['Pesquisar','Search','Rechercher','Buscar','Suchen'],searchAria = ['Pesquisar no menu','Search the menu','Rechercher dans le menu','Buscar en el menú','Im Menü suchen'];
const fullMenuLabels = ['Menu completo','Full menu','Menu complet','Menú completo','Vollständiges Menü'],closeLabels = ['Fechar','Close','Fermer','Cerrar','Schließen'];
const emptyLabels = ['Sem resultados','No results','Aucun résultat','Sin resultados','Keine Ergebnisse'];
const helpLabels = ['Ajuda','Help','Aide','Ayuda','Hilfe'];
const sidebarGroups = {
  ADMIN: [
    ['1. Visão geral','1. Overview','1. Vue d’ensemble','1. Vista general','1. Übersicht'],
    ['2. Operação','2. Operations','2. Opérations','2. Operaciones','2. Betrieb'],
    ['3. Clientes','3. Clients','3. Clients','3. Clientes','3. Kunden'],
    ['4. Piscinas','4. Pools','4. Piscines','4. Piscinas','4. Pools'],
    ['5. Técnicos e equipa','5. Technicians and team','5. Techniciens et équipe','5. Técnicos y equipo','5. Techniker und Team'],
    ['6. Comercial','6. Sales','6. Commercial','6. Comercial','6. Vertrieb'],
    ['7. Faturação e financeiro','7. Billing and finance','7. Facturation et finances','7. Facturación y finanzas','7. Abrechnung und Finanzen'],
    ['8. Stock e produtos','8. Stock and products','8. Stock et produits','8. Stock y productos','8. Lager und Produkte'],
    ['9. Equipamentos','9. Equipment','9. Équipements','9. Equipos','9. Ausrüstung'],
    ['10. Obras e logística','10. Works and logistics','10. Travaux et logistique','10. Obras y logística','10. Arbeiten und Logistik'],
    ['11. Comunicação','11. Communication','11. Communication','11. Comunicación','11. Kommunikation'],
    ['12. Relatórios e estatísticas','12. Reports and statistics','12. Rapports et statistiques','12. Informes y estadísticas','12. Berichte und Statistiken'],
    ['13. Configurações','13. Settings','13. Paramètres','13. Configuración','13. Einstellungen'],
  ],
  TECHNICIAN: [['Hoje','Today','Aujourd’hui','Hoy','Heute'],['Logística','Logistics','Logistique','Logística','Logistik'],['Conta','Account','Compte','Cuenta','Konto']],
  CLIENT: [['Portal do cliente','Client portal','Portail client','Portal del cliente','Kundenportal']],
};
const sidebarFirstLinks = {ADMIN:['Centro de operações','Operations centre','Centre des opérations','Centro de operaciones','Betriebszentrale'],TECHNICIAN:['Rota do dia','Today’s route','Tournée du jour','Ruta del día','Tagesroute'],CLIENT:['Estado da piscina','Pool status','État de la piscine','Estado de la piscina','Poolzustand']};
const soundLabels = ['Preferências de som','Sound preferences','Préférences sonores','Preferencias de sonido','Toneinstellungen'];
const sidebarAria = ['Navegacao principal V2','Main navigation V2','Navigation principale V2','Navegación principal V2','Hauptnavigation V2'];
const mobileAria = ['Navegacao primaria mobile','Primary mobile navigation','Navigation mobile principale','Navegación móvil principal','Mobile Hauptnavigation'];
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
      await page.evaluate(() => { window.qaHeaderNodes=[...document.querySelectorAll('.cw-v2-context-kicker,.cw-v2-context-title,[data-cw-breadcrumb],.cw-v2-shell-topbar [data-cw-open-drawer],.cw-v2-drawer-title')];window.qaHeaderLeaves=qaHeaderNodes.map(node=>node.firstChild);window.qaSearchNode=document.querySelector('[data-cw-search-input]'); });
      await page.evaluate(() => { window.qaSidebarNodes=[...document.querySelectorAll('.cw-v2-shell-sidebar summary,.cw-v2-shell-sidebar .cw-v2-nav-links a,[data-cw-drawer-groups] summary,[data-cw-drawer-groups] a,.cw-v2-brand small')];window.qaSidebarLeaves=qaSidebarNodes.map(node=>node.firstChild);window.qaSidebarHrefs=qaSidebarNodes.map(node=>node.getAttribute('href')); });
      for (const width of [320, 390, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForFunction(() => parseFloat(getComputedStyle(document.body).paddingTop) >= document.querySelector('.cw-v2-shell-topbar').getBoundingClientRect().height);
        const heading = await page.locator('h1').first().boundingBox(), topbar = await page.locator('.cw-v2-shell-topbar').boundingBox();
        assert(heading.y >= topbar.y + topbar.height - 1 && heading.y < 450, name + '/' + width + ': title must follow the header: ' + JSON.stringify({ heading, topbar }));
        assert.equal(await page.locator('.cw-v2-shell-sidebar').isVisible(), width > 1200);
        assert.equal(await page.locator('.cw-v2-mobile-primary').isVisible(), width <= 900);
        const headerInput = page.locator('[data-cw-search-input]');
        await headerInput.fill('Literal Á<{unchanged}>'); await headerInput.evaluate(node=>{node.focus();node.setSelectionRange(2,7);});
        for (const language of ['en','fr','es','de','pt']) {
          await page.evaluate(language=>{document.documentElement.lang=language;dispatchEvent(new CustomEvent('cw-language-change',{detail:{language}}));},language);
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const index=languages.indexOf(language),[areas,titles]=headerLabels[name];
          for (const selector of ['.cw-v2-shell-sidebar','[data-cw-drawer-groups]']) {
            assert.deepEqual(await page.locator(selector+' summary').allTextContents(),sidebarGroups[expectedRole].map(group=>group[index]));
            assert.equal(await page.locator(selector+' .cw-v2-nav-links a').first().textContent(),sidebarFirstLinks[expectedRole][index]);
            assert.equal(await page.locator(selector+' a[href="/help-center"]').textContent(),helpLabels[index]);
            assert(await page.locator(selector+' [data-shell-search]').evaluateAll(nodes=>nodes.every(node=>node.textContent===node.getAttribute('data-shell-search')&&node.hasAttribute('data-cw-no-i18n')&&CWNavigationSearch.labels(node).length===5)));
            if(expectedRole==='ADMIN')assert.equal(await page.locator(selector+' a[href="/settings"]').textContent(),soundLabels[index]);
          }
          assert.equal(await page.locator('.cw-v2-brand small').textContent(),roleLabels[expectedRole][index]);
          assert.equal(await page.locator('.cw-v2-shell-sidebar nav').getAttribute('aria-label'),sidebarAria[index]);assert.equal(await page.locator('.cw-v2-mobile-primary').getAttribute('aria-label'),mobileAria[index]);
          assert(await page.evaluate(()=>qaSidebarNodes.every((node,index)=>node.isConnected&&node.firstChild===qaSidebarLeaves[index]&&node.getAttribute('href')===qaSidebarHrefs[index])));sidebarChecks++;
          assert.equal(await page.locator('.cw-v2-context-kicker').textContent(),areas[index],name+'/'+language+'/'+width+': header area');
          assert.equal(await page.locator('.cw-v2-context-title').textContent(),titles[index],name+'/'+language+'/'+width+': header title');
          assert.equal(await page.locator('[data-cw-breadcrumb]').textContent(),[roleLabels[expectedRole][index],areas[index],titles[index]].join(' / '));
          assert.equal(await headerInput.getAttribute('placeholder'),searchLabels[index]);assert.equal(await headerInput.getAttribute('aria-label'),searchAria[index]);
          assert.equal(await page.locator('.cw-v2-shell-topbar [data-cw-open-drawer]').textContent(),primaryLabels[expectedRole][language][4]);
          assert.equal(await page.locator('.cw-v2-drawer-title').textContent(),primaryLabels[expectedRole][language][4]);
          assert.equal(await page.locator('.cw-v2-drawer-panel').getAttribute('aria-label'),fullMenuLabels[index]);assert.equal(await page.locator('[data-cw-close-drawer]').getAttribute('aria-label'),closeLabels[index]);
          assert(await page.evaluate(()=>qaHeaderNodes.every((node,index)=>node.firstChild===qaHeaderLeaves[index])&&qaSearchNode===document.querySelector('[data-cw-search-input]')&&document.activeElement===qaSearchNode&&qaSearchNode.value==='Literal Á<{unchanged}>'&&qaSearchNode.selectionStart===2&&qaSearchNode.selectionEnd===7));
          assert(await page.locator('.cw-v2-shell-topbar').evaluate(node=>{const bounds=node.getBoundingClientRect();return bounds.left>=0&&bounds.right<=innerWidth&&parseFloat(getComputedStyle(document.body).paddingTop)>=bounds.height;}));
          assert.equal(await page.evaluate(()=>localStorage.getItem('cwFieldOutbox:navigation')),'preserve-work');headerChecks++;
          if(width===320&&language==='de')await page.screenshot({path:path.join(visual,name+'-de-header-320.png')});
        }
        await headerInput.fill('');
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
      // Text and accessible attributes have separate private ownership; neither may reclaim foreign mutations or clones.
      await page.evaluate(()=>{
        const [area,title,breadcrumb,menu,drawerTitle]=qaHeaderNodes,input=qaSearchNode,dialog=document.querySelector('.cw-v2-drawer-panel');
        area.firstChild.nodeValue='Foreign header <b>{literal}</b>';title.append(document.createElement('span'));breadcrumb.replaceChild(document.createTextNode(breadcrumb.firstChild.nodeValue),breadcrumb.firstChild);
        const menuClone=menu.cloneNode(true),inputClone=input.cloneNode(true),drawerClone=drawerTitle.cloneNode(true);document.body.append(menuClone,inputClone,drawerClone);
        input.setAttribute('placeholder','Foreign search <b>{literal}</b>');dialog.setAttribute('aria-label','Foreign dialog {literal}');
        window.qaForeignHeader=[area,title,breadcrumb,menuClone,drawerClone];window.qaForeignHeaderHtml=qaForeignHeader.map(node=>node.innerHTML);
        window.qaForeignInput=inputClone;window.qaForeignInputHtml=inputClone.outerHTML;
      });
      for(const language of languages){
        await page.evaluate(language=>{document.documentElement.lang=language;dispatchEvent(new CustomEvent('cw-language-change',{detail:{language}}));},language);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        assert(await page.evaluate(()=>qaForeignHeader.every((node,index)=>node.innerHTML===qaForeignHeaderHtml[index])&&qaForeignInput.outerHTML===qaForeignInputHtml));
        assert.equal(await page.locator('.cw-v2-shell-topbar [data-cw-search-input]').getAttribute('placeholder'),'Foreign search <b>{literal}</b>');assert.equal(await page.locator('.cw-v2-drawer-panel').getAttribute('aria-label'),'Foreign dialog {literal}');
        assert.equal(await page.locator('.cw-v2-shell-topbar [data-cw-search-input]').getAttribute('aria-label'),searchAria[languages.indexOf(language)]);assert.equal(await page.locator('[data-cw-close-drawer]').getAttribute('aria-label'),closeLabels[languages.indexOf(language)]);
        assert.equal(await page.locator('.cw-v2-shell-topbar [data-cw-open-drawer]').textContent(),primaryLabels[expectedRole][language][4]);headerOwnershipChecks+=8;
      }
      await page.evaluate(()=>{for(const node of qaForeignHeader.slice(3))node.remove();qaForeignInput.remove();});
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
      for(const language of languages){
        await page.evaluate(language=>{document.documentElement.lang=language;dispatchEvent(new CustomEvent('cw-language-change',{detail:{language}}));},language);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        for(const query of helpLabels){await input.fill(query);assert.equal(await results.locator('a[href="/help-center"]').count(),1);assert.equal(await results.locator('a[href="/help-center"]').textContent(),helpLabels[languages.indexOf(language)]);multilingualSearchChecks++;}
      }
      if(expectedRole==='ADMIN'){await input.fill('OPERACOES');assert.equal(await results.locator('a[href="/admin-master-control"]').textContent(),'Betriebszentrale');multilingualSearchChecks++;}
      await input.fill('Hilfe');await input.press('ArrowDown');
      await results.locator('a').first().evaluate(node=>{window.qaRetainedResult=node;window.qaRetainedResultLabel=node.textContent;});
      await page.evaluate(()=>{document.documentElement.lang='en';dispatchEvent(new CustomEvent('cw-language-change',{detail:{language:'en'}}));});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert(await page.evaluate(()=>qaRetainedResult===document.activeElement&&qaRetainedResult.isConnected&&qaRetainedResult.textContent===qaRetainedResultLabel&&document.querySelector('[data-cw-search-input]').value==='Hilfe'));
      await page.keyboard.press('Escape');await input.fill('Hilfe');assert.equal(await results.locator('a[href="/help-center"]').textContent(),'Help');
      // Only original intact leaves provide aliases; public markers cannot adopt foreign nodes.
      await page.evaluate(()=>{
        const groups=[...document.querySelectorAll('.cw-v2-shell-sidebar summary')],links=[...document.querySelectorAll('.cw-v2-shell-sidebar .cw-v2-nav-links a')],clone=links[0].cloneNode(true);clone.id='qaSidebarClone';document.body.appendChild(clone);
        groups[0].firstChild.nodeValue='Foreign group <b>{literal}</b>';links[0].firstChild.nodeValue='Foreign link';links[1].setAttribute('data-shell-search','Foreign search');links[2].replaceChild(document.createTextNode(links[2].textContent),links[2].firstChild);links[3].append(document.createElement('span'));
        window.qaDetachedSidebar=links[4];qaDetachedSidebar.remove();const originalMetadata=links[5].getAttribute('data-shell-search');links[5].setAttribute('data-shell-search','Temporary foreign metadata');CWNavigationSearch.labels(links[5]);links[5].setAttribute('data-shell-search',originalMetadata);window.qaForeignSidebar=[groups[0],...links.slice(0,6),clone];window.qaForeignSidebarHtml=qaForeignSidebar.map(node=>node.innerHTML);window.qaForeignSidebarMetadata=qaForeignSidebar.map(node=>node.getAttribute('data-shell-search'));
        const owned=document.querySelector('[data-cw-drawer-groups] a'),aliases=CWNavigationSearch.labels(owned);aliases[0]='Poisoned alias';window.qaAliasCopySafe=CWNavigationSearch.labels(owned)[0]!=='Poisoned alias';
      });
      for(const language of languages){await page.evaluate(language=>{document.documentElement.lang=language;dispatchEvent(new CustomEvent('cw-language-change',{detail:{language}}));},language);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert(await page.evaluate(()=>qaAliasCopySafe&&Object.isFrozen(CWNavigationSearch)&&qaForeignSidebar.every((node,index)=>node.innerHTML===qaForeignSidebarHtml[index]&&node.getAttribute('data-shell-search')===qaForeignSidebarMetadata[index]&&CWNavigationSearch.labels(node).length===0)));sidebarOwnershipChecks+=8;}
      await page.evaluate(()=>{document.querySelector('.cw-v2-shell-sidebar .cw-v2-nav-links').appendChild(qaDetachedSidebar);document.getElementById('qaSidebarClone').remove();});
      await page.evaluate(()=>{document.documentElement.lang='pt';dispatchEvent(new CustomEvent('cw-language-change',{detail:{language:'pt'}}));});
      await input.fill('no-such-menu-item'); assert.equal(await results.locator('a').count(), 0); assert(await results.locator('[role=status]').isVisible());
      await results.locator('[role=status]').evaluate(node=>{window.qaEmptyNode=node;window.qaEmptyLeaf=node.firstChild;window.qaEmptyParent=node.parentElement;});
      for(const language of ['en','fr','es','de','pt']){
        await page.evaluate(language=>{document.documentElement.lang=language;dispatchEvent(new CustomEvent('cw-language-change',{detail:{language}}));},language);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        assert.equal(await results.locator('[role=status]').textContent(),emptyLabels[languages.indexOf(language)]);
        assert(await page.evaluate(()=>qaEmptyNode.firstChild===qaEmptyLeaf&&qaEmptyNode.parentElement===qaEmptyParent&&document.querySelector('[data-cw-search-input]').value==='no-such-menu-item'&&document.activeElement===document.querySelector('[data-cw-search-input]')));emptySearchChecks++;
      }
      await page.evaluate(()=>{const clone=qaEmptyNode.cloneNode(true);document.body.appendChild(clone);qaEmptyNode.firstChild.nodeValue='Foreign result <b>{literal}</b>';window.qaEmptyClone=clone;window.qaEmptyCloneText=clone.textContent;});
      for(const language of languages){await page.evaluate(language=>{document.documentElement.lang=language;dispatchEvent(new CustomEvent('cw-language-change',{detail:{language}}));},language);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await results.locator('[role=status]').textContent(),'Foreign result <b>{literal}</b>');assert(await page.evaluate(()=>qaEmptyClone.textContent===qaEmptyCloneText));emptySearchChecks+=2;}
      await page.evaluate(()=>{document.documentElement.lang='pt';dispatchEvent(new CustomEvent('cw-language-change',{detail:{language:'pt'}}));});
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
    console.log('PASS shared header and search: '+JSON.stringify({headerChecks,headerOwnershipChecks,emptySearchChecks,languages:5,widths:[320,390,1024,1440],ownedLeavesAndAttributes:true,focusSelectionValueNodesAndWorkRetained:true,componentOnly:true}));
    console.log('PASS shared sidebar and multilingual search: '+JSON.stringify({sidebarChecks,sidebarOwnershipChecks,multilingualSearchChecks,languages:5,widths:[320,390,1024,1440],groupsRoleModulesAndAria:true,privateAliasCopies:true,existingResultFocusAndDestinationsRetained:true,componentOnly:true}));
    console.log('Navigation visual evidence: ' + visual);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
