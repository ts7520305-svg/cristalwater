(function () {
  'use strict';
  const principal = () => window.CristalAuth?.parseUser?.() || {};
  const key = () => `cwFieldOutbox:${principal().technicianId || principal().id || 'none'}`;
  const read = () => { try { return JSON.parse(localStorage.getItem(key()) || '{}'); } catch (_) { return {}; } };
  const write = value => { localStorage.setItem(key(), JSON.stringify(value)); render(); };
  let flushing = false;
  const isBlocked = status => status >= 400 && status < 500 && ![401,408,425,429].includes(status);
  function failureMessage(error) {
    if(error.status===401)return 'Sessão expirada. Volte a entrar com a mesma conta.';
    if([403,404].includes(error.status))return 'A visita pode ter sido alterada ou atribuída a outro técnico. Peça ao escritório para confirmar. O registo foi preservado.';
    if(error.status===409)return 'O servidor detetou um conflito. Confirme a visita, os produtos e o stock com o escritório antes de repetir.';
    if(error.status===429)return 'O servidor pediu uma pausa. O envio será repetido automaticamente.';
    return error.message || 'Sem ligação confirmada.';
  }
  function recordFailure(visitId,error) {
    const rows=read();
    if(rows[visitId]){
      rows[visitId].error=failureMessage(error);rows[visitId].blocked=isBlocked(error.status);
      rows[visitId].retryAt=error.retryAt || null;write(rows);
    }
  }
  async function retry(visitId) {
    const rows=read();if(!rows[visitId])return;
    rows[visitId].blocked=false;rows[visitId].error='';write(rows);
    await flush();
  }
  function render() {
    let banner = document.getElementById('cwFieldSyncStatus');
    if (!banner) { banner = document.createElement('div'); banner.id = 'cwFieldSyncStatus'; banner.setAttribute('role', 'status'); banner.style.cssText = 'position:sticky;top:0;z-index:50;padding:12px;background:#fff4ce;color:#624400;font-weight:700'; document.body.prepend(banner); }
    const entries = Object.values(read());
    banner.hidden = entries.length === 0;
    banner.replaceChildren();
    if(!entries.length)return;
    const summary=document.createElement('div');
    summary.textContent=`${entries.length} visita(s) guardada(s) neste dispositivo, por confirmar no servidor. ${entries.filter(item=>item.blocked).length ? "Existem envios que precisam de confirmação do escritório." : ""}`;banner.append(summary);
    const details=document.createElement('details'),title=document.createElement('summary');
    details.open=entries.some(item=>item.blocked);
    title.textContent='Ver envios pendentes';title.style.minHeight='44px';details.append(title);
    for(const item of entries){
      const row=document.createElement('div');row.dataset.pendingVisit=item.visitId;row.style.cssText='padding:12px 0;border-top:1px solid #d8be74';
      const name=document.createElement('strong');name.textContent=item.label || `Visita ${item.visitId}`;
      const message=document.createElement('p');message.textContent=item.error || 'Aguarda sincronização automática.';row.append(name,message);
      if(item.blocked){
        const button=document.createElement('button');button.type='button';button.textContent='Confirmado pelo escritório — tentar novamente';button.style.cssText='min-height:44px;padding:10px;white-space:normal';
        button.onclick=()=>retry(item.visitId).catch(()=>{message.textContent='Não foi possível repetir. O registo continua neste telemóvel.'});row.append(button);
      }
      details.append(row);
    }
    banner.append(details);
  }
  async function send(item) {
    const submittingOwner = key();
    const submittingToken = window.CristalAuth?.getToken?.();
    await window.CWFieldPhotos?.sync(item.visitId);
    if(key() !== submittingOwner || window.CristalAuth?.getToken?.() !== submittingToken) throw new Error('Sessão alterada durante o envio');
    const response = await fetch(`/api/core/visits/${encodeURIComponent(item.visitId)}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${submittingToken}` }, body: JSON.stringify(item.body) });
    const result = await response.json().catch(()=>({}));
    if (!response.ok || response.status === 202 || result.offline || !result.visit?.id) {
      const error = new Error(result.error || result.message || 'Sem confirmação do servidor');
      error.status = response.status;
      if(response.status===429){
        const value=response.headers.get('Retry-After'),seconds=Number(value);
        const delay=value && Number.isFinite(seconds)?seconds*1000:Date.parse(value)-Date.now();
        error.retryAt=Date.now()+Math.max(30000,Math.min(Number.isFinite(delay)?delay:30000,3600000));
      }
      throw error;
    }
    if(key() !== submittingOwner) throw new Error('Sessão alterada durante o envio');
    const rows = read();
    if (rows[item.visitId]?.body.clientRequestId === item.body.clientRequestId) { delete rows[item.visitId]; write(rows); }
    window.dispatchEvent(new CustomEvent('cw:visit-synced', {detail:{visitId:item.visitId,visit:result.visit}}));
    return result;
  }
  async function submitCompletion(visitId, body) {
    const submittingOwner = key();
    const rows = read();
    const item = (rows[visitId] && !rows[visitId].blocked ? rows[visitId] : null) || { visitId, body: {...body, clientRequestId: crypto.randomUUID()}, createdAt:new Date().toISOString(), label:document.getElementById("nextTitle")?.textContent || `Visita ${visitId}` };
    rows[visitId] = item;
    write(rows); // Persistence must succeed before a network write is attempted.
    if(item.retryAt && item.retryAt>Date.now())throw new Error('O servidor pediu uma pausa. A visita permanece guardada e será enviada automaticamente.');
    try { const result = await send(item); return result; }
    catch (error) {
      if(key() !== submittingOwner) throw error;
      recordFailure(visitId,error);
      if(isBlocked(error.status))throw new Error(failureMessage(error));
      throw new Error('Visita guardada neste dispositivo. Aguarda confirmação do servidor; mantenha os dados da aplicação.');
    }
  }
  async function flush() {
    if (flushing || !navigator.onLine || !window.CristalAuth?.getToken?.() || window.CristalAuth?.isSessionExpired?.()) return;
    flushing = true;
    try {
      for (const item of Object.values(read())) {
        if (item.blocked || (item.retryAt && item.retryAt>Date.now())) continue;
        const submittingOwner = key();
        try { await send(item); }
        catch (error) {
          if(key() !== submittingOwner) break;
          recordFailure(item.visitId,error);
          if (!error.status || error.status === 401) break;
        }
      }
    } finally { flushing = false; }
  }
  window.CWFieldOffline = { submitCompletion, flush, pending: visitId => Boolean(read()[visitId]), render, retry };
  window.addEventListener('online', flush);
  window.addEventListener('pageshow', flush);
  setInterval(flush,30000);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
})();
