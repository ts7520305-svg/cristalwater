const API = "/api/guides";
const RISK_API = "/api/operational-risk";

let VEHICLES = [];
let RISK_AVAILABLE=false, legacyLoad=0, vehicleChoiceRead=0, riskRead=0;
const LEGACY_TOKEN=localStorage.getItem('token')||localStorage.getItem('cristalwater_jwt')||localStorage.getItem('adminToken');
function requirePageSession(){if(!window.CWFleetPageSession?.isCurrent())throw Error('A sessão mudou ou expirou. Reabra a página com a conta correta.');}
function clearLegacy(){legacyLoad++;vehicleChoiceRead++;riskRead++;VEHICLES=[];GUIDES=[];WORK_GUIDES=[];RISK_AVAILABLE=false;for(const id of ['guides','works','movements','riskRules','riskSummary'])el(id)?.replaceChildren();for(const input of document.querySelectorAll('main input,main select,main textarea,main button'))if(!input.closest('#fleetManager')){if('value' in input)input.value='';input.disabled=true;}}
window.addEventListener('cw:fleet-session-ended',clearLegacy);window.addEventListener('pagehide',clearLegacy);
window.addEventListener('pageshow',()=>{if(window.CWFleetPageSession?.isCurrent()){for(const input of document.querySelectorAll('main input,main select,main textarea,main button'))if(!input.closest('#fleetManager'))input.disabled=false;load();}});
window.addEventListener('cw:fleet-updated',()=>refreshVehicleChoices().catch(()=>{if(window.CWFleetPageSession?.isCurrent()){VEHICLES=[];renderVehicleChoices();}}));
let GUIDES = [];
let WORK_GUIDES = [];
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
  if (target.vehicleId != null) selectors.push(`[data-risk-vehicle-id="${attrSelector(target.vehicleId)}"]`);

  let node = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!node && target.anchor) {
    const needle = normalizeText(target.anchor).slice(0, 24);
    node = Array.from(document.querySelectorAll("[data-risk-target-type],.card"))
      .find((item) => normalizeText(item.innerText || "").includes(needle));
  }
  if (!node) return;

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
          <input type="checkbox" data-risk-key="${esc(key)}" ${RISK_RULES[key] !== false ? "checked" : ""}>
          <span>${esc(label)}</span>
        </label>
      `).join("")}
      ${RISK_NUMBER_LABELS.map(([key, label]) => `
        <label class="cw-risk-rule">
          <span>${esc(label)}</span>
          <input type="number" min="0" data-risk-key="${esc(key)}" value="${esc(RISK_RULES[key] ?? 0)}">
        </label>
      `).join("")}
    `;
  }
}

function riskUnavailable(message){RISK_AVAILABLE=false;RISK_SUMMARY={issues:[],byVehicleId:{},byTechnicianId:{},byClientId:{},counts:{}};RISK_RULES={};el('riskSummary').textContent=message;el('riskRules').replaceChildren();el('saveRiskRulesButton').disabled=true;window.dispatchEvent(new Event('cw:fleet-risk-unavailable'));}
async function loadRiskState(){const turn=++riskRead;RISK_AVAILABLE=false;el('saveRiskRulesButton').disabled=true;try{const summary=await riskRequest('/summary');if(turn!==riskRead)return;if(!Array.isArray(summary.issues)||!summary.rules||!RISK_RULE_LABELS.every(([k])=>typeof summary.rules[k]==='boolean')||!RISK_NUMBER_LABELS.every(([k])=>Number.isFinite(summary.rules[k])&&summary.rules[k]>=0)||!summary.counts||!['total','critical','warning'].every(k=>Number.isSafeInteger(summary.counts[k])&&summary.counts[k]>=0))throw Error('Incomplete risk summary');RISK_SUMMARY=summary;RISK_RULES=summary.rules;RISK_AVAILABLE=true;renderRiskPanel();el('saveRiskRulesButton').disabled=false;window.dispatchEvent(new CustomEvent('cw:fleet-risk-ready',{detail:summary}));}catch(error){if(turn===riskRead&&window.CWFleetPageSession?.isCurrent())riskUnavailable('Não foi possível confirmar os alertas. Atualize para voltar a tentar.');}}
async function saveRiskRules(){if(!RISK_AVAILABLE)return;const nextRules={};document.querySelectorAll('[data-risk-key]').forEach(input=>{nextRules[input.dataset.riskKey]=input.type==='checkbox'?input.checked:Number(input.value);});try{await riskRequest('/rules',{method:'PUT',body:JSON.stringify({rules:nextRules})});await loadRiskState();}catch(_){if(window.CWFleetPageSession?.isCurrent())riskUnavailable('A gravação das regras não está confirmada. Atualize os alertas antes de voltar a guardar.');}}
function renderVehicleChoices(){for(const id of ['guideVehicle','workVehicle','maintVehicle']){const select=el(id);if(!select)continue;const selected=select.value;select.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='Escolher viatura…';select.append(blank);for(const vehicle of VEHICLES.filter(v=>v.active!==false&&!v.deletedAt)){const option=document.createElement('option');option.value=String(vehicle.id);option.textContent=vehicle.plate+' — '+(vehicle.name||'');select.append(option);}if(selected&&!Array.from(select.options).some(o=>o.value===selected)){const unavailable=document.createElement('option');unavailable.value=selected;unavailable.textContent='Viatura #'+selected+' indisponível — escolha outra';unavailable.disabled=true;select.append(unavailable);}select.value=selected;}}
async function refreshVehicleChoices(){const turn=++vehicleChoiceRead,response=await j(`${API}/vehicles?active=all`);if(turn!==vehicleChoiceRead)return;if(!Array.isArray(response.vehicles))throw Error('Lista de viaturas incompleta.');VEHICLES=response.vehicles;renderVehicleChoices();}
function selectedVehicle(id){const value=Number(val(id));if(!value||!VEHICLES.some(v=>v.id===value&&v.active!==false&&!v.deletedAt)){alert('Escolha uma viatura disponível antes de continuar.');return false;}return true;}

function renderGuideItems(items = []) {
  if (!items.length) return `<p class="muted">Sem materiais.</p>`;
  return `
    <table class="table">
      <tbody>
        ${items.map((item) => `
          <tr>
            <td>${esc(item.name)}</td>
            <td>${esc(item.type || "")}</td>
            <td>${esc(item.quantity)} ${esc(item.unit || "")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function renderOfficialDocument(doc) {
  if (!doc?.url) {
    return `<div class="document-note muted">Sem ficheiro oficial da AT anexado.</div>`;
  }
  return `
    <div class="document-note">
      <strong>Ficheiro AT oficial anexado</strong>
      <div class="muted">
        ${esc(doc.originalName || doc.filename || "Documento AT")}
        ${doc.size ? ` - ${esc(formatFileSize(doc.size))}` : ""}
        ${doc.uploadedAt ? ` - ${new Date(doc.uploadedAt).toLocaleString("pt-PT")}` : ""}
      </div>
    </div>
  `;
}

async function uploadTransportGuideDocument(id, input) {
  const fileInput = typeof input === "string" ? el(input) : input;
  if (!fileInput?.files?.[0]) return null;

  const formData = new FormData();
  formData.append("document", fileInput.files[0]);

  const response = await fetch(`${API}/transport/${encodeURIComponent(id)}/document`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  requirePageSession();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || data.message || "Erro ao enviar ficheiro da AT");
  }

  fileInput.value = "";
  return data.document;
}

async function replaceTransportGuideDocument(id, input) {
  try {
    await uploadTransportGuideDocument(id, input);
    await load();
  } catch (error) {
    alert(error.message);
  }
}

function renderTransportGuides() {
  const target = el("guides");
  if (!target) return;
  target.innerHTML = GUIDES.slice(0, 20).map((guide) => {
    const issues = uniqueIssues([
      ...targetIssues("TransportGuide", guide.id),
      ...vehicleIssues(guide.vehicleId).filter((issue) => issue.type === "MISSING_TRANSPORT_GUIDE_DOCUMENT"),
    ]);
    return `
      <div class="card ${riskClass(issues)}" data-risk-target-type="TransportGuide" data-risk-target-id="${esc(guide.id)}" data-risk-transport-guide-id="${esc(guide.id)}" data-risk-vehicle-id="${esc(guide.vehicleId || "")}" data-risk-anchor="${esc(guide.codeAT || guide.vehicle?.plate || guide.id)}" data-risk-issue-types="${esc(riskIssueTypes(issues))}">
        <strong>Guia ${esc(guide.codeAT || `#${guide.id}`)}</strong>
        <span class="badge ${guide.status === "ACTIVE" ? "" : "off"}">${esc(guide.status)}</span>
        ${renderRiskBadges(issues)}

        <div class="muted">
          ${esc(guide.vehicle?.plate || "sem viatura")} - ${guide.items?.length || 0} itens
        </div>

        ${renderOfficialDocument(guide.officialDocument)}
        ${renderGuideItems(guide.items || [])}

        <div class="links">
          ${guide.officialDocument?.url ? `<a class="btn primary" target="_blank" rel="noopener" href="${esc(guide.officialDocument.url)}">Abrir AT oficial</a>` : ""}
          <label class="btn upload-inline">
            <span>Anexar / substituir AT</span>
            <small>PDF ou imagem oficial</small>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xml,.txt,application/pdf,image/*" onchange="replaceTransportGuideDocument(${guide.id}, this)">
          </label>
          <button class="btn" onclick="editTransportGuide(${guide.id})">Editar guia</button>
          <button class="btn" onclick="editTransportGuideItems(${guide.id})">Editar materiais</button>
          <button class="btn warn" onclick="closeTransportGuide(${guide.id})">Fechar</button>
          <button class="btn warn" onclick="cancelTransportGuide(${guide.id})">Anular</button>
        </div>
      </div>
    `;
  }).join("") || `<p class="muted">Sem guias AT.</p>`;
}

function renderWorkGuides() {
  const target = el("works");
  if (!target) return;
  target.innerHTML = WORK_GUIDES.slice(0, 20).map((workGuide) => {
    const issues = uniqueIssues([
      ...targetIssues("WorkGuide", workGuide.id),
      ...vehicleIssues(workGuide.vehicleId).filter((issue) => ["MISSING_TRANSPORT_GUIDE", "VEHICLE_STOCK_LOW", "VEHICLE_STOCK_EMPTY"].includes(issue.type)),
    ]);
    return `
      <div class="card ${riskClass(issues)}" data-risk-target-type="WorkGuide" data-risk-target-id="${esc(workGuide.id)}" data-risk-work-guide-id="${esc(workGuide.id)}" data-risk-vehicle-id="${esc(workGuide.vehicleId || "")}" data-risk-anchor="${esc(workGuide.vehicle?.plate || workGuide.id)}" data-risk-issue-types="${esc(riskIssueTypes(issues))}">
        <strong>Obra #${workGuide.id}</strong>
        <span class="badge ${workGuide.status === "OPEN" ? "" : "off"}">${esc(workGuide.status)}</span>
        <span class="badge ${!workGuide.guideId ? "off" : ""}">${!workGuide.guideId ? "AT em falta" : "AT associada"}</span>
        ${renderRiskBadges(issues)}

        <div class="muted">
          ${esc(workGuide.vehicle?.plate || "")} - ${esc(workGuide.technician?.name || "")} - AT ${esc(workGuide.guide?.codeAT || workGuide.guideId || "AT EM FALTA")} - ${workGuide.items?.length || 0} itens
        </div>

        ${!workGuide.guideId ? `<div class="document-note muted">Guia de obra provisoria: o dia pode continuar, mas a guia de transporte AT deve ser adicionada para fechar a pendencia.</div>` : ""}

        <table class="table">
          <tbody>
            ${(workGuide.items || []).slice(0, 8).map((item) => `
              <tr>
                <td>${esc(item.name)}</td>
                <td>${esc(item.quantity)} ${esc(item.unit || "")}</td>
                <td>usado ${esc(item.usedQty || 0)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="links">
          <a class="btn primary" data-auth-download target="_blank" rel="noopener" href="/api/guides/work/${workGuide.id}/pdf">PDF guia obra</a>
          ${workGuide.guide?.id ? `<a class="btn" data-auth-download target="_blank" rel="noopener" href="/api/guides/transport/${workGuide.guide.id}/pdf">PDF guia AT</a>` : `<span class="btn warn">AT em falta</span>`}
          <button class="btn" onclick="closeWork(${workGuide.id})">Fechar</button>
        </div>
      </div>
    `;
  }).join("") || `<p class="muted">Sem guias de obra.</p>`;
}

async function load() {
  const turn=++legacyLoad;
  try {
    requirePageSession();
    await loadRiskState();
    if(turn!==legacyLoad)return;

    await refreshVehicleChoices();
    if(turn!==legacyLoad)return;

    const guidesResponse = await j(`${API}/transport`);
    if(turn!==legacyLoad)return;
    GUIDES = guidesResponse.guides || [];
    renderTransportGuides();

    const workResponse = await j(`${API}/work`);
    if(turn!==legacyLoad)return;
    WORK_GUIDES = workResponse.workGuides || [];
    renderWorkGuides();
    setTimeout(focusStoredRiskTarget, 150);

    const movementsResponse = await j(`${API}/movements?limit=30`);
    if(turn!==legacyLoad)return;
    const movements = movementsResponse.movements || [];
    el("movements").innerHTML = `
      <h3>Ultimos movimentos</h3>
      ${
        movements.map((movement) => `
          <div class="card">
            <strong>${esc(movement.movementType)}</strong> - ${esc(movement.itemName)} - ${esc(movement.quantity)} ${esc(movement.unit || "")}
            <div class="muted">
              Viatura ${esc(movement.vehicleId || "-")} - ${new Date(movement.createdAt).toLocaleString("pt-PT")}
            </div>
          </div>
        `).join("") || `<p class="muted">Sem movimentos.</p>`
      }
    `;
  } catch (error) {
    if(turn===legacyLoad&&window.CWFleetPageSession?.isCurrent())alert(error.message);
  }
}

function createTransportGuide() {
  requirePageSession();
  const vehicle=selectedVehicle('guideVehicle');if(!vehicle)return;
  const language=document.getElementById('fleetLanguage')?.value||'pt';
  location.href='/transport-guide-create?vehicleId='+encodeURIComponent(val('guideVehicle'))+'&lang='+encodeURIComponent(language);
}

async function editTransportGuide(id) {
  const guide = GUIDES.find((item) => Number(item.id) === Number(id));
  if (!guide) return;

  const codeAT = prompt("Codigo AT", guide.codeAT || "");
  if (codeAT === null) return;
  const origin = prompt("Origem", guide.origin || "");
  if (origin === null) return;
  const destination = prompt("Destino", guide.destination || "");
  if (destination === null) return;
  const status = prompt("Estado", guide.status || "ACTIVE");
  if (status === null) return;
  const notes = prompt("Notas", guide.notes || "");
  if (notes === null) return;

  await j(`${API}/transport/${id}`, {
    method: "PUT",
    body: JSON.stringify({ codeAT, origin, destination, status, notes }),
  });
  await load();
}

async function editTransportGuideItems(id) {
  const guide = GUIDES.find((item) => Number(item.id) === Number(id));
  if (!guide) return;

  const current = (guide.items || [])
    .map((item) => `${item.name};${item.type || ""};${item.unit || "UN"};${item.quantity || 0}`)
    .join("\n");

  const text = prompt("Editar materiais da guia.\nFormato por linha:\nNome;Tipo;Unidade;Quantidade", current);
  if (text === null) return;

  const items = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, type, unit, quantity] = line.split(";").map((part) => part?.trim());
      return { name, type: type || "MATERIAL", unit: unit || "UN", quantity: Number(quantity || 0) };
    })
    .filter((item) => item.name);

  await j(`${API}/transport/${id}/items`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
  await load();
}

async function closeTransportGuide(id) {
  if (!confirm("Fechar esta guia AT?")) return;
  await j(`${API}/transport/${id}`, { method: "PUT", body: JSON.stringify({ status: "CLOSED" }) });
  await load();
}

async function cancelTransportGuide(id) {
  if (!confirm("Anular esta guia AT?")) return;
  await j(`${API}/transport/${id}`, { method: "PUT", body: JSON.stringify({ status: "CANCELLED" }) });
  await load();
}

async function startWorkGuide() {
  if(!selectedVehicle("workVehicle"))return;
  const response = await j(`${API}/work/start`, {
    method: "POST",
    body: JSON.stringify({
      vehicleId: val("workVehicle"),
      technicianId: val("workTech"),
      startKm: val("startKm"),
    }),
  });
  if (response.message) alert(response.message);
  await load();
}


async function closeWork(id) {
  const endKm = prompt("Km final?");
  if (endKm === null) return;
  await j(`${API}/work/${id}/close`, {
    method: "POST",
    body: JSON.stringify({ endKm }),
  });
  await load();
}

async function createMaintenance() {
  if(!selectedVehicle("maintVehicle"))return;
  await j(`${API}/maintenance`, {
    method: "POST",
    body: JSON.stringify({
      vehicleId: val("maintVehicle"),
      type: el("maintType")?.value || "GENERAL",
      title: val("maintTitle"),
      dueDate: val("maintDue"),
      km: val("maintKm"),
    }),
  });
  await load();
}


window.load = load;
window.saveRiskRules = saveRiskRules;
window.replaceTransportGuideDocument = replaceTransportGuideDocument;
