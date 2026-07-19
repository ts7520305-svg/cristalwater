// ======================================================
// TECHNICIAN AUTH GUARD
// Synchronous protection for technician-only surfaces.
// ======================================================
(function(){
  "use strict";

  const root = document.documentElement;
  const previousVisibility = root.style.visibility;
  root.style.visibility = "hidden";

  function redirectForRole(role, reason) {
    const safeRole = String(role || "").toUpperCase().trim();
    if (safeRole === "ADMIN") {
      window.location.replace("/admin-master-control");
      return;
    }
    if (safeRole === "CLIENT") {
      window.location.replace("/client-portal");
      return;
    }
    const suffix = reason ? `?reason=${encodeURIComponent(reason)}` : "";
    window.location.replace(`/technician-login${suffix}`);
  }

  function decodePayload(token) {
    try {
      const chunk = String(token || "").split(".")[1] || "";
      if (!chunk) return null;
      const normalized = chunk.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(atob(normalized).split("").map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`).join(""));
      return JSON.parse(json);
    } catch (_) {
      return null;
    }
  }

  function tokenExpired(token) {
    const payload = decodePayload(token);
    if (!payload || typeof payload.exp !== "number") return true;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now;
  }

  try {
    const token = localStorage.getItem("cristalwater_jwt") || localStorage.getItem("token");
    const userRaw = localStorage.getItem("cristalwater_user") || localStorage.getItem("user");

    if (!token || !userRaw) {
      redirectForRole("", "no_session");
      return;
    }

    if (String(token).split(".").length !== 3) {
      ["cristalwater_jwt", "cristalwater_user", "token", "user", "adminToken"].forEach((key) => localStorage.removeItem(key));
      redirectForRole("", "invalid_token");
      return;
    }

    if (tokenExpired(token)) {
      ["cristalwater_jwt", "cristalwater_user", "token", "user", "adminToken"].forEach((key) => localStorage.removeItem(key));
      redirectForRole("", "session_expired");
      return;
    }

    const user = JSON.parse(userRaw || "{}");
    const role = String(user.role || "").toUpperCase().trim();

    if (role !== "TECHNICIAN") {
      redirectForRole(role, "forbidden");
      return;
    }

    localStorage.setItem("cristalwater_jwt", token);
    localStorage.setItem("token", token);
    localStorage.setItem("cristalwater_user", JSON.stringify(user));
    localStorage.setItem("user", JSON.stringify(user));
    root.style.visibility = previousVisibility;
  } catch (err) {
    console.error("TECHNICIAN_AUTH_GUARD_ERROR", err);
    redirectForRole("", "guard_error");
  }
})();
