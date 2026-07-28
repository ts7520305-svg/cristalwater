const state = {
  pools: [],
  poolReminders: [],
};
const initialPoolId = new URLSearchParams(location.search).get("poolId");

function el(id) {
  return document.getElementById(id);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"]/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[m]));
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function authHeaders() {
  const token = localStorage.getItem("cwAdminToken") || localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Erro ${response.status}`);
  }
  return data;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

function poolLabel(pool) {
  const client = pool.client?.name || "Sem cliente";
  const zone = pool.zone || pool.location || pool.address || "";
  const name = pool.name || pool.type || `Piscina #${pool.id}`;
  return `${name} - ${client}${zone ? ` - ${zone}` : ""}`;
}

function poolById(poolId) {
  return state.pools.find((pool) => String(pool.id) === String(poolId));
}

function extractLine(description, label) {
  const match = String(description || "").match(new RegExp(`^${label}:\\s*(.+)$`, "mi"));
  return match ? match[1].trim() : "";
}

function renderPoolOptions() {
  const options = state.pools
    .map((pool) => `<option value="${esc(pool.id)}">${esc(poolLabel(pool))}</option>`)
    .join("");

  el("poolReminderPool").innerHTML = `<option value="">Escolher piscina ou jacuzzi</option>${options}`;
  const currentFilter = el("poolReminderFilter").value;
  el("poolReminderFilter").innerHTML = `<option value="">Todas as piscinas</option>${options}`;
  const targetPoolId = currentFilter || initialPoolId;
  if (targetPoolId && state.pools.some((pool) => String(pool.id) === String(targetPoolId))) {
    el("poolReminderPool").value = targetPoolId;
    el("poolReminderFilter").value = targetPoolId;
  }
}

function renderLeads(leads) {
  el("leads").innerHTML = (leads || []).map((lead) => `
    <div class="card">
      <header>
        <h3>${esc(lead.name)}</h3>
        <span class="badge">${esc(lead.status)}</span>
      </header>
      <p>${esc(lead.phone || "")}${lead.zone ? ` - ${esc(lead.zone)}` : ""}</p>
      <p class="muted">${esc(lead.notes || "")}</p>
      <div class="actions">
        <button class="btn" type="button" onclick="convertLead(${Number(lead.id)})">Converter cliente</button>
        <button class="btn" type="button" onclick="addActivity(${Number(lead.id)})">Nota</button>
      </div>
    </div>
  `).join("") || '<p class="muted">Sem leads.</p>';
}

function renderGeneralReminders(reminders) {
  el("reminders").innerHTML = (reminders || []).map((item) => `
    <div class="card">
      <header>
        <h3>${esc(item.title)}</h3>
        <span class="badge ${item.status === "DONE" ? "done" : ""}">${esc(item.category || "GENERAL")}</span>
      </header>
      <p>${formatDate(item.dueAt)}</p>
      <p class="muted">${esc(item.description || "")}</p>
      ${item.status === "DONE" ? '<span class="badge done">Concluido</span>' : `<button class="btn" type="button" onclick="completeReminder(${Number(item.id)})">Concluir</button>`}
    </div>
  `).join("") || '<p class="muted">Sem lembretes gerais.</p>';
}

function renderPoolReminders(reminders) {
  el("poolReminders").innerHTML = (reminders || []).map((item) => {
    const pool = item.pool || poolById(item.poolId);
    const client = item.client || pool?.client;
    const eventAt = extractLine(item.description, "Evento");
    const days = extractLine(item.description, "Avisar");
    const priority = extractLine(item.description, "Prioridade") || "NORMAL";
    const notes = extractLine(item.description, "Notas");
    const completed = item.isCompleted || item.status === "DONE";
    return `
      <div class="card">
        <header>
          <h3>${esc(item.title)}</h3>
          <span class="badge ${priority === "HIGH" ? "warn" : ""}">${esc(priority)}</span>
        </header>
        <p><strong>${esc(pool?.name || "Piscina")}</strong></p>
        <p class="muted">${esc(client?.name || "Cliente")} ${pool?.zone ? `- ${esc(pool.zone)}` : ""}</p>
        <p>Aviso: ${formatDate(item.dueDate || item.dueAt)}</p>
        <p>Evento: ${formatDate(eventAt)}</p>
        <p class="muted">${esc(days || "")}</p>
        ${notes ? `<p class="muted">${esc(notes)}</p>` : ""}
        <div class="actions">
          ${completed ? '<span class="badge done">Concluido</span>' : `<button class="btn primary" type="button" onclick="completePoolReminder(${Number(item.id)}, ${Number(item.poolId || 0)})">Concluir</button>`}
          <button class="btn danger" type="button" onclick="deletePoolReminder(${Number(item.id)}, ${Number(item.poolId || 0)})">Eliminar</button>
          ${item.poolId ? `<a class="btn" href="/admin-pool-technical?poolId=${Number(item.poolId)}">Ficha piscina</a>` : ""}
        </div>
      </div>
    `;
  }).join("") || '<p class="muted">Sem lembretes por piscina.</p>';
}

async function loadPoolReminders() {
  const poolId = el("poolReminderFilter").value;
  const data = await api("/api/crm/reminders?category=TECHNICAL_PERIODIC_SERVICE");
  state.poolReminders = (data.reminders || [])
    .filter((item) => item.status !== "DONE")
    .filter((item) => !poolId || String(item.poolId) === String(poolId));
  renderPoolReminders(state.poolReminders);
}

async function loadAll() {
  el("poolReminderStatus").textContent = "A carregar dados...";
  const [leads, generalReminders, pools] = await Promise.all([
    api("/api/crm/leads"),
    api("/api/crm/reminders"),
    api("/api/core/pools?includeInactive=true"),
  ]);
  state.pools = pools.pools || [];
  renderPoolOptions();
  renderLeads(leads.leads || []);
  renderGeneralReminders(generalReminders.reminders || []);
  await loadPoolReminders();
  el("poolReminderStatus").textContent = "";
  updateReminderPreview();
}

function updateReminderPreview() {
  const eventValue = el("poolReminderEventAt").value;
  const daysBefore = Number(el("poolReminderDaysBefore").value || 0);
  const target = el("poolReminderPreview");
  const eventAt = eventValue ? new Date(eventValue) : null;
  if (!eventAt || Number.isNaN(eventAt.getTime())) {
    target.textContent = "Escolhe a data do evento para calcular o aviso.";
    return;
  }
  const dueAt = new Date(eventAt.getTime() - daysBefore * 24 * 60 * 60 * 1000);
  target.textContent = `Aviso programado para ${formatDate(dueAt)}. Evento em ${formatDate(eventAt)}.`;
}

async function createPoolReminder(event) {
  event.preventDefault();
  const form = event.target;
  const data = formValues(form);
  data.daysBefore = Number(data.daysBefore || 0);
  const eventAt = new Date(data.eventAt);
  const dueAt = new Date(eventAt.getTime() - data.daysBefore * 24 * 60 * 60 * 1000);
  const pool = poolById(data.poolId);
  const cleanNotes = String(data.description || "").replace(/\r?\n/g, " ").trim();
  const description = [
    `Acao: ${data.title}`,
    `Evento: ${eventAt.toISOString()}`,
    `Avisar: ${data.daysBefore} dia(s) antes`,
    `Prioridade: ${data.priority || "NORMAL"}`,
    pool ? `Piscina: ${pool.name || `#${pool.id}`}` : null,
    pool?.client ? `Cliente: ${pool.client.name}` : null,
    cleanNotes ? `Notas: ${cleanNotes}` : null,
  ].filter(Boolean).join("\n");
  el("poolReminderStatus").textContent = "A guardar lembrete...";
  await api(`/api/core/pools/${encodeURIComponent(data.poolId)}/service-reminders`, {
    method: "POST",
    body: JSON.stringify({
      title: data.title,
      dueAt: dueAt.toISOString(),
      priority: data.priority || "NORMAL",
      repeatRule: "NONE",
      description,
    }),
  });
  form.reset();
  el("poolReminderDaysBefore").value = "1";
  el("poolReminderStatus").textContent = "Lembrete criado e ligado a piscina.";
  updateReminderPreview();
  await loadPoolReminders();
}

async function completePoolReminder(id, poolId) {
  if (!poolId) return alert("Este lembrete nao tem piscina associada.");
  await api(`/api/core/pools/${encodeURIComponent(poolId)}/service-reminders/${encodeURIComponent(id)}/complete`, { method: "POST" });
  await loadPoolReminders();
}

async function deletePoolReminder(id, poolId) {
  if (!confirm("Eliminar este lembrete da piscina?")) return;
  if (!poolId) return alert("Este lembrete nao tem piscina associada.");
  await api(`/api/core/pools/${encodeURIComponent(poolId)}/service-reminders/${encodeURIComponent(id)}`, { method: "DELETE" });
  await loadPoolReminders();
}

async function completeReminder(id) {
  await api(`/api/crm/reminders/${encodeURIComponent(id)}/complete`, { method: "POST" });
  const generalReminders = await api("/api/crm/reminders");
  renderGeneralReminders(generalReminders.reminders || []);
}

async function convertLead(id) {
  if (!confirm("Converter este lead em cliente e criar piscina base?")) return;
  await api(`/api/crm/leads/${encodeURIComponent(id)}/convert`, { method: "POST", body: "{}" });
  await loadAll();
}

async function addActivity(id) {
  const description = prompt("Nota do contacto/follow-up:");
  if (!description) return;
  await api(`/api/crm/leads/${encodeURIComponent(id)}/activity`, {
    method: "POST",
    body: JSON.stringify({ type: "NOTE", title: "Nota", description }),
  });
  await loadAll();
}

el("leadForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/crm/leads", { method: "POST", body: JSON.stringify(formValues(event.target)) });
    event.target.reset();
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
});

el("reminderForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = formValues(event.target);
    data.dueAt = new Date(data.dueAt).toISOString();
    await api("/api/crm/reminders", { method: "POST", body: JSON.stringify(data) });
    event.target.reset();
    const generalReminders = await api("/api/crm/reminders");
    renderGeneralReminders(generalReminders.reminders || []);
  } catch (error) {
    alert(error.message);
  }
});

el("poolReminderForm").addEventListener("submit", (event) => {
  createPoolReminder(event).catch((error) => {
    el("poolReminderStatus").textContent = error.message;
  });
});
el("poolReminderFilter").addEventListener("change", () => {
  loadPoolReminders().catch((error) => {
    el("poolReminders").innerHTML = `<p class="muted">${esc(error.message)}</p>`;
  });
});
el("poolReminderEventAt").addEventListener("input", updateReminderPreview);
el("poolReminderDaysBefore").addEventListener("input", updateReminderPreview);
el("refreshAll").addEventListener("click", () => loadAll().catch((error) => alert(error.message)));

window.completePoolReminder = completePoolReminder;
window.deletePoolReminder = deletePoolReminder;
window.completeReminder = completeReminder;
window.convertLead = convertLead;
window.addActivity = addActivity;

loadAll().catch((error) => {
  el("poolReminderStatus").textContent = error.message;
});
