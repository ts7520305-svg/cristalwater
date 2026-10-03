(function () {
  const KEY_PREFIX = 'cw:ctx:';
  const key = KEY_PREFIX + window.location.pathname;
  // The legacy visit page is loaded asynchronously and has its own session guard.
  // Never adopt an unowned pathname snapshot as a visit/account draft.
  const scopedVisit = /^\/technician-visit(?:\.html)?$/.test(window.location.pathname);
  const restored = new Set();
  function scope() {
    if (!scopedVisit) return { key };
    const context = window.CWVisitNavigationMemory?.scope();
    if (!context) return null;
    return { ...context, key: key + ':v1:' + encodeURIComponent(context.owner) + ':' + context.visitId };
  }
  const canRemember = el => el && el.type !== 'file' && el.type !== 'password'
    && !/password|passwd|token|secret|^pin$/i.test(el.name || el.id || '')
    && !el.closest('[data-cw-form-memory="managed"], .cw-lang-switch');

  function validVisitSnapshot(parsed, context) {
    return parsed && parsed.version === 1 && parsed.owner === context.owner
      && parsed.visitId === context.visitId && parsed.fields && typeof parsed.fields === 'object'
      && !Array.isArray(parsed.fields);
  }

  function collectFields() {
    const fields = {};
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach((el) => {
      if (!el.id) return;
      if (!canRemember(el)) return;
      if (el.type === 'checkbox' || el.type === 'radio') fields[el.id] = !!el.checked;
      else fields[el.id] = el.value;
    });
    return fields;
  }

  function restoreFields(fields) {
    if (!fields || typeof fields !== 'object') return;
    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (!canRemember(el)) return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!value;
      else if (typeof value === 'string') el.value = value;
      else if (value != null) el.value = String(value);
    });
  }

  function saveContext() {
    const context = scope();
    if (!context) return;
    const payload = {
      ...(scopedVisit ? { version: 1, owner: context.owner, visitId: context.visitId } : {}),
      at: Date.now(),
      scrollY: Math.round(window.scrollY || 0),
      fields: collectFields(),
    };
    try {
      const previous = scopedVisit && sessionStorage.getItem(context.key);
      if (previous) {
        let valid = false;
        try { valid = validVisitSnapshot(JSON.parse(previous), context); } catch (_e) { /* Preserve unreadable bytes before saving new work. */ }
        if (!valid) {
          const prefix = context.key + ':unreadable:';
          let index = 0;
          while (sessionStorage.getItem(prefix + index) !== null) index++;
          sessionStorage.setItem(prefix + index, previous);
        }
      }
      sessionStorage.setItem(context.key, JSON.stringify(payload));
    } catch (_e) {
      // Ignore storage failures.
    }
  }

  function restoreContext() {
    const context = scope();
    if (!context || (scopedVisit && restored.has(context.key))) return;
    try {
      const raw = sessionStorage.getItem(context.key);
      if (scopedVisit) restored.add(context.key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (scopedVisit && !validVisitSnapshot(parsed, context)) return;
      // Remove old credential snapshots and values now owned by a recoverable form.
      parsed.fields = Object.fromEntries(Object.entries(parsed.fields || {}).filter(([id]) => canRemember(document.getElementById(id))));
      if (!scopedVisit) sessionStorage.setItem(key, JSON.stringify(parsed));
      restoreFields(parsed.fields || {});
      if (Number.isFinite(parsed.scrollY)) {
        requestAnimationFrame(() => { if (scope()?.key === context.key) window.scrollTo({ top: parsed.scrollY, behavior: 'auto' }); });
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

  function saveFieldContext(event) {
    if (canRemember(event.target)) saveContext();
  }

  document.addEventListener('click', handleBack);
  window.addEventListener('cw:visit-context-ready', restoreContext);
  window.addEventListener('pagehide', saveContext);
  window.addEventListener('beforeunload', saveContext);

  document.addEventListener('DOMContentLoaded', () => {
    restoreContext();
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach((el) => {
      el.addEventListener('input', saveFieldContext);
      el.addEventListener('change', saveFieldContext);
    });
  });
})();
