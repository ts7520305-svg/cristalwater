// Baseline BEFORE da logica inline de admin-payment-settings.html (sem ficheiro JS dedicado).
renderNav("settings");

const API = "/api";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function showStatus(message) {
  const box = document.getElementById("statusBox");
  box.style.display = "block";
  box.textContent = message;
}

async function loadConfig() {
  try {
    const res = await fetch(`${API}/notification-rules/payment-policy`, { headers: authHeaders() });
    const data = await res.json();

    if (!res.ok || data.ok === false) {
      showStatus(data.message || "Erro ao carregar configuracao.");
      return;
    }

    const config = data.config || {};

    document.getElementById("policy").value = config.policy || "OVERDUE_ONLY";
    document.getElementById("defaultWhatsapp").checked = Boolean(config.defaultWhatsapp);
    document.getElementById("defaultEmail").checked = Boolean(config.defaultEmail);
    document.getElementById("defaultInternal").checked = Boolean(config.defaultInternal);
  } catch (error) {
    console.error(error);
    showStatus("Erro de ligacao ao carregar configuracao.");
  }
}

async function saveConfig() {
  try {
    const payload = {
      policy: document.getElementById("policy").value,
      defaultWhatsapp: document.getElementById("defaultWhatsapp").checked,
      defaultEmail: document.getElementById("defaultEmail").checked,
      defaultInternal: document.getElementById("defaultInternal").checked,
    };

    const res = await fetch(`${API}/notification-rules/payment-policy`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || data.ok === false) {
      showStatus(data.message || "Erro ao guardar configuracao.");
      return;
    }

    showStatus("Configuracao guardada com sucesso.");
  } catch (error) {
    console.error(error);
    showStatus("Erro de ligacao ao guardar configuracao.");
  }
}

loadConfig();
