(function () {
  'use strict';
  const fields = ['valuationType','valuationKey','valuationHash','valuationSnapshot','quantity','quantityUnit','purchaseItemId','activeMeasurementKey','id','expenseId','monthRef','amountCents','targetType','clientId','visitId','extraVisitId','repairId','targetHash','targetSnapshot','expenseHash','expenseSnapshot','activeKey','reason','createdById','createdAt','reviewedAt','voidedAt','voidReason'];
  const positive = n => Number.isSafeInteger(n) && n > 0, month = s => typeof s === 'string' && /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(s);
  const iso = s => typeof s === 'string' && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
  const targetId = a => a.targetType === 'REGULAR' ? a.visitId : a.targetType === 'EXTRA' ? a.extraVisitId : a.repairId;
  const record = a => Object.fromEntries(fields.map(k => [k, a[k]]));
  window.CWExpenseCostPeriod = { create(host) {
    const { el, node, money, hash, active, note } = host;
    let revision = 0, selected = null, preview = null, stamp = '';
    const context = () => { const c = host.context(); return { ...c, stamp: c.epoch + ':' + c.detailEpoch + ':' + c.expense?.id }; };
    const key = (expenseId, allocationId) => 'cw-cost-period-draft:' + host.owner() + ':' + expenseId + ':' + allocationId;
    function clear() { revision++; selected = preview = null; stamp = ''; el('costPeriodBox').hidden = true; el('costPeriodFacts').replaceChildren(); el('costPeriodStatus').textContent = ''; el('costPeriodForm').reset(); }
    function controls() { document.querySelectorAll('#costPeriodForm input,#costPeriodForm textarea,#costPeriodForm button').forEach(n => n.disabled = !context().canWrite || !preview); }
    async function verifyPreview(p, expenseId, version, allocation) {
      const a = p?.allocationBefore, { available, hash: signature, ...value } = p || {};
      if (!p || available !== true || p.version !== 1 || p.basis !== 'CONFIRMED_SERVICE_EXECUTION_MONTH_UTC' || p.expenseId !== expenseId || p.expenseVersion !== version || !positive(p.allocationId) || !positive(p.clientId) || !positive(p.targetId) || !positive(p.amountCents) || !month(p.fromMonth) || !month(p.toMonth) || p.fromMonth === p.toMonth || !a || Object.keys(a).sort().join() !== [...fields].sort().join() || a.id !== p.allocationId || a.expenseId !== expenseId || a.monthRef !== p.fromMonth || a.amountCents !== p.amountCents || a.clientId !== p.clientId || a.targetType !== p.targetType || !['REGULAR','EXTRA','REPAIR'].includes(a.targetType) || targetId(a) !== p.targetId || a.valuationType !== 'MANUAL' || a.voidedAt !== null || a.voidReason !== null || !iso(a.createdAt) || !positive(a.createdById) || !(a.reviewedAt === null || iso(a.reviewedAt)) || ['valuationKey','valuationHash','valuationSnapshot','quantity','quantityUnit','purchaseItemId','activeMeasurementKey'].some(k => a[k] !== null) || ['visitId','extraVisitId','repairId'].some(k => a[k] !== (k === ({REGULAR:'visitId',EXTRA:'extraVisitId',REPAIR:'repairId'}[a.targetType]) ? p.targetId : null))) throw Error('Correção do período não confirmada.');
      const s = a.targetSnapshot, facts = ['type','id','clientId','poolId','status','startAt','endAt', ...(a.targetType === 'REPAIR' ? ['executionBasis','executionProofId','executionFingerprint','materialMode'] : [])];
      if (!s || s.type !== a.targetType || s.id !== p.targetId || s.clientId !== a.clientId || !iso(s.endAt) || s.endAt.slice(0, 7) !== p.toMonth || typeof s.label !== 'string' || typeof s.clientName !== 'string' || a.expenseSnapshot?.id !== expenseId || a.targetType === 'REPAIR' && (s.status !== 'CONFIRMED' || s.startAt !== null || !positive(s.poolId) || s.executionBasis !== 'EXPLICIT_AUTHENTICATED_REPAIR_COMPLETION' || !positive(s.executionProofId) || !/^[a-f0-9]{64}$/.test(s.executionFingerprint) || !['NONE','RESERVED'].includes(s.materialMode))) throw Error('Execução da correção não confirmada.');
      if (await hash(value) !== signature || await hash(a) !== p.beforeHash || await hash(a.expenseSnapshot) !== a.expenseHash || await hash(Object.fromEntries(facts.map(k => [k, s[k]]))) !== a.targetHash || await hash({ expenseId, monthRef: p.fromMonth, type: p.targetType, id: p.targetId }) !== a.activeKey || allocation && await hash(record(allocation)) !== p.beforeHash) throw Error('A correção não corresponde à atribuição selecionada.');
      return p;
    }
    async function review(allocation) {
      if (!active() || !context().canWrite) return;
      clear(); const rev = revision, c = context(); selected = allocation.id; stamp = c.stamp; el('costPeriodBox').hidden = false; el('costPeriodStatus').textContent = 'A confirmar o mês da execução…'; controls();
      try {
        const result = await host.request('/' + c.expense.id + '/cost-period-preview?allocationId=' + allocation.id);
        if (!active() || rev !== revision || stamp !== context().stamp) return;
        if (result.preview?.available !== true) { if (result.preview?.applied !== false || typeof result.preview.message !== 'string') throw Error('Correção não confirmada.'); el('costPeriodStatus').textContent = result.preview.message; return; }
        const p = await verifyPreview(result.preview, c.expense.id, c.expense.version, allocation);
        if (!active() || rev !== revision || stamp !== context().stamp) return;
        preview = p; el('costPeriodStatus').textContent = 'Reveja os meses antes de confirmar.';
        node(el('costPeriodFacts'), 'p', p.allocationBefore.targetSnapshot.label + ' · ' + p.allocationBefore.targetSnapshot.clientName);
        node(el('costPeriodFacts'), 'p', 'Despesa #' + p.expenseId + ' · Atribuição #' + p.allocationId + ' · ' + money(p.amountCents));
        node(el('costPeriodFacts'), 'strong', 'Mês atual: ' + p.fromMonth + ' → Mês da execução: ' + p.toMonth + ' (UTC)');
        node(el('costPeriodFacts'), 'p', 'A atribuição anterior fica anulada no histórico. O valor, o serviço, o cliente e os pagamentos mantêm-se.');
        try { el('costPeriodReason').value = sessionStorage.getItem(key(p.expenseId, p.allocationId)) || ''; } catch {}
        el('costPeriodConfirmed').checked = false;
        el('costPeriodBox').scrollIntoView({ block: 'start' });
      } catch (error) { if (active() && rev === revision && stamp === context().stamp) { preview = null; el('costPeriodFacts').replaceChildren(); el('costPeriodStatus').textContent = error.message; } } finally { controls(); }
    }
    async function verify(result, local) {
      const e = local.envelope, d = e.data;
      if (e.command !== 'CORRECT_COST_PERIOD' || !result.applied) return;
      const p = await verifyPreview(result.preview, e.expenseId, e.expectedVersion), a = result.allocation, v = result.allocationVoided, before = result.allocationBefore;
      if (p.hash !== d.previewHash || p.allocationId !== d.allocationId || p.fromMonth !== d.fromMonth || p.toMonth !== d.toMonth || p.amountCents !== d.amountCents || result.version !== e.expectedVersion + 1 || result.reason !== d.reason || await hash(before) !== p.beforeHash || !a || !v || !positive(a.id) || a.id === before.id || !iso(a.createdAt) || a.createdById !== Number(local.owner.split(':')[1]) || !iso(v.voidedAt)) throw Error('Recibo da correção não corresponde ao pedido original.');
      const expectedVoided = { ...before, voidedAt: v.voidedAt, voidReason: d.reason, activeKey: null };
      const expected = { ...before, id: a.id, createdAt: a.createdAt, createdById: a.createdById, reviewedAt: null, monthRef: p.toMonth, reason: d.reason, activeKey: await hash({ expenseId: e.expenseId, monthRef: p.toMonth, type: p.targetType, id: p.targetId }) };
      if (await hash(v) !== await hash(expectedVoided) || await hash(a) !== await hash(expected)) throw Error('O valor ou o histórico da correção não foi confirmado.');
    }
    function receipt(result, local) { if (local.envelope.command === 'CORRECT_COST_PERIOD' && result.applied) { try { sessionStorage.removeItem(key(local.envelope.expenseId, local.envelope.data.allocationId)); } catch {} clear(); } }
    function observe() { if (stamp && stamp !== context().stamp) clear(); }
    el('costPeriodReason').addEventListener('input', () => { if (!active() || !preview || stamp !== context().stamp) return; try { sessionStorage.setItem(key(preview.expenseId, selected), el('costPeriodReason').value); } catch {} });
    el('costPeriodClose').addEventListener('click', clear);
    el('costPeriodForm').addEventListener('submit', event => { event.preventDefault(); if (!active() || !context().canWrite || !preview || stamp !== context().stamp || !el('costPeriodConfirmed').checked) return; const reason = el('costPeriodReason').value.trim(); if (!reason) { note('Indique o motivo da correção.'); return; } void host.execute('CORRECT_COST_PERIOD', { allocationId: preview.allocationId, fromMonth: preview.fromMonth, toMonth: preview.toMonth, amountCents: preview.amountCents, previewHash: preview.hash, reason, confirmed: true }); });
    return { clear, controls, review, verify, receipt, observe };
  } };
})();
