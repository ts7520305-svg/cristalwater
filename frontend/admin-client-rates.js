(() => {
 'use strict';
 const el=id=>document.getElementById(id),panel=el('ratePanel'),select=el('clientId');
 if(!panel || !select)return;
 const ownerToken=localStorage.getItem('token');
 let currentId=null,version=0,ready=false,busy=false,dirty=false;
 const status=text=>el('rateStatus').textContent=text;
 function session(){if(!ownerToken || localStorage.getItem('token')!==ownerToken){panel.hidden=true;select.replaceChildren();el('rateClient').textContent='';el('ratePreview').textContent='';el('ratePeriods').replaceChildren();el('rateBase').value='';throw Error('Sessão alterada. Reabra a página.');}}
 async function api(url,options={}){session();const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${ownerToken}`,'Content-Type':'application/json'}});const d=await r.json();session();if(!r.ok)throw Error(d.error||'Não foi possível concluir.');return d;}
 async function run(fn){if(busy)return;busy=true;const controls=[select,...panel.querySelectorAll('button,input')];controls.forEach(c=>c.disabled=true);try{session();await fn();}catch(e){status(e.message);}finally{controls.forEach(c=>c.disabled=false);busy=false;}}
 function changed(){dirty=true;el('ratePreview').textContent='';}
 function addPeriod(p={}){
  const row=document.createElement('fieldset');row.innerHTML='<legend>Período de preço</legend><label>Designação<input data-key="label" maxlength="120" placeholder="Ex.: verão"></label><label>De<input data-key="startsOn" type="date" min="2000-01-01" max="2199-12-31" required></label><label>Até (opcional)<input data-key="endsOn" type="date" min="2000-01-01" max="2199-12-31"></label><label>Mensalidade (€)<input data-key="monthlyAmount" type="number" min="0" max="10000000" step="0.01" required></label><button type="button">Remover período</button>';
  for(const input of row.querySelectorAll('input'))input.value=p[input.dataset.key]??(input.dataset.key==='monthlyAmount'&&p.monthlyCents!=null?p.monthlyCents/100:'');
  row.querySelector('button').onclick=()=>{row.remove();changed();};el('ratePeriods').append(row);
 }
 function payload(){
  if(!ready || Number(select.value)!==currentId)throw Error('Carregue o plano do cliente selecionado.');
  if(!el('rateForm').reportValidity())throw Error('Preencha os campos obrigatórios.');
  return{baseMonthlyAmount:Number(el('rateBase').value),expectedVersion:version,monthRef:el('rateMonth').value,
   periods:[...el('ratePeriods').children].map(row=>Object.fromEntries([...row.querySelectorAll('input')].map(input=>[input.dataset.key,input.type==='number'?Number(input.value):input.value])))};
 }
 async function load(){
  const id=Number(select.value);if(!id)throw Error('Escolha um cliente.');ready=false;
  const d=await api(`/api/settings/client-rates/${id}`);
  if(Number(select.value)!==id)return;
  currentId=id;version=d.plan?.version||0;
  el('rateForm').hidden=!!d.plan?.snapshot?.servicePlan;
  el('rateClient').textContent=`${d.clientName} · ${version?'Versão '+version:'Sem plano por período'}`;
  el('rateBase').value=d.plan?d.plan.snapshot.baseCents/100:d.legacyBaseAmount;
  el('ratePeriods').replaceChildren();(d.plan?.snapshot.periods||[]).forEach(addPeriod);
  el('ratePreview').textContent='';ready=!d.plan?.snapshot?.servicePlan;dirty=false;status(ready?'Plano carregado.':'Preços definidos no acordo sazonal. Use Serviços e visitas por época para rever preço e calendário em conjunto.');
 }
 select.addEventListener('change',()=>{
  if(dirty && !window.confirm('Descartar as alterações por guardar?')){select.value=currentId||'';return;}
  ready=false;dirty=false;currentId=null;version=0;el('ratePeriods').replaceChildren();el('rateBase').value='';el('ratePreview').textContent='';el('rateClient').textContent='Carregue o plano do cliente selecionado.';
 });
 el('rateLoad').onclick=()=>{if(dirty&&!window.confirm('Descartar alterações e recarregar?'))return;run(load);};
 el('rateAdd').onclick=()=>{if(!ready)return status('Carregue um cliente primeiro.');addPeriod();changed();};
 el('rateForm').addEventListener('input',changed);
 el('rateForm').onsubmit=event=>{event.preventDefault();let p;try{p=payload();}catch(e){return status(e.message);}run(async()=>{
  const d=await api('/api/settings/client-rates-preview',{method:'POST',body:JSON.stringify(p)}),q=d.preview;
  const euro=n=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(n);
  el('ratePreview').textContent=`Simulação ${q.monthRef}: ${euro(q.amount)} sem IVA
`+q.segments.map(s=>`${s.startsOn} a ${s.endsOn}: ${s.days}/${q.daysInMonth} dias a ${euro(s.monthlyAmount)}/mês (${s.label})`).join('\n');status('Simulação calculada. Ainda não foi guardada.');
 });};
 el('rateSave').onclick=()=>{let p;try{p=payload();}catch(e){return status(e.message);}if(!window.confirm('Guardar os preços acordados para este cliente? As faturas existentes mantêm-se.'))return;run(async()=>{await api(`/api/settings/client-rates/${currentId}`,{method:'PUT',body:JSON.stringify(p)});await load();status('Nova versão guardada. Faturas existentes preservadas.');});};
 el('rateMonth').value=new Date().toISOString().slice(0,7);
 window.addEventListener('cw:client-services-saved',()=>{ready=false;dirty=false;run(load);});
 window.addEventListener('storage',()=>{try{session();}catch{}});
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 run(async()=>{const d=await api('/api/core/clients');for(const c of d.clients||[]){const option=document.createElement('option');option.value=c.id;option.textContent=c.name;select.append(option);}const id=new URLSearchParams(location.search).get('clientId');if(id)select.value=id;status('Escolha o cliente pelo nome.');});
})();
