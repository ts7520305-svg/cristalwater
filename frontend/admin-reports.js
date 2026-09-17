(function () {
  'use strict';
  const monthInput=document.getElementById('reportMonth'),mode=document.getElementById('reportMode'),refresh=document.getElementById('refreshReports'),status=document.getElementById('reportsStatus');
  const names={financial:'Financeiro',reports:'Relatórios guardados',communications:'Comunicações'};
  const keys=['cristalwater_jwt','token','adminToken','cristalwater_user','user'];
  const fingerprint=()=>JSON.stringify(keys.map(key=>localStorage.getItem(key)));
  const panels=Object.fromEntries(Object.keys(names).map(key=>[key,{root:document.getElementById(key+'Panel'),content:document.getElementById(key),status:document.getElementById(key==='reports'?'reportsStatusSection':key+'Status'),retry:document.querySelector('[data-report-retry="'+key+'"]'),state:'idle',snapshot:null}]));
  let identity='',credential='',invalid=false,generation=0,observedMonth='',observedMode='';
  const requests=new Set();
  try{identity=fingerprint();credential=localStorage.getItem('cristalwater_jwt')||localStorage.getItem('token')||'';}catch(_){}
  const wanted=()=>mode.value==='communications'?['communications']:mode.value==='financial'?['financial','reports']:Object.keys(names);
  const integer=value=>Number.isSafeInteger(value)&&value>=0;
  const amount=value=>value===null||integer(value);
  const money=value=>value===null?'Por rever':(value/100).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
  const date=value=>new Date(value).toLocaleString('pt-PT',{timeZone:'UTC'})+' UTC';
  function text(parent,tag,value){const node=document.createElement(tag);node.textContent=value;parent.append(node);return node;}
  function state(value,message){status.dataset.state=value;status.textContent=message;}
  function controls(){
    const busy=Object.values(panels).some(panel=>panel.state==='loading');
    refresh.disabled=busy||invalid;
    for(const panel of Object.values(panels)){panel.retry.disabled=busy||invalid;panel.root.setAttribute('aria-busy',String(panel.state==='loading'));}
  }
  function clear(){
    for(const panel of Object.values(panels)){panel.state='idle';panel.snapshot=null;panel.content.replaceChildren();panel.status.textContent='Atualize para consultar este período.';panel.retry.hidden=true;panel.root.dataset.state='idle';}
  }
  function stop(){generation++;for(const request of requests)request.abort();requests.clear();}
  function active(){
    let same=false;
    try{const user=JSON.parse(localStorage.getItem('cristalwater_user')||localStorage.getItem('user')||'{}');same=!!credential&&identity===fingerprint()&&String(user.role).toUpperCase()==='ADMIN'&&Number.isSafeInteger(Number(user.userId||user.id))&&Number(user.userId||user.id)>0;}catch(_){}
    if(same&&!invalid)return true;
    if(!invalid){invalid=true;stop();clear();monthInput.disabled=true;mode.disabled=true;controls();state('session','A sessão mudou. Reabra a página com a conta pretendida.');}
    return false;
  }
  function changed(){
    stop();clear();controls();
    observedMonth=monthInput.value;observedMode=mode.value;
    for(const [key,panel] of Object.entries(panels))panel.root.hidden=!wanted().includes(key);
    if(active())state('idle','O período mudou. Atualize para consultar o mês selecionado.');
  }
  function validate(body,section,month){
    const start=new Date(month+'-01T00:00:00Z'),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
    const fail=()=>{throw Error('A resposta não confirma o período, as fontes ou os valores desta secção. Tente novamente.');};
    if(body?.ok!==true||body.reportVersion!==1||body.section!==section||body.monthRef!==month||body.complete!==true||body.limitApplied!==null||body.period?.timeZone!=='UTC'||body.period.start!==start.toISOString()||body.period.end!==end.toISOString()||typeof body.generatedAt!=='string'||!Number.isFinite(Date.parse(body.generatedAt)))fail();
    const data=body.data;if(!data)fail();
    if(section==='financial'){
      const cash=data.cash,docs=data.documents;
      if(data.currency!=='EUR'||data.basis?.cash!=='PAYMENT_PAID_AT_UTC'||data.basis.documents!=='DOCUMENT_MONTH_REFERENCE_CURRENT_VALUES'||data.basis.balance!=='CURRENT_DOCUMENT_BALANCE'||data.basis.internalCreditIncluded!==false||data.basis.historicalClosingBalance!==false||!cash||!docs)fail();
      if(!integer(cash.paymentCount)||!integer(cash.invalidAmountCount)||cash.invalidAmountCount>cash.paymentCount||!amount(cash.amountCents)||(cash.invalidAmountCount>0&&cash.amountCents!==null))fail();
      if(!['total','receivableCount','excludedCount','unknownStatusCount','invalidAmountCount'].every(key=>integer(docs[key]))||docs.receivableCount+docs.excludedCount+docs.unknownStatusCount!==docs.total||docs.invalidAmountCount>docs.receivableCount||!amount(docs.amountCents)||!amount(docs.openAmountCents)||((docs.unknownStatusCount||docs.invalidAmountCount)&&(docs.amountCents!==null||docs.openAmountCents!==null)))fail();
      if((cash.paymentCount===0&&cash.amountCents!==0)||(docs.total===0&&(docs.amountCents!==0||docs.openAmountCents!==0)))fail();
    }else if(section==='reports'){
      if(data.basis!=='MONTHLY_REPORT_MONTH'||!['total','adminCount','clientCount','otherCount'].every(key=>integer(data[key]))||data.total!==data.adminCount+data.clientCount+data.otherCount)fail();
    }else{
      if(data.basis!=='COMMUNICATION_LOG_CREATED_AT_UTC'||data.deliveryConfirmed!==false||!integer(data.total)||data.latestLimit!==5||!Array.isArray(data.latest)||data.latest.length!==Math.min(data.total,5)||new Set(data.latest.map(row=>row?.id)).size!==data.latest.length)fail();
      let previous=null;
      for(const row of data.latest){
        const at=Date.parse(row?.createdAt);
        if(!row||!integer(row.id)||row.id===0||typeof row.channel!=='string'||typeof row.createdAt!=='string'||!Number.isFinite(at)||at<start.getTime()||at>=end.getTime()||(previous&&(at>previous.at||(at===previous.at&&row.id>=previous.id))))fail();
        previous={at,id:row.id};
      }
    }
    return data;
  }
  function metric(list,label,value,key){text(list,'dt',label);const node=text(list,'dd',value);node.dataset.metric=key;}
  function render(section,body){
    const panel=panels[section],data=body.data,content=panel.content;content.replaceChildren();
    const list=document.createElement('dl');list.className='report-metrics';content.append(list);
    let review=false;
    if(section==='financial'){
      metric(list,'Recebido no mês',money(data.cash.amountCents),'cash');metric(list,'Recebimentos',String(data.cash.paymentCount),'payments');
      metric(list,'Valor atual dos documentos do mês',money(data.documents.amountCents),'documentsAmount');metric(list,'Saldo atual desses documentos',money(data.documents.openAmountCents),'documentsOpen');
      metric(list,'Documentos considerados',String(data.documents.receivableCount),'documents');
      text(content,'p','Recebimentos pela data do pagamento; aplicações e ajustes de crédito interno excluídos.');
      text(content,'p','Documentos pela referência mensal guardada. O saldo reflete o estado atual, não o fecho histórico do mês.');
      text(content,'p',data.documents.excludedCount+' rascunhos, documentos retirados ou registos de depósito excluídos dos valores documentais.');
      review=[data.cash.amountCents,data.documents.amountCents,data.documents.openAmountCents].some(value=>value===null);
      if(review)text(content,'p','Há valores por rever: '+data.cash.invalidAmountCount+' recebimentos com montante inválido, '+data.documents.invalidAmountCount+' documentos com montantes inválidos/contraditórios e '+data.documents.unknownStatusCount+' com estado desconhecido. Um total que exceda a precisão permitida também fica por rever.').className='report-warning';
    }else if(section==='reports'){
      metric(list,'Administrativos guardados',String(data.adminCount),'adminReports');metric(list,'De clientes guardados',String(data.clientCount),'clientReports');metric(list,'Outros tipos',String(data.otherCount),'otherReports');
      text(content,'p','Contagem dos registos guardados com esta referência mensal. Não representa o envio ou a entrega de relatórios.');
      review=data.otherCount>0;
      if(review)text(content,'p','Existem tipos de relatório por rever.').className='report-warning';
    }else{
      metric(list,'Registos de comunicação no mês',String(data.total),'communications');
      text(content,'p','Registos criados neste mês. Não confirmam entrega ao destinatário.');
      if(data.latest.length){
        text(content,'h3','Últimos '+data.latest.length+' de '+data.total+' registos');const items=document.createElement('ul');
        for(const row of data.latest)text(items,'li',(row.channel.trim()||'Canal não indicado')+' · '+date(row.createdAt));
        content.append(items);
      }else text(content,'p','Sem registos de comunicação neste mês.');
    }
    text(content,'p','Período '+body.monthRef+' (UTC) · consultado em '+date(body.generatedAt)).className='report-source';
    panel.state=review?'review':'ready';panel.root.dataset.state=panel.state;
    panel.status.textContent=review?'Consulta concluída; existem valores ou tipos por rever.':'Consulta confirmada para '+body.monthRef+'.';
    panel.snapshot=body;panel.retry.hidden=true;
  }
  function aggregate(){
    const selected=wanted().map(key=>panels[key]);
    if(selected.some(panel=>panel.state==='loading'))state('loading','A confirmar as fontes do relatório…');
    else if(selected.some(panel=>panel.state==='error')){
      const available=selected.filter(panel=>['ready','review'].includes(panel.state)).length;
      state(available?'partial':'error',available?'Consulta parcial. As secções indisponíveis têm opção de tentar novamente.':'Não foi possível confirmar os dados. Tente novamente.');
    }else if(selected.some(panel=>panel.state==='review'))state('review','Consulta concluída para '+monthInput.value+' (UTC), com dados por rever.');
    else state('ready','Relatórios confirmados para '+monthInput.value+' (UTC).');
    controls();
  }
  async function load(list=wanted()){
    if(!active())return;
    const month=monthInput.value;
    if(!monthInput.checkValidity()||!/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)){changed();state('error','Escolha um mês entre janeiro de 2000 e dezembro de 2199.');return;}
    stop();const current=generation,view=mode.value;observedMonth=month;observedMode=view;
    for(const section of list){
      const panel=panels[section];panel.state='loading';panel.snapshot=null;panel.content.replaceChildren();panel.retry.hidden=true;panel.root.dataset.state='loading';panel.status.textContent='A consultar '+month+'…';
    }
    aggregate();
    await Promise.all(list.map(async section=>{
      const controller=new AbortController();requests.add(controller);let timedOut=false;
      const timer=setTimeout(()=>{timedOut=true;controller.abort();},20000);
      const currentQuery=()=>{
        if(!active()||generation!==current)return false;
        if(monthInput.value!==month||mode.value!==view){changed();return false;}
        return true;
      };
      try{
        const response=await fetch('/api/admin/reports/summary?'+new URLSearchParams({monthRef:month,section}),{headers:{Authorization:'Bearer '+credential},cache:'no-store',signal:controller.signal});
        if(response.status!==200)throw Error(response.status===403?'A conta não tem acesso a esta secção.':'Não foi possível confirmar esta secção. Tente novamente.');
        const body=await response.json();if(!currentQuery())return;validate(body,section,month);render(section,body);
      }catch(error){
        if(currentQuery()){
          const panel=panels[section];panel.state='error';panel.root.dataset.state='error';panel.snapshot=null;panel.content.replaceChildren();panel.retry.hidden=false;
          panel.status.textContent=timedOut?'A consulta demorou demasiado. Tente novamente.':error instanceof SyntaxError?'A resposta é inválida. Tente novamente.':error instanceof TypeError?'Sem ligação à fonte. Tente novamente.':error.message||'Consulta não confirmada.';
        }
      }finally{clearTimeout(timer);requests.delete(controller);if(currentQuery())aggregate();}
    }));
  }
  monthInput.value=new Date().toISOString().slice(0,7);
  observedMonth=monthInput.value;observedMode=mode.value;
  monthInput.addEventListener('input',changed);monthInput.addEventListener('change',changed);
  mode.addEventListener('change',()=>{changed();void load();});refresh.addEventListener('click',()=>void load());
  for(const [key,panel] of Object.entries(panels))panel.retry.addEventListener('click',()=>void load([key]));
  window.addEventListener('storage',active);window.addEventListener('focus',active);
  // Browsers can restore a form value during reload without an input event.
  // Start after pageshow and invalidate any later silent period/mode change.
  window.addEventListener('pageshow',event=>{if(event.persisted)changed();else setTimeout(()=>{changed();void load();},0);});
  window.addEventListener('pagehide',changed);document.addEventListener('visibilitychange',active);
  setInterval(()=>{if(active()&&(observedMonth!==monthInput.value||observedMode!==mode.value))changed();},500);
})();
