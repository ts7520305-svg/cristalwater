const API = "/api";
const dayNames = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];

const state = {
  rounds: [],
  pools: [],
  technicians: [],
  visits: [],
  extraVisits: []
};

function authHeaders(){
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setStatus(message, type = "info"){
  const el = document.getElementById("status");
  if(!el) return;
  el.textContent = message;
  el.style.borderColor = type === "error" ? "rgba(255,91,122,.45)" : "rgba(53,217,255,.18)";
  el.style.background = type === "error" ? "rgba(255,91,122,.12)" : "rgba(53,217,255,.08)";
}

function val(id){
  return document.getElementById(id)?.value || "";
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchJSON(url, options = {}){
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok || data.ok === false){
    throw new Error(data.message || data.error || `Erro HTTP ${res.status}`);
  }
  return data;
}

function asArray(data, key){
  if(Array.isArray(data)) return data;
  if(Array.isArray(data?.[key])) return data[key];
  if(Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeText(value){
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function addDays(date, days){
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfToday(){
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateInput(date){
  if(!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTimeInput(date){
  if(!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const ymd = formatDateInput(date);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${ymd}T${hh}:${mm}`;
}

function toValidDate(value){
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getWeekKey(date){
  if(!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function roundLabel(round){
  return `${dayNames[Number(round.dayOfWeek) || 0]} - ${round.name}`;
}

function roundTechnicians(round){
  return (round.technicians || []).filter((rt) => rt && (rt.technician?.id || rt.technicianId));
}

function roundHasTechnician(round){
  return roundTechnicians(round).length > 0;
}

function poolLabel(pool){
  const client = pool.client?.name || pool.clientName || "Sem cliente";
  return `${pool.name || `Piscina #${pool.id}`} - ${client}`;
}

function getServiceVisitDate(visit){
  return toValidDate(visit.plannedDate || visit.date || visit.scheduledAt || visit.startedAt);
}

function getExtraVisitDate(visit){
  return toValidDate(visit.scheduledAt || visit.date || visit.plannedDate);
}

function inferAssignmentMode(...values){
  const text = normalizeText(values.filter(Boolean).join(" "));
  if(text.includes("unassigned") || text.includes("sem tecnico")) return "UNASSIGNED";
  if(text.includes("substitution") || text.includes("substituicao")) return "SUBSTITUTION";
  if(text.includes("other_day") || text.includes("outro dia")) return "OTHER_DAY";
  if(text.includes("reschedule") || text.includes("reagend")) return "RESCHEDULE";
  if(text.includes("support") || text.includes("apoio") || text.includes("ajuda")) return "SUPPORT";
  return "NORMAL";
}

function normalizeServiceVisit(visit){
  const technician = visit.technician || {};
  return {
    ...visit,
    uid: `SERVICE-${visit.id}`,
    kind: "SERVICE",
    plannedAt: visit.plannedDate || visit.date,
    technicianId: visit.technicianId || technician.id || null,
    technicianName: visit.technicianName || technician.name || "",
    assignmentMode: inferAssignmentMode(visit.reason, visit.internalNotes, visit.notes),
    billingMode: "MONTHLY",
    isBillable: false,
    price: 0
  };
}

function normalizeExtraVisit(visit){
  const pool = visit.pool || {};
  const client = visit.client || pool.client || {};
  const technician = visit.technician || {};
  return {
    ...visit,
    uid: `EXTRA-${visit.id}`,
    kind: "EXTRA",
    client,
    pool,
    round: null,
    roundName: "Visita extra",
    plannedAt: visit.scheduledAt || visit.date,
    technicianId: visit.technicianId || technician.id || null,
    technicianName: technician.name || "",
    assignmentMode: inferAssignmentMode(visit.assignmentMode, visit.internalNote, visit.notes),
    isBillable: Boolean(visit.isBillable || visit.billingMode === "EXTRA"),
    price: Number(visit.totalPrice || visit.price || visit.unitPrice || 0)
  };
}

function allPlannerVisits(){
  const start = startOfToday();
  const end = addDays(start, 7);
  const normal = state.visits.map(normalizeServiceVisit);
  const extras = state.extraVisits
    .map(normalizeExtraVisit)
    .filter((visit) => {
      const date = getVisitDate(visit);
      return date && date >= start && date < end;
    });
  return [...normal, ...extras].sort((a, b) => (getVisitDate(a)?.getTime() || 0) - (getVisitDate(b)?.getTime() || 0));
}

function getVisitDate(visit){
  return visit.kind === "EXTRA" ? getExtraVisitDate(visit) : getServiceVisitDate(visit);
}

function visitClientName(visit){
  return visit.client?.name || visit.clientName || visit.pool?.client?.name || "-";
}

function visitPoolName(visit){
  return visit.pool?.name || visit.poolName || "-";
}

function visitTechnicianName(visit){
  return visit.technician?.name || visit.technicianName || state.technicians.find((tech) => String(tech.id) === String(visit.technicianId))?.name || "Sem tecnico";
}

function visitRoundName(visit){
  return visit.kind === "EXTRA" ? "Visita extra" : (visit.round?.name || visit.roundName || "-");
}

function assignmentLabel(value){
  return {
    NORMAL: "Normal",
    SUPPORT: "Ajuda / apoio",
    SUBSTITUTION: "Substituicao",
    OTHER_DAY: "Ronda de outro dia",
    RESCHEDULE: "Reagendada",
    UNASSIGNED: "Sem tecnico"
  }[String(value || "NORMAL").toUpperCase()] || "Normal";
}

function assignmentOptions(selected){
  const current = String(selected || "NORMAL").toUpperCase();
  return [
    ["NORMAL", "Normal"],
    ["SUPPORT", "Ajuda / apoio"],
    ["SUBSTITUTION", "Substituicao"],
    ["OTHER_DAY", "Ronda de outro dia"],
    ["RESCHEDULE", "Reagendamento"],
    ["UNASSIGNED", "Sem tecnico"]
  ].map(([value, label]) => `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`).join("");
}

function roundDayOptions(selected){
  const current = Number(selected);
  return dayNames.map((name, index) => `<option value="${index}" ${current === index ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");
}

function visitHasAlert(visit){
  const status = normalizeText(visit.status);
  const priority = normalizeText(visit.priority);
  const text = normalizeText([
    visit.alertType,
    visit.alert,
    visit.problem,
    visit.issue,
    visit.notes,
    visit.adminNotes,
    visit.technicianNotes
  ].join(" "));
  return Boolean(
    visit.hasAlert ||
    visit.criticalAlert ||
    (Array.isArray(visit.alerts) && visit.alerts.length) ||
    (Array.isArray(visit.technicalAlerts) && visit.technicalAlerts.length) ||
    ["urgent", "critical", "critico", "alert"].some(word => status.includes(word) || priority.includes(word) || text.includes(word))
  );
}

function visitIsDone(visit){
  const status = normalizeText(visit.status || "PLANNED");
  return ["done", "completed", "concluida", "concluido", "finished", "closed", "fechada"].some(word => status.includes(word));
}

function visitIsLate(visit){
  const date = getVisitDate(visit);
  return Boolean(date && date < new Date() && !visitIsDone(visit));
}

function visitSearchText(visit){
  return normalizeText([
    visit.kind === "EXTRA" ? "extra visita cobravel pontual limpeza" : "normal ronda mensal",
    visitClientName(visit),
    visitPoolName(visit),
    visitTechnicianName(visit),
    visitRoundName(visit),
    assignmentLabel(visit.assignmentMode),
    visit.status,
    visit.billingMode,
    visit.pool?.address,
    visit.pool?.location,
    visit.client?.zone,
    visit.pool?.zone,
    visit.alertType,
    visit.problem,
    visit.notes
  ].join(" "));
}

function setSelectOptions(id, options, placeholder){
  const el = document.getElementById(id);
  if(!el) return;
  const previous = el.value;
  const body = options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("");
  el.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${body}`;
  if(options.some(option => String(option.value) === String(previous))) el.value = previous;
}

function uniqueVisitOptions(getValue){
  const map = new Map();
  allPlannerVisits().forEach(visit => {
    const value = getValue(visit);
    if(!value || value === "-") return;
    const key = String(value);
    if(!map.has(key)) map.set(key, { value: key, label: key });
  });
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-PT"));
}

function updateVisitFilterSelects(){
  setSelectOptions("visitTechnicianFilter", uniqueVisitOptions(visitTechnicianName), "Todos os tecnicos");
  setSelectOptions("visitRoundFilter", uniqueVisitOptions(visitRoundName), "Todas as rondas");
}

function getVisitFilters(){
  return {
    query: val("visitSearch"),
    date: val("visitDateFilter"),
    week: val("visitWeekFilter"),
    day: val("visitDayFilter"),
    technician: val("visitTechnicianFilter"),
    round: val("visitRoundFilter"),
    status: val("visitStatusFilter")
  };
}

function filterVisits(){
  const filters = getVisitFilters();
  const query = normalizeText(filters.query);
  return allPlannerVisits().filter(visit => {
    const date = getVisitDate(visit);
    if(query && !visitSearchText(visit).includes(query)) return false;
    if(filters.date && formatDateInput(date) !== filters.date) return false;
    if(filters.week && getWeekKey(date) !== filters.week) return false;
    if(filters.day !== "" && (!date || String(date.getDay()) !== filters.day)) return false;
    if(filters.technician && visitTechnicianName(visit) !== filters.technician) return false;
    if(filters.round && visitRoundName(visit) !== filters.round) return false;
    if(filters.status === "alerts" && !visitHasAlert(visit)) return false;
    if(filters.status === "late" && !visitIsLate(visit)) return false;
    if(filters.status === "pending" && visitIsDone(visit)) return false;
    if(filters.status === "done" && !visitIsDone(visit)) return false;
    if(filters.status === "extra" && visit.kind !== "EXTRA") return false;
    if(filters.status === "billable" && !(visit.kind === "EXTRA" && visit.billingMode === "EXTRA")) return false;
    return true;
  });
}

function updateSelects(){
  const roundOptions = state.rounds.map(r => `<option value="${r.id}">${escapeHtml(roundLabel(r))}</option>`).join("");
  const techOptions = state.technicians.map(t => `<option value="${t.id}">${escapeHtml(t.name || `Tecnico #${t.id}`)}</option>`).join("");
  const poolOptions = state.pools.map(p => `<option value="${p.id}">${escapeHtml(poolLabel(p))}</option>`).join("");

  ["assignTechRound", "assignPoolRound"].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.innerHTML = roundOptions || "<option>Sem rondas</option>";
  });

  const assignTech = document.getElementById("assignTech");
  if(assignTech) assignTech.innerHTML = techOptions || "<option>Sem tecnicos</option>";

  const assignPool = document.getElementById("assignPool");
  if(assignPool) assignPool.innerHTML = poolOptions || "<option>Sem piscinas</option>";

  const extraPool = document.getElementById("extraPool");
  if(extraPool) extraPool.innerHTML = `<option value="">Piscina / jacuzzi da visita extra</option>${poolOptions}`;

  const extraTechnician = document.getElementById("extraTechnician");
  if(extraTechnician) extraTechnician.innerHTML = `<option value="">Sem tecnico definido</option>${techOptions}`;

  if(!val("extraStart")){
    const initial = new Date();
    initial.setMinutes(0, 0, 0);
    document.getElementById("extraStart").value = formatDateTimeInput(initial);
  }

  updateVisitFilterSelects();
}

function renderKpis(){
  const activeRounds = state.rounds.filter(r => r.active !== false);
  const unassignedRounds = activeRounds.filter((round) => !roundHasTechnician(round));
  const poolIds = new Set();
  const techIds = new Set();
  state.rounds.forEach(r => {
    (r.pools || []).forEach(rp => poolIds.add(rp.poolId || rp.pool?.id));
    roundTechnicians(r).forEach(rt => techIds.add(rt.technicianId || rt.technician?.id));
  });
  document.getElementById("kpiRounds").textContent = activeRounds.length;
  document.getElementById("kpiPools").textContent = poolIds.size;
  document.getElementById("kpiTechs").textContent = techIds.size;
  document.getElementById("kpiVisits").textContent = allPlannerVisits().length;
  document.getElementById("kpiUnassignedRounds").textContent = unassignedRounds.length;

  const warning = document.getElementById("roundTechWarning");
  const warningCard = document.getElementById("kpiUnassignedRoundsCard");
  if(warning){
    if(unassignedRounds.length){
      const names = unassignedRounds.map(round => `${dayNames[Number(round.dayOfWeek) || 0]} - ${round.name}`).join(", ");
      warning.style.display = "block";
      warning.innerHTML = `<strong>Aviso: ${unassignedRounds.length} ronda(s) sem tecnico atribuido</strong><span>${escapeHtml(names)}. Associa um tecnico antes de gerar ou executar visitas.</span>`;
    }else{
      warning.style.display = "none";
      warning.innerHTML = "";
    }
  }
  if(warningCard) warningCard.classList.toggle("warning-card", unassignedRounds.length > 0);
}

function renderRounds(){
  const box = document.getElementById("roundsByDay");
  if(!box) return;
  const byDay = new Map();
  for(let i = 0; i < 7; i++) byDay.set(i, []);
  state.rounds.forEach(r => byDay.get(Number(r.dayOfWeek) || 0).push(r));

  box.innerHTML = [...byDay.entries()].map(([day, rounds]) => `
    <div class="day-card" data-help-topic="rounds">
      <h3>${escapeHtml(dayNames[day])}</h3>
      ${rounds.length ? rounds.map(renderRoundCard).join("") : `<div class="empty">Sem ronda definida</div>`}
    </div>
  `).join("");

  box.querySelectorAll("[data-delete-round]").forEach(btn => btn.addEventListener("click", () => deleteRound(btn.dataset.deleteRound)));
  box.querySelectorAll("[data-toggle-round]").forEach(btn => btn.addEventListener("click", () => toggleRound(btn.dataset.toggleRound)));
  box.querySelectorAll("[data-save-round]").forEach(btn => btn.addEventListener("click", () => saveRoundFromCard(btn.dataset.saveRound)));
  box.querySelectorAll("[data-focus-tech-round]").forEach(btn => btn.addEventListener("click", () => focusTechnicianAssignment(btn.dataset.focusTechRound)));
  setupRoundPoolDrag(box);
}

function renderRoundCard(round){
  const hasTechnician = roundHasTechnician(round);
  const technicians = roundTechnicians(round).map((rt, index) => ({
    name: rt.technician?.name || `Tecnico #${rt.technicianId}`,
    role: index === 0 ? "principal" : "apoio"
  })).filter(item => item.name);
  const pools = (round.pools || []).slice().sort((a,b)=>(a.order || 0)-(b.order || 0));
  return `
    <article class="round-card ${hasTechnician || round.active === false ? "" : "round-card-risk"}" data-help-topic="rounds" data-round-id="${round.id}">
      <div class="round-top">
        <div>
          <strong>${escapeHtml(round.name)}</strong><br>
          <span class="mini">ID ${round.id} - ${round.active === false ? "Inativa" : "Ativa"}</span>
        </div>
        <span class="pill">${pools.length} piscinas</span>
      </div>
      ${hasTechnician || round.active === false ? "" : `
        <div class="status" style="border-color:rgba(255,107,107,.5);background:rgba(255,107,107,.12);margin:10px 0">
          Aviso: ronda ativa sem tecnico atribuido.
          <button type="button" data-focus-tech-round="${round.id}" style="margin-left:8px">Associar tecnico</button>
        </div>
      `}
      <div class="round-editor">
        <input data-round-field="name" value="${escapeHtml(round.name)}" aria-label="Nome da ronda">
        <select data-round-field="dayOfWeek" aria-label="Dia da ronda">${roundDayOptions(round.dayOfWeek)}</select>
        <button type="button" data-save-round="${round.id}">Guardar</button>
      </div>
      <div style="margin-top:9px">
        ${technicians.length
          ? technicians.map(item => `<span class="pill">${escapeHtml(item.name)} · ${escapeHtml(item.role)}</span>`).join(" ")
          : `<span class="pill">Sem tecnico</span>`}
      </div>
      <ul class="round-pool-list">
        ${pools.length ? pools.map(rp => `
          <li class="pool-line" draggable="true" data-source-round-id="${round.id}" data-pool-id="${rp.poolId || rp.pool?.id}">
            <b>#${rp.order || "-"} ${escapeHtml(rp.pool?.name || `Piscina #${rp.poolId}`)}</b>
            <span>${escapeHtml(rp.pool?.client?.name || "Sem cliente")} - arraste para outra ronda</span>
          </li>
        `).join("") : `<li class="mini">Ainda sem piscinas associadas. Pode arrastar uma piscina de outra ronda para aqui.</li>`}
      </ul>
      <div class="round-actions">
        <button class="secondary" data-toggle-round="${round.id}">${round.active === false ? "Ativar" : "Pausar"}</button>
        <button class="danger" data-delete-round="${round.id}">Apagar</button>
      </div>
    </article>
  `;
}

function focusTechnicianAssignment(roundId){
  const selector = document.getElementById("assignTechRound");
  if(selector) {
    selector.value = String(roundId);
    selector.scrollIntoView({ behavior: "smooth", block: "center" });
    selector.focus();
  }
  setStatus("Seleciona o tecnico e confirma em Associar tecnico a ronda.", "error");
}

function setupRoundPoolDrag(container){
  container.querySelectorAll(".pool-line").forEach((item) => {
    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", JSON.stringify({
        type: "ROUND_POOL",
        poolId: item.dataset.poolId,
        sourceRoundId: item.dataset.sourceRoundId
      }));
      event.dataTransfer.effectAllowed = "move";
    });
  });

  container.querySelectorAll(".round-card").forEach((card) => {
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", async (event) => {
      event.preventDefault();
      card.classList.remove("drag-over");
      const raw = event.dataTransfer.getData("text/plain");
      if(!raw) return;
      const payload = JSON.parse(raw);
      if(payload.type !== "ROUND_POOL") return;
      await movePoolToRound(payload.poolId, payload.sourceRoundId, card.dataset.roundId);
    });
  });
}

async function saveRoundFromCard(roundId){
  const card = document.querySelector(`.round-card[data-round-id="${roundId}"]`);
  if(!card) return;
  const name = card.querySelector('[data-round-field="name"]')?.value?.trim() || "";
  const dayOfWeek = Number(card.querySelector('[data-round-field="dayOfWeek"]')?.value || 1);
  if(!name){ setStatus("Indica o nome da ronda.", "error"); return; }
  try{
    setStatus("A guardar ronda...");
    await fetchJSON(`${API}/rounds/${roundId}`, {
      method: "PUT",
      body: JSON.stringify({ name, dayOfWeek })
    });
    await loadAll();
    setStatus("Ronda atualizada. Se necessario, volta a gerar as visitas planeadas.");
  }catch(err){ setStatus(err.message, "error"); }
}

async function movePoolToRound(poolId, sourceRoundId, targetRoundId){
  if(!poolId || !targetRoundId || String(sourceRoundId || "") === String(targetRoundId || "")){
    setStatus("Escolhe uma ronda diferente para mover a piscina.", "error");
    return;
  }
  try{
    setStatus("A mover piscina para outra ronda...");
    const data = await fetchJSON(`${API}/rounds/${targetRoundId}/move-pool`, {
      method: "POST",
      body: JSON.stringify({
        poolId: Number(poolId),
        sourceRoundId: Number(sourceRoundId || 0) || null,
        movePlannedVisits: true
      })
    });
    await loadAll();
    setStatus(`Piscina movida. ${data.updatedVisits || 0} visita(s) planeada(s) atualizada(s).`);
  }catch(err){ setStatus(err.message, "error"); }
}

function visitStatusOptions(selected){
  const statuses = [
    ["PLANNED", "Planeada"],
    ["ON_ROUTE", "A caminho"],
    ["IN_PROGRESS", "Em execucao"],
    ["DONE", "Concluida"],
    ["BLOCKED", "Retida / impedida"],
    ["RESCHEDULED", "Reagendada"],
    ["CANCELLED", "Cancelada"]
  ];
  return statuses.map(([value, label]) => `<option value="${value}" ${String(selected || "PLANNED").toUpperCase() === value ? "selected" : ""}>${label}</option>`).join("");
}

function billingOptions(selected){
  const options = [
    ["EXTRA", "Extra cobravel"],
    ["INCLUDED", "Incluida no contrato"],
    ["NO_CHARGE", "Sem cobranca"]
  ];
  return options.map(([value, label]) => `<option value="${value}" ${String(selected || "EXTRA").toUpperCase() === value ? "selected" : ""}>${label}</option>`).join("");
}

function technicianOptions(selected){
  const options = state.technicians.map((tech) => `<option value="${tech.id}" ${String(selected || "") === String(tech.id) ? "selected" : ""}>${escapeHtml(tech.name || `Tecnico #${tech.id}`)}</option>`).join("");
  return `<option value="">Sem tecnico</option>${options}`;
}

function renderPlanner(){
  const box = document.getElementById("visitPlanner");
  if(!box) return;
  const visits = filterVisits();
  const columns = [
    { id: "", name: "Sem tecnico" },
    ...state.technicians.filter((tech) => tech.active !== false).map((tech) => ({ id: String(tech.id), name: tech.name || `Tecnico #${tech.id}` }))
  ];

  box.innerHTML = columns.map((column) => {
    const assigned = visits.filter((visit) => String(visit.technicianId || "") === String(column.id));
    return `
      <section class="tech-column" data-technician-id="${escapeHtml(column.id)}">
        <h4>${escapeHtml(column.name)} <span class="pill">${assigned.length}</span></h4>
        <div class="tech-drop">
          ${assigned.length ? assigned.map(renderVisitChip).join("") : `<div class="empty">Arraste visitas para aqui</div>`}
        </div>
      </section>
    `;
  }).join("");

  box.querySelectorAll(".visit-chip").forEach((chip) => {
    chip.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", JSON.stringify({ kind: chip.dataset.kind, id: chip.dataset.id }));
      event.dataTransfer.effectAllowed = "move";
    });
  });

  box.querySelectorAll(".tech-column").forEach((column) => {
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.classList.add("drag-over");
    });
    column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
    column.addEventListener("drop", async (event) => {
      event.preventDefault();
      column.classList.remove("drag-over");
      const raw = event.dataTransfer.getData("text/plain");
      if(!raw) return;
      const payload = JSON.parse(raw);
      await reassignVisit(payload.kind, payload.id, column.dataset.technicianId || null);
    });
  });
}

function renderVisitChip(visit){
  const date = getVisitDate(visit);
  return `
    <article class="visit-chip ${visit.kind === "EXTRA" ? "extra" : ""} ${visitIsDone(visit) ? "done" : ""}" draggable="true" data-kind="${visit.kind}" data-id="${visit.id}">
      <b>${escapeHtml(visitPoolName(visit))}</b>
      <span>${escapeHtml(visitClientName(visit))}</span>
      <span>${escapeHtml(date ? date.toLocaleString("pt-PT") : "Sem data")} - ${visit.kind === "EXTRA" ? "Extra" : "Ronda"} - ${escapeHtml(assignmentLabel(visit.assignmentMode))}</span>
    </article>
  `;
}

function renderVisits(){
  const box = document.getElementById("weekVisits");
  if(!box) return;
  const filteredVisits = filterVisits();
  const allVisits = allPlannerVisits();
  const summary = document.getElementById("visitFilterSummary");
  if(summary){
    const alertCount = filteredVisits.filter(visitHasAlert).length;
    const lateCount = filteredVisits.filter(visitIsLate).length;
    const extraCount = filteredVisits.filter((visit) => visit.kind === "EXTRA").length;
    const billableCount = filteredVisits.filter((visit) => visit.kind === "EXTRA" && visit.billingMode === "EXTRA").length;
    summary.textContent = `${filteredVisits.length} de ${allVisits.length} visita(s) - ${alertCount} alerta(s) - ${lateCount} atrasada(s) - ${extraCount} extra(s) - ${billableCount} cobravel(is)`;
  }

  renderPlanner();

  if(!allVisits.length){
    box.innerHTML = `<div class="empty">Ainda nao existem visitas geradas para esta semana.</div>`;
    return;
  }
  if(!filteredVisits.length){
    box.innerHTML = `<div class="empty">Nenhuma visita corresponde aos filtros escolhidos.</div>`;
    return;
  }

  box.innerHTML = `
    <div class="table-scroll" aria-label="Lista editavel de visitas da semana">
      <table class="visits-table">
        <thead>
          <tr><th>Data</th><th>Cliente</th><th>Piscina</th><th>Tecnico</th><th>Tipo / cobranca</th><th>Estado</th><th>Editar</th></tr>
        </thead>
        <tbody>
          ${filteredVisits.map(renderVisitRow).join("")}
        </tbody>
      </table>
    </div>
  `;

  box.querySelectorAll("[data-save-visit]").forEach((btn) => {
    btn.addEventListener("click", () => saveVisitFromRow(btn.dataset.kind, btn.dataset.id));
  });
}

function renderVisitRow(visit){
  const date = getVisitDate(visit);
  const hasAlert = visitHasAlert(visit);
  const isLate = visitIsLate(visit);
  const classes = [
    hasAlert ? "visit-row-alert" : "",
    isLate ? "visit-row-late" : "",
    visit.kind === "EXTRA" ? "visit-row-extra" : ""
  ].filter(Boolean).join(" ");

  return `
    <tr class="${classes}" data-kind="${visit.kind}" data-id="${visit.id}">
      <td><input data-field="date" type="datetime-local" value="${escapeHtml(formatDateTimeInput(date))}"></td>
      <td>${escapeHtml(visitClientName(visit))}</td>
      <td>${escapeHtml(visitPoolName(visit))}</td>
      <td><select data-field="technicianId">${technicianOptions(visit.technicianId)}</select></td>
      <td>
        ${visit.kind === "EXTRA"
          ? `<select data-field="billingMode">${billingOptions(visit.billingMode)}</select><input class="money-input" data-field="unitPrice" type="number" min="0" step="0.01" value="${escapeHtml(visit.price || "")}" placeholder="Valor">`
          : `<span class="pill">Ronda normal</span>`}
        <select data-field="assignmentMode" title="Motivo operacional">${assignmentOptions(visit.assignmentMode)}</select>
        ${hasAlert ? `<span class="pill pill-alert">Com alerta</span>` : ""}
      </td>
      <td><select data-field="status">${visitStatusOptions(visit.status)}</select></td>
      <td>
        <div class="table-actions">
          <button data-save-visit data-kind="${visit.kind}" data-id="${visit.id}" type="button">Guardar alteracoes</button>
          <span class="mini">${escapeHtml(visitRoundName(visit))}${isLate ? " - atrasada" : ""}</span>
        </div>
      </td>
    </tr>
  `;
}

function render(){
  updateSelects();
  renderKpis();
  renderRounds();
  renderVisits();
}

async function loadAll(){
  try{
    setStatus("A carregar rondas, tecnicos, piscinas, visitas e extras...");
    const [roundsData, poolsData, techData, visitsData, extraData] = await Promise.allSettled([
      fetchJSON(`${API}/rounds`),
      fetchJSON(`${API}/pools`),
      fetchJSON(`${API}/technicians`),
      fetchJSON(`${API}/round-planner/week`),
      fetchJSON(`${API}/extra-visits`)
    ]);

    if(roundsData.status === "fulfilled") state.rounds = asArray(roundsData.value, "rounds");
    if(poolsData.status === "fulfilled") state.pools = asArray(poolsData.value, "pools");
    if(techData.status === "fulfilled") state.technicians = asArray(techData.value, "technicians");
    if(visitsData.status === "fulfilled") state.visits = asArray(visitsData.value, "visits");
    if(extraData.status === "fulfilled") state.extraVisits = asArray(extraData.value, "extraVisits");

    const errors = [roundsData, poolsData, techData, visitsData, extraData].filter(r => r.status === "rejected").map(r => r.reason.message);
    render();
    setStatus(errors.length ? `Carregado com avisos: ${errors.join(" - ")}` : "Rondas e visitas carregadas com sucesso.", errors.length ? "error" : "info");
  }catch(err){
    setStatus(err.message, "error");
  }
}

async function createRound(){
  const name = val("roundName").trim();
  const dayOfWeek = Number(val("roundDay"));
  if(!name){ setStatus("Indica o nome da ronda.", "error"); return; }
  try{
    setStatus("A criar ronda...");
    await fetchJSON(`${API}/rounds`, { method:"POST", body: JSON.stringify({ name, dayOfWeek }) });
    document.getElementById("roundName").value = "";
    await loadAll();
  }catch(err){ setStatus(err.message, "error"); }
}

async function assignTechnician(){
  const roundId = Number(val("assignTechRound"));
  const technicianId = Number(val("assignTech"));
  if(!roundId || !technicianId){ setStatus("Seleciona uma ronda e um tecnico.", "error"); return; }
  try{
    setStatus("A associar tecnico...");
    await fetchJSON(`${API}/rounds/${roundId}/technicians`, { method:"POST", body: JSON.stringify({ technicianId }) });
    await loadAll();
  }catch(err){ setStatus(err.message, "error"); }
}

async function assignPool(){
  const roundId = Number(val("assignPoolRound"));
  const poolId = Number(val("assignPool"));
  const order = Number(val("assignPoolOrder") || 0);
  if(!roundId || !poolId){ setStatus("Seleciona uma ronda e uma piscina.", "error"); return; }
  try{
    setStatus("A associar piscina...");
    await fetchJSON(`${API}/rounds/${roundId}/pools`, { method:"POST", body: JSON.stringify({ poolId, order }) });
    document.getElementById("assignPoolOrder").value = "";
    await loadAll();
  }catch(err){ setStatus(err.message, "error"); }
}

async function generateWeek(force = false){
  if(force && !confirm("Forcar a geracao vai substituir visitas planeadas ainda nao concluidas desta semana. Continuar?")) return;
  try{
    setStatus(force ? "A regenerar visitas planeadas da semana..." : "A gerar visitas da semana a partir das rondas...");
    const data = await fetchJSON(`${API}/round-planner/generate`, { method:"POST", body: JSON.stringify({ force }) });
    await loadAll();
    const blocked = Number(data.blocked || 0);
    const blockedText = blocked
      ? `, ${blocked} bloqueada(s) por ficha tecnica ou regras em falta`
      : "";
    setStatus(`Semana gerada: ${data.total || 0} visita(s) criada(s), ${data.skipped || 0} ja existente(s)${blockedText}.`);
  }catch(err){ setStatus(err.message, "error"); }
}

async function createExtraVisits(){
  const poolId = Number(val("extraPool"));
  const technicianId = Number(val("extraTechnician")) || null;
  const start = toValidDate(val("extraStart"));
  const repeatMode = val("extraRepeatMode") || "once";
  const billingMode = val("extraBillingMode") || "EXTRA";
  const unitPrice = Number(val("extraPrice") || 0);
  const notes = val("extraNotes").trim();
  const count = repeatMode === "once" ? 1 : Math.min(90, Math.max(1, Number(val("extraRepeatCount") || 1)));

  if(!poolId){ setStatus("Seleciona a piscina ou jacuzzi da visita extra.", "error"); return; }
  if(!start){ setStatus("Seleciona a data e hora da visita extra.", "error"); return; }
  if(billingMode === "EXTRA" && unitPrice <= 0){ setStatus("Indica o valor da visita extra cobravel.", "error"); return; }

  try{
    setStatus(`A criar ${count} visita(s) extra...`);
    for(let i = 0; i < count; i += 1){
      const scheduledAt = repeatMode === "weekly" ? addDays(start, i * 7) : repeatMode === "daily" ? addDays(start, i) : start;
      await fetchJSON(`${API}/extra-visits`, {
        method: "POST",
        body: JSON.stringify({
          poolId,
          technicianId,
          scheduledAt: scheduledAt.toISOString(),
          visitType: repeatMode === "once" ? "ONE_OFF" : "RECURRING",
          type: "EXTRA_SERVICE",
          source: "ADMIN_PLANNER",
          origin: "ADMIN",
          billingMode,
          unitPrice: billingMode === "EXTRA" ? unitPrice : null,
          totalPrice: billingMode === "EXTRA" ? unitPrice : null,
          notes
        })
      });
    }
    document.getElementById("extraRepeatCount").value = "1";
    document.getElementById("extraNotes").value = "";
    await loadAll();
    setStatus(`${count} visita(s) extra criada(s) com sucesso.`);
  }catch(err){ setStatus(err.message, "error"); }
}

async function reassignVisit(kind, id, technicianId){
  try{
    const currentVisit = allPlannerVisits().find((visit) => visit.kind === kind && String(visit.id) === String(id));
    const oldTech = String(currentVisit?.technicianId || "");
    const newTech = String(technicianId || "");
    const assignmentMode = !newTech ? "UNASSIGNED" : (oldTech && oldTech !== newTech ? "SUPPORT" : "NORMAL");
    const payload = {
      technicianId: technicianId || null,
      assignmentMode,
      operationNote: assignmentMode === "SUPPORT"
        ? "Visita movida por drag-and-drop para apoio em campo."
        : "Visita movida no planeador."
    };
    setStatus("A reatribuir visita...");
    if(kind === "EXTRA"){
      await fetchJSON(`${API}/extra-visits/${id}`, { method:"PUT", body: JSON.stringify(payload) });
    }else{
      await fetchJSON(`${API}/round-planner/visits/${id}`, { method:"PATCH", body: JSON.stringify(payload) });
    }
    await loadAll();
    setStatus("Visita reatribuida com sucesso.");
  }catch(err){ setStatus(err.message, "error"); }
}

async function saveVisitFromRow(kind, id){
  const row = document.querySelector(`tr[data-kind="${kind}"][data-id="${id}"]`);
  if(!row) return;
  const dateValue = row.querySelector('[data-field="date"]')?.value || "";
  const date = toValidDate(dateValue);
  let technicianId = row.querySelector('[data-field="technicianId"]')?.value || null;
  const status = row.querySelector('[data-field="status"]')?.value || "PLANNED";
  const assignmentMode = row.querySelector('[data-field="assignmentMode"]')?.value || "NORMAL";
  if(assignmentMode === "UNASSIGNED") technicianId = null;

  if(!date){ setStatus("Data da visita invalida.", "error"); return; }

  try{
    setStatus("A guardar alteracoes da visita...");
    if(kind === "EXTRA"){
      const billingMode = row.querySelector('[data-field="billingMode"]')?.value || "EXTRA";
      const unitPrice = Number(row.querySelector('[data-field="unitPrice"]')?.value || 0);
      await fetchJSON(`${API}/extra-visits/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          scheduledAt: date.toISOString(),
          technicianId,
          status,
          assignmentMode,
          billingMode,
          unitPrice: billingMode === "EXTRA" ? unitPrice : null,
          totalPrice: billingMode === "EXTRA" ? unitPrice : null
        })
      });
    }else{
      await fetchJSON(`${API}/round-planner/visits/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          plannedDate: date.toISOString(),
          technicianId,
          status,
          assignmentMode
        })
      });
    }
    await loadAll();
    setStatus("Alteracoes guardadas.");
  }catch(err){ setStatus(err.message, "error"); }
}

function clearVisitFilters(){
  ["visitSearch", "visitDateFilter", "visitWeekFilter", "visitDayFilter", "visitTechnicianFilter", "visitRoundFilter", "visitStatusFilter"].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = "";
  });
  renderVisits();
}

function setupVisitFilters(){
  ["visitDateFilter", "visitWeekFilter", "visitDayFilter", "visitTechnicianFilter", "visitRoundFilter", "visitStatusFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderVisits);
  });
  document.getElementById("visitSearch")?.addEventListener("input", renderVisits);
  document.getElementById("clearVisitFilters")?.addEventListener("click", clearVisitFilters);
}

async function deleteRound(id){
  if(!confirm("Apagar esta ronda? As visitas ja geradas nao sao apagadas automaticamente.")) return;
  try{
    setStatus("A apagar ronda...");
    await fetchJSON(`${API}/rounds/${id}`, { method:"DELETE" });
    await loadAll();
  }catch(err){ setStatus(err.message, "error"); }
}

async function toggleRound(id){
  const round = state.rounds.find(r => String(r.id) === String(id));
  if(!round) return;
  try{
    setStatus("A atualizar estado da ronda...");
    await fetchJSON(`${API}/rounds/${id}`, { method:"PUT", body: JSON.stringify({ name: round.name, dayOfWeek: round.dayOfWeek, active: round.active === false }) });
    await loadAll();
  }catch(err){ setStatus(err.message, "error"); }
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refreshBtn")?.addEventListener("click", loadAll);
  document.getElementById("createRoundBtn")?.addEventListener("click", createRound);
  document.getElementById("assignTechBtn")?.addEventListener("click", assignTechnician);
  document.getElementById("assignPoolBtn")?.addEventListener("click", assignPool);
  document.getElementById("generateWeekBtn")?.addEventListener("click", () => generateWeek(false));
  document.getElementById("forceGenerateBtn")?.addEventListener("click", () => generateWeek(true));
  document.getElementById("createExtraVisitBtn")?.addEventListener("click", createExtraVisits);
  setupVisitFilters();
  loadAll();
});
