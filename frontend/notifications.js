const API = "/api";

// 🔥 SOCKET
let socket;
if (typeof io !== "undefined") {
  socket = io();
}

let notifications = [];
let settings = [];

let audio = new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3");
let soundEnabled = false;

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
    const res = await fetch(`${API}/settings/${user.id}`);
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

  return true;
}

// ==========================================================
// SOM
// ==========================================================

function enableSound(){
  document.addEventListener("click", () => {

    if (!soundEnabled){

      audio.play()
        .then(()=>{
          audio.pause();
          audio.currentTime = 0;
          soundEnabled = true;
          console.log("🔊 Som ativado");
        })
        .catch(()=>{});

    }

  }, { once:true });
}

function playSound(type){

  if (!soundEnabled) return;
  if (!isSoundEnabled(type)) return;

  try{
    audio.currentTime = 0;
    audio.play().catch(()=>{});
  }catch(e){}
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

  const countBox = document.getElementById("count");

  try {

    const res = await fetch(`${API}/notifications`);
    const data = await res.json();

    if (!data.ok) {
      countBox.textContent = "Erro";
      return;
    }

    notifications = data.notifications || [];

    render();

  } catch (err){
    console.log(err);
  }
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
        ${!n.isRead ? `<button onclick="markRead(${n.id})">✔ Lido</button>` : ""}
      </div>
    `;

    listBox.appendChild(div);
  });
}

// ==========================================================
// READ
// ==========================================================

async function markRead(id){

  await fetch(`${API}/notifications/read/${id}`, { method:"POST" });

  notifications = notifications.map(n =>
    n.id === id ? { ...n, isRead:true } : n
  );

  render();
}

async function markAllRead(){

  await fetch(`${API}/notifications/read-all`, { method:"POST" });

  notifications = notifications.map(n => ({
    ...n,
    isRead:true
  }));

  render();
}

// ==========================================================
// ICONES
// ==========================================================

function getIcon(type){
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