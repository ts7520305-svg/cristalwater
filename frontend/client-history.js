const content = document.getElementById("content");
const clientId = Number(localStorage.getItem("cw_client_id") || localStorage.getItem("clientId") || 0);
const authToken = localStorage.getItem("token") || localStorage.getItem("authToken") || localStorage.getItem("cristalwater_jwt");

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
        "Authorization": `Bearer ${authToken}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      content.innerText = data.message || "Acesso negado.";
      return;
    }

    if (!Array.isArray(data.pools) || !data.pools.length) {
      content.innerText = "Sem piscinas associadas.";
      return;
    }

    content.innerHTML = "";

    data.pools.forEach(pool => {
      let html = `
        <div class="pool">
          <h3>${pool.name}</h3>
          <p>Zona: ${pool.zone || "-"}</p>
          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Estado</th>
                <th>Técnico</th>
                <th>Química</th>
                <th>Produtos</th>
                <th>Notas / Incidentes</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (!Array.isArray(pool.serviceVisits) || !pool.serviceVisits.length) {
        html += `
          <tr>
            <td colspan="6">Sem intervenções registadas.</td>
          </tr>
        `;
      } else {
        pool.serviceVisits.forEach(v => {
          const products = Array.isArray(v.chemicals)
            ? v.chemicals.map((item) => `${item.name || "Produto"} ${item.quantity || 0}${item.unit ? ` ${item.unit}` : ""}`).join(" • ")
            : (typeof v.products === "string" ? v.products : "-");
          const chemistry = [
            v.ph != null ? `pH ${v.ph}` : null,
            v.chlorine != null ? `Cloro ${v.chlorine}` : null,
            v.alkalinity != null ? `Alcal. ${v.alkalinity}` : null,
            v.salt != null ? `Sal ${v.salt}` : null,
            v.temperature != null ? `Temp. ${v.temperature}` : null,
          ].filter(Boolean).join(" • ") || "-";
          const notes = [v.notes, v.internalNotes, v.alerts].filter(Boolean).join("<br>") || "-";
          html += `
            <tr>
              <td>${formatDateTime(v.date)}</td>
              <td>${v.status}</td>
              <td>${v.technicianName || "-"}</td>
              <td>${chemistry}</td>
              <td>${products}</td>
              <td>${notes}</td>
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