(() => {
 'use strict';
 const el=id=>document.getElementById(id),root=el('equipmentMaintenancePanel');if(!root)return;
 const token=()=>window.CristalAuth?.getToken?.()||localStorage.getItem('token'),owner=token();
 let poolId=0,editing=null,plans=[],dirty=false,busy=false,loaded=false,revision=0;
 const status=text=>{el('emStatus').textContent=text;};
 function session(){if(!owner||owner!==token()){root.hidden=true;el('emPlans').replaceChildren();el('emForm').reset();revision++;throw Error('Sessão alterada. Reabra a página.');}}
 async function api(url,method='GET',payload){session();const rev=revision;const response=await fetch(url,{method,headers:{Authorization:`Bearer ${owner}`,'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined,cache:'no-store'});const body=await response.json();session();if(rev!==revision)throw Error('Piscina alterada. Atualize os planos.');if(!response.ok||body.ok===false)throw Error(body.error||body.message||'Não foi possível concluir.');return body;}
 function controls(){root.querySelectorAll('button,input,select,textarea').forEach(c=>{if(!c.closest('#equipmentReminderControls'))c.disabled=busy;});el('emNew').disabled=busy||!loaded;el('emRefresh').disabled=busy||!poolId;el('emPool').disabled=busy||el('emPool').options.length<2;}
 async function run(fn){if(busy)return;busy=true;controls();try{session();await fn();}catch(e){status(e.message);}finally{busy=false;controls();}}
 function discard(){return !dirty||window.confirm('Existem alterações por guardar. Descartar?');}
 function close(){editing=null;dirty=false;el('emForm').hidden=true;el('emForm').reset();}
 function edit(plan){if(!discard())return;editing=plan||null;el('emForm').reset();el('emFormTitle').textContent=plan?'Editar plano':'Novo plano';for(const [key,id] of Object.entries({component:'emComponent',title:'emTitle',instructions:'emInstructions',intervalCount:'emCount',intervalUnit:'emUnit',nextDue:'emDue'})){if(plan)el(id).value=plan[key]??'';}el('emCount').max=el('emUnit').value==='MONTHS'?'120':'3650';el('emActive').checked=plan?plan.active:true;el('emForm').hidden=false;dirty=false;el('emTitle').focus();}
 function node(tag,text,parent){const n=document.createElement(tag);n.textContent=text;parent.append(n);return n;}
 function render(){el('emPlans').replaceChildren();if(!plans.length)node('p','Ainda não existem planos nesta piscina.',el('emPlans'));
  for(const plan of plans){const card=node('article','',el('emPlans'));card.className='em-plan';node('h3',plan.title,card);node('p',`${plan.active?'Ativo':'Pausado'} · Próxima revisão: ${plan.nextDue} · Repetir a cada ${plan.intervalCount} ${plan.intervalUnit==='MONTHS'?'meses':'dias'}`,card);if(plan.overdue&&plan.active)node('strong','Revisão em atraso',card);if(plan.lastCompletedAt)node('p','Última execução: '+new Date(plan.lastCompletedAt).toLocaleString('pt-PT'),card);if(plan.instructions)node('p',plan.instructions,card);const b=node('button','Editar / pausar',card);b.type='button';b.className='btn';b.onclick=()=>{if(!busy)edit(plan);};}
 }
 async function load(){loaded=false;close();el('emPlans').replaceChildren();const d=await api(`/api/equipment-maintenance/pools/${poolId}`);plans=d.plans||[];loaded=true;render();status('Planos atualizados.');}
 el('emLoadPools').onclick=()=>run(async()=>{const d=await api('/api/core/pools');const select=el('emPool');select.replaceChildren(new Option('Escolher piscina',''));for(const pool of d.pools||[])select.append(new Option(`${pool.name} · ${pool.client?.name||'Cliente'} · #${pool.id}`,String(pool.id)));select.value=String(poolId||'');status('Selecione a piscina.');});
 el('emPool').onchange=()=>{if(!discard()){el('emPool').value=String(poolId||'');return;}poolId=Number(el('emPool').value);revision++;loaded=false;close();el('emPlans').replaceChildren();if(poolId)run(load);else controls();};
 el('emNew').onclick=()=>edit(null);el('emCancel').onclick=()=>{if(discard())close();};el('emRefresh').onclick=()=>{if(discard())run(load);};
 el('emForm').oninput=()=>{dirty=true;};
 el('emUnit').onchange=()=>{el('emCount').max=el('emUnit').value==='MONTHS'?'120':'3650';dirty=true;};
 el('emForm').onsubmit=event=>{event.preventDefault();if(busy||!loaded||!el('emForm').reportValidity())return;const p={component:el('emComponent').value,title:el('emTitle').value.trim(),instructions:el('emInstructions').value.trim(),intervalCount:Number(el('emCount').value),intervalUnit:el('emUnit').value,nextDue:el('emDue').value,active:el('emActive').checked};
  if(!p.title)return status('Indique o nome do componente.');
  const id=editing?.id;if(editing)p.expectedVersion=editing.version;
  run(async()=>{try{await api(id?`/api/equipment-maintenance/plans/${id}`:`/api/equipment-maintenance/pools/${poolId}`,id?'PUT':'POST',p);}catch(e){loaded=false;close();el('emPlans').replaceChildren();throw Error(`${e.message} Atualize os planos para verificar o estado antes de voltar a guardar.`);}await load();status('Plano guardado. O técnico pode consultá-lo na visita desta piscina.');});
 };
 window.addEventListener('storage',()=>{try{session();}catch{}});controls();
})();
