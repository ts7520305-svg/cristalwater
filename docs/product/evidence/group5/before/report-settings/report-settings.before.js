const API = "/api";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function setStatus(msg) {
  document.getElementById("status").textContent = msg;
}

function getClientId() {
  return document.getElementById("clientId").value.trim();
}

function getVisitId() {
  return document.getElementById("visitId").value.trim();
}

function getCheckboxValue(id) {
  return document.getElementById(id).checked;
}

function setCheckboxValue(id, value) {
  document.getElementById(id).checked = !!value;
}

function refreshLinks() {
  const visitId = getVisitId();

  const clientUrl = visitId
    ? `/api/report-visit/visit/${visitId}?role=CLIENT`
    : "-";

  const adminUrl = visitId
    ? `/api/report-visit/visit/${visitId}?role=ADMIN`
    : "-";

  document.getElementById("clientLink").textContent = `Relatório cliente: ${clientUrl}`;
  document.getElementById("adminLink").textContent = `Relatório admin: ${adminUrl}`;
}

async function loadSettings() {
  const clientId = getClientId();

  if (!clientId) {
    alert("Indica o ID do cliente");
    return;
  }

  setStatus("A carregar configurações...");

  try {
    const res = await fetch(`${API}/report-settings/${clientId}`, {
      headers: authHeaders()
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert(data.error || "Erro ao carregar");
      setStatus("Erro");
      return;
    }

    const s = data.setting;

    setCheckboxValue("showClientName", s.showClientName);
    setCheckboxValue("showPoolName", s.showPoolName);
    setCheckboxValue("showZone", s.showZone);
    setCheckboxValue("showAddress", s.showAddress);
    setCheckboxValue("showTechnicianName", s.showTechnicianName);
    setCheckboxValue("showStatus", s.showStatus);
    setCheckboxValue("showPlannedDate", s.showPlannedDate);
    setCheckboxValue("showStartEnd", s.showStartEnd);
    setCheckboxValue("showWaterParameters", s.showWaterParameters);
    setCheckboxValue("showChecklist", s.showChecklist);
    setCheckboxValue("showChemicals", s.showChemicals);
    setCheckboxValue("showEquipment", s.showEquipment);
    setCheckboxValue("showTechnicalRoom", s.showTechnicalRoom);
    setCheckboxValue("showNotes", s.showNotes);
    setCheckboxValue("showPhotos", s.showPhotos);

    refreshLinks();
    setStatus("Configurações carregadas");
  } catch (err) {
    console.error(err);
    setStatus("Erro de ligação");
    alert("Erro de ligação ao servidor");
  }
}

async function saveSettings() {
  const clientId = getClientId();

  if (!clientId) {
    alert("Indica o ID do cliente");
    return;
  }

  setStatus("A guardar configurações...");

  try {
    const body = {
      showClientName: getCheckboxValue("showClientName"),
      showPoolName: getCheckboxValue("showPoolName"),
      showZone: getCheckboxValue("showZone"),
      showAddress: getCheckboxValue("showAddress"),
      showTechnicianName: getCheckboxValue("showTechnicianName"),
      showStatus: getCheckboxValue("showStatus"),
      showPlannedDate: getCheckboxValue("showPlannedDate"),
      showStartEnd: getCheckboxValue("showStartEnd"),
      showWaterParameters: getCheckboxValue("showWaterParameters"),
      showChecklist: getCheckboxValue("showChecklist"),
      showChemicals: getCheckboxValue("showChemicals"),
      showEquipment: getCheckboxValue("showEquipment"),
      showTechnicalRoom: getCheckboxValue("showTechnicalRoom"),
      showNotes: getCheckboxValue("showNotes"),
      showPhotos: getCheckboxValue("showPhotos"),
    };

    const res = await fetch(`${API}/report-settings/${clientId}`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert(data.error || "Erro ao guardar");
      setStatus("Erro");
      return;
    }

    refreshLinks();
    setStatus("Configurações guardadas com sucesso");
  } catch (err) {
    console.error(err);
    setStatus("Erro de ligação");
    alert("Erro de ligação ao servidor");
  }
}

function openClientReport() {
  const visitId = getVisitId();
  if (!visitId) {
    alert("Indica o ID da visita");
    return;
  }

  window.open(`${API}/report-visit/visit/${visitId}?role=CLIENT`, "_blank");
}

function openAdminReport() {
  const visitId = getVisitId();
  if (!visitId) {
    alert("Indica o ID da visita");
    return;
  }

  window.open(`${API}/report-visit/visit/${visitId}?role=ADMIN`, "_blank");
}

document.getElementById("visitId").addEventListener("input", refreshLinks);