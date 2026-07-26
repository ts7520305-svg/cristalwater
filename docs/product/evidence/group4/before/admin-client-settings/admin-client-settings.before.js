
const API = "/api";
const actionLock = new Set();

function authHeaders(extra = {}) {
  const token = localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function parseJson(res, fallback) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || fallback);
  return data;
}

async function withActionLock(key, callback) {
  if (actionLock.has(key)) return;
  actionLock.add(key);
  try {
    return await callback();
  } finally {
    actionLock.delete(key);
  }
}

async function loadClient() {
  const id = document.getElementById("clientId").value;
  if (!id) return alert("Indica um cliente válido.");

  const res = await fetch(`${API}/clients/${id}`, { headers: authHeaders() });
  const data = await parseJson(res, "Erro ao carregar cliente.");

  document.getElementById("mode").value = data.paymentReminderMode;
  document.getElementById("whatsapp").checked = data.paymentReminderWhatsapp;
  document.getElementById("email").checked = data.paymentReminderEmail;
  document.getElementById("internal").checked = data.paymentReminderInternal;
  document.getElementById("whatsappNumber").value = data.paymentReminderWhatsappNumber || "";
  document.getElementById("emailAddress").value = data.paymentReminderEmailAddress || "";
}

async function save() {
  const id = document.getElementById("clientId").value;
  if (!id) return alert("Indica um cliente válido.");
  if (!confirm("Guardar esta configuração do cliente?")) return;

  await withActionLock(`save:${id}`, async () => {
    const res = await fetch(`${API}/clients/${id}`, {
      method:"PUT",
      headers:authHeaders({ "Content-Type":"application/json" }),
      body: JSON.stringify({
        paymentReminderMode: document.getElementById("mode").value,
        paymentReminderWhatsapp: document.getElementById("whatsapp").checked,
        paymentReminderEmail: document.getElementById("email").checked,
        paymentReminderInternal: document.getElementById("internal").checked,
        paymentReminderWhatsappNumber: document.getElementById("whatsappNumber").value,
        paymentReminderEmailAddress: document.getElementById("emailAddress").value
      })
    });
    await parseJson(res, "Erro ao guardar configuração do cliente.");
  });

  alert("Guardado");
}

