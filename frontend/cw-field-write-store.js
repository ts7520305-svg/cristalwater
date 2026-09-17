(function () {
  'use strict';
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const scopes = ['VISIT_PHOTO', 'VISIT_COMPLETION', 'TECHNICIAN_ALERT', 'EXTRA_VISIT_START', 'EXTRA_VISIT_PHOTO', 'EXTRA_VISIT_COMPLETION'];
  const photoScope = scope => ['VISIT_PHOTO','EXTRA_VISIT_PHOTO'].includes(scope);
  const extraScope = scope => scope.startsWith('EXTRA_VISIT_');
  const id = value => Number.isSafeInteger(value) && value > 0;
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
  const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(value => value.toString(16).padStart(2, '0')).join('');
  const hash = value => digest(new TextEncoder().encode(JSON.stringify(canonical(value))));
  const envelope = record => ({ v: 1, scope: record.scope, resourceId: record.resourceId, payload: record.payload });
  function session() {
    try {
      const token = window.CristalAuth?.getToken?.();
      if (!token || (localStorage.getItem('token') && localStorage.getItem('token') !== token)) return null;
      const claim = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))), technicianId = Number(claim.technicianId || claim.id), userId = Number(claim.userId || claim.id);
      if (!['TECHNICIAN', 'TEAM_LEADER'].includes(claim.role) || !id(technicianId) || (claim.principalType === 'USER' && !id(userId))) return null;
      return { token, technicianId, owner: claim.principalType === 'USER' ? `USER:${userId}:TECH:${technicianId}` : `TECH:${technicianId}` };
    } catch (_) { return null; }
  }
  function same(captured) { const current = session(); return !!captured && current?.owner === captured.owner && current?.token === captured.token; }
  function requireSession(captured) { if (!same(captured)) throw Error('A sessão mudou. Reabra a página com a conta original; os envios foram preservados.'); }
  const key = record => `${record.owner}:${record.requestId}`;
  function database() { return new Promise((resolve, reject) => { const request = indexedDB.open('cw-field-writes', 1); request.onupgradeneeded = () => request.result.createObjectStore('requests', { keyPath: 'key' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(Error('Feche as outras janelas para recuperar os envios.')); }); }
  async function transaction(mode, operation) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('requests', mode), store = tx.objectStore('requests'); let result, failure;
      tx.oncomplete = () => { db.close(); resolve(result); }; tx.onabort = tx.onerror = () => { db.close(); reject(failure || tx.error || Error('Não foi possível guardar o envio.')); };
      const done = value => { result = value; }, abort = error => { failure = error; tx.abort(); };
      try { operation(store, done, abort); } catch (error) { abort(error); }
    });
  }
  function confirmation(response, record) {
    const receipt = response?.receipt;
    if (response?.ok !== true || !receipt || receipt.owner !== record.owner || receipt.requestId !== record.requestId || receipt.scope !== record.scope || receipt.resourceId !== record.resourceId || receipt.payloadHash !== record.payloadHash || !Number.isFinite(Date.parse(receipt.confirmedAt))) throw Error('Resposta incompleta. O pedido original continua por confirmar.');
    if (photoScope(record.scope)) {
      if (!id(response.photo?.id) || response.photo[extraScope(record.scope) ? 'extraVisitId' : 'visitId'] !== record.resourceId || response.photo.type !== record.payload.type || !(extraScope(record.scope) ? /^\/uploads\/(?:qa\/)?extra-visit-/ : /^\/uploads\/(?:qa\/)?visit-/).test(response.photo.url) || response.sha256 !== record.payload.sha256 || response.size !== record.payload.size) throw Error('A confirmação não corresponde à fotografia guardada.');
    } else if (record.scope === 'TECHNICIAN_ALERT') {
      if (!id(response.alert?.id) || response.alert.technicianId !== record.resourceId || response.alert.visitId !== record.payload.visitId || response.alert.message !== record.payload.message || response.alert.priority !== record.payload.priority || response.alert.recipientRole !== 'ADMIN' || !Number.isFinite(Date.parse(response.alert.createdAt))) throw Error('A confirmação não corresponde ao alerta original para a administração.');
    } else if (record.scope === 'EXTRA_VISIT_START') {
      if (response.visit?.id !== record.resourceId || response.visit.visitType !== 'EXTRA' || response.visit.poolId !== record.payload.poolId || response.visit.status !== 'IN_PROGRESS' || !Number.isFinite(Date.parse(response.visit.startAt)) || response.visit.endAt) throw Error('O início da visita extra ainda não está confirmado.');
    } else if (response.visit?.id !== record.resourceId || response.visit.status !== 'DONE' || response.visit.completionRequestId !== record.requestId || !Number.isFinite(Date.parse(response.visit.endAt))) throw Error('A conclusão desta visita ainda não está confirmada.');
    if (extraScope(record.scope) && !photoScope(record.scope) && (response.visit.visitType !== 'EXTRA' || response.visit.poolId !== record.payload.poolId)) throw Error('A confirmação pertence a outra piscina ou tipo de visita.');
    return response;
  }
  async function validate(record, captured, bytes = false) {
    const allowed = ['key','owner','requestId','scope','resourceId','payload','payloadHash','createdAt','file','fileName','label','attemptedAt','response','failure'];
    if (!record || Object.keys(record).some(field => !allowed.includes(field)) || record.owner !== captured.owner || !uuid.test(record.requestId) || record.key !== key(record) || !scopes.includes(record.scope) || !id(record.resourceId) || !record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload) || !Number.isFinite(Date.parse(record.createdAt)) || await hash(envelope(record)) !== record.payloadHash) throw Error('Envio guardado inválido. Os dados foram preservados; peça apoio ao escritório.');
    if (record.scope === 'TECHNICIAN_ALERT' && (record.resourceId !== captured.technicianId || Object.keys(record.payload).some(field => !['message','visitId','priority'].includes(field)) || typeof record.payload.message !== 'string' || !record.payload.message.trim() || record.payload.message.length > 5000 || !['NORMAL','HIGH'].includes(record.payload.priority) || (record.payload.visitId !== null && !id(record.payload.visitId)))) throw Error('Alerta guardado inválido. Preserve os dados e peça revisão ao escritório.');
    if (record.response) confirmation(record.response, record);
    else if (photoScope(record.scope)) {
      if (!(record.file instanceof Blob) || !record.file.size || record.file.size > 25 * 1024 * 1024 || record.file.size !== record.payload.size || !['BEFORE','AFTER','PROBLEM','ACCESS','GENERAL'].includes(record.payload.type) || !/^[0-9a-f]{64}$/.test(record.payload.sha256) || (bytes && await digest(await record.file.arrayBuffer()) !== record.payload.sha256)) throw Error('Fotografia guardada inválida. Os dados foram preservados.');
    }
    return record;
  }
  async function records(scope, captured = session(), includeConfirmed = false) {
    requireSession(captured);
    const all = await transaction('readonly', (store, done) => { const read = store.getAll(); read.onsuccess = () => done(read.result); });
    const own = all.filter(record => record.owner === captured.owner || String(record.key).startsWith(captured.owner + ':'));
    for (const record of own) await validate(record, captured);
    requireSession(captured); return own.filter(record => (!scope || record.scope === scope) && (includeConfirmed || !record.response)).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.resourceId - b.resourceId || a.requestId.localeCompare(b.requestId));
  }
  async function get(requestId, captured) { requireSession(captured); const record = await transaction('readonly', (store, done) => { const read = store.get(`${captured.owner}:${requestId}`); read.onsuccess = () => done(read.result); }); requireSession(captured); if (!record) throw Error('Pedido guardado não encontrado.'); return validate(record, captured, true); }
  async function locked(name, captured, operation) {
    requireSession(captured);
    if (!navigator.locks?.request) throw Error('Este navegador não permite coordenar os envios. Os dados foram preservados.');
    return navigator.locks.request(`cw-field-write:${captured.owner}:${name}`, { ifAvailable: true }, async lock => { if (!lock) throw Error('O envio está em utilização noutra janela. Tente confirmar novamente.'); requireSession(captured); return operation(); });
  }
  async function prepare(scope, resourceId, payload, options = {}, captured = session()) {
    return locked(`prepare:${scope}:${resourceId}`, captured, async () => {
      const previous = await records(scope, captured, true);
      if (['VISIT_COMPLETION','EXTRA_VISIT_COMPLETION','EXTRA_VISIT_START'].includes(scope)) { const existing = previous.find(record => record.resourceId === resourceId); if (existing) { if (!equal(existing.payload, payload)) throw Error(existing.response ? 'Esta conclusão já foi confirmada. Use o procedimento de correção da visita.' : 'Há uma conclusão diferente por confirmar. Conserve-a e peça revisão antes de alterar.'); return existing; } }
      if (scope === 'TECHNICIAN_ALERT') { const existing = previous.find(record => !record.response); if (existing) { if (!equal(existing.payload, payload)) throw Error('Há um alerta diferente por confirmar. Preserve-o antes de preparar outro.'); return existing; } }
      const record = { owner: captured.owner, requestId: options.requestId || crypto.randomUUID(), scope, resourceId, payload: JSON.parse(JSON.stringify(payload)), createdAt: new Date().toISOString(), label: options.label || `Visita ${resourceId}`, ...(options.file ? { file: options.file, fileName: options.fileName || 'photo' } : {}) };
      record.key = key(record); record.payloadHash = await hash(envelope(record)); await validate(record, captured, true); requireSession(captured);
      await transaction('readwrite', (store, done, abort) => { const read = store.get(record.key); read.onsuccess = () => { try { if (read.result) throw Error('Identificador já guardado. Conserve o envio original.'); if (!same(captured)) throw Error('Sessão alterada.'); store.add(record); done(record); } catch (error) { abort(error); } }; });
      const saved = await get(record.requestId, captured); if (saved.payloadHash !== record.payloadHash) throw Error('A gravação local não ficou confirmada.'); window.dispatchEvent(new Event('cw:field-write-change')); return saved;
    });
  }
  async function update(record, captured, change) {
    requireSession(captured);
    await transaction('readwrite', (store, done, abort) => { const read = store.get(record.key); read.onsuccess = () => { try { const current = read.result; if (!same(captured) || !current || current.owner !== record.owner || current.payloadHash !== record.payloadHash || !equal(current.payload, record.payload)) throw Error('O pedido ou a sessão mudou. Os dados foram preservados.'); const next = change(current); store.put(next); done(next); } catch (error) { abort(error); } }; });
  }
  async function send(requestId, captured = session(), options = {}) {
    return locked(requestId, captured, async () => {
      const record = await get(requestId, captured); if (record.response) return record.response;
      if (!navigator.onLine) throw Error('Envio guardado neste dispositivo; aguarda ligação.');
      if (window.CristalAuth?.isSessionExpired?.()) throw Error('Sessão expirada. Volte a entrar com a mesma conta.');
      if (record.failure?.retryAt > Date.now()) throw Error('O servidor pediu uma pausa. O pedido foi preservado e será repetido depois.');
      if (options.automatic && record.failure?.blocked) throw Error(record.failure.message);
      await update(record, captured, current => ({ ...current, attemptedAt: current.attemptedAt || new Date().toISOString() }));
      const headers = { Authorization: 'Bearer ' + captured.token }; let body, endpoint;
      if (photoScope(record.scope)) { body = new FormData(); body.append('type', record.payload.type); body.append('requestId', record.requestId); body.append('photo', record.file, record.fileName); if(extraScope(record.scope))body.append('poolId', String(record.payload.poolId)); headers['X-CW-Field-Request'] = record.requestId; endpoint = extraScope(record.scope) ? `/api/field/extra-visits/${record.resourceId}/photo` : `/api/visits/${record.resourceId}/photo`; }
      else { headers['Content-Type'] = 'application/json'; body = JSON.stringify({ ...record.payload, requestId: record.requestId }); endpoint = record.scope === 'TECHNICIAN_ALERT' ? '/api/visits/internal-alert' : extraScope(record.scope) ? `/api/field/extra-visits/${record.resourceId}/${record.scope === 'EXTRA_VISIT_START' ? 'start' : 'complete'}` : `/api/core/visits/${record.resourceId}/complete`; }
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000), check = setInterval(() => { if (!same(captured)) controller.abort(); }, 250);
      try {
        const response = await fetch(endpoint, { method: 'POST', headers, body, signal: controller.signal }); const result = await response.json(); requireSession(captured);
        if (response.status !== 200) { const value = response.headers.get('Retry-After'), seconds = Number(value), wait = value && Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now(); throw Object.assign(Error(result.error || 'Envio por confirmar. Conserve o pedido original.'), { status: response.status, retryAt: response.status === 429 ? Date.now() + Math.max(30000, Math.min(Number.isFinite(wait) ? wait : 30000, 3600000)) : null }); }
        confirmation(result, record);
        await update(record, captured, current => { if (current.response && !equal(current.response, result)) throw Error('Confirmações incompatíveis. Os dados foram preservados.'); const next = { ...current, response: result }; delete next.file; delete next.failure; return next; });
        const saved = await get(requestId, captured); if (!equal(saved.response, result)) throw Error('A confirmação não ficou guardada neste dispositivo.');
        window.dispatchEvent(new Event('cw:field-write-change')); return result;
      } catch (error) { if (same(captured)) await update(record, captured, current => current.response ? current : { ...current, failure: { message: String(error.message).slice(0, 500), status: error.status || null, retryAt: error.retryAt || null, blocked: error.status >= 400 && error.status < 500 && ![401,408,425,429].includes(error.status) } }).catch(() => {}); throw error; }
      finally { clearTimeout(timer); clearInterval(check); }
    });
  }
  async function remove(requestId, captured = session()) { return locked(requestId, captured, async () => { const record = await get(requestId, captured); if (record.response) return; if (record.attemptedAt) throw Error('O envio já foi iniciado. Confirme o pedido antes de remover a fotografia.'); requireSession(captured); await transaction('readwrite', (store, done) => { requireSession(captured); store.delete(record.key); done(); }); window.dispatchEvent(new Event('cw:field-write-change')); }); }
  async function flush(scope, captured = session()) { const pending = await records(scope, captured); const confirmed = []; for (const record of pending) { if (record.failure?.blocked || record.failure?.retryAt > Date.now()) continue; try { confirmed.push(await send(record.requestId, captured, { automatic: true })); } catch (error) { return { pending: (await records(scope, captured)).length, confirmed, error: error.message }; } } return { pending: (await records(scope, captured)).length, confirmed }; }
  window.CWFieldWriteStore = { session, same, prepare, send, records, get, remove, flush, digest, hash, confirmation };
})();
