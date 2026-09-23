(function () {
  'use strict';
  const types = ['REGULAR', 'EXTRA', 'MAINTENANCE_EQUIPMENT', 'MAINTENANCE_REMINDER', 'REPAIR'];
  const count = n => Number.isSafeInteger(n) && n >= 0, id = n => count(n) && n > 0;
  const month = s => typeof s === 'string' && /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(s);
  const date = s => typeof s === 'string' && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
  const day = s => typeof s === 'string' && month(s.slice(0, 7)) && date(s + 'T00:00:00.000Z');
  const fail = () => { throw Error('Valores por execução não confirmados. Volte a consultar.'); };
  const add = values => { const n = values.reduce((a, b) => a + b, 0); if (!count(n)) fail(); return n; };
  const revFields = ['sourceCount', 'confirmedCount', 'pendingCount', 'grossAmountCents', 'confirmedGrossAmountCents', 'confirmedReductionAmountCents', 'confirmedNetAmountCents', 'pendingGrossAmountCents'];
  const costFields = ['sourceCount', 'confirmedCount', 'reviewCount', 'periodMismatchCount', 'periodMismatchAmountCents', 'materialAmountCents', 'laborAmountCents', 'otherAmountCents', 'purchaseAmountCents', 'knownCostCount', 'knownCostAmountCents', 'confirmedAllocatedAmountCents'];
  const reviewFields = ['documentReviewCount', 'lineReviewCount', 'repairExecutionReviewCount', 'monthlyAllocationReviewCount', 'creditAllocationReviewCount', 'costAllocationReviewCount', 'costUnplacedCount', 'costPeriodMismatchCount', 'nonServiceCostAllocationCount'];
  function validateRevenue(r) {
    if (!r || !revFields.every(k => count(r[k])) || r.sourceCount !== r.confirmedCount + r.pendingCount || r.grossAmountCents !== r.confirmedGrossAmountCents + r.pendingGrossAmountCents || r.confirmedGrossAmountCents !== r.confirmedNetAmountCents + r.confirmedReductionAmountCents || (!r.confirmedCount && r.confirmedGrossAmountCents !== 0) || (!r.pendingCount && r.pendingGrossAmountCents !== 0)) fail();
  }
  function validateCosts(c) {
    if (!c || !costFields.every(k => count(c[k])) || c.sourceCount !== c.confirmedCount + c.reviewCount + c.periodMismatchCount || c.knownCostCount > c.confirmedCount || c.knownCostAmountCents !== add([c.materialAmountCents, c.laborAmountCents, c.otherAmountCents]) || c.confirmedAllocatedAmountCents !== c.knownCostAmountCents + c.purchaseAmountCents || (!c.periodMismatchCount && c.periodMismatchAmountCents !== 0) || (!c.knownCostCount && c.knownCostAmountCents !== 0) || (!c.confirmedCount && c.confirmedAllocatedAmountCents !== 0)) fail();
  }
  function sourceIdentity(r, identity) { if (!r || !types.includes(r.serviceType) || !id(r.serviceId) || !id(r.clientId) || identity && ['serviceType', 'serviceId', 'clientId'].some(k => r[k] !== identity[k])) fail(); }
  function revenueSource(r, m, identity) {
    sourceIdentity(r, identity);
    if (!r || !['LINE', 'MONTHLY_ALLOCATION'].includes(r.kind) || !['targetId', 'lineId', 'invoiceId'].every(k => id(r[k])) || r.kind === 'LINE' && r.targetId !== r.lineId || !month(r.documentMonth) || r.serviceMonth !== m || typeof r.label !== 'string' || !id(r.grossAmountCents) || !count(r.reductionAmountCents) || r.reductionAmountCents > r.grossAmountCents || !['CONFIRMED', 'CREDIT_PENDING', 'CREDIT_REVIEW'].includes(r.state) || r.confirmed !== (r.state === 'CONFIRMED') || r.netAmountCents !== (r.confirmed ? r.grossAmountCents - r.reductionAmountCents : null)) fail();
  }
  function costSource(c, m, identity) {
    sourceIdentity(c, identity);
    if (!c || !id(c.id) || !id(c.expenseId) || typeof c.label !== 'string' || typeof c.documentNumber !== 'string' || typeof c.reason !== 'string' || !day(c.expenseDate) || !month(c.allocationMonth) || c.serviceMonth !== m || !id(c.amountCents) || !['MATERIAL', 'LABOR', 'PURCHASE', 'OTHER'].includes(c.kind) || !['CONFIRMED', 'REVIEW', 'PERIOD_MISMATCH'].includes(c.state) || c.state === 'CONFIRMED' && c.allocationMonth !== m || c.state === 'PERIOD_MISMATCH' && c.allocationMonth === m) fail();
  }
  function sample(s, expected, check, identity) {
    if (!s || !count(s.total) || s.total !== expected || s.limit !== 10 || s.sampleOnly !== (s.total > 10) || !Array.isArray(s.rows) || s.rows.length !== Math.min(s.total, 10)) fail();
    s.rows.forEach(check); if (new Set(s.rows.map(identity)).size !== s.rows.length) fail();
  }
  function compare(aggregate, sums, fields, full) {
    for (const k of fields) { const n = add(sums.map(s => s[k])); if (full ? aggregate[k] !== n : aggregate[k] < n) fail(); }
  }
  function revenueSums(rows) {
    const confirmed = rows.filter(r => r.confirmed);
    const sum = (rs, k) => add(rs.map(r => r[k]));
    return { sourceCount: rows.length, confirmedCount: confirmed.length, pendingCount: rows.length - confirmed.length, grossAmountCents: sum(rows, 'grossAmountCents'), confirmedGrossAmountCents: sum(confirmed, 'grossAmountCents'), confirmedReductionAmountCents: sum(confirmed, 'reductionAmountCents'), confirmedNetAmountCents: sum(confirmed, 'netAmountCents'), pendingGrossAmountCents: sum(rows.filter(r => !r.confirmed), 'grossAmountCents') };
  }
  function costSums(rows) {
    const confirmed = rows.filter(r => r.state === 'CONFIRMED'), mismatch = rows.filter(r => r.state === 'PERIOD_MISMATCH');
    const sum = rs => add(rs.map(r => r.amountCents));
    const c = { sourceCount: rows.length, confirmedCount: confirmed.length, reviewCount: rows.filter(r => r.state === 'REVIEW').length, periodMismatchCount: mismatch.length, periodMismatchAmountCents: sum(mismatch), knownCostCount: confirmed.filter(r => r.kind !== 'PURCHASE').length, knownCostAmountCents: sum(confirmed.filter(r => r.kind !== 'PURCHASE')), confirmedAllocatedAmountCents: sum(confirmed) };
    for (const [kind, name] of [['MATERIAL', 'material'], ['LABOR', 'labor'], ['OTHER', 'other'], ['PURCHASE', 'purchase']]) c[name + 'AmountCents'] = sum(confirmed.filter(r => r.kind === kind));
    return c;
  }
  function service(s, m) {
    if (!s || !types.includes(s.serviceType) || !id(s.serviceId) || !id(s.clientId) || s.key !== s.serviceType + ':' + s.serviceId + ':' + s.clientId || typeof s.clientName !== 'string' || typeof s.label !== 'string' || s.serviceMonth !== m || s.completeRevenue !== false || s.completeOperatingCosts !== false || s.profit !== null) fail();
    validateRevenue(s.revenue); validateCosts(s.costs);
    const r = s.revenue, c = s.costs;
    if (r.state !== (!r.sourceCount ? 'MISSING' : r.pendingCount ? 'PENDING' : 'CONFIRMED') || r.netAmountCents !== (r.sourceCount && !r.pendingCount ? r.confirmedNetAmountCents : null) || !count(c.unplacedCount) || c.amountCents !== (c.knownCostCount && !c.reviewCount && !c.periodMismatchCount && !c.unplacedCount ? c.knownCostAmountCents : null)) fail();
    sample(s.revenueSources, r.sourceCount, row => revenueSource(row, m, s), row => row.kind + ':' + row.targetId);
    sample(s.costSources, c.sourceCount, row => costSource(row, m, s), row => row.id);
    compare(r, [revenueSums(s.revenueSources.rows)], revFields, !s.revenueSources.sampleOnly);
    compare(c, [costSums(s.costSources.rows)], costFields, !s.costSources.sampleOnly);
  }
  function validate(s, m, generatedAt) {
    if (!s || s.version !== 1 || s.monthRef !== m || !month(m) || s.currency !== 'EUR' || !date(s.generatedAt) || generatedAt && s.generatedAt !== generatedAt || !['PARTIAL', 'REVIEW'].includes(s.state) || s.completeRevenue !== false || s.completeOperatingCosts !== false || s.profit !== null || s.limitApplied !== null || s.basis?.services !== 'SERVICES_WITH_ELIGIBLE_REVENUE_OR_EXPENSE_ATTRIBUTION' || s.basis.period !== 'CONFIRMED_SERVICE_EXECUTION_MONTH_UTC' || s.basis.revenue !== 'CURRENT_DOCUMENT_VALUES_ALL_DOCUMENT_MONTHS' || s.basis.costs !== 'EXPLICIT_ATTRIBUTION_MATCHING_EXECUTION_MONTH' || s.basis.stock !== 'PURCHASE_ATTRIBUTION_SEPARATE_FROM_MEASURED_CONSUMPTION' || s.basis.cashIncluded !== false || s.basis.historicalClosingBalance !== false || !['serviceCount', 'clientCount', 'servicesWithoutRevenueCount', 'servicesWithoutKnownCostCount'].every(k => count(s[k])) || s.clientCount > s.serviceCount || s.servicesWithoutRevenueCount > s.serviceCount || s.servicesWithoutKnownCostCount > s.serviceCount) fail();
    validateRevenue(s.revenue); validateCosts(s.costs);
    if (!s.allMonths || !reviewFields.every(k => count(s.allMonths[k])) || s.state !== (reviewFields.some(k => k !== 'nonServiceCostAllocationCount' && s.allMonths[k] > 0) ? 'REVIEW' : 'PARTIAL') || s.allMonths.costPeriodMismatchCount < s.costs.periodMismatchCount || s.allMonths.costAllocationReviewCount < s.costs.reviewCount) fail();
    sample(s.services, s.serviceCount, row => service(row, m), row => row.key);
    compare(s.revenue, s.services.rows.map(r => r.revenue), revFields, !s.services.sampleOnly);
    compare(s.costs, s.services.rows.map(r => r.costs), costFields, !s.services.sampleOnly);
    const derived = {clientCount: new Set(s.services.rows.map(r => r.clientId)).size, servicesWithoutRevenueCount: s.services.rows.filter(r => !r.revenue.sourceCount).length, servicesWithoutKnownCostCount: s.services.rows.filter(r => !r.costs.knownCostCount).length};
    for (const k of Object.keys(derived)) if (s.services.sampleOnly ? s[k] < derived[k] : s[k] !== derived[k]) fail();
    return s;
  }
  function response(result, selection) {
    if (!result || result.ok !== true || !result.selection || Object.keys(result.selection).length !== Object.keys(selection).length || Object.keys(selection).some(k => result.selection[k] !== selection[k]) || result.pageSize !== 10 || !count(result.total) || !Array.isArray(result.rows) || result.rows.length !== Math.max(0, Math.min(10, result.total - (selection.page - 1) * 10))) fail();
    validate(result.summary, selection.monthRef);
    if (selection.mode === 'SERVICES') {
      if (result.service !== null || result.total > result.summary.serviceCount || !selection.q && result.total !== result.summary.serviceCount) fail();
      result.rows.forEach(row => service(row, selection.monthRef)); if (new Set(result.rows.map(r => r.key)).size !== result.rows.length) fail();
      compare(result.summary.revenue, result.rows.map(r => r.revenue), revFields, !selection.q && result.total <= 10);
      compare(result.summary.costs, result.rows.map(r => r.costs), costFields, !selection.q && result.total <= 10);
    } else {
      if (result.service === null ? result.total !== 0 : result.service.key !== selection.serviceType + ':' + selection.serviceId + ':' + selection.clientId || typeof result.service.label !== 'string' || typeof result.service.clientName !== 'string') fail();
      result.rows.forEach(row => selection.mode === 'REVENUE' ? revenueSource(row, selection.monthRef, selection) : costSource(row, selection.monthRef, selection));
      if (new Set(result.rows.map(r => selection.mode === 'REVENUE' ? r.kind + ':' + r.targetId : r.id)).size !== result.rows.length) fail();
      if (result.service) service(result.service, selection.monthRef);
      const aggregate = result.service?.[selection.mode === 'REVENUE' ? 'revenue' : 'costs'];
      if (aggregate) {
        if (result.total > aggregate.sourceCount || !selection.q && result.total !== aggregate.sourceCount) fail();
        compare(aggregate, [selection.mode === 'REVENUE' ? revenueSums(result.rows) : costSums(result.rows)], selection.mode === 'REVENUE' ? revFields : costFields, !selection.q && result.total <= 10);
      }
    }
    return result;
  }
  function create(host) {
    const {el, node, money} = host;
    let epoch = 0, busy = false, blocked = true, selected = null;
    function clear() { epoch++; busy = false; selected = null; el('executionValuesPanel').hidden = true; el('executionValues').replaceChildren(); }
    function controls(disabled) {
      blocked = disabled;
      el('executionValues').querySelectorAll('button,input').forEach(n => { n.disabled = blocked || busy || n.dataset.unavailable === 'true'; });
    }
    function status(kind, text) { el('executionStatus').dataset.state = kind; el('executionStatus').textContent = text; }
    function erase() { for (const id of ['executionMetrics', 'executionBasis', 'executionRows', 'executionPagination', 'executionSourceTitle']) el(id).replaceChildren(); }
    function button(parent, text, work, unavailable = false) { const b = node(parent, 'button', text); b.type = 'button'; b.dataset.unavailable = String(unavailable); b.addEventListener('click', work); return b; }
    function draw(data) {
      erase();
      const s = data.summary, r = s.revenue, c = s.costs, all = s.allMonths;
      for (const [label, value] of [['Líquido confirmado · parcial', r.confirmedCount ? r.confirmedNetAmountCents : null], ['Bruto com reduções por confirmar', r.pendingGrossAmountCents], ['Custos conhecidos · parciais', c.knownCostCount ? c.knownCostAmountCents : null], ['Compras atribuídas · sem consumo comprovado', c.purchaseAmountCents]]) { const card = node(el('executionMetrics'), 'div', '', 'kpi'); node(card, 'span', label); node(card, 'strong', money(value)); }
      const basis = el('executionBasis');
      node(basis, 'p', `${s.serviceCount} serviços com receita elegível ou despesa atribuída, de ${s.clientCount} clientes, executados em ${s.monthRef} (UTC). Não abrange todos os serviços executados. Os totais incluem todos os registos deste conjunto, independentemente da pesquisa ou página.`);
      const limits = node(basis, 'details', ''); node(limits, 'summary', 'Como ler os valores e o que falta confirmar');
      node(limits, 'p', `Valores atuais de documentos de qualquer mês; não são recebimentos nem um fecho histórico. Bruto confirmado ${money(r.confirmedGrossAmountCents)}, menos reduções confirmadas ${money(r.confirmedReductionAmountCents)}. Custos conhecidos: materiais ${money(c.materialAmountCents)}, trabalho ${money(c.laborAmountCents)} e outros ${money(c.otherAmountCents)}. Compras de stock ficam separadas do consumo.`);
      node(limits, 'p', `Há ${s.servicesWithoutRevenueCount} serviços sem receita elegível e ${s.servicesWithoutKnownCostCount} sem custos conhecidos neste conjunto. ${c.periodMismatchCount} atribuições (${money(c.periodMismatchAmountCents)}) têm outro mês e não entram nos custos alinhados.`);
      node(limits, 'p', `Em todos os meses: ${all.documentReviewCount} documentos, ${all.lineReviewCount} linhas, ${all.repairExecutionReviewCount} confirmações de reparação, ${all.monthlyAllocationReviewCount} parcelas de mensalidades, ${all.creditAllocationReviewCount} reduções e ${all.costAllocationReviewCount} custos por rever; ${all.costUnplacedCount} custos sem período confirmável, ${all.costPeriodMismatchCount} com outro mês e ${all.nonServiceCostAllocationCount} atribuídos à empresa ou ao cliente sem serviço. Consulte despesas e documentos para rever estas origens.`);
      node(basis, 'p', 'Manutenções e reparações não herdam os custos da visita. Ausência de valor não significa zero; receitas e custos completos, lucro e margem continuam por apurar.');
      const sourceTitle = data.service ? data.service.clientName + ' · ' + data.service.label + ' · ' + (selected.mode === 'REVENUE' ? 'Origens da receita' : 'Origens dos custos') : selected.mode === 'SERVICES' ? 'Serviços do mês de execução' : 'Serviço sem origens elegíveis nesta consulta';
      el('executionSourceTitle').textContent = sourceTitle;
      for (const row of data.rows) {
        const card = node(el('executionRows'), 'article', '', 'rec');
        if (selected.mode === 'SERVICES') {
          card.dataset.serviceKey = row.key;
          node(card, 'h4', row.clientName + ' · ' + row.label);
          node(card, 'p', 'Cliente #' + row.clientId + ' · Execução ' + row.serviceMonth + ' · Receita líquida documentada: ' + money(row.revenue.netAmountCents) + ' · Custos conhecidos deste serviço: ' + money(row.costs.amountCents));
          node(card, 'p', row.revenue.pendingCount + ' origens de receita por confirmar · ' + row.costs.reviewCount + ' custos por rever · ' + row.costs.periodMismatchCount + ' atribuições com outro mês · ' + row.costs.unplacedCount + ' custos sem período confirmável. Compras atribuídas: ' + money(row.costs.purchaseAmountCents) + '. Cobertura parcial; sem margem.', 'ai-note');
          const actions = node(card, 'div', '', 'action-buttons');
          for (const [mode, label, total] of [['REVENUE', 'Ver receitas', row.revenue.sourceCount], ['COSTS', 'Ver custos', row.costs.sourceCount]]) button(actions, label + ' (' + total + ')', () => { selected = {...selected, mode, page: 1, q: '', serviceType: row.serviceType, serviceId: row.serviceId, clientId: row.clientId}; el('executionSearch').value = ''; void request(); }, !total);
        } else if (selected.mode === 'REVENUE') {
          node(card, 'h4', 'Documento #' + row.invoiceId + ' · Linha #' + row.lineId + (row.kind === 'MONTHLY_ALLOCATION' ? ' · Parcela #' + row.targetId : ''));
          node(card, 'p', row.label + ' · Mês do documento ' + row.documentMonth + ' · Execução ' + row.serviceMonth);
          node(card, 'p', 'Bruto ' + money(row.grossAmountCents) + ' · Redução confirmada ' + money(row.reductionAmountCents) + ' · Líquido ' + money(row.netAmountCents) + ' · ' + ({CONFIRMED: 'Confirmado neste registo', CREDIT_PENDING: 'Notas por repartir', CREDIT_REVIEW: 'Notas por rever'}[row.state]));
          const a = node(card, 'a', 'Abrir documentos deste cliente'); a.href = '/invoices?clientId=' + selected.clientId;
        } else {
          node(card, 'h4', 'Despesa #' + row.expenseId + ' · Atribuição #' + row.id);
          node(card, 'p', row.label + ' · ' + (row.documentNumber || 'Sem número de documento') + ' · Data ' + row.expenseDate);
          node(card, 'p', money(row.amountCents) + ' · ' + ({MATERIAL: 'Consumo valorizado', LABOR: 'Tempo valorizado', OTHER: 'Outro custo atribuído', PURCHASE: 'Compra atribuída; não comprova consumo'}[row.kind]) + ' · Atribuição ' + row.allocationMonth + ' · Execução ' + row.serviceMonth + ' · ' + ({CONFIRMED: 'Confirmado neste registo', REVIEW: 'Por rever; excluído dos custos conhecidos', PERIOD_MISMATCH: 'Mês diferente; excluído dos custos alinhados'}[row.state]));
          node(card, 'p', row.reason, 'ai-note'); const a = node(card, 'a', row.state === 'PERIOD_MISMATCH' ? 'Rever mês na despesa' : 'Abrir despesa e atribuição'); a.href = '/admin-expenses?expenseId=' + row.expenseId + '&allocationId=' + row.id;
        }
      }
      if (!data.rows.length) node(el('executionRows'), 'p', 'Sem resultados nesta página. Altere a pesquisa ou volte à lista de serviços.');
      const nav = el('executionPagination'), pages = Math.max(1, Math.ceil(data.total / 10));
      node(nav, 'span', data.total + ' resultados · Página ' + selected.page + ' de ' + pages);
      button(nav, 'Anterior', () => { selected.page--; void request(); }, selected.page <= 1);
      button(nav, 'Seguinte', () => { selected.page++; void request(); }, selected.page >= pages);
      status(s.state === 'REVIEW' ? 'review' : 'ready', 'Consulta por execução: ' + new Date(s.generatedAt).toLocaleString('pt-PT', {timeZone: 'UTC'}) + ' UTC · Cobertura parcial.');
      controls(blocked);
    }
    async function request() {
      if (blocked || busy || !selected || !host.active()) return;
      const revision = ++epoch, parentRevision = host.revision(), expected = {...selected}; busy = true; erase(); status('loading', 'A consultar as origens…'); controls(blocked);
      const query = Object.fromEntries(Object.entries(expected).filter(([, v]) => v !== null));
      try {
        const result = await host.api('execution-values?' + new URLSearchParams(query), null, parentRevision);
        if (!host.active() || revision !== epoch || parentRevision !== host.revision()) return;
        response(result, expected); busy = false; draw(result);
      } catch (error) {
        if (host.active() && revision === epoch && parentRevision === host.revision()) { busy = false; erase(); status('error', error.name === 'AbortError' ? 'A consulta demorou demasiado. Volte a pesquisar.' : 'Não foi possível confirmar esta consulta. Volte a pesquisar.'); controls(blocked); }
      }
    }
    function render(s) {
      clear(); if (!s) return;
      selected = {monthRef: s.monthRef, q: '', page: 1, mode: 'SERVICES', serviceType: null, serviceId: null, clientId: null};
      el('executionValuesPanel').hidden = false; const root = el('executionValues');
      const statusNode = node(root, 'p', '', 'ai-state'); statusNode.id = 'executionStatus'; statusNode.setAttribute('role', 'status'); statusNode.setAttribute('aria-live', 'polite');
      const form = node(root, 'form', '', 'ai-toolbar'), label = node(form, 'label', 'Pesquisar nesta lista'); label.htmlFor = 'executionSearch';
      const search = node(label, 'input', ''); search.id = 'executionSearch'; search.type = 'search'; search.maxLength = 160;
      const submit = node(form, 'button', 'Pesquisar'); submit.type = 'submit'; submit.id = 'executionSubmit';
      button(form, 'Todos os serviços', () => { selected = {...selected, q: '', page: 1, mode: 'SERVICES', serviceType: null, serviceId: null, clientId: null}; search.value = ''; void request(); }).id = 'executionBack';
      search.addEventListener('input', () => { epoch++; busy = false; selected.q = search.value.trim(); selected.page = 1; erase(); status('idle', 'Pesquisa alterada. Consulte os resultados.'); controls(blocked); });
      form.addEventListener('submit', event => { event.preventDefault(); void request(); });
      for (const [id, tag, cls] of [['executionMetrics', 'div', 'ai-metrics'], ['executionBasis', 'div', 'ai-note'], ['executionSourceTitle', 'h4', ''], ['executionRows', 'div', ''], ['executionPagination', 'div', 'ai-toolbar']]) node(root, tag, '', cls).id = id;
      draw({summary: s, rows: s.services.rows, total: s.serviceCount, service: null});
    }
    return {clear, controls, render};
  }
  window.CWExecutionValues = {create, validate};
})();
