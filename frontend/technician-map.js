const API = "/api";

let route = [];
let currentIndex = 0;

// ============================
// CARREGAR RONDA
// ============================

async function loadToday(){

  const res = await fetch(`${API}/visits/today?technicianId=1`);
  const data = await res.json();

  route = data.visits;
  currentIndex = 0;

  updateInfo();
}

// ============================
// CONCLUIR VISITA
// ============================

async function complete(){

  const visit = route[currentIndex];

  await fetch(`${API}/visits/complete/${visit.id}`,{
    method:"POST"
  });

  alert("Piscina concluída");

  nextPool();
}

// ============================
// ALERTA
// ============================

async function alertProblem(){

  const msg = prompt("Descreve o problema");

  if(!msg) return;

  await fetch(`${API}/visits/alert`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      visitId: route[currentIndex].id,
      message: msg
    })
  });

  alert("Alerta enviado");
}

// ============================
// NEXT
// ============================

function nextPool(){
  currentIndex++;
  if(currentIndex >= route.length) currentIndex = 0;
  updateInfo();
}

// ============================
// INFO
// ============================

function updateInfo(){

  const v = route[currentIndex];

  document.getElementById("infoBox").innerHTML = `
    <b>${v.pool.name}</b><br>
    Cliente: ${v.client.name}<br>
  `;
}