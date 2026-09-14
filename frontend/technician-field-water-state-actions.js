(function () {
  const ns = window.CwFieldWaterState = window.CwFieldWaterState || {};
  if (ns.actionsReady) return;
  ns.actionsReady = true;

  const $ = (selector) => document.querySelector(selector);

  ns.toast = function toast(message) {
    const node = $("#toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    window.setTimeout(() => node.classList.remove("show"), 2400);
  };

  ns.currentVisitState = function currentVisitState() {
    const state = ns.readStorage("cw:tech-field:ui-state:v1", {});
    return {
      visitId: state?.selectedVisitId ? String(state.selectedVisitId) : "",
      poolName: String(state?.selectedVisitTitle || $("#nextTitle")?.textContent || "Piscina").trim(),
    };
  };

  ns.currentClientName = function currentClientName() {
    const raw = String($("#nextMeta")?.textContent || "").trim();
    return raw ? (raw.split(" - ")[0].trim() || "Cliente") : "Cliente";
  };

  ns.currentLocation = function currentLocation() {
    return String($("#routeMeta")?.textContent || "").replace(/\s+/g, " ").trim();
  };

  ns.selectedFlowState = function selectedFlowState() {
    const value = String($("#waterFlowState")?.value || "FULL").toUpperCase();
    return ns.FLOW[value] ? value : "FULL";
  };

  ns.openWater = async function openWater() {
    const visit = ns.currentVisitState();
    if (!visit.visitId) {
      ns.toast("Seleciona uma piscina antes de marcar água aberta.");
      return;
    }

    const state = ns.selectedFlowState();
    const note = String($("#waterNote")?.value || "").trim();
    const createdAt = new Date();
    const safetyMinutes = ns.safetyMinutes();
    const dueAt = new Date(createdAt.getTime() + safetyMinutes * 60 * 1000);
    const localId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const techId = ns.technicianId();
    const user = ns.authUser();
    const encodedNote = `[Caudal: ${state}]${note ? ` ${note}` : ""}`;

    const reminder = {
      localId,
      status: "OPEN",
      alerted: false,
      visitId: visit.visitId,
      poolName: visit.poolName || "Piscina",
      clientName: ns.currentClientName(),
      location: ns.currentLocation(),
      technicianId: techId === "sem-tecnico" ? null : techId,
      technicianName: String(user?.name || "").trim(),
      flowState: state,
      userNote: note,
      note: encodedNote,
      createdAt: createdAt.toISOString(),
      dueAt: dueAt.toISOString(),
      reminderMode: "SYSTEM_SAFETY",
      safetyMinutes,
      source: "technician-field-water-state-v2",
    };

    ns.addLocalReminder(reminder);
    ns.decorateWaterUi?.();
    ns.toast("Água aberta registada. O aviso fica ativo até confirmares o fecho.");

    try {
      const data = await ns.api("/api/technician/water-reminders", {
        method: "POST",
        body: JSON.stringify(reminder),
      });
      ns.updateLocalReminder(localId, (item) => {
        item.serverId = data.reminder?.id || data.id || null;
        item.notificationId = data.notification?.id || null;
        item.syncError = "";
        item.syncedAt = new Date().toISOString();
      });
    } catch (error) {
      ns.updateLocalReminder(localId, (item) => {
        item.syncError = error.message || "Sem ligação ao servidor";
      });
    }

    const noteField = $("#waterNote");
    if (noteField) noteField.value = "";
    window.setTimeout(() => window.location.reload(), 120);
  };

  ns.closeWater = async function closeWater(localId) {
    const reminder = ns.activeReminder(localId);
    if (!reminder) return;
    if (!window.confirm("Confirma que a torneira está totalmente fechada?")) return;

    const closedAt = new Date().toISOString();
    const updated = ns.updateLocalReminder(localId, (item) => {
      item.status = "CLOSED";
      item.closedAt = closedAt;
      item.closeConfirmed = true;
      item.closeConfirmedBy = ns.authUser()?.name || "Técnico";
      item.closeDurationMinutes = Math.max(0, Math.round((Date.now() - new Date(item.createdAt || Date.now()).getTime()) / 60000));
    });

    ns.decorateWaterUi?.();
    ns.toast("Água fechada confirmada.");

    try {
      await ns.api(`/api/technician/water-reminders/${encodeURIComponent(updated?.serverId || localId)}/close`, {
        method: "POST",
        body: JSON.stringify(updated || reminder),
      });
      ns.updateLocalReminder(localId, (item) => {
        item.syncError = "";
        item.closeSyncedAt = new Date().toISOString();
      });
    } catch (error) {
      ns.updateLocalReminder(localId, (item) => {
        item.syncError = error.message || "Fecho pendente de sincronização";
      });
    }

    window.setTimeout(() => window.location.reload(), 120);
  };
})();
