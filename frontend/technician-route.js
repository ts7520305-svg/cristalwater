const API = "/api";

const technicianId = 1;

// carregar rota
async function loadRoute() {
  const res = await fetch(`${API}/routes/today/${technicianId}`);
  const data = await res.json();

  const box = document.getElementById("route");
  box.innerHTML = "";

  data.visits.forEach(v => {
    box.innerHTML += `Cliente ${v.clientId} <br>`;
  });
}

// sugestões
async function loadSuggestions() {
  const res = await fetch(`${API}/routes/suggest/${technicianId}`);
  const data = await res.json();

  const box = document.getElementById("suggestions");
  box.innerHTML = "";

  if (!data.suggestions.length) {
    box.innerHTML = "Sem sugestões";
    return;
  }

  data.suggestions.forEach(v => {
    box.innerHTML += `
      Cliente ${v.clientId}
      <button onclick="accept(${v.id})">Aceitar</button>
      <br>
    `;
  });
}

// aceitar
async function accept(id) {
  await fetch(`${API}/routes/accept/${id}`, {
    method: "POST"
  });

  alert("Piscina adicionada à rota");
  loadRoute();
  loadSuggestions();
}

loadRoute();
loadSuggestions();