const API = "/api";

async function load(){

  const res = await fetch(`${API}/today`);
  const data = await res.json();

  document.getElementById("total").textContent = data.total;
  document.getElementById("done").textContent = data.done;
  document.getElementById("pending").textContent = data.pending;
  document.getElementById("notDone").textContent = data.notDone;

  const list = document.getElementById("list");
  list.innerHTML = "";

  data.visits.forEach(v=>{
    list.innerHTML += `
      <div class="item">
        ${v.pool.name} - ${v.client.name} - ${v.status}
      </div>
    `;
  });
}

load();