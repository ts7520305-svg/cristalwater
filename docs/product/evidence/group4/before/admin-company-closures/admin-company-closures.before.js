const API = "/api/company-closures";
let templates = [];

function $(sel){ return document.querySelector(sel); }
function fmtDate(v){ return v ? new Date(v).toLocaleDateString("pt-PT") : "-"; }
function formData(form){
  const data = Object.fromEntries(new FormData(form).entries());
  ["notifyClients","notifyTechnicians","showOnClientPortal","pauseNormalVisits","allowCriticalServices"].forEach(k=>data[k]=form.elements[k]?.checked || false);
  return data;
}

async function api(path="", opts={}){
  const res = await fetch(API + path, { headers:{"Content-Type":"application/json"}, ...opts });
  const json = await res.json().catch(()=>({ok:false,error:"Resposta inválida"}));
  if(!res.ok || json.ok === false) throw new Error(json.error || "Erro API");
  return json;
}

async function loadTemplates(){
  const r = await api("/templates");
  templates = r.templates || [];
}

function applyTemplate(id){
  const t = templates.find(x=>x.id===id); if(!t) return;
  const f = $("#closureForm");
  f.title.value = t.title;
  f.messageTitle.value = t.messageTitle;
  f.messageBody.value = t.messageBody;
  if(id==="NATAL") f.closureType.value="CHRISTMAS";
  if(id==="FERIAS_VERAO") f.closureType.value="SUMMER_BREAK";
  if(id==="FERIADO") f.closureType.value="PUBLIC_HOLIDAY";
}

async function routeImpact(id){
  const r = await api(`/${id}/route-impact`);
  alert(`Impacto nas rondas:\nTotal: ${r.impact.totalVisits}\nNormais: ${r.impact.normalVisits}\nCríticas: ${r.impact.criticalVisits}\n\n${r.impact.recommendation}`);
}
async function activate(id){ await api(`/${id}/activate`,{method:"POST",body:JSON.stringify({})}); await loadClosures(); }
async function notify(id){ const r=await api(`/${id}/generate-notifications`,{method:"POST",body:JSON.stringify({})}); alert(`${r.created} notificações criadas.`); }
async function cancelClosure(id){ const reason=prompt("Motivo para cancelar?")||"Cancelado pelo admin"; await api(`/${id}/cancel`,{method:"POST",body:JSON.stringify({reason})}); await loadClosures(); }

async function loadClosures(){
  const box = $("#closuresList");
  try{
    const r = await api();
    const list = r.closures || [];
    if(!list.length){ box.innerHTML = "Nenhum encerramento criado."; return; }
    box.innerHTML = list.map(c=>`<div class="closure"><div><b>${c.title}</b> <span class="badge">${c.status}</span> <span class="badge">${c.closureType}</span></div><div class="muted">${fmtDate(c.startDate)} → ${fmtDate(c.endDate)}</div><p>${c.messageTitle || "Sem título de mensagem"}</p><div class="actions"><button class="btn2" onclick="routeImpact(${c.id})">Ver impacto rondas</button><button class="btn2" onclick="notify(${c.id})">Gerar avisos</button><button class="btn2" onclick="activate(${c.id})">Ativar</button><button class="btn2" onclick="cancelClosure(${c.id})">Cancelar</button></div></div>`).join("");
  }catch(e){ box.innerHTML = `<span style="color:#ffb4b4">${e.message}</span>`; }
}

$("#closureForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const data = formData(e.currentTarget);
  try{
    await api("", { method:"POST", body: JSON.stringify(data) });
    e.currentTarget.reset();
    await loadClosures();
  }catch(err){ alert(err.message); }
});

document.querySelectorAll("[data-template]").forEach(btn=>btn.addEventListener("click",()=>applyTemplate(btn.dataset.template)));
loadTemplates().then(loadClosures);
window.routeImpact=routeImpact; window.activate=activate; window.notify=notify; window.cancelClosure=cancelClosure;
