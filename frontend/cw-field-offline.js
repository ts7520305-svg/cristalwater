(function () {
  'use strict';
  const store = window.CWFieldWriteStore;
  const languages = ['pt', 'en', 'fr', 'es', 'de'];
  // Display copy only. Stored labels, server evidence, payloads and receipt values remain literal.
  const texts = {
    sessionChanged: ['A sessão mudou. Reabra a página com a conta original.', 'The session changed. Reopen the page with the original account.', 'La session a changé. Rouvrez la page avec le compte d’origine.', 'La sesión cambió. Abra la página con la cuenta original.', 'Die Sitzung wurde geändert. Öffnen Sie die Seite mit dem ursprünglichen Konto erneut.'],
    history: ['Existem envios antigos ou ilegíveis sem conta confirmada. Os dados existentes não serão substituídos. Não limpe os dados da aplicação; peça revisão ao escritório.', 'There are older or unreadable submissions without a confirmed account. Existing data will not be replaced. Do not clear the application data; ask the office to review it.', 'Des envois anciens ou illisibles n’ont pas de compte confirmé. Les données existantes ne seront pas remplacées. N’effacez pas les données de l’application ; demandez une vérification au bureau.', 'Hay envíos antiguos o ilegibles sin una cuenta confirmada. Los datos existentes no se sustituirán. No borre los datos de la aplicación; pida una revisión a la oficina.', 'Es gibt ältere oder unlesbare Sendungen ohne bestätigtes Konto. Vorhandene Daten werden nicht ersetzt. Löschen Sie keine App-Daten; bitten Sie das Büro um Prüfung.'],
    expired: ['Sessão expirada. Volte a entrar com a mesma conta.', 'Session expired. Sign in again with the same account.', 'Session expirée. Reconnectez-vous avec le même compte.', 'Sesión caducada. Inicie sesión de nuevo con la misma cuenta.', 'Sitzung abgelaufen. Melden Sie sich mit demselben Konto erneut an.'],
    assignment: ['A visita pode ter sido alterada ou atribuída a outro técnico. Peça ao escritório para confirmar. O registo foi preservado.', 'The visit may have changed or been assigned to another technician. Ask the office to confirm. The record was preserved.', 'La visite a peut-être été modifiée ou attribuée à un autre technicien. Demandez confirmation au bureau. Le dossier a été conservé.', 'La visita puede haber cambiado o estar asignada a otro técnico. Pida confirmación a la oficina. El registro se ha conservado.', 'Der Besuch wurde möglicherweise geändert oder einem anderen Techniker zugewiesen. Bitten Sie das Büro um Bestätigung. Der Datensatz bleibt erhalten.'],
    conflict: ['O servidor detetou um conflito. Confirme a visita, os produtos e o stock com o escritório antes de repetir.', 'The server detected a conflict. Confirm the visit, products and stock with the office before retrying.', 'Le serveur a détecté un conflit. Vérifiez la visite, les produits et le stock avec le bureau avant de réessayer.', 'El servidor detectó un conflicto. Confirme la visita, los productos y las existencias con la oficina antes de reintentar.', 'Der Server hat einen Konflikt erkannt. Klären Sie Besuch, Produkte und Bestand mit dem Büro, bevor Sie es erneut versuchen.'],
    unconfirmed: ['Sem confirmação do servidor.', 'No confirmation from the server.', 'Aucune confirmation du serveur.', 'Sin confirmación del servidor.', 'Keine Bestätigung vom Server.'],
    originalError: ['Sem confirmação do servidor. Mensagem original: {message}', 'No confirmation from the server. Original message: {message}', 'Aucune confirmation du serveur. Message d’origine : {message}', 'Sin confirmación del servidor. Mensaje original: {message}', 'Keine Bestätigung vom Server. Originalmeldung: {message}'],
    rejectedSummary: ['Há correções não aplicadas. Reveja os avisos antes de continuar.', 'Some corrections were not applied. Review the notices before continuing.', 'Certaines corrections n’ont pas été appliquées. Consultez les avis avant de continuer.', 'Hay correcciones sin aplicar. Revise los avisos antes de continuar.', 'Einige Korrekturen wurden nicht angewendet. Prüfen Sie die Hinweise, bevor Sie fortfahren.'],
    pendingCount: ['{count} visita(s) guardada(s) neste dispositivo, por confirmar no servidor.', '{count} visit(s) saved on this device, awaiting server confirmation.', '{count} visite(s) enregistrée(s) sur cet appareil, en attente de confirmation du serveur.', '{count} visita(s) guardada(s) en este dispositivo, pendientes de confirmación del servidor.', '{count} Besuch(e) auf diesem Gerät gespeichert, Serverbestätigung steht aus.'],
    showPending: ['Ver envios pendentes', 'View pending submissions', 'Voir les envois en attente', 'Ver envíos pendientes', 'Ausstehende Sendungen anzeigen'],
    rejection: ['Correção não aplicada. {message} Abra a visita concluída para rever o registo.', 'Correction not applied. {message} Open the completed visit to review the record.', 'Correction non appliquée. {message} Ouvrez la visite terminée pour vérifier le dossier.', 'Corrección sin aplicar. {message} Abra la visita finalizada para revisar el registro.', 'Korrektur nicht angewendet. {message} Öffnen Sie den abgeschlossenen Besuch, um den Datensatz zu prüfen.'],
    waiting: ['Aguarda sincronização automática.', 'Awaiting automatic synchronization.', 'En attente de synchronisation automatique.', 'Pendiente de sincronización automática.', 'Automatische Synchronisierung steht aus.'],
    offline: ['Sem ligação. O envio está guardado neste dispositivo e aguarda sincronização.', 'Offline. The submission is saved on this device and awaits synchronization.', 'Hors ligne. L’envoi est enregistré sur cet appareil et attend la synchronisation.', 'Sin conexión. El envío está guardado en este dispositivo y espera la sincronización.', 'Offline. Die Sendung ist auf diesem Gerät gespeichert und wartet auf Synchronisierung.'],
    retryBlocked: ['Confirmado pelo escritório — tentar novamente', 'Confirmed by the office — retry', 'Confirmé par le bureau — réessayer', 'Confirmado por la oficina — reintentar', 'Vom Büro bestätigt — erneut versuchen'],
    confirmSaved: ['Confirmar envio guardado', 'Confirm saved submission', 'Confirmer l’envoi enregistré', 'Confirmar envío guardado', 'Gespeicherten Versand bestätigen'],
    acknowledge: ['Tomei conhecimento da recusa', 'I have reviewed the rejection', 'J’ai pris connaissance du refus', 'He revisado el rechazo', 'Ich habe die Ablehnung zur Kenntnis genommen'],
    sending: ['A confirmar…', 'Confirming…', 'Confirmation…', 'Confirmando…', 'Wird bestätigt…'],
    sessionPreserved: ['A sessão mudou. O pedido foi preservado.', 'The session changed. The request was preserved.', 'La session a changé. La demande a été conservée.', 'La sesión cambió. La solicitud se ha conservado.', 'Die Sitzung wurde geändert. Die Anfrage bleibt erhalten.'],
    saved: ['Visita guardada neste dispositivo. {message}', 'Visit saved on this device. {message}', 'Visite enregistrée sur cet appareil. {message}', 'Visita guardada en este dispositivo. {message}', 'Besuch auf diesem Gerät gespeichert. {message}'],
  };
  const t = (key, values = {}) => {
    const language = String(window.CristalI18n?.readLanguage?.() || document.documentElement.lang || 'pt').slice(0, 2).toLowerCase();
    const value = texts[key][Math.max(0, languages.indexOf(language))];
    return value.replace(/\{(count|message)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
  };
  const activeSends = new Set();
  let flushing = false, revision = 0;
  function assertHistory(captured = store.session()) {
    if (!store.same(captured)) throw Error(t('sessionChanged'));
    const raw = localStorage.getItem('cwFieldOutbox:' + captured.technicianId);
    try {
      const rows = JSON.parse(raw || '{}');
      if (!rows || typeof rows !== 'object' || Array.isArray(rows) || Object.keys(rows).length) throw Error('Historic queue');
    } catch (_) { throw Error(t('history')); }
  }
  function message(error) {
    if (error.status === 401) return t('expired');
    if ([403,404].includes(error.status)) return t('assignment');
    if (error.status === 409) return t('conflict');
    return error.message ? t('originalError', { message: error.message }) : t('unconfirmed');
  }
  async function entries(captured = store.session()) { assertHistory(captured); return (await store.records(null, captured)).filter(row=>['VISIT_COMPLETION','EXTRA_VISIT_COMPLETION','EXTRA_VISIT_START','EXTRA_VISIT_CORRECTION'].includes(row.scope)); }
  async function rejections(captured=store.session()) { const latest=new Map();for(const row of await store.records('EXTRA_VISIT_CORRECTION',captured,true))latest.set(row.resourceId,row);return [...latest.values()].filter(row=>row.response?.applied===false&&!row.reviewedAt); }
  async function pending(visitId, visitType = 'REGULAR') { return (await entries()).some(row => row.resourceId === Number(visitId) && row.scope === (visitType === 'EXTRA' ? 'EXTRA_VISIT_COMPLETION' : 'VISIT_COMPLETION')); }
  async function render() {
    const current = ++revision, captured = store.session();
    let banner = document.getElementById('cwFieldSyncStatus');
    if (!banner) { banner = document.createElement('aside'); banner.id = 'cwFieldSyncStatus'; banner.setAttribute('role','status'); banner.setAttribute('data-cw-state-managed','manual'); banner.setAttribute('data-cw-no-i18n',''); banner.style.cssText = 'padding:12px;background:#fff4ce;color:#624400;font-weight:700;overflow-wrap:anywhere;box-sizing:border-box;max-width:100%'; document.body.prepend(banner); }
    try {
      if (!captured) { banner.hidden = true; banner.replaceChildren(); document.getElementById('cwFieldStorageError')?.remove(); return; }
      const rows = [...await entries(captured),...await rejections(captured)];
      await window.CWFieldPhotos?.assertHistory(captured);
      if (current !== revision || !store.same(captured)) return;
      document.getElementById('cwFieldStorageError')?.remove();
      const expanded = banner.querySelector('details')?.open === true;
      banner.hidden = !rows.length; banner.replaceChildren();
      if (!rows.length) return;
      const summary = document.createElement('p'); summary.textContent = rows.some(row=>row.response?.applied===false) ? t('rejectedSummary') : t('pendingCount', { count: rows.length }); banner.append(summary);
      const details = document.createElement('details'), title = document.createElement('summary');
      details.open = expanded || rows.some(row => row.failure); title.textContent = t('showPending'); title.style.minHeight = '44px'; details.append(title);
      for (const row of rows) {
        const item = document.createElement('div'); item.dataset.pendingVisit = row.resourceId; item.style.cssText = 'padding:12px 0;border-top:1px solid #d8be74';
        const name = document.createElement('strong'), info = document.createElement('p'), button = document.createElement('button');
        name.textContent = row.label; info.textContent = row.response?.applied===false ? t('rejection', { message: row.response.message }) : row.failure ? message(row.failure) : t(navigator.onLine ? 'waiting' : 'offline');
        const activeKey = captured.owner + ':' + row.requestId;
        button.type = 'button'; button.textContent = t(activeSends.has(activeKey) ? 'sending' : row.response?.applied===false ? 'acknowledge' : row.failure?.blocked ? 'retryBlocked' : 'confirmSaved'); button.disabled = activeSends.has(activeKey); button.style.cssText = 'min-height:44px;max-width:100%;padding:10px;white-space:normal;overflow-wrap:anywhere';
        button.onclick = async () => {
          if (activeSends.has(activeKey)) return;
          activeSends.add(activeKey); button.disabled = true; button.textContent = t('sending');
          try { if(row.response?.applied===false)await store.acknowledgeRejection(row.requestId,captured);else await send(row, captured); }
          catch (error) { if (store.same(captured)) info.textContent = message(error); }
          finally { activeSends.delete(activeKey); await render(); }
        };
        item.append(name, info, button); details.append(item);
      }
      banner.append(details);
    } catch (error) {
      if (current !== revision || !store.same(captured)) return;
      banner.hidden = true;
      let warning = document.getElementById('cwFieldStorageError');
      if (!warning) { warning = document.createElement('aside'); warning.id = 'cwFieldStorageError'; warning.setAttribute('role','alert'); warning.setAttribute('data-cw-no-i18n',''); warning.style.cssText = 'padding:16px;background:#ffe2cf;color:#562800;font-weight:700;overflow-wrap:anywhere;box-sizing:border-box;max-width:100%'; document.body.prepend(warning); }
      warning.textContent = error.message;
    }
  }
  async function send(row, captured, options = {}) {
    assertHistory(captured);
    const visitType = row.scope.startsWith('EXTRA_') ? 'EXTRA' : 'REGULAR';
    if (!['EXTRA_VISIT_START','EXTRA_VISIT_CORRECTION'].includes(row.scope)) await window.CWFieldPhotos?.sync(row.resourceId, captured, options, visitType);
    const result = await store.send(row.requestId, captured, options);
    if (!store.same(captured)) throw Error(t('sessionPreserved'));
    if(row.scope==='EXTRA_VISIT_CORRECTION')window.dispatchEvent(new CustomEvent('cw:extra-correction-confirmed',{detail:{visitId:row.resourceId,result,owner:captured.owner,token:captured.token}}));
    else window.dispatchEvent(new CustomEvent('cw:visit-synced', { detail: { visitId: row.resourceId, visitType, visit: result.visit, owner: captured.owner, token: captured.token } }));
    return result;
  }
  async function prepareCompletion(visitId, body, captured = store.session(), visitType = 'REGULAR') {
    assertHistory(captured);
    return store.prepare(visitType === 'EXTRA' ? 'EXTRA_VISIT_COMPLETION' : 'VISIT_COMPLETION', Number(visitId), body, { label: document.getElementById('nextTitle')?.textContent || 'Visita ' + visitId }, captured);
  }
  async function sendPreparedCompletion(row, captured = store.session()) {
    try { return await send(row, captured); }
    catch (error) { if (!store.same(captured)) throw error; throw Object.assign(Error(t('saved', { message: message(error) })), { status: error.status }); }
    finally { await render(); }
  }
  async function submitCompletion(visitId, body, captured = store.session(), visitType = 'REGULAR') {
    return sendPreparedCompletion(await prepareCompletion(visitId,body,captured,visitType),captured);
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
  window.CWFieldOffline = { submitExtraStart, submitCompletion, prepareCompletion, sendPreparedCompletion, flush, pending, render, retry, entries, rejections, assertHistory };
  window.addEventListener('cw:field-write-change', render);
  window.addEventListener('cw-language-change', render);
  // Initial server preference loads are silent; react only to an actual language change.
  let observedLanguage = document.documentElement.lang;
  new MutationObserver(() => {
    if (document.documentElement.lang === observedLanguage) return;
    observedLanguage = document.documentElement.lang; render();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  window.addEventListener('storage', render);
  window.addEventListener('offline', render);
  window.addEventListener('online', flush);
  window.addEventListener('pageshow', flush);
  setInterval(flush, 30000);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
