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
let settings = [];

let soundEnabled = false;
let audioCtx = null;

const user = JSON.parse(localStorage.user || "{}");

// ==========================================================
// INIT
// ==========================================================

window.onload = () => {
  enableSound();
  requestPushPermission();
  loadSettings();
  loadNotifications();
};

// ==========================================================
// LOAD SETTINGS (DB)
// ==========================================================

async function loadSettings(){

  if (!user.id) return;

  try {
    const res = await fetch(`${API}/settings/${user.id}`, { headers: authHeaders() });
    const data = await res.json();

    if (data.ok){
      settings = data.settings || [];
    }

  } catch (err){
    console.log(err);
  }
}

// ==========================================================
// VERIFICAR SOM (DB + fallback)
// ==========================================================

function isSoundEnabled(type){

  const found = settings.find(s => s.type === type);

  if (found) return found.sound;

  // fallback antigo (compatibilidade)
  const saved = localStorage.getItem("sound_" + type);
  if (saved !== null) return saved === "true";

  return false;
}

// ==========================================================
// SOM
// ==========================================================

function enableSound(){
  document.addEventListener("click", () => {

    if (!soundEnabled){

      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        soundEnabled = true;
      } catch (_) {
        soundEnabled = false;
      }

    }

  }, { once:true });
}

function playSound(type){

  if (!soundEnabled) return;
  if (!isSoundEnabled(type)) return;

  try {
    const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx = ctx;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.02;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.08);
  } catch (_) {}
}

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

    if (notifications.some(x => x.id === n.id)) return;

    notifications.unshift(n);

    playSound(n.type);
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