(function () {
  "use strict";

  if (window.__CW_OPERATIONAL_RISK__) return;
  window.__CW_OPERATIONAL_RISK__ = true;

  const path = String(location.pathname || "").replace(/\.html$/i, "").toLowerCase();
  const isAdmin = path.includes("admin") || path.includes("billing") || path.includes("invoice") || path.includes("to-issue") || path.includes("dashboard");
  if (!isAdmin || ["/login", "/admin-login"].includes(path)) return;

  const DEFAULT_RULES = {
    overduePayments: true,
    missingTransportGuide: true,
    missingTransportGuideDocument: true,
    missingWorkGuide: true,
    vehicleInsuranceExpiring: true,
    vehicleInspectionExpiring: true,
    lowVehicleStock: true,
    technicianLinkedVehicleIssues: true,
    insuranceWarningDays: 30,
    inspectionWarningDays: 30,
    stockLowThreshold: 1,
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  async function api(url) {
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || data.message || "Erro");
    return data;
  }

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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

  function groupBy(items, key) {
    return items.reduce((acc, item) => {
      const value = item[key];
      if (value !== undefined && value !== null) {
        const mapKey = String(value);
        if (!acc[mapKey]) acc[mapKey] = [];
        acc[mapKey].push(item);
      }
      return acc;
    }, {});
  }

  function addIssue(issues, issue) {
    issues.push({
      id: issue.id || [issue.type, issue.vehicleId, issue.technicianId, issue.clientId, issue.targetId].filter(Boolean).join(":"),
      severity: issue.severity || "WARNING",
      type: issue.type || "RISK",
      module: issue.module || "Sistema",
      targetType: issue.targetType || null,
      targetId: issue.targetId == null ? null : Number(issue.targetId),
      vehicleId: issue.vehicleId == null ? null : Number(issue.vehicleId),
      technicianId: issue.technicianId == null ? null : Number(issue.technicianId),
      clientId: issue.clientId == null ? null : Number(issue.clientId),
      title: issue.title || "Atencao",
      message: issue.message || "",
      href: issue.href || "/admin-master-control",
      anchorText: issue.anchorText || "",
    });
  }

  function isInsurance(record) {
    return /seguro|apolice|apol/.test(normalize(`${record?.type || ""} ${record?.title || ""} ${record?.notes || ""}`));
  }

  function isInspection(record) {
    return /inspecao|inspec|ipo|vistoria/.test(normalize(`${record?.type || ""} ${record?.title || ""} ${record?.notes || ""}`));
  }

  function latest(records, vehicleId, predicate) {
    return records
      .filter((record) => Number(record.vehicleId) === Number(vehicleId) && predicate(record))
      .sort((a, b) => new Date(b.dueDate || b.createdAt || 0).getTime() - new Date(a.dueDate || a.createdAt || 0).getTime())[0] || null;
  }

  async function loadRules() {
    try {
      const data = await api("/api/settings/global/OPERATIONAL_RISK_RULES");
      return { ...DEFAULT_RULES, ...JSON.parse(data.value || "{}") };
    } catch (_) {
      return { ...DEFAULT_RULES };
    }
  }

  async function fallbackSummary() {
    const rules = await loadRules();
    const [vehiclesData, guidesData, worksData, maintenanceData, invoicesData] = await Promise.all([
      api("/api/guides/vehicles?active=all").catch(() => ({ vehicles: [] })),
      api("/api/guides/transport").catch(() => ({ guides: [] })),
      api("/api/guides/work").catch(() => ({ workGuides: [] })),
      api("/api/guides/maintenance").catch(() => ({ records: [] })),
      api("/api/invoices").catch(() => ({ invoices: [] })),
    ]);

    const vehicles = (vehiclesData.vehicles || []).filter((vehicle) => vehicle.active !== false);
    const guides = guidesData.guides || [];
    const works = worksData.workGuides || [];
    const maintenance = maintenanceData.records || [];
    const issues = [];

    vehicles.forEach((vehicle) => {
      const label = vehicle.plate || `Viatura ${vehicle.id}`;
      const techs = (vehicle.assignedTechnicians || []).filter((tech) => tech.active !== false);
      const activeGuide = guides.find((guide) => Number(guide.vehicleId) === Number(vehicle.id) && guide.status === "ACTIVE");
      const openWork = works.find((work) => Number(work.vehicleId) === Number(vehicle.id) && work.status === "OPEN");
      const vehicleIssues = [];

      if (rules.missingTransportGuide !== false) {
        if (openWork && !openWork.guideId) {
          vehicleIssues.push({
            type: "MISSING_TRANSPORT_GUIDE",
            severity: "CRITICAL",
            module: "Viaturas e Guias",
            targetType: "WorkGuide",
            targetId: openWork.id,
            vehicleId: vehicle.id,
            technicianId: openWork.technicianId,
            title: "Guia AT em falta",
            message: `${label}: guia de obra #${openWork.id} esta provisoria sem guia AT.`,
            href: "/admin-vehicles",
            anchorText: label,
          });
        } else if (techs.length && !activeGuide) {
          vehicleIssues.push({
            type: "MISSING_TRANSPORT_GUIDE",
            severity: "CRITICAL",
            module: "Viaturas e Guias",
            targetType: "Vehicle",
            targetId: vehicle.id,
            vehicleId: vehicle.id,
            title: "Sem guia AT ativa",
            message: `${label}: viatura com tecnico associado sem guia AT ativa.`,
            href: "/admin-vehicles",
            anchorText: label,
          });
        }
      }

      if (rules.missingTransportGuideDocument !== false && activeGuide && !activeGuide.officialDocument?.url) {
        vehicleIssues.push({
          type: "MISSING_TRANSPORT_GUIDE_DOCUMENT",
          severity: "WARNING",
          module: "Viaturas e Guias",
          targetType: "TransportGuide",
          targetId: activeGuide.id,
          vehicleId: vehicle.id,
          title: "Ficheiro AT oficial em falta",
          message: `${label}: guia ${activeGuide.codeAT || `#${activeGuide.id}`} sem ficheiro oficial anexado.`,
          href: "/admin-vehicles",
          anchorText: label,
        });
      }

      if (rules.missingWorkGuide !== false && (activeGuide || techs.length) && !openWork) {
        vehicleIssues.push({
          type: "MISSING_WORK_GUIDE",
          severity: "WARNING",
          module: "Viaturas e Guias",
          targetType: "Vehicle",
          targetId: vehicle.id,
          vehicleId: vehicle.id,
          title: "Guia de obra em falta",
          message: `${label}: sem guia de obra aberta para a operacao atual.`,
          href: "/admin-vehicles",
          anchorText: label,
        });
      }

      if (rules.vehicleInsuranceExpiring !== false) {
        const insurance = latest(maintenance, vehicle.id, isInsurance);
        const left = daysUntil(insurance?.dueDate);
        if (!insurance) vehicleIssues.push({ type: "VEHICLE_INSURANCE_MISSING", severity: "CRITICAL", module: "Viaturas e Guias", targetType: "Vehicle", targetId: vehicle.id, vehicleId: vehicle.id, title: "Seguro nao registado", message: `${label}: seguro nao registado.`, href: "/admin-vehicles", anchorText: label });
        else if (left !== null && left < 0) vehicleIssues.push({ type: "VEHICLE_INSURANCE_OVERDUE", severity: "CRITICAL", module: "Viaturas e Guias", targetType: "Vehicle", targetId: vehicle.id, vehicleId: vehicle.id, title: "Seguro expirado", message: `${label}: seguro expirado.`, href: "/admin-vehicles", anchorText: label });
        else if (left !== null && left <= Number(rules.insuranceWarningDays || 30)) vehicleIssues.push({ type: "VEHICLE_INSURANCE_EXPIRING", severity: "WARNING", module: "Viaturas e Guias", targetType: "Vehicle", targetId: vehicle.id, vehicleId: vehicle.id, title: "Seguro a acabar", message: `${label}: seguro a acabar em ${left} dia(s).`, href: "/admin-vehicles", anchorText: label });
      }

      if (rules.vehicleInspectionExpiring !== false) {
        const inspection = latest(maintenance, vehicle.id, isInspection);
        const left = daysUntil(inspection?.dueDate);
        if (!inspection) vehicleIssues.push({ type: "VEHICLE_INSPECTION_MISSING", severity: "WARNING", module: "Viaturas e Guias", targetType: "Vehicle", targetId: vehicle.id, vehicleId: vehicle.id, title: "Inspecao nao registada", message: `${label}: inspecao/IPO nao registada.`, href: "/admin-vehicles", anchorText: label });
        else if (left !== null && left < 0) vehicleIssues.push({ type: "VEHICLE_INSPECTION_OVERDUE", severity: "CRITICAL", module: "Viaturas e Guias", targetType: "Vehicle", targetId: vehicle.id, vehicleId: vehicle.id, title: "Inspecao vencida", message: `${label}: inspecao vencida.`, href: "/admin-vehicles", anchorText: label });
        else if (left !== null && left <= Number(rules.inspectionWarningDays || 30)) vehicleIssues.push({ type: "VEHICLE_INSPECTION_EXPIRING", severity: "WARNING", module: "Viaturas e Guias", targetType: "Vehicle", targetId: vehicle.id, vehicleId: vehicle.id, title: "Inspecao a acabar", message: `${label}: inspecao a acabar em ${left} dia(s).`, href: "/admin-vehicles", anchorText: label });
      }

      if (rules.lowVehicleStock !== false && openWork) {
        const lowItems = (openWork.items || []).filter((item) => Number(item.quantity || 0) <= Number(rules.stockLowThreshold || 1));
        if (!(openWork.items || []).length || lowItems.length) {
          const names = lowItems.slice(0, 4).map((item) => `${item.name} (${item.quantity} ${item.unit || "UN"})`).join(", ");
          vehicleIssues.push({
            type: "VEHICLE_STOCK_LOW",
            severity: lowItems.some((item) => Number(item.quantity || 0) <= 0) ? "CRITICAL" : "WARNING",
            module: "Viaturas e Guias",
            targetType: "WorkGuide",
            targetId: openWork.id,
            vehicleId: vehicle.id,
            technicianId: openWork.technicianId,
            title: "Material baixo/em falta",
            message: names ? `${label}: material baixo/em falta - ${names}.` : `${label}: guia de obra aberta sem material carregado.`,
            href: "/admin-vehicles",
            anchorText: label,
          });
        }
      }

      vehicleIssues.forEach((issue) => addIssue(issues, issue));
      if (rules.technicianLinkedVehicleIssues !== false) {
        techs.forEach((tech) => vehicleIssues.forEach((issue) => addIssue(issues, {
          ...issue,
          id: `TECH:${issue.type}:${vehicle.id}:${tech.id}`,
          targetType: "Technician",
          targetId: tech.id,
          technicianId: tech.id,
          module: "Tecnicos",
          title: `Tecnico com viatura em alerta`,
          message: `${tech.name || `Tecnico ${tech.id}`}: ${issue.message}`,
          href: "/admin-technicians",
          anchorText: tech.name || "",
        })));
      }
    });

    const invoices = invoicesData.invoices || invoicesData.data || [];
    invoices.forEach((invoice) => {
      const open = Number(invoice.amountOpen || invoice.totalOpen || invoice.openAmount || 0);
      const overdue = String(invoice.status || "").toUpperCase().includes("OVERDUE") || String(invoice.status || "").toUpperCase().includes("ATRAS") || (invoice.dueDate && new Date(invoice.dueDate) < new Date());
      if (rules.overduePayments !== false && open > 0 && overdue) {
        addIssue(issues, {
          type: "OVERDUE_PAYMENT",
          severity: "CRITICAL",
          module: "Financeiro",
          targetType: "Client",
          targetId: invoice.clientId || invoice.client?.id,
          clientId: invoice.clientId || invoice.client?.id,
          title: "Pagamento em atraso",
          message: `${invoice.client?.name || `Cliente ${invoice.clientId || ""}`}: ${open.toFixed(2)} EUR em aberto.`,
          href: "/invoices",
          anchorText: invoice.client?.name || "",
        });
      }
    });

    return {
      ok: true,
      rules,
      issues,
      counts: {
        total: issues.length,
        critical: issues.filter((issue) => issue.severity === "CRITICAL").length,
        warning: issues.filter((issue) => issue.severity !== "CRITICAL").length,
      },
      byVehicleId: groupBy(issues, "vehicleId"),
      byTechnicianId: groupBy(issues, "technicianId"),
      byClientId: groupBy(issues, "clientId"),
    };
  }

  async function loadSummary() {
    try {
      return await api("/api/operational-risk/summary");
    } catch (_) {
      return fallbackSummary();
    }
  }

  function issueTooltip(issue) {
    return `${issue.title}: ${issue.message}`;
  }

  function moduleHref(moduleName) {
    if (moduleName === "Viaturas e Guias") return "/admin-vehicles";
    if (moduleName === "Financeiro") return "/invoices";
    if (moduleName === "Tecnicos") return "/admin-technicians";
    return "/admin-master-control";
  }

  function issueActionHref(issue) {
    const targetType = String(issue?.targetType || "");
    if (["Vehicle", "TransportGuide", "WorkGuide"].includes(targetType)) return "/admin-vehicles";
    if (targetType === "Technician" && issue?.vehicleId) return "/admin-vehicles";
    if (targetType === "Client" && issue?.clientId) return "/admin-clients";
    if (issue?.module === "Financeiro") return "/invoices";
    return issue?.href || moduleHref(issue?.module);
  }

  function issueAnchor(issue) {
    const message = cleanAnchor(issue?.message);
    return issue?.anchorText || message || issue?.title || "";
  }

  function inferredRiskType(issue) {
    const current = String(issue?.type || "");
    if (current && current !== "TECHNICIAN_LINKED_VEHICLE_RISK") return current;
    const text = normalize(`${issue?.title || ""} ${issue?.message || ""}`);
    if (text.includes("ficheiro") && text.includes("at")) return "MISSING_TRANSPORT_GUIDE_DOCUMENT";
    if ((text.includes("guia at") || text.includes("transporte at")) && text.includes("falta")) return "MISSING_TRANSPORT_GUIDE";
    if (text.includes("guia de obra")) return "MISSING_WORK_GUIDE";
    if (text.includes("material") || text.includes("stock")) return "VEHICLE_STOCK_LOW";
    return current || "";
  }

  function cleanAnchor(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.split(":")[0].trim();
  }

  function issueTargetPayload(issue) {
    return {
      targetType: issue?.targetType || "",
      targetId: issue?.targetId ?? null,
      vehicleId: issue?.vehicleId ?? null,
      technicianId: issue?.technicianId ?? null,
      clientId: issue?.clientId ?? null,
      type: inferredRiskType(issue),
      anchor: issueAnchor(issue),
    };
  }

  function riskLinkAttrs(issue) {
    return [
      `href="${esc(issueActionHref(issue))}"`,
      `data-cw-risk-link="1"`,
      `data-risk-target="${esc(JSON.stringify(issueTargetPayload(issue)))}"`,
      `data-anchor="${esc(issueAnchor(issue))}"`,
      `title="${esc(issueTooltip(issue))}"`,
      `onclick="try{sessionStorage.setItem('cw:risk-target',this.dataset.riskTarget||'');sessionStorage.setItem('cw:risk-anchor',this.dataset.anchor||'');}catch(_){}"`,
    ].join(" ");
  }

  function attrSelector(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function samePageHref(href) {
    try {
      const url = new URL(href, location.origin);
      return url.pathname.replace(/\.html$/i, "").toLowerCase() === path;
    } catch (_) {
      return false;
    }
  }

  function focusRiskTarget(target = {}) {
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
    if (target.targetType === "TransportGuide" && target.targetId != null) selectors.push(`[data-risk-transport-guide-id="${attrSelector(target.targetId)}"]`);
    if (target.targetType === "WorkGuide" && target.targetId != null) selectors.push(`[data-risk-work-guide-id="${attrSelector(target.targetId)}"]`);
    if (target.vehicleId != null) selectors.push(`[data-risk-vehicle-id="${attrSelector(target.vehicleId)}"]`);
    if (target.technicianId != null) selectors.push(`[data-risk-technician-id="${attrSelector(target.technicianId)}"]`);
    if (target.clientId != null) selectors.push(`[data-risk-client-id="${attrSelector(target.clientId)}"]`);

    let node = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
    if (!node && target.anchor) {
      const needle = normalize(target.anchor).slice(0, 24);
      node = Array.from(document.querySelectorAll(".cw-risk-jump-target,.card,.tech-row,.invoice-card,article"))
        .find((item) => normalize(item.innerText || "").includes(needle));
    }
    if (!node) return false;
    node.classList.add("cw-risk-focus");
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => node.classList.remove("cw-risk-focus"), 3500);
    return true;
  }

  function focusRiskTargetWhenReady(target = {}, attempts = 10) {
    let tries = 0;
    const run = () => {
      if (focusRiskTarget(target) || tries >= attempts) {
        sessionStorage.removeItem("cw:risk-target");
        sessionStorage.removeItem("cw:risk-anchor");
        return;
      }
      tries += 1;
      setTimeout(run, 350);
    };
    run();
  }

  function readRiskTarget(raw) {
    try {
      return JSON.parse(raw || "{}") || {};
    } catch (_) {
      return { anchor: raw || "" };
    }
  }

  function setupRiskNavigation() {
    if (window.__CW_RISK_NAVIGATION__) return;
    window.__CW_RISK_NAVIGATION__ = true;
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("[data-cw-risk-link]");
      if (!link) return;
      const target = readRiskTarget(link.getAttribute("data-risk-target"));
      const anchor = link.getAttribute("data-anchor") || target.anchor || "";
      if (anchor) sessionStorage.setItem("cw:risk-anchor", anchor);
      sessionStorage.setItem("cw:risk-target", JSON.stringify({ ...target, anchor }));
      if (samePageHref(link.getAttribute("href") || "")) {
        event.preventDefault();
        focusRiskTargetWhenReady({ ...target, anchor }, 8);
      }
    }, true);
  }

  function focusStoredRiskTarget() {
    const rawTarget = sessionStorage.getItem("cw:risk-target");
    const anchor = sessionStorage.getItem("cw:risk-anchor");
    if (!rawTarget && !anchor) return;
    const target = readRiskTarget(rawTarget);
    if (anchor && !target.anchor) target.anchor = anchor;
    focusRiskTargetWhenReady(target, 12);
  }

  function renderGlobalPanel(summary) {
    const issues = summary.issues || [];
    const critical = issues.filter((issue) => issue.severity === "CRITICAL");
    const topIssues = (critical.length ? critical : issues).slice(0, 8);
    const existing = document.getElementById("cwOperationalRiskPanel");
    if (!issues.length) {
      existing?.remove();
      return;
    }

    const modules = Array.from(new Set(issues.map((issue) => issue.module || "Sistema")));
    const html = `
      <section id="cwOperationalRiskPanel" class="cw-risk-global ${critical.length ? "critical" : "warning"}" aria-live="polite">
        <div class="cw-risk-global-head">
          <div>
            <strong>${critical.length ? "Intervencao necessaria" : "Avisos operacionais"}</strong>
            <span>${issues.length} ponto(s) a rever - ${critical.length} critico(s)</span>
          </div>
          <div class="cw-risk-global-actions">
            ${modules.map((moduleName) => `<a href="${esc(moduleHref(moduleName))}">${esc(moduleName)}</a>`).join("")}
            <button type="button" data-cw-risk-toggle>${existing?.classList.contains("is-open") ? "Fechar" : "Detalhes"}</button>
          </div>
        </div>
        <div class="cw-risk-global-list">
          ${topIssues.map((issue) => `
            <a class="cw-risk-global-item" ${riskLinkAttrs(issue)}>
              <span class="${issue.severity === "CRITICAL" ? "dot critical" : "dot warning"}"></span>
              <b>${esc(issue.title)}</b>
              <small>${esc(issue.message)}</small>
            </a>
          `).join("")}
        </div>
      </section>
    `;

    if (existing) existing.outerHTML = html;
    else {
      const target = document.querySelector("main") || document.body;
      target.insertAdjacentHTML("afterbegin", html);
    }

    const panel = document.getElementById("cwOperationalRiskPanel");
    panel?.querySelector("[data-cw-risk-toggle]")?.addEventListener("click", () => {
      panel.classList.toggle("is-open");
      panel.querySelector("[data-cw-risk-toggle]").textContent = panel.classList.contains("is-open") ? "Fechar" : "Detalhes";
    });
  }

  function markSidebar(summary) {
    const issues = summary.issues || [];
    const byHref = new Map();
    issues.forEach((issue) => {
      const href = moduleHref(issue.module);
      const current = byHref.get(href) || { total: 0, critical: 0 };
      current.total += 1;
      if (issue.severity === "CRITICAL") current.critical += 1;
      byHref.set(href, current);
    });

    document.querySelectorAll(".cw-side a").forEach((link) => {
      const href = link.getAttribute("href")?.replace(/\.html$/i, "") || "";
      const data = byHref.get(href);
      link.querySelector(".cw-side-risk-count")?.remove();
      link.classList.toggle("cw-side-risk", Boolean(data));
      link.classList.toggle("cw-side-risk-critical", Boolean(data?.critical));
      if (data) link.insertAdjacentHTML("beforeend", `<em class="cw-side-risk-count">${data.critical || data.total}</em>`);
    });
  }

  function cardMatches(card, issue) {
    const text = normalize(card.innerText || "");
    const anchors = [issue.anchorText, issue.message, issue.title]
      .filter(Boolean)
      .map((value) => normalize(value));
    return anchors.some((anchor) => anchor && text.includes(anchor.split(":")[0].slice(0, 28)));
  }

  function markCurrentPage(summary) {
    const issues = summary.issues || [];
    if (!issues.length) return;

    const relevant = issues.filter((issue) => {
      if (path === "/admin-vehicles") return issue.module === "Viaturas e Guias" && issue.targetType !== "Technician";
      if (path === "/admin-technicians") return issue.targetType === "Technician";
      if (path === "/invoices" || path === "/billing") return issue.module === "Financeiro";
      return false;
    });
    if (!relevant.length) return;

    document.querySelectorAll(".card,.tech-row,.invoice-card,article").forEach((card) => {
      const matches = relevant.filter((issue) => cardMatches(card, issue));
      if (!matches.length) return;
      card.classList.add("cw-risk-card", "cw-risk-jump-target");
      if (!card.querySelector(".cw-risk-inline-list") && !card.querySelector(".cw-risk-badge")) {
        card.insertAdjacentHTML("afterbegin", `
          <div class="cw-risk-inline-list">
            ${matches.slice(0, 3).map((issue) => `<a class="cw-risk-badge" ${riskLinkAttrs(issue)} data-severity="${esc(issue.severity)}" data-risk-tip="${esc(issueTooltip(issue))}">${issue.severity === "CRITICAL" ? "Erro" : "Aviso"}: ${esc(issue.title)}</a>`).join("")}
          </div>
        `);
      }
    });

    focusStoredRiskTarget();
  }

  async function bootRisk() {
    setupRiskNavigation();
    const summary = await loadSummary();
    window.__CW_OPERATIONAL_RISK_SUMMARY__ = summary;
    renderGlobalPanel(summary);
    markSidebar(summary);
    markCurrentPage(summary);
    setTimeout(() => markCurrentPage(summary), 800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootRisk);
  else bootRisk();
})();
