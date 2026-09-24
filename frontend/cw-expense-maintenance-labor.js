(function () {
  'use strict';
  const commands = ['SHARE_MAINTENANCE_LABOR','VOID_MAINTENANCE_LABOR_SHARE'], basis = 'CONFIRMED_PARENT_COST_TIME_SHARE';
  const fields = ['id','expenseId','monthRef','amountCents','targetType','clientId','visitId','extraVisitId','repairId','maintenanceCompletionId','serviceReminderId','targetHash','targetSnapshot','expenseHash','expenseSnapshot','activeKey','reason','createdById','createdAt','reviewedAt','voidedAt','voidReason','valuationType','valuationKey','valuationHash','valuationSnapshot','quantity','quantityUnit','purchaseItemId','activeMeasurementKey'];
  const positive = n => Number.isSafeInteger(n) && n > 0, count = n => Number.isSafeInteger(n) && n >= 0, iso = s => typeof s === 'string' && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
  const workIntervals=w=>w?.schema===2?w.intervals:[{startAt:w?.startAt,endAt:w?.endAt}];
  function soundTime(w){
    if(w?.schema===1)return w.basis==='DECLARED_EQUIPMENT_WORK_INTERVAL'&&iso(w.startAt)&&iso(w.endAt)&&w.durationMs===Date.parse(w.endAt)-Date.parse(w.startAt)&&positive(w.durationMs);
    return w?.schema===2&&w.basis==='DECLARED_EQUIPMENT_WORK_INTERVALS'&&Object.keys(w).length===5&&Array.isArray(w.intervals)&&w.intervals.length>0&&w.intervals.length<=20&&w.intervals.every((t,i,a)=>t&&Object.keys(t).length===3&&iso(t.startAt)&&iso(t.endAt)&&positive(t.durationMs)&&t.durationMs===Date.parse(t.endAt)-Date.parse(t.startAt)&&(!i||Date.parse(t.startAt)>=Date.parse(a[i-1].endAt)))&&positive(w.durationMs)&&w.durationMs===w.intervals.reduce((n,t)=>n+t.durationMs,0);
  }
  window.CWExpenseMaintenanceLabor = { create(host) {
    const { el, node, button, money, hash, active, note } = host;
    let revision = 0, stamp = '', selected = null, preview = null, voiding = null, page = 1, total = 0, reminderMode = false;
    const context = () => { const c = host.context(); return { ...c, stamp: c.epoch + ':' + c.detailEpoch + ':' + c.expense?.id }; };
    const key = (expenseId, allocationId, id, operation) => 'cw-maintenance-labor-draft:' + host.owner() + ':' + expenseId + ':' + allocationId + ':' + id + ':' + operation;
    const draftKey = () => preview ? key(preview.expenseId, preview.allocationId, preview.reminderId === undefined ? preview.completionId : 'REMINDER:' + preview.reminderId, 'share') : voiding ? key(voiding.share.expenseId, voiding.share.allocationId, voiding.share.id, 'void') : null;
    function draft() { if (!active() || stamp !== context().stamp || !draftKey()) return; try { sessionStorage.setItem(draftKey(), el('maintenanceLaborReason').value); } catch { note('O motivo não pôde ser guardado neste navegador.'); } }
    function picker(visible) { el('maintenanceLaborTypeBox').hidden = !visible; el('maintenanceLaborCandidates').hidden = !visible; el('maintenanceLaborPrevious').hidden = !visible; el('maintenanceLaborNext').hidden = !visible; el('maintenanceLaborChange').hidden = visible || !!voiding; }
    function clear() { picker(true); revision++; selected = preview = voiding = null; stamp = ''; page = 1; total = 0; reminderMode = false; el('maintenanceLaborType').value = 'MAINTENANCE_EQUIPMENT'; el('maintenanceLaborBox').hidden = true; el('maintenanceLaborCandidates').replaceChildren(); el('maintenanceLaborFacts').replaceChildren(); el('maintenanceLaborStatus').textContent = ''; el('maintenanceLaborForm').reset(); }
    function controls() {
      const c = context();
      el('maintenanceLaborType').disabled = !c.canWrite || stamp !== c.stamp;
      for (const n of el('maintenanceLaborForm').querySelectorAll('input,textarea,button')) n.disabled = !c.canWrite || !(preview || voiding) || stamp !== c.stamp;
      el('maintenanceLaborPrevious').disabled = !c.canWrite || page <= 1 || !!voiding;
      el('maintenanceLaborChange').disabled = !c.canWrite;
      el('maintenanceLaborNext').disabled = !c.canWrite || page * 10 >= total || !!voiding;
    }
    async function verifyPreview(p, expenseId, version, allocation) {
      if ([2,3].includes(p?.version)) {
        await window.CWReminderVisitCostRules.verify(p, hash, allocation);
        if (p.expenseId !== expenseId || version !== null && p.expenseVersion !== version) throw Error('A parcela não corresponde à despesa selecionada.');
        return p;
      }
      const { available, hash: signature, ...value } = p || {}, a = p?.allocationBefore, w = p?.workTime, t = p?.target, u = p?.used;
      if (available !== true || p.version !== (p.workTimeRevision!==undefined?5:w?.schema===2?4:1) || p.basis !== basis || p.expenseId !== expenseId || version !== null && p.expenseVersion !== version || !positive(p.expenseVersion) || !positive(p.allocationId) || !positive(p.completionId) || !a || a.id !== p.allocationId || a.expenseId !== expenseId || a.valuationType !== 'LABOR' || !['REGULAR','EXTRA'].includes(a.targetType) || a.quantityUnit !== 'SECOND' || a.voidedAt !== null || a.monthRef !== p.monthRef || !positive(a.amountCents) || !positive(p.parentDurationMs) || !positive(p.amountCents) || !count(p.remainingAmountCents) || !count(p.remainingDurationMs) || !count(u?.durationMs) || !count(u.amountCents) || !Array.isArray(u.shares) || !soundTime(w) || !iso(a.targetSnapshot?.startAt) || !iso(a.targetSnapshot.endAt) || a.targetSnapshot.endAt.slice(0, 7) !== p.monthRef || workIntervals(w).some(t=>t.startAt<a.targetSnapshot.startAt||t.endAt>a.targetSnapshot.endAt) || t?.type !== 'MAINTENANCE_EQUIPMENT' || t.id !== p.completionId || t.clientId !== a.clientId || t.snapshot?.endAt?.slice(0, 7) !== p.monthRef) throw Error('Repartição do trabalho não confirmada.');
      const parentId = a.targetType === 'REGULAR' ? a.visitId : a.extraVisitId;
      if (!positive(parentId) || w.origin?.visitType !== a.targetType || w.origin.visitId !== parentId || w.origin.clientId !== a.clientId || w.origin.poolId !== t.snapshot.poolId || !positive(w.origin.technicianId) || w.origin.technicianId!==a.valuationSnapshot?.source?.service?.technicianId || t.snapshot.originVisitType !== a.targetType || t.snapshot.originVisitId !== parentId || u.durationMs + w.durationMs > p.parentDurationMs) throw Error('A manutenção não corresponde à visita e ao tempo selecionados.');
      const final = u.durationMs + w.durationMs === p.parentDurationMs;
      const expected = final ? a.amountCents - u.amountCents : Number((BigInt(a.amountCents) * BigInt(w.durationMs) * 2n + BigInt(p.parentDurationMs)) / (2n * BigInt(p.parentDurationMs)));
      const [whole, fraction = ''] = String(a.quantity).split('.');
      if (!/^\d+(\.\d{1,6})?$/.test(String(a.quantity)) || BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0')) !== BigInt(p.parentDurationMs) * 1000n || p.amountCents !== expected || p.rounding !== (final ? 'FINAL_PARENT_REMAINDER' : 'NEAREST_CENT') || p.remainingAmountCents !== a.amountCents - u.amountCents - expected || p.remainingDurationMs !== p.parentDurationMs - u.durationMs - w.durationMs || await hash(value) !== signature || await hash(a) !== p.allocationHash || await hash(w) !== p.workTimeHash || allocation && await hash(Object.fromEntries(fields.map(k => [k, allocation[k]]))) !== p.allocationHash) throw Error('O cálculo não corresponde à parcela selecionada.');
      if(p.workTimeRevision!==undefined)await window.CWEquipmentTimeReviewRules.share(p,hash);
      await window.CWExpenseMaintenance.verifyTarget(t, hash); return p;
    }
    function showFacts(p, removing = false) {
      const facts = el('maintenanceLaborFacts'); facts.replaceChildren();
      node(facts, 'strong', p.target.label + ' · ' + p.target.clientName);
      node(facts, 'p', 'Origem: ' + p.allocationBefore.targetSnapshot.label + ' · Despesa #' + p.expenseId + ' · Atribuição #' + p.allocationId);
      node(facts, 'p', 'Tempo deste serviço: ' + (p.workTime.durationMs / 1000) + ' s · Tempo valorizado da visita: ' + (p.parentDurationMs / 1000) + ' s · ' + p.monthRef + ' (UTC)');
      if (p.workTime.schema === 2) {
        for (const [i,w] of p.workTime.intervals.entries()) node(facts, 'p', 'Intervalo '+(i+1)+': '+w.startAt+' → '+w.endAt+' · '+(w.durationMs/1000)+' s (UTC)');
        node(facts, 'p', 'As pausas entre intervalos ficam excluídas da duração e do custo.');
      }
      if(p.workTimeRevision)node(facts,'p','Tempos corrigidos pela administração: '+p.workTimeRevision.revision.owner+' · '+new Date(p.workTimeRevision.revision.createdAt).toLocaleString('pt-PT')+' · '+p.workTimeRevision.revision.reason);
      node(facts, 'p', 'Custo original: ' + money(p.allocationBefore.amountCents) + ' · Já repartido: ' + money(p.used.amountCents));
      node(facts, 'strong', (removing ? 'Valor a devolver à visita: ' : 'Parcela para esta manutenção: ') + money(p.amountCents));
      if (!removing) node(facts, 'p', 'Fica na visita: ' + money(p.remainingAmountCents));
      node(facts, 'p', removing ? 'A parcela fica anulada no histórico e o seu valor volta à visita. As restantes parcelas mantêm-se.' : 'Esta parcela é descontada da visita. A base de trabalho, a despesa e os pagamentos conservam os seus valores. Se a base tiver vários documentos, cada componente é repartido separadamente.');
      try { el('maintenanceLaborReason').value = sessionStorage.getItem(draftKey()) || ''; } catch {}
      picker(false); el('maintenanceLaborBox').scrollIntoView({ block: 'start' });
      el('maintenanceLaborConfirmed').checked = false;
      el('maintenanceLaborSubmit').textContent = removing ? 'Confirmar anulação da parcela' : 'Confirmar repartição';
    }
    async function choose(id) {
      if (!active() || !context().canWrite || !selected) return;
      draft(); const rev = ++revision, c = context(), allocation = selected; preview = voiding = null; el('maintenanceLaborFacts').replaceChildren(); el('maintenanceLaborStatus').textContent = 'A confirmar o cálculo…'; controls();
      try {
        const result = await host.request('/' + c.expense.id + '/maintenance-labor-preview?allocationId=' + allocation.id + (reminderMode ? '&reminderId=' : '&completionId=') + id);
        if (!active() || rev !== revision || stamp !== context().stamp) return;
        if (result.preview?.available !== true) { if (result.preview?.applied !== false || typeof result.preview.message !== 'string') throw Error('Cálculo não confirmado.'); el('maintenanceLaborStatus').textContent = result.preview.message; return; }
        const p = await verifyPreview(result.preview, c.expense.id, c.expense.version, allocation);
        if (reminderMode ? p.reminderId !== id || p.completionId !== null : p.completionId !== id || p.reminderId !== undefined) throw Error('A parcela não corresponde ao serviço selecionado.');
        if (!active() || rev !== revision || stamp !== context().stamp) return;
        preview = p; showFacts(p); el('maintenanceLaborStatus').textContent = 'Reveja a parcela e o valor que fica na visita.';
      } catch (error) { if (active() && rev === revision && stamp === context().stamp) el('maintenanceLaborStatus').textContent = error.message; } finally { controls(); }
    }
    async function candidates() {
      draft(); const rev = ++revision, c = context(); preview = voiding = null; picker(true); el('maintenanceLaborFacts').replaceChildren(); el('maintenanceLaborCandidates').replaceChildren(); el('maintenanceLaborStatus').textContent = 'A consultar revisões desta visita…'; controls();
      try {
        const result = await host.request('/' + c.expense.id + '/maintenance-labor-candidates?allocationId=' + selected.id + '&page=' + page + (reminderMode ? '&targetType=MAINTENANCE_REMINDER' : '')), data = result.candidates;
        if (!active() || rev !== revision || stamp !== context().stamp) return;
        if (!data || data.expenseId !== c.expense.id || data.expenseVersion !== c.expense.version || data.allocationId !== selected.id || data.page !== page || data.pageSize !== 10 || !count(data.total) || !Array.isArray(data.rows) || data.rows.length > 10 || typeof data.available !== 'boolean' || data.available && reminderMode !== (data.targetType === 'MAINTENANCE_REMINDER')) throw Error('Lista de revisões não confirmada.');
        total = data.total; el('maintenanceLaborStatus').textContent = data.available ? total + (reminderMode ? ' lembretes · Página ' : ' revisões · Página ') + page : data.message;
        for (const row of data.rows) {
          if (!positive(row.id) || typeof row.label !== 'string' || !['MISSING','RECORDED','REVIEW','WITHDRAWN'].includes(row.workTimeState) || typeof row.targetConfirmed !== 'boolean' || typeof row.shared !== 'boolean') throw Error('Revisão recebida incompleta.');
          const card = node(el('maintenanceLaborCandidates'), 'article', '', 'row'); node(card, 'strong', row.label);
          node(card, 'p', row.shared ? 'Parcela já atribuída neste documento.' : ['MISSING','WITHDRAWN'].includes(row.workTimeState) ? 'Falta registar o tempo próprio.' : row.workTimeState === 'REVIEW' ? 'Tempo próprio por rever.' : !row.targetConfirmed ? 'Execução ou decisão comercial por confirmar.' : (row.durationMs / 1000) + ' s de trabalho registados.');
          if(!reminderMode){const link=node(card,'a','Consultar / corrigir tempos');link.href='/equipment-time-review.html?completionId='+row.id;}
          if (!row.shared && row.targetConfirmed && row.workTimeState === 'RECORDED') button(card, 'Calcular parcela #' + row.id, () => choose(row.id), true);
        }
      } catch (error) { if (active() && rev === revision && stamp === context().stamp) { el('maintenanceLaborCandidates').replaceChildren(); el('maintenanceLaborStatus').textContent = error.message; } } finally { controls(); }
    }
    async function review(allocation) {
      if (!active() || !context().canWrite) return;
      draft(); clear(); selected = allocation; stamp = context().stamp; el('maintenanceLaborBox').hidden = false; el('maintenanceLaborBox').scrollIntoView({ block: 'start' }); await candidates();
    }
    async function remove(row) {
      if (!active() || !context().canWrite) return;
      draft(); clear(); const rev = revision, c = context(); stamp = c.stamp;
      const p = await verifyPreview(row.share.preview, c.expense.id, null);
      if (await hash(row.share) !== row.hash) throw Error('A parcela histórica não foi confirmada.');
      if (!active() || rev !== revision || stamp !== context().stamp) return;
      voiding = row; el('maintenanceLaborBox').hidden = false; el('maintenanceLaborStatus').textContent = 'Reveja o motivo para devolver esta parcela à visita.'; showFacts(p, true); controls(); el('maintenanceLaborBox').scrollIntoView({ block: 'start' });
    }
    function render(row, a) {
      if (!Array.isArray(a.maintenanceShares) || typeof a.maintenanceShareReview !== 'boolean') throw Error('Histórico da repartição não confirmado.');
      if (a.maintenanceShares.length || a.maintenanceShareReview) {
        node(row, 'p', 'Repartido com manutenções: ' + money(a.maintenanceSharedAmountCents) + ' · Fica na visita: ' + money(a.maintenanceParentAmountCents));
        if (a.maintenanceShareReview) node(row, 'p', 'Reveja a origem e o histórico das parcelas antes de usar estes custos.');
      }
      for (const s of a.maintenanceShares) {
        const item = node(row, 'div', '', 'row'); item.dataset.maintenanceShareId = s.share.id;
        node(item, 'strong', s.share.preview.target.label); node(item, 'p', money(s.share.preview.amountCents) + ' · ' + (s.voidedAt ? 'Parcela anulada' : s.needsReview ? 'Parcela por rever' : 'Parcela confirmada')); node(item, 'p', s.voidReason || s.share.reason);
        if (!s.voidedAt) button(item, 'Anular parcela da manutenção', () => remove(s), true);
      }
      if (!a.voidedAt && !a.needsReview && a.valuationType === 'LABOR' && ['REGULAR','EXTRA'].includes(a.targetType)) button(row, 'Repartir com manutenção', () => review(a), true);
    }
    async function verify(result, record) {
      const e = record.envelope, d = e.data; if (!result.applied || !commands.includes(e.command)) return;
      const s = result.share, creating = e.command === commands[0];
      if (!s || s.schema !== 1 || s.expenseId !== e.expenseId || s.allocationId !== d.allocationId || !iso(s.createdAt) || !positive(s.createdById) || result.version !== e.expectedVersion + 1 || result.reason !== d.reason || await hash(s) !== result.shareHash) throw Error('Recibo da repartição incompleto.');
      const p = await verifyPreview(s.preview, e.expenseId, creating ? e.expectedVersion : null);
      if (p.allocationId !== s.allocationId || p.completionId !== s.completionId || p.reminderId !== s.reminderId || creating && (s.id !== e.requestId || s.createdById !== Number(record.owner.split(':')[1]) || !window.CWReminderVisitCostRules.matchesRequest(s, d) || s.reason !== d.reason || p.hash !== d.previewHash || p.amountCents !== d.amountCents) || !creating && (s.id !== d.shareId || result.shareHash !== d.shareHash || !iso(result.voidedAt))) throw Error('O recibo não corresponde à parcela do pedido original.');
    }
    function receipt(result, record) {
      const e = record.envelope; if (!result.applied || !commands.includes(e.command)) return;
      try { sessionStorage.removeItem(key(e.expenseId, e.data.allocationId, e.command === commands[0] ? (e.data.reminderId === undefined ? e.data.completionId : 'REMINDER:' + e.data.reminderId) : e.data.shareId, e.command === commands[0] ? 'share' : 'void')); } catch {}
      clear();
    }
    function observe() { if (stamp && stamp !== context().stamp) clear(); }
    el('maintenanceLaborType').addEventListener('change', () => { draft(); reminderMode = el('maintenanceLaborType').value === 'MAINTENANCE_REMINDER'; page = 1; void candidates(); });
    el('maintenanceLaborReason').addEventListener('input', draft);
    el('maintenanceLaborClose').addEventListener('click', () => { draft(); clear(); });
    el('maintenanceLaborChange').addEventListener('click', () => void candidates());
    el('maintenanceLaborPrevious').addEventListener('click', () => { page--; void candidates(); }); el('maintenanceLaborNext').addEventListener('click', () => { page++; void candidates(); });
    el('maintenanceLaborForm').addEventListener('submit', event => {
      event.preventDefault(); if (!active() || !context().canWrite || stamp !== context().stamp || !el('maintenanceLaborConfirmed').checked) return;
      const reason = el('maintenanceLaborReason').value.trim(); if (!reason) { note('Indique o motivo da repartição ou da anulação.'); return; }
      if (preview) void host.execute(commands[0], { allocationId: preview.allocationId, ...window.CWReminderVisitCostRules.selection(preview), amountCents: preview.amountCents, previewHash: preview.hash, reason, confirmed: true });
      else if (voiding) void host.execute(commands[1], { allocationId: voiding.share.allocationId, shareId: voiding.share.id, shareHash: voiding.hash, reason, confirmed: true });
    });
    return { clear, controls, render, verify, receipt, observe, draft };
  } };
})();
