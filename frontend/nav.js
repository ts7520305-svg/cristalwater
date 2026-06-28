function renderNav(active) {
  const nav = document.createElement("div");
  nav.className = "top-nav";

  nav.innerHTML = `
    <a href="/frontend/admin-dashboard.html" class="${active === "dashboard" ? "active" : ""}">Dashboard</a>
    <a href="/frontend/admin-collection.html" class="${active === "collection" ? "active" : ""}">Cobrança</a>
    <a href="/frontend/admin-payments.html" class="${active === "payments" ? "active" : ""}">Pagamentos</a>
    <a href="/frontend/admin-payment-settings.html" class="${active === "settings" ? "active" : ""}">Configuração</a>
  `;

  document.body.insertBefore(nav, document.body.firstChild);
}