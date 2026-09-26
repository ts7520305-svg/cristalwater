const API = "/api/guides";
const RISK_API = "/api/operational-risk";

let VEHICLES = [];
let RISK_AVAILABLE=false, legacyLoad=0, vehicleChoiceRead=0, riskRead=0;
const LEGACY_TOKEN=localStorage.getItem('token')||localStorage.getItem('cristalwater_jwt')||localStorage.getItem('adminToken');
function requirePageSession(){if(!window.CWFleetPageSession?.isCurrent())throw Error('A sessão mudou ou expirou. Reabra a página com a conta correta.');}
function clearLegacy(){legacyLoad++;vehicleChoiceRead++;riskRead++;VEHICLES=[];RISK_AVAILABLE=false;for(const id of ['riskRules','riskSummary'])el(id)?.replaceChildren();for(const input of document.querySelectorAll('main input,main select,main textarea,main button'))if(!input.closest('#fleetManager,.fh')){if('value' in input)input.value='';input.disabled=true;}}
window.addEventListener('cw:fleet-session-ended',clearLegacy);window.addEventListener('pagehide',clearLegacy);
window.addEventListener('pageshow',()=>{if(window.CWFleetPageSession?.isCurrent()){for(const input of document.querySelectorAll('main input,main select,main textarea,main button'))if(!input.closest('#fleetManager,.fh'))input.disabled=false;load();}});
window.addEventListener('cw:fleet-updated',()=>refreshVehicleChoices().catch(()=>{if(window.CWFleetPageSession?.isCurrent()){VEHICLES=[];renderVehicleChoices();}}));
let RISK_SUMMARY = { issues: [], byVehicleId: {}, byTechnicianId: {}, byClientId: {}, counts: {} };
let RISK_RULES = {};

const RISK_RULE_LABELS = [
  ["overduePayments", "Pagamentos em atraso"],
  ["missingTransportGuide", "Guia AT em falta"],
  ["missingTransportGuideDocument", "Ficheiro oficial AT em falta"],
  ["missingWorkGuide", "Guia de obra em falta"],
  ["vehicleInsuranceExpiring", "Seguro em falta/a acabar"],
  ["vehicleInspectionExpiring", "Inspecao em falta/a acabar"],
  ["lowVehicleStock", "Material baixo/em falta"],
  ["pendingOperationalLocks", "Pendencias operacionais"],
  ["technicianLinkedVehicleIssues", "Marcar tecnico associado"],
];

const RISK_NUMBER_LABELS = [
  ["insuranceWarningDays", "Aviso seguro dias"],
  ["inspectionWarningDays", "Aviso inspecao dias"],
  ["stockLowThreshold", "Limite stock baixo"],
];

function el(id) {
  return document.getElementById(id);
}

function val(id) {
  return el(id)?.value ?? "";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function authHeaders(extra = {}) {
  requirePageSession();
  const token = LEGACY_TOKEN;
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function j(url, opt = {}) {
  const headers = authHeaders({ "Content-Type": "application/json", ...(opt.headers || {}) });
  const response = await fetch(url, {
    headers,
    ...opt,
  });
  const data = await response.json().catch(() => ({}));
  requirePageSession();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || data.message || "Erro");
  }
  return data;
}

async function riskRequest(path, opt = {}) {
  const headers = authHeaders({ "Content-Type": "application/json", ...(opt.headers || {}) });
  const response = await fetch(`${RISK_API}${path}`, {
    headers,
    ...opt,
  });
  const data = await response.json().catch(() => ({}));
  requirePageSession();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || data.message || "Erro ao carregar riscos");
  }
  return data;
}

function uniqueIssues(items = []) {
  const byId = new Map();
  items.filter(Boolean).forEach((item) => {
    byId.set(item.id || `${item.type}-${item.targetType}-${item.targetId}`, item);
  });
  return Array.from(byId.values());
}

function vehicleIssues(vehicleId) {
  return uniqueIssues(RISK_SUMMARY.byVehicleId?.[String(vehicleId)] || [])
    .filter((issue) => issue.targetType !== "Technician");
}

function technicianIssues(technicianId) {
  return uniqueIssues(RISK_SUMMARY.byTechnicianId?.[String(technicianId)] || []);
}

function targetIssues(targetType, targetId) {
  return uniqueIssues((RISK_SUMMARY.issues || []).filter((issue) => (
    issue.targetType === targetType && Number(issue.targetId) === Number(targetId)
  )));
}

function groupIssues(issues, key) {
  return issues.reduce((acc, issue) => {
    const value = issue[key];
    if (value !== undefined && value !== null) {
      const mapKey = String(value);
      if (!acc[mapKey]) acc[mapKey] = [];
      acc[mapKey].push(issue);
    }
    return acc;
  }, {});
}

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function issueText(issue) {
  return `${issue?.title || "Atencao"}: ${issue?.message || ""}`.trim();
}

function cleanRiskAnchor(value) {
  return String(value || "").split(":")[0].trim();
}

function riskHref(issue) {
  const targetType = String(issue?.targetType || "");
  if (["Vehicle", "TransportGuide", "WorkGuide", "Technician"].includes(targetType) || issue?.vehicleId) return "/admin-vehicles";
  if (targetType === "Client") return "/admin-clients";
  return issue?.href || "/admin-vehicles";
}

function riskAnchor(issue) {
  return issue?.anchorText || cleanRiskAnchor(issue?.message) || issue?.title || "";
}

function inferredRiskType(issue) {
  const current = String(issue?.type || "");
  if (current && current !== "TECHNICIAN_LINKED_VEHICLE_RISK") return current;
  const text = normalizeText(`${issue?.title || ""} ${issue?.message || ""}`);
  if (text.includes("ficheiro") && text.includes("at")) return "MISSING_TRANSPORT_GUIDE_DOCUMENT";
  if ((text.includes("guia at") || text.includes("transporte at")) && text.includes("falta")) return "MISSING_TRANSPORT_GUIDE";
  if (text.includes("guia de obra")) return "MISSING_WORK_GUIDE";
  if (text.includes("material") || text.includes("stock")) return "VEHICLE_STOCK_LOW";
  return current || "";
}

function riskTargetPayload(issue) {
  return {
    targetType: issue?.targetType || "",
    targetId: issue?.targetId ?? null,
    vehicleId: issue?.vehicleId ?? null,
    technicianId: issue?.technicianId ?? null,
    clientId: issue?.clientId ?? null,
    type: inferredRiskType(issue),
    anchor: riskAnchor(issue),
  };
}

function riskLinkAttrs(issue) {
  return [
    `href="${esc(riskHref(issue))}"`,
    `data-cw-risk-link="1"`,
    `data-risk-target="${esc(JSON.stringify(riskTargetPayload(issue)))}"`,
    `data-anchor="${esc(riskAnchor(issue))}"`,
    `onclick="try{sessionStorage.setItem('cw:risk-target',this.dataset.riskTarget||'');sessionStorage.setItem('cw:risk-anchor',this.dataset.anchor||'');}catch(_){}"`,
  ].join(" ");
}

function riskIssueTypes(issues = []) {
  return uniqueIssues(issues).map((issue) => issue.type).filter(Boolean).join(" ");
}

function renderRiskBadges(issues = [], limit = 4) {
  const all = uniqueIssues(issues);
  const rows = all.slice(0, limit);
  if (!rows.length) return "";
  const extra = all.length - rows.length;
  return `
    <div class="cw-risk-badges">
      ${rows.map((issue) => `
        <a class="cw-risk-badge" ${riskLinkAttrs(issue)} data-severity="${esc(issue.severity || "WARNING")}" data-risk-tip="${esc(issueText(issue))}">
          ${issue.severity === "CRITICAL" ? "Erro" : "Aviso"}: ${esc(issue.title || "Atencao")}
        </a>
      `).join("")}
      ${extra > 0 ? `<a class="cw-risk-badge" ${riskLinkAttrs(all[rows.length])} data-risk-tip="${esc(`${extra} avisos adicionais nesta entidade.`)}">+${extra}</a>` : ""}
    </div>
  `;
}

function riskClass(issues = []) {
  return uniqueIssues(issues).length ? "cw-risk-card" : "";
}

function attrSelector(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function readStoredRiskTarget(raw) {
  try {
    return JSON.parse(raw || "{}") || {};
  } catch (_) {
    return { anchor: raw || "" };
  }
}

function focusStoredRiskTarget() {
  let target = {};
  try {
    const rawTarget = sessionStorage.getItem("cw:risk-target");
    const anchor = sessionStorage.getItem("cw:risk-anchor");
    if (!rawTarget && !anchor) return;
    target = readStoredRiskTarget(rawTarget);
    if (anchor && !target.anchor) target.anchor = anchor;
  } catch (_) {
    return;
  }

  const selectors = [];
  if (target.type === "MISSING_TRANSPORT_GUIDE_DOCUMENT" && target.vehicleId != null) {
    selectors.push(`[data-risk-target-type="TransportGuide"][data-risk-issue-types~="MISSING_TRANSPORT_GUIDE_DOCUMENT"][data-risk-vehicle-id="${attrSelector(target.vehicleId)}"]`);
  }
  if (target.type === "MISSING_TRANSPORT_GUIDE" && target.vehicleId != null) {
    selectors.push(`[data-risk-target-type="WorkGuide"][data-risk-issue-types~="MISSING_TRANSPORT_GUIDE"][data-risk-vehicle-id="${attrSelector(target.vehicleId)}"]`);
  }
  if (/VEHICLE_STOCK/.test(String(target.type || "")) && target.vehicleId != null) {
    selectors.push(`[data-risk-target-type="WorkGuide"][data-risk-vehicle-id="${attrSelector(target.vehicleId)}"]`);
  }
  if (target.targetType && target.targetId != null) {
    selectors.push(`[data-risk-target-type="${attrSelector(target.targetType)}"][data-risk-target-id="${attrSelector(target.targetId)}"]`);
  }
  if (target.targetId != null && ['TransportGuide','WorkGuide'].includes(target.targetType) && !selectors.map(selector=>document.querySelector(selector)).find(Boolean) && window.CWFleetHistory?.focusTarget(target)) return;
  if (target.vehicleId != null) selectors.push(`[data-risk-vehicle-id="${attrSelector(target.vehicleId)}"]`);

  let node = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!node && target.anchor) {
    const needle = normalizeText(target.anchor).slice(0, 24);
    node = Array.from(document.querySelectorAll("[data-risk-target-type],.card"))
      .find((item) => normalizeText(item.innerText || "").includes(needle));
  }
  if (!node) {window.CWFleetHistory?.focusTarget(target);return;}

  node.classList.add("cw-risk-focus");
  node.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => node.classList.remove("cw-risk-focus"), 4500);
  try {
    sessionStorage.removeItem("cw:risk-target");
    sessionStorage.removeItem("cw:risk-anchor");
  } catch (_) {}
}

function renderAssignedTechnicians(vehicle) {
  const technicians = vehicle.assignedTechnicians || [];
  if (!technicians.length) return `<div class="muted">Sem tecnico associado.</div>`;
  return `
    <div class="muted">
      Tecnicos:
      ${technicians.map((tech) => {
        const issues = technicianIssues(tech.id);
        const cls = issues.length ? "cw-risk-tech" : "";
        const tip = issues.map(issueText).join(" | ");
        return `<span class="badge ${cls}" tabindex="0" title="${esc(tip)}">${esc(tech.name || `#${tech.id}`)}</span>`;
      }).join(" ")}
    </div>
  `;
}

function renderRiskPanel() {
  const summary = el("riskSummary");
  const rules = el("riskRules");

  if (summary) {
    const counts = RISK_SUMMARY.counts || {};
    summary.innerHTML = `
      <div class="cw-risk-summary-card"><b>${esc(counts.total || 0)}</b><span>Total de avisos</span></div>
      <div class="cw-risk-summary-card"><b>${esc(counts.critical || 0)}</b><span>Criticos a vermelho</span></div>
      <div class="cw-risk-summary-card"><b>${esc(counts.warning || 0)}</b><span>Avisos ativos</span></div>
    `;
  }

  if (rules) {
    rules.innerHTML = `
      ${RISK_RULE_LABELS.map(([key, label]) => `
        <label class="cw-risk-rule">
          <input type="checkbox" disabled data-risk-key="${esc(key)}" ${RISK_RULES[key] !== false ? "checked" : ""}>
          <span>${esc(label)}</span>
        </label>
      `).join("")}
      ${RISK_NUMBER_LABELS.map(([key, label]) => `
        <label class="cw-risk-rule">
          <span>${esc(label)}</span>
          <input type="number" disabled min="0" data-risk-key="${esc(key)}" value="${esc(RISK_RULES[key] ?? 0)}">
        </label>
      `).join("")}
    `;
  }
}

function riskUnavailable(message){RISK_AVAILABLE=false;RISK_SUMMARY={issues:[],byVehicleId:{},byTechnicianId:{},byClientId:{},counts:{}};RISK_RULES={};el('riskSummary').textContent=message;el('riskRules').replaceChildren();el('saveRiskRulesButton').disabled=false;window.dispatchEvent(new Event('cw:fleet-risk-unavailable'));}
async function loadRiskState(){const turn=++riskRead;RISK_AVAILABLE=false;el('saveRiskRulesButton').disabled=false;try{const summary=await riskRequest('/summary');if(turn!==riskRead)return;if(!Array.isArray(summary.issues)||!summary.rules||!RISK_RULE_LABELS.every(([k])=>typeof summary.rules[k]==='boolean')||!RISK_NUMBER_LABELS.every(([k])=>Number.isFinite(summary.rules[k])&&summary.rules[k]>=0)||!summary.counts||!['total','critical','warning'].every(k=>Number.isSafeInteger(summary.counts[k])&&summary.counts[k]>=0))throw Error('Incomplete risk summary');RISK_SUMMARY=summary;RISK_RULES=summary.rules;RISK_AVAILABLE=true;renderRiskPanel();el('saveRiskRulesButton').disabled=false;window.dispatchEvent(new CustomEvent('cw:fleet-risk-ready',{detail:summary}));}catch(error){if(turn===riskRead&&window.CWFleetPageSession?.isCurrent())riskUnavailable('Não foi possível confirmar os alertas. Atualize para voltar a tentar.');}}
function saveRiskRules(){requirePageSession();location.href='/operational-risk-rules?lang='+(document.getElementById('fleetLanguage')?.value||'pt');}
function renderVehicleChoices(){for(const id of ['guideVehicle','workVehicle','maintVehicle']){const select=el(id);if(!select)continue;const selected=select.value;select.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='Escolher viatura…';select.append(blank);for(const vehicle of VEHICLES.filter(v=>v.active!==false&&!v.deletedAt)){const option=document.createElement('option');option.value=String(vehicle.id);option.textContent=vehicle.plate+' — '+(vehicle.name||'');select.append(option);}if(selected&&!Array.from(select.options).some(o=>o.value===selected)){const unavailable=document.createElement('option');unavailable.value=selected;unavailable.textContent='Viatura #'+selected+' indisponível — escolha outra';unavailable.disabled=true;select.append(unavailable);}select.value=selected;}}
async function refreshVehicleChoices(){const turn=++vehicleChoiceRead,response=await j(`${API}/vehicles?active=all`);if(turn!==vehicleChoiceRead)return;if(!Array.isArray(response.vehicles))throw Error('Lista de viaturas incompleta.');VEHICLES=response.vehicles;renderVehicleChoices();}
function selectedVehicle(id){const value=Number(val(id));if(!value||!VEHICLES.some(v=>v.id===value&&v.active!==false&&!v.deletedAt)){alert('Escolha uma viatura disponível antes de continuar.');return false;}return true;}

function manageTransportGuideDocuments(id) {
  requirePageSession();
  const lang = document.getElementById('fleetLanguage')?.value || new URL(location.href).searchParams.get('lang') || 'pt';
  location.href = '/transport-guide-documents?' + new URLSearchParams({ ...(id ? { guideId: String(id) } : {}), lang });
}

async function load() {
  const turn=++legacyLoad;
  try { requirePageSession(); } catch (_) { return; }
  const results=await Promise.allSettled([loadRiskState(),refreshVehicleChoices(),window.CWFleetHistory?.refreshAll()]);
  if(turn!==legacyLoad||!window.CWFleetPageSession?.isCurrent())return;
  if(results[1].status==='rejected'){VEHICLES=[];renderVehicleChoices();alert(results[1].reason.message);}
  focusStoredRiskTarget();
}

function createTransportGuide() {
  requirePageSession();
  const vehicle=selectedVehicle('guideVehicle');if(!vehicle)return;
  const language=document.getElementById('fleetLanguage')?.value||'pt';
  location.href='/transport-guide-create?vehicleId='+encodeURIComponent(val('guideVehicle'))+'&lang='+encodeURIComponent(language);
}

function manageTransportGuide(id, action) {
  requirePageSession();
  if (!window.CWFleetHistory?.has('transport',id)) return;
  const lang = new URL(location.href).searchParams.get('lang') || document.documentElement.lang || 'pt';
  location.href = '/transport-guide-manage?' + new URLSearchParams({ guideId: String(id), action, lang });
}
function editTransportGuide(id) { manageTransportGuide(id, 'EDIT'); }

function editTransportGuideItems(id) {
  requirePageSession();
  if (!window.CWFleetHistory?.has('transport',id)) return;
  const lang = new URL(location.href).searchParams.get('lang') || document.documentElement.lang || 'pt';
  location.href = '/transport-guide-items?' + new URLSearchParams({ guideId: String(id), lang });
}

function closeTransportGuide(id) { manageTransportGuide(id, 'CLOSE'); }
function cancelTransportGuide(id) { manageTransportGuide(id, 'CANCEL'); }

function startWorkGuide() {
  requirePageSession();if(!selectedVehicle('workVehicle'))return;
  const lang=document.getElementById('fleetLanguage')?.value||'pt';
  location.href='/work-guide-start?vehicleId='+encodeURIComponent(val('workVehicle'))+'&lang='+encodeURIComponent(lang);
}

function closeWork(id) {
  requirePageSession();
  const lang=new URL(location.href).searchParams.get('lang');
  location.href='/work-guide-close?workGuideId='+encodeURIComponent(id)+(lang?'&lang='+encodeURIComponent(lang):'');
}

function createMaintenance() {
  requirePageSession();if(!selectedVehicle('maintVehicle'))return;
  const lang=document.getElementById('fleetLanguage')?.value||'pt';
  location.href='/vehicle-maintenance?kind=vehicles&vehicleId='+encodeURIComponent(val('maintVehicle'))+'&lang='+encodeURIComponent(lang);
}


window.load = load;
window.saveRiskRules = saveRiskRules;
window.manageTransportGuideDocuments = manageTransportGuideDocuments;
