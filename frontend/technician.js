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

let routeLoadRevision = 0, routeServerConfirmedAt = null, routeViewSource = '', routeCacheWarning = '', routeVisibleDay = null;
function todayRouteKey() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}
function readRouteState() {
  try { return window.CWLegacyRouteCache.read(legacyWriteSession, todayRouteKey()); }
  catch (error) { routeCacheWarning = error.message; return null; }
}
function showRouteStatus(message) {
  const status = document.getElementById('status');
  if (status) status.textContent = message || (routeViewSource === 'offline' ? 'Rota offline da conta atual, consultada em ' + routeServerConfirmedAt + '. Confirme alterações com o escritório.' : 'Rota atualizada para ' + routeVisibleDay + '.') + (routeCacheWarning ? ' ' + routeCacheWarning : '');
}

function isVisitCompleted(visit){
  const status = String(visit?.status || "").toUpperCase();
  return Boolean(visit?.endAt) || ["DONE", "COMPLETED", "CONCLUDED", "CONCLUIDA", "CONCLUÍDA"].includes(status);
}

function nextPendingVisitId(items = visits){
  const next = (Array.isArray(items) ? items : []).find((visit) => !isVisitCompleted(visit));
  return next?.id || null;
}

function activeVisitId(){
  const state = readRouteState();
  const lockedId = state?.activeVisitId ? Number(state.activeVisitId) : null;
  if (lockedId && visits.some((visit) => Number(visit.id) === lockedId && !isVisitCompleted(visit))) {
    return lockedId;
  }
  return nextPendingVisitId();
}

function persistRouteSnapshot(nextVisits, extra = {}) {
  const previous = readRouteState();
  const snapshot = {
    v: 2, owner: legacyWriteSession.owner, technicianId: legacyWriteSession.technicianId, day: todayRouteKey(),
    serverConfirmedAt: routeServerConfirmedAt || previous?.serverConfirmedAt,
    activeVisitId: extra.activeVisitId || nextPendingVisitId(nextVisits),
    visits: nextVisits, pendingSyncVisitIds: nextVisits.filter(visit => visit.pendingSync).map(visit => visit.id),
    updatedAt: new Date().toISOString(), source: extra.source || 'server'
  };
  try { window.CWLegacyRouteCache.save(snapshot, legacyWriteSession); routeCacheWarning = ''; }
  catch (error) { routeCacheWarning = 'A rota não ficou guardada para uso offline. ' + error.message; }
  return snapshot;
}
function validVisitCoordinates(pool) {
  return typeof pool?.latitude === 'number' && Number.isFinite(pool.latitude) && Math.abs(pool.latitude) <= 90 && typeof pool?.longitude === 'number' && Number.isFinite(pool.longitude) && Math.abs(pool.longitude) <= 180;
}
function mergeRouteVisits(serverVisits, completionRequests) {
  const pending = new Map(completionRequests.map(record => [record.resourceId, record]));
  return serverVisits.map(visit => {
    const request = pending.get(visit.id);
    // Current assignment, names, location and photos always come from the current response.
    if (request && !isVisitCompleted(visit) && !['CANCELLED','CANCELED','ARCHIVED'].includes(visit.status)) return { ...visit, status: 'DONE', endAt: request.createdAt, pendingSync: true };
    return { ...visit, pendingSync: !!request };
  });
}

function markLocalVisitCompleted(id, { pendingSync = false } = {}){
  const now = new Date().toISOString();
  visits = visits.map((visit) => {
    if (String(visit.id) !== String(id)) return visit;
    return {
      ...visit,
      status: "DONE",
      endAt: visit.endAt || now,
      pendingSync,
      syncError: "",
    };
  });

  persistRouteSnapshot(visits, {
    activeVisitId: nextPendingVisitId(visits),
    pendingSyncVisitIds: visits.filter((visit) => visit.pendingSync).map((visit) => visit.id),
    source: pendingSync ? "offline-complete" : "online-complete",
  });
  showRouteStatus();
}

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

        loadRoute();
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

let offlineBarRevision = 0, legacyEntryGeneration = 0;
const legacyWriteSession = window.CWFieldWriteStore.session();
const legacyCompletionBusy = new Set();
function protectLegacyRouteSession() {
  if (!window.CWFieldWriteStore.same(legacyWriteSession)) { ++routeLoadRevision; visits = []; document.getElementById('list')?.replaceChildren(); showRouteStatus('A sessão mudou. Reabra a página para consultar a rota da conta atual.'); }
  else if (routeVisibleDay && routeVisibleDay !== todayRouteKey()) { visits = []; document.getElementById('list')?.replaceChildren(); routeVisibleDay = null; loadRoute(); }
}
window.addEventListener('storage', protectLegacyRouteSession);
window.addEventListener('offline', () => { if (window.CWFieldWriteStore.same(legacyWriteSession) && routeVisibleDay) { routeViewSource = 'offline'; showRouteStatus(); } });
setInterval(protectLegacyRouteSession, 1000);
window.addEventListener('pagehide', () => { legacyEntryGeneration++; });
window.addEventListener('pageshow', () => updateOfflineBar());
window.addEventListener('cw:field-write-change', () => updateOfflineBar());
async function updateOfflineBar(syncText) {
  const revision = ++offlineBarRevision, credential = window.CristalAuth?.getToken?.();
  const results = await Promise.allSettled([
    typeof getOfflineQueue === 'function' ? getOfflineQueue() : [],
    typeof getOfflinePhotos === 'function' ? getOfflinePhotos() : [],
    Promise.resolve().then(() => typeof getOfflineGps === 'function' ? getOfflineGps() : []),
    window.CWFieldWriteStore.records('TECHNICIAN_ALERT')
  ]);
  if (revision !== offlineBarRevision || credential !== window.CristalAuth?.getToken?.()) return;
  const errors = results.map((result, index) => result.status === 'rejected' ? (index === 2 ? 'GPS por rever; os registos foram preservados.' : result.reason.message) : '').filter(Boolean);
  const rows = results.map(result => result.status === 'fulfilled' ? result.value : []);
  const network = document.getElementById('offlineNetwork'), visitsEl = document.getElementById('offlineVisits'), photosEl = document.getElementById('offlinePhotos');
  if (network) network.textContent = errors[0] || (rows[3].length && syncText?.includes('Sincronizado') ? 'Alertas por confirmar' : syncText) || (navigator.onLine ? 'Online' : 'Offline');
  if (visitsEl) visitsEl.textContent = (results[0].status === 'fulfilled' ? rows[0].length : '?') + ' visitas por confirmar';
  if (photosEl) photosEl.textContent = (results[1].status === 'fulfilled' ? rows[1].length : '?') + ' fotos por confirmar · ' + rows[2].length + ' GPS pendentes · ' + (results[3].status === 'fulfilled' ? rows[3].length : '?') + ' alertas por confirmar';
  let panel = document.getElementById('legacyFieldRecovery');
  if (!panel) { panel = document.createElement('section'); panel.id = 'legacyFieldRecovery'; panel.setAttribute('role', 'status'); panel.style.cssText = 'padding:14px;background:#fff4ce;color:#624400'; (network?.parentElement || document.body).append(panel); }
  panel.replaceChildren(); panel.hidden = !errors.length && !rows[0].length && !rows[1].length && !rows[3].length;
  for (const message of errors) { const item = document.createElement('p'); item.textContent = message; panel.append(item); }
  for (const record of [...rows[1], ...rows[0], ...rows[3]]) {
    const row = document.createElement('div'), label = document.createElement('span'), retry = document.createElement('button');
    label.textContent = record.label + ' — ' + (record.failure?.message || 'por confirmar. '); retry.textContent = 'Confirmar envio guardado'; retry.type = 'button'; retry.style.cssText = 'min-height:44px;white-space:normal';
    const captured = window.CWFieldWriteStore.session();
    retry.onclick = async () => { retry.disabled = true; try { if (record.scope === 'VISIT_COMPLETION') await sendOfflineAction(record, captured); else await window.CWFieldWriteStore.send(record.requestId, captured); if (window.CWFieldWriteStore.same(captured)) { await updateOfflineBar(); loadRoute(); } } catch (error) { if (window.CWFieldWriteStore.same(captured)) label.textContent = record.label + ' — ' + error.message; } finally { retry.disabled = false; } };
    row.append(label, retry); panel.append(row);
  }
}

async function runAutoSync(){

  if (!navigator.onLine)
    return;

  if (isSyncing)
    return;

  isSyncing = true;
  const syncCredential = window.CristalAuth?.getToken?.();
  const sameSyncSession = () => !!syncCredential && window.CristalAuth?.getToken?.() === syncCredential;

  updateOfflineBar(
    "🔄 A sincronizar..."
  );

  try {

    if (
      typeof syncOfflineQueue === "function"
    ){

      const queueResult = await syncOfflineQueue();
      if (!sameSyncSession()) return;
      if (queueResult?.pending || queueResult?.unattributed) throw new Error(queueResult.error || 'Conclusões por confirmar ou a rever.');
    }

    if (
      typeof syncOfflinePhotos === "function"
    ){

      const photoResult = await syncOfflinePhotos();
      if (!sameSyncSession()) return;
      if (photoResult?.pending || photoResult?.unattributed) throw new Error(photoResult.error || 'Fotografias por confirmar ou a rever.');
    }

    if (
      typeof syncOfflineGps === "function"
    ){

      const gpsResult = await syncOfflineGps();
      if (!sameSyncSession()) return;
      if (gpsResult?.pending || gpsResult?.unattributed || gpsResult?.busy) throw new Error('GPS ainda por confirmar ou a rever.');
    }

    updateOfflineBar(
      "✅ Sincronizado"
    );

    setTimeout(() => {

      updateOfflineBar();

    }, 2500);

    loadRoute();

  } catch(err){

    if (!sameSyncSession()) return;

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
  const captured = legacyWriteSession, ticket = ++routeLoadRevision, day = todayRouteKey();
  if (!window.CWFieldWriteStore.same(captured)) return;
  const current = () => ticket === routeLoadRevision && day === todayRouteKey() && window.CWFieldWriteStore.same(captured);
  routeCacheWarning = '';
  try {
    if (!navigator.onLine) {
      const snapshot = readRouteState();
      const pending = snapshot ? await window.CWFieldWriteStore.records('VISIT_COMPLETION', captured) : [];
      if (!current()) return;
      visits = mergeRouteVisits(snapshot?.visits || [], pending); routeVisibleDay = day; routeServerConfirmedAt = snapshot?.serverConfirmedAt || null; routeViewSource = 'offline';
      renderVisits();
      showRouteStatus(snapshot ? null : routeCacheWarning || 'Não há rota offline confirmada para esta conta e dia. Abra a ronda com ligação.');
      return;
    }
    const response = await fetch(API + '/visits/today?date=' + encodeURIComponent(day), { headers: { Authorization: 'Bearer ' + captured.token }, cache: 'no-store' });
    if (!current()) return;
    if (response.status === 401 || response.status === 403) { redirectToLogin(); return; }
    const data = await response.json(); if (!current()) return;
    const ids = new Set();
    if (!response.ok || data.ok !== true || data.date !== day || data.technicianId !== captured.technicianId || !Array.isArray(data.visits) || data.total !== data.visits.length || data.visits.some(visit => { if (!visit || !Number.isSafeInteger(visit.id) || visit.id <= 0 || ids.has(visit.id) || visit.technicianId !== captured.technicianId || typeof visit.status !== 'string') return true; ids.add(visit.id); return false; })) throw Error('Não foi possível confirmar a rota desta conta e dia. A lista anterior foi conservada; tente atualizar com rede.');
    const previous = readRouteState();
    const pending = await window.CWFieldWriteStore.records('VISIT_COMPLETION', captured); if (!current()) return;
    visits = mergeRouteVisits(data.visits, pending); routeVisibleDay = day; routeServerConfirmedAt = new Date().toISOString(); routeViewSource = 'server';
    persistRouteSnapshot(visits, { activeVisitId: previous?.activeVisitId && visits.some(visit => visit.id === previous.activeVisitId && !isVisitCompleted(visit)) ? previous.activeVisitId : nextPendingVisitId(visits), source: 'server' });
    renderVisits(); showRouteStatus();
  } catch (error) { if (current()) showRouteStatus(error.message || 'Não foi possível carregar a ronda. A lista anterior foi conservada.'); }
}

// ======================================================
// RENDER VISITS
// ======================================================

function renderVisits() {
  if (!window.CWFieldWriteStore.same(legacyWriteSession)) return;
  window.CWFieldInternalAlert?.setVisits(visits);

  const list =
    document.getElementById("list");

  if (!list) return;

  list.innerHTML = "";

  if (!visits.length) {

    list.innerHTML = `
      <div class="card">
        ${routeViewSource === 'offline' && !routeServerConfirmedAt ? 'Rota indisponível sem confirmação desta conta e dia.' : 'Sem visitas hoje'}
      </div>
    `;

    return;
  }

  const lockedVisitId = activeVisitId();

  visits.forEach(v => {

    const client =
      v.client?.name || "-";

    const pool =
      v.pool?.name || "-";

    const photos =
      v.photos || v.VisitPhoto || [];

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

    const isLocked = lockedVisitId && String(lockedVisitId) === String(v.id);
    const isBlocked = lockedVisitId && String(lockedVisitId) !== String(v.id) && !isVisitCompleted(v);

    div.className = `card${isLocked ? " active-visit" : ""}${isBlocked ? " blocked-visit" : ""}`;

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

      ${isLocked ? '<div class="visit-lock-note">Stop atual bloqueado para evitar execução duplicada.</div>' : (isBlocked ? '<div class="visit-block-note">Esta visita está bloqueada enquanto o stop atual estiver em curso.</div>' : '')}

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
          ${isBlocked ? "disabled" : ""}
        >
          ✔ Concluir
        </button>

        <button
          class="map-btn"
          data-action="map"
          data-lat="${v.pool?.latitude ?? ''}"
          data-lng="${v.pool?.longitude ?? ''}"
          ${validVisitCoordinates(v.pool) ? '' : 'disabled'}
        >
          ${validVisitCoordinates(v.pool) ? 'Navegar' : 'Sem coordenadas: confirmar morada'}
        </button>

      </div>

    `;

    list.appendChild(div);
    window.CWLegacyVisitDrafts.bind(div, v);
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

async function completeVisit(id) {
  const captured = legacyWriteSession, generation = legacyEntryGeneration;
  if (legacyCompletionBusy.has(id)) return;
  legacyCompletionBusy.add(id);
  try {
    const visit = visits.find(item => String(item.id) === String(id)), lockedId = activeVisitId();
    if (lockedId && String(lockedId) !== String(id) && visit && !isVisitCompleted(visit)) throw Error('Há uma visita em curso. Conclua essa visita antes de avançar.');
    const body = { visitId: Number(id), ...await window.CWLegacyVisitDrafts.beforeComplete(id) };
    const record = await addOfflineAction({ url: '/api/core/visits/' + id + '/complete', method: 'POST', body }, captured);
    if (!window.CWFieldWriteStore.same(captured) || generation !== legacyEntryGeneration) return;
    markLocalVisitCompleted(id, { pendingSync: true }); renderVisits(); await updateOfflineBar();
    try {
      await sendOfflineAction(record, captured);
      if (!window.CWFieldWriteStore.same(captured) || generation !== legacyEntryGeneration) return;
      markLocalVisitCompleted(id, { pendingSync: false }); renderVisits(); alert('Visita confirmada no servidor.'); loadRoute();
    } catch (error) { if (window.CWFieldWriteStore.same(captured) && generation === legacyEntryGeneration) alert('Conclusão guardada, por confirmar. ' + error.message); }
  } catch (error) { if (window.CWFieldWriteStore.same(captured) && generation === legacyEntryGeneration) alert(error.message || 'Não foi possível guardar a conclusão. Os campos foram preservados.'); }
  finally { legacyCompletionBusy.delete(id); if (window.CWFieldWriteStore.same(captured)) updateOfflineBar(); }
}

async function uploadPhoto(id, type) {
  const captured = legacyWriteSession, generation = legacyEntryGeneration;
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
  input.onchange = async () => {
    if (!window.CWFieldWriteStore.same(captured) || generation !== legacyEntryGeneration) return;
    const file = input.files[0]; if (!file) return;
    let saved = false;
    try {
      const record = await saveOfflinePhoto({ visitId: Number(id), type, file }, captured); saved = true;
      if (!window.CWFieldWriteStore.same(captured) || generation !== legacyEntryGeneration) return;
      await window.CWFieldWriteStore.send(record.requestId, captured);
      if (window.CWFieldWriteStore.same(captured) && generation === legacyEntryGeneration) { alert('Fotografia confirmada no servidor.'); loadRoute(); }
    } catch (error) { if (window.CWFieldWriteStore.same(captured) && generation === legacyEntryGeneration) alert((saved ? 'Fotografia guardada neste dispositivo; por confirmar. ' : 'A fotografia não ficou guardada. Selecione-a novamente. ') + error.message); }
    finally { if (window.CWFieldWriteStore.same(captured)) updateOfflineBar(); }
  };
  input.click();
}

async function sendInternalAlert(){
  await window.CWFieldInternalAlert.send();
}

// ======================================================
// GOOGLE MAPS
// ======================================================

function openGoogleMaps(lat, lng) {
  if (!window.CWFieldWriteStore.same(legacyWriteSession)) return;
  if (lat == null || lng == null || String(lat).trim() === '' || String(lng).trim() === '' || !validVisitCoordinates({ latitude: Number(lat), longitude: Number(lng) })) { alert('Coordenadas indisponíveis. Confirme a morada com o escritório.'); return; }
  window.open(
    `https://www.google.com/maps?q=${lat},${lng}`,
    "_blank", "noopener,noreferrer"
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
  window.CWFieldRoutePreview.open();
}

function logout(){

  localStorage.removeItem("token");

  localStorage.removeItem("user");

  window.location.href =
    "/login";
}
