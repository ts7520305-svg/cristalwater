(function () {
  'use strict';
  const rules = window.CWMaintenanceMaterialRules, { commands, positive, count, quantity, decimal, iso } = rules;
  window.CWExpenseMaintenanceMaterial = { create(host) {
    const { el, node, button, money, hash, active, note } = host;
    let revision = 0, stamp = '', selected = null, completionId = null, preview = null, voiding = null, page = 1, total = 0, reminderMode = false;
    const context = () => { const c = host.context(); return { ...c, stamp: c.epoch + ':' + c.detailEpoch + ':' + c.expense?.id }; };
    const key = (expenseId, allocationId, id, operation) => 'cw-maintenance-material-draft:' + host.owner() + ':' + expenseId + ':' + allocationId + ':' + id + ':' + operation;
    const draftKey = () => voiding ? key(voiding.share.expenseId, voiding.share.allocationId, voiding.share.id, 'void') : selected && completionId ? key(context().expense.id, selected.id, reminderMode ? 'REMINDER:' + completionId : completionId, 'share') : null;
    const inputQuantity = () => el('maintenanceMaterialQuantity').value.trim().replace(',', '.');
    function draft() { if (!active() || stamp !== context().stamp || !draftKey()) return; try { sessionStorage.setItem(draftKey(), JSON.stringify({ reason: el('maintenanceMaterialReason').value, quantity: el('maintenanceMaterialQuantity').value })); } catch { note('O rascunho dos materiais não pôde ser guardado neste navegador.'); } }
    function restore() { el('maintenanceMaterialReason').value = ''; el('maintenanceMaterialQuantity').value = ''; try { const saved = JSON.parse(sessionStorage.getItem(draftKey())); if (saved && typeof saved.reason === 'string' && typeof saved.quantity === 'string') { el('maintenanceMaterialReason').value = saved.reason; el('maintenanceMaterialQuantity').value = saved.quantity; } } catch {} }
    function picker(visible) { el('maintenanceMaterialTypeBox').hidden = !visible; el('maintenanceMaterialCandidates').hidden = !visible; el('maintenanceMaterialPrevious').hidden = !visible; el('maintenanceMaterialNext').hidden = !visible; el('maintenanceMaterialChange').hidden = visible || !!voiding; el('maintenanceMaterialQuantityBox').hidden = visible || !!voiding; el('maintenanceMaterialForm').hidden = visible; }
    function clear() { revision++; selected = preview = voiding = completionId = null; stamp = ''; page = 1; total = 0; reminderMode = false; el('maintenanceMaterialType').value = 'MAINTENANCE_EQUIPMENT'; el('maintenanceMaterialBox').hidden = true; el('maintenanceMaterialCandidates').replaceChildren(); el('maintenanceMaterialFacts').replaceChildren(); el('maintenanceMaterialStatus').textContent = ''; el('maintenanceMaterialForm').reset(); el('maintenanceMaterialQuantity').value = ''; picker(true); }
    function controls() {
      const c = context(), writable = c.canWrite && stamp === c.stamp; el('maintenanceMaterialType').disabled = !writable;
      for (const n of el('maintenanceMaterialForm').querySelectorAll('input,textarea,button')) n.disabled = !writable || !(preview || voiding);
      el('maintenanceMaterialQuantity').disabled = !writable || !completionId || !!voiding;
      el('maintenanceMaterialCalculate').disabled = !writable || !completionId || !!voiding;
      el('maintenanceMaterialPrevious').disabled = !writable || page <= 1 || !!voiding; el('maintenanceMaterialNext').disabled = !writable || page * 10 >= total || !!voiding;
      el('maintenanceMaterialChange').disabled = !writable;
    }
    function showFacts(p, removing = false) {
      const box = el('maintenanceMaterialFacts'); box.replaceChildren();
      node(box, 'strong', p.target.label + ' · ' + p.target.clientName);
      node(box, 'p', 'Origem: ' + p.allocationBefore.targetSnapshot.label + ' · Despesa #' + p.expenseId + ' · Atribuição #' + p.allocationId + ' · Linha de compra #' + p.allocationBefore.purchaseItemId);
      node(box, 'p', p.material.productName + ' · ' + p.quantity + ' ' + p.material.unit + ' nesta parcela · Declaração: ' + p.material.declaredQuantity + ' ' + p.material.unit);
      node(box, 'p', 'Já repartido neste serviço, em todas as compras: ' + p.maintenanceUsed.quantity + ' ' + p.material.unit + ' · ' + p.monthRef + ' (UTC)');
      if(p.period)node(box,'p','Mês da visita: '+p.period.parentMonthRef+' · Mês da manutenção: '+p.monthRef+' (UTC). '+(removing?'A anulação retira a parcela do mês da manutenção e devolve-a ao mês da visita.':'O remanescente fica no mês da visita; esta parcela passa para o mês da manutenção.'));
      node(box, 'p', 'Custo original: ' + money(p.allocationBefore.amountCents) + ' / ' + p.parentQuantity + ' ' + p.material.unit + ' · Já repartido nesta atribuição: ' + money(p.used.amountCents));
      node(box, 'strong', (removing ? 'Valor a devolver à visita: ' : 'Parcela para esta manutenção: ') + money(p.amountCents));
      if(p.materialRevision){const e=p.materialRevision.revision,h=e.preview.originReview.revision;node(box,'p','Materiais históricos declarados por '+e.owner+' em '+new Date(e.createdAt).toLocaleString('pt-PT')+'. Origem revista por '+h.owner+' em '+new Date(h.createdAt).toLocaleString('pt-PT')+'.');node(box,'p','Evidência histórica: '+h.preview.proposed.record.evidence);node(box,'p','O recibo técnico original está indisponível. Esta parcela usa a declaração administrativa e o consumo confirmado da visita.');}
      if (!removing) node(box, 'p', 'Fica na visita: ' + money(p.remainingAmountCents) + ' / ' + p.remainingQuantity + ' ' + p.material.unit + ' · Ainda sem parcela neste serviço: ' + p.remainingMaintenanceQuantity + ' ' + p.material.unit);
      node(box, 'p', removing ? 'A anulação devolve esta parcela à visita e conserva o histórico. As restantes parcelas mantêm-se.' : 'A parcela é descontada da visita. A compra, o consumo de stock, a despesa e os pagamentos não são duplicados.');
      el('maintenanceMaterialConfirmed').checked = false; el('maintenanceMaterialSubmit').textContent = removing ? 'Confirmar anulação da parcela' : 'Confirmar repartição';
    }
    async function calculate() {
      if (!active() || !context().canWrite || !selected || !completionId) return;
      draft(); const rev = ++revision, c = context(), a = selected, id = completionId, raw = inputQuantity(); preview = null; el('maintenanceMaterialConfirmed').checked = false; el('maintenanceMaterialFacts').replaceChildren(); el('maintenanceMaterialStatus').textContent = 'A confirmar quantidades e custo…'; controls();
      try {
        if (raw && (quantity(raw) === null || quantity(raw) <= 0n)) throw Error('Indique uma quantidade positiva com até seis casas decimais.');
        const result = await host.request('/' + c.expense.id + '/maintenance-material-preview?' + new URLSearchParams({ allocationId: a.id, ...(reminderMode ? { reminderId: id } : { completionId: id }), ...(raw ? { quantity: raw } : {}) }));
        if (!active() || rev !== revision || stamp !== context().stamp || inputQuantity() !== raw) return;
        if (result.preview?.available !== true) { if (result.preview?.applied !== false || typeof result.preview.message !== 'string') throw Error('Cálculo não confirmado.'); el('maintenanceMaterialStatus').textContent = result.preview.message; return; }
        const p = await rules.verify(result.preview, hash, a);
        if (p.expenseId !== c.expense.id || p.expenseVersion !== c.expense.version || p.allocationId !== a.id || (reminderMode ? p.reminderId !== id || p.completionId !== null : p.completionId !== id || p.reminderId !== undefined) || raw && quantity(raw) !== quantity(p.quantity)) throw Error('A parcela não corresponde à revisão selecionada.');
        if (!active() || rev !== revision || stamp !== context().stamp || inputQuantity() !== raw) return;
        preview = p; showFacts(p); el('maintenanceMaterialStatus').textContent = 'Reveja a quantidade, a parcela e o valor que fica na visita.';
      } catch (error) { if (active() && rev === revision && stamp === context().stamp) el('maintenanceMaterialStatus').textContent = error.message; } finally { controls(); }
    }
    async function choose(id) { if (!active() || !context().canWrite || !selected) return; draft(); completionId = id; preview = voiding = null; restore(); picker(false); await calculate(); el('maintenanceMaterialBox').scrollIntoView({ block: 'start' }); }
    async function candidates() {
      draft(); const rev = ++revision, c = context(); preview = voiding = completionId = null; picker(true); el('maintenanceMaterialCandidates').replaceChildren(); el('maintenanceMaterialFacts').replaceChildren(); el('maintenanceMaterialStatus').textContent = 'A consultar materiais das revisões…'; controls();
      try {
        const result = await host.request('/' + c.expense.id + '/maintenance-material-candidates?allocationId=' + selected.id + '&page=' + page + (reminderMode ? '&targetType=MAINTENANCE_REMINDER' : '')), data = result.candidates;
        if (!active() || rev !== revision || stamp !== context().stamp) return;
        if (!data || data.expenseId !== c.expense.id || data.expenseVersion !== c.expense.version || data.allocationId !== selected.id || data.page !== page || data.pageSize !== 10 || !count(data.total) || !Array.isArray(data.rows) || data.rows.length > 10 || typeof data.available !== 'boolean' || data.available && reminderMode !== (data.targetType === 'MAINTENANCE_REMINDER')) throw Error('Lista de revisões não confirmada.');
        total = data.total; el('maintenanceMaterialStatus').textContent = data.available ? total + (reminderMode ? ' lembretes · Página ' : ' revisões · Página ') + page + ' · ' + data.material.productName + ' / ' + data.material.unit : data.message;
        for (const row of data.rows) {
          if (!positive(row.id) || typeof row.label !== 'string' || !['MISSING','NONE','DECLARED','MATCHED','REVIEW','WITHDRAWN'].includes(row.materialsState) || typeof row.shared !== 'boolean' || typeof row.targetConfirmed !== 'boolean' || row.availableQuantity !== null && quantity(row.availableQuantity) === null) throw Error('Revisão recebida incompleta.');
          const card = node(el('maintenanceMaterialCandidates'), 'article', '', 'row'); node(card, 'strong', row.label);
          node(card, 'p', row.shared ? 'Parcela já atribuída neste documento.' : row.materialsState === 'NONE' ? 'Sem materiais, confirmado.' : row.materialsState === 'MISSING' ? 'Falta registar os materiais próprios.' : row.materialsState !== 'MATCHED' ? 'Consumo ou declaração por confirmar.' : !row.targetConfirmed ? 'Execução ou decisão comercial por confirmar.' : row.declaredQuantity === null ? 'Este produto não foi declarado.' : 'Declarado: ' + row.declaredQuantity + ' · Ainda sem parcela, entre todas as compras: ' + row.availableQuantity);
          if (!row.shared && row.targetConfirmed && row.materialsState === 'MATCHED' && quantity(row.availableQuantity) > 0n) button(card, 'Rever materiais #' + row.id, () => choose(row.id), true);
          const link = node(card, 'a', 'Consultar / corrigir declaração'); link.href = reminderMode ? '/reminder-resources?associated=1&reminderId=' + row.id : '/equipment-material-review?completionId=' + row.id;
        }
      } catch (error) { if (active() && rev === revision && stamp === context().stamp) { el('maintenanceMaterialCandidates').replaceChildren(); el('maintenanceMaterialStatus').textContent = error.message; } } finally { controls(); }
    }
    async function review(a) { if (!active() || !context().canWrite) return; draft(); clear(); selected = a; stamp = context().stamp; el('maintenanceMaterialBox').hidden = false; el('maintenanceMaterialBox').scrollIntoView({ block: 'start' }); await candidates(); }
    async function remove(row) {
      if (!active() || !context().canWrite) return; draft(); clear(); const rev = revision, c = context(); stamp = c.stamp;
      const p = await rules.verify(row.share.preview, hash); if (p.expenseId !== c.expense.id || await hash(row.share) !== row.hash) throw Error('A parcela histórica não foi confirmada.');
      if (!active() || rev !== revision || stamp !== context().stamp) return;
      voiding = row; restore(); el('maintenanceMaterialBox').hidden = false; picker(false); showFacts(p, true); el('maintenanceMaterialStatus').textContent = 'Reveja a anulação e o valor que volta à visita.'; controls(); el('maintenanceMaterialBox').scrollIntoView({ block: 'start' });
    }
    function render(row, a) {
      if (!Array.isArray(a.maintenanceMaterialShares) || typeof a.maintenanceMaterialShareReview !== 'boolean') throw Error('Histórico das parcelas de materiais não confirmado.');
      if (a.maintenanceMaterialShares.length || a.maintenanceMaterialShareReview) {
        node(row, 'p', 'Materiais repartidos com revisões: ' + money(a.maintenanceMaterialSharedAmountCents) + ' · Fica na visita: ' + money(a.maintenanceMaterialParentAmountCents));
        if (a.maintenanceMaterialShareReview) node(row, 'p', 'Reveja o histórico e as origens dos materiais antes de usar estes custos.');
      }
      for (const s of a.maintenanceMaterialShares) {
        const item = node(row, 'div', '', 'row'); item.dataset.maintenanceMaterialShareId = s.share.id; node(item, 'strong', s.share.preview.target.label); node(item, 'p', s.share.preview.quantity + ' ' + s.share.preview.material.unit + ' · ' + money(s.share.preview.amountCents) + ' · ' + (s.voidedAt ? 'Parcela anulada' : s.needsReview ? 'Parcela por rever' : 'Parcela confirmada')); node(item, 'p', s.voidReason || s.share.reason); if(s.share.preview.period)node(item,'p','Mês da manutenção: '+s.share.preview.monthRef+' · Origem na visita: '+s.share.preview.period.parentMonthRef+' (UTC)');
        if (!s.voidedAt) button(item, 'Anular parcela de materiais', () => remove(s).catch(error => note(error.message)), true);
      }
      if (!a.voidedAt && !a.needsReview && a.valuationType === 'MATERIAL' && ['REGULAR','EXTRA'].includes(a.targetType)) button(row, 'Repartir materiais com manutenção', () => review(a), true);
    }
    async function verify(result, record) {
      const e = record.envelope, d = e.data; if (!result.applied || !commands.includes(e.command)) return;
      const s = result.share, creating = e.command === commands[0];
      if (!s || s.schema !== 1 || s.expenseId !== e.expenseId || s.allocationId !== d.allocationId || !iso(s.createdAt) || !positive(s.createdById) || result.version !== e.expectedVersion + 1 || result.reason !== d.reason || await hash(s) !== result.shareHash) throw Error('Recibo da repartição dos materiais incompleto.');
      const p = await rules.verify(s.preview, hash);
      if (p.expenseId !== e.expenseId || p.allocationId !== s.allocationId || p.completionId !== s.completionId || p.reminderId !== s.reminderId || creating && (p.expenseVersion !== e.expectedVersion || s.id !== e.requestId || s.createdById !== Number(record.owner.split(':')[1]) || !window.CWReminderVisitCostRules.matchesRequest(s, d) || s.reason !== d.reason || p.hash !== d.previewHash || p.amountCents !== d.amountCents || p.quantity !== d.quantity) || !creating && (s.id !== d.shareId || result.shareHash !== d.shareHash || !iso(result.voidedAt))) throw Error('O recibo não corresponde aos materiais do pedido original.');
    }
    function receipt(result, record) {
      const e = record.envelope; if (!result.applied || !commands.includes(e.command)) return;
      const k = key(e.expenseId, e.data.allocationId, e.command === commands[0] ? (e.data.reminderId === undefined ? e.data.completionId : 'REMINDER:' + e.data.reminderId) : e.data.shareId, e.command === commands[0] ? 'share' : 'void');
      try { const saved = JSON.parse(sessionStorage.getItem(k)), raw = saved?.quantity?.trim().replace(',', '.'); if (saved?.reason?.trim() === e.data.reason && (e.command === commands[1] || !raw || quantity(raw) === quantity(e.data.quantity))) sessionStorage.removeItem(k); } catch {}
      clear();
    }
    function observe() { if (stamp && stamp !== context().stamp) clear(); }
    el('maintenanceMaterialType').addEventListener('change', () => { draft(); reminderMode = el('maintenanceMaterialType').value === 'MAINTENANCE_REMINDER'; page = 1; void candidates(); });
    el('maintenanceMaterialReason').addEventListener('input', draft);
    el('maintenanceMaterialQuantity').addEventListener('input', () => { draft(); revision++; preview = null; el('maintenanceMaterialConfirmed').checked = false; el('maintenanceMaterialFacts').replaceChildren(); el('maintenanceMaterialStatus').textContent = 'Calcule novamente depois de alterar a quantidade.'; controls(); });
    el('maintenanceMaterialCalculate').addEventListener('click', () => void calculate());
    el('maintenanceMaterialClose').addEventListener('click', () => { draft(); clear(); }); el('maintenanceMaterialChange').addEventListener('click', () => void candidates());
    el('maintenanceMaterialPrevious').addEventListener('click', () => { page--; void candidates(); }); el('maintenanceMaterialNext').addEventListener('click', () => { page++; void candidates(); });
    el('maintenanceMaterialForm').addEventListener('submit', event => {
      event.preventDefault(); if (!active() || !context().canWrite || stamp !== context().stamp || !el('maintenanceMaterialConfirmed').checked) return;
      const reason = el('maintenanceMaterialReason').value.trim(); if (!reason) { note('Indique o motivo da repartição ou anulação.'); return; }
      if (preview) void host.execute(commands[0], { allocationId: preview.allocationId, ...window.CWReminderVisitCostRules.selection(preview), quantity: preview.quantity, amountCents: preview.amountCents, previewHash: preview.hash, reason, confirmed: true });
      else if (voiding) void host.execute(commands[1], { allocationId: voiding.share.allocationId, shareId: voiding.share.id, shareHash: voiding.hash, reason, confirmed: true });
    });
    return { clear, controls, draft, render, verify, receipt, observe };
  } };
})();
