// ==========================================
// LOGOUT CLIENTE / ADMIN (JWT)
// ==========================================

function logoutClient() {
  // Remover token e dados locais
  localStorage.removeItem("authToken");
  localStorage.removeItem("clientId");
  localStorage.removeItem("clientName");
  localStorage.removeItem("admin");

  // Redirecionar para login
  window.location.href = "/frontend/client-login.html";
}