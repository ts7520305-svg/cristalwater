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
  let index = 0;
  let startedAt = null;
  let pendingProblems = [];
  let selectedPhotoType = "AFTER";
  let visitPhotos = [];
  let visitDrafts = {};
  let visitPhotosByKey = {};
  let waterReminders = [];
  let usedProducts = [];
  let activeWorkGuide = null;
  let activeWorkStock = [];
  let activeTransportGuide = null;
  let activeInsurance = null;
  let activeVehicle = null;
  let activeTechnician = null;
  let assistOptions = { loading: false, loadedKey: "", otherToday: [], tomorrow: [], error: "" };
  let notifiedVisitNoticeKey = "";
  const waterTimers = new Map();
  const draftFieldIds = ["ph", "chlorine", "alkalinity", "salt", "orp", "temperature", "notes"];
  const checkIds = ["cleaned", "vacuumed", "basketCleaned", "brushed", "waterlineClean", "backwashDone"];

  async function api(path, options = {}) {
    const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || data.message || "Erro no servidor");
    return data;
  }

  async function apiForm(path, formData) {
    const response = await fetch(path, { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || data.message || "Erro no servidor");
    return data;
  }

  function current() {
    return visits[index] || null;
  }

  function visitKey(visit = current()) {
    return visit?.id ? `visit-${visit.id}` : "visit-none";
  }

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
    } catch (_) {}
  }

  function waterReminderStorageKey(technicianId = currentTechnicianId()) {
    return `cwWaterReminders:${String(technicianId || "sem-tecnico").trim() || "sem-tecnico"}`;
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
      if (node) node.value = values[id] || "";
    });

    const checks = draft?.checks || {};
    checkIds.forEach((id) => {
      const node = $(`#${id}`);
      if (!node) return;
      node.checked = Object.prototype.hasOwnProperty.call(checks, id)
        ? Boolean(checks[id])
        : ["cleaned", "basketCleaned"].includes(id);
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
      type: photo?.type || "AFTER",
      fileName: photo?.fileName || `Foto ${photo?.id || itemIndex + 1}`,
      previewUrl: photo?.url || "",
      url: photo?.url || "",
      status: "uploaded",
      error: "",
      serverId: photo?.id || null,
    })).filter((photo) => photo.url);
  }

  function applySavedVisitData(visit) {
    applyVisitForm({
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
    });
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
    const visit = current();
    if (!visit?.id) return;
    const key = visitKey(visit);
    visitPhotosByKey[key] = visitPhotos;
    visitDrafts[key] = readVisitForm();
    storageWrite("cwFieldVisitDrafts", visitDrafts);
  }

  function loadCurrentDraft() {
    const visit = current();
    if (isVisitDone(visit)) {
      applySavedVisitData(visit);
      return;
    }
    const key = visitKey(visit);
    const draft = visitDrafts[key] || null;
    applyVisitForm(draft);
    visitPhotos = visitPhotosByKey[key] || (draft?.photos || []);
    renderPhotoList();
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
    const address = pool.address || pool.location || client.address || pool.zone || "";
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

  function syncTechnicianContextFromVisit(visit) {
    const technician = visit?.technician || visits.find((item) => item.technician?.id || item.technician?.name)?.technician || null;
    if (technician) activeTechnician = technician;

    const vehicle = technician?.vehicle || activeWorkGuide?.vehicle || activeTransportGuide?.vehicle || activeVehicle || null;
    if (vehicle) activeVehicle = vehicle;

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
    const atOk = guideHasTransportReference();
    const workOk = Boolean(activeWorkGuide?.id);
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
  }

  function currentTechnicianId() {
    const fromQuery = new URLSearchParams(location.search).get("technicianId") || "";
    const fromInput = $("#technicianId")?.value || "";
    const fromStorage = localStorage.getItem("cwTechnicianId") || "";
    const fromActive = activeTechnician?.id ? String(activeTechnician.id) : "";
    return String(fromQuery || fromInput || fromStorage || fromActive || "").trim();
  }

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

  function updateFieldDashboard(visit) {
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

    if (docsValue) docsValue.textContent = `${readyDocs} / 2`;
    if (docsMeta) docsMeta.textContent = docsReady ? "AT e guia de obra prontas" : "ver luzes AT/obra";

    if (photosValue) photosValue.textContent = `${photoCount} foto${photoCount === 1 ? "" : "s"}`;
    if (photosMeta) photosMeta.textContent = photoCount ? "registos prontos para sincronizar" : "sem fotos nesta visita";

    setTileTone("#fieldProgressTile", pending ? "" : "ok");
    setTileTone("#fieldDocsTile", docsReady ? "ok" : "warn");
    setTileTone("#fieldPhotosTile", photoCount ? "ok" : "");
    renderCrewStatus();
  }

  function mapsSearchUrl(visit) {
    const location = visitLocation(visit);
    if (location.lat && location.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.lat},${location.lng}`)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.label)}`;
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
      title.textContent = "Sem proximo servico";
      summary.textContent = "A ronda nao tem mais piscinas pendentes.";
      mapBox.innerHTML = '<div class="map-fallback">Ronda concluida.</div>';
      meta.innerHTML = "";
      navLink.href = "#";
      mapsLink.href = "#";
      return;
    }

    const location = visitLocation(visit);
    const poolName = visit.pool?.name || "Piscina";
    const clientName = visit.client?.name || "Cliente";
    title.textContent = poolName;
    summary.textContent = `${clientName} - ${visit.status || "Pendente"}`;
    navLink.href = navigationUrl(visit);
    mapsLink.href = mapsSearchUrl(visit);

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
          A navegacao abre pela morada/zona registada.
        </div>
      </div>
    `;
    meta.innerHTML = `<span>${esc(location.address || "Morada ou zona por confirmar")}</span>`;
  }

  function readingNumber(value) {
    const number = Number(String(value || "").replace(",", ".").trim());
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
    return `<a class="doc-btn" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
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

  function reminderIsPermanent(reminder) {
    const text = `${reminder?.title || ""} ${reminder?.description || ""} ${reminder?.category || ""}`.toLowerCase();
    const repeat = String(reminder?.repeatRule || "").trim();
    return Boolean(repeat && repeat !== "NONE") || text.includes("permanente") || text.includes("permanent");
  }

  function normalizeReminder(reminder, source, model) {
    const due = reminder?.dueDate || reminder?.dueAt || null;
    const dueDate = due ? new Date(due) : null;
    const hasValidDue = dueDate && !Number.isNaN(dueDate.getTime());
    const permanent = reminderIsPermanent(reminder);
    const overdue = hasValidDue && dueDate < new Date() && !permanent;
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
      permanent,
      overdue,
      label: overdue ? "Lembrete atrasado" : (permanent ? "Lembrete permanente" : "Lembrete temporario")
    };
  }

  function visibleReminders(visit) {
    const reminders = [
      ...listOf(visit?.pool?.operationalReminders).map((reminder) => normalizeReminder(reminder, "Piscina", "operational")),
      ...listOf(visit?.client?.operationalReminders).map((reminder) => normalizeReminder(reminder, "Cliente", "operational")),
      ...listOf(visit?.pool?.client?.operationalReminders).map((reminder) => normalizeReminder(reminder, "Cliente", "operational")),
      ...listOf(visit?.pool?.generalReminders).map((reminder) => normalizeReminder(reminder, "Piscina", "general")),
      ...listOf(visit?.client?.generalReminders).map((reminder) => normalizeReminder(reminder, "Cliente", "general")),
      ...listOf(visit?.pool?.client?.generalReminders).map((reminder) => normalizeReminder(reminder, "Cliente", "general"))
    ].filter((reminder) => reminder && reminder.title);

    return uniqueByKey(reminders, (reminder) => (
      `${reminder.model}:${reminder.source}:${reminder.id || ""}:${reminder.title}:${reminder.due || ""}`
    ));
  }

  function reminderClass(reminder) {
    if (reminder.overdue) return "reminder-overdue";
    return reminder.permanent ? "reminder-permanent" : "reminder-temporary";
  }

  function renderVisitNoticeStrip(visit, accesses, reminders) {
    const strip = $("#visitNoticeStrip");
    const nextCard = document.querySelector(".next");
    if (!strip) return;

    const hasNotices = Boolean(visit && (accesses.length || reminders.length));
    if (nextCard) nextCard.classList.toggle("has-alerts", hasNotices);
    if (!hasNotices) {
      strip.hidden = true;
      strip.innerHTML = "";
      return;
    }

    const pills = [
      accesses.length ? `<span class="visit-notice-pill access">${accesses.length} acesso(s)</span>` : "",
      reminders.length ? `<span class="visit-notice-pill reminder">${reminders.length} lembrete(s)</span>` : ""
    ].filter(Boolean).join("");

    strip.hidden = false;
    strip.innerHTML = `
      <b>Atencao antes de entrar</b>
      <div class="visit-notice-pills">${pills}</div>
      <small>Confirma codigos, chaves e instrucoes desta piscina antes de iniciar ou concluir a visita.</small>
    `;
  }

  function maybeNotifyVisitNotices(visit, accesses, reminders) {
    const total = accesses.length + reminders.length;
    if (!visit || !total) {
      notifiedVisitNoticeKey = "";
      return;
    }
    const key = `${visitKey(visit)}:${accesses.length}:${reminders.length}`;
    if (notifiedVisitNoticeKey === key) return;
    notifiedVisitNoticeKey = key;
    toast(`Atencao: esta visita tem ${total} aviso(s) de acesso ou lembrete.`);
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
    const hasNotices = accesses.length || reminders.length;
    card.hidden = false;
    card.classList.toggle("has-alerts", Boolean(hasNotices));
    renderVisitNoticeStrip(visit, accesses, reminders);
    maybeNotifyVisitNotices(visit, accesses, reminders);

    if (!hasNotices) {
      list.innerHTML = `
        <div class="access-item">
          <div class="access-code">Sem codigo ou lembrete registado</div>
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
          <span class="chip">${esc(reminder.label)} - ${esc(reminder.source)}</span>
          <div class="access-code">${esc(reminder.title)}</div>
          <div class="access-meta">${meta}</div>
        </div>
      `;
    }).join("");

    list.innerHTML = `${accessHtml}${reminderHtml}`;
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
        <img class="photo-thumb" src="${esc(photo.previewUrl || photo.url || "")}" alt="Fotografia ${esc(photoTypeLabel(photo.type))}">
        <div class="photo-meta">
          <strong>${esc(photoTypeLabel(photo.type))}</strong>
          <span class="photo-status ${photo.status === "uploaded" ? "ok" : "warn"}">${esc(photoStatusText(photo))}</span>
          <span class="muted">${esc(photo.fileName || "Foto do servico")}</span>
          <div class="photo-mini">
            ${photo.status !== "uploaded" ? `<button type="button" data-photo-retry="${esc(photo.localId)}">Enviar</button>` : ""}
            <button type="button" data-photo-remove="${esc(photo.localId)}">Remover</button>
          </div>
        </div>
      </div>
    `).join("");

    list.querySelectorAll("[data-photo-retry]").forEach((button) => {
      button.addEventListener("click", () => {
        const photo = visitPhotos.find((item) => item.localId === button.dataset.photoRetry);
        if (photo) uploadPhoto(photo);
      });
    });

    list.querySelectorAll("[data-photo-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const photo = visitPhotos.find((item) => item.localId === button.dataset.photoRemove);
        if (photo?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
        visitPhotos = visitPhotos.filter((item) => item.localId !== button.dataset.photoRemove);
        renderPhotoList();
      });
    });
  }

  async function uploadPhoto(photo) {
    const visit = current();
    if (!visit?.id || !photo?.file) {
      photo.status = "pending";
      photo.error = "Sem visita ativa";
      renderPhotoList();
      return false;
    }

    photo.status = "uploading";
    photo.error = "";
    renderPhotoList();

    try {
      const formData = new FormData();
      formData.append("photo", photo.file);
      formData.append("type", photo.type || "AFTER");
      const data = await apiForm(`/api/visits/${encodeURIComponent(visit.id)}/photo`, formData);
      photo.status = "uploaded";
      photo.url = data.photo?.url || photo.url;
      photo.serverId = data.photo?.id || null;
      renderPhotoList();
      return true;
    } catch (error) {
      photo.status = "pending";
      photo.error = error.message;
      renderPhotoList();
      return false;
    }
  }

  async function syncPendingPhotos(showFeedback = true) {
    const pending = visitPhotos.filter((photo) => photo.status !== "uploaded");
    if (!pending.length) {
      if (showFeedback) toast("Fotografias ja sincronizadas.");
      return true;
    }

    for (const photo of pending) {
      await uploadPhoto(photo);
    }

    const stillPending = visitPhotos.some((photo) => photo.status !== "uploaded");
    if (showFeedback) {
      toast(stillPending ? "Ainda existem fotos pendentes." : "Fotografias sincronizadas.");
    }
    return !stillPending;
  }

  function pickPhoto(type) {
    const input = $("#photoInput");
    if (!input) return;
    selectedPhotoType = type || "AFTER";
    input.value = "";
    input.click();
  }

  function addSelectedPhoto(file) {
    if (!file) return;
    const photo = {
      localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: selectedPhotoType || "AFTER",
      file,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
      error: "",
    };
    visitPhotos.unshift(photo);
    renderPhotoList();
    uploadPhoto(photo);
  }

  function activeWaterReminders() {
    return waterReminders.filter((reminder) => reminder.status !== "CLOSED" && reminderBelongsToCurrentContext(reminder));
  }

  function saveWaterReminders() {
    waterReminders = waterReminders.filter(reminderBelongsToCurrentContext).slice(-100);
    storageWrite(waterReminderStorageKey(), waterReminders);
  }

  function reminderBelongsToCurrentContext(reminder = {}) {
    const technicianId = currentTechnicianId();
    if (technicianId && reminder.technicianId && String(reminder.technicianId) !== String(technicianId)) return false;

    const poolIds = new Set(visits.map((visit) => String(visit.pool?.id || visit.poolId || "")).filter(Boolean));
    const clientIds = new Set(visits.map((visit) => String(visit.client?.id || visit.clientId || visit.pool?.client?.id || "")).filter(Boolean));

    if (reminder.poolId && poolIds.size && !poolIds.has(String(reminder.poolId))) return false;
    if (reminder.clientId && clientIds.size && !clientIds.has(String(reminder.clientId))) return false;

    return true;
  }

  function loadWaterRemindersFromStorage() {
    const scoped = storageRead(waterReminderStorageKey(), null);
    const legacy = storageRead("cwWaterReminders", []);
    const source = Array.isArray(scoped) ? scoped : (Array.isArray(legacy) ? legacy : []);
    waterReminders = source.filter(reminderBelongsToCurrentContext).slice(-100);
    storageWrite(waterReminderStorageKey(), waterReminders);
  }

  function waterReminderLabel(reminder) {
    const due = new Date(reminder.dueAt);
    if (Number.isNaN(due.getTime())) return "Hora por confirmar";
    const now = new Date();
    if (reminder.status === "OVERDUE") return `Alerta enviado - previsto ${formatDate(due)}`;
    if (due <= now && reminder.status !== "CLOSED") return `Atrasado desde ${formatDate(due)}`;
    return `Lembrar em ${formatDate(due)}`;
  }

  function waterReminderSyncBadge(reminder) {
    if (reminder.syncError) return '<span class="chip" style="background:rgba(255,107,107,.18);border-color:rgba(255,107,107,.5);color:#ffd0d0">Nao sincronizado</span>';
    if (reminder.serverId) return '<span class="chip" style="background:rgba(51,209,122,.16);border-color:rgba(51,209,122,.5);color:#9affc6">Registado</span>';
    return '<span class="chip" style="background:rgba(255,209,102,.16);border-color:rgba(255,209,102,.45);color:#ffd166">A sincronizar</span>';
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
    const active = activeWaterReminders().sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    if (!active.length) {
      list.innerHTML = '<div class="muted">Sem lembretes de agua aberta.</div>';
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
              ${reminder.syncError ? `<div class="muted" style="color:#ffd0d0">Erro: ${esc(reminder.syncError)}</div>` : ""}
            </div>
            <div style="display:grid;gap:6px;justify-items:end">
              <span class="chip">${overdue ? "ALARME" : "Aberta"}</span>
              ${waterReminderSyncBadge(reminder)}
            </div>
          </div>
          <div class="doc-number" style="font-size:18px">${esc(waterReminderLabel(reminder))}</div>
          <div class="water-actions">
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
  }

  function clearWaterTimer(localId) {
    const timer = waterTimers.get(localId);
    if (timer) clearTimeout(timer);
    waterTimers.delete(localId);
  }

  function scheduleWaterReminder(reminder) {
    if (!reminder?.localId || reminder.status === "CLOSED") return;
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

  function waterDueFromInputs() {
    const minutesRaw = ($("#waterMinutes")?.value || "").trim();
    const timeRaw = ($("#waterCloseTime")?.value || "").trim();
    const minutes = Number(minutesRaw.replace(",", "."));

    if (Number.isFinite(minutes) && minutes > 0) {
      return {
        dueAt: new Date(Date.now() + minutes * 60 * 1000),
        label: `${Math.round(minutes)} min`,
        mode: "MINUTES",
      };
    }

    if (timeRaw) {
      const [hour, minute] = timeRaw.split(":").map(Number);
      if (Number.isFinite(hour) && Number.isFinite(minute)) {
        const due = new Date();
        due.setHours(hour, minute, 0, 0);
        if (due <= new Date()) due.setDate(due.getDate() + 1);
        return {
          dueAt: due,
          label: due.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
          mode: "CLOCK",
        };
      }
    }

    return null;
  }

  async function createWaterReminder() {
    const visit = current();
    if (!visit) {
      toast("Seleciona uma piscina primeiro.");
      return;
    }

    const due = waterDueFromInputs();
    if (!due) {
      toast("Indica os minutos ou a hora para fechar a agua.");
      return;
    }

    const location = visitLocation(visit);
    const reminder = {
      localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status: "OPEN",
      alerted: false,
      visitId: visit.id || null,
      poolId: visit.pool?.id || null,
      clientId: visit.client?.id || null,
      poolName: visit.pool?.name || "Piscina",
      clientName: visit.client?.name || "Cliente",
      location: location.address || visit.pool?.zone || "",
      technicianId: currentTechnicianId() || visit.technician?.id || null,
      technicianName: activeTechnician?.name || visit.technician?.name || "",
      dueAt: due.dueAt.toISOString(),
      reminderMode: due.mode,
      note: ($("#waterNote")?.value || "").trim(),
      createdAt: new Date().toISOString(),
    };

    waterReminders.push(reminder);
    saveWaterReminders();
    renderWaterReminders();
    scheduleWaterReminder(reminder);
    const waterMinutes = $("#waterMinutes");
    const waterCloseTime = $("#waterCloseTime");
    const waterNote = $("#waterNote");
    if (waterMinutes) waterMinutes.value = "";
    if (waterCloseTime) waterCloseTime.value = "";
    if (waterNote) waterNote.value = "";

    try {
      const data = await api("/api/technician/water-reminders", {
        method: "POST",
        body: JSON.stringify(reminder),
      });
      reminder.serverId = data.reminder?.id || data.id || null;
      reminder.notificationId = data.notification?.id || null;
      reminder.syncError = "";
      reminder.syncedAt = new Date().toISOString();
      saveWaterReminders();
      renderWaterReminders();
      toast(`Agua aberta registada no sistema para ${due.label}.`);
    } catch (error) {
      reminder.syncError = error.message || "Sem ligacao ao servidor";
      saveWaterReminders();
      renderWaterReminders();
      toast("Lembrete guardado no telemovel. Falhou o envio ao sistema.");
    }
  }

  async function closeWaterReminder(localId) {
    const reminder = waterReminders.find((item) => item.localId === localId);
    if (!reminder) return;
    reminder.status = "CLOSED";
    reminder.closedAt = new Date().toISOString();
    clearWaterTimer(localId);
    saveWaterReminders();
    renderWaterReminders();

    try {
      await api(`/api/technician/water-reminders/${encodeURIComponent(reminder.serverId || reminder.localId)}/close`, {
        method: "POST",
        body: JSON.stringify(reminder),
      });
      toast("Agua fechada registada no sistema.");
    } catch (error) {
      reminder.syncError = error.message || "Sem ligacao ao servidor";
      saveWaterReminders();
      toast("Agua fechada no telemovel. Falhou o envio ao sistema.");
    }
  }

  async function escalateWaterReminder(localId, manual) {
    const reminder = waterReminders.find((item) => item.localId === localId);
    if (!reminder || reminder.status === "CLOSED") return;
    reminder.status = "OVERDUE";
    reminder.alerted = true;
    reminder.alertedAt = new Date().toISOString();
    saveWaterReminders();
    renderWaterReminders();

    if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 500]);
    toast(manual ? "Alerta enviado para a equipa." : "ALARME: verificar agua aberta.");
    if (!manual) showWaterAlarmPopup(reminder);

    try {
      const data = await api(`/api/technician/water-reminders/${encodeURIComponent(reminder.serverId || reminder.localId)}/alarm`, {
        method: "POST",
        body: JSON.stringify({ ...reminder, manual }),
      });
      reminder.serverId = data.reminder?.id || reminder.serverId || null;
      reminder.alertId = data.alert?.id || reminder.alertId || null;
      reminder.notificationIds = Array.isArray(data.notifications) ? data.notifications.map((item) => item.id) : reminder.notificationIds;
      reminder.syncError = "";
      saveWaterReminders();
      renderWaterReminders();
      toast(manual ? "Alerta geral registado." : "Alarme geral enviado e registado.");
    } catch (error) {
      reminder.syncError = error.message || "Sem ligacao ao servidor";
      saveWaterReminders();
      renderWaterReminders();
      toast("Alarme no telemovel, mas falhou o envio ao sistema.");
    }
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
    const vehicleId = (vehicleInput?.value || localStorage.getItem("cwVehicleId") || "1").trim();
    const technicianId = (technicianInput?.value || localStorage.getItem("cwTechnicianId") || "").trim();

    if (vehicleInput) vehicleInput.value = vehicleId;
    if (technicianInput) technicianInput.value = technicianId;
    localStorage.setItem("cwVehicleId", vehicleId);
    if (technicianId) localStorage.setItem("cwTechnicianId", technicianId);

    const transportBox = $("#transportGuideBox");
    const workBox = $("#workGuideBox");
    if (transportBox) transportBox.innerHTML = '<div class="doc-number">A carregar guia AT...</div>';
    if (workBox) workBox.innerHTML = '<div class="doc-number">A carregar guia de obra...</div>';

    const [transportResult, stockResult, insuranceResult] = await Promise.allSettled([
      api(`/api/guides/transport/latest/${encodeURIComponent(vehicleId)}`),
      api(`/api/guides/stock/${encodeURIComponent(vehicleId)}${technicianId ? `?technicianId=${encodeURIComponent(technicianId)}` : ""}`),
      api(`/api/guides/vehicles/${encodeURIComponent(vehicleId)}/insurance`),
    ]);

    if (transportResult.status === "fulfilled") {
      activeTransportGuide = transportResult.value.guide || null;
      activeVehicle = activeTransportGuide?.vehicle || activeVehicle;
      renderTransportGuide(transportResult.value.guide, transportResult.value.items);
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
    } else {
      activeInsurance = null;
      renderInsurance(null, null, vehicleId);
    }

    updateFieldDashboard(current());
    renderCrewStatus();

    if (showFeedback) toast("Guias atualizadas.");
  }

  function resetForm() {
    ["ph", "chlorine", "alkalinity", "salt", "orp", "temperature", "notes"].forEach((id) => {
      const node = $(`#${id}`);
      if (node) node.value = "";
    });
    updateAllReferenceStatuses();
    const category = $("#problemCategory");
    if (category) category.value = "Servico normal";
    ["cleaned", "basketCleaned"].forEach((id) => {
      const node = $(`#${id}`);
      if (node) node.checked = true;
    });
    ["vacuumed", "brushed", "waterlineClean", "backwashDone"].forEach((id) => {
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

  function renderList() {
    const list = $("#visitList");
    if (!list) return;
    if (!visits.length) {
      list.innerHTML = '<div class="visit">Sem visitas pendentes.</div>';
      return;
    }
    list.innerHTML = visits.map((visit, i) => {
      const location = visitLocation(visit);
      const done = isVisitDone(visit);
      const status = done ? "Feita / pode corrigir" : (visit.status || "Pendente");
      return `
      <button class="visit ${i === index ? "active" : ""} ${done ? "done" : ""}" type="button" data-visit-index="${i}">
        <div class="visit-top">
          <b>${esc(visit.pool?.name || "Piscina")}</b>
          <span class="chip">${esc(status)}</span>
        </div>
        <span>${esc(visit.client?.name || "Cliente")}</span>
        <div class="visit-location">
          <span>Local: ${esc(location.address || visit.pool?.zone || "Localizacao por confirmar")}</span>
          <span>${location.lat && location.lng ? `GPS: ${esc(location.lat.toFixed(5))}, ${esc(location.lng.toFixed(5))}` : "GPS por registar"}</span>
        </div>
      </button>
    `;
    }).join("");

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
      <button class="assist-card" type="button" data-assist-visit="${esc(visit.id)}" data-assist-source="${esc(source)}">
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

  function openAssistVisit(visitId, source) {
    const pools = source === "tomorrow" ? assistOptions.tomorrow : assistOptions.otherToday;
    const found = pools.find((visit) => String(visit.id) === String(visitId));
    if (!found) return;
    const visit = { ...found, assistSource: source };
    const existing = visits.findIndex((item) => String(item.id) === String(visit.id));
    if (existing >= 0) {
      visits[existing] = { ...visits[existing], ...visit };
      index = existing;
    } else {
      visits.push(visit);
      index = visits.length - 1;
    }
    loadCurrentDraft();
    render();
    switchFieldTab("route", true);
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
    render();
    if (isVisitDone(current())) {
      switchFieldTab("service");
      toast("Visita feita aberta para corrigir.");
    }
  }

  function nextPendingIndex(afterIndex) {
    const later = visits.findIndex((visit, i) => i > afterIndex && !isVisitDone(visit));
    if (later >= 0) return later;
    const any = visits.findIndex((visit) => !isVisitDone(visit));
    return any >= 0 ? any : visits.length;
  }

  function render() {
    const visit = current();
    $("#progressText").textContent = visits.length ? `${Math.min(index + 1, visits.length)} de ${visits.length} visitas` : "Sem visitas pendentes";

    if (!visit) {
      $("#nextTitle").textContent = "Ronda concluida";
      $("#nextMeta").textContent = "Podes ajudar colegas que ainda tenham piscinas pendentes ou antecipar a ronda do proximo dia.";
      if ($("#startBtn")) {
        $("#startBtn").disabled = false;
        $("#startBtn").textContent = "Ajudar colegas";
      }
      $("#finishBtn").disabled = false;
      $("#finishBtn").textContent = "Ronda de amanha";
      $("#connectionState").textContent = "Concluido";
      renderCorrectionSummary(null);
      renderAccessCard(null);
      renderRouteCard(null);
      renderList();
      updateFieldDashboard(null);
      renderAssistPanel();
      loadAssistOptions(false);
      return;
    }

    $("#finishBtn").disabled = false;
    $("#connectionState").textContent = "Campo";
    $("#nextTitle").textContent = visit.pool?.name || "Piscina";
    const sourceLabel = visit.assistSource === "otherToday"
      ? `Ajudar ${visit.technician?.name || visit.technicianName || "colega"}`
      : (visit.assistSource === "tomorrow" ? "Ronda do proximo dia" : (visit.technician?.name || "Tecnico"));
    $("#nextMeta").textContent = `${visit.client?.name || "Cliente"} - ${sourceLabel} - ${isVisitDone(visit) ? "Feita / correcao aberta" : (visit.status || "Pendente")}`;
    if ($("#startBtn")) $("#startBtn").textContent = isVisitDone(visit) ? "Rever registo" : "Iniciar visita";
    $("#finishBtn").textContent = isVisitDone(visit) ? "Guardar correcao" : "Concluir e passar a proxima";
    renderAssistPanel();
    renderCorrectionSummary(visit);
    renderAccessCard(visit);
    renderRouteCard(visit);
    renderList();
    updateFieldDashboard(visit);
  }

  async function load() {
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
      const todayQuery = todayQueryParams();
      let data = await api(`/api/technician/today?${todayQuery}`).catch(() => null);
      if (!data || !Array.isArray(data.visits)) {
        data = await api("/api/core/dashboard");
        visits = Array.isArray(data.nextVisits) ? data.nextVisits : [];
      } else {
        visits = data.visits;
      }
      index = visits.findIndex((visit) => !isVisitDone(visit));
      if (index < 0) index = visits.length;
      visitDrafts = storageRead("cwFieldVisitDrafts", {});
      loadWaterRemindersFromStorage();
      loadCurrentDraft();
      renderWaterReminders();
      scheduleWaterReminders();
      syncTechnicianContextFromVisit(current());
      render();
      await loadGuides(false).catch(() => renderCrewStatus());
    } catch (error) {
      $("#nextTitle").textContent = "Nao foi possivel carregar";
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
      if (saveButton) saveButton.disabled = false;
    }

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
      if (button) button.disabled = false;
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
    const safeTab = ["service", "route", "list", "docs", "more"].includes(tab) ? tab : "service";
    document.body.dataset.fieldTab = safeTab;
    try {
      localStorage.setItem("cwFieldActiveTab", safeTab);
    } catch (_) {}
    document.querySelectorAll("[data-field-tab-button]").forEach((button) => {
      button.classList.toggle("active", button.dataset.fieldTabButton === safeTab);
    });
    if (shouldScroll) {
      window.setTimeout(() => scrollFieldTabIntoView(safeTab), 0);
    }
  }

  function setupFieldLayout() {
    document.body.classList.add("cw-tech-field-page");

    markFieldSection("#cleaningCard", "field-panel-service", "Servico", "limpeza e leituras");
    markFieldSection("#doseRows", "field-panel-service", "Produtos", "consumo do carro");
    markFieldSection("#photoList", "field-panel-service", "Fotografias", "registo rapido");
    markFieldSection("#accessCard", "field-panel-route", "Acesso", "chaves e codigos");
    markFieldSection("#routeCard", "field-panel-route", "Rota", "proximo local");
    markFieldSection("#visitList", "field-panel-list", "Lista do dia", "corrigir ou avancar");
    markFieldSection(".crew-card", "field-panel-docs", "Tecnico", "viatura e documentos");
    markFieldSection("#transportGuideBox", "field-panel-docs", "Documentos", "AT, obra e seguro");
    markFieldSection("#waterReminderList", "field-panel-more", "Agua aberta", "alarme obrigatorio");
    markFieldSection("#adminAlertMessage", "field-panel-more", "Avisos", "admin e stock");
    markFieldSection("#problemPanel", "field-panel-more", "Extras / problemas", "separado do servico");

    const nextCard = document.querySelector(".next");
    if (nextCard && !nextCard.querySelector(".field-action-rail")) {
      const rail = document.createElement("div");
      rail.className = "field-action-rail";
      rail.innerHTML = `
        <button type="button" data-quick-tab="route">Ir</button>
        <button type="button" data-quick-tab="service">Servico</button>
        <button type="button" data-quick-action="photo">Fotos</button>
        <button type="button" data-quick-action="problem">Problema</button>
      `;
      nextCard.appendChild(rail);
    }

    if (!document.querySelector(".field-tabs")) {
      const nav = document.createElement("nav");
      nav.className = "field-tabs";
      nav.setAttribute("aria-label", "Navegacao do tecnico em campo");
      nav.innerHTML = `
        <button type="button" data-field-tab-button="list">Today</button>
        <button type="button" data-field-tab-button="route">Route</button>
        <button type="button" data-field-tab-button="service">Visit</button>
        <button type="button" data-field-tab-button="more">Alerts</button>
        <button type="button" data-field-tab-button="menu">Menu</button>
      `;
      document.body.appendChild(nav);
    }

    document.querySelectorAll("[data-field-tab-button]").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.fieldTabButton;
        if (tab === "menu") {
          const opener = document.querySelector("[data-cw-open-drawer]");
          if (opener) {
            opener.click();
          } else {
            const drawer = document.querySelector("[data-cw-drawer]");
            drawer?.classList.add("is-open");
            drawer?.setAttribute("aria-hidden", "false");
          }
          return;
        }
        switchFieldTab(tab, true);
      });
    });
    document.querySelectorAll("[data-quick-tab]").forEach((button) => {
      button.addEventListener("click", () => switchFieldTab(button.dataset.quickTab, true));
    });
    document.querySelectorAll("[data-quick-action='photo']").forEach((button) => {
      button.addEventListener("click", () => {
        switchFieldTab("service");
        const photoButton = document.querySelector("[data-photo-type='AFTER']");
        photoButton?.scrollIntoView({ behavior: "smooth", block: "center" });
        photoButton?.focus();
      });
    });
    document.querySelectorAll("[data-quick-action='problem']").forEach((button) => {
      button.addEventListener("click", () => {
        switchFieldTab("more");
        $("#problemBtn")?.click();
      });
    });

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
          openAssistVisit(visitButton.dataset.assistVisit, visitButton.dataset.assistSource);
        }
      });
    }

    let savedTab = "service";
    try {
      savedTab = localStorage.getItem("cwFieldActiveTab") || "service";
    } catch (_) {}
    switchFieldTab(savedTab);
  }

  setupFieldLayout();

  const startBtn = $("#startBtn");
  if (startBtn) {
    startBtn.onclick = async () => {
      const visit = current();
      if (!visit) {
        showAssistMode("help");
        return;
      }
      if (isVisitDone(visit)) {
        switchFieldTab("service");
        loadCurrentDraft();
        toast("Registo aberto para corrigir.");
        return;
      }
      startedAt = new Date();
      startBtn.disabled = true;
      try {
        const result = await api(`/api/operational-state/visits/${visit.id}/state`, {
          method: "POST",
          body: JSON.stringify({
            state: "IN_PROGRESS",
            actor: activeTechnician?.name || "TECHNICIAN_FIELD_MODE",
            technicianId: currentTechnicianId() || undefined,
            notes: "Visita iniciada no portal tecnico.",
          }),
        });
        visits[index] = mergeVisitSnapshot(visit, result.visit || {}, "IN_PROGRESS");
        render();
        toast("Piscina iniciada e registada.");
      } catch (error) {
        toast(error.message || "Nao foi possivel iniciar visita.");
      } finally {
        startBtn.disabled = false;
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

  document.querySelectorAll("[data-photo-type]").forEach((button) => {
    button.addEventListener("click", () => pickPhoto(button.dataset.photoType));
  });

  const photoInput = $("#photoInput");
  if (photoInput) {
    photoInput.addEventListener("change", () => {
      Array.from(photoInput.files || []).forEach(addSelectedPhoto);
    });
  }

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
    input.addEventListener("change", () => saveCurrentDraft());
  });

  checkIds.forEach((id) => {
    const input = $(`#${id}`);
    if (!input) return;
    input.addEventListener("change", () => saveCurrentDraft());
  });

  window.addEventListener("beforeunload", () => {
    saveCurrentDraft();
  });

  const finishBtn = $("#finishBtn");
  if (finishBtn) {
    finishBtn.onclick = async () => {
      const visit = current();
      if (!visit) {
        showAssistMode("tomorrow");
        return;
      }
      const originalIndex = index;
      const wasDone = isVisitDone(visit);
      $("#finishBtn").disabled = true;
      const photosReady = await syncPendingPhotos(false);
      if (!photosReady) {
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
          const result = await api(`/api/technician/visits/${visit.id}/correction`, {
            method: "PATCH",
            body: JSON.stringify(body),
          });
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
          visits[index] = updatedVisit;
          loadCurrentDraft();
          render();
          toast("Correcao guardada sem duplicar stock.");
          $("#finishBtn").disabled = false;
          return;
        }

        const completeResult = await api(`/api/core/visits/${visit.id}/complete`, { method: "POST", body: JSON.stringify(body) });
        let stockUpdated = false;
        if (productsUsed.length) {
          try {
            await consumeVisitProducts(visit, productsUsed);
            stockUpdated = true;
          } catch (stockError) {
            console.error(stockError);
            toast("Visita concluida. Consumo ficou por sincronizar.");
          }
        }
        const completedVisit = mergeVisitSnapshot(visit, completeResult.visit || {}, "DONE");
        completedVisit.status = "DONE";
        completedVisit.endAt = completeResult.visit?.endAt || completedVisit.endAt || new Date().toISOString();
        visits[originalIndex] = completedVisit;
        usedProducts = [];
        saveCurrentDraft();
        toast(wasDone ? "Correcao guardada." : (stockUpdated ? "Visita concluida e stock atualizado." : "Visita concluida."));
        if (!wasDone) {
          index = nextPendingIndex(originalIndex);
          loadCurrentDraft();
        }
        render();
      } catch (error) {
        $("#finishBtn").disabled = false;
        toast(error.message);
      }
    };
  }

  load();
  updateAllReferenceStatuses();
})();
