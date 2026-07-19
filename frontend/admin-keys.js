const state = {
  clients: [],
  pools: [],
  technicians: [],
  keys: [],
  lastReportRows: [],
  lastReportName: "cristal-water-lista"
};
const ui = window.CwUi || {
  success: (m) => console.log(m),
  error: (m) => console.error(m),
  info: (m) => console.info(m),
  confirm: async () => false,
  safeError: (err, fallback) => (err && err.message) || fallback,
};

async function api(url, options = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cw_token") || "";
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : undefined,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({ ok: false, error: "Resposta invalida" }));
  if (!response.ok || data.ok === false) throw new Error(data.error || `Erro ${response.status}`);
  return data;
}

function asArray(data, key) {
  return Array.isArray(data) ? data : (data?.[key] || []);
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

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(csvValue).join(";"),
    ...rows.map((row) => headers.map((key) => csvValue(row[key])).join(";"))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
}

function clientPools(clientId) {
  return state.pools.filter((pool) => Number(pool.clientId) === Number(clientId));
}

function renderReport(title, rows, filename) {
  const node = document.getElementById("keyReports");
  if (!node) return;

  state.lastReportRows = rows;
  state.lastReportName = filename;

  if (!rows.length) {
    node.className = "empty";
    node.innerHTML = "Sem dados para esta lista.";
    return;
  }

  const headers = Object.keys(rows[0]);
  node.className = "";
  node.innerHTML = `
    <div class="report-head">
      <div>
        <b>${esc(title)}</b>
        <p class="hint">${esc(rows.length)} linha(s) geradas.</p>
      </div>
      <button class="muted" onclick="downloadCurrentReport()">Descarregar CSV</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function val(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function setStatus(message) {
  const node = document.getElementById("keyStatus");
  if (node) node.textContent = message || "";
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

function clientLabel(client) {
  return [client.name, client.zone, client.address].filter(Boolean).join(" - ") || `Cliente ${client.id}`;
}

function poolLabel(pool) {
  const client = pool.client?.name || state.clients.find((item) => Number(item.id) === Number(pool.clientId))?.name;
  return [pool.name || `Piscina ${pool.id}`, pool.zone || pool.location, client].filter(Boolean).join(" - ");
}

function selectedClientPools() {
  const clientId = val("clientId");
  return state.pools.filter((pool) => !clientId || Number(pool.clientId) === Number(clientId));
}

function renderClientOptions(selectedId = val("clientId")) {
  const select = document.getElementById("clientId");
  if (!select) return;
  select.innerHTML = '<option value="">Selecionar cliente para chave geral</option>' + state.clients.map((client) => `
    <option value="${esc(client.id)}" ${String(selectedId) === String(client.id) ? "selected" : ""}>
      ${esc(clientLabel(client))}
    </option>
  `).join("");
}

function renderPoolOptions(selectedId = val("poolId")) {
  const select = document.getElementById("poolId");
  if (!select) return;
  const pools = selectedClientPools();
  select.innerHTML = '<option value="">Chave geral do cliente / sem piscina</option>' + pools.map((pool) => `
    <option value="${esc(pool.id)}" ${String(selectedId) === String(pool.id) ? "selected" : ""}>
      ${esc(poolLabel(pool))}
    </option>
  `).join("");
}

function renderTechnicianOptions() {
  const select = document.getElementById("technicianId");
  if (!select) return;
  select.innerHTML = '<option value="">Todos os tecnicos</option>' + state.technicians.map((tech) => `
    <option value="${esc(tech.id)}">${esc(tech.name || `Tecnico ${tech.id}`)}</option>
  `).join("");
}

async function loadOptions() {
  const [clientsResult, poolsResult, techResult] = await Promise.allSettled([
    api("/api/core/clients?includeInactive=1"),
    api("/api/core/pools?includeInactive=1"),
    api("/api/core/technicians?includeInactive=1"),
  ]);

  if (clientsResult.status === "fulfilled") state.clients = asArray(clientsResult.value, "clients");
  if (poolsResult.status === "fulfilled") state.pools = asArray(poolsResult.value, "pools");
  if (techResult.status === "fulfilled") state.technicians = asArray(techResult.value, "technicians");

  renderClientOptions();
  renderPoolOptions();
  renderTechnicianOptions();
  applyQueryPrefill();
}

function applyQueryPrefill() {
  const params = new URLSearchParams(location.search);
  const poolId = params.get("poolId");
  const clientId = params.get("clientId");
  if (poolId) {
    const pool = state.pools.find((item) => String(item.id) === String(poolId));
    if (pool?.clientId) renderClientOptions(pool.clientId);
    renderPoolOptions(poolId);
    return;
  }
  if (clientId) {
    renderClientOptions(clientId);
    renderPoolOptions();
  }
}

function syncClientFromPool() {
  const pool = state.pools.find((item) => String(item.id) === String(val("poolId")));
  if (pool?.clientId && String(val("clientId")) !== String(pool.clientId)) {
    renderClientOptions(pool.clientId);
    renderPoolOptions(pool.id);
  }
}

async function saveKey() {
  try {
    const body = {
      clientId: val("clientId") || null,
      poolId: val("poolId") || null,
      codeValue: val("codeValue"),
      title: val("title"),
      instructions: val("instructions"),
      visibleToTechnician: true,
      requiredForVisit: true
    };

    if (!body.clientId && !body.poolId) {
      ui.error("Escolhe o cliente ou a piscina/jacuzzi.");
      return;
    }
    if (!body.codeValue) {
      ui.error("Indica o codigo da chave/acesso.");
      return;
    }

    const data = await api("/api/keys", { method: "POST", body: JSON.stringify(body) });
    ["codeValue", "title", "instructions"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.value = "";
    });
    await loadKeys();
    setStatus(body.poolId
      ? "Chave guardada e associada a ficha tecnica da piscina."
      : "Chave geral do cliente guardada.");
    if (data.key?.pool?.id || body.poolId) {
      await loadMorningKeys().catch(() => {});
    }
  } catch (error) {
    ui.error(ui.safeError(error, "Nao foi possivel guardar a chave."));
  }
}

async function archiveKey(id) {
  const ok = await ui.confirm("Arquivar esta chave?", { title: "Confirmar arquivo", confirmText: "Arquivar", danger: true });
  if (!ok) return;
  await api(`/api/keys/${encodeURIComponent(id)}/archive`, { method: "POST" });
  loadKeys();
}

async function restoreKey(id) {
  await api(`/api/keys/${encodeURIComponent(id)}/restore`, { method: "POST" });
  loadKeys();
}

async function hardDeleteKey(id) {
  const ok = await ui.confirm("Apagar definitivamente?", { title: "Confirmar eliminacao", confirmText: "Apagar", danger: true });
  if (!ok) return;
  await api(`/api/keys/${encodeURIComponent(id)}?mode=hard`, { method: "DELETE" });
  loadKeys();
}

function keyPools(key) {
  if (Array.isArray(key.pools) && key.pools.length) return key.pools;
  return key.pool ? [key.pool] : [];
}

function keyLocation(key) {
  if (key.source === "pool") {
    const pools = keyPools(key);
    return pools.length
      ? pools.map((pool) => `${pool.client?.name || key.clientName || "Cliente"} / ${pool.name || "Piscina"}`).join(", ")
      : `${key.clientName || "Cliente"} / piscina`;
  }
  return `${key.clientName || key.client?.name || "Cliente"} / chave geral`;
}

function keyActions(key, id) {
  const pool = keyPools(key)[0];
  const sheet = pool?.id ? `<a class="btn muted" href="/admin-pool-technical?poolId=${esc(pool.id)}">Ficha piscina</a>` : "";
  return `
    ${sheet}
    ${key.active === false
      ? `<button class="muted" onclick="restoreKey('${esc(id)}')">Restaurar</button>`
      : `<button class="danger" onclick="archiveKey('${esc(id)}')">Arquivar</button>`}
    <button class="danger" onclick="hardDeleteKey('${esc(id)}')">Apagar</button>
  `;
}

async function loadKeys() {
  const data = await api("/api/keys?includeInactive=true");
  const keys = data.keys || [];
  state.keys = keys;
  document.getElementById("keys").innerHTML = keys.length ? keys.map((key) => {
    const id = key.uid || `${key.source || "client"}-${key.id}`;
    const pools = keyPools(key);
    return `
      <div class="row">
        <div class="row-main">
          <b>${esc(key.codeValue || key.keyCode || "-")}</b>
          <span class="pill">${esc(key.source === "pool" ? "Piscina/Jacuzzi" : "Cliente")}</span>
          <span class="pill">${esc(key.title || key.keyName || "Chave")}</span>
          ${key.requiredForVisit ? '<span class="pill">Obrigatoria em ronda</span>' : ""}
          ${key.visibleToTechnician ? '<span class="pill">Visivel ao tecnico</span>' : ""}
          ${key.active === false ? '<span class="pill">Arquivada</span>' : ""}
          <br>
          <small>${esc(keyLocation(key))}</small>
          ${key.instructions || key.description ? `<br><small>${esc(key.instructions || key.description)}</small>` : ""}
          ${pools.length ? `<br><small>Registada na ficha: ${pools.map((pool) => `#${esc(pool.id)} ${esc(pool.name || "Piscina")}`).join(", ")}</small>` : ""}
        </div>
        <div class="row-actions">
          ${keyActions(key, id)}
        </div>
      </div>
    `;
  }).join("") : '<div class="empty">Sem chaves registadas.</div>';
}

async function loadMorningKeys() {
  const date = val("date");
  const tech = val("technicianId");
  const query = new URLSearchParams();
  if (date) query.set("date", date);
  if (tech) query.set("technicianId", tech);
  const data = await api(`/api/keys/required/morning?${query.toString()}`);
  const rows = data.keys || [];
  document.getElementById("morning").innerHTML = `
    <p><b>${esc(data.count)}</b> chave(s)/codigo(s) necessarios para ${esc(data.date || date || "hoje")}.</p>
    ${rows.length ? rows.map((key) => `
      <div class="key-alert">
        <strong>${esc(key.alertText || `${key.technicianName || "Tecnico"} precisa da chave ${key.keyCode}`)}</strong>
        <span class="pill">${esc(key.keyCode || key.keyName || "Chave")}</span>
        ${key.roundName ? `<span class="pill">Ronda: ${esc(key.roundName)}</span>` : ""}
        ${key.plannedDate ? `<span class="pill">${esc(formatDateTime(key.plannedDate))}</span>` : ""}
        <br>
        <small>${esc(key.clientName || "Cliente")} / ${esc(key.poolName || "Piscina")} ${key.poolZone ? `- ${esc(key.poolZone)}` : ""}</small>
        ${key.instructions ? `<br><small>${esc(key.instructions)}</small>` : ""}
        <div class="row-actions" style="margin-top:8px;justify-content:flex-start">
          ${key.poolId ? `<a class="btn muted" href="/admin-pool-technical?poolId=${esc(key.poolId)}">Abrir ficha</a>` : ""}
          ${key.visitId ? `<a class="btn muted" href="/admin-visits">Ver visitas</a>` : ""}
        </div>
      </div>
    `).join("") : '<div class="empty">Sem chaves necessarias para as visitas abertas neste dia.</div>'}
  `;
}

async function generateClientList() {
  if (!state.clients.length || !state.pools.length) {
    await loadOptions();
  }

  const rows = [...state.clients]
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    .map((client) => {
      const pools = Array.isArray(clientPools(client.id)) ? clientPools(client.id) : [];
      return {
        "Cliente ID": client.id,
        "Cliente": client.name || "",
        "Zona": client.zone || "",
        "Telefone": client.phone || client.telephone || "",
        "Email": client.email || "",
        "Piscinas/Jacuzzis": pools.length,
        "Referencias": pools.map((pool) => `#${pool.id} ${pool.name || "Piscina"} (${pool.zone || pool.location || "-"})`).join(" | "),
        "Estado": client.status || (client.active === false ? "Inativo" : "Ativo")
      };
    });

  renderReport("Lista de clientes com piscinas/jacuzzis", rows, "cristal-water-clientes-piscinas");
}

async function generateKeyReferenceList() {
  if (!state.keys.length) {
    await loadKeys();
  }

  const rows = [];

  for (const key of state.keys) {
    const pools = Array.isArray(keyPools(key)) ? keyPools(key) : [];
    const base = {
      "Chave/Codigo": key.codeValue || key.keyCode || "",
      "Nome": key.title || key.keyName || "Chave",
      "Tipo": key.source === "pool" ? "Piscina/Jacuzzi" : "Cliente",
      "Visivel tecnico": key.visibleToTechnician ? "Sim" : "Nao",
      "Obrigatoria ronda": key.requiredForVisit ? "Sim" : "Nao",
      "Estado": key.active === false ? "Arquivada" : "Ativa",
      "Instrucoes": key.instructions || key.description || ""
    };

    if (pools.length) {
      pools.forEach((pool) => rows.push({
        ...base,
        "Cliente ID": pool.client?.id || key.client?.id || "",
        "Cliente": pool.client?.name || key.clientName || "",
        "Piscina ID": pool.id || "",
        "Piscina/Jacuzzi": pool.name || "",
        "Zona/Local": pool.zone || pool.location || "",
        "Morada": pool.address || pool.client?.address || ""
      }));
    } else {
      rows.push({
        ...base,
        "Cliente ID": key.client?.id || "",
        "Cliente": key.clientName || key.client?.name || "",
        "Piscina ID": "",
        "Piscina/Jacuzzi": "Chave geral do cliente",
        "Zona/Local": key.client?.zone || "",
        "Morada": key.client?.address || ""
      });
    }
  }

  rows.sort((a, b) =>
    String(a.Cliente || "").localeCompare(String(b.Cliente || "")) ||
    String(a["Piscina/Jacuzzi"] || "").localeCompare(String(b["Piscina/Jacuzzi"] || ""))
  );

  renderReport("Lista de chaves com referencias de clientes e piscinas", rows, "cristal-water-chaves-referencias");
}

function downloadCurrentReport() {
  downloadCsv(state.lastReportName, state.lastReportRows);
}

window.saveKey = saveKey;
window.archiveKey = archiveKey;
window.restoreKey = restoreKey;
window.hardDeleteKey = hardDeleteKey;
window.loadKeys = loadKeys;
window.loadMorningKeys = loadMorningKeys;
window.generateClientList = generateClientList;
window.generateKeyReferenceList = generateKeyReferenceList;
window.downloadCurrentReport = downloadCurrentReport;

document.addEventListener("DOMContentLoaded", async () => {
  const date = document.getElementById("date");
  if (date) date.value = new Date().toISOString().slice(0, 10);
  document.getElementById("clientId")?.addEventListener("change", () => renderPoolOptions(""));
  document.getElementById("poolId")?.addEventListener("change", syncClientFromPool);

  try {
    await loadOptions();
    await loadKeys();
  } catch (error) {
    setStatus(error.message);
  }
});
