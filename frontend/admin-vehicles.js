const API = "/api/guides";
const RISK_API = "/api/operational-risk";

let VEHICLES = [];
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

const DEFAULT_RISK_RULES = {
  overduePayments: true,
  missingTransportGuide: true,
  missingTransportGuideDocument: true,
  missingWorkGuide: true,
  vehicleInsuranceExpiring: true,
  vehicleInspectionExpiring: true,
  lowVehicleStock: true,
  pendingOperationalLocks: true,
  technicianLinkedVehicleIssues: true,
  insuranceWarningDays: 30,
  inspectionWarningDays: 30,
  stockLowThreshold: 1,
};

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

async function j(url, opt = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opt,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || data.message || "Erro");
  }
  return data;
}

async function riskRequest(path, opt = {}) {
  const response = await fetch(`${RISK_API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opt,
  });
  const data = await response.json().catch(() => ({}));
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

function daysUntil(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - start.getTime()) / 86400000);
}

function addClientRiskIssue(issues, data) {
  issues.push({
    id: data.id || [data.type, data.targetType, data.targetId, data.vehicleId, data.technicianId].filter(Boolean).join(":"),
    severity: data.severity || "WARNING",
    type: data.type,
    targetType: data.targetType,
    targetId: data.targetId == null ? null : Number(data.targetId),
    vehicleId: data.vehicleId == null ? null : Number(data.vehicleId),
    technicianId: data.technicianId == null ? null : Number(data.technicianId),
    clientId: data.clientId == null ? null : Number(data.clientId),
    title: data.title || "Atencao",
    message: data.message || "",
    href: data.href || "/admin-vehicles",
    source: "BROWSER_RISK",
  });
}

function addTechLinkedIssues(issues, vehicle, vehicleIssue, rules) {
  if (rules.technicianLinkedVehicleIssues === false) return;
  (vehicle.assignedTechnicians || []).filter((tech) => tech.active !== false).forEach((tech) => {
    addClientRiskIssue(issues, {
      ...vehicleIssue,
      id: `TECH_LINK:${vehicleIssue.id || vehicleIssue.type}:${tech.id}`,
      type: "TECHNICIAN_LINKED_VEHICLE_RISK",
      targetType: "Technician",
      targetId: tech.id,
      technicianId: tech.id,
      vehicleId: vehicle.id,
      title: `Viatura ${vehicle.plate}: ${vehicleIssue.title}`,
      source: "BROWSER_RISK",
    });
  });
}

function isInsuranceRecord(record) {
  return /seguro|apolice|apol/.test(normalizeText(`${record?.type || ""} ${record?.title || ""} ${record?.notes || ""}`));
}

function isInspectionRecord(record) {
  return /inspecao|inspec|ipo|vistoria/.test(normalizeText(`${record?.type || ""} ${record?.title || ""} ${record?.notes || ""}`));
}

function latestRecord(records, vehicleId, predicate) {
  return records
    .filter((record) => Number(record.vehicleId) === Number(vehicleId) && predicate(record))
    .sort((a, b) => new Date(b.dueDate || b.createdAt).getTime() - new Date(a.dueDate || a.createdAt).getTime())[0] || null;
}

async function loadRiskRulesFallback() {
  try {
    const data = await j("/api/settings/global/OPERATIONAL_RISK_RULES");
    return { ...DEFAULT_RISK_RULES, ...JSON.parse(data.value || "{}") };
  } catch (_) {
    return { ...DEFAULT_RISK_RULES };
  }
}

async function loadRiskFromExistingApis() {
  const rules = await loadRiskRulesFallback();
  const [vehiclesData, guidesData, worksData, maintenanceData] = await Promise.all([
    j(`${API}/vehicles?active=all`).catch(() => ({ vehicles: [] })),
    j(`${API}/transport`).catch(() => ({ guides: [] })),
    j(`${API}/work`).catch(() => ({ workGuides: [] })),
    j(`${API}/maintenance`).catch(() => ({ records: [] })),
  ]);

  const vehicles = (vehiclesData.vehicles || []).filter((vehicle) => vehicle.active !== false);
  const guides = guidesData.guides || [];
  const works = worksData.workGuides || [];
  const maintenance = maintenanceData.records || [];
  const issues = [];

  vehicles.forEach((vehicle) => {
    const vehicleLabel = vehicle.plate || `Viatura ${vehicle.id}`;
    const assignedTechs = (vehicle.assignedTechnicians || []).filter((tech) => tech.active !== false);
    const activeGuide = guides.find((guide) => Number(guide.vehicleId) === Number(vehicle.id) && guide.status === "ACTIVE");
    const openWork = works.find((work) => Number(work.vehicleId) === Number(vehicle.id) && work.status === "OPEN");

    if (rules.missingTransportGuide !== false) {
      let vehicleIssue = null;
      if (openWork && !openWork.guideId) {
        vehicleIssue = {
          id: `MISSING_AT:${vehicle.id}:${openWork.id}`,
          type: "MISSING_TRANSPORT_GUIDE",
          severity: "CRITICAL",
          targetType: "Vehicle",
          targetId: vehicle.id,
          vehicleId: vehicle.id,
          technicianId: openWork.technicianId || null,
          title: "Guia AT em falta",
          message: `Falta guia de transporte AT para ${vehicleLabel}. A guia de obra #${openWork.id} esta provisoria.`,
        };
      } else if (assignedTechs.length && !activeGuide) {
        vehicleIssue = {
          id: `NO_ACTIVE_AT:${vehicle.id}`,
          type: "MISSING_TRANSPORT_GUIDE",
          severity: "CRITICAL",
          targetType: "Vehicle",
          targetId: vehicle.id,
          vehicleId: vehicle.id,
          title: "Sem guia AT ativa",
          message: `${vehicleLabel} tem tecnico associado mas nao tem guia de transporte AT ativa.`,
        };
      }
      if (vehicleIssue) {
        addClientRiskIssue(issues, vehicleIssue);
        addTechLinkedIssues(issues, vehicle, vehicleIssue, rules);
      }
    }

    if (rules.missingTransportGuideDocument !== false && activeGuide && !activeGuide.officialDocument?.url) {
      const vehicleIssue = {
        id: `MISSING_AT_FILE:${activeGuide.id}`,
        type: "MISSING_TRANSPORT_GUIDE_DOCUMENT",
        severity: "WARNING",
        targetType: "TransportGuide",
        targetId: activeGuide.id,
        vehicleId: vehicle.id,
        title: "Ficheiro AT oficial em falta",
        message: `${vehicleLabel} tem guia AT ${activeGuide.codeAT || `#${activeGuide.id}`} sem ficheiro oficial anexado.`,
      };
      addClientRiskIssue(issues, vehicleIssue);
      addTechLinkedIssues(issues, vehicle, vehicleIssue, rules);
    }

    if (rules.missingWorkGuide !== false && (activeGuide || assignedTechs.length) && !openWork) {
      const vehicleIssue = {
        id: `MISSING_WORK:${vehicle.id}`,
        type: "MISSING_WORK_GUIDE",
        severity: "WARNING",
        targetType: "Vehicle",
        targetId: vehicle.id,
        vehicleId: vehicle.id,
        title: "Guia de obra em falta",
        message: `${vehicleLabel} ainda nao tem guia de obra aberta para o dia/ronda atual.`,
      };
      addClientRiskIssue(issues, vehicleIssue);
      addTechLinkedIssues(issues, vehicle, vehicleIssue, rules);
    }

    if (rules.vehicleInsuranceExpiring !== false) {
      const insurance = latestRecord(maintenance, vehicle.id, isInsuranceRecord);
      const left = daysUntil(insurance?.dueDate);
      let vehicleIssue = null;
      if (!insurance) {
        vehicleIssue = { id: `NO_INSURANCE:${vehicle.id}`, type: "VEHICLE_INSURANCE_MISSING", severity: "CRITICAL", targetType: "Vehicle", targetId: vehicle.id, vehicleId: vehicle.id, title: "Seguro nao registado", message: `${vehicleLabel} nao tem seguro registado no sistema.` };
      } else if (left !== null && left < 0) {
        vehicleIssue = { id: `INSURANCE_OVERDUE:${vehicle.id}`, type: "VEHICLE_INSURANCE_OVERDUE", severity: "CRITICAL", targetType: "Vehicle", targetId: vehicle.id, vehicleId: vehicle.id, title: "Seguro expirado", message: `${vehicleLabel} tem seguro expirado.` };
      } else if (left !== null && left <= Number(rules.insuranceWarningDays || 30)) {
        vehicleIssue = { id: `INSURANCE_EXPIRING:${vehicle.id}`, type: "VEHICLE_INSURANCE_EXPIRING", severity: "WARNING", targetType: "Vehicle", targetId: vehicle.id, vehicleId: vehicle.id, title: "Seguro a acabar", message: `${vehicleLabel} tem seguro a acabar em ${left} dia(s).` };
      }
      if (vehicleIssue) {
        addClientRiskIssue(issues, vehicleIssue);
        addTechLinkedIssues(issues, vehicle, vehicleIssue, rules);
      }
    }

    if (rules.vehicleInspectionExpiring !== false) {
      const inspection = latestRecord(maintenance, vehicle.id, isInspectionRecord);
      const left = daysUntil(inspection?.dueDate);
      let vehicleIssue = null;
      if (!inspection) {
        vehicleIssue = { id: `NO_INSPECTION:${vehicle.id}`, type: "VEHICLE_INSPECTION_MISSING", severity: "WARNING", targetType: "Vehicle", targetId: vehicle.id, vehicleId: vehicle.id, title: "Inspecao nao registada", message: `${vehicleLabel} nao tem inspecao/IPO registada no sistema.` };
      } else if (left !== null && left < 0) {
        vehicleIssue = { id: `INSPECTION_OVERDUE:${vehicle.id}`, type: "VEHICLE_INSPECTION_OVERDUE", severity: "CRITICAL", targetType: "Vehicle", targetId: vehicle.id, vehicleId: vehicle.id, title: "Inspecao vencida", message: `${vehicleLabel} tem inspecao vencida.` };
      } else if (left !== null && left <= Number(rules.inspectionWarningDays || 30)) {
        vehicleIssue = { id: `INSPECTION_EXPIRING:${vehicle.id}`, type: "VEHICLE_INSPECTION_EXPIRING", severity: "WARNING", targetType: "Vehicle", targetId: vehicle.id, vehicleId: vehicle.id, title: "Inspecao a acabar", message: `${vehicleLabel} tem inspecao a acabar em ${left} dia(s).` };
      }
      if (vehicleIssue) {
        addClientRiskIssue(issues, vehicleIssue);
        addTechLinkedIssues(issues, vehicle, vehicleIssue, rules);
      }
    }

    if (rules.lowVehicleStock !== false && openWork) {
      const lowItems = (openWork.items || []).filter((item) => Number(item.quantity || 0) <= Number(rules.stockLowThreshold || 1));
      if (!(openWork.items || []).length || lowItems.length) {
        const names = lowItems.slice(0, 5).map((item) => `${item.name} (${item.quantity} ${item.unit || "UN"})`).join(", ");
        const vehicleIssue = {
          id: `LOW_STOCK:${vehicle.id}:${openWork.id}`,
          type: lowItems.length ? "VEHICLE_STOCK_LOW" : "VEHICLE_STOCK_EMPTY",
          severity: lowItems.some((item) => Number(item.quantity || 0) <= 0) ? "CRITICAL" : "WARNING",
          targetType: "WorkGuide",
          targetId: openWork.id,
          vehicleId: vehicle.id,
          technicianId: openWork.technicianId || null,
          title: lowItems.length ? "Material baixo/em falta" : "Stock da viatura sem linhas",
          message: lowItems.length ? `${vehicleLabel} tem material baixo ou em falta: ${names}.` : `${vehicleLabel} tem guia de obra aberta mas sem material carregado.`,
        };
        addClientRiskIssue(issues, vehicleIssue);
        addTechLinkedIssues(issues, vehicle, vehicleIssue, rules);
      }
    }
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    rules,
    counts: {
      total: issues.length,
      critical: issues.filter((issue) => issue.severity === "CRITICAL").length,
      warning: issues.filter((issue) => issue.severity !== "CRITICAL").length,
    },
    issues,
    byVehicleId: groupIssues(issues, "vehicleId"),
    byTechnicianId: groupIssues(issues, "technicianId"),
    byClientId: groupIssues(issues, "clientId"),
  };
}

function issueText(issue) {
  return `${issue.title || "Atencao"}: ${issue.message || ""}`.trim();
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

async function loadRiskState() {
  try {
    RISK_SUMMARY = await riskRequest("/summary");
    RISK_RULES = RISK_SUMMARY.rules || {};
  } catch (error) {
    console.warn(error);
    RISK_SUMMARY = await loadRiskFromExistingApis();
    RISK_RULES = RISK_SUMMARY.rules || {};
  }
  renderRiskPanel();
}

async function saveRiskRules() {
  const nextRules = {};
  document.querySelectorAll("[data-risk-key]").forEach((input) => {
    nextRules[input.dataset.riskKey] = input.type === "checkbox" ? input.checked : Number(input.value || 0);
  });
  try {
    await riskRequest("/rules", {
      method: "PUT",
      body: JSON.stringify({ rules: nextRules }),
    });
  } catch (_) {
    await j("/api/settings/global/OPERATIONAL_RISK_RULES", {
      method: "PUT",
      body: JSON.stringify({
        value: JSON.stringify({ ...DEFAULT_RISK_RULES, ...nextRules }),
        notes: "Regras dos alertas visuais operacionais.",
      }),
    });
  }
  await load();
}

function vehicleOptions() {
  return VEHICLES
    .filter((vehicle) => vehicle.active !== false)
    .map((vehicle) => `<option value="${vehicle.id}">${esc(vehicle.plate)} - ${esc(vehicle.name || "")}</option>`)
    .join("");
}

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
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
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

function renderVehicles() {
  const target = el("vehicles");
  if (!target) return;
  target.innerHTML = VEHICLES.map((vehicle) => {
    const issues = vehicleIssues(vehicle.id);
    return `
      <div class="card ${riskClass(issues)}" data-risk-target-type="Vehicle" data-risk-target-id="${esc(vehicle.id)}" data-risk-vehicle-id="${esc(vehicle.id)}" data-risk-anchor="${esc(vehicle.plate || vehicle.name || vehicle.id)}" data-risk-issue-types="${esc(riskIssueTypes(issues))}">
        <strong>${esc(vehicle.plate)}</strong>
        <span class="badge ${vehicle.active ? "" : "off"}">${esc(vehicle.status || "ACTIVE")}</span>
        ${renderRiskBadges(issues)}

        <div class="muted">
          ${esc(vehicle.name || "")} - ${esc(vehicle.brand || "")} ${esc(vehicle.model || "")} - Km ${esc(vehicle.currentKm || 0)}
        </div>
        ${renderAssignedTechnicians(vehicle)}

        <div class="muted ${issues.length ? "cw-risk-line" : ""}">
          Guia obra atual: ${vehicle.workGuides?.[0]?.id || "-"} - guia AT: ${vehicle.transportGuides?.[0]?.codeAT || vehicle.transportGuides?.[0]?.id || "-"}
        </div>

        <div class="links">
          <button class="btn" onclick="editVehicle(${vehicle.id})">Editar</button>
          ${
            vehicle.active
              ? `<button class="btn warn" onclick="archiveVehicle(${vehicle.id})">Arquivar</button>`
              : `<button class="btn primary" onclick="restoreVehicle(${vehicle.id})">Restaurar</button>`
          }
          <button class="btn warn" onclick="deleteVehicle(${vehicle.id})">Eliminar</button>
        </div>
      </div>
    `;
  }).join("") || `<p class="muted">Sem viaturas.</p>`;
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
          <a class="btn primary" target="_blank" rel="noopener" href="/api/guides/work/${workGuide.id}/pdf">PDF guia obra</a>
          ${workGuide.guide?.id ? `<a class="btn" target="_blank" rel="noopener" href="/api/guides/transport/${workGuide.guide.id}/pdf">PDF guia AT</a>` : `<span class="btn warn">AT em falta</span>`}
          <button class="btn" onclick="closeWork(${workGuide.id})">Fechar</button>
        </div>
      </div>
    `;
  }).join("") || `<p class="muted">Sem guias de obra.</p>`;
}

async function load() {
  try {
    await loadRiskState();

    const vehiclesResponse = await j(`${API}/vehicles?active=all`);
    VEHICLES = vehiclesResponse.vehicles || [];

    ["guideVehicle", "workVehicle", "maintVehicle"].forEach((id) => {
      const select = el(id);
      if (select) select.innerHTML = vehicleOptions();
    });
    renderVehicles();

    const guidesResponse = await j(`${API}/transport`);
    GUIDES = guidesResponse.guides || [];
    renderTransportGuides();

    const workResponse = await j(`${API}/work`);
    WORK_GUIDES = workResponse.workGuides || [];
    renderWorkGuides();
    setTimeout(focusStoredRiskTarget, 150);

    const movementsResponse = await j(`${API}/movements?limit=30`);
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
    alert(error.message);
  }
}

async function saveVehicle() {
  await j(`${API}/vehicles`, {
    method: "POST",
    body: JSON.stringify({
      plate: val("plate"),
      name: val("vname"),
      brand: val("brand"),
      model: val("model"),
      currentKm: val("km"),
      status: val("status"),
    }),
  });
  await load();
}

async function editVehicle(id) {
  const vehicle = VEHICLES.find((item) => Number(item.id) === Number(id));
  if (!vehicle) return;

  const newPlate = prompt("Matricula", vehicle.plate || "");
  if (newPlate === null) return;
  const name = prompt("Nome", vehicle.name || "");
  if (name === null) return;
  const brand = prompt("Marca", vehicle.brand || "");
  if (brand === null) return;
  const model = prompt("Modelo", vehicle.model || "");
  if (model === null) return;
  const currentKm = prompt("Km atual", vehicle.currentKm || 0);
  if (currentKm === null) return;
  const status = prompt("Estado", vehicle.status || "ACTIVE");
  if (status === null) return;

  await j(`${API}/vehicles/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      plate: newPlate,
      name,
      brand,
      model,
      currentKm,
      status,
      active: status !== "ARCHIVED",
      archiveStatus: status === "ARCHIVED" ? "ARQUIVADO" : "ATIVO",
    }),
  });
  await load();
}

async function archiveVehicle(id) {
  await j(`${API}/vehicles/${id}`, {
    method: "PUT",
    body: JSON.stringify({ active: false, status: "ARCHIVED", archiveStatus: "ARQUIVADO" }),
  });
  await load();
}

async function restoreVehicle(id) {
  await j(`${API}/vehicles/${id}/restore`, { method: "POST" });
  await load();
}

async function deleteVehicle(id) {
  if (!confirm("Eliminar viatura se nao tiver historico; se tiver historico, sera arquivada. Continuar?")) return;
  await j(`${API}/vehicles/${id}`, { method: "DELETE" });
  await load();
}

function addGuideItem() {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input placeholder="Nome">
    <input placeholder="Tipo">
    <input placeholder="Un">
    <input type="number" placeholder="Qtd">
    <button class="btn warn" onclick="this.parentElement.remove()">x</button>
  `;
  el("guideItems").appendChild(row);
}

async function createTransportGuide() {
  const items = [...el("guideItems").children]
    .map((row) => ({
      name: row.children[0].value,
      type: row.children[1].value,
      unit: row.children[2].value,
      quantity: Number(row.children[3].value || 0),
    }))
    .filter((item) => item.name);

  const created = await j(`${API}/transport`, {
    method: "POST",
    body: JSON.stringify({
      vehicleId: val("guideVehicle"),
      codeAT: val("codeAT"),
      origin: val("origin"),
      destination: val("destination"),
      items,
    }),
  });

  const documentInput = el("guideDocument");
  if (documentInput?.files?.[0] && created?.guide?.id) {
    await uploadTransportGuideDocument(created.guide.id, documentInput);
  }

  el("guideItems").innerHTML = "";
  addGuideItem();
  await load();
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

async function consume() {
  await j(`${API}/work/consume`, {
    method: "POST",
    body: JSON.stringify({
      workGuideId: val("consumeWork"),
      name: val("consumeName"),
      quantity: val("consumeQty"),
      visitId: val("consumeVisit"),
    }),
  });
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

window.addEventListener("DOMContentLoaded", () => {
  const guideDocument = el("guideDocument");
  const guideDocumentName = el("guideDocumentName");
  if (guideDocument && guideDocumentName) {
    guideDocument.addEventListener("change", () => {
      guideDocumentName.textContent = guideDocument.files?.[0]?.name || "Nenhum ficheiro escolhido";
    });
  }
  if (!el("guideItems")?.children.length) addGuideItem();
  load();
});

window.load = load;
window.saveRiskRules = saveRiskRules;
window.replaceTransportGuideDocument = replaceTransportGuideDocument;
