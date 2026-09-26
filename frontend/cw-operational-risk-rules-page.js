(function () {
  'use strict';
  const R = window.CWOperationalRiskRules, copy = window.CWOperationalRiskRulesCopy;
  const $ = id => document.getElementById(id), panel = $('riskRulesManager'), jobs = {};
  const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
  let actor, invalid = false, suspended = false, storageBlocked = false, key = '', raw = null;
  let pending = null, original = null, receipt = null, review = null, proposal = null, target = null, data = null;
  let state='loading',writeState='idle',language='pt';
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
  function clearFields(){ $('consumeForm').reset();$('ruleFields').replaceChildren();$('confirm').checked=false; }
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
    const res = await fetch('/api/operational-risk-rules' + path, { ...config, headers: { Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json' }, cache: 'no-store', redirect: 'error', signal: job.controller.signal });
    if (!current(job)) throw Error('stale');
    if ([401, 403].includes(res.status)) { invalid = true; active(); throw Error('session'); }
    const trusted = res.headers.get('x-cw-risk-rules') === 'operational-risk-rules-v1' && res.headers.get('x-cw-owner') === actor.owner && res.headers.get('cache-control') === 'private, no-store' && (res.headers.get('content-type') || '').startsWith('application/json');
    const value = await res.json();
    if (!current(job) || !trusted) throw Error('unconfirmed');
    if (res.status !== 200) throw Object.assign(Error('refused'), value?.ok === false && value.version === 1 && value.owner === actor.owner && typeof value.code === 'string' && value.code.startsWith('RISK_RULES_') ? { status: res.status, code: value.code } : {});
    if (!R.base(value, actor.owner)) throw Error('unconfirmed');
    return value;
  }
  const display=v=>v===null||v===undefined?t('missing'):typeof v==='boolean'?t(v?'on':'off'):typeof v==='object'?JSON.stringify(v):String(v);
  function fact(dl,label,value){const item=node('div','');item.append(node('dt',t(label)),node('dd',value===null||value===undefined?t('missing'):String(value)));dl.append(item);}
  const date=v=>new Intl.DateTimeFormat({pt:'pt-PT',en:'en-GB',fr:'fr-FR',es:'es-ES',de:'de-DE'}[language],{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Lisbon'}).format(new Date(v));
  function drawRows(){const parsed=R.parse(target?.record?.value??null);$('ruleFields').replaceChildren();for(const k of R.fields){const card=node('article',''),heading=node('h3',t(k)),facts=node('dl',''),operation=node('select',''),input=R.booleans.includes(k)?node('select',''):node('input','');card.className='hub-card';card.dataset.rule=k;heading.dataset.copy=k;facts.dataset.current=k;operation.dataset.op='';for(const op of ['KEEP','SET','DEFAULT']){const option=node('option',t(op));option.value=op;option.dataset.copy=op;operation.append(option);}operation.value=$('mode').value==='REPLACE'?'DEFAULT':'KEEP';operation.onchange=render;const opLabel=node('label',''),opTitle=node('span',t('operation'));opTitle.dataset.copy='operation';opLabel.append(opTitle,operation);input.dataset.value='';if(R.booleans.includes(k)){for(const [value,label]of [['true','on'],['false','off']]){const option=node('option',t(label));option.value=value;option.dataset.copy=label;input.append(option);}}else{input.inputMode='decimal';input.maxLength=24;input.autocomplete='off';}const old=parsed.stored&&Object.hasOwn(parsed.stored,k)?parsed.stored[k]:R.defaults[k];input.value=R.valid(k,old)?String(old):R.booleans.includes(k)?'true':'';const valueLabel=node('label',''),valueTitle=node('span',t('value'));valueTitle.dataset.copy='value';valueLabel.append(valueTitle,input);card.append(heading,facts,opLabel,valueLabel);$('ruleFields').append(card);}}
  function collect(){const fields={};for(const card of $('ruleFields').children){const k=card.dataset.rule,op=card.querySelector('[data-op]').value,v=card.querySelector('[data-value]').value;fields[k]=op==='SET'?{op,value:R.booleans.includes(k)?v==='true':v.trim().replace(',','.')}: {op};}return R.input({mode:$('mode').value,reason:$('notes').value,fields});}
  async function load(){if(!active()||suspended||blocked()||busy()||pending||review)return;target=null;state='loading';writeState='loading';clearFields();const job=start('detail');render();try{const value=await request('',job);if(!R.readPacket(value,actor.owner))throw Error();target=value.choice;$('mode').value=target.record&&!R.parse(target.record.value).stored?'REPLACE':'EDIT';drawRows();state='ready';writeState='editing';}catch(e){if(current(job)){state='error';writeState=e.code==='RISK_RULES_VOLUME_REVIEW'?'volumeError':'detailError';}}finally{finish(job);if(active()&&!suspended)render();}}
  function render(){panel.dataset.state=invalid?'session':state;panel.dataset.writeState=writeState;document.documentElement.lang=language;document.title='Cristal Water — '+t('title');for(const el of document.querySelectorAll('[data-copy]'))el.textContent=t(el.dataset.copy);$('language').value=language;$('returnLink').href=(invalid?'/login':'/admin-vehicles')+'?lang='+language;$('writeStatus').textContent=t(writeState);$('writeReference').textContent=pending?t('reference')+': '+pending.requestId:'';
   $('currentFacts').replaceChildren();const parsed=target?R.parse(target.record?.value??null):null;if(parsed){fact($('currentFacts'),'state',t(parsed.state));fact($('currentFacts'),'scope',t('global'));fact($('currentFacts'),'record',target.record?'#'+target.record.id:t('missing'));}
   $('rawDetails').hidden=!target?.record||blocked();$('rawRecord').textContent=target?.record?.value||'';$('consumeForm').hidden=!target||blocked()||!!review||!!pending;for(const el of $('consumeForm').elements)el.disabled=blocked()||busy()||!!review||!!pending;$('mode').querySelector('[value=EDIT]').disabled=!!target?.record&&!parsed?.stored;$('modeHint').textContent=t($('mode').value+'Hint');
   for(const card of $('ruleFields').children){const k=card.dataset.rule,op=card.querySelector('[data-op]'),input=card.querySelector('[data-value]'),facts=card.querySelector('[data-current]');op.querySelector('[value=KEEP]').disabled=$('mode').value==='REPLACE';input.disabled=input.disabled||op.value!=='SET';facts.replaceChildren();const exists=parsed?.stored&&Object.hasOwn(parsed.stored,k);fact(facts,'stored',exists?display(parsed.stored[k]):t('missing'));fact(facts,'effective',parsed?.rules?display(parsed.rules[k]):parsed?.invalidKeys.includes(k)||target?.record&&!parsed?.stored?t('invalidValue'):display(exists?parsed.stored[k]:R.defaults[k]));fact(facts,'default',display(R.defaults[k]));}
   $('reviewPanel').hidden=!review||blocked()||!!pending;$('reviewFacts').replaceChildren();$('reviewRows').replaceChildren();if(review){fact($('reviewFacts'),'scope',t('global'));fact($('reviewFacts'),'mode',t(review.proposal.mode));fact($('reviewFacts'),'before',t(review.plan.beforeState));fact($('reviewFacts'),'after',t(review.plan.afterState));fact($('reviewFacts'),'notes',review.proposal.reason);for(const row of review.plan.rows){const card=node('article',''),facts=node('dl','');card.className='hub-card';card.append(node('h3',t(row.key)));fact(facts,'operation',t(row.op));fact(facts,'stored',row.beforeStored?display(row.before):t('missing'));fact(facts,'before',display(row.beforeEffective));fact(facts,'after',display(row.afterEffective));fact(facts,'source',t(row.afterStored?'stored':'default'));card.append(facts);$('reviewRows').append(card);}}
   $('expiry').textContent=review?t('expires')+' '+date(review.expiresAt):'';$('save').disabled=blocked()||busy()||!review||!$('confirm').checked;$('confirm').disabled=busy();$('backEdit').disabled=busy();$('receiptFacts').replaceChildren();if(receipt){fact($('receiptFacts'),'confirmedAt',date(receipt.receipt.confirmedAt));fact($('receiptFacts'),'audit','#'+receipt.auditId);if(receipt.record){fact($('receiptFacts'),'record','#'+receipt.record.id);fact($('receiptFacts'),'after',t(receipt.plan.afterState));}}
   for(const id of ['check','retry','cancel'])$(id).hidden=!unresolved()||blocked()||id==='retry'&&!original;$('cancelHint').hidden=!unresolved()||blocked();$('next').hidden=!receipt||blocked();$('discard').hidden=!target||!!pending||blocked();for(const id of ['check','retry','cancel','next','discard'])$(id).disabled=busy();$('refresh').hidden=!!target||!!pending||blocked();$('refresh').disabled=busy();
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
    catch (e) { if (current(job)) { review = proposal = null; writeState = e.code==='RISK_RULES_VOLUME_REVIEW'?'volumeError':'reviewError'; } }
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
      const candidate = { version: 1, owner: actor.owner, resourceId:R.resourceId,requestId: review.requestId };
      if (!remember(candidate)) { render(); return; } pending = candidate;
      original = JSON.stringify({ proposal, requestId: review.requestId, reviewToken: review.reviewToken });
    }
    writeState = 'saving'; const job = start('write'); render();
    try { accept(await request('/commit', job, { method: 'POST', body: original })); }
    catch (e) { if (current(job)) writeState = e.status === 409 ? 'changed' : 'unknown'; }
    finally { finish(job); if (active() && !suspended) { render();  } }
  }
  async function check(cancel = false) {
    if (!active() || blocked() || busy() || !unresolved()) return; const job = start('write'); writeState = 'checking'; render();
    try { accept(await request('/' + (cancel ? 'cancel' : 'result') + '/' + pending.requestId, job, cancel ? { method: 'POST', body: JSON.stringify({resourceId:pending.resourceId}) } : {})); }
    catch (_) { if (current(job)) writeState = 'unknown'; }
    finally { finish(job); if (active() && !suspended) { render();  } }
  }
  const url=new URL(location.href),lang=url.searchParams.get('lang');if(Object.hasOwn(copy,lang))language=lang;
  try{actor=identity();if(!actor)throw Error();key='cw:operational-risk-rules:v1:'+actor.owner;document.body.dataset.requiredRole=actor.role;}catch(_){invalid=true;}
  $('mode').addEventListener('change',()=>{if(active()&&!blocked()&&!busy()&&!review&&!pending){drawRows();render();}});
  $('consumeForm').addEventListener('submit',e=>{e.preventDefault();prepare();});$('confirm').addEventListener('change',render);$('save').addEventListener('click',()=>send());
  $('backEdit').addEventListener('click',()=>{if(active()&&!busy()&&!pending){review=proposal=null;$('confirm').checked=false;writeState='editing';render();}});
  $('discard').addEventListener('click',()=>{if(active()&&!blocked()&&!busy()&&!pending){clearFields();target=review=proposal=null;load();}});
  $('check').addEventListener('click',()=>check());$('retry').addEventListener('click',()=>send(true));$('cancel').addEventListener('click',()=>check(true));
  $('next').addEventListener('click',()=>{if(active()&&!blocked()&&!busy()&&receipt&&remember(null)){pending=receipt=original=target=review=proposal=null;load();}render();});
  $('refresh').addEventListener('click',load);$('language').addEventListener('change',()=>{language=$('language').value;const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);render();});
  window.addEventListener('storage',active);window.addEventListener('focus',active);document.addEventListener('visibilitychange',()=>{if(!document.hidden)active();});
  window.addEventListener('pagehide',()=>{suspended=true;for(const k of Object.keys(jobs))abort(k);clearFields();review=proposal=original=receipt=data=target=null;state='loading';writeState=pending?'unknown':'idle';render();});
  window.addEventListener('pageshow',()=>{suspended=false;if(active()){restore();render();if(!pending)load();}});
  setInterval(()=>{if(active()&&review&&!pending&&Date.parse(review.expiresAt)<=Date.now()){review=proposal=null;writeState='expired';render();}},1000);
  render();active();
}());
