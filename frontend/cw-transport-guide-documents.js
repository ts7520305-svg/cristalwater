(function () {
  'use strict';
  const R = window.CWTransportDocumentsRules, copy = window.CWTransportDocumentsCopy;
  const $ = id => document.getElementById(id), panel = $('transportCreator'), jobs = {};
  const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
  let actor, invalid = false, suspended = false, storageBlocked = false, key = '', raw = null;
  let pending = null, original = null, receipt = null, review = null, proposal = null, target = null, data = null;
  let versions=null,historyPage=1,historyState='idle',reviewFile=null;
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
  function clearFields() { $('consumeForm').reset(); reviewFile=null; $('confirm').checked = false; }
  function active() {
    let current; try { current = identity(); } catch (_) { /* Unreadable aliases invalidate this page. */ }
    if (!invalid && actor && current?.fingerprint === actor.fingerprint && actor.expires > Date.now()) return true;
    if (!invalid || state !== 'session') {
      invalid = true; for (const k of Object.keys(jobs)) abort(k); clearFields();
      data = target = review = proposal = original = pending = receipt = versions = null; state = writeState = 'session'; render();
    }
    return false;
  }
  function start(kind) { abort(kind); const controller = new AbortController(), job = { kind, controller, timer: setTimeout(() => controller.abort(), 30000) }; jobs[kind] = job; return job; }
  const current = job => active() && !suspended && jobs[job.kind] === job;
  function finish(job) { clearTimeout(job.timer); if (jobs[job.kind] === job) delete jobs[job.kind]; }
  async function request(path, job, config = {}) {
    const res = await fetch('/api/transport-guide-documents' + path, { ...config, headers: { Authorization: 'Bearer ' + actor.token, ...(config.body instanceof FormData ? {} : {'Content-Type': 'application/json'}) }, cache: 'no-store', redirect: 'error', signal: job.controller.signal });
    if (!current(job)) throw Error('stale');
    if ([401, 403].includes(res.status)) { invalid = true; active(); throw Error('session'); }
    const trusted = res.headers.get('x-cw-transport') === 'transport-documents-v1' && res.headers.get('x-cw-owner') === actor.owner && res.headers.get('cache-control') === 'private, no-store' && (res.headers.get('content-type') || '').startsWith('application/json');
    const value = await res.json();
    if (!current(job) || !trusted) throw Error('unconfirmed');
    if (res.status !== 200) throw Object.assign(Error('refused'), value?.ok === false && value.version === 1 && value.owner === actor.owner && typeof value.code === 'string' && value.code.startsWith('TRANSPORT_') ? { status: res.status, code: value.code } : {});
    if (!R.base(value, actor.owner)) throw Error('unconfirmed');
    return value;
  }
  function formData(packet,file){const form=new FormData();form.append('payload',JSON.stringify(packet));form.append('document',file,file.name);return form;}
  async function collect(file){if(!file||!R.name(file.name)||!R.mime(file.name)||file.size<=0||file.size>R.maxFile)return null;const bytes=await file.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');return R.input({guideId:target?.id,reason:$('notes').value,file:{name:file.name,mimeType:R.mime(file.name),size:file.size,sha256:hash}});}
  function choose(guide) {
    if(!active()||blocked()||busy()||pending||target||!data||!R.choice(guide))return;
    target=guide;review=proposal=receipt=versions=null;clearFields();historyPage=1;writeState='editing';render();loadHistory();$('writePanel').scrollIntoView({block:'start'});$('notes').focus({preventScroll:true});
  }
  const versionUrl=(guide,id)=>'/api/transport-guide-documents/'+guide+'/files/'+id;
  function link(href,label){const el=node('a',label);el.href=href;el.dataset.authDownload='';el.target='_blank';el.rel='noopener';return el;}
  const fileSize=n=>new Intl.NumberFormat({pt:'pt-PT',en:'en-GB',fr:'fr-FR',es:'es-ES',de:'de-DE'}[language],{maximumFractionDigits:2}).format(n/1024)+' KB';
  function fileFacts(dl,file){fact(dl,'fileName',file.name||file.originalName);fact(dl,'fileType',file.mimeType);fact(dl,'fileSize',file.size===null?t('missing'):fileSize(file.size));}
  function fact(dl, label, value) { const div = node('div', ''); div.append(node('dt', t(label)), node('dd', value === null || value === undefined || value === '' ? t('missing') : String(value))); dl.append(div); }
  const date = v => new Intl.DateTimeFormat({ pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' }[language], { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(v));
  function render() {
    panel.dataset.state=invalid?'session':state;panel.dataset.writeState=writeState;document.documentElement.lang=language;document.title='Cristal Water — '+t('title');
    for(const el of document.querySelectorAll('[data-copy]'))el.textContent=t(el.dataset.copy);$('language').value=language;$('returnLink').href=(invalid?'/login':'/admin-vehicles')+'?lang='+language;
    $('writePanel').hidden=!target&&!pending&&!storageBlocked;$('writeStatus').textContent=t(writeState);$('targetIdentity').textContent=target?'#'+target.id+' — '+(target.codeAT||t('missing'))+' · '+(target.vehicle?.plate||t('missing')):'';$('writeReference').textContent=pending?t('reference')+': '+pending.requestId:'';
    $('consumeForm').hidden=!target||blocked()||!!review||!!pending;
    for(const el of $('consumeForm').elements)el.disabled=blocked()||busy()||!!review||!!pending||el.dataset.fixed==='true';
    $('selectedFile').textContent=$('document').files[0]?$('document').files[0].name+' · '+fileSize($('document').files[0].size):t('noFile');
    $('currentFacts').replaceChildren();const selected=receipt?.document?{kind:'VERSION',id:receipt.document.id,name:receipt.document.originalName,...receipt.document}:target?.current;
    if(selected){fact($('currentFacts'),'currentFile',selected.kind==='NONE'?t('none'):selected.name);if(selected.kind==='LEGACY')fact($('currentFacts'),'legacyState',t('legacy_'+selected.state));}
    $('reviewPanel').hidden=!review||blocked()||!!pending;$('reviewFacts').replaceChildren();$('reviewRows').replaceChildren();
    if(review){const p=review.proposal,c=review.choice,dl=$('reviewFacts');fact(dl,'plate',c.vehicle?.plate);fact(dl,'guide','#'+c.id+' — '+(c.codeAT||t('missing')));fact(dl,'notes',p.reason);fileFacts(dl,p.file);fact(dl,'currentFile',c.current.kind==='NONE'?t('none'):c.current.name);if(c.current.kind==='LEGACY')fact(dl,'legacyState',t('legacy_'+c.current.state));fact(dl,'previousSaved',t(c.current.kind==='LEGACY'&&!c.current.available?'metadataOnly':'preservedVersions'));}
    $('expiry').textContent=review?t('expires')+' '+date(review.expiresAt):'';$('save').disabled=blocked()||busy()||!review||!$('confirm').checked;$('confirm').disabled=busy();$('backEdit').disabled=busy();$('receiptFacts').replaceChildren();
    if(receipt){const dl=$('receiptFacts');fact(dl,'guide','#'+receipt.guideId);fact(dl,'confirmedAt',date(receipt.receipt.confirmedAt));fact(dl,'audit','#'+receipt.auditId);if(receipt.document){fileFacts(dl,receipt.document);fact(dl,'version','#'+receipt.document.id);const row=node('div','');row.append(link(versionUrl(receipt.guideId,receipt.document.id),t('openFile')));dl.append(row);}}
    for(const id of ['check','retry','cancel'])$(id).hidden=!unresolved()||blocked()||id==='retry'&&!original;$('cancelHint').hidden=!unresolved()||blocked();$('next').hidden=!receipt||blocked();$('discard').hidden=!target||!!pending||blocked();for(const id of ['check','retry','cancel','next','discard'])$(id).disabled=busy();
    $('listStatus').textContent=t(invalid?'session':state);$('count').textContent=data?t('total')+': '+data.total:'';$('page').textContent=data?t('page')+' '+data.page+' / '+Math.max(1,Math.ceil(data.total/25)):'';$('previous').disabled=blocked()||!data||data.page<=1;$('following').disabled=blocked()||!data||data.page*25>=data.total;$('refresh').disabled=invalid||suspended;for(const el of $('filters').elements)el.disabled=invalid||suspended;
    $('guideList').replaceChildren();if(data){if(!data.guides.length)$('guideList').append(node('p',t('empty')));for(const v of data.guides){const card=node('article',''),b=node('button',t('choose'));card.className='hub-card';card.dataset.guideId=v.id;card.append(node('h3','#'+v.id+' — '+(v.codeAT||t('missing'))),node('p',v.vehicle?.plate||t('missing')),node('p',t('currentFile')+': '+(v.current.name||t('none'))));if(!R.editable(v))card.append(node('p',t('unavailable')));b.type='button';b.disabled=blocked()||busy()||!!pending||!!target||!R.editable(v);b.addEventListener('click',()=>choose(v));card.append(b);$('guideList').append(card);}}
    const historyId=target?.id||receipt?.guideId;$('historyPanel').hidden=!historyId||blocked();$('historyStatus').textContent=t(historyState);$('historyPage').textContent=versions?t('page')+' '+versions.page+' / '+Math.max(1,Math.ceil(versions.total/25)):'';
    $('historyPrevious').disabled=!versions||versions.page<=1||!!jobs.history;$('historyFollowing').disabled=!versions||versions.page*25>=versions.total||!!jobs.history;$('historyRefresh').disabled=blocked()||!!jobs.history;
    $('versionList').replaceChildren();if(versions){if(!versions.versions.length)$('versionList').append(node('p',t('noVersions')));for(const v of versions.versions){const card=node('article',''),dl=node('dl','');card.className='hub-card';card.dataset.versionId=v.id;card.append(node('h3',t('version')+' #'+v.id+(selected?.id===v.id?' · '+t('currentFile'):'')));fileFacts(dl,v);fact(dl,'confirmedAt',date(v.createdAt));fact(dl,'actor',v.createdBy);fact(dl,'notes',v.reason);if(v.kind==='LEGACY')fact(dl,'legacyState',t(v.available?'archivedLegacy':'metadataOnly'));card.append(dl);if(v.available)card.append(link(versionUrl(historyId,v.id),t('openFile')));$('versionList').append(card);}}

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
    if(!active()||blocked()||busy()||pending||!target)return;const selected=$('document').files[0];review=null;reviewFile=null;$('confirm').checked=false;writeState='reviewing';const job=start('review');render();
    try{const candidate=await collect(selected);if(!current(job))return;if(!candidate){writeState='invalid';return;}proposal=candidate;const value=await request('/review',job,{method:'POST',body:formData(proposal,selected)});if(!R.reviewPacket(value,actor.owner,proposal))throw Error();review=value;reviewFile=selected;writeState='reviewed';}
    catch(_){if(current(job)){review=proposal=null;reviewFile=null;writeState='reviewError';}}
    finally{finish(job);if(active()&&!suspended)render();}
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
      original = { packet:{ proposal, requestId: review.requestId, reviewToken: review.reviewToken }, file:reviewFile };
    }
    writeState = 'saving'; const job = start('write'); render();
    try { accept(await request('/commit', job, { method: 'POST', body: formData(original.packet,original.file) })); }
    catch (e) { if (current(job)) writeState = e.status === 409 ? 'changed' : 'unknown'; }
    finally { finish(job); if (active() && !suspended) { render(); if (receipt) {load();loadHistory();} } }
  }
  async function check(cancel = false) {
    if (!active() || blocked() || busy() || !unresolved()) return; const job = start('write'); writeState = 'checking'; render();
    try { accept(await request('/' + (cancel ? 'cancel' : 'result') + '/' + pending.requestId, job, cancel ? { method: 'POST', body: JSON.stringify({ guideId: pending.guideId }) } : {})); }
    catch (_) { if (current(job)) writeState = 'unknown'; }
    finally { finish(job); if (active() && !suspended) { render(); if (receipt) {load();loadHistory();} } }
  }
  async function loadHistory(){
    if(!active()||suspended)return;const guideId=target?.id||receipt?.guideId;if(!guideId)return;const requested=historyPage;versions=null;historyState='loading';const job=start('history');render();
    try{const value=await request('/history/'+guideId+'?page='+requested,job);if(!R.historyPacket(value,actor.owner,guideId,requested))throw Error();if((target?.id||receipt?.guideId)!==guideId)return;versions=value;historyState='ready';}
    catch(_){if(current(job)){versions=null;historyState='error';}}
    finally{finish(job);if(active()&&!suspended)render();}
  }
  const url = new URL(location.href), lang = url.searchParams.get('lang'); if (Object.hasOwn(copy, lang)) language = lang;
  if (R.id(url.searchParams.get('guideId'))) { query.guideId = url.searchParams.get('guideId'); $('vehicleFilter').value = query.guideId; }
  try { actor = identity(); if (!actor) throw Error(); key = 'cw:transport-guide-documents:v1:' + actor.owner; document.body.dataset.requiredRole = actor.role; } catch (_) { invalid = true; }
  $('document').addEventListener('change',()=>{if(active())render();});
  $('historyRefresh').addEventListener('click',loadHistory);$('historyPrevious').addEventListener('click',()=>{historyPage=Math.max(1,historyPage-1);loadHistory();});$('historyFollowing').addEventListener('click',()=>{historyPage++;loadHistory();});
  panel.addEventListener('click',e=>{if(e.target.closest('[data-auth-download]')&&!active()){e.preventDefault();e.stopImmediatePropagation();}},true);
  $('consumeForm').addEventListener('submit', e => { e.preventDefault(); prepare(); }); $('confirm').addEventListener('change', render); $('save').addEventListener('click', () => send());
  $('backEdit').addEventListener('click', () => { if (active() && !busy() && !pending) { review = proposal = null; $('confirm').checked = false; writeState = 'editing'; render(); } });
  $('discard').addEventListener('click', () => { if (active() && !blocked() && !busy() && !pending) { abort('history');clearFields(); target = review = proposal = versions = null; writeState = 'idle'; render(); } });
  $('check').addEventListener('click', () => check()); $('retry').addEventListener('click', () => send(true)); $('cancel').addEventListener('click', () => check(true));
  $('next').addEventListener('click', () => { if (active() && !blocked() && !busy() && receipt && remember(null)) { abort('history');pending = receipt = original = target = review = proposal = versions = null; writeState = 'idle'; } render(); });
  $('filters').addEventListener('submit', e => { e.preventDefault(); const filter = { q: $('search').value.trim(), ...($('vehicleFilter').value.trim() ? { guideId: $('vehicleFilter').value.trim() } : {}) }; if (!R.query(filter)) { abort('list'); data = null; state = 'error'; render(); return; } query = filter; page = 1; load(); });
  $('clearSearch').addEventListener('click', () => { $('search').value = $('vehicleFilter').value = ''; query = { q: '' }; page = 1; load(); });
  $('refresh').addEventListener('click', load); $('previous').addEventListener('click', () => { page = Math.max(1, page - 1); load(); }); $('following').addEventListener('click', () => { page++; load(); });
  $('language').addEventListener('change', () => { language = $('language').value; const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url); render(); });
  window.addEventListener('storage', active); window.addEventListener('focus', active); document.addEventListener('visibilitychange', () => { if (!document.hidden) active(); });
  window.addEventListener('pagehide', () => { suspended = true; for (const k of Object.keys(jobs)) abort(k); clearFields(); review = proposal = original = receipt = data = target = versions = null; state = 'loading'; writeState = pending ? 'unknown' : 'idle'; render(); });
  window.addEventListener('pageshow', () => { suspended = false; if (active()) { restore(); render(); load(); } });
  setInterval(() => { if (active() && review && !pending && Date.parse(review.expiresAt) <= Date.now()) { review = proposal = null; writeState = 'expired'; render(); } }, 1000);
  render(); active();
}());
