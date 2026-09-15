const state = {
  pools: [],
  poolReminders: [],
  generalReminders: [],
};
const initialPoolId = new URLSearchParams(location.search).get("poolId");
const completingPoolReminders = new Set();
let removePoolReminder;

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
  const token = window.CristalAuth?.getToken?.() || localStorage.getItem("cristalwater_jwt") || localStorage.getItem("token");
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
        <h3 data-cw-no-i18n>${esc(lead.name)}</h3>
        <span class="badge">${esc(lead.status)}</span>
      </header>
      <p>${esc(lead.phone || "")}${lead.zone ? ` - ${esc(lead.zone)}` : ""}</p>
      <p class="muted" data-cw-no-i18n>${esc(lead.notes || "")}</p>
      <div class="actions">
        <button class="btn" type="button" onclick="convertLead(${Number(lead.id)})">Converter cliente</button>
        <button class="btn" type="button" onclick="addActivity(${Number(lead.id)})">Nota</button>
      </div>
    </div>
  `).join("") || '<p class="muted">Sem leads.</p>';
}

function renderGeneralReminders(reminders) {
  state.generalReminders = (reminders || []).filter(item => !window.CwReminderDelete.wasDeleted(item.id));
  el("reminders").innerHTML = state.generalReminders.map((item) => `
    <div class="card">
      <header>
        <h3 data-cw-no-i18n>${esc(item.title)}</h3>
        <span class="badge ${item.status === "DONE" ? "done" : ""}">${esc(item.category || "GENERAL")}</span>
      </header>
      <p>${formatDate(item.dueAt)}</p>
      <p class="muted" data-cw-no-i18n>${esc(item.description || "")}</p>
      ${item.status === "DONE" ? '<span class="badge done">Concluido</span>' : `<button class="btn" type="button" data-complete-reminder="${Number(item.id)}" ${completingPoolReminders.has(String(item.id)) || window.CwReminderDelete.busy(item.id) ? 'disabled' : ''} onclick="completeReminder(${Number(item.id)})">Concluir</button>`}
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
          <h3 data-cw-no-i18n>${esc(item.title)}</h3>
          <span class="badge ${priority === "HIGH" ? "warn" : ""}">${esc(priority)}</span>
        </header>
        <p><strong data-cw-no-i18n>${esc(pool?.name || "Piscina")}</strong></p>
        <p class="muted" data-cw-no-i18n>${esc(client?.name || "Cliente")} ${pool?.zone ? `- ${esc(pool.zone)}` : ""}</p>
        <p>Aviso: ${formatDate(item.dueDate || item.dueAt)}</p>
        <p>Evento: ${formatDate(eventAt)}</p>
        <p class="muted">${esc(days || "")}</p>
        ${notes ? `<p class="muted" data-cw-no-i18n>${esc(notes)}</p>` : ""}
        <div class="actions">
          ${completed ? '<span class="badge done">Concluido</span>' : `<button class="btn primary" type="button" data-complete-reminder="${Number(item.id)}" ${completingPoolReminders.has(String(item.id)) || window.CwReminderDelete.busy(item.id) ? 'disabled' : ''} onclick="completePoolReminder(${Number(item.id)}, ${Number(item.poolId || 0)})">Concluir</button>`}
          <button class="btn danger" type="button" data-delete-reminder="${Number(item.id)}" ${completingPoolReminders.has(String(item.id)) || window.CwReminderDelete.busy(item.id) ? 'disabled' : ''} onclick="deletePoolReminder(${Number(item.id)}, ${Number(item.poolId || 0)})">Eliminar</button>
          ${item.poolId ? `<a class="btn" href="/admin-pool-technical?poolId=${Number(item.poolId)}">Ficha piscina</a>` : ""}
        </div>
      </div>
    `;
  }).join("") || '<p class="muted">Sem lembretes por piscina.</p>';
}

async function loadPoolReminders() {
  const authorization = authHeaders().Authorization;
  const poolId = el("poolReminderFilter").value;
  const data = await api("/api/crm/reminders?category=TECHNICAL_PERIODIC_SERVICE");
  if (authorization !== authHeaders().Authorization) return;
  state.poolReminders = (data.reminders || [])
    .filter(item => !window.CwReminderDelete.wasDeleted(item.id))
    .filter((item) => !item.completedAt && !["DONE", "COMPLETED", "CLOSED", "RESOLVED", "CANCELLED", "CANCELED"].includes(item.status))
    .filter((item) => !poolId || String(item.poolId) === String(poolId));
  renderPoolReminders(state.poolReminders);
}

async function loadAll() {
  const authorization = authHeaders().Authorization;
  el("poolReminderStatus").textContent = "A carregar dados...";
  const [leads, generalReminders, pools] = await Promise.all([
    api("/api/crm/leads"),
    api("/api/crm/reminders"),
    api("/api/core/pools?includeInactive=true"),
  ]);
  if (authorization !== authHeaders().Authorization) return;
  state.pools = pools.pools || [];
  renderPoolOptions();
  renderLeads(leads.leads || []);
  renderGeneralReminders(generalReminders.reminders || []);
  await loadPoolReminders();
  if (authorization !== authHeaders().Authorization) return;
  el("poolReminderStatus").textContent = "";
  updateReminderPreview();
  if (!poolReminderCreator) setupReminderCreators();
  else { poolReminderCreator.refresh(); generalReminderCreator.refresh(); }
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

let poolReminderCreator, generalReminderCreator;
function preparePoolReminder() {
  const data = Object.fromEntries([...el('poolReminderForm').querySelectorAll('[name]')].map(input => [input.name, input.value]));
  const days = Number(data.daysBefore || 0), eventAt = new Date(data.eventAt);
  if (!data.title.trim() || !data.poolId || !Number.isFinite(eventAt.getTime()) || !Number.isInteger(days) || days < 0 || days > 365) throw Error('Indica piscina, titulo, data e antecedencia entre 0 e 365 dias.');
  const pool = poolById(data.poolId);
  const description = [
    `Acao: ${data.title}`, `Evento: ${eventAt.toISOString()}`, `Avisar: ${days} dia(s) antes`,
    `Prioridade: ${data.priority || 'NORMAL'}`, pool ? `Piscina: ${pool.name || '#' + pool.id}` : null,
    pool?.client ? `Cliente: ${pool.client.name}` : null,
    data.description.trim() ? `Notas: ${data.description.replace(/\r?\n/g, ' ').trim()}` : null,
  ].filter(Boolean).join('\n');
  return { path: `/api/core/pools/${data.poolId}/service-reminders`, body: {
    title: data.title.trim(), dueAt: new Date(eventAt.getTime() - days * 86400000).toISOString(),
    priority: data.priority || 'NORMAL', repeatRule: 'NONE', description,
  } };
}
function setupReminderCreators() {
  poolReminderCreator = CwReminderCreate.attach({
    scope: 'crm-pool', button: 'createPoolReminderBtn', status: 'poolReminderStatus',
    fields: ['poolReminderPool', 'poolReminderTitle', 'poolReminderEventAt', 'poolReminderDaysBefore', 'poolReminderPriority', 'poolReminderDescription'],
    validPath: path => typeof path === 'string' && /^\/api\/core\/pools\/[1-9]\d*\/service-reminders$/.test(path),
    prepare: preparePoolReminder, onRestore: updateReminderPreview,
    async onSuccess() { el('poolReminderForm').reset(); el('poolReminderDaysBefore').value = '1'; updateReminderPreview(); await loadPoolReminders(); },
  });
  generalReminderCreator = CwReminderCreate.attach({
    scope: 'crm-general', button: 'createGeneralReminderBtn', status: 'generalReminderStatus',
    fields: ['generalReminderTitle', 'generalReminderDueAt', 'generalReminderCategory', 'generalReminderDescription'],
    validPath: path => path === '/api/crm/reminders',
    prepare() {
      const dueAt = new Date(el('generalReminderDueAt').value), title = el('generalReminderTitle').value.trim();
      if (!title || !Number.isFinite(dueAt.getTime())) throw Error('Indica titulo e data.');
      return { path: '/api/crm/reminders', body: { title, dueAt: dueAt.toISOString(), category: el('generalReminderCategory').value, description: el('generalReminderDescription').value } };
    },
    async onSuccess(_result, current) { el('reminderForm').reset(); const data = await api('/api/crm/reminders'); if (current()) renderGeneralReminders(data.reminders || []); },
  });
}

function reminderActionButtons(id) {
  return [...document.querySelectorAll('[data-complete-reminder], [data-delete-reminder]')]
    .filter(button => (button.dataset.completeReminder || button.dataset.deleteReminder) === String(id));
}
function setReminderCompleting(id, busy) {
  if (busy) completingPoolReminders.add(String(id)); else completingPoolReminders.delete(String(id));
  reminderActionButtons(id).forEach(button => { button.disabled = busy || window.CwReminderDelete.busy(id); });
}

async function completePoolReminder(id, poolId) {
  if (!poolId) return alert("Este lembrete nao tem piscina associada.");
  const key = String(id);
  if (completingPoolReminders.has(key) || window.CwReminderDelete.busy(id) || window.CwReminderDelete.wasDeleted(id)) return;
  setReminderCompleting(id, true);
  try {
    await api(`/api/core/pools/${encodeURIComponent(poolId)}/service-reminders/${encodeURIComponent(id)}/complete`, { method: "POST" });
    await loadPoolReminders();
  } finally { setReminderCompleting(id, false); }
}

async function deletePoolReminder(id, poolId) {
  await removePoolReminder(id);
}

async function completeReminder(id) {
  const key = String(id);
  if (completingPoolReminders.has(key) || window.CwReminderDelete.busy(id) || window.CwReminderDelete.wasDeleted(id)) return;
  setReminderCompleting(id, true);
  try {
    await api(`/api/crm/reminders/${encodeURIComponent(id)}/complete`, { method: "POST" });
    const generalReminders = await api("/api/crm/reminders");
    renderGeneralReminders(generalReminders.reminders || []);
  } finally { setReminderCompleting(id, false); }
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

el('reminderForm').addEventListener('submit', event => { event.preventDefault(); generalReminderCreator?.submit(); });
el('poolReminderForm').addEventListener('submit', event => { event.preventDefault(); poolReminderCreator?.submit(); });
el("poolReminderFilter").addEventListener("change", () => {
  loadPoolReminders().catch((error) => {
    el("poolReminders").innerHTML = `<p class="muted">${esc(error.message)}</p>`;
  });
});
el("poolReminderEventAt").addEventListener("input", updateReminderPreview);
el("poolReminderDaysBefore").addEventListener("input", updateReminderPreview);
el("refreshAll").addEventListener("click", () => loadAll().catch((error) => alert(error.message)));

window.completePoolReminder = completePoolReminder;
removePoolReminder = window.CwReminderDelete.attach({
  status: 'poolReminderStatus', get: id => state.poolReminders.find(row => String(row.id) === String(id)),
  poolLabel: row => `${poolById(row.poolId)?.name || 'Piscina'} (#${row.poolId})`, reload: loadPoolReminders,
  isCompleting: id => completingPoolReminders.has(String(id)),
  buttons: reminderActionButtons,
  onDeleted(id) {
    state.poolReminders = state.poolReminders.filter(row => String(row.id) !== String(id)); renderPoolReminders(state.poolReminders);
    renderGeneralReminders(state.generalReminders);
  },
});
window.deletePoolReminder = deletePoolReminder;
window.completeReminder = completeReminder;
window.convertLead = convertLead;
window.addActivity = addActivity;

loadAll().catch((error) => {
  el("poolReminderStatus").textContent = error.message;
});
