const API = "/api";

const statusBox = document.getElementById("gpsStatus");
const startBtn = document.getElementById("startBtn");
const sendNowBtn = document.getElementById("sendNowBtn");
const syncKpi = document.getElementById("syncKpi");
const accuracyKpi = document.getElementById("accuracyKpi");
const lastKpi = document.getElementById("lastKpi");

let watchId = null;
let lastSentAt = 0;
const SEND_INTERVAL = 10000;

function userData() {
  try {
    return JSON.parse(localStorage.getItem("cristalwater_user") || localStorage.getItem("user") || "{}") || {};
  } catch (_) {
    return {};
  }
}

function technicianId() {
  const user = userData();
  return Number(user.technicianId || user.id || 0);
}

function setStatus(message, tone = "") {
  if (!statusBox) return;
  statusBox.textContent = message;
  if (tone) statusBox.dataset.tone = tone;
  else statusBox.removeAttribute("data-tone");
}

function setKpi(sync, accuracy, last) {
  if (syncKpi) syncKpi.textContent = sync;
  if (accuracyKpi) accuracyKpi.textContent = accuracy;
  if (lastKpi) lastKpi.textContent = last;
}

async function parseResponse(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(data.error || data.message || `Falha HTTP ${response.status}`);
  }
  return data;
}

async function sendPoint(position) {
  const now = Date.now();
  if (now - lastSentAt < SEND_INTERVAL) return;

  const id = technicianId();
  if (!id) {
    throw new Error("Sessao tecnica sem tecnico associado.");
  }

  lastSentAt = now;
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const accuracy = Number(position.coords.accuracy || 0);

  await parseResponse(await fetch(`${API}/gps/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      technicianId: id,
      latitude: lat,
      longitude: lng,
      accuracy,
    }),
  }));

  setKpi("Sincronizado", `${Math.round(accuracy)} m`, new Date().toLocaleTimeString("pt-PT"));
  setStatus("Localizacao enviada com sucesso.");
}

function onPosition(position) {
  sendPoint(position).catch((error) => {
    setStatus(error.message || "Falha no envio de localizacao.", "error");
    setKpi("Erro", "-", lastKpi?.textContent || "-");
  });
}

function onError() {
  setStatus("GPS indisponivel neste momento.", "warning");
  setKpi("Sem sinal", "-", lastKpi?.textContent || "-");
}

function startTracking() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  if (!navigator.geolocation) {
    setStatus("GPS nao suportado neste dispositivo.", "error");
    return;
  }

  if (watchId != null) {
    setStatus("Tracking ja esta ativo.");
    return;
  }

  setStatus("A iniciar tracking GPS.");
  setKpi("A iniciar", "-", lastKpi?.textContent || "-");
  watchId = navigator.geolocation.watchPosition(onPosition, onError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000,
  });
}

function sendNow() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  if (!navigator.geolocation) {
    setStatus("GPS nao suportado neste dispositivo.", "error");
    return;
  }

  setStatus("A obter ponto atual.");
  navigator.geolocation.getCurrentPosition(onPosition, onError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000,
  });
}

if (startBtn) startBtn.addEventListener("click", startTracking);
if (sendNowBtn) sendNowBtn.addEventListener("click", sendNow);

if (window.CristalAuth?.requireAuth("TECHNICIAN")) {
  setStatus("Pronto para iniciar GPS.");
  setKpi("Em espera", "-", "-");
}
