const API = "/api";

const params = new URLSearchParams(window.location.search);
const visitId = params.get("visit");

async function loadVisit(){

  const res = await fetch(`${API}/visits/${visitId}`);
  const data = await res.json();

  const v = data.visit;

  document.getElementById("info").innerHTML =
    `<b>${v.pool.name}</b><br>${v.client.name}`;
}

async function completeVisit(){

  await fetch(`${API}/visits/complete/${visitId}`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      ph: document.getElementById("ph").value,
      chlorine: document.getElementById("chlorine").value,
      alkalinity: document.getElementById("alkalinity").value,
      cleaned: document.getElementById("cleaned").checked,
      brushed: document.getElementById("brushed").checked,
      notes: document.getElementById("notes").value
    })
  });

  alert("Visita concluída");
}

async function markNotDone(){

  const reason = prompt("Motivo?");
  if(!reason) return;

  await fetch(`${API}/visits/not-done/${visitId}`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ notes: reason })
  });

  alert("Não feita");
}

async function uploadPhoto(){

  const file = document.getElementById("photo").files[0];
  if(!file) return;

  const form = new FormData();
  form.append("photo", file);

  await fetch(`${API}/visits/${visitId}/photo`,{
    method:"POST",
    body: form
  });

  alert("Foto enviada");
}

loadVisit();