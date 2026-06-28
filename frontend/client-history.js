const content = document.getElementById("content");
const clientId = localStorage.getItem("clientId");
const token = localStorage.getItem("authToken");

function formatDateTime(dateString) {
  const d = new Date(dateString);

  const date = d.toLocaleDateString("pt-PT");
  const time = d.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit"
  });

  return `${date} • ${time}`;
}

async function loadHistory() {
  try {
    const res = await fetch(`/api/client-portal/history/${clientId}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      content.innerText = data.message || "Acesso negado.";
      return;
    }

    if (!data.pools.length) {
      content.innerText = "Sem piscinas associadas.";
      return;
    }

    content.innerHTML = "";

    data.pools.forEach(pool => {
      let html = `
        <div class="pool">
          <h3>${pool.name}</h3>
          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Estado</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (!pool.serviceVisits.length) {
        html += `
          <tr>
            <td colspan="3">Sem intervenções registadas.</td>
          </tr>
        `;
      } else {
        pool.serviceVisits.forEach(v => {
          html += `
            <tr>
              <td>${formatDateTime(v.date)}</td>
              <td>${v.status}</td>
              <td>${v.notes || "-"}</td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
          </table>
        </div>
      `;

      content.innerHTML += html;
    });

  } catch (err) {
    content.innerText = "Erro de ligação ao servidor.";
  }
}

loadHistory();