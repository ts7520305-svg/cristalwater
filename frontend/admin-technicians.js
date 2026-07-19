const API = `${location.origin}/api/core`;
const RISK_API = `${location.origin}/api/operational-risk`;
const ui = window.CwUi || {
  success: (m) => console.log(m),
  error: (m) => console.error(m),
  info: (m) => console.info(m),
  confirm: async () => false,
  prompt: async () => null,
  safeError: (err, fallback) => (err && err.message) || fallback,
};

let TECHS = [];
let RISK_SUMMARY = { byTechnicianId: {}, issues: [] };
let showInactive = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char]));
}

function userError(error, fallback) {
  return ui.safeError(error, fallback || "Nao foi possivel concluir a operacao.");
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function technicianSearchText(tech) {
  return normalizeText([
    tech.id,
    tech.name,
    tech.email,
    tech.phone,
    tech.pin,
    tech.zone,
    tech.vehicleId,
    tech.role,
    tech.active === false ? "inativo desativado" : "ativo",
  ].filter(Boolean).join(" "));
}

function filteredTechnicians() {
  const query = normalizeText(val("technicianSearch"));
  if (!query) return TECHS;
  const terms = query.split(/\s+/).filter(Boolean);
  return TECHS.filter((tech) => {
    const haystack = technicianSearchText(tech);
    return terms.every((term) => haystack.includes(term));
  });
}

async function request(path, opts = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || data.message || "Erro");
  return data;
}

async function loadRiskSummary() {
  try {
    const response = await fetch(`${RISK_API}/summary`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "Erro");
    RISK_SUMMARY = data;
  } catch (error) {
    console.warn(error);
    RISK_SUMMARY = await loadTechnicianRiskFallback();
  }
}

async function apiJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || data.message || "Erro");
  return data;
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

function isVehicleInsurance(record) {
  return /seguro|apolice|apol/.test(normalizeText(`${record?.type || ""} ${record?.title || ""} ${record?.notes || ""}`));
}

function isVehicleInspection(record) {
  return /inspecao|inspec|ipo|vistoria/.test(normalizeText(`${record?.type || ""} ${record?.title || ""} ${record?.notes || ""}`));
}

function daysUntil(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

function latestRecord(records, vehicleId, predicate) {
  return records
    .filter((record) => Number(record.vehicleId) === Number(vehicleId) && predicate(record))
    .sort((a, b) => new Date(b.dueDate || b.createdAt).getTime() - new Date(a.dueDate || a.createdAt).getTime())[0] || null;
}

function pushTechVehicleIssue(issues, tech, vehicle, issue) {
  if (!tech?.id) return;
  issues.push({
    id: `${issue.type}:${vehicle.id}:${tech.id}`,
    type: issue.type,
    severity: issue.severity || "WARNING",
    targetType: "Technician",
    targetId: tech.id,
    technicianId: tech.id,
    vehicleId: vehicle.id,
    title: `Viatura ${vehicle.plate || vehicle.id}: ${issue.title}`,
    message: issue.message,
    source: "BROWSER_RISK",
  });
}

async function loadTechnicianRiskFallback() {
  try {
    const [vehiclesData, guidesData, worksData, maintenanceData] = await Promise.all([
      apiJson("/api/guides/vehicles?active=all").catch(() => ({ vehicles: [] })),
      apiJson("/api/guides/transport").catch(() => ({ guides: [] })),
      apiJson("/api/guides/work").catch(() => ({ workGuides: [] })),
      apiJson("/api/guides/maintenance").catch(() => ({ records: [] })),
    ]);
    const guides = guidesData.guides || [];
    const works = worksData.workGuides || [];
    const maintenance = maintenanceData.records || [];
    const issues = [];

    (vehiclesData.vehicles || []).filter((vehicle) => vehicle.active !== false).forEach((vehicle) => {
      const techs = (vehicle.assignedTechnicians || []).filter((tech) => tech.active !== false);
      if (!techs.length) return;
      const activeGuide = guides.find((guide) => Number(guide.vehicleId) === Number(vehicle.id) && guide.status === "ACTIVE");
      const openWork = works.find((work) => Number(work.vehicleId) === Number(vehicle.id) && work.status === "OPEN");
      const label = vehicle.plate || `Viatura ${vehicle.id}`;
      const vehicleIssues = [];

      if (openWork && !openWork.guideId) {
        vehicleIssues.push({ type: "MISSING_TRANSPORT_GUIDE", severity: "CRITICAL", title: "Guia AT em falta", message: `Falta guia de transporte AT para ${label}.` });
      } else if (!activeGuide) {
        vehicleIssues.push({ type: "MISSING_TRANSPORT_GUIDE", severity: "CRITICAL", title: "Sem guia AT ativa", message: `${label} nao tem guia de transporte AT ativa.` });
      }
      if (activeGuide && !activeGuide.officialDocument?.url) {
        vehicleIssues.push({ type: "MISSING_TRANSPORT_GUIDE_DOCUMENT", severity: "WARNING", title: "Ficheiro AT oficial em falta", message: `${label} tem guia AT sem ficheiro oficial anexado.` });
      }
      if ((activeGuide || techs.length) && !openWork) {
        vehicleIssues.push({ type: "MISSING_WORK_GUIDE", severity: "WARNING", title: "Guia de obra em falta", message: `${label} ainda nao tem guia de obra aberta.` });
      }

      const insurance = latestRecord(maintenance, vehicle.id, isVehicleInsurance);
      const insuranceDays = daysUntil(insurance?.dueDate);
      if (!insurance) vehicleIssues.push({ type: "VEHICLE_INSURANCE_MISSING", severity: "CRITICAL", title: "Seguro nao registado", message: `${label} nao tem seguro registado.` });
      else if (insuranceDays !== null && insuranceDays < 0) vehicleIssues.push({ type: "VEHICLE_INSURANCE_OVERDUE", severity: "CRITICAL", title: "Seguro expirado", message: `${label} tem seguro expirado.` });
      else if (insuranceDays !== null && insuranceDays <= 30) vehicleIssues.push({ type: "VEHICLE_INSURANCE_EXPIRING", severity: "WARNING", title: "Seguro a acabar", message: `${label} tem seguro a acabar em ${insuranceDays} dia(s).` });

      const inspection = latestRecord(maintenance, vehicle.id, isVehicleInspection);
      const inspectionDays = daysUntil(inspection?.dueDate);
      if (!inspection) vehicleIssues.push({ type: "VEHICLE_INSPECTION_MISSING", severity: "WARNING", title: "Inspecao nao registada", message: `${label} nao tem inspecao/IPO registada.` });
      else if (inspectionDays !== null && inspectionDays < 0) vehicleIssues.push({ type: "VEHICLE_INSPECTION_OVERDUE", severity: "CRITICAL", title: "Inspecao vencida", message: `${label} tem inspecao vencida.` });
      else if (inspectionDays !== null && inspectionDays <= 30) vehicleIssues.push({ type: "VEHICLE_INSPECTION_EXPIRING", severity: "WARNING", title: "Inspecao a acabar", message: `${label} tem inspecao a acabar em ${inspectionDays} dia(s).` });

      if (openWork) {
        const lowItems = (openWork.items || []).filter((item) => Number(item.quantity || 0) <= 1);
        if (lowItems.length) {
          vehicleIssues.push({ type: "VEHICLE_STOCK_LOW", severity: "WARNING", title: "Material baixo/em falta", message: `${label} tem material baixo ou em falta.` });
        }
      }

      techs.forEach((tech) => vehicleIssues.forEach((issue) => pushTechVehicleIssue(issues, tech, vehicle, issue)));
    });

    return { issues, byTechnicianId: groupIssues(issues, "technicianId") };
  } catch (_) {
    return { byTechnicianId: {}, issues: [] };
  }
}

function technicianRiskIssues(techId) {
  return RISK_SUMMARY.byTechnicianId?.[String(techId)] || [];
}

function issueText(issue) {
  return `${issue.title || "Atencao"}: ${issue.message || ""}`.trim();
}

function cleanRiskAnchor(value) {
  return String(value || "").split(":")[0].trim();
}

function riskHref(issue) {
  const targetType = String(issue?.targetType || "");
  if (issue?.vehicleId || ["Vehicle", "TransportGuide", "WorkGuide"].includes(targetType)) return "/admin-vehicles";
  if (targetType === "Client") return "/admin-clients";
  return issue?.href || "/admin-master-control";
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
    `href="${escapeHtml(riskHref(issue))}"`,
    `data-cw-risk-link="1"`,
    `data-risk-target="${escapeHtml(JSON.stringify(riskTargetPayload(issue)))}"`,
    `data-anchor="${escapeHtml(riskAnchor(issue))}"`,
    `onclick="try{sessionStorage.setItem('cw:risk-target',this.dataset.riskTarget||'');sessionStorage.setItem('cw:risk-anchor',this.dataset.anchor||'');}catch(_){}"`,
  ].join(" ");
}

function renderRiskBadges(issues = []) {
  if (!issues.length) return "";
  const top = issues.slice(0, 2);
  return `
    <div class="cw-risk-badges">
      ${top.map((issue) => `
        <a class="cw-risk-badge" ${riskLinkAttrs(issue)} data-severity="${escapeHtml(issue.severity || "WARNING")}" data-risk-tip="${escapeHtml(issueText(issue))}">
          ${issue.severity === "CRITICAL" ? "Erro" : "Aviso"}: ${escapeHtml(issue.title || "Atencao")}
        </a>
      `).join("")}
      ${issues.length > top.length ? `<a class="cw-risk-badge" ${riskLinkAttrs(issues[top.length])} data-risk-tip="${escapeHtml(`${issues.length - top.length} avisos adicionais.`)}">+${issues.length - top.length}</a>` : ""}
    </div>
  `;
}

function technicianStatus(tech) {
  return tech.active === false
    ? '<span class="pill cw-status-inactive">Inativo</span>'
    : '<span class="pill cw-status-active">Ativo</span>';
}

function renderTechnicianRow(tech) {
  const id = Number(tech.id);
  const issues = technicianRiskIssues(id);
  return `
    <article class="tech-row ${issues.length ? "cw-risk-card" : ""}" data-risk-target-type="Technician" data-risk-target-id="${escapeHtml(id)}" data-risk-technician-id="${escapeHtml(id)}" data-risk-vehicle-id="${escapeHtml(tech.vehicleId || "")}" data-risk-anchor="${escapeHtml(tech.name || "")}">
      <div class="tech-name">
        <b>${escapeHtml(tech.name || "-")}</b>
        ${technicianStatus(tech)}
        ${renderRiskBadges(issues)}
      </div>
      <div class="tech-meta">
        <span>Email: ${escapeHtml(tech.email || "-")}</span>
        <span>Telefone: ${escapeHtml(tech.phone || "-")}</span>
      </div>
      <div class="tech-meta">
        <span>PIN: ${escapeHtml(tech.pin || "-")}</span>
        <span class="${issues.length ? "cw-risk-line" : ""}">Zona: ${escapeHtml(tech.zone || "-")} - Viatura: ${escapeHtml(tech.vehicleId || "-")}</span>
      </div>
      <div class="tech-actions">
        <button onclick="editTechnician(${id})">Editar</button>
        ${tech.active === false
          ? `<button onclick="restoreTechnician(${id})" class="cw-action-ok">Ativar</button>`
          : `<button onclick="toggleTechnician(${id}, false)" class="cw-action-warn">Desativar</button>`}
        <button onclick="resetPin(${id})">Reset PIN</button>
        <button onclick="deleteTechnician(${id})" class="cw-action-danger">Eliminar</button>
      </div>
    </article>
  `;
}

function renderTechnicians() {
  const list = document.getElementById("list");
  const count = document.getElementById("technicianCount");
  if (!list) return;

  const rows = filteredTechnicians();
  if (count) count.textContent = `${rows.length} de ${TECHS.length} tecnico(s)`;

  if (!TECHS.length) {
    list.innerHTML = '<div class="cw-empty">Ainda nao existem tecnicos reais inseridos.</div>';
    return;
  }

  if (!rows.length) {
    list.innerHTML = '<div class="cw-empty">Nenhum tecnico encontrado com essa pesquisa.</div>';
    return;
  }

  list.innerHTML = `
    <div class="tech-list-head">
      <span>Tecnico</span>
      <span>Contacto</span>
      <span>Operacao</span>
      <span style="text-align:right">Acoes</span>
    </div>
    ${rows.map(renderTechnicianRow).join("")}
  `;
}

async function loadTechnicians() {
  const list = document.getElementById("list");
  if (list) list.textContent = "A carregar...";
  try {
    const [data] = await Promise.all([
      request(`/technicians${showInactive ? "?includeInactive=1" : ""}`),
      loadRiskSummary(),
    ]);
    TECHS = data.technicians || [];
    renderTechnicians();
  } catch (err) {
    console.error(err);
    if (list) list.innerHTML = `<div class="cw-empty">${escapeHtml(userError(err, "Nao foi possivel carregar os tecnicos."))}</div>`;
    ui.error(userError(err, "Nao foi possivel carregar os tecnicos."));
  }
}

async function createTechnician() {
  const body = {
    name: val("name"),
    email: val("email") || null,
    phone: val("phone") || null,
    pin: val("pin") || "1234",
    zone: val("zone") || null,
    vehicleId: val("vehicleId") || null,
    active: true,
    role: "TECHNICIAN",
  };
  if (!body.name) {
    ui.error("Indica o nome do tecnico para continuar.");
    return;
  }
  try {
    await request("/technicians", { method: "POST", body: JSON.stringify(body) });
    document.getElementById("technicianForm").reset();
    await loadTechnicians();
    ui.success("Tecnico criado com sucesso.");
  } catch (error) {
    ui.error(userError(error, "Nao foi possivel criar o tecnico."));
  }
}

async function payload(tech) {
  const name = await ui.prompt("Indica o nome do tecnico.", { title: "Editar tecnico", defaultValue: tech.name || "", confirmText: "Seguinte" });
  if (name === null) return null;
  const email = await ui.prompt("Indica o email (opcional).", { title: "Editar tecnico", defaultValue: tech.email || "", confirmText: "Seguinte" });
  if (email === null) return null;
  const phone = await ui.prompt("Indica o telefone (opcional).", { title: "Editar tecnico", defaultValue: tech.phone || "", confirmText: "Seguinte" });
  if (phone === null) return null;
  const zone = await ui.prompt("Indica a zona de operacao.", { title: "Editar tecnico", defaultValue: tech.zone || "", confirmText: "Seguinte" });
  if (zone === null) return null;
  const vehicleId = await ui.prompt("Indica o ID da viatura (opcional).", { title: "Editar tecnico", defaultValue: String(tech.vehicleId || ""), confirmText: "Guardar" });
  if (vehicleId === null) return null;
  return { name, email, phone, zone, vehicleId: vehicleId || null };
}

async function editTechnician(id) {
  const tech = TECHS.find((item) => Number(item.id) === Number(id));
  if (!tech) {
    ui.error("Tecnico nao encontrado.");
    return;
  }
  const body = await payload(tech);
  if (!body) return;
  try {
    await request(`/technicians/${id}`, { method: "PUT", body: JSON.stringify(body) });
    await loadTechnicians();
    ui.success("Tecnico atualizado com sucesso.");
  } catch (error) {
    ui.error(userError(error, "Nao foi possivel atualizar o tecnico."));
  }
}

async function resetPin(id) {
  const pin = await ui.prompt("Indica o novo PIN do tecnico.", { title: "Reset de PIN", defaultValue: "1234", confirmText: "Atualizar" });
  if (pin === null) return;
  try {
    await request(`/technicians/${id}`, { method: "PUT", body: JSON.stringify({ pin }) });
    await loadTechnicians();
    ui.success("PIN atualizado com sucesso.");
  } catch (error) {
    ui.error(userError(error, "Nao foi possivel atualizar o PIN."));
  }
}

async function toggleTechnician(id, active) {
  try {
    await request(`/technicians/${id}`, { method: "PUT", body: JSON.stringify({ active }) });
    await loadTechnicians();
  } catch (error) {
    ui.error(userError(error, "Nao foi possivel alterar o estado do tecnico."));
  }
}

async function restoreTechnician(id) {
  try {
    await request(`/technicians/${id}/restore`, { method: "POST" });
    await loadTechnicians();
  } catch (error) {
    ui.error(userError(error, "Nao foi possivel reativar o tecnico."));
  }
}

async function deleteTechnician(id) {
  const approved = await ui.confirm("Esta operacao elimina apenas quando for seguro; caso exista historico, o tecnico sera desativado para preservar dados. Queres continuar?", {
    title: "Confirmar eliminacao",
    confirmText: "Continuar",
    danger: true,
  });
  if (!approved) return;
  try {
    await request(`/technicians/${id}`, { method: "DELETE" });
    await loadTechnicians();
    ui.success("Operacao concluida no tecnico.");
  } catch (error) {
    ui.error(userError(error, "Nao foi possivel concluir a operacao no tecnico."));
  }
}

function toggleInactive() {
  showInactive = !showInactive;
  document.getElementById("toggleInactive").textContent = showInactive ? "Ocultar inativos" : "Ver inativos";
  loadTechnicians();
}

window.createTechnician = createTechnician;
window.editTechnician = editTechnician;
window.resetPin = resetPin;
window.toggleTechnician = toggleTechnician;
window.restoreTechnician = restoreTechnician;
window.deleteTechnician = deleteTechnician;
window.toggleInactive = toggleInactive;

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("technicianSearch")?.addEventListener("input", renderTechnicians);
  loadTechnicians();
});
