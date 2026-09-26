(function () {
  "use strict";

  if (window.__CW_OPERATIONAL_RISK__) return;
  window.__CW_OPERATIONAL_RISK__ = true;

  const path = String(location.pathname || "").replace(/\.html$/i, "").toLowerCase();
  const managedFleet = path === '/admin-vehicles';
  const fleetCurrent = () => !managedFleet || !!window.CWFleetPageSession?.isCurrent();
  let fleetRiskRead = 0;
  const clearFleetRisk = () => { {fleetRiskRead++;window.__CW_OPERATIONAL_RISK_SUMMARY__=null;document.getElementById('cwOperationalRiskPanel')?.remove();document.querySelectorAll('.cw-risk-inline-list,.cw-side-risk-count').forEach(el=>el.remove());document.querySelectorAll('.cw-side-risk,.cw-side-risk-critical,.cw-risk-card,.cw-risk-jump-target,.cw-risk-focus').forEach(el=>el.classList.remove('cw-side-risk','cw-side-risk-critical','cw-risk-card','cw-risk-jump-target','cw-risk-focus'));} };
  if(managedFleet){window.addEventListener('cw:fleet-session-ended',clearFleetRisk);window.addEventListener('cw:fleet-risk-unavailable',clearFleetRisk);window.addEventListener('pagehide',clearFleetRisk);window.addEventListener('cw:fleet-risk-ready',event=>{if(fleetCurrent()){clearFleetRisk();showRisk(event.detail,fleetRiskRead);}});}
  const isAdmin = path.includes("admin") || path.includes("billing") || path.includes("invoice") || path.includes("to-issue") || path.includes("dashboard");
  if (!isAdmin || ["/login", "/admin-login"].includes(path)) return;

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
    if(!fleetCurrent())throw Error('Session changed');
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if(!fleetCurrent())throw Error('Session changed');
    if (!response.ok || data.ok === false) throw new Error(data.error || data.message || "Erro");
    return data;
  }

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  async function loadSummary(){const summary=await api('/api/operational-risk/summary');if(!Array.isArray(summary.issues)||!summary.counts||!['total','critical','warning'].every(k=>Number.isSafeInteger(summary.counts[k])&&summary.counts[k]>=0))throw Error('Incomplete risk summary');return summary;}

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
    document.getElementById("cwOperationalRiskUnavailable")?.remove();
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

  function showRisk(summary, turn) {
    if(!fleetCurrent()||managedFleet&&turn!==fleetRiskRead)return;
    window.__CW_OPERATIONAL_RISK_SUMMARY__ = summary;
    renderGlobalPanel(summary);
    markSidebar(summary);
    markCurrentPage(summary);
    setTimeout(() => { if(fleetCurrent()&&(!managedFleet||turn===fleetRiskRead))markCurrentPage(summary); }, 800);
  }

  async function bootRisk() {
    setupRiskNavigation();
    const turn=++fleetRiskRead;
    let summary;try{summary=await loadSummary();if(managedFleet&&(!Array.isArray(summary.issues)||!summary.counts||!['total','critical','warning'].every(k=>Number.isSafeInteger(summary.counts[k])&&summary.counts[k]>=0)))throw Error('Incomplete risk summary');}catch(_){if(turn===fleetRiskRead){clearFleetRisk();if(!managedFleet&&!document.getElementById('cwOperationalRiskUnavailable')){const status=document.createElement('p');status.id='cwOperationalRiskUnavailable';status.setAttribute('role','status');status.textContent='Não foi possível confirmar os alertas operacionais. Atualize para voltar a tentar.';(document.querySelector('main')||document.body).prepend(status);}}return;}
    showRisk(summary,turn);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootRisk);
  else bootRisk();
})();
