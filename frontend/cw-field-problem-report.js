(function () {
  'use strict';
  const store=window.CWFieldWriteStore, captured=store?.session();
  const button=document.getElementById('saveProblemBtn'), card=button?.closest('section');
  if(!store||!card)return;
  card.style.marginBottom='calc(96px + env(safe-area-inset-bottom, 0px))';
  const scope='FIELD_PROBLEM_REPORT', key=captured?'cwFieldProblemDraft:'+captured.owner:null;
  const fields={category:'problemCategory',type:'problemType',severity:'problemSeverity',message:'problemText'};
  const panel=document.getElementById('problemPanel');let opened=false;
  const nodes=Object.fromEntries(Object.entries(fields).map(([field,id])=>[field,document.getElementById(id)]));
  const payloadFields=['visitType','visitId','poolId',...Object.keys(fields)];
  const blank=()=>({v:1,owner:captured?.owner,visitType:'REGULAR',visitId:null,poolId:null,poolName:'',category:'Servico normal',type:'Agua turva',severity:'Normal',message:'',requestId:null});
  let draft=blank(), observed, state=null, busy=false, conflict=false, closed=false, revision=0, unsaved=false, ready=false;
  const target=document.createElement('p');target.id='problemReportContext';
  const status=document.createElement('p');status.id='problemReportStatus';status.setAttribute('role','status');
  const legacy=document.createElement('p');legacy.id='problemReportLegacyStatus';legacy.className='muted';
  const recover=document.createElement('button');recover.type='button';recover.id='recoverProblemReportBtn';recover.className='big';recover.hidden=true;
  card.querySelector('.admin-alert-grid').before(target);card.append(status,legacy,recover);
  nodes.message.maxLength=5000;nodes.message.setAttribute('aria-label','Descrição da ocorrência');
  for(const node of [target,status,legacy])node.style.overflowWrap='anywhere';
  function active(){return !closed&&store.same(captured);}
  function requireActive(){if(!active())throw Error('A sessão mudou. Reabra com a conta original para recuperar o registo.');}
  const id=value=>Number.isSafeInteger(value)&&value>0;
  const current=()=>{const value=window.CWFieldVisitContext?.();return value?.visitType==='REGULAR'&&id(value.id)&&id(value.poolId)?value:null;};
  const payload=value=>Object.fromEntries(payloadFields.map(field=>[field,value[field]]));
  const samePayload=(a,b)=>payloadFields.every(field=>a[field]===b[field]);
  const hasContent=value=>value.message!==''||value.category!=='Servico normal'||value.type!=='Agua turva'||value.severity!=='Normal';
  function read(){
    requireActive();const raw=localStorage.getItem(key);let value;
    try{value=raw?JSON.parse(raw):blank();}catch(_){throw Error('Rascunho do registo ilegível. Preserve os dados e peça apoio ao escritório.');}
    if(!value||Object.keys(value).length!==Object.keys(blank()).length||Object.keys(value).some(field=>!Object.hasOwn(blank(),field))||value.v!==1||value.owner!==captured.owner||value.visitType!=='REGULAR'||![value.visitId,value.poolId].every(value=>value===null||id(value))||Boolean(value.visitId)!==Boolean(value.poolId)||typeof value.poolName!=='string'||!['Servico normal','Extra / reparacao'].includes(value.category)||!['Agua turva','Equipamento','Fuga','Acesso bloqueado','Cliente ausente','Outro'].includes(value.type)||!['Normal','Urgente'].includes(value.severity)||typeof value.message!=='string'||value.message.length>5000||(value.requestId!==null&&!/^[0-9a-f-]{36}$/i.test(value.requestId)))throw Error('Rascunho da ocorrência ilegível. Preserve os dados e peça apoio ao escritório.');
    if(observed===undefined)observed=raw;return value;
  }
  function write(value){
    requireActive();read();
    if(localStorage.getItem(key)!==observed){conflict=true;throw Error('O registo mudou noutra janela. Copie o texto desta janela e reabra para rever o rascunho guardado.');}
    const raw=JSON.stringify(value);localStorage.setItem(key,raw);
    if(localStorage.getItem(key)!==raw)throw Error('Não foi possível confirmar a gravação neste dispositivo.');
    observed=raw;draft=value;unsaved=false;
  }
  function show(value){for(const field of Object.keys(fields))nodes[field].value=value[field];}
  function contextChanged(){
    const selected=current(), value=state?.payload||draft, original=id(value.visitId), same=!!selected&&(!original||selected.id===value.visitId&&selected.poolId===value.poolId);
    target.textContent=original?'Registo associado à visita '+value.visitId+' · '+(state?.label||draft.poolName||'Piscina '+value.poolId):selected?'Novo registo para a visita '+selected.id+' · '+(selected.poolName||'Piscina '+selected.poolId):'Selecione uma visita regular para preparar um novo registo.';
    panel.hidden=!opened;
    const locked=busy||conflict||!active()||!ready;
    for(const node of Object.values(nodes)){if(node.tagName==='SELECT')node.disabled=locked||!!state||(!selected&&!original);else node.readOnly=locked||!!state||(!selected&&!original);}
    button.disabled=locked||!!state||!same;
    button.hidden=!!state||(original&&!same);
    recover.hidden=!state&&!(original&&!same)&&!(hasContent(draft)&&!opened);
    recover.disabled=locked;
    recover.textContent=!opened?'Rever ocorrência guardada':state?.response?'Limpar rascunho confirmado':state?'Confirmar ocorrência guardada':'Enviar ocorrência da visita '+value.visitId;
  }
  function legacyNotice(){
    try{const raw=localStorage.getItem('cwFieldProblems');if(!raw){legacy.textContent='';return;}const rows=JSON.parse(raw);legacy.textContent=Array.isArray(rows)&&rows.length===0?'':'Há registos antigos de ocorrências sem conta confirmada neste dispositivo. Foram preservados; peça revisão ao escritório. Não serão enviados automaticamente.';}
    catch(_){legacy.textContent='O histórico antigo não pôde ser lido. Preserve os dados e peça revisão ao escritório.';}
  }
  async function refresh(){
    if(busy)return;const generation=++revision;
    if(!active()){show(blank());draft=blank();state=null;ready=false;target.textContent='';status.textContent='A sessão mudou. Reabra a página para recuperar as ocorrências da conta atual.';contextChanged();return;}
    try{
      const saved=read(),rows=await store.records(scope,captured,true);
      if(!active()||generation!==revision||busy)return;
      if(conflict){contextChanged();return;}
      if(!unsaved)draft=saved;
      state=rows.find(row=>!row.response)||(draft.requestId?rows.find(row=>row.requestId===draft.requestId):null);
      if(draft.requestId&&!state)throw Error('O registo do rascunho não foi encontrado. Preserve o texto e peça apoio ao escritório.');
      if(state&&draft.visitId&&!samePayload(draft,state.payload))throw Error('O rascunho difere do registo guardado. Ambos foram preservados; peça revisão antes de enviar.');
      if(state){draft={...blank(),...state.payload,poolName:state.label,requestId:state.requestId};show(draft);}else if(!unsaved)show(draft);
      if(!ready&&(state||hasContent(draft)))opened=true;ready=true;contextChanged();legacyNotice();
      const confirmed=state?.response||rows.filter(row=>row.response).at(-1)?.response;
      status.textContent=state&&!state.response?'Registo guardado neste dispositivo, por confirmar. '+(state.failure?.message||'Use Confirmar ocorrência guardada.'):unsaved?'O texto não ficou guardado. Conserve-o e tente novamente.':confirmed?'Registo #'+confirmed.problemReport.repairId+' registado para a administração. O registo não confirma leitura, orçamento ou reparação.':draft.visitId?'Rascunho guardado neste dispositivo; ainda não enviado.':'O registo ficará guardado nesta conta antes de enviar.';
    }catch(error){if(active()&&generation===revision){conflict=true;contextChanged();status.textContent=error.message;}}
  }
  function collect(){
    requireActive();const selected=current();
    if(!draft.visitId&&!selected)throw Error('Selecione uma visita regular antes de preparar o registo.');
    const value={...draft,...(!draft.visitId?{visitId:selected.id,poolId:selected.poolId,poolName:selected.poolName||'Piscina '+selected.poolId}:{}),...Object.fromEntries(Object.keys(fields).map(field=>[field,nodes[field].value]))};
    return hasContent(value)?value:blank();
  }
  function saveDraft(){
    if(busy||state||conflict||!ready)return;++revision;
    try{draft=collect();unsaved=true;write(draft);status.textContent='Rascunho guardado neste dispositivo; ainda não enviado.';}
    catch(error){status.textContent='O texto não ficou guardado. '+error.message;}
    contextChanged();
  }
  function clearConfirmed(){write(blank());state=null;opened=false;show(draft);}
  async function pendingSummary(){
    requireActive();const saved=read(), rows=await store.records(scope,captured,true);requireActive();const items=[];
    for(const row of rows.filter(row=>!row.response))items.push({kind:'pending',text:`Visita ${row.payload.visitId || 'sem associação'} — ocorrência por confirmar. Abra Mais → Extras / problemas${row.failure?.blocked?'; confirme o contexto com o escritório':''}.`});
    if((unsaved||hasContent(saved))&&!rows.some(row=>row.requestId===saved.requestId||!row.response&&samePayload(row.payload,saved)))items.push({kind:'pending',text:unsaved?'A ocorrência não ficou guardada. Conserve o texto em Mais → Extras / problemas.':`Visita ${saved.visitId} — rascunho de ocorrência por enviar em Mais → Extras / problemas.`});
    legacyNotice();if(legacy.textContent)items.push({kind:'unknown',text:legacy.textContent});
    return items;
  }
  async function send(){
    if(busy||conflict||!ready)return;busy=true;contextChanged();let message='';
    try{
      requireActive();
      if(!navigator.locks?.request)throw Error('Este navegador não permite coordenar as ocorrências. Preserve o texto.');
      await navigator.locks.request('cw-field-problem-draft:'+captured.owner,{ifAvailable:true},async lock=>{
        if(!lock)throw Error('O registo está em utilização noutra janela. Tente novamente.');
        requireActive();
        if(state?.response){clearConfirmed();return;}
        const value=state?{...draft,...state.payload,requestId:state.requestId}:collect();
        write(value);
        state=await store.prepare(scope,captured.technicianId,payload(value),{label:value.poolName},captured);
        write({...value,requestId:state.requestId});
        await store.send(state.requestId,captured);state=await store.get(state.requestId,captured);
        clearConfirmed();
      });
    }catch(error){message=error.message;}
    finally{busy=false;if(!message||state||!active())await refresh();else contextChanged();if(message&&active())status.textContent=(state?.response?'Registo já confirmado; o rascunho foi preservado. ':state?'Registo guardado, por confirmar. ':'O registo não foi enviado. ')+message;}
  }
  for(const node of Object.values(nodes))node.addEventListener(node.tagName==='SELECT'?'change':'input',saveDraft);
  function open(){requireActive();opened=true;contextChanged();nodes.message.focus();}
  function close(){opened=false;contextChanged();}
  recover.addEventListener('click',()=>opened?send():open());
  window.addEventListener('storage',event=>{if(event.key===key&&event.newValue!==observed&&!busy){conflict=true;status.textContent='O registo mudou noutra janela. Copie o texto desta janela e reabra para rever o rascunho guardado.';contextChanged();}if(!active())refresh();});
  window.addEventListener('cw:field-write-change',refresh);
  window.addEventListener('pagehide',()=>{closed=true;++revision;});
  window.addEventListener('pageshow',()=>{closed=false;refresh();});
  setInterval(()=>{if(!active())refresh();},1000);
  window.CWFieldProblemReport={send,refresh,contextChanged,pendingSummary,open,close};
  contextChanged();refresh();
})();
