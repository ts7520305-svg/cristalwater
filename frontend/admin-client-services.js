(() => {
  'use strict';
  const el=id=>document.getElementById(id),select=el('clientId');if(!select)return;
  const panel=document.createElement('section');panel.id='servicePanel';panel.className='card';
  panel.innerHTML=`<h3>Serviços e visitas por época</h3>
    <p>Cada cliente e instalação pode ter a sua frequência, dias, horários e serviços. O preço é a mensalidade total do contrato, sem IVA; as visitas previstas estão incluídas.</p>
    <button type="button" id="serviceLoad">Carregar acordo e calendário</button><p id="serviceClient"></p>
    <form id="serviceForm"><fieldset id="serviceFields" disabled><legend>Acordo anual por épocas</legend>
    <div class="serviceGrid"><label>Início do contrato<input id="serviceStart" type="date" required min="2000-01-01" max="2199-12-31"></label><label>Fim (opcional)<input id="serviceEnd" type="date" min="2000-01-01" max="2199-12-31"></label></div>
    <p>As épocas repetem-se anualmente dentro da vigência. Pode atravessar dezembro (por exemplo, setembro a maio). Defina todos os meses, mesmo quando não há visitas.</p>
    <div id="serviceSeasons"></div><button type="button" id="serviceAddSeason">Adicionar época</button>
    <label>Mês a planear<input id="serviceMonth" type="month" min="2000-01" max="2199-12" required></label>
    <p>Horários de Portugal continental. Num calendário mensal, dias 29–31 passam para o último dia dos meses mais curtos. Horários em falta ficam por planear.</p>
    <button type="submit" id="servicePreview">Simular acordo e visitas</button><button type="button" id="serviceCalendarPreview">Simular mês do acordo guardado</button>
    </fieldset></form>
    <div id="serviceImpact" aria-live="polite"></div><button type="button" id="serviceConfirm" disabled>Confirmar o que foi simulado</button>
    <button type="button" id="serviceRetry" hidden>Recuperar confirmação do envio</button><button type="button" id="serviceResolve" hidden>Recarregar para rever a recusa</button>
    <p id="serviceStatus" role="status" aria-live="polite"></p><p>A simulação mostra as visitas a criar, atualizar ou cancelar. Visitas manuais, reagendadas, iniciadas e concluídas são preservadas para revisão. As faturas existentes mantêm-se.</p>`;
  el('ratePanel').after(panel);
  const style=document.createElement('style');style.textContent='#servicePanel{overflow-wrap:anywhere;background:var(--ds-surface,#fff);color:var(--ds-text,#172a35)}#servicePanel label,#servicePanel legend,#servicePanel h3,#servicePanel p{color:var(--ds-text,#172a35)}#servicePanel fieldset{min-width:0;border:1px solid var(--cw-border,#cbd5e1);border-radius:10px;margin:14px 0;padding:12px}#servicePanel legend{max-width:100%}#servicePanel label{display:block;min-width:0}#servicePanel input,#servicePanel select,#servicePanel textarea{max-width:100%;min-width:0;width:100%;font:inherit;color:var(--ds-text,#172a35);-webkit-text-fill-color:var(--ds-text,#172a35);background:var(--ds-surface,#fff);opacity:1;border:1px solid var(--cw-border,#cbd5e1);border-radius:8px;padding:8px;min-height:44px}#servicePanel button{max-width:100%;white-space:normal}#servicePanel textarea{min-height:80px}.serviceGrid{display:flex;flex-wrap:wrap;gap:12px}.serviceGrid>label{flex:1 1 160px}.serviceSlot{display:flex;flex-wrap:wrap;gap:8px;align-items:end}.serviceSlot>label{flex:1 1 100px}#serviceImpact{white-space:pre-line}#serviceImpact ul{padding-left:22px}';document.head.append(style);
  let captured=null,current=null,options=null,version=0,busy=false,ready=false,dirty=false,simulation=null,pending=null,storageOK=true,sequence=0;
  const status=(text,state='ready')=>{el('serviceStatus').textContent=text;el('serviceStatus').dataset.state=state;};
  const token=()=>window.CristalAuth?.getToken?.()||localStorage.getItem('token');
  function identity(){try{const t=token(),claim=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))),u=JSON.parse(localStorage.getItem('user')||localStorage.getItem('cristalwater_user')||'null'),id=Number(claim.userId||claim.id);if(claim.role!=='ADMIN'||!Number.isSafeInteger(id)||id<=0||u&&Number(u.userId||u.id)!==id)return null;return {token:t,owner:'ADMIN:'+id};}catch{return null;}}
  captured=identity();
  function session(){const now=identity();if(!captured||now?.owner!==captured.owner||now.token!==captured.token){ready=false;current=null;simulation=null;panel.querySelector('#serviceSeasons').replaceChildren();el('serviceClient').textContent='';el('serviceImpact').replaceChildren();el('serviceStart').value='';el('serviceEnd').value='';status('Sessão alterada. Reabra com a conta original para recuperar o envio.','session');controls();throw Error('Sessão alterada.');}}
  const key=()=>`cwClientServices:v1:${captured.owner}:${current}`;
  const draftKey=()=>key()+':draft';
  function readRecord(){const raw=localStorage.getItem(key());if(!raw)return {schema:1,owner:captured.owner,clientId:current};const record=JSON.parse(raw);if(record.schema!==1||record.owner!==captured.owner||record.clientId!==current||record.pending&&(!record.pending.body?.requestId||!record.pending.payloadHash||!['SAVE','GENERATE'].includes(record.pending.kind)))throw Error('Os dados de recuperação precisam de revisão. Foram preservados.');return record;}
  function writeRecord(record){session();const value=JSON.stringify(record);localStorage.setItem(key(),value);if(localStorage.getItem(key())!==value)throw Error('O envio não ficou guardado neste dispositivo.');}
  function controls(){el('serviceFields').disabled=busy||!ready||!!pending||!storageOK;el('serviceLoad').disabled=busy;el('serviceConfirm').disabled=busy||!ready||!simulation||!!pending||!storageOK;el('serviceRetry').hidden=!pending||!!pending.refused;el('serviceRetry').disabled=busy;el('serviceResolve').hidden=!pending?.refused;el('serviceResolve').disabled=busy;}
  async function api(path,body,method='POST'){
    session();const timer=new AbortController(),timeout=setTimeout(()=>timer.abort(),20000);
    try{const response=await fetch(path,{method,signal:timer.signal,headers:{Authorization:'Bearer '+captured.token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();session();if(response.status!==200||result.ok!==true)throw Object.assign(Error(result.error||'Não foi possível confirmar a resposta.'),{status:response.status});return result;}finally{clearTimeout(timeout);}
  }
  async function run(fn){if(busy)return;busy=true;controls();status('A confirmar os dados…','loading');try{session();await fn();}catch(error){if(identity()?.token===captured?.token)status(error.message,pending?'pending':'error');}finally{busy=false;controls();}}
  function option(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o;}
  const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const week=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  function addSlot(rule,value={}){
    const row=document.createElement('div');row.className='serviceSlot';row.innerHTML='<label>Dia<select data-slot="day" required></select></label><label>Hora<input data-slot="at" type="time" required></label><button type="button">Remover horário</button>';
    const day=row.querySelector('select'),frequency=rule.querySelector('[data-rule=frequency]').value;
    day.append(option('','Escolher dia'));(frequency==='WEEKLY'?week:Array.from({length:31},(_,i)=>'Dia '+(i+1))).forEach((text,i)=>day.append(option(frequency==='WEEKLY'?i:i+1,text)));
    day.value=value.day??'';row.querySelector('input').value=value.at??'';
    row.querySelector('button').onclick=()=>{row.remove();changed();};rule.querySelector('.serviceSlots').append(row);
  }
  function addRule(season,value={}){
    const row=document.createElement('fieldset');row.className='serviceRule';row.innerHTML='<legend>Visitas de uma instalação</legend><div class="serviceGrid"><label>Instalação<select data-rule="poolId" required></select></label><label>Frequência<select data-rule="frequency"><option value="WEEKLY">Por semana</option><option value="MONTHLY">Por mês</option></select></label><label>Número total de visitas<input data-rule="count" type="number" min="1" max="168" step="1" required></label><label>Atribuição<select data-rule="assignment"></select></label></div><div class="serviceSlots"></div><button type="button" class="addSlot">Adicionar dia e horário</button> <button type="button" class="removeRule">Remover instalação</button>';
    const pools=row.querySelector('[data-rule=poolId]');pools.append(option('','Escolher instalação'));for(const p of options.pools)pools.append(option(p.id,p.name||'Piscina '+p.id));
    pools.value=value.poolId??'';row.querySelector('[data-rule=frequency]').value=value.frequency||'WEEKLY';row.querySelector('[data-rule=count]').value=value.count??'';
    const assigned=row.querySelector('[data-rule=assignment]');assigned.append(option('','Por atribuir'));
    for(const t of options.technicians)assigned.append(option('T:'+t.id,'Técnico: '+t.name));for(const r of options.rounds)assigned.append(option('R:'+r.id,'Atribuição da ronda: '+r.name));
    const selected=value.technicianId?'T:'+value.technicianId:value.roundId?'R:'+value.roundId:'';
    if(selected&&![...assigned.options].some(o=>o.value===selected))assigned.append(option(selected,'Atribuição anterior indisponível — rever'));assigned.value=selected;
    (value.slots||[]).forEach(s=>addSlot(row,s));
    row.querySelector('[data-rule=frequency]').onchange=()=>{const slots=[...row.querySelectorAll('.serviceSlot')].map(s=>({day:s.querySelector('select').value,at:s.querySelector('input').value}));row.querySelector('.serviceSlots').replaceChildren();slots.forEach(s=>addSlot(row,s));changed();};
    row.querySelector('.addSlot').onclick=()=>{addSlot(row);changed();};row.querySelector('.removeRule').onclick=()=>{row.remove();changed();};season.querySelector('.serviceRules').append(row);
  }
  function addSeason(value={}){
    const row=document.createElement('fieldset');row.className='serviceSeason';row.innerHTML='<legend>Época</legend><div class="serviceGrid"><label>Designação<input data-season="label" maxlength="120" required></label><label>Do mês<select data-season="fromMonth" required></select></label><label>Até ao mês<select data-season="toMonth" required></select></label><label>Mensalidade total (€)<input data-season="monthlyAmount" type="number" min="0" max="10000000" step="0.01" required></label></div><label>Serviços incluídos<textarea data-season="services" maxlength="2000" required></textarea></label><div class="serviceRules"></div><button type="button" class="addRule">Adicionar instalação</button> <button type="button" class="removeSeason">Remover época</button>';
    for(const name of ['fromMonth','toMonth']){const s=row.querySelector(`[data-season=${name}]`);s.append(option('','Escolher mês'));months.forEach((m,i)=>s.append(option(i+1,m)));}
    for(const input of row.querySelectorAll('[data-season]'))input.value=value[input.dataset.season]??(input.dataset.season==='monthlyAmount'&&value.monthlyCents!=null?value.monthlyCents/100:'');
    (value.schedules||[]).forEach(s=>addRule(row,s));row.querySelector('.addRule').onclick=()=>{addRule(row);changed();};row.querySelector('.removeSeason').onclick=()=>{row.remove();changed();};el('serviceSeasons').append(row);
  }
  function form(){return {startsOn:el('serviceStart').value,endsOn:el('serviceEnd').value||null,seasons:[...el('serviceSeasons').children].map(row=>({...Object.fromEntries([...row.querySelectorAll('[data-season]')].map(x=>[x.dataset.season,x.value])),schedules:[...row.querySelectorAll('.serviceRule')].map(rule=>{const get=name=>rule.querySelector(`[data-rule=${name}]`).value,a=get('assignment');return {poolId:get('poolId'),frequency:get('frequency'),count:get('count'),technicianId:a.startsWith('T:')?Number(a.slice(2)):null,roundId:a.startsWith('R:')?Number(a.slice(2)):null,slots:[...rule.querySelectorAll('.serviceSlot')].map(s=>({day:s.querySelector('select').value,at:s.querySelector('input').value}))};})}))};}
  function fill(plan){el('serviceStart').value=plan?.startsOn||'';el('serviceEnd').value=plan?.endsOn||'';el('serviceSeasons').replaceChildren();(plan?.seasons||[]).forEach(addSeason);}
  function changed(){if(!ready||busy||pending)return;simulation=null;dirty=true;el('serviceImpact').replaceChildren();try{session();sessionStorage.setItem(draftKey(),JSON.stringify({schema:1,version,plan:form(),monthRef:el('serviceMonth').value}));}catch(error){storageOK=false;status('Não foi possível guardar o rascunho. Preserve os dados antes de sair.','error');}controls();}
  async function load(){
    const clientId=Number(select.value);if(!clientId)throw Error('Escolha um cliente pelo nome.');
    const ticket=++sequence;ready=false;simulation=null;el('serviceImpact').replaceChildren();status('A carregar o acordo…','loading');
    const result=await api('/api/settings/client-services/'+clientId,null,'GET');
    if(ticket!==sequence||Number(select.value)!==clientId)return;
    if(result.clientId!==clientId||!Array.isArray(result.pools)||!Array.isArray(result.technicians)||!Array.isArray(result.rounds))throw Error('A resposta não corresponde ao cliente escolhido.');
    current=clientId;options=result;version=result.plan?.version||0;storageOK=true;dirty=false;
    el('serviceClient').textContent=result.clientName+' · Versão '+version;
    fill(result.plan?.snapshot?.servicePlan);el('serviceMonth').value=new Date().toISOString().slice(0,7);
    const record=readRecord();pending=record.pending||null;
    const draft=JSON.parse(sessionStorage.getItem(draftKey())||'null');
    if(draft){if(draft.schema!==1||!draft.plan)throw Error('Rascunho inválido. Os dados foram preservados.');fill(draft.plan);el('serviceMonth').value=draft.monthRef;dirty=true;if(draft.version!==version){status('Existe uma versão mais recente. O seu rascunho foi preservado; reveja todos os campos e simule novamente.','conflict');}}
    ready=true;
    status(pending?(pending.refused?'O envio foi recusado. Recarregue para rever antes de preparar outro.':'Há um envio por confirmar. Recupere a confirmação antes de alterar o acordo.'):dirty?'Rascunho recuperado. Reveja-o e simule antes de guardar.':'Acordo carregado. Configure os serviços e a frequência acordados.',pending?'pending':'ready');
  }
  function impact(result,kind){
    const output=el('serviceImpact');output.replaceChildren();const text=document.createElement('p');
    const s=result.summary,euro=new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'});
    text.textContent=`${kind==='SAVE'?'Guardar nova versão e aplicar':'Aplicar acordo guardado a'} ${result.monthRef}\nMensalidade: ${euro.format(result.pricing.amount)} sem IVA.\nCriar: ${s.create}; atualizar: ${s.update}; cancelar: ${s.cancel}; já agendadas: ${s.keep}; preservar: ${s.preserve}; rever: ${s.review}; por planear: ${s.pending}.`;output.append(text);
    const list=document.createElement('ul');const labels={CREATE:'Criar',UPDATE:'Atualizar',CANCEL:'Cancelar',KEEP:'Já agendada',PRESERVE:'Preservar',REVIEW:'Rever'};
    for(const row of result.actions){const li=document.createElement('li');li.textContent=`${labels[row.action]} · ${row.day}${row.at?' '+row.at:''} · ${row.poolName}${row.technicianName?' · '+row.technicianName:''} — ${row.reason}`;list.append(li);}
    for(const row of result.pending){const li=document.createElement('li');li.textContent=`Por planear · ${row.day} · ${row.poolName}: ${row.reason}`;list.append(li);}output.append(list);
  }
  async function simulate(kind){
    if(!ready||current!==Number(select.value))throw Error('Carregue o acordo deste cliente.');
    if(kind==='SAVE'&&!el('serviceForm').reportValidity())throw Error('Preencha os campos obrigatórios.');
    if(kind==='GENERATE'&&dirty)throw Error('Guarde e simule as alterações do acordo antes de gerar outro mês.');
    const body={expectedVersion:version,monthRef:el('serviceMonth').value,...(kind==='SAVE'?{baseMonthlyAmount:0,periods:[],servicePlan:form()}:{})};
    const selected=current,result=await api(`/api/settings/client-services/${selected}/${kind==='SAVE'?'preview':'calendar-preview'}`,body);
    if(current!==selected||Number(select.value)!==selected)return;
    if(result.clientId!==selected||result.expectedVersion!==version||result.monthRef!==body.monthRef||!/^[a-f0-9]{64}$/.test(result.payloadHash)||!/^[a-f0-9]{64}$/.test(result.reviewToken)||!Array.isArray(result.actions)||!Array.isArray(result.pending))throw Error('Simulação incompleta.');
    simulation={kind,body:{...body,reviewToken:result.reviewToken},payloadHash:result.payloadHash,result};impact(result,kind);status('Reveja as datas, alterações e pendências acima. Só a confirmação grava.','preview');
  }
  async function locked(fn){if(!navigator.locks?.request)throw Error('Este navegador não permite coordenar os envios. Preserve os dados.');return navigator.locks.request(key(),{ifAvailable:true},async lock=>{if(!lock)throw Error('Existe um envio noutra janela. Aguarde e recupere a confirmação.');session();return fn();});}
  async function send(){
    const selected=current,record=readRecord();pending=record.pending;
    if(!pending||pending.refused)throw Error('Não existe envio por confirmar.');
    const request=pending;
    try{
      if(!navigator.onLine)throw Error('Sem ligação. O pedido está guardado; recupere a confirmação quando voltar a ter rede.');
      const result=await api(`/api/settings/client-services/${selected}${request.kind==='GENERATE'?'/calendar':''}`,request.body,request.kind==='SAVE'?'PUT':'POST');
      const r=result.receipt,expected=request.body.expectedVersion+(request.kind==='SAVE'?1:0);
      if(result.clientId!==selected||result.planVersion!==expected||result.monthRef!==request.body.monthRef||!Number.isSafeInteger(result.planId)||!Array.isArray(result.applied)||r?.owner!==captured.owner||r.resourceId!==selected||r.requestId!==request.body.requestId||r.scope!==(request.kind==='SAVE'?'CLIENT_SERVICE_PLAN':'CLIENT_SERVICE_GENERATION')||r.payloadHash!==request.payloadHash||!Number.isFinite(Date.parse(r.confirmedAt)))throw Error('A resposta não confirma este envio. Conserve o pedido original.');
      session();if(current!==selected)throw Error('Cliente alterado. Recupere a confirmação na ficha original.');
      writeRecord({...record,pending:null,confirmed:result});pending=null;simulation=null;dirty=false;sessionStorage.removeItem(draftKey());version=expected;
      status('Confirmado. Acordo e visitas guardados; as pendências indicadas continuam para revisão.','confirmed');ready=false;window.dispatchEvent(new Event('cw:client-services-saved'));
    }catch(error){
      if(identity()?.owner===captured.owner&&identity()?.token===captured.token&&current===selected&&[400,403,404,409].includes(error.status)){pending={...request,refused:{status:error.status,message:error.message}};writeRecord({...record,pending});}
      throw error;
    }
  }
  el('serviceLoad').onclick=()=>run(load);
  el('serviceAddSeason').onclick=()=>{addSeason();changed();};
  el('serviceForm').addEventListener('input',event=>{if(event.target.id!=='serviceMonth')changed();else{simulation=null;controls();}});
  el('serviceForm').addEventListener('change',event=>{if(event.target.id!=='serviceMonth')changed();});
  el('serviceForm').onsubmit=event=>{event.preventDefault();run(()=>simulate('SAVE'));};
  el('serviceCalendarPreview').onclick=()=>run(()=>simulate('GENERATE'));
  el('serviceConfirm').onclick=()=>run(()=>locked(async()=>{
    if(!simulation)throw Error('Simule primeiro.');const record=readRecord();if(record.pending){pending=record.pending;throw Error('Há um envio por confirmar nesta ficha.');}
    pending={kind:simulation.kind,body:{...simulation.body,requestId:crypto.randomUUID()},payloadHash:simulation.payloadHash};writeRecord({...record,pending});await send();
  }));
  el('serviceRetry').onclick=()=>run(()=>locked(send));
  el('serviceResolve').onclick=()=>run(()=>locked(async()=>{const record=readRecord();if(!record.pending?.refused)throw Error('Recupere primeiro a confirmação.');writeRecord({...record,history:[...(record.history||[]),record.pending],pending:null});pending=null;await load();status('Recusa conservada. Reveja o rascunho face ao acordo atual e simule novamente.','ready');}));
  select.addEventListener('change',()=>{sequence++;current=null;ready=false;pending=null;simulation=null;options=null;el('serviceClient').textContent='';el('serviceSeasons').replaceChildren();el('serviceStart').value='';el('serviceEnd').value='';el('serviceImpact').replaceChildren();status('Carregue o acordo do cliente selecionado.');controls();});
  window.addEventListener('storage',event=>{try{session();if(current&&event.key===key()){pending=readRecord().pending||null;simulation=null;status('A ficha foi usada noutra janela. Recarregue ou recupere a confirmação.','conflict');controls();}}catch{}});
  window.addEventListener('pageshow',()=>{try{session();simulation=null;controls();}catch{}});
  setInterval(()=>{try{session();}catch{}},1000);
  status('Escolha um cliente e carregue o acordo.');controls();
})();
