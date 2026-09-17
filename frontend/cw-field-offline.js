(function () {
  'use strict';
  const store = window.CWFieldWriteStore;
  let flushing = false, revision = 0;
  function assertHistory(captured = store.session()) {
    if (!store.same(captured)) throw Error('A sessão mudou. Reabra a página com a conta original.');
    const raw = localStorage.getItem('cwFieldOutbox:' + captured.technicianId);
    try {
      const rows = JSON.parse(raw || '{}');
      if (!rows || typeof rows !== 'object' || Array.isArray(rows) || Object.keys(rows).length) throw Error('Historic queue');
    } catch (_) { throw Error('Existem envios antigos ou ilegíveis sem conta confirmada. Os dados existentes não serão substituídos. Não limpe os dados da aplicação; peça revisão ao escritório.'); }
  }
  function message(error) {
    if (error.status === 401) return 'Sessão expirada. Volte a entrar com a mesma conta.';
    if ([403,404].includes(error.status)) return 'A visita pode ter sido alterada ou atribuída a outro técnico. Peça ao escritório para confirmar. O registo foi preservado.';
    if (error.status === 409) return 'O servidor detetou um conflito. Confirme a visita, os produtos e o stock com o escritório antes de repetir.';
    return error.message || 'Sem confirmação do servidor.';
  }
  async function entries(captured = store.session()) { assertHistory(captured); return (await store.records(null, captured)).filter(row=>['VISIT_COMPLETION','EXTRA_VISIT_COMPLETION','EXTRA_VISIT_START','EXTRA_VISIT_CORRECTION'].includes(row.scope)); }
  async function rejections(captured=store.session()) { const latest=new Map();for(const row of await store.records('EXTRA_VISIT_CORRECTION',captured,true))latest.set(row.resourceId,row);return [...latest.values()].filter(row=>row.response?.applied===false&&!row.reviewedAt); }
  async function pending(visitId, visitType = 'REGULAR') { return (await entries()).some(row => row.resourceId === Number(visitId) && row.scope === (visitType === 'EXTRA' ? 'EXTRA_VISIT_COMPLETION' : 'VISIT_COMPLETION')); }
  async function render() {
    const current = ++revision, captured = store.session();
    let banner = document.getElementById('cwFieldSyncStatus');
    if (!banner) { banner = document.createElement('aside'); banner.id = 'cwFieldSyncStatus'; banner.setAttribute('role','status'); banner.setAttribute('data-cw-state-managed','manual'); banner.style.cssText = 'padding:12px;background:#fff4ce;color:#624400;font-weight:700'; document.body.prepend(banner); }
    try {
      if (!captured) { banner.hidden = true; banner.replaceChildren(); document.getElementById('cwFieldStorageError')?.remove(); return; }
      const rows = [...await entries(captured),...await rejections(captured)];
      await window.CWFieldPhotos?.assertHistory(captured);
      if (current !== revision || !store.same(captured)) return;
      document.getElementById('cwFieldStorageError')?.remove();
      const expanded = banner.querySelector('details')?.open === true;
      banner.hidden = !rows.length; banner.replaceChildren();
      if (!rows.length) return;
      const summary = document.createElement('p'); summary.textContent = rows.some(row=>row.response?.applied===false) ? 'Há correções não aplicadas. Reveja os avisos antes de continuar.' : rows.length + ' visita(s) guardada(s) neste dispositivo, por confirmar no servidor.'; banner.append(summary);
      const details = document.createElement('details'), title = document.createElement('summary');
      details.open = expanded || rows.some(row => row.failure); title.textContent = 'Ver envios pendentes'; title.style.minHeight = '44px'; details.append(title);
      for (const row of rows) {
        const item = document.createElement('div'); item.dataset.pendingVisit = row.resourceId; item.style.cssText = 'padding:12px 0;border-top:1px solid #d8be74';
        const name = document.createElement('strong'), info = document.createElement('p'), button = document.createElement('button');
        name.textContent = row.label; info.textContent = row.response?.applied===false ? 'Correção não aplicada. '+row.response.message+' Abra a visita concluída para rever o registo.' : row.failure ? message(row.failure) : 'Aguarda sincronização automática.';
        button.type = 'button'; button.textContent = row.failure?.blocked ? 'Confirmado pelo escritório — tentar novamente' : 'Confirmar envio guardado'; button.style.cssText = 'min-height:44px;padding:10px;white-space:normal';
        if(row.response?.applied===false)button.textContent='Tomei conhecimento da recusa';
        button.onclick = async () => { button.disabled = true; try { if(row.response?.applied===false)await store.acknowledgeRejection(row.requestId,captured);else await send(row, captured); } catch (error) { if (store.same(captured)) info.textContent = message(error); } finally { if(store.same(captured))await render(); button.disabled = false; } };
        item.append(name, info, button); details.append(item);
      }
      banner.append(details);
    } catch (error) {
      if (current !== revision || !store.same(captured)) return;
      banner.hidden = true;
      let warning = document.getElementById('cwFieldStorageError');
      if (!warning) { warning = document.createElement('aside'); warning.id = 'cwFieldStorageError'; warning.setAttribute('role','alert'); warning.style.cssText = 'padding:16px;background:#ffe2cf;color:#562800;font-weight:700'; document.body.prepend(warning); }
      warning.textContent = error.message;
    }
  }
  async function send(row, captured, options = {}) {
    assertHistory(captured);
    const visitType = row.scope.startsWith('EXTRA_') ? 'EXTRA' : 'REGULAR';
    if (!['EXTRA_VISIT_START','EXTRA_VISIT_CORRECTION'].includes(row.scope)) await window.CWFieldPhotos?.sync(row.resourceId, captured, options, visitType);
    const result = await store.send(row.requestId, captured, options);
    if (!store.same(captured)) throw Error('A sessão mudou. O pedido foi preservado.');
    if(row.scope==='EXTRA_VISIT_CORRECTION')window.dispatchEvent(new CustomEvent('cw:extra-correction-confirmed',{detail:{visitId:row.resourceId,result,owner:captured.owner,token:captured.token}}));
    else window.dispatchEvent(new CustomEvent('cw:visit-synced', { detail: { visitId: row.resourceId, visitType, visit: result.visit, owner: captured.owner, token: captured.token } }));
    return result;
  }
  async function submitCompletion(visitId, body, captured = store.session(), visitType = 'REGULAR') {
    assertHistory(captured);
    const row = await store.prepare(visitType === 'EXTRA' ? 'EXTRA_VISIT_COMPLETION' : 'VISIT_COMPLETION', Number(visitId), body, { label: document.getElementById('nextTitle')?.textContent || 'Visita ' + visitId }, captured);
    try { return await send(row, captured); }
    catch (error) { if (!store.same(captured)) throw error; throw Object.assign(Error('Visita guardada neste dispositivo. ' + message(error)), { status: error.status }); }
    finally { await render(); }
  }
  async function retry(visitId, captured = store.session(), visitType = 'REGULAR') {
    const row = (await entries(captured)).find(item => item.resourceId === Number(visitId) && item.scope === (visitType === 'EXTRA' ? 'EXTRA_VISIT_COMPLETION' : 'VISIT_COMPLETION'));
    try { if (row) return await send(row, captured); } finally { await render(); }
  }
  async function flush() {
    const captured = store.session();
    if (flushing || !captured || !navigator.onLine || window.CristalAuth?.isSessionExpired?.()) return;
    flushing = true;
    try {
      for (const row of await entries(captured)) {
        if (row.failure?.blocked || row.failure?.retryAt > Date.now()) continue;
        try { await send(row, captured, { automatic: true }); }
        catch (error) { if (!store.same(captured) || !error.status || error.status === 401) break; }
      }
    } catch (_) { /* render retains and reports unreadable history. */ }
    finally { flushing = false; await render(); }
  }
  async function submitExtraStart(visit, captured = store.session()) {
    const row = await store.prepare('EXTRA_VISIT_START',Number(visit.id),{visitType:'EXTRA',poolId:visit.poolId || visit.pool?.id},{label:'Início: '+(visit.pool?.name || visit.id)},captured);
    try { return await send(row,captured); } finally { await render(); }
  }
  window.CWFieldOffline = { submitExtraStart, submitCompletion, flush, pending, render, retry, entries, rejections, assertHistory };
  window.addEventListener('cw:field-write-change', render);
  window.addEventListener('storage', render);
  window.addEventListener('online', flush);
  window.addEventListener('pageshow', flush);
  setInterval(flush, 30000);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
