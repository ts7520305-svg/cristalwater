const API =
  "/api";

// ======================================================
// AUTH
// ======================================================

const adminToken =
  localStorage.getItem("token");

const adminUser =
  JSON.parse(
    localStorage.getItem("user") || "{}"
  );

// ======================================================
// SOCKET
// ======================================================

const adminSocket =
  io();

// ======================================================
// STATE
// ======================================================

let liveMap = null;

let liveMarkers = [];

let productivityChart = null;

let billingChart = null;

let timelineItems = [];

let onlineClientsCount = 0;

let onlineTechniciansCount = 0;

// ======================================================
// HELPERS
// ======================================================

function adminLogout(){

  localStorage.removeItem("token");

  localStorage.removeItem("user");

  window.location.href =
    "/login";
}

function getAuthHeaders(){

  return {
    Authorization:
      `Bearer ${adminToken}`
  };
}

function escapeHtml(value){

  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function formatMoney(value){

  return `€ ${Number(value || 0).toFixed(2)}`;
}

function setText(id,value){

  const el =
    document.getElementById(id);

  if(el){

    el.textContent =
      value;
  }
}

function setStatus(message){

  setText(
    "status",
    message
  );
}

function getCurrentMonthRef(){

  const now =
    new Date();

  const y =
    now.getFullYear();

  const m =
    String(now.getMonth() + 1)
      .padStart(2,"0");

  return `${y}-${m}`;
}

function clamp(value){

  const n =
    Number(value || 0);

  if(n < 0) return 0;

  if(n > 100) return 100;

  return Math.round(n);
}

// ======================================================
// TIMELINE
// ======================================================

function addTimeline(title,message){

  timelineItems.unshift({

    title,

    message,

    createdAt:new Date()
  });

  timelineItems =
    timelineItems.slice(0,20);

  renderTimeline();
}

function renderTimeline(){

  const box =
    document.getElementById("timelineFeed");

  if(!box) return;

  if(!timelineItems.length){

    box.innerHTML = `
      <div class="timeline-item">
        <b>Sistema iniciado</b>
        <div>Resumo Operacional ativo.</div>
        <div class="timeline-time">
          ${new Date().toLocaleString("pt-PT")}
        </div>
      </div>
    `;

    return;
  }

  box.innerHTML =
    timelineItems.map(item => `

      <div class="timeline-item">

        <b>${escapeHtml(item.title)}</b>

        <div>
          ${escapeHtml(item.message)}
        </div>

        <div class="timeline-time">
          ${
            new Date(item.createdAt)
              .toLocaleString("pt-PT")
          }
        </div>

      </div>

    `).join("");
}

// ======================================================
// LOAD DASHBOARD
// ======================================================

async function loadDashboard(){

  const monthRef =
    document.getElementById("monthRef")?.value ||
    getCurrentMonthRef();

  setStatus("A carregar inteligência operacional...");

  try {

    const res =
      await fetch(
        `${API}/dashboard/admin?monthRef=${encodeURIComponent(monthRef)}`,
        {
          headers:
            getAuthHeaders()
        }
      );

    if(res.status === 401 || res.status === 403){

      adminLogout();

      return;
    }

    const data =
      await res.json();

    if(!res.ok){

      console.error(data);

      setStatus("Erro ao carregar");

      return;
    }

    renderOperationalIntelligence(data);

    setStatus("Resumo Operacional online");

  } catch(err){

    console.error(err);

    setStatus("Erro ligação");
  }
}

// ======================================================
// OPERATIONAL INTELLIGENCE
// ======================================================

function renderOperationalIntelligence(data = {}){

  const summary =
    data.summary || {};

  const ai =
    data.aiAnalysis || {};

  const predictive =
    data.predictiveAnalysis || {};

  const totalPaid =
    Number(
      summary.totalPaid ||
      summary.monthPaid ||
      summary.totalPaidAll ||
      0
    );

  const totalOpen =
    Number(
      summary.totalOpen ||
      summary.monthOpen ||
      summary.totalOpenAll ||
      0
    );

  const monthBilled =
    Number(summary.monthBilled || summary.totalBilledAll || 0);

  const monthPaid =
    Number(summary.monthPaid || summary.totalPaidAll || 0);

  const monthOpen =
    Number(summary.monthOpen || summary.totalOpenAll || totalOpen || 0);

  const pending =
    Number(summary.pendingInvoices || 0);

  const partial =
    Number(summary.partialInvoices || 0);

  const overloaded =
    (ai.overloadedTechs || []).length;

  const criticalZones =
    (ai.criticalZones || []).length;

  const openAlerts =
    Number(
      summary.openAlerts ||
      (
        Array.isArray(data.alerts)
          ? data.alerts.length
          : 0
      )
    );

  const aiAlertSignals =
    (ai.alerts || []).length;

  const tomorrowRisk =
    (predictive.tomorrowRiskZones || []).length;

  const visitsTotal =
    Number(summary.visitsThisMonth || 0);

  const visitsDone =
    Number(summary.visitsDoneThisMonth || 0);

  const visitsNotDone =
    Number(summary.visitsNotDoneThisMonth || 0);

  const totalPools =
    Number(summary.totalPools || 0);

  const totalInvoices =
    Number(summary.totalInvoices || 0);

  const totalInvoicesAll =
    Number(summary.totalInvoicesAll || totalInvoices || 0);

  const overdueInvoices =
    Number(summary.overdueInvoices || summary.openInvoicesAll || 0);

  const overdueClients =
    Number(summary.overdueClients || 0);

  const overdueAmount =
    Number(summary.overdueAmount || summary.totalOpenAll || totalOpen || 0);

  const officialInvoiceClients =
    Number(summary.officialInvoiceClients || 0);

  const officialInvoicePending =
    Number(summary.officialInvoicePending || 0);

  const officialInvoicePendingAmount =
    Number(summary.officialInvoicePendingAmount || 0);

  const technicianCount =
    Array.isArray(data.technicians)
      ? data.technicians.length
      : Number(summary.totalTechnicians || 0);

  const completionRate =
    visitsTotal > 0
      ? (visitsDone / visitsTotal) * 100
      : 100;

  const failurePressure =
    visitsTotal > 0
      ? Math.min((visitsNotDone / visitsTotal) * 200, 20)
      : 0;

  const alertPressure =
    totalPools > 0
      ? Math.min((openAlerts / totalPools) * 250, 35)
      : Math.min(openAlerts * 2, 35);

  const overloadPressure =
    technicianCount > 0
      ? Math.min((overloaded / technicianCount) * 35, 35)
      : Math.min(overloaded * 5, 25);

  const zonePressure =
    Math.min(
      criticalZones * 1.5 +
      tomorrowRisk * 1.5 +
      aiAlertSignals * 4,
      24
    );

  const operationsScore =
    clamp(
      completionRate -
      failurePressure -
      alertPressure -
      overloadPressure -
      zonePressure
    );

  const collectionRate =
    monthBilled > 0
      ? (monthPaid / monthBilled) * 100
      : 100;

  const openRatio =
    monthBilled > 0
      ? (monthOpen / monthBilled) * 100
      : 0;

  const invoiceRisk =
    totalInvoices > 0
      ? ((pending + partial) / totalInvoices) * 100
      : 0;

  const financialScore =
    clamp(
      collectionRate -
      openRatio * 0.8 -
      invoiceRisk * 0.5
    );

  const efficiency =
    operationsScore;

  const estimatedProfit =
    totalPaid -
    Number(summary.operationalCost || 0);

  const criticalAlerts =
    openAlerts;

  setText("operationsScore", operationsScore);
  setText("financialScore", financialScore);
  setText("criticalAlerts", criticalAlerts);
  setText("efficiencyRate", `${efficiency}%`);
  setText("estimatedProfit", formatMoney(estimatedProfit));

  renderAdminRoleDashboard({
    operationsScore,
    financialScore,
    visitsTotal,
    visitsDone,
    visitsNotDone,
    openAlerts,
    technicianCount,
    overloaded,
    criticalZones,
    tomorrowRisk,
    pending,
    partial,
    monthOpen,
    totalOpen,
    totalInvoicesAll,
    totalBilledAll:Number(summary.totalBilledAll || monthBilled || 0),
    overdueInvoices,
    overdueClients,
    overdueAmount,
    officialInvoiceClients,
    officialInvoicePending,
    officialInvoicePendingAmount
  });

  renderAIState({
    operationsScore,
    financialScore,
    criticalAlerts
  });

  renderCriticalBanner({
    operationsScore,
    financialScore,
    criticalAlerts,
    overloaded,
    criticalZones,
    tomorrowRisk,
    openAlerts,
    visitsNotDone,
    pending,
    partial,
    monthOpen,
    totalOpen,
    overdueInvoices,
    overdueClients,
    overdueAmount
  });

  renderIntelligencePanel({
    summary,
    ai,
    predictive,
    operationsScore,
    financialScore,
    criticalAlerts,
    estimatedProfit,
    openAlerts
  });

  renderCharts(
    operationsScore,
    financialScore,
    {
      summary,
      operationsScore,
      financialScore,
      criticalAlerts,
      visitsTotal,
      visitsDone,
      visitsNotDone,
      monthBilled,
      monthPaid,
      monthOpen,
      pending,
      partial,
      totalInvoices,
      totalInvoicesAll,
      overdueInvoices,
      overdueClients,
      overdueAmount,
      officialInvoiceClients,
      officialInvoicePending,
      officialInvoicePendingAmount
    }
  );
}

// ======================================================
// AI STATE
// ======================================================

function renderAIState(info){

  const dot =
    document.getElementById("aiDot");

  const text =
    document.getElementById("aiStateText");

  if(!dot || !text) return;

  dot.classList.remove(
    "ai-green",
    "ai-orange",
    "ai-red"
  );

  if(
    info.operationsScore < 50 ||
    info.financialScore < 50 ||
    info.criticalAlerts >= 5
  ){

    dot.classList.add("ai-red");

    text.textContent =
      "Sistema em estado crítico";

    return;
  }

  if(
    info.operationsScore < 75 ||
    info.financialScore < 75 ||
    info.criticalAlerts > 0
  ){

    dot.classList.add("ai-orange");

    text.textContent =
      "Sistema sob atenção";

    return;
  }

  dot.classList.add("ai-green");

  text.textContent =
    "Sistema estável";
}

// ======================================================
// ROLE DASHBOARD
// ======================================================

function renderAdminRoleDashboard(info){

  const box =
    document.getElementById("adminRoleDashboard");

  if(!box) return;

  const alertCount =
    Number(info.openAlerts || 0);

  const failedVisits =
    Number(info.visitsNotDone || 0);

  const financeOpen =
    Number(info.totalOpen || info.monthOpen || 0);

  const invoiceRisk =
    Number(info.pending || 0) +
    Number(info.partial || 0);

  const totalInvoices =
    Number(info.totalInvoicesAll || 0);

  const overdueInvoices =
    Number(info.overdueInvoices || 0);

  const overdueClients =
    Number(info.overdueClients || 0);

  const overdueAmount =
    Number(info.overdueAmount || financeOpen || 0);

  const officialInvoiceClients =
    Number(info.officialInvoiceClients || 0);

  const officialInvoicePending =
    Number(info.officialInvoicePending || 0);

  const officialInvoicePendingAmount =
    Number(info.officialInvoicePendingAmount || 0);

  const fieldSignals =
    Number(info.overloaded || 0) +
    Number(info.criticalZones || 0) +
    Number(info.tomorrowRisk || 0);

  const pulse =
    alertCount > 0 || failedVisits > 0 || financeOpen > 0
      ? "Prioridades ativas"
      : "Operacao limpa";

  const cards = [
    {
      label:"Hoje em campo",
      value:`${Number(info.visitsDone || 0)} / ${Number(info.visitsTotal || 0)}`,
      text:failedVisits > 0
        ? `${failedVisits} visita(s) com problema ou atraso`
        : "Execucao diaria sem falhas graves",
      href:"/admin-visits",
      tone:failedVisits > 0 ? "warn" : "ok"
    },
    {
      label:"Alertas criticos",
      value:String(alertCount),
      text:alertCount > 0
        ? "Abrir triagem de problemas e reparacoes"
        : "Sem alertas abertos relevantes",
      href:alertCount > 0 ? "/admin-alerts?priority=CRITICAL" : "/admin-alerts",
      tone:alertCount >= 5 ? "bad" : alertCount > 0 ? "warn" : "ok"
    },
    {
      label:"Equipa e rondas",
      value:String(Number(info.technicianCount || 0)),
      text:fieldSignals > 0
        ? `${fieldSignals} sinal(is) para redistribuir ou acompanhar`
        : "Tecnicos e zonas sem pressao operacional",
      href:"/admin-rounds",
      tone:fieldSignals > 0 ? "warn" : "ok"
    },
    {
      label:"Total faturas",
      value:String(totalInvoices),
      text:`Faturado total: ${formatMoney(info.totalBilledAll || 0)}`,
      href:"/invoices",
      tone:totalInvoices > 0 ? "ok" : "warn"
    },
    {
      label:"Fatura real",
      value:String(officialInvoicePending),
      text:officialInvoicePending > 0
        ? `${officialInvoiceClients} cliente(s) · ${formatMoney(officialInvoicePendingAmount)} por emitir`
        : `${officialInvoiceClients} cliente(s) com fatura oficial`,
      href:officialInvoicePending > 0 ? "/to-issue?status=pending" : "/to-issue?status=all",
      tone:officialInvoicePending > 0 ? "warn" : "ok"
    },
    {
      label:"Em atraso",
      value:formatMoney(overdueAmount),
      text:overdueInvoices > 0
        ? `${overdueClients} devedor(es) · ${overdueInvoices} fatura(s)`
        : "Sem valores em aberto",
      href:"/invoices?status=overdue",
      tone:overdueAmount > 0 || invoiceRisk > 0 ? "bad" : "ok"
    }
  ];

  const actions = [
    {
      label:"Entrada guiada",
      hint:"Novo cliente com piscina, ficha tecnica, ronda e visita",
      href:"/admin-onboarding.html"
    },
    {
      label:"Planear / arrastar rondas",
      hint:"Rever carga dos tecnicos e visitas extra",
      href:"/admin-rounds"
    },
    {
      label:"Abrir mapa live",
      hint:"Ver tecnicos, GPS e zonas com pressao",
      href:"/admin-live-map"
    },
    {
      label:"Triar cobrancas",
      hint:"Mensalidades, extras e faturas em aberto",
      href:"/billing"
    }
  ];

  box.innerHTML = `
    <div class="role-dashboard-head">
      <div>
        <h2>Command Center do administrador</h2>
        <p>Decisao rapida por prioridade: operacao, equipa, alertas e financeiro.</p>
      </div>
      <span class="role-pulse">${escapeHtml(pulse)}</span>
    </div>
    <div class="role-grid">
      ${cards.map((card) => `
        <a class="role-card ${escapeHtml(card.tone)}" href="${escapeHtml(card.href)}">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <small>${escapeHtml(card.text)}</small>
        </a>
      `).join("")}
    </div>
    <div class="role-actions">
      ${actions.map((action) => `
        <a class="role-action" href="${escapeHtml(action.href)}">
          ${escapeHtml(action.label)}
          <span>${escapeHtml(action.hint)}</span>
        </a>
      `).join("")}
    </div>
  `;
}

// ======================================================
// CRITICAL BANNER
// ======================================================

function renderCriticalBanner(info){

  const banner =
    document.getElementById("criticalBanner");

  const text =
    document.getElementById("criticalBannerText");

  const actions =
    document.getElementById("criticalBannerActions");

  if(!banner || !text) return;

  const isCritical =
    info.operationsScore < 50 ||
    info.financialScore < 50 ||
    info.criticalAlerts >= 5;

  const alertCount =
    Number(info.criticalAlerts || info.openAlerts || 0);

  const failedVisits =
    Number(info.visitsNotDone || 0);

  const financeCount =
    Number(info.pending || 0) +
    Number(info.partial || 0);

  const financeOpen =
    Number(info.totalOpen || info.monthOpen || 0);

  const mapSignals =
    Number(info.overloaded || 0) +
    Number(info.criticalZones || 0) +
    Number(info.tomorrowRisk || 0);

  const links = [];

  if(alertCount > 0){
    links.push({
      href:"/admin-alerts?priority=CRITICAL",
      label:`Alertas criticos (${alertCount})`
    });
  }

  if(failedVisits > 0){
    links.push({
      href:"/admin-alerts?source=visit",
      label:`Visitas com problema (${failedVisits})`
    });
  }

  if(info.financialScore < 75 || financeCount > 0 || financeOpen > 0){
    links.push({
      href:financeOpen > 0 ? "/invoices?status=overdue" : "/invoices",
      label:financeCount > 0
        ? `Financeiro (${financeCount})`
        : "Financeiro"
    });
  }

  if(info.operationsScore < 75 || mapSignals > 0){
    links.push({
      href:"/admin-live-map",
      label:mapSignals > 0
        ? `Mapa / tecnicos (${mapSignals})`
        : "Mapa / tecnicos"
    });
  }

  if(!links.length){
    links.push({
      href:"/admin-alerts",
      label:"Abrir situacoes"
    });
  }

  if(isCritical){

    banner.style.display =
      "block";

    const defaultHref =
      links[0].href;

    banner.setAttribute("role","button");
    banner.setAttribute("tabindex","0");
    banner.setAttribute("title","Abrir situacoes criticas");
    banner.onclick = (event) => {
      if(event.target.closest("a,button")) return;
      window.location.href = defaultHref;
    };
    banner.onkeydown = (event) => {
      if(event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      window.location.href = defaultHref;
    };

    if(actions){
      actions.innerHTML = links.map((link) => `
        <a class="critical-link" href="${escapeHtml(link.href)}">
          ${escapeHtml(link.label)}
        </a>
      `).join("");
    }

    text.innerHTML = `
      A operação requer atenção imediata.
      Existem indicadores críticos em técnicos, zonas,
      alertas ou financeiro.
    `;

    return;
  }

  banner.style.display =
    "none";

  if(actions){
    actions.innerHTML = "";
  }

  banner.removeAttribute("role");
  banner.removeAttribute("tabindex");
  banner.removeAttribute("title");
  banner.onclick = null;
  banner.onkeydown = null;
}

// ======================================================
// INTELLIGENCE PANEL
// ======================================================

function renderIntelligencePanel({
  summary,
  ai,
  predictive,
  operationsScore,
  financialScore,
  criticalAlerts,
  estimatedProfit
}){

  const box =
    document.getElementById("intelligencePanel");

  if(!box) return;

  box.innerHTML = "";

  if(operationsScore >= 75){

    box.innerHTML += `
      <div class="intelligence-item intelligence-good">
        ✅ Operação estável. Rotas e carga operacional estão controladas.
      </div>
    `;

  } else if(operationsScore >= 50){

    box.innerHTML += `
      <div class="intelligence-item intelligence-warning">
        ⚠️ Operação sob pressão. Rever técnicos, zonas e visitas pendentes.
      </div>
    `;

  } else {

    box.innerHTML += `
      <div class="intelligence-item intelligence-critical">
        🚨 Risco operacional elevado. Ação imediata recomendada.
      </div>
    `;
  }

  if(financialScore >= 75){

    box.innerHTML += `
      <div class="intelligence-item intelligence-good">
        🟢 Financeiro controlado. Lucro estimado: <b>${formatMoney(estimatedProfit)}</b>.
      </div>
    `;

  } else {

    box.innerHTML += `
      <div class="intelligence-item intelligence-warning">
        💶 Atenção financeira. Verificar cobranças pendentes e pagamentos parciais.
      </div>
    `;
  }

  (ai.overloadedTechs || []).forEach(t => {

    box.innerHTML += `
      <div class="intelligence-item intelligence-critical">
        🛠️ Técnico sobrecarregado:
        <b>${escapeHtml(t.technician)}</b>
      </div>
    `;
  });

  (ai.criticalZones || []).forEach(z => {

    box.innerHTML += `
      <div class="intelligence-item intelligence-warning">
        🔴 Zona crítica:
        <b>${escapeHtml(z.zone)}</b>
      </div>
    `;
  });

  (predictive.tomorrowRiskZones || []).forEach(z => {

    box.innerHTML += `
      <div class="intelligence-item intelligence-warning">
        🔮 Risco previsto amanhã na zona:
        <b>${escapeHtml(z.zone)}</b>
      </div>
    `;
  });

  (ai.recommendations || []).forEach(r => {

    box.innerHTML += `
      <div class="intelligence-item intelligence-info">
        🤖 ${escapeHtml(r.message)}
      </div>
    `;
  });

  (predictive.recommendations || []).forEach(r => {

    box.innerHTML += `
      <div class="intelligence-item intelligence-info">
        🔮 ${escapeHtml(r.message)}
      </div>
    `;
  });
}

// ======================================================
// CHARTS
// ======================================================

function percent(part,total){

  const n =
    Number(part || 0);

  const d =
    Number(total || 0);

  if(!d) return 0;

  return clamp((n / d) * 100);
}

function barRow(label,value,tone = ""){

  const width =
    clamp(value);

  return `
    <div class="chart-bar-row">
      <span>${escapeHtml(label)}</span>
      <div class="chart-bar-track">
        <div class="chart-bar-fill ${tone}" style="width:${width}%"></div>
      </div>
      <b>${width}%</b>
    </div>
  `;
}

function renderTrendSummaries(context = {}){

  const operational =
    document.getElementById("operationalSummary");

  const financial =
    document.getElementById("financialSummary");

  const visitsTotal =
    Number(context.visitsTotal || 0);

  const visitsDone =
    Number(context.visitsDone || 0);

  const visitsNotDone =
    Number(context.visitsNotDone || 0);

  const visitsPending =
    Math.max(
      visitsTotal - visitsDone - visitsNotDone,
      0
    );

  const doneRate =
    percent(visitsDone, visitsTotal);

  const pendingRate =
    percent(visitsPending, visitsTotal);

  const notDoneRate =
    percent(visitsNotDone, visitsTotal);

  const alertPressure =
    percent(
      context.criticalAlerts,
      Math.max(Number(context.summary?.totalPools || 0), 1)
    );

  if(operational){

    operational.innerHTML = `
      <div class="chart-summary-grid">
        <div class="chart-mini-card"><span>Score operacional</span><b>${escapeHtml(context.operationsScore)}</b></div>
        <div class="chart-mini-card"><span>Alertas abertos</span><b>${escapeHtml(context.criticalAlerts)}</b></div>
        <div class="chart-mini-card"><span>Visitas do mês</span><b>${escapeHtml(visitsTotal)}</b></div>
        <div class="chart-mini-card"><span>Falhadas / impedidas</span><b>${escapeHtml(visitsNotDone)}</b></div>
      </div>
      ${barRow("Concluídas", doneRate, "ok")}
      ${barRow("Pendentes", pendingRate, pendingRate > 15 ? "warn" : "")}
      ${barRow("Não realizadas", notDoneRate, notDoneRate > 3 ? "bad" : "")}
      ${barRow("Pressão alertas", alertPressure, alertPressure > 10 ? "bad" : "warn")}
      <div class="chart-note">Deve ajudar a perceber se a operação está a cumprir as rondas, onde existem falhas e se os alertas estão a crescer demasiado.</div>
    `;
  }

  const monthBilled =
    Number(context.monthBilled || 0);

  const monthPaid =
    Number(context.monthPaid || 0);

  const monthOpen =
    Number(context.monthOpen || 0);

  const collectionRate =
    percent(monthPaid, monthBilled);

  const openRate =
    percent(monthOpen, monthBilled);

  const invoiceRisk =
    percent(
      Number(context.pending || 0) + Number(context.partial || 0),
      context.totalInvoices || 0
    );

  if(financial){

    financial.innerHTML = `
      <div class="chart-summary-grid">
        <div class="chart-mini-card"><span>Score financeiro</span><b>${escapeHtml(context.financialScore)}</b></div>
        <div class="chart-mini-card"><span>Faturado</span><b>${escapeHtml(formatMoney(monthBilled))}</b></div>
        <div class="chart-mini-card"><span>Recebido</span><b>${escapeHtml(formatMoney(monthPaid))}</b></div>
        <div class="chart-mini-card"><span>Em aberto</span><b>${escapeHtml(formatMoney(monthOpen))}</b></div>
      </div>
      ${barRow("Cobrança", collectionRate, collectionRate >= 85 ? "ok" : "warn")}
      ${barRow("Dívida aberta", openRate, openRate > 15 ? "bad" : "warn")}
      ${barRow("Faturas em risco", invoiceRisk, invoiceRisk > 15 ? "bad" : "warn")}
      <div class="chart-note">Deve mostrar se o mês está saudável: quanto foi faturado, recebido e o peso real das dívidas.</div>
    `;
  }
}

function renderCharts(
  operationsScore,
  financialScore,
  context = {}
){

  renderTrendSummaries(context);

  renderOperationsChart(
    operationsScore,
    context
  );

  renderFinancialChart(
    financialScore,
    context
  );
}

function renderOperationsChart(score,context = {}){

  const ctx =
    document.getElementById("productivityChart");

  if(!ctx || typeof Chart === "undefined"){
    if(ctx) ctx.style.display = "none";
    return;
  }

  ctx.style.display = "block";

  if(productivityChart){

    productivityChart.destroy();
  }

  const total =
    Number(context.visitsTotal || 0);

  const done =
    Number(context.visitsDone || 0);

  const notDone =
    Number(context.visitsNotDone || 0);

  const pending =
    Math.max(total - done - notDone, 0);

  productivityChart =
    new Chart(ctx, {

      type:"bar",

      data:{

        labels:[
          "Concluídas",
          "Pendentes",
          "Falhadas",
          "Alertas"
        ],

        datasets:[{

          label:"Operação do mês",

          data:[
            done,
            pending,
            notDone,
            Number(context.criticalAlerts || 0)
          ],

          backgroundColor:[
            "#16a34a",
            "#2563eb",
            "#dc2626",
            "#ea580c"
          ]
        }]
      },

      options:{
        responsive:true,
        plugins:{
          legend:{
            labels:{ color:"#c7e8f7" }
          }
        },
        scales:{
          x:{
            ticks:{ color:"#9cc7df" },
            grid:{ color:"rgba(125,211,252,.12)" }
          },
          y:{
            beginAtZero:true,
            ticks:{ color:"#9cc7df" },
            grid:{ color:"rgba(125,211,252,.12)" }
          }
        }
      }
    });
}

function renderFinancialChart(score,context = {}){

  const ctx =
    document.getElementById("billingChart");

  if(!ctx || typeof Chart === "undefined"){
    if(ctx) ctx.style.display = "none";
    return;
  }

  ctx.style.display = "block";

  if(billingChart){

    billingChart.destroy();
  }

  billingChart =
    new Chart(ctx, {

      type:"bar",

      data:{

        labels:[
          "Faturado",
          "Recebido",
          "Em aberto"
        ],

        datasets:[{

          label:"Financeiro",

          data:[
            Number(context.monthBilled || 0),
            Number(context.monthPaid || 0),
            Number(context.monthOpen || 0)
          ],

          backgroundColor:[
            "#2563eb",
            "#16a34a",
            "#dc2626"
          ]
        }]
      },

      options:{
        responsive:true,
        plugins:{
          legend:{
            labels:{ color:"#c7e8f7" }
          }
        },
        scales:{
          x:{
            ticks:{ color:"#9cc7df" },
            grid:{ color:"rgba(125,211,252,.12)" }
          },
          y:{
            beginAtZero:true,
            ticks:{ color:"#9cc7df" },
            grid:{ color:"rgba(125,211,252,.12)" }
          }
        }
      }
    });
}

// ======================================================
// MAP
// ======================================================

async function initLiveMap(){

  const mapEl =
    document.getElementById("liveMap");

  if(!mapEl || typeof L === "undefined") return;

  liveMap =
    L.map("liveMap")
      .setView([37.136,-8.67],10);

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:"OpenStreetMap"
    }
  ).addTo(liveMap);

  await loadLiveMap();
}

async function loadLiveMap(){

  if(!liveMap) return;

  try {

    clearLiveMarkers();

    const res =
      await fetch(
        `${API}/gps/live`,
        {
          headers:
            getAuthHeaders()
        }
      );

    if(res.status === 401 || res.status === 403){

      adminLogout();

      return;
    }

    const technicians =
      await res.json();

    setText(
      "liveTechnicians",
      Array.isArray(technicians)
        ? technicians.length
        : 0
    );

    const bounds = [];

    (technicians || []).forEach(tech => {

      if(
        tech.latitude == null ||
        tech.longitude == null
      ) return;

      const marker =
        L.marker([
          tech.latitude,
          tech.longitude
        ])
        .addTo(liveMap)
        .bindPopup(`

          <b>🛠️ ${escapeHtml(tech.name || "Técnico")}</b>
          <br>
          Atualizado:
          ${
            tech.updatedAt
              ? new Date(tech.updatedAt).toLocaleString("pt-PT")
              : "-"
          }

        `);

      liveMarkers.push(marker);

      bounds.push([
        tech.latitude,
        tech.longitude
      ]);
    });

    if(bounds.length){

      liveMap.fitBounds(
        bounds,
        {
          padding:[40,40]
        }
      );
    }

  } catch(err){

    console.error(err);
  }
}

function clearLiveMarkers(){

  liveMarkers.forEach(marker => {

    liveMap.removeLayer(marker);
  });

  liveMarkers = [];
}

// ======================================================
// REALTIME
// ======================================================

function bindRealtime(){

  adminSocket.emit(
    "userOnline",
    {
      userId:"admin_dashboard"
    }
  );

  adminSocket.on(
    "gps-update",
    data => {

      loadLiveMap();

      addTimeline(
        "GPS atualizado",
        data?.name ||
        "Posição de técnico atualizada"
      );
    }
  );

  adminSocket.on(
    "new-notification",
    data => {

      addTimeline(
        "Nova notificação",
        data?.message ||
        "Notificação recebida"
      );

      loadDashboard();
    }
  );

  adminSocket.on(
    "newMessage",
    data => {

      addTimeline(
        "Nova mensagem",
        data?.message ||
        "Mensagem recebida no chat"
      );
    }
  );

  adminSocket.on(
    "presenceUpdate",
    data => {

      const id =
        String(data.userId || "");

      if(id.includes("client")){

        onlineClientsCount +=
          data.online ? 1 : -1;

        if(onlineClientsCount < 0){
          onlineClientsCount = 0;
        }

        setText(
          "liveClients",
          onlineClientsCount
        );
      }

      if(id.includes("technician")){

        onlineTechniciansCount +=
          data.online ? 1 : -1;

        if(onlineTechniciansCount < 0){
          onlineTechniciansCount = 0;
        }

        setText(
          "liveTechnicians",
          onlineTechniciansCount
        );
      }

      addTimeline(
        data.online
          ? "Utilizador online"
          : "Utilizador offline",
        id
      );
    }
  );
}

// ======================================================
// BUTTONS
// ======================================================

function bindButtons(){

  document
    .getElementById("refreshBtn")
    ?.addEventListener(
      "click",
      ()=>{

        loadDashboard();

        loadLiveMap();

        addTimeline(
          "Dashboard atualizado",
          "Atualização manual executada"
        );
      }
    );

  document
    .getElementById("liveMapBtn")
    ?.addEventListener(
      "click",
      ()=>{

        window.location.href =
          "/admin-live-map";
      }
    );

  document
    .getElementById("visitsBtn")
    ?.addEventListener(
      "click",
      ()=>{

        window.location.href =
          "/admin-visits-dashboard";
      }
    );

  document
    .getElementById("roundsBtn")
    ?.addEventListener(
      "click",
      ()=>{

        window.location.href =
          "/admin-rounds";
      }
    );

  document
    .getElementById("notificationsBtn")
    ?.addEventListener(
      "click",
      ()=>{

        window.location.href =
          "/admin-notifications";
      }
    );

  document
    .getElementById("logoutBtn")
    ?.addEventListener(
      "click",
      adminLogout
    );
}

// ======================================================
// INIT
// ======================================================

window.addEventListener(
  "load",
  ()=>{

    if(
      !adminToken ||
      !adminUser ||
      adminUser.role !== "ADMIN"
    ){

      adminLogout();

      return;
    }

    bindButtons();

    bindRealtime();

    const month =
      document.getElementById("monthRef");

    if(month){

      month.value =
        getCurrentMonthRef();
    }

    renderTimeline();

    loadDashboard();

    initLiveMap();

    setInterval(
      loadLiveMap,
      30000
    );

    setInterval(
      loadDashboard,
      60000
    );
  }
);
