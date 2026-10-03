'use strict';
// Real authenticated page and real SQL/API data. Only GET failure/latency responses
// are injected for recovery checks; no script, auth or success payload is mocked.
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const languages = ['pt','en','fr','es','de'];
const expected = {
  title: ['Centro de comando','Command centre','Centre de commande','Centro de mando','Leitzentrale'],
  documentTitle: ['Cristal Water · Centro de Operações V2','Cristal Water · Operations Centre V2','Cristal Water · Centre des opérations V2','Cristal Water · Centro de operaciones V2','Cristal Water · Betriebszentrale V2'],
  refresh: ['Atualizar','Refresh','Actualiser','Actualizar','Aktualisieren'],
  groups: [
    ['Operação diária','Clientes e equipas','Intervenções e campo','Ativos e armazém','Financeiro e relatórios','Sistema'],
    ['Daily operations','Clients and teams','Interventions and field work','Assets and warehouse','Finance and reports','System'],
    ['Opérations quotidiennes','Clients et équipes','Interventions et terrain','Actifs et entrepôt','Finances et rapports','Système'],
    ['Operación diaria','Clientes y equipos','Intervenciones y campo','Activos y almacén','Finanzas e informes','Sistema'],
    ['Tagesbetrieb','Kunden und Teams','Einsätze und Außendienst','Anlagen und Lager','Finanzen und Berichte','System'],
  ],
  headings: [
    ['Centro de alertas','Aprovações pendentes','Financeiro rápido','Resumo executivo','Prioridades','Operação do dia','Histórico operacional recente','Mapa de operações','Editar visita'],
    ['Alert centre','Pending approvals','Finance at a glance','Executive summary','Priorities','Today’s operations','Recent operational history','Operations map','Edit visit'],
    ['Centre d’alertes','Approbations en attente','Finances en bref','Résumé exécutif','Priorités','Opérations du jour','Historique opérationnel récent','Carte des opérations','Modifier la visite'],
    ['Centro de alertas','Aprobaciones pendientes','Finanzas rápidas','Resumen ejecutivo','Prioridades','Operación del día','Historial operativo reciente','Mapa de operaciones','Editar visita'],
    ['Alarmzentrale','Ausstehende Freigaben','Finanzübersicht','Managementübersicht','Prioritäten','Tagesbetrieb','Aktueller Betriebsverlauf','Betriebskarte','Besuch bearbeiten'],
  ],
  mobile: [['Centro','Hoje','Visitas','Alertas','Menu'],['Centre','Today','Visits','Alerts','Menu'],['Centre','Ce jour','Visites','Alertes','Menu'],['Centro','Hoy','Visitas','Alertas','Menú'],['Start','Heute','Besuche','Alarme','Menü']],
  metrics: [['Críticos','Visitas hoje','Técnicos ativos','Pendências'],['Critical','Today’s visits','Active technicians','Outstanding items'],['Critiques','Visites du jour','Techniciens actifs','Éléments en attente'],['Críticos','Visitas de hoy','Técnicos activos','Pendientes'],['Kritisch','Heutige Besuche','Aktive Techniker','Offene Punkte']],
  metricHint: [['ações imediatas','planeadas no dia','em operação no terreno','financeiro por fechar'],['immediate actions','planned for today','working in the field','finance awaiting completion'],['actions immédiates','prévues aujourd’hui','en activité sur le terrain','finances à clôturer'],['acciones inmediatas','planificadas para hoy','trabajando en campo','finanzas por cerrar'],['sofortiger Handlungsbedarf','heute geplant','im Außendienst tätig','offene Finanzvorgänge']],
  digest: [['Visitas em atraso','Em execução','Técnicos disponíveis','Próxima decisão'],['Overdue visits','In progress','Available technicians','Next decision'],['Visites en retard','En cours','Techniciens disponibles','Prochaine décision'],['Visitas atrasadas','En curso','Técnicos disponibles','Próxima decisión'],['Überfällige Besuche','In Bearbeitung','Verfügbare Techniker','Nächste Entscheidung']],
  loading: ['A carregar resumo','Loading summary','Chargement du résumé','Cargando resumen','Übersicht wird geladen'],
  loadingBody: ['Os indicadores principais estão a ser preparados.','The main indicators are being prepared.','Les principaux indicateurs sont en préparation.','Se están preparando los indicadores principales.','Die Hauptkennzahlen werden vorbereitet.'],
  retry: ['Tentar novamente','Try again','Réessayer','Reintentar','Erneut versuchen'],
  continue: ['Continuar sem dados','Continue without data','Continuer sans données','Continuar sin datos','Ohne Daten fortfahren'],
  error: ['Não foi possível carregar os dados','Unable to load data','Impossible de charger les données','No se pudieron cargar los datos','Daten konnten nicht geladen werden'],
  invalid: ['Resposta inválida do servidor.','Invalid server response.','Réponse du serveur invalide.','Respuesta del servidor no válida.','Ungültige Serverantwort.'],
  timeout: ['Não foi possível carregar os dados. O pedido excedeu o tempo limite.','Unable to load data. The request timed out.','Impossible de charger les données. Le délai a été dépassé.','No se pudieron cargar los datos. La solicitud agotó el tiempo.','Daten konnten nicht geladen werden. Zeitüberschreitung der Anfrage.'],
  unavailable: ['Dados indisponíveis','Data unavailable','Données indisponibles','Datos no disponibles','Daten nicht verfügbar'],
  emptyVisits: ['Sem visitas abertas. Quando existirem rondas/visitas, aparecem aqui.','No open visits. Rounds and visits will appear here when available.','Aucune visite ouverte. Les tournées et visites apparaîtront ici.','No hay visitas abiertas. Las rondas y visitas aparecerán aquí.','Keine offenen Besuche. Vorhandene Touren und Besuche erscheinen hier.'],
};
let browser, page, client, pool, technician, visit, history, token, previousLanguage;
let closing = false;
const routeErrors = [];
const redact = message => String(message).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/eyJ[A-Za-z0-9_.-]+/g, '[token]');
let mode = 'normal', held = [], readyCases = 0, stateCases = 0, searchCases = 0, ownershipCases = 0;
const requests = [], writes = [], errors = [], stateProof = [];
const release = () => { const pending = held; held = []; pending.forEach(item => item.resolve()); };
const counts = () => Promise.all(['client','pool','technician','serviceVisit','technicalHistory','invoice','payment','chatMessage','notification','emailLog'].map(key => prisma[key].count()));
const raw = () => Promise.all([prisma.client.findUnique({where:{id:client.id}}),prisma.pool.findUnique({where:{id:pool.id}}),prisma.technician.findUnique({where:{id:technician.id}}),prisma.serviceVisit.findUnique({where:{id:visit.id}}),prisma.technicalHistory.findUnique({where:{id:history.id}})]);
const select = async language => { await page.locator('#cwLanguageSelect').selectOption(language); await page.waitForFunction(language => document.documentElement.lang === language, language); };
const ready = () => page.waitForFunction(() => document.querySelectorAll('#metrics .metric-card').length === 4 && !document.querySelector('[data-cw-state="loading"],[data-cw-state="error"]'));
const errorState = () => page.waitForFunction(() => document.querySelectorAll('[data-cw-state="error"]').length === 6, null, {timeout:16000});
const fingerprint = () => page.evaluate(() => JSON.stringify({
  timeOrigin:performance.timeOrigin,token:localStorage.getItem('token'),jwt:localStorage.getItem('cristalwater_jwt'),admin:localStorage.getItem('adminToken'),
  actor:JSON.parse(localStorage.getItem('user')).id,role:JSON.parse(localStorage.getItem('user')).role,
  outbox:localStorage.getItem('cwFieldOutbox:command-languages'),notes:document.getElementById('visitEditNotes').value,
  reason:document.getElementById('visitEditReason').value,disabled:document.getElementById('visitEditReason').disabled,
  links:[...document.querySelectorAll('a[href]')].map(node=>node.getAttribute('href')),
  numbers:[...document.querySelectorAll('#metrics .metric-value,#operationDigest strong')].map(node=>node.textContent),
}));
async function checkState(kind, messages) {
  await page.evaluate(() => { window.qaStateNodes=[...document.querySelectorAll('#metrics *')].map(node=>({node,text:node.firstChild,children:[...node.childNodes]})); });
  for (let i = 0; i < languages.length; i++) {
    const reads = requests.length; await select(languages[i]);
    assert.equal(requests.length, reads, 'Language must not refetch business sections');
    assert.equal(await page.locator('#metrics b').textContent(), expected[kind][i]);
    if (messages) assert.equal(await page.locator('#metrics .muted').textContent(), messages[i]);
    if (kind !== 'unavailable') {
      assert.equal(await page.locator('#metrics [data-dashboard-retry]').textContent(), expected.retry[i]);
      assert.equal(await page.locator('#metrics [data-dashboard-continue]').textContent(), expected.continue[i]);
    }
    assert.equal(await page.locator('#metrics [data-cw-state]').getAttribute('role'),kind==='error'?'alert':'status');
    assert.equal(await page.locator('#metrics [data-cw-state]').getAttribute('aria-live'),kind==='error'?'assertive':'polite');
    assert(await page.evaluate(()=>qaStateNodes.every(item=>item.node.isConnected&&item.node.firstChild===item.text&&item.node.childNodes.length===item.children.length&&item.children.every((node,i)=>item.node.childNodes[i]===node))));
    stateCases++;
  }
  stateProof.push({kind,mode,languages:languages.slice()});
}
async function inject(route) {
  if (mode === 'normal') return route.continue();
  if (mode === 'server') return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Resposta inválida do servidor.'})});
  if (mode === 'invalid') return route.fulfill({status:200,contentType:'application/json',body:'{ malformed'});
  if (mode === 'http') return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});
  let response;
  try { response = await route.fetch(); } catch (error) {
    if (!closing) routeErrors.push(redact(error.message));
    return route.abort().catch(()=>{});
  }
  await new Promise(resolve => held.push({resolve}));
  await route.fulfill({response}).catch(()=>{});
}
async function checkVisitsDashboard(admin) {
  const fixtureVisits = [], reads = [], businessWrites = [], preferenceWrites = [], pageErrors = [];
  const dashboardCopy = {
    title: ['Painel Admin - Visitas','Admin Dashboard - Visits','Tableau Admin - Visites','Panel Admin - Visitas','Admin-Dashboard - Besuche'],
    intro: ['Monitorizacao operacional de visitas com estado, parametros e evidencias fotograficas.','Visit monitoring with status, readings and photographic evidence.','Suivi des visites avec état, paramètres et preuves photographiques.','Seguimiento de visitas con estado, parámetros y evidencias fotográficas.','Besuchsübersicht mit Status, Messwerten und Fotobelegen.'],
    back: ['Voltar','Back','Retour','Volver','Zurück'],
    logout: ['Sair','Log out','Déconnexion','Salir','Abmelden'],
    filters: ['Filtros de visitas','Visit filters','Filtres de visites','Filtros de visitas','Besuchsfilter'],
    notes: ['Notas:','Notes:','Notes :','Notas:','Notizen:'],
    labels: [['Estado','Técnico','Início','Fim','pH','Cloro','Alcalinidade','Sal'],['Status','Technician','Start','End','pH','Chlorine','Alkalinity','Salt'],['État','Technicien','Début','Fin','pH','Chlore','Alcalinité','Sel'],['Estado','Técnico','Inicio','Fin','pH','Cloro','Alcalinidad','Sal'],['Status','Techniker','Beginn','Ende','pH','Chlor','Alkalinität','Salz']],
    empty: ['Sem visitas','No visits','Aucune visite','Sin visitas','Keine Besuche'],
    emptyBody: ['Não existem visitas para os filtros selecionados.','No visits match the selected filters.','Aucune visite ne correspond aux filtres sélectionnés.','No hay visitas para los filtros seleccionados.','Keine Besuche für die ausgewählten Filter.'],
    loading: ['A carregar visitas...','Loading visits...','Chargement des visites...','Cargando visitas...','Besuche werden geladen...'],
    error: ['Erro ao carregar visitas','Unable to load visits','Impossible de charger les visites','No se pudieron cargar las visitas','Besuche konnten nicht geladen werden'],
    errorBody: ['Confirma login e ligação ao servidor.','Check your login and server connection.','Vérifiez votre connexion et la liaison au serveur.','Comprueba el acceso y la conexión al servidor.','Anmeldung und Serververbindung prüfen.'],
    photo: ['Foto da visita','Visit photo','Photo de la visite','Foto de la visita','Besuchsfoto'],
    filter: ['Filtrar por estado','Filter by status','Filtrer par état','Filtrar por estado','Nach Status filtern'],
    placeholder: ['Pesquisar cliente, piscina, tecnico ou nota','Search client, pool, technician or note','Rechercher client, piscine, technicien ou note','Buscar cliente, piscina, técnico o nota','Kunde, Pool, Techniker oder Notiz suchen'],
    options: [['Todos os estados','Concluída','Em curso'],['All statuses','Completed','In progress'],['Tous les états','Terminée','En cours'],['Todos los estados','Completada','En curso'],['Alle Status','Abgeschlossen','In Bearbeitung']],
  };
  const nativeCounts = async () => [...await counts(),await prisma.fieldWriteRequest.count(),await prisma.stockMovement.count(),await prisma.visitPhoto.count()];
  let dashboardContext, dashboardPage, heldReply, visitMode = 'normal';
  try {
    for (const status of ['PLANNED','IN_PROGRESS','DONE']) fixtureVisits.push(await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:technician.id,plannedDate:new Date(),startAt:new Date(),...(status==='DONE'?{endAt:new Date()}:{}),status,notes:'Atualizar <img src=x onerror=alert(1)>',ph:7.2,chlorine:1.4,alkalinity:80,salt:4000,photos:{create:{url:'/icon-192.png'}}}}));
    const records = await prisma.serviceVisit.findMany({where:{id:{in:fixtureVisits.map(v=>v.id)}},include:{photos:true},orderBy:{id:'asc'}}), before = await nativeCounts();
    const native = await fetch(base+'/api/visits/today',{headers:{Authorization:'Bearer '+token}});assert.equal(native.status,200);assert.match(native.headers.get('cache-control'),/private.*no-store/);
    const nativeData = await native.json(), nativeRows = Array.isArray(nativeData)?nativeData:nativeData.visits;assert(Array.isArray(nativeRows));for(const v of fixtureVisits)assert(nativeRows.some(row=>row.id===v.id),'Own fixture appears in native daily GET');
    dashboardContext = await browser.newContext({viewport:{width:320,height:1000},serviceWorkers:'block'});
    await dashboardContext.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    await dashboardContext.addInitScript(({token,id})=>{
      for(const key of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(key,token);
      for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id,role:'ADMIN'}));
      localStorage.setItem('cwFieldOutbox:dashboard-languages','pending original work <img src=x>');
    },{token,id:admin.id});
    await dashboardContext.route('**/api/visits/today',async route=>{
      if(visitMode==='http')return route.fulfill({status:503,json:{error:'Atualizar'}});
      if(visitMode!=='hold')return route.continue();
      const response=await route.fetch();assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/private.*no-store/);
      await new Promise(resolve=>{heldReply=resolve;});await route.fulfill({response}).catch(()=>{});
    });
    dashboardPage = await dashboardContext.newPage();dashboardPage.setDefaultTimeout(7000);dashboardPage.on('pageerror',error=>pageErrors.push(error.message));
    dashboardPage.on('request',request=>{const url=new URL(request.url());if(url.origin!==base||!url.pathname.startsWith('/api/'))return;if(request.method()==='GET'&&url.pathname==='/api/visits/today')reads.push(url.pathname);if(request.method()==='PUT'&&url.pathname==='/api/settings/language/me')preferenceWrites.push(request.postDataJSON());else if(!['GET','HEAD'].includes(request.method()))businessWrites.push({method:request.method(),path:url.pathname});});
    const choose = async language => {await dashboardPage.locator('#cwLanguageSelect').selectOption(language);await dashboardPage.waitForFunction(language=>document.documentElement.lang===language,language);};
    const snapshot = () => dashboardPage.evaluate(()=>JSON.stringify({data:[...document.querySelectorAll('#visits article h3,#visits .value,#visits article p')].map(node=>node.matches('p')?node.lastChild.nodeValue:node.textContent),photos:[...document.querySelectorAll('#visits img')].map(node=>node.getAttribute('src')),query:document.getElementById('searchInput').value,status:document.getElementById('statusFilter').value,controls:[...document.querySelectorAll('main button,main input,main select')].map(node=>({id:node.id,disabled:node.disabled,busy:node.getAttribute('aria-busy')})),token:localStorage.getItem('token'),outbox:localStorage.getItem('cwFieldOutbox:dashboard-languages')}));
    await dashboardPage.goto(base+'/admin-visits-dashboard?lang=de',{waitUntil:'networkidle'});await dashboardPage.locator('#visits article').first().waitFor();
    const colors = await dashboardPage.locator('.page-head p,.page .cw-btn,.toolbar input,.toolbar select,#visits article:first-child .label,#visits article:first-child .value').evaluateAll(nodes=>nodes.map(node=>{const style=getComputedStyle(node);let parent=node,bg='';while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')break;parent=parent.parentElement;}return {text:node.textContent,color:style.color,background:bg};}));
    const channel = n => {n/=255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;};
    const luminance = color => color.match(/[\d.]+/g).slice(0,3).reduce((sum,n,i)=>sum+channel(Number(n))*[0.2126,0.7152,0.0722][i],0);
    const contrasts = colors.map(item=>{const a=luminance(item.color),b=luminance(item.background);return {...item,ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)};});
    console.log('PRECONDITION visits dashboard computed contrast '+JSON.stringify(contrasts));
    assert.equal(await dashboardPage.locator('main h1').textContent(),dashboardCopy.title[4],'Own dashboard title must follow actual DE language selection');
    assert(contrasts.every(item=>item.ratio>=4.5),'Dashboard copy and controls need readable contrast: '+JSON.stringify(contrasts.filter(item=>item.ratio<4.5)));
    await dashboardPage.locator('#searchInput').fill('Atualizar');
    assert.equal(await dashboardPage.locator('#visits article').count(),3);
    const expectedDates = await dashboardPage.evaluate(rows=>rows.flatMap(row=>[row.startAt?new Date(row.startAt).toLocaleString('pt-PT'):'-',row.endAt?new Date(row.endAt).toLocaleString('pt-PT'):'-']),nativeRows.filter(row=>fixtureVisits.some(v=>v.id===row.id)));
    assert.deepEqual(await dashboardPage.locator('#visits article').evaluateAll(nodes=>nodes.flatMap(node=>[node.querySelectorAll('.value')[2].textContent,node.querySelectorAll('.value')[3].textContent])),expectedDates);
    await dashboardPage.waitForFunction(()=>[...document.querySelectorAll('#visits img')].every(img=>img.complete&&img.naturalWidth>0));
    await dashboardPage.evaluate(()=>{window.qaVisitNodes=[...document.querySelectorAll('main h1,.page-head p,.page-actions button,.toolbar input,.toolbar select,.toolbar option,#visits article,#visits .label,#visits .value,#visits img,#visits p b')].map(node=>({node,first:node.firstChild,children:[...node.childNodes]}));});
    const original = await snapshot();
    for(let i=0;i<languages.length;i++) {
      const count=reads.length;await choose(languages[i]);
      assert.equal(await dashboardPage.title(),dashboardCopy.title[i]);assert.equal(await dashboardPage.locator('main h1').textContent(),dashboardCopy.title[i]);assert.equal(await dashboardPage.locator('#refreshBtn').textContent(),expected.refresh[i]);
      assert.equal(await dashboardPage.locator('.page-head p').textContent(),dashboardCopy.intro[i]);assert.equal(await dashboardPage.locator('[data-cw-back]').textContent(),dashboardCopy.back[i]);assert.equal(await dashboardPage.locator('#logoutBtn').textContent(),dashboardCopy.logout[i]);assert.equal(await dashboardPage.locator('.toolbar').getAttribute('aria-label'),dashboardCopy.filters[i]);assert.equal(await dashboardPage.locator('#visits p b').first().textContent(),dashboardCopy.notes[i]);
      assert.deepEqual(await dashboardPage.locator('#visits article').first().locator('.label').allTextContents(),dashboardCopy.labels[i]);
      assert.deepEqual(await dashboardPage.locator('#statusFilter option').allTextContents(),dashboardCopy.options[i]);assert.deepEqual(await dashboardPage.locator('#statusFilter option').evaluateAll(nodes=>nodes.map(node=>node.value)),['','DONE','IN_PROGRESS']);
      assert.equal(await dashboardPage.locator('#statusFilter').getAttribute('aria-label'),dashboardCopy.filter[i]);assert.equal(await dashboardPage.locator('#searchInput').getAttribute('placeholder'),dashboardCopy.placeholder[i]);assert.equal(await dashboardPage.locator('#visits img').first().getAttribute('alt'),dashboardCopy.photo[i]);
      assert.equal(await dashboardPage.locator('#searchInput').getAttribute('aria-label'),dashboardCopy.placeholder[i]);
      assert.equal(await snapshot(),original);assert.equal(reads.length,count);
      assert(await dashboardPage.evaluate(()=>qaVisitNodes.every(({node,first,children})=>node.isConnected&&node.firstChild===first&&node.childNodes.length===children.length&&children.every((child,index)=>node.childNodes[index]===child))));
      for(const width of [320,390,1440]) {
        await dashboardPage.setViewportSize({width,height:1000});await dashboardPage.locator('main h1').scrollIntoViewIfNeeded();
        assert(await dashboardPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        assert(await dashboardPage.locator('main h1,.page-actions button,.toolbar input,.toolbar select,#visits .box').evaluateAll(nodes=>nodes.every(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&node.scrollWidth<=node.clientWidth+1;})),'Dashboard controls fit '+languages[i]+'/'+width);
        await dashboardPage.screenshot({path:path.join(__dirname,'../reports/field-visual/admin-master-languages','visits-'+languages[i]+'-'+width+'.png')});
      }
    }
    await dashboardPage.evaluate(()=>{const field=document.getElementById('searchInput');field.focus();field.setSelectionRange(2,6);CristalI18n.applyLanguage('fr');});
    assert.deepEqual(await dashboardPage.locator('#searchInput').evaluate(node=>({focus:document.activeElement===node,value:node.value,start:node.selectionStart,end:node.selectionEnd})),{focus:true,value:'Atualizar',start:2,end:6});
    for(const status of ['DONE','IN_PROGRESS']) {await dashboardPage.locator('#statusFilter').selectOption(status);assert.equal(await dashboardPage.locator('#visits article').count(),1);const filtered=await snapshot();for(const language of languages){await choose(language);assert.equal(await snapshot(),filtered);}}
    await dashboardPage.locator('#searchInput').fill('no-native-visit-'+randomUUID());
    const captureFeedback = () => dashboardPage.evaluate(()=>{window.qaVisitFeedback=[...document.querySelectorAll('#visits .card,#visits h3,#visits p')].map(node=>({node,first:node.firstChild,children:[...node.childNodes]}));});
    const sameFeedback = () => dashboardPage.evaluate(()=>qaVisitFeedback.every(({node,first,children})=>node.isConnected&&node.firstChild===first&&node.childNodes.length===children.length&&children.every((child,index)=>node.childNodes[index]===child)));
    await captureFeedback();
    for(let i=0;i<languages.length;i++){const count=reads.length;await choose(languages[i]);assert.equal(await dashboardPage.locator('#visits h3').textContent(),dashboardCopy.empty[i]);assert.equal(await dashboardPage.locator('#visits p').textContent(),dashboardCopy.emptyBody[i]);assert.equal(reads.length,count);assert(await sameFeedback());}
    await dashboardPage.locator('#statusFilter').selectOption('');await dashboardPage.locator('#searchInput').fill('Atualizar');
    visitMode='hold';await dashboardPage.locator('#refreshBtn').click();await dashboardPage.locator('#visits .card:not(article)').waitFor();
    await captureFeedback();
    for(let i=0;i<languages.length;i++){const count=reads.length;await choose(languages[i]);assert.equal(await dashboardPage.locator('#visits h3').textContent(),dashboardCopy.loading[i]);assert.equal(reads.length,count);assert(await sameFeedback());}
    const deadline=Date.now()+7000;while(!heldReply&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(heldReply);heldReply();heldReply=null;visitMode='normal';await dashboardPage.locator('#visits article').first().waitFor();
    visitMode='http';await dashboardPage.locator('#refreshBtn').click();await dashboardPage.waitForFunction(()=>!document.querySelector('#visits article')&&document.querySelector('#visits p'));
    await captureFeedback();
    for(let i=0;i<languages.length;i++){const count=reads.length;await choose(languages[i]);assert.equal(await dashboardPage.locator('#visits h3').textContent(),dashboardCopy.error[i]);assert.equal(await dashboardPage.locator('#visits p').textContent(),dashboardCopy.errorBody[i]);assert(!await dashboardPage.locator('#visits').textContent().then(text=>text.includes('Atualizar')));assert.equal(reads.length,count);assert(await sameFeedback());}
    visitMode='normal';await dashboardPage.locator('#refreshBtn').click();await dashboardPage.locator('#visits article').first().waitFor();
    await dashboardPage.evaluate(()=>{const node=document.querySelector('#visits .label'),clone=node.cloneNode(true);clone.id='qaForeignVisitLabel';node.parentNode.appendChild(clone);node.firstChild.nodeValue='Estado';const photo=document.querySelector('#visits img');photo.alt='Foto da visita';const input=document.getElementById('searchInput');input.placeholder='Pesquisar cliente, piscina, tecnico ou nota';window.qaVisitForeign=[{node,value:node.outerHTML},{node:clone,value:clone.outerHTML},{node:photo,attribute:'alt',value:photo.alt},{node:input,attribute:'placeholder',value:input.placeholder}];});
    for(const language of languages){await choose(language);assert(await dashboardPage.evaluate(()=>qaVisitForeign.every(({node,attribute,value})=>(attribute?node.getAttribute(attribute):node.outerHTML)===value)));}
    assert.deepEqual(pageErrors,[]);assert.deepEqual(businessWrites,[]);assert(preferenceWrites.every(body=>Object.keys(body).length===1&&languages.includes(body.language)));
    assert.deepEqual(await nativeCounts(),before);assert.deepEqual(await prisma.serviceVisit.findMany({where:{id:{in:fixtureVisits.map(v=>v.id)}},include:{photos:true},orderBy:{id:'asc'}}),records);
    const proof={languages,widths:[320,390,1440],literalData:true,nodeIdentity:true,focusCaret:true,states:['ready','filtered','empty','loading native GET','503','recovered'],privateNoStore:true,zeroBusinessWrites:true,sqlUnchanged:true,minContrast:Math.min(...contrasts.map(item=>item.ratio))};
    console.log('PASS visits dashboard native languages '+JSON.stringify(proof));return proof;
  } finally {
    heldReply?.();await dashboardContext?.close();
    if(fixtureVisits.length)await prisma.serviceVisit.deleteMany({where:{id:{in:fixtureVisits.map(v=>v.id)}}});
  }
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({where:{email:process.env.ADMIN_EMAIL}});
  token = jwt.sign({id:admin.id,role:'ADMIN',principalType:'USER'},getJwtSecret(),{expiresIn:'1h'});
  const preference = await fetch(base+'/api/settings/language/me',{headers:{Authorization:'Bearer '+token}});assert.equal(preference.status,200);previousLanguage=(await preference.json()).language;
  const prefix = randomUUID();
  client = await prisma.client.create({data:{name:'Atualizar',email:prefix+'@qa.test',notes:'Literal <img src=x onerror=alert(1)> Prioridades'}});
  pool = await prisma.pool.create({data:{name:'Críticos',clientId:client.id,active:true,zone:'Centro de comando',notes:'Literal dados <b>Idioma</b>'}});
  technician = await prisma.technician.create({data:{name:'Prioridades',active:true,notes:'PRIVATE_TECH_WORK'}});
  // The real dashboard returns the first20 open visits by plannedDate.
  // Place only our fixture before existing dates; never assume an empty suite DB.
  const earliest = (await prisma.serviceVisit.aggregate({_min:{plannedDate:true}}))._min.plannedDate;
  const fixtureDate = new Date(Math.min(Date.now(),earliest?.getTime() ?? Date.now()) - 1);
  visit = await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:technician.id,date:new Date(),plannedDate:fixtureDate,status:'PLANNED',notes:'Guardar <img src=x onerror=alert(1)>',reason:'Atualizar',internalNotes:'PRIVATE_INTERNAL_WORK'}});
  const fixtureResponse = await fetch(base+'/api/core/dashboard',{headers:{Authorization:'Bearer '+token}});assert.equal(fixtureResponse.status,200);
  const fixtureDashboard = await fixtureResponse.json();assert.equal(fixtureDashboard.nextVisits[0].id,visit.id,'Own literal-data fixture must be present in the real bounded dashboard');
  console.log('PRECONDITION command fixture '+JSON.stringify({nativeFirstVisitId:fixtureDashboard.nextVisits[0].id,fixtureVisitId:visit.id,nativeReturnedVisits:fixtureDashboard.nextVisits.length,beforeExistingDate:earliest?fixtureDate.getTime()<earliest.getTime():true}));
  history = await prisma.technicalHistory.create({data:{poolId:pool.id,type:'TECHNICAL_SHEET_CHANGE',message:'Não foi possível carregar os dados.',component:'Centro de comando',performedAt:new Date()}});
  const before = await counts(), records = await raw();
  const output = path.join(__dirname,'../reports/field-visual/admin-master-languages');await fs.mkdir(output,{recursive:true});
  browser = await chromium.launch({headless:true,...(process.env.CW_CHROMIUM_PATH?{executablePath:process.env.CW_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
  const context = await browser.newContext({viewport:{width:320,height:1000},serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await context.route('**/api/operational-flow/summary',inject);await context.route('**/api/core/dashboard',inject);
  await context.addInitScript(({token,id})=>{
    for(const key of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(key,token);
    for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id,role:'ADMIN'}));
    localStorage.setItem('cwFieldOutbox:command-languages','pending original work <img src=x>');
  },{token,id:admin.id});
  page = await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{const url=new URL(request.url());if(url.origin===base&&url.pathname.startsWith('/api/')){if(request.method()==='GET'&&['/api/operational-flow/summary','/api/core/dashboard','/api/technicians'].includes(url.pathname))requests.push(url.pathname);if(!['GET','HEAD'].includes(request.method())&&!(request.method()==='PUT'&&url.pathname==='/api/settings/language/me'))writes.push({method:request.method(),path:url.pathname});}});
  await page.goto(base+'/admin-master-control?lang=de',{waitUntil:'networkidle'});await ready();
  assert.equal(await page.locator('h1').textContent(),expected.title[4]);assert.equal(await page.locator('#cwLanguageSelect').count(),1);
  assert(await page.locator('#todayList').textContent().then(text=>text.includes('Críticos')&&text.includes('Atualizar')&&text.includes('Prioridades')));
  assert(await page.locator('#technicalPropagationList').textContent().then(text=>text.includes('Não foi possível carregar os dados.')));
  await page.evaluate(()=>{
    document.getElementById('visitEditNotes').value='pending original notes <img src=x>';
    document.getElementById('visitEditReason').value='Atualizar';document.getElementById('visitEditReason').disabled=true;
    const selectors=['h1','#refreshBtn','#metrics .pill','#metrics .metric-label','#prioritySummary b','#prioritySummary .muted','#operationDigest span','.cw-v2-sidebar summary','.cw-v2-sidebar a'];
    window.qaCommandNodes=selectors.flatMap(selector=>[...document.querySelectorAll(selector)]).map(node=>({node,text:node.firstChild,children:[...node.childNodes]}));
  });
  const originalFingerprint = await fingerprint();
  for(let i=0;i<languages.length;i++) {
    const reads=requests.length;await select(languages[i]);
    assert.equal(await page.title(),expected.documentTitle[i]);assert.equal(await page.locator('h1').textContent(),expected.title[i]);assert.equal(await page.locator('#refreshBtn').textContent(),expected.refresh[i]);
    assert.deepEqual(await page.locator('h2').allTextContents(),expected.headings[i]);
    assert.deepEqual(await page.locator('.cw-v2-sidebar summary').allTextContents(),expected.groups[i]);assert.deepEqual(await page.locator('.cw-v2-drawer summary').allTextContents(),expected.groups[i]);
    assert.deepEqual(await page.locator('#metrics .pill').allTextContents(),expected.metrics[i]);assert.deepEqual(await page.locator('#metrics .metric-label').allTextContents(),expected.metricHint[i]);
    assert.deepEqual(await page.locator('#operationDigest .item span').allTextContents(),expected.digest[i]);
    const missingAliases = await page.locator('.cw-v2-sidebar [data-shell-search]').evaluateAll(nodes=>nodes.filter(node=>CWCommandSearch.labels(node).length<5).map(node=>({text:node.textContent,meta:node.getAttribute('data-shell-search'),href:node.getAttribute('href')})));
    assert.deepEqual(missingAliases, []);
    assert(await page.evaluate(()=>qaCommandNodes.every(item=>item.node.isConnected&&item.node.firstChild===item.text&&item.node.childNodes.length===item.children.length&&item.children.every((node,i)=>item.node.childNodes[i]===node))));
    assert.equal(await fingerprint(),originalFingerprint);assert.equal(requests.length,reads);
    assert.equal(await page.locator('#todayList b').filter({hasText:'Críticos'}).count(),1);assert.equal(await page.locator('#technicalPropagationList b').filter({hasText:'Não foi possível carregar os dados.'}).count(),1);
    for(const width of [320,390,1440]) {
      await page.setViewportSize({width,height:1000});await page.locator('h1').scrollIntoViewIfNeeded();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page fits '+languages[i]+'/'+width);
      assert(await page.locator('#cwLanguageSelect').evaluate(node=>{const r=node.getBoundingClientRect();return r.height>=44&&r.left>=0&&r.right<=innerWidth;}));
      if(width<900){assert.deepEqual(await page.locator('.cw-v2-mobile-nav a,.cw-v2-mobile-nav button').allTextContents(),expected.mobile[i]);const geometry=await page.locator('.cw-v2-mobile-nav a,.cw-v2-mobile-nav button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);return {label:node.textContent,font:getComputedStyle(node).font,spacing:getComputedStyle(node).letterSpacing,left:r.left,right:r.right,width:r.width,height:r.height,viewport:innerWidth,lines:[...range.getClientRects()].map(line=>({left:line.left,right:line.right}))};}));for(const item of geometry)assert(item.width>=44&&item.height>=44&&item.left>=0&&item.right<=item.viewport&&item.lines.length===1&&item.lines.every(line=>line.left>=item.left&&line.right<=item.right),languages[i]+'/'+width+' '+JSON.stringify(item));}
      await page.screenshot({path:path.join(output,languages[i]+'-'+width+'.png')});readyCases++;
    }
  }
  // Search each original and translated route label without losing the existing query,
  // result nodes, focus, safe hrefs, selection or keyboard behaviour during repaint.
  await page.setViewportSize({width:1440,height:1000});
  for(const query of ['rotas','routes','itinéraires','rutas','routen','Técnicos','technicians','techniciens','técnicos','Techniker','stock inventario','inventory','inventaire','inventario','Inventar']){
    const target=/rotas|routes|itinéraires|rutas|routen/i.test(query)?'/admin-rounds':/técnicos|technicians|techniciens|techniker/i.test(query)?'/admin-technicians':'/admin-inventory';
    await page.locator('[data-cw-search-input]').fill(query);assert.equal(await page.locator('[data-cw-search-results] a[href="'+target+'"]').count(),1,query);assert(await page.locator('[data-cw-search-results] a').count()<=8);searchCases++;
  }
  await page.locator('[data-cw-search-input]').fill('rotas');await page.locator('[data-cw-search-input]').press('ArrowDown');
  await page.evaluate(()=>{window.qaResultNodes=[...document.querySelectorAll('[data-cw-search-results] a')];window.qaSearchFocused=document.activeElement;});
  await select('en');assert(await page.evaluate(()=>qaResultNodes.every((node,i)=>document.querySelectorAll('[data-cw-search-results] a')[i]===node)));assert.equal(await page.locator('[data-cw-search-input]').inputValue(),'rotas');
  // Selecting a native language control naturally focuses it; applying the same
  // engine with keyboard focus elsewhere must retain that other focused control.
  await page.evaluate(()=>{qaSearchFocused.focus();CristalI18n.applyLanguage('fr');});assert(await page.evaluate(()=>document.activeElement===qaSearchFocused));await page.keyboard.press('Escape');assert(await page.locator('[data-cw-search-input]').evaluate(node=>document.activeElement===node));
  await page.locator('[data-cw-search-input]').fill('original query');await page.locator('[data-cw-search-input]').evaluate(node=>{node.focus();});
  // Search inputs do not expose selection ranges in Chromium. A genuine text
  // field does; language changes must retain its value, focus and caret.
  await page.evaluate(()=>{const field=document.createElement('input');field.id='qaCaret';field.value='pending original query';document.body.appendChild(field);field.focus();field.setSelectionRange(3,8);CristalI18n.applyLanguage('de');});
  assert.deepEqual(await page.locator('#qaCaret').evaluate(node=>({focus:document.activeElement===node,value:node.value,start:node.selectionStart,end:node.selectionEnd})),{focus:true,value:'pending original query',start:3,end:8});await page.locator('#qaCaret').evaluate(node=>node.remove());
  // Foreign nodes and metadata never obtain ownership, even with exact copy text.
  await page.evaluate(()=>{
    const link=document.querySelector('.cw-v2-sidebar a[href="/admin-master-control"]');
    const clone=link.cloneNode(true);clone.id='qaClone';link.parentNode.appendChild(clone);
    link.firstChild.nodeValue='Centro de comando';
    const group=document.querySelector('.cw-v2-sidebar summary');group.replaceChildren(document.createTextNode('Operação diária'));
    const changed=document.querySelector('.cw-v2-sidebar a[href="/admin-rounds"]');changed.setAttribute('data-shell-search','foreign metadata');
    const href=document.querySelector('.cw-v2-sidebar a[href="/admin-clients"]');href.href='/help-center';
    const added=document.querySelector('.cw-v2-sidebar a[href="/admin-pools"]');const badge=document.createElement('span');badge.id='qaBadge';badge.textContent='Piscinas';added.appendChild(badge);
    const aria=document.querySelector('#metrics .metric-card');aria.setAttribute('aria-label','Abrir Críticos');
    const literal=document.createElement('b');literal.id='qaLiteral';literal.textContent='Atualizar';document.body.appendChild(literal);
    window.qaForeign=[clone,link,group,changed,href,added,aria,literal].map(node=>({node,markup:node.outerHTML}));
    window.qaForeignAliases=[clone,link,changed,href,added].map(node=>CWCommandSearch.labels(node));
  });
  assert(await page.evaluate(()=>qaForeignAliases.every(values=>values.length===0)));
  for(const lang of languages){await select(lang);assert(await page.evaluate(()=>qaForeign.filter(({node})=>!node.matches('.metric-card')).every(({node,markup})=>node.outerHTML===markup)));assert.equal(await page.locator('#metrics .metric-card').first().getAttribute('aria-label'),'Abrir Críticos');ownershipCases+=8;}
  await page.evaluate(()=>{const values=CWCommandSearch.labels(document.querySelector('.cw-v2-drawer a[href="/admin-visits"]'));values.fill('poisoned');});await page.locator('[data-cw-search-input]').fill('besuche');assert.equal(await page.locator('[data-cw-search-results] a[href="/admin-visits"]').count(),1);searchCases++;
  // Loading labels translate in place while genuine GET responses remain pending.
  mode='hold';await page.locator('#refreshBtn').click();await page.waitForFunction(()=>document.querySelectorAll('[data-cw-state="loading"]').length===6);await checkState('loading',expected.loadingBody);const heldDeadline=Date.now()+10000;while(held.length<2&&Date.now()<heldDeadline)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(held.length,2,'Both real GET replies reached the latency fixture');release();mode='normal';await ready();
  // A backend message identical to an owned fallback must remain literal.
  mode='server';await page.locator('#refreshBtn').click();await errorState();await checkState('error',languages.map(()=>'Resposta inválida do servidor.'));
  await page.locator('#metrics [data-dashboard-continue]').click();await checkState('unavailable');await page.locator('#operationDigest [data-dashboard-continue]').click();assert.equal(await page.locator('[data-cw-state="error"]').count(),0,JSON.stringify(await page.locator('[data-cw-state="error"]').evaluateAll(nodes=>nodes.map(node=>({root:node.parentNode.id,buttons:[...node.querySelectorAll('button')].map(b=>({group:b.dataset.dashboardContinue,disabled:b.disabled,text:b.textContent}))})))));
  mode='normal';await page.locator('#refreshBtn').click();await ready();
  for(const failureMode of ['invalid','http']){
    mode=failureMode;await page.locator('#refreshBtn').click();await errorState();await checkState('error',failureMode==='invalid'?expected.invalid:['Erro HTTP 503','HTTP error 503','Erreur HTTP 503','Error HTTP 503','HTTP-Fehler 503']);
    mode='normal';await page.locator('#metrics [data-dashboard-retry]').click();await ready();
  }
  mode='hold';await page.locator('#refreshBtn').click();await errorState();await checkState('error',expected.timeout);release();mode='normal';await page.locator('#metrics [data-dashboard-retry]').click();await ready();
  // Reload restores normal owned labels and the latest persisted language preference.
  await select('de');await page.reload({waitUntil:'networkidle'});await ready();assert.equal(await page.locator('h1').textContent(),expected.title[4]);assert.equal(await page.locator('#cwLanguageSelect').inputValue(),'de');
  assert.equal(await page.locator('#todayList img').count(),0);assert.deepEqual(errors,[]);assert.deepEqual(routeErrors,[]);assert.deepEqual(writes,[]);assert.deepEqual(await raw(),records);assert.deepEqual(await counts(),before);
  const visitsDashboard = await checkVisitsDashboard(admin);
  const proof={ok:true,realAuthenticatedPage:true,successPayloadMocks:false,controlledGetFailures:['503 literal server text','malformed JSON','HTTP fallback','12000ms deadline'],languages,widths:[320,390,1440],readyCases,stateCases,searchCases,ownershipCases,nodeIdentityRetained:true,focusAndCaretRetained:true,literalNamesMessagesAndRecordBytes:true,zeroBusinessWrites:true,apiPaths:[...new Set(requests)],states:stateProof,visitsDashboard};
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(proof,null,2)+'\n');console.log('PASS command centre native languages '+JSON.stringify(proof));
})().catch(async error=>{console.error(redact(error.stack || error));if(page)console.error('Command centre state',await page.locator('#metrics').textContent().catch(()=>null));process.exitCode=1;}).finally(async()=>{
  closing=true;release();await page?.unrouteAll({behavior:'ignoreErrors'});await browser?.close();
  if(token&&previousLanguage)await fetch(base+'/api/settings/language/me',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({language:previousLanguage})});
  if(history)await prisma.technicalHistory.delete({where:{id:history.id}});if(visit)await prisma.serviceVisit.delete({where:{id:visit.id}});if(pool)await prisma.pool.delete({where:{id:pool.id}});if(client)await prisma.client.delete({where:{id:client.id}});if(technician)await prisma.technician.delete({where:{id:technician.id}});await prisma.$disconnect();
});
