(function () {
  'use strict';
  const messages = {
    pending: ['Pedido por confirmar', 'Request awaiting confirmation', 'Demande à confirmer', 'Solicitud pendiente de confirmación', 'Anfrage noch nicht bestätigt'],
    retry: ['Confirmar pedido guardado', 'Confirm saved request', 'Confirmer la demande enregistrée', 'Confirmar solicitud guardada', 'Gespeicherte Anfrage bestätigen'],
    waiting: ['A confirmar o pedido…', 'Confirming request…', 'Confirmation en cours…', 'Confirmando solicitud…', 'Anfrage wird bestätigt…'],
    unknown: ['Sem confirmação. O pedido está guardado; use a confirmação para repetir o mesmo envio.', 'Not confirmed. The request is saved; confirm it to retry the same send.', 'Non confirmé. La demande est enregistrée ; confirmez-la pour réessayer le même envoi.', 'Sin confirmar. La solicitud está guardada; confírmela para repetir el mismo envío.', 'Nicht bestätigt. Die Anfrage ist gespeichert; denselben Versand erneut bestätigen.'],
    storage: ['Não foi possível guardar o pedido neste navegador. Os campos foram conservados; o envio está bloqueado.', 'Could not save the request in this browser. Fields are retained; sending is blocked.', 'Impossible d’enregistrer la demande dans ce navigateur. Les champs sont conservés ; l’envoi est bloqué.', 'No se pudo guardar la solicitud en este navegador. Se conservan los campos; el envío está bloqueado.', 'Anfrage konnte im Browser nicht gespeichert werden. Eingaben bleiben erhalten; Versand ist gesperrt.'],
    damaged: ['Os dados de recuperação não são válidos. Conserve-os e peça assistência antes de enviar.', 'Recovery data is invalid. Keep it and get help before sending.', 'Les données de récupération ne sont pas valides. Conservez-les et demandez de l’aide avant d’envoyer.', 'Los datos de recuperación no son válidos. Consérvelos y solicite ayuda antes de enviar.', 'Wiederherstellungsdaten sind ungültig. Aufbewahren und vor dem Senden Hilfe anfordern.'],
    session: ['A sessão mudou. Reabra a página com a sua conta.', 'The session changed. Reopen the page with your account.', 'La session a changé. Rouvrez la page avec votre compte.', 'La sesión ha cambiado. Abra la página con su cuenta.', 'Die Sitzung wurde geändert. Seite mit Ihrem Konto erneut öffnen.'],
    busy: ['Existe um pedido noutra janela. Confirme primeiro o pedido guardado.', 'Another tab has a request. Confirm the saved request first.', 'Une demande existe dans un autre onglet. Confirmez d’abord la demande enregistrée.', 'Hay una solicitud en otra pestaña. Confirme primero la solicitud guardada.', 'Ein anderer Tab hat eine Anfrage. Zuerst die gespeicherte Anfrage bestätigen.'],
    confirmed: ['Pedido confirmado.', 'Request confirmed.', 'Demande confirmée.', 'Solicitud confirmada.', 'Anfrage bestätigt.'],
    create: ['Nova proposta', 'New proposal', 'Nouvelle proposition', 'Nueva propuesta', 'Neuer Vorschlag'],
    workflow: ['Decisão da proposta', 'Proposal decision', 'Décision sur la proposition', 'Decisión de la propuesta', 'Entscheidung zum Vorschlag'],
    batch: ['Decisão em lote', 'Batch decision', 'Décision par lot', 'Decisión por lote', 'Stapelentscheidung'],
    apply: ['Aplicação à ficha', 'Apply to technical sheet', 'Application à la fiche', 'Aplicar a la ficha', 'Im Datenblatt anwenden'],
  };
  const lang = () => Math.max(0, ['pt', 'en', 'fr', 'es', 'de'].indexOf(String(window.CristalI18n?.readLanguage?.() || document.documentElement.lang || 'pt').slice(0, 2)));
  const t = key => messages[key]?.[lang()] || key;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
  const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(x => x.toString(16).padStart(2, '0')).join('');
  const hash = value => digest(JSON.stringify(canonical(value)));
  const allowed = { CREATE: ['reason', 'changes', 'photos', 'riskLevel', 'asDraft'], WORKFLOW: ['nextStatus', 'note', 'expectedVersion'], BATCH: ['proposalIds', 'nextStatus', 'note', 'expectedVersions'], APPLY: ['expectedVersion', 'expectedSheetVersion', 'expectedEffectsHash', 'resolutions'] };
  const rejections = new Set(['INVALID_TECHNICAL_PROPOSAL_REQUEST', 'INVALID_TECHNICAL_PROPOSAL', 'INVALID_TECHNICAL_SHEET_EDIT', 'TECHNICAL_PROPOSAL_VERSION_CONFLICT', 'TECHNICAL_PROPOSAL_TRANSITION_DENIED', 'TECHNICAL_PROPOSAL_HISTORY_CONFLICT', 'TECHNICAL_PROPOSAL_APPLICATION_CONFLICT', 'TECHNICAL_PROPOSAL_APPLICATION_STATE']);
  const intentEnvelope = record => ({ v: 1, poolId: record.poolId, proposalId: record.proposalId, action: record.action, intent: record.intent });
  const slot = record => [record.poolId, record.action, record.proposalId || ''].join(':');
  async function verify(result, record) {
    const receipt = result?.receipt;
    if (!receipt || receipt.scope !== 'TECHNICAL_PROPOSAL' || receipt.actorKey !== record.owner || receipt.requestId !== record.requestId || receipt.poolId !== record.poolId || receipt.proposalId !== record.proposalId || receipt.action !== record.action || receipt.payloadHash !== record.payloadHash) throw Error(t('unknown'));
    const proposal = result.proposal, intent = record.intent;
    const validProposal = (p, id, state) => p && validId(p.id) && (id === null || p.id === id) && p.poolId === record.poolId && p.status === state && /^technical-proposal-v1:[0-9a-f]{64}$/.test(p.version);
    if (record.action === 'BATCH') {
      if (!Array.isArray(result.updated) || !Array.isArray(result.failed)) throw Error(t('unknown'));
      const ids = [...result.updated.map(p => p.id), ...result.failed.map(p => p.proposalId)];
      if (result.ok !== (result.failed.length === 0) || result.updatedCount !== result.updated.length || result.failedCount !== result.failed.length || result.targetState !== intent.nextStatus || !result.batchId || ids.length !== intent.proposalIds.length || new Set(ids).size !== ids.length || ids.some(id => !intent.proposalIds.includes(id)) || result.updated.some(p => !validProposal(p, p.id, intent.nextStatus)) || result.failed.some(p => !Number.isInteger(p.status) || p.status < 400)) throw Error(t('unknown'));
    } else {
      const state = record.action === 'CREATE' ? (intent.asDraft ? 'DRAFT' : 'SUBMITTED') : record.action === 'APPLY' ? 'APPLIED' : intent.nextStatus;
      if (result.ok !== true || result.propagation?.persisted !== true || !validProposal(proposal, record.proposalId, state)) throw Error(t('unknown'));
      if (record.action === 'CREATE' && (proposal.reason !== intent.reason.trim() || !Array.isArray(proposal.changes) || proposal.changes.length !== intent.changes.length || proposal.changes.some((c, i) => c.field !== intent.changes[i].field || String(c.after ?? '') !== String(intent.changes[i].after ?? '')) || !equal(proposal.photos, intent.photos || []))) throw Error(t('unknown'));
      if (record.action === 'WORKFLOW' && proposal.reviewNote !== (intent.note || '')) throw Error(t('unknown'));
      if (record.action === 'APPLY' && (!validId(result.application?.historyId) || !/^technical-sheet-v1:[0-9a-f]{64}$/.test(result.application.sheetVersion) || !equal(result.application.resolutions, intent.resolutions) || !equal(proposal.application, result.application) || await hash({ effects: result.application.effects }) !== intent.expectedEffectsHash)) throw Error(t('unknown'));
    }
    return result;
  }
  function create(options = {}) {
    let credential = '', owner = '', db, invalidated = false, unavailable = false;
    const controllers = new Set();
    const token = () => localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
    try { credential = token(); } catch (_) { unavailable = true; }
    function active() {
      let same = false; try { same = !!credential && token() === credential && (!localStorage.getItem('token') || localStorage.getItem('token') === credential); } catch (_) {}
      if (same && !invalidated) return true;
      if (!invalidated) { invalidated = true; for (const controller of controllers) controller.abort(); options.onInvalidated?.(); }
      return false;
    }
    const ready = (async () => {
      try {
        if (!credential || !crypto.subtle || !crypto.randomUUID || !navigator.locks?.request) throw Error('Unavailable');
        const user = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
        const id = Number(user.userId || user.id); if (!validId(id) || !['ADMIN', 'TECHNICIAN', 'TEAM_LEADER'].includes(user.role)) throw Error('Role');
        owner = user.principalType === 'ENV_ADMIN' ? 'ENV_ADMIN:' + await digest(String(user.email || '').trim().toLowerCase()) : (user.role === 'ADMIN' || user.principalType === 'USER' ? 'USER:' : 'TECHNICIAN:') + id;
        db = await new Promise((resolve, reject) => { const r = indexedDB.open('cw-technical-proposal-requests-v1', 1); r.onupgradeneeded = () => r.result.createObjectStore('requests'); r.onsuccess = () => resolve(r.result); r.onerror = r.onblocked = () => reject(Error('Storage')); });
      } catch (_) { unavailable = true; }
    })();
    async function access(mode, operation) {
      await ready; if (!active()) throw Error(t('session')); if (unavailable || !db) throw Error(t('storage'));
      return new Promise((resolve, reject) => { try { const tx = db.transaction('requests', mode), request = operation(tx.objectStore('requests')); tx.oncomplete = () => resolve(request.result); tx.onerror = tx.onabort = () => reject(Error(t('storage'))); } catch (_) { reject(Error(t('storage'))); } });
    }
    async function validate(entry) {
      const r = entry?.record;
      if (!r || r.schema !== 1 || r.owner !== owner || !uuid.test(r.requestId) || !validId(r.poolId) || !Object.hasOwn(allowed, r.action) || (['CREATE', 'BATCH'].includes(r.action) ? r.proposalId !== null : !validId(r.proposalId)) || !r.intent || Object.keys(r.intent).some(key => !allowed[r.action].includes(key)) || Object.keys(r).some(key => !['schema', 'owner', 'requestId', 'poolId', 'proposalId', 'action', 'intent', 'payloadHash'].includes(key)) || !['pending', 'confirmed', 'rejected'].includes(entry.phase) || r.payloadHash !== await hash(intentEnvelope(r))) throw Error(t('damaged'));
      if (entry.phase === 'confirmed') await verify(entry.result, r);
      return entry;
    }
    async function all() {
      const keys = await access('readonly', store => store.getAllKeys()), own = [], pending = new Set();
      for (const key of keys.filter(key => typeof key === 'string' && key.startsWith(owner + ':'))) {
        const entry = await validate(await access('readonly', store => store.get(key)));
        if (key !== owner + ':' + entry.record.requestId || (entry.phase === 'pending' && pending.has(slot(entry.record)))) throw Error(t('damaged'));
        if (entry.phase === 'pending') pending.add(slot(entry.record)); own.push(entry);
      }
      if (!active()) throw Error(t('session')); return own;
    }
    const read = async id => { const entry = await access('readonly', store => store.get(owner + ':' + id)); return entry ? validate(entry) : null; };
    async function write(entry) { await access('readwrite', store => store.put(entry, owner + ':' + entry.record.requestId)); const stored = await read(entry.record.requestId); if (!equal(entry, stored)) throw Error(t('storage')); }
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('cw-technical-proposal-requests') : null;
    const changed = () => { if (active()) options.onChange?.(); };
    const signal = () => { channel?.postMessage('changed'); changed(); };
    async function transport(entry) {
      const record = entry.record;
      if (!active()) throw Error(t('session'));
      const suffix = record.action === 'CREATE' ? '' : record.action === 'BATCH' ? '/workflow/batch' : '/' + record.proposalId + (record.action === 'APPLY' ? '/apply' : '/workflow');
      const controller = new AbortController(); controllers.add(controller); const timeout = setTimeout(() => controller.abort(), 70000);
      try {
        const response = await fetch('/api/core/pools/' + record.poolId + '/technical-change-proposals' + suffix, { method: 'POST', headers: { Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...record.intent, requestId: record.requestId }), signal: controller.signal });
        const result = await response.json(); if (!active()) throw Error(t('session'));
        if ([400, 403, 404, 409].includes(response.status) && result.ok === false && rejections.has(result.code)) {
          await write({ ...entry, phase: 'rejected', error: String(result.error || '') }); signal(); options.onRejected?.(record, result); throw Object.assign(Error(result.error || t('unknown')), { rejected: true });
        }
        if (response.status !== (record.action === 'CREATE' ? 201 : 200)) throw Error(t('unknown'));
        await verify(result, record); await write({ ...entry, phase: 'confirmed', result }); if (!active()) throw Error(t('session'));
        signal(); await options.onConfirmed?.(record, result); return result;
      } catch (error) { if (!error.rejected) signal(); throw error.rejected ? error : Error(active() ? t('unknown') : t('session')); }
      finally { clearTimeout(timeout); controllers.delete(controller); }
    }
    async function locked(record, work) {
      await ready; if (!active()) throw Error(t('session')); if (unavailable) throw Error(t('storage'));
      return navigator.locks.request('cw-proposal:' + owner + ':' + slot(record), { ifAvailable: true }, async lock => { if (!lock) throw Error(t('busy')); return work(); });
    }
    async function send(action, poolId, proposalId, intent, requestId) {
      await ready; if (!active()) throw Error(t('session')); if (unavailable) throw Error(t('storage'));
      const record = { schema: 1, owner, action, poolId: Number(poolId), proposalId: proposalId == null ? null : Number(proposalId), intent: JSON.parse(JSON.stringify(intent)), requestId: requestId || crypto.randomUUID() };
      record.payloadHash = await hash(intentEnvelope(record));
      return locked(record, async () => {
        const old = await read(record.requestId);
        if (old) { if (!equal(old.record, record)) throw Error(t('damaged')); if (old.phase === 'confirmed') { await options.onConfirmed?.(record, old.result); return old.result; } if (old.phase === 'rejected') throw Error(old.error || t('unknown')); return transport(old); }
        if ((await all()).some(entry => entry.phase === 'pending' && slot(entry.record) === slot(record))) throw Error(t('busy'));
        const entry = { record, phase: 'pending' }; await validate(entry); await write(entry); signal(); return transport(entry);
      });
    }
    async function retry(requestId) {
      const entry = await read(requestId); if (!entry) throw Error(t('damaged'));
      return locked(entry.record, async () => { const fresh = await read(requestId); if (fresh.phase === 'confirmed') { await options.onConfirmed?.(fresh.record, fresh.result); return fresh.result; } if (fresh.phase !== 'pending') throw Error(fresh.error || t('unknown')); return transport(fresh); });
    }
    if (channel) channel.onmessage = changed;
    window.addEventListener('focus', changed); window.addEventListener('storage', changed); window.addEventListener('cw-language-change', changed); setInterval(() => { if (!active()) changed(); }, 500);
    return { ready, send, retry, all, read, active, owner: () => owner };
  }
  function panel(client, container, options = {}) {
    container.dataset.cwNoI18n = ''; let generation = 0, working = false; const errors = new Map();
    async function refresh() {
      const ownGeneration = ++generation;
      try {
        const pending = (await client.all()).filter(entry => entry.phase === 'pending'); if (generation !== ownGeneration || !client.active()) return;
        container.replaceChildren(); container.hidden = !pending.length;
        for (const entry of pending) {
          const record = entry.record, box = document.createElement('section'), title = document.createElement('strong'), description = document.createElement('p'), button = document.createElement('button'), status = document.createElement('p');
          box.style.cssText = 'padding:12px;border:1px solid currentColor;border-radius:10px;margin:8px 0;overflow-wrap:anywhere';
          title.textContent = t('pending') + ' · ' + t(record.action.toLowerCase()) + ' · #' + record.poolId;
          description.textContent = record.intent.reason || record.intent.note || (record.proposalId ? '#' + record.proposalId : String(record.intent.proposalIds?.length || ''));
          button.type = 'button'; button.className = 'btn'; button.textContent = t('retry'); button.dataset.proposalRetry = record.requestId; button.disabled = working; status.setAttribute('role', 'status');
          status.textContent = errors.get(record.requestId) || '';
          button.onclick = async () => { if (working) return; working = true; button.disabled = true; status.textContent = t('waiting'); options.busy?.(true); try { await client.retry(record.requestId); errors.delete(record.requestId); } catch (error) { errors.set(record.requestId, error.message); } finally { working = false; options.busy?.(false); await refresh(); } };
          box.append(title, description, button, status); container.append(box);
        }
      } catch (error) { if (generation !== ownGeneration) return; container.hidden = false; container.textContent = error.message; }
    }
    return { refresh, clear: () => { generation++; container.replaceChildren(); container.hidden = true; } };
  }
  window.CWProposalRequests = { create, panel, equal, hash, t };
})();
