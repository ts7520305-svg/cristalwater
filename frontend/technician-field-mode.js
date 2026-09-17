(function () {
  const ui = window.CwUi || {
    success: (m) => console.log(m),
    error: (m) => console.error(m),
    info: (m) => console.info(m),
  };
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char]));

  let visits = [];
  let routeConfirmedAt = null;
  window.CWFieldDaySnapshot = () => ({
    confirmedAt: sameFieldSession() && window.CWFieldRouteCache.same(routeContext) ? routeConfirmedAt : null,
    visits: sameFieldSession() && window.CWFieldRouteCache.same(routeContext) ? visits.map(visit => ({ id: visit.id, visitType: visit.visitType || 'REGULAR', name: visit.pool?.name || `Visita ${visit.id}`, done: isVisitDone(visit), future: visit.assistSource === 'tomorrow' })) : [],
  });
  let index = 0;
  let startedAt = null;
  let pendingProblems = [];
  let selectedPhotoType = "AFTER";
  const fieldWriteSession = window.CWFieldWriteStore?.session();
  let routeRevision = 0, routeContext = null, routeSnapshot = null, routeSessionBlocked = false;
  let fieldWriteGeneration = 0, selectedPhotoContext = null;
  let fieldPendingRevision = 0;
  window.addEventListener('pagehide', () => { ++fieldWriteGeneration; ++routeRevision; });
  const sameFieldSession = () => window.CWFieldWriteStore?.same(fieldWriteSession);
  const startingVisits = new Set();
  const extraVisitNotice = 'Visita extra: registe o trabalho, as medições, os produtos e as fotografias. Pode também registar revisões de equipamento, água aberta ou bomba em manual. Depois de concluir, use “Corrigir registo” para rever os valores. Pode registar impedimentos e combinar o regresso com o escritório.';
  window.CWFieldVisitContext = () => sameFieldSession() && current() ? { id:current().id, visitType:current().visitType || 'REGULAR', poolId:current().poolId || current().pool?.id, clientId:current().clientId || current().client?.id || current().pool?.clientId, poolName:current().pool?.name, clientName:current().client?.name, technicianName:activeTechnician?.name || current().technician?.name } : null;
  let visitPhotos = [];
  let currentDraftEntry = null;
  const visitDraftManager = window.CWFieldVisitDrafts.create(fieldWriteSession, { changed(entry, fill) {
    if (!sameFieldSession() || entry !== currentDraftEntry) return;
    if (fill) { const draft=visitDraftManager.expand(entry); applyVisitForm(draft); visitPhotos=draft.photos || []; visitPhotosByKey[entry.key]=visitPhotos;renderPhotoList(); }
    visitDraftManager.paint(entry);
  } });
  window.CWFieldDraftSummary = () => visitDraftManager.pendingSummary();
  let visitPhotosByKey = {};
  let waterReminders = [];
  let waterRemindersError = '';
  let usedProducts = [];
  let activeWorkGuide = null;
  let activeWorkStock = [];
  let activeTransportGuide = null;
  let activeInsurance = null;
  let activeVehicle = null;
  let activeTechnician = null;
  let technicalProposals = [];
  let docsSource = "live";
  let docsCompliance = null;
  let documentsLoaded = false;
  let assistOptions = { loading: false, loadedKey: "", otherToday: [], tomorrow: [], error: "" };
  let notifiedVisitNoticeKey = "";
  let activePoolFilter = "TODO";
  let opsSnapshot = { docsReady: false, done: 0, total: 0, pending: 0 };
  const waterTimers = new Map();
  const draftFieldIds = ["ph", "chlorine", "alkalinity", "salt", "orp", "temperature", "notes"];
  const checkIds = ["cleaned", "vacuumed", "basketCleaned", "brushed", "waterlineClean", "backwashDone"];

  const POOL_STATE = {
    TODO: "Por iniciar",
    TRAVEL: "A caminho",
    IN_PROGRESS: "Em intervenção",
    WATER_OPEN: "Água aberta",
    WAITING_MATERIAL: "A aguardar material",
    CRITICAL: "Alerta crítico",
    DONE: "Concluída",
    INCOMPLETE: "Por concluir",
  };

  const MAP_ROUTE_PATH = "/technician-map";
  const FIELD_RETURN_CONTRACT_KEY = "cw:tech-field:return-contract:v1";
  const FIELD_UI_STATE_KEY = "cw:tech-field:ui-state:v1";
  const FIELD_LAST_EXPLICIT_FILTER_KEY = "cw:tech-field:last-explicit-filter:v1";
  const FIELD_DOCS_CACHE_KEY_PREFIX = "cw:tech-field:docs-cache:v1:";
  const OP_EXCEPTION_STATE_KEY = "cw:tech-field:op-exception-state:v1";
  const OP_EXCEPTION_HISTORY_KEY = "cw:tech-field:op-exception-history:v1";
  const OP_EXCEPTION_COMMAND_BRIDGE_KEY = "cw:tech-field:op-exception-command:v1";

  function safeSessionRead(key, fallback) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function safeSessionWrite(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function safeSessionDelete(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (_) {}
  }

  function normalizePoolFilter(value, fallback = "TODO") {
    const safe = String(value || "").toUpperCase();
    if (["TODO", "IN_PROGRESS", "DONE"].includes(safe)) return safe;
    return fallback;
  }

  function normalizeFieldTab(value, fallback = "hoje") {
    const safe = String(value || "").toLowerCase();
    if (["hoje", "agora", "docs", "more", "mapa"].includes(safe)) return safe;
    return fallback;
  }

  function readDomActivePoolFilter(fallback = "TODO") {
    return normalizePoolFilter(
      document.querySelector("#poolSegments [data-pool-filter].active")?.dataset?.poolFilter,
      fallback
    );
  }

  function currentFieldTab() {
    return normalizeFieldTab(document.body?.dataset?.fieldTab || "hoje", "hoje");
  }

  function selectedVisitId() {
    return current()?.id ? String(current().id) : "";
  }

  function selectedVisitTitle() {
    return current()?.pool?.name || "";
  }

  function persistFieldUiState() {
    const safeActiveFilter = readDomActivePoolFilter(activePoolFilter || "TODO");
    activePoolFilter = normalizePoolFilter(safeActiveFilter, "TODO");
    const payload = {
      activeTab: normalizeFieldTab(currentFieldTab(), "hoje"),
      activeFilter: activePoolFilter,
      selectedVisitId: selectedVisitId(),
      selectedVisitType: current()?.visitType || 'REGULAR',
      selectedVisitTitle: selectedVisitTitle(),
      scrollY: Math.max(0, Math.round(window.scrollY || 0)),
      savedAt: new Date().toISOString(),
    };
    storageWrite(FIELD_UI_STATE_KEY, payload);
    try {
      localStorage.setItem("cwFieldActivePoolFilter", payload.activeFilter);
    } catch (_) {}
  }

  function readFieldUiState() {
    const saved = storageRead(FIELD_UI_STATE_KEY, null);
    if (!saved || typeof saved !== "object") return null;
    return {
      activeTab: normalizeFieldTab(saved.activeTab, "hoje"),
      activeFilter: normalizePoolFilter(saved.activeFilter, "TODO"),
      selectedVisitId: String(saved.selectedVisitId || ""),
      selectedVisitType: saved.selectedVisitType || '',
      selectedVisitTitle: String(saved.selectedVisitTitle || ""),
      scrollY: Number.isFinite(Number(saved.scrollY)) ? Math.max(0, Number(saved.scrollY)) : 0,
    };
  }

  function readLastExplicitFilter() {
    try {
      const raw = String(localStorage.getItem(FIELD_LAST_EXPLICIT_FILTER_KEY) || "").trim();
      if (!raw) return "";
      return normalizePoolFilter(raw, "");
    } catch (_) {
      return "";
    }
  }

  function writeLastExplicitFilter(filter) {
    const safe = normalizePoolFilter(filter, "");
    if (!safe) return;
    try {
      localStorage.setItem(FIELD_LAST_EXPLICIT_FILTER_KEY, safe);
    } catch (_) {}
  }

  function buildMapReturnContract() {
    const domActiveFilter = readDomActivePoolFilter(activePoolFilter || "TODO");
    return {
      returnTo: `${window.location.pathname}${window.location.search || ""}${window.location.hash || ""}`,
      activeTab: normalizeFieldTab(currentFieldTab(), "hoje"),
      activeFilter: normalizePoolFilter(domActiveFilter || activePoolFilter, "TODO"),
      selectedVisitId: selectedVisitId(),
      selectedVisitType: current()?.visitType || 'REGULAR',
      selectedVisitTitle: selectedVisitTitle(),
      activeInterventionVisitId: String(visits.find((visit) => hasActiveIntervention(visit))?.id || ""),
      scrollY: Math.max(0, Math.round(window.scrollY || 0)),
      createdAt: new Date().toISOString(),
      source: "technician-field-mode",
    };
  }

  function persistMapReturnContract(contract) {
    if (!contract) return;
    safeSessionWrite(FIELD_RETURN_CONTRACT_KEY, contract);
  }

  function sanitizeReturnToPath(raw) {
    const fallback = "/technician-field-mode";
    const text = String(raw || "").trim();
    if (!text.startsWith("/")) return fallback;
    if (!text.startsWith("/technician-field-mode")) return fallback;
    return text;
  }

  function buildMapRouteFromContract(contract) {
    const params = new URLSearchParams();
    params.set("returnTo", sanitizeReturnToPath(contract.returnTo));
    params.set("activeTab", normalizeFieldTab(contract.activeTab, "hoje"));
    params.set("activeFilter", normalizePoolFilter(contract.activeFilter, "TODO"));
    if (contract.selectedVisitId) params.set("selectedVisitId", String(contract.selectedVisitId));
    if (contract.selectedVisitType) params.set("selectedVisitType", contract.selectedVisitType);
    if (Number.isFinite(Number(contract.scrollY))) params.set("scrollY", String(Math.max(0, Number(contract.scrollY))));
    return `${MAP_ROUTE_PATH}?${params.toString()}`;
  }

  function readReturnContractFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const selectedVisit = params.get("selectedVisitId");
      const activeTab = params.get("activeTab");
      const activeFilter = params.get("activeFilter");
      const returnTo = params.get("returnTo");
      const scrollY = Number(params.get("scrollY"));

      if (!activeTab && !activeFilter && !selectedVisit) return null;
      if (returnTo && !sanitizeReturnToPath(returnTo).startsWith("/technician-field-mode")) return null;

      return {
        returnTo: sanitizeReturnToPath(returnTo || "/technician-field-mode"),
        activeTab: normalizeFieldTab(activeTab, "hoje"),
        activeFilter: normalizePoolFilter(activeFilter, "TODO"),
        selectedVisitId: String(selectedVisit || ""),
        selectedVisitType: params.get('selectedVisitType') || '',
        activeInterventionVisitId: "",
        scrollY: Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0,
        source: "url",
      };
    } catch (_) {
      return null;
    }
  }

  function readReturnContract() {
    const sessionContract = safeSessionRead(FIELD_RETURN_CONTRACT_KEY, null);
    if (sessionContract && sanitizeReturnToPath(sessionContract.returnTo).startsWith("/technician-field-mode")) {
      const returned = readReturnContractFromUrl();
      return {
        returnTo: sanitizeReturnToPath(sessionContract.returnTo),
        activeTab: normalizeFieldTab(sessionContract.activeTab, "hoje"),
        activeFilter: normalizePoolFilter(sessionContract.activeFilter, "TODO"),
        selectedVisitId: returned?.selectedVisitId || String(sessionContract.selectedVisitId || ""),
        selectedVisitType: returned?.selectedVisitId ? returned.selectedVisitType : sessionContract.selectedVisitType || '',
        selectedVisitTitle: String(sessionContract.selectedVisitTitle || ""),
        activeInterventionVisitId: String(sessionContract.activeInterventionVisitId || ""),
        scrollY: Number.isFinite(Number(sessionContract.scrollY)) ? Math.max(0, Number(sessionContract.scrollY)) : 0,
        source: "session",
      };
    }

    return readReturnContractFromUrl();
  }

  function clearReturnContract() {
    safeSessionDelete(FIELD_RETURN_CONTRACT_KEY);
  }

  function stripReturnParamsFromUrl() {
    try {
      const url = new URL(window.location.href);
      const keys = ["returnTo", "activeTab", "activeFilter", "selectedVisitId", "selectedVisitType", "scrollY"];
      const hadAny = keys.some((key) => url.searchParams.has(key));
      keys.forEach((key) => url.searchParams.delete(key));
      if (hadAny) {
        const next = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState({}, "", next);
      }
    } catch (_) {}
  }

  function applyVisitSelectionFromId(visitId, visitType) {
    const wanted = String(visitId || "");
    if (!wanted) return false;
    const matches = visits.map((visit,position)=>({visit,position})).filter(({visit})=>String(visit.id || '')===wanted && (!visitType || (visit.visitType || 'REGULAR')===visitType));
    if (matches.length !== 1) return false;
    index = matches[0].position;
    return true;
  }

  function applyReturnState(contract, fallbackState) {
    const fallbackFilter = normalizePoolFilter(fallbackState?.activeFilter || "", "");
    const explicitFilter = normalizePoolFilter(readLastExplicitFilter(), "");
    const preferredFilter = normalizePoolFilter(
      contract?.activeFilter
        || (fallbackFilter && fallbackFilter !== "TODO" ? fallbackFilter : "")
        || explicitFilter
        || fallbackFilter
        || "TODO",
      "TODO"
    );
    activePoolFilter = preferredFilter;

    const restoredVisit = applyVisitSelectionFromId(contract?.selectedVisitId, contract?.selectedVisitType)
      || applyVisitSelectionFromId(contract?.activeInterventionVisitId)
      || applyVisitSelectionFromId(fallbackState?.selectedVisitId, fallbackState?.selectedVisitType);

    if (!restoredVisit) {
      index = visits.findIndex((visit) => !isVisitDone(visit));
      if (index < 0) index = visits.length;
    }
  }

  function elapsedMinutesLabel(startAt) {
    if (!startAt) return "Sem tempo em curso";
    const date = new Date(startAt);
    if (Number.isNaN(date.getTime())) return "Sem tempo em curso";
    const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    return `${diffMinutes} minuto(s) em intervenção`;
  }

  function visitHasWaterOpen(visit) {
    if (!visit) return false;
    const visitId = String(visit.id || "");
    const poolId = String(visit.pool?.id || visit.poolId || "");
    return activeWaterReminders().some((reminder) => {
      if (reminder.status === "CLOSED") return false;
      if ((visit.visitType || "REGULAR") === (reminder.visitType || "REGULAR") && visitId && String(reminder.visitId || "") === visitId) return true;
      if (poolId && String(reminder.poolId || "") === poolId) return true;
      return false;
    });
  }

  function visitHasCriticalProblem(visit) {
    const text = `${visit?.status || ""} ${visit?.notes || ""} ${visit?.internalNotes || ""}`.toLowerCase();
    if (text.includes("bomba") && text.includes("manual")) return true;
    if (text.includes("critic")) return true;
    return pendingProblems.some((problem) => {
      const sameVisit = isRegularVisit(visit) && String(problem.visitId || "") === String(visit?.id || "");
      return sameVisit && String(problem.severity || "").toUpperCase() === "URGENTE";
    });
  }

  function visitHasMaterialBlock(visit) {
    const text = `${visit?.status || ""} ${visit?.notes || ""} ${visit?.internalNotes || ""}`.toLowerCase();
    return text.includes("aguardar material") || text.includes("stock") || text.includes("falta material");
  }

  function operationalStateCode(visit) {
    if (isVisitDone(visit)) return "DONE";
    if (visitHasCriticalProblem(visit)) return "CRITICAL";
    if (visitHasWaterOpen(visit)) return "WATER_OPEN";
    if (visitHasMaterialBlock(visit)) return "WAITING_MATERIAL";

    const status = String(visit?.status || "").toUpperCase();
    if (status === 'INCOMPLETE') return 'INCOMPLETE';
    if (["IN_PROGRESS", "STARTED", "ACTIVE"].includes(status) || (visit?.startAt && !visit?.endAt)) {
      return "IN_PROGRESS";
    }
    if (["ON_ROUTE", "TRAVEL", "EM_TRANSITO", "A_CAMINHO"].includes(status)) {
      return "TRAVEL";
    }
    return "TODO";
  }

  function operationalStateLabel(visit) {
    return POOL_STATE[operationalStateCode(visit)] || POOL_STATE.TODO;
  }

  function elapsedSinceLabel(isoValue) {
    if (!isoValue) return "duracao indisponivel";
    const started = new Date(isoValue);
    if (Number.isNaN(started.getTime())) return "duracao indisponivel";
    const minutes = Math.max(0, Math.round((Date.now() - started.getTime()) / 60000));
    if (minutes < 60) return `${minutes} minuto(s)`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return `${hours}h ${String(rem).padStart(2, "0")}m`;
  }

  function firstPresent(values = []) {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (!text) continue;
      return value;
    }
    return null;
  }

  function resolvePumpManualSignal(visit = current()) {
    const equipment = visit?.pool?.equipment || visit?.equipment || {};
    const stateRaw = firstPresent([
      equipment.pumpMode,
      equipment.pumpStatus,
      equipment.mode,
      equipment.manualMode,
      visit?.pumpMode,
      visit?.pumpStatus,
      visit?.manualPumpState,
    ]);
    const stateText = String(stateRaw || "").toUpperCase();
    const manualFlag = [
      equipment.pumpManual,
      equipment.isPumpManual,
      equipment.manual,
      visit?.pumpManual,
      visit?.isPumpManual,
      visit?.manual,
    ].some((value) => value === true || String(value).toLowerCase() === "true");
    const active = manualFlag || stateText.includes("MANUAL");

    const who = firstPresent([
      equipment.pumpManualBy,
      equipment.manualBy,
      visit?.pumpManualBy,
      visit?.manualBy,
      visit?.lastUpdatedBy,
    ]) || "pendente backend";
    const since = firstPresent([
      equipment.pumpManualAt,
      equipment.manualAt,
      visit?.pumpManualAt,
      visit?.manualAt,
      visit?.updatedAt,
    ]);
    const status = active ? "MANUAL" : (stateText || "SEM_SINAL");
    const poolName = visit?.pool?.name || "Piscina por confirmar";
    const hasBackendSignal = manualFlag || Boolean(stateRaw);
    const hasFullMetadata = Boolean(since && who && who !== "pendente backend");

    return {
      active,
      who,
      poolName,
      since,
      duration: elapsedSinceLabel(since),
      status,
      hasBackendSignal,
      hasFullMetadata,
      dependencyPending: !hasBackendSignal || !hasFullMetadata,
    };
  }

  function hasP0Interruption(visit = current()) {
    const pump = resolvePumpManualSignal(visit);
    const urgentProblems = pendingProblems.filter((problem) => String(problem.severity || "").toUpperCase() === "URGENTE").length;
    return activeWaterReminders().length > 0 || urgentProblems > 0 || pump.active;
  }

  function hasActiveIntervention(visit = current()) {
    if (!visit) return false;
    const code = operationalStateCode(visit);
    return ["IN_PROGRESS", "WATER_OPEN", "WAITING_MATERIAL"].includes(code) && !isVisitDone(visit);
  }

  function initialOperationalTab() {
    const hash = String(window.location.hash || "").toLowerCase();
    if (hash === "#agora") return "agora";
    if (hash === "#docs") return "docs";
    if (hash === "#more") return "more";
    if (hasActiveIntervention(current())) return "agora";
    if (hasP0Interruption(current())) return "hoje";
    return "hoje";
  }

  async function api(path, options = {}) {
    const { expectedStatus, ...fetchOptions } = options;
    const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...fetchOptions });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false || response.status === 202 || data.offline || (expectedStatus !== undefined && response.status !== expectedStatus)) throw new Error(data.error || data.message || "Sem confirmação do servidor; dados pendentes de sincronização");
    return data;
  }

  async function apiForm(path, formData) {
    const response = await fetch(path, { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false || response.status === 202 || data.offline) throw new Error(data.error || data.message || "Sem confirmação do servidor; dados pendentes de sincronização");
    return data;
  }

  function current() {
    return visits[index] || null;
  }

  function visitKey(visit = current()) {
    return visit?.id ? `visit-${visit.visitType || 'REGULAR'}-${visit.id}` : "visit-none";
  }

  function isRegularVisit(visit = current()) {
    return !!visit?.id && (!visit.visitType || visit.visitType === 'REGULAR');
  }

  function requireRegularVisit(visit = current()) {
    if (!sameFieldSession()) { toast('A sessão mudou. Reabra a página com a conta original.'); return false; }
    if (!isRegularVisit(visit)) { toast(visit ? extraVisitNotice : 'Escolha uma visita.'); return false; }
    return true;
  }

  function requireExecutableVisit(visit = current()) {
    if (!sameFieldSession()) { toast('A sessão mudou. Reabra a página com a conta original.'); return false; }
    if (!visit?.id || !['REGULAR','EXTRA'].includes(visit.visitType || 'REGULAR')) { toast('Escolha uma visita.'); return false; }
    if (visit.visitType === 'EXTRA' && isVisitDone(visit)) { toast('Visita extra concluída. Consulte o registo; correções exigem revisão pelo escritório.'); return false; }
    return true;
  }
  const photoPreviewCache = new Map();

  function readFieldDrafts() {
    return visitDraftManager.read();
  }
  window.CWFieldDraftSnapshot = () => { if (!sameFieldSession()) throw Error('Sessão alterada.'); return readFieldDrafts(); };

  function isVisitDone(visit) {
    const status = String(visit?.status || "").toUpperCase();
    return Boolean(visit?.endAt) || ["DONE", "COMPLETED", "CONCLUIDA", "CONCLUIDA"].includes(status);
  }

  function storageRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function storageWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) { return false; }
  }

  function toast(message) {
    const node = $("#toast");
    if (!node) {
      ui.info(message);
      return;
    }
    node.textContent = message;
    node.classList.add("show");
    setTimeout(() => node.classList.remove("show"), 2400);
  }

  function formatDate(value) {
    if (!value) return "Sem data definida";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Sem data definida";
    return date.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
  }

  function localIsoDate(date = new Date()) {
    const safe = Number.isNaN(date.getTime()) ? new Date() : date;
    return [
      safe.getFullYear(),
      String(safe.getMonth() + 1).padStart(2, "0"),
      String(safe.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function addLocalDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  function dayQueryParams(date, technicianId = currentTechnicianId()) {
    const params = new URLSearchParams();
    if (technicianId) params.set("technicianId", technicianId);
    params.set("date", localIsoDate(date));
    return params.toString();
  }

  function readVisitForm() {
    const values = {};
    draftFieldIds.forEach((id) => {
      values[id] = $(`#${id}`)?.value || "";
    });
    const checks = {};
    checkIds.forEach((id) => {
      checks[id] = Boolean($(`#${id}`)?.checked);
    });
    return {
      values,
      checks,
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      pendingProblems,
      usedProducts: usedProducts.map((product) => ({ ...product })),
      photos: visitPhotos.map((photo) => ({
        localId: photo.localId,
        type: photo.type,
        fileName: photo.fileName,
        previewUrl: photo.previewUrl?.startsWith("blob:") ? "" : photo.previewUrl,
        status: photo.status,
        error: photo.error,
        url: photo.url,
        serverId: photo.serverId || null,
      })),
    };
  }

  function applyVisitForm(draft) {
    const values = draft?.values || {};
    draftFieldIds.forEach((id) => {
      const node = $(`#${id}`);
      if (node) node.value = values[id] || (id === "shortageUnit" ? "L" : "");
    });

    const checks = draft?.checks || {};
    checkIds.forEach((id) => {
      const node = $(`#${id}`);
      if (!node) return;
      node.checked = Object.prototype.hasOwnProperty.call(checks, id)
        ? Boolean(checks[id])
        : false;
    });

    startedAt = draft?.startedAt ? new Date(draft.startedAt) : null;
    pendingProblems = Array.isArray(draft?.pendingProblems) ? draft.pendingProblems : [];
    usedProducts = Array.isArray(draft?.usedProducts) ? draft.usedProducts : [];
    updateAllReferenceStatuses();
    renderDoseRows();
  }

  function inputValue(value) {
    return value === undefined || value === null ? "" : String(value);
  }

  function parseProductsValue(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return raw ? [{ name: raw, quantity: "", unit: "" }] : [];
    }
  }

  function productsFromVisit(visit) {
    const fromJson = Array.isArray(visit?.chemicalsJson) ? visit.chemicalsJson : [];
    const fromChemicals = Array.isArray(visit?.chemicals) ? visit.chemicals : [];
    const fromText = parseProductsValue(visit?.products);
    const source = fromJson.length ? fromJson : (fromChemicals.length ? fromChemicals : fromText);
    return source.map((product, itemIndex) => ({
      localId: `saved-dose-${visit?.id || "x"}-${product?.id || itemIndex}`,
      name: product?.name || product?.productName || "",
      quantity: inputValue(product?.quantity),
      unit: product?.unit || "UN",
      notes: product?.notes || "",
    })).filter((product) => product.name || product.quantity);
  }

  function photosFromVisit(visit) {
    return (Array.isArray(visit?.photos) ? visit.photos : []).map((photo, itemIndex) => ({
      localId: `saved-photo-${visit?.id || "x"}-${photo?.id || itemIndex}`,
      visitId: visit?.id, visitType: visit?.visitType || 'REGULAR',
      type: photo?.type || "AFTER",
      fileName: photo?.fileName || `Foto ${photo?.id || itemIndex + 1}`,
      previewUrl: isRegularVisit(visit) ? photo?.url || "" : "",
      url: photo?.url || "",
      status: "uploaded",
      error: "",
      serverId: photo?.id || null,
    })).filter((photo) => photo.url);
  }

  function savedVisitDraft(visit) {
    return {
      values: {
        ph: inputValue(visit?.ph),
        chlorine: inputValue(visit?.chlorine),
        alkalinity: inputValue(visit?.alkalinity),
        salt: inputValue(visit?.salt),
        orp: inputValue(visit?.orpMv ?? visit?.orp),
        temperature: inputValue(visit?.temperature),
        notes: inputValue(visit?.notes),
      },
      checks: {
        cleaned: Boolean(visit?.cleaned),
        vacuumed: Boolean(visit?.vacuumed),
        basketCleaned: Boolean(visit?.basketCleaned),
        brushed: Boolean(visit?.brushed),
        waterlineClean: Boolean(visit?.waterlineClean),
        backwashDone: Boolean(visit?.backwashDone),
      },
      startedAt: visit?.startAt || null,
      pendingProblems: [],
      usedProducts: productsFromVisit(visit),
      photos: photosFromVisit(visit),
    };
  }

  function applySavedVisitData(visit) {
    applyVisitForm(savedVisitDraft(visit));
    visitPhotos = photosFromVisit(visit);
    renderPhotoList();
  }

  function mergeVisitSnapshot(base, incoming = {}, fallbackStatus) {
    const result = incoming && typeof incoming === "object" ? incoming : {};
    return {
      ...(base || {}),
      ...result,
      status: result.status || fallbackStatus || base?.status,
      pool: {
        ...(base?.pool || {}),
        ...(result.pool || {}),
      },
      client: result.client || result.pool?.client || base?.client,
      technician: {
        ...(base?.technician || {}),
        ...(result.technician || {}),
      },
    };
  }

  function saveCurrentDraft() {
    if (!sameFieldSession()) return Promise.resolve();
    const visit = current();
    if (!visit?.id || !currentDraftEntry || currentDraftEntry.key !== visitKey(visit) || (visit.visitType === 'EXTRA' && isVisitDone(visit))) return Promise.resolve();
    const key = visitKey(visit);
    visitPhotosByKey[key] = visitPhotos;
    return visitDraftManager.save(currentDraftEntry,readVisitForm());
  }

  function loadCurrentDraft() {
    const visit = current();
    if (!visit) { currentDraftEntry=null;applyVisitForm(null);visitPhotos=[];visitDraftManager.paint(null);return; }
    currentDraftEntry=visitDraftManager.bind(visit,savedVisitDraft(visit));
    if (visit.visitType === 'EXTRA' && isVisitDone(visit)) {
      applySavedVisitData(visit);
      visitDraftManager.paint(currentDraftEntry);
      return;
    }
    const key = visitKey(visit);
    const draft = visitDraftManager.expand(currentDraftEntry);
    applyVisitForm(draft);
    visitPhotos = visitPhotosByKey[key] || (draft?.photos || []);
    window.CWFieldPhotos.list(visit?.id, true, fieldWriteSession, visit?.visitType || 'REGULAR').then(pending => {
      if (!sameFieldSession() || visitKey(current()) !== key) { pending.forEach(photo => { if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl); }); return; }
      for(const photo of pending) { const position=visitPhotos.findIndex(p=>p.localId===photo.localId);if(position>=0){if(visitPhotos[position].previewUrl?.startsWith('blob:'))URL.revokeObjectURL(visitPhotos[position].previewUrl);visitPhotos[position]=photo;}else visitPhotos.push(photo); }
      renderPhotoList();
    }).catch(error=>{if(sameFieldSession())toast('Falha ao recuperar fotografias: '+error.message)});
    renderPhotoList();
    visitDraftManager.paint(currentDraftEntry);
  }

  function validCoordinate(value, type) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    if (Math.abs(number) < 0.0001) return null;
    if (type === "lat" && (number < -90 || number > 90)) return null;
    if (type === "lng" && (number < -180 || number > 180)) return null;
    return number;
  }

  function visitLocation(visit) {
    const pool = visit?.pool || {};
    const client = visit?.client || pool.client || {};
    const lat = validCoordinate(pool.latitude ?? client.latitude, "lat");
    const lng = validCoordinate(pool.longitude ?? client.longitude, "lng");
    const address = [pool.address, pool.location, client.address, pool.zone]
      .map(value=>String(value ?? '').trim())
      .find(value=>value && !['-','—','n/a','null','undefined'].includes(value.toLowerCase())) || '';
    const label = [pool.name, client.name, address].filter(Boolean).join(", ");
    return { lat, lng, address, label: label || "Cristal Water" };
  }

  function setTileTone(selector, tone) {
    const node = $(selector);
    if (!node) return;
    node.classList.remove("ok", "warn");
    if (tone) node.classList.add(tone);
  }

  function guideHasTransportReference() {
    return Boolean(activeTransportGuide?.id || activeWorkGuide?.guideId || activeWorkGuide?.guide?.id);
  }

  function docsCacheKey(vehicleId) {
    return `${FIELD_DOCS_CACHE_KEY_PREFIX}${String(vehicleId || "default")}`;
  }

  function readDocsCache(vehicleId) {
    return storageRead(docsCacheKey(vehicleId), null);
  }

  function saveDocsCache(vehicleId, payload) {
    if (!payload || !vehicleId) return;
    storageWrite(docsCacheKey(vehicleId), {
      savedAt: new Date().toISOString(),
      vehicleId: String(vehicleId),
      ...payload,
    });
  }

  function parseDateSafe(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function firstDocDate(values = []) {
    for (const value of values) {
      const date = parseDateSafe(value);
      if (date) return date;
    }
    return null;
  }

  function normalizeDocStatus({ present, statusText, dueDate, required }) {
    const text = String(statusText || "").toUpperCase();
    if (!present) return { code: "UNAVAILABLE", label: "Indisponível", required };
    if (text.includes("EXPIR") || text.includes("VENC")) return { code: "EXPIRED", label: "Expirado", required };
    if (text.includes("PEND") || text.includes("DRAFT") || text.includes("PROVIS")) return { code: "PENDING", label: "Pendente", required };
    if (dueDate && dueDate.getTime() < Date.now()) return { code: "EXPIRED", label: "Expirado", required };
    return { code: "VALID", label: "Válido", required };
  }

  function computeDocsCompliance() {
    const vehicle = activeVehicle || activeWorkGuide?.vehicle || activeTransportGuide?.vehicle || {};
    const transportDue = firstDocDate([activeTransportGuide?.validUntil, activeTransportGuide?.expiresAt]);
    const workDue = firstDocDate([activeWorkGuide?.validUntil, activeWorkGuide?.expiresAt]);
    const insuranceDue = firstDocDate([activeInsurance?.dueDate, activeInsurance?.validUntil, vehicle?.insuranceDueDate]);
    const inspectionDue = firstDocDate([
      vehicle?.inspectionDueDate,
      vehicle?.inspection?.dueDate,
      vehicle?.inspection?.validUntil,
    ]);
    const safetyDocs = Array.isArray(vehicle?.safetySheets)
      ? vehicle.safetySheets
      : (Array.isArray(vehicle?.documents) ? vehicle.documents.filter((doc) => String(doc.type || "").toUpperCase().includes("SAFETY")) : []);
    const manuals = Array.isArray(vehicle?.manuals)
      ? vehicle.manuals
      : (Array.isArray(vehicle?.documents) ? vehicle.documents.filter((doc) => String(doc.type || "").toUpperCase().includes("MANUAL")) : []);

    const states = {
      transport: normalizeDocStatus({
        present: Boolean(activeTransportGuide?.id || activeWorkGuide?.guideId || activeWorkGuide?.guide?.id),
        statusText: activeTransportGuide?.status || activeWorkGuide?.guide?.status,
        dueDate: transportDue,
        required: true,
      }),
      workGuide: normalizeDocStatus({
        present: Boolean(activeWorkGuide?.id),
        statusText: activeWorkGuide?.status,
        dueDate: workDue,
        required: true,
      }),
      insurance: normalizeDocStatus({
        present: Boolean(activeInsurance?.id || activeInsurance?.policyNumber || activeInsurance?.title),
        statusText: activeInsurance?.status,
        dueDate: insuranceDue,
        required: true,
      }),
      inspection: normalizeDocStatus({
        present: Boolean(vehicle?.inspection || vehicle?.inspectionDueDate || vehicle?.inspectionStatus),
        statusText: vehicle?.inspectionStatus || vehicle?.inspection?.status,
        dueDate: inspectionDue,
        required: true,
      }),
      safety: normalizeDocStatus({
        present: safetyDocs.length > 0,
        statusText: safetyDocs.find((doc) => doc?.status)?.status,
        dueDate: firstDocDate(safetyDocs.map((doc) => doc?.dueDate || doc?.validUntil)),
        required: false,
      }),
      manuals: normalizeDocStatus({
        present: manuals.length > 0,
        statusText: manuals.find((doc) => doc?.status)?.status,
        dueDate: firstDocDate(manuals.map((doc) => doc?.dueDate || doc?.validUntil)),
        required: false,
      }),
    };

    const blockers = Object.entries(states)
      .filter(([, state]) => state.required && state.code !== "VALID")
      .map(([key, state]) => `${({transport:"Guia AT",workGuide:"Guia de obra",insurance:"Seguro",inspection:"Inspeção"})[key] || key}: ${state.label}`);
    const readyForOperation = blockers.length === 0;

    return {
      states,
      blockers,
      readyForOperation,
      reason: readyForOperation ? "" : `Bloqueio documental - ${blockers.join(" | ")}`,
    };
  }

  function setCrewDocStatus(selector, ok, valueId, metaId, value, meta) {
    const node = $(selector);
    if (!node) return;
    node.classList.toggle("ok", Boolean(ok));
    node.classList.toggle("warn", !ok);
    const valueNode = $(`#${valueId}`);
    const metaNode = $(`#${metaId}`);
    if (valueNode) valueNode.textContent = value || (ok ? "Verde" : "Vermelha");
    if (metaNode) metaNode.textContent = meta || "";
  }

  function setCrewDocState(selector, valueId, metaId, state, okMeta, warnMeta) {
    const isOk = state?.code === "VALID";
    setCrewDocStatus(
      selector,
      isOk,
      valueId,
      metaId,
      state?.label || "Indisponível",
      isOk ? okMeta : (warnMeta || "Documento pendente para operação segura.")
    );
  }

  function syncTechnicianContextFromVisit(visit) {
    const technician = visit?.technician || visits.find((item) => item.technician?.id || item.technician?.name)?.technician || null;
    if (technician) activeTechnician = technician;

    const vehicle = technician?.vehicle || activeWorkGuide?.vehicle || activeTransportGuide?.vehicle || activeVehicle || null;
    if (vehicle) activeVehicle = activeVehicle?.id === vehicle.id ? {...activeVehicle, ...vehicle} : vehicle;

    const technicianInput = $("#technicianId");
    if (technician?.id) {
      if (technicianInput) technicianInput.value = technician.id;
      localStorage.setItem("cwTechnicianId", String(technician.id));
    }

    const vehicleInput = $("#vehicleId");
    if (vehicle?.id) {
      if (vehicleInput) vehicleInput.value = vehicle.id;
      localStorage.setItem("cwVehicleId", String(vehicle.id));
    }

    renderCrewStatus();
  }

  function renderCrewStatus() {
    const vehicleInputValue = ($("#vehicleId")?.value || localStorage.getItem("cwVehicleId") || "").trim();
    const technicianInputValue = ($("#technicianId")?.value || localStorage.getItem("cwTechnicianId") || "").trim();
    const vehicle = activeVehicle || activeWorkGuide?.vehicle || activeTransportGuide?.vehicle || null;
    const technician = activeTechnician || activeWorkGuide?.technician || current()?.technician || null;
    const plate = vehicle?.plate || activeWorkGuide?.vehicle?.plate || activeTransportGuide?.vehicle?.plate || vehicleInputValue || "Matricula por confirmar";
    const vehicleName = [vehicle?.name, vehicle?.status].filter(Boolean).join(" - ");
    const compliance = computeDocsCompliance();
    docsCompliance = compliance;
    const atOk = compliance.states.transport.code === "VALID";
    const workOk = compliance.states.workGuide.code === "VALID";
    const atCode = activeTransportGuide?.codeAT || activeWorkGuide?.guide?.codeAT || activeWorkGuide?.guideId || "";

    const technicianName = $("#fieldTechnicianName");
    const technicianMeta = $("#fieldTechnicianMeta");
    const vehiclePlate = $("#fieldVehiclePlate");
    const vehicleMeta = $("#fieldVehicleMeta");

    if (technicianName) technicianName.textContent = technician?.name || "Tecnico por identificar";
    if (technicianMeta) technicianMeta.textContent = technician?.id ? `ID ${technician.id}` : (technicianInputValue ? `ID ${technicianInputValue}` : "ID tecnico por confirmar");
    if (vehiclePlate) vehiclePlate.textContent = plate;
    if (vehicleMeta) vehicleMeta.textContent = vehicleName || (vehicle?.id ? `Viatura ID ${vehicle.id}` : "Viatura associada a este dia/ronda.");

    setCrewDocStatus(
      "#fieldTransportGuideStatus",
      atOk,
      "fieldTransportGuideValue",
      "fieldTransportGuideMeta",
      atOk ? "Verde" : "Vermelha",
      atOk ? `AT ${atCode || "associada"} disponivel para apresentar.` : "Guia de transporte AT em falta ou por associar."
    );

    setCrewDocStatus(
      "#fieldWorkGuideStatus",
      workOk,
      "fieldWorkGuideValue",
      "fieldWorkGuideMeta",
      workOk ? "Verde" : "Vermelha",
      workOk ? `Guia de obra #${activeWorkGuide.id} ${activeWorkGuide.guideId ? "ligada a AT." : "provisoria, falta AT."}` : "Sem guia de obra aberta para esta viatura."
    );

    setCrewDocState(
      "#fieldInsuranceStatus",
      "fieldInsuranceValue",
      "fieldInsuranceMeta",
      compliance.states.insurance,
      "Seguro válido para operação.",
      "Seguro ausente, pendente ou expirado."
    );

    setCrewDocState(
      "#fieldInspectionStatus",
      "fieldInspectionValue",
      "fieldInspectionMeta",
      compliance.states.inspection,
      "Inspeção válida para circulação.",
      "Inspeção ausente, pendente ou expirada."
    );

    const safetyAggregate = compliance.states.safety.code === "VALID" && compliance.states.manuals.code === "VALID"
      ? { code: "VALID", label: "Válido" }
      : (compliance.states.safety.code !== "VALID" ? compliance.states.safety : compliance.states.manuals);
    setCrewDocState(
      "#fieldSafetyStatus",
      "fieldSafetyValue",
      "fieldSafetyMeta",
      safetyAggregate,
      "Fichas de segurança e manuais disponíveis.",
      "Fichas de segurança/manuais pendentes ou indisponíveis."
    );

    const center = $("#documentCenterBox");
    if (center) {
      center.innerHTML = `
        <div class="doc-head"><span class="chip">Centro documental</span><strong class="${compliance.readyForOperation ? "status-ok" : "status-warn"}">${compliance.readyForOperation ? "Operacional" : "Bloqueado"}</strong></div>
        <div class="doc-number">Fonte: ${docsSource === "cache" ? "offline sincronizado" : "online"}</div>
        <div class="doc-meta">
          <span>Guia AT: ${esc(compliance.states.transport.label)}</span>
          <span>Guia obra: ${esc(compliance.states.workGuide.label)}</span>
          <span>Seguro: ${esc(compliance.states.insurance.label)}</span>
          <span>Inspeção: ${esc(compliance.states.inspection.label)}</span>
          <span>Fichas: ${esc(compliance.states.safety.label)}</span>
          <span>Manuais: ${esc(compliance.states.manuals.label)}</span>
        </div>
        ${compliance.reason ? `<div class="muted" data-doc-lock-reason="1">${esc(compliance.reason)}</div>` : '<div class="muted">Documentação obrigatória validada para iniciar e concluir.</div>'}
      `;
    }
  }

  function currentTechnicianId() {
    const principal = window.CristalAuth?.parseUser?.() || {};
    if (['TECHNICIAN','TEAM_LEADER'].includes(principal.role)) return String(principal.technicianId || principal.id || '');
    const fromQuery = new URLSearchParams(location.search).get("technicianId") || "";
    const fromInput = $("#technicianId")?.value || "";
    const fromStorage = localStorage.getItem("cwTechnicianId") || "";
    const fromActive = activeTechnician?.id ? String(activeTechnician.id) : "";
    return String(fromQuery || fromInput || fromStorage || fromActive || "").trim();
  }

  function currentPoolId() {
    const visit = current();
    const poolId = visit?.pool?.id || visit?.poolId || "";
    return String(poolId || "").trim();
  }

  function parseProposalPhotoLines(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  function renderTechnicalProposalList() {
    const list = $("#technicalProposalList");
    if (!list) return;
    if (!technicalProposals.length) {
      list.textContent = "Sem propostas desta piscina nesta sessão.";
      return;
    }
    list.innerHTML = technicalProposals.slice(0, 4).map((item) => {
      const when = formatDate(item.submittedAt || item.createdAt);
      const risk = esc(item.riskLevel || "MEDIUM");
      const reason = esc(item.reason || "Sem motivo");
      const changesCount = Array.isArray(item.changes) ? item.changes.length : 0;
      const photosCount = Array.isArray(item.photos) ? item.photos.length : 0;
      return `<div class="interrupt-item" data-tech-proposal-id="${esc(item.id)}"><strong>${risk}</strong><div>${reason}</div><div class="muted">${when} | ${changesCount} alteração(ões) | ${photosCount} foto(s)</div></div>`;
    }).join("");
  }

  async function loadTechnicalProposals(poolId) {
    void technicalProposalEditor.open(Number(poolId));
    if (!poolId) {
      technicalProposals = [];
      renderTechnicalProposalList();
      return;
    }
    const credential = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
    const relevant = () => currentPoolId() === String(poolId) && credential === (localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '');
    technicalProposals = [];
    const list = $("#technicalProposalList");
    if (list) list.textContent = "A consultar propostas...";
    try {
      const data = await api(`/api/core/pools/${encodeURIComponent(poolId)}/technical-change-proposals?onlyPending=true`);
      if (!relevant()) return;
      technicalProposals = Array.isArray(data.proposals) ? data.proposals : [];
      renderTechnicalProposalList();
    } catch (_) {
      if (!relevant()) return;
      if (list) list.textContent = "Não foi possível consultar as propostas. Atualize antes de repetir um envio.";
    }
  }

  const technicalProposalEditor = window.CWTechnicalProposalEditor.create({ saved: async id => { if (Number(currentPoolId()) === id) await loadTechnicalProposals(currentPoolId()); } });
  async function submitTechnicalProposal() { return technicalProposalEditor.submit(); }

  function todayQueryParams() {
    return dayQueryParams(new Date(), currentTechnicianId());
  }

  function updateFieldDashboardLegacy(visit) {
    const done = visits.filter(isVisitDone).length;
    const total = visits.length;
    const pending = Math.max(total - done, 0);
    const hasTransport = guideHasTransportReference();
    const hasWorkGuide = Boolean(activeWorkGuide?.id);
    const docsReady = hasTransport && hasWorkGuide;
    const readyDocs = [hasTransport, hasWorkGuide].filter(Boolean).length;
    const photoCount = visitPhotos.length;
    const location = visit ? visitLocation(visit) : null;

    const focusNow = $("#fieldFocusNow");
    const focusMeta = $("#fieldFocusMeta");
    const progressValue = $("#fieldProgressValue");
    const progressMeta = $("#fieldProgressMeta");
    const docsValue = $("#fieldDocsValue");
    const docsMeta = $("#fieldDocsMeta");
    const photosValue = $("#fieldPhotosValue");
    const photosMeta = $("#fieldPhotosMeta");

    if (focusNow) focusNow.textContent = visit ? (visit.pool?.name || "Piscina") : "Dia concluido";
    if (focusMeta) {
      focusMeta.textContent = visit
        ? `${visit.client?.name || "Cliente"} - ${location?.address || visit.pool?.zone || "local por confirmar"}`
        : "Sem visitas pendentes nesta ronda.";
    }

    if (progressValue) progressValue.textContent = `${done} / ${total}`;
    if (progressMeta) progressMeta.textContent = pending ? `${pending} visita(s) por concluir` : "Ronda pronta para fechar";

    if (docsValue) docsValue.textContent = docsReady ? "Associados" : "Atenção";
    if (docsMeta) docsMeta.textContent = docsReady ? "guia de obra ligada a AT" : "confirmar guia AT/obra e seguro";

    if (photosValue) photosValue.textContent = `${photoCount} foto${photoCount === 1 ? "" : "s"}`;
    if (photosMeta) photosMeta.textContent = photoCount ? "registos prontos para sincronizar" : "sem fotos nesta visita";

    setTileTone("#fieldProgressTile", pending ? "" : "ok");
    setTileTone("#fieldDocsTile", docsReady ? "ok" : "warn");
    setTileTone("#fieldPhotosTile", photoCount ? "ok" : "");
  }

  function actorName() {
    const parsed = window.CristalAuth?.parseUser?.() || {};
    return activeTechnician?.name || parsed?.name || "Tecnico em campo";
  }

  function opExceptionState() {
    const value = storageRead(OP_EXCEPTION_STATE_KEY, {});
    return value && typeof value === "object" ? value : {};
  }

  function saveOpExceptionState(nextState) {
    storageWrite(OP_EXCEPTION_STATE_KEY, nextState || {});
  }

  function opExceptionHistory() {
    const value = storageRead(OP_EXCEPTION_HISTORY_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function saveOpExceptionHistory(entries) {
    storageWrite(OP_EXCEPTION_HISTORY_KEY, (entries || []).slice(-200));
  }

  function appendOpExceptionHistory(entry) {
    const next = opExceptionHistory();
    next.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      ...entry,
    });
    saveOpExceptionHistory(next);
  }

  function pushOpExceptionCommand(eventType, exception, state) {
    const queue = storageRead(OP_EXCEPTION_COMMAND_BRIDGE_KEY, []);
    const safeQueue = Array.isArray(queue) ? queue : [];
    safeQueue.push({
      eventType,
      createdAt: new Date().toISOString(),
      exceptionId: exception.id,
      category: exception.category,
      priority: exception.priority,
      poolName: exception.poolName || current()?.pool?.name || "",
      clientName: exception.clientName || current()?.client?.name || "",
      state,
    });
    storageWrite(OP_EXCEPTION_COMMAND_BRIDGE_KEY, safeQueue.slice(-150));
  }

  function exceptionDurationLabel(isoStart) {
    if (!isoStart) return "Sem tempo em curso";
    return elapsedSinceLabel(isoStart);
  }

  function isVisitDelayed(visit) {
    if (!visit || isVisitDone(visit)) return false;
    const planned = new Date(visit.plannedDate || visit.date || 0);
    if (Number.isNaN(planned.getTime())) return false;
    return Date.now() - planned.getTime() > 20 * 60 * 1000;
  }

  function collectOperationalExceptions() {
    const items = [];
    const visit = current();
    const nowIso = new Date().toISOString();
    const pump = resolvePumpManualSignal(visit);

    if (pump.active) {
      items.push({
        id: `pump-manual:${String(visit?.id || "none")}`,
        category: "PUMP_MANUAL",
        title: "P0 - Bomba em manual",
        detail: `Quem ativou: ${pump.who} | Piscina: ${pump.poolName} | Duração: ${pump.duration} | Estado: ${pump.status}`,
        priority: "P0",
        createdBy: pump.who || "Sistema",
        createdAt: pump.since || nowIso,
        targetAction: "problem",
      });
    }

    activeWaterReminders().forEach((reminder) => {
      items.push({
        id: `water-open:${String(reminder.localId || reminder.serverId || reminder.id || "none")}`,
        category: "WATER_OPEN",
        title: "P0 - Agua aberta",
        detail: `${reminder.poolName || "Piscina"} | ${reminder.clientName || "Cliente"} | ${waterReminderLabel(reminder)}`,
        priority: reminder.status === "OVERDUE" ? "P0" : "P1",
        createdBy: reminder.technicianName || "Tecnico",
        createdAt: reminder.createdAt || nowIso,
        targetAction: "water",
      });
    });

    const urgentProblems = pendingProblems.filter((problem) => String(problem.severity || "").toUpperCase() === "URGENTE");
    if (urgentProblems.length) {
      const first = urgentProblems[0];
      items.push({
        id: `critical-problem:${String(first.visitId || visit?.id || "none")}`,
        category: "CRITICAL_PROBLEM",
        title: "P0 - Problema critico",
        detail: `${urgentProblems.length} problema(s) critico(s) pendente(s).`,
        priority: "P0",
        createdBy: actorName(),
        createdAt: first.createdAt || nowIso,
        targetAction: "problem",
      });
    }

    if (isVisitDelayed(visit)) {
      items.push({
        id: `visit-delayed:${String(visit?.id || "none")}`,
        category: "VISIT_DELAYED",
        title: "P1 - Visita atrasada",
        detail: `${visit?.pool?.name || "Piscina"} com atraso face ao planeado.`,
        priority: "P1",
        createdBy: "Sistema",
        createdAt: visit?.plannedDate || visit?.date || nowIso,
        targetAction: "hoje",
      });
    }

    if (documentsLoaded && !opsSnapshot.docsReady) {
      items.push({
        id: `docs-missing:${String(visit?.id || "none")}`,
        category: "DOC_MISSING",
        title: "P1 - Documento obrigatorio em falta",
        detail: opsSnapshot.docsBlockReason || "Documentacao da viatura incompleta para operacao segura.",
        priority: "P1",
        createdBy: "Sistema",
        createdAt: nowIso,
        targetAction: "docs",
      });
    }

    return items;
  }

  function ensureOperationalExceptionState(exceptions) {
    const state = opExceptionState();
    let changed = false;
    const nowIso = new Date().toISOString();

    exceptions.forEach((exception) => {
      if (!state[exception.id]) {
        state[exception.id] = {
          status: "OPEN",
          createdBy: exception.createdBy || "Sistema",
          createdAt: exception.createdAt || nowIso,
          receivedBy: actorName(),
          receivedAt: nowIso,
          openLogged: false,
        };
        changed = true;
      }

      if (!state[exception.id].openLogged) {
        appendOpExceptionHistory({
          action: "OPEN",
          by: state[exception.id].createdBy || "Sistema",
          exceptionId: exception.id,
          title: exception.title,
          detail: exception.detail,
        });
        pushOpExceptionCommand("OPEN", exception, state[exception.id]);
        state[exception.id].openLogged = true;
        changed = true;
      }
    });

    if (changed) saveOpExceptionState(state);
    return state;
  }

  function updateOperationalException(exceptionId, updater) {
    const state = opExceptionState();
    const currentState = state[exceptionId];
    if (!currentState) return;
    const nextState = { ...currentState };
    updater(nextState);
    state[exceptionId] = nextState;
    saveOpExceptionState(state);
    renderInterruptBoard();
  }

  function assumeOperationalException(exception) {
    updateOperationalException(exception.id, (nextState) => {
      nextState.status = "ASSUMED";
      nextState.assumedBy = actorName();
      nextState.assumedAt = new Date().toISOString();
      appendOpExceptionHistory({
        action: "ASSUMED",
        by: nextState.assumedBy,
        exceptionId: exception.id,
        title: exception.title,
      });
      pushOpExceptionCommand("ASSUMED", exception, nextState);
    });
    toast("Excecao assumida.");
  }

  function confirmOperationalException(exception) {
    updateOperationalException(exception.id, (nextState) => {
      nextState.status = "CONFIRMED";
      nextState.confirmedBy = actorName();
      nextState.confirmedAt = new Date().toISOString();
      appendOpExceptionHistory({
        action: "CONFIRMED",
        by: nextState.confirmedBy,
        exceptionId: exception.id,
        title: exception.title,
      });
      pushOpExceptionCommand("CONFIRMED", exception, nextState);
    });
    toast("Excecao confirmada.");
  }

  function resolveOperationalException(exception) {
    updateOperationalException(exception.id, (nextState) => {
      nextState.status = "RESOLVED";
      nextState.resolvedBy = actorName();
      nextState.resolvedAt = new Date().toISOString();
      appendOpExceptionHistory({
        action: "RESOLVED",
        by: nextState.resolvedBy,
        exceptionId: exception.id,
        title: exception.title,
      });
      pushOpExceptionCommand("RESOLVED", exception, nextState);
    });
    toast("Excecao resolvida.");
  }

  function renderExceptionHistory(history) {
    if (!history.length) {
      return '<div class="interrupt-item" data-history-empty="1">Sem historico local de excecoes.</div>';
    }
    return history.slice(-6).reverse().map((entry) => `
      <div class="interrupt-item" data-history-entry="${esc(entry.id || "")}" style="border-style:dashed">
        <strong>${esc(entry.action || "EVENT")}</strong>
        <div>${esc(entry.title || "Excecao operacional")}</div>
        <div class="muted">${esc(formatDate(entry.createdAt))} | ${esc(entry.by || "Sistema")}</div>
      </div>
    `).join("");
  }

  function updateFieldDashboard(visit) {
    const done = visits.filter(isVisitDone).length;
    const total = visits.length;
    const pending = Math.max(total - done, 0);
    const compliance = computeDocsCompliance();
    const docsReady = Boolean(compliance.readyForOperation);
    opsSnapshot = { docsReady, done, total, pending, docsBlockReason: compliance.reason || "" };
    const readyDocs = Object.values(compliance.states).filter((state) => state.code === "VALID").length;
    const photoCount = visitPhotos.length;
    const location = visit ? visitLocation(visit) : null;

    const focusNow = $("#fieldFocusNow");
    const focusMeta = $("#fieldFocusMeta");
    const progressValue = $("#fieldProgressValue");
    const progressMeta = $("#fieldProgressMeta");
    const docsValue = $("#fieldDocsValue");
    const docsMeta = $("#fieldDocsMeta");
    const photosValue = $("#fieldPhotosValue");
    const photosMeta = $("#fieldPhotosMeta");
    const heroLabel = $("#fieldHeroLabel");
    const heroActions = $("#fieldHeroActions");
    const heroTile = $("#fieldHeroTile");
    const userName = String(window.CristalAuth?.parseUser?.().name || activeTechnician?.name || "").trim();
    const firstName = userName ? userName.split(/\s+/)[0] : "Técnico";
    const exceptions = collectOperationalExceptions().filter((item) => item && item.id);
    const stateById = ensureOperationalExceptionState(exceptions);
    const openExceptions = exceptions.filter((item) => (stateById[item.id]?.status || "OPEN") !== "RESOLVED");
    const openAlerts = openExceptions.length;
    const hasWaterOpen = openExceptions.some((item) => item.category === "WATER_OPEN");
    const hasManualPump = openExceptions.some((item) => item.category === "PUMP_MANUAL");
    const hasActiveVisit = Boolean(visit);
    const hasIntervention = hasActiveIntervention(visit);
    const hasP0 = openExceptions.some((item) => String(item.priority || "").toUpperCase() === "P0") || hasManualPump;

    function setHeroButton(index, text, action, variant = "secondary") {
      const button = heroActions?.querySelector(`button:nth-child(${index + 1})`);
      if (!button) return;
      if (!text || !action) {
        button.hidden = true;
        return;
      }
      button.hidden = false;
      button.textContent = text;
      button.dataset.heroAction = action;
      button.classList.remove("primary", "secondary");
      button.classList.add(variant);
    }

    document.body.dataset.fieldMode = hasActiveVisit ? "active" : "free";
    document.body.dataset.fieldPriority = hasP0 ? "p0" : "normal";
    if (heroTile) heroTile.classList.toggle("p0", hasP0);

    if (heroLabel) {
      heroLabel.textContent = hasP0 ? "Prioridade P0" : `Bom dia, ${firstName}`;
    }

    if (focusNow) {
      if (hasP0) {
        focusNow.textContent = hasWaterOpen ? "Água aberta" : "Bomba em manual";
      } else if (visit) {
        focusNow.textContent = visit.pool?.name || (hasManualPump ? "Bomba em manual" : "Piscina");
      } else {
        focusNow.textContent = openAlerts ? (hasWaterOpen ? "Água aberta ativa" : (hasManualPump ? "Bomba em manual" : "Há alertas ativos")) : "Hoje está livre";
      }
    }
    if (focusMeta) {
      if (hasP0) {
        focusMeta.textContent = "Alerta crítico ativo. Trate primeiro e só depois continue a ronda.";
      } else if (visit) {
        focusMeta.textContent = `${visit.client?.name || "Cliente"} - ${location?.address || visit.pool?.zone || "local por confirmar"}`;
      } else {
        const statParts = [
          `${total} piscina${total === 1 ? "" : "s"}`,
          `${openAlerts} alerta${openAlerts === 1 ? "" : "s"}`,
          `${hasWaterOpen ? 1 : 0} água aberta`,
          `${hasManualPump ? 1 : 0} bomba manual`,
        ];
        focusMeta.textContent = `Não tens visitas atribuídas neste momento. ${statParts.join(" · ")}.`;
      }
    }

    if (progressValue) progressValue.textContent = visit ? `${done} / ${total}` : `${total} / ${total}`;
    if (progressMeta) progressMeta.textContent = visit ? (pending ? `${pending} visita(s) por concluir` : "Ronda pronta para fechar") : "Agenda livre neste momento";

    if (docsValue) docsValue.textContent = !documentsLoaded ? "A validar" : docsReady ? "Válidos" : "Rever";
    if (docsMeta) docsMeta.textContent = !documentsLoaded ? "A confirmar a viatura" : docsReady ? "Obrigatórios confirmados" : "Abra Viatura para ver o que falta";

    const pendingPhotos = visitPhotos.filter(photo => photo.status !== "uploaded").length;
    const pendingRevision = ++fieldPendingRevision;
    if (photosValue) photosValue.textContent = '…';
    if (photosMeta) photosMeta.textContent = 'A verificar envios guardados';
    Promise.resolve(visit ? window.CWFieldOffline.pending(visit.id, visit.visitType || 'REGULAR') : false).then(pendingVisit => {
      if (!sameFieldSession() || pendingRevision !== fieldPendingRevision) return;
      if (photosValue) photosValue.textContent = String(pendingPhotos + (pendingVisit ? 1 : 0));
      if (photosMeta) photosMeta.textContent = pendingVisit ? 'visita por confirmar' : pendingPhotos ? 'fotos por enviar' : 'envios pendentes nesta visita';
      setTileTone('#fieldPhotosTile', pendingPhotos || pendingVisit ? 'warn' : 'ok');
    }).catch(() => { if (sameFieldSession() && pendingRevision === fieldPendingRevision) { if (photosValue) photosValue.textContent = '?'; if (photosMeta) photosMeta.textContent = 'Envios por verificar; preserve os dados'; setTileTone('#fieldPhotosTile','warn'); } });

    if (heroActions) {
      heroActions.hidden = false;
      if (hasP0) {
        setHeroButton(0, "Tratar alerta", "p0", "primary");
        setHeroButton(1, "Continuar", "continue", "secondary");
        setHeroButton(2, "Comunicar", "contact", "secondary");
      } else if (!hasActiveVisit) {
        setHeroButton(0, "Atualizar", "refresh", "primary");
        setHeroButton(1, "Ver agenda", "agenda", "secondary");
        setHeroButton(2, "Comunicar", "contact", "secondary");
      } else if (!isRegularVisit(visit) && isVisitDone(visit)) {
        setHeroButton(0, "Consultar visita extra", "continue", "primary");
        setHeroButton(1, "Navegar", "map", "secondary");
        setHeroButton(2, "Comunicar", "contact", "secondary");
      } else if (hasIntervention) {
        setHeroButton(0, "Continuar", "continue", "primary");
        setHeroButton(1, "Navegar", "map", "secondary");
        setHeroButton(2, "Comunicar", "contact", "secondary");
      } else {
        setHeroButton(0, "Abrir visita", "openVisit", "primary");
        setHeroButton(1, "Navegar", "map", "secondary");
        setHeroButton(2, "Comunicar", "contact", "secondary");
      }
    }

    const freeMode = !visit;
    setTileTone("#fieldProgressTile", freeMode ? "" : (pending ? "" : "ok"));
    setTileTone("#fieldDocsTile", freeMode ? "" : (docsReady ? "ok" : "warn"));
    setTileTone("#fieldPhotosTile", "warn");
    const progressTile = $("#fieldProgressTile");
    const docsTile = $("#fieldDocsTile");
    const photosTile = $("#fieldPhotosTile");
    if (progressTile) progressTile.hidden = freeMode;
    if (docsTile) docsTile.hidden = freeMode;
    if (photosTile) photosTile.hidden = freeMode;
    const routeCard = $("#routeCard");
    const dayVisitsCard = $("#dayVisitsCard");
    if (routeCard) routeCard.hidden = freeMode;
    if (dayVisitsCard) dayVisitsCard.hidden = freeMode;
    renderCrewStatus();
    renderInterruptBoard();
  }

  function renderInterruptBoard() {
    const card = $("#interruptCard");
    const summary = $("#interruptSummary");
    const list = $("#interruptList");
    if (!card || !summary || !list) return;

    const exceptions = collectOperationalExceptions().filter((item) => item && item.id);
    const stateById = ensureOperationalExceptionState(exceptions);
    const openExceptions = exceptions.filter((item) => {
      const status = stateById[item.id]?.status || "OPEN";
      return status !== "RESOLVED";
    });
    const history = opExceptionHistory();

    const historyList = $("#fieldAlertHistoryList");
    if (historyList) historyList.innerHTML = renderExceptionHistory(history);
    const priorityNotice = $("#fieldPriorityNotice");
    if (priorityNotice) { priorityNotice.hidden = !openExceptions.length; priorityNotice.textContent = `${openExceptions.length} alerta(s) por resolver · Ver`; }

    if (!openExceptions.length) {
      card.hidden = true;
      summary.textContent = "Sem alertas críticos neste momento.";
      list.innerHTML = "";
      return;
    }

    card.hidden = false;
    summary.textContent = openExceptions.length
      ? "Fluxo interrompido por excecoes operacionais. Assumir, confirmar e resolver antes de continuar."
      : "Sem excecoes abertas. Historico local disponivel para auditoria.";

    const exceptionsHtml = openExceptions.map((item) => {
      const state = stateById[item.id] || {};
      const status = state.status || "OPEN";
      const canAssume = status === "OPEN";
      const canConfirm = ["ASSUMED", "OPEN"].includes(status);
      const canResolve = status !== "RESOLVED";
      const createdAt = state.createdAt || item.createdAt || new Date().toISOString();
      return `
      <div class="interrupt-item" data-exception-id="${esc(item.id)}" data-exception-category="${esc(item.category)}">
        <strong>${esc(item.title)}</strong>
        <div>${esc(item.detail)}</div>
        <div class="muted">Prioridade: ${esc(item.priority)} | Estado: ${esc(status)}</div>
        <div class="muted">Responsabilidade: criou ${esc(state.createdBy || item.createdBy || "Sistema")} | recebeu ${esc(state.receivedBy || "Tecnico")}</div>
        <div class="muted">Assumiu: ${esc(state.assumedBy || "pendente")} | Confirmou: ${esc(state.confirmedBy || "pendente")} | Resolveu: ${esc(state.resolvedBy || "pendente")}</div>
        <div class="muted">Tempo em curso: ${esc(exceptionDurationLabel(createdAt))}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          ${item.targetAction ? `<button type="button" data-interrupt-action="target" data-interrupt-target="${esc(item.targetAction)}" data-exception-id="${esc(item.id)}">Abrir</button>` : ""}
          ${canAssume ? `<button type="button" data-interrupt-action="assume" data-exception-id="${esc(item.id)}">Assumir</button>` : ""}
          ${canConfirm ? `<button type="button" data-interrupt-action="confirm" data-exception-id="${esc(item.id)}">Confirmar</button>` : ""}
          ${canResolve ? `<button type="button" data-interrupt-action="resolve" data-exception-id="${esc(item.id)}">Resolver</button>` : ""}
        </div>
      </div>
    `;
    }).join("");

    list.innerHTML = exceptionsHtml;
  }

  function mapsSearchUrl(visit) {
    const location = visitLocation(visit);
    if (location.lat && location.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.lat},${location.lng}`)}`;
    }
    return location.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}` : null;
  }

  function navigationUrl(visit) {
    const location = visitLocation(visit);
    if (location.lat && location.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${location.lat},${location.lng}`)}&travelmode=driving`;
    }
    return mapsSearchUrl(visit);
  }

  function renderRouteCard(visit) {
    const title = $("#routeTitle");
    const summary = $("#routeSummary");
    const mapBox = $("#mapBox");
    const meta = $("#routeMeta");
    const navLink = $("#navLink");
    const mapsLink = $("#mapsLink");
    if (!title || !summary || !mapBox || !meta || !navLink || !mapsLink) return;

    if (!visit) {
      title.textContent = "Hoje livre";
      summary.textContent = "Não tens visitas atribuídas neste momento.";
      mapBox.innerHTML = '<div class="map-fallback">Atualiza a agenda ou comunica com o administrador.</div>';
      meta.innerHTML = `<span>Sem próxima piscina para navegar.</span>`;
      [navLink,mapsLink].forEach(link=>{link.removeAttribute("href");link.setAttribute("aria-disabled","true");});
      return;
    }

    const location = visitLocation(visit);
    const poolName = visit.pool?.name || "Piscina";
    const clientName = visit.client?.name || "Cliente";
    title.textContent = poolName;
    summary.textContent = `${clientName} - ${visit.status || "Pendente"}`;
    for(const [link,url] of [[navLink,navigationUrl(visit)],[mapsLink,mapsSearchUrl(visit)]]){
      if(url){link.href=url;link.removeAttribute('aria-disabled');}
      else{link.removeAttribute('href');link.setAttribute('aria-disabled','true');}
    }

    if (location.lat && location.lng) {
      const delta = 0.008;
      const bbox = [
        location.lng - delta,
        location.lat - delta,
        location.lng + delta,
        location.lat + delta,
      ].join("%2C");
      mapBox.innerHTML = `
        <iframe
          id="fieldMapFrame"
          title="Mapa da proxima piscina"
          loading="lazy"
          src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${encodeURIComponent(`${location.lat},${location.lng}`)}">
        </iframe>
        <div class="map-overlay"><span>Destino</span><strong>${esc(poolName)}</strong></div>
      `;
      meta.innerHTML = `
        <span>Coordenadas: ${esc(location.lat.toFixed(6))}, ${esc(location.lng.toFixed(6))}</span>
        <span>${esc(location.address || "Morada nao indicada")}</span>
      `;
      return;
    }

    mapBox.innerHTML = `
      <div class="map-fallback">
        <div>
          <strong>Sem coordenadas GPS nesta piscina.</strong><br>
          ${location.address ? "A navegação abre pela morada/zona registada." : "Sem morada confirmada. Peça a localização ao escritório antes de navegar."}
        </div>
      </div>
    `;
    meta.innerHTML = `<span>${esc(location.address || "Morada ou zona por confirmar")}</span>`;
  }

  function readingNumber(value) {
    const raw = String(value ?? "").replace(",", ".").trim();
    if (!raw) return null;
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
  }

  function updateReferenceStatus(input) {
    if (!input) return;
    const min = readingNumber(input.dataset.min);
    const max = readingNumber(input.dataset.max);
    const value = readingNumber(input.value);
    const status = $(`#${input.id}Status`);
    if (!status || min === null || max === null) return;

    status.className = "range-status";
    if (value === null) {
      status.textContent = "Por medir";
      return;
    }

    if (value < min) {
      status.textContent = "Baixo";
      status.classList.add("low");
      return;
    }

    if (value > max) {
      status.textContent = "Alto";
      status.classList.add("high");
      return;
    }

    status.textContent = "OK";
    status.classList.add("ok");
  }

  function updateAllReferenceStatuses() {
    ["ph", "chlorine", "alkalinity", "orp"].forEach((id) => updateReferenceStatus($(`#${id}`)));
  }

  function itemQuantity(item, mode) {
    if (mode === "work") return item.quantity ?? item.initialQty ?? 0;
    return item.quantity ?? 0;
  }

  function isChemical(item) {
    const raw = `${item?.type || ""} ${item?.name || item?.productName || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return /chemical|quim|cloro|ph|sal|bromo|alcal|floc|algic|estabil|redutor|aumentador/.test(raw);
  }

  function totalByUnit(items, field, filter = () => true) {
    const totals = new Map();
    (Array.isArray(items) ? items : []).filter(filter).forEach((item) => {
      const unit = String(item.unit || "UN").toUpperCase();
      const value = Number(item[field] ?? 0);
      totals.set(unit, (totals.get(unit) || 0) + (Number.isFinite(value) ? value : 0));
    });
    return [...totals.entries()].map(([unit, value]) => `${value} ${unit}`).join(" / ") || "Sem leitura";
  }

  function docButton(href, label) {
    const protectedDownload = String(href || "").startsWith("/api/guides/") ? " data-auth-download" : "";
    return `<a class="doc-btn"${protectedDownload} href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  }

  function renderItems(items, mode) {
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) return '<div class="muted">Sem material registado.</div>';
    return `<div class="doc-items">${rows.map((item) => `
      <div class="doc-item">
        <span>${esc(item.name || item.productName || "Material")}</span>
        <strong>${mode === "work" ? "Final " : ""}${esc(itemQuantity(item, mode))} ${esc(item.unit || "UN")}</strong>
      </div>
    `).join("")}</div>`;
  }

  function renderUsage(items) {
    const rows = (Array.isArray(items) ? items : []).filter((item) => Number(item.usedQty || 0) > 0);
    if (!rows.length) return '<div class="muted">Ainda sem saidas de material registadas nesta guia.</div>';
    return `<div class="doc-items">${rows.map((item) => `
      <div class="doc-item">
        <span>${esc(item.name || "Material")}</span>
        <strong>Usado ${esc(item.usedQty || 0)} ${esc(item.unit || "UN")}</strong>
      </div>
    `).join("")}</div>`;
  }

  function movementNotesLabel(move) {
    const notes = move?.userNotes || move?.notes || "";
    if (!notes) return "";
    try {
      const parsed = JSON.parse(notes);
      return parsed?.userNotes || "";
    } catch (_) {
      return notes;
    }
  }

  function renderMovements(movements) {
    const rows = Array.isArray(movements) ? movements : [];
    if (!rows.length) return '<div class="muted">Ainda sem movimentos por local.</div>';
    return `<div class="doc-items">${rows.slice(-8).reverse().map((move) => `
      <div class="doc-item">
        <span>${esc(move.itemName || "Material")}<small>${esc(move.locationLabel || move.location || "Local nao indicado")}</small></span>
        <strong>${esc(move.quantity || 0)} ${esc(move.unit || "UN")}</strong>
      </div>
      ${movementNotesLabel(move) ? `<div class="muted">${esc(movementNotesLabel(move))}</div>` : ""}
    `).join("")}</div>`;
  }

  function renderStockSummary(items) {
    return `
      <div class="doc-summary">
        <strong>Leitura final de quimicos</strong>
        <span>${esc(totalByUnit(items, "quantity", isChemical))}</span>
        <small>Usado hoje: ${esc(totalByUnit(items, "usedQty", isChemical))}</small>
      </div>
    `;
  }

  function productOptions(selectedName = "") {
    const rows = Array.isArray(activeWorkStock) ? activeWorkStock : [];
    const selected = String(selectedName || "");
    const existing = rows.map((item) => String(item.name || item.productName || "")).filter(Boolean);
    const options = rows.map((item) => {
      const name = item.name || item.productName || "";
      const qty = Number(item.quantity ?? 0);
      const unit = item.unit || "UN";
      const label = `${name} - disponivel ${qty} ${unit}`;
      return `<option value="${esc(name)}" ${name === selected ? "selected" : ""}>${esc(label)}</option>`;
    }).join("");
    if (selected && !existing.includes(selected)) {
      return `<option value="${esc(selected)}" selected>${esc(selected)}</option>${options}`;
    }
    return `<option value="">Escolher produto</option>${options}`;
  }

  function ensureDoseRow() {
    const row = {
      localId: `dose-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: "",
      quantity: "",
      unit: "",
      notes: "",
    };
    usedProducts.push(row);
    renderDoseRows();
    saveCurrentDraft();
  }

  function productStockByName(name) {
    const wanted = String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    return (activeWorkStock || []).find((item) => {
      const raw = String(item.name || item.productName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      return raw === wanted;
    }) || null;
  }

  function updateDoseRow(localId, field, value) {
    const row = usedProducts.find((item) => item.localId === localId);
    if (!row) return;
    row[field] = value;
    if (field === "name") {
      const stock = productStockByName(value);
      if (stock && !row.unit) row.unit = stock.unit || "UN";
    }
    renderDoseRows();
    saveCurrentDraft();
  }

  function removeDoseRow(localId) {
    usedProducts = usedProducts.filter((item) => item.localId !== localId);
    renderDoseRows();
    saveCurrentDraft();
  }

  function renderDoseRows() {
    const box = $("#doseRows");
    if (!box) return;
    if (!usedProducts.length) {
      box.innerHTML = '<div class="dose-empty">Sem produtos adicionados nesta visita.</div>';
      return;
    }
    box.innerHTML = usedProducts.map((row) => `
      <div class="dose-row" data-dose-id="${esc(row.localId)}">
        <select data-dose-field="name" aria-label="Produto usado">
          ${productOptions(row.name)}
        </select>
        <input data-dose-field="quantity" inputmode="decimal" placeholder="Dosagem" value="${esc(row.quantity || "")}">
        <input data-dose-field="unit" placeholder="Un." value="${esc(row.unit || productStockByName(row.name)?.unit || "")}">
        <button class="dose-remove" type="button" data-dose-remove="${esc(row.localId)}">Remover</button>
      </div>
    `).join("");
  }

  function normalizedUsedProducts() {
    return usedProducts.map((product) => {
      const stock = productStockByName(product.name);
      return {
        name: String(product.name || "").trim(),
        quantity: readingNumber(product.quantity),
        unit: String(product.unit || stock?.unit || "UN").trim() || "UN",
        notes: String(product.notes || "").trim(),
        available: Number(stock?.quantity ?? NaN),
      };
    }).filter((product) => product.name && product.quantity !== null && product.quantity > 0);
  }

  async function validateUsedProducts(products) {
    if (!products.length) return;
    if (!activeWorkGuide?.id) {
      await loadGuides(false);
    }
    if (!activeWorkGuide?.id) {
      throw new Error("Sem guia de obra ativa para deduzir produtos.");
    }
    for (const product of products) {
      const stock = productStockByName(product.name);
      if (!stock) throw new Error(`Produto sem stock na viatura: ${product.name}`);
      const available = Number(stock.quantity ?? 0);
      if (available < product.quantity) {
        throw new Error(`Stock insuficiente para ${product.name}. Disponivel: ${available} ${stock.unit || product.unit}`);
      }
    }
  }

  async function consumeVisitProducts(visit, products) {
    if (!products.length) return [];
    const vehicleId = ($("#vehicleId")?.value || localStorage.getItem("cwVehicleId") || "").trim();
    const technicianId = ($("#technicianId")?.value || localStorage.getItem("cwTechnicianId") || "").trim();
    const location = visitLocation(visit);
    const readings = {
      ph: $("#ph")?.value,
      chlorine: $("#chlorine")?.value,
      alkalinity: $("#alkalinity")?.value,
      salt: $("#salt")?.value,
      orp: $("#orp")?.value,
      temperature: $("#temperature")?.value,
    };

    const results = [];
    for (const product of products) {
      const result = await api("/api/guides/work/consume", {
        method: "POST",
        body: JSON.stringify({
          workGuideId: activeWorkGuide.id,
          name: product.name,
          quantity: product.quantity,
          unit: product.unit,
          visitId: visit?.id || null,
          technicianId,
          vehicleId,
          poolId: visit?.pool?.id || visit?.poolId || null,
          clientId: visit?.client?.id || visit?.clientId || visit?.pool?.clientId || null,
          poolName: visit?.pool?.name || "",
          clientName: visit?.client?.name || visit?.pool?.client?.name || "",
          location: location.label,
          latitude: location.lat,
          longitude: location.lng,
          notes: product.notes || `Dosagem aplicada na visita ${visit?.id || ""}`.trim(),
          ...readings,
        }),
      });
      results.push(result);
    }
    await loadGuides(false);
    return results;
  }

  function listOf(value) {
    return Array.isArray(value) ? value : [];
  }

  function uniqueByKey(items, keyForItem) {
    const seen = new Set();
    return items.filter((item) => {
      const key = keyForItem(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function accessTypeLabel(type) {
    const normalized = String(type || "").trim().toUpperCase();
    if (normalized.includes("GATE") || normalized.includes("PORT")) return "Portao";
    if (normalized.includes("ALARM") || normalized.includes("ALARME")) return "Alarme";
    if (normalized.includes("BOX") || normalized.includes("CAIXA")) return "Caixa de chaves";
    if (normalized.includes("KEY") || normalized.includes("CHAVE")) return "Chave";
    if (normalized.includes("CODE") || normalized.includes("COD")) return "Codigo";
    return "Acesso";
  }

  function visibleAccesses(visit) {
    const poolKeys = listOf(visit?.pool?.keyAccesses)
      .filter((key) => key && key.active !== false && key.visibleToTechnician !== false)
      .map((key) => ({
        source: "Piscina",
        code: key.keyCode,
        title: "Chave / codigo da piscina",
        type: "KEY",
        instructions: key.description || "",
        required: key.requiredForVisit !== false
      }));

    const clientKeys = [
      ...listOf(visit?.client?.accesses),
      ...listOf(visit?.pool?.client?.accesses)
    ]
      .filter((key) => key && key.active !== false && key.visibleToTechnician !== false)
      .map((key) => ({
        source: "Cliente",
        code: key.codeValue,
        title: key.title || "Chave / codigo do cliente",
        type: key.accessType,
        instructions: key.instructions || "",
        required: true
      }));

    return uniqueByKey([...poolKeys, ...clientKeys].filter((key) => key.code || key.instructions), (key) => (
      `${key.source}:${key.type || ""}:${key.code || ""}:${key.instructions || ""}`
    ));
  }

  function repeatLabel(rule) {
    const value = String(rule || "").trim();
    if (!value || value === "NONE") return "";
    if (value === "WEEKLY") return "Repeticao semanal";
    if (value === "MONTHLY") return "Repeticao mensal";
    if (value === "QUARTERLY") return "Repeticao trimestral";
    if (value === "SEMIANNUAL") return "Repeticao semestral";
    if (value === "YEARLY" || value === "ANNUAL") return "Repeticao anual";
    if (value.startsWith("CUSTOM")) return value.replace(/^CUSTOM[:|]?/i, "Repeticao personalizada: ");
    return value;
  }

  function reminderIsRecurring(reminder) {
    const repeat = String(reminder?.repeatRule || "").trim().toUpperCase();
    return Boolean(repeat && repeat !== "NONE");
  }

  function normalizeReminder(reminder, source, model) {
    const due = reminder?.dueDate || reminder?.dueAt || null;
    const dueDate = due ? new Date(due) : null;
    const hasValidDue = dueDate && !Number.isNaN(dueDate.getTime());
    const recurring = reminderIsRecurring(reminder);
    const overdue = Boolean(hasValidDue && dueDate < new Date());
    return {
      id: reminder?.id,
      model,
      source,
      title: reminder?.title || "Lembrete",
      description: reminder?.description || "",
      due,
      category: reminder?.category || "",
      priority: reminder?.priority || "NORMAL",
      repeatRule: reminder?.repeatRule || "",
      recurring,
      overdue,
      label: overdue ? (recurring ? "Lembrete recorrente atrasado" : "Lembrete atrasado") : (recurring ? "Lembrete recorrente" : "Lembrete pontual")
    };
  }

  function visibleReminders(visit) {
    const open = reminder => reminder && reminder.isCompleted !== true && !reminder.completedAt && !["DONE", "CLOSED", "COMPLETED", "RESOLVED", "CANCELLED", "CANCELED"].includes(String(reminder.status || "").toUpperCase());
    const reminders = [
      ...listOf(visit?.pool?.operationalReminders).filter(open).map((reminder) => normalizeReminder(reminder, "Piscina", "operational")),
      ...listOf(visit?.client?.operationalReminders).filter(open).map((reminder) => normalizeReminder(reminder, "Cliente", "operational")),
      ...listOf(visit?.pool?.client?.operationalReminders).filter(open).map((reminder) => normalizeReminder(reminder, "Cliente", "operational")),
      ...listOf(visit?.pool?.generalReminders).filter(open).map((reminder) => normalizeReminder(reminder, "Piscina", "general")),
      ...listOf(visit?.client?.generalReminders).filter(open).map((reminder) => normalizeReminder(reminder, "Cliente", "general")),
      ...listOf(visit?.pool?.client?.generalReminders).filter(open).map((reminder) => normalizeReminder(reminder, "Cliente", "general"))
    ].filter((reminder) => reminder && reminder.title);

    return uniqueByKey(reminders, (reminder) => (
      `${reminder.model}:${reminder.source}:${reminder.id || ""}:${reminder.title}:${reminder.due || ""}`
    ));
  }

  function reminderClass(reminder) {
    if (reminder.overdue) return "reminder-overdue";
    return reminder.recurring ? "reminder-permanent" : "reminder-temporary";
  }

  function renderVisitNoticeStrip(visit, accesses, reminders, notes = "") {
    const strip = $("#visitNoticeStrip");
    const nextCard = document.querySelector(".next");
    if (!strip) return;

    const returnInstructions = visit?.reason === "INCOMPLETE_RETURN" ? String(visit.returnInstructions || "Confirme as instruções com o escritório") : "";
    const hasNotices = Boolean(visit && (accesses.length || reminders.length || notes || returnInstructions));
    if (nextCard) nextCard.classList.toggle("has-alerts", hasNotices);
    if (!hasNotices) {
      strip.hidden = true;
      strip.innerHTML = "";
      return;
    }

    const pills = [
      notes ? '<span class="visit-notice-pill reminder">Notas da piscina</span>' : "",
      accesses.length ? `<span class="visit-notice-pill access">${accesses.length} acesso(s)</span>` : "",
      reminders.length ? `<span class="visit-notice-pill reminder">${reminders.length} lembrete(s)</span>` : ""
    ].filter(Boolean).join("");

    strip.hidden = false;
    strip.innerHTML = `
      ${returnInstructions ? `<b>Regresso agendado pelo escritório</b><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(returnInstructions)}</p>` : "<b>Atencao antes de entrar</b>"}
      <div class="visit-notice-pills">${pills}</div>
      <small>Confirma codigos, chaves e instrucoes desta piscina antes de iniciar ou concluir a visita.</small>
    `;
  }

  function maybeNotifyVisitNotices(visit, accesses, reminders, notes) {
    const total = accesses.length + reminders.length + (notes ? 1 : 0);
    if (!visit || !total) {
      notifiedVisitNoticeKey = "";
      return;
    }
    const key = `${visitKey(visit)}:${accesses.length}:${reminders.length}:${notes || ""}`;
    if (notifiedVisitNoticeKey === key) return;
    notifiedVisitNoticeKey = key;
    toast(`Atencao: esta visita tem ${total} aviso(s), notas ou lembretes.`);
  }

  function renderAccessCard(visit) {
    const card = $("#accessCard");
    const list = $("#accessList");
    if (!card || !list) return;

    if (!visit) {
      card.hidden = false;
      card.classList.remove("has-alerts");
      renderVisitNoticeStrip(null, [], []);
      list.innerHTML = '<div class="muted">Sem piscina selecionada.</div>';
      return;
    }

    const accesses = visibleAccesses(visit);
    const reminders = visibleReminders(visit);
    const notes = typeof visit.pool?.notes === "string" ? visit.pool.notes.trim() : "";
    const hasNotices = accesses.length || reminders.length || notes;
    card.hidden = false;
    card.classList.toggle("has-alerts", Boolean(hasNotices));
    renderVisitNoticeStrip(visit, accesses, reminders, notes);
    maybeNotifyVisitNotices(visit, accesses, reminders, notes);

    if (!hasNotices) {
      list.innerHTML = `
        <div class="access-item">
          <div class="access-code">Sem código, nota ou lembrete registado</div>
          <div class="access-meta">Se esta piscina precisar de codigo de portao, alarme, chave ou aviso permanente, o administrador deve registar na ficha do cliente ou da piscina.</div>
        </div>
      `;
      return;
    }

    const accessHtml = accesses.map((access) => `
      <div class="access-item access-code-item">
        <span class="chip">${esc(accessTypeLabel(access.type))} - ${esc(access.source)}${access.required ? " - obrigatorio" : ""}</span>
        <div class="access-code">${esc(access.code || "Sem codigo")}</div>
        <div class="access-meta">${esc(access.title || "")}${access.instructions ? `<br>${esc(access.instructions)}` : ""}</div>
      </div>
    `).join("");

    const reminderHtml = reminders.map((reminder) => {
      const repeat = repeatLabel(reminder.repeatRule);
      const when = reminder.due ? formatDate(reminder.due) : "Sem data definida";
      const meta = [
        reminder.description,
        `Quando: ${when}`,
        repeat
      ].filter(Boolean).map((part) => esc(part)).join("<br>");
      return `
        <div class="access-item ${reminderClass(reminder)}">
          <span class="chip"><span>${esc(reminder.label)}</span> - <span>${esc(reminder.source)}</span></span>
          <div class="access-code" data-cw-no-i18n>${esc(reminder.title)}</div>
          <div class="access-meta">${meta}</div>
        </div>
      `;
    }).join("");

    const notesHtml = notes ? `<div class="access-item reminder-permanent" data-pool-notes><span class="chip">Notas da piscina</span><div class="access-meta" data-cw-no-i18n style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(notes)}</div></div>` : "";
    list.innerHTML = `${notesHtml}${accessHtml}${reminderHtml}`;
  }

  function photoTypeLabel(type) {
    const labels = {
      BEFORE: "Antes",
      AFTER: "Depois",
      PROBLEM: "Problema",
      ACCESS: "Acesso",
    };
    return labels[type] || "Registo";
  }

  function photoStatusText(photo) {
    if (photo.status === "uploaded") return "Sincronizada no registo";
    if (photo.status === "uploading") return "A enviar...";
    return photo.error ? `Pendente: ${photo.error}` : "Pendente por sincronizar";
  }

  function renderPhotoList() {
    const list = $("#photoList");
    if (!list) return;
    updateFieldDashboard(current());

    if (!visitPhotos.length) {
      list.innerHTML = '<div class="muted">Ainda sem fotografias nesta visita.</div>';
      return;
    }

    list.innerHTML = visitPhotos.map((photo) => `
      <div class="photo-item" data-photo-id="${esc(photo.localId)}">
        <img class="photo-thumb" ${photo.visitType === 'EXTRA' && photo.status === 'uploaded' ? `data-extra-photo-url="${esc(photo.url)}"` : `src="${esc(photo.previewUrl || photo.url || "")}"`} alt="Fotografia ${esc(photoTypeLabel(photo.type))}">
        <div class="photo-meta">
          <strong>${esc(photoTypeLabel(photo.type))}</strong>
          <span class="photo-status ${photo.status === "uploaded" ? "ok" : "warn"}">${esc(photoStatusText(photo))}</span>
          <span class="muted">${esc(photo.fileName || "Foto do servico")}</span>
          <div class="photo-mini">
            ${photo.status !== "uploaded" ? `<button type="button" data-photo-retry="${esc(photo.localId)}">Enviar</button>` : ""}
            ${photo.status !== "uploaded" ? `<button type="button" data-photo-remove="${esc(photo.localId)}">Remover</button>` : ""}
          </div>
        </div>
      </div>
    `).join("");

    for (const node of list.querySelectorAll('[data-extra-photo-url]')) {
      const url = node.dataset.extraPhotoUrl;
      if (photoPreviewCache.has(url)) { node.src = photoPreviewCache.get(url); continue; }
      if (!/^\/uploads\/(?:qa\/)?extra-visit-/.test(url)) continue;
      fetch(url,{headers:{Authorization:'Bearer '+fieldWriteSession.token},cache:'no-store'}).then(async response=>{
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw Error('Fotografia por confirmar.');
        const file=await response.blob(); if (!sameFieldSession()) return;
        const preview=URL.createObjectURL(file); photoPreviewCache.set(url,preview); if(node.isConnected)node.src=preview;
      }).catch(()=>{if(node.isConnected)node.alt='Fotografia guardada no servidor; ligue à rede para consultar.';});
    }

    list.querySelectorAll("[data-photo-retry]").forEach((button) => {
      button.addEventListener("click", () => {
        const photo = visitPhotos.find((item) => item.localId === button.dataset.photoRetry);
        if (photo) uploadPhoto(photo);
      });
    });

    list.querySelectorAll("[data-photo-remove]").forEach((button) => {
      button.addEventListener("click", async () => {
        const photo = visitPhotos.find((item) => item.localId === button.dataset.photoRemove);
        if (!photo || !sameFieldSession()) return;
        button.disabled = true;
        try {
          await window.CWFieldPhotos.remove(photo.visitId || current()?.id, photo.localId, fieldWriteSession, photo.visitType || 'REGULAR');
          if (photo.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
          if (!sameFieldSession()) return;
          visitPhotos = visitPhotos.filter((item) => item.localId !== photo.localId);
          saveCurrentDraft(); renderPhotoList();
        } catch (error) { if (sameFieldSession()) toast(error.message); }
        finally { button.disabled = false; }
      });
    });
  }

  async function uploadPhoto(photo) {
    const generation = fieldWriteGeneration;
    if (!sameFieldSession()) { photoFeedback('A sessão mudou. Reabra a página com a conta original.'); return false; }
    const visit = visits.find(v => (v.visitType || 'REGULAR') === (photo?.visitType || 'REGULAR') && String(v.id) === String(photo?.visitId));
    if (photo?.status === 'uploading') return false;
    if (!visit?.id || !(photo?.file instanceof Blob)) {
      photo.status = "pending";
      photo.error = "Sem visita ativa";
      renderPhotoList();
      return false;
    }

    photo.status = "uploading";
    photo.error = "";
    renderPhotoList();

    try {
      const data = await window.CWFieldPhotos.send(visit.id, photo.localId, fieldWriteSession, {}, visit.visitType || 'REGULAR');
      if (!sameFieldSession() || generation !== fieldWriteGeneration) return false;
      photo.status = "uploaded";
      photo.url = data.photo.url;
      photo.serverId = data.photo?.id || null;
      if (visitKey(current()) === visitKey(visit)) { saveCurrentDraft(); photoFeedback("Fotografia confirmada pelo servidor."); renderPhotoList(); }
      return true;
    } catch (error) {
      photo.status = "pending";
      photo.error = error.message;
      if (sameFieldSession() && generation === fieldWriteGeneration && visitKey(current()) === visitKey(visit)) renderPhotoList();
      return false;
    }
  }

  async function syncPendingPhotos(showFeedback = true) {
    if (!current()?.id) return false;
    const target = visitKey();
    const pending = visitPhotos.filter((photo) => photo.status !== "uploaded");
    if (!pending.length) {
      if (showFeedback) toast("Fotografias ja sincronizadas.");
      return true;
    }

    for (const photo of pending) {
      await uploadPhoto(photo);
      if (visitKey() !== target || !sameFieldSession()) return false;
    }

    const stillPending = visitPhotos.some((photo) => photo.status !== "uploaded");
    if (showFeedback) {
      toast(stillPending ? "Ainda existem fotos pendentes." : "Fotografias sincronizadas.");
    }
    return !stillPending;
  }

  function photoFeedback(message) {
    const node = $('#photoFeedback');
    if(node){node.textContent=message;node.hidden=!message;}
  }

  function pickPhoto(type, gallery = false) {
    if (!requireExecutableVisit()) return;
    const input = $(gallery ? '#galleryPhotoInput' : '#photoInput');
    if (!input) return;
    selectedPhotoType = type || "AFTER";
    if (!sameFieldSession()) { photoFeedback('A sessão mudou. Reabra a página com a conta original.'); return; }
    selectedPhotoContext = { visitId: current()?.id, visitKey:visitKey(), type: selectedPhotoType, generation: fieldWriteGeneration };
    input.value = "";
    try { input.click(); }
    catch(error){ photoFeedback('Não foi possível abrir a câmara. Use a opção de fotografia guardada no telemóvel.'); }
  }

  async function addSelectedPhoto(file, selection = selectedPhotoContext) {
    if (!file) return;
    if (!sameFieldSession() || (selection && (selection.generation !== fieldWriteGeneration || selection.visitKey !== visitKey()))) { photoFeedback('A visita ou a sessão mudou. Escolha novamente a fotografia na visita correta.'); return; }
    if (!requireExecutableVisit()) return;
    const target = visitKey();
    if (!current()?.id) { photoFeedback('Escolha uma visita antes de adicionar fotografias.'); return; }
    if (!file.type.startsWith('image/') || !file.size || file.size > 25*1024*1024) {
      photoFeedback('Escolha uma imagem válida, até 25 MB. A fotografia não foi adicionada.'); return;
    }
    const photo = {
      localId: crypto.randomUUID(),
      visitId: current()?.id, visitType:current()?.visitType || 'REGULAR', poolId:current()?.poolId || current()?.pool?.id,
      type: selection?.type || selectedPhotoType || "AFTER",
      file,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
      error: "",
    };
    try { await window.CWFieldPhotos.save(photo.visitId,photo,fieldWriteSession, current()?.visitType || 'REGULAR'); }
    catch(error) { URL.revokeObjectURL(photo.previewUrl);photoFeedback('Não foi possível guardar a fotografia neste dispositivo. Liberte espaço e tente novamente; a fotografia não foi adicionada.');return; }
    if (!sameFieldSession() || target !== visitKey()) { URL.revokeObjectURL(photo.previewUrl); return; }
    photoFeedback("Fotografia guardada neste telemóvel. Aguarda confirmação do envio.");
    visitPhotos.unshift(photo);
    saveCurrentDraft();
    renderPhotoList();
    uploadPhoto(photo);
  }

  function activeWaterReminders() {
    loadWaterRemindersFromStorage();
    return waterReminders.filter((reminder) => reminder.status !== "CLOSED" && reminderBelongsToCurrentContext(reminder));
  }

  function reminderBelongsToCurrentContext() { return sameFieldSession(); }

  function loadWaterRemindersFromStorage() {
    try { waterReminders = window.CWFieldReminders?.list('WATER_OPEN') || []; waterRemindersError = ''; }
    catch (error) { waterReminders = []; waterRemindersError = error.message; }
  }

  function waterReminderLabel(reminder) {
    const due = new Date(reminder.dueAt);
    if (Number.isNaN(due.getTime())) return "Hora por confirmar";
    const now = new Date();
    if (reminder.status === "CLOSED") return "Torneira fechada; confirmação no servidor pendente";
    if (reminder.status === "OVERDUE") return `Água por confirmar - previsto ${formatDate(due)}`;
    if (due <= now && reminder.status !== "CLOSED") return `Atrasado desde ${formatDate(due)}`;
    return `Lembrar em ${formatDate(due)}`;
  }

  function waterReminderSyncBadge(reminder) {
    if (reminder.syncError) return '<span class="chip" style="background:#fce4e4;border-color:#bd6464;color:#842020">Por confirmar</span>';
    if (reminder.serverId) return '<span class="chip" style="background:#ddf4e7;border-color:#68a880;color:#185a30">Registado</span>';
    return '<span class="chip" style="background:#fff0c6;border-color:#bd9c45;color:#604800">A sincronizar</span>';
  }

  function showWaterAlarmPopup(reminder) {
    const message = [
      "ALARME: agua aberta por fechar.",
      reminder.poolName ? `Piscina: ${reminder.poolName}` : "",
      reminder.clientName ? `Cliente: ${reminder.clientName}` : "",
      reminder.note ? `Nota: ${reminder.note}` : "",
      "Verificar ou fechar imediatamente.",
    ].filter(Boolean).join("\n");
    setTimeout(() => ui.error(message), 80);
  }

  function renderWaterReminders() {
    const list = $("#waterReminderList");
    if (!list) return;
    loadWaterRemindersFromStorage();
    if (waterRemindersError) { list.textContent = waterRemindersError; return; }
    const active = waterReminders.filter(row=>row.status!=="CLOSED" || !row.closeSyncedAt).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    if (!active.length) {
      list.innerHTML = '<div class="muted">Sem lembretes de agua aberta.</div>';
      renderInterruptBoard();
      return;
    }

    list.innerHTML = active.map((reminder) => {
      const overdue = reminder.status === "OVERDUE" || new Date(reminder.dueAt) <= new Date();
      return `
        <div class="water-item ${overdue ? "overdue" : ""}" data-water-id="${esc(reminder.localId)}">
          <div class="water-line">
            <div>
              <strong>${esc(reminder.poolName || "Piscina")}</strong>
              <div class="muted">${esc(reminder.clientName || "Cliente")} - ${esc(reminder.location || "Localizacao por confirmar")}</div>
              <div class="muted">${esc(reminder.note || "Sem nota adicional")}</div>
              ${reminder.syncError ? `<div class="muted" style="color:#842020;background:#fce4e4;padding:4px;border-radius:4px"> ${esc(reminder.syncError)}</div>` : ""}
            </div>
            <div style="display:grid;gap:6px;justify-items:end">
              <span class="chip">${reminder.status === "CLOSED" ? "Fecho por enviar" : overdue ? "ALARME" : "Aberta"}</span>
              ${waterReminderSyncBadge(reminder)}
            </div>
          </div>
          <div class="doc-number" style="font-size:18px">${esc(waterReminderLabel(reminder))}</div>
          <div class="water-actions" style="${reminder.status === "CLOSED" ? "display:none" : ""}">
            <button class="close" type="button" data-water-close="${esc(reminder.localId)}">Agua fechada</button>
            <button class="alarm" type="button" data-water-alarm="${esc(reminder.localId)}">Alertar equipa</button>
          </div>
        </div>
      `;
    }).join("");

    list.querySelectorAll("[data-water-close]").forEach((button) => {
      button.addEventListener("click", () => closeWaterReminder(button.dataset.waterClose));
    });
    list.querySelectorAll("[data-water-alarm]").forEach((button) => {
      button.addEventListener("click", () => escalateWaterReminder(button.dataset.waterAlarm, true));
    });
    renderInterruptBoard();
  }

  function clearWaterTimer(localId) {
    const timer = waterTimers.get(localId);
    if (timer) clearTimeout(timer);
    waterTimers.delete(localId);
  }

  function scheduleWaterReminder(reminder) {
    if (!reminder?.localId || reminder.status !== "OPEN") return;
    clearWaterTimer(reminder.localId);
    const dueMs = new Date(reminder.dueAt).getTime();
    if (!Number.isFinite(dueMs)) return;
    const delay = Math.max(0, dueMs - Date.now());
    const timer = setTimeout(() => escalateWaterReminder(reminder.localId, false), delay);
    waterTimers.set(reminder.localId, timer);
  }

  function scheduleWaterReminders() {
    waterTimers.forEach((timer) => clearTimeout(timer));
    waterTimers.clear();
    activeWaterReminders().forEach(scheduleWaterReminder);
  }

  async function createWaterReminder() {
    try { await window.CWWaterReminders?.open(); } catch (error) { toast(error.message); }
  }

  async function closeWaterReminder(localId) {
    try { await window.CWWaterReminders?.close(localId); } catch (error) { toast(error.message); }
  }

  async function escalateWaterReminder(localId, manual) {
    if (!sameFieldSession()) return;
    const reminder = window.CWFieldReminders?.list('WATER_OPEN').find(item=>item.localId===localId);
    if (!reminder || reminder.status === 'CLOSED') return;
    try {
      await window.CWFieldReminders.mark('WATER_OPEN',localId,'alarm');
      if (navigator.vibrate) navigator.vibrate([300,120,300]);
      toast('ALARME: verificar água aberta. A confirmar no servidor.');
      if (!manual) showWaterAlarmPopup(reminder);
      await window.CWFieldReminders.sync();
    } catch (error) { toast(error.message); }
  }

  function renderTransportGuide(guide, items) {
    const box = $("#transportGuideBox");
    if (!box) return;
    if (!guide) {
      box.innerHTML = `
        <div class="doc-head"><span class="chip">Guia AT</span><strong class="status-warn">Em falta</strong></div>
        <div class="doc-number">Sem guia de transporte ativa</div>
        <div class="muted">Pode iniciar o servico em modo provisorio. O administrador fica com alerta para associar a guia AT assim que estiver disponivel.</div>
      `;
      return;
    }

    const vehicle = guide.vehicle || {};
    const pdfHref = guide.id
      ? `/api/guides/transport/${encodeURIComponent(guide.id)}/pdf`
      : `/api/guides/transport/latest/${encodeURIComponent(guide.vehicleId || vehicle.id || "")}/pdf`;
    const officialDocument = guide.officialDocument || guide.transportGuideDocument || null;
    const officialDocumentMeta = officialDocument?.url
      ? `<span>Ficheiro AT oficial: ${esc(officialDocument.originalName || officialDocument.filename || "documento")}</span>`
      : `<span>Ficheiro AT oficial: por anexar pelo administrador</span>`;
    const officialDocumentButton = officialDocument?.url
      ? docButton(officialDocument.url, "Abrir guia AT oficial")
      : "";
    box.innerHTML = `
      <div class="doc-head"><span class="chip">Guia AT</span><strong class="status-ok">${esc(guide.status || "ACTIVE")}</strong></div>
      <div class="doc-number">${esc(guide.codeAT || `Guia #${guide.id}`)}</div>
      <div class="doc-meta">
        <span>Empresa: Cristal Water LDA</span>
        <span>Viatura: ${esc(vehicle.plate || guide.vehiclePlate || guide.vehicleId || "Nao indicada")}</span>
        <span>Origem: ${esc(guide.origin || "Armazem Cristal Water")}</span>
        <span>Destino: ${esc(guide.destination || "Clientes em rota")}</span>
        <span>Validade: ${esc(formatDate(guide.validFrom))} - ${esc(formatDate(guide.validUntil))}</span>
        ${officialDocumentMeta}
      </div>
      ${renderItems(items || guide.items, "transport")}
      <div class="doc-actions">${officialDocumentButton}${docButton(pdfHref, officialDocument?.url ? "Abrir PDF guia AT gerado" : "Abrir PDF guia AT")}</div>
    `;
  }

  function renderWorkGuide(workGuide, stock, movements) {
    const box = $("#workGuideBox");
    if (!box) return;
    if (!workGuide) {
      box.innerHTML = `
        <div class="doc-head"><span class="chip">Guia de obra</span><strong class="status-warn">Em falta</strong></div>
        <div class="doc-number">Sem guia de obra aberta</div>
        <div class="muted">Abre a gestao de guias para iniciar uma guia de trabalho ligada a viatura.</div>
      `;
      return;
    }

    const stockRows = stock || workGuide.items || [];
    box.innerHTML = `
      <div class="doc-head"><span class="chip">Guia de obra</span><strong class="${workGuide.guideId ? "status-ok" : "status-warn"}">${esc(workGuide.status || "OPEN")}</strong></div>
      <div class="doc-number">Obra #${esc(workGuide.id)}</div>
      <div class="doc-meta">
        <span>Empresa: Cristal Water LDA</span>
        <span>Tecnico: ${esc(workGuide.technician?.name || workGuide.technicianId || "Nao indicado")}</span>
        <span>Viatura: ${esc(workGuide.vehicle?.plate || workGuide.vehicleId || "Nao indicada")}</span>
        <span>Guia AT associada: ${esc(workGuide.guide?.codeAT || workGuide.guideId || "AT em falta - associar mais tarde")}</span>
        <span>Inicio: ${esc(formatDate(workGuide.createdAt))}</span>
      </div>
      <div class="doc-subtitle">Saidas de material registadas</div>
      ${renderUsage(stockRows)}
      <div class="doc-subtitle">Saidas por local</div>
      ${renderMovements(movements)}
      <div class="doc-subtitle">Stock final da viatura</div>
      ${renderItems(stockRows, "work")}
      ${renderStockSummary(stockRows)}
      <div class="doc-actions">${docButton(`/api/guides/work/${encodeURIComponent(workGuide.id)}/pdf`, "Abrir PDF guia de obra")}</div>
    `;
  }

  function renderInsurance(vehicle, insurance, vehicleId) {
    const box = $("#insuranceBox");
    if (!box) return;
    const plate = vehicle?.plate || vehicleId || "Nao indicada";
    if (!insurance) {
      box.innerHTML = `
        <div class="doc-head"><span class="chip">Seguro</span><strong class="status-warn">Por validar</strong></div>
        <div class="doc-number">Seguro da viatura</div>
        <div class="doc-meta">
          <span>Empresa: Cristal Water LDA</span>
          <span>Matricula: ${esc(plate)}</span>
          <span>Sem seguro registado na ficha da viatura.</span>
        </div>
        <div class="doc-actions">${docButton(`/api/guides/vehicles/${encodeURIComponent(vehicleId)}/insurance/pdf`, "Abrir ficha do seguro")}</div>
      `;
      return;
    }

    box.innerHTML = `
      <div class="doc-head"><span class="chip">Seguro</span><strong class="status-ok">${esc(insurance.status || "Ativo")}</strong></div>
      <div class="doc-number">${esc(insurance.title || "Seguro da viatura")}</div>
      <div class="doc-meta">
        <span>Empresa: Cristal Water LDA</span>
        <span>Matricula: ${esc(plate)}</span>
        <span>Validade: ${esc(formatDate(insurance.dueDate))}</span>
        <span>${esc(insurance.notes || "Documento registado na frota.")}</span>
      </div>
      <div class="doc-actions">${docButton(`/api/guides/vehicles/${encodeURIComponent(vehicleId)}/insurance/pdf`, "Abrir PDF seguro")}</div>
    `;
  }

  async function loadGuides(showFeedback = true) {
    const vehicleInput = $("#vehicleId");
    const technicianInput = $("#technicianId");
    const vehicleId = (vehicleInput?.value || localStorage.getItem("cwVehicleId") || "").trim();
    if (!vehicleId) { documentsLoaded = true; renderCrewStatus(); updateFieldDashboard(current()); return; }
    documentsLoaded = false;
    const technicianId = (technicianInput?.value || localStorage.getItem("cwTechnicianId") || "").trim();

    if (vehicleInput) vehicleInput.value = vehicleId;
    if (technicianInput) technicianInput.value = technicianId;
    localStorage.setItem("cwVehicleId", vehicleId);
    if (technicianId) localStorage.setItem("cwTechnicianId", technicianId);

    const transportBox = $("#transportGuideBox");
    const workBox = $("#workGuideBox");
    if (transportBox) transportBox.innerHTML = '<div class="doc-number">A carregar guia AT...</div>';
    if (workBox) workBox.innerHTML = '<div class="doc-number">A carregar guia de obra...</div>';

    docsSource = "live";
    const cachedDocs = readDocsCache(vehicleId);

    const [transportResult, stockResult, insuranceResult] = await Promise.allSettled([
      api(`/api/guides/transport/latest/${encodeURIComponent(vehicleId)}`),
      api(`/api/guides/stock/${encodeURIComponent(vehicleId)}${technicianId ? `?technicianId=${encodeURIComponent(technicianId)}` : ""}`),
      api(`/api/guides/vehicles/${encodeURIComponent(vehicleId)}/insurance`),
    ]);

    if (transportResult.status === "fulfilled") {
      activeTransportGuide = transportResult.value.guide || null;
      activeVehicle = activeTransportGuide?.vehicle || activeVehicle;
      renderTransportGuide(transportResult.value.guide, transportResult.value.items);
      docsSource = "live";
    } else if (cachedDocs?.transport) {
      activeTransportGuide = cachedDocs.transport.guide || null;
      activeVehicle = cachedDocs.transport.vehicle || activeVehicle;
      renderTransportGuide(cachedDocs.transport.guide, cachedDocs.transport.items || []);
      docsSource = "cache";
    } else {
      activeTransportGuide = null;
      renderTransportGuide(null, []);
    }

    if (stockResult.status === "fulfilled") {
      activeWorkGuide = stockResult.value.workGuide || null;
      activeWorkStock = stockResult.value.stock || activeWorkGuide?.items || [];
      activeVehicle = activeWorkGuide?.vehicle || activeVehicle;
      activeTechnician = activeWorkGuide?.technician || activeTechnician;
      renderWorkGuide(stockResult.value.workGuide, stockResult.value.stock, stockResult.value.movements);
      docsSource = "live";
    } else if (cachedDocs?.work) {
      activeWorkGuide = cachedDocs.work.workGuide || null;
      activeWorkStock = cachedDocs.work.stock || [];
      activeVehicle = cachedDocs.work.vehicle || activeVehicle;
      renderWorkGuide(cachedDocs.work.workGuide, cachedDocs.work.stock || [], cachedDocs.work.movements || []);
      docsSource = "cache";
    } else {
      activeWorkGuide = null;
      activeWorkStock = [];
      renderWorkGuide(null, [], []);
    }

    renderDoseRows();

    if (insuranceResult.status === "fulfilled") {
      activeVehicle = insuranceResult.value.vehicle || activeVehicle;
      activeInsurance = insuranceResult.value.insurance || null;
      renderInsurance(insuranceResult.value.vehicle, insuranceResult.value.insurance, vehicleId);
      docsSource = "live";
    } else if (cachedDocs?.insurance) {
      activeVehicle = cachedDocs.insurance.vehicle || activeVehicle;
      activeInsurance = cachedDocs.insurance.insurance || null;
      renderInsurance(cachedDocs.insurance.vehicle, cachedDocs.insurance.insurance, vehicleId);
      docsSource = "cache";
    } else {
      activeInsurance = null;
      renderInsurance(null, null, vehicleId);
    }

    if (transportResult.status === "fulfilled" || stockResult.status === "fulfilled" || insuranceResult.status === "fulfilled") {
      saveDocsCache(vehicleId, {
        transport: {
          guide: activeTransportGuide,
          items: transportResult.status === "fulfilled" ? (transportResult.value.items || []) : (cachedDocs?.transport?.items || []),
          vehicle: activeTransportGuide?.vehicle || activeVehicle || null,
        },
        work: {
          workGuide: activeWorkGuide,
          stock: activeWorkStock,
          movements: stockResult.status === "fulfilled" ? (stockResult.value.movements || []) : (cachedDocs?.work?.movements || []),
          vehicle: activeWorkGuide?.vehicle || activeVehicle || null,
        },
        insurance: {
          vehicle: activeVehicle || null,
          insurance: activeInsurance || null,
        },
      });
    }

    documentsLoaded = true;
    updateFieldDashboard(current());
    renderCrewStatus();

    visitDraftManager.paint(currentDraftEntry);
    if (showFeedback) toast(docsSource === "cache" ? "Documentos carregados em modo offline sincronizado." : "Guias atualizadas.");
  }

  function resetForm() {
    ["ph", "chlorine", "alkalinity", "salt", "orp", "temperature", "notes"].forEach((id) => {
      const node = $(`#${id}`);
      if (node) node.value = "";
    });
    updateAllReferenceStatuses();
    const category = $("#problemCategory");
    if (category) category.value = "Servico normal";
    checkIds.forEach((id) => {
      const node = $(`#${id}`);
      if (node) node.checked = false;
    });
    startedAt = null;
    pendingProblems = [];
    usedProducts = [];
    renderDoseRows();
    visitPhotos.forEach((photo) => {
      if (photo.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
    });
    visitPhotos = [];
    renderPhotoList();
  }

  function poolFilterGroup(code) {
    if (code === "DONE") return "DONE";
    if (["IN_PROGRESS", "WATER_OPEN", "WAITING_MATERIAL", "CRITICAL"].includes(code)) return "IN_PROGRESS";
    return "TODO";
  }

  function renderNowBoard(visit) {
    const stateLine = $("#nowStateLine");
    const responsibleLine = $("#nowResponsibleLine");
    const timingLine = $("#nowTimingLine");
    if (!stateLine || !responsibleLine || !timingLine) return;

    if (!visit) {
      stateLine.textContent = "Hoje está livre";
      responsibleLine.textContent = "Ver agenda ou comunicar com o administrador";
      timingLine.textContent = "Sem intervenção ativa neste momento";
      return;
    }

    const stateLabel = operationalStateLabel(visit);
    const technicianName = visit?.technician?.name || activeTechnician?.name || "Técnico por confirmar";
    const taskType = pendingProblems.length ? "Reparação" : "Manutenção";
    stateLine.textContent = `${visit.pool?.name || "Piscina"} · ${stateLabel}`;
    responsibleLine.textContent = `${technicianName} · ${taskType}`;
    timingLine.textContent = elapsedMinutesLabel(visit.startAt || startedAt);
  }

  function renderList() {
    const list = $("#visitList");
    const segments = $("#poolSegments");
    if (!list) return;

    if (segments) {
      segments.querySelectorAll("[data-pool-filter]").forEach((button) => {
        button.classList.toggle("active", button.dataset.poolFilter === activePoolFilter);
      });
    }

    if (!visits.length) {
      list.innerHTML = `
        <div class="visit">
          <div class="visit-top">
            <b>Hoje está livre</b>
            <span class="chip">Sem visitas</span>
          </div>
          <span>Não existem visitas atribuídas neste momento.</span>
          <div class="visit-state">Atualiza a agenda, abre o calendário ou comunica com o administrador.</div>
        </div>
      `;
      return;
    }

    const grouped = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };

    visits.forEach((visit, i) => {
      const code = operationalStateCode(visit);
      const group = poolFilterGroup(code);
      grouped[group].push({ visit, i, code });
    });

    const groupOrder = activePoolFilter === "ALL" ? ["TODO", "IN_PROGRESS", "DONE"] : [activePoolFilter];
    const groupTitle = {
      TODO: "Por fazer",
      IN_PROGRESS: "Em curso",
      DONE: "Concluídas",
    };

    const html = groupOrder.map((groupKey) => {
      const rows = grouped[groupKey] || [];
      if (!rows.length) {
        return `
          <div class="visit-group">
            <div class="visit-group-title">${groupTitle[groupKey]}</div>
            <div class="empty">Sem piscinas neste estado.</div>
          </div>
        `;
      }

      const rowsHtml = rows.map(({ visit, i, code }) => {
      const location = visitLocation(visit);
      const done = isVisitDone(visit);
      const status = !isRegularVisit(visit) ? `Extra / ${isVisitDone(visit) ? 'Concluída' : visit.status || 'Pendente'}` : done ? "Feita / pode corrigir" : (visit.status || "Pendente");
      const techName = visit?.technician?.name || activeTechnician?.name || "Técnico";
      const taskType = pendingProblems.length ? "Reparação" : "Manutenção";
      const stateLabel = POOL_STATE[code] || POOL_STATE.TODO;
      return `
      <button class="visit ${i === index ? "active" : ""} ${done ? "done" : ""}" type="button" data-visit-index="${i}">
        <div class="visit-top">
          <b>${esc(visit.pool?.name || "Piscina")}</b>
          <span class="chip">${esc(stateLabel)}</span>
        </div>
        <span>${esc(visit.client?.name || "Cliente")}</span>
        <div class="visit-state">${esc(techName)} · ${esc(elapsedMinutesLabel(visit.startAt))} · ${esc(taskType)} · ${esc(status)}</div>
        <div class="visit-location">
          <span>Local: ${esc(location.address || visit.pool?.zone || "Localizacao por confirmar")}</span>
          <span>${location.lat && location.lng ? `GPS: ${esc(location.lat.toFixed(5))}, ${esc(location.lng.toFixed(5))}` : "GPS por registar"}</span>
        </div>
      </button>
    `;
      }).join("");

      return `
        <div class="visit-group">
          <div class="visit-group-title">${groupTitle[groupKey]}</div>
          ${rowsHtml}
        </div>
      `;
    }).join("");

    list.innerHTML = html;

    list.querySelectorAll("[data-visit-index]").forEach((button) => {
      button.addEventListener("click", () => selectVisit(Number(button.dataset.visitIndex)));
    });
  }

  function ensureAssistPanel() {
    const nextCard = document.querySelector(".next");
    if (!nextCard) return null;
    let panel = $("#fieldAssistPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "fieldAssistPanel";
      panel.className = "field-assist-panel";
      nextCard.appendChild(panel);
    }
    return panel;
  }

  function pendingVisitsOnly(items) {
    return (Array.isArray(items) ? items : []).filter((visit) => !isVisitDone(visit));
  }

  function visitLine(visit) {
    const location = visitLocation(visit);
    const time = formatDate(visit.plannedDate || visit.date || visit.startAt);
    return `${time} - ${visit.client?.name || "Cliente"} - ${location.address || visit.pool?.zone || "local por confirmar"}`;
  }

  function assistCardHtml(visit, source) {
    const isTomorrow = source === "tomorrow";
    const techName = visit.technician?.name || visit.technicianName || "tecnico por confirmar";
    return `
      <button class="assist-card" type="button" data-assist-visit="${esc(visit.id)}" data-assist-type="${esc(visit.visitType || 'REGULAR')}" data-assist-source="${esc(source)}">
        <span class="chip">${isTomorrow ? "Amanha" : "Ajudar colega"}</span>
        <b>${esc(visit.pool?.name || "Piscina")}</b>
        <small>${esc(visitLine(visit))}</small>
        <small>${isTomorrow ? "Ronda propria antecipada" : `Ronda de ${techName}`}</small>
      </button>
    `;
  }

  function renderAssistPanel(mode = "overview") {
    const panel = ensureAssistPanel();
    if (!panel) return;
    if (current()) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    const other = assistOptions.otherToday || [];
    const tomorrow = assistOptions.tomorrow || [];
    const showOther = mode === "help" || mode === "overview";
    const showTomorrow = mode === "tomorrow" || mode === "overview";
    const loading = assistOptions.loading ? '<div class="assist-empty">A procurar trabalho pendente...</div>' : "";
    const error = assistOptions.error ? `<div class="assist-empty warn">${esc(assistOptions.error)}</div>` : "";
    const otherHtml = other.length
      ? `<div class="assist-list">${other.slice(0, 8).map((visit) => assistCardHtml(visit, "otherToday")).join("")}</div>`
      : '<div class="assist-empty">Nenhuma piscina pendente de colegas neste momento.</div>';
    const tomorrowHtml = tomorrow.length
      ? `<div class="assist-list">${tomorrow.slice(0, 8).map((visit) => assistCardHtml(visit, "tomorrow")).join("")}</div>`
      : '<div class="assist-empty">A ronda do proximo dia ainda nao tem piscinas pendentes.</div>';

    panel.innerHTML = `
      <div class="assist-head">
        <b>Depois da ronda</b>
        <span>${esc(`${other.length} colega(s) pendente(s) - ${tomorrow.length} para antecipar`)}</span>
      </div>
      <div class="assist-actions">
        <button type="button" data-assist-mode="help">Ajudar colegas</button>
        <button type="button" data-assist-mode="tomorrow">Antecipar amanha</button>
      </div>
      ${loading}
      ${error}
      ${showOther ? `<div class="assist-section"><h3>Ajudar outras rondas em trabalho</h3>${otherHtml}</div>` : ""}
      ${showTomorrow ? `<div class="assist-section"><h3>Comecar a ronda do proximo dia</h3>${tomorrowHtml}</div>` : ""}
    `;
  }

  async function loadAssistOptions(force = false) {
    const technicianId = currentTechnicianId();
    const key = `${technicianId || "all"}:${localIsoDate(new Date())}`;
    if (!force && assistOptions.loadedKey === key) {
      renderAssistPanel();
      return;
    }
    assistOptions = { ...assistOptions, loading: true, loadedKey: key, error: "" };
    renderAssistPanel();

    try {
      const todayAllQuery = dayQueryParams(new Date(), "");
      const tomorrowQuery = dayQueryParams(addLocalDays(1), technicianId);
      const [todayResult, tomorrowResult] = await Promise.allSettled([
        api(`/api/technician/today?${todayAllQuery}`),
        api(`/api/technician/today?${tomorrowQuery}`),
      ]);

      const todayVisits = todayResult.status === "fulfilled" ? pendingVisitsOnly(todayResult.value.visits) : [];
      const tomorrowVisits = tomorrowResult.status === "fulfilled" ? pendingVisitsOnly(tomorrowResult.value.visits) : [];
      const otherToday = todayVisits
        .filter((visit) => !technicianId || String(visit.technician?.id || visit.technicianId || "") !== String(technicianId))
        .sort((a, b) => new Date(a.plannedDate || a.date || 0) - new Date(b.plannedDate || b.date || 0));

      assistOptions = {
        loading: false,
        loadedKey: key,
        otherToday,
        tomorrow: tomorrowVisits.sort((a, b) => new Date(a.plannedDate || a.date || 0) - new Date(b.plannedDate || b.date || 0)),
        error: "",
      };
    } catch (error) {
      assistOptions = { ...assistOptions, loading: false, error: error.message || "Nao foi possivel carregar alternativas." };
    }
    renderAssistPanel();
  }

  function openAssistVisit(visitId, source, visitType = 'REGULAR') {
    const pools = source === "tomorrow" ? assistOptions.tomorrow : assistOptions.otherToday;
    const found = pools.find((visit) => String(visit.id) === String(visitId) && (visit.visitType || 'REGULAR') === visitType);
    if (!found) return;
    const visit = { ...found, assistSource: source };
    const existing = visits.findIndex((item) => visitKey(item) === visitKey(visit));
    if (existing >= 0) {
      visits[existing] = { ...visits[existing], ...visit };
      index = existing;
    } else {
      visits.push(visit);
      index = visits.length - 1;
    }
    loadCurrentDraft();
    render();
    switchFieldTab("hoje", true);
    toast(source === "tomorrow" ? "Ronda de amanha aberta." : "Visita de apoio aberta.");
  }

  function showAssistMode(mode) {
    renderAssistPanel(mode);
    ensureAssistPanel()?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function readingLabel(value, suffix = "") {
    if (value === undefined || value === null || value === "") return "Sem registo";
    return `${value}${suffix ? ` ${suffix}` : ""}`;
  }

  function doneChecksLabel(visit) {
    const done = [];
    if (visit?.cleaned) done.push("Limpeza");
    if (visit?.vacuumed) done.push("Aspiracao");
    if (visit?.basketCleaned) done.push("Cesto");
    if (visit?.brushed) done.push("Escovagem");
    if (visit?.waterlineClean) done.push("Linha de agua");
    if (visit?.backwashDone) done.push("Filtro");
    return done.length ? done.join(" / ") : "Sem checklist marcada";
  }

  function productsLabel(products) {
    if (!products.length) return "Sem produtos";
    return products.map((product) => `${product.name} ${product.quantity || ""} ${product.unit || ""}`.trim()).join(" / ");
  }

  function renderCorrectionSummary(visit) {
    const card = $("#correctionSummaryCard");
    const summary = $("#correctionSummary");
    const savedAt = $("#correctionSavedAt");
    if (!card || !summary) return;

    if (!isVisitDone(visit)) {
      card.hidden = true;
      summary.innerHTML = "";
      return;
    }

    const products = productsFromVisit(visit);
    const photos = photosFromVisit(visit);
    card.hidden = false;
    if (savedAt) savedAt.textContent = visit?.endAt ? formatDate(visit.endAt) : "Feita";

    summary.innerHTML = `
      <div class="service-summary-grid">
        <div class="service-summary-item"><span>Checklist</span><b>${esc(doneChecksLabel(visit))}</b></div>
        <div class="service-summary-item"><span>pH</span><b>${esc(readingLabel(visit?.ph))}</b></div>
        <div class="service-summary-item"><span>Cloro</span><b>${esc(readingLabel(visit?.chlorine, "ppm"))}</b></div>
        <div class="service-summary-item"><span>Alcalinidade</span><b>${esc(readingLabel(visit?.alkalinity, "ppm"))}</b></div>
        <div class="service-summary-item"><span>ORP</span><b>${esc(readingLabel(visit?.orpMv, "mV"))}</b></div>
        <div class="service-summary-item"><span>Temperatura</span><b>${esc(readingLabel(visit?.temperature, "C"))}</b></div>
        <div class="service-summary-item"><span>Produtos</span><b>${esc(productsLabel(products))}</b></div>
        <div class="service-summary-item"><span>Fotos</span><b>${esc(`${photos.length} foto${photos.length === 1 ? "" : "s"}`)}</b></div>
        <div class="service-summary-item"><span>Estado</span><b>Correção aberta</b></div>
      </div>
      <div class="service-summary-note">
        <strong>Notas guardadas:</strong><br>
        ${esc(visit?.notes || "Sem notas registadas nesta visita.")}
      </div>
    `;
  }

  function selectVisit(nextIndex) {
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= visits.length) return;
    saveCurrentDraft();
    index = nextIndex;
    loadCurrentDraft();
    persistFieldUiState();
    render();
    if (isVisitDone(current())) {
      switchFieldTab("agora");
      toast(isRegularVisit(current()) ? 'Visita feita aberta para corrigir.' : 'Registo da visita extra concluída.');
    }
  }

  function nextPendingIndex(afterIndex) {
    const later = visits.findIndex((visit, i) => i > afterIndex && !isVisitDone(visit));
    if (later >= 0) return later;
    const any = visits.findIndex((visit) => !isVisitDone(visit));
    return any >= 0 ? any : visits.length;
  }

  function render() {
    renderIncompleteStatus();
    const visit = current();
    window.dispatchEvent(new CustomEvent("cw:field-visit-selected", { detail: { visitId: visit?.id || null, visitType:visit?.visitType || null, poolId:visit?.poolId || visit?.pool?.id || null, state:JSON.stringify([visit?.status,visit?.startAt,visit?.endAt]) } }));
    const extra = !!visit && !isRegularVisit(visit);
    document.body.classList.toggle('field-extra-selected',extra);
    const readOnly = extra && isVisitDone(visit);
    $('#fieldExtraVisitNotice').hidden = !extra;
    $('#fieldExtraVisitNotice').textContent = extra ? extraVisitNotice : '';
    for (const selector of [...draftFieldIds.map(id=>'#'+id),...checkIds.map(id=>'#'+id),'#startBtn','#finishBtn','#incompleteSave','#problemBtn','#saveProblemBtn','#openWaterBtn','#pumpReminderCreate','#sendAdminAlertBtn','#addDoseBtn','#galleryPhotoBtn','#photoInput','#galleryPhotoInput','[data-photo-type]','#doseRows input','#doseRows select','#doseRows button']) document.querySelectorAll(selector).forEach(node=>{node.disabled=readOnly;});
    for(const selector of ['#openWaterBtn','#pumpReminderCreate'])document.querySelectorAll(selector).forEach(node=>{node.disabled=!visit || !sameFieldSession();});
    if(extra)for(const selector of ['#problemBtn','#saveProblemBtn','#sendAdminAlertBtn'])document.querySelectorAll(selector).forEach(node=>{node.disabled=true;});
    $("#progressText").textContent = visits.length ? `${visits.filter(isVisitDone).length} de ${visits.length} visitas concluídas` : "Sem visitas atribuídas";

    if (!visit) {
      $("#nextTitle").textContent = "Hoje livre";
      void technicalProposalEditor.open(null);
      $("#nextMeta").textContent = "Não tens visitas atribuídas. Atualiza a agenda, vê o calendário ou comunica com o administrador.";
      if ($("#startBtn")) {
        $("#startBtn").disabled = false;
        $("#startBtn").textContent = "Atualizar agenda";
        $("#startBtn").dataset.cwCheckinRequired = 'false';
        delete $("#startBtn").dataset.cwCheckinTarget;
      }
      $("#finishBtn").disabled = false;
      $("#finishBtn").textContent = "Ver agenda";
      updateFieldConnection();
      renderCorrectionSummary(null);
      renderAccessCard(null);
      renderRouteCard(null);
      renderList();
      renderNowBoard(null);
      updateFieldDashboard(null);
      renderAssistPanel();
      loadAssistOptions(false);
      technicalProposals = [];
      renderTechnicalProposalList();
      return;
    }

    $("#finishBtn").disabled = !sameFieldSession();
    updateFieldConnection();
    $("#nextTitle").textContent = visit.pool?.name || "Piscina";
    const sourceLabel = visit.assistSource === "otherToday"
      ? `Ajudar ${visit.technician?.name || visit.technicianName || "colega"}`
      : (visit.assistSource === "tomorrow" ? "Ronda do proximo dia" : (visit.technician?.name || "Tecnico"));
    $("#nextMeta").textContent = `${visit.client?.name || "Cliente"} - ${sourceLabel} - ${readOnly ? 'Extra / ' + (visit.status || 'Pendente') : isVisitDone(visit) ? "Feita / correcao aberta" : (visit.status || "Pendente")}`;
    if ($("#startBtn")) {
      $("#startBtn").textContent = readOnly ? "Consultar registo" : isVisitDone(visit) ? "Rever registo" : "Iniciar visita";
      $("#startBtn").dataset.cwCheckinRequired = String(!isVisitDone(visit));
      $("#startBtn").dataset.cwCheckinTarget = JSON.stringify([visit.visitType || 'REGULAR', visit.id, visit.pool?.id]);
      $("#startBtn").disabled = readOnly || startingVisits.has(visitKey(visit));
    }
    $("#finishBtn").textContent = readOnly ? "Corrigir registo" : isVisitDone(visit) ? "Guardar correção" : "Concluir visita";
    renderAssistPanel();
    renderCorrectionSummary(visit);
    renderAccessCard(visit);
    renderRouteCard(visit);
    renderList();
    renderNowBoard(visit);
    updateFieldDashboard(visit);
    loadTechnicalProposals(currentPoolId());
    persistFieldUiState();
    visitDraftManager.paint(currentDraftEntry);
  }

  function showRouteCacheWarning(message) {
    const node = $("#fieldRouteAge"); node.hidden = false; node.textContent = message;
  }

  function persistModernRoute() {
    if (!sameFieldSession() || !window.CWFieldRouteCache.same(routeContext) || !routeSnapshot) return false;
    try { routeSnapshot = window.CWFieldRouteCache.update(routeSnapshot, visits, routeContext); return true; }
    catch (error) { showRouteCacheWarning('A ronda não ficou guardada para uso offline. ' + error.message); return false; }
  }

  function protectFieldRouteSession() {
    if (!sameFieldSession()) {
      if (routeSessionBlocked) return;
      for(const url of photoPreviewCache.values())URL.revokeObjectURL(url); photoPreviewCache.clear();
      routeSessionBlocked = true; ++routeRevision; visits = []; index = 0; routeConfirmedAt = null; routeSnapshot = null;
      const main = document.querySelector('main.field'); main.inert = true; main.style.setProperty('display', 'none', 'important');
      const banner = document.createElement('section'); banner.id = 'fieldRouteSessionChanged'; banner.setAttribute('role', 'alert'); banner.style.cssText = 'padding:20px;background:#fff4ce;color:#624400';
      const text = document.createElement('p'); text.textContent = 'A sessão mudou. Os dados guardados foram preservados. Reabra o modo de campo com a conta atual.';
      const link = document.createElement('a'); link.href = '/technician-field-mode'; link.textContent = 'Reabrir modo de campo'; banner.append(text, link); document.body.prepend(banner);
    } else if (routeContext && routeContext.day !== window.CWFieldRouteCache.today()) {
      ++routeRevision; visits = []; index = 0; routeConfirmedAt = null; routeSnapshot = null; routeContext = null;
      loadCurrentDraft(); render(); void load();
    }
  }
  window.addEventListener('storage', protectFieldRouteSession);
  window.addEventListener('pageshow', event => { protectFieldRouteSession(); if (event.persisted && !routeSessionBlocked) void load(); });
  window.setInterval(protectFieldRouteSession, 1000);

  async function load(options = {}) {
    if (!sameFieldSession() || routeSessionBlocked) { protectFieldRouteSession(); return; }
    const revision = ++routeRevision, context = window.CWFieldRouteCache.scope(fieldWriteSession);
    const relevant = () => revision === routeRevision && !routeSessionBlocked && sameFieldSession() && window.CWFieldRouteCache.same(context);
    if (window.CristalAuth && !window.CristalAuth.hydrate()) {
      window.CristalAuth.logout();
      return;
    }
    const role = String(window.CristalAuth?.parseUser?.().role || "").toUpperCase().trim();
    if (role && !["TECHNICIAN", "ADMIN"].includes(role)) {
      window.CristalAuth?.logout();
      return;
    }

    try {
      const fallbackState = readFieldUiState();
      const returnContract = readReturnContract();
      const query = new URLSearchParams({ date: context.day, technicianId: String(context.session.technicianId) });
      let snapshot, failure;
      try {
        const response = await fetch('/api/technician/today?' + query, { headers: { Authorization: 'Bearer ' + context.session.token }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
        if (!relevant()) return;
        const data = await response.json(); if (!relevant()) return;
        if (response.status !== 200) throw Object.assign(Error(data.error || 'Não foi possível confirmar a ronda no servidor.'), { denied: [401,403].includes(response.status) });
        snapshot = window.CWFieldRouteCache.fromResponse(data, context);
      } catch (error) { if (!relevant()) return; failure = error; }
      if (!relevant()) return;
      $("#fieldRouteAge").hidden = true;
      if (snapshot) {
        routeConfirmedAt = snapshot.serverConfirmedAt;
        try { window.CWFieldRouteCache.save(snapshot, context); }
        catch (error) { showRouteCacheWarning('A ronda não ficou guardada para uso offline. ' + error.message); }
      } else {
        routeConfirmedAt = null;
        if (failure?.denied) { visits = []; routeSnapshot = null; routeContext = null; throw failure; }
        snapshot = window.CWFieldRouteCache.read(context);
        if (!snapshot) throw new Error('Sem ronda guardada para esta conta e este dia. Abra o modo de campo com ligação antes de sair.');
        showRouteCacheWarning(`Ronda de ${context.day}, consultada no servidor em ${new Date(snapshot.serverConfirmedAt).toLocaleString('pt-PT')}. Sem confirmação atual; alterações do escritório por verificar.`);
      }
      routeContext = context; routeSnapshot = snapshot; visits = snapshot.visits;
      $("#fieldLoadError").hidden = true;
      const liveState = options.preserveNavigation ? readFieldUiState() : fallbackState;
      const liveContract = options.preserveNavigation ? null : returnContract;
      applyReturnState(liveContract, liveState);
      const oldDrafts = localStorage.getItem(`cwFieldVisitDrafts:${currentTechnicianId()}`);
      $('#fieldDraftHistory').hidden = !oldDrafts || oldDrafts === '{}';
      loadWaterRemindersFromStorage();
      loadCurrentDraft();
      renderWaterReminders();
      scheduleWaterReminders();
      syncTechnicianContextFromVisit(current());
      render();
      const preferredTab = normalizeFieldTab(
        liveContract?.activeTab || liveState?.activeTab || initialOperationalTab(),
        initialOperationalTab()
      );
      switchFieldTab(preferredTab);
      activePoolFilter = readDomActivePoolFilter(activePoolFilter || "TODO");
      const scrollToY = Number.isFinite(Number(returnContract?.scrollY))
        ? Math.max(0, Number(returnContract.scrollY))
        : (Number.isFinite(Number(fallbackState?.scrollY)) ? Math.max(0, Number(fallbackState.scrollY)) : 0);
      if (scrollToY > 0 && !options.preserveNavigation) {
        window.setTimeout(() => {
          window.scrollTo({ top: scrollToY, behavior: "auto" });
        }, 40);
      }
      clearReturnContract();
      stripReturnParamsFromUrl();
      persistFieldUiState();
      await loadGuides(false).catch(() => renderCrewStatus());
      if (!relevant()) return;
      await loadTechnicalProposals(currentPoolId());
    } catch (error) {
      if (!relevant()) return;
      routeConfirmedAt = null;
      $("#fieldLoadError").hidden = false; $("#fieldLoadErrorText").textContent = error.message;
      $("#nextTitle").textContent = "Não foi possível carregar";
      $("#nextMeta").textContent = error.message;
      $("#progressText").textContent = "Verificar ligacao";
      $("#connectionState").textContent = "Offline";
      renderList();
      updateFieldDashboard(null);
      renderCrewStatus();
    }
  }

  function showProblemPanel() {
    const panel = $("#problemPanel");
    if (!panel) return;
    panel.hidden = false;
    $("#problemText")?.focus();
  }

  function hideProblemPanel() {
    const panel = $("#problemPanel");
    if (panel) panel.hidden = true;
  }

  async function saveProblem() {
    const visit = current();
    if (!requireRegularVisit(visit)) return;
    const target = visitKey(visit);
    const category = $("#problemCategory")?.value || "Servico normal";
    const type = $("#problemType")?.value || "Outro";
    const severity = $("#problemSeverity")?.value || "Normal";
    const message = ($("#problemText")?.value || "").trim();
    if (!message) {
      toast("Escreve o problema antes de guardar.");
      return;
    }

    const report = {
      visitId: visit?.id || null,
      pool: visit?.pool?.name || "Piscina",
      client: visit?.client?.name || "Cliente",
      category,
      type,
      severity,
      message,
      createdAt: new Date().toISOString(),
      synced: false,
    };

    const notes = $("#notes");
    if (notes) {
      const line = `${category.toUpperCase()} (${severity} - ${type}): ${message}`;
      notes.value = `${notes.value}\n${line}`.trim();
    }

    const saveButton = $("#saveProblemBtn");
    if (saveButton) saveButton.disabled = true;
    try {
      if (visit?.id) {
        const result = await api(`/api/core/visits/${visit.id}/problem`, {
          method: "POST",
          body: JSON.stringify({ category, type, severity, message }),
        });
        report.synced = true;
        report.repairId = result.repair?.id || null;
        report.alertId = result.alert?.id || null;
      }
    } catch (error) {
      report.syncError = error.message;
    } finally {
      if (saveButton) saveButton.disabled = !isRegularVisit();
    }

    if (!sameFieldSession() || visitKey() !== target) return;
    pendingProblems.unshift(report);
    const saved = JSON.parse(localStorage.getItem("cwFieldProblems") || "[]");
    saved.unshift(report);
    localStorage.setItem("cwFieldProblems", JSON.stringify(saved.slice(0, 50)));

    const text = $("#problemText");
    if (text) text.value = "";
    hideProblemPanel();
    if (report.synced) {
      toast(severity === "Urgente" ? "Problema urgente registado." : "Problema registado.");
    } else {
      toast("Problema nas notas. Sera enviado ao concluir.");
    }
    renderInterruptBoard();
  }

  function savePendingAdminAlert(payload, error) {
    const saved = storageRead("cwPendingAdminAlerts", []);
    saved.unshift({
      ...payload,
      syncError: error?.message || String(error || "Erro de ligacao"),
      savedAt: new Date().toISOString(),
    });
    storageWrite("cwPendingAdminAlerts", saved.slice(0, 50));
  }

  async function sendAdminStockAlert() {
    const visit = current();
    if (!requireRegularVisit(visit)) return;
    const target = visitKey(visit);
    const message = ($("#adminAlertMessage")?.value || "").trim();
    const productName = ($("#stockProductName")?.value || "").trim();
    const quantity = ($("#stockQuantity")?.value || "").trim();
    const unit = ($("#stockUnit")?.value || "").trim();
    const requestType = $("#adminAlertType")?.value || "STOCK_REQUEST";
    const priority = $("#adminAlertPriority")?.value || "NORMAL";

    if (!message && !productName) {
      toast("Escreve o material em falta ou uma nota.");
      return;
    }

    const payload = {
      requestType,
      priority,
      productName,
      quantity,
      unit,
      message: message || `Verificar stock: ${productName}`,
      visitId: visit?.id || null,
      poolId: visit?.pool?.id || null,
      clientId: visit?.client?.id || null,
      poolName: visit?.pool?.name || "",
      clientName: visit?.client?.name || "",
      vehicleId: ($("#vehicleId")?.value || localStorage.getItem("cwVehicleId") || "").trim(),
      technicianId: ($("#technicianId")?.value || localStorage.getItem("cwTechnicianId") || "").trim(),
      createdAt: new Date().toISOString(),
    };

    const button = $("#sendAdminAlertBtn");
    if (button) button.disabled = true;
    try {
      await api("/api/technician/stock-reminders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!sameFieldSession() || visitKey() !== target) return;
      ["adminAlertMessage", "stockProductName", "stockQuantity"].forEach((id) => {
        const node = $(`#${id}`);
        if (node) node.value = "";
      });
      const unitNode = $("#stockUnit");
      if (unitNode) unitNode.value = unit || "";
      toast(priority === "HIGH" ? "Aviso urgente enviado ao admin." : "Aviso enviado ao admin.");
    } catch (error) {
      savePendingAdminAlert(payload, error);
      toast("Sem ligacao. Aviso guardado no telemovel.");
    } finally {
      if (button) button.disabled = !isRegularVisit();
    }
  }

  function addSectionHeader(section, title, hint) {
    if (!section || section.dataset.fieldHeaderReady) return;
    section.dataset.fieldHeaderReady = "1";
    const header = document.createElement("div");
    header.className = "field-tab-title";
    header.innerHTML = `<h2>${esc(title)}</h2><span>${esc(hint)}</span>`;
    section.insertBefore(header, section.firstChild);
  }

  function markFieldSection(selector, panelClass, title, hint) {
    const node = $(selector);
    const section = node?.matches("section") ? node : node?.closest("section");
    if (!section) return null;
    section.classList.add("field-panel", panelClass);
    addSectionHeader(section, title, hint);
    return section;
  }

  function scrollFieldTabIntoView(tab) {
    const panel = document.querySelector(`.field-panel-${tab}`);
    if (!panel) return;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function switchFieldTab(tab, shouldScroll = false) {
    if (tab === "mapa") {
      activePoolFilter = normalizePoolFilter(
        document.querySelector("#poolSegments [data-pool-filter].active")?.dataset?.poolFilter,
        activePoolFilter
      );
      writeLastExplicitFilter(activePoolFilter);
      const contract = buildMapReturnContract();
      persistMapReturnContract(contract);
      persistFieldUiState();
      window.location.href = buildMapRouteFromContract(contract);
      return;
    }

    const safeTab = ["hoje", "agora", "docs", "more"].includes(tab) ? tab : "hoje";
    document.body.dataset.fieldTab = safeTab;
    if ($("#fieldPageTitle")) $("#fieldPageTitle").textContent = {hoje:"O meu dia",agora:"Visita",docs:"Viatura e documentos",more:"Apoio"}[safeTab];
    try {
      localStorage.setItem("cwFieldActiveTab", safeTab);
    } catch (_) {}
    document.querySelectorAll("[data-field-tab-button]").forEach((button) => {
      button.classList.toggle("active", button.dataset.fieldTabButton === safeTab);
      if (button.dataset.fieldTabButton === safeTab) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    persistFieldUiState();
    if (shouldScroll) {
      window.setTimeout(() => scrollFieldTabIntoView(safeTab), 0);
    }
  }

  function updateFieldConnection() {
    const badge = $("#connectionState"); if (!badge) return;
    badge.textContent = navigator.onLine ? "Rede disponível" : "Sem rede";
    badge.dataset.offline = String(!navigator.onLine);
  }
  window.addEventListener("online", updateFieldConnection);
  window.addEventListener("offline", updateFieldConnection);

  function setupFieldLayout() {
    $("#fieldPriorityNotice")?.addEventListener("click", () => {switchFieldTab("hoje"); $("#interruptCard")?.scrollIntoView({block:"start"});});
    $("#fieldReloadBtn")?.addEventListener("click", () => load());
    document.querySelectorAll("[data-field-jump]").forEach(button => button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.fieldJump);
      target?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",block:"start"});
    }));
    document.body.classList.add("cw-tech-field-page");

    markFieldSection("#cleaningCard", "field-panel-agora", "Servico", "limpeza e leituras");
    markFieldSection("#doseRows", "field-panel-agora", "Produtos", "consumo do carro");
    markFieldSection("#photoList", "field-panel-agora", "Fotografias", "registo rapido");
    markFieldSection("#accessCard", "field-panel-agora", "Acesso", "chaves e codigos");
    markFieldSection("#routeCard", "field-panel-hoje", "Rota", "proximo local");
    markFieldSection("#visitList", "field-panel-hoje", "Lista do dia", "corrigir ou avancar");
    markFieldSection(".crew-card", "field-panel-docs", "Tecnico", "viatura e documentos");
    markFieldSection("#transportGuideBox", "field-panel-docs", "Documentos", "AT, obra e seguro");
    markFieldSection("#waterReminderList", "field-panel-more", "Agua aberta", "alarme obrigatorio");
    markFieldSection("#adminAlertMessage", "field-panel-more", "Avisos", "admin e stock");
    markFieldSection("#problemPanel", "field-panel-more", "Extras / problemas", "separado do servico");

    if (!document.querySelector(".field-tabs")) {
      const nav = document.createElement("nav");
      nav.className = "field-tabs";
      nav.setAttribute("aria-label", "Navegacao do tecnico em campo");
      nav.innerHTML = `
        <button type="button" data-field-tab-button="hoje">Hoje</button>
        <button type="button" data-field-tab-button="agora">Visita</button>
        <button type="button" data-field-tab-button="mapa">Mapa</button>
        <button type="button" data-field-tab-button="docs">Viatura</button>
        <button type="button" data-field-tab-button="more">Mais</button>
      `;
      document.body.appendChild(nav);
    }

    document.querySelectorAll("[data-field-tab-button]").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.fieldTabButton;
        switchFieldTab(tab, true);
      });
    });
    document.querySelectorAll("[data-hero-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.heroAction;
        if (action === "refresh") {
          load();
          return;
        }
        if (action === "agenda") {
          window.location.href = "/technician-route";
          return;
        }
        if (action === "openVisit") {
          switchFieldTab("agora", true);
          document.querySelector("#nextTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (action === "continue") {
          switchFieldTab("agora", true);
          document.querySelector("#nowBoard")?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (action === "map") {
          switchFieldTab("mapa", true);
          return;
        }
        if (action === "p0") {
          switchFieldTab("hoje", true);
          document.querySelector("#interruptCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (action === "contact") {
          switchFieldTab("more", true);
          document.querySelector("#adminAlertMessage")?.scrollIntoView({ behavior: "smooth", block: "start" });
          document.querySelector("#adminAlertMessage")?.focus();
        }
      });
    });

    const interruptList = document.querySelector("#interruptList");
    if (interruptList && !interruptList.dataset.actionsReady) {
      interruptList.dataset.actionsReady = "1";
      interruptList.addEventListener("click", (event) => {
        const actionButton = event.target.closest("[data-interrupt-action]");
        if (!actionButton) return;
        const action = actionButton.dataset.interruptAction;
        const exceptionId = actionButton.dataset.exceptionId;
        const exception = collectOperationalExceptions().find((item) => item.id === exceptionId);
        if (action === "assume" && exception) {
          assumeOperationalException(exception);
          return;
        }
        if (action === "confirm" && exception) {
          confirmOperationalException(exception);
          return;
        }
        if (action === "resolve" && exception) {
          resolveOperationalException(exception);
          return;
        }
        if (action === "target") {
          const target = actionButton.dataset.interruptTarget;
          if (!target) return;
          if (target === "problem") {
            switchFieldTab("more", true);
            showProblemPanel();
            return;
          }
          if (target === "docs") {
            switchFieldTab("docs", true);
            document.querySelector("#transportGuideBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          if (target === "water") {
            switchFieldTab("more", true);
            document.querySelector("#waterReminderList")?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          if (target === "hoje") {
            switchFieldTab("hoje", true);
          }
          return;
        }
        if (action === "problem") {
          switchFieldTab("more", true);
          showProblemPanel();
          return;
        }
        if (action === "docs") {
          switchFieldTab("docs", true);
          document.querySelector("#transportGuideBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (action === "water") {
          switchFieldTab("more", true);
          document.querySelector("#waterReminderList")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    const assistPanel = ensureAssistPanel();
    if (assistPanel && !assistPanel.dataset.assistReady) {
      assistPanel.dataset.assistReady = "1";
      assistPanel.addEventListener("click", (event) => {
        const modeButton = event.target.closest("[data-assist-mode]");
        if (modeButton) {
          showAssistMode(modeButton.dataset.assistMode);
          return;
        }
        const visitButton = event.target.closest("[data-assist-visit]");
        if (visitButton) {
          openAssistVisit(visitButton.dataset.assistVisit, visitButton.dataset.assistSource, visitButton.dataset.assistType);
        }
      });
    }

    const segments = document.querySelector("#poolSegments");
    if (segments && !segments.dataset.eventsReady) {
      segments.dataset.eventsReady = "1";
      segments.addEventListener("click", (event) => {
        const button = event.target.closest("[data-pool-filter]");
        if (!button) return;
        activePoolFilter = normalizePoolFilter(button.dataset.poolFilter, "TODO");
        writeLastExplicitFilter(activePoolFilter);
        renderList();
        persistFieldUiState();
      });
    }

    // Keep a visual default without persisting, so load() can restore return contract state.
    document.body.dataset.fieldTab = "hoje";
    document.querySelectorAll("[data-field-tab-button]").forEach((button) => {
      button.classList.toggle("active", button.dataset.fieldTabButton === "hoje");
    });
  }

  setupFieldLayout();

  if (!window.__cwFieldBeforeUnloadBound) {
    window.__cwFieldBeforeUnloadBound = true;
    window.addEventListener("beforeunload", () => {
      persistFieldUiState();
    });
    window.addEventListener("pageshow", () => {
      window.setTimeout(() => {
        persistFieldUiState();
      }, 0);
    });
  }

  const startBtn = $("#startBtn");
  if (startBtn) {
    startBtn.onclick = async () => {
      const visit = current();
      if (!visit) {
        showAssistMode("help");
        return;
      }
      if (!requireExecutableVisit(visit) || startingVisits.has(visitKey(visit))) return;
      if (isVisitDone(visit)) {
        switchFieldTab("agora");
        loadCurrentDraft();
        toast("Registo aberto para corrigir.");
        return;
      }
      if (docsCompliance && !docsCompliance.readyForOperation) {
        switchFieldTab("docs", true);
        document.querySelector("#documentCenterBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
        toast(docsCompliance.reason || "Bloqueio operacional: faltam documentos obrigatórios da viatura.");
        return;
      }
      startedAt = new Date();
      if (!navigator.onLine && isRegularVisit(visit)) {
        visits[index] = mergeVisitSnapshot(visit, { startAt: startedAt.toISOString() }, "IN_PROGRESS");
        saveCurrentDraft();
        const saved = persistModernRoute();
        render();
        toast(saved ? "Visita iniciada neste dispositivo. O registo será enviado ao concluir com ligação." : "Início apenas em memória: a ronda não ficou guardada. Não feche a página.");
        return;
      }
      startBtn.disabled = true;
      const target = visitKey(visit);
      startingVisits.add(target);
      try {
        const result = visit.visitType === 'EXTRA' ? await window.CWFieldOffline.submitExtraStart(visit,fieldWriteSession) : await api(`/api/operational-state/visits/${visit.id}/state`, {
          method: "POST",
          body: JSON.stringify({
            state: "IN_PROGRESS",
            visitType: 'REGULAR',
            poolId: visit.poolId || visit.pool?.id,
          }),
        });
        if (!sameFieldSession()) return;
        const confirmed = result.visit;
        if (result.ok !== true || confirmed?.id !== visit.id || confirmed.poolId !== (visit.poolId || visit.pool?.id) || confirmed.technicianId !== fieldWriteSession.technicianId || !['IN_PROGRESS','STARTED','EM_EXECUCAO'].includes(confirmed.status) || !Number.isFinite(Date.parse(confirmed.startAt)) || confirmed.endAt) throw Error('A resposta não confirma o início desta visita. Atualize a rota.');
        const position = visits.findIndex(row=>visitKey(row)===target);
        if (position < 0) return;
        visits[position] = mergeVisitSnapshot(visits[position], confirmed, 'IN_PROGRESS');
        if (visitKey() === target) { startedAt = new Date(confirmed.startAt); saveCurrentDraft(); }
        persistModernRoute();
        render();
        toast(`${visit.pool?.name || 'Piscina'}: início confirmado.`);
      } catch (error) {
        if (sameFieldSession()) toast(error.message || "Nao foi possivel iniciar visita.");
      } finally {
        startingVisits.delete(target);
        if (sameFieldSession()) startBtn.disabled = (current()?.visitType === 'EXTRA' && isVisitDone(current())) || startingVisits.has(visitKey());
      }
    };
  }

  const problemBtn = $("#problemBtn");
  if (problemBtn) problemBtn.onclick = showProblemPanel;

  const saveProblemBtn = $("#saveProblemBtn");
  if (saveProblemBtn) saveProblemBtn.onclick = saveProblem;

  const cancelProblemBtn = $("#cancelProblemBtn");
  if (cancelProblemBtn) cancelProblemBtn.onclick = hideProblemPanel;

  const loadGuidesBtn = $("#loadGuidesBtn");
  if (loadGuidesBtn) loadGuidesBtn.onclick = () => loadGuides(true);

  const refreshCrewStatus = $("#refreshCrewStatus");
  if (refreshCrewStatus) refreshCrewStatus.onclick = () => loadGuides(true);

  const submitTechnicalProposalBtn = $("#submitTechnicalProposalBtn");
  if (submitTechnicalProposalBtn) {
    submitTechnicalProposalBtn.onclick = async () => {
      try {
        await submitTechnicalProposal();
      } catch (error) {
        const status = $("#technicalProposalStatus");
        if (status) status.textContent = error.message || "Erro ao submeter proposta.";
        toast(error.message || "Erro ao submeter proposta.");
      }
    };
  }

  document.querySelectorAll("[data-photo-type]").forEach((button) => {
    button.addEventListener("click", () => pickPhoto(button.dataset.photoType));
  });

  for(const id of ['photoInput','galleryPhotoInput']){
    const input = $(`#${id}`);
    input?.addEventListener('change', () => { const selection = selectedPhotoContext; selectedPhotoContext = null; Array.from(input.files || []).forEach(file => addSelectedPhoto(file, selection)); });
    input?.addEventListener('cancel', () => photoFeedback('Nenhuma fotografia adicionada. Pode tentar novamente ou escolher uma fotografia guardada.'));
  }
  $('#galleryPhotoBtn')?.addEventListener('click', () => pickPhoto($('#galleryPhotoType').value, true));

  const syncPhotosBtn = $("#syncPhotosBtn");
  if (syncPhotosBtn) syncPhotosBtn.onclick = () => syncPendingPhotos(true);

  const openWaterBtn = $("#openWaterBtn");
  if (openWaterBtn) openWaterBtn.onclick = createWaterReminder;

  const sendAdminAlertBtn = $("#sendAdminAlertBtn");
  if (sendAdminAlertBtn) sendAdminAlertBtn.onclick = sendAdminStockAlert;

  const addDoseBtn = $("#addDoseBtn");
  if (addDoseBtn) addDoseBtn.onclick = ensureDoseRow;

  const refreshDoseStockBtn = $("#refreshDoseStockBtn");
  if (refreshDoseStockBtn) refreshDoseStockBtn.onclick = () => loadGuides(true);

  const doseRows = $("#doseRows");
  if (doseRows) {
    doseRows.addEventListener("input", (event) => {
      const row = event.target.closest("[data-dose-id]");
      const field = event.target.dataset.doseField;
      if (!row || !field) return;
      const item = usedProducts.find((product) => product.localId === row.dataset.doseId);
      if (!item) return;
      item[field] = event.target.value;
      saveCurrentDraft();
    });
    doseRows.addEventListener("change", (event) => {
      const row = event.target.closest("[data-dose-id]");
      const field = event.target.dataset.doseField;
      if (!row || !field) return;
      updateDoseRow(row.dataset.doseId, field, event.target.value);
    });
    doseRows.addEventListener("click", (event) => {
      const id = event.target.dataset.doseRemove;
      if (!id) return;
      removeDoseRow(id);
    });
  }

  ["ph", "chlorine", "alkalinity", "orp"].forEach((id) => {
    const input = $(`#${id}`);
    if (input) input.addEventListener("input", () => updateReferenceStatus(input));
  });

  // Persist field draft while typing so browser refresh does not lose in-progress notes/measurements.
  draftFieldIds.forEach((id) => {
    const input = $(`#${id}`);
    if (!input) return;
    input.addEventListener("input", () => saveCurrentDraft());
  });

  checkIds.forEach((id) => {
    const input = $(`#${id}`);
    if (!input) return;
    input.addEventListener("change", () => saveCurrentDraft());
  });

  const finishBtn = $("#finishBtn");
  if (finishBtn) {
    finishBtn.onclick = async () => {
      if (!sameFieldSession()) { toast('A sessão mudou. Reabra a página com a conta original.'); return; }
      const visit = current();
      if (!visit) {
        showAssistMode("tomorrow");
        return;
      }
      if(visit.visitType==='EXTRA'&&isVisitDone(visit)){await window.CWExtraVisitCorrection.open(visit,fieldWriteSession);return;}
      if (!requireExecutableVisit(visit)) return;
      const target = visitKey(visit);
      const wasDone = isVisitDone(visit);
      const draftEntry = currentDraftEntry;
      if (draftEntry?.submitting) return;
      await saveCurrentDraft();
      if (!sameFieldSession() || visitKey() !== target) return;
      if (draftEntry.error || draftEntry.external || Object.keys(draftEntry.conflicts).length || draftEntry.request) { visitDraftManager.paint(draftEntry);toast($('#fieldSaveStatus').textContent);return; }
      try { readFieldDrafts(); } catch (error) { toast(error.message); return; }
      if (!wasDone && docsCompliance && !docsCompliance.readyForOperation) {
        switchFieldTab("docs", true);
        document.querySelector("#documentCenterBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
        toast(docsCompliance.reason || "Bloqueio operacional: faltam documentos obrigatórios da viatura.");
        return;
      }
      draftEntry.submitting = true;
      visitDraftManager.paint(draftEntry);
      try {
      $("#finishBtn").disabled = true;
      const photosReady = await syncPendingPhotos(false);
      if (!sameFieldSession() || visitKey(current()) !== visitKey(visit)) { finishBtn.disabled = current()?.visitType === 'EXTRA' && isVisitDone(current()); return; }
      if (!photosReady && navigator.onLine) {
        $("#finishBtn").disabled = false;
        toast("Ha fotografias pendentes. Sincroniza ou remove antes de concluir.");
        return;
      }

      const productsUsed = normalizedUsedProducts();
      if (!wasDone) {
        try {
          await validateUsedProducts(productsUsed);
        } catch (validationError) {
          $("#finishBtn").disabled = false;
          toast(validationError.message);
          return;
        }
      }

      const productsPayload = productsUsed.map((product) => ({
        name: product.name,
        quantity: product.quantity,
        unit: product.unit,
        notes: product.notes,
      }));

      if (!sameFieldSession() || visitKey(current()) !== visitKey(visit)) { finishBtn.disabled = current()?.visitType === 'EXTRA' && isVisitDone(current()); return; }

      const body = {
        cleaned: $("#cleaned").checked,
        vacuumed: $("#vacuumed")?.checked || false,
        basketCleaned: $("#basketCleaned").checked,
        brushed: $("#brushed").checked,
        waterlineClean: $("#waterlineClean")?.checked || false,
        backwashDone: $("#backwashDone").checked,
        ph: $("#ph").value,
        chlorine: $("#chlorine").value,
        alkalinity: $("#alkalinity").value,
        salt: $("#salt").value,
        orp: $("#orp").value,
        temperature: $("#temperature").value,
        notes: $("#notes").value,
        problem: pendingProblems.filter((problem) => !problem.synced).map((problem) => `${problem.category || "Servico normal"} - ${problem.type}: ${problem.message}`).join("\n") || undefined,
        problemCategory: pendingProblems.some((problem) => problem.category === "Extra / reparacao") ? "Extra / reparacao" : undefined,
        priority: pendingProblems.some((problem) => problem.severity === "Urgente") ? "HIGH" : "NORMAL",
        startedAt,
        completedAt: new Date(),
        performedByTechnicianId: currentTechnicianId() || undefined,
        performedByTechnicianName: activeTechnician?.name || undefined,
        vehicleId: ($("#vehicleId")?.value || localStorage.getItem("cwVehicleId") || "").trim() || undefined,
        workGuideId: activeWorkGuide?.id || undefined,
        products: wasDone ? JSON.stringify(productsPayload) : (productsPayload.length ? JSON.stringify(productsPayload) : undefined),
        photos: visitPhotos
          .filter((photo) => photo.url)
          .map((photo) => ({ url: photo.url, type: photo.type || "AFTER" })),
      };

      try {
        if (wasDone) {
          await saveCurrentDraft();
          const result = await visitDraftManager.prepare(draftEntry,()=>api(`/api/technician/visits/${visit.id}/correction`, {
            method: "PATCH",
            body: JSON.stringify(body),
          }));
          if (!sameFieldSession()) return;
          if (result.visit?.id !== visit.id || result.visit?.poolId !== (visit.poolId || visit.pool?.id)) throw Error('A resposta não confirma a correção desta visita. Atualize a rota.');
          const updatedVisit = {
            ...visit,
            ...(result.visit || {}),
            status: "DONE",
            pool: {
              ...(visit.pool || {}),
              ...((result.visit || {}).pool || {}),
            },
            client: (result.visit || {}).client || (result.visit || {}).pool?.client || visit.client,
            technician: {
              ...(visit.technician || {}),
              ...((result.visit || {}).technician || {}),
            },
          };
          const position = visits.findIndex(row=>visitKey(row)===target);
          if (position >= 0) visits[position] = updatedVisit;
          await visitDraftManager.acceptCorrection(draftEntry,savedVisitDraft(updatedVisit));
          if (!sameFieldSession()) return;
          if (visitKey() === target) loadCurrentDraft();
          persistModernRoute();
          render();
          toast(`${visit.pool?.name || 'Piscina'}: correção guardada e stock reconciliado.`);
          $("#finishBtn").disabled = current()?.visitType === 'EXTRA' && isVisitDone(current());
          return;
        }

        // These fields are server-derived or already stored through the photo contract.
        const { startedAt: ignoredStart, completedAt: ignoredEnd, performedByTechnicianId: ignoredActor, performedByTechnicianName: ignoredName, photos: ignoredPhotos, problemCategory: ignoredCategory, ...completionBody } = body;
        await saveCurrentDraft();
        const prepared = await visitDraftManager.prepare(draftEntry,()=>window.CWFieldOffline.prepareCompletion(visit.id, visit.visitType === 'EXTRA' ? {...completionBody,visitType:'EXTRA',poolId:visit.poolId || visit.pool?.id} : completionBody, fieldWriteSession, visit.visitType || 'REGULAR'));
        const completeResult = await window.CWFieldOffline.sendPreparedCompletion(prepared,fieldWriteSession);
        if (!sameFieldSession()) return;
        // Stock is consumed atomically by the completion transaction on the server.
        const stockUpdated = productsUsed.length > 0;
        if (stockUpdated) await loadGuides(false).catch(() => {});
        if (!sameFieldSession()) return;
        const completedVisit = mergeVisitSnapshot(visit, completeResult.visit || {}, "DONE");
        completedVisit.status = "DONE";
        completedVisit.endAt = completeResult.visit?.endAt || completedVisit.endAt || new Date().toISOString();
        const position = visits.findIndex(row=>visitKey(row)===target);
        if (position >= 0) visits[position] = completedVisit;
        persistModernRoute();
        toast(`${visit.pool?.name || 'Piscina'}: ${stockUpdated ? 'visita concluída e stock atualizado.' : 'visita concluída.'}`);
        if (visitKey() === target && position >= 0) {
          index = nextPendingIndex(position);
          loadCurrentDraft();
        }
        render();
      } catch (error) {
        if (sameFieldSession()) { $("#finishBtn").disabled = current()?.visitType === 'EXTRA' && isVisitDone(current()); visitDraftManager.paint(currentDraftEntry);toast(error.message); }
      }
      } finally { draftEntry.submitting=false; if(sameFieldSession())visitDraftManager.paint(currentDraftEntry); }
    };
  }

  window.addEventListener('cw:visit-synced', event => {
    if (!sameFieldSession() || event.detail.owner !== fieldWriteSession.owner || event.detail.token !== fieldWriteSession.token) return;
    const position = visits.findIndex(v => (v.visitType || 'REGULAR') === (event.detail.visitType || 'REGULAR') && String(v.id) === String(event.detail.visitId));
    if (position >= 0 && !(isVisitDone(visits[position]) && event.detail.visit.status === 'IN_PROGRESS')) visits[position] = mergeVisitSnapshot(visits[position], event.detail.visit, event.detail.visit.status);
    persistModernRoute();
    render();
  });
  window.addEventListener('cw:extra-correction-confirmed',event=>{if(sameFieldSession()&&event.detail.owner===fieldWriteSession.owner&&event.detail.token===fieldWriteSession.token)void load();});
  window.addEventListener('cw:water-state-updated', () => { loadWaterRemindersFromStorage(); renderWaterReminders(); scheduleWaterReminders(); renderList(); renderNowBoard(current()); });
  function renderIncompleteStatus(){void window.CWFieldIncomplete?.refresh();}
  window.addEventListener('cw:incomplete-confirmed',event=>{if(sameFieldSession()&&event.detail.owner===fieldWriteSession.owner&&event.detail.token===fieldWriteSession.token)void load({preserveNavigation:true});});
  void load();
  updateAllReferenceStatuses();
})();
