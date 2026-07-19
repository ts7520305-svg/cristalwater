const API = "/api";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

let map = L.map('map').setView([37.1,-8.6],10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
.addTo(map);

let coords = [];

function loadRoute(){

  navigator.geolocation.getCurrentPosition(async pos=>{

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    const res = await fetch(`${API}/routes/optimize?lat=${lat}&lng=${lng}`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();

    coords = [];

    (Array.isArray(data) ? data : []).forEach(v=>{
      if(!v.pool.latitude) return;

      coords.push([v.pool.latitude, v.pool.longitude]);

      L.marker([v.pool.latitude, v.pool.longitude])
        .addTo(map)
        .bindPopup(v.pool.name);
    });

    if(coords.length > 1){
      L.polyline(coords,{color:'blue'}).addTo(map);
    }

  }, () => {});
}

function openGoogle(){
  let url = "https://www.google.com/maps/dir/";

  coords.forEach(c=>{
    url += `${c[0]},${c[1]}/`;
  });

  window.open(url);
}

function openWaze(){
  if(!coords.length) return;
  const last = coords[coords.length-1];
  window.open(`https://waze.com/ul?ll=${last[0]},${last[1]}&navigate=yes`);
}