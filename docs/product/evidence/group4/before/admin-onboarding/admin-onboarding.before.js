(function () {
  "use strict";

  const API = "/api";
  const draftKey = "cw_onboarding_draft";
  const state = {
    bootstrap: { rounds: [], technicians: [] },
    result: null,
    busy: false,
  };

  const ids = [
    "clientName", "clientZone", "clientPhone", "clientEmail", "clientAddress", "clientNif",
    "requiresInvoice", "poolName", "poolType", "disinfectionType", "volumeM3", "poolMonthly",
    "poolLocation", "poolAddress", "serviceFrequency", "estimatedMinutes", "serialNumber",
    "targetPhMin", "targetPhMax", "targetOrpMinMv", "targetChlorineMin", "targetChlorineMax",
    "targetAlkalinityMin", "targetAlkalinityMax", "pumpHorsePower", "filterBrandModel",
    "chlorinatorModel", "technicalRoomLocation", "specialObservations", "roundId", "roundName",
    "roundDay", "technicianId", "plannedDate", "createVisit",
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function stringValue(id) {
    return String($(id)?.value || "").trim();
  }

  function numberValue(id, fallback = undefined) {
    const raw = $(id)?.value;
    if (raw === undefined || raw === null || raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function checked(id) {
    return Boolean($(id)?.checked);
  }

  function dayName(day) {
    return ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"][Number(day) || 0] || "Segunda";
  }

  function authHeaders() {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken") || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function fetchJSON(path, options = {}) {
    const isForm = options.body instanceof FormData;
    const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
      ...options,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || data.message || `Erro ${res.status}`);
    }
    return data;
  }

  function setStatus(message, tone = "") {
    const box = $("formStatus");
    if (!box) return;
    box.className = `status ${tone}`.trim();
    box.textContent = message;
  }

  function addLog(title, message, tone = "") {
    const list = $("logList");
    if (!list) return;
    const item = document.createElement("div");
    item.className = `log-item ${tone}`.trim();
    item.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(message)}</span>`;
    list.prepend(item);
  }

  function asArray(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }

  function setDefaultDate() {
    const input = $("plannedDate");
    if (!input || input.value) return;
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    input.value = next.toISOString().slice(0, 16);
  }

  function applyTreatmentDefaults() {
    const type = stringValue("disinfectionType");
    const presets = {
      CLORO: { cMin: 1, cMax: 3, phMin: 7.2, phMax: 7.6, alkMin: 80, alkMax: 120, orp: 650 },
      SAL: { cMin: 0.8, cMax: 2.5, phMin: 7.2, phMax: 7.6, alkMin: 80, alkMax: 120, orp: 650 },
      BROMO: { cMin: 2, cMax: 5, phMin: 7.2, phMax: 7.8, alkMin: 80, alkMax: 140, orp: 650 },
      UV: { cMin: 0.5, cMax: 1.5, phMin: 7.2, phMax: 7.6, alkMin: 80, alkMax: 120, orp: 650 },
      OZONO: { cMin: 0.5, cMax: 1.5, phMin: 7.2, phMax: 7.6, alkMin: 80, alkMax: 120, orp: 650 },
    };
    const preset = presets[type] || presets.CLORO;
    $("targetChlorineMin").value = preset.cMin;
    $("targetChlorineMax").value = preset.cMax;
    $("targetPhMin").value = preset.phMin;
    $("targetPhMax").value = preset.phMax;
    $("targetAlkalinityMin").value = preset.alkMin;
    $("targetAlkalinityMax").value = preset.alkMax;
    $("targetOrpMinMv").value = preset.orp;
  }

  function collectDraft() {
    const draft = {};
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      draft[id] = el.type === "checkbox" ? el.checked : el.value;
    });
    return draft;
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftKey, JSON.stringify(collectDraft()));
    } catch {
      /* ignored */
    }
  }

  function restoreDraft() {
    let draft = null;
    try {
      draft = JSON.parse(localStorage.getItem(draftKey) || "null");
    } catch {
      draft = null;
    }
    if (!draft) return;
    ids.forEach((id) => {
      const el = $(id);
      if (!el || draft[id] === undefined) return;
      if (el.type === "checkbox") el.checked = Boolean(draft[id]);
      else el.value = draft[id];
    });
  }

  function clearDraft() {
    localStorage.removeItem(draftKey);
    $("flowForm")?.reset();
    setDefaultDate();
    applyTreatmentDefaults();
    state.result = null;
    renderResult();
    renderSteps();
    setStatus("Rascunho limpo. Podes recomecar o fluxo.", "ok");
    addLog("Rascunho limpo", "Nenhum registo foi apagado da base de dados.", "warn");
  }

  function buildPayload() {
    const poolMonthly = numberValue("poolMonthly", 0);
    const roundId = stringValue("roundId");
    const roundName = stringValue("roundName") || `${dayName(numberValue("roundDay", 1))} - ${stringValue("clientZone") || "Nova zona"}`;
    const technical = {
      disinfectionType: stringValue("disinfectionType"),
      volumeM3: numberValue("volumeM3", 0),
      targetPhMin: numberValue("targetPhMin", 7.2),
      targetPhMax: numberValue("targetPhMax", 7.6),
      targetChlorineMin: numberValue("targetChlorineMin", 1),
      targetChlorineMax: numberValue("targetChlorineMax", 3),
      targetAlkalinityMin: numberValue("targetAlkalinityMin", 80),
      targetAlkalinityMax: numberValue("targetAlkalinityMax", 120),
      targetOrpMinMv: numberValue("targetOrpMinMv", 650),
      pumpHorsePower: numberValue("pumpHorsePower", undefined),
      filterBrandModel: stringValue("filterBrandModel"),
      chlorinatorModel: stringValue("chlorinatorModel"),
      technicalRoomLocation: stringValue("technicalRoomLocation"),
      specialObservations: stringValue("specialObservations"),
    };

    return {
      client: {
        name: stringValue("clientName"),
        email: stringValue("clientEmail"),
        phone: stringValue("clientPhone"),
        address: stringValue("clientAddress"),
        zone: stringValue("clientZone"),
        requiresInvoice: checked("requiresInvoice"),
        fiscalNif: stringValue("clientNif"),
        notes: "Criado pela Entrada Guiada Cristal Water.",
      },
      pool: {
        name: stringValue("poolName"),
        type: stringValue("poolType"),
        address: stringValue("poolAddress") || stringValue("clientAddress"),
        zone: stringValue("clientZone"),
        location: stringValue("poolLocation") || stringValue("clientZone"),
        volumeM3: numberValue("volumeM3", undefined),
        monthlyAmount: poolMonthly,
        serviceFrequency: numberValue("serviceFrequency", 1),
        estimatedMinutes: numberValue("estimatedMinutes", 35),
        serialNumber: stringValue("serialNumber"),
        notes: stringValue("specialObservations"),
      },
      technical,
      technicianId: stringValue("technicianId") ? Number(stringValue("technicianId")) : null,
      plannedDate: stringValue("plannedDate") || new Date().toISOString(),
      createVisit: checked("createVisit"),
      round: {
        assign: true,
        id: roundId ? Number(roundId) : null,
        name: roundName,
        dayOfWeek: numberValue("roundDay", 1),
      },
    };
  }

  function validatePayload(payload) {
    if (!payload.client.name) return "Nome do cliente obrigatorio.";
    if (!payload.pool.name) return "Nome da piscina ou jacuzzi obrigatorio.";
    if (!payload.pool.type) return "Tipo de equipamento obrigatorio.";
    if (payload.technical.targetPhMin > payload.technical.targetPhMax) return "pH minimo nao pode ser maior que pH maximo.";
    if (payload.technical.targetChlorineMin > payload.technical.targetChlorineMax) return "Minimo quimico nao pode ser maior que o maximo.";
    if (payload.technical.targetAlkalinityMin > payload.technical.targetAlkalinityMax) return "Alcalinidade minima nao pode ser maior que a maxima.";
    if (payload.pool.volumeM3 !== undefined && payload.pool.volumeM3 < 0) return "Volume nao pode ser negativo.";
    return "";
  }

  function renderOptions() {
    const roundSelect = $("roundId");
    if (roundSelect) {
      const current = roundSelect.value;
      roundSelect.innerHTML = `<option value="">Criar nova ronda</option>` + state.bootstrap.rounds.map((round) => (
        `<option value="${escapeHtml(round.id)}">${escapeHtml(round.name || `Ronda ${round.id}`)} - ${escapeHtml(dayName(round.dayOfWeek))}</option>`
      )).join("");
      if (current) roundSelect.value = current;
    }

    const techSelect = $("technicianId");
    if (techSelect) {
      const current = techSelect.value;
      techSelect.innerHTML = `<option value="">Sem tecnico por agora</option>` + state.bootstrap.technicians.map((tech) => (
        `<option value="${escapeHtml(tech.id)}">${escapeHtml(tech.name || `Tecnico ${tech.id}`)}${tech.zone ? ` - ${escapeHtml(tech.zone)}` : ""}</option>`
      )).join("");
      if (current) techSelect.value = current;
    }
  }

  async function loadBootstrap() {
    try {
      const data = await fetchJSON("/operational-flow/bootstrap");
      state.bootstrap.rounds = asArray(data, "rounds");
      state.bootstrap.technicians = asArray(data, "technicians");
      renderOptions();
      addLog("Dados carregados", `${state.bootstrap.rounds.length} ronda(s) e ${state.bootstrap.technicians.length} tecnico(s) disponiveis.`, "ok");
    } catch (err) {
      addLog("Aviso", `Nao foi possivel carregar rondas/tecnicos: ${err.message}`, "warn");
    }
  }

  async function submitFlow(event) {
    event.preventDefault();
    if (state.busy) return;
    const payload = buildPayload();
    const validation = validatePayload(payload);
    if (validation) {
      setStatus(validation, "error");
      addLog("Validacao", validation, "error");
      return;
    }

    state.busy = true;
    $("submitBtn").disabled = true;
    setStatus("A criar cliente, equipamento, ronda e visita...", "");
    addLog("Fluxo iniciado", "A guardar os dados principais.", "");

    try {
      const result = await fetchJSON("/operational-flow/onboard", {
        method: "POST",
        body: JSON.stringify({
          client: payload.client,
          pool: {
            ...payload.pool,
            disinfectionType: payload.technical.disinfectionType,
          },
          technicalSheet: payload.technical,
          technicianId: payload.technicianId,
          plannedDate: payload.plannedDate,
          createVisit: payload.createVisit,
          round: payload.round,
        }),
      });
      state.result = result;
      addLog("Fluxo criado", "Cliente, equipamento, ronda e visita foram criados conforme os dados disponiveis.", "ok");

      if (result.pool?.id) {
        await fetchJSON(`/pools/${result.pool.id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...payload.pool,
            technicalSheet: payload.technical,
          }),
        });
        addLog("Ficha tecnica atualizada", "Valores de referencia e dados tecnicos minimos foram guardados.", "ok");
      }

      localStorage.removeItem(draftKey);
      setStatus("Fluxo criado com sucesso. Usa os atalhos laterais para continuar.", "ok");
      await loadBootstrap();
      renderResult();
      renderSteps();
    } catch (err) {
      setStatus(err.message || "Erro ao criar fluxo.", "error");
      addLog("Erro ao criar", err.message || "Erro inesperado.", "error");
    } finally {
      state.busy = false;
      $("submitBtn").disabled = false;
    }
  }

  function renderSteps() {
    const steps = Array.from(document.querySelectorAll(".step-pill"));
    const result = state.result || {};
    const done = [
      Boolean(result.client?.id),
      Boolean(result.pool?.id),
      Boolean(result.pool?.id),
      Boolean(result.round?.id),
      Boolean(result.visit?.id),
    ];
    steps.forEach((step, index) => step.classList.toggle("done", done[index]));
  }

  function renderResult() {
    const box = $("resultBox");
    if (!box) return;
    const result = state.result;
    if (!result?.client?.id) {
      box.innerHTML = `<div class="summary-item"><b>Ainda sem fluxo criado</b><span>Depois de criares, aparecem aqui os atalhos para abrir cliente, ficha tecnica, ronda e visita.</span></div>`;
      return;
    }

    const client = result.client || {};
    const pool = result.pool || {};
    const round = result.round || {};
    const visit = result.visit || {};
    const flowStatus = result.flowStatus === "READY_FOR_SERVICE" ? "Pronto para servico" : "Pendente de atribuicao";

    box.innerHTML = `
      <div class="summary-item"><b>${escapeHtml(flowStatus)}</b><span>${escapeHtml(client.name)}${pool.name ? ` - ${escapeHtml(pool.name)}` : ""}</span></div>
      <div class="summary-item"><b>Cliente #${escapeHtml(client.id)}</b><span>${escapeHtml(client.email || client.phone || "Sem contacto principal")}</span></div>
      <div class="summary-item"><b>Equipamento #${escapeHtml(pool.id || "-")}</b><span>${escapeHtml(pool.type || "POOL")} - ${escapeHtml(pool.zone || pool.location || client.zone || "Sem zona")}</span></div>
      <div class="summary-item"><b>Ronda #${escapeHtml(round.id || "-")}</b><span>${escapeHtml(round.name || "Sem ronda")} ${visit.id ? `- visita #${escapeHtml(visit.id)}` : ""}</span></div>
      <div class="result-actions">
        <a class="btn" href="/admin-clients?search=${encodeURIComponent(client.name || client.id)}">Abrir cliente</a>
        <a class="btn ok" href="/admin-pools?clientId=${encodeURIComponent(client.id || "")}&from=onboarding">Adicionar outro equipamento</a>
        <a class="btn" href="/admin-pool-technical?poolId=${encodeURIComponent(pool.id || "")}">Ficha tecnica</a>
        <a class="btn" href="/admin-rounds">Abrir rondas</a>
        <a class="btn" href="/admin-visits${visit.id ? `?visitId=${encodeURIComponent(visit.id)}` : ""}">Abrir visita</a>
      </div>
    `;
  }

  function bindEvents() {
    $("flowForm")?.addEventListener("submit", submitFlow);
    $("resetBtn")?.addEventListener("click", clearDraft);
    $("disinfectionType")?.addEventListener("change", () => {
      applyTreatmentDefaults();
      saveDraft();
    });
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", saveDraft);
      el.addEventListener("change", saveDraft);
    });
  }

  function init() {
    setDefaultDate();
    restoreDraft();
    bindEvents();
    renderResult();
    renderSteps();
    loadBootstrap();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
