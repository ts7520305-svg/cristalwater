(() => {
 'use strict';
 const el = id => document.getElementById(id), keys = ['cristalwater_jwt','token','adminToken','cristalwater_user','user'];
 const scope = 'REPAIR_WORK_INTERVAL', basis = 'EXPLICIT_AUTHENTICATED_REPAIR_WORK_INTERVAL', repairId = Number(new URLSearchParams(location.search).get('repairId'));
 const positive = v => Number.isSafeInteger(v) && v > 0 && v <= 2147483647, count = v => Number.isSafeInteger(v) && v >= 0;
 const sha = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v), uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
 const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k,canonical(v[k])])) : v;
 const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
 const hash = async v => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(v)))))].map(v => v.toString(16).padStart(2,'0')).join('');
 const iso = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v && Date.parse(v) <= Date.now();
 const second = v => iso(v) && v.endsWith('.000Z'), reason = v => typeof v === 'string' && v === v.trim() && v.length >= 5 && v.length <= 1000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
 const identity = () => JSON.stringify(keys.map(k => localStorage.getItem(k))), fields = ['workTechnician','workStart','workEnd','workReason'];
 const duration = seconds => Math.floor(seconds / 3600) + ' h ' + Math.floor(seconds % 3600 / 60) + ' min ' + seconds % 60 + ' s';
 const period = row => row.startedAt.replace('T',' ').replace('.000Z',' UTC') + ' → ' + row.endedAt.replace('T',' ').replace('.000Z',' UTC');
 const node = (parent,tag,text) => { const n=document.createElement(tag); n.textContent=text; parent.append(n); return n; };
 const raw = row => Object.fromEntries(Object.entries(row).filter(([k]) => !['recordHash','state','reviewReasons','canVoid'].includes(k)));
 let principal, invalid = false, db, storageFailed = false, pending = null, writing = false, epoch = 0, detail = null, selected = null, draftLoaded = false;
 const controllers = new Set(), note = text => { el('workWriteStatus').textContent=text; }, state = (kind,text) => { el('workStatus').dataset.state=kind; el('workStatus').textContent=text; };
 function clearVoid() { selected=null; el('workVoidPanel').hidden=true; el('workVoidForm').reset(); el('workVoidPreview').textContent=''; }
 function clear() { epoch++; for(const c of controllers)c.abort(); controllers.clear(); detail=null; clearVoid(); el('workEntry').hidden=true; el('workForm').reset(); for(const id of ['workFacts','workSummary','workRows','workWindow','workTechnician'])el(id).replaceChildren(); el('workDuration').textContent='Indique o início e o fim.'; }
 function active() {
  if(!invalid && principal && principal.fingerprint===identity() && principal.expires>Date.now())return true;
  if(!invalid){invalid=true;clear();el('workPendingPreview').textContent='';note('');}
  state('session','Entre com a conta original de administração ou técnico para recuperar os pedidos guardados.'); controls(); return false;
 }
 function controls() {
  const disabled=invalid||writing||!navigator.onLine, locked=disabled||storageFailed||!db||!!pending;
  el('workRefresh').disabled=disabled;
  for(const id of [...fields,'workConfirmed','workRecord'])el(id).disabled=locked||!detail?.canRegister;
  for(const id of ['workVoidReason','workVoidConfirmed','workVoid'])el(id).disabled=locked||!selected;
  el('workVoidCancel').disabled=disabled;
  for(const id of ['workCheck','workRetry'])el(id).disabled=disabled||storageFailed||!db||!pending;
  el('workPending').hidden=invalid||!pending;
  document.querySelectorAll('[data-work-void]').forEach(n=>n.disabled=locked);
  if(pending&&!invalid){const d=pending.payload.data;el('workPendingPreview').textContent='Reparação #'+pending.repairId+' · '+(pending.payload.command==='RECORD'?'Registar técnico #'+d.technicianId+' · '+period(d):'Anular intervalo #'+d.intervalId)+' · '+d.reason;}
 }
 async function request(id,path='',options={}) {
  const c=new AbortController();controllers.add(c);const timer=setTimeout(()=>c.abort(),25000);
  try{const response=await fetch('/api/repairs/'+id+'/work'+path,{...options,headers:{Authorization:'Bearer '+principal.token,...options.headers},cache:'no-store',redirect:'error',signal:c.signal});
   if(!active())throw Error('Sessão alterada.');if((response.headers.get('content-type')||'').split(';')[0]!=='application/json')throw Error('Resposta não confirmada.');
   const result=await response.json();if(!active())throw Error('Sessão alterada.');if(response.status!==200||result?.ok!==true)throw Error(result?.message||'Operação não confirmada.');return result;
  }finally{clearTimeout(timer);controllers.delete(c);}
 }
 async function validateSource(s,id) {
  if(!s||!sha(s.hash)||!iso(s.earliestStartAt)||!iso(s.latestEndAt)||Date.parse(s.earliestStartAt)>Date.parse(s.latestEndAt))throw Error('Datas da execução não confirmadas.');
  const f=s.facts;
  if(!f||f.type!=='REPAIR'||f.id!==id||!positive(f.clientId)||!positive(f.poolId)||f.status!=='CONFIRMED'||f.startAt!==null||f.endAt!==s.latestEndAt||f.executionBasis!=='EXPLICIT_AUTHENTICATED_REPAIR_COMPLETION'||!positive(f.executionProofId)||!sha(f.executionFingerprint)||!['NONE','RESERVED'].includes(f.materialMode)||await hash(f)!==s.hash)throw Error('A origem não corresponde à execução da reparação.');
 }
 async function validateInterval(r, requireProof = true) {
  if(!r||!['id','repairId','clientId','poolId','technicianId','durationSeconds'].every(k=>positive(r[k]))||typeof r.technicianName!=='string'||!second(r.startedAt)||!second(r.endedAt)||(Date.parse(r.endedAt)-Date.parse(r.startedAt))/1000!==r.durationSeconds||!sha(r.sourceHash)||!sha(r.fingerprint)||!reason(r.reason)||!iso(r.createdAt)||typeof r.createdBy!=='string'||!r.snapshot||typeof r.snapshot!=='object')throw Error('Intervalo recebido inválido.');
  if(r.voidedAt===null){if(r.voidedBy!==null||r.voidReason!==null||!sha(r.activeKey))throw Error('Estado do intervalo inválido.');}
  else if(!iso(r.voidedAt)||r.activeKey!==null||typeof r.voidedBy!=='string'||!reason(r.voidReason))throw Error('Anulação recebida inválida.');
  if(requireProof){
   const s=r.snapshot;
   const expected={version:1,basis,...Object.fromEntries(['repairId','clientId','poolId','technicianId','technicianName','startedAt','endedAt','durationSeconds','sourceHash'].map(k=>[k,r[k]])),source:s.source,repairCreatedAt:s.repairCreatedAt,reason:r.reason,createdBy:r.createdBy,createdAt:r.createdAt};
   if(!equal(s,expected)||await hash(s)!==r.fingerprint)throw Error('A prova do intervalo não está confirmada.');
   await validateSource({hash:r.sourceHash,facts:s.source,earliestStartAt:s.repairCreatedAt,latestEndAt:s.source?.endAt},r.repairId);
   if(Date.parse(r.startedAt)<Date.parse(s.repairCreatedAt)||Date.parse(r.endedAt)>Date.parse(s.source.endAt))throw Error('O intervalo não corresponde às datas da reparação.');
  }
 }
 async function validateDetail(v) {
  if(!v||v.version!==1||v.basis!==basis||v.repairId!==repairId||!sha(v.contextVersion)||typeof v.problem!=='string'||!(v.poolName===null||typeof v.poolName==='string')||typeof v.canRegister!=='boolean'||!Array.isArray(v.technicians)||!Array.isArray(v.rows)||typeof v.message!=='string'||v.visibility!==(principal.role==='ADMIN'?'ALL_REPAIR_TECHNICIANS':'OWN_TECHNICIAN'))throw Error('Contexto de trabalho não confirmado.');
  if(new Set(v.technicians.map(t=>t.id)).size!==v.technicians.length||v.technicians.some(t=>!positive(t.id)||typeof t.name!=='string'||typeof t.active!=='boolean'||principal.role!=='ADMIN'&&t.id!==principal.technicianId))throw Error('Técnicos não confirmados.');
  if(v.source?.hash!==null)await validateSource(v.source,repairId);
  else if(v.source?.facts!==null||v.source.latestEndAt!==null||v.canRegister)throw Error('Origem de trabalho não confirmada.');
  if(v.canRegister!==!!(v.source.hash&&v.technicians.length))throw Error('Permissão de registo não confirmada.');
  const ids=new Set(),sum={unit:'PERSON_SECOND',count:v.rows.length,confirmedCount:0,reviewCount:0,voidedCount:0,totalSeconds:0};
  for(const r of v.rows){
   if(ids.has(r.id)||r.repairId!==repairId||principal.role!=='ADMIN'&&r.technicianId!==principal.technicianId||!['CONFIRMED','REVIEW','VOIDED'].includes(r.state)||!Array.isArray(r.reviewReasons)||r.reviewReasons.some(x=>!['INTERVAL_EVIDENCE_CHANGED','EXECUTION_EVIDENCE_CHANGED','TECHNICIAN_MISSING','RECORDED_TIME_OVERLAP'].includes(x))||r.canVoid!==(r.voidedAt===null)||await hash(raw(r))!==r.recordHash)throw Error('Histórico de intervalos não confirmado.');
   ids.add(r.id);await validateInterval(r,r.state==='CONFIRMED');
   if(r.state==='VOIDED'){if(r.voidedAt===null)throw Error('Anulação não confirmada.');sum.voidedCount++;}
   else {if(r.voidedAt!==null)throw Error('Estado de intervalo inválido.');if(r.state==='CONFIRMED'){if(r.reviewReasons.length||r.sourceHash!==v.source.hash||!v.technicians.some(t=>t.id===r.technicianId))throw Error('A confirmação não corresponde à origem atual.');sum.confirmedCount++;sum.totalSeconds+=r.durationSeconds;}else{if(!r.reviewReasons.length)throw Error('Motivo de revisão em falta.');sum.reviewCount++;}}
  }
  if(!equal(sum,v.summary)||!count(sum.totalSeconds))throw Error('Totais dos tempos não confirmados.');
 }
 function inputDate(id) { const s=el(id).value; if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(s))throw Error('Indique o início e o fim em UTC.'); const value=s+(s.length===16?':00':'')+'.000Z';if(!second(value))throw Error('Indique horários passados válidos em UTC.');return value; }
 function formData() { const data={technicianId:Number(el('workTechnician').value),startedAt:inputDate('workStart'),endedAt:inputDate('workEnd'),reason:el('workReason').value.trim(),confirmed:true};if(!positive(data.technicianId)||!positive((Date.parse(data.endedAt)-Date.parse(data.startedAt))/1000)||!reason(data.reason))throw Error('Reveja o técnico, as datas e a justificação.');return data; }
 function updateDuration() { try{const seconds=(Date.parse(inputDate('workEnd'))-Date.parse(inputDate('workStart')))/1000;el('workDuration').textContent=positive(seconds)?'Duração declarada: '+duration(seconds):'O fim tem de ser posterior ao início.';}catch{el('workDuration').textContent='Indique o início e o fim em UTC.';} }
 const draftKey = () => 'cw-repair-work-draft:'+principal.owner+':'+repairId;
 function saveDraft() { if(!active()||!detail||writing)return;el('workConfirmed').checked=false;updateDuration();try{sessionStorage.setItem(draftKey(),JSON.stringify(Object.fromEntries(fields.map(id=>[id,el(id).value]))));}catch{note('O rascunho não pôde ser guardado. Preserve os horários e a justificação.');} }
 function restoreDraft() { if(draftLoaded)return;draftLoaded=true;try{const saved=JSON.parse(sessionStorage.getItem(draftKey()));for(const id of fields)if(typeof saved?.[id]==='string')el(id).value=saved[id];}catch{}el('workConfirmed').checked=false;updateDuration(); }
 async function load() {
  if(!active()||writing||!navigator.onLine)return;clear();const rev=epoch;state('loading','A consultar a execução e os tempos…');controls();
  try{await syncPending();const result=await request(repairId);if(!active()||rev!==epoch)return;const v=result.detail;await validateDetail(v);if(!active()||rev!==epoch)return;detail=v;
   node(el('workFacts'),'h2','Reparação #'+repairId+' · '+v.problem);if(v.poolName!==null)node(el('workFacts'),'p',v.poolName);node(el('workFacts'),'p',v.message);
   if(v.canRegister){node(el('workTechnician'),'option','Escolha o técnico').value='';for(const t of v.technicians)node(el('workTechnician'),'option',t.name+' · #'+t.id+(t.active?'':' · Histórico inativo')).value=String(t.id);if(v.technicians.length===1)el('workTechnician').value=String(v.technicians[0].id);el('workWindow').textContent='Entre '+v.source.earliestStartAt.replace('T',' ')+' e '+v.source.latestEndAt.replace('T',' ')+' (UTC).';el('workEntry').hidden=false;restoreDraft();}
   for(const r of v.rows){const card=node(el('workRows'),'article','');card.dataset.intervalId=String(r.id);node(card,'h3',r.technicianName+' · '+duration(r.durationSeconds));node(card,'p',period(r));node(card,'p',(r.state==='CONFIRMED'?'Confirmado':r.state==='VOIDED'?'Anulado':'Por rever')+' · '+r.reason);if(r.state==='REVIEW')node(card,'p','Reveja a execução, a prova e possíveis sobreposições. A duração está excluída do total confirmado.');if(r.voidedAt)node(card,'p','Motivo da anulação: '+r.voidReason);
    if(r.canVoid){const b=node(card,'button','Rever anulação #'+r.id);b.type='button';b.dataset.workVoid='';b.onclick=()=>{if(!active()||pending||writing)return;clearVoid();selected=r;el('workVoidPreview').textContent=r.technicianName+' · '+period(r)+' · '+duration(r.durationSeconds);el('workVoidPanel').hidden=false;controls();el('workVoidPanel').scrollIntoView();};}}
   const s=v.summary;el('workSummary').textContent=(v.visibility==='OWN_TECHNICIAN'?'Os seus intervalos: ':'Intervalos apresentados: ')+s.count+' · Confirmados: '+s.confirmedCount+' · Por rever: '+s.reviewCount+' · Anulados: '+s.voidedCount+' · Tempo de técnicos confirmado: '+duration(s.totalSeconds);
   state('ready',v.canRegister?'Consulte o histórico e confirme cada intervalo de trabalho.':v.message);
  }catch(e){if(active()&&rev===epoch){clear();state('error',e.message);}}finally{controls();}
 }
 function access(mode,operation) { return new Promise((resolve,reject)=>{const tx=db.transaction('state',mode),r=operation(tx.objectStore('state'));tx.oncomplete=()=>resolve(r?.result);tx.onerror=tx.onabort=()=>reject(Error('O pedido não pôde ser guardado. Preserve os dados.'));}); }
 const readLocal = kind => access('readonly',s=>s.get(principal.owner+':'+kind));
 const payloadHash = r => hash({v:1,scope,resourceId:r.repairId,payload:r.payload});
 async function validPending(r) {
  if(!r||r.owner!==principal.owner||!positive(r.repairId)||!uuid(r.requestId)||!iso(r.createdAt)||!r.payload||!equal(Object.keys(r.payload).sort(),['command','data','expectedVersion'])||!sha(r.payload.expectedVersion)||r.payloadHash!==await payloadHash(r)||!r.review||r.reviewHash!==await hash(r.review))return false;
  const {command,data:d}=r.payload;if(d?.confirmed!==true||!reason(d.reason))return false;
  if(command==='RECORD'){
   if(!equal(Object.keys(d).sort(),['confirmed','endedAt','reason','startedAt','technicianId'])||!positive(d.technicianId)||principal.role!=='ADMIN'&&d.technicianId!==principal.technicianId||!second(d.startedAt)||!second(d.endedAt)||!positive((Date.parse(d.endedAt)-Date.parse(d.startedAt))/1000)||r.review.technician?.id!==d.technicianId||typeof r.review.technician.name!=='string')return false;
   await validateSource(r.review.source,r.repairId);return Date.parse(d.startedAt)>=Date.parse(r.review.source.earliestStartAt)&&Date.parse(d.endedAt)<=Date.parse(r.review.source.latestEndAt);
  }
  if(command!=='VOID'||!equal(Object.keys(d).sort(),['confirmed','intervalId','reason','recordHash'])||!positive(d.intervalId)||!sha(d.recordHash)||r.review.before?.id!==d.intervalId||r.review.before.repairId!==r.repairId||principal.role!=='ADMIN'&&r.review.before.technicianId!==principal.technicianId)return false;
  return r.review.before.voidedAt===null&&await hash(r.review.before)===d.recordHash;
 }
 async function syncPending() {
  if(!db||!active()||writing)return;try{const r=await readLocal('pending');if(!active())return;if(r&&!await validPending(r))throw Error('Pedido inválido');if(!active())return;pending=r||null;}
  catch{storageFailed=true;note('Não foi possível verificar o pedido guardado. Pode consultar; novos registos estão bloqueados.');}controls();
 }
 async function validateReceipt(result,r) {
  const receipt=result?.receipt,d=r.payload.data;
  if(result?.ok!==true||!receipt||receipt.owner!==r.owner||receipt.requestId!==r.requestId||receipt.scope!==scope||receipt.resourceId!==r.repairId||receipt.payloadHash!==r.payloadHash||!iso(receipt.confirmedAt)||!equal(result.context,r.payload)||typeof result.applied!=='boolean')throw Error('O resultado não corresponde ao pedido guardado.');
  if(!result.applied){if(!['REPAIR_WORK_CHANGED','WORK_TIME_CONFLICT'].includes(result.code)||typeof result.message!=='string'||!result.message)throw Error('Recusa não confirmada.');return;}
  const row=result.interval;if(!row||row.repairId!==r.repairId||await hash(row)!==result.recordHash)throw Error('O registo confirmado não corresponde à reparação.');
  await validateInterval(row,r.payload.command==='RECORD');
  if(r.payload.command==='RECORD'){
   if(!['technicianId','startedAt','endedAt','reason'].every(k=>row[k]===d[k])||row.voidedAt!==null||row.createdBy!==r.owner||row.technicianName!==r.review.technician.name||row.sourceHash!==r.review.source.hash||!equal(row.snapshot.source,r.review.source.facts)||row.snapshot.repairCreatedAt!==r.review.source.earliestStartAt)throw Error('O técnico, o intervalo ou a execução não correspondem à confirmação revista.');
  }else{
   const expected={...r.review.before,activeKey:null,voidedAt:row.voidedAt,voidedBy:r.owner,voidReason:d.reason};
   if(!iso(row.voidedAt)||!equal(row,expected))throw Error('A anulação não conserva o intervalo original.');
  }
 }
 async function accept(result,r) {
  await validateReceipt(result,r);if(!active())return;
  await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'),s=tx.objectStore('state'),get=s.get(principal.owner+':pending');get.onsuccess=()=>{if(!active()||!equal(get.result,r)){tx.abort();return;}s.put({record:r,result},principal.owner+':confirmed');s.delete(principal.owner+':pending');};tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(Error('Não foi possível guardar o resultado. Consulte o mesmo pedido.'));});
  if(active()){pending=null;if(result.applied&&r.payload.command==='RECORD'){try{sessionStorage.removeItem('cw-repair-work-draft:'+principal.owner+':'+r.repairId);}catch{}}note(result.applied?(r.payload.command==='RECORD'?'Intervalo confirmado e resultado guardado.':'Anulação confirmada; o histórico foi preservado.'):result.message+' A recusa ficou guardada.');}
 }
 async function execute(action='RECORD') {
  if(!active()||writing||storageFailed||!db||!navigator.onLine||['RECORD','VOID'].includes(action)&&(!detail||pending||action==='RECORD'&&(!detail.canRegister||!el('workConfirmed').checked)||action==='VOID'&&(!selected||!el('workVoidConfirmed').checked)))return;
  const view=detail,before=selected,rev=epoch;let payload,review;
  try{if(action==='RECORD'){payload={command:action,expectedVersion:view.contextVersion,data:formData()};review={source:view.source,technician:view.technicians.find(t=>t.id===payload.data.technicianId)};}if(action==='VOID'){const why=el('workVoidReason').value.trim();if(!reason(why))throw Error('Justifique a anulação.');payload={command:action,expectedVersion:view.contextVersion,data:{intervalId:before.id,recordHash:before.recordHash,reason:why,confirmed:true}};review={before:raw(before)};}}catch(e){note(e.message);return;}
  writing=true;controls();let resolved=false;
  try{await navigator.locks.request('cw-repair-work:'+principal.owner,{ifAvailable:true},async lock=>{
   if(!lock)throw Error('Há outra janela a confirmar um pedido. Consulte novamente.');if(!active())return;const stored=await readLocal('pending');if(!active())return;if(stored&&!await validPending(stored)){storageFailed=true;throw Error('Pedido guardado inválido. Novos registos bloqueados.');}
   if(payload){if(stored){pending=stored;throw Error('Existe um pedido por confirmar nesta conta.');}if(rev!==epoch||detail!==view||action==='VOID'&&selected!==before)throw Error('A seleção mudou. Consulte novamente.');
    const r={owner:principal.owner,repairId,requestId:crypto.randomUUID(),payload,review,createdAt:new Date().toISOString()};r.payloadHash=await payloadHash(r);r.reviewHash=await hash(review);if(!await validPending(r))throw Error('Reveja o técnico e um intervalo dentro das datas apresentadas.');if(!active()||rev!==epoch||detail!==view)return;await access('readwrite',s=>s.add(r,principal.owner+':pending'));const saved=await readLocal('pending');if(!equal(saved,r)){storageFailed=true;throw Error('A gravação do pedido não ficou confirmada.');}pending=saved;
   }else{if(!stored)throw Error('Não há pedido pendente nesta conta.');pending=stored;}
   if(!active())return;const r=pending;controls();let result;
   if(action==='check'){const found=await request(r.repairId,'/requests/'+r.requestId+'?payloadHash='+r.payloadHash);if(found.found===false){note('O resultado ainda não foi encontrado. Conserve o pedido e repita apenas o mesmo pedido.');return;}if(found.found!==true)throw Error('Consulta de resultado inválida.');result=found.result;}
   else result=await request(r.repairId,'',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:r.requestId,...r.payload})});
   if(!active())return;await accept(result,r);resolved=active();
  });}catch(e){if(active())note((/fetch|aborted|NetworkError|Load failed/i.test(e.message)?'A resposta não chegou. O pedido continua guardado.':e.message)+' Consulte o resultado antes de preparar outro pedido.');}finally{writing=false;controls();}
  if(resolved&&active()&&rev===epoch){const message=el('workWriteStatus').textContent;draftLoaded=false;await load();if(active())note(message);}
 }
 el('workForm').onsubmit=e=>{e.preventDefault();void execute('RECORD');};el('workVoidForm').onsubmit=e=>{e.preventDefault();void execute('VOID');};
 el('workRefresh').onclick=()=>{draftLoaded=false;void load();};el('workCheck').onclick=()=>void execute('check');el('workRetry').onclick=()=>void execute('retry');el('workVoidCancel').onclick=()=>{clearVoid();controls();};
 for(const id of fields)for(const event of ['input','change'])el(id).addEventListener(event,saveDraft);
 el('workVoidReason').addEventListener('input',()=>{el('workVoidConfirmed').checked=false;});
 for(const event of ['storage','focus'])window.addEventListener(event,()=>{if(active())void syncPending();});document.addEventListener('visibilitychange',active);
 for(const method of ['setItem','removeItem','clear']){const original=Storage.prototype[method];Storage.prototype[method]=function(...args){const result=Reflect.apply(original,this,args);if(this===localStorage&&(method==='clear'||keys.includes(String(args[0]))))active();return result;};}
 window.addEventListener('pagehide',clear);window.addEventListener('pageshow',e=>{if(e.persisted&&active()){draftLoaded=false;void load();}});window.addEventListener('online',controls);window.addEventListener('offline',controls);setInterval(()=>{if(active())controls();},500);
 (async()=>{try{
  const token=keys.slice(0,3).map(k=>localStorage.getItem(k)).find(Boolean),claims=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))),role=claims.role,tech=Number(claims.technicianId||claims.id),user=Number(claims.userId||claims.id),users=keys.slice(3).map(k=>localStorage.getItem(k)).filter(Boolean).map(JSON.parse);
  if(!['ADMIN','TECHNICIAN','TEAM_LEADER'].includes(role)||!positive(user)||role!=='ADMIN'&&!positive(tech)||!users.length||users.some(u=>u.role!==role||Number(u.userId||u.id)!==user)||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||keys.slice(0,3).some(k=>localStorage.getItem(k)&&localStorage.getItem(k)!==token))throw Error('Sessão inválida.');
  principal={token,role,technicianId:role==='ADMIN'?null:tech,owner:role==='ADMIN'?'ADMIN:'+user:claims.principalType==='USER'?'USER:'+user+':TECH:'+tech:'TECH:'+tech,expires:claims.exp*1000,fingerprint:identity()};
  if(!positive(repairId)){state('error','Abra uma reparação para consultar os seus tempos.');storageFailed=true;return;}
  try{if(!navigator.locks||!crypto.subtle)throw Error('Storage');db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cw-repair-work-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=r.onblocked=()=>reject(Error('Storage'));});await syncPending();const last=await readLocal('confirmed');if(last){if(!await validPending(last.record))throw Error('Storage');await validateReceipt(last.result,last.record);if(active())note('Último resultado guardado: reparação #'+last.record.repairId+(last.result.applied?' confirmada.':' — pedido não aplicado.'));}}catch{storageFailed=true;note('Não foi possível verificar o armazenamento dos pedidos. Pode consultar; novos registos estão bloqueados.');}
  if(active())await load();
 }catch{invalid=true;active();}finally{controls();}})();
})();
