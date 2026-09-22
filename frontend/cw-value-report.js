(function () {
  'use strict';
  const period=document.getElementById('reportMonth'), load=document.getElementById('reportLoad'), status=document.getElementById('reportStatus'), list=document.getElementById('reportList'), warnings=document.getElementById('reportWarnings'), filter=document.getElementById('reportActiveOnly');
  const keys=['cristalwater_jwt','token','cristalwater_user','user'], fingerprint=()=>JSON.stringify(keys.map(k=>localStorage.getItem(k)));
  let identity='', credential='', invalid=false, generation=0, request, snapshot=null;
  try { identity=fingerprint();credential=localStorage.getItem('cristalwater_jwt')||localStorage.getItem('token')||''; } catch (_) {}
  const money=value=>value===null?'Por apurar':value.toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
  const quantity=value=>value.toLocaleString('pt-PT',{maximumFractionDigits:6});
  function state(kind,text){status.dataset.state=kind;status.textContent=text;}
  function clear(){snapshot=null;list.replaceChildren();warnings.replaceChildren();}
  function busy(value){list.setAttribute('aria-busy',String(value));load.disabled=value||invalid;}
  function active(){
    let same=false;try{same=!!credential&&identity===fingerprint();}catch(_){}
    if(same&&!invalid)return true;
    invalid=true;generation++;request?.abort();clear();busy(false);period.disabled=true;filter.disabled=true;state('session','A sessão mudou. Reabra a página com a conta pretendida.');return false;
  }
  function changed(){generation++;request?.abort();clear();busy(false);if(active())state('idle','O mês mudou. Atualize para consultar o período selecionado.');}
  function text(parent,tag,value){const node=document.createElement(tag);node.textContent=value;parent.append(node);return node;}
  const integer=value=>Number.isSafeInteger(value)&&value>=0;
  const id=value=>Number.isSafeInteger(value)&&value>0;
  const amount=value=>value===null||(typeof value==='number'&&Number.isFinite(value)&&value>=0);
  function validate(data,month){
    if(data?.ok!==true||data.reportVersion!==1||data.monthRef!==month||data.complete!==true||data.financialComplete!==false||data.limitApplied!==null||!Array.isArray(data.technicians)||data.total!==data.technicians.length||data.returned!==data.total||data.basis?.visits!=='COMPLETED_END_AT_UTC'||data.basis?.stock!=='STOCK_MOVEMENT_CREATED_AT_UTC'||data.basis?.extraLines!=='DOCUMENT_MONTH_REFERENCE_STORED_LINE_VALUE'||data.basis?.labor!=='CURRENT_CONFIGURED_RATE_ESTIMATE')throw Error('A resposta não confirma o período e as fontes. Atualize para tentar novamente.');
    const quality=['undatedCompleted','excludedVisitStates','unallocatedMovements','invalidStockQuantities','excludedStockMovements','excludedDocuments','unallocatedDocumentLines','extraLinesNeedingReview','invalidPayments'];
    if(!quality.every(k=>integer(data.dataQuality?.[k])))throw Error('O diagnóstico dos dados está incompleto.');
    if(new Set(data.technicians.map(row=>row?.id)).size!==data.total)throw Error('A resposta contém técnicos repetidos.');
    const sourceLines=new Set();
    for(const row of data.technicians){
      if(!row||(row.id!==null&&!id(row.id))||row.technicianId!==row.id||typeof row.name!=='string'||![true,false,null].includes(row.active)||!['regularDone','extraDone','visitsDone','undatedCompleted','unknownDurations','stockMovementCount','stockReviewCount','extraLinesReviewCount'].every(k=>integer(row[k]))||row.visitsDone!==row.regularDone+row.extraDone||row.unknownDurations>row.visitsDone||!amount(row.minutes)||row.minutes===null||!amount(row.extraLinesAmount)||!amount(row.confirmedExtraLinesAmount)||row.confirmedExtraLinesAmount===null||!amount(row.laborEstimate)||!['NOT_APPLICABLE','MISSING_RATE','AMBIGUOUS_RATE','CURRENT_RATE_PER_VISIT','CURRENT_HOURLY_RATE'].includes(row.laborEstimateBasis)||row.financialStatus!=='NOT_ESTABLISHED'||!['profitability','profit','cost','revenue','stockCost','laborCost','estimatedRevenue'].every(k=>row[k]===null))throw Error('Existem valores sem confirmação no relatório. Atualize para tentar novamente.');
      if(!amount(row.valuedLaborAmountCents)||!integer(row.valuationCount)||!integer(row.valuationReviewCount))throw Error('Custos de trabalho confirmados incompletos.');
      if(!Array.isArray(row.stock)||!row.stock.every(s=>s&&typeof s.product==='string'&&typeof s.unit==='string'&&s.unit&&[s.consumed,s.returned,s.net].every(Number.isFinite)&&s.consumed>=0&&s.returned>=0&&Math.abs(s.net-(s.consumed-s.returned))<0.000002)||!Array.isArray(row.extraLineEvidence)||!row.extraLineEvidence.every(e=>e&&id(e.invoiceId)&&id(e.lineId)&&id(e.extraVisitId)&&amount(e.amount)&&e.amount!==null))throw Error('As fontes de stock ou de documentos estão incompletas.');
      if((row.extraLinesReviewCount>0&&row.extraLinesAmount!==null)||(row.extraLinesReviewCount===0&&row.extraLinesAmount!==row.confirmedExtraLinesAmount))throw Error('Existem valores documentais contraditórios.');
      let evidenceCents=0;
      for(const line of row.extraLineEvidence){if(sourceLines.has(line.lineId))throw Error('Uma linha documental está atribuída mais de uma vez.');sourceLines.add(line.lineId);evidenceCents+=Math.round(line.amount*100);}
      if(!Number.isSafeInteger(evidenceCents)||evidenceCents!==Math.round(row.confirmedExtraLinesAmount*100))throw Error('O valor das linhas não coincide com as fontes.');
    }
  }
  function render(){
    if(!active()||!snapshot)return;
    list.replaceChildren();warnings.replaceChildren();
    const visible=snapshot.technicians.filter(row=>!filter.checked||row.visitsDone||row.undatedCompleted||row.stockMovementCount||row.extraLineEvidence.length||row.extraLinesReviewCount||row.valuationCount);
    for(const row of visible){
      const card=document.createElement('article');card.dataset.technicianId=row.id??'unassigned';
      text(card,'h2',row.name+(row.id?' · #'+row.id:'')+(row.active===false?' (inativo)':''));
      text(card,'p',row.regularDone+' visitas regulares e '+row.extraDone+' extras concluídas.');
      text(card,'p',quantity(row.minutes)+' minutos com horário confirmado · '+row.unknownDurations+' visitas sem duração válida.');
      if(row.undatedCompleted)text(card,'p',row.undatedCompleted+' conclusões sem data confirmada, previstas neste mês. Não incluídas no total acima.');
      text(card,'p','Linhas de extras identificadas: '+money(row.extraLinesAmount)+'.');
      if(row.extraLinesReviewCount)text(card,'p',row.extraLinesReviewCount+' linhas exigem revisão de origem/ajustes. Parcela identificada: '+money(row.confirmedExtraLinesAmount)+'.');
      const rates={CURRENT_RATE_PER_VISIT:'tarifa atual por visita',CURRENT_HOURLY_RATE:'tarifa horária atual',AMBIGUOUS_RATE:'existem duas tarifas; falta confirmar qual aplicar',MISSING_RATE:'sem tarifa positiva configurada',NOT_APPLICABLE:'sem técnico confirmado'};
      text(card,'p','Mão de obra estimada: '+money(row.laborEstimate)+' ('+rates[row.laborEstimateBasis]+').');
      text(card,'p','Tempo valorizado com despesa confirmada: '+money(row.valuedLaborAmountCents===null?null:row.valuedLaborAmountCents/100)+' · '+row.valuationCount+' registos · '+row.valuationReviewCount+' por rever. Cobertura parcial; já incluído nas despesas atribuídas.');
      text(card,'p','Custos completos e margem total: por apurar.');
      if(row.stock.length){
        text(card,'h3','Movimentos de produtos');const stock=document.createElement('ul');
        for(const item of row.stock)text(stock,'li',item.product+' · '+item.unit+': consumo '+quantity(item.consumed)+'; devolução '+quantity(item.returned)+'; diferença '+quantity(item.net)+'.');
        card.append(stock);
      }else text(card,'p','Sem quantidades de consumo/devolução identificadas neste período.');
      if(row.stockReviewCount)text(card,'p',row.stockReviewCount+' movimentos de produtos precisam de revisão.');
      if(row.extraLineEvidence.length){const details=document.createElement('details');text(details,'summary','Ver linhas de origem ('+row.extraLineEvidence.length+')');const sources=document.createElement('ul');for(const source of row.extraLineEvidence)text(sources,'li','Documento #'+source.invoiceId+' · linha #'+source.lineId+' · extra #'+source.extraVisitId+' · '+money(source.amount));details.append(sources);card.append(details);}
      list.append(card);
    }
    const q=snapshot.dataQuality;
    text(warnings,'p',q.unallocatedDocumentLines+' linhas documentais sem repartição por técnico; '+q.extraLinesNeedingReview+' linhas extra por rever; '+q.excludedDocuments+' rascunhos/documentos retirados excluídos.');
    if(q.undatedCompleted||q.unallocatedMovements||q.invalidStockQuantities)text(warnings,'p',q.undatedCompleted+' conclusões sem data; '+q.unallocatedMovements+' movimentos sem responsável confirmado; '+q.invalidStockQuantities+' movimentos sem quantidades/origem utilizáveis.');
    state(visible.length?'ready':'empty',visible.length?visible.length+' registos apresentados · período '+snapshot.monthRef+' (UTC).':'Sem registos para este filtro no período '+snapshot.monthRef+'.');
  }
  async function query(){
    if(!active())return;
    const current=++generation, month=period.value;request?.abort();request=new AbortController();const controller=request;
    clear();busy(true);state('loading','A confirmar as fontes do relatório…');let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},20000);
    const currentQuery=()=>active()&&current===generation;
    try{
      if(!period.checkValidity()||!/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Escolha um mês válido.');
      const response=await fetch('/api/billing/technician-profit?'+new URLSearchParams({monthRef:month}),{headers:{Authorization:'Bearer '+credential},cache:'no-store',signal:controller.signal});
      if(response.status!==200)throw Error('Não foi possível confirmar o relatório. Use Atualizar para tentar novamente.');
      const data=await response.json();if(!currentQuery())return;validate(data,month);snapshot=data;render();
    }catch(error){if(currentQuery()){clear();state('error',timedOut?'A consulta demorou demasiado. Use Atualizar para tentar novamente.':error instanceof SyntaxError?'Resposta inválida. Atualize para tentar novamente.':error.message||'Consulta não confirmada.');}}
    finally{clearTimeout(timer);if(currentQuery())busy(false);}
  }
  period.value=new Date().toISOString().slice(0,7);period.addEventListener('input',changed);load.addEventListener('click',query);filter.addEventListener('change',render);
  window.addEventListener('storage',active);window.addEventListener('focus',active);window.addEventListener('pageshow',active);setInterval(active,500);void query();
})();
