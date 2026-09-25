(function () {
  'use strict';
  const R = window.CWTransportItemsRules, copy = window.CWTransportItemsCopy;
  const $ = id => document.getElementById(id), panel = $('transportCreator'), jobs = {};
  const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
  let actor, invalid = false, suspended = false, storageBlocked = false, key = '', raw = null;
  let pending = null, original = null, receipt = null, review = null, proposal = null, target = null, data = null;
  let state = 'loading', writeState = 'idle', language = 'pt', page = 1, query = { q: '' };
  const t = k => copy[language][k] || k, node = (tag, text) => { const el = document.createElement(tag); el.textContent = text; return el; };
  const busy = () => !!jobs.write || !!jobs.review, blocked = () => invalid || suspended || storageBlocked;
  const unresolved = () => !!pending && !receipt;
  function identity() {
    const tokens=keys.slice(0,3).map(k=>localStorage.getItem(k)),token=tokens.find(Boolean),users=keys.slice(3).map(k=>localStorage.getItem(k)).filter(Boolean).map(JSON.parse);
    if(!token||tokens.some(v=>v&&v!==token))return null;
    const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))),id=Number(claims.userId||claims.id);
    if(claims.role!=='ADMIN'||claims.principalType==='ENV_ADMIN'||!R.positive(id)||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||!users.length||users.some(u=>u.role!=='ADMIN'||Number(u.userId||u.id)!==id))return null;
    return {token,role:'ADMIN',owner:'ADMIN:'+id,expires:claims.exp*1000,fingerprint:JSON.stringify([tokens,users.map(u=>[u.role,Number(u.userId||u.id)])])};
  }
  function abort(kind) { const job = jobs[kind]; if (job) { job.controller.abort(); clearTimeout(job.timer); delete jobs[kind]; } }
  function clearFields() { $('consumeForm').reset(); $('transportItems').replaceChildren(); $('confirm').checked = false; }
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
    const res = await fetch('/api/transport-guide-items' + path, { ...config, headers: { Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json' }, cache: 'no-store', redirect: 'error', signal: job.controller.signal });
    if (!current(job)) throw Error('stale');
    if ([401, 403].includes(res.status)) { invalid = true; active(); throw Error('session'); }
    const trusted = res.headers.get('x-cw-transport') === 'transport-items-v1' && res.headers.get('x-cw-owner') === actor.owner && res.headers.get('cache-control') === 'private, no-store' && (res.headers.get('content-type') || '').startsWith('application/json');
    const value = await res.json();
    if (!current(job) || !trusted) throw Error('unconfirmed');
    if (res.status !== 200) throw Object.assign(Error('refused'), value?.ok === false && value.version === 1 && value.owner === actor.owner && typeof value.code === 'string' && value.code.startsWith('TRANSPORT_') ? { status: res.status, code: value.code } : {});
    if (!R.base(value, actor.owner)) throw Error('unconfirmed');
    return value;
  }
  function collect() {
    const items=[...$('transportItems').children].map(row=>({id:row.dataset.itemId?Number(row.dataset.itemId):null,workItemId:row.dataset.itemId?R.id(row.querySelector('[data-field=workItemId]').value):null,name:row.querySelector('[data-field=name]').value,type:row.dataset.nullType==='true'?null:row.querySelector('[data-field=type]').value,unit:row.querySelector('[data-field=unit]').value,quantity:row.querySelector('[data-field=quantity]').value.trim().replace(',','.')}));
    return R.input({guideId:target?.id,notes:$('notes').value,items});
  }
  function addItem(item=null) {
    if(blocked()||busy()||pending||review||$('transportItems').children.length>=100)return;
    const row=node('div','');row.className='item-fields';row.dataset.itemId=item?.id||'';row.dataset.nullType=String(item?.type===null);
    const heading=node('h4',item?'#'+item.id:t('newItem'));if(!item)heading.dataset.copy='newItem';row.append(heading);
    for(const k of ['name','type','unit','quantity']){const label=node('label',''),span=node('span',t(k)),input=node('input','');span.dataset.copy=k;input.dataset.field=k;input.type='text';input.maxLength=item?10000:{name:300,type:100,unit:30,quantity:14}[k];if(k==='quantity')input.inputMode='decimal';input.value=item?(k==='quantity'?String(item.quantity):item[k]||''):'';input.readOnly=!!item&&k!=='quantity';label.append(span,input);row.append(label);}
    if(item){const label=node('label',''),span=node('span',t('mapping')),select=node('select','');span.dataset.copy='mapping';select.dataset.field='workItemId';const blank=node('option',t('chooseMapping'));blank.value='';blank.dataset.copy='chooseMapping';select.append(blank);for(const w of target.workGuides[0].items.filter(w=>['name','type','unit'].every(k=>w[k]===item[k]))){const option=node('option','#'+w.id+' · '+w.unit+' · '+w.usedQty+' / '+w.initialQty+' — '+w.name);option.value=w.id;select.append(option);}const detail=node('p','');detail.dataset.workDetail='';detail.className='mapping-detail';select.addEventListener('change',render);label.append(span,select,detail);row.append(label);}
    const remove=node('button',t('remove'));remove.type='button';remove.dataset.copy='remove';remove.disabled=!!item;remove.dataset.fixed=String(!!item);remove.addEventListener('click',()=>{if(active()&&!blocked()&&!busy()&&!review&&!pending&&!item){row.remove();render();}});row.append(remove);$('transportItems').append(row);
  }
  function choose(guide) {
    if(!active()||blocked()||busy()||pending||target||!data||!R.editable(guide))return;
    target=guide;review=proposal=receipt=null;clearFields();for(const item of guide.items)addItem(item);
    writeState='editing';render();$('writePanel').scrollIntoView({block:'start'});$('notes').focus({preventScroll:true});
  }
  function fact(dl, label, value) { const div = node('div', ''); div.append(node('dt', t(label)), node('dd', value === null || value === undefined || value === '' ? t('missing') : String(value))); dl.append(div); }
  const date = v => new Intl.DateTimeFormat({ pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' }[language], { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(v));
  function render() {
    panel.dataset.state=invalid?'session':state;panel.dataset.writeState=writeState;document.documentElement.lang=language;document.title='Cristal Water — '+t('title');
    for(const el of document.querySelectorAll('[data-copy]'))el.textContent=t(el.dataset.copy);$('language').value=language;$('returnLink').href=(invalid?'/login':'/admin-vehicles')+'?lang='+language;
    $('writePanel').hidden=!target&&!pending&&!storageBlocked;$('writeStatus').textContent=t(writeState);$('targetIdentity').textContent=target?'#'+target.id+' — '+(target.codeAT||t('missing'))+' · '+target.vehicle.plate:'';$('writeReference').textContent=pending?t('reference')+': '+pending.requestId:'';
    $('consumeForm').hidden=!target||blocked()||!!review||!!pending;
    for(const el of $('consumeForm').elements)el.disabled=blocked()||busy()||!!review||!!pending||el.dataset.fixed==='true';
    for(const detail of document.querySelectorAll('[data-work-detail]')){const row=detail.closest('.item-fields'),id=R.id(row.querySelector('[data-field=workItemId]').value),w=target?.workGuides[0]?.items.find(i=>i.id===id);detail.textContent=w?'#'+w.id+' · '+w.name+' ('+w.unit+')\n'+t('used')+': '+w.usedQty+'\n'+t('workInitialBefore')+': '+w.initialQty+'\n'+t('before')+': '+w.quantity:'';}
    $('addItem').disabled=blocked()||busy()||!!review||!!pending||$('transportItems').children.length>=100;
    $('reviewPanel').hidden=!review||blocked()||!!pending;$('reviewFacts').replaceChildren();$('reviewRows').replaceChildren();
    if(review){const p=review.proposal,c=review.choice,plan=review.plan,dl=$('reviewFacts');fact(dl,'plate',c.vehicle.plate);fact(dl,'guide','#'+c.id+' — '+(c.codeAT||t('missing')));fact(dl,'workMode','#'+plan.workGuideId);fact(dl,'notes',p.notes);
      for(const row of plan.rows){const card=node('article',''),facts=node('dl','');card.className='hub-card';card.append(node('h4',(row.id?'#'+row.id+' → #'+row.workItemId+' — ':'')+row.name+' ('+row.unit+')'));fact(facts,'transportBefore',row.before?row.before.transportQuantity:t('newItem'));fact(facts,'workInitialBefore',row.before?row.before.initialQty:t('newItem'));fact(facts,'before',row.before?row.before.quantity:t('newItem'));fact(facts,'initial',row.after.initialQty);fact(facts,'used',row.after.usedQty);fact(facts,'delta',row.delta);fact(facts,'after',row.after.quantity);card.append(facts);$('reviewRows').append(card);}}
    $('expiry').textContent=review?t('expires')+' '+date(review.expiresAt):'';$('save').disabled=blocked()||busy()||!review||!$('confirm').checked;$('confirm').disabled=busy();$('backEdit').disabled=busy();$('receiptFacts').replaceChildren();
    if(receipt){const dl=$('receiptFacts');fact(dl,'guide','#'+receipt.guideId);fact(dl,'confirmedAt',date(receipt.receipt.confirmedAt));fact(dl,'audit','#'+receipt.auditId);if(receipt.guide){fact(dl,'plate',receipt.guide.vehicle.plate);fact(dl,'workMode','#'+receipt.workGuideId);fact(dl,'movements',receipt.movementIds.map(id=>'#'+id).join(', ')||t('noAdjustment'));}}
    for(const id of ['check','retry','cancel'])$(id).hidden=!unresolved()||blocked()||id==='retry'&&!original;$('cancelHint').hidden=!unresolved()||blocked();$('next').hidden=!receipt||blocked();$('discard').hidden=!target||!!pending||blocked();for(const id of ['check','retry','cancel','next','discard'])$(id).disabled=busy();
    $('listStatus').textContent=t(invalid?'session':state);$('count').textContent=data?t('total')+': '+data.total:'';$('page').textContent=data?t('page')+' '+data.page+' / '+Math.max(1,Math.ceil(data.total/25)):'';$('previous').disabled=blocked()||!data||data.page<=1;$('following').disabled=blocked()||!data||data.page*25>=data.total;$('refresh').disabled=invalid||suspended;for(const el of $('filters').elements)el.disabled=invalid||suspended;
    $('guideList').replaceChildren();if(data){if(!data.guides.length)$('guideList').append(node('p',t('empty')));for(const v of data.guides){const card=node('article',''),b=node('button',t('choose'));card.className='hub-card';card.dataset.guideId=v.id;card.append(node('h3','#'+v.id+' — '+(v.codeAT||t('missing'))),node('p',v.vehicle.plate),node('p',t('workMode')+': '+v.workGuides.map(w=>'#'+w.id).join(', ')));if(!R.editable(v))card.append(node('p',t('unavailable')));b.type='button';b.disabled=blocked()||busy()||!!pending||!!target||!R.editable(v);b.addEventListener('click',()=>choose(v));card.append(b);$('guideList').append(card);}}
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
      const candidate = { version: 1, owner: actor.owner, guideId: proposal.guideId, requestId: review.requestId };
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
    try { accept(await request('/' + (cancel ? 'cancel' : 'result') + '/' + pending.requestId, job, cancel ? { method: 'POST', body: JSON.stringify({ guideId: pending.guideId }) } : {})); }
    catch (_) { if (current(job)) writeState = 'unknown'; }
    finally { finish(job); if (active() && !suspended) { render(); if (receipt) load(); } }
  }
  const url = new URL(location.href), lang = url.searchParams.get('lang'); if (Object.hasOwn(copy, lang)) language = lang;
  if (R.id(url.searchParams.get('guideId'))) { query.guideId = url.searchParams.get('guideId'); $('vehicleFilter').value = query.guideId; }
  try { actor = identity(); if (!actor) throw Error(); key = 'cw:transport-guide-items:v1:' + actor.owner; document.body.dataset.requiredRole = actor.role; } catch (_) { invalid = true; }
  $('addItem').addEventListener('click',()=>{if(active()){addItem();render();}});
  $('consumeForm').addEventListener('submit', e => { e.preventDefault(); prepare(); }); $('confirm').addEventListener('change', render); $('save').addEventListener('click', () => send());
  $('backEdit').addEventListener('click', () => { if (active() && !busy() && !pending) { review = proposal = null; $('confirm').checked = false; writeState = 'editing'; render(); } });
  $('discard').addEventListener('click', () => { if (active() && !blocked() && !busy() && !pending) { clearFields(); target = review = proposal = null; writeState = 'idle'; render(); } });
  $('check').addEventListener('click', () => check()); $('retry').addEventListener('click', () => send(true)); $('cancel').addEventListener('click', () => check(true));
  $('next').addEventListener('click', () => { if (active() && !blocked() && !busy() && receipt && remember(null)) { pending = receipt = original = target = review = proposal = null; writeState = 'idle'; } render(); });
  $('filters').addEventListener('submit', e => { e.preventDefault(); const filter = { q: $('search').value.trim(), ...($('vehicleFilter').value.trim() ? { guideId: $('vehicleFilter').value.trim() } : {}) }; if (!R.query(filter)) { abort('list'); data = null; state = 'error'; render(); return; } query = filter; page = 1; load(); });
  $('clearSearch').addEventListener('click', () => { $('search').value = $('vehicleFilter').value = ''; query = { q: '' }; page = 1; load(); });
  $('refresh').addEventListener('click', load); $('previous').addEventListener('click', () => { page = Math.max(1, page - 1); load(); }); $('following').addEventListener('click', () => { page++; load(); });
  $('language').addEventListener('change', () => { language = $('language').value; const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url); render(); });
  window.addEventListener('storage', active); window.addEventListener('focus', active); document.addEventListener('visibilitychange', () => { if (!document.hidden) active(); });
  window.addEventListener('pagehide', () => { suspended = true; for (const k of Object.keys(jobs)) abort(k); clearFields(); review = proposal = original = receipt = data = target = null; state = 'loading'; writeState = pending ? 'unknown' : 'idle'; render(); });
  window.addEventListener('pageshow', () => { suspended = false; if (active()) { restore(); render(); load(); } });
  setInterval(() => { if (active() && review && !pending && Date.parse(review.expiresAt) <= Date.now()) { review = proposal = null; writeState = 'expired'; render(); } }, 1000);
  render(); active();
}());
