(function(){
  'use strict';
  const store=window.CWFieldWriteStore,scope='EXTRA_VISIT_CORRECTION',R=window.CWVisitProductIdentity,P=window.CWExtraCorrectionProducts;
  const t=(key,values)=>window.CWFieldDocumentCopy.text(key,values,document.documentElement.lang);
  const readings=[['ph','correctionPh',10],['chlorine','correctionChlorine',10],['alkalinity','correctionAlkalinity',300],['salt','correctionSalt',10000],['temperature','correctionTemperature',45],['orpMv','correctionOrp',1000]];
  const checks=[['cleaned','correctionCleaned'],['brushed','correctionBrushed'],['vacuumed','correctionVacuumed'],['basketCleaned','correctionBasketCleaned'],['waterlineClean','correctionWaterlineClean'],['backwashDone','correctionBackwashDone']];
  const clone=value=>JSON.parse(JSON.stringify(value)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  let active=null,generation=0;
  const dialog=document.createElement('dialog');dialog.id='extraCorrectionDialog';dialog.setAttribute('aria-labelledby','extraCorrectionTitle');dialog.setAttribute('data-cw-no-i18n','');dialog.setAttribute('data-cw-state-managed','manual');dialog.setAttribute('data-cw-form-memory','managed');
  dialog.innerHTML='<h2 id="extraCorrectionTitle" data-correction-copy="correctionTitle"></h2><p id="extraCorrectionName"></p><p data-correction-copy="correctionIntro"></p><label><span id="extraCorrectionLanguageLabel"></span><select id="extraCorrectionLanguage"><option value="pt">Português</option><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option><option value="de">Deutsch</option></select></label><p id="extraCorrectionStatus" role="status" aria-live="polite"></p><form id="extraCorrectionForm"><fieldset id="extraCorrectionFields"><div id="extraCorrectionReadings"></div><div id="extraCorrectionChecks"></div><label><span data-correction-copy="correctionNotes"></span><textarea name="notes" maxlength="6000"></textarea></label><section id="extraCorrectionProductSection" data-cw-no-i18n data-cw-state-managed="manual" data-cw-form-memory="managed"><h3 id="extraCorrectionProductTitle">Produtos utilizados</h3><p id="extraCorrectionGuideStatus" role="status"></p><div id="extraCorrectionCatalogue"></div><div id="extraCorrectionProducts"></div><button type="button" id="extraCorrectionAdd">Adicionar produto</button></section><label><span data-correction-copy="correctionReason"></span><textarea name="reason" minlength="5" maxlength="1000" required></textarea></label></fieldset><div id="extraCorrectionReview" hidden></div><div class="extra-correction-actions"><button type="submit" id="extraCorrectionPreview" data-correction-copy="correctionPreview"></button><button type="button" id="extraCorrectionConfirm" hidden>Confirmar correção</button><button type="button" id="extraCorrectionRefresh" hidden data-correction-copy="correctionRefresh"></button><button type="button" id="extraCorrectionClose" data-correction-copy="correctionClose"></button></div></form>';
  const style=document.createElement('style');style.textContent='#extraCorrectionDialog{box-sizing:border-box;width:720px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);padding:20px;border:1px solid #b7ccdc;border-radius:16px;background:#fff;color:#17364c;overflow:auto}#extraCorrectionDialog::backdrop{background:#102e46aa}#extraCorrectionDialog *{box-sizing:border-box}#extraCorrectionDialog fieldset{border:0;padding:0;min-width:0}#extraCorrectionDialog label{display:block;margin:10px 0;color:#17364c;min-width:0;overflow-wrap:anywhere}#extraCorrectionChecks label{min-height:44px}#extraCorrectionDialog input:not([type=checkbox]),#extraCorrectionDialog textarea{display:block;width:100%;min-height:44px;margin-top:5px;padding:9px;border:1px solid #8198a8;border-radius:7px;background:#fff;color:#17364c;font-size:16px}#extraCorrectionDialog select{display:block;width:100%;min-width:0;min-height:44px;padding:9px;border:1px solid #8198a8;border-radius:7px;background:#fff;color:#17364c;font-size:16px}#extraCorrectionGuideStatus{overflow-wrap:anywhere}#extraCorrectionDialog textarea{min-height:80px}#extraCorrectionDialog input[type=checkbox]{width:22px;height:22px;vertical-align:middle;margin-right:9px}#extraCorrectionReadings,#extraCorrectionChecks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}#extraCorrectionDialog button{min-height:44px;white-space:normal;background:#075c4c;color:#fff;border:0;border-radius:8px;padding:10px 13px;font-size:15px}#extraCorrectionDialog button:disabled{opacity:.6}#extraCorrectionDialog [hidden]{display:none!important}.extra-correction-product{padding:12px 0;border-top:1px solid #cbd7e0}.extra-correction-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}#extraCorrectionStatus{padding:12px;background:#edf5fa;color:#17364c;overflow-wrap:anywhere}#extraCorrectionReview{padding:12px;background:#fff4ce;color:#624400;margin-top:12px;overflow-wrap:anywhere}#extraCorrectionDialog h2{font-size:24px;color:#17364c}#extraCorrectionDialog h3{color:#17364c}@media(max-width:360px){#extraCorrectionReadings,#extraCorrectionChecks{grid-template-columns:1fr}}';
  document.head.append(style);document.body.append(dialog);
  const $=selector=>dialog.querySelector(selector),form=$('form'),fields=$('fieldset'),status=$('#extraCorrectionStatus');
  const discard=document.createElement('button');discard.type='button';discard.id='extraCorrectionDiscard';discard.dataset.correctionCopy='correctionDiscard';$('.extra-correction-actions').append(discard);
  for(const [name,label,max] of readings){const node=document.createElement('label');const title=document.createElement('span');title.dataset.correctionCopy=label;node.append(title);const input=document.createElement('input');input.name=name;input.type='number';input.step='any';input.min='0';input.max=String(max);node.append(input);$('#extraCorrectionReadings').append(node);}
  for(const [name,label] of checks){const node=document.createElement('label'),input=document.createElement('input');input.name=name;input.type='checkbox';const title=document.createElement('span');title.dataset.correctionCopy=label;node.append(input,title);$('#extraCorrectionChecks').append(node);}
  const descriptor=(key,values={})=>({key,values});
  const copyError=(key,values={})=>Object.assign(Error(key),{copyKey:key,copyValues:values});
  function renderMessage(value){
    if(Array.isArray(value))return value.map(renderMessage).join(' ');
    if(value&&typeof value==='object')return t(value.key,Object.fromEntries(Object.entries(value.values||{}).map(([key,item])=>[key,renderMessage(item)])));
    return String(value??'');
  }
  function errorMessage(error){
    if(error?.copyKey)return descriptor(error.copyKey,error.copyValues);
    const known={
      'Envio guardado neste dispositivo; aguarda ligação.':'correctionOfflineSaved',
      'Sessão expirada. Volte a entrar com a mesma conta.':'correctionSessionExpired',
      'Sessão alterada.':'correctionSessionChanged',
      'A sessão mudou. Reabra a página com a conta original; os envios foram preservados.':'correctionSessionChanged',
      'Resposta incompleta. O pedido original continua por confirmar.':'correctionIncompleteResponse',
      'A correção ainda não está confirmada. Conserve o pedido original.':'correctionIncompleteResponse',
      'A confirmação pertence a outra piscina ou tipo de visita.':'correctionIncompleteResponse',
    };
    if(Object.hasOwn(known,error?.message))return descriptor(known[error.message]);
    if(error?.name==='QuotaExceededError')return descriptor('correctionQuota');
    if(error?.status===401)return descriptor('correctionSessionExpired');
    if(error?.status===403)return descriptor('correctionForbidden');
    if(['TimeoutError','AbortError'].includes(error?.name)||error?.name==='TypeError'&&/fetch|network/i.test(error.message))return descriptor('correctionNetwork');
    return error?.message?[descriptor('correctionUnknownError'),descriptor('correctionOriginalDetail',{message:error.message})]:descriptor('correctionUnknownError');
  }
  function rejectionMessage(result){
    if(result?.code==='EXTRA_CORRECTION_STATE')return descriptor('correctionRejectedState');
    if(result?.code==='EXTRA_CORRECTION_STALE')return descriptor('correctionRejectedStale');
    const detail=result?.message?descriptor('correctionOriginalDetail',{message:result.message}):'';
    return result?.code==='EXTRA_CORRECTION_STOCK'?descriptor('correctionRejectedStock',{detail}):detail;
  }
  function paintStatus(){status.textContent=active?.message?renderMessage(active.message):'';}
  function showStatus(key,values={}){if(active)active.message=descriptor(key,values);paintStatus();}
  function showError(error,wrapper){if(active)active.message=wrapper?descriptor(wrapper,{message:errorMessage(error)}):errorMessage(error);paintStatus();}
  function validation(input){
    if(!input?.setCustomValidity)return;
    input.setCustomValidity('');const v=input.validity;
    const key=v.badInput?'correctionNumber':v.valueMissing?'correctionRequired':v.rangeUnderflow?'correctionMinimum':v.rangeOverflow?'correctionMaximum':v.tooShort?'correctionMinLength':v.tooLong?'correctionMaxLength':null;
    if(key)input.setCustomValidity(t(key,{min:v.tooShort?input.minLength:input.min,max:v.tooLong?input.maxLength:input.max}));
  }
  function renderReview(s){
    const box=$('#extraCorrectionReview');if(!s?.review||box.hidden)return;
    box.replaceChildren();const title=document.createElement('strong');title.textContent=t('correctionReviewTitle');box.append(title);
    for(const line of [...differences(s.baseline,s.review),t('correctionReasonLine',{reason:s.review.reason})]){const row=document.createElement('p');row.textContent=line;box.append(row);}
  }
  function paintCopy(){
    for(const node of dialog.querySelectorAll('[data-correction-copy]'))node.textContent=t(node.dataset.correctionCopy);
    $('#extraCorrectionLanguageLabel').textContent=t('correctionLanguage');
    $('#extraCorrectionLanguage').value=Object.hasOwn(window.CWFieldDocumentCopy.locales,document.documentElement.lang)?document.documentElement.lang:'pt';
    $('#extraCorrectionConfirm').textContent=t(active?.requestId?'correctionConfirmSaved':'correctionConfirm');
    if(active?.nameIsFallback)$('#extraCorrectionName').textContent=t('correctionVisit');
    for(const input of form.elements)validation(input);
    paintStatus();renderReview(active);
  }
  form.addEventListener('invalid',event=>validation(event.target),true);
  function selected(s){const now=window.CWFieldVisitContext?.();return store.same(s.captured)&&now?.visitType==='EXTRA'&&now.id===s.id&&now.poolId===s.poolId;}
  function assert(s){if(!store.same(s.captured))throw copyError('correctionSessionChanged');}
  $('#extraCorrectionLanguage').onchange=event=>{if(window.CristalI18n)window.CristalI18n.applyLanguage(event.target.value);else document.documentElement.lang=event.target.value;};
  const catalogue=window.CWProductCatalogue.mount($('#extraCorrectionCatalogue'),paintProducts);
  function product(row={}){
    const node=document.createElement('div');node.className='extra-correction-product';node._notes=row.notes;node._identity=R.identity(row);
    const holder=document.createElement('label'),title=document.createElement('span'),select=document.createElement('select');title.dataset.productLabel='productChoose';select.dataset.productSelect='';holder.append(title,select);node.append(holder);
    select.addEventListener('input',event=>event.stopPropagation());
    select.onchange=()=>{const s=active;if(!s||!selected(s)||fields.disabled||s.requestId)return;const item=s.items?.find(item=>String(item.id)===select.value);if(!item){paintProducts();return;}const picked=R.fromItem(item,item.workGuideId);node._identity=R.identity(picked);for(const key of ['name','unit'])node.querySelector(`[data-product-field=${key}]`).value=picked[key];paintProducts();changed();};
    for(const [key,label,type] of [['name','productUsed','hidden'],['quantity','productQuantity','number'],['unit','productUnit','text']]){const holder=document.createElement('label'),title=document.createElement('span'),input=document.createElement('input');title.dataset.productLabel=label;input.dataset.productField=key;input.type=type;input.required=true;input.value=row[key]??'';if(key!=='quantity')input.readOnly=true;if(type==='hidden')holder.hidden=true;if(type==='number'){input.min='0.000001';input.max='100000';input.step='any';}holder.append(title,input);node.append(holder);}
    const remove=document.createElement('button');remove.type='button';remove.dataset.productRemove='';remove.onclick=()=>{if(!active||!selected(active)||fields.disabled||active.requestId)return;node.remove();paintProducts();changed();};node.append(remove);$('#extraCorrectionProducts').append(node);
  }
  function rowValue(node){return {...Object.fromEntries([...node.querySelectorAll('input[data-product-field]')].map(input=>[input.dataset.productField,input.value])),...(node._notes!==undefined?{notes:node._notes}:{}),...(node._identity||{})};}
  function paintProducts(){
    const s=active,all=s?.items||[],available=s?.catalogue?.state==='AVAILABLE';
    const view=catalogue.update({key:s?.id,active:!!s&&selected(s),disabled:fields.disabled||!!s?.requestId,available,items:all,language:document.documentElement.lang});
    $('#extraCorrectionLanguageLabel').textContent=t('correctionLanguage');$('#extraCorrectionLanguage').value=Object.hasOwn(window.CWFieldDocumentCopy.locales,document.documentElement.lang)?document.documentElement.lang:'pt';
    $('#extraCorrectionProductTitle').textContent=t('correctionProducts');$('#extraCorrectionAdd').textContent=t('correctionAdd');$('#extraCorrectionAdd').disabled=!available||!all.some(item=>R.text(item.name)&&R.text(item.unit))||!!s?.requestId;
    const state=s?.catalogue?.state;$('#extraCorrectionGuideStatus').textContent=state==='AVAILABLE'?t(s.source==='live'?'correctionGuideLive':'correctionGuideCache',{date:window.CWFieldDocumentCopy.date(s.catalogue.asOf,document.documentElement.lang),guides:s.catalogue.guides.map(g=>'#'+g.id).join(', ')}):t(state==='NO_ORIGINAL_GUIDE'?'correctionGuideNone':state==='REVIEW_REQUIRED'?'correctionGuideReview':'correctionGuideUnavailable');
    for(const node of dialog.querySelectorAll('.extra-correction-product')){
      const row=rowValue(node),select=node.querySelector('select'),selection=P.choices(all,row,view);select.replaceChildren(new Option(t('productChoose'),''));select.disabled=!available;
      for(const {item,valid,chosen,pinned} of selection.entries){const option=new Option(t('work')+' #'+item.workGuideId+' · #'+item.id+' · '+item.name+' · '+item.quantity+' '+(R.text(item.unit)?item.unit:t('unit'))+(pinned?' · '+t('cataloguePinned'):''),String(item.id));option.disabled=!valid;option.dataset.catalogueResult=pinned?'pinned':'page';select.append(option);if(chosen)option.selected=true;}
      if(selection.saved){const label=(row.name||t('productUnknown'))+' · '+(row.unit||t('unit'))+(row.workGuideItemId?' · '+t('work')+' #'+row.workGuideId+' · #'+row.workGuideItemId:'')+' · '+t('correctionSaved');const option=new Option(label,'saved');select.append(option);option.selected=true;}
      for(const label of node.querySelectorAll('[data-product-label]'))label.textContent=t(label.dataset.productLabel);
      select.setAttribute('aria-label',t('productChoose'));node.querySelector('[data-product-remove]').textContent=t('productRemove');
    }
  }
  function collect(){return {...Object.fromEntries(readings.map(([key])=>[key,form.elements[key].value])),...Object.fromEntries(checks.map(([key])=>[key,form.elements[key].checked])),notes:form.elements.notes.value,reason:form.elements.reason.value,products:[...dialog.querySelectorAll('.extra-correction-product')].map(rowValue)};}
  function fill(payload){for(const [key] of readings)form.elements[key].value=payload[key]??'';for(const [key] of checks)form.elements[key].checked=payload[key]===true;form.elements.notes.value=payload.notes??'';form.elements.reason.value=payload.reason??'';$('#extraCorrectionProducts').replaceChildren();for(const row of payload.products||payload.chemicalsJson||[])product(row);paintProducts();paintCopy();}
  function read(s){s.raw=localStorage.getItem(s.key);if(!s.raw)return null;let draft;try{draft=JSON.parse(s.raw);}catch(_){throw copyError('correctionUnreadableDraft');}if(draft?.v!==1||draft.owner!==s.captured.owner||draft.id!==s.id||draft.poolId!==s.poolId||!Number.isSafeInteger(draft.revision)||!/^[a-f0-9]{64}$/.test(draft.baseVersion)||!draft.baseline||draft.baseline.id!==s.id||draft.baseline.visitType!=='EXTRA'||draft.baseline.poolId!==s.poolId||draft.baseline.technicianId!==s.captured.technicianId||!draft.payload||!Array.isArray(draft.payload.products))throw copyError('correctionReviewDraft');if(draft.productCatalogue!==undefined&&!P.packet(draft.productCatalogue,{owner:s.captured.owner,technicianId:s.captured.technicianId,id:s.id,poolId:s.poolId,baseVersion:draft.baseVersion}))throw copyError('correctionReviewCatalogue');return draft;}
  function save(s,payload,requestId=s.requestId){
    const data={v:1,owner:s.captured.owner,id:s.id,poolId:s.poolId,name:s.name,baseVersion:s.baseVersion,baseline:clone(s.baseline),payload:clone(payload),...(s.catalogue?{productCatalogue:clone(s.catalogue)}:{}),...(requestId?{requestId}:{})};
    s.saving=s.saving.then(async()=>{
      assert(s);if(!navigator.locks?.request)throw copyError('correctionLocksUnavailable');
      await navigator.locks.request(s.key,async()=>{assert(s);if(localStorage.getItem(s.key)!==s.raw)throw copyError('correctionDraftChanged');const next=JSON.stringify({...data,revision:(s.draft?.revision||0)+1});localStorage.setItem(s.key,next);if(localStorage.getItem(s.key)!==next)throw copyError('correctionSaveUnconfirmed');s.raw=next;s.draft=JSON.parse(next);});
    });return s.saving;
  }
  function changed(){const s=active;if(!s||s.requestId||!selected(s))return;s.review=null;$('#extraCorrectionReview').hidden=true;$('#extraCorrectionConfirm').hidden=true;showStatus('correctionSaving');save(s,collect()).then(()=>{if(active===s&&store.same(s.captured))showStatus('correctionDraftSaved');}).catch(error=>{if(active===s){showError(error);$('#extraCorrectionPreview').disabled=true;}});}
  form.addEventListener('input',event=>{validation(event.target);if(!event.target.closest('[data-product-catalogue]')&&event.target.id!=='extraCorrectionLanguage')changed();});$('#extraCorrectionAdd').onclick=()=>{if(!active||!selected(active)||fields.disabled||active.requestId||active.catalogue?.state!=='AVAILABLE')return;product();paintProducts();changed();};
  let productLanguage=document.documentElement.lang;
  new MutationObserver(()=>{const language=document.documentElement.lang;if(language===productLanguage)return;productLanguage=language;if(active&&selected(active)){paintCopy();paintProducts();}}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  function differences(before,after){
    const rows=[];for(const [key,label] of [...readings,...checks,['notes','correctionNotes']]){const normal=value=>checks.some(row=>row[0]===key)?value===true:key==='notes'?String(value??''):value===''||value==null?null:Number(value);const a=normal(before[key]),b=normal(after[key]);if(a!==b)rows.push(`${t(label)}: ${a===null?t('correctionNoValue'):typeof a==='boolean'?t(a?'correctionYes':'correctionNo'):a} → ${b===null?t('correctionNoValue'):typeof b==='boolean'?t(b?'correctionYes':'correctionNo'):b}`);}
    const normalize=rows=>rows.map(row=>({name:String(row.name).trim(),quantity:Number(row.quantity),unit:String(row.unit).trim(),notes:row.notes||'',...(R.identity(row)||{})}));
    const a=normalize(before.chemicalsJson||[]),b=normalize(after.products);if(!same(a,b)){const label=rows=>rows.map(row=>`${row.name}: ${row.quantity} ${row.unit}${row.workGuideItemId?' ('+t('work')+' #'+row.workGuideId+' · #'+row.workGuideItemId+')':''}`).join('; ')||t('correctionNone');rows.push(t('correctionPreviousProducts',{products:label(a)}));rows.push(t('correctionCorrectedProducts',{products:label(b)}));}return rows;
  }
  form.onsubmit=async event=>{event.preventDefault();const s=active;if(!s||s.requestId||!selected(s)||!form.reportValidity())return;try{const payload=collect();if(payload.products.some(row=>!P.allowed(row,s.baseline,s.catalogue)))throw copyError('correctionChooseRequired');const changes=differences(s.baseline,payload);if(!changes.length)throw copyError('correctionNoChanges');await save(s,payload);if(active!==s||!selected(s))return;s.review=clone(payload);const box=$('#extraCorrectionReview');box.hidden=false;renderReview(s);$('#extraCorrectionConfirm').hidden=false;showStatus('correctionStockDifference');}catch(error){if(active===s&&store.same(s.captured))showError(error);}};
  function finish(s,result){
    if(active!==s||!store.same(s.captured))return;
    s.requestId=null;s.review=null;fields.disabled=true;paintProducts();discard.disabled=false;$('#extraCorrectionConfirm').hidden=true;$('#extraCorrectionPreview').hidden=true;$('#extraCorrectionRefresh').hidden=false;
    showStatus(result.applied?'correctionApplied':'correctionNotApplied',{message:rejectionMessage(result)});
    s.finished=result;
  }
  async function send(s){
    if(!selected(s))throw copyError('correctionVisitChanged');
    if(!s.requestId){if(!s.review)throw copyError('correctionReviewFirst');const payload={visitType:'EXTRA',poolId:s.poolId,baseVersion:s.baseVersion,...s.review};const row=await store.prepare(scope,s.id,payload,{label:'Correção: '+s.name},s.captured);s.requestId=row.requestId;await save(s,s.review,s.requestId);}
    fields.disabled=true;paintProducts();discard.disabled=true;const result=await store.send(s.requestId,s.captured);finish(s,result);
    window.dispatchEvent(new CustomEvent('cw:extra-correction-confirmed',{detail:{visitId:s.id,result,owner:s.captured.owner,token:s.captured.token}}));
  }
  $('#extraCorrectionConfirm').onclick=async()=>{const s=active;if(!s)return;$('#extraCorrectionConfirm').disabled=true;try{await send(s);}catch(error){if(active===s&&store.same(s.captured)){showError(error,s.requestId?'correctionPendingError':null);fields.disabled=!!s.requestId;paintProducts();$('#extraCorrectionConfirm').textContent=t(s.requestId?'correctionConfirmSaved':'correctionConfirm');}}finally{if(active===s)$('#extraCorrectionConfirm').disabled=false;window.CWFieldOffline?.render();}};
  async function open(visit,captured=store.session(),rebase=false){
    const revision=++generation,s={captured,id:Number(visit.id),poolId:visit.poolId||visit.pool?.id,name:visit.pool?.name||visit.poolName||'Visita extra',nameIsFallback:!(visit.pool?.name||visit.poolName),saving:Promise.resolve(),requestId:null,raw:null};s.key=`cwExtraCorrectionDraft:v1:${captured?.owner}:${s.id}`;active=s;
    fields.disabled=true;discard.disabled=true;$('#extraCorrectionPreview').hidden=true;$('#extraCorrectionPreview').disabled=true;$('#extraCorrectionConfirm').hidden=true;$('#extraCorrectionRefresh').hidden=true;$('#extraCorrectionReview').hidden=true;$('#extraCorrectionName').textContent=s.name;showStatus('correctionLoading');fill({});if(!dialog.open)dialog.showModal();
    try{
      assert(s);if(!selected(s))throw copyError('correctionChooseVisit');const draft=read(s),records=(await store.records(scope,captured,true)).filter(row=>row.resourceId===s.id),pending=records.find(row=>!row.response),previous=records.find(row=>row.requestId===draft?.requestId)?.response;
      let snapshot;try{const response=await fetch(`/api/field/extra-visits/${s.id}/correction`,{headers:{Authorization:'Bearer '+captured.token},cache:'no-store',signal:AbortSignal.timeout(12000)});const data=await response.json().catch(()=>{throw Object.assign(copyError('correctionIncompleteResponse'),{invalidResponse:true});});if(response.status!==200)throw Object.assign(data.error?Error(data.error):copyError('correctionReadUnconfirmed'),{status:response.status});if(data.ok!==true||data.visit?.id!==s.id||data.visit.visitType!=='EXTRA'||data.visit.poolId!==s.poolId||data.visit.technicianId!==captured.technicianId||data.visit.status!=='DONE'||!/^[a-f0-9]{64}$/.test(data.version)||!P.packet(data.productCatalogue,{owner:captured.owner,technicianId:captured.technicianId,id:s.id,poolId:s.poolId,baseVersion:data.version}))throw Object.assign(copyError('correctionIncompleteResponse'),{invalidResponse:true});snapshot=data;}catch(error){if(!draft||error.status||error.invalidResponse)throw error;showStatus('correctionSavedVersion');}
      if(revision!==generation||active!==s||!selected(s))return;
      s.baseline=snapshot?.visit||draft.baseline;s.baseVersion=snapshot?.version||draft.baseVersion;s.draft=draft;
      let payload=draft?.payload||{...s.baseline,products:s.baseline.chemicalsJson||[]};
      if(previous?.applied&&!pending)payload={...s.baseline,products:s.baseline.chemicalsJson||[],reason:''};
      if(draft&&!rebase&&!previous?.applied){s.baseline=draft.baseline;s.baseVersion=draft.baseVersion;}
      if(pending){s.requestId=pending.requestId;s.baseVersion=pending.payload.baseVersion;payload=pending.payload;}
      const candidate=snapshot?.version===s.baseVersion?snapshot.productCatalogue:draft?.productCatalogue;s.catalogue=P.packet(candidate,{owner:captured.owner,technicianId:captured.technicianId,id:s.id,poolId:s.poolId,baseVersion:s.baseVersion})?candidate:null;s.items=P.items(s.catalogue);s.source=snapshot?.productCatalogue===s.catalogue?'live':'cache';
      fill(payload);fields.disabled=!!pending;paintProducts();discard.disabled=!!pending;$('#extraCorrectionPreview').hidden=!!pending;$('#extraCorrectionPreview').disabled=false;$('#extraCorrectionConfirm').textContent=t(pending?'correctionConfirmSaved':'correctionConfirm');$('#extraCorrectionConfirm').hidden=!pending;
      if(pending){showStatus('correctionPending');return;}
      if(!rebase&&draft&&!previous?.applied&&snapshot&&draft.baseVersion!==snapshot.version){fields.disabled=true;$('#extraCorrectionPreview').disabled=true;$('#extraCorrectionRefresh').hidden=false;showStatus('correctionStaleDraft');return;}
      if(snapshot)showStatus(rebase?'correctionRebase':previous&&!previous.applied?'correctionPreviousNotApplied':'correctionCurrentRead',{message:rejectionMessage(previous)});
      if(rebase||previous?.applied)await save(s,collect(),null);
    }catch(error){if(active===s&&revision===generation&&store.same(captured))showError(error);}
  }
  $('#extraCorrectionRefresh').onclick=async()=>{const s=active;if(!s||!selected(s))return;try{await s.saving;await open({id:s.id,poolId:s.poolId,poolName:s.name},s.captured,true);}catch(error){if(active===s&&store.same(s.captured))showError(error);}};
  function clearDialog(){++generation;active=null;fields.disabled=true;fill({});$('#extraCorrectionReview').replaceChildren();$('#extraCorrectionReview').hidden=true;$('#extraCorrectionName').textContent='';$('#extraCorrectionGuideStatus').textContent='';status.textContent='';}
  $('#extraCorrectionClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{if(!dialog.open)clearDialog();});
  discard.onclick=async()=>{const s=active;if(!s||s.requestId||!selected(s)||!confirm(t('correctionDiscardQuestion')))return;try{await s.saving;assert(s);await navigator.locks.request(s.key,async()=>{assert(s);if(localStorage.getItem(s.key)!==s.raw)throw copyError('correctionDraftChanged');localStorage.removeItem(s.key);if(localStorage.getItem(s.key)!==null)throw copyError('correctionRemoveUnconfirmed');});dialog.close();}catch(error){if(active===s&&store.same(s.captured))showError(error);}};
  window.addEventListener('cw:extra-correction-confirmed',event=>{const s=active;if(s&&s.requestId===event.detail.result?.receipt?.requestId&&s.captured.owner===event.detail.owner&&s.captured.token===event.detail.token)finish(s,event.detail.result);});
  function protect(){if(active&&!selected(active)){dialog.close();clearDialog();}}
  window.addEventListener('storage',protect);window.addEventListener('cw:field-visit-selected',protect);setInterval(protect,1000);
  async function pendingDrafts(){const captured=store.session();if(!captured)return [];const prefix=`cwExtraCorrectionDraft:v1:${captured.owner}:`,records=await store.records(scope,captured,true),rows=[];for(const key of Object.keys(localStorage).filter(key=>key.startsWith(prefix))){let draft;try{draft=JSON.parse(localStorage.getItem(key));}catch(_){throw Error(t('correctionUnreadableDraft'));}if(draft?.v!==1||draft.owner!==captured.owner||!draft.baseline||!Array.isArray(draft.payload?.products))throw Error(t('correctionReviewDraft'));if(draft.requestId&&records.some(row=>row.requestId===draft.requestId))continue;if(differences(draft.baseline,draft.payload).length)rows.push({visitId:draft.id,name:draft.name||t('correctionVisit')+' '+draft.id});}if(!store.same(captured))throw Error(t('correctionSessionChanged'));return rows;}
  paintCopy();
  window.CWExtraVisitCorrection={open,pendingDrafts};
})();
