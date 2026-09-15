(() => {
  'use strict';
  const el = id => document.getElementById(id), root = el('commercialQuotes');
  if (!root) return;
  const ownerToken = localStorage.getItem('token');
  let ready = false;
  function checkSession() {
    if (!ownerToken || localStorage.getItem('token') !== ownerToken) { root.hidden = true; root.querySelectorAll('input,textarea').forEach(c => c.value = ''); throw Error('Sessão alterada. Reabra a página.'); }
  }
  async function api(url, options) { checkSession(); const data = await fetchJSON(url, options); checkSession(); return data; }
  window.addEventListener('storage', () => { try { checkSession(); } catch {} });
  let currentId = null, latest = null, dirty = false, busy = false, loaded = false;
  const status = message => { el('cqStatus').textContent = message; };
  function addLine(line = {}) {
    const row = document.createElement('fieldset'); row.className = 'cq-line';
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;margin:12px 0;padding:12px;border:1px solid #cbd5e1;border-radius:8px';
    row.innerHTML = '<legend>Linha de orçamento</legend><label>Tipo<select data-key="type"><option value="MATERIAL">Material</option><option value="LABOR">Mão de obra</option><option value="OTHER">Outro</option></select></label><label>Descrição<input data-key="description" required maxlength="300"></label><label>Quantidade / horas<input data-key="quantity" type="number" min="0.001" max="100000" step="0.001" value="1" required></label><label>Custo unitário (€)<input data-key="unitCost" type="number" min="0" max="1000000" step="0.01" required></label><label>Margem (%)<input data-key="marginPercent" type="number" min="0" max="95" step="0.01" value="0" required></label><button type="button" class="cw-v2-btn">Remover linha</button>';
    for (const input of row.querySelectorAll('[data-key]')) if (line[input.dataset.key] != null) input.value = line[input.dataset.key];
    row.querySelector('button').onclick = () => { row.remove(); changed(); };
    el('cqLines').append(row);
  }
  function changed() { dirty = true; el('cqTotals').textContent = ''; }
  function payload() {
    if (!ready) throw Error('Carregue o orçamento antes de editar.');
    if (!currentId) throw Error('Escolha uma reparação.');
    if (!el('cqForm').reportValidity()) throw Error('Preencha os campos obrigatórios.');
    return { lines: [...el('cqLines').children].map(row => Object.fromEntries([...row.querySelectorAll('[data-key]')].map(input => [input.dataset.key, input.type === 'number' ? Number(input.value) : input.value]))),
      taxPercent: Number(el('cqTax').value), discountPercent: Number(el('cqDiscount').value), validityDays: Number(el('cqValidity').value), terms: el('cqTerms').value,
      expectedVersion: latest?.version || 0, confirmBelowCost: el('cqBelow').checked };
  }
  function totals(q) {
    const eur = n => new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(n);
    el('cqTotals').textContent = `Custo interno: ${eur(q.totalCost)} | Resultado: ${eur(q.profit)}
Sem IVA: ${eur(q.net)} | IVA: ${eur(q.tax)} | Total: ${eur(q.total)}${q.belowCost ? '\nAtenção: venda abaixo do custo.' : ''}`;
  }
  async function run(fn) {
    if (busy) return; busy = true;
    const controls = [...root.querySelectorAll('input,select,textarea,button')];
    controls.forEach(c => c.disabled = true);
    try { checkSession(); await fn(); } catch (error) { status(error.message || 'Não foi possível concluir.'); }
    finally { controls.forEach(c => c.disabled = false); busy = false; }
  }
  async function readVersions() {
    ready = false;
    const data = await api(`/api/repairs/${currentId}/quotes`);
    latest = data.quotes[0] || null;
    el('cqVersions').textContent = latest ? `Versão guardada: ${latest.version}. Histórico: ${data.quotes.map(q => 'v' + q.version).join(', ')}.` : 'Sem orçamento detalhado guardado.';
    el('cqLines').replaceChildren();
    if (latest) {
      latest.snapshot.lines.forEach(addLine);
      const q = latest.snapshot;
      el('cqTax').value = q.taxPercent; el('cqDiscount').value = q.discountPercent; el('cqValidity').value = q.validityDays; el('cqTerms').value = q.terms;
      totals(q);
    } else { el('cqForm').reset(); addLine(); el('cqTotals').textContent = ''; }
    el('cqApproval').value = ''; dirty = false; ready = true;
  }
  root.addEventListener('toggle', () => {
    if (!root.open || loaded) return;
    run(async () => {
      const data = await api('/api/core/repairs');
      for (const repair of data.repairs || []) {
        const option = document.createElement('option'); option.value = repair.id;
        option.textContent = `#${repair.id} · ${repair.pool?.name || 'Piscina'} · ${repair.problem} · ${repair.status}`;
        el('cqRepair').append(option);
      }
      loaded = true; status('Escolha a reparação para preparar ou consultar o orçamento.');
    });
  });
  el('cqRepair').addEventListener('change', () => {
    if (dirty && !window.confirm('Há alterações por guardar. Descartar e mudar de reparação?')) { el('cqRepair').value = currentId || ''; return; }
    const id = Number(el('cqRepair').value);
    if (!id) { el('cqRepair').value = currentId || ''; return; }
    run(async () => { currentId = id; latest = null; await readVersions(); status('Orçamento carregado.'); });
  });
  el('cqForm').addEventListener('input', changed);
  el('cqAdd').onclick = () => { addLine(); changed(); };
  el('cqForm').onsubmit = event => { event.preventDefault(); let p; try { p = payload(); } catch(e) { status(e.message); return; }
    run(async () => { totals((await api('/api/repairs/quote-preview',{method:'POST',body:JSON.stringify(p)})).quote); status('Cálculo atualizado. Ainda não foi guardado.'); }); };
  el('cqSave').onclick = () => { let p; try { p = payload(); } catch(e) { status(e.message); return; }
    run(async () => { await api(`/api/repairs/${currentId}/quote`,{method:'PUT',body:JSON.stringify(p)}); await readVersions(); status('Nova versão guardada. Aprovação do cliente ainda por registar.'); }); };
  el('cqApprove').onclick = () => {
    if (!ready || !latest || dirty) return status('Guarde as alterações antes de aprovar.');
    const approvalReference = el('cqApproval').value.trim();
    if (!approvalReference) return status('Indique a referência da aprovação recebida do cliente.');
    if (!window.confirm(`Registar aprovação do cliente para a versão ${latest.version}?`)) return;
    run(async () => { await api(`/api/repairs/${currentId}/approve`,{method:'PUT',body:JSON.stringify({quoteId:latest.id,approvalReference})}); status('Aprovação registada. Reparação disponível para o fluxo de agendamento.'); });
  };
  el('cqReload').onclick = () => {
    if (!currentId) return status('Escolha uma reparação.');
    if (dirty && !window.confirm('Descartar alterações e recarregar a versão guardada?')) return;
    run(async () => { await readVersions(); status('Versão guardada recarregada.'); });
  };
  el('cqPdf').onclick = () => {
    if (!ready || !latest || dirty) return status('Guarde as alterações antes de abrir o PDF.');
    run(async () => {
      const response = await fetch(`/api/repairs/${currentId}/pdf`,{headers:authHeaders()});
      if (!response.ok) throw Error('Não foi possível gerar o PDF.');
      const blob = await response.blob(); checkSession();
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `orcamento-${currentId}-v${latest.version}.pdf`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000); status('PDF preparado.');
    });
  };
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
})();
