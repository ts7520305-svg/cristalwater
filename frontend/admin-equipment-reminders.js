(() => {
  'use strict';
  const root=document.getElementById('equipmentReminderControls');if(!root)return;
  const el=id=>document.getElementById(id),checkbox=el('equipmentRemindersEnabled'),save=el('equipmentRemindersSave'),reload=el('equipmentRemindersReload'),check=el('equipmentRemindersCheck'),status=el('equipmentRemindersStatus'),automatic=el('equipmentRemindersAutomatic');
  const token=()=>window.CristalAuth?.getToken?.()||localStorage.getItem('token'),owner=token();
  let saved=false,loaded=false,busy=false,closed=false;
  function controls(){checkbox.disabled=busy||!loaded||closed;save.disabled=busy||!loaded||closed||checkbox.checked===saved;check.disabled=busy||!loaded||closed||checkbox.checked!==saved;reload.disabled=busy||closed;}
  function session(){if(!owner||token()!==owner){closed=true;loaded=false;root.hidden=true;checkbox.checked=false;status.textContent='';automatic.textContent='';controls();throw Error('Sessão alterada. Reabra a página.');}}
  async function api(path,method='GET',payload){session();const response=await fetch(`/api/equipment-maintenance/notifications/${path}`,{method,headers:{Authorization:`Bearer ${owner}`,'Content-Type':'application/json'},cache:'no-store',body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(12000)});const data=await response.json();session();if(!response.ok||data.ok!==true)throw Error(data.error||data.message||'Resposta não confirmada pelo servidor.');return data;}
  async function read(){const data=await api('config');if(typeof data.enabled!=='boolean'||typeof data.automaticChecksEnabled!=='boolean')throw Error('Configuração recebida incompleta.');saved=data.enabled;checkbox.checked=saved;loaded=true;automatic.textContent=data.automaticChecksEnabled?'Verificação automática ativa neste servidor.':'Verificação automática não está ativa neste servidor.';}
  async function run(fn){if(busy||closed)return;busy=true;controls();try{session();await fn();}catch(error){if(!closed){loaded=false;checkbox.checked=saved;status.textContent=`Não foi possível confirmar. ${error.message} Atualize a configuração antes de voltar a guardar ou verificar.`;}}finally{busy=false;controls();}}
  reload.onclick=()=>run(async()=>{loaded=false;await read();status.textContent='Configuração atualizada.';});
  checkbox.onchange=()=>{controls();status.textContent=checkbox.checked===saved?'Configuração sem alterações.':'Alteração por guardar.';};
  save.onclick=()=>{if(!loaded||busy||checkbox.checked===saved)return;const enabled=checkbox.checked;run(async()=>{loaded=false;await api('config','PUT',{enabled});await read();status.textContent=saved===enabled?'Configuração guardada e confirmada.':'A configuração foi alterada entretanto. Reveja o estado atual.';});};
  check.onclick=()=>{if(!loaded||busy||checkbox.checked!==saved)return;run(async()=>{const data=await api('check','POST',{});if(!Number.isInteger(data.created)||data.created<0||!Number.isInteger(data.superseded)||data.superseded<0)throw Error('Resultado da verificação incompleto.');status.textContent=data.skipped?`Verificação não executada: ${data.skipped}.`:`Verificação concluída. Avisos criados: ${data.created}. Avisos anteriores substituídos: ${data.superseded}.`;});};
  window.addEventListener('storage',()=>{try{session();}catch{}});window.addEventListener('focus',()=>{try{session();}catch{}});
  run(async()=>{status.textContent='A consultar configuração...';await read();status.textContent='Configuração carregada.';});
})();
