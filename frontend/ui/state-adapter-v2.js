(function () {
  if (window.__CW_V2_STATE_ADAPTER__) return;
  window.__CW_V2_STATE_ADAPTER__ = true;

  const ERROR_TERMS = [
    "erro",
    "error",
    "falha",
    "indisponivel",
    "nao foi possivel",
    "não foi possível",
  ];

  const LOADING_TERMS = [
    "a carregar",
    "atualizar",
    "actualizar",
    "carregar",
    "loading",
    "processando",
    "aguarde",
  ];

  const EMPTY_TERMS = [
    "sem dados",
    "sem ",
    "nenhum",
    "ainda nao existem",
    "ainda não existem",
    "vazio",
    "no data",
  ];

  function hasAnyTerm(text, terms) {
    return terms.some((term) => text.includes(term));
  }

  function hasErrorContext(node) {
    let current = node;
    for (let depth = 0; current && depth < 5; depth += 1) {
      if (current.querySelector?.('[data-tone="error"], .status-box[data-tone="error"], [data-cw-state-context="error"]')) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  function classify(node) {
    const text = String(node.textContent || "").trim().toLowerCase();
    const className = String(node.className || "").toLowerCase();
    const role = String(node.getAttribute("role") || "").toLowerCase();
    const ariaBusy = String(node.getAttribute("aria-busy") || "").toLowerCase() === "true";
    const declared = String(node.dataset.cwState || "").toLowerCase();

    if (
      declared === "error"
      || className.includes("state-error")
      || role === "alert"
      || hasAnyTerm(text, ERROR_TERMS)
    ) {
      return "error";
    }

    if (
      declared === "loading"
      || className.includes("state-loading")
      || className.includes(" loading")
      || ariaBusy
      || hasAnyTerm(text, LOADING_TERMS)
    ) {
      return "loading";
    }

    if (
      declared === "empty"
      || className.includes("state-empty")
      || className.includes(" empty")
      || hasAnyTerm(text, EMPTY_TERMS)
    ) {
      return hasErrorContext(node) ? "error" : "empty";
    }

    return null;
  }

  function applyA11y(node, kind) {
    if (kind === "error") {
      node.setAttribute("role", "alert");
      node.setAttribute("aria-live", "assertive");
      return;
    }

    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
  }

  function applyClass(node, kind) {
    node.classList.remove("cw-v2-state-loading", "cw-v2-state-empty", "cw-v2-state-error");
    if (kind === "loading") node.classList.add("cw-v2-state-loading", "loading");
    if (kind === "empty") node.classList.add("cw-v2-state-empty", "empty");
    if (kind === "error") node.classList.add("cw-v2-state-error");
    node.dataset.cwState = kind;

    const text = String(node.textContent || "").trim().toLowerCase();
    if (kind === "error" && text.startsWith("sem ")) {
      node.textContent = "Erro ao carregar dados. Tente novamente.";
    }
  }

  function normalizeNode(node) {
    if (!(node instanceof HTMLElement)) return;
    const kind = classify(node);
    if (!kind) return;

    applyClass(node, kind);
    applyA11y(node, kind);
  }

  function scan(root) {
    const scope = root || document;
    const nodes = scope.querySelectorAll(
      ".cw-v2-state-loading, .cw-v2-state-empty, .cw-v2-state-error, .empty, .empty-box, .loading, [aria-busy='true'], [data-cw-state]"
    );
    nodes.forEach(normalizeNode);
  }

  function start() {
    scan(document);

    const observer = new MutationObserver(() => {
      scan(document);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "aria-busy", "data-cw-state", "data-tone", "role"],
    });
  }

  window.CWV2StateAdapter = {
    scan,
    start,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
