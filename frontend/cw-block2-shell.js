(function () {
  function addShellClass() {
    document.body.classList.add("cw-block2-shell");
  }

  function addStatusNode() {
    if (document.querySelector(".cw-block2-status")) return;
    const main = document.querySelector("main") || document.body;
    const status = document.createElement("p");
    status.className = "cw-block2-status";
    status.id = "cwBlock2Status";
    status.setAttribute("aria-live", "polite");
    status.textContent = "Pagina pronta para leitura segura.";
    main.insertBefore(status, main.firstChild || null);
  }

  function markRequiredLabels() {
    document.querySelectorAll("label").forEach((label) => {
      const text = (label.textContent || "").trim();
      if (!text) return;
      if (label.querySelector(".cw-required")) return;
      const targetId = label.getAttribute("for");
      const input = targetId ? document.getElementById(targetId) : label.querySelector("input,select,textarea");
      if (input && input.hasAttribute("required")) {
        const mark = document.createElement("span");
        mark.className = "cw-required";
        mark.textContent = " *";
        mark.style.color = "#b22f3d";
        label.appendChild(mark);
      }
    });
  }

  function protectDoubleClick() {
    document.querySelectorAll("button, .btn").forEach((button) => {
      if (button.dataset.cwBound === "1") return;
      button.dataset.cwBound = "1";
      button.addEventListener("click", function () {
        if (this.disabled) return;
        this.dataset.cwOriginalText = this.textContent;
        this.disabled = true;
        setTimeout(() => {
          this.disabled = false;
          if (this.dataset.cwOriginalText) this.textContent = this.dataset.cwOriginalText;
        }, 1200);
      });
    });
  }

  function addUnsavedGuard() {
    const form = document.querySelector("form");
    if (!form) return;
    let dirty = false;
    form.querySelectorAll("input,select,textarea").forEach((input) => {
      input.addEventListener("input", () => {
        dirty = true;
      });
    });
    window.addEventListener("beforeunload", (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
    form.addEventListener("submit", () => {
      dirty = false;
    });
  }

  function applyTableLabels() {
    document.querySelectorAll("table").forEach((table) => {
      const headers = Array.from(table.querySelectorAll("thead th")).map((th) => (th.textContent || "").trim());
      if (!headers.length) return;
      table.querySelectorAll("tbody tr").forEach((tr) => {
        Array.from(tr.children).forEach((td, idx) => {
          if (td.tagName !== "TD") return;
          if (!td.getAttribute("data-label") && headers[idx]) td.setAttribute("data-label", headers[idx]);
        });
      });
    });
  }

  function enforceAuthHint() {
    const role = (document.body.dataset.cwRole || "").toUpperCase();
    if (!role) return;

    const loginByRole = {
      CLIENT: "/client-login",
      TECHNICIAN: "/login",
      ADMIN: "/login",
    };

    if (!window.CristalAuth) {
      const raw = localStorage.getItem("cristalwater_jwt") || localStorage.getItem("token") || "";
      if (String(raw).trim().length < 8) {
        window.location.replace(loginByRole[role] || "/login");
      }
      return;
    }

    if (!window.CristalAuth.hydrate || !window.CristalAuth.hydrate()) {
      window.location.replace(loginByRole[role] || "/login");
      return;
    }

    const user = window.CristalAuth.parseUser ? window.CristalAuth.parseUser() : {};
    const currentRole = String(user.role || "").toUpperCase().trim();
    if (role && currentRole && currentRole !== role && !(role === "TECHNICIAN" && currentRole === "ADMIN")) {
      window.location.replace(loginByRole[role] || "/login");
      return;
    }

    if (window.CristalAuth.requireAuth) window.CristalAuth.requireAuth(role);
  }

  function boot() {
    addShellClass();
    addStatusNode();
    markRequiredLabels();
    protectDoubleClick();
    addUnsavedGuard();
    applyTableLabels();
    enforceAuthHint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();