(function () {
  'use strict';
  const R = window.CWVehicleConsumptionRules, copy = window.CWVehicleConsumptionCopy;
  const $ = id => document.getElementById(id), panel = $('consumptionManager'), jobs = {};
  const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
  let actor, invalid = false, suspended = false, storageBlocked = false, key = '', raw = null;
  let pending = null, original = null, receipt = null, review = null, proposal = null, target = null, data = null;
  let state = 'loading', writeState = 'idle', language = 'pt', page = 1, query = { q: '' };
  const t = k => copy[language][k] || k, node = (tag, text) => { const el = document.createElement(tag); el.textContent = text; return el; };
  const busy = () => !!jobs.write || !!jobs.review, blocked = () => invalid || suspended || storageBlocked;
  const unresolved = () => !!pending && !receipt;
  function identity() {
    const tokens = keys.slice(0, 3).map(k => localStorage.getItem(k)), token = tokens.find(Boolean);
    const users = keys.slice(3).map(k => localStorage.getItem(k)).filter(Boolean).map(JSON.parse);
    if (!token || tokens.some(v => v && v !== token)) return null;
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const role = claims.role, id = Number(claims.userId || claims.id), tech = Number(claims.technicianId || claims.id);
    if (!['ADMIN', 'TECHNICIAN', 'TEAM_LEADER'].includes(role) || claims.principalType === 'ENV_ADMIN' || !R.positive(id) || !R.positive(tech) || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() || !users.length) return null;
    if (role !== 'ADMIN' && claims.principalType === 'USER' && !R.positive(claims.technicianId)) return null;
    if (users.some(u => u.role !== role || Number(u.userId || u.id) !== id || role !== 'ADMIN' && Number(u.technicianId || u.id) !== tech)) return null;
    const owner = role === 'ADMIN' ? 'ADMIN:' + id : claims.principalType === 'USER' ? `USER:${id}:TECH:${tech}` : 'TECH:' + tech;
    return { token, role, owner, expires: claims.exp * 1000, fingerprint: JSON.stringify([tokens, users.map(u => [u.role, u.userId || u.id, u.technicianId || u.id])]) };
  }
  function abort(kind) { const job = jobs[kind]; if (job) { job.controller.abort(); clearTimeout(job.timer); delete jobs[kind]; } }
  function clearFields() { $('consumeForm').reset(); $('confirm').checked = false; }
  function active() {
    let current; try { current = identity(); } catch (_) { /* Unreadable aliases invalidate this page. */ }
    if (!invalid && actor && current?.fingerprint === actor.fingerprint && actor.expires > Date.now()) return true;
    if (!invalid || state !== 'session') {
      invalid = true; for (const k of Object.keys(jobs)) abort(k); clearFields();
      data = target = review = proposal = original = pending = receipt = null; state = writeState = 'session'; render();
    }
    return false;
  }
  function start(kind) { abort(kind); const controller = new AbortController(), job = { kind, controller, timer: setTimeout(() => controller.abort(), 30000) }; jobs[kind] = job; return job; }
  const current = job => active() && !suspended && jobs[job.kind] === job;
  function finish(job) { clearTimeout(job.timer); if (jobs[job.kind] === job) delete jobs[job.kind]; }
  async function request(path, job, config = {}) {
    const res = await fetch('/api/vehicle-consumption' + path, { ...config, headers: { Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json' }, cache: 'no-store', redirect: 'error', signal: job.controller.signal });
    if (!current(job)) throw Error('stale');
    if ([401, 403].includes(res.status)) { invalid = true; active(); throw Error('session'); }
    const trusted = res.headers.get('x-cw-consumption') === 'vehicle-consumption-v1' && res.headers.get('x-cw-owner') === actor.owner && res.headers.get('cache-control') === 'private, no-store' && (res.headers.get('content-type') || '').startsWith('application/json');
    const value = await res.json();
    if (!current(job) || !trusted) throw Error('unconfirmed');
    if (res.status !== 200) throw Object.assign(Error('refused'), value?.ok === false && value.version === 1 && value.owner === actor.owner && typeof value.code === 'string' && value.code.startsWith('CONSUME_') ? { status: res.status, code: value.code } : {});
    if (!R.base(value, actor.owner)) throw Error('unconfirmed');
    return value;
  }
  function collect() {
    return R.input({ workGuideId: target?.work.id, itemId: target?.item.id, quantity: $('quantity').value.trim().replace(',', '.'), visitId: $('visit').value.trim() === '' ? null : R.id($('visit').value.trim()) || NaN, location: $('location').value, notes: $('notes').value });
  }
  function choose(work, item) {
    if (!active() || blocked() || busy() || pending || target || !data) return;
    target = { work, item }; review = proposal = receipt = null; clearFields(); writeState = 'editing'; render();
    $('writePanel').scrollIntoView({ block: 'start' }); $('quantity').focus({ preventScroll: true });
  }
  function fact(dl, label, value) { const div = node('div', ''); div.append(node('dt', t(label)), node('dd', value === null || value === undefined || value === '' ? t('missing') : String(value))); dl.append(div); }
  const named = v => v ? '#' + v.id + ' — ' + v.name : t('none');
  const date = v => new Intl.DateTimeFormat({ pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' }[language], { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(v));
  function render() {
    panel.dataset.state = invalid ? 'session' : state; panel.dataset.writeState = writeState;
    document.documentElement.lang = language; document.title = 'Cristal Water — ' + t('title');
    for (const el of document.querySelectorAll('[data-copy]')) el.textContent = t(el.dataset.copy);
    $('language').value = language; $('returnLink').href = (invalid ? '/login' : actor?.role === 'ADMIN' ? '/admin-vehicles' : '/technician-guide') + '?lang=' + language;
    $('writePanel').hidden = !target && !pending && !storageBlocked;
    $('writeStatus').textContent = t(writeState); $('targetIdentity').textContent = target ? t('work') + ' #' + target.work.id + ' · ' + target.work.vehicle.plate + ' · #' + target.item.id + ' — ' + target.item.name + ' (' + target.item.unit + ')' : '';
    $('writeReference').textContent = pending ? t('reference') + ': ' + pending.requestId : '';
    $('consumeForm').hidden = !target || blocked() || !!review || !!pending;
    for (const el of $('consumeForm').elements) el.disabled = blocked() || busy() || !!review || !!pending;
    $('reviewPanel').hidden = !review || blocked() || !!pending;
    $('reviewFacts').replaceChildren();
    if (review) {
      const c = review.choice, dl = $('reviewFacts');
      fact(dl, 'work', '#' + c.work.id); fact(dl, 'plate', c.vehicle.plate); fact(dl, 'status', t(c.vehicle.status));
      fact(dl, 'AT', c.transport ? '#' + c.transport.id + ' — ' + (c.transport.codeAT || t('missing')) : t('provisional'));
      fact(dl, 'technician', named(c.technician)); fact(dl, 'item', named(c.item)); fact(dl, 'unit', c.item.unit);
      fact(dl, 'balance', c.item.quantity); fact(dl, 'quantity', review.proposal.quantity); fact(dl, 'after', review.after.quantity); fact(dl, 'used', review.after.usedQty);
      fact(dl, 'visit', c.visit ? '#' + c.visit.id : t('none')); fact(dl, 'pool', named(c.visit?.pool)); fact(dl, 'client', named(c.visit?.client));
      fact(dl, 'location', review.proposal.location); fact(dl, 'notes', review.proposal.notes);
    }
    $('expiry').textContent = review ? t('expires') + ' ' + date(review.expiresAt) : '';
    $('save').disabled = blocked() || busy() || !review || !$('confirm').checked; $('confirm').disabled = busy(); $('backEdit').disabled = busy();
    $('receiptFacts').replaceChildren();
    if (receipt) { const dl = $('receiptFacts'); fact(dl, 'work', '#' + receipt.workGuideId); fact(dl, 'item', receipt.item ? named(receipt.item) : '#' + receipt.itemId); fact(dl, 'confirmedAt', date(receipt.receipt.confirmedAt)); fact(dl, 'audit', '#' + receipt.auditId); if (receipt.item) { fact(dl, 'quantity', receipt.quantity + ' ' + receipt.item.unit); fact(dl, 'after', receipt.item.quantity); fact(dl, 'movements', '#' + receipt.vehicleMovementId + ' / #' + receipt.stockMovementId); } }
    for (const id of ['check', 'retry', 'cancel']) $(id).hidden = !unresolved() || blocked() || id === 'retry' && !original;
    $('cancelHint').hidden = !unresolved() || blocked(); $('next').hidden = !receipt || blocked();
    $('discard').hidden = !target || !!pending || blocked();
    for (const id of ['check', 'retry', 'cancel', 'next', 'discard']) $(id).disabled = busy();
    $('listStatus').textContent = t(invalid ? 'session' : state); $('count').textContent = data ? t('total') + ': ' + data.total : '';
    $('page').textContent = data ? t('page') + ' ' + data.page + ' / ' + Math.max(1, Math.ceil(data.total / 25)) : '';
    $('previous').disabled = blocked() || !data || data.page <= 1; $('following').disabled = blocked() || !data || data.page * 25 >= data.total;
    $('refresh').disabled = invalid || suspended; for (const el of $('filters').elements) el.disabled = invalid || suspended;
    $('guideList').replaceChildren();
    if (data) {
      if (!data.guides.length) $('guideList').append(node('p', t('empty')));
      for (const work of data.guides) {
        const card = node('article', ''), dl = node('dl', ''); card.className = 'hub-card'; card.dataset.workId = work.id;
        card.append(node('h3', work.vehicle.plate + ' · #' + work.id)); fact(dl, 'technician', named(work.technician));
        fact(dl, 'AT', work.guide ? '#' + work.guide.id + ' — ' + (work.guide.codeAT || t('missing')) : t('provisional')); card.append(dl);
        if (!work.items.length) card.append(node('p', t('noItems')));
        for (const item of work.items) {
          const div = node('div', ''), b = node('button', t('choose')); div.className = 'item'; div.dataset.itemId = item.id;
          div.append(node('h4', named(item)), node('p', t('balance') + ': ' + item.quantity + ' ' + item.unit));
          b.type = 'button'; b.disabled = blocked() || busy() || !!pending || !!target || item.quantity <= 0;
          b.addEventListener('click', () => choose(work, item)); div.append(b); card.append(div);
        }
        $('guideList').append(card);
      }
    }
  }
  async function load() {
    if (!active() || suspended) return; data = null; state = 'loading'; const job = start('list'), requested = page, filter = { ...query }; render();
    try { const value = await request('?' + new URLSearchParams({ ...filter, page: requested }), job); if (!R.listPacket(value, actor.owner, requested)) throw Error(); data = value; state = 'ready'; }
    catch (_) { if (current(job)) { data = null; state = 'error'; } }
    finally { finish(job); if (active() && !suspended) render(); }
  }
  function restore() {
    try { raw = sessionStorage.getItem(key); const record = R.pending(raw, actor.owner); if (record === false) { storageBlocked = true; writeState = 'corrupt'; return; } pending = record; original = receipt = null; writeState = pending ? 'unknown' : 'idle'; }
    catch (_) { storageBlocked = true; writeState = 'storage'; }
  }
  function remember(value) {
    try { if (sessionStorage.getItem(key) !== raw) { storageBlocked = true; writeState = 'corrupt'; return false; } const next = value === null ? null : JSON.stringify(value); if (next === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, next); if (sessionStorage.getItem(key) !== next) throw Error(); raw = next; return true; }
    catch (_) { writeState = 'storage'; return false; }
  }
  async function prepare() {
    if (!active() || blocked() || busy() || pending || !target) return; proposal = collect();
    if (!proposal) { writeState = 'invalid'; render(); return; }
    review = null; $('confirm').checked = false; writeState = 'reviewing'; const job = start('review'); render();
    try { const value = await request('/review', job, { method: 'POST', body: JSON.stringify(proposal) }); if (!R.reviewPacket(value, actor.owner, proposal)) throw Error(); review = value; writeState = 'reviewed'; }
    catch (_) { if (current(job)) { review = proposal = null; writeState = 'reviewError'; } }
    finally { finish(job); if (active() && !suspended) render(); }
  }
  function accept(value) {
    if (!pending || !R.resultPacket(value, actor.owner, pending)) throw Error();
    if (value.status === 'UNCONFIRMED') { writeState = 'unconfirmed'; return; }
    receipt = value.result; writeState = value.status === 'CANCELLED' ? 'cancelled' : 'saved'; review = proposal = original = null; clearFields();
  }
  async function send(retry = false) {
    if (!active() || blocked() || busy() || (retry ? !pending || !original : !!pending || !review || !$('confirm').checked)) return;
    if (!retry) {
      if (Date.parse(review.expiresAt) <= Date.now()) { review = proposal = null; writeState = 'expired'; render(); return; }
      const candidate = { version: 1, owner: actor.owner, workGuideId: proposal.workGuideId, itemId: proposal.itemId, requestId: review.requestId };
      if (!remember(candidate)) { render(); return; } pending = candidate;
      original = JSON.stringify({ proposal, requestId: review.requestId, reviewToken: review.reviewToken });
    }
    writeState = 'saving'; const job = start('write'); render();
    try { accept(await request('/commit', job, { method: 'POST', body: original })); }
    catch (e) { if (current(job)) writeState = e.status === 409 ? 'changed' : 'unknown'; }
    finally { finish(job); if (active() && !suspended) { render(); if (receipt) load(); } }
  }
  async function check(cancel = false) {
    if (!active() || blocked() || busy() || !unresolved()) return; const job = start('write'); writeState = 'checking'; render();
    try { accept(await request('/' + (cancel ? 'cancel' : 'result') + '/' + pending.requestId, job, cancel ? { method: 'POST', body: JSON.stringify({ workGuideId: pending.workGuideId, itemId: pending.itemId }) } : {})); }
    catch (_) { if (current(job)) writeState = 'unknown'; }
    finally { finish(job); if (active() && !suspended) { render(); if (receipt) load(); } }
  }
  const url = new URL(location.href), lang = url.searchParams.get('lang'); if (Object.hasOwn(copy, lang)) language = lang;
  if (R.id(url.searchParams.get('workGuideId'))) { query.workGuideId = url.searchParams.get('workGuideId'); $('guideFilter').value = query.workGuideId; }
  try { actor = identity(); if (!actor) throw Error(); key = 'cw:vehicle-consumption:v1:' + actor.owner; document.body.dataset.requiredRole = actor.role; } catch (_) { invalid = true; }
  $('consumeForm').addEventListener('submit', e => { e.preventDefault(); prepare(); }); $('confirm').addEventListener('change', render); $('save').addEventListener('click', () => send());
  $('backEdit').addEventListener('click', () => { if (active() && !busy() && !pending) { review = proposal = null; $('confirm').checked = false; writeState = 'editing'; render(); } });
  $('discard').addEventListener('click', () => { if (active() && !blocked() && !busy() && !pending) { clearFields(); target = review = proposal = null; writeState = 'idle'; render(); } });
  $('check').addEventListener('click', () => check()); $('retry').addEventListener('click', () => send(true)); $('cancel').addEventListener('click', () => check(true));
  $('next').addEventListener('click', () => { if (active() && !blocked() && !busy() && receipt && remember(null)) { pending = receipt = original = target = review = proposal = null; writeState = 'idle'; } render(); });
  $('filters').addEventListener('submit', e => { e.preventDefault(); const filter = { q: $('search').value.trim(), ...($('guideFilter').value.trim() ? { workGuideId: $('guideFilter').value.trim() } : {}) }; if (!R.query(filter)) { abort('list'); data = null; state = 'error'; render(); return; } query = filter; page = 1; load(); });
  $('clearSearch').addEventListener('click', () => { $('search').value = $('guideFilter').value = ''; query = { q: '' }; page = 1; load(); });
  $('refresh').addEventListener('click', load); $('previous').addEventListener('click', () => { page = Math.max(1, page - 1); load(); }); $('following').addEventListener('click', () => { page++; load(); });
  $('language').addEventListener('change', () => { language = $('language').value; const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url); render(); });
  window.addEventListener('storage', active); window.addEventListener('focus', active); document.addEventListener('visibilitychange', () => { if (!document.hidden) active(); });
  window.addEventListener('pagehide', () => { suspended = true; for (const k of Object.keys(jobs)) abort(k); clearFields(); review = proposal = original = receipt = data = target = null; state = 'loading'; writeState = pending ? 'unknown' : 'idle'; render(); });
  window.addEventListener('pageshow', () => { suspended = false; if (active()) { restore(); render(); load(); } });
  setInterval(() => { if (active() && review && !pending && Date.parse(review.expiresAt) <= Date.now()) { review = proposal = null; writeState = 'expired'; render(); } }, 1000);
  render(); active();
}());
