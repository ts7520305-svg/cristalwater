(function () {
  'use strict';
  const el=id=>document.getElementById(id),timeMode=document.body.dataset.reviewType==='time',historyMode=document.body.dataset.reviewType==='history',resourceField=historyMode?'originReview':timeMode?'workTime':'materials',kind=historyMode?'history':timeMode?'time':'material',proof=historyMode?window.CWEquipmentHistoryRules:timeMode?window.CWEquipmentTimeReviewRules:window.CWEquipmentMaterialReviewRules;
  const itemFields=historyMode?[['technicianId','Técnico histórico confirmado',10],['evidence','Evidência histórica consultada',2000]]:timeMode?[['startAt','Início (UTC)',30],['endAt','Fim (UTC)',30]]:[['productName','Produto',160],['unit','Unidade',24],['quantity','Quantidade',30]],emptyItem=()=>Object.fromEntries(itemFields.map(([k])=>[k,''])),asInput=v=>!v?null:historyMode||timeMode?proof.asInput(v):{mode:v.mode,items:v.items};
  const keys = ['cristalwater_jwt','token','adminToken','cristalwater_user','user'];
  const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, canonical(v[k])])) : v;
  const hash = async v => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(v)))))].map(n => n.toString(16).padStart(2, '0')).join('');
  const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const check = (v, message = 'Os dados precisam de revisão.') => { if (!v) throw Error(message); };
  const identity = () => JSON.stringify(keys.map(k => localStorage.getItem(k)));
  const params = new URLSearchParams(location.search), completionId = Number(params.get('completionId')), expectedPool = params.has('poolId') ? Number(params.get('poolId')) : null;
  const states = historyMode?{MISSING:'Origem histórica por rever',ATTESTED:'Origem revista pela administração',REVIEW:'Origem ou histórico por rever',WITHDRAWN:'Declaração histórica anulada'}:timeMode?{MISSING:'Tempo próprio não registado',RECORDED:'Intervalos confirmados',REVIEW:'Tempo próprio por rever',WITHDRAWN:'Declaração anulada; tempo por confirmar'}:{ MISSING:'Materiais não registados',NONE:'Sem materiais, confirmado',DECLARED:'Aguarda consumos e fecho da visita',MATCHED:'Compatível com o consumo líquido da visita',REVIEW:'Materiais por rever',WITHDRAWN:'Declaração anulada; materiais por confirmar' };
  const controllers = new Set(); let principal, invalid = false, storageFailed = false, busy = false, loading = false, draftHydrated = false, db, pending, detail, reviewed, editEpoch = 0, readEpoch = 0;
  let draft = { action: 'DECLARED', items: [emptyItem()], reason:'' };
  const node = (parent, tag, text) => { const n = document.createElement(tag); n.textContent = text; parent.append(n); return n; };
  const status = text => { el('status').textContent = text; }, note = text => { el('writeStatus').textContent = text; };
  const date = at => new Date(at).toLocaleString('pt-PT'), money = cents => new Intl.NumberFormat('pt-PT', { style:'currency',currency:'EUR' }).format(cents / 100);
  function active() {
    if (!invalid && principal && principal.expires > Date.now() && principal.fingerprint === identity()) return true;
    if (!invalid) {
      invalid = true; editEpoch++; readEpoch++; for (const c of controllers) c.abort(); controllers.clear();
      detail = null; reviewed = null; pending = null; draft = { action:'DECLARED',items:[],reason:'' };
      for (const id of ['detailSection','editSection','historySection','pendingPanel','previewSection']) el(id).hidden = true;
      for (const id of ['title','origin','original','current','history','preview','pendingText','items','eligibility']) el(id).replaceChildren(); el('reason').value = ''; note('');
    }
    status('A sessão mudou. Reabra com a conta original para recuperar os pedidos guardados.'); controls(); return false;
  }
  function controls() {
    const blocked = invalid || busy || loading || !navigator.onLine;
    el('refresh').disabled = blocked;
    el('editSection').querySelectorAll('button,input,select,textarea').forEach(n => { n.disabled = blocked || !detail?.editable || !!pending || storageFailed || !db; });
    el('submit').disabled ||= !reviewed; el('addItem').disabled ||= draft.items.length >= 20;
    for (const id of ['checkPending','retryPending']) el(id).disabled = blocked || !pending || storageFailed || !db;
    el('pendingPanel').hidden = !pending || invalid;
    if (pending && !invalid) el('pendingText').textContent = 'Revisão #' + pending.completionId + '\n' + (pending.body.action === 'WITHDRAW' ? 'Anular declaração' : materialText(pending.body[resourceField])) + '\nMotivo: ' + pending.body.reason;
  }
  function materialText(record) { if(historyMode)return record?'Técnico histórico #'+(record.origin?.technicianId||record.technicianId)+(record.origin?' · Origem '+record.origin.visitType+' #'+record.origin.visitId:'')+'\nEvidência: '+record.evidence:'Sem declaração administrativa de origem. O registo técnico original permanece conservado.'; if(timeMode){if(!record)return 'Tempo próprio por confirmar.';const rows=proof.intervals(record);return Array.isArray(rows)?rows.map((w,i)=>'Intervalo '+(i+1)+': '+w?.startAt+' → '+w?.endAt+' (UTC)').join('\n')+'\n'+rows.reduce((n,w)=>n+(Date.parse(w?.endAt)-Date.parse(w?.startAt))/1000,0).toLocaleString('pt-PT',{maximumFractionDigits:3})+' segundos efetivos; pausas excluídas.':'Intervalos por rever.';} return !record ? 'Materiais por confirmar.' : record.mode === 'NONE' ? 'Sem materiais, por declaração explícita.' : record.items.map(i => i.productName + ' · ' + i.quantity + ' ' + i.unit).join('\n'); }
  function drawRecord(parent, record) { if(timeMode&&record?.schema===3)node(parent,'p','Declaração administrativa de tempos históricos, ligada à evidência de origem.'); if(!historyMode&&!timeMode&&record?.schema===2)node(parent,'p','Declaração administrativa de materiais históricos, ligada à evidência de origem.'); node(parent, 'pre', materialText(record)); }
  function clearPreview() { editEpoch++; reviewed = null; el('confirmed').checked = false; el('preview').replaceChildren(); el('previewSection').hidden = true; controls(); }
  const draftKey = () => 'cw-equipment-'+kind+'-draft:' + principal.owner + ':' + completionId;
  function validDraft(value) { return value && (timeMode||historyMode?['DECLARED','WITHDRAW']:['DECLARED','NONE','WITHDRAW']).includes(value.action) && Array.isArray(value.items) && value.items.length <= (historyMode?1:20) && (!historyMode||value.items.length===1) && typeof value.reason === 'string' && value.reason.length <= 500 && value.items.every(i => proof.fields(i,itemFields.map(([k])=>k)) && itemFields.every(([k,title,max]) => typeof i[k] === 'string' && i[k].length <= max)); }
  function saveDraft() { if (!active()) return; draftHydrated = true; try { sessionStorage.setItem(draftKey(), JSON.stringify(draft)); } catch (_) { storageFailed = true; note('Não foi possível conservar o rascunho neste navegador.'); controls(); } }
  function drawItems() {
    el('items').replaceChildren(); el('items').hidden = draft.action !== 'DECLARED'; el('addItem').hidden = historyMode || draft.action !== 'DECLARED'; el('withdrawNote').hidden = draft.action !== 'WITHDRAW';
    for (const [index, item] of draft.items.entries()) {
      const card = node(el('items'), 'article', ''), fields = node(card, 'div', ''); fields.className = 'item';
      for (const [key, title, max] of itemFields) {
        const label = node(fields, 'label', title), input = node(label, historyMode?(key==='technicianId'?'select':'textarea'):'input', ''); if(historyMode&&key==='technicianId'){node(input,'option','Escolha o técnico confirmado').value='';if(detail?.origin?.technicianId)node(input,'option',detail.technicianName+' (#'+detail.origin.technicianId+')').value=String(detail.origin.technicianId);}input.value = item[key]; input.maxLength = max; input.dataset[historyMode?'history':timeMode?'time':'material']=key;if(timeMode){input.type='datetime-local';input.step='0.001';} input.dataset.index = index; if (key === 'quantity') input.inputMode = 'decimal';
        input.oninput = () => { if (!active() || busy || pending) return; item[key] = input.value; clearPreview(); saveDraft(); };
      }
      if(historyMode)continue;
      const remove = node(card,'button',timeMode?'Remover intervalo':'Remover produto'); remove.type = 'button'; remove.className = 'secondary';
      remove.onclick = () => { if (!active() || busy || pending) return; draft.items.splice(index, 1); clearPreview(); saveDraft(); drawItems(); };
    }
    controls();
  }
  function payload() {
    if(historyMode)return {action:draft.action==='WITHDRAW'?'WITHDRAW':'REPLACE',originReview:draft.action==='WITHDRAW'?null:proof.input({technicianId:Number(draft.items[0]?.technicianId),evidence:draft.items[0]?.evidence.trim()})};
    if(timeMode)return {action:draft.action==='WITHDRAW'?'WITHDRAW':'REPLACE',workTime:draft.action==='WITHDRAW'?null:proof.input({intervals:draft.items.map(i=>({startAt:new Date(i.startAt+'Z').toISOString(),endAt:new Date(i.endAt+'Z').toISOString()}))})};
    return { action: draft.action === 'WITHDRAW' ? 'WITHDRAW' : 'REPLACE', materials: draft.action === 'WITHDRAW' ? null : proof.input({ mode: draft.action, items: draft.action === 'NONE' ? [] : draft.items.map(i => ({ ...i, quantity: i.quantity.trim().replace(',', '.') })) }) };
  }
  async function request(path, body) {
    const c = new AbortController(), timer = setTimeout(() => c.abort(), 40000); controllers.add(c);
    try {
      const response = await fetch('/api/equipment-maintenance' + path, { method: body ? 'POST' : 'GET', headers: { Authorization:'Bearer ' + principal.token, ...(body ? { 'Content-Type':'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache:'no-store',redirect:'error',signal:c.signal });
      check(active()); check((response.headers.get('content-type') || '').split(';')[0] === 'application/json', 'Resposta do servidor por confirmar.'); const value = await response.json(); check(active());
      if (response.status !== 200 || value?.ok !== true) throw Object.assign(Error(value?.error || 'Operação por confirmar.'), { status: response.status }); return value;
    } finally { clearTimeout(timer); controllers.delete(c); }
  }
  async function load() {
    if (!active()) return; const ticket = ++readEpoch; clearPreview(); detail = null; loading = true;
    for (const id of ['detailSection','editSection','historySection']) el(id).hidden = true;
    for (const id of ['original','current','history']) el(id).replaceChildren(); controls(); status('A consultar a revisão…');
    try {
      check(proof.positive(completionId) && (expectedPool === null || proof.positive(expectedPool)), 'Abra uma revisão a partir das manutenções de equipamento.');
      const value = (await request('/completions/'+completionId+'/'+(historyMode?'history':timeMode?'work-time':'materials'))).declaration;
      if (!active() || ticket !== readEpoch) return;
      check(value?.available, value?.message); check(value.completionId === completionId && proof.origin(value.origin) && (expectedPool === null || value.origin.poolId === expectedPool) && await hash(value.original) === value.originalHash && value.original.id === completionId && Array.isArray(value.history) && typeof value.editable === 'boolean' && typeof value.journalValid === 'boolean' && Object.hasOwn(states, value.current?.state));
      if(value.historicalOrigin){const proof=value.historicalOrigin.current||value.historicalOrigin.previous;check(proof);await window.CWEquipmentHistoryRules.revision(proof,hash);check(proof.revision.completionId===completionId&&proof.revision.preview.baseHash===value.originalHash);}
      if(historyMode)check(value.source?.id===completionId&&await hash(value.source)===value.sourceHash&&await hash(value.source.result)===value.original.resultHash);
      for (const event of value.history) { await proof.preview(event.revision?.preview, hash); check(await hash(event.revision) === event.hash && event.revision.completionId === completionId); }
      if (!active() || ticket !== readEpoch) return; detail = value;
      if (!draftHydrated) { const record = value.current.record; if(historyMode&&record){proof.record(record);draft={action:'DECLARED',items:[{technicianId:String(record.origin.technicianId),evidence:record.evidence}],reason:''};}else if(timeMode&&record){try{proof.record(record);draft={action:'DECLARED',items:proof.intervals(record).map(w=>({startAt:w.startAt.slice(0,-1),endAt:w.endAt.slice(0,-1)})),reason:''};}catch(_){draft={action:'DECLARED',items:[emptyItem()],reason:''};}}else if (record && ['NONE','DECLARED'].includes(record.mode) && Array.isArray(record.items)) draft = { action:record.mode,items:record.items.map(i => ({ ...i })),reason:'' }; draftHydrated = true; el('action').value = draft.action; drawItems(); }
      if(historyMode)drawItems();
      el('title').textContent = value.title; const o = value.origin;
      el('origin').textContent = 'Revisão #' + completionId + ' · ' + date(value.original.completedAt) + ' · Visita ' + (o.visitType === 'EXTRA' ? 'extra' : 'regular') + ' #' + o.visitId + ' · Cliente: ' + value.clientName + ' (#' + o.clientId + ') · Piscina: ' + value.poolName + ' (#' + o.poolId + ') · Técnico: ' + value.technicianName + ' (#' + o.technicianId + ')';
      el('back').href = '/admin-operational-settings?poolId=' + o.poolId + '&maintenanceKind=EQUIPMENT#equipmentMaintenancePanel';
      drawRecord(el('original'), value.original.record);if(historyMode){node(el('original'),'p','Identificador de autoria no original: '+value.source.actor+' · Pedido: '+value.source.requestId);node(el('original'),'pre',value.source.notes);node(el('original'),'p',value.technicalReceiptAvailable?'Existe um comprovativo técnico neste registo.':'Comprovativo técnico original indisponível. A autoria técnica não é presumida.');} node(el('current'), 'strong', states[value.current.state]); drawRecord(el('current'), value.current.record); el('eligibility').textContent = value.message;
      if(value.historicalOrigin){const p=(value.historicalOrigin.current||value.historicalOrigin.previous).revision;node(el('original'),'p','Origem revista por '+p.owner+' · '+date(p.createdAt));node(el('original'),'pre','Evidência: '+p.preview.proposed.record.evidence);const link=node(el('eligibility'),'a',' Consultar origem histórica');link.href='/equipment-history-review.html?completionId='+completionId+'&poolId='+o.poolId;}
      if(value.historicalReviewAvailable&&!value.historicalOrigin){const link=node(el('eligibility'),'a',' Rever primeiro a origem histórica');link.href='/equipment-history-review.html?completionId='+completionId+'&poolId='+o.poolId;}
      if(historyMode&&value.current.state==='ATTESTED'){const link=node(el('eligibility'),'a',' Declarar / rever materiais históricos');link.href='/equipment-material-review?completionId='+completionId+'&poolId='+o.poolId;const timeLink=node(el('eligibility'),'a',' Declarar / rever tempos históricos');timeLink.href='/equipment-time-review.html?completionId='+completionId+'&poolId='+o.poolId;}
      for (const event of [...value.history].reverse()) { const r = event.revision, article = node(el('history'), 'article', ''); node(article, 'h3', (r.preview.proposed.action === 'WITHDRAW' ? 'Declaração anulada' : 'Declaração corrigida') + ' · ' + date(r.createdAt)); node(article, 'p', r.owner + ' · ' + r.reason); drawRecord(article, r.preview.proposed.record); node(article, 'p', historyMode?'Declaração administrativa com evidência e data próprias; original conservado.':r.preview.affectedShares.length + (timeMode?' parcelas de trabalho assinaladas para revisão.':' parcelas de materiais assinaladas para revisão.')); }
      if (!value.history.length) node(el('history'), 'p', value.journalValid ? 'Ainda não há alterações administrativas.' : 'O histórico precisa de revisão.');
      el('detailSection').hidden = false; el('editSection').hidden = !value.editable; el('historySection').hidden = false; status(value.journalValid ? 'Revisão consultada. O original e o histórico estão disponíveis abaixo.' : 'Histórico por confirmar. Novas alterações estão bloqueadas.');
    } catch (error) { if (active() && ticket === readEpoch) status(error.message); }
    finally { if (ticket === readEpoch) { loading = false; controls(); } }
  }
  async function calculate() {
    if (!active() || busy || pending || !detail?.editable) return; clearPreview(); const ticket = editEpoch, read = readEpoch;
    try {
      const body = payload(), p = (await request('/completions/'+completionId+'/'+kind+'-preview', body)).preview;
      if (!active() || ticket !== editEpoch || read !== readEpoch) return;
      check(p?.available, p?.message); await proof.preview(p, hash);
      check(p.completionId === completionId && p.baseHash === detail.originalHash && equal(p.origin, detail.origin) && p.previous.headHash === (detail.history.at(-1)?.hash || null) && equal(p.previous.record, detail.current.record) && p.proposed.action === body.action && equal(asInput(p.proposed.record),body[resourceField]));
      if (!active() || ticket !== editEpoch || read !== readEpoch) return; reviewed = p;
      const box = el('preview'); node(box, 'h4', 'Declaração proposta'); drawRecord(box, p.proposed.record); node(box, 'p', states[p.afterState]);
      if (p.afterState === 'REVIEW') node(box, 'p', 'As quantidades ou os consumos precisam de conferência. Esta declaração ficará por rever e não permite confirmar novas parcelas de custo.');
      if(historyMode){node(box,'p','A declaração ficará atribuída à administração e à data da confirmação. Não recria um recibo técnico. Ao alterar ou anular esta origem, os materiais e tempos históricos e as suas parcelas de custo precisam de nova revisão.');el('previewSection').hidden=false;note('Confira a evidência e a origem; indique o motivo e confirme a revisão histórica.');return;}
      node(box, 'h4', 'Custos que precisarão de revisão');
      if (!p.affectedShares.length) node(box, 'p', timeMode?'Não há parcelas ativas de trabalho desta revisão.':'Não há parcelas ativas de materiais desta visita.');
      for (const s of p.affectedShares) { const line = node(box, 'p', 'Revisão #' + s.completionId + ' · ' + (timeMode?(s.durationMs/1000).toLocaleString('pt-PT',{maximumFractionDigits:3})+' segundos':s.quantity+' unidades') + ' · Parcela original ' + money(s.amountCents) + ' · '); const link = node(line, 'a', 'Abrir despesa #' + s.expenseId); link.href = '/admin-expenses?expenseId=' + s.expenseId + '&allocationId=' + s.allocationId; }
      node(box, 'p', timeMode?'As parcelas existentes conservam os valores e as reservas até à sua anulação explícita em Despesas. Confirme depois uma nova parcela com os tempos corrigidos. O original, os materiais, a visita e os pagamentos ficam conservados.':'As parcelas existentes conservam os valores e as reservas até à sua revisão ou anulação em Despesas. Esta alteração não movimenta stock nem altera os registos de trabalho, compras ou pagamentos.');
      el('previewSection').hidden = false; note('Confira a proposta, indique o motivo e confirme a alteração.');
    } catch (error) { if (active() && ticket === editEpoch) note(error.message); }
    finally { controls(); }
  }
  function access(mode, work) { return new Promise((resolve, reject) => { const tx = db.transaction('state', mode), q = work(tx.objectStore('state')); tx.oncomplete = () => resolve(q?.result); tx.onerror = tx.onabort = () => reject(tx.error || Error('Não foi possível guardar o pedido.')); }); }
  const readLocal = kind => access('readonly', s => s.get(principal.owner + ':' + kind));
  async function validPending(row) {
    check(row?.owner === principal.owner && proof.positive(row.completionId) && proof.uuid(row.body?.requestId) && row.hash === await hash({ owner:row.owner,completionId:row.completionId,body:row.body,preview:row.preview }));
    check(proof.fields(row.body, ['requestId','action',resourceField,'previewHash','reason','confirmed']) && row.body.confirmed === true && typeof row.body.reason === 'string' && row.body.reason.trim() === row.body.reason && row.body.reason.length >= 3 && row.body.reason.length <= 500);
    await proof.preview(row.preview, hash); check(row.preview.completionId === row.completionId && row.preview.hash === row.body.previewHash && row.body.action === row.preview.proposed.action && equal(row.body[resourceField],asInput(row.preview.proposed.record))); return row;
  }
  async function syncPending() { if (!db || !active() || busy) return; try { const row = await readLocal('pending'); if (row) await validPending(row); if (active()) pending = row || null; } catch (_) { storageFailed = true; note('O pedido guardado precisa de revisão. Novas confirmações estão bloqueadas.'); } controls(); }
  async function accept(result, row) {
    await proof.response(result, row.body, row.owner, row.completionId, hash); check(active());
    await new Promise((resolve, reject) => { const tx = db.transaction('state', 'readwrite'), s = tx.objectStore('state'), get = s.get(principal.owner + ':pending');
      get.onsuccess = () => { if (!active() || !equal(get.result, row)) { tx.abort(); return; } s.put({ record:row,result }, principal.owner + ':confirmed'); s.delete(principal.owner + ':pending'); }; tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(Error('O resultado não pôde ser conservado. Mantenha o pedido.')); });
    check(active()); pending = null;
    if (result.applied && row.completionId === completionId && draft.reason.trim() === row.body.reason) {
      let matched = false; try { matched = equal(payload(), {action:row.body.action,[resourceField]:row.body[resourceField]}); } catch (_) {}
      if (matched) { sessionStorage.removeItem(draftKey()); draft.reason = ''; el('reason').value = ''; }
    }
    note(result.applied ? (historyMode?'Revisão histórica confirmada. A evidência, o autor e a data ficaram conservados; o original mantém-se.':'Alteração confirmada. O original e as parcelas afetadas ficaram conservados no histórico.') : result.message + ' O resultado ficou guardado.'); await load();
  }
  async function execute(mode) {
    if (!active() || busy || storageFailed || !db || !navigator.onLine) return;
    const ticket = editEpoch, read = readEpoch; let prepared;
    if (mode === 'create') {
      if (!reviewed || pending || !el('confirmForm').reportValidity()) return;
      check(draft.reason.trim().length >= 3, 'Indique um motivo com pelo menos três caracteres.');
      prepared = { owner:principal.owner,completionId,body:{ requestId:crypto.randomUUID(),...payload(),previewHash:reviewed.hash,reason:draft.reason.trim(),confirmed:true },preview:reviewed };
    }
    busy = true; controls();
    try { await navigator.locks.request('cw-equipment-'+kind+'-review:' + principal.owner, { ifAvailable:true }, async lock => {
      check(lock, 'Existe uma confirmação noutra janela. Consulte novamente.'); check(active()); let stored = await readLocal('pending'); if (stored) await validPending(stored); check(active());
      if (mode === 'create') {
        if (stored) { pending = stored; throw Error('Existe um pedido por confirmar nesta conta.'); }
        check(ticket === editEpoch && read === readEpoch && reviewed === prepared.preview, 'A declaração mudou. Reveja a proposta.'); prepared.hash = await hash(prepared); await validPending(prepared); check(active() && ticket === editEpoch && read === readEpoch);
        await access('readwrite', s => s.add(prepared, principal.owner + ':pending')); stored = await readLocal('pending'); check(equal(stored, prepared), 'A gravação do pedido não ficou confirmada.');
      }
      check(active()); pending = stored || null; if (!stored) { await load(); note('Não existe pedido pendente nesta conta.'); return; } controls();
      const result = mode === 'check' ? await request('/'+kind+'-review-requests/' + stored.body.requestId) : await request('/completions/'+stored.completionId+'/'+kind+'-review', stored.body);
      await accept(result, stored);
    }); } catch (error) { if (active()) note(error.message + (pending ? ' O pedido original foi conservado; consulte o resultado ou reenvie-o.' : '')); }
    finally { busy = false; if (active()) controls(); }
  }
  el('refresh').onclick = load; el('calculate').onclick = calculate;
  el('action').onchange = () => { if (!active() || busy || pending) return; draft.action = el('action').value; clearPreview(); saveDraft(); drawItems(); };
  el('reason').oninput = () => { if (!active() || busy || pending) return; draft.reason = el('reason').value; el('confirmed').checked = false; saveDraft(); };
  el('addItem').onclick = () => { if (!active() || busy || pending || draft.items.length >= 20) return; draft.items.push(emptyItem()); clearPreview(); saveDraft(); drawItems(); };
  el('confirmForm').onsubmit = event => { event.preventDefault(); void execute('create').catch(error => { if (active()) note(error.message); }); };
  el('checkPending').onclick = () => execute('check'); el('retryPending').onclick = () => execute('retry');
  for (const event of ['storage','focus']) window.addEventListener(event, () => { if (active()) void syncPending(); });
  document.addEventListener('visibilitychange', active); window.addEventListener('offline', clearPreview); window.addEventListener('online', controls); window.addEventListener('popstate', () => location.reload());
  for (const method of ['setItem','removeItem','clear']) { const original = Storage.prototype[method]; Storage.prototype[method] = function (...args) { const value = Reflect.apply(original, this, args); if (this === localStorage && (method === 'clear' || keys.includes(String(args[0])))) active(); return value; }; }
  setInterval(() => { if (active()) controls(); }, 500);
  (async () => { try {
    const token = keys.slice(0,3).map(k => localStorage.getItem(k)).find(Boolean), claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0)))), user = Number(claims.userId || claims.id), users = keys.slice(3).map(k => localStorage.getItem(k)).filter(Boolean).map(JSON.parse);
    check(claims.role === 'ADMIN' && proof.positive(user) && users.length && users.every(u => u.role === 'ADMIN' && Number(u.userId || u.id) === user) && Number.isFinite(claims.exp) && claims.exp * 1000 > Date.now() && !keys.slice(0,3).some(k => localStorage.getItem(k) && localStorage.getItem(k) !== token));
    principal = { token,owner:'ADMIN:' + user,expires:claims.exp * 1000,fingerprint:identity() };
    try {
      check(navigator.locks && crypto.subtle && crypto.randomUUID); db = await new Promise((resolve, reject) => { const q = indexedDB.open('cw-equipment-'+kind+'-review-v1',1); q.onupgradeneeded = () => q.result.createObjectStore('state'); q.onsuccess = () => resolve(q.result); q.onerror = q.onblocked = () => reject(Error('Storage')); }); await syncPending();
      const last = await readLocal('confirmed'); if (last) { await validPending(last.record); await proof.response(last.result, last.record.body, last.record.owner, last.record.completionId, hash); if (active()) note('Último resultado guardado: ' + (last.result.applied ? 'alteração confirmada.' : 'pedido não aplicado.')); }
    } catch (_) { storageFailed = true; note('Não foi possível verificar os pedidos guardados. Pode consultar; novas confirmações estão bloqueadas.'); }
    if (!active()) return; const saved = sessionStorage.getItem(draftKey()); if (saved) { const value = JSON.parse(saved); check(validDraft(value), 'O rascunho guardado precisa de revisão.'); draft = value; draftHydrated = true; }
    el('action').value = draft.action; el('reason').value = draft.reason; el('confirmed').checked = false; drawItems(); await load();
  } catch (error) { if (!principal) active(); else if (active()) { storageFailed = true; status(error.message); } } finally { controls(); } })();
})();
