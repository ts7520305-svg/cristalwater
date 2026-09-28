'use strict';
const API = '/api';
const dashboardAuthKeys = ['token', 'cristalwater_jwt', 'adminToken', 'authToken', 'cwAdminToken', 'user', 'cristalwater_user'];
const dashboardFingerprint = () => JSON.stringify(dashboardAuthKeys.map(key => localStorage.getItem(key)));
const dashboardOwner = dashboardFingerprint();
const dashboardToken = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
const monthPattern = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/;
const count = value => Number.isSafeInteger(value) && value >= 0;
const amount = value => typeof value === 'number' && Number.isFinite(value);
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const $ = id => document.getElementById(id);
let dashboardGeneration = 0, dashboardController, dashboardInvalidated = false;

function formatMoney(value) { return amount(value) ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value) : '—'; }
function setText(id, value) { if ($(id)) $(id).textContent = value; }
function node(tag, text, className) {
  const el = document.createElement(tag); if (text != null) el.textContent = String(text); if (className) el.className = className; return el;
}
function link(href, text) { const el = node('a', text, 'btn'); el.href = href; return el; }
function getMonthRef() { return $('monthRef')?.value || ''; }
function currentMonthRef() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return parts.find(part => part.type === 'year').value + '-' + parts.find(part => part.type === 'month').value;
}
function status(message, state) {
  setText('dashboardStatus', message); $('dashboardStatus').dataset.state = state;
  $('dashboardResults').setAttribute('aria-busy', String(state === 'loading'));
  $('refreshBtn').disabled = dashboardInvalidated || !navigator.onLine;
  $('monthRef').disabled = dashboardInvalidated;
}
function clearDashboard(message) {
  for (const id of ['totalClients', 'totalPools', 'monthBilled', 'monthPaid', 'monthOpen', 'creditBalance', 'openAlerts', 'visitsThisMonth']) setText(id, '—');
  for (const id of ['clientsSub', 'monthlyPotential', 'receivedPercent', 'clientsWithCredit', 'visitsSub', 'alertScope']) setText(id, 'Por confirmar');
  setText('dashboardScope', 'Período ainda não confirmado.'); $('dashboardResults').removeAttribute('data-month');
  for (const id of ['topDebtorsTable', 'latestPayments', 'poolsByZone', 'alertsList', 'monthlyEvolution', 'financialDistribution']) $(id).replaceChildren(node('p', message));
}
function cancelDashboardRead() { dashboardGeneration++; dashboardController?.abort(); dashboardController = null; }
function invalidateDashboardSession() {
  if (dashboardInvalidated) return;
  dashboardInvalidated = true; cancelDashboardRead(); clearDashboard('A informação da sessão anterior foi retirada.');
  status('A sessão mudou. Volte a abrir esta página com a conta pretendida.', 'session');
}
function sameDashboardSession() {
  if (dashboardInvalidated) return false;
  if (!dashboardToken || dashboardFingerprint() !== dashboardOwner) { invalidateDashboardSession(); return false; }
  return true;
}
function buildLegacyDashboardView(data, month) {
  const s = data?.summary;
  const counts = ['totalClients', 'totalPools', 'openAlerts', 'visitsThisMonth', 'visitsDoneThisMonth', 'visitsPlannedThisMonth', 'visitsNotDoneThisMonth'];
  if (!monthPattern.test(month) || data?.ok !== true || data.monthRef !== month || !s || !counts.every(key => count(s[key]))
      || !['monthBilled', 'monthPaid', 'monthOpen'].every(key => amount(s[key]))
      || !['visits', 'alerts', 'poolsByZone', 'topDebtors', 'latestPayments', 'monthlyEvolution'].every(key => Array.isArray(data[key]))) return null;
  const otherVisits = s.visitsThisMonth - s.visitsDoneThisMonth - s.visitsPlannedThisMonth - s.visitsNotDoneThisMonth;
  const unique = (rows, key) => new Set(rows.map(row => row[key])).size === rows.length;
  if (otherVisits < 0 || data.visits.length !== s.visitsThisMonth || !data.visits.every(row => row && positiveId(row.id)) || !unique(data.visits, 'id')
      || data.alerts.length !== s.openAlerts || !data.alerts.every(row => row && typeof row.id === 'string' && typeof row.message === 'string' && ['technical', 'notification', 'visit'].includes(row.source)) || !unique(data.alerts, 'id')
      || !data.poolsByZone.every(row => row && typeof row.zone === 'string' && row.zone.length > 0 && count(row.count) && row.count > 0) || !unique(data.poolsByZone, 'zone')
      || data.poolsByZone.reduce((sum, row) => sum + row.count, 0) !== s.totalPools
      || data.topDebtors.length > 15 || !data.topDebtors.every(row => row && positiveId(row.invoiceId) && positiveId(row.clientId) && typeof row.clientName === 'string' && typeof row.monthRef === 'string' && amount(row.amountOpen) && row.amountOpen > 0) || !unique(data.topDebtors, 'invoiceId')
      || data.latestPayments.length > 15 || !data.latestPayments.every(row => row && positiveId(row.paymentId) && typeof row.clientName === 'string' && typeof row.method === 'string' && amount(row.amount) && typeof row.paidAt === 'string' && Number.isFinite(Date.parse(row.paidAt))) || !unique(data.latestPayments, 'paymentId')
      || !data.monthlyEvolution.every(row => row && monthPattern.test(row.month) && ['billed', 'paid', 'open'].every(key => amount(row[key]))) || !unique(data.monthlyEvolution, 'month')) return null;
  // Complete totals are available only with mutually consistent source counts.
  // Without that contract, retain the known preview and leave the total unknown.
  const coverage = data.alertCoverage;
  if (coverage !== undefined) {
    if (!coverage || coverage.scope !== 'DASHBOARD_ALERT_SOURCES_ALL_PERIODS' || coverage.totalsComplete !== true || coverage.limitPerSource !== 200
        || !count(coverage.total) || !count(coverage.returned) || coverage.returned !== data.alerts.length || coverage.total < coverage.returned
        || coverage.truncated !== (coverage.total > coverage.returned) || !coverage.sources) return null;
    let total = 0, returned = 0;
    for (const source of ['technical', 'notification', 'visit']) {
      const entry = coverage.sources[source];
      if (!entry || !count(entry.total) || !count(entry.returned) || entry.returned !== Math.min(entry.total, 200) || data.alerts.filter(row => row.source === source).length !== entry.returned) return null;
      total += entry.total; returned += entry.returned;
    }
    if (!count(total) || total !== coverage.total || returned !== coverage.returned) return null;
  }
  return { data, summary: s, month, otherVisits, coverage };
}
function smallCards(target, rows, emptyMessage) {
  $(target).replaceChildren(...(rows.length ? rows.map(([title, ...lines]) => {
    const card = node('div', null, 'small-card'); card.append(node('strong', title));
    for (const line of lines) card.append(node('p', line)); return card;
  }) : [node('p', emptyMessage)]));
}
function renderTopDebtors(rows) {
  if (!rows.length) { $('topDebtorsTable').replaceChildren(node('p', 'Sem documentos com saldo na consulta.')); return; }
  const table = node('table', null, 'table'), head = node('thead'), header = node('tr'), body = node('tbody');
  for (const title of ['Documento / cliente', 'Por receber', 'Consultar']) { const cell = node('th', title); cell.scope = 'col'; header.append(cell); }
  head.append(header);
  for (const row of rows) {
    const tr = node('tr'), identity = node('td'), actions = node('td');
    identity.append(node('strong', '#' + row.invoiceId + ' · ' + row.clientName), node('p', 'Período original: ' + row.monthRef));
    actions.append(link('/admin-clients?clientId=' + row.clientId, 'Cliente'), link('/billing', 'Cobranças'));
    tr.append(identity, node('td', formatMoney(row.amountOpen)), actions); body.append(tr);
  }
  table.append(head, body); $('topDebtorsTable').replaceChildren(table);
}
function renderLegacyDashboard(view) {
  const { data, summary: s, month, otherVisits, coverage } = view;
  setText('totalClients', s.totalClients); setText('clientsSub', 'Cadastro atual, incluindo inativos');
  setText('totalPools', s.totalPools); setText('monthlyPotential', 'Instalações registadas, incluindo inativas');
  setText('monthBilled', formatMoney(s.monthBilled)); setText('monthPaid', formatMoney(s.monthPaid)); setText('monthOpen', formatMoney(s.monthOpen));
  setText('receivedPercent', 'Pagamentos pela data de recebimento');
  setText('creditBalance', '—'); setText('clientsWithCredit', 'Crédito não apurado nesta consulta');
  setText('visitsThisMonth', s.visitsThisMonth);
  setText('visitsSub', `${s.visitsDoneThisMonth} concluídas · ${s.visitsPlannedThisMonth} planeadas / em curso · ${s.visitsNotDoneThisMonth} não realizadas / impedidas · ${otherVisits} noutros estados`);
  setText('openAlerts', coverage?.total ?? '—');
  setText('alertScope', coverage ? `${coverage.returned} de ${coverage.total} registos carregados. ${coverage.truncated ? 'Pré-visualização parcial. ' : ''}Três fontes · todos os períodos.` : `Total por confirmar; ${data.alerts.length} registos carregados.`);
  setText('dashboardScope', 'Mês ' + month + ': visitas e documentos do período; pagamentos pela data de recebimento. Cadastro, crédito por confirmar e alertas têm os âmbitos indicados nos cartões.');
  smallCards('monthlyEvolution', data.monthlyEvolution.map(row => [row.month, 'Documentos: ' + formatMoney(row.billed), 'Pagamentos: ' + formatMoney(row.paid), 'Saldo dos documentos: ' + formatMoney(row.open)]), 'Sem períodos na consulta.');
  smallCards('financialDistribution', [['Documentos do período', formatMoney(s.monthBilled)], ['Pagamentos no período', formatMoney(s.monthPaid)], ['Saldo dos documentos', formatMoney(s.monthOpen)]], 'Sem valores confirmados.');
  renderTopDebtors(data.topDebtors);
  smallCards('latestPayments', data.latestPayments.map(row => [row.clientName, formatMoney(row.amount) + ' · ' + row.method, new Date(row.paidAt).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })]), 'Sem pagamentos na consulta.');
  smallCards('poolsByZone', data.poolsByZone.map(row => [row.zone, row.count + ' instalações registadas']), 'Sem zonas na consulta.');
  smallCards('alertsList', data.alerts.map(row => [row.type || 'Alerta', row.message, row.client?.name || row.pool?.client?.name || 'Cliente por identificar', row.status || 'Estado por confirmar']), coverage ? 'Sem alertas nas três fontes consultadas.' : 'Sem alertas carregados; total por confirmar.');
  data.alerts.forEach((row, index) => {
    if (positiveId(row.clientId)) $('alertsList').children[index].append(link('/admin-clients?clientId=' + row.clientId, 'Abrir cliente'));
    else if (positiveId(row.poolId)) $('alertsList').children[index].append(link('/admin-pool-technical?poolId=' + row.poolId, 'Abrir ficha'));
  });
  $('dashboardResults').dataset.month = month;
}
async function loadDashboard() {
  if (!sameDashboardSession()) return false;
  cancelDashboardRead(); const month = getMonthRef(), request = dashboardGeneration;
  clearDashboard('Os dados desta consulta ainda não foram confirmados.');
  if (!monthPattern.test(month)) { status('Escolha um mês válido antes de atualizar.', 'invalid'); return false; }
  if (!navigator.onLine) { status('Sem ligação. Ligue-se à rede para confirmar os dados.', 'offline'); return false; }
  const controller = new AbortController(); dashboardController = controller;
  const current = () => sameDashboardSession() && request === dashboardGeneration && getMonthRef() === month;
  const timeout = setTimeout(() => {
    if (!current()) return;
    cancelDashboardRead(); clearDashboard('A consulta demorou demasiado. Use Atualizar para tentar de novo.'); status('Tempo de consulta excedido.', 'error');
  }, 15000);
  status('A consultar o mês ' + month + '…', 'loading');
  try {
    const response = await fetch(API + '/dashboard/admin?monthRef=' + encodeURIComponent(month), { headers: { Authorization: 'Bearer ' + dashboardToken }, cache: 'no-store', signal: controller.signal });
    if (!current()) return false;
    if (!response.ok) throw Object.assign(Error('unavailable'), { status: response.status });
    const data = await response.json(); if (!current()) return false;
    const view = buildLegacyDashboardView(data, month); if (!view) throw Error('Incomplete or incompatible response');
    renderLegacyDashboard(view); status('Consulta confirmada · ' + month, 'ready'); return true;
  } catch (error) {
    if (!current()) return false;
    clearDashboard('Informação indisponível. Use Atualizar para consultar novamente.');
    status(error.status === 401 ? 'Sessão inválida. Volte a entrar.' : error.status === 403 ? 'Sem permissão para consultar o dashboard.' : 'Não foi possível confirmar os dados.', 'error');
    return false;
  } finally { clearTimeout(timeout); }
}
function monthChanged() {
  if (!sameDashboardSession()) return;
  cancelDashboardRead(); clearDashboard('Atualize para consultar o mês escolhido.');
  status(navigator.onLine ? 'O mês mudou. Use Atualizar para confirmar os dados.' : 'Sem ligação.', navigator.onLine ? 'changed' : 'offline');
}
if ($('monthRef')) $('monthRef').value = currentMonthRef();
window.addEventListener('DOMContentLoaded', () => {
  $('queryForm').addEventListener('submit', event => { event.preventDefault(); void loadDashboard(); });
  $('monthRef').addEventListener('input', monthChanged);
  $('monthRef').addEventListener('change', monthChanged);
});
// The common navigation restores the saved month at DOMContentLoaded.
window.addEventListener('pageshow', event => { if (event.persisted) invalidateDashboardSession(); else void loadDashboard(); });
window.addEventListener('storage', event => { if (event.key === null || (dashboardAuthKeys.includes(event.key) && event.oldValue !== event.newValue)) invalidateDashboardSession(); });
window.addEventListener('offline', () => { if (sameDashboardSession()) { cancelDashboardRead(); clearDashboard('Sem ligação. Os dados não foram confirmados.'); status('Ligue-se à rede para voltar a consultar.', 'offline'); } });
window.addEventListener('online', () => { if (sameDashboardSession()) void loadDashboard(); });
const dashboardSessionTimer = setInterval(sameDashboardSession, 1000);
window.addEventListener('pagehide', () => { invalidateDashboardSession(); clearInterval(dashboardSessionTimer); });
