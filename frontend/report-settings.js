(function () {
  'use strict';
  const names = { showClientName:'Nome do cliente', showPoolName:'Nome da instalação', showZone:'Zona', showAddress:'Morada', showTechnicianName:'Nome do técnico', showStatus:'Estado', showPlannedDate:'Data planeada', showStartEnd:'Início e fim', showWaterParameters:'Parâmetros da água', showChecklist:'Checklist', showChemicals:'Químicos', showEquipment:'Equipamento', showTechnicalRoom:'Casa técnica', showNotes:'Observações', showPhotos:'Fotos' };
  const fields=Object.keys(names),el=id=>document.getElementById(id),input=el('clientId'),status=el('status'),authKeys=['cristalwater_jwt','token','adminToken','cristalwater_user','user'];
  const fingerprint=()=>JSON.stringify(authKeys.map(key=>localStorage.getItem(key))),id=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
  const version=/^report-settings-v1:[a-f0-9]{64}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value)))))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const validFields=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(key=>typeof value[key]==='boolean');
  const values=()=>Object.fromEntries(fields.map(key=>[key,el(key).checked])),assign=value=>fields.forEach(key=>{el(key).checked=value?.[key]===true;});
  const selected=()=>/^[1-9]\d{0,9}$/.test(input.value.trim())&&id(Number(input.value.trim()))?Number(input.value.trim()):null;
  const text=(parent,tag,value)=>{const node=document.createElement(tag);node.textContent=value;parent.append(node);return node;};
  let credential='',identity='',owner='',invalid=false,db,storageUnavailable=false,busy=false,view=null,observed=input.value,recoveryScan=0;
  const controllers=new Set(),channel=typeof BroadcastChannel==='function'?new BroadcastChannel('cw-report-settings-v1'):null;
  try {
    identity=fingerprint();credential=localStorage.getItem('cristalwater_jwt')||localStorage.getItem('token')||localStorage.getItem('adminToken')||'';
    const claims=JSON.parse(atob(credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))),userId=Number(claims.userId||claims.id);
    if(claims.role!=='ADMIN'||!id(userId))throw Error('Invalid administrator');
    for(const key of authKeys.slice(0,3)){const value=localStorage.getItem(key);if(value&&value!==credential)throw Error('Conflicting session');}
    const users=authKeys.slice(3).map(key=>localStorage.getItem(key)).filter(Boolean).map(JSON.parse);
    if(!users.length||users.some(user=>user.role!=='ADMIN'||Number(user.userId||user.id)!==userId))throw Error('Conflicting account');
    owner='ADMIN:'+userId;
  }catch(_){invalid=true;}
  const slot=clientId=>owner+':'+clientId,draftKey=clientId=>'cwReportSettingsDraft:v1:'+slot(clientId);
  const intent=record=>({clientId:record.clientId,expectedVersion:record.base.version,setting:record.setting});
  const envelope=record=>({v:1,scope:'CLIENT_REPORT_SETTINGS',resourceId:record.clientId,payload:intent(record)});
  function note(state,message){status.dataset.state=state;status.textContent=message;status.setAttribute('role',['error','session','conflict'].includes(state)?'alert':'status');}
  function stop(){for(const controller of controllers)controller.abort();controllers.clear();}
  function active(){
    let same=false;try{same=!!owner&&identity===fingerprint();}catch(_){}
    if(same&&!invalid)return true;
    invalid=true;stop();view=null;busy=false;assign(null);el('loadedClient').textContent='';el('settingsRecovery').replaceChildren();el('settingsReview').hidden=true;controls();note('session','A sessão mudou. Reabra a página com a conta pretendida.');return false;
  }
  const current=v=>active()&&view===v&&input.value===v.selection&&selected()===v.id;
  function controls(){
    input.disabled=invalid;el('loadSettings').disabled=busy||invalid;
    el('settingsFields').disabled=invalid||busy||!view?.base||!view.base.editable||!!view.pending||view.conflict||view.needsRead;
    el('saveSettings').disabled=el('settingsFields').disabled||storageUnavailable||view?.draftUnavailable||!navigator.locks?.request;
    el('retrySettings').hidden=!view?.pending;el('retrySettings').disabled=invalid||busy||storageUnavailable||!navigator.onLine;
    el('reviewSettings').hidden=!view?.conflict||!!view?.pending;el('reviewSettings').disabled=invalid||busy;
    el('discardSettings').hidden=!view?.base||!!view?.pending||view?.needsRead;el('discardSettings').disabled=invalid||busy;
    el('prepareSettings').disabled=invalid||busy||!view?.revision;
  }
  function validateState(value,clientId){
    if(value?.ok!==true||value.reportSettingsVersion!==1||value.client?.id!==clientId||typeof value.client.name!=='string'||typeof value.client.active!=='boolean'||typeof value.editable!=='boolean'||!['DEFAULT','SAVED'].includes(value.source)||!validFields(value.setting)||!version.test(value.version)||(value.source==='DEFAULT'?value.savedAt!==null:typeof value.savedAt!=='string'||!Number.isFinite(Date.parse(value.savedAt))))throw Error('A resposta não confirma este cliente e as suas opções.');
    return value;
  }
  function validDraft(draft,clientId){return draft?.schema===1&&draft.owner===owner&&draft.clientId===clientId&&validFields(draft.setting)&&(!draft.requestId||uuid.test(draft.requestId))&&validateState(draft.base,clientId);}
  function draft(clientId){const raw=sessionStorage.getItem(draftKey(clientId));if(!raw)return null;const result=JSON.parse(raw);if(!validDraft(result,clientId))throw Error('Rascunho inválido. Conserve os dados e peça assistência.');return result;}
  function saveDraft(v,setting=values(),requestId=null){
    try{const value={schema:1,owner,clientId:v.id,base:v.base,setting,requestId};sessionStorage.setItem(draftKey(v.id),JSON.stringify(value));if(!equal(draft(v.id),value))throw Error('Draft not confirmed');v.draftUnavailable=false;return true;}
    catch(_){v.draftUnavailable=true;note('error','Não foi possível guardar o rascunho neste navegador. Conserve esta janela; não foi enviado um novo pedido.');controls();return false;}
  }
  function access(mode,work){return new Promise((resolve,reject)=>{if(!db)return reject(Error('Recuperação local indisponível.'));const tx=db.transaction('clients',mode);let result;tx.oncomplete=()=>resolve(typeof result==='function'?result():result?.result);tx.onerror=tx.onabort=()=>reject(Error('Não foi possível confirmar o armazenamento local.'));try{result=work(tx.objectStore('clients'));}catch(error){tx.abort();reject(error);}});}
  const ready=new Promise(resolve=>{
    if(invalid||typeof indexedDB==='undefined'||!crypto.subtle){storageUnavailable=true;resolve();return;}
    try{const request=indexedDB.open('cw-report-settings-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('clients');request.onsuccess=()=>{db=request.result;resolve();};request.onerror=request.onblocked=()=>{storageUnavailable=true;resolve();};}catch(_){storageUnavailable=true;resolve();}
  });
  async function validRecord(record,clientId){if(record?.schema!==1||record.owner!==owner||record.clientId!==clientId||!uuid.test(record.requestId)||!validFields(record.setting)||!validateState(record.base,clientId)||record.payloadHash!==await hash(envelope(record)))throw Error('O pedido guardado não pôde ser verificado. Conserve os dados e peça assistência.');}
  async function verify(result,record){
    const receipt=result?.receipt;
    if(result?.ok!==true||typeof result.applied!=='boolean'||!equal(result.context,intent(record))||receipt?.owner!==owner||receipt.scope!=='CLIENT_REPORT_SETTINGS'||receipt.resourceId!==record.clientId||receipt.requestId!==record.requestId||receipt.payloadHash!==record.payloadHash||typeof receipt.confirmedAt!=='string'||!Number.isFinite(Date.parse(receipt.confirmedAt)))throw Error('Resposta sem confirmação do pedido original.');
    if(result.applied){validateState(result.state,record.clientId);if(!equal(result.state.setting,record.setting)||result.state.source!=='SAVED'||!id(result.auditId)||result.savedAt!==result.state.savedAt)throw Error('Gravação não confirmada.');}
    else if(!['REPORT_SETTINGS_STALE','REPORT_SETTINGS_UNAVAILABLE'].includes(result.code)||(result.currentVersion!==null&&!version.test(result.currentVersion)))throw Error('Recusa não confirmada.');
  }
  async function readLocal(clientId){
    const entry=await access('readonly',store=>store.get(slot(clientId)));if(!entry)return{schema:1,owner,clientId,pending:null,confirmed:null};
    if(entry.schema!==1||entry.owner!==owner||entry.clientId!==clientId||Object.keys(entry).sort().join(',')!=='clientId,confirmed,owner,pending,schema')throw Error('Dados de recuperação inválidos. Conserve-os e peça assistência.');
    if(entry.pending)await validRecord(entry.pending,clientId);if(entry.confirmed){await validRecord(entry.confirmed.record,clientId);await verify(entry.confirmed.result,entry.confirmed.record);}return entry;
  }
  async function writeLocal(entry){await access('readwrite',store=>store.put(entry,slot(entry.clientId)));if(!equal(await readLocal(entry.clientId),entry))throw Error('Pedido local não confirmado.');}
  function clearConfirmedDraft(record){try{const value=draft(record.clientId);if(value&&(value.requestId===record.requestId||value.base.version===record.base.version&&equal(value.setting,record.setting)))sessionStorage.removeItem(draftKey(record.clientId));}catch(_){/* The durable acknowledgement prevents replacing an unconfirmed send. */}}
  async function recoverList(){
    // Publish one complete scan; overlapping reads must never mix recovery rows.
    const scan=++recoveryScan;await ready;if(scan!==recoveryScan||!active())return;
    const container=el('settingsRecovery'),fragment=document.createDocumentFragment();
    if(storageUnavailable||!navigator.locks?.request){text(fragment,'p','A recuperação local está indisponível. Pode consultar as opções, mas a gravação está bloqueada.');container.replaceChildren(fragment);controls();return;}
    try{const rows=await access('readonly',store=>{const keys=store.getAllKeys(),values=store.getAll();return()=>keys.result.map((key,index)=>[key,values.result[index]]);});if(scan!==recoveryScan||!active())return;let count=0;
      for(const [key,entry] of rows){if(typeof key!=='string'||!key.startsWith(owner+':'))continue;const clientId=Number(key.slice(owner.length+1));if(!id(clientId)||!entry||entry.owner!==owner||entry.clientId!==clientId)throw Error('Há dados de recuperação inválidos nesta conta.');const state=await readLocal(clientId);if(scan!==recoveryScan||!active())return;if(!state.pending)continue;count++;const box=text(fragment,'div',''),record=state.pending;text(box,'p',record.base.client.name+' · cliente #'+clientId);const button=text(box,'button','Consultar pedido guardado');button.type='button';button.disabled=busy;button.addEventListener('click',()=>{input.value=String(clientId);changeSelection();load();});}
      if(!count)text(fragment,'p','Não há pedidos por confirmar nesta conta.');
      if(scan===recoveryScan&&active())container.replaceChildren(fragment);
    }catch(error){if(scan!==recoveryScan||!active())return;container.replaceChildren();text(container,'p',error.message);storageUnavailable=true;controls();}
  }
  async function request(v,method,body){
    const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),20000);
    try{if(!current(v))throw Error('Contexto alterado.');const response=await fetch('/api/report-settings/'+v.id,{method,headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},cache:'no-store',...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});if(!current(v))throw Error('Contexto alterado.');const data=await response.json();if(!current(v))throw Error('Contexto alterado.');if(response.status!==200||data?.ok!==true)throw Error([401,403].includes(response.status)?'A sessão não permite esta operação. Reabra a página com a conta correta.':'Não foi possível confirmar a operação. Conserve e repita o pedido original.');return data;}
    finally{clearTimeout(timer);controllers.delete(controller);}
  }
  function describe(v){el('loadedClient').textContent=v.base.client.name+' · cliente #'+v.id+(v.base.client.active?'':' · inativo')+' · '+(v.base.source==='DEFAULT'?'valores padrão, sem configuração gravada':'configuração guardada');}
  function changeSelection(){if(!active())return;stop();observed=input.value;view=null;busy=false;assign(null);el('loadedClient').textContent='';el('settingsReview').hidden=true;note('idle','Carregue as configurações do cliente selecionado. Os rascunhos anteriores foram conservados.');controls();recoverList();}
  async function load(){
    if(!active()||busy)return;const clientId=selected();if(!clientId){note('error','Indique um ID de cliente válido.');return;}
    const v={id:clientId,selection:input.value,base:null,pending:null,conflict:false,needsRead:false,draftUnavailable:false};view=v;observed=input.value;busy=true;assign(null);el('loadedClient').textContent='';el('settingsReview').hidden=true;note('loading','A confirmar o cliente e as configurações…');controls();
    try{await ready;if(!current(v))return;const local=storageUnavailable?null:await readLocal(clientId);if(!current(v))return;
      let savedDraft=draft(clientId);
      if(local?.confirmed&&savedDraft?.requestId===local.confirmed.record.requestId){if(local.confirmed.result.applied){clearConfirmedDraft(local.confirmed.record);savedDraft=null;}else v.conflict=true;}
      if(local?.pending){v.pending=local.pending;v.base=local.pending.base;assign(local.pending.setting);describe(v);note('pending','Existe um pedido guardado para este cliente. Confirme esse pedido antes de alterar as opções.');return;}
      if(savedDraft){v.base=savedDraft.base;assign(savedDraft.setting);describe(v);}
      const state=validateState(await request(v,'GET'),clientId);if(!current(v))return;
      if(!savedDraft){v.base=state;assign(state.setting);}else v.conflict=v.conflict||savedDraft.base.version!==state.version;
      describe(v);note(v.conflict?'conflict':'ready',v.conflict?'A versão atual mudou. Reveja as alterações; o rascunho foi conservado.':!state.editable?'Este cliente está arquivado ou indisponível para alteração.':savedDraft?'Rascunho recuperado. Confira as opções antes de guardar.':'Cliente e opções confirmados.');
      if(!state.editable)v.needsRead=true;
    }catch(error){if(current(v)){v.needsRead=true;note('error',error.message);}}
    finally{if(current(v)){busy=false;controls();recoverList();}}
  }
  async function locked(v,work){await ready;if(storageUnavailable||!navigator.locks?.request)throw Error('A gravação recuperável não está disponível neste navegador.');return navigator.locks.request('cw-report-settings:'+slot(v.id),{ifAvailable:true},async lock=>{if(!lock)throw Error('Outra janela está a tratar este cliente. Confirme depois o pedido guardado.');if(!current(v))return;return work();});}
  async function transport(v,record){
    if(!navigator.onLine)throw Error('Sem ligação. O pedido está guardado; confirme-o quando tiver rede.');
    const result=await request(v,'POST',{requestId:record.requestId,...intent(record)});await verify(result,record);if(!current(v))return;
    const local=await readLocal(v.id);if(!equal(local.pending,record))throw Error('O pedido guardado mudou. Conserve os dados.');
    await writeLocal({...local,pending:null,confirmed:{record,result}});channel?.postMessage({changed:true});if(!current(v))return;
    v.pending=null;v.needsRead=true;v.conflict=!result.applied;
    if(result.applied){clearConfirmedDraft(record);v.base=result.state;assign(record.setting);describe(v);note('confirmed','Gravação confirmada. Carregue novamente para consultar a versão atual antes de outra alteração.');}
    else{v.base=record.base;assign(record.setting);note('conflict',result.message||'O pedido não foi aplicado. Reveja a versão atual.');}
  }
  async function send(repeat){
    const v=view;if(!v||!current(v)||busy)return;if(!repeat&&(!v.base||!v.base.editable||v.conflict||v.needsRead||v.pending||v.draftUnavailable))return;
    busy=true;note('saving',repeat?'A confirmar o pedido guardado…':'A guardar o pedido antes do envio…');controls();
    try{await locked(v,async()=>{
      const local=await readLocal(v.id);if(!current(v))return;
      if(local.pending){v.pending=local.pending;v.base=local.pending.base;assign(local.pending.setting);describe(v);if(repeat)await transport(v,local.pending);else note('pending','Já existe um pedido. Use Confirmar pedido guardado.');return;}
      if(repeat){note('idle','O pedido já foi tratado noutra janela. Carregue a versão atual.');v.needsRead=true;return;}
      const setting=values();if(equal(setting,v.base.setting)){note('ready','Não há alterações para guardar.');return;}
      const record={schema:1,owner,clientId:v.id,requestId:crypto.randomUUID(),base:v.base,setting};record.payloadHash=await hash(envelope(record));if(!current(v))return;if(!saveDraft(v,setting,record.requestId))return;
      await validRecord(record,v.id);await writeLocal({...local,pending:record});v.pending=record;channel?.postMessage({changed:true});if(current(v))await transport(v,record);
    });}catch(error){if(current(v))note(v.pending?'pending':'error',error.message);}
    finally{if(current(v)){busy=false;controls();recoverList();}}
  }
  async function review(){
    const v=view;if(!v?.base||!current(v)||busy||v.pending)return;busy=true;controls();
    try{const mine=values(),fresh=validateState(await request(v,'GET'),v.id);if(!current(v))return;if(!fresh.editable)throw Error('O cliente já não está disponível para alteração.');const merged=Object.fromEntries(fields.map(key=>[key,mine[key]===v.base.setting[key]?fresh.setting[key]:mine[key]]));v.revision={fresh,setting:merged};const rows=el('reviewRows');rows.replaceChildren();for(const key of fields){const row=text(rows,'tr','');text(row,'th',names[key]);text(row,'td',fresh.setting[key]?'Mostrar':'Ocultar');text(row,'td',merged[key]?'Mostrar':'Ocultar');}el('settingsReview').hidden=false;note('conflict','Confira a versão atual e a proposta abaixo. Preparar a revisão não envia a gravação.');}
    catch(error){if(current(v))note('error',error.message);}finally{if(current(v)){busy=false;controls();}}
  }
  el('prepareSettings').addEventListener('click',()=>{const v=view;if(!v?.revision||!current(v)||busy)return;const revision=v.revision;v.base=revision.fresh;assign(revision.setting);v.pending=null;v.conflict=false;v.needsRead=false;if(!saveDraft(v,revision.setting))return;v.revision=null;el('settingsReview').hidden=true;describe(v);note('ready','Revisão preparada. Confira as opções e guarde para criar um novo pedido.');controls();});
  el('discardSettings').addEventListener('click',()=>{const v=view;if(!v?.base||!current(v)||busy||v.pending)return;try{sessionStorage.removeItem(draftKey(v.id));if(sessionStorage.getItem(draftKey(v.id)))throw Error('Draft retained');load();}catch(_){note('error','Não foi possível descartar o rascunho. Os dados foram conservados.');}});
  for(const key of fields)el(key).addEventListener('change',()=>{const v=view;if(v?.base&&current(v)&&!busy&&!v.pending&&!v.conflict&&!v.needsRead){saveDraft(v);controls();}});
  input.addEventListener('input',changeSelection);el('loadSettings').addEventListener('click',load);el('saveSettings').addEventListener('click',()=>send(false));el('retrySettings').addEventListener('click',()=>send(true));el('reviewSettings').addEventListener('click',review);
  function observe(){if(!active())return;if(input.value!==observed)changeSelection();}
  async function changedElsewhere(){if(!active())return;await recoverList();if(view&&!busy)load();}
  if(channel)channel.onmessage=changedElsewhere;
  window.addEventListener('storage',observe);window.addEventListener('focus',observe);document.addEventListener('visibilitychange',observe);setInterval(observe,500);
  window.addEventListener('pagehide',()=>{stop();if(view)view.needsRead=true;busy=false;controls();});window.addEventListener('pageshow',event=>{observe();if(event.persisted&&view)load();});
  window.addEventListener('online',()=>{if(active()){controls();recoverList();}});window.addEventListener('offline',()=>{if(active())controls();});
  function refreshLinks(){const visitId=el('visitId').value.trim();el('clientLink').textContent='Relatório cliente: '+(visitId?'/api/report-visit/visit/'+visitId+'?role=CLIENT':'-');el('adminLink').textContent='Relatório admin: '+(visitId?'/api/report-visit/visit/'+visitId+'?role=ADMIN':'-');}
  window.openClientReport=()=>{const value=el('visitId').value.trim();if(value)window.open('/api/report-visit/visit/'+encodeURIComponent(value)+'?role=CLIENT','_blank');};
  window.openAdminReport=()=>{const value=el('visitId').value.trim();if(value)window.open('/api/report-visit/visit/'+encodeURIComponent(value)+'?role=ADMIN','_blank');};
  el('visitId').addEventListener('input',refreshLinks);assign(null);controls();if(active())recoverList();
})();
