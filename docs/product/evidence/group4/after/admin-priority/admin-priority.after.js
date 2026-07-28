const API = "/api";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ==========================================================
// LOAD
// ==========================================================

async function load(){

  const res = await fetch(`${API}/pools`, { headers: authHeaders() });
  if (!res.ok) return;
  const pools = await res.json();

  const list = document.getElementById("list");
  list.innerHTML = "";

  pools.forEach(p => {

    list.innerHTML += `
      <div class="card">
        <b>${escapeHtml(p.name)}</b><br>
        Cliente: ${escapeHtml(p.client?.name || "-")}

        <br><br>

        Prioridade:
        <select onchange="save(${p.id}, this.value)">
          <option value="0" ${p.priority==0?"selected":""}>Normal</option>
          <option value="1" ${p.priority==1?"selected":""}>Alta</option>
          <option value="2" ${p.priority==2?"selected":""}>Urgente</option>
        </select>
      </div>
    `;
  });
}

// ==========================================================
// SAVE
// ==========================================================

async function save(id, priority){

  await fetch(`${API}/pools/priority/${id}`,{
    method:"POST",
    headers: authHeaders({ "Content-Type":"application/json" }),
    body: JSON.stringify({ priority: Number(priority) })
  });

  console.log("✔ prioridade atualizada:", id, priority);
}

load();
