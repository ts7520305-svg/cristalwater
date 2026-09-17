(function(){
  'use strict';
  const store=window.CWFieldWriteStore;
  const key=(scope,context,captured)=>`cwIncompleteV2:${captured.owner}:${scope}:${context.visitType}:${context.id}`;
  const validContext=(context,data)=>data?.ok===true&&data.visit?.id===context.id&&data.visit.visitType===context.visitType&&data.visit.poolId===context.poolId&&/^[a-f0-9]{64}$/.test(data.baseVersion)&&typeof data.hasReturn==='boolean'&&typeof data.hasImpediment==='boolean';
  async function view(context,captured){
    if(!store.same(captured))throw Error('Sessão alterada. Reabra a página.');
    const cache=key('context',context,captured);
    if(!navigator.onLine){const saved=JSON.parse(localStorage.getItem(cache)||'null');if(!validContext(context,saved))throw Error('Ligue à rede para confirmar esta visita antes de preparar o pedido.');return saved;}
    const response=await fetch(`/api/technician/visits/${context.id}/incomplete?visitType=${context.visitType}`,{headers:{Authorization:'Bearer '+captured.token},cache:'no-store',signal:AbortSignal.timeout(10000)}),data=await response.json();
    if(!store.same(captured))throw Error('Sessão alterada.');
    if(response.status!==200||!validContext(context,data))throw Error(data.error||'Não foi possível confirmar a visita. Preserve o registo.');
    localStorage.setItem(cache,JSON.stringify(data));return data;
  }
  function read(scope,context,captured){
    if(!store.same(captured))throw Error('Sessão alterada.');
    const name=key(scope,context,captured),raw=localStorage.getItem(name),value=raw?JSON.parse(raw):null;
    if(value&&(value.owner!==captured.owner||value.context.id!==context.id||value.context.visitType!==context.visitType||value.context.poolId!==context.poolId||!value.values||!validContext(context,value.snapshot)))throw Error('Rascunho inválido. Conserve os dados e peça apoio.');
    return {name,raw,value};
  }
  async function write(previous,context,values,snapshot,captured){
    if(!navigator.locks?.request)throw Error('Este navegador não permite coordenar os rascunhos.');
    return navigator.locks.request(previous.name,async()=>{
      if(!store.same(captured))throw Error('Sessão alterada.');
      if(localStorage.getItem(previous.name)!==previous.raw)throw Error('O rascunho mudou noutra janela. Reabra a visita para recuperar a versão guardada.');
      if(!validContext(context,snapshot))throw Error('Confirme primeiro o contexto da visita.');
      const value={owner:captured.owner,context,values,snapshot,savedAt:new Date().toISOString()},raw=JSON.stringify(value);
      localStorage.setItem(previous.name,raw);if(localStorage.getItem(previous.name)!==raw)throw Error('O rascunho não ficou guardado.');
      return {name:previous.name,raw,value};
    });
  }
  async function clear(previous,captured){
    if(!previous)return;
    await navigator.locks.request(previous.name,async()=>{if(store.same(captured)&&localStorage.getItem(previous.name)===previous.raw)localStorage.removeItem(previous.name);});
  }
  async function prepare(scope,context,values,snapshot,captured){
    if(!validContext(context,snapshot))throw Error('Confirme primeiro o contexto da visita.');
    return store.prepare(scope,context.id,{visitType:context.visitType,poolId:context.poolId,baseVersion:snapshot.baseVersion,...values},{label:`${context.visitType==='EXTRA'?'Visita extra':'Visita'} #${context.id}`},captured);
  }
  window.CWIncompleteWorkflow={view,read,write,clear,prepare};
})();
