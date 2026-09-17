(function(){
  'use strict';
  const store=window.CWFieldWriteStore,captured=store?.adminSession(),mount=document.getElementById('pendingList'),scope='FIELD_CLIENT_APPROVAL';
  if(!mount||!store)return;mount.closest('section').dataset.cwStateManaged='manual';
  const status=document.createElement('p');status.id='intakeReviewStatus';status.setAttribute('role','status');
  const reload=document.createElement('button');reload.type='button';reload.id='intakeReviewReload';reload.textContent='Atualizar fichas';
  const list=document.createElement('div');list.id='intakeReviewList';mount.replaceChildren(status,reload,list);mount.style.overflowWrap='anywhere';
  let rows=[],saved=[],busy=false,closed=false,generation=0,listed=false;
  const active=()=>!closed&&store.same(captured),requireActive=()=>{if(!active())throw Error('A sessão mudou. Reabra com a conta original.');};
  const live=row=>!row.response||row.response.applied===false&&!row.reviewedAt;
  const text=(parent,tag,value)=>{const node=document.createElement(tag);node.textContent=value;parent.append(node);return node;};
  function button(parent,label,kind,id,action){const node=text(parent,'button',label);node.type='button';node.dataset[kind]=String(id);node.disabled=busy||!active();node.addEventListener('click',action);return node;}
  function render(){
    list.replaceChildren();reload.disabled=busy||!active();if(!active()){rows=[];saved=[];status.textContent='A sessão mudou. Reabra com a conta original.';return;}
    for(const row of saved.filter(live)){const card=text(list,'article','');card.className='item';card.dataset.intakePending=row.requestId;text(card,'strong',row.label||'Cliente #'+row.resourceId);text(card,'p','Aprovação de cliente #'+row.resourceId+' e piscinas: '+(row.payload.poolIds.join(', ')||'sem piscinas pendentes')+'.');text(card,'p',row.response?.message||row.failure?.message||'Aprovação guardada neste dispositivo, por confirmar.');button(card,row.response?'Rever ficha atual':'Confirmar aprovação guardada','intakeRecover',row.requestId,()=>recover(row));}
    for(const row of rows.filter(row=>!saved.some(record=>record.resourceId===row.id&&live(record)))){
      const card=text(list,'article','');card.className='item';card.dataset.intakeClient=row.id;text(card,'h3',row.name+' · Cliente #'+row.id);
      for(const [label,value] of [['Telefone',row.phone],['Email',row.email],['Morada',row.address],['Zona',row.zone],['Notas',row.notes]])text(card,'p',label+': '+(value||'Não indicado'));
      text(card,'p','Cliente: '+(row.pendingReview?'pendente de revisão':'já revisto')+'. A aprovação ativa o cliente e as piscinas pendentes apresentadas.');
      for(const pool of row.pools){text(card,'strong',(pool.name||'Piscina')+' #'+pool.id+(pool.pendingReview?' · pendente':' · já revista'));text(card,'p',[pool.type||'Tipo não indicado',pool.volumeM3===null?'Volume não indicado':pool.volumeM3+' m³',pool.address||'Morada não indicada',pool.latitude===null?'GPS não indicado':pool.latitude+', '+pool.longitude].join(' · '));if(pool.notes)text(card,'p',pool.notes);}
      text(card,'p','Esta aprovação não agenda visitas nem ativa contrato ou faturação.');
      const actions=text(card,'div','');actions.className='actions';button(actions,'Aprovar cadastro','intakeApprove',row.id,()=>approve(row));const link=text(actions,'a','Abrir ficha');link.className='btn';link.href='/client-detail?id='+encodeURIComponent(row.id);
    }
    if(!rows.length&&!saved.some(live))text(list,'p',listed?'Sem fichas pendentes nos dados consultados.':'A lista de fichas ainda não está confirmada.');
    const latest=saved.filter(row=>row.response?.applied).at(-1);if(latest)text(list,'p','Aprovação confirmada: cliente #'+latest.resourceId+' e '+latest.response.approval.poolIds.length+' piscina(s), em '+new Date(latest.response.approval.reviewedAt).toLocaleString('pt-PT')+'.');
  }
  async function refresh(){if(busy)return;const own=++generation;if(!active()){render();return;}let error='';try{const records=await store.records(scope,captured,true);if(!active()||own!==generation)return;saved=records;}catch(e){if(active()){rows=[];saved=[];listed=false;status.textContent=e.message;render();}return;}
    try{const response=await fetch('/api/technician-intake/pending-review',{headers:{Authorization:'Bearer '+captured.token},cache:'no-store',signal:AbortSignal.timeout(8000)}),data=await response.json();requireActive();if(own!==generation)return;if(!response.ok||data.ok!==true||!Array.isArray(data.clients)||data.clients.some(row=>!Number.isSafeInteger(row.id)||!/^intake-v1:[a-f0-9]{64}$/.test(row.approvalVersion)||!Array.isArray(row.approvalPoolIds)||!Array.isArray(row.pools)))throw Error('Não foi possível confirmar as fichas atuais.');rows=data.clients;listed=true;}catch(e){if(!active()||own!==generation)return;rows=[];listed=false;error=e.message;}
    if(!active()||own!==generation)return;render();status.textContent=error?'Consulta por confirmar. As aprovações guardadas continuam disponíveis. '+error:'Fichas consultadas. Reveja os dados antes de aprovar.';
  }
  async function execute(operation){if(busy)return;busy=true;++generation;render();let error='';try{requireActive();await operation();requireActive();}catch(e){error=e.message;}finally{busy=false;await refresh();if(error&&active())status.textContent='Aprovação por confirmar. '+error;}}
  async function approve(row){if(busy||!active()||!confirm('Aprovar este cliente e ativar as piscinas pendentes apresentadas?'))return;return execute(async()=>{const record=await store.prepare(scope,row.id,{clientId:row.id,expectedVersion:row.approvalVersion,poolIds:row.approvalPoolIds},{label:row.name},captured);await store.send(record.requestId,captured);});}
  async function recover(row){return execute(async()=>{if(row.response?.applied===false)await store.acknowledgeRejection(row.requestId,captured);else await store.send(row.requestId,captured);});}
  reload.addEventListener('click',refresh);window.addEventListener('cw:field-write-change',refresh);window.addEventListener('storage',()=>{if(!active())refresh();});window.addEventListener('pagehide',()=>{closed=true;++generation;});window.addEventListener('pageshow',()=>{closed=false;refresh();});setInterval(()=>{if(!active())refresh();},1000);refresh();
})();
