const API =
  "/api";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

const socket =
  io();

// ======================================================
// SOUND
// ======================================================

const notifySound =
  new Audio(
    "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
  );

// ======================================================
// INIT
// ======================================================

window.onload =
  loadNotifications;

// ======================================================
// LOAD
// ======================================================

async function loadNotifications() {

  const countBox =
    document.getElementById("count");

  const listBox =
    document.getElementById("list");

  try {

    const [
      countRes,
      listRes
    ] = await Promise.all([

      fetch(
        `${API}/notifications/unread-count`,
        { headers: authHeaders() }
      ),

      fetch(
        `${API}/notifications`,
        { headers: authHeaders() }
      )
    ]);

    const countData =
      await countRes.json();

    const listData =
      await listRes.json();

    countBox.innerHTML = `

      <b>
        Não lidas:
      </b>

      ${countData.count || 0}

    `;

    listBox.innerHTML = "";

    if (
      !(listData.notifications || []).length
    ){

      listBox.innerHTML = `

        <div class="empty">
          Sem notificações.
        </div>

      `;

      return;
    }

    listData.notifications.forEach((n) => {

      const div =
        document.createElement("div");

      div.className =
        "card";

      div.innerHTML = `

        <div class="title">

          ${getIcon(n.type)}

          ${escapeHtml(
            n.title || "Notificação"
          )}

        </div>

        <div>

          ${escapeHtml(
            n.message || ""
          )}

        </div>

        <div class="meta">

          ${
            n.isRead
              ? "Lida"
              : "Por ler"
          }

          ·

          ${
            new Date(n.createdAt)
              .toLocaleString("pt-PT")
          }

        </div>

        <div class="actions">

          <button
            class="btn"
            onclick="openTarget(
              '${escapeJs(n.id)}',
              ${n.clientId || 'null'},
              '${escapeJs(n.type || "")}'
            )"
          >

            🔎 Abrir

          </button>

          ${
            !n.isRead

              ? `

              <button
                class="btn btn-gray"
                onclick="markRead('${escapeJs(n.id)}', ${n.clientId || 'null'})"
              >

                ✔ Marcar lida

              </button>

            `

              : ""
          }

        </div>

      `;

      listBox.appendChild(div);
    });

  } catch (err) {

    console.error(err);

    listBox.innerHTML = `

      <div class="empty">
        Erro ao carregar notificações.
      </div>

    `;
  }
}

// ======================================================
// MARK READ
// ======================================================

async function markRead(id, clientId = null) {

  if (String(id || "").startsWith("chat-") && clientId) {
    await fetch(
      `${API}/client-messages/seen/${clientId}`,
      {
        method: "POST",
        headers: authHeaders()
      }
    );

    loadNotifications();
    return;
  }

  await fetch(
    `${API}/notifications/read/${id}`,
    {
      method: "POST",
      headers: authHeaders()
    }
  );

  loadNotifications();
}

// ======================================================
// MARK ALL
// ======================================================

async function markAllRead() {

  await fetch(
    `${API}/notifications/read-all`,
    {
      method: "POST",
      headers: authHeaders()
    }
  );

  loadNotifications();
}

// ======================================================
// OPEN TARGET
// ======================================================

async function openTarget(
  notificationId,
  clientId,
  type
) {

  const t =
    String(type || "")
      .toUpperCase();

  // ==================================================
  // CHAT
  // ==================================================

  if (t.includes("CHAT")) {

    window.location.href =
      `/chat?clientId=${clientId}&filter=unread`;

    return;
  }

  try {

    await fetch(
      `${API}/notifications/read/${notificationId}`,
      {
        method: "POST",
        headers: authHeaders()
      }
    );

  } catch (err) {

    console.error(err);
  }

  // ==================================================
  // BILLING
  // ==================================================

  if (
    t.includes("PAYMENT") ||
    t.includes("INVOICE") ||
    t.includes("DEBT") ||
    t.includes("REMINDER")
  ){

    window.location.href =
      `/billing`;

    return;
  }

  if (
    t.includes("STOCK") ||
    t.includes("PURCHASE") ||
    t.includes("MATERIAL")
  ){

    window.location.href =
      `/admin-inventory`;

    return;
  }

  window.location.href =
    `/admin-dashboard`;
}

// ======================================================
// ICON
// ======================================================

function getIcon(type) {

  const t =
    String(type || "")
      .toUpperCase();

  if (t.includes("CHAT"))
    return "💬";

  if (t.includes("PAYMENT"))
    return "💶";

  if (t.includes("INVOICE"))
    return "📄";

  if (t.includes("DEBT"))
    return "🚨";

  if (t.includes("REMINDER"))
    return "⏰";

  if (t.includes("WHATSAPP"))
    return "📲";

  if (t.includes("ARRIVAL"))
    return "📍";

  return "⚠️";
}

// ======================================================
// REALTIME
// ======================================================

socket.on(
  "new-notification",
  (data) => {

    loadNotifications();

    notifySound.play();

    showToast(
      data.message ||
      "Nova notificação"
    );
  }
);

// ======================================================
// TOAST
// ======================================================

function showToast(message){

  const div =
    document.createElement("div");

  div.innerText =
    message;

  div.style.position =
    "fixed";

  div.style.bottom =
    "20px";

  div.style.right =
    "20px";

  div.style.background =
    "#1e88e5";

  div.style.color =
    "white";

  div.style.padding =
    "14px";

  div.style.borderRadius =
    "10px";

  div.style.zIndex =
    "99999";

  div.style.boxShadow =
    "0 2px 10px rgba(0,0,0,.25)";

  document.body.appendChild(div);

  setTimeout(() => {

    div.remove();

  }, 5000);
}

// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHtml(value) {

  return String(value ?? "")

    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;")

    .replaceAll("'", "&#039;");
}

// ======================================================
// ESCAPE JS
// ======================================================

function escapeJs(value) {

  return String(value ?? "")
    .replaceAll("'", "\\'");
}
