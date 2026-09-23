(function () {
  'use strict';
  window.CWExpenseValuation = { create(host) {
    const { el, node, money, request, active, note } = host;
    const positive = n => Number.isSafeInteger(n) && n > 0, count = n => Number.isSafeInteger(n) && n >= 0;
    const cents = n => n === null || count(n), quantity = s => typeof s === 'string' && /^\d{1,12}(\.\d{1,6})?$/.test(s) && Number(s) > 0;
    let editingId = null, revision = 0, techRevision = 0, preview = null, confirmedSelection = '', technicians = [], wantedTechnician = '';
    const kind = () => el('valuationKind').value, key = () => 'cw-valuation-draft:' + host.owner() + ':' + editingId;
    const laborFields = ['laborTechnician', 'laborPaidMinutes', 'laborPeriodStart', 'laborPeriodEnd', 'laborBasisReason'];
    const work = window.CWRepairLabor.create({ ...host, draft }, invalidate);
    function signature() { const c = host.context(), t = host.target(); return JSON.stringify([c.epoch, c.detailEpoch, c.expense?.id, c.expense?.version, t?.type, t?.id, t?.hash, kind(), work.id(), el('valuationLot').value, kind() === 'MATERIAL' ? el('valuationQuantity').value : '', el('allocationAmount').value, el('allocationMonth').value]); }
    function draft() {
      if (!active() || !editingId || host.context().expense?.id !== editingId) return;
      try { sessionStorage.setItem(key(), JSON.stringify({ kind: kind(), workIntervalId: work.id(), lot: el('valuationLot').value, quantity: el('valuationQuantity').value, labor: Object.fromEntries(laborFields.map(id => [id, el(id).value || (id === 'laborTechnician' ? wantedTechnician : '')])) })); } catch { note('O rascunho da valorização não pôde ser guardado.'); }
    }
    function invalidate(message = 'Calcule o custo com o serviço e as fontes atuais antes de confirmar.') {
      work.sync(); revision++; preview = null; confirmedSelection = ''; el('valuationPreview').replaceChildren(); el('valuationStatus').textContent = kind() === 'MANUAL' ? '' : message; el('allocationConfirmed').checked = false;
      if (kind() !== 'MANUAL') { el('allocationAmount').value = ''; el('allocationMonth').value = ''; }
    }
    function controls() {
      const c = host.context(), repair = el('allocationType').value === 'REPAIR', maintenance = window.CWExpenseMaintenance.types.includes(el('allocationType').value);
      const unavailable = value => maintenance && value !== 'MANUAL' || repair && (value === 'LABOR' && (c.expense?.sourceType !== 'MANUAL' || c.expense?.category !== 'LABOR' || !c.expense?.laborBasis) || value === 'MATERIAL' && (c.expense?.sourceType !== 'STOCK_PURCHASE' || host.target()?.snapshot?.materialMode === 'NONE'));
      if (unavailable(kind())) { invalidate(); el('valuationKind').value = 'MANUAL'; invalidate(); }
      for (const option of el('valuationKind').options) option.disabled = unavailable(option.value);
      el('repairCostBasis').hidden = !repair;
      const method = kind(), material = method === 'MATERIAL';
      el('valuationBox').hidden = method === 'MANUAL'; el('valuationLotLabel').hidden = !material; el('valuationQuantityLabel').hidden = !material;
      el('allocationAmount').readOnly = method !== 'MANUAL'; el('allocationMonth').readOnly = method !== 'MANUAL';
      el('valuationCalculate').disabled = !c.canWrite; el('laborTechniciansRefresh').disabled = !c.canWrite;
      for (const n of el('laborBasisForm').querySelectorAll('input,select,textarea,button')) n.disabled = !c.canWrite;
      el('laborTechnician').disabled = !c.canWrite || !technicians.length; work.sync();
    }
    function clear() {
      draft(); work.clear(); revision++; techRevision++; preview = null; confirmedSelection = ''; editingId = null; wantedTechnician = ''; technicians = [];
      for (const id of ['valuationPreview', 'valuationStatus', 'valuationMetrics', 'valuationSummaryBasis', 'laborBasisStatus', 'laborTechnician', 'valuationLot']) el(id).replaceChildren();
      el('laborBasisForm').reset(); el('valuationQuantity').value = ''; el('valuationKind').value = 'MANUAL'; el('laborBasisBox').hidden = true; el('valuationBox').hidden = true;
    }
    async function loadTechnicians() {
      if (!active() || !editingId || el('laborBasisBox').hidden) return;
      const rev = ++techRevision, c = host.context(), stamp = [c.epoch, c.detailEpoch, editingId].join(':');
      wantedTechnician = el('laborTechnician').value || wantedTechnician; technicians = []; el('laborTechnician').replaceChildren(); controls();
      try {
        const result = await request('/labor-technicians'); const now = host.context();
        if (!active() || rev !== techRevision || stamp !== [now.epoch, now.detailEpoch, editingId].join(':')) return;
        if (!Array.isArray(result.technicians) || new Set(result.technicians.map(t => t.id)).size !== result.technicians.length || !result.technicians.every(t => positive(t.id) && typeof t.name === 'string' && typeof t.active === 'boolean')) throw Error('Técnicos não confirmados.');
        technicians = result.technicians; const empty = node(el('laborTechnician'), 'option', 'Escolha o técnico'); empty.value = '';
        for (const t of technicians) { const option = node(el('laborTechnician'), 'option', t.name + ' · #' + t.id + (t.active ? '' : ' · inativo')); option.value = String(t.id); }
        el('laborTechnician').value = wantedTechnician;
      } catch (error) { if (active() && rev === techRevision) { technicians = []; el('laborTechnician').replaceChildren(); el('laborBasisStatus').textContent = error.message; } } finally { controls(); }
    }
    function render(expense) {
      work.clear(); revision++; techRevision++; editingId = expense.id; preview = null; confirmedSelection = ''; technicians = []; el('laborBasisForm').reset(); el('laborTechnician').replaceChildren(); el('valuationLot').replaceChildren(); el('valuationKind').value = 'MANUAL'; el('valuationQuantity').value = '';
      const b = expense.laborBasis;
      if (b && (!positive(b.id) || b.expenseId !== expense.id || !positive(b.technicianId) || !positive(b.paidMinutes) || typeof b.periodStart !== 'string' || typeof b.periodEnd !== 'string' || b.technician?.id !== b.technicianId)) throw Error('Base de trabalho incompleta.');
      wantedTechnician = b ? String(b.technicianId) : ''; el('laborPeriodStart').value = b?.periodStart || expense.expenseDate; el('laborPeriodEnd').value = b?.periodEnd || expense.expenseDate; el('laborPaidMinutes').value = b?.paidMinutes || ''; el('laborBasisReason').value = '';
      el('laborBasisBox').hidden = expense.category !== 'LABOR' || expense.sourceType !== 'MANUAL' || !!expense.cancelledAt;
      el('laborBasisStatus').textContent = b ? b.technician.name + ' · ' + b.periodStart + ' a ' + b.periodEnd + ' · ' + b.paidMinutes + ' minutos pagos · Total do documento: ' + money(expense.amountCents) + '. As visitas usam o tempo registado; as reparações usam intervalos declarados e confirmados.' : 'Ainda não há uma base de custo do trabalho confirmada.';
      const blank = node(el('valuationLot'), 'option', 'Escolha uma linha da compra'); blank.value = '';
      if (expense.sourceType === 'STOCK_PURCHASE') for (const item of expense.sourceSnapshot?.items || []) { if (!positive(item.id) || typeof item.productName !== 'string' || typeof item.unit !== 'string') throw Error('Linha de compra incompleta.'); const option = node(el('valuationLot'), 'option', item.productName + ' · ' + item.unit + ' · Linha #' + item.id); option.value = String(item.id); }
      try { const saved = JSON.parse(sessionStorage.getItem(key())); if (saved && ['MANUAL','MATERIAL','LABOR'].includes(saved.kind)) { el('valuationKind').value = saved.kind; work.restore(saved.workIntervalId); el('valuationLot').value = saved.lot || ''; el('valuationQuantity').value = saved.quantity || ''; for (const id of laborFields) if (typeof saved.labor?.[id] === 'string') { if (id === 'laborTechnician') wantedTechnician = saved.labor[id]; else el(id).value = saved.labor[id]; } } } catch {}
      el('laborBasisConfirmed').checked = false; invalidate(); controls(); if (!el('laborBasisBox').hidden) void loadTechnicians();
    }
    function repairSource(source, target) {
      const s = source?.service;
      if (source?.version !== 2 || source.kind !== 'MATERIAL' || !s || s.type !== 'REPAIR' || s.materialMode !== 'RESERVED' || !['type','id','clientId','poolId','status','startAt','endAt','executionBasis','executionProofId','executionFingerprint','materialMode'].every(k => s[k] === target?.[k]) || !Array.isArray(source.movements) || !source.movements.length || new Set(source.movements.map(m => m.id)).size !== source.movements.length || !source.movements.every(m => positive(m.id) && m.movementType === 'CONSUMPTION' && m.scopeTo === 'REPAIR' && m.visitId === null && m.extraVisitId === null && m.clientId === s.clientId && m.poolId === s.poolId && typeof m.quantity === 'number' && m.quantity > 0 && Number.isFinite(m.quantity) && Number.isFinite(Date.parse(m.createdAt)) && Date.parse(m.createdAt) <= Date.parse(s.endAt))) throw Error('O consumo recebido não corresponde à execução desta reparação.');
    }
    async function validatePreview(p) {
      const c = host.context(), t = host.target();
      if (!p || p.version !== 1 || p.expenseId !== editingId || p.expenseVersion !== c.expense?.version || p.kind !== kind() || p.targetType !== t?.type || p.targetId !== t?.id || p.clientId !== t?.clientId || p.targetHash !== t?.hash || !quantity(p.quantity) || !quantity(p.availableQuantity) || !positive(p.amountCents) || typeof p.label !== 'string' || !/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(p.monthRef) || !/^[a-f0-9]{64}$/.test(p.valuationHash) || p.purchaseItemId !== (kind() === 'MATERIAL' ? Number(el('valuationLot').value) : null) || !p.calculation || p.calculation.amountCents !== p.amountCents || p.calculation.quantity !== p.quantity || p.calculation.quantityUnit !== p.quantityUnit || p.calculation.method !== (kind() === 'MATERIAL' ? 'CONFIRMED_PURCHASE_LINE' : 'CONFIRMED_EXPENSE_PAID_TIME') || !quantity(p.calculation.baseQuantity) || !positive(p.calculation.baseAmountCents) || p.source?.kind !== kind()) throw Error('Valorização incompleta ou de outro contexto.');
      const { hash, ...value } = p; if (typeof hash !== 'string' || await host.hash(value) !== hash || await host.hash(p.source) !== p.valuationHash) throw Error('Os valores recebidos não correspondem à valorização confirmada.');
      if (p.targetType === 'REPAIR') { if (p.kind === 'LABOR') await work.preview(p,t,c.expense); else { repairSource(p.source, t.snapshot); if (p.source.item?.id !== p.purchaseItemId || p.source.item?.purchaseId !== c.expense.stockPurchaseId) throw Error('A compra não corresponde à reparação revista.'); } if (p.monthRef !== t.snapshot.endAt.slice(0, 7)) throw Error('O mês não corresponde à reparação revista.'); }
      return p;
    }
    async function calculate() {
      if (!active() || !host.context().canWrite || kind() === 'MANUAL') return;
      const t = host.target(); invalidate('A consultar consumo, tempo e base de custo…');
      if (!t || !['REGULAR','EXTRA','REPAIR'].includes(t.type)) { el('valuationStatus').textContent = 'Escolha e reveja um serviço com execução confirmada.'; return; }
      const rev = ++revision, captured = signature(), query = { kind: kind(), targetType: t.type, targetId: String(t.id) };
      if (kind() === 'MATERIAL') { if (!positive(Number(el('valuationLot').value))) { el('valuationStatus').textContent = 'Escolha uma linha da compra ligada à despesa.'; return; } query.purchaseItemId = el('valuationLot').value; const q = el('valuationQuantity').value.trim().replace(',', '.'); if (q) query.quantity = q; }
      if (kind() === 'LABOR' && t.type === 'REPAIR') { const row = work.selection(); if (!row) { el('valuationStatus').textContent = 'Consulte e escolha um intervalo declarado e confirmado.'; return; } query.workIntervalId = String(row.id); }
      try {
        const result = await request('/' + editingId + '/valuation-preview?' + new URLSearchParams(query));
        if (!active() || rev !== revision || captured !== signature()) return;
        const value = await validatePreview(result.preview); if (!active() || rev !== revision || captured !== signature()) return;
        preview = value; if (kind() === 'MATERIAL') el('valuationQuantity').value = value.quantity;
        el('allocationAmount').value = (value.amountCents / 100).toFixed(2); el('allocationMonth').value = value.monthRef; confirmedSelection = signature();
        node(el('valuationPreview'), 'p', value.targetType === 'REPAIR' && value.kind === 'LABOR' ? 'Intervalo declarado #' + value.workIntervalId + ' · ' + value.source.workInterval.snapshot.technicianName : value.label); node(el('valuationPreview'), 'strong', money(value.amountCents));
        node(el('valuationPreview'), 'p', kind() === 'MATERIAL' ? 'Quantidade confirmada: ' + value.quantity + ' ' + value.quantityUnit + '. Base: ' + money(value.calculation.baseAmountCents) + ' para ' + value.calculation.baseQuantity + ' ' + value.quantityUnit + '.' : (value.targetType === 'REPAIR' ? 'Tempo declarado e confirmado: ' : 'Tempo medido: ') + Number(value.quantity).toLocaleString('pt-PT') + ' segundos. Base: ' + money(value.calculation.baseAmountCents) + ' para ' + (Number(value.calculation.baseQuantity) / 60).toLocaleString('pt-PT') + ' minutos pagos.');
        el('valuationStatus').textContent = 'Mês de conclusão do serviço: ' + value.monthRef + '. Reveja a origem e justifique a confirmação. Este custo integra a despesa já registada.'; draft();
      } catch (error) { if (active() && rev === revision) invalidate(error.message); } finally { controls(); }
    }
    function submit(reason) {
      if (kind() === 'MANUAL') return false;
      if (!preview || confirmedSelection !== signature() || !el('allocationConfirmed').checked || !host.context().canWrite) throw Error('Calcule e reveja o custo atual antes de confirmar.');
      const p = preview;
      void host.execute(p.kind === 'MATERIAL' ? 'VALUE_MATERIAL' : 'VALUE_LABOR', { ...(p.workIntervalId ? { workIntervalId: p.workIntervalId } : {}), kind: p.kind, targetType: p.targetType, targetId: p.targetId, targetHash: p.targetHash, monthRef: p.monthRef, purchaseItemId: p.purchaseItemId, quantity: p.quantity, amountCents: p.amountCents, valuationHash: p.valuationHash, previewHash: p.hash, reason, confirmed: true });
      return true;
    }
    function showSummary(value) {
      if (!value || value.version !== 3 || value.coverage !== 'CONFIRMED_EXPENSE_MEASUREMENTS' || value.includedInExpenseAttribution !== true || value.completeOperatingCosts !== false || !cents(value.materialAmountCents) || !cents(value.laborAmountCents) || !count(value.count) || !count(value.reviewCount) || value.basis?.month !== 'CONFIRMED_SERVICE_EXECUTION_UTC' || value.basis?.material !== 'CONFIRMED_PURCHASE_LINE_SERVICE_CONSUMPTION' || value.basis?.repairMaterial !== 'AUTHENTICATED_REPAIR_PROOF_MOVEMENTS' || value.basis?.repairLabor !== 'CONFIRMED_DECLARED_REPAIR_INTERVAL_PAID_TIME' || value.basis?.labor !== 'CONFIRMED_EXPENSE_PAID_TIME') throw Error('Resumo de valorizações incompleto.');
      el('valuationMetrics').replaceChildren(); for (const [label, amount] of [['Consumo valorizado', value.materialAmountCents], ['Tempo valorizado', value.laborAmountCents]]) { const card = node(el('valuationMetrics'), 'div', '', 'metric'); node(card, 'span', label); node(card, 'strong', money(amount)); }
      el('valuationSummaryBasis').textContent = 'Incluídos nos montantes atribuídos acima, pelo mês de conclusão do serviço. ' + value.count + ' valorizações · ' + value.reviewCount + ' por rever. Cobertura parcial: consumos, tempos registados nas visitas e intervalos declarados de reparações com base de custo confirmada.';
    }
    async function verify(result, record) {
      const e = record.envelope, d = e.data;
      if (!result.applied) return;
      if (e.command === 'SET_LABOR_BASIS') { const b = result.laborBasis; if (!b || !positive(b.id) || b.expenseId !== e.expenseId || !['technicianId','periodStart','periodEnd','paidMinutes'].every(k => b[k] === d[k]) || result.version !== e.expectedVersion + 1) throw Error('Base de trabalho não confirmada.'); }
      if (['VALUE_MATERIAL','VALUE_LABOR'].includes(e.command)) {
        const a = result.allocation, c = result.calculation;
        if (!a || !positive(a.id) || a.expenseId !== e.expenseId || a.valuationType !== d.kind || a.targetType !== d.targetType || (a.targetType === 'REPAIR' ? a.repairId : a.targetType === 'REGULAR' ? a.visitId : a.extraVisitId) !== d.targetId || a.targetHash !== d.targetHash || a.monthRef !== d.monthRef || a.amountCents !== d.amountCents || a.quantity !== d.quantity || a.purchaseItemId !== d.purchaseItemId || a.valuationHash !== d.valuationHash || a.voidedAt !== null || !a.activeKey || result.previewHash !== d.previewHash || result.version !== e.expectedVersion + 1 || !c || c.quantity !== d.quantity || c.amountCents !== d.amountCents || c.quantityUnit !== a.quantityUnit || !a.valuationSnapshot?.source || await host.hash(a.valuationSnapshot.source) !== d.valuationHash) throw Error('A confirmação não corresponde ao custo e às fontes revistos.');
        if (a.targetType === 'REPAIR') { if (d.kind === 'LABOR') await work.receipt(a,d,e.expenseId); else repairSource(a.valuationSnapshot.source, a.targetSnapshot); if (a.clientId !== a.valuationSnapshot.source.service.clientId || a.monthRef !== a.targetSnapshot.endAt.slice(0, 7)) throw Error('O destinatário ou mês do custo de reparação não está confirmado.'); }
      }
    }
    function receipt(result, record) { if (result.applied && ['SET_LABOR_BASIS','VALUE_MATERIAL','VALUE_LABOR','VOID_COST'].includes(record.envelope.command)) { try { sessionStorage.removeItem('cw-valuation-draft:' + host.owner() + ':' + record.envelope.expenseId); } catch {} editingId = null; } }
    el('valuationKind').addEventListener('change', () => { invalidate(); controls(); draft(); });
    for (const id of ['valuationQuantity','valuationLot']) el(id).addEventListener('input', () => { invalidate(); draft(); });
    el('valuationCalculate').addEventListener('click', () => void calculate());
    el('laborBasisForm').addEventListener('input', event => { if (event.target.id !== 'laborBasisConfirmed') el('laborBasisConfirmed').checked = false; wantedTechnician = el('laborTechnician').value || wantedTechnician; draft(); });
    el('laborTechniciansRefresh').addEventListener('click', () => void loadTechnicians());
    el('laborBasisForm').addEventListener('submit', event => { event.preventDefault(); try {
      const technicianId = Number(el('laborTechnician').value), paidMinutes = Number(el('laborPaidMinutes').value), reason = el('laborBasisReason').value.trim();
      if (!active() || !host.context().canWrite || !el('laborBasisConfirmed').checked || !positive(paidMinutes) || !technicians.some(t => t.id === technicianId) || !reason) throw Error('Reveja o técnico, tempo, período e documento antes de confirmar.');
      void host.execute('SET_LABOR_BASIS', { technicianId, paidMinutes, periodStart: el('laborPeriodStart').value, periodEnd: el('laborPeriodEnd').value, reason, confirmed: true });
    } catch (error) { note(error.message); } });
    function observe() { work.sync(); if (preview && confirmedSelection !== signature()) invalidate('A seleção mudou. Calcule novamente antes de confirmar.'); }
    return { render, clear, controls, draft, invalidate, submit, showSummary, verify, receipt, observe };
  } };
})();
