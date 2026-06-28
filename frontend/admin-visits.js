const API = `${location.origin}/api`;

const state = {
  pools: [],
  technicians: []
};

function todayDateValue() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function nowDateTimeValue() {
  const now = new Date();
  return `${todayDateValue()}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function asArray(data, key) {
  return Array.isArray(data) ? data : (data?.[key] || []);
}

function showStatus(message, type = "info") {
  const meta = document.getElementById("visitListMeta");
  if (!meta) return;
  meta.textContent = message;
  meta.style.borderColor = type === "error" ? "rgba(255,107,107,.45)" : type === "ok" ? "rgba(64,230,160,.38)" : "rgba(53,217,255,.18)";
  meta.style.background = type === "error" ? "rgba(255,107,107,.12)" : type === "ok" ? "rgba(64,230,160,.10)" : "rgba(53,217,255,.08)";
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.error || `Erro HTTP ${res.status}`);
  }
  return data;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-PT");
}

async function loadPools() {
  try {
    const data = await fetchJSON(`${API}/pools`);
    state.pools = asArray(data, "pools");

    const select = document.getElementById("poolId");
    if (!select) return;

    select.innerHTML = state.pools.map((pool) => `
      <option value="${esc(pool.id)}">
        ${esc(pool.name || `Piscina ${pool.id}`)}
      </option>
    `).join("");
  } catch (err) {
    console.error(err);
    showStatus(`Erro ao carregar piscinas: ${err.message}`, "error");
  }
}

async function loadTechnicians() {
  try {
    const data = await fetchJSON(`${API}/technicians`);
    state.technicians = asArray(data, "technicians");

    const createSelect = document.getElementById("technicianId");
    const filterSelect = document.getElementById("technicianFilter");

    if (createSelect) {
      createSelect.innerHTML = state.technicians.map((tech) => `
        <option value="${esc(tech.id)}">
          ${esc(tech.name || `Tecnico ${tech.id}`)}
        </option>
      `).join("");
    }

    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">Todos os tecnicos</option>' + state.technicians.map((tech) => `
        <option value="${esc(tech.id)}">
          ${esc(tech.name || `Tecnico ${tech.id}`)}
        </option>
      `).join("");
    }
  } catch (err) {
    console.error(err);
    showStatus(`Erro ao carregar tecnicos: ${err.message}`, "error");
  }
}

async function loadVisits() {
  try {
    const dateFilter = document.getElementById("visitDateFilter");
    const technicianFilter = document.getElementById("technicianFilter");
    const params = new URLSearchParams();

    if (dateFilter?.value) params.set("date", dateFilter.value);
    if (technicianFilter?.value) params.set("technicianId", technicianFilter.value);

    const data = await fetchJSON(`${API}/visits/today?${params.toString()}`);
    const visits = data.visits || [];

    const container = document.getElementById("visits");
    const meta = document.getElementById("visitListMeta");
    if (!container) return;

    if (meta) {
      meta.textContent = `${data.total ?? visits.length} visita(s) em ${data.date || dateFilter?.value || "hoje"}`;
    }

    if (!visits.length) {
      container.innerHTML = '<div class="empty">Sem visitas para estes filtros.</div>';
      return;
    }

    container.innerHTML = visits.map((visit) => `
      <div class="visit">
        <b>${esc(visit.pool?.name || "-")}</b>
        <span class="pill">${esc(visit.status || "-")}</span>
        <br>
        Cliente: ${esc(visit.client?.name || "-")}
        <br>
        Tecnico: ${esc(visit.technicianName || "-")}
        <br>
        Planeada: ${esc(formatDateTime(visit.plannedDate))}
        <br>
        Inicio: ${esc(formatDateTime(visit.startAt))}
        <br>
        Fim: ${esc(formatDateTime(visit.endAt))}
        <div class="actions">
          ${visit.pool?.id ? `<a class="btn" href="/admin-pool-technical?poolId=${esc(visit.pool.id)}">Ficha da piscina</a>` : ""}
          <a class="btn" href="/admin-service-log">Registo diario</a>
        </div>
      </div>
    `).join("");
  } catch (err) {
    console.error(err);
    showStatus(`Erro ao carregar visitas: ${err.message}`, "error");
  }
}

async function createVisit() {
  try {
    const poolId = document.getElementById("poolId")?.value;
    const technicianId = document.getElementById("technicianId")?.value;
    const technicianSelect = document.getElementById("technicianId");
    const technicianName = technicianSelect?.options[technicianSelect.selectedIndex]?.text || "Tecnico";
    const plannedDate = document.getElementById("plannedDate")?.value;

    if (!poolId) {
      showStatus("Escolhe a piscina ou jacuzzi.", "error");
      return;
    }

    const data = await fetchJSON(`${API}/visits/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poolId,
        technicianId,
        technicianName,
        plannedDate
      })
    });

    showStatus("Visita planeada com sucesso.", "ok");
    loadVisits();
  } catch (err) {
    console.error(err);
    showStatus(`Erro ao criar visita: ${err.message}`, "error");
  }
}

window.loadVisits = loadVisits;
window.createVisit = createVisit;

window.onload = () => {
  const dateFilter = document.getElementById("visitDateFilter");
  const plannedDate = document.getElementById("plannedDate");

  if (dateFilter && !dateFilter.value) dateFilter.value = todayDateValue();
  if (plannedDate && !plannedDate.value) plannedDate.value = nowDateTimeValue();

  loadPools();
  loadTechnicians();
  loadVisits();
};
