(function () {
  'use strict';
  const R = window.CWTransportGuideRules, copy = window.CWTransportGuideCopy;
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
    const res = await fetch('/api/transport-guide-create' + path, { ...config, headers: { Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json' }, cache: 'no-store', redirect: 'error', signal: job.controller.signal });
    if (!current(job)) throw Error('stale');
    if ([401, 403].includes(res.status)) { invalid = true; active(); throw Error('session'); }
    const trusted = res.headers.get('x-cw-transport') === 'transport-create-v1' && res.headers.get('x-cw-owner') === actor.owner && res.headers.get('cache-control') === 'private, no-store' && (res.headers.get('content-type') || '').startsWith('application/json');
    const value = await res.json();
    if (!current(job) || !trusted) throw Error('unconfirmed');
    if (res.status !== 200) throw Object.assign(Error('refused'), value?.ok === false && value.version === 1 && value.owner === actor.owner && typeof value.code === 'string' && value.code.startsWith('TRANSPORT_') ? { status: res.status, code: value.code } : {});
    if (!R.base(value, actor.owner)) throw Error('unconfirmed');
    return value;
  }
  function collect() {
    const clock=window.CWOnboardingRules,mode=$('workMode').value,tech=$('technician').value,km=$('startKm').value.trim();
    if(!mode||!tech)return null;
    const from=clock.resolve($('validFrom').value,$('fromChoice').value),until=$('validUntil').value?clock.resolve($('validUntil').value,$('untilChoice').value):null;
    if(!from||$('validUntil').value&&!until)return null;
    const items=[...$('transportItems').children].map(row=>({workItemId:row.dataset.workItemId?Number(row.dataset.workItemId):null,name:row.querySelector('[data-field=name]').value,type:row.dataset.nullType==='true'?null:row.querySelector('[data-field=type]').value,unit:row.querySelector('[data-field=unit]').value,quantity:row.querySelector('[data-field=quantity]').value.trim().replace(',','.')}));
    return R.input({vehicleId:target?.id,workGuideId:mode==='new'?null:R.id(mode),technicianId:tech==='none'?null:R.id(tech),startKm:km===''?null:/^\d+(?:[.,]\d+)?$/.test(km)?Number(km.replace(',','.')):NaN,codeAT:$('codeAT').value,origin:$('origin').value,destination:$('destination').value,notes:$('notes').value,validFrom:from,validUntil:until,isDraft:$('draft').value==='draft'?true:$('draft').value==='reference'?false:null,items});
  }
  function addItem(item=null) {
    if(blocked()||busy()||pending||review||$('transportItems').children.length>=100)return;
    const row=node('div','');row.className='item-fields';row.dataset.workItemId=item?.id||'';row.dataset.nullType=String(item?.type===null);
    const heading=node('h4',item?'#'+item.id:t('newItem'));heading.dataset.copy=item?'':'newItem';if(item)delete heading.dataset.copy;row.append(heading);
    for(const k of ['name','type','unit','quantity']){const label=node('label',''),span=node('span',t(k)),input=node('input','');span.dataset.copy=k;input.dataset.field=k;input.type='text';input.maxLength={name:300,type:100,unit:30,quantity:14}[k];if(k==='quantity')input.inputMode='decimal';input.value=item?(k==='quantity'?String(item.initialQty):item[k]||''):'';input.readOnly=!!item&&k!=='quantity';label.append(span,input);row.append(label);}
    const remove=node('button',t('remove'));remove.type='button';remove.dataset.copy='remove';remove.disabled=!!item;remove.dataset.fixed=String(!!item);remove.addEventListener('click',()=>{if(active()&&!blocked()&&!busy()&&!review&&!pending&&!item){row.remove();render();}});row.append(remove);$('transportItems').append(row);
  }
  function configureWork() {
    if(!active()||blocked()||busy()||pending||review||!target)return;
    const work=target.workGuides.find(w=>String(w.id)===$('workMode').value);$('transportItems').replaceChildren();
    $('technician').value=work?(work.technicianId===null?'none':String(work.technicianId)):'';$('startKm').value=work?.startKm??'';
    if(work)for(const item of work.items)addItem(item);else if($('workMode').value==='new')addItem();render();
  }
  function choose(vehicle) {
    if(!active()||blocked()||busy()||pending||target||!data)return;
    target=vehicle;review=proposal=receipt=null;clearFields();
    for(const [id,rows]of [['workMode',[['','chooseMode'],['new','newWork'],...vehicle.workGuides.filter(w=>w.guideId===null).map(w=>[String(w.id),'#'+w.id])]],['technician',[['','chooseTechnician'],['none','none'],...vehicle.technicians.map(t=>[String(t.id),'#'+t.id+' — '+t.name])]]]){const select=$(id);select.replaceChildren();for(const [value,label]of rows){const option=node('option',copy[language][label]||label);option.value=value;if(copy[language][label])option.dataset.copy=label;select.append(option);}}
    writeState='editing';render();$('writePanel').scrollIntoView({block:'start'});$('workMode').focus({preventScroll:true});
  }
  function fact(dl, label, value) { const div = node('div', ''); div.append(node('dt', t(label)), node('dd', value === null || value === undefined || value === '' ? t('missing') : String(value))); dl.append(div); }
  const named = v => v ? '#' + v.id + ' — ' + v.name : t('none');
  const date = v => new Intl.DateTimeFormat({ pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' }[language], { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(v));
  function render() {
    panel.dataset.state=invalid?'session':state;panel.dataset.writeState=writeState;document.documentElement.lang=language;document.title='Cristal Water — '+t('title');
    for(const el of document.querySelectorAll('[data-copy]'))el.textContent=t(el.dataset.copy);$('language').value=language;$('returnLink').href=(invalid?'/login':'/admin-vehicles')+'?lang='+language;
    $('writePanel').hidden=!target&&!pending&&!storageBlocked;$('writeStatus').textContent=t(writeState);$('targetIdentity').textContent=target?'#'+target.id+' — '+target.plate:'';$('writeReference').textContent=pending?t('reference')+': '+pending.requestId:'';
    $('consumeForm').hidden=!target||blocked()||!!review||!!pending;const linked=$('workMode').value!==''&&$('workMode').value!=='new';
    for(const el of $('consumeForm').elements)el.disabled=blocked()||busy()||!!review||!!pending||el.dataset.fixed==='true'||el.id==='technician'&&linked;
    $('startKm').readOnly=linked;$('addItem').disabled=blocked()||busy()||!!review||!!pending||!$('workMode').value||$('transportItems').children.length>=100;
    for(const [dateId,choiceId]of [['validFrom','fromChoice'],['validUntil','untilChoice']])$(choiceId).disabled=blocked()||busy()||!!review||!!pending||window.CWOnboardingRules.candidates($(dateId).value).length!==2;
    $('reviewPanel').hidden=!review||blocked()||!!pending;$('reviewFacts').replaceChildren();$('reviewRows').replaceChildren();
    if(review){const p=review.proposal,c=review.choice,plan=review.plan,dl=$('reviewFacts');fact(dl,'plate',c.plate);fact(dl,'workMode',p.workGuideId?'#'+p.workGuideId:t('newWork'));fact(dl,'technician',named(c.technicians.find(x=>x.id===p.technicianId)));fact(dl,'startKm',p.startKm);for(const k of ['codeAT','origin','destination','notes'])fact(dl,k,p[k]);fact(dl,'draft',t(p.isDraft?'draftValue':'referenceValue'));fact(dl,'validFrom',date(p.validFrom));fact(dl,'validUntil',p.validUntil?date(p.validUntil):t('none'));fact(dl,'closeWorks',plan.closeWorkGuideIds.map(x=>'#'+x).join(', ')||t('none'));fact(dl,'closeTransports',plan.closeTransportGuideIds.map(id=>{const row=c.transportGuides.find(g=>g.id===id);return '#'+id+(row?.codeAT?' — '+row.codeAT:'');}).join(', ')||t('none'));
      for(const row of plan.rows){const card=node('article',''),facts=node('dl','');card.className='hub-card';card.append(node('h4',(row.workItemId?'#'+row.workItemId+' — ':'')+row.name+' ('+row.unit+')'));fact(facts,'before',row.before?row.before.quantity:t('newItem'));fact(facts,'initial',row.after.initialQty);fact(facts,'used',row.after.usedQty);fact(facts,'after',row.after.quantity);card.append(facts);$('reviewRows').append(card);}}
    $('expiry').textContent=review?t('expires')+' '+date(review.expiresAt):'';$('save').disabled=blocked()||busy()||!review||!$('confirm').checked;$('confirm').disabled=busy();$('backEdit').disabled=busy();$('receiptFacts').replaceChildren();
    if(receipt){const dl=$('receiptFacts');fact(dl,'vehicle','#'+receipt.vehicleId);fact(dl,'confirmedAt',date(receipt.receipt.confirmedAt));fact(dl,'audit','#'+receipt.auditId);if(receipt.guide){fact(dl,'guide','#'+receipt.guide.id+(receipt.guide.codeAT?' — '+receipt.guide.codeAT:''));fact(dl,'workMode','#'+receipt.workGuide.id);fact(dl,'movements',receipt.movementIds.map(id=>'#'+id).join(', '));fact(dl,'closeWorks',receipt.closedWorkGuideIds.map(id=>'#'+id).join(', ')||t('none'));fact(dl,'closeTransports',receipt.closedTransportGuideIds.map(id=>'#'+id).join(', ')||t('none'));}}
    for(const id of ['check','retry','cancel'])$(id).hidden=!unresolved()||blocked()||id==='retry'&&!original;$('cancelHint').hidden=!unresolved()||blocked();$('next').hidden=!receipt||blocked();$('discard').hidden=!target||!!pending||blocked();for(const id of ['check','retry','cancel','next','discard'])$(id).disabled=busy();
    $('listStatus').textContent=t(invalid?'session':state);$('count').textContent=data?t('total')+': '+data.total:'';$('page').textContent=data?t('page')+' '+data.page+' / '+Math.max(1,Math.ceil(data.total/25)):'';$('previous').disabled=blocked()||!data||data.page<=1;$('following').disabled=blocked()||!data||data.page*25>=data.total;$('refresh').disabled=invalid||suspended;for(const el of $('filters').elements)el.disabled=invalid||suspended;
    $('guideList').replaceChildren();if(data){if(!data.vehicles.length)$('guideList').append(node('p',t('empty')));for(const v of data.vehicles){const card=node('article',''),b=node('button',t('choose'));card.className='hub-card';card.dataset.vehicleId=v.id;card.append(node('h3',v.plate),node('p','#'+v.id+' — '+(v.name||t('missing'))),node('p',t('openWorks')+': '+v.workGuides.length+' · '+t('activeGuides')+': '+v.transportGuides.length));b.type='button';b.disabled=blocked()||busy()||!!pending||!!target;b.addEventListener('click',()=>choose(v));card.append(b);$('guideList').append(card);}}
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
      const candidate = { version: 1, owner: actor.owner, vehicleId: proposal.vehicleId, requestId: review.requestId };
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
    try { accept(await request('/' + (cancel ? 'cancel' : 'result') + '/' + pending.requestId, job, cancel ? { method: 'POST', body: JSON.stringify({ vehicleId: pending.vehicleId }) } : {})); }
    catch (_) { if (current(job)) writeState = 'unknown'; }
    finally { finish(job); if (active() && !suspended) { render(); if (receipt) load(); } }
  }
  const url = new URL(location.href), lang = url.searchParams.get('lang'); if (Object.hasOwn(copy, lang)) language = lang;
  if (R.id(url.searchParams.get('vehicleId'))) { query.vehicleId = url.searchParams.get('vehicleId'); $('vehicleFilter').value = query.vehicleId; }
  try { actor = identity(); if (!actor) throw Error(); key = 'cw:transport-guide-create:v1:' + actor.owner; document.body.dataset.requiredRole = actor.role; } catch (_) { invalid = true; }
  $('workMode').addEventListener('change',configureWork);$('addItem').addEventListener('click',()=>{if(active()){addItem();render();}});
  for(const [dateId,choiceId]of [['validFrom','fromChoice'],['validUntil','untilChoice']])$(dateId).addEventListener('change',()=>{if(window.CWOnboardingRules.candidates($(dateId).value).length!==2)$(choiceId).value='';render();});
  $('consumeForm').addEventListener('submit', e => { e.preventDefault(); prepare(); }); $('confirm').addEventListener('change', render); $('save').addEventListener('click', () => send());
  $('backEdit').addEventListener('click', () => { if (active() && !busy() && !pending) { review = proposal = null; $('confirm').checked = false; writeState = 'editing'; render(); } });
  $('discard').addEventListener('click', () => { if (active() && !blocked() && !busy() && !pending) { clearFields(); target = review = proposal = null; writeState = 'idle'; render(); } });
  $('check').addEventListener('click', () => check()); $('retry').addEventListener('click', () => send(true)); $('cancel').addEventListener('click', () => check(true));
  $('next').addEventListener('click', () => { if (active() && !blocked() && !busy() && receipt && remember(null)) { pending = receipt = original = target = review = proposal = null; writeState = 'idle'; } render(); });
  $('filters').addEventListener('submit', e => { e.preventDefault(); const filter = { q: $('search').value.trim(), ...($('vehicleFilter').value.trim() ? { vehicleId: $('vehicleFilter').value.trim() } : {}) }; if (!R.query(filter)) { abort('list'); data = null; state = 'error'; render(); return; } query = filter; page = 1; load(); });
  $('clearSearch').addEventListener('click', () => { $('search').value = $('vehicleFilter').value = ''; query = { q: '' }; page = 1; load(); });
  $('refresh').addEventListener('click', load); $('previous').addEventListener('click', () => { page = Math.max(1, page - 1); load(); }); $('following').addEventListener('click', () => { page++; load(); });
  $('language').addEventListener('change', () => { language = $('language').value; const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url); render(); });
  window.addEventListener('storage', active); window.addEventListener('focus', active); document.addEventListener('visibilitychange', () => { if (!document.hidden) active(); });
  window.addEventListener('pagehide', () => { suspended = true; for (const k of Object.keys(jobs)) abort(k); clearFields(); review = proposal = original = receipt = data = target = null; state = 'loading'; writeState = pending ? 'unknown' : 'idle'; render(); });
  window.addEventListener('pageshow', () => { suspended = false; if (active()) { restore(); render(); load(); } });
  setInterval(() => { if (active() && review && !pending && Date.parse(review.expiresAt) <= Date.now()) { review = proposal = null; writeState = 'expired'; render(); } }, 1000);
  render(); active();
}());
