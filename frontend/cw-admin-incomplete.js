(function(){
  'use strict';
  const store=window.CWFieldWriteStore,flow=window.CWIncompleteWorkflow,scope='VISIT_RETURN',forms=new WeakMap(),pageSession=store.adminSession();let refresh=async()=>{},syncing=false;
  const panel=document.createElement('section');panel.id='returnPendingPanel';panel.setAttribute('aria-live','polite');panel.hidden=true;document.getElementById('followupList').before(panel);
  function sessionChanged(){panel.hidden=true;panel.replaceChildren();document.getElementById('followupList').replaceChildren();document.getElementById('shortagePreparation').replaceChildren();document.getElementById('followupStatus').textContent='Sessão alterada. Reabra a página; os pedidos foram preservados.';}
  const read=form=>({date:form.elements.date.value,technicianId:Number(form.elements.technicianId.value),instructions:form.elements.instructions.value.trim()});
  function queue(form){const s=forms.get(form);if(!s||!store.same(s.captured))return;const values=read(form);s.queue=s.queue.then(async()=>{s.draft=await flow.write(s.draft,s.context,values,s.draft.value?.snapshot||s.snapshot,s.captured);s.error=null;}).catch(error=>{s.error=error;s.message.textContent=error.message;});}
  async function mount(form,context,options){
    refresh=options.refresh;const captured=store.adminSession(),s={context,captured,queue:Promise.resolve(),message:form.querySelector('[role=status]')};forms.set(form,s);
    for(const control of form.elements)control.disabled=true;
    try{
      if(!captured)throw Error('Confirme a sessão de escritório.');
      s.draft=flow.read(scope,context,captured);s.snapshot=await flow.view(context,captured);if(!store.same(captured)||!form.isConnected)return;
      if(s.draft.value)for(const [name,value]of Object.entries(s.draft.value.values))form.elements[name].value=value;
      const pending=(await store.records(scope,captured,true)).some(row=>row.resourceId===context.id&&row.payload.visitType===context.visitType&&(!row.response||row.response.applied===false&&!row.reviewedAt));
      if(pending){s.message.textContent='Há um pedido por confirmar ou uma recusa por rever acima.';return;}
      if(s.snapshot.hasReturn||s.snapshot.visit.status!=='INCOMPLETE'){s.message.textContent='O estado mudou. Atualize o acompanhamento.';return;}
      for(const control of form.elements)control.disabled=false;
      form.addEventListener('input',()=>queue(form));form.addEventListener('change',()=>queue(form));
      form.addEventListener('submit',async event=>{
        event.preventDefault();const button=form.querySelector('button');if(button.disabled)return;button.disabled=true;
        try{
          queue(form);await s.queue;if(s.error)throw s.error;const values=read(form);
          if(!await options.confirm(`Agendar o regresso para ${values.date}, com ${form.elements.technicianId.selectedOptions[0].textContent}? A visita original mantém o histórico.`,{title:'Confirmar regresso',confirmText:'Agendar'}))return;
          if(!store.same(captured))throw Error('A sessão mudou.');
          const record=await flow.prepare(scope,context,values,s.draft.value?.snapshot||s.snapshot,captured);
          for(const control of form.elements)control.disabled=true;
          await render();await send(record,captured,false);
        }catch(error){if(store.same(captured))s.message.textContent=`Pedido preservado. ${error.message}`;}finally{if(store.same(captured)&&form.isConnected)button.disabled=false;void render();}
      });
    }catch(error){if(store.same(captured))s.message.textContent=error.message;}
  }
  async function send(row,captured,automatic){
    const result=await store.send(row.requestId,captured,{automatic});if(!store.same(captured))return;
    if(result.applied){
      const context={id:row.resourceId,visitType:row.payload.visitType,poolId:row.payload.poolId},draft=flow.read(scope,context,captured),v=draft.value?.values;
      if(v&&v.date===row.payload.date&&Number(v.technicianId)===Number(row.payload.technicianId)&&v.instructions.trim()===row.payload.instructions.trim()&&draft.value.snapshot.baseVersion===row.payload.baseVersion)await flow.clear(draft,captured);
      await refresh();if(store.same(captured))document.getElementById('followupStatus').textContent=`Regresso #${result.visit.id} registado. O técnico deve atualizar a rota para o consultar.`;
    }
    await render();
  }
  async function render(){
    const captured=store.adminSession();if(!captured||!store.same(pageSession)){sessionChanged();return;}
    try{
      const all=await store.records(scope,captured,true),rows=all.filter(r=>!r.response||r.response.applied===false&&!r.reviewedAt);if(!store.same(captured))return;panel.replaceChildren();panel.hidden=!rows.length;
      for(const row of rows){const p=document.createElement('p');p.textContent=`${row.label} — ${row.response?.message||'agendamento guardado, por confirmar'}${row.failure?.message?': '+row.failure.message:''}`;const button=document.createElement('button');button.type='button';button.className='cw-v2-btn';button.textContent=row.response?'Rever recusa e atualizar':'Confirmar pedido original';button.onclick=async()=>{button.disabled=true;try{if(row.response){await store.acknowledgeRejection(row.requestId,captured);const context={id:row.resourceId,visitType:row.payload.visitType,poolId:row.payload.poolId};const draft=flow.read(scope,context,captured),v=draft.value?.values;if(v&&v.date===row.payload.date&&Number(v.technicianId)===Number(row.payload.technicianId)&&v.instructions.trim()===row.payload.instructions.trim()&&draft.value.snapshot.baseVersion===row.payload.baseVersion)await flow.clear(draft,captured);await refresh();}else await send(row,captured,false);}catch(error){if(store.same(captured))p.textContent=`Pedido preservado. ${error.message}`;}finally{button.disabled=false;if(row.response)void render();}};panel.append(p,button);}
    }catch(error){if(!store.same(captured)){sessionChanged();return;}panel.hidden=false;panel.textContent=error.message;}
  }
  async function sync(){
    const captured=store.adminSession();if(syncing||!captured||!store.same(pageSession)||!navigator.onLine)return;syncing=true;
    try{
      const rows=await store.records(scope,captured);if(!store.same(captured))return;
      for(const row of rows){if(!store.same(captured))return;if(row.failure?.blocked||row.failure?.retryAt>Date.now())continue;try{await send(row,captured,true);}catch(_){}}
    }catch(error){
      // A session can change during the queue read, before any send is attempted.
      if(store.same(captured)){panel.hidden=false;panel.textContent=`Pedidos preservados. ${error.message}`;}
    }finally{syncing=false;void render();}
  }
  window.CWAdminIncomplete={mount,render};window.addEventListener('cw:field-write-change',render);window.addEventListener('online',sync);window.addEventListener('storage',()=>{if(!store.adminSession()){panel.hidden=true;for(const form of document.querySelectorAll('#followupList form'))for(const c of form.elements)c.disabled=true;}void render();});setInterval(sync,15000);setTimeout(sync,1000);void render();
})();
