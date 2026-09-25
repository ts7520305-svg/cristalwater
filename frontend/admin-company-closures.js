(function () {
  'use strict';
  const R=window.CWCompanyClosureRules, $=id=>document.getElementById(id), form=$('closureForm'), keys=['cristalwater_jwt','token','adminToken','cristalwater_user','user'];
  const API='/api/company-closures', fingerprint=()=>JSON.stringify(keys.map(key=>localStorage.getItem(key)));
  const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(R.canonical(value)))))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const text=(parent,tag,value)=>{const node=document.createElement(tag);node.textContent=value;parent.append(node);return node;};
  const note=(id,state,message)=>{const node=$(id);node.dataset.state=state;node.textContent=message;};
  let credential='',identity='',owner='',expires=0,invalid=false,busy=false,ready=false,storageBad=false,reading=false,sequence=0,observed=0,pending=null,templates=[],rows=[],loadedSelection=null;
  let editing=null,editStale=false;
  const controllers=new Set();
  try {
    identity=fingerprint();credential=keys.slice(0,3).map(key=>localStorage.getItem(key)).find(Boolean);
    const claims=JSON.parse(atob(credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))),id=Number(claims.userId||claims.id),users=keys.slice(3).map(key=>localStorage.getItem(key)).filter(Boolean).map(JSON.parse);
    if(claims.role!=='ADMIN'||!R.positive(id)||!Number.isFinite(claims.exp)||!users.length||users.some(user=>user.role!=='ADMIN'||Number(user.userId||user.id)!==id)||keys.slice(0,3).some(key=>localStorage.getItem(key)&&localStorage.getItem(key)!==credential))throw Error();
    owner='ADMIN:'+id;expires=claims.exp*1000;
  }catch(_){invalid=true;}
  const slot='cwCompanyClosures:v2:'+owner,draftSlot='cwCompanyClosureDraft:v2:'+owner;
  const editPrefix='cwCompanyClosureEdit:v1:'+owner+':',editActive=editPrefix+'active';
  function stop(){sequence++;for(const controller of controllers)controller.abort();controllers.clear();}
  function controls(){
    $('closureFields').disabled=invalid||busy||!!pending||storageBad||!ready;
    form.elements.status.disabled=!!editing;
    $('saveClosure').disabled=invalid||busy||!!pending||storageBad||!ready||editStale;
    for(const id of ['reloadClosureEdit','leaveClosureEdit'])$(id).disabled=invalid||busy||!!pending||storageBad;
    $('refreshClosures').disabled=invalid||busy||reading;
    for(const id of ['fromFilter','toFilter','statusFilter'])$(id).disabled=invalid||busy;
    document.querySelectorAll('[data-template]').forEach(button=>{button.disabled=invalid||busy||!!pending||storageBad||!ready||!!editing;});
    document.querySelectorAll('[data-operation]').forEach(button=>{button.disabled=invalid||busy||!!pending||storageBad||!ready;});
    $('closureRecovery').hidden=invalid||!pending;$('recoverClosure').disabled=invalid||busy||storageBad||!navigator.onLine;
  }
  function active(){
    let same=false;try{same=!invalid&&!!owner&&identity===fingerprint()&&expires>Date.now();}catch(_){}
    if(same)return true;
    if(!invalid||$('closureStatus').dataset.state!=='session'){
      invalid=true;stop();rows=[];templates=[];ready=false;reading=false;editing=null;editStale=false;form.reset();editView();$('closuresList').replaceChildren();$('closureImpact').replaceChildren();$('closureImpact').hidden=true;$('pendingClosure').textContent='';
      note('closureStatus','session','A sessão mudou ou terminou. Reabra a página com a conta pretendida.');note('writeStatus','session','Os pedidos e rascunhos foram conservados para a conta original.');controls();
    }
    return false;
  }
  function selection(){return {status:$('statusFilter').value,from:$('fromFilter').value,to:$('toFilter').value};}
  function validSelection(value){return ['','PLANNED','ACTIVE','CANCELLED'].includes(value.status)&&(!value.from||R.day(value.from))&&(!value.to||R.day(value.to))&&(!value.from||!value.to||value.from<=value.to);}
  function fields(){return Object.fromEntries(R.fieldKeys.map(key=>[key,R.booleans.includes(key)?form.elements[key].checked:form.elements[key].value]));}
  function assign(value){for(const [key,val] of Object.entries(value||{})){const node=form.elements[key];if(!node)continue;if(R.booleans.includes(key))node.checked=val;else node.value=val;}}
  function readLocal(){
    const raw=localStorage.getItem(slot),value=raw?JSON.parse(raw):{schema:2,owner,revision:0,pending:null,receipt:null};
    if(value?.schema!==2||value.owner!==owner||!Number.isSafeInteger(value.revision)||value.revision<0||value.pending&&(!R.command(value.pending.command)||!/^[a-f0-9]{64}$/.test(value.pending.payloadHash)))throw Error('O pedido local não pôde ser verificado. Conserve os dados e peça assistência.');
    if(value.pending?.review&&(!R.state(value.pending.review)||value.pending.command.operation!=='UPDATE'||value.pending.review.closure.id!==value.pending.command.closureId||value.pending.review.version!==value.pending.command.expectedVersion))throw Error('A revisão local não corresponde ao pedido guardado.');
    return value;
  }
  function saveLocal(value){const raw=JSON.stringify(value);localStorage.setItem(slot,raw);if(localStorage.getItem(slot)!==raw)throw Error('Não foi possível conservar o pedido neste navegador.');observed=value.revision;}
  function storeSession(key,value){const raw=JSON.stringify(value);sessionStorage.setItem(key,raw);if(sessionStorage.getItem(key)!==raw)throw Error('Não foi possível conservar o rascunho.');}
  function draft(){if(invalid||busy||pending)return;try{storeSession(editing?editPrefix+editing.closure.id:draftSlot,{owner,fields:fields(),...(editing?{review:editing}:{})});if(editing)storeSession(editActive,editing.closure.id);}catch(_){storageBad=true;note('writeStatus','error','Não foi possível conservar o rascunho. Mantenha esta janela; nenhum novo pedido será enviado.');controls();}}
  function validDraft(saved){return saved?.owner===owner&&R.exact(saved.fields,R.fieldKeys)&&Object.entries(saved.fields).every(([key,value])=>typeof value===(R.booleans.includes(key)?'boolean':'string'));}
  function editView(){
    $('closureFormTitle').textContent=editing?'Editar encerramento #'+editing.closure.id:'Novo encerramento';
    $('saveClosure').textContent=editing?'Guardar alterações':'Guardar encerramento';
    $('closureEditActions').hidden=!editing;$('closureEditStatus').hidden=!editing;
    $('closureEditStatus').textContent=editing?(editStale?'O registo mudou. O rascunho está conservado; carregue a versão atual antes de guardar.':'A editar a versão revista. Alterar a mensagem conserva as horas originais; mudar um dia define o início/fim desse dia UTC. Ativação e cancelamento continuam ações separadas.') : '';
    $('closureEditStatus').dataset.state=editStale?'conflict':editing?'editing':'idle';
  }
  function restoreCreate(){editing=null;editStale=false;form.reset();const raw=sessionStorage.getItem(draftSlot);if(raw){const saved=JSON.parse(raw);if(!validDraft(saved))throw Error('Rascunho original inválido.');assign(saved.fields);}sessionStorage.removeItem(editActive);editView();controls();}
  function recoverView(){
    $('pendingClosure').textContent=pending?'Pedido '+pending.command.requestId+' — '+pending.command.operation+'. Confirme este mesmo pedido antes de outra alteração.':'';
    if(pending&&pending.command.operation==='CREATE'){editing=null;editStale=false;assign(pending.command.fields);editView();}
    if(pending?.command.operation==='UPDATE'&&R.state(pending.review)){editing=pending.review;assign(pending.command.fields);editView();}controls();
  }
  async function request(path,method='GET',body){
    if(!active())throw Error('Sessão alterada.');
    const controller=new AbortController();controllers.add(controller);let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},15000);
    try{
      const response=await fetch(API+path,{method,headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:'no-store',redirect:'error'});
      if(!active())throw Error('Sessão alterada.');if(response.status===401||response.status===403){invalid=true;active();throw Error('Sessão terminada.');}
      if(![200,201].includes(response.status)||response.headers.get('X-CW-Module')!=='company-closures-v2'||response.headers.get('X-CW-Owner')!==owner||response.headers.get('cache-control')!=='private, no-store'||!(response.headers.get('content-type')||'').startsWith('application/json'))throw Error('A resposta não confirma esta operação.');
      const value=await response.json();if(!active())throw Error('Sessão alterada.');if(value?.ok!==true)throw Error('Não foi possível confirmar os dados.');return value;
    }catch(error){if(timedOut)throw Error('A consulta demorou demasiado. Conserve o pedido e tente confirmar novamente.');throw error;}
    finally{clearTimeout(timer);controllers.delete(controller);}
  }
  function render(){
    const box=$('closuresList');box.replaceChildren();
    if(!rows.length){text(box,'p','Nenhum encerramento nos dados confirmados destes filtros.');return;}
    for(const state of rows){
      const c=state.closure,card=text(box,'article','');card.className='closure';card.dataset.closureId=c.id;
      text(card,'h3',c.title);text(card,'span',c.status+' · '+c.closureType).className='badge';
      text(card,'p',new Date(c.startDate).toLocaleString('pt-PT',{timeZone:'UTC'})+' → '+new Date(c.endDate).toLocaleString('pt-PT',{timeZone:'UTC'})+' UTC');
      text(card,'p',c.messageTitle||'Sem título de mensagem');text(card,'p',c.messageBody||'Sem mensagem personalizada');
      text(card,'p','Preferências registadas; sem pausa ou reagendamento automático.').className='muted';
      const buttons=text(card,'div','');buttons.className='actions';
      for(const [operation,label] of [['EDIT','Editar'],['IMPACT','Ver impacto nas visitas'],['ACTIVATE','Ativar'],['NOTIFY','Gerar avisos'],['CANCEL','Cancelar']]){
        if(operation==='ACTIVATE'&&c.status!=='PLANNED'||operation==='NOTIFY'&&c.status!=='ACTIVE'||['CANCEL','EDIT'].includes(operation)&&c.status==='CANCELLED')continue;
        const button=text(buttons,'button',label);button.type='button';button.dataset.operation=operation;button.dataset.id=c.id;
      }
    }
  }
  async function load(){
    if(!active()||busy)return;stop();const generation=sequence,chosen=selection();ready=false;reading=true;rows=[];$('closuresList').replaceChildren();$('closureImpact').hidden=true;note('closureStatus','loading','A confirmar a lista e os modelos…');controls();
    if(!validSelection(chosen)){reading=false;note('closureStatus','error','Selecione datas e estado válidos.');controls();return;}
    try{
      const query=new URLSearchParams(Object.entries(chosen).filter(([,value])=>value)),[data,models]=await Promise.all([request('?'+query),request('/templates')]);
      if(!active()||generation!==sequence)return;
      // Browsers may restore date controls after this script has started the
      // first read. Bind the result to those visible values and reread them.
      if(!R.equal(selection(),chosen)){reading=false;load();return;}
      if(data.version!==2||data.limit!==100||typeof data.complete!=='boolean'||!R.equal(data.filters,chosen)||!Array.isArray(data.closures)||data.closures.length>100||data.closures.some(row=>!R.state(row))||new Set(data.closures.map(row=>row.closure.id)).size!==data.closures.length||models.version!==2||!Array.isArray(models.templates)||models.templates.some(t=>typeof t.id!=='string'||typeof t.title!=='string'||typeof t.messageTitle!=='string'||typeof t.messageBody!=='string'||!R.types.includes(t.closureType)))throw Error('A resposta não confirma a lista e os filtros.');
      if(!data.complete&&data.closures.length!==data.limit)throw Error('Lista parcial incompatível.');
      rows=data.closures;templates=models.templates;loadedSelection=chosen;ready=true;render();note('closureStatus',!data.complete?'partial':rows.length?'ready':'empty',!data.complete?'Lista parcial: 100 encerramentos apresentados. Restrinja as datas ou o estado.':rows.length+' encerramento(s) confirmado(s) nesta consulta.');
      if(editing){const latest=rows.find(row=>row.closure.id===editing.closure.id);if(latest&&latest.version!==editing.version)editStale=true;editView();}
      if(!storageBad){const local=readLocal();observed=local.revision;pending=local.pending;recoverView();}
    }catch(error){if(active()&&generation===sequence){ready=false;rows=[];$('closuresList').replaceChildren();note('closureStatus','error','Não foi possível confirmar a lista ou os modelos. Use Atualizar lista.');}}
    finally{if(active()&&generation===sequence){reading=false;controls();}}
  }
  async function verify(result,record){
    const command=record.command,receipt=result?.receipt;
    if(result?.ok!==true||typeof result.applied!=='boolean'||!R.equal(result.context,R.intent(command))||receipt?.owner!==owner||receipt.scope!==R.scope||receipt.resourceId!==(command.closureId||1)||receipt.requestId!==command.requestId||receipt.payloadHash!==record.payloadHash||!Number.isFinite(Date.parse(receipt.confirmedAt)))throw Error('Resposta sem comprovativo do pedido original.');
    if(!result.applied){if(typeof result.code!=='string'||typeof result.message!=='string')throw Error('Resultado de revisão inválido.');return;}
    if(!R.state(result.state)||!R.positive(result.auditId)||!Number.isSafeInteger(result.createdNotifications)||result.createdNotifications<0||result.automaticReplanning!==false||command.closureId&&result.state.closure.id!==command.closureId)throw Error('Comprovativo incompatível com o encerramento.');
    const c=result.state.closure;
    const edited=command.operation==='UPDATE'&&record.review?R.updateValues(record.review.closure,command.fields):null;
    if(['CREATE','UPDATE'].includes(command.operation))for(const [key,value] of Object.entries(command.fields)){const expected=edited?edited[key]:key==='startDate'?value+'T00:00:00.000Z':key==='endDate'?value+'T23:59:59.999Z':value;if(c[key]!==expected)throw Error('Campos não confirmados pelo comprovativo.');}
    if(command.operation==='CANCEL'&&c.status!=='CANCELLED'||command.operation==='ACTIVATE'&&c.status!=='ACTIVE'||command.operation!=='NOTIFY'&&result.createdNotifications!==0)throw Error('A operação não foi confirmada.');
  }
  async function transport(record){
    if(!R.command(record.command)||record.payloadHash!==await hash(R.envelope(record.command)))throw Error('Conserve o pedido local original.');
    if(record.command.operation==='UPDATE'&&record.review&&(!R.state(record.review)||record.review.closure.id!==record.command.closureId||record.review.version!==record.command.expectedVersion))throw Error('A versão revista do rascunho não foi confirmada.');
    const saved=await request('/requests/'+record.command.requestId);if(typeof saved.found!=='boolean')throw Error('Consulta de comprovativo inválida.');
    const result=saved.found?saved.result:await request('/commands','POST',record.command);await verify(result,record);if(!active())return;
    const local=readLocal();if(!R.equal(local.pending,record))throw Error('O pedido local mudou. Conserve os dados e volte a confirmar.');
    saveLocal({...local,revision:local.revision+1,pending:null,receipt:result});pending=null;ready=false;
    if(result.applied&&record.command.operation==='CREATE'){
      const raw=sessionStorage.getItem(draftSlot);if(raw&&R.equal(JSON.parse(raw).fields,record.command.fields))sessionStorage.removeItem(draftSlot);
      restoreCreate();
    }
    if(record.command.operation==='UPDATE'){
      if(result.applied){editing=result.state;editStale=false;assign(R.editable(editing));try{storeSession(editPrefix+editing.closure.id,{owner,review:editing,fields:fields()});storeSession(editActive,editing.closure.id);}catch(_){storageBad=true;}}
      else{editStale=true;}
      editView();
    }
    note('writeStatus',result.applied?'confirmed':'conflict',result.applied?(record.command.operation==='NOTIFY'?result.createdNotifications+' aviso(s) criado(s) uma única vez. ':'Alteração confirmada. ')+(storageBad?'O comprovativo foi conservado, mas não foi possível atualizar o rascunho. Novas alterações bloqueadas.':'Atualize a lista antes de outra operação.'):result.message);recoverView();
  }
  async function edit(closureId,fresh=false){
    if(!active()||busy||pending||storageBad||!R.positive(closureId))return;
    draft();if(storageBad)return;let selected=false;busy=true;reading=false;stop();const generation=sequence;controls();
    try{
      const data=await request('/'+closureId);
      if(!active()||generation!==sequence)return;
      if(data.version!==2||!R.state(data.state)||data.state.closure.id!==closureId)throw Error('Não foi possível confirmar este encerramento.');
      if(data.state.closure.status==='CANCELLED'){if(editing?.closure.id===closureId)editStale=true;throw Error('Este encerramento foi cancelado. O rascunho foi conservado.');}
      if(!R.fields(R.editable(data.state)))throw Error('Este registo usa opções antigas que o formulário não consegue representar. O original foi conservado.');
      const raw=sessionStorage.getItem(editPrefix+closureId),saved=raw?JSON.parse(raw):null;
      if(saved&&(!validDraft(saved)||!R.state(saved.review)||saved.review.closure.id!==closureId)){storageBad=true;throw Error('O rascunho guardado não pôde ser confirmado. Conserve os dados.');}
      if(fresh&&saved&&!R.equal(saved.fields,R.editable(saved.review))&&!confirm('Descartar as alterações deste rascunho e carregar a versão atual do encerramento #'+closureId+'?'))return;
      editing=!fresh&&saved?saved.review:data.state;editStale=editing.version!==data.state.version;
      assign(!fresh&&saved?saved.fields:R.editable(editing));editView();
      try{storeSession(editPrefix+closureId,{owner,review:editing,fields:fields()});storeSession(editActive,closureId);}catch(_){storageBad=true;throw Error('Não foi possível conservar a revisão; nenhum pedido será enviado.');}
      selected=true;
      note('writeStatus',editStale?'conflict':'review',editStale?'A versão guardada mudou. O rascunho permanece no formulário; use Carregar versão atual para o substituir explicitamente.':'Reveja os campos de #'+closureId+' antes de guardar. Guardar não emite novamente os avisos já criados.');
    }catch(error){if(active())note('writeStatus','error',error.message);}
    finally{if(active()){busy=false;editView();controls();if(selected)await load();}}
  }
  async function send(command,repeat=false){
    if(!active()||busy||storageBad||!navigator.locks?.request||!repeat&&(!ready||pending))return;
    const revision=observed;busy=true;reading=false;stop();controls();note('writeStatus','saving','A conservar e confirmar o pedido…');
    try{await navigator.locks.request(slot,async()=>{
      if(!active())return;const local=readLocal();pending=local.pending;
      if(pending){recoverView();if(repeat)await transport(pending);else note('writeStatus','pending','Já existe um pedido por confirmar. Use Confirmar pedido guardado.');return;}
      if(repeat||local.revision!==revision){ready=false;note('writeStatus','conflict','Outra janela atualizou os pedidos. Atualize a lista e reveja antes de enviar.');return;}
      if(!R.command(command))throw Error('Reveja o título, datas e opções.');
      const record={command,payloadHash:await hash(R.envelope(command)),...(command.operation==='UPDATE'?{review:editing}:{})};if(!active())return;
      saveLocal({...local,revision:local.revision+1,pending:record});pending=record;recoverView();await transport(record);
    });}catch(error){if(active())note('writeStatus',pending?'pending':'error',pending?'O resultado ainda não está confirmado. O pedido original foi conservado; use Confirmar pedido guardado.':error.message);}
    finally{if(active()){busy=false;recoverView();controls();}}
  }
  async function action(operation,closureId){
    if(!active()||busy||pending||!ready)return;const state=rows.find(row=>row.closure.id===closureId);if(!state)return;
    if(operation==='EDIT'){await edit(closureId);return;}
    if(operation==='IMPACT'){
      busy=true;controls();$('closureImpact').hidden=false;$('closureImpact').textContent='A confirmar o impacto…';const generation=sequence;
      try{const data=await request('/'+closureId+'/route-impact');if(!active()||generation!==sequence)return;const impact=data.impact;if(data.version!==2||!R.state(data.state)||data.state.closure.id!==closureId||data.state.version!==state.version||impact?.visitType!=='REGULAR'||typeof impact.complete!=='boolean'||impact.limit!==500||!Array.isArray(impact.visits)||impact.totalVisits!==impact.visits.length||impact.normalVisits!==null||impact.criticalVisits!==null||impact.unclassifiedVisits!==impact.totalVisits||impact.classification!=='UNCONFIRMED_NO_RECORDED_PRIORITY')throw Error();$('closureImpact').textContent=(impact.complete?'':'DADOS PARCIAIS — limite de 500 visitas.\n')+'Visitas regulares: '+impact.totalVisits+'\nPrioridade por rever: '+impact.unclassifiedVisits+'\n'+impact.recommendation;}
      catch(_){if(active())$('closureImpact').textContent='Não foi possível confirmar este impacto. Atualize a lista e tente novamente.';}
      finally{if(active()){busy=false;controls();}}return;
    }
    let data={};
    if(operation==='CANCEL'){const reason=prompt('Motivo para cancelar este encerramento? Os avisos já criados não serão apagados.');if(reason===null)return;if(!reason.trim()){note('writeStatus','error','Indique um motivo; o encerramento não foi cancelado.');return;}data={reason};}
    if(operation==='NOTIFY'&&!confirm('Criar avisos na aplicação para os destinatários selecionados? Só é permitida uma emissão por encerramento.'))return;
    if(operation==='ACTIVATE'&&!confirm('Ativar este encerramento? As rondas não serão alteradas automaticamente.'))return;
    await send({requestId:crypto.randomUUID(),operation,closureId,expectedVersion:state.version,fields:data});
  }
  for(const input of form.querySelectorAll('[name]')){input.id='closure-'+input.name;const label=input.previousElementSibling;if(label?.tagName==='LABEL')label.htmlFor=input.id;}
  form.addEventListener('input',draft);form.addEventListener('change',draft);
  form.addEventListener('submit',event=>{event.preventDefault();if(!active()||busy||pending||!ready||editStale)return;const data=fields();if(!R.fields(data)){note('writeStatus','error','Reveja o título, datas e opções. Nada foi enviado.');return;}if(editing&&R.equal(data,R.editable(editing))){note('writeStatus','review','Não há alterações para guardar.');return;}if(editing&&data.status!==editing.closure.status){note('writeStatus','error','Use a ação explícita de ativação ou cancelamento.');return;}draft();if(!storageBad)send({requestId:crypto.randomUUID(),operation:editing?'UPDATE':'CREATE',closureId:editing?.closure.id||null,expectedVersion:editing?.version||null,fields:data});});
  document.querySelectorAll('[data-template]').forEach(button=>button.addEventListener('click',()=>{if(!active()||busy||pending||!ready||editing)return;const template=templates.find(row=>row.id===button.dataset.template);if(template){assign({title:template.title,messageTitle:template.messageTitle,messageBody:template.messageBody,closureType:template.closureType});draft();}}));
  $('closuresList').addEventListener('click',event=>{const button=event.target.closest('[data-operation]');if(button)action(button.dataset.operation,Number(button.dataset.id));});
  $('refreshClosures').addEventListener('click',load);$('recoverClosure').addEventListener('click',()=>send(null,true));
  $('reloadClosureEdit').addEventListener('click',()=>{if(editing)edit(editing.closure.id,true);});
  $('leaveClosureEdit').addEventListener('click',()=>{if(!active()||busy||pending||storageBad)return;draft();if(storageBad)return;try{restoreCreate();}catch(_){storageBad=true;note('writeStatus','error','O rascunho foi conservado; não foi possível recuperar o formulário original.');controls();}});
  for(const id of ['fromFilter','toFilter','statusFilter'])$(id).addEventListener('input',()=>{if(!active()||busy)return;stop();ready=false;reading=false;rows=[];$('closuresList').replaceChildren();$('closureImpact').hidden=true;note('closureStatus','idle','Os filtros mudaram. Use Atualizar lista.');controls();});
  window.addEventListener('storage',event=>{if(!active())return;if(event.key===slot&&!busy){ready=false;try{const local=readLocal();pending=local.pending;recoverView();note('writeStatus','review','Outra janela atualizou os pedidos. Atualize a lista antes de outra alteração.');}catch(_){storageBad=true;note('writeStatus','error','O pedido guardado não pôde ser verificado. Conserve os dados e peça assistência.');controls();}}});
  function observe(){if(active()&&ready&&!busy&&!reading&&!R.equal(selection(),loadedSelection)){ready=false;rows=[];$('closuresList').replaceChildren();$('closureImpact').hidden=true;note('closureStatus','idle','Os filtros mudaram. Use Atualizar lista.');controls();}}
  window.addEventListener('focus',observe);setInterval(observe,500);window.addEventListener('pagehide',()=>{stop();ready=false;controls();});
  window.addEventListener('online',()=>{if(active())controls();});window.addEventListener('offline',()=>{if(active())controls();});
  for(const id of ['closuresList','closureStatus','writeStatus','closureImpact'])$(id).dataset.cwStateManaged='manual';
  if(active()){
    try{if(!navigator.locks?.request||!crypto.subtle||!crypto.randomUUID)throw Error();const local=readLocal();observed=local.revision;pending=local.pending;const raw=sessionStorage.getItem(draftSlot);if(raw){const saved=JSON.parse(raw);if(!validDraft(saved))throw Error();assign(saved.fields);}const activeRaw=sessionStorage.getItem(editActive);if(activeRaw){const id=JSON.parse(activeRaw),saved=JSON.parse(sessionStorage.getItem(editPrefix+id));if(!R.positive(id)||!validDraft(saved)||!R.state(saved.review)||saved.review.closure.id!==id)throw Error();editing=saved.review;assign(saved.fields);editView();}recoverView();}
    catch(_){storageBad=true;note('writeStatus','error','Recuperação local indisponível. Os dados foram conservados; novas alterações estão bloqueadas.');}
    controls();load();
  }
}());
