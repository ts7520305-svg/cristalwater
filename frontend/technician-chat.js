const statusBox = document.getElementById("statusBox");
const messageList = document.getElementById("messageList");

function setStatus(message, tone = "") {
  if (!statusBox) return;
  statusBox.textContent = message;
  if (tone) statusBox.dataset.tone = tone;
  else statusBox.removeAttribute("data-tone");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function parseResponse(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { raw: text };
  }
  if (!response.ok) throw new Error(data.error || data.message || `Falha HTTP ${response.status}`);
  return data;
}

function render(items) {
  if (!messageList) return;
  if (!Array.isArray(items) || items.length === 0) {
    messageList.innerHTML = '<div class="empty">Sem mensagens internas para mostrar.</div>';
    return;
  }

  messageList.innerHTML = items.map((item) => {
    const title = item.title || item.type || "Notificacao";
    const msg = item.message || "Sem detalhe.";
    const when = item.createdAt ? new Date(item.createdAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "Sem data";
    return `
      <article class="message">
        <b>${escapeHtml(title)}</b>
        <div>${escapeHtml(msg)}</div>
        <small>${escapeHtml(when)}</small>
      </article>
    `;
  }).join("");
}

async function loadMessages() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  setStatus("A carregar notificacoes de leitura.");
  try {
    const data = await parseResponse(await fetch("/api/notifications"));
    const items = Array.isArray(data.notifications) ? data.notifications : [];
    render(items.slice(0, 20));
    setStatus(items.length ? `Mensagens carregadas (${items.length}).` : "Sem mensagens no momento.");
  } catch (error) {
    render([]);
    setStatus(error.message || "Falha ao carregar mensagens.", "error");
  }
}

loadMessages();