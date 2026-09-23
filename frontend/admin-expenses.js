(function () {
  'use strict';
  const el = id => document.getElementById(id), keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
  const hash = value => digest(new TextEncoder().encode(JSON.stringify(canonical(value))));
  const identity = () => JSON.stringify(keys.map(k => localStorage.getItem(k)));
  const money = cents => cents === null ? 'Por confirmar' : new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  const amount = text => { if (!/^\d{1,8}([.,]\d{1,2})?$/.test(text.trim())) throw Error('Indique um montante válido, com até duas casas decimais.'); const [whole, fraction = ''] = text.trim().replace(',', '.').split('.'); const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0')); if (value <= 0 || value > 2147483647) throw Error('Montante fora do intervalo permitido.'); return value; };
  const date = () => new Date().toISOString().slice(0, 10), positive = n => Number.isSafeInteger(n) && n > 0, cents = n => n === null || Number.isSafeInteger(n) && n >= 0;
  const statusNames = { OPEN: 'Por pagar', PARTIAL: 'Parcialmente paga', PAID: 'Paga', CANCELLED: 'Anulada', REVIEW: 'Por confirmar' };
  const sourceNames = { MANUAL: 'Registo manual', STOCK_PURCHASE: 'Compra de stock', VEHICLE_MAINTENANCE: 'Manutenção de viatura' }, paymentNames = { TRANSFER: 'Transferência', CARD: 'Cartão', CASH: 'Numerário', OTHER: 'Outro' };
  const commandNames = { CREATE: 'Nova despesa', EDIT: 'Correção da despesa', CANCEL: 'Anulação da despesa', REOPEN: 'Reabertura', RECORD_PAYMENT: 'Registo de pagamento', REVERSE_PAYMENT: 'Correção de pagamento', ADD_EVIDENCE: 'Novo comprovativo', VOID_EVIDENCE: 'Anulação de comprovativo', ALLOCATE_COST: 'Atribuição de custo', REVIEW_COST: 'Revisão de atribuição', VOID_COST: 'Anulação de atribuição', SET_LABOR_BASIS: 'Base de custo do trabalho', VALUE_MATERIAL: 'Valorização de consumo', VALUE_LABOR: 'Valorização do tempo' };
  let principal, invalid = false, readEpoch = 0, detailEpoch = 0, formEpoch = 0, sourceEpoch = 0, preparingFile = false, page = 1, total = 0, selectedId = null, detail = null, source = null, sourcePage = 1, sourceTotal = 0, target = null, pending = null, writing = false, db = null, storageFailed = false, openedAfter = null;
  const controllers = new Set(), urls = new Set();
  const costsUI = window.CWExpenseCosts.create({ el, node, button, money, amount, hash, request, execute, active, note, controls, owner: () => principal?.owner || '', openExpense: openDetail, context: () => ({ expense: detail, epoch: readEpoch, detailEpoch, canRead: !invalid && !writing && navigator.onLine, canWrite: !invalid && !writing && !preparingFile && !pending && !storageFailed && !!db && navigator.onLine }) });
  function node(parent, tag, text, cls) { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; parent.append(n); return n; }
  function button(parent, text, work, write = false) { const b = node(parent, 'button', text); b.type = 'button'; if (write) b.dataset.write = ''; b.addEventListener('click', () => Promise.resolve().then(work).catch(error => { if (active()) note(error.message); })); return b; }
  function state(kind, text) { el('expenseStatus').dataset.state = kind; el('expenseStatus').textContent = text; }
  function note(text) { el('writeStatus').textContent = text; }
  function abort() { for (const controller of controllers) controller.abort(); controllers.clear(); for (const url of urls) URL.revokeObjectURL(url); urls.clear(); }
  function clearRead() { costsUI.clear(); readEpoch++; detailEpoch++; sourceEpoch++; formEpoch++; abort(); detail = null; selectedId = null; for (const id of ['expenseMetrics', 'expenseBasis', 'expenseRows', 'listSummary', 'detailTitle', 'detailFacts', 'paymentRows', 'evidenceRows', 'eventList']) el(id).replaceChildren(); el('expenseDetail').hidden = true; total = 0; }
  function active() {
    if (!invalid && principal && principal.fingerprint === identity() && principal.expires > Date.now()) return true;
    if (!invalid) { invalid = true; clearRead(); el('expenseForm').reset(); el('paymentForm').reset(); el('evidenceForm').reset(); el('expenseEditor').hidden = true; el('pendingPanel').hidden = true; el('pendingPreview').replaceChildren(); el('sourceRows').replaceChildren(); el('sourceReview').replaceChildren(); el('sourceStatus').replaceChildren(); el('editorTitle').replaceChildren(); source = null; note(''); }
    state('session', 'A sessão mudou. Reabra esta página com a conta original para recuperar os pedidos guardados.'); controls(); return false;
  }
  function controls() {
    const disabled = invalid || writing || preparingFile || !navigator.onLine;
    document.querySelectorAll('[data-write]').forEach(b => b.disabled = disabled || !!pending || storageFailed || !db);
    document.querySelectorAll('#expenseForm input,#expenseForm select,#expenseForm textarea,#paymentForm input,#paymentForm select,#evidenceForm input').forEach(n => n.disabled = disabled || !!pending || storageFailed || !db);
    for (const id of ['checkPending', 'retryPending', 'cancelPending']) el(id).disabled = disabled || !pending;
    for (const id of ['expenseRefresh', 'sourceRefresh']) el(id).disabled = disabled;
    el('expensePrevious').disabled = disabled || page <= 1; el('expenseNext').disabled = disabled || page * 10 >= total;
    el('sourcePrevious').disabled = disabled || sourcePage <= 1; el('sourceNext').disabled = disabled || sourcePage * 10 >= sourceTotal;
    el('pendingPanel').hidden = !pending || invalid;
    try { el('newExpense').textContent = principal && sessionStorage.getItem('cw-expense-draft:' + principal.owner) ? 'Continuar rascunho' : 'Nova despesa'; } catch {}
    costsUI.controls();
    if (pending && !invalid) { const e = pending.envelope, d = e.data; el('pendingPreview').textContent = [commandNames[e.command] + (e.expenseId ? ' · Despesa #' + e.expenseId : ''), d.title, d.supplierName, d.documentNumber ? 'Documento: ' + d.documentNumber : '', d.amountCents ? 'Montante: ' + money(d.amountCents) : '', d.expenseDate ? 'Data do documento: ' + d.expenseDate : '', d.dueDate ? 'Vencimento: ' + d.dueDate : '', d.paidOn ? 'Pagamento efetuado em: ' + d.paidOn : '', d.name ? 'Comprovativo: ' + d.name : '', d.monthRef ? 'Mês da atribuição: ' + d.monthRef : '', d.targetType ? 'Destino: ' + ({COMPANY:'Empresa',CLIENT:'Cliente',REGULAR:'Visita regular',EXTRA:'Visita extra',REPAIR:'Reparação'}[d.targetType]) + (d.targetId ? ' #' + d.targetId : '') : '', d.workIntervalId ? 'Intervalo declarado #' + d.workIntervalId : '', d.quantity ? 'Quantidade: ' + d.quantity + (d.kind === 'LABOR' ? ' segundos' : '') : '', d.paidMinutes ? 'Tempo pago: ' + d.paidMinutes + ' minutos' : '', d.periodStart ? 'Período: ' + d.periodStart + ' a ' + d.periodEnd : '', d.technicianId ? 'Técnico #' + d.technicianId : '', d.reason ? 'Motivo: ' + d.reason : ''].filter(Boolean).join('\n'); }
  }
  async function access(mode, fn) { return new Promise((resolve, reject) => { const tx = db.transaction('state', mode), request = fn(tx.objectStore('state')); tx.oncomplete = () => resolve(request?.result); tx.onerror = tx.onabort = () => reject(tx.error || Error('Não foi possível guardar o pedido neste navegador.')); }); }
  const readLocal = kind => access('readonly', s => s.get(principal.owner + ':' + kind));
  async function validPending(record) { return record?.owner === principal.owner && record.payloadHash === await hash({ v: 1, ...record.envelope }) && (!record.file || record.envelope.data.sha256 === await digest(await record.file.arrayBuffer())); }
  async function syncPending() { if (!db || !active() || writing) return; try { const stored = await readLocal('pending'); if (!active()) return; if (stored && !await validPending(stored)) throw Error('Pedido local inválido.'); pending = stored || null; controls(); } catch { storageFailed = true; note('Não foi possível verificar o pedido guardado. As escritas estão bloqueadas para evitar duplicações.'); controls(); } }
  async function request(path, options = {}, epoch) {
    const controller = new AbortController(); controllers.add(controller); const timer = setTimeout(() => controller.abort(), 40000);
    try {
      const response = await fetch('/api/expenses' + path, { ...options, headers: { Authorization: 'Bearer ' + principal.token, ...(options.headers || {}) }, cache: 'no-store', redirect: 'error', signal: controller.signal });
      if (!active() || epoch !== undefined && epoch !== readEpoch) throw Error('Consulta alterada.');
      if ((response.headers.get('content-type') || '').split(';')[0] !== 'application/json') throw Error('Resposta do servidor não confirmada.');
      const result = await response.json(); if (!active() || epoch !== undefined && epoch !== readEpoch) throw Error('Consulta alterada.');
      if (response.status !== 200 || result?.ok !== true) throw Object.assign(Error(result?.error || 'Não foi possível confirmar a operação.'), { status: response.status }); return result;
    } finally { clearTimeout(timer); controllers.delete(controller); }
  }
  function selection() { return JSON.stringify([el('expenseMonth').value, el('expenseScope').value, el('expenseFilter').value, el('expenseSearch').value.trim(), page]); }
  const observedFilters = () => JSON.stringify(['expenseMonth','expenseScope','expenseFilter','expenseSearch'].map(id => el(id).value)); let observed = '';
  function validateSummary(s) {
    if (!s || s.version !== 1 || s.monthRef !== el('expenseMonth').value || s.currency !== 'EUR' || !['READY', 'REVIEW'].includes(s.state) || s.coverage !== 'REGISTERED_EXPENSES_ONLY' || s.completeOperatingCosts !== false || s.bankReconciled !== false || s.limitApplied !== null || s.basis?.documents !== 'EXPENSE_DOCUMENT_DATE' || s.basis?.payments !== 'RECORDED_PAYMENT_DATE' || s.basis?.open !== 'CURRENT_REGISTERED_OBLIGATIONS' || !['documentCount','paymentCount','missingDueDateCount','reviewCount'].every(k => Number.isSafeInteger(s[k]) && s[k] >= 0) || !cents(s.openCount) || !Number.isFinite(Date.parse(s.generatedAt)) || !['documentAmountCents', 'paymentsAmountCents', 'openAmountCents', 'overdueAmountCents'].every(k => cents(s[k])) || s.state === 'READY' && ['documentAmountCents', 'paymentsAmountCents', 'openAmountCents', 'overdueAmountCents'].some(k => s[k] === null)) throw Error('Totais de despesas incompletos ou de outro mês.');
  }
  function validateExpense(e) { if (!e || !positive(e.id) || !positive(e.version) || !positive(e.amountCents) || !cents(e.openCents) || !cents(e.paidCents) || typeof e.title !== 'string' || typeof e.supplierName !== 'string' || !statusNames[e.status] || typeof e.needsReview !== 'boolean' || typeof e.sourceChanged !== 'boolean' || !/^\d{4}-\d{2}-\d{2}$/.test(e.expenseDate)) throw Error('Despesa não confirmada.'); }
  async function load() {
    if (!active() || !navigator.onLine) return; clearRead(); const epoch = readEpoch, selected = selection(); observed = observedFilters(); state('loading', 'A consultar despesas…');
    try {
      const query = new URLSearchParams({ monthRef: el('expenseMonth').value, scope: el('expenseScope').value, filter: el('expenseFilter').value, q: el('expenseSearch').value.trim(), page: String(page) });
      const result = await request('?' + query, {}, epoch); if (!active() || epoch !== readEpoch || selected !== selection()) return;
      if (result.monthRef !== query.get('monthRef') || result.scope !== query.get('scope') || result.filter !== query.get('filter') || result.q !== query.get('q') || result.page !== page || result.pageSize !== 10 || !Number.isSafeInteger(result.total) || result.total < 0 || !Array.isArray(result.rows) || result.rows.length > 10 || new Set(result.rows.map(e => e.id)).size !== result.rows.length) throw Error('Lista não confirmada para os filtros escolhidos.');
      validateSummary(result.summary); result.rows.forEach(validateExpense); total = result.total;
      const s = result.summary;
      for (const [title, value] of [['Despesas do mês', s.documentAmountCents], ['Pagamentos registados no mês', s.paymentsAmountCents], ['Por pagar agora · todos os meses', s.openAmountCents], ['Vencido agora · todos os meses', s.overdueAmountCents]]) { const box = node(el('expenseMetrics'), 'div', '', 'metric'); node(box, 'span', title); node(box, 'strong', money(value)); }
      el('expenseBasis').textContent = 'Consulta: ' + new Date(s.generatedAt).toLocaleString('pt-PT') + '. Despesas pela data do documento; pagamentos pela data registada. Cobertura parcial, sem conciliação bancária. ' + s.reviewCount + ' despesas por rever; ' + s.missingDueDateCount + ' saldos sem vencimento indicado.';
      el('listSummary').textContent = total + ' despesas encontradas · Página ' + page + ' de ' + Math.max(1, Math.ceil(total / 10));
      for (const e of result.rows) { const card = node(el('expenseRows'), 'article', ''); node(card, 'h3', e.title); node(card, 'p', e.supplierName + ' · ' + (e.documentNumber || 'Sem número de documento')); node(card, 'p', e.expenseDate + ' · ' + money(e.amountCents) + ' · ' + statusNames[e.status]); node(card, 'p', e.needsReview || e.allocationReviewCount ? 'Há dados ou atribuições por rever.' : 'Por pagar: ' + money(e.openCents), 'badge'); button(card, 'Abrir despesa #' + e.id, () => openDetail(e.id)); }
      if (!total) node(el('expenseRows'), 'p', 'Não há despesas para estes filtros.'); state(s.state === 'REVIEW' ? 'review' : 'ready', s.state === 'REVIEW' ? 'Há despesas por rever. Os totais afetados ficam por confirmar.' : 'Despesas consultadas.');
      await costsUI.load(true);
    } catch (error) { if (active() && epoch === readEpoch) { clearRead(); state('error', error.name === 'AbortError' ? 'A consulta demorou demasiado. Tente novamente.' : error.message); } } finally { controls(); }
  }
  async function openDetail(id) {
    if (!active()) return; costsUI.draft(); selectedId = id; detail = null; el('expenseDetail').hidden = true; el('expenseFile').value = ''; const epoch = readEpoch, revision = ++detailEpoch;
    try {
      const result = await request('/' + id, {}, epoch); if (!active() || epoch !== readEpoch || revision !== detailEpoch || selectedId !== id) return;
      const e = result.expense; validateExpense(e); if (e.id !== id || !Array.isArray(e.payments) || !Array.isArray(e.evidence) || !Array.isArray(result.events)) throw Error('Detalhe não confirmado.'); detail = e;
      for (const k of ['detailFacts', 'paymentRows', 'evidenceRows', 'eventList']) el(k).replaceChildren(); el('detailTitle').textContent = e.title + ' · #' + e.id;
      node(el('detailFacts'), 'p', e.supplierName + ' · Documento: ' + (e.documentNumber || 'não indicado')); node(el('detailFacts'), 'p', 'Total: ' + money(e.amountCents) + ' · Registado como pago: ' + money(e.paidCents) + ' · Por pagar: ' + money(e.openCents));
      node(el('detailFacts'), 'p', 'Documento: ' + e.expenseDate + ' · Vencimento: ' + (e.dueDate || 'não indicado') + ' · ' + statusNames[e.status]); node(el('detailFacts'), 'p', e.sourceChanged ? 'A origem mudou. Reveja e corrija a despesa antes de registar pagamentos.' : 'Origem: ' + sourceNames[e.sourceType] + (e.sourceId ? ' #' + e.sourceId : '')); if (e.notes) node(el('detailFacts'), 'p', e.notes);
      el('cancelExpense').hidden = !!e.cancelledAt; el('reopenExpense').hidden = !e.cancelledAt; el('editExpense').hidden = !!e.cancelledAt; el('paymentBox').hidden = !!e.cancelledAt || e.needsReview || e.openCents === 0; el('evidenceForm').hidden = !!e.cancelledAt;
      for (const p of e.payments) { const row = node(el('paymentRows'), 'div', '', 'row'); node(row, 'p', p.paidOn + ' · ' + money(p.amountCents) + ' · ' + paymentNames[p.method] + (p.reversedAt ? ' · Registo anulado: ' + p.reverseReason : '')); if (!p.reversedAt) button(row, 'Corrigir este registo de pagamento', () => reasonCommand('REVERSE_PAYMENT', { paymentId: p.id }, 'Motivo da correção. Esta ação não devolve dinheiro:'), true); }
      for (const f of e.evidence) { const row = node(el('evidenceRows'), 'div', '', 'row'); node(row, 'p', f.name + (f.voidedAt ? ' · Anulado: ' + f.voidReason : '')); if (!f.voidedAt) { button(row, 'Descarregar comprovativo', () => download(e.id, f)); button(row, 'Anular comprovativo', () => reasonCommand('VOID_EVIDENCE', { evidenceId: f.id }, 'Motivo da anulação deste comprovativo:'), true); } }
      for (const event of result.events) { const row = node(el('eventList'), 'div', '', 'row'); node(row, 'strong', commandNames[event.command] || event.command); node(row, 'p', event.actorName + ' · ' + new Date(event.createdAt).toLocaleString('pt-PT')); node(row, 'p', event.result.applied ? event.result.reason || 'Registo confirmado.' : event.result.message); if (event.result.before && event.result.after) node(row, 'p', 'Total anterior: ' + money(event.result.before.amountCents) + ' · Total confirmado: ' + money(event.result.after.amountCents)); }
      costsUI.render(e);
      el('paymentAmount').value = e.openCents > 0 ? (e.openCents / 100).toFixed(2) : ''; el('paymentDate').value = date(); el('paymentDate').max = date(); el('expenseDetail').hidden = false; controls();
    } catch (error) { if (active() && epoch === readEpoch && revision === detailEpoch && selectedId === id) { detail = null; el('expenseDetail').hidden = true; note(error.message); } }
  }
  const fields = { title: 'expenseTitle', supplierName: 'expenseSupplierName', documentNumber: 'expenseDocument', expenseDate: 'expenseDate', dueDate: 'expenseDue', notes: 'expenseNotes', reason: 'expenseReason', category: 'expenseCategory' };
  function values() { return { ...Object.fromEntries(Object.entries(fields).map(([k, id]) => [k, el(id).value.trim()])), supplierId: el('expenseSupplier').value ? Number(el('expenseSupplier').value) : null, amount: el('expenseAmount').value }; }
  function saveDraft() { if (!active() || el('expenseEditor').hidden) return; try { sessionStorage.setItem('cw-expense-draft:' + principal.owner, JSON.stringify({ values: values(), target, source, sourceType: el('sourceType').value, openedAfter })); } catch { note('O rascunho não pôde ser guardado neste navegador.'); } }
  function fill(values) { for (const [k, id] of Object.entries(fields)) el(id).value = values[k] || ''; el('expenseSupplier').value = values.supplierId || ''; el('expenseSupplierName').readOnly = !!values.supplierId; el('expenseAmount').value = values.amount || ''; el('expenseConfirmed').checked = false; }
  function validateSource(value, type, id) { if (!value || value.type !== type || value.id !== id || !positive(value.id) || !/^[a-f0-9]{64}$/.test(value.hash) || !value.suggested || !cents(value.suggested.amountCents) || typeof value.suggested.title !== 'string' || typeof value.suggested.supplierName !== 'string') throw Error('Origem não confirmada.'); return value; }
  function sourceNote() { el('sourceReview').textContent = source ? 'Origem: ' + sourceNames[source.type] + ' #' + source.id + '. Valor apurado na origem: ' + money(source.suggested.amountCents) + '. ' + source.warning : 'Confirme o documento e o montante real da despesa.'; }
  async function editor(edit = false, draft = null) {
    if (!active() || pending || writing) return;
    const revision = ++formEpoch, original = edit ? detail : null;
    if (draft) { target = draft.target; source = draft.source; openedAfter = draft.openedAfter; fill(draft.values); }
    else {
      openedAfter = (await readLocal('confirmed'))?.envelope.requestId || null; if (!active() || revision !== formEpoch) return;
      target = original ? { id: original.id, version: original.version } : null; source = null;
      if (original) {
        const e = original; fill({ ...e, amount: (e.amountCents / 100).toFixed(2), reason: '' });
        if (e.sourceType !== 'MANUAL') { const result = await request('/sources/' + e.sourceType + '/' + e.sourceId); if (!active() || revision !== formEpoch || target?.id !== e.id) return; source = validateSource(result.source, e.sourceType, e.sourceId); }
      } else fill({ expenseDate: date(), category: 'GENERAL' });
    }
    el('editorTitle').textContent = target ? 'Rever / corrigir despesa #' + target.id : 'Nova despesa'; el('sourceChooser').hidden = !!target; el('sourceType').value = draft?.sourceType || source?.type || 'MANUAL'; el('sourceSearchBox').hidden = el('sourceType').value === 'MANUAL'; el('expenseEditor').hidden = false; sourceNote(); controls(); saveDraft();
  }
  async function loadSources() {
    if (!active() || el('sourceType').value === 'MANUAL') return; const revision = ++sourceEpoch, type = el('sourceType').value, q = el('sourceSearch').value.trim(), expectedPage = sourcePage;
    el('sourceRows').replaceChildren(); el('sourceStatus').textContent = 'A consultar origens…';
    try {
      const result = await request('/sources?' + new URLSearchParams({ type, q, page: String(sourcePage) }));
      if (!active() || revision !== sourceEpoch || el('sourceType').value !== type || sourcePage !== expectedPage) return;
      if (result.type !== type || result.q !== q || result.page !== sourcePage || result.pageSize !== 10 || !Array.isArray(result.rows) || result.rows.length > 10 || !Number.isSafeInteger(result.total) || result.total < 0) throw Error('Origens não confirmadas.');
      sourceTotal = result.total; el('sourceStatus').textContent = sourceTotal + ' origens · Página ' + sourcePage;
      for (const row of result.rows) { const box = node(el('sourceRows'), 'article', ''); node(box, 'p', row.suggested.title + ' #' + row.id + ' · ' + row.suggested.supplierName + ' · ' + money(row.suggested.amountCents)); if (row.registeredExpenseId) button(box, 'Abrir despesa existente #' + row.registeredExpenseId, () => openDetail(row.registeredExpenseId)); else button(box, 'Rever esta origem', async () => { const choice = ++formEpoch; const result = await request('/sources/' + type + '/' + row.id); if (!active() || choice !== formEpoch || el('expenseEditor').hidden || revision !== sourceEpoch || el('sourceType').value !== type) return; source = validateSource(result.source, type, row.id); const suggested = source.suggested; fill({ ...suggested, supplierId: [...el('expenseSupplier').options].some(o => Number(o.value) === suggested.supplierId && o.textContent.replace(/ · inativo$/, '') === suggested.supplierName) ? suggested.supplierId : null, expenseDate: suggested.expenseDate || date(), amount: suggested.amountCents === null ? '' : (suggested.amountCents / 100).toFixed(2) }); sourceNote(); saveDraft(); }, true); }
    } catch (error) { if (active() && revision === sourceEpoch) el('sourceStatus').textContent = error.message; } finally { controls(); }
  }
  async function verify(result, record) {
    const c = result?.receipt, e = record.envelope;
    if (!result || result.ok !== true || !c || c.owner !== principal.owner || c.requestId !== e.requestId || c.command !== e.command || c.requestedExpenseId !== e.expenseId || c.expectedVersion !== e.expectedVersion || c.payloadHash !== record.payloadHash || !Number.isFinite(Date.parse(c.confirmedAt)) || typeof result.applied !== 'boolean' || result.applied && (!positive(result.expenseId) || !positive(result.version) || e.expenseId !== null && result.expenseId !== e.expenseId) || !result.applied && (typeof result.code !== 'string' || typeof result.message !== 'string')) throw Error('A confirmação não corresponde ao pedido original.');
    if (result.applied && ['CREATE','EDIT'].includes(e.command) && (result.after?.id !== result.expenseId || result.after.version !== result.version || !['title','supplierName','documentNumber','expenseDate','dueDate','amountCents','category','notes','sourceType','sourceId','sourceHash'].every(k => result.after[k] === e.data[k]))) throw Error('Despesa não confirmada.');
    if (result.applied && ['ALLOCATE_COST','REVIEW_COST','VOID_COST'].includes(e.command)) { const a = result.allocation; if (!a || !positive(a.id) || a.expenseId !== e.expenseId || !positive(a.amountCents) || (e.command === 'ALLOCATE_COST' ? a.amountCents !== e.data.amountCents || a.monthRef !== e.data.monthRef || a.targetType !== e.data.targetType || (a.targetType === 'CLIENT' ? a.clientId : a.targetType === 'REGULAR' ? a.visitId : a.targetType === 'EXTRA' ? a.extraVisitId : a.targetType === 'REPAIR' ? a.repairId : null) !== e.data.targetId : a.id !== e.data.allocationId) || e.command !== 'VOID_COST' && a.targetHash !== e.data.targetHash || e.command === 'VOID_COST' && (!a.voidedAt || a.activeKey !== null)) throw Error('Atribuição não confirmada.'); }
    await costsUI.verify(result, record);
    if (result.applied && e.command === 'RECORD_PAYMENT' && (result.payment?.expenseId !== e.expenseId || result.payment.amountCents !== e.data.amountCents || result.payment.paidOn !== e.data.paidOn || result.payment.method !== e.data.method || result.payment.reference !== e.data.reference)) throw Error('Pagamento não confirmado.');
    if (result.applied && e.command === 'ADD_EVIDENCE' && (result.evidence?.expenseId !== e.expenseId || result.evidence.sha256 !== e.data.sha256 || result.evidence.size !== e.data.size || result.evidence.name !== e.data.name)) throw Error('Comprovativo não confirmado.');
  }
  async function accept(result, record) {
    await verify(result, record); if (!active()) return;
    const stored = await readLocal('pending'); if (!active() || stored?.envelope.requestId !== record.envelope.requestId || stored.payloadHash !== record.payloadHash) throw Error('O pedido local mudou.');
    await access('readwrite', s => { s.put({ ...record, file: undefined, result }, principal.owner + ':confirmed'); return s.delete(principal.owner + ':pending'); });
    if (!active()) return; pending = null; costsUI.receipt(result, record);
    if (result.applied && ['CREATE', 'EDIT'].includes(record.envelope.command)) { el('expenseEditor').hidden = true; el('expenseForm').reset(); sessionStorage.removeItem('cw-expense-draft:' + principal.owner); }
    if (result.applied && record.envelope.command === 'ADD_EVIDENCE') el('expenseFile').value = '';
    const followId = selectedId === record.envelope.expenseId ? result.expenseId || selectedId : selectedId;
    note(result.applied ? 'Operação confirmada e registada.' : result.message + ' Os dados do formulário foram conservados.'); await load(); if (followId && active()) await openDetail(followId);
  }
  async function transmit(record, action) {
    if (!await validPending(record)) throw Error('Pedido guardado inválido.'); if (!active()) return;
    if (action === 'check') { await accept(await request('/requests/' + record.envelope.requestId), record); return; }
    let result;
    if (action !== 'cancel' && record.envelope.command === 'ADD_EVIDENCE') { const data = new FormData(); data.append('envelope', JSON.stringify(record.envelope)); data.append('file', record.file, record.envelope.data.name); result = await request('/evidence', { method: 'POST', body: data }); }
    else result = await request(action === 'cancel' ? '/commands/cancel' : '/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record.envelope) });
    if (active()) await accept(result, record);
  }
  async function execute(command, data, file = null, action = null) {
    if (!active() || writing || storageFailed || !db || !navigator.onLine) return;
    const context = command === 'CREATE' ? { id: null, version: null } : command === 'EDIT' ? target && { ...target } : detail && { id: detail.id, version: detail.version };
    if (!navigator.locks?.request || !crypto.randomUUID) { note('Este navegador precisa de HTTPS e suporte de armazenamento seguro para registar despesas.'); return; }
    writing = true; controls();
    try {
      await navigator.locks.request('cw-expense-command:' + principal.owner, { ifAvailable: true }, async lock => {
        if (!lock) { note('Há um pedido desta conta em curso noutra janela.'); return; }
        pending = await readLocal('pending'); if (!active()) return;
        if (action) { if (pending) await transmit(pending, action); return; }
        if (pending) { note('Confirme primeiro o pedido guardado.'); return; }
        if (!context) throw Error('Consulte a despesa antes de alterar o registo.');
        const envelope = { requestId: crypto.randomUUID(), command, expenseId: context.id, expectedVersion: context.version, data };
        const signature = await hash({ command, expenseId: context.id, expectedVersion: context.version, data });
        const previous = await readLocal('confirmed'); if (!active()) return;
        if (command === 'CREATE' && previous?.result?.applied && previous.signature === signature && previous.envelope.requestId !== openedAfter) { note('Esta despesa já foi confirmada noutra janela.'); el('expenseEditor').hidden = true; await load(); return; }
        const record = { owner: principal.owner, envelope, payloadHash: await hash({ v: 1, ...envelope }), signature, file, createdAt: new Date().toISOString() };
        await access('readwrite', s => s.put(record, principal.owner + ':pending')); if (!active()) return; pending = record; controls(); await transmit(record, 'send');
      });
    } catch (error) { if (active()) note(error.status === 404 && action === 'check' ? 'Ainda não há confirmação. Pode consultar novamente, reenviar o pedido original ou cancelá-lo no servidor.' : 'Não foi possível confirmar: ' + error.message + ' O pedido original foi conservado; não foi reenviado automaticamente.'); }
    finally { writing = false; if (active()) await syncPending(); controls(); }
  }
  async function reasonCommand(command, data, question) { if (!detail || !active() || pending || writing) return; const reason = prompt(question); if (!reason?.trim()) return; await execute(command, { ...data, reason: reason.trim() }); }
  async function download(expenseId, item) {
    if (!active()) return; const epoch = readEpoch, controller = new AbortController(); controllers.add(controller); const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('/api/expenses/' + expenseId + '/evidence/' + item.id, { headers: { Authorization: 'Bearer ' + principal.token }, cache: 'no-store', redirect: 'error', signal: controller.signal });
      if (!active() || epoch !== readEpoch || selectedId !== expenseId) return;
      if (response.status !== 200 || response.headers.get('x-expense-id') !== String(expenseId) || response.headers.get('x-expense-evidence-id') !== String(item.id) || response.headers.get('x-content-sha256') !== item.sha256 || !response.headers.get('content-disposition')?.startsWith('attachment')) throw Error('Comprovativo não confirmado.');
      const blob = await response.blob(); if (blob.size !== item.size || await digest(await blob.arrayBuffer()) !== item.sha256) throw Error('Ficheiro incompleto.');
      if (!active() || epoch !== readEpoch || selectedId !== expenseId) return; const url = URL.createObjectURL(blob); urls.add(url); const a = document.createElement('a'); a.href = url; a.download = item.name; a.click(); setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 30000);
    } catch (error) { if (active() && epoch === readEpoch && selectedId === expenseId) note(error.message); } finally { clearTimeout(timer); controllers.delete(controller); }
  }
  el('expenseForm').addEventListener('submit', event => { event.preventDefault(); try { const v = values(); if (!el('expenseConfirmed').checked || !v.title || !v.supplierName || !v.expenseDate) throw Error('Confirme os campos obrigatórios.'); if (el('sourceType').value !== 'MANUAL' && !source) throw Error('Reveja primeiro a origem selecionada.'); void execute(target ? 'EDIT' : 'CREATE', { ...v, amount: undefined, amountCents: amount(v.amount), dueDate: v.dueDate || null, sourceType: source?.type || 'MANUAL', sourceId: source?.id || null, sourceHash: source?.hash || null, confirmed: true }); } catch (error) { note(error.message); } });
  el('paymentForm').addEventListener('submit', event => { event.preventDefault(); try { void execute('RECORD_PAYMENT', { amountCents: amount(el('paymentAmount').value), paidOn: el('paymentDate').value, method: el('paymentMethod').value, reference: el('paymentReference').value.trim() }); } catch (error) { note(error.message); } });
  el('evidenceForm').addEventListener('submit', async event => { event.preventDefault(); if (preparingFile || writing || pending || !detail || !active()) return; const revision = detailEpoch; preparingFile = true; controls(); try { const file = el('expenseFile').files[0]; if (!file || !file.size || file.size > 5242880) throw Error('Escolha um PDF, PNG ou JPEG até 5 MB.'); const bytes = await file.arrayBuffer(); if (!active()) return; const a = new Uint8Array(bytes), mime = new TextDecoder().decode(a.slice(0, 5)) === '%PDF-' ? 'application/pdf' : [137,80,78,71,13,10,26,10].every((v, i) => a[i] === v) ? 'image/png' : a[0] === 255 && a[1] === 216 && a[2] === 255 ? 'image/jpeg' : null; if (!mime) throw Error('Formato do comprovativo inválido.'); const sha256 = await digest(bytes); if (!active() || revision !== detailEpoch) return; preparingFile = false; await execute('ADD_EVIDENCE', { name: file.name, size: file.size, mime, sha256 }, file); } catch (error) { if (active()) note(error.message); } finally { preparingFile = false; controls(); } });
  function changed() { if (!active()) return; saveDraft(); observed = observedFilters(); clearRead(); page = 1; el('expenseEditor').hidden = true; state('idle', 'Consulte os filtros selecionados. O rascunho guardado permanece nesta conta.'); controls(); }
  for (const id of ['expenseMonth', 'expenseScope', 'expenseFilter', 'expenseSearch']) el(id).addEventListener('input', changed);
  el('expenseRefresh').addEventListener('click', () => void load()); el('newExpense').addEventListener('click', async () => { try { const saved = sessionStorage.getItem('cw-expense-draft:' + principal.owner); await editor(false, saved ? JSON.parse(saved) : null); } catch (error) { note(error.message); } });
  el('discardDraft').addEventListener('click', async () => { if (!active() || pending || writing || !confirm('Descartar este rascunho ainda não enviado?')) return; try { sessionStorage.removeItem('cw-expense-draft:' + principal.owner); formEpoch++; sourceEpoch++; el('expenseEditor').hidden = true; el('expenseForm').reset(); source = null; target = null; controls(); } catch (error) { note(error.message); } });
  el('closeEditor').addEventListener('click', () => { saveDraft(); formEpoch++; el('expenseEditor').hidden = true; });
  el('expenseForm').addEventListener('input', saveDraft); el('expenseSupplier').addEventListener('change', () => { const option = el('expenseSupplier').selectedOptions[0]; el('expenseSupplierName').readOnly = !!el('expenseSupplier').value; if (el('expenseSupplier').value) el('expenseSupplierName').value = option.dataset.name; saveDraft(); });
  el('sourceType').addEventListener('change', () => { sourceEpoch++; source = null; sourcePage = 1; sourceTotal = 0; el('sourceRows').replaceChildren(); el('sourceSearchBox').hidden = el('sourceType').value === 'MANUAL'; el('expenseConfirmed').checked = false; sourceNote(); saveDraft(); controls(); });
  el('sourceSearch').addEventListener('input', () => { sourceEpoch++; sourcePage = 1; sourceTotal = 0; el('sourceRows').replaceChildren(); controls(); }); el('sourceRefresh').addEventListener('click', () => void loadSources());
  el('sourcePrevious').addEventListener('click', () => { sourcePage--; void loadSources(); }); el('sourceNext').addEventListener('click', () => { sourcePage++; void loadSources(); });
  el('expensePrevious').addEventListener('click', () => { page--; void load(); }); el('expenseNext').addEventListener('click', () => { page++; void load(); });
  el('editExpense').addEventListener('click', () => void editor(true).catch(error => note(error.message)));
  el('cancelExpense').addEventListener('click', () => void reasonCommand('CANCEL', {}, 'Motivo da anulação da despesa:')); el('reopenExpense').addEventListener('click', () => void reasonCommand('REOPEN', {}, 'Motivo da reabertura da despesa:'));
  for (const [id, action] of [['checkPending', 'check'], ['retryPending', 'retry'], ['cancelPending', 'cancel']]) el(id).addEventListener('click', () => void execute(null, null, null, action));
  for (const name of ['storage', 'focus']) window.addEventListener(name, () => { if (active()) void syncPending(); }); document.addEventListener('visibilitychange', active);
  for (const method of ['setItem', 'removeItem', 'clear']) { const original = Storage.prototype[method]; Storage.prototype[method] = function (...args) { const result = Reflect.apply(original, this, args); if (this === localStorage && (method === 'clear' || keys.includes(String(args[0])))) active(); return result; }; }
  window.addEventListener('pagehide', () => { saveDraft(); clearRead(); }); window.addEventListener('pageshow', e => { if (e.persisted && active()) { clearRead(); state('idle', 'Consulte novamente os dados após regressar à página.'); controls(); } });
  window.addEventListener('online', controls); window.addEventListener('offline', controls); setInterval(() => { if (active()) { if (observed && observed !== observedFilters()) changed(); costsUI.observe(); controls(); } }, 500);
  (async () => {
    try {
      const token = keys.slice(0, 3).map(k => localStorage.getItem(k)).find(Boolean), claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))), id = Number(claims.userId || claims.id), users = keys.slice(3).map(k => localStorage.getItem(k)).filter(Boolean).map(JSON.parse);
      if (claims.role !== 'ADMIN' || !positive(id) || !users.length || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() || users.some(u => u.role !== 'ADMIN' || Number(u.userId || u.id) !== id) || keys.slice(0, 3).some(k => localStorage.getItem(k) && localStorage.getItem(k) !== token)) throw Error('Session');
      principal = { id, token, owner: 'ADMIN:' + id, expires: claims.exp * 1000, fingerprint: identity() }; el('expenseMonth').value = date().slice(0, 7);
      try { db = await new Promise((resolve, reject) => { const open = indexedDB.open('cw-expense-commands-v1', 1); open.onupgradeneeded = () => open.result.createObjectStore('state'); open.onsuccess = () => resolve(open.result); open.onerror = open.onblocked = () => reject(Error('Storage')); }); await syncPending(); } catch { storageFailed = true; note('Não foi possível preparar o armazenamento dos pedidos. Pode consultar as despesas; os registos estão bloqueados.'); }
      if (!active()) return; const suppliers = await request('/suppliers'); if (!Array.isArray(suppliers.suppliers)) throw Error('Fornecedores não confirmados.'); for (const s of suppliers.suppliers) { if (!positive(s.id) || typeof s.name !== 'string') throw Error('Fornecedor inválido.'); const option = node(el('expenseSupplier'), 'option', s.name + (s.active ? '' : ' · inativo')); option.value = s.id; option.dataset.name = s.name; }
      controls(); await load();
    } catch (error) { if (!principal) { invalid = true; active(); } else if (active()) { state('error', error.message); controls(); } }
  })();
})();
