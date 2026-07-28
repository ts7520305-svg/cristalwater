const API = "/api";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

window.onload = () => {
  document.getElementById("search").addEventListener("input", renderLogs);
  document.getElementById("channelFilter").addEventListener("change", renderLogs);
  load();
};

let allLogs = [];

async function load() {
  const res = await fetch(API + "/communications", { headers: authHeaders() });
  const data = await res.json();

  const container = document.getElementById("list");
  container.innerHTML = "";

  if (!data.ok) {
    container.innerHTML = `<div class="empty">Erro ao carregar histórico.</div>`;
    return;
  }

  allLogs = data.logs || [];
  renderLogs();
}

function renderLogs() {
  const container = document.getElementById("list");
  const q = document.getElementById("search").value.trim().toLowerCase();
  const channel = document.getElementById("channelFilter").value;

  container.innerHTML = "";

  const filtered = allLogs.filter((l) => {
    const hay = `${l.channel} ${l.clientId} ${l.message}`.toLowerCase();
    const matchText = hay.includes(q);
    const matchChannel = !channel || l.channel === channel;
    return matchText && matchChannel;
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="empty">Sem comunicações ainda</div>`;
    return;
  }

  filtered.forEach(l => {
    const div = document.createElement("div");
    div.className = "card";

    let tagClass = "";
    let label = l.channel;

    if (l.channel === "CHAT") tagClass = "chat";
    if (l.channel === "WHATSAPP_BROWSER") tagClass = "browser";
    if (l.channel === "WHATSAPP_API") tagClass = "api";

    div.innerHTML = `
      <div class="tag ${tagClass}">${escapeHtml(label)}</div>

      <div><b>Cliente:</b> ${l.clientId ?? "-"}</div>
      <div><b>Referência:</b> ${l.referenceId ?? "-"}</div>

      <div style="margin-top:8px;">${escapeHtml(l.message)}</div>

      <div class="meta">
        ${new Date(l.createdAt).toLocaleString("pt-PT")}
      </div>

      <div class="actions">
        ${l.clientId ? `<button class="mini-btn" onclick="openClientChat(${l.clientId})" title="Abrir diretamente o chat do cliente"><span>💬</span><span>Abrir cliente</span></button>` : ""}
        <button class="mini-btn" onclick="goBilling()" title="Abrir centro de cobranças relacionado"><span>💶</span><span>Cobranças</span></button>
      </div>
    `;

    container.appendChild(div);
  });
}

function openClientChat(clientId) {
  window.location.href = `/chat?mode=client&clientId=${clientId}&senderId=1`;
}

function goBilling() {
  window.location.href = `/billing-center`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}