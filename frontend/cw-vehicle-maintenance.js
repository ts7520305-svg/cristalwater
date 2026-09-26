(function () {
  'use strict';
  const R = window.CWVehicleMaintenanceRules, copy = window.CWVehicleMaintenanceCopy;
  const $ = id => document.getElementById(id), panel = $('maintenanceManager'), jobs = {};
  const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
  let actor, invalid = false, suspended = false, storageBlocked = false, key = '', raw = null;
  let pending = null, original = null, receipt = null, review = null, proposal = null, target = null, data = null;
  let state = 'loading', writeState = 'idle', language = 'pt', page = 1, query = { q: '', kind:'records' };
  let operation = 'EDIT';
  const t = k => copy[language][k] || k, node = (tag, text) => { const el = document.createElement(tag); el.textContent = text; return el; };
  const fields = () => R.fields.filter(k => k !== 'cost' || actor?.role === 'ADMIN');
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
  function clearFields() { $('consumeForm').reset(); $('maintenanceFields').replaceChildren(); $('confirm').checked = false; }
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
    const res = await fetch('/api/vehicle-maintenance' + path, { ...config, headers: { Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json' }, cache: 'no-store', redirect: 'error', signal: job.controller.signal });
    if (!current(job)) throw Error('stale');
    if ([401, 403].includes(res.status)) { invalid = true; active(); throw Error('session'); }
    const trusted = res.headers.get('x-cw-maintenance') === 'vehicle-maintenance-v1' && res.headers.get('x-cw-owner') === actor.owner && res.headers.get('cache-control') === 'private, no-store' && (res.headers.get('content-type') || '').startsWith('application/json');
    const value = await res.json();
    if (!current(job) || !trusted) throw Error('unconfirmed');
    if (res.status !== 200) throw Object.assign(Error('refused'), value?.ok === false && value.version === 1 && value.owner === actor.owner && typeof value.code === 'string' && value.code.startsWith('MAINTENANCE_') ? { status: res.status, code: value.code } : {});
    if (!R.base(value, actor.owner)) throw Error('unconfirmed');
    return value;
  }
  function collect() {
    const changes={};for(const k of fields()){const mode=$('mode-'+k);if(!mode||mode.value==='keep')continue;let value=mode.value==='clear'?null:$('value-'+k).value;if(k==='dueDate'&&value!==null)value=window.CWOnboardingRules.resolve(value,$('time-dueDate').value)||'invalid date';if(['km','cost'].includes(k)&&value!==null)value=value.trim().replace(',','.');changes[k]=value;}
    if(operation==='CREATE'&&actor.role!=='ADMIN')changes.cost=null;
    return R.input({operation,maintenanceId:target?.record?.id||null,vehicleId:target?.record?target.record.vehicleId:target?.vehicle?.id||null,reason:$('notes').value,changes});
  }
  function choose(choice) {
    if(!active()||blocked()||busy()||pending||target||!data)return;
    clearFields();target=choice;operation=choice.record?'EDIT':'CREATE';review=proposal=receipt=null;writeState='editing';drawFields();render();$('writePanel').scrollIntoView({block:'start'});$('notes').focus({preventScroll:true});
  }
  function valueText(k,v){return v===null||v===undefined?t('missing'):k==='type'||k==='status'?t(v):v==='ON_CONFIRMATION'?t('now'):String(v);}
  function facts(dl,c){fact(dl,'maintenance',c.record?'#'+c.record.id:t('newRecord'));fact(dl,'plate',c.vehicle?.plate);fact(dl,'vehicleKm',c.vehicle?.currentKm);if(c.record){for(const k of [...fields(),'status','completedAt'])fact(dl,k==='title'?'titleField':k==='notes'?'fieldNotes':k,valueText(k,c.record[k]));}if(actor?.role==='ADMIN')fact(dl,'expense',c.expense?'#'+c.expense.id:t('none'));}
  function fieldMode(k){const mode=$('mode-'+k)?.value,value=$('value-'+k);if(!value)return;value.disabled=blocked()||busy()||!!review||!!pending||mode!=='set';$('hint-'+k).textContent=t(mode);if(k==='dueDate'){$('time-dueDate').disabled=value.disabled;$('time-dueDate').hidden=mode!=='set';}}
  function drawFields(){
    const box=$('maintenanceFields');box.replaceChildren();$('operation').value=operation;$('operation').hidden=operation==='CREATE';
    for(const k of fields()){if(operation==='COMPLETE'&&!['km','cost','notes'].includes(k))continue;
      const card=node('article','');card.className='hub-card';const label=node('label',''),title=node('span',t(k==='title'?'titleField':k==='notes'?'fieldNotes':k));title.dataset.copy=k==='title'?'titleField':k==='notes'?'fieldNotes':k;label.append(title);
      const current=node('p',t('before')+': '+valueText(k,target.record?.[k]));current.dataset.current=k;card.append(current);
      const mode=node('select','');mode.id='mode-'+k;mode.setAttribute('aria-label',t(k)+' — '+t('choice'));for(const action of ['keep','set','clear']){if(operation==='CREATE'&&action==='keep'||['type','title'].includes(k)&&action==='clear')continue;const o=node('option',t(action));o.value=action;o.dataset.copy=action;mode.append(o);}mode.value=operation==='CREATE'?(['type','title'].includes(k)?'set':'clear'):'keep';
      const hint=node('span','');hint.id='hint-'+k;hint.className='muted';label.append(mode,hint);
      const value=node(k==='type'?'select':k==='notes'?'textarea':'input','');value.id='value-'+k;value.setAttribute('aria-label',t(k));value.autocomplete='off';
      if(k==='type'){const blank=node('option',t('selectType'));blank.value='';blank.dataset.copy='selectType';value.append(blank);for(const type of R.types){const o=node('option',t(type));o.value=type;o.dataset.copy=type;value.append(o);}}
      else{value.maxLength=k==='title'?200:k==='notes'?2000:40;if(['km','cost'].includes(k))value.inputMode='decimal';if(k==='dueDate')value.type='datetime-local';}
      label.append(value);if(k==='dueDate'){const time=node('select','');time.id='time-dueDate';time.setAttribute('aria-label',t('timeChoice'));for(const [v,copy] of [['','unique'],['first','first'],['second','second']]){const o=node('option',t(copy));o.value=v;o.dataset.copy=copy;time.append(o);}label.append(time);}
      mode.onchange=()=>{value.value='';if(k==='dueDate')$('time-dueDate').value='';fieldMode(k);};card.append(label);box.append(card);fieldMode(k);
    }
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
    $('writeStatus').textContent=t(writeState);$('targetIdentity').textContent=target?t('maintenance')+' '+(target.record?'#'+target.record.id:t('newRecord'))+' · '+(target.vehicle?.plate||t('missing')):'';
    $('writeReference').textContent=pending?t('reference')+': '+pending.requestId:'';
    $('currentFacts').replaceChildren();if(target)facts($('currentFacts'),target);
    $('consumeForm').hidden=!target||blocked()||!!review||!!pending;
    for(const el of $('consumeForm').elements)el.disabled=blocked()||busy()||!!review||!!pending;
    for(const k of fields())fieldMode(k);
    for(const el of document.querySelectorAll('[data-current]'))el.textContent=t('before')+': '+valueText(el.dataset.current,target?.record?.[el.dataset.current]);
    const complete=$('operation').querySelector('[value=COMPLETE]');complete.disabled=!target?.record||!R.openStatuses.includes(target.record.status)||target.record.completedAt!==null;
    $('reviewPanel').hidden=!review||blocked()||!!pending;$('reviewFacts').replaceChildren();$('reviewRows').replaceChildren();
    if(review){const dl=$('reviewFacts');fact(dl,'operation',t(review.proposal.operation));fact(dl,'maintenance',review.choice.record?'#'+review.choice.record.id:t('newRecord'));fact(dl,'plate',review.choice.vehicle?.plate);fact(dl,'notes',review.proposal.reason);if(actor?.role==='ADMIN'){fact(dl,'expense',review.choice.expense?'#'+review.choice.expense.id:t('none'));fact(dl,'financialReview',t(review.plan.expenseReviewAfter?'yes':'no'));}for(const k of [...fields(),'status','completedAt']){const card=node('article',''),facts=node('dl','');card.className='hub-card';card.append(node('h4',t(k==='title'?'titleField':k==='notes'?'fieldNotes':k)));fact(facts,'before',valueText(k,review.choice.record?.[k]));fact(facts,'after',valueText(k,review.plan.after[k]));card.append(facts);$('reviewRows').append(card);}}
    $('expiry').textContent = review ? t('expires') + ' ' + date(review.expiresAt) : '';
    $('save').disabled = blocked() || busy() || !review || !$('confirm').checked; $('confirm').disabled = busy(); $('backEdit').disabled = busy();
    $('receiptFacts').replaceChildren();
    if(receipt){const dl=$('receiptFacts');fact(dl,'operation',t(receipt.operation));fact(dl,'maintenance',receipt.record?'#'+receipt.record.id:receipt.maintenanceId?'#'+receipt.maintenanceId:t('newRecord'));fact(dl,'confirmedAt',date(receipt.receipt.confirmedAt));fact(dl,'audit','#'+receipt.auditId);if(receipt.record){for(const k of ['status','completedAt','km',...(actor?.role==='ADMIN'?['cost']:[])])fact(dl,k,valueText(k,receipt.record[k]));if(actor?.role==='ADMIN')fact(dl,'financialReview',t(receipt.plan.expenseReviewAfter?'yes':'no'));}}
    const expense=receipt?.plan?.expenseId||target?.expense?.id;$('expenseLink').hidden=blocked()||actor?.role!=='ADMIN';$('expenseLink').href='/admin-expenses'+(expense?'?expenseId='+expense:'');
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
      if (!data.rows.length) $('guideList').append(node('p', t('empty')));
      for(const c of data.rows){const card=node('article',''),dl=node('dl',''),b=node('button',t(c.record?'choose':'create'));card.className='hub-card';card.dataset.recordId=c.record?.id||'';card.dataset.vehicleId=c.record?.vehicleId||c.vehicle?.id||'';card.append(node('h3',c.record?'#'+c.record.id+' — '+c.record.title:c.vehicle.plate));fact(dl,'plate',c.vehicle?.plate);if(c.record){fact(dl,'status',t(c.record.status));fact(dl,'dueDate',c.record.dueDate);if(actor?.role==='ADMIN')fact(dl,'cost',c.record.cost);}card.append(dl);b.type='button';b.disabled=blocked()||busy()||!!pending||!!target;b.onclick=()=>choose(c);card.append(b);$('guideList').append(card);}
    }
  }
  async function load() {
    if (!active() || suspended) return; data = null; state = 'loading'; const job = start('list'), requested = page, filter = { ...query }; render();
    try { const value = await request('?' + new URLSearchParams({ ...filter, page: requested }), job); if (!R.listPacket(value, actor.owner, requested, filter.kind)) throw Error(); data = value; state = 'ready'; }
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
      const candidate = { version: 1, owner: actor.owner, operation:proposal.operation,maintenanceId:proposal.maintenanceId,vehicleId:proposal.vehicleId,requestId: review.requestId };
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
    try { accept(await request('/' + (cancel ? 'cancel' : 'result') + '/' + pending.requestId, job, cancel ? { method: 'POST', body: JSON.stringify({operation:pending.operation,maintenanceId:pending.maintenanceId,vehicleId:pending.vehicleId}) } : {})); }
    catch (_) { if (current(job)) writeState = 'unknown'; }
    finally { finish(job); if (active() && !suspended) { render(); if (receipt) load(); } }
  }
  const url = new URL(location.href), lang = url.searchParams.get('lang'); if (Object.hasOwn(copy, lang)) language = lang;
  for(const k of ['vehicleId','maintenanceId'])if(R.id(url.searchParams.get(k))){query[k]=url.searchParams.get(k);$(k+'Filter').value=query[k];}
  if(url.searchParams.get('kind')==='vehicles'&&!query.maintenanceId)query.kind='vehicles';$('directoryKind').value=query.kind;
  try { actor = identity(); if (!actor) throw Error(); key = 'cw:vehicle-maintenance:v1:' + actor.owner; document.body.dataset.requiredRole = actor.role; } catch (_) { invalid = true; }
  $('operation').addEventListener('change',()=>{if(active()&&!blocked()&&!busy()&&!pending){operation=$('operation').value;drawFields();render();}});
  $('consumeForm').addEventListener('submit', e => { e.preventDefault(); prepare(); }); $('confirm').addEventListener('change', render); $('save').addEventListener('click', () => send());
  $('backEdit').addEventListener('click', () => { if (active() && !busy() && !pending) { review = proposal = null; $('confirm').checked = false; writeState = 'editing'; render(); } });
  $('discard').addEventListener('click', () => { if (active() && !blocked() && !busy() && !pending) { clearFields(); target = review = proposal = null; writeState = 'idle'; render(); } });
  $('check').addEventListener('click', () => check()); $('retry').addEventListener('click', () => send(true)); $('cancel').addEventListener('click', () => check(true));
  $('next').addEventListener('click', () => { if (active() && !blocked() && !busy() && receipt && remember(null)) { pending = receipt = original = target = review = proposal = null; writeState = 'idle'; } render(); });
  $('filters').addEventListener('submit',e=>{e.preventDefault();const filter={kind:$('directoryKind').value,q:$('search').value.trim()};for(const k of ['vehicleId','maintenanceId'])if($(k+'Filter').value.trim())filter[k]=$(k+'Filter').value.trim();if(!R.query(filter)){abort('list');data=null;state='error';render();return;}query=filter;page=1;load();});
  $('clearSearch').addEventListener('click',()=>{$('search').value=$('vehicleIdFilter').value=$('maintenanceIdFilter').value='';query={q:'',kind:$('directoryKind').value};page=1;load();});
  $('refresh').addEventListener('click', load); $('previous').addEventListener('click', () => { page = Math.max(1, page - 1); load(); }); $('following').addEventListener('click', () => { page++; load(); });
  $('language').addEventListener('change', () => { language = $('language').value; const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url); render(); });
  window.addEventListener('storage', active); window.addEventListener('focus', active); document.addEventListener('visibilitychange', () => { if (!document.hidden) active(); });
  window.addEventListener('pagehide', () => { suspended = true; for (const k of Object.keys(jobs)) abort(k); clearFields(); review = proposal = original = receipt = data = target = null; state = 'loading'; writeState = pending ? 'unknown' : 'idle'; render(); });
  window.addEventListener('pageshow', () => { suspended = false; if (active()) { restore(); render(); load(); } });
  setInterval(() => { if (active() && review && !pending && Date.parse(review.expiresAt) <= Date.now()) { review = proposal = null; writeState = 'expired'; render(); } }, 1000);
  render(); active();
}());
