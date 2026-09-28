(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const authKeys = ['token', 'cristalwater_jwt', 'adminToken', 'user', 'cristalwater_user'];
  const fingerprint = () => JSON.stringify(authKeys.map(key => localStorage.getItem(key)));
  const owner = fingerprint(), token = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token');
  const money = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
  const monthPattern = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/;
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const amount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  let generation = 0, controller, invalidated = false, loading = false;

  function textElement(tag, text) {
    const element = document.createElement(tag);
    element.textContent = String(text);
    return element;
  }
  function status(message, state) {
    $('status').textContent = message; $('status').dataset.state = state;
    $('results').setAttribute('aria-busy', String(loading));
    $('refreshBtn').disabled = invalidated || !navigator.onLine;
    $('refreshBtn').setAttribute('aria-busy', String(loading));
    $('monthRef').disabled = invalidated;
  }
  function clear(message) {
    for (const id of ['totalClients', 'totalPools', 'zoneCount', 'monthOpen']) $(id).textContent = '—';
    $('results').removeAttribute('data-month'); $('loadedMonth').textContent = 'Período ainda não confirmado.';
    for (const id of ['zonesTable', 'debtorsTable']) $(id).replaceChildren(textElement('p', message));
  }
  function cancelRead() {
    generation++; controller?.abort(); controller = null; loading = false;
  }
  function invalidateSession() {
    if (invalidated) return;
    invalidated = true; cancelRead(); clear('A informação da sessão anterior foi retirada.');
    status('A sessão mudou. Volte a abrir esta página com a conta pretendida.', 'session');
  }
  function sameSession() {
    if (invalidated) return false;
    if (!token || fingerprint() !== owner) { invalidateSession(); return false; }
    return true;
  }
  function validPacket(data, month) {
    const summary = data?.summary;
    if (data?.ok !== true || data.monthRef !== month || !summary ||
        !count(summary.totalClients) || !count(summary.totalPools) || !amount(summary.monthOpen) ||
        !Array.isArray(data.poolsByZone) || !Array.isArray(data.topDebtors) || data.topDebtors.length > 15) return false;
    const zones = data.poolsByZone;
    if (!zones.every(row => row && typeof row.zone === 'string' && row.zone.length > 0 && count(row.count) && row.count > 0) ||
        new Set(zones.map(row => row.zone)).size !== zones.length ||
        zones.reduce((sum, row) => sum + row.count, 0) !== summary.totalPools) return false;
    const debts = data.topDebtors;
    return debts.every(row => row && Number.isSafeInteger(row.invoiceId) && row.invoiceId > 0 &&
      typeof row.clientName === 'string' && typeof row.status === 'string' && typeof row.monthRef === 'string' &&
      amount(row.total) && amount(row.amountOpen) && row.amountOpen > 0) &&
      new Set(debts.map(row => row.invoiceId)).size === debts.length;
  }
  function table(target, headers, rows, emptyMessage) {
    if (!rows.length) { $(target).replaceChildren(textElement('p', emptyMessage)); return; }
    const result = document.createElement('table'), head = document.createElement('thead'), heading = document.createElement('tr');
    for (const label of headers) {
      const cell = textElement('th', label); cell.scope = 'col'; heading.append(cell);
    }
    head.append(heading);
    const body = document.createElement('tbody');
    for (const values of rows) {
      const row = document.createElement('tr');
      values.forEach(value => row.append(textElement('td', value)));
      body.append(row);
    }
    result.append(head, body); $(target).replaceChildren(result);
  }
  function render(data, month) {
    $('totalClients').textContent = data.summary.totalClients;
    $('totalPools').textContent = data.summary.totalPools;
    $('zoneCount').textContent = data.poolsByZone.length;
    $('monthOpen').textContent = money.format(data.summary.monthOpen);
    $('loadedMonth').textContent = 'Saldo dos documentos do período ' + month + '.';
    table('zonesTable', ['Zona/localização', 'Total'], data.poolsByZone.map(row => [row.zone, row.count]), 'Sem instalações registadas por zona.');
    table('debtorsTable', ['Documento', 'Cliente', 'Período original', 'Estado original', 'Por receber', 'Total'],
      data.topDebtors.map(row => ['#' + row.invoiceId, row.clientName, row.monthRef, row.status, money.format(row.amountOpen), money.format(row.total)]),
      'Sem documentos com saldo por receber na consulta.');
    $('results').dataset.month = month;
  }
  async function loadOperational() {
    if (!sameSession()) return false;
    cancelRead();
    const month = $('monthRef').value, request = generation;
    clear('Os dados desta consulta ainda não foram confirmados.');
    if (!monthPattern.test(month)) {
      status('Escolha um mês válido antes de atualizar.', 'invalid'); return false;
    }
    if (!navigator.onLine) {
      status('Sem ligação. Ligue-se à rede para confirmar os dados.', 'offline'); return false;
    }
    const activeController = new AbortController(); controller = activeController; loading = true;
    status('A consultar o período ' + month + '…', 'loading');
    const current = () => sameSession() && request === generation && $('monthRef').value === month;
    try {
      const response = await fetch('/api/dashboard/admin?monthRef=' + encodeURIComponent(month), {
        headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: activeController.signal,
      });
      if (!current()) return false;
      if (!response.ok) throw Object.assign(Error('unavailable'), { status: response.status });
      const data = await response.json();
      if (!current()) return false;
      if (!validPacket(data, month)) throw Error('incomplete or incompatible response');
      render(data, month); loading = false;
      status('Consulta confirmada para ' + month + '. Cadastro e documentos globais conforme indicado abaixo.', 'ready');
      return true;
    } catch (error) {
      if (!current()) return false;
      clear('Informação indisponível. Use Atualizar para voltar a consultar.'); loading = false;
      status(error.status === 403 ? 'Sem permissão para consultar o dashboard.' :
        error.status === 401 ? 'Sessão inválida. Volte a entrar.' :
          'Não foi possível confirmar os dados. Os valores estão indisponíveis, não são zero.', 'error');
      return false;
    } finally {
      if (request === generation) { loading = false; $('results').setAttribute('aria-busy', 'false'); $('refreshBtn').setAttribute('aria-busy', 'false'); }
    }
  }
  function monthChanged() {
    if (!sameSession()) return;
    cancelRead(); clear('Atualize para consultar o mês escolhido.');
    status(navigator.onLine ? 'O mês mudou. Use Atualizar para consultar os dados.' : 'Sem ligação. Os dados não foram confirmados.', navigator.onLine ? 'changed' : 'offline');
  }
  $('queryForm').addEventListener('submit', event => { event.preventDefault(); void loadOperational(); });
  $('monthRef').addEventListener('input', monthChanged);
  window.addEventListener('storage', event => {
    if (event.key === null || (authKeys.includes(event.key) && event.oldValue !== event.newValue)) invalidateSession();
  });
  window.addEventListener('offline', () => {
    if (!sameSession()) return;
    cancelRead(); clear('Sem ligação. Os dados não foram confirmados.'); status('Ligue-se à rede para voltar a consultar.', 'offline');
  });
  window.addEventListener('online', () => { if (sameSession()) void loadOperational(); });
  const timer = setInterval(sameSession, 1000);
  window.addEventListener('pagehide', () => { invalidateSession(); clearInterval(timer); });

  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  $('monthRef').value = parts.find(part => part.type === 'year').value + '-' + parts.find(part => part.type === 'month').value;
  window.loadOperational = loadOperational;
  // Shared navigation restores the selected month on DOMContentLoaded. Start
  // after that restoration so the request and the visible period always agree.
  if (document.readyState === 'complete') void loadOperational();
  else window.addEventListener('pageshow', () => { void loadOperational(); }, { once: true });
})();
