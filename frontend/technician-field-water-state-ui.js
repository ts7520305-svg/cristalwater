(function () {
  const ns = window.CwFieldWaterState = window.CwFieldWaterState || {};
  if (ns.uiReady) return;
  ns.uiReady = true;

  const $ = (selector, root = document) => root.querySelector(selector);

  ns.enhanceWaterForm = function enhanceWaterForm() {
    const card = $(".water-card");
    const grid = card?.querySelector(".water-grid");
    const note = $("#waterNote");
    if (!card || !grid || !note) return false;

    [$("#waterMinutes"), $("#waterCloseTime")].filter(Boolean).forEach((node) => {
      node.hidden = true;
      node.tabIndex = -1;
      node.setAttribute("aria-hidden", "true");
      node.value = "";
    });

    if (!$("#waterFlowState")) {
      const select = document.createElement("select");
      select.id = "waterFlowState";
      select.setAttribute("aria-label", "Estado da torneira ou caudal");
      select.innerHTML = `
        <option value="DRIP">A pingar</option>
        <option value="HALF">Meia aberta</option>
        <option value="FULL" selected>Totalmente aberta</option>
      `;
      grid.insertBefore(select, note);
    }

    note.placeholder = "Nota opcional. Ex: encher até meio do skimmer";

    let helper = card.querySelector("[data-water-state-helper]");
    if (!helper) {
      helper = document.createElement("div");
      helper.dataset.waterStateHelper = "1";
      helper.className = "muted";
      helper.style.marginTop = "10px";
      const legacyHelper = card.querySelector(":scope > .muted");
      if (legacyHelper) legacyHelper.replaceWith(helper);
      else card.insertBefore(helper, grid);
    }
    helper.textContent = "Indica como ficou a água. O aviso mantém-se ativo até confirmares que a torneira está fechada; o tempo é contado automaticamente.";
    return true;
  };

  function decorateWaterCardItem(node, reminder) {
    if (!node || !reminder) return;
    const mainTime = node.querySelector(".doc-number");
    if (mainTime) mainTime.textContent = `Água aberta há ${ns.elapsedLabel(reminder.createdAt)}`;

    let detail = node.querySelector("[data-water-flow-detail]");
    if (!detail) {
      detail = document.createElement("div");
      detail.dataset.waterFlowDetail = "1";
      detail.className = "muted";
      const line = node.querySelector(".water-line");
      if (line) line.insertAdjacentElement("afterend", detail);
      else node.prepend(detail);
    }
    const note = ns.userNote(reminder);
    detail.textContent = `Caudal: ${ns.flowLabel(ns.flowFromReminder(reminder))}${note ? ` · ${note}` : ""}`;
  }

  function decorateInterruptItem(node) {
    const id = String(node?.dataset?.exceptionId || "");
    if (!id.startsWith("water-open:")) return;
    const localId = id.slice("water-open:".length);
    const reminder = ns.activeReminder(localId);
    if (!reminder) return;
    const detail = node.querySelector("strong")?.nextElementSibling;
    if (detail) {
      detail.textContent = `${reminder.poolName || "Piscina"} | ${reminder.clientName || "Cliente"} | Água aberta há ${ns.elapsedLabel(reminder.createdAt)} | Caudal: ${ns.flowLabel(ns.flowFromReminder(reminder))}`;
    }
  }

  ns.decorateWaterUi = function decorateWaterUi() {
    ns.enhanceWaterForm();
    document.querySelectorAll("#waterReminderList [data-water-id]").forEach((node) => {
      decorateWaterCardItem(node, ns.activeReminder(node.dataset.waterId));
    });
    document.querySelectorAll('#interruptList [data-exception-category="WATER_OPEN"]').forEach(decorateInterruptItem);
  };

  function interceptActions() {
    document.addEventListener("click", (event) => {
      const openButton = event.target.closest("#openWaterBtn");
      if (openButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        ns.openWater().catch((error) => ns.toast(error.message || "Não foi possível registar água aberta."));
        return;
      }

      const closeButton = event.target.closest("[data-water-close]");
      if (closeButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        ns.closeWater(closeButton.dataset.waterClose).catch((error) => ns.toast(error.message || "Não foi possível confirmar o fecho."));
      }
    }, true);
  }

  function observeRenders() {
    const observer = new MutationObserver(() => ns.decorateWaterUi());
    observer.observe(document.body, { childList: true, subtree: true });
    window.setInterval(ns.decorateWaterUi, 30000);
  }

  ns.init = function init() {
    if (ns.initialized) return;
    ns.initialized = true;
    ns.enhanceWaterForm();
    interceptActions();
    observeRenders();
    ns.decorateWaterUi();
    ns.retryPendingSync().catch(() => {});
    window.addEventListener("online", () => ns.retryPendingSync().catch(() => {}));
  };
})();
