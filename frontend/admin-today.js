const API = "/api/core";
const CONTEXT_KEY = "cw-admin-today-context";

const state = {
  visits: [],
  filter: "",
  restoreScrollY: null,
  scrollRestored: false,
  navigationLocked: false,
};

const $ = (selector) => document.querySelector(selector);

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char]));
}

function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function statusTone(status) {
  const value = normalize(status).replaceAll("_", " ");
  if (value.includes("done") || value.includes("conclu")) return "done";
  if (value.includes("not done") || value.includes("cancel")) return "not-done";
  if (value.includes("pend") || value.includes("planned") || value.includes("progress")) return "pending";
  return "other";
}

function formatStatus(status) {
  const value = String(status || "").trim();
  if (!value) return "Sem estado";
  return value.replaceAll("_", " ");
}

function countByTone(visits = []) {
  return visits.reduce((acc, visit) => {
    const tone = statusTone(visit.status);
    if (tone === "done") acc.done += 1;
    else if (tone === "not-done") acc.notDone += 1;
    else acc.pending += 1;
    return acc;
  }, { done: 0, pending: 0, notDone: 0 });
}

function formatDate(value) {
  if (!value) return "sem horario";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setStatus(text, tone) {
  const el = $("#status");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("status-critical", "status-warn", "status-ok");
  if (tone === "critical") el.classList.add("status-critical");
  if (tone === "warn") el.classList.add("status-warn");
  if (tone === "ok") el.classList.add("status-ok");
}

function writeContext(force = false) {
  if (state.navigationLocked && !force) return;
  const payload = {
    filter: state.filter,
    scrollY: window.scrollY,
  };
  sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(payload));
}

function readContext() {
  const raw = sessionStorage.getItem(CONTEXT_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.filter = String(parsed.filter || "");
    state.restoreScrollY = Number.isFinite(parsed.scrollY) ? parsed.scrollY : null;
    state.scrollRestored = false;
    const search = $("#searchVisits");
    if (search) search.value = state.filter;
  } catch (_error) {
    sessionStorage.removeItem(CONTEXT_KEY);
  }
}

function restoreScrollIfNeeded() {
  if (state.scrollRestored || !Number.isFinite(state.restoreScrollY)) return;
  const targetY = state.restoreScrollY;
  let attempts = 0;
  const tryRestore = () => {
    window.scrollTo({ top: targetY, behavior: "auto" });
    attempts += 1;
    if (Math.abs(window.scrollY - targetY) <= 8 || attempts >= 10) {
      state.scrollRestored = true;
      return;
    }
    requestAnimationFrame(tryRestore);
  };
  requestAnimationFrame(tryRestore);
}

function matchesFilter(visit, filter) {
  if (!filter) return true;
  const pool = visit.pool?.name || "";
  const client = visit.client?.name || "";
  const technician = visit.technician?.name || visit.technicianName || "";
  const status = formatStatus(visit.status);
  const bag = normalize(`${pool} ${client} ${technician} ${status}`);
  return bag.includes(normalize(filter));
}

function bucketKey(visit) {
  const status = normalize(visit.status).replaceAll("_", " ");
  if (status.includes("done") || status.includes("conclu")) return "done";
  if (status.includes("progress") || status.includes("execu")) return "in_progress";

  const when = new Date(visit.plannedDate || visit.date || visit.scheduledAt || visit.createdAt || 0).getTime();
  if (Number.isFinite(when) && when < Date.now()) return "late";
  return "upcoming";
}

function renderVisitItem(visit) {
  const pool = visit.pool?.name || "Piscina sem nome";
  const client = visit.client?.name || "Cliente nao definido";
  const technician = visit.technician?.name || visit.technicianName || "Sem tecnico";
  const status = formatStatus(visit.status);
  const tone = statusTone(status);
  const scheduledAt = visit.plannedDate || visit.date || visit.scheduledAt || visit.createdAt;
  const visitId = visit.id ? `#${visit.id}` : "";
  return `
    <article class="cw-today-item">
      <div class="cw-today-item-main">
        <b>${esc(pool)}</b>
        <div class="meta">${esc(client)} · ${esc(technician)} · ${esc(formatDate(scheduledAt))}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="cw-status-pill ${esc(tone)}">${esc(status)}</span>
        <a class="cw-v2-btn" href="/admin-visits${visit.id ? `?visitId=${encodeURIComponent(visit.id)}` : ""}">Abrir ${esc(visitId)}</a>
      </div>
    </article>
  `;
}

function renderList() {
  const list = $("#listGroups");
  if (!list) return;

  const shown = state.visits.filter((visit) => matchesFilter(visit, state.filter));
  if (!shown.length) {
    list.innerHTML = '<div class="cw-v2-state-empty">Sem visitas para este filtro. Ajusta o termo ou abre o planeamento.</div>';
    return;
  }

  const groups = {
    late: { title: "Atrasadas", items: [] },
    in_progress: { title: "Em execução", items: [] },
    upcoming: { title: "Próximas", items: [] },
    done: { title: "Concluídas", items: [] },
  };

  shown.forEach((visit) => {
    const key = bucketKey(visit);
    groups[key].items.push(visit);
  });

  list.innerHTML = Object.values(groups).map((group) => `
    <section class="cw-list-group">
      <header>
        <h3>${esc(group.title)}</h3>
        <span class="pill">${group.items.length}</span>
      </header>
      <div class="cw-list">
        ${group.items.length ? group.items.map(renderVisitItem).join("") : '<div class="cw-v2-state-empty">Sem itens neste grupo.</div>'}
      </div>
    </section>
  `).join("");
}

function renderSummary(summary) {
  $("#total").textContent = Number(summary.total || 0);
  $("#done").textContent = Number(summary.done || 0);
  $("#pending").textContent = Number(summary.pending || 0);
  $("#notDone").textContent = Number(summary.notDone || 0);

  const issues = Number(summary.pending || 0) + Number(summary.notDone || 0);
  if (issues === 0) {
    setStatus("Dia estavel: sem pendencias criticas.", "ok");
  } else if (Number(summary.notDone || 0) > 0) {
    setStatus(`Atencao: ${issues} visita(s) exigem acao.`, "critical");
  } else {
    setStatus(`Existem ${issues} visita(s) pendentes para fechar.`, "warn");
  }
}

function fromCoreDashboardPayload(data) {
  const visits = Array.isArray(data.nextVisits) ? data.nextVisits : [];
  const counts = countByTone(visits);
  return {
    visits,
    summary: {
      total: visits.length,
      done: counts.done,
      pending: counts.pending,
      notDone: counts.notDone,
    },
  };
}

async function load() {
  const refresh = $("#refreshBtn");
  try {
    if (refresh) {
      refresh.disabled = true;
      refresh.textContent = "A atualizar...";
    }

    const response = await fetch(`${API}/dashboard`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || `Erro HTTP ${response.status}`);
    }

    const mapped = fromCoreDashboardPayload(data);
    state.visits = mapped.visits;
    renderSummary(mapped.summary);
    renderList();
    restoreScrollIfNeeded();
    setTimeout(restoreScrollIfNeeded, 160);
  } catch (error) {
    setStatus(error.message || "Erro ao carregar operacao de hoje.", "critical");
    const list = $("#listGroups");
    if (list) list.innerHTML = '<div class="cw-v2-state-error">Falha ao carregar visitas. Tenta atualizar novamente.</div>';
  } finally {
    if (refresh) {
      refresh.disabled = false;
      refresh.textContent = "Atualizar";
    }
  }
}

function bind() {
  const refresh = $("#refreshBtn");
  if (refresh) refresh.addEventListener("click", load);

  const search = $("#searchVisits");
  if (search) {
    search.addEventListener("input", (event) => {
      state.filter = String(event.target.value || "");
      renderList();
      writeContext();
    });
  }

  window.addEventListener("scroll", writeContext, { passive: true });
  window.addEventListener("cw:navigate-away", () => {
    writeContext(true);
    state.navigationLocked = true;
  });

  document.addEventListener("click", (event) => {
    const action = event.target.closest('[data-cw-action="menu"],[data-cw-action="home"],[data-cw-action="back"]');
    if (!action) return;
    writeContext(true);
    state.navigationLocked = true;
  });

  const stamp = $("#todayDate");
  if (stamp) {
    stamp.textContent = new Date().toLocaleString("pt-PT", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  readContext();
  bind();
  load();
});