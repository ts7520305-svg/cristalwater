(function () {
  'use strict';
  const R = window.CWVehicleAssignmentRules, copy = window.CWVehicleAssignmentCopy;
  const $ = id => document.getElementById(id), panel = $('assignmentManager'), jobs = {};
  const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
  let actor, invalid = false, suspended = false, storageBlocked = false, key = '', raw = null;
  let pending = null, original = null, receipt = null, review = null, proposal = null, target = null, data = null;
  let state = 'loading', writeState = 'idle', language = 'pt', page = 1, query = { q: '', kind:'technicians' };
  let destination, destinations=null, vehiclePage=1, vehicleQuery='', vehicleState='loading';
  const t = k => copy[language][k] || k, node = (tag, text) => { const el = document.createElement(tag); el.textContent = text; return el; };
  const busy = () => !!jobs.write || !!jobs.review, blocked = () => invalid || suspended || storageBlocked;
  const unresolved = () => !!pending && !receipt;
  function identity() {
    const tokens = keys.slice(0, 3).map(k => localStorage.getItem(k)), token = tokens.find(Boolean);
    const users = keys.slice(3).map(k => localStorage.getItem(k)).filter(Boolean).map(JSON.parse);
    if (!token || tokens.some(v => v && v !== token)) return null;
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const role = claims.role, id = Number(claims.userId || claims.id), tech = Number(claims.technicianId || claims.id);
    if (role !== 'ADMIN' || claims.principalType === 'ENV_ADMIN' || !R.positive(id) || !R.positive(tech) || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() || !users.length) return null;
    if (role !== 'ADMIN' && claims.principalType === 'USER' && !R.positive(claims.technicianId)) return null;
    if (users.some(u => u.role !== role || Number(u.userId || u.id) !== id || role !== 'ADMIN' && Number(u.technicianId || u.id) !== tech)) return null;
    const owner = role === 'ADMIN' ? 'ADMIN:' + id : claims.principalType === 'USER' ? `USER:${id}:TECH:${tech}` : 'TECH:' + tech;
    return { token, role, owner, expires: claims.exp * 1000, fingerprint: JSON.stringify([tokens, users.map(u => [u.role, u.userId || u.id, u.technicianId || u.id])]) };
  }
  function abort(kind) { const job = jobs[kind]; if (job) { job.controller.abort(); clearTimeout(job.timer); delete jobs[kind]; } }
  function clearFields() { $('consumeForm').reset(); destination=undefined;destinations=null;vehiclePage=1;vehicleQuery='';$('vehicleSearch').value=''; $('confirm').checked = false; }
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
    const res = await fetch('/api/vehicle-assignment' + path, { ...config, headers: { Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json' }, cache: 'no-store', redirect: 'error', signal: job.controller.signal });
    if (!current(job)) throw Error('stale');
    if ([401, 403].includes(res.status)) { invalid = true; active(); throw Error('session'); }
    const trusted = res.headers.get('x-cw-assignment') === 'vehicle-assignment-v1' && res.headers.get('x-cw-owner') === actor.owner && res.headers.get('cache-control') === 'private, no-store' && (res.headers.get('content-type') || '').startsWith('application/json');
    const value = await res.json();
    if (!current(job) || !trusted) throw Error('unconfirmed');
    if (res.status !== 200) throw Object.assign(Error('refused'), value?.ok === false && value.version === 1 && value.owner === actor.owner && typeof value.code === 'string' && value.code.startsWith('ASSIGNMENT_') ? { status: res.status, code: value.code } : {});
    if (!R.base(value, actor.owner)) throw Error('unconfirmed');
    return value;
  }
  function collect() {
    const mode=$('kmMode').value;
    return R.input({technicianId:target?.technician.id,vehicleId:destination===undefined?undefined:destination?.id||null,kmMode:mode,km:mode==='KEEP'?null:$('km').value.trim().replace(',','.'),reason:$('notes').value});
  }
  function choose(choice) {
    if(!active()||blocked()||busy()||pending||target||!data)return;
    clearFields();target=choice;review=proposal=receipt=null;writeState='editing';render();loadVehicles();$('writePanel').scrollIntoView({block:'start'});$('destination').focus({preventScroll:true});
  }
  const vehicleName=v=>v?'#'+v.id+' — '+v.plate:t('none');
  function drawOptions(){const select=$('destination');select.replaceChildren();for(const [value,text]of [['',t('selectVehicle')],['none',t('unassign')],...(destinations?.rows||[]).map(v=>[String(v.id),vehicleName(v)])]){const option=node('option',text);option.value=value;select.append(option);}if(destination&&!Array.from(select.options).some(o=>o.value===String(destination.id))){const option=node('option',vehicleName(destination));option.value=String(destination.id);select.append(option);}select.value=destination===undefined?'':destination===null?'none':String(destination.id);}
  async function loadVehicles(){if(!active()||suspended||!target||pending)return;destinations=null;vehicleState='loading';const job=start('vehicles'),requested=vehiclePage,search=vehicleQuery;render();try{const value=await request('?'+new URLSearchParams({kind:'vehicles',page:requested,q:search}),job);if(!R.listPacket(value,actor.owner,requested,'vehicles'))throw Error();destinations=value;vehicleState='ready';}catch(_){if(current(job)){destinations=null;vehicleState='error';}}finally{finish(job);if(active()&&!suspended)render();}}
  function fact(dl, label, value) { const div = node('div', ''); div.append(node('dt', t(label)), node('dd', value === null || value === undefined || value === '' ? t('missing') : String(value))); dl.append(div); }
  const named = v => v ? '#' + v.id + ' — ' + v.name : t('none');
  const date = v => new Intl.DateTimeFormat({ pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' }[language], { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(v));
  function render() {
    panel.dataset.state=invalid?'session':state;panel.dataset.writeState=writeState;
    document.documentElement.lang=language;document.title='Cristal Water — '+t('title');
    for(const el of document.querySelectorAll('[data-copy]'))el.textContent=t(el.dataset.copy);
    $('language').value=language;$('returnLink').href=(invalid?'/login':'/admin-vehicles')+'?lang='+language;
    $('writePanel').hidden=!target&&!pending&&!storageBlocked;$('writeStatus').textContent=t(writeState);
    $('targetIdentity').textContent=target?'#'+target.technician.id+' — '+target.technician.name:'';
    $('writeReference').textContent=pending?t('reference')+': '+pending.requestId:'';
    $('currentFacts').replaceChildren();if(target){fact($('currentFacts'),'before',vehicleName(target.vehicle));fact($('currentFacts'),'openWork',target.openWorkCount);fact($('currentFacts'),'active',t(target.technician.active&&!target.technician.deletedAt?'yes':'no'));}
    $('workLink').hidden=!target?.openWorkCount||blocked();$('workLink').href='/work-guide-close'+(target?.firstOpenWorkId?'?workGuideId='+target.firstOpenWorkId+'&lang='+language:'?lang='+language);
    $('editor').hidden=!target||blocked()||!!review||!!pending;
    for(const el of $('consumeForm').elements)el.disabled=blocked()||busy()||!!review||!!pending;
    $('prepare').disabled=blocked()||busy()||!!review||!!pending||!!target?.openWorkCount;
    $('km').disabled=$('km').disabled||$('kmMode').value!=='SET'||!destination;
    $('kmMode').disabled=$('kmMode').disabled||!destination;$('kmSelection').textContent=t($('kmMode').value);
    drawOptions();$('selectedVehicle').textContent=destination===undefined?t('selectVehicle'):vehicleName(destination)+(destination?' · '+t('kmBefore')+': '+(destination.currentKm??t('missing')):'');
    $('vehicleStatus').textContent=t(vehicleState);$('vehiclePage').textContent=destinations?t('page')+' '+vehiclePage+' / '+Math.max(1,Math.ceil(destinations.total/25)):'';
    for(const id of ['vehicleSearch','findVehicle','previousVehicle','followingVehicle'])$(id).disabled=blocked()||busy()||!!review||!!pending||id==='previousVehicle'&&(!destinations||vehiclePage<=1)||id==='followingVehicle'&&(!destinations||vehiclePage*25>=destinations.total);
    $('reviewPanel').hidden=!review||blocked()||!!pending;$('reviewFacts').replaceChildren();
    if(review){const c=review.choice,p=review.plan,dl=$('reviewFacts');fact(dl,'technician','#'+c.technician.id+' — '+c.technician.name);fact(dl,'before',vehicleName(c.currentVehicle));fact(dl,'after',vehicleName(c.targetVehicle));fact(dl,'closeLog',c.openLog?'#'+c.openLog.id+' · '+c.openLog.startAt:t('none'));fact(dl,'createLog',t(p.createLog?'now':'no'));fact(dl,'historyGap',t(p.historyGap?'gap':'no'));fact(dl,'targetWork',c.targetWork.length?c.targetWork.map(w=>'#'+w.id).join(', '):t('none'));fact(dl,'kmMode',t(p.updateKm?'SET':'KEEP'));fact(dl,'kmBefore',p.kmBefore);fact(dl,'kmAfter',p.kmAfter);fact(dl,'notes',review.proposal.reason);}
    $('expiry').textContent=review?t('expires')+' '+date(review.expiresAt):'';
    $('save').disabled=blocked()||busy()||!review||!$('confirm').checked;$('confirm').disabled=busy();$('backEdit').disabled=busy();
    $('receiptFacts').replaceChildren();if(receipt){const dl=$('receiptFacts');fact(dl,'technician','#'+receipt.technicianId);fact(dl,'confirmedAt',date(receipt.receipt.confirmedAt));fact(dl,'audit','#'+receipt.auditId);if(!receipt.cancelled){fact(dl,'after',vehicleName(receipt.vehicle));fact(dl,'closeLog',receipt.closedLog?'#'+receipt.closedLog.id+' · '+receipt.closedLog.endAt:t('none'));fact(dl,'createLog',receipt.openedLog?'#'+receipt.openedLog.id+' · '+receipt.openedLog.startAt:t('none'));fact(dl,'kmAfter',receipt.vehicle?.currentKm);fact(dl,'historyGap',t(receipt.plan.historyGap?'gap':'no'));}}
    for(const id of ['check','retry','cancel'])$(id).hidden=!unresolved()||blocked()||id==='retry'&&!original;
    $('cancelHint').hidden=!unresolved()||blocked();$('next').hidden=!receipt||blocked();$('discard').hidden=!target||!!pending||blocked();for(const id of ['check','retry','cancel','next','discard'])$(id).disabled=busy();
    $('listStatus').textContent=t(invalid?'session':state);$('count').textContent=data?t('total')+': '+data.total:'';$('page').textContent=data?t('page')+' '+data.page+' / '+Math.max(1,Math.ceil(data.total/25)):'';
    $('previous').disabled=blocked()||!data||data.page<=1;$('following').disabled=blocked()||!data||data.page*25>=data.total;$('refresh').disabled=invalid||suspended;for(const el of $('filters').elements)el.disabled=invalid||suspended;
    $('guideList').replaceChildren();if(data){if(!data.rows.length)$('guideList').append(node('p',t('empty')));for(const c of data.rows){const card=node('article',''),dl=node('dl',''),button=node('button',t('choose'));card.className='hub-card';card.dataset.technicianId=c.technician.id;card.append(node('h3','#'+c.technician.id+' — '+c.technician.name));fact(dl,'before',vehicleName(c.vehicle));fact(dl,'openWork',c.openWorkCount);fact(dl,'active',t(c.technician.active&&!c.technician.deletedAt?'yes':'no'));button.type='button';button.disabled=blocked()||busy()||!!pending||!!target;button.onclick=()=>choose(c);card.append(dl,button);$('guideList').append(card);}}
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
    catch (e) { if (current(job)) { review = proposal = null; writeState = e.code==='ASSIGNMENT_OPEN_WORK'?'openWorkError':e.code==='ASSIGNMENT_HISTORY_REVIEW'?'historyError':'reviewError'; } }
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
      const candidate = { version: 1, owner: actor.owner, technicianId:proposal.technicianId,vehicleId:proposal.vehicleId,requestId: review.requestId };
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
    try { accept(await request('/' + (cancel ? 'cancel' : 'result') + '/' + pending.requestId, job, cancel ? { method: 'POST', body: JSON.stringify({technicianId:pending.technicianId,vehicleId:pending.vehicleId}) } : {})); }
    catch (_) { if (current(job)) writeState = 'unknown'; }
    finally { finish(job); if (active() && !suspended) { render(); if (receipt) load(); } }
  }
  const url = new URL(location.href), lang = url.searchParams.get('lang'); if (Object.hasOwn(copy, lang)) language = lang;
  if(R.id(url.searchParams.get('technicianId'))){query.technicianId=url.searchParams.get('technicianId');$('technicianIdFilter').value=query.technicianId;}
  try { actor = identity(); if (!actor) throw Error(); key = 'cw:vehicle-assignment:v1:' + actor.owner; document.body.dataset.requiredRole = actor.role; } catch (_) { invalid = true; }
  $('destination').addEventListener('change',()=>{const value=$('destination').value;destination=value==='none'?null:value===''?undefined:destinations?.rows.find(v=>String(v.id)===value)||(destination&&String(destination.id)===value?destination:undefined);$('kmMode').value='KEEP';$('km').value='';render();});
  $('kmMode').addEventListener('change',()=>{$('km').value='';render();});
  $('findVehicle').addEventListener('click',()=>{vehicleQuery=$('vehicleSearch').value.trim();vehiclePage=1;loadVehicles();});
  $('vehicleSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('findVehicle').click();}});
  $('previousVehicle').addEventListener('click',()=>{vehiclePage=Math.max(1,vehiclePage-1);loadVehicles();});
  $('followingVehicle').addEventListener('click',()=>{vehiclePage++;loadVehicles();});
  $('consumeForm').addEventListener('submit', e => { e.preventDefault(); prepare(); }); $('confirm').addEventListener('change', render); $('save').addEventListener('click', () => send());
  $('backEdit').addEventListener('click', () => { if (active() && !busy() && !pending) { review = proposal = null; $('confirm').checked = false; writeState = 'editing'; render(); } });
  $('discard').addEventListener('click', () => { if (active() && !blocked() && !busy() && !pending) { clearFields(); target = review = proposal = null; writeState = 'idle'; render(); } });
  $('check').addEventListener('click', () => check()); $('retry').addEventListener('click', () => send(true)); $('cancel').addEventListener('click', () => check(true));
  $('next').addEventListener('click', () => { if (active() && !blocked() && !busy() && receipt && remember(null)) { pending = receipt = original = target = review = proposal = null; writeState = 'idle'; } render(); });
  $('filters').addEventListener('submit',e=>{e.preventDefault();const filter={kind:'technicians',q:$('search').value.trim()};if($('technicianIdFilter').value.trim())filter.technicianId=$('technicianIdFilter').value.trim();if(!R.query(filter)){abort('list');data=null;state='error';render();return;}query=filter;page=1;load();});
  $('clearSearch').addEventListener('click',()=>{$('search').value=$('technicianIdFilter').value='';query={q:'',kind:'technicians'};page=1;load();});
  $('refresh').addEventListener('click', load); $('previous').addEventListener('click', () => { page = Math.max(1, page - 1); load(); }); $('following').addEventListener('click', () => { page++; load(); });
  $('language').addEventListener('change', () => { language = $('language').value; const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url); render(); });
  window.addEventListener('storage', active); window.addEventListener('focus', active); document.addEventListener('visibilitychange', () => { if (!document.hidden) active(); });
  window.addEventListener('pagehide', () => { suspended = true; for (const k of Object.keys(jobs)) abort(k); clearFields(); review = proposal = original = receipt = data = target = null; state = 'loading'; writeState = pending ? 'unknown' : 'idle'; render(); });
  window.addEventListener('pageshow', () => { suspended = false; if (active()) { restore(); render(); load(); } });
  setInterval(() => { if (active() && review && !pending && Date.parse(review.expiresAt) <= Date.now()) { review = proposal = null; writeState = 'expired'; render(); } }, 1000);
  render(); active();
}());
