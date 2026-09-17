(function(){
  'use strict';
  const store=window.CWFieldWriteStore,flow=window.CWIncompleteWorkflow,$=id=>document.getElementById(id),scope='VISIT_INCOMPLETE';
  const fields=['incompleteReason','incompleteNextStep','shortageProduct','shortageQuantity','shortageUnit'];
  const terminal=['DONE','COMPLETED','CONCLUIDA','CONCLUIDO','CANCELLED','CANCELED','SKIPPED','ARCHIVED'];
  let state=null,revision=0,syncing=false,message='',selectionSignature=null;
  const banner=document.createElement('aside');banner.id='incompletePendingBanner';banner.setAttribute('role','status');banner.setAttribute('data-cw-state-managed','manual');banner.style.cssText='padding:14px;background:#fff4ce;color:#624400;overflow-wrap:anywhere';banner.hidden=true;document.body.prepend(banner);
  function same(s){return s===state&&store.same(s?.captured);}
  function legacy(captured){const raw=localStorage.getItem(`cwIncompleteVisits:${captured.technicianId}`);if(!raw)return false;const data=JSON.parse(raw);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Registos antigos ilegíveis. Conserve os dados e contacte o escritório.');return Object.keys(data).length>0;}
  function values(){return Object.fromEntries(fields.map(id=>[id,$(id).value]));}
  function changed(){
    const s=state;if(!same(s))return;
    const input=values();s.queue=s.queue.then(async()=>{if(!s.snapshot)throw Error('Aguarde a confirmação da visita antes de escrever.');s.draft=await flow.write(s.draft,s.context,input,s.draft.value?.snapshot||s.snapshot,s.captured);s.error=null;}).catch(error=>{s.error=error;if(same(s)){message=error.message;void render();}});
    const show=$('incompleteReason').value==='CHEMICAL_MISSING';$('chemicalShortageFields').hidden=!show;$('chemicalShortageFields').style.display=show?'block':'none';
  }
  async function render(){
    const captured=store.session();if(!captured){banner.hidden=true;$('incompleteSave').disabled=true;$('incompleteStatus').textContent='Sessão alterada. Reabra a página; os pedidos foram preservados.';return;}
    try{
      const all=await store.records(scope,captured,true),pending=all.filter(r=>!r.response||r.response.applied===false&&!r.reviewedAt),old=legacy(captured);
      if(!store.same(captured))return;
      banner.replaceChildren();banner.hidden=!pending.length&&!old;
      if(old){const p=document.createElement('p');p.textContent='Há impedimentos antigos sem conta e tipo confirmados. Conserve os dados e peça reconciliação ao escritório antes de criar outro registo.';banner.append(p);}
      for(const row of pending){const p=document.createElement('p');p.textContent=`${row.label} — ${row.response?.message||'por confirmar no escritório'}${row.failure?.blocked?'. Confirme a situação com o escritório antes de reenviar.':''}`;banner.append(p);if(row.response?.applied===false){const b=document.createElement('button');b.type='button';b.textContent='Rever recusa e atualizar visita';b.onclick=async()=>{await store.acknowledgeRejection(row.requestId,captured);if(!store.same(captured))return;message='Recusa revista. Confirme o estado atual e prepare novamente o registo.';if(state?.context.id===row.resourceId&&state.context.visitType===row.payload.visitType){await state.queue;await flow.clear(state.draft,captured);state=null;await select();}await render();};banner.append(b);}}
      const s=state,own=pending.filter(row=>same(s)&&row.resourceId===s.context.id&&row.payload.visitType===s.context.visitType);
      const blocked=own.some(row=>row.failure?.blocked);
      $('incompleteStatus').textContent=message||(blocked?'Registo preservado. Confirme a situação com o escritório antes de reenviar.':own.length?'Registo guardado neste telemóvel, por confirmar no escritório.':s?.snapshot?.visit.status==='INCOMPLETE'?'Visita por concluir registada no servidor. Aviso disponível para o escritório.':s?.draft?.value?'Rascunho guardado neste dispositivo. Confirme para enviar.':'');
      $('incompleteSave').disabled=!same(s)||s.busy||!s.snapshot||old||own.length>0||s.snapshot.hasReturn||!!s.snapshot.visit.endAt||terminal.includes(s.snapshot.visit.status);
      $('incompleteRetry').disabled=!pending.some(r=>!r.response);
      const show=$('incompleteReason').value==='CHEMICAL_MISSING';$('chemicalShortageFields').hidden=!show;$('chemicalShortageFields').style.display=show?'block':'none';
    }catch(error){banner.hidden=false;banner.textContent=error.message;$('incompleteStatus').textContent=error.message;$('incompleteSave').disabled=true;}
  }
  async function select(force=false){
    const context=window.CWFieldVisitContext?.(),captured=store.session();
    if(!context||!captured){state=null;void render();return;}
    if(!force&&same(state)&&state.context.id===context.id&&state.context.visitType===context.visitType&&state.context.poolId===context.poolId){void render();return;}
    const own=++revision,s={context,captured,snapshot:null,draft:null,queue:Promise.resolve(),busy:false};state=s;message='A confirmar a visita…';void render();
    try{
      s.draft=flow.read(scope,context,captured);
      if(s.draft.value)for(const id of fields)$(id).value=s.draft.value.values[id]||'';
      s.snapshot=await flow.view(context,captured);
      if(own!==revision||!same(s))return;
      message='';await render();
    }catch(error){if(same(s)){message=error.message;await render();}}
  }
  async function confirmed(record,result,captured){
    if(!store.same(captured))return;
    if(result.applied){
      const context={id:record.resourceId,visitType:record.payload.visitType,poolId:record.payload.poolId};
      const draft=flow.read(scope,context,captured);
      if(draft.value?.snapshot?.baseVersion===record.payload.baseVersion&&draft.value.values.incompleteReason===record.payload.reason&&draft.value.values.incompleteNextStep.trim()===record.payload.nextStep.trim())await flow.clear(draft,captured);
      message='Visita por concluir registada no servidor. Aviso disponível para o escritório.';
      if(same(state)&&state.context.id===record.resourceId&&state.context.visitType===record.payload.visitType){state.draft=flow.read(scope,context,captured);state.snapshot=null;await select(true);message='Visita por concluir registada no servidor. Aviso disponível para o escritório.';}
      window.dispatchEvent(new CustomEvent('cw:incomplete-confirmed',{detail:{owner:captured.owner,token:captured.token}}));
    }else message=result.message;
    window.dispatchEvent(new Event('cw:incomplete-updated'));await render();
  }
  async function sync(explicit=false){
    const captured=store.session();if(syncing||!captured||!navigator.onLine)return;syncing=true;
    try{
      const rows=await store.records(scope,captured);
      if(explicit&&rows.some(row=>row.failure?.blocked)&&!confirm('O escritório confirmou que pode repetir o envio destas visitas?'))return;
      for(const row of rows){if(!explicit&&(row.failure?.blocked||row.failure?.retryAt>Date.now()))continue;try{const result=await store.send(row.requestId,captured,{automatic:!explicit});await confirmed(row,result,captured);}catch(error){if(store.same(captured))message=`${error.message}${error.status>=400&&error.status<500?' Confirme a situação com o escritório antes de reenviar.':''}`;}}
    }catch(error){if(store.same(captured))message=error.message;}finally{syncing=false;void render();}
  }
  $('incompleteSave').onclick=async()=>{
    const s=state;if(!same(s)||$('incompleteSave').disabled)return;s.busy=true;message='';void render();
    try{
      changed();await s.queue;if(s.error)throw s.error;if(!same(s))return;
      const v=values(),reason=v.incompleteReason,nextStep=v.incompleteNextStep.trim();if(!reason||nextStep.length<5||nextStep.length>1000)throw Error('Escolha o motivo e indique o próximo passo (5–1000 caracteres).');
      const body={reason,nextStep};
      if(reason==='CHEMICAL_MISSING'){const quantity=v.shortageQuantity.trim()?Number(v.shortageQuantity.replace(',','.')):null,productName=v.shortageProduct.trim(),unit=v.shortageUnit;if(productName.length<2||productName.length>120||!['L','KG','UN'].includes(unit)||quantity!==null&&(!Number.isFinite(quantity)||quantity<=0||quantity>100000))throw Error('Indique o produto e uma quantidade positiva, ou deixe por confirmar.');body.chemicalShortage={productName,quantity,unit};}
      await flow.prepare(scope,s.context,body,s.draft.value?.snapshot||s.snapshot,s.captured);message='Registo guardado neste telemóvel, por confirmar no escritório.';await render();await sync();
    }catch(error){if(same(s))message=error.message;}finally{s.busy=false;void render();}
  };
  $('incompleteRetry').onclick=()=>sync(true);
  for(const id of fields){$(id).addEventListener('input',changed);$(id).addEventListener('change',changed);}
  window.addEventListener('cw:field-visit-selected',event=>{const signature=JSON.stringify(event.detail),force=selectionSignature!==null&&selectionSignature!==signature;selectionSignature=signature;void select(force);});
  window.addEventListener('cw:field-write-change',()=>render());
  window.addEventListener('online',()=>{void select(true);void sync();});window.addEventListener('pageshow',()=>sync());
  window.addEventListener('storage',()=>{if(state&&!store.same(state.captured)){state=null;message='Sessão alterada. Reabra a página.';}void render();});
  setInterval(()=>{void render();void sync();},15000);
  async function pendingSummary(){const captured=store.session();if(!captured)throw Error('Sessão alterada');const rows=await store.records(scope,captured,true);const items=rows.filter(r=>!r.response||r.response.applied===false&&!r.reviewedAt).map(row=>({kind:'pending',text:`${row.label} — ${row.response?.message||'impedimento por confirmar no escritório'}.`}));if(legacy(captured))items.push({kind:'unknown',text:'Impedimentos antigos por reconciliar com o escritório.'});for(let i=0;i<localStorage.length;i++){const name=localStorage.key(i);if(name.startsWith(`cwIncompleteV2:${captured.owner}:${scope}:`)){const value=JSON.parse(localStorage.getItem(name));if(value?.values?.incompleteNextStep)items.push({kind:'pending',text:`Visita ${value.context.visitType==='EXTRA'?'extra ':''}#${value.context.id} — rascunho de impedimento guardado.`});}}return items;}
  window.CWFieldIncomplete={refresh:render,pendingSummary};void select();void sync();
})();
