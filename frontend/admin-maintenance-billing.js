(() => {
  'use strict';
  const el = id => document.getElementById(id), root = el('maintenanceBillingPanel'); if (!root) return;
  const token = () => window.CristalAuth?.getToken?.() || localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
  const sessionToken = token(), positive = n => Number.isSafeInteger(n) && n > 0 && n <= 2147483647;
  const status = text => { el('mbStatus').textContent = text; };
  let owner, storageKey, pending = null, blocked = false, busy = false, loading = false, selected = null, rows = [], poolId = 0, nextBefore = null, revision = 0, controller;
  function session() {
    if (!blocked && sessionToken && sessionToken === token()) return true;
    if (sessionToken !== token()) { blocked = true; revision++; controller?.abort(); root.hidden = true; el('mbRows').replaceChildren(); el('mbReview').reset(); el('mbPendingSummary').textContent = ''; selected = null; pending = null; }
    return false;
  }
  function amount(value) {
    if (typeof value !== 'string' || !/^(0|[1-9]\d*)([.,]\d{1,2})?$/.test(value.trim())) throw Error('Indique o valor com até duas casas decimais.');
    const [whole, fraction = ''] = value.trim().replace(',', '.').split('.'), result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!positive(result)) throw Error('Indique um valor extra positivo dentro do limite permitido.'); return result;
  }
  function valid(record) {
    const b = record?.body;
    if (!record || record.schema !== 1 || record.owner !== owner || typeof record.id !== 'string' || !/^[0-9a-f-]{36}$/.test(record.id) || !['EQUIPMENT','REMINDER'].includes(record.kind) || !positive(record.sourceId) ||
      !b || Object.keys(b).length !== 7 || !positive(b.expectedPoolId) || !positive(b.expectedClientId) || !/^v1:[a-f0-9]{64}$/.test(b.expectedVersion) || !['INCLUDED','EXTRA'].includes(b.mode) || b.confirmed !== true ||
      typeof b.note !== 'string' || b.note.trim().length < 3 || b.note.length > 2000 || (b.mode === 'EXTRA' ? amount(b.amount) !== record.amountCents : b.amount !== '0.00' || record.amountCents !== 0) ||
      typeof record.summary !== 'string' || record.summary.length > 3000 || record.rejection && (![400,403,404,409,422].includes(record.rejection.status) || typeof record.rejection.message !== 'string')) throw Error('O pedido guardado precisa de revisão; foi conservado e não será enviado.');
    return record;
  }
  function read() { const raw = localStorage.getItem(storageKey); return raw ? valid(JSON.parse(raw)) : null; }
  function persist(record) { localStorage.setItem(storageKey, JSON.stringify(record)); if (read()?.id !== record.id) throw Error('Não foi possível guardar o pedido neste navegador.'); }
  function forget(record) { if (read()?.id !== record.id) throw Error('O pedido mudou noutra janela. Reabra a página.'); localStorage.removeItem(storageKey); pending = null; }
  function renderControls() {
    root.querySelectorAll('button,input,select,textarea').forEach(node => { node.disabled = blocked || busy || loading; });
    el('mbRefresh').disabled ||= !poolId; el('mbOlder').disabled ||= !nextBefore; el('mbOlder').hidden = !nextBefore;
    el('mbAmount').disabled ||= el('mbMode').value !== 'EXTRA';
    el('mbPending').hidden = !pending; el('mbReview').hidden = !selected || Boolean(pending);
    for (const button of root.querySelectorAll('[data-mb-review]')) button.disabled ||= Boolean(pending);
    if (pending) { el('mbPendingSummary').textContent = `${pending.rejection ? 'Pedido recusado' : 'Pedido por confirmar'}: ${pending.summary}`; el('mbRetry').disabled ||= Boolean(pending.rejection); el('mbCorrect').hidden = !pending.rejection; }
  }
  const node = (tag, text, parent) => { const item = document.createElement(tag); item.textContent = text; parent.append(item); return item; };
  function renderRows() {
    const list = el('mbRows'); list.replaceChildren(); if (!rows.length) node('p', 'Não existem intervenções concluídas nesta página.', list);
    for (const row of rows) {
      const card = node('article', '', list); card.className = 'mb-card'; card.dataset.mbSource = `${row.kind}:${row.sourceId}`;
      node('h3', row.title, card); node('p', `Concluída: ${new Date(row.completedAt).toLocaleString('pt-PT')}${row.visitId ? ` · Visita ${row.visitType === 'EXTRA' ? 'extra' : 'regular'} #${row.visitId}` : ''}`, card); node('p', row.details, card);
      if (row.decision) {
        const invoiceLabel = { DRAFT: 'Rascunho', PENDING: 'Pendente', ISSUED: 'Emitido', PAID: 'Pago', PARTIAL: 'Pagamento parcial', CANCELLED: 'Cancelado', CANCELED: 'Cancelado', VOID: 'Anulado', UNAVAILABLE: 'Indisponível' }[row.invoiceStatus] || row.invoiceStatus;
        node('strong', row.decision.mode === 'INCLUDED' ? 'Incluída na mensalidade · Sem valor extra' : `Extra: ${(row.decision.amountCents / 100).toFixed(2)} EUR · Documento #${row.decision.invoiceId} · ${invoiceLabel}`, card);
        node('p', row.decision.note, card);
      } else if (!row.reviewable) node('p', row.reviewIssue, card);
      else { const button = node('button', 'Rever cobrança', card); button.type = 'button'; button.className = 'btn'; button.dataset.mbReview = row.sourceId;
        button.onclick = () => { if (busy || loading || pending || !session()) return; selected = row; el('mbReview').reset(); el('mbSource').textContent = `${row.title} · ${row.poolName} · ${row.clientName}`; summary(); renderControls(); el('mbMode').focus(); }; }
    }
    renderControls();
  }
  function summary() {
    const mode = el('mbMode').value; el('mbAmount').disabled = mode !== 'EXTRA';
    el('mbConfirmSummary').textContent = !selected || !mode ? '' : mode === 'INCLUDED' ? `${selected.clientName}: esta intervenção fica incluída, sem valor extra.` : `${selected.clientName}: será preparado um rascunho de ${el('mbAmount').value || '…'} EUR para ${selected.title}.`;
  }
  async function load(before = null) {
    if (!session()) return; controller?.abort(); controller = new AbortController(); const current = ++revision, pid = poolId, kind = el('mbKind').value;
    rows = []; selected = null; nextBefore = null; el('mbRows').replaceChildren(); loading = Boolean(pid); renderControls(); if (!pid) return;
    try {
      const response = await fetch(`/api/equipment-maintenance/pools/${pid}/billing?kind=${kind}${before ? `&before=${before}` : ''}`, { headers: { Authorization: `Bearer ${sessionToken}` }, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
      const data = await response.json(); if (!session() || current !== revision) return;
      if (!response.ok || data.ok !== true || data.poolId !== pid || data.kind !== kind || !positive(data.clientId) || !Array.isArray(data.rows) || data.rows.some(row => row.kind !== kind || row.poolId !== pid || row.clientId !== data.clientId || !positive(row.sourceId) || !/^v1:[a-f0-9]{64}$/.test(row.expectedVersion))) throw Error(data.error || 'Não foi possível confirmar a lista de intervenções.');
      rows = data.rows; nextBefore = data.nextBefore; el('mbContext').textContent = `${data.poolName} · ${data.clientName}`; renderRows(); if (!pending) status('Intervenções atualizadas.');
    } catch (error) { if (session() && current === revision) status(error.name === 'AbortError' ? 'Consulta cancelada. Atualize a lista.' : error.message); }
    finally { if (current === revision) { loading = false; renderControls(); } }
  }
  function validateResult(data, record) {
    const b = record.body;
    return data?.ok === true && data.schema === 1 && data.kind === record.kind && data.sourceId === record.sourceId && data.poolId === b.expectedPoolId && data.clientId === b.expectedClientId && data.expectedVersion === b.expectedVersion &&
      data.mode === b.mode && data.amountCents === record.amountCents && data.amount === record.amountCents / 100 && data.note === b.note && Number.isFinite(Date.parse(data.reviewedAt)) &&
      (b.mode === 'EXTRA' ? data.status === 'DRAFT' && positive(data.invoiceId) && positive(data.invoiceLineId) : data.status === 'INCLUDED' && data.invoiceId === null && data.invoiceLineId === null);
  }
  async function send(retry = false) {
    if (busy || blocked || !session()) return;
    if (!retry && (!selected || !el('mbReview').reportValidity())) return;
    if (!navigator.locks?.request || !crypto.randomUUID) { status('Use um navegador atualizado para proteger a confirmação entre janelas.'); return; }
    busy = true; renderControls();
    try { await navigator.locks.request(storageKey, { ifAvailable: true }, async lock => {
      if (!session()) return; if (!lock) throw Error('Existe uma confirmação noutra janela. Aguarde e atualize.');
      const stored = read();
      if (stored && stored.id !== pending?.id) { pending = stored; status('Pedido pendente recuperado. Use Repetir confirmação.'); return; }
      if (!stored && pending) { pending = null; selected = null; await load(); status('A outra janela resolveu o pedido. Lista atualizada.'); return; }
      if (retry !== Boolean(pending) || pending?.rejection) return;
      if (!pending) {
        if (!selected || !el('mbReview').reportValidity()) return;
        const mode = el('mbMode').value, amountCents = mode === 'EXTRA' ? amount(el('mbAmount').value) : 0;
        const body = { expectedVersion: selected.expectedVersion, expectedPoolId: selected.poolId, expectedClientId: selected.clientId, mode, amount: (amountCents / 100).toFixed(2), note: el('mbNote').value.trim(), confirmed: el('mbConfirmed').checked };
        const record = valid({ schema: 1, id: crypto.randomUUID(), owner, kind: selected.kind, sourceId: selected.sourceId, amountCents, body,
          summary: `${selected.title} · ${selected.poolName} · ${selected.clientName} · ${mode === 'INCLUDED' ? 'Incluída na mensalidade' : `${body.amount} EUR como extra`}` });
        persist(record); pending = record; renderControls();
      }
      const record = pending; status('A confirmar a decisão comercial…');
      try {
        const response = await fetch(`/api/equipment-maintenance/billing/${record.kind}/${record.sourceId}/review`, { method: 'POST', headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(record.body), signal: AbortSignal.timeout(40000) });
        const data = await response.json().catch(() => ({})); if (!session()) return;
        if (!response.ok) throw Object.assign(Error(data.error || 'Decisão não confirmada.'), { status: response.status });
        if (!validateResult(data, record)) throw Error('A confirmação recebida não corresponde à intervenção e ao valor revistos.');
        forget(record); selected = null; await load();
        if (session()) status(data.mode === 'INCLUDED' ? 'Decisão confirmada: incluída na mensalidade, sem valor extra.' : `Decisão confirmada: rascunho #${data.invoiceId} preparado por ${data.amount.toFixed(2)} EUR. Consulte o documento para revisão.`);
      } catch (error) {
        if (!session()) return;
        if ([400,403,404,409,422].includes(error.status)) { pending = { ...record, rejection: { status: error.status, message: error.message } }; persist(pending); status(`${error.message} Use Rever dados.`); }
        else status(`${error.message} O pedido foi conservado. Use Repetir confirmação para recuperar o resultado.`);
      }
    }); } catch (error) { if (session()) status(error.message); }
    finally { busy = false; if (session()) renderControls(); }
  }
  el('mbReview').onsubmit = event => { event.preventDefault(); void send(); };
  el('mbReview').oninput = summary;
  el('mbCancel').onclick = () => { selected = null; renderControls(); };
  el('mbRetry').onclick = () => send(true);
  el('mbCorrect').onclick = async () => {
    if (busy || !pending?.rejection || !session()) return; busy = true; renderControls();
    try { await navigator.locks.request(storageKey, { ifAvailable: true }, async lock => { if (!lock || !session()) return; const record = read(); if (record?.id !== pending.id || !record.rejection) throw Error('O pedido mudou noutra janela.'); forget(record); selected = null; await load(); }); }
    catch (error) { if (session()) status(error.message); } finally { busy = false; if (session()) renderControls(); }
  };
  el('mbRefresh').onclick = () => load(); el('mbOlder').onclick = () => load(nextBefore); el('mbKind').onchange = () => load();
  el('emPool').addEventListener('change', () => { poolId = Number(el('emPool').value) || 0; el('mbContext').textContent = poolId ? 'A consultar a piscina…' : 'Escolha uma piscina acima.'; void load(); });
  try {
    const payload = JSON.parse(atob(sessionToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.role !== 'ADMIN' || !positive(Number(payload.id))) throw Error('Sessão administrativa inválida.');
    owner = `ADMIN:${payload.id}`; storageKey = `cwMaintenanceBilling:v1:${owner}`; pending = read();
    if (pending) status(pending.rejection ? `${pending.rejection.message} Use Rever dados.` : 'Pedido pendente recuperado. Use Repetir confirmação.');
  } catch (error) { blocked = true; status(error.message); }
  for (const event of ['storage','focus']) window.addEventListener(event, () => { if (!session() || busy) return; try { pending = read(); renderControls(); } catch (error) { blocked = true; status(error.message); renderControls(); } });
  renderControls();
})();
