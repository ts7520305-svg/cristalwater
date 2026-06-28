// ==========================================
// CRISTAL WATER - ADMIN EMAIL LOGS (FRONTEND)
// Com token admin real (JWT)
// ==========================================

const form = document.getElementById("filters");
const rows = document.getElementById("rows");
const summary = document.getElementById("summary");

const statusEl = document.getElementById("status");
const typeEl = document.getElementById("type");
const recipientEl = document.getElementById("recipient");
const fromEl = document.getElementById("from");
const toEl = document.getElementById("to");

let page = 1;
const pageSize = 25;

// 🔐 TOKEN ADMIN (JWT)
const ADMIN_TOKEN = localStorage.getItem("adminToken");

if (!ADMIN_TOKEN) {
  alert("Token admin não encontrado. Faz login de admin primeiro.");
}

// ------------------------------
// REENVIAR EMAIL FAILED
// ------------------------------
async function retryEmail(id) {
  if (!confirm("Reenviar este email falhado?")) return;

  try {
    const res = await fetch(`/api/admin/email/retry-failed/${id}`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + ADMIN_TOKEN,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Erro no retry.");
      return;
    }

    alert(data.message || "Retry executado com sucesso.");
    load();
  } catch (err) {
    alert("Erro de ligação ao servidor.");
  }
}

// ------------------------------
// CARREGAR EMAIL LOGS
// ------------------------------
async function load() {
  const params = new URLSearchParams({
    page,
    pageSize,
  });

  if (statusEl.value) params.append("status", statusEl.value);
  if (typeEl.value) params.append("type", typeEl.value);
  if (recipientEl.value) params.append("recipient", recipientEl.value);
  if (fromEl.value) params.append("from", fromEl.value);
  if (toEl.value) params.append("to", toEl.value);

  try {
    const res = await fetch("/api/admin/email-logs?" + params.toString(), {
      headers: {
        "Authorization": "Bearer " + ADMIN_TOKEN,
      },
    });

    const data = await res.json();

    rows.innerHTML = "";

    if (!data.items || !data.items.length) {
      rows.innerHTML =
        `<tr><td colspan="9">Sem resultados para os filtros atuais.</td></tr>`;
    } else {
      data.items.forEach(e => {
        const retryBtn =
          e.status === "FAILED"
            ? `<button onclick="retryEmail(${e.id})">Reenviar</button>`
            : "";

        rows.innerHTML += `
          <tr>
            <td>${new Date(e.createdAt).toLocaleString()}</td>
            <td>${e.status}</td>
            <td>${e.type || ""}</td>
            <td>${e.to || ""}</td>
            <td>${e.subject || ""}</td>
            <td>${e.retryCount ?? 0}</td>
            <td>${e.lastRetryAt ? new Date(e.lastRetryAt).toLocaleString() : "-"}</td>
            <td>${e.error || ""}</td>
            <td>${retryBtn}</td>
          </tr>
        `;
      });
    }

    summary.textContent =
      `Página ${data.page} · Total ${data.total}`;
  } catch (err) {
    rows.innerHTML =
      `<tr><td colspan="9">Erro ao carregar dados.</td></tr>`;
  }
}

// ------------------------------
// EVENTOS
// ------------------------------
form.addEventListener("submit", e => {
  e.preventDefault();
  page = 1;
  load();
});

document.getElementById("clear").addEventListener("click", () => {
  statusEl.value = "";
  typeEl.value = "";
  recipientEl.value = "";
  fromEl.value = "";
  toEl.value = "";
  page = 1;
  load();
});

document.getElementById("prev").addEventListener("click", () => {
  if (page > 1) {
    page--;
    load();
  }
});

document.getElementById("next").addEventListener("click", () => {
  page++;
  load();
});

// ------------------------------
// INIT
// ------------------------------
load();