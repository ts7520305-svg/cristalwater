'use strict';
const API = '/api';
const authKeys = ['token', 'user', 'cristalwater_jwt', 'cristalwater_user', 'adminToken'];
const dashboardSession = () => JSON.stringify(authKeys.map(key => localStorage.getItem(key)));
const dashboardOwner = dashboardSession();
const adminSocket = typeof io === 'function' ? io() : null;
const monthPattern = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/;
let dashboardRequestVersion = 0, dashboardRequestController, mapVersion = 0, mapController;
let sessionInvalid = false, liveMap = null, liveMarkers = [], charts = [], timelineItems = [], intervals = [];
const $ = id => document.getElementById(id);
const formatMoney = value => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
const setText = (id, value) => { if ($(id)) $(id).textContent = value; };
function node(tag, text, className) {
  const el = document.createElement(tag); if (text != null) el.textContent = String(text); if (className) el.className = className; return el;
}
function link(href, text, className) { const el = node('a', text, className); el.href = href; return el; }
function getCurrentMonthRef() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return parts.find(p => p.type === 'year').value + '-' + parts.find(p => p.type === 'month').value;
}
function getAuthHeaders() { return { Authorization: 'Bearer ' + (localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '') }; }
function adminLogout() {
  if (window.CristalAuth?.logout) return window.CristalAuth.logout();
  authKeys.forEach(key => localStorage.removeItem(key)); window.location.href = '/login';
}
function setStatus(message, state) {
  setText('status', message); $('status').dataset.state = state;
  $('dashboardQuery').setAttribute('aria-busy', String(state === 'loading'));
  $('refreshBtn').disabled = sessionInvalid || !navigator.onLine;
  $('monthRef').disabled = sessionInvalid;
}
function validExternalInvoiceSummary(summary) {
  const counts = ['officialInvoiceClients', 'officialInvoiceTotal', 'officialInvoicePending', 'officialInvoiceConfirmed', 'officialInvoiceReview'];
  return !!summary && counts.every(key => Number.isSafeInteger(summary[key]) && summary[key] >= 0)
    && Number.isFinite(summary.officialInvoicePendingAmount) && summary.officialInvoicePendingAmount >= 0
    && summary.officialInvoicePending + summary.officialInvoiceConfirmed + summary.officialInvoiceReview <= summary.officialInvoiceTotal;
}
function buildDashboardView(data, month) {
  const summary = data?.summary;
  const counts = ['totalPools', 'totalClients', 'totalInvoicesAll', 'openInvoicesAll', 'overdueClients', 'totalInvoices', 'pendingInvoices', 'partialInvoices', 'visitsThisMonth', 'visitsDoneThisMonth', 'visitsNotDoneThisMonth', 'visitsPlannedThisMonth', 'openAlerts'];
  const amounts = ['monthBilled', 'monthPaid', 'monthOpen', 'totalBilledAll', 'totalOpenAll'];
  if (!monthPattern.test(month) || data?.ok !== true || data.monthRef !== month || !summary
      || !counts.every(key => Number.isSafeInteger(summary[key]) && summary[key] >= 0)
      || !amounts.every(key => typeof summary[key] === 'number' && Number.isFinite(summary[key]))
      || !Array.isArray(data.visits) || data.visits.length !== summary.visitsThisMonth
      || !Array.isArray(data.technicians) || !data.technicians.every(row => row && Number.isSafeInteger(row.id) && row.id > 0)
      || !Array.isArray(data.alerts) || data.alerts.length !== summary.openAlerts
      || !data.alerts.every(row => row && typeof row.id === 'string' && typeof row.message === 'string')
      || new Set(data.alerts.map(row => row.id)).size !== data.alerts.length) return null;
  const otherVisits = summary.visitsThisMonth - summary.visitsDoneThisMonth - summary.visitsNotDoneThisMonth - summary.visitsPlannedThisMonth;
  if (otherVisits < 0 || summary.pendingInvoices + summary.partialInvoices > summary.totalInvoices) return null;
  return { summary, month, otherVisits, alerts: data.alerts, technicianCount: data.technicians.length,
    completionRate: summary.visitsThisMonth ? Math.round(summary.visitsDoneThisMonth / summary.visitsThisMonth * 100) : null };
}
function externalInvoiceCards(summary) {
  const valid = validExternalInvoiceSummary(summary);
  return [
    { key: 'externalPending', externalKind: 'pending', label: 'Faturação externa', value: valid ? summary.officialInvoicePending : '—',
      text: valid ? formatMoney(summary.officialInvoicePendingAmount) + ' em documentos por associar · ' + summary.officialInvoiceConfirmed + ' referência(s) confirmada(s)' : 'Resumo indisponível. Consultar o registo.',
      href: valid && summary.officialInvoicePending > 0 ? '/to-issue?status=pending' : '/to-issue?status=all' },
    { key: 'externalReview', externalKind: 'review', label: 'Referências a rever', value: valid ? summary.officialInvoiceReview : '—',
      text: valid ? (summary.officialInvoiceReview ? 'Conferir números e histórico no registo de faturas' : 'Sem referências pendentes de revisão') : 'Resumo indisponível. Consultar o registo.',
      href: valid && summary.officialInvoiceReview > 0 ? '/to-issue?status=review' : '/to-issue?status=all' },
  ];
}
function renderAdminRoleDashboard(view) {
  const s = view?.summary, box = $('adminRoleDashboard');
  const head = node('div', null, 'role-dashboard-head'), title = node('div');
  title.append(node('h2', 'Resumo do administrador'), node('p', 'Visitas do mês, registos atuais e documentos de todos os períodos, conforme indicado em cada cartão.'));
  head.append(title, node('span', view ? 'Consulta confirmada' : 'Por confirmar', 'role-pulse'));
  const cards = [
    { key: 'visits', label: 'Visitas · mês selecionado', value: s ? s.visitsDoneThisMonth + ' / ' + s.visitsThisMonth : '—', text: s ? 'Concluídas / registadas · ' + s.visitsNotDoneThisMonth + ' não realizadas ou impedidas' : 'Dados ainda não confirmados', href: '/admin-visits' },
    { key: 'alerts', label: 'Alertas na consulta', value: s?.openAlerts ?? '—', text: 'Todos os períodos. A lista pode ser parcial; consulte os alertas para confirmar.', href: '/admin-alerts' },
    { key: 'team', label: 'Técnicos registados', value: view?.technicianCount ?? '—', text: 'Cadastro atual, incluindo registos inativos', href: '/admin-rounds' },
    { key: 'documents', label: 'Documentos internos', value: s?.totalInvoicesAll ?? '—', text: s ? 'Todos os períodos · total ' + formatMoney(s.totalBilledAll) : 'Dados ainda não confirmados', href: '/invoices' },
    ...externalInvoiceCards(s),
    { key: 'open', label: 'Por receber · todos os períodos', value: s ? formatMoney(s.totalOpenAll) : '—', text: s ? s.overdueClients + ' cliente(s) · ' + s.openInvoicesAll + ' documento(s) com saldo; sem classificação por vencimento' : 'Dados ainda não confirmados', href: '/invoices' },
  ];
  const grid = node('div', null, 'role-grid');
  for (const card of cards) {
    const el = link(card.href, null, 'role-card ds-nav-link'); el.dataset.dashboardCard = card.key;
    if (card.externalKind) el.dataset.externalInvoice = card.externalKind;
    el.append(node('span', card.label), node('strong', card.value), node('small', card.text)); grid.append(el);
  }
  const actions = node('div', null, 'role-actions');
  for (const [href, label, hint] of [['/admin-onboarding.html', 'Entrada guiada', 'Cliente, piscina e ficha técnica'], ['/admin-rounds', 'Planear rondas', 'Rever atribuições e visitas'], ['/admin-live-map', 'Abrir mapa', 'Consultar posições registadas'], ['/billing', 'Abrir cobranças', 'Conferir documentos e pagamentos']]) {
    const el = link(href, label, 'role-action'); el.append(node('span', hint)); actions.append(el);
  }
  box.replaceChildren(head, grid, actions);
}
function destroyCharts() { charts.forEach(chart => chart.destroy()); charts = []; for (const id of ['productivityChart', 'billingChart']) $(id).style.display = 'none'; }
function clearDashboard(message) {
  for (const id of ['monthVisitCount', 'monthDocumentCount', 'criticalAlerts', 'efficiencyRate', 'estimatedProfit', 'monthReceived']) setText(id, '—');
  setText('summaryScope', 'Período ainda não confirmado.'); setText('aiStateText', 'Dados por confirmar');
  $('aiDot').className = 'ai-dot ai-neutral'; $('criticalBanner').classList.add('is-hidden');
  $('criticalBannerActions').replaceChildren(); $('criticalBannerText').textContent = '';
  for (const id of ['operationalSummary', 'financialSummary', 'intelligencePanel']) $(id).replaceChildren(node('p', message));
  renderAdminRoleDashboard(null); destroyCharts();
}
function renderSummary(target, rows, note) {
  const grid = node('div', null, 'chart-summary-grid');
  for (const [label, value] of rows) { const item = node('div', null, 'chart-mini-card'); item.append(node('span', label), node('b', value)); grid.append(item); }
  $(target).replaceChildren(grid, node('p', note, 'chart-note'));
}
function renderCharts(view) {
  destroyCharts(); if (typeof Chart !== 'function') return;
  const s = view.summary, color = getComputedStyle(document.body).color;
  for (const [id, labels, values] of [
    ['productivityChart', ['Concluídas', 'Planeadas', 'Não realizadas / impedidas', 'Outros estados'], [s.visitsDoneThisMonth, s.visitsPlannedThisMonth, s.visitsNotDoneThisMonth, view.otherVisits]],
    ['billingChart', ['Documentos do mês', 'Pagamentos no mês', 'Saldo dos documentos do mês'], [s.monthBilled, s.monthPaid, s.monthOpen]],
  ]) {
    $(id).style.display = 'block';
    charts.push(new Chart($(id), { type: 'bar', data: { labels, datasets: [{ label: view.month, data: values, backgroundColor: ['#155db1', '#167749', '#ae4520', '#6250a3'] }] }, options: { responsive: true, plugins: { legend: { labels: { color } } }, scales: { x: { ticks: { color } }, y: { beginAtZero: true, ticks: { color } } } } }));
  }
}
function renderOperationalIntelligence(data, month = $('monthRef').value) {
  const view = buildDashboardView(data, month); if (!view) throw Error('Resposta incompleta ou incompatível');
  const s = view.summary; renderAdminRoleDashboard(view);
  setText('monthVisitCount', s.visitsThisMonth); setText('monthDocumentCount', s.totalInvoices); setText('criticalAlerts', s.openAlerts);
  setText('efficiencyRate', view.completionRate === null ? '—' : view.completionRate + '%');
  setText('monthReceived', formatMoney(s.monthPaid)); setText('estimatedProfit', 'Não apurado');
  setText('aiStateText', 'Consulta confirmada'); $('aiDot').className = 'ai-dot ai-neutral';
  setText('summaryScope', 'Período ' + month + ': visitas e documentos do mês; pagamentos pela data de recebimento. Cadastro, faturação externa e lista de alertas abrangem todos os períodos.');
  renderSummary('operationalSummary', [['Visitas do mês', s.visitsThisMonth], ['Concluídas', s.visitsDoneThisMonth], ['Planeadas', s.visitsPlannedThisMonth], ['Não realizadas / impedidas', s.visitsNotDoneThisMonth], ['Outros estados', view.otherVisits]], 'Outros estados incluem os registos não classificados acima. Estes totais não demonstram a carga de trabalho de um dia.');
  renderSummary('financialSummary', [['Documentos do mês', formatMoney(s.monthBilled)], ['Pagamentos no mês', formatMoney(s.monthPaid)], ['Saldo dos documentos do mês', formatMoney(s.monthOpen)]], 'Os pagamentos podem liquidar documentos de outros meses. Valores internos, sem confirmação de lucro ou emissão fiscal.');
  const panel = $('intelligencePanel'); panel.replaceChildren(node('p', 'O lucro exige receitas e custos conciliados. Este resumo não o apura.'), link('/billing', 'Conferir documentos e pagamentos', 'ds-nav-link'));
  panel.append(node('p', 'A carga diária e previsões futuras exigem o planeamento das datas pretendidas.'), link('/admin-rounds', 'Consultar o planeamento', 'ds-nav-link'));
  if (view.alerts.length) {
    panel.append(node('h3', 'Alertas recebidos na consulta'), node('p', 'Primeiros ' + Math.min(5, view.alerts.length) + ' de ' + view.alerts.length + ' registos recebidos; a lista pode ser parcial.'));
    for (const alert of view.alerts.slice(0, 5)) panel.append(node('p', alert.message, 'intelligence-item'));
  } else panel.append(node('p', 'A consulta não devolveu alertas. Confirme o estado no módulo de alertas.'));
  const actions = $('criticalBannerActions'); actions.replaceChildren();
  if (s.visitsNotDoneThisMonth) actions.append(link('/admin-visits', 'Visitas a rever (' + s.visitsNotDoneThisMonth + ')', 'ds-nav-link'));
  if (s.openAlerts) actions.append(link('/admin-alerts', 'Consultar alertas (' + s.openAlerts + ')', 'ds-nav-link'));
  if (s.totalOpenAll > 0) actions.append(link('/invoices', 'Documentos por receber', 'ds-nav-link'));
  $('criticalBanner').classList.toggle('is-hidden', !actions.children.length);
  setText('criticalBannerText', 'Conferir os registos e o respetivo contexto antes de tomar uma decisão.');
  renderCharts(view); return view;
}
function cancelDashboard() { dashboardRequestVersion++; dashboardRequestController?.abort(); }
function clearLiveMarkers() { liveMarkers.forEach(marker => liveMap?.removeLayer(marker)); liveMarkers = []; }
function clearMap(message) { mapVersion++; mapController?.abort(); clearLiveMarkers(); setText('liveTechnicians', '—'); setText('mapStatus', message); }
function invalidateSession() {
  if (sessionInvalid) return; sessionInvalid = true; cancelDashboard(); clearDashboard('A sessão mudou. Reabra a página com a conta pretendida.');
  clearMap('Posições retiradas após mudança de sessão.'); timelineItems = []; renderTimeline(); adminSocket?.disconnect();
  setStatus('Sessão alterada. Reabra a página.', 'session');
}
function currentSession() {
  if (!sessionInvalid && (dashboardSession() !== dashboardOwner || !(localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token')))) invalidateSession();
  return !sessionInvalid;
}
async function loadDashboard() {
  if (!currentSession()) return false;
  cancelDashboard(); const version = dashboardRequestVersion, month = $('monthRef').value;
  clearDashboard('Informação ainda não confirmada para esta consulta.');
  if (!monthPattern.test(month)) { setStatus('Escolha um mês válido.', 'invalid'); return false; }
  if (!navigator.onLine) { setStatus('Sem ligação. Volte a ligar-se para confirmar os dados.', 'offline'); return false; }
  const controller = new AbortController(); dashboardRequestController = controller;
  const current = () => currentSession() && version === dashboardRequestVersion && month === $('monthRef').value;
  const timeout = setTimeout(() => controller.abort(), 20000); setStatus('A consultar os dados…', 'loading');
  try {
    const response = await fetch(API + '/dashboard/admin?monthRef=' + encodeURIComponent(month), { headers: getAuthHeaders(), cache: 'no-store', signal: controller.signal });
    if (!current()) return false;
    if (!response.ok) throw Error(response.status === 403 ? 'Sem permissão para consultar o resumo.' : 'Não foi possível confirmar os dados.');
    const data = await response.json(); if (!current()) return false;
    renderOperationalIntelligence(data, month);
    setStatus(validExternalInvoiceSummary(data.summary) ? 'Resumo Operacional online' : 'Resumo carregado; faturação externa indisponível', 'ready'); return true;
  } catch (error) {
    if (!current()) return false;
    clearDashboard('Resumo indisponível. Use Atualizar para voltar a consultar.'); setStatus('Não foi possível confirmar os dados. Os valores estão indisponíveis.', 'error'); return false;
  } finally { clearTimeout(timeout); }
}
function renderTimeline() {
  const box = $('timelineFeed'); box.replaceChildren();
  if (!timelineItems.length) { box.append(node('p', 'Sem eventos recebidos nesta página.')); return; }
  for (const item of timelineItems) {
    const row = node('div', null, 'timeline-item'); row.append(node('b', item.title), node('p', item.message), node('div', item.at.toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' }), 'timeline-time')); box.append(row);
  }
}
function addTimeline(title, message) {
  if (!currentSession()) return; timelineItems.unshift({ title, message: typeof message === 'string' ? message : 'Evento recebido', at: new Date() }); timelineItems = timelineItems.slice(0, 20); renderTimeline();
}
async function loadLiveMap() {
  if (!currentSession()) return;
  if (!liveMap) { setText('mapStatus', 'Mapa não disponível nesta página. Use o botão Mapa para consultar as posições.'); $('liveMap').hidden = true; return; }
  clearMap('A consultar posições…'); const version = mapVersion, controller = new AbortController(); mapController = controller;
  if (!navigator.onLine) { setText('mapStatus', 'Sem ligação para confirmar posições.'); return; }
  const current = () => currentSession() && version === mapVersion;
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(API + '/gps/live', { headers: getAuthHeaders(), cache: 'no-store', signal: controller.signal });
    if (!current()) return; if (!response.ok) throw Error('GPS unavailable');
    const rows = await response.json(); if (!current()) return; if (!Array.isArray(rows)) throw Error('GPS incompatible');
    const bounds = [];
    for (const row of rows) {
      if (!row || typeof row.latitude !== 'number' || typeof row.longitude !== 'number' || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude) || Math.abs(row.latitude) > 90 || Math.abs(row.longitude) > 180) continue;
      const popup = node('div'); popup.append(node('b', row.name || 'Técnico'), node('p', 'Registo: ' + (row.updatedAt ? new Date(row.updatedAt).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' }) : 'Data indisponível')));
      const point = [row.latitude, row.longitude]; liveMarkers.push(L.marker(point).addTo(liveMap).bindPopup(popup)); bounds.push(point);
    }
    setText('liveTechnicians', bounds.length); setText('mapStatus', 'Posições recebidas; consulte a data de cada registo.');
    if (bounds.length) liveMap.fitBounds(bounds, { padding: [40, 40] });
  } catch (_) { if (current()) clearMap('Posições indisponíveis. Abra o mapa para voltar a consultar.'); }
  finally { clearTimeout(timeout); }
}
function initLiveMap() {
  if (typeof L === 'undefined') { void loadLiveMap(); return; }
  $('liveMap').hidden = false;
  liveMap = L.map('liveMap').setView([37.136, -8.67], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OpenStreetMap' }).addTo(liveMap); void loadLiveMap();
}
function bindRealtime() {
  adminSocket?.on('gps-update', () => { if (currentSession()) void loadLiveMap(); });
  adminSocket?.on('new-notification', data => { if (!currentSession()) return; addTimeline('Notificação recebida', data?.message); void loadDashboard(); });
  adminSocket?.on('newMessage', data => { if (currentSession()) addTimeline('Mensagem recebida', data?.message); });
}
function monthChanged() {
  if (!currentSession()) return; cancelDashboard(); clearDashboard('Atualize para consultar o mês escolhido.'); setStatus('Mês alterado. Use Atualizar.', 'changed');
}
window.addEventListener('storage', event => {
  if (event.key !== null && !authKeys.includes(event.key)) return;
  if (event.key === null || event.oldValue !== event.newValue || dashboardSession() !== dashboardOwner) { invalidateSession(); return; }
  cancelDashboard(); clearDashboard('Sessão alterada. Atualize o resumo.'); setStatus('Sessão alterada. Atualize o resumo.', 'changed');
});
window.addEventListener('offline', () => { if (currentSession()) { cancelDashboard(); clearDashboard('Sem ligação para confirmar os dados.'); clearMap('Sem ligação para confirmar posições.'); setStatus('Sem ligação.', 'offline'); } });
window.addEventListener('online', () => { if (currentSession()) { void loadDashboard(); void loadLiveMap(); } });
window.addEventListener('pagehide', () => { invalidateSession(); intervals.forEach(clearInterval); });
if ($('monthRef')) $('monthRef').value = getCurrentMonthRef();
window.addEventListener('load', () => {
  if (!currentSession()) return;
  $('dashboardQuery').addEventListener('submit', async event => { event.preventDefault(); if (await loadDashboard()) addTimeline('Consulta confirmada', 'Período ' + $('monthRef').value); void loadLiveMap(); });
  $('monthRef').addEventListener('input', monthChanged); $('logoutBtn').addEventListener('click', adminLogout);
  for (const [id, href] of [['liveMapBtn', '/admin-live-map'], ['visitsBtn', '/admin-visits-dashboard'], ['roundsBtn', '/admin-rounds'], ['notificationsBtn', '/admin-notifications']]) $(id).addEventListener('click', () => { window.location.href = href; });
  renderTimeline(); bindRealtime(); void loadDashboard(); initLiveMap();
  intervals = [setInterval(loadLiveMap, 30000), setInterval(loadDashboard, 60000), setInterval(currentSession, 1000)];
});
