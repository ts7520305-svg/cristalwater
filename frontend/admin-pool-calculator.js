(function(){
  'use strict';
  const R=window.CWPoolCalculatorRules,fields=R.fieldKeys,copy=window.CWPoolCalculatorCopy;
  const urlLanguage=()=>{const values=new URLSearchParams(location.search).getAll('lang');return values.length===1&&Object.hasOwn(copy,values[0])?values[0]:'pt';};
  let language=urlLanguage(),statusKey='',draftKey='',badgePool=null,currentCalculation=null;
  const t=(key,values={})=>copy[language][key].replace(/\{(\w+)\}/g,(_,name)=>String(values[name]??'{'+name+'}'));
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
  function clearResults(){currentCalculation=null;resultInput=null;for(const id of blocks)$(id).replaceChildren();for(const id of ['kVolume','kArea','kSalt','kHeat'])$(id).textContent='-';}
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
  function status(state,key){statusKey=key;root.dataset.state=state;$('status').textContent=t(key);$('status').setAttribute('role',['error','session','uncertain','storage','conflict','draft-error'].includes(state)?'alert':'status');controls();if(['uncertain','storage','conflict','draft-error'].includes(state)&&!root.hidden)$('status').scrollIntoView({block:'center'});}
  function draftMessage(key){draftKey=key;$('draftStatus').textContent=key?t(key):'';}
  function poolLabel(pool){return (pool.client?.name?pool.client.name+' · ':'')+(pool.name||t('poolId')+' #'+pool.id);}
  function renderBadge(){$('poolBadge').textContent=badgePool?(badgePool.client?.name||t('client'))+' · '+(badgePool.name||t('poolId')+' #'+badgePool.id):t('poolId');}
  function applyLanguage(){
    document.documentElement.lang=language;document.title='Cristal Water · '+t('title');$('calculatorLanguage').value=language;$('calculatorLanguage').setAttribute('aria-label',t('language'));
    document.querySelectorAll('[data-calculator-copy]').forEach(node=>{node.textContent=t(node.dataset.calculatorCopy);});
    for(const id of ['poolId',...fields]){const control=$(id),label=document.querySelector('label[for="'+id+'"]');label.textContent=t(id);control.setAttribute('aria-label',t(id));control.querySelectorAll('[data-original-option]').forEach(option=>{option.textContent=t('storedOption',{value:option.value});});}
    $('ambientLossFactor').placeholder=t('automatic');renderBadge();
    $('poolId').querySelectorAll('[data-empty-pool-name]').forEach(option=>{option.textContent=(option.dataset.clientName?option.dataset.clientName+' · ':'')+t('poolId')+' #'+option.value;});
    if(statusKey)$('status').textContent=t(statusKey);draftMessage(draftKey);
    if(currentCalculation&&resultInput&&same(payload(),resultInput))renderCalculation(currentCalculation);
  }
  function blank(){draftMessage('');badgePool=null;for(const id of fields)$(id).value='';renderBadge();clearResults();}
  function active(){
    try{if(!invalid&&session.identity===fingerprint()&&session.expires>Date.now())return true;}catch(_){}
    invalid=true;abort();loadedId=null;baseline=null;loading=false;saving=false;blank();$('poolId').replaceChildren();poolsReady=false;
    status('session','session');return false;
  }
  function setFields(values={}){
    for(const id of fields){
      const control=$(id);control.querySelectorAll?.('[data-original-option]').forEach(option=>option.remove());
      const value=values[id]===undefined||values[id]===null?defaults[id]:String(values[id]);
      if(control.tagName==='SELECT'&&value!==''&&![...control.options].some(option=>option.value===value)){
        const option=document.createElement('option');option.value=value;option.textContent=t('storedOption',{value});option.dataset.originalOption='true';control.append(option);
      }
      control.value=value;
    }
  }
  function fill(data){
    setFields(data.fields);review=data;
    badgePool=data.pool;renderBadge();
    baseline=payload();
  }
  const dirty=()=>!!baseline&&!same(payload(),baseline);
  function discard(mode){return !(dirty()||uncertain||draftStale)||window.confirm(mode==='switch'?t('confirmSwitch'):uncertain||draftStale?t('confirmConflict'):t('confirmDiscard'));}
  function draftFailure(){draftBlocked=true;clearResults();draftMessage('draftFailure');$('draftStatus').setAttribute('role','alert');controls();}
  function conserveDraft(){
    if(!review||!loadedId||invalid||suspended||durable?.pending)return false;
    try{if(fields.some(id=>$(id).validity.badInput))throw Error('Incomplete numeric field');drafts.save(review,payload());draftBlocked=false;draftMessage('draftKept');$('draftStatus').setAttribute('role','status');controls();return true;}catch(_){draftFailure();return false;}
  }
  function retryCalculatorDraft(){if(active()&&!suspended&&!saving&&!loading&&!durable?.pending&&loadedId&&conserveDraft())status(draftStale?'conflict':'edited',draftStale?'draftStale':'draftRetried');}
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
    if(!active()||suspended)return;abort();const generation=sequence;loading=true;loadedId=null;baseline=null;poolsReady=false;blank();status('loading','loadingPools');
    try{
      const data=await read('/api/pools');if(generation!==sequence)return;
      if(!Array.isArray(data.pools)||data.pools.some(p=>!positive(p.id)||typeof p.name!=='string')||new Set(data.pools.map(p=>p.id)).size!==data.pools.length)throw Error('Invalid pools');
      $('poolId').replaceChildren();
      for(const pool of data.pools){const option=document.createElement('option');option.value=String(pool.id);option.textContent=poolLabel(pool);if(!pool.name){option.dataset.emptyPoolName='true';option.dataset.clientName=pool.client?.name||'';}$('poolId').append(option);}
      poolsReady=true;loading=false;
      if(!data.pools.length){status('empty','empty');return;}
      const selected=selectionFromUrl();
      if(selected===false||selected!==null&&!data.pools.some(p=>String(p.id)===selected)){$('poolId').value='';status('error','unavailable');return;}
      if(selected!==null)$('poolId').value=selected;
      await loadPool(true,'restore');
    }catch(_){if(active()&&!suspended&&generation===sequence){loading=false;poolsReady=false;$('poolId').replaceChildren();status('error','poolsError');}}
  }
  async function loadPool(confirmed=false,mode='reload'){
    if(!active()||suspended||saving||storageBlocked||draftBlocked||durable?.pending)return;
    if(!poolsReady){await loadPools();return;}
    const target=$('poolId').value;
    if(!confirmed&&!discard(mode)){$('poolId').value=loadedId||'';if(loadedId)writeUrl(loadedId);return;}
    if(mode==='switch'&&loadedId&&dirty()&&!conserveDraft()){$('poolId').value=loadedId;writeUrl(loadedId);return;}
    abort();const generation=sequence;uncertain=false;draftStale=false;loadedId=null;baseline=null;loading=true;blank();
    if(!validId(target)){loading=false;status('error','invalidPool');return;}
    writeUrl(target);status('loading','loadingPool');
    try{
      const data=await read('/api/pool-calculations/'+target+'/edit-state',undefined,true);
      if(generation!==sequence||$('poolId').value!==target)return;
      if(!R.state(data)||data.poolId!==Number(target))throw Error('Pool mismatch');
      if(durable?.confirmed&&!durable.confirmed.result.applied)durable=await store.clear();
      if(!active()||suspended||generation!==sequence)return;
      let saved;try{saved=drafts.read(Number(target));if(mode==='reload'){drafts.discard(Number(target));saved=null;}else if(durable?.confirmed?.result.applied&&window.CWPoolCalculatorDrafts.sameRequest(saved,durable.confirmed.record)){drafts.finish(durable.confirmed.record);saved=null;}}catch(_){fill(data);loadedId=target;loading=false;draftFailure();status('draft-error','draftInvalid');return;}
      fill(saved?saved.review:data);loadedId=target;loading=false;clearResults();
      if(saved){setFields(saved.fields);draftStale=saved.review.version!==data.version;draftMessage('draftRecovered');status(draftStale?'conflict':'edited',draftStale?'draftStale':'recovered');return;}
      resultInput=payload();status('ready','ready');
    }catch(_){if(active()&&!suspended&&generation===sequence){loading=false;loadedId=null;baseline=null;blank();status('error','poolError');}}
  }
  function changed(){
    if(!active()||suspended||loading||saving||uncertain||storageBlocked||draftStale||durable?.pending||!loadedId)return;
    abort();clearResults();conserveDraft();status('edited','edited');
  }
  function validInputs(){return fields.every(id=>$(id).validity.valid&&($(id).type!=='number'||$(id).value===''||Number.isFinite(Number($(id).value))));}
  function storageFailure(){storageBlocked=true;saving=false;clearResults();status('storage','storageError');}
  function restore(record){
    loadedId=String(record.poolId);const option=document.createElement('option');option.value=loadedId;option.textContent=poolLabel(record.review.pool);if(!record.review.pool.name){option.dataset.emptyPoolName='true';option.dataset.clientName=record.review.pool.client?.name||'';}
    $('poolId').replaceChildren(option);poolsReady=true;fill(record.review);setFields(record.command.fields);writeUrl(loadedId);clearResults();
  }
  async function recoverCalculation(){
    if(!active()||suspended||saving||storageBlocked||!durable?.pending)return;
    try{if(!store.unchanged()){storageFailure();return;}}catch(_){storageFailure();return;}
    abort();const generation=sequence,record=durable.pending;saving=true;uncertain=true;clearResults();status('saving','confirming');
    try{
      const recovered=await read('/api/pool-calculations/requests/'+record.command.requestId,undefined,true);
      if(typeof recovered.found!=='boolean')throw Error('Invalid recovery');
      if(!store.unchanged())throw Error('Request changed');
      const result=recovered.found?recovered.result:await read('/api/pool-calculations/'+record.poolId+'/reviewed',record.command,true);
      if(!R.confirmation(result,record,session.owner)||result.applied&&!validCalculation(result.calculation))throw Error('Unconfirmed receipt');
      durable=await store.confirm(result);
      if(!active()||suspended||generation!==sequence)return;
      saving=false;uncertain=!result.applied;
      if(result.applied){fill(result.state);draftStale=false;try{drafts.finish(record);draftMessage('draftFinished');}catch(_){draftFailure();}const unchanged=R.equal(payload(),record.command.fields);if(unchanged){renderCalculation(result.calculation);resultInput=payload();}else clearResults();status('saved',unchanged?'saved':'savedRecalculate');}
      else {restore(record);status('conflict',result.code);}
    }catch(_){if(active()&&!suspended&&generation===sequence){saving=false;uncertain=true;clearResults();status('uncertain','uncertain');}}
  }
  async function calculate(save){
    if(!active()||suspended||loading||saving||uncertain||storageBlocked||draftBlocked||draftStale||durable?.pending||!loadedId||loadedId!==$('poolId').value)return;
    if(!validInputs()||!R.fields(payload())){clearResults();status('error','invalidInputs');fields.find(id=>!$(id).validity.valid)&&$(fields.find(id=>!$(id).validity.valid)).reportValidity();return;}
    abort();const generation=sequence,target=loadedId,input=payload();clearResults();saving=save;
    status(save?'saving':'previewing',save?'preparing':'calculating');
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
      renderCalculation(data.calculation);resultInput=input;status('preview','calculated');
    }catch(_){if(active()&&!suspended&&generation===sequence){clearResults();status('error','calculationError');}}
  }
  async function start(){
    if(!active())return;
    try{durable=await store.read();}catch(_){if(active())storageFailure();return;}
    if(!active()||suspended)return;
    if(durable.pending){restore(durable.pending);uncertain=true;status('uncertain','pending');return;}
    if(durable.confirmed&&!durable.confirmed.result.applied){restore(durable.confirmed.record);uncertain=true;status('conflict',durable.confirmed.result.code);return;}
    await loadPools();
  }
  function renderBlock(id,rows){$(id).innerHTML=rows.join('');}
  function renderCalculation(c){
    currentCalculation=c;
    const input=payload(),number=id=>input[id]===''?null:Number(input[id]),has=id=>number(id)!==null&&Number.isFinite(number(id)),positive=id=>has(id)&&number(id)>0;
    const shape=input.shape.toUpperCase(),area=positive('surfaceM2')||(['ROUND','CIRCULAR'].includes(shape)?positive('diameterM'):['RECTANGULAR','OVAL','KIDNEY','FREEFORM'].includes(shape)&&positive('lengthM')&&positive('widthM')&&(!['KIDNEY','FREEFORM'].includes(shape)||positive('shapeFactor')));
    const volume=positive('volumeM3')||area&&(positive('averageDepthM')||positive('depthMinM')&&positive('depthMaxM'));
    const filtration=volume&&positive('pumpFlowM3h'),salt=volume&&has('saltCurrentPpm')&&number('saltCurrentPpm')>=0&&positive('targetSalinityPpm');
    const chlorination=volume&&positive('chlorinatorGph')&&has('chlorineCurrentPpm')&&number('chlorineCurrentPpm')>=0&&positive('targetChlorinePpm');
    const heat=volume&&has('currentWaterTempC')&&has('targetWaterTempC')&&positive('heatPumpThermalKw');
    const missing=key=>['<p class="note">'+esc(t('insufficient',{detail:t(key)}))+'</p>'],displayRow=(key,value)=>row(t(key),value);
    // Translate only known generated text; unexpected source text remains literal and escaped.
    const knownNote=(key,value)=>value===copy.pt[key]?t(key):value;
    const formulaKeys={'custom':'customFormula','round: π × r²':'roundFormula','oval: π × (L/2) × (W/2)':'ovalFormula','kidney/freeform approximation: L × W × factor':'kidneyFormula','freeform approximation: L × W × factor':'freeFormula','rectangular: L × W':'rectangleFormula'};
    const formula=Object.hasOwn(formulaKeys,c.geometry.formula)?t(formulaKeys[c.geometry.formula]):c.geometry.formula;
    const hours=c.filtration.idealFiltrationHoursDay,program=c.filtration.suggestedProgram==='Dividir em 2-3 períodos/dia. Base: '+hours+'h/dia.'?t('program',{hours}):knownNote('needFlow',c.filtration.suggestedProgram);
    $('kVolume').textContent=volume?fmt(c.geometry.volumeM3,' m³'):'-';$('kArea').textContent=area?fmt(c.geometry.surfaceM2,' m²'):'-';$('kSalt').textContent=salt?fmt(c.salt.saltKgToAdd,' kg'):'-';$('kHeat').textContent=heat?fmt(c.heatPump.estimatedHoursToTarget,' h'):'-';
    const recommendations=[];
    if(salt)recommendations.push(t('saltAdvice',{value:fmt(c.salt.saltKgToAdd,' kg')}));
    if(filtration)recommendations.push(program);
    if(chlorination)recommendations.push(t('chlorineAdvice',{value:fmt(c.chlorination.estimatedDailyProductionHours,t('hoursDay'))}));
    if(heat)recommendations.push(t('heatAdvice',{value:fmt(c.heatPump.estimatedHoursToTarget,' h')}));
    $('recommendations').innerHTML=(recommendations.length?recommendations:[t('needData')]).map(x=>'<div class="rec">'+esc(x)+'</div>').join('');
    renderBlock('geometry',area||volume?[displayRow('shape',['RECTANGULAR','OVAL','ROUND','KIDNEY','FREEFORM'].includes(c.geometry.shape)?t(c.geometry.shape):c.geometry.shape),displayRow('formula',area?formula:t('manualVolume')),displayRow('area',area?fmt(c.geometry.surfaceM2,' m²'):'-'),displayRow('volume',volume?fmt(c.geometry.volumeM3,' m³'):'-'),displayRow('litres',volume?fmt(c.geometry.volumeLitres,' L'):'-')] : missing('needGeometry'));
    renderBlock('filtration',filtration?[displayRow('flow',fmt(c.filtration.pumpFlowM3h,' m³/h')),displayRow('turnover',fmt(c.filtration.oneTurnoverHours,' h')),displayRow('dailyMinimum',fmt(c.filtration.minimumFiltrationHoursDay,' h')),displayRow('dailyIdeal',fmt(c.filtration.idealFiltrationHoursDay,' h')),displayRow('programLabel',program)] : missing('needFiltration'));
    renderBlock('salt',salt?[displayRow('currentSalt',fmt(c.salt.saltCurrentPpm,' ppm')),displayRow('targetSalt',fmt(c.salt.targetSalinityPpm,' ppm')),displayRow('missingSalt',fmt(c.salt.saltMissingPpm,' ppm')),displayRow('add',fmt(c.salt.saltKgToAdd,' kg')),displayRow('note',knownNote('saltNote',c.salt.note))] : missing('needSalt'));
    renderBlock('chlorination',chlorination?[displayRow('machine',fmt(c.chlorination.chlorinatorGph,' g/h')),displayRow('chlorineTarget',fmt(c.chlorination.chlorineGramsToReachTarget,' g')),displayRow('hoursTarget',fmt(c.chlorination.chlorinatorHoursToReachTarget,' h')),displayRow('dailyDemand',fmt(c.chlorination.estimatedDailyChlorineGrams,t('gramsDay'))),displayRow('productionHours',fmt(c.chlorination.estimatedDailyProductionHours,' h')),displayRow('idealMachine',c.chlorination.idealChlorinatorRangeGph)] : missing('needChlorination'));
    renderBlock('heatPump',heat?[displayRow('currentTemperature',fmt(c.heatPump.currentWaterTempC,' °C')),displayRow('targetTemperature',fmt(c.heatPump.targetWaterTempC,' °C')),displayRow('rise',fmt(c.heatPump.deltaT,' °C')),displayRow('covered',t(c.heatPump.covered?'yes':'no')),displayRow('thermalEnergy',fmt(c.heatPump.thermalEnergyKwhAdjusted,' kWh')),displayRow('electricEnergy',fmt(c.heatPump.estimatedElectricKwh,' kWh')),displayRow('hoursTarget',fmt(c.heatPump.estimatedHoursToTarget,' h')),displayRow('note',knownNote('heatNote',c.heatPump.note))] : missing('needHeat'));
    const chem=c.chemistry,rows=[];
    if(chem){for(const [key,label,suffix] of [['alkalinityCurrentPpm','currentAlkalinity',' ppm'],['targetAlkalinityPpm','targetAlkalinity',' ppm'],['bicarbonateKgToAdd','bicarbonate',' kg'],['phCurrent','phCurrent',''],['targetPh','targetPh',''],['phMinusKgEstimate','phMinus',' kg'],['phPlusKgEstimate','phPlus',' kg'],['orpCurrentMv','currentOrp',' mV'],['targetOrpMv','targetOrp',' mV']])if(chem[key]!==null&&chem[key]!==undefined&&(!['bicarbonateKgToAdd','phMinusKgEstimate','phPlusKgEstimate'].includes(key)||positive('volumeM3')))rows.push(displayRow(label,fmt(chem[key],suffix)));}
    renderBlock('chemistry',rows.length?rows:['<p class="note">'+esc(t('needChemistry'))+'</p>']);
  }
  function clearInputs(){
    if(!active()||suspended||loading||saving||uncertain||storageBlocked||draftBlocked||draftStale||durable?.pending||!loadedId||!window.confirm(t('confirmClear')))return;
    abort();setFields();clearResults();conserveDraft();status('edited','cleared');
  }
  Object.assign(window,{loadPool:()=>loadPool(),onPoolChange:()=>loadPool(false,'switch'),previewCalculation:()=>calculate(false),saveAndCalculate:()=>calculate(true),clearInputs,recoverCalculation,retryCalculatorDraft});
  for(const id of fields)$(id).addEventListener('input',changed);
  for(const id of [...blocks,'status','draftStatus','poolBadge','kVolume','kArea','kSalt','kHeat'])$(id).dataset.cwStateManaged='manual';
  window.addEventListener('storage',event=>{if(active()&&(event.key===store.key||event.key===null)){try{if(!store.unchanged())storageFailure();}catch(_){storageFailure();}}});window.addEventListener('focus',active);document.addEventListener('visibilitychange',()=>{if(!document.hidden)active();});
  window.addEventListener('beforeunload',event=>{if(!invalid&&(dirty()||saving||uncertain)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>{suspended=true;if(saving){saving=false;uncertain=true;}abort();loading=false;clearResults();root.hidden=true;controls();});
  window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;root.hidden=false;if(!active())return;language=urlLanguage();applyLanguage();controls();if(draftBlocked){draftFailure();return;}if(draftStale){status('conflict','draftStale');return;}if(dirty()||uncertain){status(uncertain?'uncertain':'edited',uncertain?'pending':'historyDraft');}else loadPool(true,'restore');}});
  window.addEventListener('popstate',()=>{if(!active()||suspended)return;language=urlLanguage();applyLanguage();if(saving||durable?.pending||storageBlocked||draftBlocked){if(loadedId)writeUrl(loadedId);return;}const selected=selectionFromUrl();if(!selected||![...$('poolId').options].some(o=>o.value===selected)){if(loadedId)writeUrl(loadedId);return;}if(selected===loadedId)return;$('poolId').value=selected;loadPool(false,'switch');});
  setInterval(()=>{if(active()&&!suspended&&!loading&&!saving&&!uncertain&&resultInput&&!same(payload(),resultInput))changed();},300);
  $('calculatorLanguage').addEventListener('change',()=>{active();language=$('calculatorLanguage').value;const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);applyLanguage();});
  applyLanguage();controls();start();
}());
