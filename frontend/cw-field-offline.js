(function () {
  'use strict';
  const principal = () => window.CristalAuth?.parseUser?.() || {};
  const key = () => `cwFieldOutbox:${principal().technicianId || principal().id || 'none'}`;
  const read = () => { try { return JSON.parse(localStorage.getItem(key()) || '{}'); } catch (_) { return {}; } };
  const write = value => { localStorage.setItem(key(), JSON.stringify(value)); render(); };
  let flushing = false;
  function render() {
    let banner = document.getElementById('cwFieldSyncStatus');
    if (!banner) { banner = document.createElement('div'); banner.id = 'cwFieldSyncStatus'; banner.setAttribute('role', 'status'); banner.style.cssText = 'position:sticky;top:0;z-index:50;padding:12px;background:#fff4ce;color:#624400;font-weight:700'; document.body.prepend(banner); }
    const entries = Object.values(read());
    banner.hidden = entries.length === 0;
    banner.textContent = entries.length ? `${entries.length} visita(s) guardada(s) neste dispositivo, por confirmar no servidor. ${entries.find(x=>x.error)?.error || 'A sincronização é automática quando houver ligação.'}` : '';
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
      error.status = response.status; throw error;
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
    const item = (rows[visitId] && !rows[visitId].blocked ? rows[visitId] : null) || { visitId, body: {...body, clientRequestId: crypto.randomUUID()}, createdAt:new Date().toISOString() };
    rows[visitId] = item;
    write(rows); // Persistence must succeed before a network write is attempted.
    try { const result = await send(item); return result; }
    catch (error) {
      if(key() !== submittingOwner) throw error;
      const next = read();
      if (next[visitId]) {
        if (error.status >= 400 && error.status < 500 && error.status !== 401) {
          // A definite validation response permits the user to correct the draft.
          delete next[visitId]; write(next); throw error;
        }
        next[visitId].error = error.status === 401 ? 'Sessão expirada. Inicie sessão para sincronizar.' : 'Sem ligação confirmada.';
        write(next);
      }
      throw new Error('Visita guardada neste dispositivo. Aguarda confirmação do servidor; mantenha os dados da aplicação.');
    }
  }
  async function flush() {
    if (flushing || !navigator.onLine || !window.CristalAuth?.getToken?.() || window.CristalAuth?.isSessionExpired?.()) return;
    flushing = true;
    try {
      for (const item of Object.values(read())) {
        if (item.blocked) continue;
        const submittingOwner = key();
        try { await send(item); }
        catch (error) {
          if(key() !== submittingOwner) break;
          const rows = read();
          if (rows[item.visitId]) { rows[item.visitId].error = error.message; rows[item.visitId].blocked = error.status >= 400 && error.status < 500 && error.status !== 401; write(rows); }
          if (!error.status || error.status === 401) break;
        }
      }
    } finally { flushing = false; }
  }
  window.CWFieldOffline = { submitCompletion, flush, pending: visitId => Boolean(read()[visitId]), render };
  window.addEventListener('online', flush);
  window.addEventListener('pageshow', flush);
  setInterval(flush,30000);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
})();
