const rows = document.getElementById("rows");

function getClientId() {
  const userRaw = localStorage.getItem("user");
  let user = null;
  try { user = userRaw ? JSON.parse(userRaw) : null; } catch { user = null; }
  return Number(user?.clientId || user?.id || localStorage.getItem("cw_client_id") || localStorage.getItem("clientId") || 0);
}

function getAuthHeaders() {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loadNotifications() {
  try {
    const clientId = getClientId();
    if (!clientId) throw new Error("Cliente não identificado.");
    const res = await fetch(
      `/api/client-portal/${clientId}/notifications`,
      { headers: getAuthHeaders() }
    );
    const data = await res.json();

    rows.innerHTML = "";

    if (!data.notifications || !data.notifications.length) {
      rows.innerHTML =
        `<tr><td colspan="5">Sem notificações.</td></tr>`;
      return;
    }

    data.notifications.forEach(n => {
      const btn =
        n.status === "PENDING"
          ? `<button onclick="markRead(${n.id})">Marcar como lida</button>`
          : "";

      rows.innerHTML += `
        <tr>
          <td>${new Date(n.createdAt).toLocaleString()}</td>
          <td>${n.title}</td>
          <td>${n.message}</td>
          <td>${n.status}</td>
          <td>${btn}</td>
        </tr>
      `;
    });
  } catch (e) {
    rows.innerHTML =
      `<tr><td colspan="5">Erro ao carregar notificações.</td></tr>`;
  }
}

async function markRead(id) {
  const clientId = getClientId();
  await fetch(`/api/client-portal/${clientId}/notifications/${id}/read`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  loadNotifications();
}

loadNotifications();