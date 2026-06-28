const API = "/api";

// 🔧 CONFIG
const technicianId = 1;
const SEND_INTERVAL = 10000; // 10 segundos

let lastSent = 0;

// ==========================================
// INICIAR TRACKING
// ==========================================

function startTracking() {

  if (!navigator.geolocation) {
    alert("GPS não suportado neste dispositivo");
    return;
  }

  console.log("GPS tracking iniciado");

  navigator.geolocation.watchPosition(
    handlePosition,
    handleError,
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000
    }
  );
}

// ==========================================
// POSIÇÃO RECEBIDA
// ==========================================

async function handlePosition(position) {

  const now = Date.now();

  // ⛔ evitar enviar demasiadas vezes
  if (now - lastSent < SEND_INTERVAL) return;

  lastSent = now;

  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const accuracy = position.coords.accuracy;

  console.log("GPS:", lat, lng);

  try {
    await fetch(API + "/gps", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        technicianId,
        lat,
        lng,
        accuracy
      })
    });

    updateStatus("📡 Localização enviada");

  } catch (err) {
    console.error(err);
    updateStatus("❌ Erro envio GPS");
  }
}

// ==========================================
// ERRO GPS
// ==========================================

function handleError(err) {
  console.error("Erro GPS:", err);
  updateStatus("❌ GPS falhou");
}

// ==========================================
// STATUS VISUAL
// ==========================================

function updateStatus(text) {
  const el = document.getElementById("gpsStatus");
  if (el) el.innerText = text;
}

// ==========================================
// BOTÃO MANUAL (opcional)
// ==========================================

async function sendNow() {
  navigator.geolocation.getCurrentPosition(handlePosition);
}

// ==========================================
// INICIAR AUTOMATICAMENTE
// ==========================================

startTracking();