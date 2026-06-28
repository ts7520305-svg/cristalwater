const API =
  "/api";

const socket =
  io();

// ======================================================
// FORMAT MONEY
// ======================================================

function formatMoney(value){

  return `
    € ${Number(value || 0)
      .toFixed(2)}
  `;
}

// ======================================================
// ESCAPE
// ======================================================

function escapeHtml(value){

  return String(value ?? "")

    .replaceAll("&","&amp;")

    .replaceAll("<","&lt;")

    .replaceAll(">","&gt;");
}

// ======================================================
// MONTH
// ======================================================

function getCurrentMonthRef(){

  const now =
    new Date();

  return `

    ${now.getFullYear()}

    -

    ${String(
      now.getMonth() + 1
    ).padStart(2,"0")}

  `.replace(/\s/g,"");
}

// ======================================================
// STATUS
// ======================================================

function setStatus(message){

  const el =
    document.getElementById(
      "status"
    );

  if (el){

    el.textContent =
      message;
  }
}

// ======================================================
// CONNECTION STATUS
// ======================================================

function updateConnectionStatus(){

  if (navigator.onLine){

    setStatus(
      "🟢 Online"
    );

  } else {

    setStatus(
      "🔴 Offline"
    );
  }
}

window.addEventListener(
  "online",
  updateConnectionStatus
);

window.addEventListener(
  "offline",
  updateConnectionStatus
);

// ======================================================
// SOCKETS
// ======================================================

socket.on(
  "new-notification",
  (data)=>{

    if (
      typeof addFeedItem === "function"
    ){

      addFeedItem(
        `🔔 ${data.message}`
      );
    }

    if (
      data.type === "VISIT_ALERT"
    ){

      if (
        typeof addCriticalAlert === "function"
      ){

        addCriticalAlert(
          data.message
        );
      }
    }
  }
);

socket.on(
  "gps-update",
  (data)=>{

    if (
      typeof addFeedItem === "function"
    ){

      addFeedItem(
        `📍 ${data.name} atualizou GPS`
      );
    }
  }
);

// ======================================================
// AUTO REFRESH
// ======================================================

function startDashboardRefresh(){

  setInterval(()=>{

    // ================================================
    // OFFLINE
    // ================================================

    if (!navigator.onLine){

      console.log(
        "Modo offline ativo"
      );

      return;
    }

    // ================================================
    // DASHBOARD
    // ================================================

    if (
      typeof loadDashboard === "function"
    ){

      loadDashboard();
    }

    // ================================================
    // IA
    // ================================================

    if (
      typeof loadAISuggestions === "function"
    ){

      loadAISuggestions();
    }

    // ================================================
    // MAP
    // ================================================

    if (
      typeof loadLiveMap === "function"
    ){

      loadLiveMap();
    }

  }, 60000);
}

// ======================================================
// SERVICE WORKER
// ======================================================

function registerServiceWorker(){

  if (
    "serviceWorker" in navigator
  ){

    window.addEventListener(
      "load",
      () => {

        navigator.serviceWorker
          .register(
            "/service-worker.js"
          )

          .then(() => {

            console.log(
              "✅ Service Worker ativo"
            );
          })

          .catch((err) => {

            console.error(
              "Erro Service Worker:",
              err
            );
          });
      }
    );
  }
}

// ======================================================
// LOCAL CACHE
// ======================================================

function saveLocalData(key,data){

  try {

    localStorage.setItem(
      key,
      JSON.stringify(data)
    );

  } catch(err){

    console.error(err);
  }
}

function getLocalData(key){

  try {

    return JSON.parse(
      localStorage.getItem(key)
    );

  } catch(err){

    return null;
  }
}

// ======================================================
// INIT
// ======================================================

window.onload = () => {

  // ================================================
  // MONTH
  // ================================================

  const month =
    document.getElementById(
      "monthRef"
    );

  if (month){

    month.value =
      getCurrentMonthRef();
  }

  // ================================================
  // CONNECTION
  // ================================================

  updateConnectionStatus();

  // ================================================
  // LOAD
  // ================================================

  if (
    typeof loadDashboard === "function"
  ){

    loadDashboard();
  }

  if (
    typeof initLiveMap === "function"
  ){

    initLiveMap();
  }

  if (
    typeof loadAISuggestions === "function"
  ){

    loadAISuggestions();
  }

  // ================================================
  // REFRESH
  // ================================================

  startDashboardRefresh();

  // ================================================
  // SERVICE WORKER
  // ================================================

  registerServiceWorker();

  // ================================================
  // STATUS
  // ================================================

  setStatus(
    "Dashboard operacional iniciado"
  );
};