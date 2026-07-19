(function () {
  const KEY_PREFIX = 'cw:ctx:';
  const key = KEY_PREFIX + window.location.pathname;

  function collectFields() {
    const fields = {};
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach((el) => {
      if (!el.id) return;
      if (el.type === 'file') return;
      if (el.type === 'checkbox' || el.type === 'radio') fields[el.id] = !!el.checked;
      else fields[el.id] = el.value;
    });
    return fields;
  }

  function restoreFields(fields) {
    if (!fields || typeof fields !== 'object') return;
    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!value;
      else if (typeof value === 'string') el.value = value;
      else if (value != null) el.value = String(value);
    });
  }

  function saveContext() {
    const payload = {
      at: Date.now(),
      scrollY: Math.round(window.scrollY || 0),
      fields: collectFields(),
    };
    try {
      sessionStorage.setItem(key, JSON.stringify(payload));
    } catch (_e) {
      // Ignore storage failures.
    }
  }

  function restoreContext() {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      restoreFields(parsed.fields || {});
      if (Number.isFinite(parsed.scrollY)) {
        requestAnimationFrame(() => window.scrollTo({ top: parsed.scrollY, behavior: 'auto' }));
      }
    } catch (_e) {
      // Ignore malformed storage.
    }
  }

  function handleBack(event) {
    const trigger = event.target.closest('[data-cw-back], [data-cw-action="back"]');
    if (!trigger) return;
    event.preventDefault();
    saveContext();

    const fallback = trigger.getAttribute('data-cw-fallback') || '/';
    const hasHistory = window.history.length > 1 && document.referrer && document.referrer.startsWith(window.location.origin);
    if (hasHistory) {
      window.history.back();
      return;
    }
    window.location.href = fallback;
  }

  document.addEventListener('click', handleBack);
  window.addEventListener('pagehide', saveContext);
  window.addEventListener('beforeunload', saveContext);

  document.addEventListener('DOMContentLoaded', () => {
    restoreContext();
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach((el) => {
      el.addEventListener('input', saveContext);
      el.addEventListener('change', saveContext);
    });
  });
})();
