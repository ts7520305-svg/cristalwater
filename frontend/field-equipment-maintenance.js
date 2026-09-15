(() => {
  'use strict';
  const root = document.getElementById('fieldEquipmentMaintenance');
  if (!root) return;
  const list = document.getElementById('fieldEquipmentList'), status = document.getElementById('fieldEquipmentStatus'), refresh = document.getElementById('fieldEquipmentRefresh');
  const readToken = () => localStorage.getItem('token') || localStorage.getItem('cristalwater_jwt');
  const owner = readToken(), cache = new Map(), uncertain = new Map(), drafts = new Map();
  let visitId = null, revision = 0, busy = false, closed = false;
  function node(tag,text,parent) { const n=document.createElement(tag); if(text!=null)n.textContent=text; if(parent)parent.append(n); return n; }
  function valid(id,rev) {
    if (!owner || readToken() !== owner) { closed=true; root.hidden=true; list.replaceChildren();cache.clear();uncertain.clear();drafts.clear();return false; }
    return !closed && id===visitId && rev===revision;
  }
  function today() { return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
  async function api(url,options,id,rev) {
    if(!valid(id,rev))throw Error('Visita ou sessão alterada.');
    const response=await fetch(url,{...options,cache:'no-store',headers:{Authorization:`Bearer ${owner}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(12000)});
    const data=await response.json();
    if(!valid(id,rev))throw Error('Visita ou sessão alterada.');
    if(!response.ok||data.ok===false){const error=Error(data.error||data.message||'Não foi possível confirmar.');error.status=response.status;throw error;}
    return data;
  }
  function render(data,id,rev,offline=false) {
    list.replaceChildren();
    const plans=(data.plans||[]).filter(p=>p.active).sort((a,b)=>a.nextDue.localeCompare(b.nextDue));
    if(!plans.length){node('p','Sem revisões preventivas ativas para esta visita.',list);return;}
    for(const plan of plans){
      const card=node('article',null,list);card.className='field-equipment-plan';
      node('h3',plan.title,card);node('p',({FILTER:'Filtro',CHLORINATOR:'Clorador',PUMP:'Bomba',OTHER:'Outro'})[plan.component] || plan.component,card);
      node('strong',`${plan.nextDue<today()?'Em atraso':plan.nextDue===today()?'Previsto para hoje':'Próxima revisão'} · ${plan.nextDue}`,card);
      node('p',plan.instructions||'Consulte as instruções do equipamento e do escritório.',card);
      node('p',`Última execução: ${plan.lastCompletedAt?new Date(plan.lastCompletedAt).toLocaleString('pt-PT'):'Sem execução registada'}`,card);
      const pending=uncertain.get(`${id}:${plan.id}`);
      if(pending && plan.version!==pending.body.expectedVersion)uncertain.delete(`${id}:${plan.id}`);
      if(plan.completedInVisit){drafts.delete(`${id}:${plan.id}`);node('p','Revisão já registada nesta visita.',card);continue;}
      if(offline || !data.canComplete || plan.canComplete === false){node('p',offline?'Consulta guardada; confirme a ligação para registar trabalho.':'Esta visita não permite registar revisões neste momento.',card);continue;}
      const frozen=uncertain.get(`${id}:${plan.id}`);
      if(frozen){
        node('p','Resultado incerto. Atualize o estado ou repita a mesma confirmação. Os dados originais serão mantidos para evitar duplicações.',card);
        const retry=node('button','Repetir a mesma confirmação',card);retry.type='button';retry.onclick=()=>submit(plan,frozen.body,id,rev);
        continue;
      }
      const label=node('label','Trabalho realizado / observações',card),notes=node('textarea',null,label);notes.rows=2;notes.maxLength=1000;notes.value=drafts.get(`${id}:${plan.id}`)||'';
      const checkLabel=node('label',null,card);checkLabel.className='field-equipment-check';
      const check=node('input',null,checkLabel);check.type='checkbox';node('span','Confirmo que executei esta revisão do equipamento.',checkLabel);
      const action=node('button','Registar revisão realizada',card);action.type='button';action.disabled=true;
      function ready(){action.disabled=!check.checked||notes.value.trim().length<3||busy;}
      notes.oninput=()=>{drafts.set(`${id}:${plan.id}`,notes.value);ready();};check.onchange=ready;
      action.onclick=()=>{if(!check.checked||notes.value.trim().length<3||busy)return;submit(plan,{visitId:id,expectedVersion:plan.version,requestId:crypto.randomUUID(),notes:notes.value.trim(),confirmed:true},id,rev);};
    }
  }
  async function submit(plan,body,id,rev){
    if(busy||!valid(id,rev))return;
    if(!navigator.onLine){status.textContent='Sem ligação. A revisão ainda não foi registada.';return;}
    busy=true;root.querySelectorAll('button,input,textarea').forEach(n=>n.disabled=true);
    uncertain.set(`${id}:${plan.id}`,{body});
    try{
      await api(`/api/equipment-maintenance/plans/${plan.id}/complete`,{method:'POST',body:JSON.stringify(body)},id,rev);
      if(valid(id,rev)){uncertain.delete(`${id}:${plan.id}`);drafts.delete(`${id}:${plan.id}`);status.textContent='Revisão registada no servidor.';await load(true);}
    }catch(error){
      if(valid(id,rev)){
        if(error.status>=400&&error.status<500&&![408,425,429].includes(error.status))uncertain.delete(`${id}:${plan.id}`);
        status.textContent=`${uncertain.has(`${id}:${plan.id}`)?'Resultado incerto. Atualize para verificar antes de continuar.':'Revisão não confirmada. Atualize o estado.'} ${error.message}`;
        const saved=cache.get(id);if(saved)render(saved.data,id,rev,true);
      }
    }finally{busy=false;if(valid(id,revision))refresh.disabled=false;}
  }
  async function load(preserve=false){
    const id=visitId,rev=++revision;if(!valid(id,rev))return;
    refresh.disabled=true;list.replaceChildren();
    if(!id){status.textContent='Escolha uma visita.';refresh.disabled=false;return;}
    if(!preserve)status.textContent=`A consultar equipamentos da visita ${id}...`;
    try{
      const data=await api(`/api/equipment-maintenance/visits/${id}`,{},id,rev);
      cache.set(id,{data,at:new Date()});render(data,id,rev);
      if(!preserve)status.textContent=`Equipamentos da visita ${id} atualizados.`;
    }catch(error){if(valid(id,rev)){const saved=cache.get(id);status.textContent=saved?`Consulta guardada da visita ${id}, de ${saved.at.toLocaleString('pt-PT')}. Não foi possível atualizar.`:`Não foi possível consultar os equipamentos da visita ${id}. Tente atualizar.`;if(saved)render(saved.data,id,rev,true);}}
    finally{if(valid(id,rev))refresh.disabled=false;}
  }
  window.addEventListener('cw:field-visit-selected',event=>{
    const next=Number(event.detail?.visitId)||null;
    if(next===visitId)return;
    visitId=next;revision++;list.replaceChildren();load();
  });
  refresh.onclick=()=>{if(!busy)load();};
  window.addEventListener('storage',()=>valid(visitId,revision));
  window.addEventListener('focus',()=>valid(visitId,revision));
  const timer=setInterval(()=>valid(visitId,revision),500);
  window.addEventListener('pagehide',()=>clearInterval(timer));
})();
