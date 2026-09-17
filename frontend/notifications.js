const API = "/api";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// 🔥 SOCKET
let socket;
if (typeof io !== "undefined") {
  socket = io();
}

let notifications = [];

// ==========================================================
// INIT
// ==========================================================

window.onload = () => {
  requestPushPermission();
  loadNotifications();
};

// ==========================================================
// PUSH
// ==========================================================

function requestPushPermission(){
  if ("Notification" in window){
    Notification.requestPermission();
  }
}

function pushNotification(message){
  if ("Notification" in window && Notification.permission === "granted"){
    new Notification("Cristal Water", { body: message });
  }
}

// ==========================================================
// WEBSOCKET
// ==========================================================

if (socket){

  socket.on("connect", () => {
    console.log("🟢 Ligado realtime");
  });

  socket.on("new-notification", (n) => {

    if (!CWNotificationRead.active()) return;

    const existing = notifications.findIndex(x => x.id === n.id);
    if (existing >= 0) {
      // A legacy chat ID identifies the conversation, not an individual message.
      if (!/^chat-[1-9]\d*$/.test(String(n.id)) || !Number.isFinite(Date.parse(n.createdAt)) || notifications[existing].createdAt === n.createdAt) return;
      notifications.splice(existing, 1);
    }

    notifications.unshift(n);

    void window.CWNotificationSound?.play(n);
    pushNotification(n.message);

    render();
  });
}

// ==========================================================
// LOAD NOTIFICATIONS
// ==========================================================

async function loadNotifications(){
  const read = CWNotificationRead.begin(); if (!read) return false;
  try {
    const res = await fetch(`${API}/notifications`, { headers: CWNotificationRead.headers(), cache: 'no-store' });
    const data = await res.json(); if (!CWNotificationRead.accepts(read)) return false;
    if (!res.ok || !CWNotificationRead.validList(data)) throw Error();
    notifications = data.notifications; render(); CWNotificationRead.controls(); return true;
  } catch { if (CWNotificationRead.accepts(read)) CWNotificationRead.status('Não foi possível atualizar as notificações. A última lista foi conservada.', true); return false; }
}

// ==========================================================
// RENDER
// ==========================================================

function render(){

  const countBox = document.getElementById("count");
  const listBox = document.getElementById("list");

  const unread = notifications.filter(n => !n.isRead).length;

  countBox.textContent = `Não lidas: ${unread}`;

  listBox.innerHTML = "";

  if (!notifications.length){
    listBox.innerHTML = `<div class="empty">Sem notificações</div>`;
    return;
  }

  notifications.forEach(n => {

    const div = document.createElement("div");
    div.className = `card ${!n.isRead ? "unread" : ""}`;

    div.innerHTML = `
      <div class="title">
        ${getIcon(n.type)} ${escapeHtml(n.type)}
      </div>

      <div>${escapeHtml(n.message)}</div>

      <div class="meta">
        Cliente: ${escapeHtml(n.client || "-")} ·
        Técnico: ${escapeHtml(n.technician || "-")} ·
        ${new Date(n.createdAt).toLocaleString("pt-PT")}
      </div>

      <div class="actions">
        ${!n.isRead ? `<button onclick="markRead('${n.id}', ${Number(n.clientId) || 'null'})">✔ Lido</button>` : ""}
      </div>
    `;

    listBox.appendChild(div);
  });
}

// ==========================================================
// READ
// ==========================================================

async function markRead(id, clientId){
  if (await CWNotificationRead.one(id, clientId)) await loadNotifications();
}
async function markAllRead(){
  if (await CWNotificationRead.all(notifications)) await loadNotifications();
}

// ==========================================================
// ICONES
// ==========================================================

function getIcon(type){
  type = String(type || "");
  if(type.includes("ARRIVAL")) return "📍";
  if(type.includes("CHAT")) return "💬";
  if(type.includes("PAYMENT")) return "💶";
  if(type.includes("INVOICE")) return "📄";
  if(type.includes("DEBT")) return "🚨";
  if(type.includes("REMINDER")) return "⏰";
  return "⚠️";
}

// ==========================================================
// ESCAPE
// ==========================================================

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
