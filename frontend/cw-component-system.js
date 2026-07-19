/* Crystal OS Component System
   Mission: UX-COMPONENT-SYSTEM-001
   Reusable behavior layer for component primitives.
*/

(function crystalComponentSystem(global) {
  "use strict";

  const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  function queryAll(root, selector) {
    return Array.from(root.querySelectorAll(selector));
  }

  function setExpanded(trigger, state) {
    if (trigger) {
      trigger.setAttribute("aria-expanded", state ? "true" : "false");
    }
  }

  function focusFirstIn(container) {
    const target = container.querySelector(FOCUSABLE_SELECTOR);
    if (target) target.focus();
  }

  function trapFocus(container, event) {
    if (event.key !== "Tab") return;
    const focusables = queryAll(container, FOCUSABLE_SELECTOR);
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function createModalController(modal) {
    let opener = null;

    function close() {
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (opener) opener.focus();
    }

    function open(trigger) {
      opener = trigger || null;
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      focusFirstIn(modal);
    }

    modal.addEventListener("click", function onBackdropClick(event) {
      if (event.target === modal) close();
    });

    modal.addEventListener("keydown", function onModalKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      trapFocus(modal, event);
    });

    queryAll(modal, "[data-cw-modal-close]").forEach(function bindClose(btn) {
      btn.addEventListener("click", close);
    });

    return { open: open, close: close };
  }

  function createDrawerController(drawer) {
    let opener = null;

    function close() {
      drawer.setAttribute("aria-hidden", "true");
      if (opener) opener.focus();
    }

    function open(trigger) {
      opener = trigger || null;
      drawer.setAttribute("aria-hidden", "false");
      focusFirstIn(drawer);
    }

    drawer.addEventListener("keydown", function onDrawerKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      trapFocus(drawer, event);
    });

    queryAll(drawer, "[data-cw-drawer-close]").forEach(function bindClose(btn) {
      btn.addEventListener("click", close);
    });

    return { open: open, close: close };
  }

  function bindDismissableAlerts(root) {
    queryAll(root, ".cw-alert[data-cw-dismissible='true'] [data-cw-alert-dismiss]").forEach(function bindDismiss(btn) {
      btn.addEventListener("click", function dismissAlert() {
        const alert = btn.closest(".cw-alert");
        if (!alert) return;
        alert.setAttribute("hidden", "hidden");
      });
    });
  }

  function bindFilterChips(root) {
    queryAll(root, "[data-cw-filter-chip]").forEach(function bindChip(chip) {
      chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") || "false");
      chip.addEventListener("click", function onChipClick() {
        const next = chip.getAttribute("aria-pressed") !== "true";
        chip.setAttribute("aria-pressed", next ? "true" : "false");
      });
    });
  }

  function bindSearch(root) {
    queryAll(root, "[data-cw-search]").forEach(function bindSearchInput(input) {
      const clearTargetId = input.getAttribute("data-cw-search-clear");
      if (!clearTargetId) return;
      const clearBtn = document.getElementById(clearTargetId);
      if (!clearBtn) return;

      function syncState() {
        clearBtn.disabled = !input.value;
      }

      input.addEventListener("input", syncState);
      clearBtn.addEventListener("click", function clearInput() {
        input.value = "";
        syncState();
        input.focus();
      });
      syncState();
    });
  }

  function bindTableRowActions(root) {
    queryAll(root, "[data-cw-row-link]").forEach(function bindRow(row) {
      row.addEventListener("click", function onRowClick(event) {
        const blocked = event.target.closest("button,a,input,select,textarea,label");
        if (blocked) return;
        const href = row.getAttribute("data-cw-row-link");
        if (href) window.location.href = href;
      });
      row.style.cursor = "pointer";
    });
  }

  function bindSidebarToggle(root) {
    const toggle = root.querySelector("[data-cw-sidebar-toggle]");
    const sidebarId = toggle ? toggle.getAttribute("data-cw-sidebar-toggle") : "";
    if (!toggle || !sidebarId) return;

    const sidebar = document.getElementById(sidebarId);
    if (!sidebar) return;

    function update(state) {
      sidebar.hidden = !state;
      setExpanded(toggle, state);
    }

    update(true);

    toggle.addEventListener("click", function onToggle() {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      update(open);
    });
  }

  function bindModalTriggers(root, modals) {
    queryAll(root, "[data-cw-modal-open]").forEach(function bindTrigger(trigger) {
      const targetId = trigger.getAttribute("data-cw-modal-open");
      const modal = document.getElementById(targetId);
      const ctrl = modal ? modals.get(modal) : null;
      if (!ctrl) return;
      trigger.addEventListener("click", function onOpen() {
        ctrl.open(trigger);
      });
    });
  }

  function bindDrawerTriggers(root, drawers) {
    queryAll(root, "[data-cw-drawer-open]").forEach(function bindTrigger(trigger) {
      const targetId = trigger.getAttribute("data-cw-drawer-open");
      const drawer = document.getElementById(targetId);
      const ctrl = drawer ? drawers.get(drawer) : null;
      if (!ctrl) return;
      trigger.addEventListener("click", function onOpen() {
        ctrl.open(trigger);
      });
    });
  }

  function bindGalleryPreview(root, modals) {
    queryAll(root, "[data-cw-gallery-preview]").forEach(function bindPreview(btn) {
      const modalId = btn.getAttribute("data-cw-gallery-preview");
      const modal = document.getElementById(modalId);
      const ctrl = modal ? modals.get(modal) : null;
      if (!ctrl) return;

      btn.addEventListener("click", function onPreview() {
        const src = btn.getAttribute("data-cw-image-src");
        const alt = btn.getAttribute("data-cw-image-alt") || "";
        const image = modal.querySelector("[data-cw-modal-image]");
        if (image && src) {
          image.setAttribute("src", src);
          image.setAttribute("alt", alt);
        }
        ctrl.open(btn);
      });
    });
  }

  function init(root) {
    const scope = root || document;

    const modalMap = new Map();
    queryAll(scope, ".cw-modal").forEach(function mapModal(modal) {
      modalMap.set(modal, createModalController(modal));
    });

    const drawerMap = new Map();
    queryAll(scope, ".cw-action-drawer").forEach(function mapDrawer(drawer) {
      drawerMap.set(drawer, createDrawerController(drawer));
    });

    bindSidebarToggle(scope);
    bindDismissableAlerts(scope);
    bindFilterChips(scope);
    bindSearch(scope);
    bindTableRowActions(scope);
    bindModalTriggers(scope, modalMap);
    bindDrawerTriggers(scope, drawerMap);
    bindGalleryPreview(scope, modalMap);

    return {
      modals: modalMap,
      drawers: drawerMap
    };
  }

  global.CrystalComponentSystem = {
    init: init
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function onReady() {
      init(document);
    });
  } else {
    init(document);
  }
})(window);
