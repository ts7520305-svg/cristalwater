const API = "/api";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

let map = L.map('map').setView([37.1, -8.6], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
.addTo(map);

let markers = [];
let routeCoords = [];

// ==========================================================
// LIMPAR
// ==========================================================

function clearMap(){
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  routeCoords = [];
}

// ==========================================================
// TODAS PISCINAS
// ==========================================================

async function loadPools(){

  clearMap();

  const res = await fetch(`${API}/pools`, { headers: authHeaders() });
  if (!res.ok) return;
  const poolsData = await res.json();
  const pools = Array.isArray(poolsData) ? poolsData : [];

  pools.forEach(p => {

    if(!p.latitude) return;

    const marker = L.marker([p.latitude, p.longitude])
      .addTo(map)
      .bindPopup(`${p.name} (${p.client.name})`);

    markers.push(marker);
    routeCoords.push([p.latitude, p.longitude]);

  });
}

// ==========================================================
// PERTO DE MIM
// ==========================================================

async function loadNearby(){

  navigator.geolocation.getCurrentPosition(async pos => {

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    clearMap();

    const res = await fetch(`${API}/pools/nearby?lat=${lat}&lng=${lng}`, { headers: authHeaders() });
    if (!res.ok) return;
    const poolsData = await res.json();
    const pools = Array.isArray(poolsData) ? poolsData : [];

    pools.forEach(p => {

      const marker = L.marker([p.latitude, p.longitude])
        .addTo(map)
        .bindPopup(`${p.name} - ${p.distanceKm.toFixed(2)} km`);

      markers.push(marker);
      routeCoords.push([p.latitude, p.longitude]);

    });

  }, () => {});
}

// ==========================================================
// ROTA
// ==========================================================

async function loadRoute(){

  clearMap();

  const res = await fetch(`${API}/pools`, { headers: authHeaders() });
  if (!res.ok) return;
  const poolsData = await res.json();
  const pools = Array.isArray(poolsData) ? poolsData : [];

  pools.forEach(p => {

    if(!p.latitude) return;

    routeCoords.push([p.latitude, p.longitude]);

    const marker = L.marker([p.latitude, p.longitude])
      .addTo(map)
      .bindPopup(p.name);

    markers.push(marker);

  });

  if(routeCoords.length > 1){
    const polyline = L.polyline(routeCoords, { color: 'blue' }).addTo(map);
    map.fitBounds(polyline.getBounds());
  }
}

// ==========================================================
// GOOGLE MAPS
// ==========================================================

function openGoogle(){

  if(routeCoords.length === 0) return;

  let url = "https://www.google.com/maps/dir/";

  routeCoords.forEach(p=>{
    url += `${p[0]},${p[1]}/`;
  });

  window.open(url);
}

// ==========================================================
// WAZE
// ==========================================================

function openWaze(){

  if(routeCoords.length === 0) return;

  const last = routeCoords[routeCoords.length - 1];

  const url = `https://waze.com/ul?ll=${last[0]},${last[1]}&navigate=yes`;

  window.open(url);
}