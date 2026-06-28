const API = `${location.origin}/api`;

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
}[char]));

const val = (id) => document.getElementById(id)?.value?.trim() || "";

let POOLS = [];
let CLIENTS = [];
let showArchived = false;
let queryClientFilterApplied = false;

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || data.message || "Erro");
  return data;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function poolType(pool) {
  const raw = String(pool.type || pool.kind || "").toUpperCase();
  const name = normalize(pool.name);
  if (raw.includes("JACUZZI") || name.includes("jacuzzi")) return "JACUZZI";
  return "POOL";
}

function typeLabel(pool) {
  return poolType(pool) === "JACUZZI" ? "Jacuzzi" : "Piscina";
}

function isActivePool(pool) {
  return pool.active !== false && !["ARCHIVED", "INACTIVE", "INATIVA", "ARQUIVADA"].includes(String(pool.status || "").toUpperCase());
}

function poolClientName(pool) {
  return pool.client?.name || pool.clientName || "-";
}

function hasClientAssociation(pool) {
  return Boolean(pool.client?.id || pool.clientName);
}

function poolZone(pool) {
  return pool.zone || pool.location || "-";
}

function assignedRoundItems(pool) {
  return Array.isArray(pool.roundPools) ? pool.roundPools.filter((item) => item && (item.round || item.roundId)) : [];
}

function hasAssignedRound(pool) {
  return assignedRoundItems(pool).length > 0;
}

function roundSummary(pool) {
  const rounds = assignedRoundItems(pool).map((item) => {
    const round = item.round || {};
    const name = round.name || `Ronda ${item.roundId || ""}`.trim();
    const day = round.dayOfWeek || round.weekday || "";
    return [name, day].filter(Boolean).join(" · ");
  }).filter(Boolean);
  return rounds.length ? rounds.join(", ") : "Sem ronda atribuida";
}

function poolSearchText(pool) {
  return normalize([
    pool.name,
    poolClientName(pool),
    hasClientAssociation(pool) ? "" : "sem cliente",
    hasAssignedRound(pool) ? roundSummary(pool) : "sem ronda",
    poolZone(pool),
    pool.location,
    pool.address,
    pool.serialNumber,
    pool.id,
    typeLabel(pool),
    pool.notes,
  ].join(" "));
}

function numberValue(value) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEuro(value) {
  const amount = numberValue(value);
  return amount ? amount.toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) : "-";
}

function formatVolume(pool) {
  const volume = numberValue(pool.volumeM3 || pool.technicalSheet?.volumeM3);
  return volume > 0 ? `${volume.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} m3` : "Calcular na ficha";
}

function uniqueOptions(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-PT"));
}

function setSelectOptions(id, values, placeholder) {
  const select = document.getElementById(id);
  if (!select) return;
  const previous = select.value;
  select.innerHTML = `<option value="">${esc(placeholder)}</option>${values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}`;
  if (values.includes(previous)) select.value = previous;
}

function updateFilterOptions() {
  setSelectOptions("poolClientFilter", uniqueOptions(POOLS.map(poolClientName)), "Todos os clientes");
  setSelectOptions("poolZoneFilter", uniqueOptions(POOLS.map(poolZone).filter((zone) => zone !== "-")), "Todas as zonas");
}

function getFilters() {
  return {
    query: val("poolSearch"),
    status: val("poolStatusFilter"),
    type: val("poolTypeFilter"),
    client: val("poolClientFilter"),
    zone: val("poolZoneFilter"),
    operational: val("poolOperationalFilter"),
  };
}

function filteredPools() {
  const filters = getFilters();
  const query = normalize(filters.query);
  return POOLS.filter((pool) => {
    if (query && !poolSearchText(pool).includes(query)) return false;
    if (filters.status === "active" && !isActivePool(pool)) return false;
    if (filters.status === "inactive" && isActivePool(pool)) return false;
    if (filters.type && poolType(pool) !== filters.type) return false;
    if (filters.client && poolClientName(pool) !== filters.client) return false;
    if (filters.zone && poolZone(pool) !== filters.zone) return false;
    if (filters.operational === "no-client" && hasClientAssociation(pool)) return false;
    if (filters.operational === "no-round" && hasAssignedRound(pool)) return false;
    if (filters.operational === "attention" && hasClientAssociation(pool) && hasAssignedRound(pool)) return false;
    return true;
  });
}

function updateSummary(pools) {
  const total = pools.length;
  const active = pools.filter(isActivePool).length;
  const inactive = total - active;
  const jacuzzis = pools.filter((pool) => poolType(pool) === "JACUZZI").length;
  const noClient = pools.filter((pool) => !hasClientAssociation(pool)).length;
  const noRound = pools.filter((pool) => !hasAssignedRound(pool)).length;
  const waterVolume = pools.reduce((sum, pool) => sum + numberValue(pool.volumeM3), 0);
  const monthly = pools.reduce((sum, pool) => sum + numberValue(pool.monthlyAmount || pool.valueMonthly || pool.monthlyValue), 0);

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  set("poolCount", total);
  set("poolActiveCount", active);
  set("poolInactiveCount", inactive);
  set("poolJacuzziCount", jacuzzis);
  set("poolVolumeTotal", `${waterVolume.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} m³`);
  set("poolMonthlyTotal", formatEuro(monthly));
  set("poolNoClientCount", noClient);
  set("poolNoRoundCount", noRound);
  set("poolListSummary", `${total} de ${POOLS.length} infraestrutura(s) visiveis - ${noClient} sem cliente - ${noRound} sem ronda`);
}

function applyQueryClientFilter() {
  if (queryClientFilterApplied) return;
  const params = new URLSearchParams(location.search);
  const clientId = params.get("clientId");
  if (!clientId) return;

  const client = CLIENTS.find((item) => String(item.id) === String(clientId));
  const filter = document.getElementById("poolClientFilter");
  if (!client || !filter) return;

  filter.value = client.name || "";
  queryClientFilterApplied = true;
  renderPools();
}

async function loadClients() {
  const data = await request("/clients");
  CLIENTS = data.clients || [];
  const select = document.getElementById("clientId");
  if (select) {
    select.innerHTML = CLIENTS.map((client) => {
      const status = String(client.status || "").toUpperCase() === "ACTIVE" ? "" : " · em configuracao";
      return `<option value="${client.id}">${esc(client.name)}${status}</option>`;
    }).join("");
    const selected = new URLSearchParams(location.search).get("clientId");
    if (selected) select.value = selected;
  }
}

async function createPool() {
  const clientId = Number(val("clientId"));
  const body = {
    name: val("name"),
    type: val("type") || "POOL",
    zone: val("zone"),
    address: val("address"),
    location: val("location"),
    monthlyAmount: val("monthlyAmount"),
    notes: val("notes"),
  };

  if (!clientId || !body.name) return alert("Cliente e nome da piscina sao obrigatorios");

  try {
    await request("/pools", { method: "POST", body: JSON.stringify({ ...body, clientId }) });
    document.getElementById("poolForm").reset();
    await loadPools();
    alert("Piscina criada e associada ao cliente.");
  } catch (err) {
    alert(err.message);
  }
}

function editPayload(pool) {
  const name = prompt("Nome da piscina/jacuzzi", pool.name || "");
  if (name === null) return null;
  const zone = prompt("Zona", pool.zone || pool.location || "");
  if (zone === null) return null;
  const address = prompt("Morada/localizacao", pool.address || "");
  if (address === null) return null;
  const location = prompt("Local na propriedade", pool.location || "");
  if (location === null) return null;
  const monthlyAmount = prompt("Valor mensal EUR", pool.monthlyAmount ?? 0);
  if (monthlyAmount === null) return null;
  const notes = prompt("Notas tecnicas", pool.notes || "");
  if (notes === null) return null;
  const type = prompt("Tipo: POOL ou JACUZZI", poolType(pool));
  if (type === null) return null;
  return { name, type: String(type || "POOL").toUpperCase(), zone, address, location, monthlyAmount, notes };
}

function findClientByAdminInput(input) {
  const query = String(input || "").trim();
  if (!query) return null;
  const numericId = Number(query);
  if (Number.isInteger(numericId) && numericId > 0) {
    return CLIENTS.find((client) => Number(client.id) === numericId) || null;
  }
  const normalized = normalize(query);
  const matches = CLIENTS.filter((client) => normalize([
    client.name,
    client.email,
    client.phone,
    client.zone,
    client.address,
    client.id,
  ].join(" ")).includes(normalized));
  if (matches.length === 1) return matches[0];
  if (!matches.length) return null;
  const options = matches.slice(0, 10).map((client) => `${client.id} - ${client.name}`).join("\n");
  const selected = prompt(`Foram encontrados varios clientes. Escreve o ID correto:\n\n${options}`);
  if (selected === null) return null;
  return findClientByAdminInput(selected);
}

async function reassignPool(id) {
  const pool = POOLS.find((item) => Number(item.id) === Number(id));
  if (!pool) return alert("Piscina nao encontrada.");
  const input = prompt(
    `Associar "${pool.name || "Piscina"}" a que cliente?\n\nPode escrever o ID, nome, telefone ou email do cliente.`,
    pool.client?.id ? String(pool.client.id) : poolClientName(pool)
  );
  if (input === null) return;
  const client = findClientByAdminInput(input);
  if (!client) return alert("Cliente nao encontrado. Confirma o ID ou pesquisa o cliente na lista.");
  if (!confirm(`Confirmar associacao da piscina a:\n${client.name}\n\nA cobranca mensal passa a contar nesta conta do cliente.`)) return;

  try {
    await request(`/pools/${id}`, { method: "PUT", body: JSON.stringify({ clientId: client.id }) });
    await loadClients();
    await loadPools();
    alert("Piscina associada ao cliente selecionado.");
  } catch (err) {
    alert(err.message);
  }
}

function renderPoolRow(pool) {
  const active = isActivePool(pool);
  const monthlyAmount = pool.monthlyAmount || pool.valueMonthly || pool.monthlyValue;
  const hasClient = hasClientAssociation(pool);
  const hasRound = hasAssignedRound(pool);
  const riskClass = !hasClient || !hasRound ? "pool-row-risk" : "";
  return `
    <article class="pool-row ${active ? "" : "pool-row-inactive"} ${riskClass}">
      <div class="pool-main">
        <div class="pool-title-line">
          <strong>${esc(pool.name || "Piscina")}</strong>
          <span class="pill">${esc(typeLabel(pool))}</span>
          <span class="pill ${active ? "cw-status-active" : "cw-status-archived"}">${active ? "Ativa" : "Inativa"}</span>
          ${hasClient ? '<span class="pill pool-ok-pill">Cliente ligado</span>' : '<span class="pill pool-alert-pill">Sem cliente</span>'}
          ${hasRound ? '<span class="pill pool-ok-pill">Com ronda</span>' : '<span class="pill pool-warn-pill">Sem ronda</span>'}
        </div>
        <div class="pool-subline">ID ${esc(pool.id)} · ${esc(pool.address || "Sem morada")}${pool.location ? ` · ${esc(pool.location)}` : ""}</div>
      </div>
      <div class="pool-cell">
        <span>Cliente</span>
        <b>${hasClient ? esc(poolClientName(pool)) : "Sem cliente associado"}</b>
      </div>
      <div class="pool-cell">
        <span>Zona</span>
        <b>${esc(poolZone(pool))}</b>
      </div>
      <div class="pool-cell">
        <span>Ronda</span>
        <b>${esc(roundSummary(pool))}</b>
      </div>
      <div class="pool-cell compact">
        <span>Volume</span>
        <b>${esc(formatVolume(pool))}</b>
      </div>
      <div class="pool-cell compact">
        <span>Mensal</span>
        <b>${esc(formatEuro(monthlyAmount))}</b>
      </div>
      <div class="pool-actions">
        <button onclick="editPool(${pool.id})">Editar</button>
        <button onclick="reassignPool(${pool.id})">Alterar cliente</button>
        <a class="btn" href="/admin-pool-technical?poolId=${pool.id}">Ficha tecnica</a>
        <a class="btn" href="/admin-pool-calculator?poolId=${pool.id}">Calculadora</a>
        ${active
          ? `<button class="cw-action-warn" onclick="archivePool(${pool.id})">Arquivar</button>`
          : `<button class="cw-action-ok" onclick="restorePool(${pool.id})">Restaurar</button>`}
        <button class="cw-action-danger" onclick="deletePool(${pool.id})">Eliminar</button>
      </div>
    </article>
  `;
}

function renderPools() {
  const list = document.getElementById("list");
  if (!list) return;

  updateFilterOptions();
  const pools = filteredPools();
  updateSummary(pools);

  if (!POOLS.length) {
    list.innerHTML = '<div class="cw-empty">Ainda nao existem piscinas reais inseridas.</div>';
    return;
  }

  if (!pools.length) {
    list.innerHTML = '<div class="cw-empty">Nenhuma piscina ou jacuzzi corresponde aos filtros.</div>';
    return;
  }

  list.innerHTML = pools.map(renderPoolRow).join("");
}

async function loadPools() {
  const data = await request(`/pools${showArchived ? "?includeInactive=1" : ""}`);
  POOLS = data.pools || [];
  renderPools();
  applyQueryClientFilter();
}

async function editPool(id) {
  const pool = POOLS.find((item) => Number(item.id) === Number(id));
  if (!pool) return alert("Piscina nao encontrada.");
  const body = editPayload(pool);
  if (!body) return;
  try {
    await request(`/pools/${id}`, { method: "PUT", body: JSON.stringify(body) });
    await loadPools();
    alert("Piscina atualizada.");
  } catch (err) {
    alert(err.message);
  }
}

async function archivePool(id) {
  if (!confirm("Arquivar/desativar esta piscina?")) return;
  try {
    await request(`/pools/${id}/archive`, { method: "POST" });
    await loadPools();
  } catch (err) {
    alert(err.message);
  }
}

async function restorePool(id) {
  try {
    await request(`/pools/${id}/restore`, { method: "POST" });
    await loadPools();
  } catch (err) {
    alert(err.message);
  }
}

async function deletePool(id) {
  const pool = POOLS.find((item) => Number(item.id) === Number(id));
  const label = pool?.name || `Piscina ${id}`;
  if (!confirm(`Eliminar definitivamente "${label}"?\n\nO sistema deve bloquear se houver dividas ou historico protegido. Para manter o historico, usa Arquivar.`)) return;
  try {
    await request(`/pools/${id}`, { method: "DELETE" });
    await loadPools();
    alert("Piscina eliminada ou removida conforme as regras do sistema.");
  } catch (err) {
    alert(err.message);
  }
}

function toggleArchived() {
  showArchived = !showArchived;
  const button = document.getElementById("toggleArchived");
  if (button) button.textContent = showArchived ? "Ocultar inativas" : "Ver inativas";
  loadPools();
}

function clearPoolFilters() {
  ["poolSearch", "poolStatusFilter", "poolTypeFilter", "poolClientFilter", "poolZoneFilter", "poolOperationalFilter"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  renderPools();
}

function setupFilters() {
  ["poolStatusFilter", "poolTypeFilter", "poolClientFilter", "poolZoneFilter", "poolOperationalFilter"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", renderPools);
  });
  document.getElementById("poolSearch")?.addEventListener("input", renderPools);
  document.getElementById("clearPoolFilters")?.addEventListener("click", clearPoolFilters);
  document.getElementById("toggleArchived")?.addEventListener("click", toggleArchived);
}

window.addEventListener("DOMContentLoaded", async () => {
  setupFilters();
  await loadClients();
  await loadPools();
});

window.createPool = createPool;
window.editPool = editPool;
window.reassignPool = reassignPool;
window.archivePool = archivePool;
window.restorePool = restorePool;
window.deletePool = deletePool;
window.toggleArchived = toggleArchived;
