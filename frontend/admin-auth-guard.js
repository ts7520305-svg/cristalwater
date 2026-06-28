// ======================================================
// ADMIN AUTH GUARD — V21 FRONTEND CONTINUITY FIX
// Centralized synchronous guard. No API validation here.
// ======================================================
(function(){
  "use strict";

  try {
    if (window.CristalAuth) {
      window.CristalAuth.requireAuth("ADMIN");
      return;
    }

    const token = localStorage.getItem("cristalwater_jwt") || localStorage.getItem("token");
    const userRaw = localStorage.getItem("cristalwater_user") || localStorage.getItem("user");

    if (!token || !userRaw) {
      window.location.replace("/login");
      return;
    }

    const user = JSON.parse(userRaw || "{}");
    const role = String(user.role || "").toUpperCase().trim();

    if (role !== "ADMIN") {
      window.location.replace("/login");
      return;
    }

    localStorage.setItem("cristalwater_jwt", token);
    localStorage.setItem("token", token);
    localStorage.setItem("adminToken", token);
    localStorage.setItem("cristalwater_user", JSON.stringify(user));
    localStorage.setItem("user", JSON.stringify(user));

  } catch(err) {
    console.error("ADMIN_AUTH_GUARD_ERROR", err);
    window.location.replace("/login");
  }
})();
