(function () {
'use strict';
const $ = id => document.getElementById(id);
const keys = ['cristalwater_jwt', 'token', 'adminToken', 'cristalwater_user', 'user'];
const fingerprint = () => JSON.stringify(keys.map(key => localStorage.getItem(key)));
const positive = n => Number.isSafeInteger(n) && n > 0 && n <= 2147483647;
const count = n => Number.isSafeInteger(n) && n >= 0;
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const coordinates = item => typeof item.latitude === 'number' && typeof item.longitude === 'number' && Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180;
const basisLabel = value => ({ RECORDED_MOVEMENT:'registada no movimento', INFERRED_GUIDE:'deduzida da guia', CURRENT_TECHNICIAN:'atribuição atual do técnico', INFERRED_TECHNICIAN_TIME:'deduzida do técnico/horário', AMBIGUOUS_MOVEMENTS:'movimentos divergentes; por rever', UNCONFIRMED:'por confirmar' }[value] || 'por confirmar');
const formatDateTime = value => value ? new Date(value).toLocaleString('pt-PT', { timeZone:'UTC', dateStyle:'short', timeStyle:'short' }) + ' UTC' : '-';
const formatTime = value => value ? new Date(value).toLocaleTimeString('pt-PT', { timeZone:'UTC', hour:'2-digit', minute:'2-digit' }) + ' UTC' : '-';
const state = { log:null };
let timelineLimit=250;
let identity, credential, expires=0, invalid=false, sequence=0, operation=null, observed='';
try {
  credential=keys.slice(0,3).map(key=>localStorage.getItem(key)).find(Boolean);
  const claims=JSON.parse(atob(credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))), users=keys.slice(3).map(key=>localStorage.getItem(key)).filter(Boolean).map(JSON.parse);
  if(claims.role!=='ADMIN'||!positive(Number(claims.userId||claims.id))||!Number.isFinite(claims.exp)||!users.length||users.some(user=>user.role!=='ADMIN'||Number(user.userId||user.id)!==Number(claims.userId||claims.id))||keys.slice(0,3).some(key=>localStorage.getItem(key)&&localStorage.getItem(key)!==credential))throw Error();
  identity=fingerprint();expires=claims.exp*1000;
}catch(_){invalid=true;}
function selection(){return {date:$('dateFilter').value,technicianId:$('technicianFilter').value,vehicleId:$('vehicleFilter').value};}
function snapshot(){return JSON.stringify(selection());}
function mark(kind,text){$('logStatus').dataset.state=kind;$('logStatus').textContent=text;}
function clear(text='Atualize para consultar a seleção atual.') {
  state.log=null;timelineLimit=250;$('metrics').replaceChildren();$('dayLabel').textContent='Por confirmar';$('timelineCount').textContent='Por confirmar';$('moreTimeline').hidden=true;
  for(const id of ['services','timeline','mapBox']){const node=document.createElement('p');node.className='empty';node.textContent=text;$(id).replaceChildren(node);$(id).setAttribute('aria-busy','false');}
}
function stop(){sequence++;if(operation){operation.controller.abort();clearTimeout(operation.timeout);operation=null;}}
function active(){
  if(invalid&&$('logStatus').dataset.state==='session')return false;
  let same=false;try{same=!invalid&&!!credential&&identity===fingerprint()&&expires>Date.now();}catch(_){}
  if(same)return true;
  invalid=true;stop();clear('Sessão alterada. Reabra a página com a conta pretendida.');
  for(const id of ['dateFilter','technicianFilter','vehicleFilter','refreshBtn'])$(id).disabled=true;
  for(const id of ['technicianFilter','vehicleFilter'])$(id).replaceChildren();
  mark('session','A sessão mudou ou terminou. Reabra a página com a conta pretendida.');return false;
}
function validate(body, chosen){
  const fail=()=>{throw Error('UNCONFIRMED');},start=Date.parse(chosen.date+'T00:00:00.000Z'),end=start+86400000;
  if(body?.ok!==true||body.version!==2||body.day!==chosen.date||body.visitType!=='REGULAR'||body.filters?.technicianId!==(chosen.technicianId?Number(chosen.technicianId):null)||body.filters?.vehicleId!==(chosen.vehicleId?Number(chosen.vehicleId):null)||body.period?.timeZone!=='UTC'||body.period.start!==new Date(start).toISOString()||body.period.end!==new Date(end).toISOString()||!Array.isArray(body.services)||!Array.isArray(body.timeline)||!Array.isArray(body.limits)||body.complete!==(body.limits.length===0)||body.basis?.selection!=='ANY_RECORDED_VISIT_DATE_IN_DAY'||body.basis.pool!=='CURRENT_DETAILS'||body.basis.gps!==(chosen.vehicleId?'OMITTED_NO_RECORDED_VEHICLE':'SELECTED_TECHNICIANS_WITH_CURRENT_EMAIL_ASSOCIATION'))fail();
  const caps={serviceVisit:500,workGuide:200,vehicleStockMovement:1000,visitStateLog:1000,technicianTrack:3000,technician:500,user:500,locationLog:3000,vehicle:500};
  if(body.services.length>500||body.limits.some(row=>!row||caps[row.source]!==row.limit)||new Set(body.limits.map(row=>row.source)).size!==body.limits.length)fail();
  const ids=new Set();
  const named=value=>value===null||value&&positive(value.id)&&typeof value.name==='string';
  for(const row of body.services){
    if(!row||!positive(row.id)||ids.has(row.id)||row.day!==chosen.date||typeof row.status!=='string'||!named(row.client)||!named(row.technician)||row.pool!==null&&(!positive(row.pool?.id)||typeof row.pool.name!=='string')||row.vehicle!==null&&!positive(row.vehicle?.id)||!count(row.stockReviewCount)||!Array.isArray(row.stockMovements)||!Array.isArray(row.chemicals)||!Array.isArray(row.stateLogs)||typeof row.poolClientChanged!=='boolean'||!['RECORDED_MOVEMENT','INFERRED_GUIDE','CURRENT_TECHNICIAN','AMBIGUOUS_MOVEMENTS','UNCONFIRMED'].includes(row.vehicleBasis)||!['RECORDED_MOVEMENT','INFERRED_TECHNICIAN_TIME','AMBIGUOUS_MOVEMENTS','UNCONFIRMED'].includes(row.workGuideBasis))fail();
    if(chosen.technicianId&&row.technician?.id!==Number(chosen.technicianId)||chosen.vehicleId&&row.vehicle?.id!==Number(chosen.vehicleId))fail();
    if(['plannedAt','startAt','endAt'].some(key=>row[key]!=null&&!Number.isFinite(Date.parse(row[key]))))fail();ids.add(row.id);
  }
  let previous=-Infinity;
  for(const item of body.timeline){const at=Date.parse(item?.at);if(!Number.isFinite(at)||at<start||at>=end||at<previous||typeof item.type!=='string'||typeof item.title!=='string'||typeof item.message!=='string'||item.visitId!=null&&!ids.has(item.visitId)||chosen.vehicleId&&item.type==='GPS')fail();previous=at;}
  const summary=body.summary;if(!summary||Object.values(summary).some(value=>!count(value))||summary.services!==body.services.length||summary.done!==body.services.filter(row=>['DONE','COMPLETED'].includes(row.status)).length||summary.technicians!==new Set(body.services.map(row=>row.technician?.id).filter(Boolean)).size||summary.vehicles!==new Set(body.services.map(row=>row.vehicle?.id).filter(Boolean)).size||summary.gpsPoints!==body.timeline.filter(row=>row.type==='GPS').length)fail();
  return body;
}
function filterRows(body,key){const rows=Array.isArray(body)?body:body?.[key];if(body?.ok===false||!Array.isArray(rows)||rows.some(row=>!row||!positive(row.id))||new Set(rows.map(row=>row.id)).size!==rows.length)throw Error('UNCONFIRMED');return rows;}
function options(id,rows,chosen,label){const select=$(id),first=document.createElement('option');first.value='';first.textContent=label;select.replaceChildren(first);for(const row of rows){const node=document.createElement('option');node.value=String(row.id);node.textContent=row.name||row.plate||'#'+row.id;select.append(node);}if(chosen&&!rows.some(row=>String(row.id)===chosen)){const old=document.createElement('option');old.value=chosen;old.textContent='#'+chosen+' (fora da lista atual)';select.append(old);}select.value=chosen;}
function renderMetrics(summary = {}) {
  const items = [
    ["Serviços", summary.services],
    ["Concluídos", summary.done],
    ["Técnicos", summary.technicians],
    ["Viaturas", summary.vehicles],
    ["Pontos GPS", summary.gpsPoints],
  ];
  $("metrics").innerHTML = items.map(([label, value]) => `
    <div class="metric">
      <span class="muted">${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join("");
}

function statusClass(service) {
  return ["DONE", "COMPLETED"].includes(service.status) ? "done" : "";
}

function renderServices(services = []) {
  if (!services.length) {
    $("services").innerHTML = '<div class="empty">Sem serviços registados para estes filtros.</div>';
    return;
  }

  $("services").innerHTML = services.map((service) => {
    const movements = service.stockMovements || [];
    const chemicals = service.chemicals || [];
    return `
      <article class="service" data-visit-id="${service.id}">
        <div class="service-head">
          <div>
            <div class="service-title">${esc(service.pool?.name || "Piscina")}</div>
            <div class="muted">${esc(service.client?.name || "Cliente original por confirmar")} · ${esc(service.pool?.zone || service.pool?.address || "")}</div>
          </div>
          <span class="pill ${statusClass(service)}">${esc(service.status)}</span>
        </div>
        ${service.stockReviewCount ? '<p class="review-note">Há movimentos com origem regular/extra ambígua; não estão incluídos no material apresentado.</p>' : ""}
        ${service.poolClientChanged ? '<p class="review-note">A instalação tem atualmente outro titular. O cliente acima é o da visita.</p>' : ""}
        <p class="muted">Viatura: ${esc(basisLabel(service.vehicleBasis))}. Guia: ${esc(basisLabel(service.workGuideBasis))}.</p>
        <div class="service-meta">
          <span><strong>Planeada:</strong> ${esc(formatDateTime(service.plannedAt))}</span>
          <span><strong>Início:</strong> ${esc(formatTime(service.startAt))}</span>
          <span><strong>Fim:</strong> ${esc(formatTime(service.endAt))}</span>
          <span><strong>Técnico:</strong> ${esc(service.technician?.name || service.technicianName || "-")}</span>
          <span><strong>Viatura:</strong> ${esc(service.vehicle?.plate || service.vehicle?.name || "-")}</span>
          <span><strong>Guia:</strong> ${esc(service.workGuide?.codeAT || service.workGuide?.id || "-")}</span>
        </div>
        ${movements.length ? `
          <div class="muted" style="margin-top:10px"><strong>Material:</strong> ${movements.map((item) => `${esc(item.itemName)} ${esc(item.quantity)} ${esc(item.unit || "")}`).join(" · ")}</div>
        ` : ""}
        ${chemicals.length ? `
          <div class="muted" style="margin-top:10px"><strong>Químicos:</strong> ${chemicals.map((item) => `${esc(item.name)} ${esc(item.quantity)} ${esc(item.unit || "")}`).join(" · ")}</div>
        ` : ""}
      </article>
    `;
  }).join("");
}

function timelineClass(item) {
  if (item.type === "GPS") return "gps";
  if (String(item.type || "").includes("STOCK")) return "stock";
  if (String(item.type || "").includes("DONE")) return "done";
  return "";
}

function renderTimeline(timeline = []) {
  const limited = timeline.slice(-timelineLimit).reverse();
  $('timelineCount').textContent=limited.length+' de '+timeline.length+' eventos apresentados';$('moreTimeline').hidden=limited.length===timeline.length;
  if (!limited.length) {
    $("timeline").innerHTML = '<div class="empty">Sem eventos na timeline para estes filtros.</div>';
    return;
  }

  $("timeline").innerHTML = limited.map((item) => {
    const mapLink = coordinates(item)
      ? `<a class="pill" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.latitude},${item.longitude}`)}">Mapa</a>`
      : "";
    return `
      <div class="timeline-item ${timelineClass(item)}">
        <div class="timeline-time">${esc(formatDateTime(item.at))} · ${esc(item.type || "EVENTO")}</div>
        <div class="line">
          <strong>${esc(item.title || "Evento")}</strong>
          ${mapLink}
        </div>
        <div class="muted">${esc(item.message || "")}</div>
      </div>
    `;
  }).join("");
}

function renderMap(timeline = []) {
  const points = timeline.filter((item) => item.type === "GPS" && coordinates(item));
  const latest = points[points.length - 1];
  if (!latest) {
    $("mapBox").innerHTML = '<div class="empty" style="margin:18px">' + (state.log?.filters.vehicleId ? 'O GPS não tem uma viatura histórica confirmada e não é apresentado neste filtro.' : 'Sem coordenadas válidas nos registos apresentados.') + '</div>';
    return;
  }
  const lat = Number(latest.latitude);
  const lng = Number(latest.longitude);
  const delta = 0.035;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
  $("mapBox").innerHTML = `
    <p class="muted map-caption">Último ponto registado: ${esc(lat)}, ${esc(lng)}. O mapa externo requer ligação.</p><iframe loading="lazy" title="Última posição GPS registada" src="https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}"></iframe>
  `;
}

function renderLog(data) {
  state.log = data;timelineLimit=250;
  $("dayLabel").textContent = data.day || $("dateFilter").value;
  renderMetrics(data.summary);
  renderServices(data.services);
  renderTimeline(data.timeline);
  renderMap(data.timeline);
}


async function loadLog(){
  if(!active())return;stop();const chosen=selection(),stamp=++sequence;
  observed=snapshot();clear('A carregar os dados da seleção…');mark('loading','A confirmar os registos e filtros…');$('refreshBtn').disabled=true;
  const date=new Date(chosen.date+'T00:00:00.000Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(chosen.date)||!Number.isFinite(+date)||date.toISOString().slice(0,10)!==chosen.date||[chosen.technicianId,chosen.vehicleId].some(value=>value&&(!/^[1-9]\d{0,9}$/.test(value)||!positive(Number(value))))){mark('error','Selecione um dia e filtros válidos.');clear('A seleção precisa de revisão.');$('refreshBtn').disabled=false;return;}
  const op={controller:new AbortController(),timedOut:false};operation=op;op.timeout=setTimeout(()=>{op.timedOut=true;op.controller.abort();},15000);
  for(const id of ['services','timeline','mapBox'])$(id).setAttribute('aria-busy','true');
  const params=new URLSearchParams({date:chosen.date});if(chosen.technicianId)params.set('technicianId',chosen.technicianId);if(chosen.vehicleId)params.set('vehicleId',chosen.vehicleId);
  async function read(url,report=false){const response=await fetch(url,{headers:{Authorization:'Bearer '+credential},cache:'no-store',redirect:'error',signal:op.controller.signal});if(response.status===401||response.status===403){invalid=true;active();throw Error('SESSION');}if(response.status!==200||(response.headers.get('content-type')||'').split(';')[0]!=='application/json')throw Error('UNCONFIRMED');if(report&&(response.headers.get('X-CW-Report-Type')!=='daily-service-log'||response.headers.get('X-CW-Report-Version')!=='2'||response.headers.get('X-CW-Day')!==chosen.date||response.headers.get('cache-control')!=='private, no-store'))throw Error('UNCONFIRMED');return response.json();}
  try{
    const [technicians,vehicles,data]=await Promise.all([read('/api/technicians'),read('/api/guides/vehicles'),read('/api/core/daily-service-log?'+params,true)]);
    if(!active()||stamp!==sequence||observed!==snapshot())return;
    const body=validate(data,chosen),techRows=filterRows(technicians,'technicians'),vehicleRows=filterRows(vehicles,'vehicles');
    options('technicianFilter',techRows,chosen.technicianId,'Todos os técnicos');options('vehicleFilter',vehicleRows,chosen.vehicleId,'Todas as viaturas');renderLog(body);
    mark(!body.complete?'partial':body.services.length||body.timeline.length?'ready':'empty',!body.complete?'Dados parciais: foi atingido o limite de consulta. Restrinja os filtros antes de usar os totais.':body.services.length||body.timeline.length?'Registos confirmados para o dia e filtros apresentados. Totais apenas das visitas regulares apresentadas.':'Sem visitas regulares nem eventos nos dados confirmados desta seleção.');
  }catch(error){if(active()&&stamp===sequence){clear('Não foi possível confirmar estes dados. Use Atualizar para tentar novamente.');mark('error',op.timedOut?'A consulta demorou demasiado. Use Atualizar para tentar novamente.':'Não foi possível confirmar o registo ou os filtros. Use Atualizar para tentar novamente.');}}
  finally{op.controller.abort();clearTimeout(op.timeout);if(active()&&stamp===sequence){operation=null;$('refreshBtn').disabled=false;for(const id of ['services','timeline','mapBox'])$(id).setAttribute('aria-busy','false');}}
}
function changed(){stop();observed=snapshot();clear();if(active()){mark('idle','A seleção mudou. A aguardar a nova consulta.');$('refreshBtn').disabled=false;}}
window.addEventListener('DOMContentLoaded',()=>{
  $('dateFilter').value=new Date().toISOString().slice(0,10);observed=snapshot();
  for(const id of ['services','timeline','mapBox','metrics','logStatus'])$(id).dataset.cwStateManaged='manual';
  $('refreshBtn').addEventListener('click',loadLog);
  $('moreTimeline').addEventListener('click',()=>{if(active()&&state.log){timelineLimit+=250;renderTimeline(state.log.timeline);}});
  for(const id of ['dateFilter','technicianFilter','vehicleFilter']){$(id).addEventListener('input',changed);$(id).addEventListener('change',()=>{changed();loadLog();});}
  window.addEventListener('storage',active);window.addEventListener('focus',active);window.addEventListener('pagehide',()=>{stop();clear();});
  setInterval(()=>{if(active()&&observed!==snapshot())changed();},500);loadLog();
});
}());
