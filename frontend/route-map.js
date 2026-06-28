const API = "/api";

let map = L.map('map').setView([37.1,-8.6],10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
.addTo(map);

let coords = [];

function loadRoute(){

  navigator.geolocation.getCurrentPosition(async pos=>{

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    const res = await fetch(`${API}/routes/optimize?lat=${lat}&lng=${lng}`);
    const data = await res.json();

    coords = [];

    data.forEach(v=>{
      if(!v.pool.latitude) return;

      coords.push([v.pool.latitude, v.pool.longitude]);

      L.marker([v.pool.latitude, v.pool.longitude])
        .addTo(map)
        .bindPopup(v.pool.name);
    });

    if(coords.length > 1){
      L.polyline(coords,{color:'blue'}).addTo(map);
    }

  });
}

function openGoogle(){
  let url = "https://www.google.com/maps/dir/";

  coords.forEach(c=>{
    url += `${c[0]},${c[1]}/`;
  });

  window.open(url);
}

function openWaze(){
  const last = coords[coords.length-1];
  window.open(`https://waze.com/ul?ll=${last[0]},${last[1]}&navigate=yes`);
}