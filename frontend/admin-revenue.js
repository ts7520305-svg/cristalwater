(function () {
  'use strict';
  const el=id=>document.getElementById(id),keys=['cristalwater_jwt','token','adminToken','cristalwater_user','user'];
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const hash=async v=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(v)))))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const identity=()=>JSON.stringify(keys.map(k=>localStorage.getItem(k))),positive=n=>Number.isSafeInteger(n)&&n>0,count=n=>Number.isSafeInteger(n)&&n>=0,cents=n=>n===null||count(n),sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s),month=s=>/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(s);
  const money=n=>n===null?'Por confirmar':new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(n/100);
  const amount=s=>{if(!/^\d{1,8}([.,]\d{1,2})?$/.test(s.trim()))throw Error('Indique um montante com até duas casas decimais.');const [a,b='']=s.trim().replace(',','.').split('.'),v=Number(a)*100+Number(b.padEnd(2,'0'));if(!positive(v)||v>2147483647)throw Error('Montante fora do intervalo permitido.');return v;};
  const refused=new Set(['CANCELLED_REQUEST','NOT_FOUND','STATE_CHANGED','ALLOCATION_CHANGED','SOURCE_REVIEW','OVER_BUDGET','TARGET_CHANGED','TARGET_ALLOCATED']);
  let principal,invalid=false,db=null,storageFailed=false,pending=null,writing=false,epoch=0,detailEpoch=0,targetEpoch=0,page=1,total=0,targetPage=1,targetTotal=0,selectedId=null,detail=null,target=null,voidId=null,observed='';
  const controllers=new Set();
  function node(parent,tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;parent.append(n);return n;}
  function note(text){el('writeStatus').textContent=text;}
  function state(kind,text){el('revenueStatus').dataset.state=kind;el('revenueStatus').textContent=text;}
  function safe(work){return Promise.resolve().then(work).catch(e=>{if(active())note(e.message);});}
  function button(parent,text,work,write=false){const b=node(parent,'button',text);b.type='button';if(write)b.dataset.write='';b.addEventListener('click',()=>void safe(work));return b;}
  function clearDetail(){detailEpoch++;targetEpoch++;selectedId=null;detail=null;target=null;voidId=null;targetTotal=0;targetPage=1;el('revenueDetail').hidden=true;el('allocationForm').reset();el('voidForm').reset();el('voidForm').hidden=true;for(const id of ['detailTitle','detailFacts','allocationRows','eventList','targetRows','targetStatus','targetReview','voidReview'])el(id).replaceChildren();}
  function clearRead(){epoch++;for(const c of controllers)c.abort();controllers.clear();clearDetail();total=0;for(const id of ['revenueRows','revenueMetrics','revenueBasis','listSummary'])el(id).replaceChildren();}
  function active(){if(!invalid&&principal&&principal.fingerprint===identity()&&principal.expires>Date.now())return true;if(!invalid){invalid=true;clearRead();el('pendingPreview').replaceChildren();note('');}state('session','A sessão mudou. Reabra esta página com a conta original para recuperar os pedidos guardados.');controls();return false;}
  function controls(){
    const disabled=invalid||writing||!navigator.onLine,blocked=disabled||!!pending||storageFailed||!db;
    document.querySelectorAll('[data-write],#allocationForm input,#allocationForm textarea,#voidForm input,#voidForm textarea').forEach(n=>n.disabled=blocked);
    for(const id of ['revenueRefresh','targetRefresh'])el(id).disabled=disabled;
    for(const id of ['checkPending','retryPending','cancelPending'])el(id).disabled=disabled||!pending||storageFailed||!db;
    el('revenuePrevious').disabled=disabled||page<=1;el('revenueNext').disabled=disabled||page*10>=total;el('targetPrevious').disabled=disabled||targetPage<=1;el('targetNext').disabled=disabled||targetPage*10>=targetTotal;
    el('allocateButton').disabled=blocked||!target||!detail?.valid;
    el('pendingPanel').hidden=!pending||invalid;
    if(pending&&!invalid){const e=pending.envelope,d=e.data;el('pendingPreview').textContent=(e.command==='ALLOCATE'?'Confirmar parcela':'Anular parcela')+' · Linha #'+e.lineId+'\n'+(e.command==='ALLOCATE'?(d.targetType==='REGULAR'?'Visita regular #':'Visita extra #')+d.targetId+' · '+money(d.amountCents):'Parcela #'+d.allocationId)+'\nMotivo: '+d.reason;}
  }
  function filters(){return JSON.stringify([el('revenueMonth').value,el('revenueScope').value,el('revenueSearch').value.trim()]);}
  function changed(){if(!active())return;observed=filters();clearRead();page=1;state('idle','Consulte os filtros selecionados.');controls();}
  async function request(path,options={},revision){
    const c=new AbortController();controllers.add(c);const timer=setTimeout(()=>c.abort(),40000);
    try{const response=await fetch('/api/revenue-allocations'+path,{...options,headers:{Authorization:'Bearer '+principal.token,...options.headers},cache:'no-store',redirect:'error',signal:c.signal});
      if(!active()||revision!==undefined&&revision!==epoch)throw Error('Consulta alterada.');if((response.headers.get('content-type')||'').split(';')[0]!=='application/json')throw Error('Resposta não confirmada.');
      const result=await response.json();if(!active()||revision!==undefined&&revision!==epoch)throw Error('Consulta alterada.');if(response.status!==200||result?.ok!==true)throw Object.assign(Error(result?.error||'Operação não confirmada.'),{status:response.status});return result;
    }finally{clearTimeout(timer);controllers.delete(c);}
  }
  function validateSource(s){
    if(!s||!positive(s.lineId)||!positive(s.invoiceId)||!positive(s.clientId)||typeof s.clientName!=='string'||typeof s.label!=='string'||typeof s.valid!=='boolean'||typeof s.excluded!=='boolean'||s.excluded&&(s.valid||s.reviewCount>0||s.reservedAmountCents!==0)||!count(s.reviewCount)||!sha(s.stateHash)||![s.amountCents,s.reservedAmountCents,s.allocatedAmountCents,s.availableAmountCents].every(cents)||s.monthRef!==null&&!month(s.monthRef)||s.documentMonth!==null&&!month(s.documentMonth))throw Error('Mensalidade não confirmada.');
    if(s.valid&&(!positive(s.amountCents)||![s.reservedAmountCents,s.allocatedAmountCents,s.availableAmountCents].every(count)||s.reservedAmountCents!==s.allocatedAmountCents||s.amountCents!==s.allocatedAmountCents+s.availableAmountCents||s.reviewCount||!month(s.monthRef)||!month(s.documentMonth)))throw Error('Valores da mensalidade inconsistentes.');
    if(!s.valid&&(s.allocatedAmountCents!==null||s.availableAmountCents!==null))throw Error('Mensalidade por rever sem indicação de incerteza.');
  }
  async function load(){
    if(!active()||!navigator.onLine)return;clearRead();const revision=epoch,selection=filters(),p=page;observed=selection;state('loading','A consultar mensalidades…');
    try{const result=await request('/sources?'+new URLSearchParams({monthRef:el('revenueMonth').value,scope:el('revenueScope').value,q:el('revenueSearch').value.trim(),page:String(p)}),{},revision);if(!active()||epoch!==revision||filters()!==selection||page!==p)return;
      const s=result.summary;if(result.monthRef!==el('revenueMonth').value||result.scope!==el('revenueScope').value||result.q!==el('revenueSearch').value.trim()||result.page!==p||result.pageSize!==10||!count(result.total)||!Array.isArray(result.rows)||result.rows.length!==Math.max(0,Math.min(10,result.total-(p-1)*10))||new Set(result.rows.map(r=>r.lineId)).size!==result.rows.length||!s||s.currency!=='EUR'||s.basis!=='DOCUMENT_MONTH_CURRENT_VALUES'||s.completeRevenueAllocation!==false||s.profit!==null||s.limitApplied!==null||!['sourceCount','excludedSourceCount','reviewSourceCount','activeCount','reviewCount'].every(k=>count(s[k]))||s.reviewSourceCount>s.sourceCount||s.reviewCount>s.activeCount||![s.amountCents,s.allocatedAmountCents,s.availableAmountCents].every(cents)||s.reviewSourceCount>0&&[s.amountCents,s.allocatedAmountCents,s.availableAmountCents].some(v=>v!==null)||!s.reviewSourceCount&&(![s.amountCents,s.allocatedAmountCents,s.availableAmountCents].every(count)||s.amountCents!==s.allocatedAmountCents+s.availableAmountCents)||!Number.isFinite(Date.parse(result.generatedAt)))throw Error('Lista ou totais não confirmados.');
      result.rows.forEach(validateSource);total=result.total;
      for(const [label,value]of [['Mensalidades documentadas',money(s.amountCents)],['Repartido pelos serviços',money(s.allocatedAmountCents)],['Disponível para repartir',money(s.availableAmountCents)],['Mensalidades por rever',String(s.reviewSourceCount)]]){const c=node(el('revenueMetrics'),'div','','metric');node(c,'span',label);node(c,'strong',value);}
      el('revenueBasis').textContent='Totais de todas as mensalidades '+(result.scope==='all'?'de todos os meses':'do mês do documento selecionado')+', antes da pesquisa e paginação. Consulta: '+new Date(result.generatedAt).toLocaleString('pt-PT')+'. '+s.reviewCount+' parcelas por rever; '+s.excludedSourceCount+' origens retiradas ou excluídas sem parcelas ativas ficam fora dos totais. Cobertura parcial: repartição do valor já documentado, sem somar novamente aos recebimentos e sem margem apurada.';
      el('listSummary').textContent=total+' mensalidades · Página '+p+' de '+Math.max(1,Math.ceil(total/10));
      for(const row of result.rows){const box=node(el('revenueRows'),'article','');node(box,'h3',row.clientName+' · Cliente #'+row.clientId);node(box,'p',row.label);node(box,'p','Documento #'+row.invoiceId+' · '+(row.documentMonth||'Mês por confirmar')+' · Mensalidade '+(row.monthRef||'por confirmar'));node(box,'p',row.valid?'Disponível: '+money(row.availableAmountCents)+' de '+money(row.amountCents):row.excluded?'Histórico: origem retirada ou excluída, sem parcelas ativas.':'Origem ou parcelas por rever.');button(box,'Abrir mensalidade #'+row.lineId,()=>openDetail(row.lineId));}
      if(!total)node(el('revenueRows'),'p','Não há mensalidades para estes filtros.');state(s.reviewSourceCount?'review':'ready',s.reviewSourceCount?'Há origens ou parcelas por rever. Os totais afetados ficam por confirmar.':'Mensalidades consultadas.');
    }catch(e){if(active()&&epoch===revision){clearRead();state('error',e.message);}}finally{controls();}
  }
  function validateAllocation(a,lineId){if(!a||!positive(a.id)||a.lineId!==lineId||!positive(a.invoiceId)||!positive(a.clientId)||!positive(a.amountCents)||!['REGULAR','EXTRA'].includes(a.targetType)||!positive(a.targetId)||!month(a.monthRef)||!sha(a.sourceHash)||!sha(a.targetHash)||typeof a.reason!=='string'||!a.reason.trim()||!Number.isFinite(Date.parse(a.createdAt))||!a.sourceSnapshot||a.sourceSnapshot.lineId!==lineId||!a.targetSnapshot||a.targetSnapshot.id!==a.targetId||a.targetSnapshot.type!==a.targetType||a.voidedAt!==null&&!Number.isFinite(Date.parse(a.voidedAt)))throw Error('Parcela não confirmada.');}
  async function openDetail(id){
    if(!active())return;clearDetail();selectedId=id;const revision=epoch,version=detailEpoch;
    try{const result=await request('/sources/'+id,{},revision);if(!active()||epoch!==revision||version!==detailEpoch||selectedId!==id)return;const s=result.source;validateSource(s);if(s.lineId!==id||!Array.isArray(s.allocations)||!Array.isArray(result.events))throw Error('Detalhe não confirmado.');
      const seen=new Set();for(const a of s.allocations){validateAllocation(a,id);if(seen.has(a.id)||typeof a.needsReview!=='boolean'||a.voidedAt&&a.needsReview)throw Error('Histórico inválido.');seen.add(a.id);}
      if(s.reviewCount!==s.allocations.filter(a=>a.needsReview).length||s.reservedAmountCents!==s.allocations.filter(a=>!a.voidedAt).reduce((sum,a)=>sum+a.amountCents,0))throw Error('Parcela ou saldo não confirmado.');detail=s;
      el('detailTitle').textContent=s.clientName+' · Mensalidade #'+id;node(el('detailFacts'),'p','Documento #'+s.invoiceId+' · Mês do documento: '+(s.documentMonth||'por confirmar')+' · Mês da mensalidade e dos serviços: '+(s.monthRef||'por confirmar'));node(el('detailFacts'),'p','Valor: '+money(s.amountCents)+' · Reservado por parcelas ativas: '+money(s.reservedAmountCents)+' · Disponível: '+money(s.availableAmountCents));
      if(s.excluded)node(el('detailFacts'),'p','Esta origem fica fora dos totais. O histórico permanece disponível.','state');
      else if(!s.valid)node(el('detailFacts'),'p','Há alterações no documento, período ou serviços. Consulte o histórico e anule as parcelas afetadas antes de confirmar novamente. Parcelas por rever continuam a reservar o valor.','state');
      for(const a of s.allocations){const row=node(el('allocationRows'),'div','','row');node(row,'strong','Parcela #'+a.id+' · '+money(a.amountCents));node(row,'p',a.targetSnapshot.label+' · '+a.monthRef);node(row,'p',a.reason);node(row,'p',a.voidedAt?'Anulada: '+a.voidReason:a.needsReview?'Por rever: a origem ou o serviço mudou.':'Ativa e confirmada.');if(!a.voidedAt)button(row,'Anular parcela #'+a.id,()=>{if(!active()||writing||pending||detail?.lineId!==id)return;voidId=a.id;el('voidForm').reset();el('voidReview').textContent='Parcela #'+a.id+' · '+a.targetSnapshot.label+' · '+money(a.amountCents);el('voidForm').hidden=false;controls();},true);}
      if(!s.allocations.length)node(el('allocationRows'),'p','Sem parcelas registadas.');
      for(const e of result.events){if(!positive(e.id)||!['ALLOCATE','VOID'].includes(e.command)||typeof e.actorName!=='string'||!Number.isFinite(Date.parse(e.createdAt))||typeof e.result?.applied!=='boolean')throw Error('Decisão não confirmada.');const row=node(el('eventList'),'div','','row');node(row,'strong',(e.command==='ALLOCATE'?'Atribuição':'Anulação')+' · '+e.actorName);node(row,'p',new Date(e.createdAt).toLocaleString('pt-PT')+' · '+(e.result.applied?'Confirmada.':String(e.result.message)));}
      el('allocationForm').hidden=!s.valid||!s.availableAmountCents;el('revenueDetail').hidden=false;controls();
    }catch(e){if(active()&&revision===epoch&&version===detailEpoch){clearDetail();note(e.message);controls();}}
  }
  async function loadTargets(){
    if(!active()||!detail?.valid||writing||!navigator.onLine)return;const s=detail,revision=epoch,version=detailEpoch,seq=++targetEpoch,q=el('targetSearch').value.trim(),p=targetPage;target=null;targetTotal=0;el('targetRows').replaceChildren();el('targetReview').textContent='Escolha um serviço.';el('allocationConfirmed').checked=false;el('targetStatus').textContent='A consultar serviços…';controls();
    try{const result=await request('/sources/'+s.lineId+'/targets?'+new URLSearchParams({q,page:String(p)}),{},revision);if(!active()||revision!==epoch||version!==detailEpoch||seq!==targetEpoch||q!==el('targetSearch').value.trim()||p!==targetPage)return;
      if(result.lineId!==s.lineId||result.stateHash!==s.stateHash||result.q!==q||result.page!==p||result.pageSize!==10||!count(result.total)||!Array.isArray(result.rows)||result.rows.length!==Math.max(0,Math.min(10,result.total-(p-1)*10)))throw Error('A mensalidade mudou ou a lista não foi confirmada. Volte a abrir a mensalidade.');
      const seen=new Set();for(const t of result.rows){if(!['REGULAR','EXTRA'].includes(t.type)||!positive(t.id)||t.clientId!==s.clientId||t.monthRef!==s.monthRef||t.valid!==true||typeof t.legacy!=='boolean'||!sha(t.hash)||typeof t.label!=='string'||seen.has(t.type+':'+t.id))throw Error('Serviço não confirmado.');seen.add(t.type+':'+t.id);}
      targetTotal=result.total;for(const t of result.rows){const box=node(el('targetRows'),'article','');node(box,'p',t.label);if(t.legacy)node(box,'p','Sem plano histórico registado: confirme a inclusão no contrato.','note');button(box,'Escolher '+(t.type==='REGULAR'?'regular #':'extra #')+t.id,()=>{if(!active()||writing||pending||detailEpoch!==version||epoch!==revision||targetEpoch!==seq)return;target=t;el('targetReview').textContent=t.label+' · Mensalidade '+t.monthRef+(t.legacy?' · Confirme a inclusão no contrato histórico.':' · Incluído na mensalidade.');el('allocationConfirmed').checked=false;controls();},true);}
      el('targetStatus').textContent=targetTotal+' serviços elegíveis · Página '+p+'. Apenas serviços concluídos, sem cobrança própria nem outra parcela ativa.';
    }catch(e){if(active()&&revision===epoch&&version===detailEpoch&&seq===targetEpoch){target=null;targetTotal=0;el('targetRows').replaceChildren();el('targetStatus').textContent=e.message;}}finally{controls();}
  }
  async function access(mode,fn){return new Promise((resolve,reject)=>{const tx=db.transaction('state',mode),req=fn(tx.objectStore('state'));tx.oncomplete=()=>resolve(req?.result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Não foi possível guardar o pedido.'));});}
  const readLocal=kind=>access('readonly',s=>s.get(principal.owner+':'+kind));
  async function validPending(record){return record?.owner===principal.owner&&['ALLOCATE','VOID'].includes(record.envelope?.command)&&positive(record.envelope?.lineId)&&sha(record.envelope?.expectedStateHash)&&record.payloadHash===await hash({v:1,...record.envelope});}
  async function syncPending(){if(!db||!active()||writing)return;try{const record=await readLocal('pending');if(!active())return;if(record&&!await validPending(record))throw Error('Pedido local inválido.');pending=record||null;controls();}catch{storageFailed=true;note('Não foi possível verificar o pedido guardado. Os novos registos estão bloqueados.');controls();}}
  function validateReceipt(result,record){
    const receipt=result.receipt,e=record.envelope,d=e.data;
    if(!receipt||receipt.owner!==record.owner||receipt.requestId!==e.requestId||receipt.command!==e.command||receipt.lineId!==e.lineId||receipt.expectedStateHash!==e.expectedStateHash||receipt.payloadHash!==record.payloadHash||!Number.isFinite(Date.parse(receipt.confirmedAt))||typeof result.applied!=='boolean')throw Error('O resultado não corresponde ao pedido guardado.');
    if(!result.applied){if(!refused.has(result.code)||typeof result.message!=='string'||!result.message)throw Error('Recusa não confirmada.');return;}
    const a=result.allocation;validateAllocation(a,e.lineId);
    if(e.command==='ALLOCATE'&&(a.targetType!==d.targetType||a.targetId!==d.targetId||a.targetHash!==d.targetHash||a.amountCents!==d.amountCents||a.reason!==d.reason.trim()||a.createdById!==principal.id||a.voidedAt!==null)||e.command==='VOID'&&(a.id!==d.allocationId||!a.voidedAt||a.voidReason!==d.reason.trim()))throw Error('A parcela confirmada não corresponde ao pedido.');
  }
  async function accept(result,record){
    validateReceipt(result,record);
    await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'),s=tx.objectStore('state'),get=s.get(principal.owner+':pending');get.onsuccess=()=>{const saved=get.result;if(saved?.envelope?.requestId!==record.envelope.requestId||saved?.payloadHash!==record.payloadHash){tx.abort();return;}s.put({owner:record.owner,envelope:record.envelope,result},principal.owner+':confirmed');s.delete(principal.owner+':pending');};tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(Error('A confirmação não pôde ser guardada. Consulte novamente o pedido.'));});
    if(!active())return;pending=null;note(result.applied?'Parcela '+(record.envelope.command==='ALLOCATE'?'registada':'anulada')+' e confirmação guardada.':result.message+' O resultado ficou guardado.');
  }
  async function execute(command,d,action='send'){
    if(!active()||writing||storageFailed||!db||!navigator.onLine||action==='send'&&(!detail||pending))return;
    const source=detail,revision=epoch,version=detailEpoch,selection=filters(),chosen=target;
    const env=action==='send'?{requestId:crypto.randomUUID(),command,lineId:source.lineId,expectedStateHash:source.stateHash,data:d}:null;
    writing=true;controls();
    try{await navigator.locks.request('cw-revenue-command:'+principal.owner,{ifAvailable:true},async lock=>{
      if(!lock)throw Error('Há outra janela a confirmar um pedido. Consulte o resultado nesta conta.');if(!active())return;
      const stored=await readLocal('pending');if(!active())return;if(stored&&!await validPending(stored))throw Error('Pedido local inválido.');
      if(action==='send'){
        if(stored){pending=stored;throw Error('Existe um pedido guardado por confirmar.');}
        if(revision!==epoch||version!==detailEpoch||filters()!==selection||detail!==source||chosen!==target)throw Error('Seleção alterada. Reveja a parcela.');
        const payloadHash=await hash({v:1,...env});if(!active()||revision!==epoch||version!==detailEpoch||filters()!==selection)return;
        pending={owner:principal.owner,envelope:env,payloadHash,createdAt:new Date().toISOString()};await access('readwrite',s=>s.put(pending,principal.owner+':pending'));
      }else{if(!stored)throw Error('Não há pedido pendente nesta conta.');pending=stored;}
      if(!active())return;const record=pending;controls();
      const result=action==='check'?await request('/requests/'+record.envelope.requestId):await request(action==='cancel'?'/commands/cancel':'/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record.envelope)});
      if(!active())return;await accept(result,record);
      if(active()&&epoch===revision&&filters()===selection){await load();if(source?.lineId===record.envelope.lineId)await openDetail(source.lineId);}
    });}catch(e){if(active())note((e.status===404?'O pedido ainda não foi confirmado. Pode repetir o mesmo pedido ou cancelá-lo.':e.message)+' Se houver um pedido guardado, consulte o resultado antes de criar outro.');}
    finally{writing=false;controls();}
  }
  el('allocationForm').addEventListener('submit',e=>{e.preventDefault();void safe(async()=>{if(!active()||!detail||!target||writing||pending)return;if(!el('allocationConfirmed').checked||!el('allocationReason').value.trim())throw Error('Confirme o contrato e explique a repartição.');const value=amount(el('allocationAmount').value);if(value>detail.availableAmountCents)throw Error('A parcela excede o valor disponível.');await execute('ALLOCATE',{targetType:target.type,targetId:target.id,targetHash:target.hash,amountCents:value,reason:el('allocationReason').value.trim(),confirmed:true});});});
  el('voidForm').addEventListener('submit',e=>{e.preventDefault();void safe(async()=>{if(!active()||!voidId||!el('voidConfirmed').checked||!el('voidReason').value.trim())throw Error('Confirme a anulação e indique o motivo.');await execute('VOID',{allocationId:voidId,reason:el('voidReason').value.trim(),confirmed:true});});});
  el('closeVoid').addEventListener('click',()=>{voidId=null;el('voidForm').hidden=true;el('voidForm').reset();});
  for(const id of ['revenueMonth','revenueScope','revenueSearch']){el(id).addEventListener('input',changed);el(id).addEventListener('change',changed);}
  el('revenueRefresh').addEventListener('click',()=>void load());el('revenuePrevious').addEventListener('click',()=>{if(page>1){page--;void load();}});el('revenueNext').addEventListener('click',()=>{if(page*10<total){page++;void load();}});
  el('targetRefresh').addEventListener('click',()=>void loadTargets());el('targetPrevious').addEventListener('click',()=>{if(targetPage>1){targetPage--;void loadTargets();}});el('targetNext').addEventListener('click',()=>{if(targetPage*10<targetTotal){targetPage++;void loadTargets();}});
  el('targetSearch').addEventListener('input',()=>{targetEpoch++;target=null;targetPage=1;targetTotal=0;el('targetRows').replaceChildren();el('targetReview').textContent='Consulte os serviços para esta pesquisa.';el('allocationConfirmed').checked=false;controls();});
  for(const [id,action]of [['checkPending','check'],['retryPending','retry'],['cancelPending','cancel']])el(id).addEventListener('click',()=>void execute(null,null,action));
  for(const event of ['storage','focus'])window.addEventListener(event,()=>{if(active())void syncPending();});document.addEventListener('visibilitychange',active);
  for(const method of ['setItem','removeItem','clear']){const original=Storage.prototype[method];Storage.prototype[method]=function(...args){const result=Reflect.apply(original,this,args);if(this===localStorage&&(method==='clear'||keys.includes(String(args[0]))))active();return result;};}
  window.addEventListener('pagehide',clearRead);window.addEventListener('pageshow',e=>{if(e.persisted&&active())changed();});window.addEventListener('online',controls);window.addEventListener('offline',controls);
  setInterval(()=>{if(active()){if(observed&&observed!==filters())changed();else controls();}},500);
  (async()=>{try{
    const token=keys.slice(0,3).map(k=>localStorage.getItem(k)).find(Boolean),claims=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))),id=Number(claims.userId||claims.id),users=keys.slice(3).map(k=>localStorage.getItem(k)).filter(Boolean).map(JSON.parse);
    if(claims.role!=='ADMIN'||!positive(id)||!users.length||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||users.some(u=>u.role!=='ADMIN'||Number(u.userId||u.id)!==id)||keys.slice(0,3).some(k=>localStorage.getItem(k)&&localStorage.getItem(k)!==token))throw Error('Sessão inválida.');
    principal={id,token,owner:'ADMIN:'+id,expires:claims.exp*1000,fingerprint:identity()};el('revenueMonth').value=new Date().toISOString().slice(0,7);
    try{if(!navigator.locks||!crypto.subtle)throw Error('Storage');db=await new Promise((resolve,reject)=>{const open=indexedDB.open('cw-revenue-commands-v1',1);open.onupgradeneeded=()=>open.result.createObjectStore('state');open.onsuccess=()=>resolve(open.result);open.onerror=open.onblocked=()=>reject(Error('Storage'));});await syncPending();const saved=await readLocal('confirmed');if(active()&&!storageFailed&&saved?.owner===principal.owner)note('Último resultado guardado: '+(saved.result?.applied?'parcela confirmada.':'pedido concluído sem aplicar.'));}catch{storageFailed=true;note('Não foi possível preparar o armazenamento dos pedidos. Pode consultar; os novos registos estão bloqueados.');}
    if(active())await load();
  }catch(e){if(!principal){invalid=true;active();}else if(active())state('error',e.message);}finally{controls();}})();
})();
