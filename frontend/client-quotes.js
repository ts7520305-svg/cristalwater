(() => {
  'use strict';
  const root = document.getElementById('clientQuotesPanel');
  if (!root) return;
  const list = document.getElementById('clientQuotesList'), status = document.getElementById('clientQuotesStatus');
  const refresh = document.getElementById('clientQuotesRefresh');
  const languages = ['pt','en','fr','es','de'];
  const copy = {
    title: ['Orçamentos','Quotes','Devis','Presupuestos','Angebote'],
    refresh: ['Atualizar','Refresh','Actualiser','Actualizar','Aktualisieren'],
    noDate: ['Sem data','No date','Sans date','Sin fecha','Kein Datum'],
    sessionError: ['Sessão ou cliente alterado.','Session or client changed.','Session ou client modifié.','La sesión o el cliente han cambiado.','Sitzung oder Kunde geändert.'],
    apiError: ['Não foi possível confirmar. Atualize os orçamentos.','Could not confirm. Refresh the quotes.','Impossible de confirmer. Actualisez les devis.','No se pudo confirmar. Actualiza los presupuestos.','Bestätigung fehlgeschlagen. Aktualisieren Sie die Angebote.'],
    pending: ['Aguarda a sua decisão','Awaiting your decision','En attente de votre décision','Pendiente de tu decisión','Ihre Entscheidung steht aus'],
    approved: ['Aprovado','Approved','Approuvé','Aprobado','Genehmigt'],
    declined: ['Recusado','Declined','Refusé','Rechazado','Abgelehnt'],
    superseded: ['Substituído por outra versão','Replaced by another version','Remplacé par une autre version','Sustituido por otra versión','Durch eine andere Version ersetzt'],
    expired: ['Prazo terminado','Expired','Délai expiré','Plazo vencido','Frist abgelaufen'],
    unavailable: ['Indisponível para aprovação','Unavailable for approval','Approbation indisponible','No disponible para aprobación','Nicht zur Genehmigung verfügbar'],
    unknown: ['Consulte a equipa','Contact the team','Contactez l’équipe','Consulta al equipo','Wenden Sie sich an das Team'],
    empty: ['Ainda não existem orçamentos publicados.','No quotes have been published yet.','Aucun devis n’a encore été publié.','Todavía no hay presupuestos publicados.','Es wurden noch keine Angebote veröffentlicht.'],
    pool: ['Piscina','Pool','Piscine','Piscina','Pool'],
    quoteTitle: ['{pool} · Orçamento v{version}','{pool} · Quote v{version}','{pool} · Devis v{version}','{pool} · Presupuesto v{version}','{pool} · Angebot v{version}'],
    dates: ['Publicado: {published} · Válido até: {until}','Published: {published} · Valid until: {until}','Publié : {published} · Valable jusqu’au : {until}','Publicado: {published} · Válido hasta: {until}','Veröffentlicht: {published} · Gültig bis: {until}'],
    subtotal: ['Subtotal: {subtotal} · Desconto: {discount} · Sem IVA: {net}','Subtotal: {subtotal} · Discount: {discount} · Excluding VAT: {net}','Sous-total : {subtotal} · Remise : {discount} · Hors TVA : {net}','Subtotal: {subtotal} · Descuento: {discount} · Sin IVA: {net}','Zwischensumme: {subtotal} · Rabatt: {discount} · Ohne MwSt.: {net}'],
    tax: ['IVA ({percent}%): {tax}','VAT ({percent}%): {tax}','TVA ({percent} %) : {tax}','IVA ({percent}%): {tax}','MwSt. ({percent}%): {tax}'],
    total: ['Total a pagar: {total} (IVA incluído)','Total payable: {total} (VAT included)','Total à payer : {total} (TVA incluse)','Total a pagar: {total} (IVA incluido)','Gesamtbetrag: {total} (inkl. MwSt.)'],
    admin: ['Pré-visualização administrativa. Apenas o cliente pode decidir neste portal.','Administrative preview. Only the client can decide in this portal.','Aperçu administratif. Seul le client peut décider dans ce portail.','Vista previa administrativa. Solo el cliente puede decidir en este portal.','Administrative Vorschau. Nur der Kunde kann in diesem Portal entscheiden.'],
    consent: ['Li a versão {version}, as condições e o total de {total}, incluindo IVA.','I have read version {version}, the terms and the total of {total}, including VAT.','J’ai lu la version {version}, les conditions et le total de {total}, TVA incluse.','He leído la versión {version}, las condiciones y el total de {total}, IVA incluido.','Ich habe Version {version}, die Bedingungen und den Gesamtbetrag von {total} inklusive MwSt. gelesen.'],
    remark: ['Observação (opcional)','Note (optional)','Remarque (facultative)','Observación (opcional)','Anmerkung (optional)'],
    approve: ['Aprovar orçamento','Approve quote','Approuver le devis','Aprobar presupuesto','Angebot genehmigen'],
    decline: ['Recusar orçamento','Decline quote','Refuser le devis','Rechazar presupuesto','Angebot ablehnen'],
    confirmApproved: ['Aprovar o orçamento versão {version}, no total de {total} (IVA incluído)?','Approve quote version {version}, totalling {total} (VAT included)?','Approuver le devis version {version}, pour un total de {total} (TVA incluse) ?','¿Aprobar el presupuesto versión {version}, por un total de {total} (IVA incluido)?','Angebot Version {version} mit einem Gesamtbetrag von {total} (inkl. MwSt.) genehmigen?'],
    confirmDeclined: ['Recusar o orçamento versão {version}, no total de {total} (IVA incluído)?','Decline quote version {version}, totalling {total} (VAT included)?','Refuser le devis version {version}, pour un total de {total} (TVA incluse) ?','¿Rechazar el presupuesto versión {version}, por un total de {total} (IVA incluido)?','Angebot Version {version} mit einem Gesamtbetrag von {total} (inkl. MwSt.) ablehnen?'],
    approvalResult: ['Aprovação registada.','Approval recorded.','Approbation enregistrée.','Aprobación registrada.','Genehmigung registriert.'],
    declineResult: ['Recusa registada.','Decline recorded.','Refus enregistré.','Rechazo registrado.','Ablehnung registriert.'],
    decisionError: ['Não foi possível confirmar a decisão. {error} Atualize para verificar o estado antes de tentar novamente.','Could not confirm the decision. {error} Refresh to check the status before trying again.','Impossible de confirmer la décision. {error} Actualisez pour vérifier l’état avant de réessayer.','No se pudo confirmar la decisión. {error} Actualiza para comprobar el estado antes de volver a intentarlo.','Die Entscheidung konnte nicht bestätigt werden. {error} Aktualisieren Sie, um den Status vor einem erneuten Versuch zu prüfen.'],
    choose: ['Escolha um cliente para consultar os orçamentos.','Select a client to view quotes.','Sélectionnez un client pour consulter les devis.','Selecciona un cliente para consultar los presupuestos.','Wählen Sie einen Kunden, um die Angebote anzuzeigen.'],
    loading: ['A carregar orçamentos...','Loading quotes...','Chargement des devis...','Cargando presupuestos...','Angebote werden geladen...'],
    updated: ['Orçamentos atualizados.','Quotes updated.','Devis actualisés.','Presupuestos actualizados.','Angebote aktualisiert.'],
    loadError: ['Não foi possível carregar. Verifique a ligação e tente novamente. {error}','Could not load. Check your connection and try again. {error}','Chargement impossible. Vérifiez la connexion et réessayez. {error}','No se pudo cargar. Comprueba la conexión y vuelve a intentarlo. {error}','Laden fehlgeschlagen. Prüfen Sie die Verbindung und versuchen Sie es erneut. {error}'],
  };
  function language() {
    const value = typeof portalLanguage !== 'undefined' ? portalLanguage : document.documentElement.lang || new URLSearchParams(location.search).get('lang') || localStorage.getItem('cw_language') || localStorage.getItem('cw_client_lang') || 'pt';
    return Math.max(0, languages.indexOf(String(value).toLowerCase().split('-')[0]));
  }
  function text(key, values = {}) {
    const parameters = typeof values === 'function' ? values() : values;
    return copy[key][language()].replace(/\{(\w+)\}/g, (placeholder, name) => Object.hasOwn(parameters, name) ? String(parameters[name]) : placeholder);
  }
  // The registry owns only its original, unmodified text leaves. Inputs,
  // handlers, literal server data and copied/foreign nodes are never repainted.
  const leaves = new Map(), ownErrors = new WeakMap();
  function paint() {
    for (const [item, leaf] of leaves) {
      if (!item.isConnected || item.childNodes.length !== 1 || item.firstChild !== leaf.textNode || leaf.textNode.nodeValue !== leaf.rendered) { leaves.delete(item); continue; }
      const rendered = text(leaf.key, leaf.values);
      if (rendered !== leaf.rendered) leaf.textNode.nodeValue = rendered;
      leaf.rendered = rendered;
    }
  }
  function bind(item, key, values) {
    paint();
    const rendered = text(key, values);
    if (item.childNodes.length === 1 && item.firstChild.nodeType === Node.TEXT_NODE) item.firstChild.nodeValue = rendered;
    else item.textContent = rendered;
    leaves.set(item, { key, values, rendered, textNode: item.firstChild });
    return item;
  }
  function ownedError(key) { const error = Error(text(key)); ownErrors.set(error, key); return error; }
  const errorText = error => ownErrors.has(error) ? text(ownErrors.get(error)) : error.message;
  const token = () => localStorage.getItem('token') || localStorage.getItem('cristalwater_jwt');
  const owner = token();
  const selection = () => typeof clientId !== 'undefined' ? Number(clientId) : Number(new URLSearchParams(location.search).get('clientId') || localStorage.getItem('cw_client_id') || localStorage.getItem('clientId'));
  const admin = () => {
    try { const user = typeof currentUser === 'function' ? currentUser() : JSON.parse(localStorage.getItem('cristalwater_user') || localStorage.getItem('user') || '{}'); return String(user.role).toUpperCase() === 'ADMIN'; } catch { return true; }
  };
  let selected = selection(), revision = 0, closed = false, busy = false;
  const eur = value => new Intl.NumberFormat('pt-PT', {style:'currency',currency:'EUR'}).format(value);
  const date = value => value ? new Date(value).toLocaleDateString('pt-PT') : text('noDate');
  function node(tag, text, parent, className) {
    const item = document.createElement(tag); if (text != null) item.textContent = text;
    if (className) item.className = className; if (parent) parent.append(item); return item;
  }
  const labelNode = (tag, key, parent, className, values) => bind(node(tag,null,parent,className),key,values);
  bind(document.getElementById('clientQuotesTitle'),'title'); bind(refresh,'refresh');
  function valid(id, rev) {
    if (!owner || owner !== token()) { closed = true; root.hidden = true; list.replaceChildren(); revision++; return false; }
    return !closed && selection() === id && selected === id && revision === rev;
  }
  async function api(path, options, id, rev) {
    if (!valid(id, rev)) throw ownedError('sessionError');
    const response = await fetch(path, {...options, headers:{Authorization:`Bearer ${owner}`, 'Content-Type':'application/json'}, cache:'no-store'});
    const data = await response.json();
    if (!valid(id, rev)) throw ownedError('sessionError');
    if (!response.ok || data.ok === false) throw (data.error || data.message ? Error(data.error || data.message) : ownedError('apiError'));
    return data;
  }
  const labels = {PENDING:'pending',APPROVED:'approved',DECLINED:'declined',SUPERSEDED:'superseded',EXPIRED:'expired',UNAVAILABLE:'unavailable'};
  function render(quotes, id, rev) {
    list.replaceChildren();
    if (!quotes.length) { labelNode('p','empty',list); return; }
    for (const q of quotes) {
      const card = node('article',null,list,'cw-quote-card');
      labelNode('h3','quoteTitle',card,null,() => ({pool:q.poolName || text('pool'),version:q.version}));
      node('p',q.problem,card); labelNode('p',labels[q.status] || 'unknown',card,'pill');
      labelNode('p','dates',card,'muted',() => ({published:date(q.publishedAt),until:date(q.validUntil)}));
      const lines = node('ul',null,card);
      for (const line of q.lines || []) node('li',`${line.description} — ${line.quantity} × ${eur(line.unitPrice)} = ${eur(line.total)}`,lines);
      labelNode('p','subtotal',card,null,{subtotal:eur(q.subtotal),discount:eur(q.discount),net:eur(q.net)});
      labelNode('p','tax',card,null,{percent:q.taxPercent,tax:eur(q.tax)});
      labelNode('strong','total',card,null,{total:eur(q.total)});
      if (q.terms) { const terms = node('p',q.terms,card); terms.style.whiteSpace = 'pre-wrap'; }
      if (admin()) { labelNode('p','admin',card,'muted'); continue; }
      if (q.status !== 'PENDING') continue;
      const label = node('label',null,card,'cw-quote-confirm');
      const checkbox = node('input',null,label); checkbox.type = 'checkbox';
      labelNode('span','consent',label,null,{version:q.version,total:eur(q.total)});
      const reasonLabel = node('label',null,card); labelNode('span','remark',reasonLabel);
      const reason = node('textarea',null,reasonLabel); reason.maxLength = 1000; reason.rows = 2;
      const actions = node('div',null,card,'cw-quote-actions');
      const message = node('p',null,card); message.setAttribute('role','status');
      for (const decision of ['APPROVED','DECLINED']) {
        const button = labelNode('button',decision === 'APPROVED' ? 'approve' : 'decline',actions,'cw-v2-btn');
        button.type = 'button'; button.disabled = true;
        button.addEventListener('click',async () => {
          if (busy || !checkbox.checked || admin() || !valid(id,rev)) return;
          if (!window.confirm(text(decision === 'APPROVED' ? 'confirmApproved' : 'confirmDeclined',{version:q.version,total:eur(q.total)}))) return;
          busy = true; refresh.disabled = true;
          root.querySelectorAll('button,input,textarea').forEach(control => control.disabled = true);
          try {
            await api(`/api/client-portal/${id}/quotes/${q.id}/decision`, {method:'POST',body:JSON.stringify({decision,confirm:true,reason:reason.value.trim()})},id,rev);
            if (valid(id,rev)) { bind(status,decision === 'APPROVED' ? 'approvalResult' : 'declineResult'); await load(true); }
          } catch (error) {
            if (valid(id,rev)) { list.replaceChildren(); bind(status,'decisionError',() => ({error:errorText(error)})); }
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
    if (!id) { bind(status,'choose'); return; }
    refresh.disabled = true;
    if (!preserveStatus) bind(status,'loading');
    try {
      const data = await api(`/api/client-portal/${id}/quotes`, {},id,rev);
      if (valid(id,rev)) { render(data.quotes || [],id,rev); if (!preserveStatus) bind(status,'updated'); }
    } catch (error) { if (valid(id,rev)) bind(status,'loadError',() => ({error:errorText(error)})); }
    finally { if (valid(id,rev)) refresh.disabled = false; }
  }
  function inspect() {
    if (!valid(selected,revision) && closed) return;
    paint();
    const next = selection();
    if (next !== selected) { selected = next; revision++; list.replaceChildren(); status.textContent = ''; load(); }
  }
  window.addEventListener('storage',inspect); window.addEventListener('focus',inspect);
  window.addEventListener('cw-language-change',paint);
  new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  const timer = setInterval(inspect,300); window.addEventListener('pagehide',()=>clearInterval(timer));
  refresh.addEventListener('click',()=>{ if (!busy) load(); });
  load();
})();
