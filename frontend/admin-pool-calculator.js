(function(){
  'use strict';
  const R=window.CWPoolCalculatorRules,fields=R.fieldKeys;
  const $=id=>document.getElementById(id),root=$('poolCalculator'),keys=['cristalwater_jwt','token','adminToken','cristalwater_user','user'];
  const defaults=Object.fromEntries(fields.map(id=>[id,$(id).value]));
  const blocks=['geometry','filtration','salt','chlorination','heatPump','chemistry','recommendations'];
  const positive=id=>Number.isInteger(id)&&id>0&&id<=2147483647;
  const validId=value=>/^[1-9]\d*$/.test(String(value))&&positive(Number(value));
  const fingerprint=()=>JSON.stringify(keys.map(k=>localStorage.getItem(k)));
  const payload=()=>Object.fromEntries(fields.map(id=>[id,$(id).value]));
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(value,suffix='')=>value===null||value===undefined?'-':String(value)+suffix;
  const row=(label,value)=>'<div class="resultRow"><span>'+esc(label)+'</span><span class="value">'+esc(value??'-')+'</span></div>';
  let session=null,invalid=false,suspended=false,sequence=0,request=null,poolsReady=false,loadedId=null,baseline=null,resultInput=null,loading=false,saving=false,uncertain=false,review=null,store=null,durable=null,storageBlocked=false,drafts=null,draftBlocked=false,draftStale=false;
  try{
    const token=keys.slice(0,3).map(k=>localStorage.getItem(k)).find(Boolean);
    const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))),id=Number(claims.userId||claims.id);
    const users=keys.slice(3).map(k=>localStorage.getItem(k)).filter(Boolean).map(JSON.parse);
    if(claims.role!=='ADMIN'||!positive(id)||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||!users.length||users.some(u=>u.role!=='ADMIN'||Number(u.userId||u.id)!==id)||keys.slice(0,3).some(k=>localStorage.getItem(k)&&localStorage.getItem(k)!==token))throw Error();
    session={token,identity:fingerprint(),expires:claims.exp*1000,owner:'ADMIN:'+id};
    store=window.CWPoolCalculatorStore.open(session.owner);
  }catch(_){invalid=true;}
  if(!invalid)try{drafts=window.CWPoolCalculatorDrafts.open(session.owner,sessionStorage);}catch(_){}
  function abort(){sequence++;if(request){request.controller.abort();clearTimeout(request.timer);request=null;}}
  function clearResults(){resultInput=null;for(const id of blocks)$(id).replaceChildren();for(const id of ['kVolume','kArea','kSalt','kHeat'])$(id).textContent='-';}
  function controls(){
    const blocked=invalid||suspended||loading||saving||uncertain||storageBlocked||draftBlocked||draftStale||!!durable?.pending||!loadedId;
    for(const id of fields)$(id).disabled=invalid||suspended||loading||saving||uncertain||storageBlocked||draftStale||!!durable?.pending||!loadedId;
    document.querySelectorAll('[data-calculator-action]').forEach(button=>{const action=button.dataset.calculatorAction;button.disabled=action==='reload'?invalid||suspended||saving||storageBlocked||draftBlocked||!!durable?.pending:blocked;});
    $('poolId').disabled=invalid||suspended||saving||uncertain||storageBlocked||draftBlocked||!!durable?.pending||!poolsReady;
    $('recovery').hidden=invalid||storageBlocked||!durable?.pending;
    $('recoverRequest').disabled=invalid||suspended||saving||storageBlocked;
    $('retryDraft').hidden=invalid||!draftBlocked||!!durable?.pending;
    $('retryDraft').disabled=invalid||suspended||loading||saving||!loadedId;
    root.setAttribute('aria-busy',String(loading||saving));
  }
  function status(state,message){root.dataset.state=state;$('status').textContent=message;$('status').setAttribute('role',['error','session','uncertain','storage','conflict','draft-error'].includes(state)?'alert':'status');controls();if(['uncertain','storage','conflict','draft-error'].includes(state)&&!root.hidden)$('status').scrollIntoView({block:'center'});}
  function blank(){$('draftStatus').textContent='';for(const id of fields)$(id).value='';$('poolBadge').textContent='Piscina';clearResults();}
  function active(){
    try{if(!invalid&&session.identity===fingerprint()&&session.expires>Date.now())return true;}catch(_){}
    invalid=true;abort();loadedId=null;baseline=null;loading=false;saving=false;blank();$('poolId').replaceChildren();poolsReady=false;
    status('session','A sessão mudou ou expirou. Volta a entrar e reabre a calculadora.');return false;
  }
  function setFields(values={}){
    for(const id of fields){
      const control=$(id);control.querySelectorAll?.('[data-original-option]').forEach(option=>option.remove());
      const value=values[id]===undefined||values[id]===null?defaults[id]:String(values[id]);
      if(control.tagName==='SELECT'&&value!==''&&![...control.options].some(option=>option.value===value)){
        const option=document.createElement('option');option.value=value;option.textContent=value+' (valor guardado)';option.dataset.originalOption='true';control.append(option);
      }
      control.value=value;
    }
  }
  function fill(data){
    setFields(data.fields);review=data;
    $('poolBadge').textContent=(data.pool.client?.name||'Cliente')+' · '+(data.pool.name||'Piscina #'+data.pool.id);
    baseline=payload();
  }
  const dirty=()=>!!baseline&&!same(payload(),baseline);
  function discard(mode){return !(dirty()||uncertain||draftStale)||window.confirm(mode==='switch'?'Conservar o rascunho desta piscina e abrir a piscina selecionada?':uncertain||draftStale?'A ficha mudou ou este pedido não foi aplicado. Descartar estes campos e carregar a versão atual?':'Descartar as alterações ainda não guardadas nesta piscina?');}
  function draftFailure(){draftBlocked=true;clearResults();$('draftStatus').textContent='Não foi possível conservar ou validar o rascunho. Mantém este separador aberto: os campos visíveis ainda não foram guardados. O rascunho anterior foi conservado.';$('draftStatus').setAttribute('role','alert');controls();}
  function conserveDraft(){
    if(!review||!loadedId||invalid||suspended||durable?.pending)return false;
    try{if(fields.some(id=>$(id).validity.badInput))throw Error('Incomplete numeric field');drafts.save(review,payload());draftBlocked=false;$('draftStatus').textContent='Rascunho conservado neste separador e nesta conta. A ficha só muda ao guardar.';$('draftStatus').setAttribute('role','status');controls();return true;}catch(_){draftFailure();return false;}
  }
  function retryCalculatorDraft(){if(active()&&!suspended&&!saving&&!loading&&!durable?.pending&&loadedId&&conserveDraft())status(draftStale?'conflict':'edited',draftStale?'A ficha mudou. O rascunho foi conservado; recarrega para rever a versão atual.':'Rascunho conservado. Calcula novamente para consultar os campos atuais.');}
  function validCalculation(c){
    if(!c||typeof c!=='object'||!Number.isFinite(Date.parse(c.generatedAt))||!Array.isArray(c.recommendations)||!c.recommendations.every(x=>typeof x==='string'))return false;
    for(const key of ['geometry','filtration','salt','chlorination','heatPump']){
      const value=c[key];if(!value||typeof value!=='object'||Array.isArray(value))return false;
      if(!Object.values(value).every(x=>x===null||typeof x==='string'||typeof x==='boolean'||typeof x==='number'&&Number.isFinite(x)||Array.isArray(x)&&x.every(y=>typeof y==='string')))return false;
    }
    if(!['volumeM3','surfaceM2','volumeLitres'].every(key=>typeof c.geometry[key]==='number'&&Number.isFinite(c.geometry[key])))return false;
    return c.chemistry===undefined||c.chemistry&&typeof c.chemistry==='object'&&!Array.isArray(c.chemistry)&&Object.values(c.chemistry).every(x=>x===null||typeof x==='number'&&Number.isFinite(x));
  }
  async function read(url,body,typed=false){
    const generation=sequence,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);request={controller,timer};
    try{
      const response=await fetch(url,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+session.token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal,cache:'no-store',redirect:'error'});
      if(!active()||suspended||generation!==sequence)throw Error('Obsolete');
      if(response.status===401||response.status===403){invalid=true;active();throw Error('Session');}
      if(response.status!==200||!(response.headers.get('content-type')||'').startsWith('application/json'))throw Error('Unconfirmed response');
      if(typed&&(response.headers.get('X-CW-Calculator')!=='pool-calculator-v2'||response.headers.get('X-CW-Owner')!==session.owner))throw Error('Response owner mismatch');
      const data=await response.json();
      if(!active()||suspended||generation!==sequence||data?.ok!==true)throw Error('Unconfirmed body');
      return data;
    }finally{clearTimeout(timer);if(generation===sequence)request=null;}
  }
  function selectionFromUrl(){
    const query=new URLSearchParams(location.search),ids=[...query.getAll('poolId'),...query.getAll('id')];
    return !ids.length?null:ids.length===1&&validId(ids[0])?ids[0]:false;
  }
  function writeUrl(id){const url=new URL(location.href);url.searchParams.delete('id');url.searchParams.set('poolId',id);history.replaceState(null,'',url);}
  async function loadPools(){
    if(!active()||suspended)return;abort();const generation=sequence;loading=true;loadedId=null;baseline=null;poolsReady=false;blank();status('loading','A carregar piscinas…');
    try{
      const data=await read('/api/pools');if(generation!==sequence)return;
      if(!Array.isArray(data.pools)||data.pools.some(p=>!positive(p.id)||typeof p.name!=='string')||new Set(data.pools.map(p=>p.id)).size!==data.pools.length)throw Error('Invalid pools');
      $('poolId').replaceChildren();
      for(const pool of data.pools){const option=document.createElement('option');option.value=String(pool.id);option.textContent=(pool.client?.name?pool.client.name+' · ':'')+(pool.name||'Piscina #'+pool.id);$('poolId').append(option);}
      poolsReady=true;loading=false;
      if(!data.pools.length){status('empty','Não há piscinas disponíveis.');return;}
      const selected=selectionFromUrl();
      if(selected===false||selected!==null&&!data.pools.some(p=>String(p.id)===selected)){$('poolId').value='';status('error','A piscina indicada não está disponível. Escolhe uma piscina da lista.');return;}
      if(selected!==null)$('poolId').value=selected;
      await loadPool(true,'restore');
    }catch(_){if(active()&&!suspended&&generation===sequence){loading=false;poolsReady=false;$('poolId').replaceChildren();status('error','Não foi possível carregar as piscinas. Tenta recarregar.');}}
  }
  async function loadPool(confirmed=false,mode='reload'){
    if(!active()||suspended||saving||storageBlocked||draftBlocked||durable?.pending)return;
    if(!poolsReady){await loadPools();return;}
    const target=$('poolId').value;
    if(!confirmed&&!discard(mode)){$('poolId').value=loadedId||'';if(loadedId)writeUrl(loadedId);return;}
    if(mode==='switch'&&loadedId&&dirty()&&!conserveDraft()){$('poolId').value=loadedId;writeUrl(loadedId);return;}
    abort();const generation=sequence;uncertain=false;draftStale=false;loadedId=null;baseline=null;loading=true;blank();
    if(!validId(target)){loading=false;status('error','Escolhe uma piscina válida.');return;}
    writeUrl(target);status('loading','A carregar a ficha da piscina selecionada…');
    try{
      const data=await read('/api/pool-calculations/'+target+'/edit-state',undefined,true);
      if(generation!==sequence||$('poolId').value!==target)return;
      if(!R.state(data)||data.poolId!==Number(target))throw Error('Pool mismatch');
      if(durable?.confirmed&&!durable.confirmed.result.applied)durable=await store.clear();
      if(!active()||suspended||generation!==sequence)return;
      let saved;try{saved=drafts.read(Number(target));if(mode==='reload'){drafts.discard(Number(target));saved=null;}else if(durable?.confirmed?.result.applied&&window.CWPoolCalculatorDrafts.sameRequest(saved,durable.confirmed.record)){drafts.finish(durable.confirmed.record);saved=null;}}catch(_){fill(data);loadedId=target;loading=false;draftFailure();status('draft-error','O rascunho guardado não pôde ser confirmado. Conservámos os bytes originais; nenhum novo pedido será enviado.');return;}
      fill(saved?saved.review:data);loadedId=target;loading=false;clearResults();
      if(saved){setFields(saved.fields);draftStale=saved.review.version!==data.version;$('draftStatus').textContent='Rascunho recuperado neste separador, para esta piscina e esta conta.';status(draftStale?'conflict':'edited',draftStale?'A ficha mudou desde a revisão deste rascunho. Os campos foram conservados; recarrega para descartar e consultar a versão atual.':'Rascunho recuperado. Calcula novamente antes de consultar os resultados.');return;}
      resultInput=payload();status('ready','Ficha carregada. Calcula para consultar os resultados dos campos visíveis. Os campos em falta usam os valores iniciais indicados; as medições químicas guardadas pertencem ao último cálculo desta piscina.');
    }catch(_){if(active()&&!suspended&&generation===sequence){loading=false;loadedId=null;baseline=null;blank();status('error','Não foi possível confirmar a ficha desta piscina. Tenta recarregar.');}}
  }
  function changed(){
    if(!active()||suspended||loading||saving||uncertain||storageBlocked||draftStale||durable?.pending||!loadedId)return;
    abort();clearResults();conserveDraft();status('edited','Campos alterados. Calcula novamente para obter resultados correspondentes a estes valores.');
  }
  function validInputs(){return fields.every(id=>$(id).validity.valid&&($(id).type!=='number'||$(id).value===''||Number.isFinite(Number($(id).value))));}
  function storageFailure(){storageBlocked=true;saving=false;clearResults();status('storage','Não foi possível conservar ou validar o pedido neste navegador, ou outra janela o alterou. Os campos continuam visíveis. Reabre a página para verificar o pedido guardado antes de continuar.');}
  function restore(record){
    loadedId=String(record.poolId);const option=document.createElement('option');option.value=loadedId;option.textContent=(record.review.pool.client?.name||'Cliente')+' · '+record.review.pool.name;
    $('poolId').replaceChildren(option);poolsReady=true;fill(record.review);setFields(record.command.fields);writeUrl(loadedId);clearResults();
  }
  async function recoverCalculation(){
    if(!active()||suspended||saving||storageBlocked||!durable?.pending)return;
    try{if(!store.unchanged()){storageFailure();return;}}catch(_){storageFailure();return;}
    abort();const generation=sequence,record=durable.pending;saving=true;uncertain=true;clearResults();status('saving','A confirmar o pedido guardado…');
    try{
      const recovered=await read('/api/pool-calculations/requests/'+record.command.requestId,undefined,true);
      if(typeof recovered.found!=='boolean')throw Error('Invalid recovery');
      if(!store.unchanged())throw Error('Request changed');
      const result=recovered.found?recovered.result:await read('/api/pool-calculations/'+record.poolId+'/reviewed',record.command,true);
      if(!R.confirmation(result,record,session.owner)||result.applied&&!validCalculation(result.calculation))throw Error('Unconfirmed receipt');
      durable=await store.confirm(result);
      if(!active()||suspended||generation!==sequence)return;
      saving=false;uncertain=!result.applied;
      if(result.applied){fill(result.state);draftStale=false;try{drafts.finish(record);$('draftStatus').textContent='O pedido foi confirmado; o rascunho correspondente foi concluído.';}catch(_){draftFailure();}const unchanged=R.equal(payload(),record.command.fields);if(unchanged){renderCalculation(result.calculation);resultInput=payload();}else clearResults();status('saved',unchanged?'Gravação confirmada para este pedido. Recarrega para consultar eventuais alterações posteriores.':'Gravação confirmada. Os campos apresentados seguem os valores guardados; calcula novamente para consultar os resultados destes campos.');}
      else {restore(record);status('conflict',result.message+' Os teus campos foram conservados.');}
    }catch(_){if(active()&&!suspended&&generation===sequence){saving=false;uncertain=true;clearResults();status('uncertain','A resposta não foi confirmada. O pedido e os campos continuam guardados neste navegador. Usa «Confirmar pedido guardado» para verificar o mesmo pedido.');}}
  }
  async function calculate(save){
    if(!active()||suspended||loading||saving||uncertain||storageBlocked||draftBlocked||draftStale||durable?.pending||!loadedId||loadedId!==$('poolId').value)return;
    if(!validInputs()||!R.fields(payload())){clearResults();status('error','Revê os campos numéricos assinalados antes de calcular.');fields.find(id=>!$(id).validity.valid)&&$(fields.find(id=>!$(id).validity.valid)).reportValidity();return;}
    abort();const generation=sequence,target=loadedId,input=payload();clearResults();saving=save;
    status(save?'saving':'previewing',save?'A conservar o pedido antes de guardar…':'A calcular os valores atuais…');
    if(save){
      if(!conserveDraft()){saving=false;controls();return;}
      try{durable=await store.prepare(review,input);}catch(_){if(active()&&!suspended&&generation===sequence)storageFailure();return;}
      saving=false;if(!active()||suspended||generation!==sequence)return;
      await recoverCalculation();return;
    }
    try{
      const data=await read('/api/pool-calculations/preview',input);
      if(generation!==sequence||!active()||suspended||loadedId!==target||$('poolId').value!==target||!same(payload(),input))return;
      if(!validCalculation(data.calculation))throw Error('Unconfirmed calculation');
      renderCalculation(data.calculation);resultInput=input;status('preview','Pré-visualização calculada para os campos atuais. Ainda não foi guardada.');
    }catch(_){if(active()&&!suspended&&generation===sequence){clearResults();status('error','Não foi possível confirmar o cálculo. Os campos foram conservados; tenta novamente.');}}
  }
  async function start(){
    if(!active())return;
    try{durable=await store.read();}catch(_){if(active())storageFailure();return;}
    if(!active()||suspended)return;
    if(durable.pending){restore(durable.pending);uncertain=true;status('uncertain','Existe um pedido por confirmar nesta conta. Os campos foram recuperados; confirma o pedido guardado antes de continuar.');return;}
    if(durable.confirmed&&!durable.confirmed.result.applied){restore(durable.confirmed.record);uncertain=true;status('conflict',durable.confirmed.result.message+' Os teus campos foram conservados.');return;}
    await loadPools();
  }
  function renderBlock(id,rows){$(id).innerHTML=rows.join('');}
  function renderCalculation(c){
    const input=payload(),number=id=>input[id]===''?null:Number(input[id]),has=id=>number(id)!==null&&Number.isFinite(number(id)),positive=id=>has(id)&&number(id)>0;
    const shape=input.shape.toUpperCase(),area=positive('surfaceM2')||(['ROUND','CIRCULAR'].includes(shape)?positive('diameterM'):['RECTANGULAR','OVAL','KIDNEY','FREEFORM'].includes(shape)&&positive('lengthM')&&positive('widthM')&&(!['KIDNEY','FREEFORM'].includes(shape)||positive('shapeFactor')));
    const volume=positive('volumeM3')||area&&(positive('averageDepthM')||positive('depthMinM')&&positive('depthMaxM'));
    const filtration=volume&&positive('pumpFlowM3h'),salt=volume&&has('saltCurrentPpm')&&number('saltCurrentPpm')>=0&&positive('targetSalinityPpm');
    const chlorination=volume&&positive('chlorinatorGph')&&has('chlorineCurrentPpm')&&number('chlorineCurrentPpm')>=0&&positive('targetChlorinePpm');
    const heat=volume&&has('currentWaterTempC')&&has('targetWaterTempC')&&positive('heatPumpThermalKw');
    const missing=text=>['<p class="note">Dados insuficientes. '+esc(text)+'</p>'];
    $('kVolume').textContent=volume?fmt(c.geometry.volumeM3,' m³'):'-';$('kArea').textContent=area?fmt(c.geometry.surfaceM2,' m²'):'-';$('kSalt').textContent=salt?fmt(c.salt.saltKgToAdd,' kg'):'-';$('kHeat').textContent=heat?fmt(c.heatPump.estimatedHoursToTarget,' h'):'-';
    const recommendations=[];
    if(salt)recommendations.push('Sal para o alvo indicado: '+fmt(c.salt.saltKgToAdd,' kg')+'.');
    if(filtration)recommendations.push(c.filtration.suggestedProgram);
    if(chlorination)recommendations.push('Produção diária estimada: '+fmt(c.chlorination.estimatedDailyProductionHours,' h/dia')+'.');
    if(heat)recommendations.push('Tempo de aquecimento estimado: '+fmt(c.heatPump.estimatedHoursToTarget,' h')+'.');
    $('recommendations').innerHTML=(recommendations.length?recommendations:['Completa os dados indicados em cada secção para consultar as estimativas.']).map(x=>'<div class="rec">'+esc(x)+'</div>').join('');
    renderBlock('geometry',area||volume?[row('Formato',c.geometry.shape),row('Fórmula',area?c.geometry.formula:'Volume manual indicado'),row('Área',area?fmt(c.geometry.surfaceM2,' m²'):'-'),row('Cubicagem',volume?fmt(c.geometry.volumeM3,' m³'):'-'),row('Litros',volume?fmt(c.geometry.volumeLitres,' L'):'-')] : missing("Indica a cubicagem ou as dimensões e a profundidade."));
    renderBlock('filtration',filtration?[row('Caudal bomba',fmt(c.filtration.pumpFlowM3h,' m³/h')),row('1 recirculação',fmt(c.filtration.oneTurnoverHours,' h')),row('Mínimo diário',fmt(c.filtration.minimumFiltrationHoursDay,' h')),row('Ideal diário',fmt(c.filtration.idealFiltrationHoursDay,' h')),row('Programa',c.filtration.suggestedProgram)] : missing("Indica o volume e o caudal da bomba."));
    renderBlock('salt',salt?[row('Sal atual',fmt(c.salt.saltCurrentPpm,' ppm')),row('Sal alvo',fmt(c.salt.targetSalinityPpm,' ppm')),row('Falta',fmt(c.salt.saltMissingPpm,' ppm')),row('Adicionar',fmt(c.salt.saltKgToAdd,' kg')),row('Nota',c.salt.note)] : missing("Indica o volume, a salinidade medida e o alvo. Um campo vazio não significa zero."));
    renderBlock('chlorination',chlorination?[row('Máquina',fmt(c.chlorination.chlorinatorGph,' g/h')),row('Cloro para alvo',fmt(c.chlorination.chlorineGramsToReachTarget,' g')),row('Horas até alvo',fmt(c.chlorination.chlorinatorHoursToReachTarget,' h')),row('Procura diária estimada',fmt(c.chlorination.estimatedDailyChlorineGrams,' g/dia')),row('Horas produção/dia',fmt(c.chlorination.estimatedDailyProductionHours,' h')),row('Máquina ideal',c.chlorination.idealChlorinatorRangeGph)] : missing("Indica o volume, o cloro medido, o alvo e a produção da máquina."));
    renderBlock('heatPump',heat?[row('Temperatura atual',fmt(c.heatPump.currentWaterTempC,' °C')),row('Temperatura alvo',fmt(c.heatPump.targetWaterTempC,' °C')),row('Subida necessária',fmt(c.heatPump.deltaT,' °C')),row('Cobertura',c.heatPump.covered?'Sim':'Não'),row('Energia térmica ajustada',fmt(c.heatPump.thermalEnergyKwhAdjusted,' kWh')),row('Consumo elétrico estimado',fmt(c.heatPump.estimatedElectricKwh,' kWh')),row('Horas até alvo',fmt(c.heatPump.estimatedHoursToTarget,' h')),row('Nota',c.heatPump.note)] : missing("Indica o volume, as temperaturas e a potência térmica da bomba."));
    const chem=c.chemistry,rows=[];
    if(chem){for(const [key,label,suffix] of [['alkalinityCurrentPpm','Alcalinidade atual',' ppm'],['targetAlkalinityPpm','Alcalinidade alvo',' ppm'],['bicarbonateKgToAdd','Bicarbonato estimado',' kg'],['phCurrent','pH atual',''],['targetPh','pH alvo',''],['phMinusKgEstimate','pH- estimado',' kg'],['phPlusKgEstimate','pH+ estimado',' kg'],['orpCurrentMv','ORP / Redox atual',' mV'],['targetOrpMv','ORP / Redox alvo',' mV']])if(chem[key]!==null&&chem[key]!==undefined&&(!['bicarbonateKgToAdd','phMinusKgEstimate','phPlusKgEstimate'].includes(key)||positive('volumeM3')))rows.push(row(label,fmt(chem[key],suffix)));}
    renderBlock('chemistry',rows.length?rows:['<p class="note">Preenche as medições e calcula para consultar este resultado. Um campo vazio não é uma medição de zero.</p>']);
  }
  function clearInputs(){
    if(!active()||suspended||loading||saving||uncertain||storageBlocked||draftBlocked||draftStale||durable?.pending||!loadedId||!window.confirm('Limpar os campos desta piscina e repor os valores iniciais? A ficha guardada só muda se guardares.'))return;
    abort();setFields();clearResults();conserveDraft();status('edited','Campos repostos nos valores iniciais. A ficha guardada não foi alterada.');
  }
  Object.assign(window,{loadPool:()=>loadPool(),onPoolChange:()=>loadPool(false,'switch'),previewCalculation:()=>calculate(false),saveAndCalculate:()=>calculate(true),clearInputs,recoverCalculation,retryCalculatorDraft});
  for(const id of fields)$(id).addEventListener('input',changed);
  for(const id of [...blocks,'status','draftStatus','poolBadge','kVolume','kArea','kSalt','kHeat'])$(id).dataset.cwStateManaged='manual';
  window.addEventListener('storage',event=>{if(active()&&(event.key===store.key||event.key===null)){try{if(!store.unchanged())storageFailure();}catch(_){storageFailure();}}});window.addEventListener('focus',active);document.addEventListener('visibilitychange',()=>{if(!document.hidden)active();});
  window.addEventListener('beforeunload',event=>{if(!invalid&&(dirty()||saving||uncertain)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>{suspended=true;if(saving){saving=false;uncertain=true;}abort();loading=false;clearResults();root.hidden=true;controls();});
  window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;root.hidden=false;if(!active())return;controls();if(draftBlocked){draftFailure();return;}if(draftStale){status('conflict','A ficha mudou desde a revisão deste rascunho. Os campos foram conservados; recarrega para rever a versão atual.');return;}if(dirty()||uncertain){status(uncertain?'uncertain':'edited',uncertain?'Pedido conservado. Confirma o pedido guardado antes de continuar.':'Campos não guardados conservados. Recalcula antes de consultar resultados.');}else loadPool(true,'restore');}});
  window.addEventListener('popstate',()=>{if(!active()||suspended)return;if(saving||durable?.pending||storageBlocked||draftBlocked){if(loadedId)writeUrl(loadedId);return;}const selected=selectionFromUrl();if(!selected||![...$('poolId').options].some(o=>o.value===selected)){if(loadedId)writeUrl(loadedId);return;}$('poolId').value=selected;loadPool(false,'switch');});
  setInterval(()=>{if(active()&&!suspended&&!loading&&!saving&&!uncertain&&resultInput&&!same(payload(),resultInput))changed();},300);
  controls();start();
}());
