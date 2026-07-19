(function initCwUi(global) {
  "use strict";

  const STYLE_ID = "cw-ui-feedback-style";
  const HOST_ID = "cw-ui-feedback-host";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".cw-ui-host { position: fixed; inset: 0; pointer-events: none; z-index: 9998; }",
      ".cw-ui-toast-stack { position: fixed; right: 16px; top: 16px; display: grid; gap: 10px; z-index: 9999; max-width: min(92vw, 420px); }",
      ".cw-ui-toast { pointer-events: auto; border-radius: 12px; padding: 12px 14px; border: 1px solid; color: #eaf5ff; background: #0f243a; box-shadow: 0 14px 34px rgba(0,0,0,.28); font: 600 14px/1.35 Inter, Segoe UI, Arial, sans-serif; }",
      ".cw-ui-toast-ok { border-color: rgba(64,230,160,.45); background: #113426; }",
      ".cw-ui-toast-error { border-color: rgba(255,107,107,.45); background: #3c1620; }",
      ".cw-ui-toast-info { border-color: rgba(125,211,252,.5); background: #102940; }",
      ".cw-ui-modal-backdrop { position: fixed; inset: 0; background: rgba(1,6,17,.7); display: grid; place-items: center; padding: 14px; pointer-events: auto; }",
      ".cw-ui-modal { width: min(100%, 520px); border-radius: 16px; background: #0a1d31; border: 1px solid #2e4f72; color: #eaf5ff; box-shadow: 0 24px 60px rgba(0,0,0,.4); }",
      ".cw-ui-modal-head { padding: 14px 16px 6px; font: 800 18px/1.2 Inter, Segoe UI, Arial, sans-serif; }",
      ".cw-ui-modal-body { padding: 0 16px 14px; font: 500 14px/1.45 Inter, Segoe UI, Arial, sans-serif; color: #bcd4e8; white-space: pre-wrap; }",
      ".cw-ui-modal-input { width: calc(100% - 32px); margin: 2px 16px 12px; padding: 10px 11px; border-radius: 10px; border: 1px solid #2e4f72; background: #082238; color: #eaf5ff; }",
      ".cw-ui-modal-actions { padding: 0 16px 16px; display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }",
      ".cw-ui-btn { border: 0; border-radius: 10px; cursor: pointer; min-height: 40px; padding: 10px 14px; font: 700 13px/1 Inter, Segoe UI, Arial, sans-serif; }",
      ".cw-ui-btn-muted { color: #d3e6f6; background: #1e3a57; }",
      ".cw-ui-btn-danger { color: #ffe6ea; background: #8b2434; }",
      ".cw-ui-btn-primary { color: #062034; background: linear-gradient(135deg,#35d1ff,#80e3ff); }",
      "@media (max-width: 540px) { .cw-ui-modal-actions { justify-content: stretch; } .cw-ui-btn { flex: 1 1 auto; } }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function host() {
    let el = document.getElementById(HOST_ID);
    if (el) return el;
    injectStyle();
    el = document.createElement("div");
    el.id = HOST_ID;
    el.className = "cw-ui-host";
    el.innerHTML = '<div class="cw-ui-toast-stack" aria-live="polite" aria-atomic="true"></div>';
    document.body.appendChild(el);
    return el;
  }

  function normalizeMessage(message, fallback) {
    const raw = String(message || "").trim();
    if (!raw) return fallback || "Ocorreu um erro. Tenta novamente.";
    const lower = raw.toLowerCase();
    if (lower.includes("prisma") || lower.includes("sql") || lower.includes("stack") || lower.includes("invalid `") || lower.includes("p20") || lower.includes("errno") || lower.includes("econn") || lower.includes("syntaxerror") || lower.includes("typeerror") || lower.includes("referenceerror")) {
      return fallback || "Nao foi possivel concluir a operacao. Verifica os dados e tenta novamente.";
    }
    return raw;
  }

  function safeError(error, fallback) {
    return normalizeMessage(error && (error.userMessage || error.message || error.error), fallback || "Nao foi possivel concluir a operacao.");
  }

  function toast(message, type) {
    const stack = host().querySelector(".cw-ui-toast-stack");
    const item = document.createElement("div");
    const tone = type === "ok" ? "cw-ui-toast-ok" : type === "error" ? "cw-ui-toast-error" : "cw-ui-toast-info";
    item.className = `cw-ui-toast ${tone}`;
    item.textContent = normalizeMessage(message, "Operacao concluida.");
    stack.appendChild(item);
    setTimeout(() => item.remove(), 3300);
  }

  function closeBackdrop(backdrop, resolver, value) {
    backdrop.remove();
    resolver(value);
  }

  function openDialog(opts) {
    return new Promise((resolve) => {
      const h = host();
      const backdrop = document.createElement("div");
      backdrop.className = "cw-ui-modal-backdrop";
      backdrop.setAttribute("role", "presentation");

      const panel = document.createElement("div");
      panel.className = "cw-ui-modal";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-label", opts.title || "Confirmacao");

      const title = document.createElement("div");
      title.className = "cw-ui-modal-head";
      title.textContent = opts.title || "Confirmacao";

      const body = document.createElement("div");
      body.className = "cw-ui-modal-body";
      body.textContent = normalizeMessage(opts.message, "Confirma esta operacao?");

      panel.appendChild(title);
      panel.appendChild(body);

      let input = null;
      if (opts.withInput) {
        input = document.createElement("input");
        input.className = "cw-ui-modal-input";
        input.type = "text";
        input.value = opts.defaultValue || "";
        input.placeholder = opts.placeholder || "";
        panel.appendChild(input);
      }

      const actions = document.createElement("div");
      actions.className = "cw-ui-modal-actions";

      const cancel = document.createElement("button");
      cancel.className = "cw-ui-btn cw-ui-btn-muted";
      cancel.type = "button";
      cancel.textContent = opts.cancelText || "Cancelar";
      cancel.addEventListener("click", () => closeBackdrop(backdrop, resolve, null));

      const accept = document.createElement("button");
      accept.className = `cw-ui-btn ${opts.danger ? "cw-ui-btn-danger" : "cw-ui-btn-primary"}`;
      accept.type = "button";
      accept.textContent = opts.confirmText || "Confirmar";
      accept.addEventListener("click", () => closeBackdrop(backdrop, resolve, input ? input.value : true));

      actions.appendChild(cancel);
      actions.appendChild(accept);
      panel.appendChild(actions);
      backdrop.appendChild(panel);
      h.appendChild(backdrop);

      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) closeBackdrop(backdrop, resolve, null);
      });
      panel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeBackdrop(backdrop, resolve, null);
        }
        if (event.key === "Enter") {
          event.preventDefault();
          closeBackdrop(backdrop, resolve, input ? input.value : true);
        }
      });

      setTimeout(() => {
        if (input) input.focus();
        else accept.focus();
      }, 0);
    });
  }

  const api = {
    safeError,
    info(message) { toast(message, "info"); },
    success(message) { toast(message, "ok"); },
    error(message) { toast(message, "error"); },
    confirm(message, opts = {}) {
      return openDialog({ ...opts, message, withInput: false });
    },
    prompt(message, opts = {}) {
      return openDialog({ ...opts, message, withInput: true });
    }
  };

  global.CwUi = api;
})(window);
