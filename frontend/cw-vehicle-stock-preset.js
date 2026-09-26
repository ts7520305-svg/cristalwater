(function () {
  'use strict';
  const R = window.CWVehicleStockPresetRules, copy = window.CWVehicleStockPresetCopy;
  const $ = id => document.getElementById(id), panel = $('presetManager'), jobs = {};
  const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
  let actor, invalid = false, suspended = false, storageBlocked = false, key = '', raw = null;
  let pending = null, original = null, receipt = null, review = null, proposal = null, target = null, data = null;
  let state = 'loading', writeState = 'idle', language = 'pt', page = 1, query = { q: '' };
  let selection=null;
  const t = k => copy[language][k] || k, node = (tag, text) => { const el = document.createElement(tag); el.textContent = text; return el; };
  const busy = () => !!jobs.write || !!jobs.review || !!jobs.detail, blocked = () => invalid || suspended || storageBlocked;
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
  function clearFields(){ $('consumeForm').reset();$('presetItems').replaceChildren();$('confirm').checked=false; }
  function active() {
    let current; try { current = identity(); } catch (_) { /* Unreadable aliases invalidate this page. */ }
    if (!invalid && actor && current?.fingerprint === actor.fingerprint && actor.expires > Date.now()) return true;
    if (!invalid || state !== 'session') {
      invalid = true; for (const k of Object.keys(jobs)) abort(k); clearFields();
      data = target = selection = review = proposal = original = pending = receipt = null; state = writeState = 'session'; render();
    }
    return false;
  }
  function start(kind) { abort(kind); const controller = new AbortController(), job = { kind, controller, timer: setTimeout(() => controller.abort(), 30000) }; jobs[kind] = job; return job; }
  const current = job => active() && !suspended && jobs[job.kind] === job;
  function finish(job) { clearTimeout(job.timer); if (jobs[job.kind] === job) delete jobs[job.kind]; }
  async function request(path, job, config = {}) {
    const res = await fetch('/api/vehicle-stock-preset' + path, { ...config, headers: { Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json' }, cache: 'no-store', redirect: 'error', signal: job.controller.signal });
    if (!current(job)) throw Error('stale');
    if ([401, 403].includes(res.status)) { invalid = true; active(); throw Error('session'); }
    const trusted = res.headers.get('x-cw-stock-preset') === 'vehicle-stock-preset-v1' && res.headers.get('x-cw-owner') === actor.owner && res.headers.get('cache-control') === 'private, no-store' && (res.headers.get('content-type') || '').startsWith('application/json');
    const value = await res.json();
    if (!current(job) || !trusted) throw Error('unconfirmed');
    if (res.status !== 200) throw Object.assign(Error('refused'), value?.ok === false && value.version === 1 && value.owner === actor.owner && typeof value.code === 'string' && value.code.startsWith('PRESET_') ? { status: res.status, code: value.code } : {});
    if (!R.base(value, actor.owner)) throw Error('unconfirmed');
    return value;
  }
  const display=v=>v===null||v===undefined?t('missing'):typeof v==='object'?JSON.stringify(v):String(v);
  function collect(){const mode=$('mode').value,edits=[],append=[];for(const row of $('presetItems').children){const existing=row.dataset.index!==undefined,action=existing?row.querySelector('[data-action]').value:'ADD',fields={};for(const key of R.fields){const value=row.querySelector('[data-field='+key+']');if(!existing||action==='CHANGE'&&value.value!==value.dataset.original)fields[key]=key==='quantity'?value.value.trim().replace(',','.'):key==='type'&&value.value===''?null:value.value;}if(existing)edits.push({index:Number(row.dataset.index),action,fields:action==='CHANGE'?fields:{}});else append.push(fields);}return R.input({vehicleId:selection?.id,mode,reason:$('notes').value,edits:mode==='EDIT'?edits:[],append:mode==='EMPTY'?[]:append});}
  function addRow(old=null,index=null){const card=node('article','');card.className='hub-card';if(index!==null)card.dataset.index=index;card.append(node('h4',index===null?t('newRow'):t('line')+' '+(index+1)));if(index!==null){const label=node('label',''),title=node('span',t('action')),select=node('select','');title.dataset.copy='action';select.dataset.action='';for(const action of ['KEEP','CHANGE','REMOVE']){const o=node('option',t(action));o.value=action;o.dataset.copy=action;select.append(o);}select.onchange=render;label.append(title,select);card.append(label);}for(const key of R.fields){const label=node('label',''),title=node('span',t(key)),input=node('input','');title.dataset.copy=key;input.dataset.field=key;input.maxLength=key==='name'?300:key==='unit'?30:key==='type'?100:24;input.autocomplete='off';if(key==='quantity')input.inputMode='decimal';input.value=old?.[key]===null||old?.[key]===undefined?'':String(old[key]);input.dataset.original=input.value;const shown=node('span',input.value);shown.dataset.exact=key;shown.className='exact-value';input.addEventListener('input',()=>shown.textContent=input.value);label.append(title,input,shown);card.append(label);}if(index===null){const button=node('button',t('removeNew'));button.type='button';button.dataset.copy='removeNew';button.onclick=()=>{if(active()&&!blocked()&&!busy()&&!review&&!pending){card.remove();render();}};card.append(button);}$('presetItems').append(card);}
  function drawRows(){ $('presetItems').replaceChildren();if($('mode').value==='EDIT')for(const [i,row]of (R.parse(target?.record?.value??null).items||[]).entries())addRow(row,i);if($('mode').value==='REPLACE')addRow(); }
  async function choose(row){if(!active()||blocked()||busy()||pending||selection)return;clearFields();selection=row.vehicle;await loadChoice();}
  async function loadChoice(){if(!active()||blocked()||busy()||pending||!selection)return;target=null;writeState='loading';const job=start('detail'),id=selection.id;render();try{const value=await request('/choice/'+id,job);if(!R.detailPacket(value,actor.owner,id))throw Error();target=value.choice;const parsed=R.parse(target.record?.value??null);$('mode').value=['VALID','EMPTY'].includes(parsed.state)?'EDIT':'REPLACE';drawRows();writeState='editing';}catch(e){if(current(job))writeState=e.code==='PRESET_VOLUME_REVIEW'?'volumeError':'detailError';}finally{finish(job);if(active()&&!suspended){render();$('writePanel').scrollIntoView({block:'start'});}}}
  function fact(dl, label, value) { const div = node('div', ''); div.append(node('dt', t(label)), node('dd', value === null || value === undefined || value === '' ? t('missing') : String(value))); dl.append(div); }
  const named = v => v ? '#' + v.id + ' — ' + v.name : t('none');
  const date = v => new Intl.DateTimeFormat({ pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' }[language], { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(v));
  function render(){
    panel.dataset.state=invalid?'session':state;panel.dataset.writeState=writeState;document.documentElement.lang=language;document.title='Cristal Water — '+t('title');
    for(const el of document.querySelectorAll('[data-copy]'))el.textContent=t(el.dataset.copy);$('language').value=language;$('returnLink').href=(invalid?'/login':'/admin-vehicles')+'?lang='+language;
    $('writePanel').hidden=!selection&&!pending&&!storageBlocked;$('writeStatus').textContent=t(writeState);$('targetIdentity').textContent=selection?'#'+selection.id+' — '+selection.plate:'';$('writeReference').textContent=pending?t('reference')+': '+pending.requestId:'';
    $('currentFacts').replaceChildren();const parsed=target?R.parse(target.record?.value??null):null;if(target){fact($('currentFacts'),'state',t(parsed.state));fact($('currentFacts'),'source',t(R.source(target)));fact($('currentFacts'),'openWorks',target.openWorks.map(w=>'#'+w.id).join(', ')||t('none'));fact($('currentFacts'),'activeGuides',target.activeGuides.map(g=>'#'+g.id).join(', ')||t('none'));fact($('currentFacts'),'lastGuide',target.lastGuide?'#'+target.lastGuide.id:t('none'));}
    $('rawDetails').hidden=!target?.record||blocked();$('rawRecord').textContent=target?.record?.value||'';
    $('reloadChoice').hidden=!selection||!!target||!!pending||blocked();$('reloadChoice').disabled=busy();
    $('consumeForm').hidden=!target||blocked()||!!review||!!pending;for(const el of $('consumeForm').elements)el.disabled=blocked()||busy()||!!review||!!pending;
    $('mode').querySelector('[value=EDIT]').disabled=!['VALID','EMPTY'].includes(parsed?.state);
    for(const row of $('presetItems').children){row.querySelector('h4').textContent=row.dataset.index===undefined?t('newRow'):t('line')+' '+(Number(row.dataset.index)+1);const locked=!!row.querySelector('[data-action]')&&row.querySelector('[data-action]').value!=='CHANGE';for(const input of row.querySelectorAll('[data-field]'))input.disabled=input.disabled||locked;}
    $('addItem').disabled=$('addItem').disabled||$('mode').value==='EMPTY'||[...$('presetItems').children].filter(r=>r.querySelector('[data-action]')?.value!=='REMOVE').length>=100;$('presetItems').hidden=$('mode').value==='EMPTY';$('modeHint').textContent=t($('mode').value+'Hint');
    $('reviewPanel').hidden=!review||blocked()||!!pending;$('reviewFacts').replaceChildren();$('reviewRows').replaceChildren();
    if(review){const dl=$('reviewFacts'),p=review.plan;fact(dl,'plate',review.choice.vehicle.plate);fact(dl,'mode',t(review.proposal.mode));fact(dl,'before',t(p.beforeState));fact(dl,'after',t(p.afterState));fact(dl,'source',t(p.sourceBefore));fact(dl,'openWorks',p.openWorkIds.map(id=>'#'+id).join(', ')||t('none'));fact(dl,'activeGuides',p.activeGuideIds.map(id=>'#'+id).join(', ')||t('none'));fact(dl,'notes',review.proposal.reason);for(const row of p.rows){const card=node('article',''),facts=node('div','');card.className='hub-card';card.append(node('h4',(row.index===null?t('newRow'):t('line')+' '+(row.index+1))+' · '+t(row.action)));for(const side of ['before','after']){const section=node('section','');section.append(node('h5',t(side)));if(row[side]){const dl=node('dl','');for(const field of R.fields)fact(dl,field,display(row[side][field]));section.append(dl);const extras=Object.fromEntries(Object.entries(row[side]).filter(([k])=>!R.fields.includes(k)));if(Object.keys(extras).length){const details=node('details',''),pre=node('pre',JSON.stringify(extras,null,2));details.append(node('summary',t('extra')),pre);section.append(details);}}else section.append(node('p',t('none')));facts.append(section);}card.append(facts);$('reviewRows').append(card);}}
    $('expiry').textContent=review?t('expires')+' '+date(review.expiresAt):'';$('save').disabled=blocked()||busy()||!review||!$('confirm').checked;$('confirm').disabled=busy();$('backEdit').disabled=busy();
    $('receiptFacts').replaceChildren();if(receipt){const dl=$('receiptFacts');fact(dl,'plate','#'+receipt.vehicleId);fact(dl,'confirmedAt',date(receipt.receipt.confirmedAt));fact(dl,'audit','#'+receipt.auditId);if(receipt.record){fact(dl,'record','#'+receipt.record.id);fact(dl,'after',t(receipt.plan.afterState));fact(dl,'count',receipt.plan.items.length);}}
    for(const id of ['check','retry','cancel'])$(id).hidden=!unresolved()||blocked()||id==='retry'&&!original;$('cancelHint').hidden=!unresolved()||blocked();$('next').hidden=!receipt||blocked();$('discard').hidden=!selection||!!pending||blocked();for(const id of ['check','retry','cancel','next','discard'])$(id).disabled=busy();
    $('listStatus').textContent=t(invalid?'session':state);$('count').textContent=data?t('total')+': '+data.total:'';$('page').textContent=data?t('page')+' '+data.page+' / '+Math.max(1,Math.ceil(data.total/25)):'';$('previous').disabled=blocked()||!data||data.page<=1;$('following').disabled=blocked()||!data||data.page*25>=data.total;$('refresh').disabled=invalid||suspended;for(const el of $('filters').elements)el.disabled=invalid||suspended;
    $('guideList').replaceChildren();if(data){if(!data.rows.length)$('guideList').append(node('p',t('empty')));for(const c of data.rows){const card=node('article',''),dl=node('dl',''),button=node('button',t('choose'));card.className='hub-card';card.dataset.vehicleId=c.vehicle.id;card.append(node('h3','#'+c.vehicle.id+' — '+c.vehicle.plate));fact(dl,'state',t(c.state));fact(dl,'count',c.count);button.type='button';button.disabled=blocked()||busy()||!!pending||!!selection;button.onclick=()=>choose(c);card.append(dl,button);$('guideList').append(card);}}
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
    catch (e) { if (current(job)) { review = proposal = null; writeState = e.code==='PRESET_VOLUME_REVIEW'?'volumeError':'reviewError'; } }
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
      const candidate = { version: 1, owner: actor.owner, vehicleId:proposal.vehicleId,requestId: review.requestId };
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
    try { accept(await request('/' + (cancel ? 'cancel' : 'result') + '/' + pending.requestId, job, cancel ? { method: 'POST', body: JSON.stringify({vehicleId:pending.vehicleId}) } : {})); }
    catch (_) { if (current(job)) writeState = 'unknown'; }
    finally { finish(job); if (active() && !suspended) { render(); if (receipt) load(); } }
  }
  const url = new URL(location.href), lang = url.searchParams.get('lang'); if (Object.hasOwn(copy, lang)) language = lang;
  if(R.id(url.searchParams.get('vehicleId'))){query.vehicleId=url.searchParams.get('vehicleId');$('vehicleIdFilter').value=query.vehicleId;}
  try { actor = identity(); if (!actor) throw Error(); key = 'cw:vehicle-stock-preset:v1:' + actor.owner; document.body.dataset.requiredRole = actor.role; } catch (_) { invalid = true; }
  $('mode').addEventListener('change',()=>{if(active()&&!blocked()&&!busy()&&!review&&!pending){drawRows();render();}});
  $('addItem').addEventListener('click',()=>{if(active()&&!blocked()&&!busy()&&!review&&!pending&&target&&$('mode').value!=='EMPTY'&&[...$('presetItems').children].filter(r=>r.querySelector('[data-action]')?.value!=='REMOVE').length<100){addRow();render();}});
  $('reloadChoice').addEventListener('click',loadChoice);
  $('consumeForm').addEventListener('submit', e => { e.preventDefault(); prepare(); }); $('confirm').addEventListener('change', render); $('save').addEventListener('click', () => send());
  $('backEdit').addEventListener('click', () => { if (active() && !busy() && !pending) { review = proposal = null; $('confirm').checked = false; writeState = 'editing'; render(); } });
  $('discard').addEventListener('click', () => { if (active() && !blocked() && !busy() && !pending) { clearFields(); target = selection = review = proposal = null; writeState = 'idle'; render(); } });
  $('check').addEventListener('click', () => check()); $('retry').addEventListener('click', () => send(true)); $('cancel').addEventListener('click', () => check(true));
  $('next').addEventListener('click', () => { if (active() && !blocked() && !busy() && receipt && remember(null)) { pending = receipt = original = target = selection = review = proposal = null; writeState = 'idle'; } render(); });
  $('filters').addEventListener('submit',e=>{e.preventDefault();const filter={q:$('search').value.trim()};if($('vehicleIdFilter').value.trim())filter.vehicleId=$('vehicleIdFilter').value.trim();if(!R.query(filter)){abort('list');data=null;state='error';render();return;}query=filter;page=1;load();});
  $('clearSearch').addEventListener('click',()=>{$('search').value=$('vehicleIdFilter').value='';query={q:''};page=1;load();});
  $('refresh').addEventListener('click', load); $('previous').addEventListener('click', () => { page = Math.max(1, page - 1); load(); }); $('following').addEventListener('click', () => { page++; load(); });
  $('language').addEventListener('change', () => { language = $('language').value; const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url); render(); });
  window.addEventListener('storage', active); window.addEventListener('focus', active); document.addEventListener('visibilitychange', () => { if (!document.hidden) active(); });
  window.addEventListener('pagehide', () => { suspended = true; for (const k of Object.keys(jobs)) abort(k); clearFields(); review = proposal = original = receipt = data = target = selection = null; state = 'loading'; writeState = pending ? 'unknown' : 'idle'; render(); });
  window.addEventListener('pageshow', () => { suspended = false; if (active()) { restore(); render(); load(); } });
  setInterval(() => { if (active() && review && !pending && Date.parse(review.expiresAt) <= Date.now()) { review = proposal = null; writeState = 'expired'; render(); } }, 1000);
  render(); active();
}());
