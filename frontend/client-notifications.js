const rows = document.getElementById("rows");

// Obter clientId da sessão
const clientId = localStorage.getItem("clientId");

async function loadNotifications() {
  try {
    const res = await fetch(
      `/api/notifications?role=CLIENT&userId=${clientId}`
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
  await fetch(`/api/notifications/${id}/read`, {
    method: "POST",
  });
  loadNotifications();
}

loadNotifications();