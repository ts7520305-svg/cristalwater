const API = "/api/guides";
const statusBox = document.getElementById("statusBox");

function setStatus(message, tone = "") {
  if (!statusBox) return;
  statusBox.textContent = message;
  if (tone) statusBox.dataset.tone = tone;
  else statusBox.removeAttribute("data-tone");
}

async function j(url, opt) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opt
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(data.error || data.message || `Falha HTTP ${response.status}`);
  }
  return data;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[char]));
}

async function init() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  setStatus("A carregar viaturas.");
  try {
    const data = await j(`${API}/vehicles`);
    const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
    vehicle.innerHTML = vehicles
      .map((item) => `<option value="${item.id}">${esc(item.plate)} - ${esc(item.name || "")}</option>`)
      .join("");
    if (vehicles[0]) vehicleStock.value = vehicles[0].id;
    setStatus(vehicles.length ? `Modulo pronto com ${vehicles.length} viatura(s).` : "Sem viaturas associadas.", vehicles.length ? "" : "warning");
  } catch (error) {
    setStatus(error.message || "Falha ao carregar viaturas.", "error");
  }
}

async function startDay() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  try {
    setStatus("A iniciar guia de obra.");
    const response = await j(`${API}/work/start`, {
      method: "POST",
      body: JSON.stringify({
        vehicleId: vehicle.value,
        technicianId: techId.value,
        startKm: startKm.value,
      }),
    });
    workGuideId.value = response.workGuide?.id || "";
    closeId.value = response.workGuide?.id || "";
    vehicleStock.value = vehicle.value;
    setStatus(response.message || "Guia iniciada com sucesso.");
    await loadStock();
  } catch (error) {
    setStatus(error.message || "Nao foi possivel iniciar guia.", "error");
  }
}

function renderAtDocumentButton(document, vehicleId, workGuide) {
  if (workGuide && !workGuide.guideId) {
    return `
      <div class="movement">
        <strong>Guia AT em falta</strong>
        <div class="muted">O administrador foi alertado. Quando a AT for adicionada, fica associada a esta guia de obra.</div>
      </div>
    `;
  }

  if (document?.url) {
    return `
      <a class="btn" target="_blank" rel="noopener" href="${esc(document.url)}">Abrir guia AT oficial</a>
      <div class="muted">Ficheiro AT: ${esc(document.originalName || document.filename || "documento")}</div>
    `;
  }

  return `
    <a class="btn" target="_blank" rel="noopener" href="${API}/transport/latest/${encodeURIComponent(vehicleId)}/pdf">Abrir PDF guia AT gerado</a>
    <div class="muted">Sem ficheiro oficial AT anexado.</div>
  `;
}

async function loadStock() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  if (!vehicleStock.value) {
    setStatus("Seleciona primeiro uma viatura.", "warning");
    return;
  }

  setStatus("A atualizar stock e movimentos.");

  try {
    const response = await j(`${API}/stock/${vehicleStock.value}`);
    const officialDocument = response.transportGuideDocument || response.workGuide?.guide?.officialDocument;

  const guideActions = response.workGuide ? `
    <div>
      <a class="btn" target="_blank" rel="noopener" href="${API}/work/${encodeURIComponent(response.workGuide.id)}/pdf">Abrir PDF guia de obra</a>
      ${renderAtDocumentButton(officialDocument, vehicleStock.value, response.workGuide)}
      <a class="btn" target="_blank" rel="noopener" href="${API}/vehicles/${encodeURIComponent(vehicleStock.value)}/insurance/pdf">Abrir PDF seguro</a>
    </div>
  ` : "";

  const movementRows = (response.movements || []).slice(-10).reverse().map((move) => `
    <div class="movement">
      <strong>${esc(move.itemName || "Material")}</strong>
      <div>${esc(move.quantity || 0)} ${esc(move.unit || "UN")} - ${esc(move.locationLabel || move.location || "Local nao indicado")}</div>
      <div class="muted">${esc(new Date(move.createdAt).toLocaleString("pt-PT"))}</div>
    </div>
  `).join("");

    stock.innerHTML = response.workGuide
      ? `<p class="muted">Guia obra #${response.workGuide.id} ligada a AT ${esc(response.workGuide.guide?.codeAT || response.workGuide.guideId || "AT EM FALTA")}</p>${guideActions}${(response.stock || []).map((item) => `
        <div class="card">
          <strong>${esc(item.name)}</strong>
          <div>${esc(item.quantity)} ${esc(item.unit || "")}</div>
          <div class="muted">Usado: ${esc(item.usedQty || 0)}</div>
        </div>
        `).join("")}<h3>Movimentos por local</h3>${movementRows || '<p class="muted">Ainda sem movimentos.</p>'}`
      : '<p class="muted">Sem guia de obra aberta.</p>';
    setStatus("Stock atualizado.");
  } catch (error) {
    stock.innerHTML = '<p class="muted">Nao foi possivel carregar stock.</p>';
    setStatus(error.message || "Falha ao carregar stock.", "error");
  }
}

async function consume() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  try {
    setStatus("A registar consumo.");
    await j(`${API}/work/consume`, {
      method: "POST",
      body: JSON.stringify({
        workGuideId: workGuideId.value,
        name: itemName.value,
        quantity: qty.value,
        visitId: visitId.value,
        technicianId: techId.value,
        location: movementLocation.value,
        notes: movementNotes.value,
      }),
    });
    setStatus("Consumo registado.");
    await loadStock();
  } catch (error) {
    setStatus(error.message || "Nao foi possivel registar consumo.", "error");
  }
}

async function closeGuide() {
  if (!window.CristalAuth?.requireAuth("TECHNICIAN")) return;

  try {
    setStatus("A fechar guia de obra.");
    await j(`${API}/work/${closeId.value || workGuideId.value}/close`, {
      method: "POST",
      body: JSON.stringify({ endKm: endKm.value }),
    });
    setStatus("Guia fechada com sucesso.");
  } catch (error) {
    setStatus(error.message || "Nao foi possivel fechar guia.", "error");
  }
}

init();
