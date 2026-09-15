(() => {
  'use strict';
  const root = document.getElementById('clientQuotesPanel');
  if (!root) return;
  const list = document.getElementById('clientQuotesList'), status = document.getElementById('clientQuotesStatus');
  const refresh = document.getElementById('clientQuotesRefresh');
  const token = () => localStorage.getItem('token') || localStorage.getItem('cristalwater_jwt');
  const owner = token();
  const selection = () => typeof clientId !== 'undefined' ? Number(clientId) : Number(new URLSearchParams(location.search).get('clientId') || localStorage.getItem('cw_client_id') || localStorage.getItem('clientId'));
  const admin = () => {
    try { const user = typeof currentUser === 'function' ? currentUser() : JSON.parse(localStorage.getItem('cristalwater_user') || localStorage.getItem('user') || '{}'); return String(user.role).toUpperCase() === 'ADMIN'; } catch { return true; }
  };
  let selected = selection(), revision = 0, closed = false, busy = false;
  const eur = value => new Intl.NumberFormat('pt-PT', {style:'currency',currency:'EUR'}).format(value);
  const date = value => value ? new Date(value).toLocaleDateString('pt-PT') : 'Sem data';
  function node(tag, text, parent, className) {
    const item = document.createElement(tag); if (text != null) item.textContent = text;
    if (className) item.className = className; if (parent) parent.append(item); return item;
  }
  function valid(id, rev) {
    if (!owner || owner !== token()) { closed = true; root.hidden = true; list.replaceChildren(); revision++; return false; }
    return !closed && selection() === id && selected === id && revision === rev;
  }
  async function api(path, options, id, rev) {
    if (!valid(id, rev)) throw Error('Sessão ou cliente alterado.');
    const response = await fetch(path, {...options, headers:{Authorization:`Bearer ${owner}`, 'Content-Type':'application/json'}, cache:'no-store'});
    const data = await response.json();
    if (!valid(id, rev)) throw Error('Sessão ou cliente alterado.');
    if (!response.ok || data.ok === false) throw Error(data.error || data.message || 'Não foi possível confirmar. Atualize os orçamentos.');
    return data;
  }
  const labels = {PENDING:'Aguarda a sua decisão',APPROVED:'Aprovado',DECLINED:'Recusado',SUPERSEDED:'Substituído por outra versão',EXPIRED:'Prazo terminado',UNAVAILABLE:'Indisponível para aprovação'};
  function render(quotes, id, rev) {
    list.replaceChildren();
    if (!quotes.length) { node('p','Ainda não existem orçamentos publicados.',list); return; }
    for (const q of quotes) {
      const card = node('article',null,list,'cw-quote-card');
      node('h3', `${q.poolName || 'Piscina'} · Orçamento v${q.version}`,card);
      node('p',q.problem,card); node('p',labels[q.status] || 'Consulte a equipa',card,'pill');
      node('p',`Publicado: ${date(q.publishedAt)} · Válido até: ${date(q.validUntil)}`,card,'muted');
      const lines = node('ul',null,card);
      for (const line of q.lines || []) node('li',`${line.description} — ${line.quantity} × ${eur(line.unitPrice)} = ${eur(line.total)}`,lines);
      node('p',`Subtotal: ${eur(q.subtotal)} · Desconto: ${eur(q.discount)} · Sem IVA: ${eur(q.net)}`,card);
      node('p',`IVA (${q.taxPercent}%): ${eur(q.tax)}`,card);
      node('strong',`Total a pagar: ${eur(q.total)} (IVA incluído)`,card);
      if (q.terms) { const terms = node('p',q.terms,card); terms.style.whiteSpace = 'pre-wrap'; }
      if (admin()) { node('p','Pré-visualização administrativa. Apenas o cliente pode decidir neste portal.',card,'muted'); continue; }
      if (q.status !== 'PENDING') continue;
      const label = node('label',null,card,'cw-quote-confirm');
      const checkbox = node('input',null,label); checkbox.type = 'checkbox';
      node('span',`Li a versão ${q.version}, as condições e o total de ${eur(q.total)}, incluindo IVA.`,label);
      const reasonLabel = node('label','Observação (opcional)',card);
      const reason = node('textarea',null,reasonLabel); reason.maxLength = 1000; reason.rows = 2;
      const actions = node('div',null,card,'cw-quote-actions');
      const message = node('p',null,card); message.setAttribute('role','status');
      for (const decision of ['APPROVED','DECLINED']) {
        const button = node('button',decision === 'APPROVED' ? 'Aprovar orçamento' : 'Recusar orçamento',actions,'cw-v2-btn');
        button.type = 'button'; button.disabled = true;
        button.addEventListener('click',async () => {
          if (busy || !checkbox.checked || admin() || !valid(id,rev)) return;
          const verb = decision === 'APPROVED' ? 'Aprovar' : 'Recusar';
          if (!window.confirm(`${verb} o orçamento versão ${q.version}, no total de ${eur(q.total)} (IVA incluído)?`)) return;
          busy = true; refresh.disabled = true;
          root.querySelectorAll('button,input,textarea').forEach(control => control.disabled = true);
          try {
            await api(`/api/client-portal/${id}/quotes/${q.id}/decision`, {method:'POST',body:JSON.stringify({decision,confirm:true,reason:reason.value.trim()})},id,rev);
            if (valid(id,rev)) { status.textContent = decision === 'APPROVED' ? 'Aprovação registada.' : 'Recusa registada.'; await load(true); }
          } catch (error) {
            if (valid(id,rev)) { list.replaceChildren(); status.textContent = `Não foi possível confirmar a decisão. ${error.message} Atualize para verificar o estado antes de tentar novamente.`; }
          } finally { busy = false; refresh.disabled = false; }
        });
      }
      checkbox.addEventListener('change',() => actions.querySelectorAll('button').forEach(button => button.disabled = !checkbox.checked || busy));
    }
  }
  async function load(preserveStatus = false) {
    const id = selected, rev = ++revision;
    if (!valid(id,rev)) return;
    list.replaceChildren();
    if (!id) { status.textContent = 'Escolha um cliente para consultar os orçamentos.'; return; }
    refresh.disabled = true;
    if (!preserveStatus) status.textContent = 'A carregar orçamentos...';
    try {
      const data = await api(`/api/client-portal/${id}/quotes`, {},id,rev);
      if (valid(id,rev)) { render(data.quotes || [],id,rev); if (!preserveStatus) status.textContent = 'Orçamentos atualizados.'; }
    } catch (error) { if (valid(id,rev)) status.textContent = `Não foi possível carregar. Verifique a ligação e tente novamente. ${error.message}`; }
    finally { if (valid(id,rev)) refresh.disabled = false; }
  }
  function inspect() {
    if (!valid(selected,revision) && closed) return;
    const next = selection();
    if (next !== selected) { selected = next; revision++; list.replaceChildren(); status.textContent = ''; load(); }
  }
  window.addEventListener('storage',inspect); window.addEventListener('focus',inspect);
  const timer = setInterval(inspect,300); window.addEventListener('pagehide',()=>clearInterval(timer));
  refresh.addEventListener('click',()=>{ if (!busy) load(); });
  load();
})();
