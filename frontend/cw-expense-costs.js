(function () {
  'use strict';
  window.CWExpenseCosts = { create(host) {
    const { el, node, button, money, amount, request, active, note } = host;
    const types = { COMPANY: 'Custos gerais da empresa', CLIENT: 'Cliente', REGULAR: 'Visita regular', EXTRA: 'Visita extra', REPAIR: 'Reparação', MAINTENANCE_EQUIPMENT: 'Manutenção de equipamento', MAINTENANCE_REMINDER: 'Lembrete de serviço' };
    const maintenance = window.CWExpenseMaintenance, serviceTypes = ['REGULAR','EXTRA','REPAIR',...maintenance.types];
    const positive = n => Number.isSafeInteger(n) && n > 0, count = n => Number.isSafeInteger(n) && n >= 0, cents = n => n === null || count(n);
    const validMonth = s => /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(s), key = id => 'cw-cost-draft:' + host.owner() + ':' + id;
    let revision = 0, pickerRevision = 0, reportPage = 1, reportTotal = 0, pickerPage = 1, pickerTotal = 0, chosen = null, client = null, editingId = null;
    let view = { mode: 'CLIENTS' }, label = '', reportSelection = '', pickerSelection = '';
    const period = window.CWExpenseCostPeriod.create(host);
    const valuation = window.CWExpenseValuation.create({ ...host, target: () => chosen });
    function context() { const c = host.context(); return { ...c, stamp: c.epoch + ':' + c.detailEpoch + ':' + c.expense?.id }; }
    function validTarget(t) { if (!t || !types[t.type] || !(t.type === 'COMPANY' ? t.id === null && t.clientId === null : positive(t.id) && positive(t.clientId)) || t.valid !== true || !/^[a-f0-9]{64}$/.test(t.hash) || typeof t.label !== 'string') throw Error('Destino não confirmado.'); return t; }
    function repairFacts(t) {
      const s = t.snapshot;
      if (!s || s.type !== 'REPAIR' || s.id !== t.id || s.clientId !== t.clientId || !positive(s.poolId) || s.status !== 'CONFIRMED' || s.startAt !== null || typeof s.endAt !== 'string' || !Number.isFinite(Date.parse(s.endAt)) || new Date(s.endAt).toISOString() !== s.endAt || s.executionBasis !== 'EXPLICIT_AUTHENTICATED_REPAIR_COMPLETION' || !positive(s.executionProofId) || !/^[a-f0-9]{64}$/.test(s.executionFingerprint) || !['NONE','RESERVED'].includes(s.materialMode) || s.label !== t.label || s.clientName !== t.clientName) throw Error('Execução da reparação não confirmada.');
      return Object.fromEntries(['type','id','clientId','poolId','status','startAt','endAt','executionBasis','executionProofId','executionFingerprint','materialMode'].map(k => [k, s[k]]));
    }
    async function verifiedTarget(t) { validTarget(t); if (t.type === 'REPAIR' && await host.hash(repairFacts(t)) !== t.hash) throw Error('A execução recebida não corresponde à reparação selecionada.'); if(maintenance.types.includes(t.type)) await maintenance.verifyTarget(t,host.hash); return t; }
    function capture() { return { ...view, monthRef: el('expenseMonth').value, q: el('costSearch').value.trim(), page: reportPage }; }
    const normalized = q => ({ monthRef: q.monthRef, mode: q.mode, clientId: q.clientId || null, targetType: q.targetType || null, targetId: q.targetId || null, q: q.q, page: q.page });
    function controls() {
      const c = context(); el('costRefresh').disabled = !c.canRead; el('costHome').disabled = !c.canRead;
      el('costPrevious').disabled = !c.canRead || reportPage <= 1; el('costNext').disabled = !c.canRead || reportPage * 10 >= reportTotal;
      for (const id of ['allocationRefresh', 'allocationChangeClient']) el(id).disabled = !c.canWrite;
      el('allocationPrevious').disabled = !c.canWrite || pickerPage <= 1; el('allocationNext').disabled = !c.canWrite || pickerPage * 10 >= pickerTotal;
      el('costSearch').disabled = !c.canRead;
      document.querySelectorAll('#allocationForm input,#allocationForm select,#allocationForm textarea').forEach(n => n.disabled = !c.canWrite); valuation.controls(); period.controls();
    }
    function draft() {
      valuation.draft();
      if (!active() || !editingId || el('allocationBox').hidden || context().expense?.id !== editingId) return;
      try { sessionStorage.setItem(key(editingId), JSON.stringify({ type: el('allocationType').value, monthRef: el('allocationMonth').value, amount: el('allocationAmount').value, reason: el('allocationReason').value, chosen, client })); } catch { note('O rascunho da atribuição não pôde ser guardado.'); }
    }
    function clear() {
      draft(); valuation.clear(); period.clear(); revision++; pickerRevision++; chosen = client = null; editingId = null;
      for (const id of ['costMetrics', 'costRows', 'costBasis', 'costStatus', 'allocationRows', 'allocationTargets', 'allocationTarget', 'allocationBasis', 'allocationPickerStatus']) el(id).replaceChildren();
      el('allocationForm').reset(); el('allocationBox').hidden = true; reportTotal = pickerTotal = 0;
      if (!context().canRead) { view = { mode: 'CLIENTS' }; label = ''; el('costSearch').value = ''; }
    }
    function summary(s, monthRef) {
      if (!s || s.version !== 1 || s.monthRef !== monthRef || s.currency !== 'EUR' || !Number.isFinite(Date.parse(s.generatedAt)) || !['READY', 'REVIEW'].includes(s.state) || s.coverage !== 'REGISTERED_EXPENSE_ATTRIBUTION' || s.completeOperatingCosts !== false || s.profit !== null || s.limitApplied !== null || s.basis?.allocated !== 'EXPLICIT_ALLOCATION_MONTH' || s.basis?.unallocated !== 'CURRENT_EXPENSE_REMAINDER_ALL_MONTHS' || s.basis?.stock !== 'PURCHASE_ATTRIBUTION_NOT_CONSUMPTION' || !['allocatedAmountCents','clientAmountCents','companyAmountCents','unallocatedAmountCents','stockPurchaseAmountCents'].every(k => cents(s[k])) || !['allocationCount','reviewCount','unallocatedExpenseCount','unallocatedReviewCount','clientCount'].every(k => count(s[k])) || s.state === 'READY' && ['allocatedAmountCents','clientAmountCents','companyAmountCents','unallocatedAmountCents'].some(k => s[k] === null)) throw Error('Resumo da atribuição de custos incompleto.');
      return s;
    }
    async function load(force = false) {
      if (!active() || !force && !context().canRead) return;
      const rev = ++revision, epoch = context().epoch, query = capture(); reportSelection = JSON.stringify(query);
      for (const id of ['costMetrics', 'costRows', 'costBasis', 'valuationMetrics', 'valuationSummaryBasis']) el(id).replaceChildren(); el('costStatus').textContent = 'A consultar atribuições…';
      try {
        const result = await request('/costs?' + new URLSearchParams(query));
        if (!active() || rev !== revision || epoch !== context().epoch || reportSelection !== JSON.stringify(capture())) return;
        if (JSON.stringify(result.selection) !== JSON.stringify(normalized(query)) || result.pageSize !== 10 || !count(result.total) || !Array.isArray(result.rows) || result.rows.length > 10) throw Error('Atribuições de outro contexto ou incompletas.');
        const s = summary(result.summary, query.monthRef); valuation.showSummary(s.valuations); reportTotal = result.total;
        for (const [title, value] of [['Atribuído no mês', s.allocatedAmountCents], ['A clientes e serviços', s.clientAmountCents], ['Custos gerais no mês', s.companyAmountCents], ['Por atribuir agora · todos os meses', s.unallocatedAmountCents]]) { const box = node(el('costMetrics'), 'div', '', 'metric'); node(box, 'span', title); node(box, 'strong', money(value)); }
        el('costBasis').textContent = 'Mês da atribuição: ' + s.monthRef + ' · Consulta: ' + new Date(s.generatedAt).toLocaleString('pt-PT') + '. Totais de todas as atribuições do mês, independentemente da pesquisa abaixo. ' + s.reviewCount + ' atribuições por rever. Compras de stock atribuídas: ' + money(s.stockPurchaseAmountCents) + '; o consumo valorizado é discriminado abaixo.';
        el('costStatus').textContent = (label || 'Clientes e custos gerais') + ' · ' + result.total + ' resultados · Página ' + reportPage + '. ' + (s.state === 'REVIEW' ? 'Existem valores por confirmar.' : 'Atribuições consultadas.');
        for (const row of result.rows) {
          if (typeof row.label !== 'string' || !cents(row.amountCents) || !(row.clientId === null || positive(row.clientId))) throw Error('Linha de custos inválida.');
          const card = node(el('costRows'), 'article', ''); node(card, 'h3', row.label); node(card, 'p', money(row.amountCents));
          if (query.mode === 'ALLOCATIONS') {
            if (!positive(row.id) || !positive(row.expenseId) || row.monthRef !== query.monthRef || row.clientId !== (query.clientId === 'COMPANY' ? null : Number(query.clientId)) || row.targetType !== query.targetType || (row.targetId || 0) !== Number(query.targetId) || typeof row.needsReview !== 'boolean') throw Error('Atribuição não confirmada para este destino.');
            node(card, 'p', row.targetLabel + ' · ' + (row.needsReview ? 'Por rever' : 'Atribuição confirmada')); node(card, 'p', row.reason); button(card, 'Abrir despesa #' + row.expenseId, () => host.openExpense(row.expenseId));
          } else {
            if (!count(row.allocationCount) || !count(row.reviewCount)) throw Error('Totais por destino incompletos.');
            node(card, 'p', row.allocationCount + ' atribuições · ' + row.reviewCount + ' por rever');
            if (query.mode === 'CLIENTS') button(card, 'Ver destinos', () => navigate({ mode: 'TARGETS', clientId: row.clientId === null ? 'COMPANY' : String(row.clientId) }, row.label));
            else { if (row.clientId !== (query.clientId === 'COMPANY' ? null : Number(query.clientId)) || !types[row.targetType] || !(row.targetType === 'COMPANY' ? row.targetId === null : positive(row.targetId))) throw Error('Destino inválido.'); button(card, 'Ver despesas atribuídas', () => navigate({ ...view, mode: 'ALLOCATIONS', targetType: row.targetType, targetId: String(row.targetId || 0) }, row.label)); }
          }
        }
        if (!result.total) node(el('costRows'), 'p', 'Não há atribuições para esta seleção.');
      } catch (error) { if (active() && rev === revision && epoch === context().epoch) { for (const id of ['costMetrics', 'costRows', 'costBasis', 'valuationMetrics', 'valuationSummaryBasis']) el(id).replaceChildren(); reportTotal = 0; el('costStatus').textContent = error.name === 'AbortError' ? 'A consulta demorou demasiado. Tente novamente.' : error.message; } }
      finally { controls(); }
    }
    async function navigate(next, title) { view = next; label = title; reportPage = 1; el('costSearch').value = ''; await load(); }
    function picked() { valuation.invalidate(); el('allocationTarget').textContent = chosen ? chosen.label + (chosen.clientName && chosen.type !== 'CLIENT' ? ' · ' + chosen.clientName : '') + '. ' + chosen.warning : client ? 'Cliente: ' + client.label + '. Escolha o serviço concluído.' : 'Escolha e reveja o destino.'; el('allocationConfirmed').checked = false; draft(); }
    async function choose(row) {
      const rev = ++pickerRevision, stamp = context().stamp;
      const result = await request('/targets/' + row.type + '/' + (row.id || 0));
      if (!active() || rev !== pickerRevision || stamp !== context().stamp || el('allocationBox').hidden) return;
      const value = await verifiedTarget(result.target);
      if (!active() || rev !== pickerRevision || stamp !== context().stamp || el('allocationBox').hidden) return;
      pickerSelection = ''; if (value.type !== row.type || value.id !== row.id) throw Error('Destino diferente do selecionado.');
      if (value.type === 'CLIENT' && serviceTypes.includes(el('allocationType').value)) { client = value; chosen = null; pickerPage = 1; el('allocationSearch').value = ''; picked(); await lookup(); }
      else { if (value.type !== el('allocationType').value || serviceTypes.includes(value.type) && value.clientId !== client?.id) throw Error('O destino já não corresponde ao cliente selecionado.'); chosen = value; if (value.type === 'CLIENT') client = value; el('allocationTargets').replaceChildren(); pickerTotal = 0; picked(); controls(); }
    }
    async function lookup() {
      if (!active() || !context().canWrite || !editingId) return;
      const rev = ++pickerRevision, stamp = context().stamp, type = el('allocationType').value, q = el('allocationSearch').value.trim(), page = pickerPage;
      pickerSelection = JSON.stringify([type, q, client?.id || null, page]); el('allocationTargets').replaceChildren();
      if (type === 'COMPANY') { await choose({ type, id: null }); return; }
      const queryType = type === 'CLIENT' || !client ? 'CLIENT' : type, query = { type: queryType, q, page: String(page), ...(queryType === 'CLIENT' ? {} : { clientId: String(client.id) }) };
      el('allocationPickerStatus').textContent = queryType === 'CLIENT' ? 'A procurar clientes…' : 'A procurar serviços concluídos…';
      try {
        const result = await request('/targets?' + new URLSearchParams(query));
        if (!active() || rev !== pickerRevision || stamp !== context().stamp || pickerSelection !== JSON.stringify([el('allocationType').value, el('allocationSearch').value.trim(), client?.id || null, pickerPage])) return;
        if (result.type !== queryType || result.q !== q || result.page !== page || result.clientId !== (queryType === 'CLIENT' ? null : client.id) || result.pageSize !== 10 || !count(result.total) || !Array.isArray(result.rows) || result.rows.length > 10) throw Error('Destinos não confirmados.');
        for (const row of result.rows) { await verifiedTarget(row); if (row.type !== queryType || queryType !== 'CLIENT' && row.clientId !== Number(query.clientId)) throw Error('Destino de outro cliente ou serviço.'); }
        if (!active() || rev !== pickerRevision || stamp !== context().stamp || pickerSelection !== JSON.stringify([el('allocationType').value, el('allocationSearch').value.trim(), client?.id || null, pickerPage])) return;
        pickerTotal = result.total; el('allocationPickerStatus').textContent = result.total + ' resultados · Página ' + page;
        for (const row of result.rows) { validTarget(row); const box = node(el('allocationTargets'), 'article', ''); node(box, 'p', row.label); button(box, queryType === 'CLIENT' && type !== 'CLIENT' ? 'Escolher cliente' : 'Rever destino', () => choose(row), true); }
      } catch (error) { if (active() && rev === pickerRevision && stamp === context().stamp) el('allocationPickerStatus').textContent = error.message; } finally { host.controls(); }
    }
    async function review(allocation) {
      const stamp = context().stamp, rev = ++pickerRevision, id = editingId;
      const result = await request('/targets/' + allocation.targetType + '/' + (allocation.targetId || 0));
      if (!active() || rev !== pickerRevision || stamp !== context().stamp || id !== editingId) return;
      const target = await verifiedTarget(result.target);
      if (!active() || rev !== pickerRevision || stamp !== context().stamp || id !== editingId) return;
      if (target.type !== allocation.targetType || target.id !== allocation.targetId) throw Error('Destino diferente do selecionado.');
      if (target.clientId !== allocation.clientId) throw Error('O cliente mudou. Anule a atribuição anterior antes de a registar para outro cliente.');
      const reason = prompt('Reviu ' + target.label + ' e o documento da despesa. Indique o motivo da confirmação:');
      if (reason?.trim() && active() && stamp === context().stamp) await host.execute('REVIEW_COST', { allocationId: allocation.id, targetHash: target.hash, reason: reason.trim(), confirmed: true });
    }
    function render(expense) {
      if (!Array.isArray(expense.allocations) || !cents(expense.allocatedCents) || !cents(expense.unallocatedCents) || !count(expense.allocationReviewCount)) throw Error('Atribuições da despesa incompletas.');
      period.clear(); editingId = expense.id; chosen = client = null; pickerRevision++; pickerPage = 1; pickerTotal = 0;
      el('allocationRows').replaceChildren(); el('allocationTargets').replaceChildren(); el('allocationForm').reset(); el('allocationType').value = 'CLIENT'; el('allocationMonth').value = expense.expenseDate.slice(0, 7); el('allocationAmount').value = expense.unallocatedCents > 0 ? (expense.unallocatedCents / 100).toFixed(2) : '';
      try { const saved = JSON.parse(sessionStorage.getItem(key(expense.id))); if (saved && types[saved.type]) { el('allocationType').value = saved.type; el('allocationMonth').value = saved.monthRef || ''; el('allocationAmount').value = saved.amount || ''; el('allocationReason').value = saved.reason || ''; chosen = saved.chosen; client = saved.client; if (chosen) validTarget(chosen); } } catch { chosen = client = null; }
      el('allocationBox').hidden = !!expense.cancelledAt; el('allocationBasis').textContent = 'Atribuído, em todos os meses: ' + money(expense.allocatedCents) + ' · Por atribuir: ' + money(expense.unallocatedCents) + '. ' + expense.allocationReviewCount + ' atribuições por rever.'; valuation.render(expense); picked();
      for (const a of expense.allocations) {
        if (!positive(a.id) || a.expenseId !== expense.id || !positive(a.amountCents) || !validMonth(a.monthRef) || !types[a.targetType] || typeof a.targetLabel !== 'string' || typeof a.needsReview !== 'boolean') throw Error('Histórico de atribuições incompleto.');
        if (maintenance.types.includes(a.targetType)) { const t=maintenance.allocation(a); if(a.targetId!==t.id)throw Error('Identidade da manutenção incompleta.'); maintenance.facts(t); }
        if (a.targetType === 'REPAIR') {
          if (!positive(a.repairId) || a.targetId !== a.repairId || !positive(a.clientId) || a.visitId !== null || a.extraVisitId !== null || !['MANUAL','MATERIAL','LABOR'].includes(a.valuationType)) throw Error('Histórico da reparação incompleto.');
          repairFacts({ id: a.repairId, clientId: a.clientId, label: a.targetLabel, clientName: a.targetSnapshot?.clientName, snapshot: a.targetSnapshot });
        }
        const row = node(el('allocationRows'), 'div', '', 'row'); row.dataset.allocationId = a.id; node(row, 'strong', a.targetLabel + (a.clientName && a.targetType !== 'CLIENT' ? ' · ' + a.clientName : '')); node(row, 'p', a.monthRef + ' · ' + money(a.amountCents) + ' · ' + (a.voidedAt ? 'Anulada' : a.needsReview ? 'Por rever' : 'Confirmada')); node(row, 'p', a.voidReason || a.reason);
        if (a.stockPurchase && a.valuationType === 'MANUAL') node(row, 'p', 'Atribuição de compra de stock; não comprova o consumo.');
        if (a.targetType === 'REPAIR' && a.valuationType === 'LABOR') { const w = a.valuationSnapshot?.source.workInterval, t = w?.snapshot; if (!positive(w?.id) || t?.repairId !== a.repairId || t?.clientId !== a.clientId || !positive(t?.technicianId)) throw Error('Intervalo de trabalho histórico incompleto.'); node(row, 'p', 'Intervalo declarado #' + w.id + ' · ' + t.technicianName + ' · ' + window.CWRepairLabor.formatTime(t.startedAt) + ' a ' + window.CWRepairLabor.formatTime(t.endedAt)); }
        if (a.valuationType !== 'MANUAL') { node(row, 'p', (a.valuationType === 'MATERIAL' ? 'Consumo valorizado: ' : 'Tempo valorizado: ') + a.quantity + ' ' + (a.quantityUnit === 'SECOND' ? 'segundos' : a.quantityUnit)); if (a.needsReview) node(row, 'p', 'A origem mudou. Anule e calcule novamente para confirmar o novo custo.'); }
        if (a.valuationSnapshot?.source?.laborDistribution) { const d=a.valuationSnapshot.source.laborDistribution,p=d.snapshot?.parts?.find(p=>p.index===d.partIndex); if(!positive(d.id)||!p)throw Error('Parcela histórica incompleta.');node(row,'p','Repartição #'+d.id+' · Parcela '+p.index+' · '+p.technicianName+' · '+p.periodStart+' a '+p.periodEnd+' · Base '+money(p.amountCents)+' / '+p.paidMinutes+' minutos pagos'); }
        if (a.laborCostGroupId || a.valuationSnapshot?.composition) { const link = node(row, 'a', 'Consultar custo composto'); const basisId = a.laborCostBasisId || a.valuationSnapshot?.composition?.basisId; link.href = '/labor-cost-bases' + (positive(basisId) ? '?basisId=' + basisId : ''); }
        else if (!a.voidedAt) { if (a.valuationType === 'MANUAL' && !a.needsReview && serviceTypes.includes(a.targetType) && validMonth(a.targetSnapshot?.endAt?.slice(0, 7)) && a.monthRef !== a.targetSnapshot.endAt.slice(0, 7)) { node(row, 'p', 'Execução em ' + a.targetSnapshot.endAt.slice(0, 7) + ' (UTC): mês diferente da atribuição.'); button(row, 'Rever correção do mês', () => period.review(a), true); } if (a.needsReview && a.valuationType === 'MANUAL') button(row, 'Rever atribuição', () => review(a), true); button(row, 'Anular atribuição', async () => { const stamp = context().stamp, reason = prompt('Motivo da correção desta atribuição. Os pagamentos mantêm-se:'); if (reason?.trim() && stamp === context().stamp && active()) await host.execute('VOID_COST', { allocationId: a.id, reason: reason.trim() }); }, true); }
      }
    }
    function receipt(result, record) { valuation.receipt(result, record); period.receipt(result, record); if (result.applied && ['ALLOCATE_COST','REVIEW_COST','VOID_COST','SET_LABOR_BASIS','VALUE_MATERIAL','VALUE_LABOR'].includes(record.envelope.command)) { try { sessionStorage.removeItem(key(record.envelope.expenseId)); } catch {} editingId = null; } }
    el('allocationForm').addEventListener('submit', async event => { event.preventDefault(); try {
      if (!active() || !context().canWrite || editingId !== context().expense?.id || !chosen || !el('allocationConfirmed').checked || chosen.type !== el('allocationType').value || !validMonth(el('allocationMonth').value)) throw Error('Reveja o destino, mês e montante antes de confirmar.');
      const stamp = context().stamp, selected = chosen, signature = () => JSON.stringify([el('allocationType').value, el('allocationMonth').value, el('allocationAmount').value, el('allocationReason').value, el('valuationKind').value]), captured = signature();
      if (selected.type === 'REPAIR' || maintenance.types.includes(selected.type)) await verifiedTarget(selected);
      if (!active() || !context().canWrite || stamp !== context().stamp || selected !== chosen || signature() !== captured || !el('allocationConfirmed').checked) return;
      const reason = el('allocationReason').value.trim(); if (!reason) throw Error('Explique como confirmou esta atribuição.');
      if (valuation.submit(reason)) return;
      void host.execute('ALLOCATE_COST', { monthRef: el('allocationMonth').value, amountCents: amount(el('allocationAmount').value), targetType: chosen.type, targetId: chosen.id, targetHash: chosen.hash, reason, confirmed: true });
    } catch (error) { note(error.message); } });
    el('allocationForm').addEventListener('input', draft);
    el('allocationType').addEventListener('change', () => { pickerRevision++; chosen = client = null; pickerPage = 1; pickerTotal = 0; el('allocationTargets').replaceChildren(); picked(); host.controls(); });
    el('allocationSearch').addEventListener('input', () => { pickerRevision++; chosen = null; pickerPage = 1; pickerTotal = 0; el('allocationTargets').replaceChildren(); picked(); controls(); });
    el('allocationRefresh').addEventListener('click', () => void lookup().catch(e => { if (active()) note(e.message); }));
    el('allocationChangeClient').addEventListener('click', () => { pickerRevision++; client = chosen = null; pickerPage = 1; el('allocationSearch').value = ''; picked(); void lookup(); });
    el('allocationPrevious').addEventListener('click', () => { pickerPage--; void lookup(); }); el('allocationNext').addEventListener('click', () => { pickerPage++; void lookup(); });
    el('costRefresh').addEventListener('click', () => void load()); el('costHome').addEventListener('click', () => void navigate({ mode: 'CLIENTS' }, ''));
    el('costSearch').addEventListener('input', () => { revision++; reportPage = 1; reportTotal = 0; el('costRows').replaceChildren(); el('costStatus').textContent = 'Consulte a pesquisa selecionada.'; controls(); });
    el('costPrevious').addEventListener('click', () => { reportPage--; void load(); }); el('costNext').addEventListener('click', () => { reportPage++; void load(); });
    function observe() {
      valuation.observe(); period.observe();
      if (reportSelection && reportSelection !== JSON.stringify(capture())) { revision++; reportSelection = ''; reportPage = 1; reportTotal = 0; el('costRows').replaceChildren(); el('costStatus').textContent = 'Consulte a seleção atual.'; }
      if (pickerSelection && pickerSelection !== JSON.stringify([el('allocationType').value, el('allocationSearch').value.trim(), client?.id || null, pickerPage])) { pickerRevision++; pickerSelection = ''; el('allocationTargets').replaceChildren(); }
    }
    async function verify(result, record) {
      await valuation.verify(result, record); await period.verify(result, record); await maintenance.receipt(result,record,host.hash);
      const e = record.envelope, a = result.allocation;
      if (!result.applied || !['ALLOCATE_COST','REVIEW_COST','VOID_COST','VALUE_MATERIAL','VALUE_LABOR'].includes(e.command) || a?.targetType !== 'REPAIR') return;
      if (!['MANUAL','MATERIAL','LABOR'].includes(a.valuationType) || ['ALLOCATE_COST','REVIEW_COST'].includes(e.command) && a.valuationType !== 'MANUAL' || !positive(a.repairId) || !positive(a.clientId) || a.visitId !== null || a.extraVisitId !== null || result.version !== e.expectedVersion + 1) throw Error('Atribuição da reparação não confirmada.');
      await verifiedTarget({ type: a.targetType, id: a.repairId, clientId: a.clientId, valid: true, hash: a.targetHash, label: a.targetSnapshot?.label, clientName: a.targetSnapshot?.clientName, snapshot: a.targetSnapshot });
      if (e.command !== 'VOID_COST' && (a.voidedAt !== null || !a.activeKey)) throw Error('Atribuição da reparação não está ativa.');
      if (e.command === 'VOID_COST' && a.valuationType === 'LABOR' && (a.activeMeasurementKey !== null || await host.hash(a.valuationSnapshot) !== await host.hash(result.allocationBefore?.valuationSnapshot))) throw Error('O intervalo ou as fontes da anulação mudaram.');
      if (['REVIEW_COST','VOID_COST'].includes(e.command) && !['id','expenseId','clientId','targetType','repairId','monthRef','amountCents','valuationType','purchaseItemId','quantity','quantityUnit','valuationHash','valuationKey'].every(k => a[k] === result.allocationBefore?.[k])) throw Error('A reparação, o cliente ou o período da atribuição mudou.');
    }
    return { clear, render, controls, load, receipt, draft, observe, verify };
  } };
})();
