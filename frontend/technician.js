// ======================================================
// API
// ======================================================

const API =
  "/api";

// ======================================================
// AUTH GUARD
// ======================================================

const token =
  localStorage.getItem("token");

const userRaw =
  localStorage.getItem("user");

let user = null;

function redirectToLogin(){

  localStorage.removeItem("token");

  localStorage.removeItem("user");

  window.location.href =
    "/login";
}

function redirectByRole(role){

  if (role === "ADMIN"){

    window.location.href =
      "/admin-dashboard";

    return;
  }

  if (role === "CLIENT"){

    window.location.href =
      "/client-portal";

    return;
  }

  window.location.href =
    "/login";
}

if (!token || !userRaw){

  redirectToLogin();

} else {

  try {

    user =
      JSON.parse(userRaw);

  } catch (err){

    redirectToLogin();
  }

  if (!user || !user.role){

    redirectToLogin();
  }

  if (user.role !== "TECHNICIAN"){

    redirectByRole(user.role);
  }
}

// ======================================================
// STATE
// ======================================================

let visits = [];

let isSyncing = false;

// ======================================================
// INIT
// ======================================================

window.addEventListener(
  "load",
  () => {

    hideSplash();

    bindButtons();

    updateConnectionStatus();

    updateOfflineBar();

    loadRoute();

    checkDay();

    if (
      typeof startGpsTracking === "function"
    ){

      startGpsTracking();
    }

    setInterval(() => {

      runAutoSync();

    }, 15000);

    window.addEventListener(
      "online",
      () => {

        updateConnectionStatus();

        updateOfflineBar();

        runAutoSync();
      }
    );

    window.addEventListener(
      "offline",
      () => {

        updateConnectionStatus();

        updateOfflineBar();
      }
    );
  }
);

// ======================================================
// SPLASH
// ======================================================

function hideSplash(){

  setTimeout(() => {

    document
      .getElementById(
        "splashScreen"
      )
      ?.classList.add(
        "splash-hide"
      );

  }, 1800);
}

// ======================================================
// BUTTONS
// ======================================================

function bindButtons(){

  const logoutBtn =
    document.getElementById("logoutBtn");

  const optimizeRouteBtn =
    document.getElementById("optimizeRouteBtn");

  const startDayBtn =
    document.getElementById("startDayBtn");

  const endDayBtn =
    document.getElementById("endDayBtn");

  const sendAlertBtn =
    document.getElementById("sendAlertBtn");

  const installAppBtn =
    document.getElementById("installAppBtn");

  const themeToggle =
    document.getElementById("themeToggle");

  if (logoutBtn){

    logoutBtn.addEventListener(
      "click",
      logout
    );
  }

  if (optimizeRouteBtn){

    optimizeRouteBtn.addEventListener(
      "click",
      optimizeRoute
    );
  }

  if (startDayBtn){

    startDayBtn.addEventListener(
      "click",
      startDay
    );
  }

  if (endDayBtn){

    endDayBtn.addEventListener(
      "click",
      endDay
    );
  }

  if (sendAlertBtn){

    sendAlertBtn.addEventListener(
      "click",
      sendInternalAlert
    );
  }

  bindInstallAppButton(installAppBtn);

  bindThemeToggle(themeToggle);
}

let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const installAppBtn = document.getElementById("installAppBtn");
  if (installAppBtn) installAppBtn.style.display = "";
});

function bindInstallAppButton(button){
  if (!button) return;

  button.addEventListener("click", async () => {
    if (!deferredInstallPrompt){
      alert("Instalacao disponivel atraves do menu do navegador.");
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    button.style.display = "none";
  });
}

function bindThemeToggle(button){
  if (!button) return;

  const applyTheme = (theme) => {
    const dark = theme === "dark";
    document.body.classList.toggle("dark-mode", dark);
    button.textContent = dark ? "Modo claro" : "Modo escuro";
    localStorage.setItem("cw-technician-theme", theme);
  };

  applyTheme(localStorage.getItem("cw-technician-theme") || "light");

  button.addEventListener("click", () => {
    const next = document.body.classList.contains("dark-mode") ? "light" : "dark";
    applyTheme(next);
  });
}

// ======================================================
// CONNECTION
// ======================================================

function updateConnectionStatus(){

  const status =
    document.getElementById(
      "status"
    );

  if (!status) return;

  if (navigator.onLine){

    status.innerText =
      "🟢 Online";

  } else {

    status.innerText =
      "🔴 Offline";
  }
}

// ======================================================
// OFFLINE BAR
// ======================================================

function updateOfflineBar(syncText){

  const queue =
    typeof getOfflineQueue === "function"
      ? getOfflineQueue()
      : [];

  const photos =
    typeof getOfflinePhotos === "function"
      ? getOfflinePhotos()
      : [];

  const gps =
    typeof getOfflineGps === "function"
      ? getOfflineGps()
      : [];

  const network =
    document.getElementById(
      "offlineNetwork"
    );

  const visitsEl =
    document.getElementById(
      "offlineVisits"
    );

  const photosEl =
    document.getElementById(
      "offlinePhotos"
    );

  if (network){

    network.innerText =
      syncText ||
      (
        navigator.onLine
          ? "🟢 Online"
          : "🔴 Offline"
      );
  }

  if (visitsEl){

    visitsEl.innerText =
      `📦 ${queue.length} visitas pendentes`;
  }

  if (photosEl){

    photosEl.innerText =
      `📸 ${photos.length} fotos pendentes · 📍 ${gps.length} GPS pendentes`;
  }
}

// ======================================================
// AUTO SYNC
// ======================================================

async function runAutoSync(){

  if (!navigator.onLine)
    return;

  if (isSyncing)
    return;

  isSyncing = true;

  updateOfflineBar(
    "🔄 A sincronizar..."
  );

  try {

    if (
      typeof syncOfflineQueue === "function"
    ){

      await syncOfflineQueue();
    }

    if (
      typeof syncOfflinePhotos === "function"
    ){

      await syncOfflinePhotos();
    }

    if (
      typeof syncOfflineGps === "function"
    ){

      await syncOfflineGps();
    }

    updateOfflineBar(
      "✅ Sincronizado"
    );

    setTimeout(() => {

      updateOfflineBar();

    }, 2500);

    loadRoute();

  } catch(err){

    console.error(err);

    updateOfflineBar(
      "⚠️ Erro sync"
    );

  } finally {

    isSyncing = false;
  }
}

// ======================================================
// LOCAL DATA
// ======================================================

function saveLocalData(key, data){

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

  } catch {

    return null;
  }
}

// ======================================================
// AUTH HEADERS
// ======================================================

function getAuthHeaders(){

  return {
    "Content-Type":"application/json",
    "Authorization": `Bearer ${token}`
  };
}

// ======================================================
// LOAD ROUTE
// ======================================================

async function loadRoute() {

  try {

    if (!navigator.onLine){

      const offlineVisits =
        getLocalData(
          "offline_visits"
        ) || [];

      visits = offlineVisits;

      renderVisits();

      return;
    }

    const res =
      await fetch(
        `${API}/visits/today`,
        {
          headers:{
            "Authorization": `Bearer ${token}`
          }
        }
      );

    if (res.status === 401 || res.status === 403){

      redirectToLogin();

      return;
    }

    const data =
      await res.json();

    const allVisits =
      data.visits || [];

    visits =
      allVisits.filter(v =>

        String(
          v.technicianName || ""
        ).toLowerCase()

        ===

        String(
          user.name || ""
        ).toLowerCase()
      );

    saveLocalData(
      "offline_visits",
      visits
    );

    renderVisits();

  } catch (err) {

    console.error(
      "Erro rota:",
      err
    );

    const status =
      document.getElementById("status");

    if (status){

      status.innerText =
        "Erro carregar ronda";
    }
  }
}

// ======================================================
// RENDER VISITS
// ======================================================

function renderVisits() {

  const list =
    document.getElementById("list");

  if (!list) return;

  list.innerHTML = "";

  if (!visits.length) {

    list.innerHTML = `
      <div class="card">
        Sem visitas hoje
      </div>
    `;

    return;
  }

  visits.forEach(v => {

    const client =
      v.client?.name || "-";

    const pool =
      v.pool?.name || "-";

    const photos =
      v.VisitPhoto || [];

    const beforePhotos =
      photos.filter(
        p => p.type === "BEFORE"
      );

    const afterPhotos =
      photos.filter(
        p => p.type === "AFTER"
      );

    const div =
      document.createElement("div");

    div.className = "card";

    div.innerHTML = `

      <h3>
        ${escapeHtml(pool)}
      </h3>

      <div>
        👤 ${escapeHtml(client)}
      </div>

      <div>
        Estado:
        <b>${escapeHtml(v.status || "-")}</b>
      </div>

      <div>
        Início:
        ${
          v.startAt
            ? new Date(v.startAt)
                .toLocaleString("pt-PT")
            : "-"
        }
      </div>

      <div>
        Fim:
        ${
          v.endAt
            ? new Date(v.endAt)
                .toLocaleString("pt-PT")
            : "-"
        }
      </div>

      <div style="margin-top:15px;">

        <input
          id="ph-${v.id}"
          placeholder="pH"
          type="number"
          step="0.1"
        >

        <input
          id="chlorine-${v.id}"
          placeholder="Cloro"
          type="number"
          step="0.1"
        >

        <input
          id="alkalinity-${v.id}"
          placeholder="Alcalinidade"
          type="number"
        >

        <input
          id="salt-${v.id}"
          placeholder="Sal"
          type="number"
        >

        <textarea
          id="products-${v.id}"
          placeholder="Produtos adicionados"
        ></textarea>

      </div>

      <div style="margin-top:10px;">

        <b>BEFORE</b><br>

        ${
          beforePhotos.map(p => `
            <img
              src="${escapeHtml(p.url)}"
              class="visit-photo"
            >
          `).join("")
        }

      </div>

      <div style="margin-top:10px;">

        <b>AFTER</b><br>

        ${
          afterPhotos.map(p => `
            <img
              src="${escapeHtml(p.url)}"
              class="visit-photo"
            >
          `).join("")
        }

      </div>

      <textarea
        id="notes-${v.id}"
        placeholder="Observações técnicas"
      ></textarea>

      <div class="visit-actions">

        <button
          class="photo-btn"
          data-action="before"
          data-visit-id="${v.id}"
        >
          📸 BEFORE
        </button>

        <button
          class="photo-btn"
          data-action="after"
          data-visit-id="${v.id}"
        >
          📸 AFTER
        </button>

        <button
          class="complete-btn"
          data-action="complete"
          data-visit-id="${v.id}"
        >
          ✔ Concluir
        </button>

        <button
          class="map-btn"
          data-action="map"
          data-lat="${v.pool?.latitude || 0}"
          data-lng="${v.pool?.longitude || 0}"
        >
          Navegar
        </button>

      </div>

    `;

    list.appendChild(div);
  });

  bindVisitButtons();
}

// ======================================================
// BIND VISIT BUTTONS
// ======================================================

function bindVisitButtons(){

  document
    .querySelectorAll("[data-action]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const action =
            button.dataset.action;

          const visitId =
            Number(button.dataset.visitId);

          if (action === "before"){

            uploadPhoto(
              visitId,
              "BEFORE"
            );

            return;
          }

          if (action === "after"){

            uploadPhoto(
              visitId,
              "AFTER"
            );

            return;
          }

          if (action === "complete"){

            completeVisit(
              visitId
            );

            return;
          }

          if (action === "map"){

            openGoogleMaps(
              button.dataset.lat,
              button.dataset.lng
            );
          }
        }
      );
    });
}

// ======================================================
// COMPLETE VISIT
// ======================================================

async function completeVisit(id){

  try {

    const notes =
      document.getElementById(
        `notes-${id}`
      ).value;

    const ph =
      document.getElementById(
        `ph-${id}`
      ).value;

    const chlorine =
      document.getElementById(
        `chlorine-${id}`
      ).value;

    const alkalinity =
      document.getElementById(
        `alkalinity-${id}`
      ).value;

    const salt =
      document.getElementById(
        `salt-${id}`
      ).value;

    const products =
      document.getElementById(
        `products-${id}`
      ).value;

    const body = {

      visitId:id,

      notes,

      ph,

      chlorine,

      alkalinity,

      salt,

      products
    };

    if (!navigator.onLine){

      addOfflineAction({

        url:
          `${API}/visits/complete`,

        method:
          "POST",

        body
      });

      updateOfflineBar();

      alert(
        "📦 Visita guardada offline"
      );

      return;
    }

    const res =
      await fetch(
        `${API}/visits/complete`,
        {

          method:"POST",

          headers:getAuthHeaders(),

          body:
            JSON.stringify(body)
        }
      );

    if (res.status === 401 || res.status === 403){

      redirectToLogin();

      return;
    }

    const data =
      await res.json();

    if (!data.ok){

      alert("Erro concluir");

      return;
    }

    alert(
      "Visita concluída"
    );

    loadRoute();

  } catch(err){

    console.error(err);

    alert("Erro");
  }
}

// ======================================================
// PHOTO
// ======================================================

async function uploadPhoto(id, type){

  try {

    const input =
      document.createElement("input");

    input.type =
      "file";

    input.accept =
      "image/*";

    input.capture =
      "environment";

    input.onchange = async () => {

      const file =
        input.files[0];

      if (!file) return;

      if (!navigator.onLine){

        const reader =
          new FileReader();

        reader.onload = function(e){

          saveOfflinePhoto({

            visitId:id,

            type,

            base64:e.target.result
          });

          updateOfflineBar();

          alert(
            "📸 Foto guardada offline"
          );
        };

        reader.readAsDataURL(file);

        return;
      }

      const formData =
        new FormData();

      formData.append(
        "photo",
        file
      );

      formData.append(
        "type",
        type
      );

      const res =
        await fetch(
          `${API}/visits/${id}/photo`,
          {

            method:"POST",

            headers:{
              "Authorization": `Bearer ${token}`
            },

            body: formData
          }
        );

      if (res.status === 401 || res.status === 403){

        redirectToLogin();

        return;
      }

      const data =
        await res.json();

      if (!data.ok){

        alert("Erro upload");

        return;
      }

      alert(
        `Foto ${type} enviada`
      );

      loadRoute();
    };

    input.click();

  } catch(err){

    console.error(err);

    alert("Erro foto");
  }
}

// ======================================================
// INTERNAL ALERT
// ======================================================

async function sendInternalAlert(){

  try {

    const text =
      document.getElementById(
        "internalAlert"
      ).value;

    if (!text){

      alert("Escreve o alerta");

      return;
    }

    alert(
      "Alerta enviado ao administrador"
    );

    document.getElementById(
      "internalAlert"
    ).value = "";

  } catch(err){

    console.error(err);

    alert("Erro alerta");
  }
}

// ======================================================
// GOOGLE MAPS
// ======================================================

function openGoogleMaps(lat, lng) {

  window.open(
    `https://www.google.com/maps?q=${lat},${lng}`,
    "_blank"
  );
}

// ======================================================
// WORKDAY
// ======================================================

async function startDay(){

  if (!user || !user.id){

    redirectToLogin();

    return;
  }

  await fetch(`${API}/workday/start`,{

    method:"POST",

    headers:getAuthHeaders(),

    body: JSON.stringify({
      userId:user.id
    })
  });

  checkDay();
}

async function endDay(){

  if (!user || !user.id){

    redirectToLogin();

    return;
  }

  await fetch(`${API}/workday/end`,{

    method:"POST",

    headers:getAuthHeaders(),

    body: JSON.stringify({
      userId:user.id
    })
  });

  checkDay();
}

async function checkDay(){

  try {

    if (!user || !user.id){

      return;
    }

    const res =
      await fetch(
        `${API}/workday/status/${user.id}`,
        {
          headers:{
            "Authorization": `Bearer ${token}`
          }
        }
      );

    const data =
      await res.json();

    const el =
      document.getElementById("dayStatus");

    if (!el) return;

    if (!data.workDay){

      el.innerText =
        "Não iniciado";

    } else {

      el.innerText =
        data.workDay.status === "ACTIVE"
          ? "🟢 Em trabalho"
          : "🔴 Terminado";
    }

  } catch {}
}

// ======================================================
// UTILS
// ======================================================

function escapeHtml(value){

  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ======================================================
// ACTIONS
// ======================================================

function optimizeRoute(){

  alert(
    "Modo otimização em desenvolvimento"
  );
}

function logout(){

  localStorage.removeItem("token");

  localStorage.removeItem("user");

  window.location.href =
    "/login";
}
