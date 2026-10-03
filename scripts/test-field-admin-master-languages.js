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
async function checkCoverageStatus(admin) {
  const copy = {
    plannerUnassigned: ['Sem tecnico','Unassigned','Sans technicien','Sin técnico','Nicht zugewiesen'],
    plannerNumber: ['Tecnico #{id}','Technician #{id}','Technicien #{id}','Técnico #{id}','Techniker #{id}'],
    plannerDrop: ['Arraste visitas para aqui','Drag visits here','Glissez les visites ici','Arrastra visitas aquí','Besuche hierher ziehen'],
    warning: ['Aviso: {count} ronda(s) sem tecnico atribuido','Warning: {count} round(s) without an assigned technician','Attention : {count} tournée(s) sans technicien attribué','Aviso: {count} ronda(s) sin técnico asignado','Warnung: {count} Rundgang/Rundgänge ohne zugewiesenen Techniker'],
    warningAction: ['. Associa um tecnico antes de gerar ou executar visitas.','. Assign a technician before generating or carrying out visits.','. Attribuez un technicien avant de générer ou effectuer des visites.','. Asigna un técnico antes de generar o realizar visitas.','. Vor dem Erzeugen oder Ausführen von Besuchen einen Techniker zuweisen.'],
    days: [['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'],['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag']],
    mainLoading: ['A carregar rondas, tecnicos, piscinas, visitas e extras...','Loading rounds, technicians, pools, visits and extras...','Chargement des tournées, techniciens, piscines, visites et suppléments...','Cargando rondas, técnicos, piscinas, visitas y extras...','Rundgänge, Techniker, Pools, Besuche und Zusätze werden geladen...'],
    mainReady: ['Rondas e visitas carregadas com sucesso.','Rounds and visits loaded successfully.','Tournées et visites chargées avec succès.','Rondas y visitas cargadas correctamente.','Rundgänge und Besuche erfolgreich geladen.'],
    mainWarnings: ['Carregado com avisos: {warnings}','Loaded with warnings: {warnings}','Chargé avec avertissements : {warnings}','Cargado con avisos: {warnings}','Mit Warnungen geladen: {warnings}'],
    loading: ['A verificar as visitas…','Checking visits…','Vérification des visites…','Comprobando visitas…','Besuche werden geprüft…'],
    ready: [' piscina(s) a verificar.',' pool(s) to review.',' piscine(s) à vérifier.',' piscina(s) por revisar.',' Pool(s) zu prüfen.'],
    automatic: ['Avisos ao escritório verificados automaticamente de hora a hora.','Office alerts checked automatically once an hour.','Alertes au bureau vérifiées automatiquement toutes les heures.','Avisos a la oficina revisados automáticamente cada hora.','Bürohinweise werden automatisch stündlich geprüft.'],
    manual: ['Avisos automáticos desativados neste ambiente; utilize Verificar agora.','Automatic alerts disabled in this environment; use Check now.','Alertes automatiques désactivées dans cet environnement ; utilisez Vérifier maintenant.','Avisos automáticos desactivados en este entorno; utiliza Comprobar ahora.','Automatische Hinweise sind in dieser Umgebung deaktiviert; Jetzt prüfen verwenden.'],
    error: ['Não foi possível atualizar: ','Could not refresh: ','Impossible d’actualiser : ','No se pudo actualizar: ','Aktualisierung nicht möglich: '],
    stale: ['. A informação anterior pode estar desatualizada.','. Previous information may be out of date.','. Les informations précédentes peuvent être obsolètes.','. La información anterior puede estar desactualizada.','. Die bisherigen Informationen können veraltet sein.'],
    summary: ['{visible} de {total} visita(s) - {alerts} alerta(s) - {late} atrasada(s) - {extras} extra(s) - {billable} cobravel(is)','{visible} of {total} visit(s) - {alerts} alert(s) - {late} overdue - {extras} extra(s) - {billable} chargeable','{visible} sur {total} visite(s) - {alerts} alerte(s) - {late} en retard - {extras} supplémentaire(s) - {billable} facturable(s)','{visible} de {total} visita(s) - {alerts} alerta(s) - {late} atrasada(s) - {extras} extra(s) - {billable} facturable(s)','{visible} von {total} Besuch(en) - {alerts} Alarm(e) - {late} überfällig - {extras} zusätzlich - {billable} kostenpflichtig'],
  };
  const reads=[],businessWrites=[],preferences=[],pageErrors=[],routeFailures=[];
  const detail='A verificar as visitas… <img src=x onerror=alert(1)> $& {count} '+ 'x'.repeat(90);
  const mainDetail=detail+' {warnings}';
  let coverageContext,coveragePage,coverageMode='normal',heldReply,latestCoverage,statusVisit,summaryExtra,states=0,geometry=0,foreign=0,summaryCases=0,summaryGeometry=0,summaryForeign=0;
  let mainMode='normal',mainHeldReply,mainKind='ready',mainCases=0,mainGeometry=0,mainForeign=0,warningRound,latestRounds,warningEntries,warningCases=0,warningGeometry=0,warningForeign=0;
  let emptyTechnician,literalTechnician,latestTechnicians,plannerCases=0,plannerGeometry=0,plannerForeign=0;
  const mainStates={ready:0,loading:0,warnings:0};
  const chipKinds={SERVICE:['Ronda','Round','Tournée','Ronda','Rundgang'],EXTRA:['Extra','Extra','Supplément','Extra','Zusatz']};let chipCases=0,chipGeometry=0,chipForeign=0;
  const chipStates={service:0,extra:0,empty:0};
  const tableHeadings=[['Data','Date','Date','Fecha','Datum'],['Cliente','Client','Client','Cliente','Kunde'],['Piscina','Pool','Piscine','Piscina','Pool'],['Tecnico','Technician','Technicien','Técnico','Techniker'],['Tipo / cobranca','Type / billing','Type / facturation','Tipo / facturación','Typ / Abrechnung'],['Estado','Status','État','Estado','Status'],['Editar','Edit','Modifier','Editar','Bearbeiten']];
  const tableAria=['Lista editavel de visitas da semana','Editable weekly visits list','Liste modifiable des visites de la semaine','Lista editable de visitas de la semana','Bearbeitbare Liste der Wochenbesuche'];let tableCases=0,tableGeometry=0,tableForeign=0;
  const modeFilter='assignment-copy-'+randomUUID(),modeFixtures=[];let latestWeek;
  let initialFilterReady;const initialFilterGate=new Promise(resolve=>{initialFilterReady=resolve;});
  const assignmentCopy={NORMAL:['Normal','Normal','Normal','Normal','Normal'],SUPPORT:['Ajuda / apoio','Help / support','Aide / renfort','Ayuda / apoyo','Hilfe / Unterstützung'],SUBSTITUTION:['Substituicao','Substitution','Remplacement','Sustitución','Vertretung'],OTHER_DAY:['Ronda de outro dia','Round from another day','Tournée d’un autre jour','Ronda de otro día','Rundgang eines anderen Tages'],RESCHEDULE:['Reagendada','Rescheduled','Replanifiée','Reprogramada','Neu geplant'],UNASSIGNED:['Sem tecnico','Unassigned','Sans technicien','Sin técnico','Nicht zugewiesen']};
  const modeSql=async()=>JSON.stringify(await prisma.serviceVisit.findMany({where:{id:{in:modeFixtures.map(row=>row.id)}},orderBy:{id:'asc'}}));let modeCases=0,modeGeometry=0;
  const matrixTimings=[],refreshContrasts=[],tableActionMeasurements=[];let stateCollectionCalls=0;
  const sql=async()=>JSON.stringify({records:await raw(),visit:await prisma.serviceVisit.findUnique({where:{id:statusVisit.id}}),extra:await prisma.extraVisit.findUnique({where:{id:summaryExtra.id}}),round:await prisma.round.findUnique({where:{id:warningRound.id},include:{pools:true,technicians:true,assignments:true}}),plannerTechnicians:await prisma.technician.findMany({where:{id:{in:[emptyTechnician.id,literalTechnician.id]}},orderBy:{id:'asc'}}),roundCount:await prisma.round.count(),extraCount:await prisma.extraVisit.count(),counts:await counts(),writes:await prisma.fieldWriteRequest.count(),stock:await prisma.stockMovement.count(),receipts:await prisma.operationalReminder.count()});
  const output=path.join(__dirname,'../reports/field-visual/round-coverage-status-languages'),filter='coverage-status-'+randomUUID();
  try {
    statusVisit=await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:technician.id,date:new Date(),plannedDate:new Date(),status:'PLANNED',notes:filter+'-regular'}});
    summaryExtra=await prisma.extraVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:technician.id,scheduledAt:new Date(Date.now()+3600000),status:'PLANNED',billingMode:'EXTRA',isBillable:true,price:20,notes:filter+'-extra urgent <img src=x> $& {visible}'}});
    warningRound=await prisma.round.create({data:{name:'Aviso: <img src=x> $& {count} '+filter,dayOfWeek:2,active:true}});
    emptyTechnician=await prisma.technician.create({data:{name:'',active:true,notes:filter+'-planner fallback only'}});
    literalTechnician=await prisma.technician.create({data:{name:'Sem tecnico',active:true,notes:filter+'-planner literal only'}});
    for(const [code,reason]of [['NORMAL','Normal'],['SUPPORT','apoio'],['SUBSTITUTION','substituicao'],['OTHER_DAY','outro dia'],['RESCHEDULE','reagendada'],['UNASSIGNED','sem tecnico']])modeFixtures.push({code,...await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:code==='UNASSIGNED'?null:technician.id,date:new Date(),plannedDate:new Date(),status:'PLANNED',reason,notes:modeFilter+'-'+code+' <img src=x> $&'}})});
    const before=await sql(),modesBefore=await modeSql();await fs.mkdir(output,{recursive:true});
    coverageContext=await browser.newContext({viewport:{width:320,height:1000},serviceWorkers:'block'});
    await coverageContext.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    await coverageContext.addInitScript(({token,id})=>{
      for(const key of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(key,token);
      for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify({id,role:'ADMIN'}));
      localStorage.setItem('cwFieldOutbox:coverage-status','pending original work <img src=x>');
      window.qaPlannerMarkup=()=>{
        const clone=document.getElementById('visitPlanner').cloneNode(true),fallbackIds=new Set(state.technicians.filter(tech=>tech.active!==false&&!tech.name).map(tech=>String(tech.id)));
        for(const column of clone.querySelectorAll('.tech-column'))if(column.dataset.technicianId===''||fallbackIds.has(column.dataset.technicianId))column.querySelector('h4').firstChild.nodeValue='QA_OWN_PLANNER_HEADING';
        for(const hint of clone.querySelectorAll('.tech-drop > .empty'))hint.firstChild.nodeValue='QA_OWN_PLANNER_HINT';
        for(const chip of clone.querySelectorAll('.visit-chip')){
          const parts=qaChipSegments.find(row=>row.kind===chip.dataset.kind&&row.id===chip.dataset.id),leaf=chip.children[2].firstChild;
          leaf.nodeValue=leaf.nodeValue.slice(0,parts.prefix.length+3)+'QA_OWN_PLANNER_KIND - QA_OWN_PLANNER_ASSIGNMENT';
        }
        return clone.innerHTML;
      };
      window.qaWeekMarkup=()=>{const clone=document.getElementById('weekVisits').cloneNode(true);for(const node of clone.querySelectorAll('thead th'))node.firstChild.nodeValue='QA_OWN_TABLE_HEADING';const scroll=clone.querySelector('.table-scroll');if(scroll)scroll.setAttribute('aria-label','QA_OWN_TABLE_ARIA');return clone.innerHTML;};
    },{token,id:admin.id});
    await coverageContext.route('**/api/rounds/coverage',async route=>{
      if(coverageMode==='http')return route.fulfill({status:503,json:{ok:false,message:detail}});
      try {
        const response=await route.fetch();assert.equal(response.status(),200);assert.equal(route.request().headers().authorization,'Bearer '+token);
        latestCoverage=await response.json();assert(latestCoverage.rows.some(row=>row.poolId===pool.id),'Own pool must appear in actual coverage GET');
        if(coverageMode==='hold')await new Promise(resolve=>{heldReply=resolve;});
        await route.fulfill({response}).catch(()=>{});
      } catch(error) {routeFailures.push(redact(error.message));await route.abort().catch(()=>{});}
    });
    await coverageContext.route('**/api/round-planner/week',async route=>{
      if(mainMode==='http')return route.fulfill({status:503,json:{ok:false,message:mainDetail}});
      try {
        const response=await route.fetch();assert.equal(response.status(),200);assert.equal(route.request().headers().authorization,'Bearer '+token);
        latestWeek=await response.json();assert(Array.isArray(latestWeek));assert(modeFixtures.every(fixture=>latestWeek.some(row=>row.id===fixture.id&&row.reason===fixture.reason&&row.notes===fixture.notes&&row.technicianId===fixture.technicianId)),'All own mode fixtures must come from the actual authenticated page GET');
        await initialFilterGate;
        if(mainMode==='hold')await new Promise(resolve=>{mainHeldReply=resolve;});
        await route.fulfill({response});
      } catch(error) {routeFailures.push(redact(error.message));await route.abort().catch(()=>{});}
    });
    await coverageContext.route('**/api/rounds',async route=>{
      try {const response=await route.fetch();assert.equal(response.status(),200);assert.equal(route.request().headers().authorization,'Bearer '+token);const payload=await response.json();assert.equal(payload.ok,true);latestRounds=payload.rounds;assert(Array.isArray(latestRounds));assert(latestRounds.some(round=>round.id===warningRound.id&&round.name===warningRound.name&&!round.technicians.length&&!round.assignments.length));await route.fulfill({response});}
      catch(error){routeFailures.push(redact(error.message));await route.abort().catch(()=>{});}
    });
    await coverageContext.route('**/api/technicians',async route=>{
      try{const response=await route.fetch();assert.equal(response.status(),200);assert.equal(route.request().headers().authorization,'Bearer '+token);latestTechnicians=await response.json();assert(Array.isArray(latestTechnicians));assert(latestTechnicians.some(tech=>tech.id===emptyTechnician.id&&tech.name===''));assert(latestTechnicians.some(tech=>tech.id===literalTechnician.id&&tech.name==='Sem tecnico'));await route.fulfill({response});}
      catch(error){routeFailures.push(redact(error.message));await route.abort().catch(()=>{});}
    });
    coveragePage=await coverageContext.newPage();coveragePage.setDefaultTimeout(7000);coveragePage.on('pageerror',error=>pageErrors.push(error.message));
    coveragePage.on('request',request=>{const url=new URL(request.url());if(url.origin!==base||!url.pathname.startsWith('/api/'))return;const entry={method:request.method(),path:url.pathname};if(entry.method==='GET')reads.push(entry);else if(entry.method==='PUT'&&entry.path==='/api/settings/language/me')preferences.push(request.postDataJSON());else if(entry.method!=='HEAD')businessWrites.push(entry);});
    const choose=async language=>{const saved=coveragePage.waitForResponse(response=>response.url().endsWith('/api/settings/language/me')&&response.request().method()==='PUT'&&response.request().postDataJSON().language===language);await coveragePage.locator('#cwLanguageSelect').selectOption(language);const response=await saved;assert.equal(response.status(),200);assert.deepEqual(await response.json(),{ok:true,language});await coveragePage.waitForFunction(value=>document.documentElement.lang===value,language);};
    const expectedReady=index=>latestCoverage.rows.length+copy.ready[index]+' '+latestCoverage.scope+' '+(latestCoverage.automaticAlertsEnabled?copy.automatic[index]:copy.manual[index]);
    const expectedMain=index=>mainKind==='loading'?copy.mainLoading[index]:mainKind==='warnings'?copy.mainWarnings[index].replace('{warnings}',()=>mainDetail):copy.mainReady[index];
    const expectedWarning=index=>({heading:copy.warning[index].replace('{count}',String(warningEntries.length)),body:warningEntries.map(({day,name})=>`${copy.days[index][day]??String(copy.days[0][day])} - ${name}`).join(', ')+copy.warningAction[index]});
    const expectedPlanner=index=>[{id:'',label:copy.plannerUnassigned[index]+' '},...latestTechnicians.filter(tech=>tech.active!==false).map(tech=>({id:String(tech.id),label:(tech.name||copy.plannerNumber[index].replace('{id}',String(tech.id)))+' '}))];
    // Compare every original byte in the browser; do not transport huge markup.
    const snapshot=save=>coveragePage.evaluate(save=>{const value=JSON.stringify({controls:[...document.querySelectorAll('main input,main textarea,main select,main button')].filter(node=>node.id!=='cwLanguageSelect'&&!node.closest('.cw-lang-switch')).map(node=>({id:node.id,value:node.value,checked:node.checked,disabled:node.disabled,busy:node.getAttribute('aria-busy'),options:node.options?[...node.options].map(option=>({value:option.value,selected:option.selected,disabled:option.disabled})):null})),links:[...document.querySelectorAll('main a[href]')].map(node=>node.getAttribute('href')),pools:[...document.querySelectorAll('#coverageList h3')].map(node=>node.textContent),deferred:[...document.querySelectorAll('#weekVisits,#visitPlanner,#visitReceiptsAdmin')].map(node=>[node.id,node.id==='visitPlanner'?qaPlannerMarkup():node.id==='weekVisits'?qaWeekMarkup():node.innerHTML]),tokens:['token','cristalwater_jwt','adminToken'].map(key=>localStorage.getItem(key)),bytes:Object.keys(localStorage).filter(key=>/^cwField|^cw:tech/.test(key)).sort().map(key=>[key,localStorage.getItem(key)])});if(save){window.qaCoverageSnapshot=value;return value.length;}return value===qaCoverageSnapshot;},save);
    const capture=()=>coveragePage.evaluate(()=>{
      const visits=new Map(allPlannerVisits().map(visit=>[visit.uid,visit]));window.qaChipSegments=[...document.querySelectorAll('#visitPlanner .visit-chip')].map(node=>{const visit=visits.get(node.dataset.kind+'-'+node.dataset.id),date=getVisitDate(visit);return{kind:node.dataset.kind,id:node.dataset.id,prefix:date?date.toLocaleString('pt-PT'):'Sem data',mode:visit.assignmentMode};});
      window.qaCoverageNodes=[...document.querySelectorAll('main,main *')].filter(node=>node.id!=='cwLanguageSelect'&&!node.closest('.cw-lang-switch')).map(node=>({node,children:[...node.childNodes]}));
    });
    async function checkRefreshContrast(language,width) {
      const button=coveragePage.locator('#coverageRefresh'),count=reads.length;
      await button.scrollIntoViewIfNeeded();
      await coveragePage.evaluate(()=>{const node=document.activeElement;window.qaRefreshFocus={node,start:node.selectionStart,end:node.selectionEnd};node.blur();});
      await coveragePage.mouse.move(0,0);
      let baseBox;
      for(const state of ['base','hover','focus-visible']) {
        if(state==='hover')await button.hover();
        if(state==='focus-visible'){await coveragePage.mouse.move(0,0);await button.focus();await coveragePage.keyboard.press('Tab');await coveragePage.keyboard.press('Shift+Tab');}
        await button.evaluate(async node=>{await Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
        const measured=await button.evaluate((node,state)=>{
          const rgba=value=>{const parts=value.match(/[\d.]+/g).map(Number);if(parts.length===3)parts.push(1);return parts;};
          const blend=(front,back)=>front.slice(0,3).map((channel,index)=>channel*front[3]+back[index]*(1-front[3]));
          const layers=[];let current=node;
          while(current){const style=getComputedStyle(current);if(style.opacity!=='1'||style.backgroundImage!=='none')throw new Error('Contrast requires opaque controls and solid background layers');const color=rgba(style.backgroundColor);layers.push(color);if(color[3]===1)break;current=current.parentElement;}
          let background=[255,255,255];for(const layer of layers.reverse())background=blend(layer,background);
          const style=getComputedStyle(node),foreground=blend(rgba(style.color),background);
          const luminance=rgb=>rgb.map(value=>{value/=255;return value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0);
          const light=luminance(foreground),dark=luminance(background),box=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);
          return {state,color:style.color,background:style.backgroundColor,effectiveBackground:background,ratio:(Math.max(light,dark)+0.05)/(Math.min(light,dark)+0.05),focusVisible:node.matches(':focus-visible'),hover:node.matches(':hover'),box:{x:box.x,width:box.width,height:box.height},fits:box.left>=0&&box.right<=innerWidth+1&&[...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1),outline:{style:style.outlineStyle,width:style.outlineWidth}};
        },state);
        const proof={language,width,...measured};refreshContrasts.push(proof);console.log('QA coverage refresh contrast '+JSON.stringify(proof));
        assert(measured.fits,'Coverage refresh label must fit '+language+'/'+width);
        if(state==='base'){baseBox=measured.box;assert(!measured.hover&&!measured.focusVisible);}else assert.deepEqual(measured.box,baseBox,'Hover and focus keep the original button dimensions');
        if(state==='hover')assert(measured.hover);
        if(state==='focus-visible'){assert(measured.focusVisible);assert.notEqual(measured.outline.style,'none');assert(parseFloat(measured.outline.width)>0);}
        if(language==='de'&&[320,1440].includes(width))await coveragePage.screenshot({path:path.join(output,'refresh-'+state+'-'+language+'-'+width+'.png'),caret:'initial'});
      }
      await coveragePage.evaluate(()=>{const {node,start,end}=qaRefreshFocus;if(node.isConnected){node.focus({preventScroll:true});if(typeof start==='number'&&typeof end==='number')node.setSelectionRange(start,end);}});
      assert.equal(reads.length,count,'Hover and keyboard focus must not read operations');assert.equal(await snapshot(false),true,'Contrast checks preserve all original control and pending bytes');
    }
    async function matrix(kind,render,widths=[320,390,1440]) {
      await capture();const snapshotChars=await snapshot(true);
      const started=Date.now(),phaseMs={language:0,state:0,snapshot:0,geometry:0,contrast:0};let stamp=started;
      const mark=phase=>{const now=Date.now();phaseMs[phase]+=now-stamp;stamp=now;};
      for(const width of widths) {await coveragePage.setViewportSize({width,height:1000});for(const [index,language]of languages.entries()) {
        const count=reads.length;await choose(language);mark('language');
        // Collect one unchanged DOM state; missing or duplicate original targets still fail.
        const actual=await coveragePage.evaluate(()=>{
          const one=(selector,root=document)=>{const nodes=root.querySelectorAll(selector);if(nodes.length!==1)throw new Error('Expected one native state target: '+selector+', got '+nodes.length);return nodes[0];};
          const node=one('#coverageStatus'),main=one('#status'),warning=one('#roundTechWarning'),planner=one('#visitPlanner'),week=one('#weekVisits');
          return{text:node.textContent,role:node.getAttribute('role'),live:node.getAttribute('aria-live'),images:node.querySelectorAll('img').length,sameNodes:qaCoverageNodes.every(({node,children})=>node.isConnected&&node.childNodes.length===children.length&&children.every((child,i)=>node.childNodes[i]===child)),
            summary:one('#visitFilterSummary').textContent,main:{text:main.textContent,class:main.getAttribute('class'),images:main.querySelectorAll('img').length},
            warning:{heading:one('strong',warning).textContent,body:one('span',warning).textContent},warningCount:one('#kpiUnassignedRounds').textContent,warningImages:warning.querySelectorAll('img').length,
            planner:[...planner.querySelectorAll('.tech-column')].map(node=>({id:node.dataset.technicianId,label:node.querySelector('h4').firstChild.nodeValue,count:Number(node.querySelector('h4 span').textContent),visits:node.querySelectorAll('.visit-chip').length,hint:node.querySelector('.tech-drop>.empty')?.textContent||null})),
            chips:[...planner.querySelectorAll('.visit-chip')].map(node=>({kind:node.dataset.kind,id:node.dataset.id,metadata:node.children[2].textContent})),chipParts:qaChipSegments,table:{headings:[...week.querySelectorAll('thead th')].map(node=>node.textContent),aria:week.querySelector('.table-scroll')?.getAttribute('aria-label')??null}};
        });stateCollectionCalls++;
        assert.equal(actual.text,render(index),kind+'/'+language+' owns only its message prefix');assert.deepEqual({role:actual.role,live:actual.live,images:actual.images,sameNodes:actual.sameNodes},{role:'status',live:'polite',images:0,sameNodes:true});
        assert.equal(actual.summary,expectedSummary(index),kind+'/'+language+' retains the six native totals');summaryCases++;
        assert.equal(actual.main.text,expectedMain(index),mainKind+'/'+language+' owns only read feedback');
        assert.equal(actual.main.class,mainKind==='warnings'?'status error':'status');
        assert.equal(actual.main.images,0);mainCases++;mainStates[mainKind]++;
        assert.deepEqual(actual.warning,expectedWarning(index),language+' owns warning count/weekdays/instruction, never received names');
        assert.equal(actual.warningCount,String(warningEntries.length));assert.equal(actual.warningImages,0);warningCases++;
        assert.deepEqual(actual.table,{headings:summaryCounts.visible?tableHeadings.map(labels=>labels[index]):[],aria:summaryCounts.visible?tableAria[index]:null},language+' owns only table headings/accessibility; zero-result fallback has no header');tableCases++;
        const planner=actual.planner;
        assert.deepEqual(planner.map(({id,label})=>({id,label})),expectedPlanner(index),language+' owns only unassigned/nameless headings, never API names');
        assert(planner.every(column=>column.count===column.visits&&column.hint===(column.visits?null:copy.plannerDrop[index])),language+' retains badge counts and native empty-column instructions');plannerCases++;
        const chipView=actual.chips,chipParts=actual.chipParts;assert.deepEqual(chipView,chipParts.map(({kind,id,prefix,mode})=>({kind,id,metadata:prefix+' - '+chipKinds[kind][index]+' - '+assignmentCopy[mode][index]})),language+' owns chip copy only; date and internal assignment code stay exact');chipCases++;if(chipView.some(chip=>chip.kind==='SERVICE'))chipStates.service++;if(chipView.some(chip=>chip.kind==='EXTRA'))chipStates.extra++;if(!chipView.length)chipStates.empty++;
        mark('state');
        assert.equal(reads.length,count,'Language must not re-read operations');assert.equal(await snapshot(false),true,'All captured form, markup, token and pending bytes must remain equal');
        mark('snapshot');
          await coveragePage.locator('#coverageStatus').scrollIntoViewIfNeeded();
          assert(await coveragePage.locator('#coverageStatus').evaluate(node=>{const box=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);return document.documentElement.scrollWidth<=innerWidth+1&&box.left>=0&&box.right<=innerWidth+1&&[...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1);}),'Coverage message fits '+kind+'/'+language+'/'+width);
          if(['ready','loading','error'].includes(kind)&&language==='de'&&[320,1440].includes(width))await coveragePage.screenshot({path:path.join(output,kind+'-'+language+'-'+width+'.png'),caret:'initial'});geometry++;
        await coveragePage.locator('#visitFilterSummary').scrollIntoViewIfNeeded();
        assert(await coveragePage.locator('#visitFilterSummary').evaluate(node=>{const box=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);return box.left>=0&&box.right<=innerWidth+1&&[...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1);}),'Filter summary fits '+kind+'/'+language+'/'+width);summaryGeometry++;
        if(['ready','loading','error'].includes(kind)&&language==='de'&&[320,1440].includes(width))await coveragePage.screenshot({path:path.join(output,'filter-'+kind+'-'+language+'-'+width+'.png'),caret:'initial'});
        await coveragePage.locator('#status').scrollIntoViewIfNeeded();
        assert(await coveragePage.locator('#status').evaluate(node=>{const box=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);return box.left>=0&&box.right<=innerWidth+1&&[...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1);}),'Main read feedback fits '+mainKind+'/'+language+'/'+width);mainGeometry++;
        if(language==='de'&&((kind==='ready'||kind==='error')&&[320,1440].includes(width)||kind==='loading'&&width===320))await coveragePage.screenshot({path:path.join(output,'main-'+mainKind+'-'+language+'-'+width+'.png'),caret:'initial'});
        await coveragePage.locator('#roundTechWarning').scrollIntoViewIfNeeded();
        assert(await coveragePage.locator('#roundTechWarning').evaluate(node=>{const box=node.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth+1&&[...node.querySelectorAll('strong,span')].every(child=>{const range=document.createRange();range.selectNodeContents(child);return [...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1);});}),'Unassigned warning fits '+language+'/'+width);warningGeometry++;
        if(kind==='ready'&&language==='de'&&[320,1440].includes(width))await coveragePage.screenshot({path:path.join(output,'unassigned-'+language+'-'+width+'.png'),caret:'initial'});
        const emptyColumn=coveragePage.locator(`#visitPlanner [data-technician-id="${emptyTechnician.id}"]`);await emptyColumn.scrollIntoViewIfNeeded();
        assert(await emptyColumn.evaluate(node=>{const box=node.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth+1&&[...node.querySelectorAll('h4,.empty')].every(child=>{const range=document.createRange();range.selectNodeContents(child);return [...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1);});}),'Planner heading/hint fits '+language+'/'+width);plannerGeometry++;
        if(kind==='ready'&&language==='de'&&[320,1440].includes(width))await coveragePage.screenshot({path:path.join(output,'planner-'+language+'-'+width+'.png'),caret:'initial'});
        const ownChip=coveragePage.locator(`#visitPlanner .visit-chip[data-kind="${summaryCounts.extras?'EXTRA':'SERVICE'}"][data-id="${summaryCounts.extras?summaryExtra.id:statusVisit.id}"]`);
        if(summaryCounts.visible){await ownChip.scrollIntoViewIfNeeded();assert(await ownChip.evaluate(node=>{const box=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node.children[2]);return box.left>=0&&box.right<=innerWidth+1&&[...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1);}),'Native chip metadata fits '+language+'/'+width);chipGeometry++;if(language==='de'&&[320,1440].includes(width)&&((kind==='ready')||(kind==='loading'&&width===1440)))await coveragePage.screenshot({path:path.join(output,'chip-'+(summaryCounts.extras?'extra':'service')+'-'+language+'-'+width+'.png'),caret:'initial'});}
        const tableMeasured=await coveragePage.locator('#weekVisits').evaluate(root=>{
          const scroll=root.querySelector('.table-scroll');if(!scroll)return{headingsFit:!root.querySelector('thead'),actions:{count:0,kinds:[],failures:[]}};const saved=scroll.scrollLeft,actions=[];
          const bounds=node=>{const box=node.getBoundingClientRect();return{left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width,height:box.height,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth};};
          try{
            const headingsFit=[...root.querySelectorAll('thead th')].every(node=>{scroll.scrollLeft+=node.getBoundingClientRect().left-scroll.getBoundingClientRect().left;const box=node.getBoundingClientRect(),frame=scroll.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);return frame.left>=0&&frame.right<=innerWidth+1&&[...range.getClientRects()].every(line=>line.left>=frame.left-1&&line.right<=frame.right+1&&line.left>=box.left-1&&line.right<=box.right+1&&line.top>=box.top-1&&line.bottom<=box.bottom+1);});
            for(const position of ['maxScroll','columnAligned']){
              scroll.scrollLeft=scroll.scrollWidth;
              if(position==='columnAligned')scroll.scrollLeft+=root.querySelector('thead th:last-child').getBoundingClientRect().left-scroll.getBoundingClientRect().left;
              for(const node of root.querySelectorAll('[data-save-visit]')){
                const row=node.closest('tr'),box=bounds(node),group=bounds(node.closest('.table-actions')),cell=bounds(node.closest('td')),table=bounds(node.closest('table')),frame=bounds(scroll),style=getComputedStyle(node),range=document.createRange();range.selectNodeContents(node);
                const lines=[...range.getClientRects()].map(line=>({left:line.left,right:line.right,top:line.top,bottom:line.bottom})),inside=container=>lines.length>0&&lines.every(line=>line.left>=container.left-1&&line.right<=container.right+1&&line.top>=container.top-1&&line.bottom<=container.bottom+1);
                const tableStyle=getComputedStyle(node.closest('table'));
                actions.push({position,kind:row.dataset.kind,id:row.dataset.id,text:node.textContent,scrollLeft:scroll.scrollLeft,maxScroll:scroll.scrollWidth-scroll.clientWidth,box,group,cell,table,frame,lines,tableStyle:{display:tableStyle.display,width:tableStyle.width,maxWidth:tableStyle.maxWidth,overflowX:tableStyle.overflowX,tableLayout:tableStyle.tableLayout},style:{display:style.display,whiteSpace:style.whiteSpace,overflowX:style.overflowX,overflowY:style.overflowY,padding:style.padding,margin:style.margin},internalFits:inside(box)&&inside(group)&&inside(cell)&&node.scrollWidth<=node.clientWidth+1,visibleFits:frame.left>=0&&frame.right<=innerWidth+1&&lines.every(line=>line.left>=frame.left-1&&line.right<=frame.right+1)});
              }
            }
            // Keep every native box in the browser; transport failures and aggregates only.
            (window.qaTableActionMeasurements??=[]).push(...actions);
            return{headingsFit,actions:{count:actions.length,kinds:[...new Set(actions.map(row=>row.kind))],failures:actions.filter(row=>!row.internalFits||!row.visibleFits||row.tableStyle.overflowX!=='visible'||row.text!=='Guardar alteracoes'),sample:actions[0]}};
          }finally{scroll.scrollLeft=saved;}
        });
        assert(tableMeasured.headingsFit,'All seven table headings fit their native horizontal scroll '+language+'/'+width);tableGeometry++;
        const actionMeasurements={state:kind,language,width,...tableMeasured.actions};tableActionMeasurements.push(actionMeasurements);console.log('QA native visit save geometry '+JSON.stringify(actionMeasurements));
        assert.equal(tableMeasured.actions.count,summaryCounts.visible*2,'Both native action positions preserve every visible row');
        if(kind==='ready'&&language==='de'&&[320,1440].includes(width)){await coveragePage.locator('#weekVisits thead').scrollIntoViewIfNeeded();await coveragePage.screenshot({path:path.join(output,'table-'+language+'-'+width+'.png'),caret:'initial'});const scroll=coveragePage.locator('#weekVisits .table-scroll'),savedLeft=await scroll.evaluate(node=>{const saved=node.scrollLeft;node.scrollLeft=node.scrollWidth;return saved;});await coveragePage.screenshot({path:path.join(output,'table-end-'+language+'-'+width+'.png'),caret:'initial'});await scroll.evaluate((node,left)=>{node.scrollLeft=left;},savedLeft);}
        assert.equal(reads.length,count,'All native read-only geometry preserves zero operational GETs');
        mark('geometry');
        if(kind==='ready')await checkRefreshContrast(language,width);mark('contrast');
        states++;
      }}
      const timing={kind,widths,snapshotChars,ms:Date.now()-started,phaseMs};matrixTimings.push(timing);console.log('QA coverage matrix time '+JSON.stringify(timing));
    }
    const refresh=async()=>{await coveragePage.locator('#coverageRefresh').click();};
    const ready=()=>coveragePage.waitForFunction(()=>document.querySelectorAll('#coverageList article').length>0&&!document.getElementById('coverageStatus').textContent.includes('…'));
    const held=async()=>{const deadline=Date.now()+7000;while(!heldReply&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(heldReply,'Actual coverage GET must reach latency gate');};
    // Start the existing read producer; there is no separate load-all UI button.
    const readAgain=()=>coveragePage.evaluate(()=>{window.qaMainRead=loadAll();});
    const readSettled=()=>coveragePage.evaluate(()=>window.qaMainRead);
    const mainHeld=async()=>{const deadline=Date.now()+7000;while(!mainHeldReply&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(mainHeldReply,'Actual planner GET must reach latency gate');};
    const navigation=coveragePage.goto(base+'/admin-rounds',{waitUntil:'networkidle'});navigation.catch(()=>{});
    try{await coveragePage.waitForFunction(()=>Boolean(document.getElementById('assignmentStart')?.value),null,{timeout:7000});await coveragePage.locator('#visitSearch').fill(pool.name);assert.equal(await coveragePage.locator('#visitSearch').inputValue(),pool.name);}finally{initialFilterReady();}
    await navigation;await ready();await choose('en');
    assert.equal(await coveragePage.locator('#coverageStatus').textContent(),expectedReady(1),'Native ready feedback must follow actual EN selection');
    console.log('QA native rounds read feedback '+JSON.stringify({text:await coveragePage.locator('#status').textContent(),language:'en'}));
    assert.deepEqual(routeFailures,[],'Native API response preparation must succeed before language assertions');
    assert.equal(await coveragePage.locator('#status').textContent(),'Rounds and visits loaded successfully.','Native main read feedback must follow actual EN selection');
    const warningCount=Number(await coveragePage.locator('#kpiUnassignedRounds').textContent());
    console.log('QA native unassigned warning '+JSON.stringify({heading:await coveragePage.locator('#roundTechWarning strong').textContent(),count:warningCount,ownRound:warningRound.id,nativeRoundRows:latestRounds.length}));
    assert.equal(await coveragePage.locator('#roundTechWarning strong').textContent(),'Warning: '+warningCount+' round(s) without an assigned technician','Native unassigned warning must follow actual EN selection');
    const plannerLabels=await coveragePage.locator('#visitPlanner .tech-column').evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.technicianId,label:node.querySelector('h4').firstChild.nodeValue,hint:node.querySelector('.tech-drop>.empty')?.textContent||null})));
    console.log('QA native planner labels '+JSON.stringify({unassigned:plannerLabels.find(column=>column.id===''),fallback:plannerLabels.find(column=>column.id===String(emptyTechnician.id)),literal:plannerLabels.find(column=>column.id===String(literalTechnician.id)),nativeTechnicianRows:latestTechnicians.length}));
    assert.equal(plannerLabels.find(column=>column.id==='').label,'Unassigned ','Native planner unassigned heading must follow actual EN selection');
    const ownChipLabels=await coveragePage.evaluate(({service,extra})=>[...document.querySelectorAll('#visitPlanner .visit-chip')].filter(node=>(node.dataset.kind==='SERVICE'&&node.dataset.id===String(service))||(node.dataset.kind==='EXTRA'&&node.dataset.id===String(extra))).map(node=>({kind:node.dataset.kind,id:node.dataset.id,metadata:node.children[2].textContent})),{service:statusVisit.id,extra:summaryExtra.id});
    console.log('QA native planner chip kinds '+JSON.stringify(ownChipLabels));assert.equal(ownChipLabels.length,2);assert(ownChipLabels.find(chip=>chip.kind==='SERVICE').metadata.includes(' - Round - '),'Native SERVICE chip kind must follow actual EN selection');assert(ownChipLabels.find(chip=>chip.kind==='EXTRA').metadata.includes(' - Extra - '),'Native EXTRA chip kind must follow actual EN selection');
    const nativeModes=await coveragePage.evaluate(ids=>state.visits.filter(row=>ids.includes(row.id)).map(row=>({id:row.id,code:normalizeServiceVisit(row).assignmentMode,metadata:document.querySelector(`#visitPlanner .visit-chip[data-kind="SERVICE"][data-id="${row.id}"]`).children[2].textContent})),modeFixtures.map(row=>row.id));
    console.log('QA native planner assignment modes '+JSON.stringify(nativeModes));assert.deepEqual(nativeModes.map(({id,code})=>({id,code})),modeFixtures.map(({id,code})=>({id,code})));assert(nativeModes.find(row=>row.code==='SUPPORT').metadata.endsWith(' - Help / support'),'Native SUPPORT chip assignment must follow actual EN selection');
    const nativeTable=await coveragePage.locator('#weekVisits').evaluate(root=>({headings:[...root.querySelectorAll('thead th')].map(node=>node.textContent),aria:root.querySelector('.table-scroll').getAttribute('aria-label'),rows:[...root.querySelectorAll('tbody tr')].map(node=>({kind:node.dataset.kind,id:Number(node.dataset.id)}))}));
    console.log('QA native visit table headings '+JSON.stringify({headings:nativeTable.headings,aria:nativeTable.aria,rows:nativeTable.rows.length}));assert.deepEqual(nativeTable.headings,tableHeadings.map(labels=>labels[1]),'Native visit table headings must follow actual EN selection');assert.equal(nativeTable.aria,tableAria[1],'Native table scroll accessible label must follow actual EN selection');
    warningEntries=await coveragePage.evaluate(()=>state.rounds.filter(round=>round.active!==false&&!roundHasTechnician(round)).map(round=>({id:round.id,name:String(round.name),day:Number(round.dayOfWeek)||0})));
    assert(warningEntries.some(round=>round.id===warningRound.id&&round.name===warningRound.name&&round.day===warningRound.dayOfWeek));assert.equal(warningEntries.length,warningCount);
    const warningIds=new Set(warningEntries.map(round=>round.id));assert.deepEqual(warningEntries,latestRounds.filter(round=>warningIds.has(round.id)).map(round=>({id:round.id,name:String(round.name),day:Number(round.dayOfWeek)||0})),'Every unassigned entry agrees with the actual page API source');
    await coveragePage.locator('#visitSearch').fill(filter+'-regular');
    assert.deepEqual(await coveragePage.locator('#weekVisits tbody tr').evaluateAll(nodes=>nodes.map(node=>[node.dataset.kind,Number(node.dataset.id)])),[['SERVICE',statusVisit.id]],'Real UI filter must retain exactly the own SQL visit without pruning data');
    const dragReads=reads.length;
    assert.deepEqual(await coveragePage.locator(`#visitPlanner .visit-chip[data-kind="SERVICE"][data-id="${statusVisit.id}"]`).evaluate(node=>{const dataTransfer=new DataTransfer();node.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer}));return JSON.parse(dataTransfer.getData('text/plain'));}),{kind:'SERVICE',id:String(statusVisit.id)},'The original dragstart keeps its typed visit payload');
    assert(await coveragePage.locator('#visitPlanner [data-technician-id=""]').evaluate(node=>{const before=node.className;node.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true}));const active=node.classList.contains('drag-over');node.dispatchEvent(new DragEvent('dragleave',{bubbles:true}));return active&&node.className===before;}),'Original drag feedback is retained');assert.equal(reads.length,dragReads);
    const weekResponse=await fetch(base+'/api/round-planner/week',{headers:{Authorization:'Bearer '+token}}),extraResponse=await fetch(base+'/api/extra-visits',{headers:{Authorization:'Bearer '+token}});assert.equal(weekResponse.status,200);assert.equal(extraResponse.status,200);
    const nativeWeek=await weekResponse.json(),nativeExtras=(await extraResponse.json()).extraVisits;assert(Array.isArray(nativeWeek));assert(Array.isArray(nativeExtras));assert.equal(nativeWeek.find(row=>row.id===statusVisit.id)?.plannedDate,statusVisit.plannedDate.toISOString());assert.deepEqual(nativeExtras.find(row=>row.id===summaryExtra.id).notes,summaryExtra.notes);
    const bounds=await coveragePage.evaluate(()=>{const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+7);return{start:start.getTime(),end:end.getTime()};});
    const nativeTotal=nativeWeek.length+nativeExtras.filter(row=>{const date=new Date(row.scheduledAt||row.date||row.plannedDate).getTime();return date>=bounds.start&&date<bounds.end;}).length;
    const summaryCounts={visible:1,total:nativeTotal,alerts:0,late:1,extras:0,billable:0},expectedSummary=index=>copy.summary[index].replace(/\{(visible|total|alerts|late|extras|billable)\}/g,(_,key)=>summaryCounts[key]);
    console.log('QA native visit filter summary '+JSON.stringify({text:await coveragePage.locator('#visitFilterSummary').textContent(),counts:summaryCounts,ownSqlVisit:statusVisit.id,weekRows:nativeWeek.length,extraRows:nativeExtras.length}));
    assert.equal(await coveragePage.locator('#visitFilterSummary').textContent(),expectedSummary(1),'Native filter summary must follow actual EN selection');
    await coveragePage.locator('#coverageReason').fill('Atualizar <b>literal draft</b>');await coveragePage.locator('#roundName').fill('A verificar as visitas…');await coveragePage.locator('#coverageCause').selectOption('Falta de produtos químicos');
    await coveragePage.locator(`[data-transfer-visit="${statusVisit.id}"]`).check();
    await coveragePage.evaluate(()=>{document.getElementById('extraPrice').disabled=true;document.getElementById('createExtraVisitBtn').setAttribute('aria-busy','true');});
    await matrix('ready',expectedReady);
    for(const width of [320,390,1440]) {
      await coveragePage.setViewportSize({width,height:1000});
      if(width===320){mainMode='hold';await readAgain();await mainHeld();mainKind='loading';}
      if(width===390){mainMode='http';await readAgain();await readSettled();mainKind='warnings';}
      if(width===390){await coveragePage.locator('#visitSearch').fill(filter);Object.assign(summaryCounts,{visible:2,alerts:1,late:1,extras:1,billable:1});assert.deepEqual(await coveragePage.locator('#weekVisits tbody tr').evaluateAll(nodes=>nodes.map(node=>[node.dataset.kind,Number(node.dataset.id)])),[['SERVICE',statusVisit.id],['EXTRA',summaryExtra.id]]);}
      if(width===1440){await coveragePage.locator('#visitStatusFilter').selectOption('extra');Object.assign(summaryCounts,{visible:1,alerts:1,late:0,extras:1,billable:1});assert.deepEqual(await coveragePage.locator('#weekVisits tbody tr').evaluateAll(nodes=>nodes.map(node=>[node.dataset.kind,Number(node.dataset.id)])),[['EXTRA',summaryExtra.id]]);assert.equal(await coveragePage.locator('#weekVisits tbody img').count(),0);}
      coverageMode='hold';await refresh();await held();await matrix('loading',index=>copy.loading[index],[width]);heldReply();heldReply=null;coverageMode='normal';await ready();
      if(width===320){mainHeldReply();mainHeldReply=null;mainMode='normal';await readSettled();mainKind='ready';}
    }
    await coveragePage.locator('#visitSearch').fill(filter+'-no-result');await coveragePage.locator('#visitStatusFilter').selectOption('');Object.assign(summaryCounts,{visible:0,alerts:0,late:0,extras:0,billable:0});assert.equal(await coveragePage.locator('#weekVisits tbody tr').count(),0);
    coverageMode='http';await refresh();await coveragePage.waitForFunction(detail=>document.getElementById('coverageStatus').textContent.includes(detail),detail);await matrix('error',index=>copy.error[index]+detail+copy.stale[index]);
    mainMode='normal';await readAgain();await readSettled();mainKind='ready';
    await coveragePage.locator('#visitSearch').fill(filter+'-regular');Object.assign(summaryCounts,{visible:1,alerts:0,late:1,extras:0,billable:0});
    coverageMode='normal';await refresh();await ready();await matrix('recovered',expectedReady,[320]);
    await coveragePage.evaluate(()=>{const input=document.getElementById('coverageReason');input.focus();input.setSelectionRange(3,9);});await snapshot(true);
    const saved=coveragePage.waitForResponse(response=>response.url().endsWith('/api/settings/language/me')&&response.request().method()==='PUT'&&response.request().postDataJSON().language==='fr');await coveragePage.evaluate(()=>CristalI18n.applyLanguage('fr'));assert.equal((await saved).status(),200);
    assert.deepEqual(await coveragePage.locator('#coverageReason').evaluate(node=>({focus:document.activeElement===node,start:node.selectionStart,end:node.selectionEnd})),{focus:true,start:3,end:9});assert.equal(await snapshot(false),true);
    const timeoutDetail=await coveragePage.evaluate(async()=>{const signal=AbortSignal.timeout(0);await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));return signal.reason.message;});
    coverageMode='hold';const failed=coveragePage.waitForEvent('requestfailed',{predicate:request=>new URL(request.url()).pathname==='/api/rounds/coverage',timeout:16000});failed.catch(()=>{});const started=Date.now();await refresh();await held();
    await coveragePage.waitForFunction(detail=>document.getElementById('coverageStatus').textContent.includes(detail),timeoutDetail,{timeout:16000});await failed;assert(Date.now()-started>=14000,'Original 15000ms production deadline must actually elapse');
    await matrix('timeout',index=>copy.error[index]+timeoutDetail+copy.stale[index],[320]);heldReply();heldReply=null;coverageMode='normal';await refresh();await ready();
    for(const replacement of [false,true]) {
      await readAgain();await readSettled();
      await choose('de');await refresh();await ready();
      await coveragePage.locator('#visitStatusFilter').selectOption('pending');await coveragePage.locator('#visitStatusFilter').selectOption('');assert.equal(await coveragePage.locator('#visitFilterSummary').textContent(),expectedSummary(4),'A native filter producer owns its fresh summary leaf');
      await coveragePage.evaluate(replacement=>{const node=document.getElementById('coverageStatus'),clone=node.cloneNode(true);clone.removeAttribute('id');node.after(clone);if(replacement)node.replaceChildren(document.createTextNode(node.textContent));else node.firstChild.nodeValue='A verificar as visitas…';window.qaCoverageForeign=[node,clone].map(node=>({node,markup:node.outerHTML}));},replacement);
      await coveragePage.evaluate(({replacement,text})=>{const node=document.getElementById('visitFilterSummary'),clone=node.cloneNode(true);clone.removeAttribute('id');node.after(clone);if(replacement)node.replaceChildren(document.createTextNode(node.textContent));else node.firstChild.nodeValue=text;window.qaSummaryForeign=[node,clone].map(node=>({node,markup:node.outerHTML}));},{replacement,text:expectedSummary(0)});
      await coveragePage.evaluate(({replacement,text})=>{const node=document.getElementById('status');if(replacement)node.replaceChildren(document.createTextNode(node.textContent));else setStatus(text,'error');const clone=node.cloneNode(true);clone.removeAttribute('id');node.after(clone);window.qaMainForeign=[node,clone].map(node=>({node,markup:node.outerHTML}));},{replacement,text:copy.mainReady[0]});
      assert.equal(await coveragePage.locator('#status').getAttribute('class'),replacement?'status':'status error');
      await coveragePage.evaluate(({replacement,expected})=>{const node=document.getElementById('roundTechWarning'),clone=node.cloneNode(true);clone.removeAttribute('id');node.after(clone);for(const [selector,text]of [['strong',expected.heading],['span',expected.body]]){const child=node.querySelector(selector);if(replacement)child.replaceChildren(document.createTextNode(child.textContent));else child.firstChild.nodeValue=text;}window.qaWarningForeign=[node,clone].map(node=>({node,markup:node.outerHTML}));},{replacement,expected:expectedWarning(0)});
      await coveragePage.evaluate(({replacement,id})=>{const nodes=[document.querySelector('#visitPlanner [data-technician-id=""] h4'),document.querySelector(`#visitPlanner [data-technician-id="${id}"] h4`),document.querySelector(`#visitPlanner [data-technician-id="${id}"] .empty`)];window.qaPlannerClones=[];for(const node of nodes){const clone=node.cloneNode(true);node.after(clone);qaPlannerClones.push(clone);if(replacement)node.replaceChild(document.createTextNode(node.firstChild.nodeValue),node.firstChild);else node.firstChild.nodeValue='Sem tecnico';}window.qaPlannerForeign=[...nodes,...qaPlannerClones].map(node=>({node,markup:node.outerHTML}));},{replacement,id:emptyTechnician.id});
      await coveragePage.evaluate(({replacement,id})=>{const node=document.querySelector(`#visitPlanner .visit-chip[data-kind="SERVICE"][data-id="${id}"]`).children[2],clone=node.cloneNode(true);node.after(clone);if(replacement)node.replaceChildren(document.createTextNode(node.textContent));else node.firstChild.nodeValue='Sem data - Ronda - Sem tecnico';window.qaChipForeign=[node,clone].map(node=>({node,markup:node.outerHTML}));},{replacement,id:statusVisit.id});
      await coveragePage.evaluate(replacement=>{const root=document.getElementById('weekVisits'),scroll=root.querySelector('.table-scroll'),node=root.querySelector('thead th'),clone=node.cloneNode(true),cloneScroll=scroll.cloneNode(true);node.after(clone);scroll.after(cloneScroll);if(replacement)node.replaceChildren(document.createTextNode(node.textContent));else node.firstChild.nodeValue='Data';scroll.setAttribute('aria-label','Lista editavel de visitas da semana');window.qaTableForeign=[node,clone,cloneScroll].map(node=>({node,markup:node.outerHTML}));window.qaTableAria=scroll;},replacement);
      for(const language of languages){const count=reads.length;await choose(language);assert(await coveragePage.evaluate(()=>qaCoverageForeign.every(({node,markup})=>node.outerHTML===markup)));assert(await coveragePage.evaluate(()=>qaSummaryForeign.every(({node,markup})=>node.outerHTML===markup)));assert(await coveragePage.evaluate(()=>qaMainForeign.every(({node,markup})=>node.outerHTML===markup)),'Literal setStatus, foreign same-byte leaf and clones never gain read ownership');assert(await coveragePage.evaluate(()=>qaWarningForeign.every(({node,markup})=>node.outerHTML===markup)),'External warning leaves and clones never gain ownership');assert(await coveragePage.evaluate(()=>qaPlannerForeign.every(({node,markup})=>node.outerHTML===markup)),'External planner leaves and clones never gain ownership');assert(await coveragePage.evaluate(()=>qaChipForeign.every(({node,markup})=>node.outerHTML===markup)),'External chip metadata and clones never gain ownership');assert(await coveragePage.evaluate(()=>qaTableForeign.every(({node,markup})=>node.outerHTML===markup)&&qaTableAria.getAttribute('aria-label')==='Lista editavel de visitas da semana'),'External table leaves/clones and changed aria never gain ownership');assert.equal(reads.length,count);foreign++;summaryForeign++;mainForeign++;warningForeign++;plannerForeign++;chipForeign++;tableForeign++;}
      await coveragePage.evaluate(()=>{qaCoverageForeign[1].node.remove();qaSummaryForeign[1].node.remove();qaMainForeign[1].node.remove();qaWarningForeign[1].node.remove();qaPlannerClones.forEach(node=>node.remove());qaChipForeign[1].node.remove();qaTableForeign[1].node.remove();qaTableForeign[2].node.remove();});
    }
    await coveragePage.locator('#visitSearch').fill(modeFilter);await coveragePage.locator('#coverageReason').evaluate(node=>{node.focus();node.setSelectionRange(3,9);});await capture();await snapshot(true);
    const modeParts=await coveragePage.evaluate(()=>qaChipSegments);assert.equal(modeParts.length,6);assert.deepEqual(modeParts.map(row=>row.mode).sort(),Object.keys(assignmentCopy).sort());
    const modeStarted=Date.now();
    for(const [index,language]of languages.entries()){
      const count=reads.length,saved=coveragePage.waitForResponse(response=>response.url().endsWith('/api/settings/language/me')&&response.request().method()==='PUT'&&response.request().postDataJSON().language===language);
      await coveragePage.evaluate(language=>CristalI18n.applyLanguage(language),language);const response=await saved;assert.equal(response.status(),200);assert.deepEqual(await response.json(),{ok:true,language});await coveragePage.waitForFunction(value=>document.documentElement.lang===value,language);
      const actual=await coveragePage.locator('#visitPlanner .visit-chip').evaluateAll(nodes=>nodes.map(node=>({kind:node.dataset.kind,id:node.dataset.id,metadata:node.children[2].textContent})));
      assert.deepEqual(actual,modeParts.map(({kind,id,prefix,mode})=>({kind,id,metadata:prefix+' - '+chipKinds[kind][index]+' - '+assignmentCopy[mode][index]})),language+' all six assignment suffixes follow native codes');
      assert.deepEqual(await coveragePage.locator('#weekVisits').evaluate(root=>({headings:[...root.querySelectorAll('thead th')].map(node=>node.textContent),aria:root.querySelector('.table-scroll').getAttribute('aria-label')})),{headings:tableHeadings.map(labels=>labels[index]),aria:tableAria[index]},language+' fresh native filter producer regains table copy ownership');
      assert(await coveragePage.evaluate(()=>qaCoverageNodes.every(({node,children})=>node.isConnected&&node.childNodes.length===children.length&&children.every((child,index)=>node.childNodes[index]===child))));assert(await snapshot(false));assert.deepEqual(await coveragePage.locator('#coverageReason').evaluate(node=>({focus:document.activeElement===node,start:node.selectionStart,end:node.selectionEnd})),{focus:true,start:3,end:9});assert.equal(reads.length,count);modeCases++;
      for(const width of [320,390,1440]){
        await coveragePage.setViewportSize({width,height:1000});assert(await coveragePage.locator('#visitPlanner .visit-chip').evaluateAll(nodes=>nodes.every(node=>{const box=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node.children[2]);return box.left>=0&&box.right<=innerWidth+1&&[...range.getClientRects()].every(line=>line.left>=box.left-1&&line.right<=box.right+1&&line.top>=box.top-1&&line.bottom<=box.bottom+1);})),language+'/'+width+' all six mode metadata labels fit');modeGeometry++;
        if(language==='de'&&[320,1440].includes(width)){const fixture=modeFixtures.find(row=>row.code==='OTHER_DAY');await coveragePage.locator(`#visitPlanner .visit-chip[data-id="${fixture.id}"]`).scrollIntoViewIfNeeded();await coveragePage.screenshot({path:path.join(output,'assignment-'+language+'-'+width+'.png'),caret:'initial'});}
      }
    }
    assert.equal(modeCases,5);assert.equal(modeGeometry,15);assert.equal(await modeSql(),modesBefore);console.log('PASS native six assignment modes '+JSON.stringify({cases:modeCases,geometry:modeGeometry,ms:Date.now()-modeStarted,codes:modeParts.map(row=>row.mode),fixtures:modeFixtures.map(row=>row.id),nativeSourceRows:latestWeek.length}));
    assert.deepEqual(await sql(),before);assert.deepEqual(pageErrors,[]);assert.deepEqual(routeFailures,[]);assert.deepEqual(businessWrites,[]);assert(preferences.every(body=>Object.keys(body).length===1&&languages.includes(body.language)));
    assert.equal(refreshContrasts.length,45);assert(refreshContrasts.every(item=>item.ratio>=4.5),'All 45 native coverage refresh contrasts must reach 4.5:1');
    assert.equal(tableActionMeasurements.reduce((sum,row)=>sum+row.count,0),90);assert.deepEqual(tableActionMeasurements.flatMap(row=>row.failures),[],'Every native save action text fits internally and its horizontally scrolled column');
    assert.equal(plannerCases,55);assert.equal(plannerGeometry,55);assert.equal(plannerForeign,10);
    assert.equal(stateCollectionCalls,55);assert.equal(stateCollectionCalls,states);
    assert.equal(tableCases,55);assert.equal(tableGeometry,55);assert.equal(tableForeign,10);
    assert.equal(chipCases,55);assert.equal(chipGeometry,40);assert.equal(chipForeign,10);
    assert.deepEqual(chipStates,{service:35,extra:10,empty:15});
    const plannerProof={cases:plannerCases,geometry:plannerGeometry,foreign:plannerForeign,nativeTechnicians:latestTechnicians.length,emptyTechnician:emptyTechnician.id,literalTechnician:literalTechnician.id,allNonOwnedMarkupCompared:true,originalDragPayload:true};console.log('PASS native planner labels '+JSON.stringify(plannerProof));
    plannerProof.chipKinds={cases:chipCases,geometry:chipGeometry,foreign:chipForeign,foreignKind:'SERVICE',kinds:['SERVICE','EXTRA'],states:chipStates,datesRemainLiteral:true,assignmentCodesUnchanged:true,allNonOwnedMarkupCompared:true};plannerProof.assignments={cases:modeCases,geometry:modeGeometry,codes:modeParts.map(row=>row.mode),fixtures:modeFixtures.map(row=>row.id),nativeSourceRows:latestWeek.length,allOriginal55CyclesRetained:true,totalCopyCycles:60,dateKindAndNonOwnedMarkupRetained:true};
    plannerProof.table={cases:tableCases,recoveredCases:5,geometry:tableGeometry,foreign:tableForeign,headings:7,accessibleLabel:true,allNonOwnedMarkupCompared:true,editableRowsUnchanged:true,saveActions:{measurements:tableActionMeasurements.reduce((sum,row)=>sum+row.count,0),positions:['maxScroll','columnAligned'],kinds:[...new Set(tableActionMeasurements.flatMap(row=>row.kinds))],allInternalAndVisible:tableActionMeasurements.every(row=>!row.failures.length),allNativeBoxesRetained:true,transportCycles:tableActionMeasurements.length,neverClicked:true}};
    const proof={languages,widths:[320,390,1440],states,geometry,foreign,matrixTimings,stateCollection:{calls:stateCollectionCalls,callsPerCycle:1,originalCallsPerCycle:11,allOriginalAssertionsRetained:true,requiredTargetsUnique:true},refreshContrastCases:refreshContrasts.length,minRefreshContrast:Math.min(...refreshContrasts.map(item=>item.ratio)),planner:plannerProof,unassignedWarning:{cases:warningCases,geometry:warningGeometry,foreign:warningForeign,count:warningEntries.length,ownRound:warningRound.id,nativeRoundRows:latestRounds.length,capturedApiNames:true},mainRead:{cases:mainCases,geometry:mainGeometry,foreign:mainForeign,states:mainStates,loadingWidths:[320],readyAndWarningWidths:[320,390,1440],actualReadProducer:true,legacyStringContract:true},summary:{cases:summaryCases,geometry:summaryGeometry,foreign:summaryForeign,nativeTotal,weekRows:nativeWeek.length,extraRows:nativeExtras.length,ownExtra:summaryExtra.id,states:['regular','regular + urgent chargeable extra','extra only','zero result','regular recovered'],sixCapturedCounts:true,freshProducerLeaf:true},nativeRows:latestCoverage.rows.length,ownFilteredVisit:statusVisit.id,realUiFilterWithoutDataPruning:true,rawScope:latestCoverage.scope,nativeSuccess:true,successPayloadMocks:false,original15000msDeadline:true,literalErrorsInert:true,nodeIdentity:true,focusCaret:true,selectionDraftsDisabledBusyBytes:true,zeroLanguageReads:true,zeroBusinessWrites:true,sqlUnchanged:true};console.log('PASS coverage status native languages '+JSON.stringify(proof));return proof;
  } finally {initialFilterReady();heldReply?.();mainHeldReply?.();await coverageContext?.close();for(const fixture of modeFixtures)await prisma.serviceVisit.delete({where:{id:fixture.id}});if(emptyTechnician)await prisma.technician.delete({where:{id:emptyTechnician.id}});if(literalTechnician)await prisma.technician.delete({where:{id:literalTechnician.id}});if(warningRound)await prisma.round.delete({where:{id:warningRound.id}});if(summaryExtra)await prisma.extraVisit.delete({where:{id:summaryExtra.id}});if(statusVisit)await prisma.serviceVisit.delete({where:{id:statusVisit.id}});}
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
  const coverageStatus = await checkCoverageStatus(admin);
  const proof={ok:true,realAuthenticatedPage:true,successPayloadMocks:false,controlledGetFailures:['503 literal server text','malformed JSON','HTTP fallback','12000ms deadline'],languages,widths:[320,390,1440],readyCases,stateCases,searchCases,ownershipCases,nodeIdentityRetained:true,focusAndCaretRetained:true,literalNamesMessagesAndRecordBytes:true,zeroBusinessWrites:true,apiPaths:[...new Set(requests)],states:stateProof,visitsDashboard,coverageStatus};
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(proof,null,2)+'\n');console.log('PASS command centre native languages '+JSON.stringify(proof));
})().catch(async error=>{console.error(redact(error.stack || error));if(page)console.error('Command centre state',await page.locator('#metrics').textContent().catch(()=>null));process.exitCode=1;}).finally(async()=>{
  closing=true;release();await page?.unrouteAll({behavior:'ignoreErrors'});await browser?.close();
  if(token&&previousLanguage)await fetch(base+'/api/settings/language/me',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({language:previousLanguage})});
  if(history)await prisma.technicalHistory.delete({where:{id:history.id}});if(visit)await prisma.serviceVisit.delete({where:{id:visit.id}});if(pool)await prisma.pool.delete({where:{id:pool.id}});if(client)await prisma.client.delete({where:{id:client.id}});if(technician)await prisma.technician.delete({where:{id:technician.id}});await prisma.$disconnect();
});
