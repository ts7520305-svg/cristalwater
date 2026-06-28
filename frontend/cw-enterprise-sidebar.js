// Cristal Water LDA - sidebar global estavel.
(function () {
  "use strict";

  if (window.__CW_PROD_SIDEBAR__) return;
  window.__CW_PROD_SIDEBAR__ = true;

  const path = String(location.pathname || "").replace(/\.html$/i, "").toLowerCase();
  const pinnedKey = "cw_sidebar_pinned";
  const publicPaths = ["/", "/login", "/admin-login", "/client-login", "/technician-login"];
  const adminArea =
    path.includes("admin") ||
    path.includes("billing") ||
    path.includes("invoice") ||
    path.includes("to-issue") ||
    path.includes("report") ||
    path.includes("dashboard") ||
    path.includes("communications") ||
    path.includes("help-center");

  if (publicPaths.includes(path) || !adminArea || document.querySelector(".cw-side")) return;

  if (localStorage.getItem(pinnedKey) === "1") {
    document.body.classList.add("cw-sidebar-pinned");
  } else {
    document.body.classList.add("cw-sidebar-compact");
  }

  const style = document.createElement("style");
  style.id = "cw-enterprise-sidebar-style";
  style.textContent = `
    :root {
      --cw-sidebar-width: 285px;
      --cw-sidebar-collapsed-width: 60px;
    }

    body.cw-with-sidebar {
      padding-left: var(--cw-sidebar-collapsed-width) !important;
      transition: none !important;
    }

    body.cw-sidebar-pinned {
      padding-left: var(--cw-sidebar-width) !important;
    }

    .cw-side {
      box-sizing: border-box !important;
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      bottom: 0 !important;
      width: var(--cw-sidebar-collapsed-width) !important;
      height: 100dvh !important;
      z-index: 9000 !important;
      overflow-y: hidden !important;
      overflow-x: hidden !important;
      scrollbar-gutter: stable !important;
      background: #06111f !important;
      border-right: 1px solid rgba(71, 211, 255, .22) !important;
      border-radius: 0 !important;
      padding: 10px !important;
      color: #eaf7ff !important;
      font-family: Inter, Segoe UI, Arial, sans-serif !important;
      box-shadow: 12px 0 40px rgba(0, 0, 0, .22) !important;
      contain: layout style paint;
      transition: width .16s ease !important;
    }

    body.cw-sidebar-pinned .cw-side {
      width: var(--cw-sidebar-width) !important;
      padding: 14px !important;
      overflow-y: auto !important;
    }

    .cw-side *,
    .cw-side *::before,
    .cw-side *::after {
      box-sizing: border-box;
    }

    .cw-side-brand {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 10px !important;
      min-height: 54px !important;
      margin: 0 0 14px !important;
      padding: 10px 8px !important;
      color: #fff !important;
      font-size: 16px !important;
    }

    .cw-side-brand b {
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    body.cw-sidebar-compact .cw-side nav,
    body.cw-sidebar-compact .cw-side .cw-side-brand b,
    body.cw-sidebar-compact .cw-side .cw-side-section,
    body.cw-sidebar-compact .cw-side a span {
      display: none !important;
    }

    body.cw-sidebar-compact .cw-side .cw-side-brand {
      justify-content: center !important;
      min-height: 46px !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .cw-side-toggle {
      width: 40px !important;
      height: 40px !important;
      flex: 0 0 40px !important;
      border: 1px solid rgba(125, 211, 252, .3) !important;
      background: #0c2238 !important;
      color: #eaf7ff !important;
      border-radius: 10px !important;
      padding: 0 !important;
      cursor: pointer !important;
      font-weight: 900 !important;
    }

    .cw-side-section {
      min-height: 18px !important;
      margin: 10px 0 6px !important;
      color: #7dd3fc !important;
      font-size: 11px !important;
      font-weight: 900 !important;
      text-transform: uppercase !important;
      letter-spacing: .08em !important;
    }

    .cw-side nav {
      display: grid !important;
      gap: 3px !important;
    }

    .cw-side a {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      min-height: 40px !important;
      margin: 0 !important;
      padding: 10px 11px !important;
      border: 1px solid transparent !important;
      border-radius: 12px !important;
      color: #d9f2ff !important;
      font-size: 14px !important;
      font-weight: 750 !important;
      line-height: 1.2 !important;
      text-decoration: none !important;
      white-space: nowrap !important;
    }

    .cw-side a:hover,
    .cw-side a.active {
      background: rgba(34, 211, 238, .16) !important;
      border-color: rgba(34, 211, 238, .28) !important;
      color: #fff !important;
    }

    .cw-side a span {
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    .cw-side a strong {
      width: 8px !important;
      height: 8px !important;
      flex: 0 0 8px !important;
      border-radius: 999px !important;
      background: rgba(125, 211, 252, .58) !important;
      color: transparent !important;
      font-size: 0 !important;
      line-height: 0 !important;
      box-shadow: 0 0 16px rgba(53, 217, 255, .14) !important;
    }

    .cw-side a.active strong {
      background: #27f5a7 !important;
      box-shadow: 0 0 18px rgba(39, 245, 167, .38) !important;
    }

    @media (max-width: 900px) {
      body.cw-with-sidebar {
        padding-left: 0 !important;
        padding-bottom: 74px !important;
      }

      .cw-side {
        display: block !important;
        width: min(325px, calc(100vw - 38px)) !important;
        max-width: calc(100vw - 38px) !important;
        height: 100dvh !important;
        padding: 14px !important;
        overflow-y: auto !important;
        transform: translateX(calc(-100% - 18px)) !important;
        transition: transform .2s ease !important;
        box-shadow: 22px 0 70px rgba(0, 0, 0, .48) !important;
      }

      body.cw-mobile-sidebar-open .cw-side {
        transform: translateX(0) !important;
      }

      body.cw-mobile-sidebar-open {
        overflow: hidden !important;
      }

      body.cw-sidebar-compact .cw-side nav,
      body.cw-sidebar-compact .cw-side .cw-side-section,
      body.cw-sidebar-compact .cw-side .cw-side-brand b,
      body.cw-sidebar-compact .cw-side a span {
        display: grid !important;
      }

      body.cw-sidebar-compact .cw-side .cw-side-brand {
        justify-content: space-between !important;
        min-height: 54px !important;
        margin: 0 0 14px !important;
        padding: 10px 8px !important;
      }

      body.cw-sidebar-compact .cw-side .cw-side-brand b {
        display: block !important;
      }

      body.cw-sidebar-compact .cw-side a span {
        display: inline !important;
      }

      .cw-mobile-menu-toggle {
        position: fixed !important;
        left: 12px !important;
        bottom: 12px !important;
        z-index: 8999 !important;
        min-width: 112px !important;
        min-height: 52px !important;
        border: 1px solid rgba(125, 211, 252, .38) !important;
        border-radius: 14px !important;
        background: linear-gradient(135deg, #2ed3ff, #4f8dff) !important;
        color: #061321 !important;
        font: 900 15px Inter, Segoe UI, Arial, sans-serif !important;
        box-shadow: 0 16px 45px rgba(0, 0, 0, .32) !important;
      }

      .cw-mobile-sidebar-backdrop {
        position: fixed !important;
        inset: 0 !important;
        z-index: 8998 !important;
        background: rgba(0, 0, 0, .48) !important;
        backdrop-filter: blur(4px) !important;
        display: none !important;
      }

      body.cw-mobile-sidebar-open .cw-mobile-sidebar-backdrop {
        display: block !important;
      }
    }

    @media (min-width: 901px) {
      .cw-mobile-menu-toggle,
      .cw-mobile-sidebar-backdrop {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);

  const groups = [
    ["Operacao", [
      ["Dashboard", "/admin-dashboard", "DA"],
      ["Centro de Operacoes", "/admin-master-control", "CO"],
      ["Command Center", "/admin-command-center", "CC"],
      ["Hoje", "/admin-today", "HJ"],
      ["Mapa Live", "/admin-live-map", "MP"],
    ]],
    ["Clientes e Piscinas", [
      ["Entrada guiada", "/admin-onboarding.html", "EG"],
      ["Clientes", "/admin-clients", "CL"],
      ["Piscinas", "/admin-pools", "PI"],
      ["Chaves", "/admin-keys", "CH"],
      ["Portal do Cliente", "/client-portal", "PC"],
      ["Alertas", "/admin-alerts", "AL"],
    ]],
    ["Equipa e Servico", [
      ["Tecnicos", "/admin-technicians", "TE"],
      ["Rondas", "/admin-rounds", "RO"],
      ["Visitas", "/admin-visits", "VI"],
      ["Registo diario", "/admin-service-log", "RD"],
      ["Portal Tecnico", "/technician-field-mode", "PT"],
    ]],
    ["Gestao", [
      ["Stock", "/admin-inventory", "ST"],
      ["Viaturas e Guias", "/admin-vehicles", "VG"],
      ["Financeiro", "/billing", "FI"],
      ["Pagamentos", "/admin-payments", "PG"],
      ["Faturas", "/invoices", "FT"],
      ["Faturacao Oficial", "/to-issue", "FO"],
    ]],
    ["Organizacao", [
      ["Lembretes e Agendamentos", "/admin-crm", "AG"],
      ["Relatorios", "/admin-reports", "RE"],
      ["Comunicacoes", "/communications", "CM"],
      ["Ajuda", "/help-center", "?"],
    ]],
    ["Sistema", [
      ["Configuracoes", "/admin-operational-settings", "CF"],
      ["Visual", "/admin-ui-settings", "UI"],
      ["Seguranca", "/admin-security", "SG"],
      ["Notificacoes", "/admin-notifications", "NO"],
    ]],
  ];

  const sidebar = document.createElement("aside");
  sidebar.className = "cw-side";
  sidebar.setAttribute("aria-label", "Menu principal Cristal Water");
  sidebar.innerHTML =
    `<div class="cw-side-brand"><b>Cristal Water LDA</b><button type="button" class="cw-side-toggle" title="Menu" aria-label="Fixar ou minimizar menu" aria-pressed="${localStorage.getItem(pinnedKey) === "1" ? "true" : "false"}">&#9776;</button></div>` +
    groups
      .map(([title, items]) => (
        `<div class="cw-side-section">${title}</div><nav>` +
        items
          .map(([label, href, icon]) => {
            const active = path === href.replace(/\.html$/i, "").toLowerCase() ? " active" : "";
            return `<a href="${href}" class="${active}"><strong>${icon}</strong><span>${label}</span></a>`;
          })
          .join("") +
        `</nav>`
      ))
      .join("");

  document.body.prepend(sidebar);
  document.body.classList.add("cw-with-sidebar");

  const mobileButton = document.createElement("button");
  mobileButton.type = "button";
  mobileButton.className = "cw-mobile-menu-toggle";
  mobileButton.textContent = "Menu";
  mobileButton.setAttribute("aria-label", "Abrir menu");
  mobileButton.setAttribute("aria-expanded", "false");

  const mobileBackdrop = document.createElement("div");
  mobileBackdrop.className = "cw-mobile-sidebar-backdrop";
  mobileBackdrop.hidden = true;
  document.body.append(mobileBackdrop, mobileButton);

  function setMobileMenu(open) {
    document.body.classList.toggle("cw-mobile-sidebar-open", open);
    mobileButton.setAttribute("aria-expanded", open ? "true" : "false");
    mobileButton.textContent = open ? "Fechar" : "Menu";
    mobileBackdrop.hidden = !open;
  }

  sidebar.querySelector(".cw-side-toggle").addEventListener("click", () => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      setMobileMenu(!document.body.classList.contains("cw-mobile-sidebar-open"));
      return;
    }
    const pinned = !document.body.classList.contains("cw-sidebar-pinned");
    const button = sidebar.querySelector(".cw-side-toggle");
    document.body.classList.toggle("cw-sidebar-pinned", pinned);
    document.body.classList.toggle("cw-sidebar-compact", !pinned);
    localStorage.setItem(pinnedKey, pinned ? "1" : "0");
    button.setAttribute("aria-pressed", pinned ? "true" : "false");
    if (!pinned) button.blur();
  });

  mobileButton.addEventListener("click", () => {
    setMobileMenu(!document.body.classList.contains("cw-mobile-sidebar-open"));
  });
  mobileBackdrop.addEventListener("click", () => setMobileMenu(false));
  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMobileMenu(false));
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMobileMenu(false);
  });
  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 900px)").matches) setMobileMenu(false);
  });
})();
