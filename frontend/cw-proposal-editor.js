(function () {
  'use strict';
  const keys = ['proposalFieldName', 'proposalBeforeValue', 'proposalAfterValue', 'proposalReason', 'proposalRiskLevel', 'proposalPhotos'];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function create(options) {
    const R = window.CWProposalRequests, fields = Object.fromEntries(keys.map(id => [id, document.getElementById(id)]));
    const status = document.getElementById('technicalProposalStatus'), save = document.getElementById('submitTechnicalProposalBtn'), container = document.getElementById('technicalProposalRecovery');
    status.dataset.cwNoI18n = ''; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    let current = null, working = false, panel, engine;
    const values = () => Object.fromEntries(keys.map(key => [key, fields[key].value]));
    const assign = data => keys.forEach(key => { fields[key].value = data?.[key] || ''; });
    const intent = data => ({ reason: data.proposalReason.trim(), changes: [{ field: data.proposalFieldName.trim(), before: data.proposalBeforeValue.trim() || null, after: data.proposalAfterValue.trim() }], photos: data.proposalPhotos.split(/\r?\n/).map(s => s.trim()).filter(Boolean), ...(data.proposalRiskLevel ? { riskLevel: data.proposalRiskLevel } : {}) });
    const key = id => 'cwTechnicalProposalDraft:v1:' + engine.owner() + ':' + id;
    const relevant = view => !!view && view === current && engine.active();
    function render() {
      const active = engine.active(), locked = working || !active || !!current?.pending;
      for (const input of Object.values(fields)) input.disabled = locked;
      save.disabled = locked || !current || !!current.storageError;
    }
    function persist(view) {
      if (!relevant(view)) return false;
      try { sessionStorage.setItem(key(view.id), JSON.stringify(view.draft)); view.storageError = false; return true; }
      catch (_) { view.storageError = true; status.textContent = R.t('storage'); render(); return false; }
    }
    function fresh(id, data) { return { schema: 1, owner: engine.owner(), poolId: id, requestId: crypto.randomUUID(), values: data || Object.fromEntries(keys.map(k => [k, ''])) }; }
    function validDraft(draft, id) { return draft && draft.schema === 1 && draft.owner === engine.owner() && draft.poolId === id && uuid.test(draft.requestId) && draft.values && Object.keys(draft).every(k => ['schema', 'owner', 'poolId', 'requestId', 'values'].includes(k)) && Object.keys(draft.values).length === keys.length && keys.every(k => typeof draft.values[k] === 'string' && draft.values[k].length <= 30000); }
    async function confirmed(record) {
      const view = current; if (!relevant(view) || !view.draft || view.id !== record.poolId || record.action !== 'CREATE') return;
      if (view.draft.requestId === record.requestId && R.equal(intent(view.draft.values), record.intent)) {
        view.pending = false; view.draft = fresh(view.id); assign(view.draft.values); persist(view); status.textContent = R.t('confirmed');
      }
      try { await options.saved?.(record.poolId); } catch (_) { /* Confirmation is already durable; keep the confirmed draft clear. */ }
    }
    async function sync() {
      const view = current; if (!view?.draft || !engine.active()) return;
      try {
        const all = await engine.all(); if (!relevant(view)) return;
        const stored = all.find(entry => entry.record.requestId === view.draft.requestId);
        if (stored?.phase === 'confirmed' && R.equal(intent(view.draft.values), stored.record.intent)) { await confirmed(stored.record); return; }
        const pending = all.filter(entry => entry.phase === 'pending' && entry.record.poolId === view.id && entry.record.action === 'CREATE');
        view.pending = pending.length > 0; if (view.pending) status.textContent = R.t('unknown'); render();
      } catch (error) { if (relevant(view)) { view.storageError = true; status.textContent = error.message; render(); } }
    }
    engine = R.create({
      onChange: () => { void panel?.refresh(); void sync(); },
      onConfirmed: async record => { await confirmed(record); },
      onRejected: record => { const view = current; if (relevant(view) && view.draft?.requestId === record.requestId) { view.pending = false; view.draft = fresh(view.id, view.draft.values); persist(view); render(); } },
      onInvalidated: () => { assign(null); current = null; if (panel) panel.clear(); status.textContent = R.t('session'); save.disabled = true; for (const input of Object.values(fields)) input.disabled = true; },
    });
    panel = R.panel(engine, container, { busy: value => { working = value; render(); } });
    async function open(id) {
      await engine.ready; if (!engine.active()) return;
      if (current?.id === id) { await sync(); await panel.refresh(); return; }
      if (current?.draft && !current.pending) { current.draft.values = values(); persist(current); }
      current = null; assign(null); status.textContent = ''; render();
      if (!Number.isSafeInteger(id) || id <= 0) { await panel.refresh(); return; }
      const view = { id, draft: null, pending: false, storageError: false }; current = view;
      try {
        const raw = sessionStorage.getItem(key(id)); let draft = raw ? JSON.parse(raw) : null;
        if (draft && !validDraft(draft, id)) throw Error(R.t('damaged'));
        const all = await engine.all(); if (!relevant(view)) return;
        const pending = all.find(entry => entry.phase === 'pending' && entry.record.poolId === id && entry.record.action === 'CREATE');
        if (!draft && pending) {
          const body = pending.record.intent;
          draft = { schema: 1, owner: engine.owner(), poolId: id, requestId: pending.record.requestId, values: { proposalFieldName: body.changes[0].field, proposalBeforeValue: body.changes[0].before || '', proposalAfterValue: String(body.changes[0].after ?? ''), proposalReason: body.reason, proposalRiskLevel: body.riskLevel || '', proposalPhotos: (body.photos || []).join('\n') } };
        }
        view.draft = draft || fresh(id); assign(view.draft.values); persist(view); await sync(); await panel.refresh();
      } catch (error) { if (relevant(view)) { view.storageError = true; status.textContent = error.message || R.t('storage'); } }
      if (relevant(view)) render();
    }
    async function submit() {
      if (working) return; const view = current; if (!view?.draft || !relevant(view)) throw Error(R.t('session'));
      view.draft.values = values(); if (!persist(view)) return;
      const body = intent(view.draft.values);
      if (!body.reason || !body.changes[0].field || !body.changes[0].after || body.photos.length > 12) throw Error('Indique o campo, o valor proposto, o motivo e até doze fotos.');
      working = true; render(); status.textContent = R.t('waiting');
      try { await engine.send('CREATE', view.id, null, body, view.draft.requestId); }
      catch (error) { if (relevant(view)) status.textContent = error.message; throw error; }
      finally { working = false; if (relevant(view)) { await sync(); render(); } await panel.refresh(); }
    }
    for (const input of Object.values(fields)) input.addEventListener('input', () => { if (!current?.draft || current.pending || !engine.active()) return; current.draft.values = values(); persist(current); render(); });
    window.addEventListener('pagehide', () => { if (current?.draft && !current.pending && engine.active()) { current.draft.values = values(); persist(current); } });
    render(); return { open, submit };
  }
  window.CWTechnicalProposalEditor = { create };
})();
