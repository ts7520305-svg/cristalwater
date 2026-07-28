(function () {
  if (window.__CW_DESIGN_SYSTEM__) return;
  window.__CW_DESIGN_SYSTEM__ = true;

  function getProfile() {
    var path = (location.pathname || "").toLowerCase();
    if (path.indexOf("/admin") === 0) return "ADMIN";
    if (path.indexOf("/technician") === 0) return "TECHNICIAN";
    if (path.indexOf("/client") === 0) return "CLIENT";
    return "SHARED";
  }

  function applyProfileAttribute() {
    document.body.setAttribute("data-profile", getProfile());
  }

  function markActiveBottomNav(nav) {
    var current = (location.pathname || "").toLowerCase();
    Array.prototype.forEach.call(nav.querySelectorAll("a"), function (a) {
      var href = (a.getAttribute("href") || "").toLowerCase();
      if (href && (current === href || current.indexOf(href + "?") === 0)) {
        a.classList.add("is-active");
      }
    });
  }

  function makeBottomNav(profile) {
    var existing = document.querySelector(".ds-bottom-nav");
    if (existing) return;
    if (profile !== "TECHNICIAN" && profile !== "CLIENT") return;

    var nav = document.createElement("nav");
    nav.className = "ds-bottom-nav";
    nav.setAttribute("aria-label", profile === "TECHNICIAN" ? "Navegacao rapida tecnico" : "Navegacao rapida cliente");

    if (profile === "TECHNICIAN") {
      nav.innerHTML = [
        '<a href="/technician-field-mode">Hoje</a>',
        '<a href="/technician-route">Ronda</a>',
        '<a href="/technician-visit">Visitas</a>',
        '<a href="/technician-guide">Docs</a>',
        '<a href="/technician-profile">Perfil</a>'
      ].join("");
    } else {
      nav.innerHTML = [
        '<a href="/client-portal">Inicio</a>',
        '<a href="/client">Piscina</a>',
        '<a href="/client-history">Historico</a>',
        '<a href="/client-notifications">Pedidos</a>',
        '<a href="/client-profile">Perfil</a>'
      ].join("");
    }

    markActiveBottomNav(nav);
    document.body.appendChild(nav);
  }

  function addTableWrappers() {
    Array.prototype.forEach.call(document.querySelectorAll("table"), function (table) {
      if (table.closest(".ds-table-wrap") || table.closest(".table-wrap") || table.closest(".table-container")) return;
      var wrap = document.createElement("div");
      wrap.className = "ds-table-wrap";
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  function ensureAriaLabels() {
    Array.prototype.forEach.call(document.querySelectorAll("input,select,textarea"), function (el) {
      var labelledBy = el.getAttribute("aria-labelledby");
      var hasForLabel = !!el.id && !!document.querySelector('label[for="' + el.id + '"]');
      var wrappedLabel = !!el.closest("label");
      var hasLabel = !!el.getAttribute("aria-label") || !!labelledBy || hasForLabel || wrappedLabel;
      if (!hasLabel) {
        var placeholder = el.getAttribute("placeholder");
        var title = el.getAttribute("title");
        var name = el.getAttribute("name");
        var fallback = placeholder || title || name;
        if (fallback) el.setAttribute("aria-label", fallback);
      }
    });
  }

  function watchAriaLabels() {
    if (!window.MutationObserver || !document.body) return;
    var observer = new MutationObserver(function () {
      ensureAriaLabels();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function exposeToastApi() {
    if (window.CWDesignSystem && window.CWDesignSystem.toast) return;

    function ensureLayer() {
      var layer = document.getElementById("ds-toast-layer");
      if (layer) return layer;
      layer = document.createElement("div");
      layer.id = "ds-toast-layer";
      layer.style.position = "fixed";
      layer.style.right = "16px";
      layer.style.bottom = "76px";
      layer.style.zIndex = "80";
      layer.style.display = "grid";
      layer.style.gap = "8px";
      layer.style.maxWidth = "min(92vw, 380px)";
      document.body.appendChild(layer);
      return layer;
    }

    function toast(message, kind) {
      var layer = ensureLayer();
      var el = document.createElement("div");
      el.className = "ds-badge is-muted";
      el.style.display = "block";
      el.style.padding = "12px 14px";
      el.style.borderRadius = "12px";
      el.style.boxShadow = "0 8px 26px rgba(6, 28, 52, 0.18)";
      el.style.background = "#f3f8fc";
      el.style.color = "#12283f";
      if (kind === "error") {
        el.style.background = "#ffeef0";
        el.style.color = "#6b1d1f";
      } else if (kind === "success") {
        el.style.background = "#e8f9ef";
        el.style.color = "#145e2f";
      }
      el.textContent = String(message || "");
      layer.appendChild(el);
      setTimeout(function () {
        el.remove();
      }, 3200);
    }

    window.CWDesignSystem = window.CWDesignSystem || {};
    window.CWDesignSystem.toast = toast;
  }

  function textOf(el) {
    return String((el && el.textContent) || "").trim().toLowerCase();
  }

  function pruneAdminNavigation() {
    if (location.pathname !== "/admin-master-control") return;
    var keep = [
      "/admin-today",
      "/admin-visits",
      "/admin-alerts",
      "/admin-alerts?scope=repairs",
      "/admin-inventory",
      "/billing",
      "/admin-technicians",
      "/admin-master-control"
    ];
    Array.prototype.forEach.call(document.querySelectorAll(".cw-v2-sidebar a[href], nav a[href]"), function (a) {
      var href = (a.getAttribute("href") || "").toLowerCase();
      if (!href || href.indexOf("/admin") !== 0 && href !== "/billing") return;
      if (keep.indexOf(href) === -1) {
        a.style.display = "none";
      }
    });
  }

  function pruneTechnicianFieldMode() {
    if (location.pathname !== "/technician-field-mode") return;
    var keepSections = [
      "resumo do dia em campo",
      "acoes principais da visita",
      "registo rapido de parametros",
      "produtos utilizados",
      "fotografias da visita",
      "visita atual"
    ];
    Array.prototype.forEach.call(document.querySelectorAll("main > section, main > .section, main > article, main > div"), function (node) {
      var titleNode = node.querySelector("h2, [role='heading']");
      if (!titleNode) return;
      var t = textOf(titleNode);
      if (!t) return;
      var keep = keepSections.some(function (k) { return t.indexOf(k) !== -1; });
      if (!keep && (t.indexOf("document") !== -1 || t.indexOf("acesso") !== -1 || t.indexOf("rota") !== -1 || t.indexOf("extras") !== -1 || t.indexOf("agua aberta") !== -1 || t.indexOf("avisos") !== -1)) {
        node.style.display = "none";
      }
    });
  }

  function pruneClientNavigation() {
    if (location.pathname.indexOf("/client") !== 0) return;
    var labels = {
      "inicio": true,
      "piscina": true,
      "historico": true,
      "documentos": true,
      "pedidos": true,
      "mensagens": true,
      "perfil": true
    };
    Array.prototype.forEach.call(document.querySelectorAll("nav a, .cw-v2-sidebar a"), function (a) {
      var txt = textOf(a);
      if (!txt) return;
      if (!Object.keys(labels).some(function (k) { return txt.indexOf(k) !== -1; })) {
        if (a.closest(".ds-bottom-nav")) return;
        if (a.getAttribute("href") && a.getAttribute("href").toLowerCase().indexOf("/client") === 0) {
          a.style.opacity = "0.65";
        }
      }
    });
  }

  function init() {
    if (!document.body) return;
    applyProfileAttribute();
    makeBottomNav(getProfile());
    addTableWrappers();
    ensureAriaLabels();
    watchAriaLabels();
    exposeToastApi();
    pruneAdminNavigation();
    pruneTechnicianFieldMode();
    pruneClientNavigation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
