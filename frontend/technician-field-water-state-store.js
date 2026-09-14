(function () {
  const ns = window.CwFieldWaterState = window.CwFieldWaterState || {};
  if (ns.storeReady) return;
  ns.storeReady = true;

  ns.FLOW = {
    DRIP: { label: "A pingar" },
    HALF: { label: "Meia aberta" },
    FULL: { label: "Totalmente aberta" },
  };
  ns.DEFAULT_SAFETY_MINUTES = 120;

  ns.safeJson = function safeJson(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  };

  ns.readStorage = function readStorage(key, fallback) {
    try { return ns.safeJson(localStorage.getItem(key), fallback); } catch (_) { return fallback; }
  };

  ns.writeStorage = function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  };

  ns.authUser = function authUser() {
    try {
      if (window.CristalAuth?.parseUser) return window.CristalAuth.parseUser() || {};
    } catch (_) {}
    return ns.safeJson(localStorage.getItem("cristalwater_user") || localStorage.getItem("user"), {});
  };

  ns.technicianId = function technicianId() {
    const query = new URLSearchParams(window.location.search || "").get("technicianId");
    const user = ns.authUser();
    return String(query || localStorage.getItem("cwTechnicianId") || user.technicianId || user.id || "sem-tecnico").trim() || "sem-tecnico";
  };

  ns.storageKey = function storageKey() {
    return `cwWaterReminders:${ns.technicianId()}`;
  };

  ns.reminders = function reminders() {
    const rows = ns.readStorage(ns.storageKey(), []);
    return Array.isArray(rows) ? rows : [];
  };

  ns.saveReminders = function saveReminders(rows) {
    return ns.writeStorage(ns.storageKey(), (Array.isArray(rows) ? rows : []).slice(-100));
  };

  ns.activeReminder = function activeReminder(localId) {
    return ns.reminders().find((item) => String(item.localId || "") === String(localId || "")) || null;
  };

  ns.updateLocalReminder = function updateLocalReminder(localId, updater) {
    const rows = ns.reminders();
    const index = rows.findIndex((item) => String(item.localId || "") === String(localId || ""));
    if (index < 0) return null;
    const next = { ...rows[index] };
    updater(next);
    rows[index] = next;
    ns.saveReminders(rows);
    return next;
  };

  ns.addLocalReminder = function addLocalReminder(reminder) {
    const rows = ns.reminders().filter((item) => String(item.localId || "") !== String(reminder.localId || ""));
    rows.push(reminder);
    ns.saveReminders(rows);
  };

  ns.safetyMinutes = function safetyMinutes() {
    const raw = Number(localStorage.getItem("cwWaterSafetyMinutes"));
    if (Number.isFinite(raw) && raw >= 15 && raw <= 1440) return Math.round(raw);
    return ns.DEFAULT_SAFETY_MINUTES;
  };

  ns.flowLabel = function flowLabel(value) {
    return ns.FLOW[String(value || "").toUpperCase()]?.label || "Estado por confirmar";
  };

  ns.elapsedLabel = function elapsedLabel(value) {
    const started = new Date(value || 0);
    if (Number.isNaN(started.getTime())) return "tempo por confirmar";
    const totalMinutes = Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000));
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours < 24) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  ns.flowFromReminder = function flowFromReminder(reminder) {
    if (reminder?.flowState && ns.FLOW[String(reminder.flowState).toUpperCase()]) return String(reminder.flowState).toUpperCase();
    const match = String(reminder?.note || "").match(/^\[Caudal:\s*(DRIP|HALF|FULL)\]/i);
    return match ? match[1].toUpperCase() : "";
  };

  ns.userNote = function userNote(reminder) {
    if (reminder?.userNote !== undefined) return String(reminder.userNote || "").trim();
    return String(reminder?.note || "").replace(/^\[Caudal:\s*(DRIP|HALF|FULL)\]\s*/i, "").trim();
  };

  ns.api = async function api(path, options = {}) {
    const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || data.message || "Erro no servidor");
    return data;
  };

  ns.retryPendingSync = async function retryPendingSync() {
    if (!navigator.onLine) return;
    const rows = ns.reminders();
    let changed = false;
    for (const reminder of rows) {
      if (!reminder?.localId) continue;
      if (reminder.status === "CLOSED" && reminder.syncError) {
        try {
          await ns.api(`/api/technician/water-reminders/${encodeURIComponent(reminder.serverId || reminder.localId)}/close`, { method: "POST", body: JSON.stringify(reminder) });
          reminder.syncError = "";
          reminder.closeSyncedAt = new Date().toISOString();
          changed = true;
        } catch (_) {}
      } else if (reminder.status !== "CLOSED" && !reminder.serverId && reminder.syncError) {
        try {
          const data = await ns.api("/api/technician/water-reminders", { method: "POST", body: JSON.stringify(reminder) });
          reminder.serverId = data.reminder?.id || data.id || null;
          reminder.notificationId = data.notification?.id || null;
          reminder.syncError = "";
          reminder.syncedAt = new Date().toISOString();
          changed = true;
        } catch (_) {}
      }
    }
    if (changed) ns.saveReminders(rows);
  };
})();
