// ======================================================
// ADMIN LOGOUT — V21
// ======================================================
(function(){
  if (window.CristalAuth) {
    window.CristalAuth.clearSession();
  } else {
    ["cristalwater_jwt","cristalwater_user","token","user","adminToken"].forEach(k => localStorage.removeItem(k));
  }
  window.location.replace("/login");
})();
