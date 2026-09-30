(function () {
  'use strict';
  // Keep original errors and stored history; only owned presentation is localised.
  const journalCopy = (() => {
    const languages = ['pt', 'en', 'fr', 'es', 'de'];
    const copy = {
  "session": [
    "A sessão mudou. Reabra os alertas com a conta atual.",
    "The session changed. Reopen the alerts with the current account.",
    "La session a changé. Rouvrez les alertes avec le compte actuel.",
    "La sesión ha cambiado. Vuelva a abrir las alertas con la cuenta actual.",
    "Die Sitzung wurde geändert. Öffnen Sie die Alarme erneut mit dem aktuellen Konto."
  ],
  "role": [
    "Esta conta não permite registar a leitura dos alertas.",
    "This account cannot record alert read acknowledgements.",
    "Ce compte ne permet pas d’enregistrer la lecture des alertes.",
    "Esta cuenta no permite registrar la lectura de las alertas.",
    "Dieses Konto darf keine Lesebestätigungen für Alarme speichern."
  ],
  "changed": [
    "A conta ou o dia mudou. Os registos locais foram preservados.",
    "The account or day changed. Local records were preserved.",
    "Le compte ou le jour a changé. Les enregistrements locaux ont été conservés.",
    "La cuenta o el día ha cambiado. Se han conservado los registros locales.",
    "Das Konto oder der Tag wurde geändert. Die lokalen Einträge bleiben erhalten."
  ],
  "mismatch": [
    "O histórico local não corresponde à conta/dia. Foi preservado.",
    "The local history does not match this account/day. It was preserved.",
    "L’historique local ne correspond pas à ce compte ou à ce jour. Il a été conservé.",
    "El historial local no corresponde a esta cuenta o a este día. Se ha conservado.",
    "Der lokale Verlauf passt nicht zu diesem Konto oder Tag. Er bleibt erhalten."
  ],
  "unreadable": [
    "O histórico local está ilegível. Foi preservado.",
    "The local history is unreadable. It was preserved.",
    "L’historique local est illisible. Il a été conservé.",
    "El historial local es ilegible. Se ha conservado.",
    "Der lokale Verlauf ist unlesbar. Er bleibt erhalten."
  ],
  "action": [
    "A leitura de um alerta não confirma a resolução da sua causa.",
    "Acknowledging an alert does not confirm that its cause is resolved.",
    "La lecture d’une alerte ne confirme pas la résolution de sa cause.",
    "Leer una alerta no confirma la resolución de su causa.",
    "Die Lesebestätigung eines Alarms bestätigt nicht, dass seine Ursache behoben ist."
  ],
  "locks": [
    "Este navegador não permite coordenar a gravação do histórico.",
    "This browser cannot coordinate saving the history.",
    "Ce navigateur ne permet pas de coordonner l’enregistrement de l’historique.",
    "Este navegador no permite coordinar el guardado del historial.",
    "Dieser Browser kann das Speichern des Verlaufs nicht koordinieren."
  ],
  "relevant": [
    "O alerta mudou. Consulte o estado atual antes de confirmar.",
    "The alert changed. Check its current status before acknowledging it.",
    "L’alerte a changé. Consultez son état actuel avant de confirmer.",
    "La alerta ha cambiado. Consulte su estado actual antes de confirmar.",
    "Der Alarm wurde geändert. Prüfen Sie vor der Bestätigung seinen aktuellen Status."
  ],
  "readback": [
    "Não foi possível confirmar a gravação do histórico neste dispositivo.",
    "Saving the history on this device could not be confirmed.",
    "L’enregistrement de l’historique sur cet appareil n’a pas pu être confirmé.",
    "No se ha podido confirmar que el historial se haya guardado en este dispositivo.",
    "Das Speichern des Verlaufs auf diesem Gerät konnte nicht bestätigt werden."
  ],
  "legacy": [
    "Existem registos antigos sem conta comprovada. Foram preservados e não alteram os alertas atuais.",
    "Older records have no verified account. They were preserved and do not change current alerts.",
    "D’anciens enregistrements n’ont pas de compte vérifié. Ils ont été conservés et ne modifient pas les alertes actuelles.",
    "Hay registros antiguos sin una cuenta verificada. Se han conservado y no modifican las alertas actuales.",
    "Ältere Einträge haben kein bestätigtes Konto. Sie bleiben erhalten und ändern die aktuellen Alarme nicht."
  ]
};
    const specs = new WeakSet(), errors = new WeakMap();
    function value(key) { const entry = Object.freeze({ key }); specs.add(entry); return entry; }
    function format(entry, language = typeof document === 'undefined' ? 'pt' : document.documentElement?.lang || 'pt') {
      if (!specs.has(entry)) return String(entry ?? '');
      return copy[entry.key][Math.max(0, languages.indexOf(String(language).toLowerCase().split('-')[0]))];
    }
    function problem(key) { const error = Error(copy[key][0]); errors.set(error, value(key)); return error; }
    return { problem, presentation: Object.freeze({ format, error: error => errors.get(error) || String(error?.message ?? ''), legacyWarning: context => legacyWarning(context) ? value('legacy') : '' }) };
  })();
  const store = window.CWFieldWriteStore;
  const legacyKeys = ['cw:tech-field:op-exception-state:v1', 'cw:tech-field:op-exception-history:v1', 'cw:tech-field:op-exception-command:v1'];
  const actions = ['OPEN', 'ASSUMED', 'CONFIRMED'];
  function scope(session = store.session()) {
    if (!store.same(session)) throw journalCopy.problem('session');
    const role = JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role;
    if (!['TECHNICIAN', 'TEAM_LEADER'].includes(role)) throw journalCopy.problem('role');
    return { session, role, day: window.CWFieldRouteCache.today() };
  }
  const same = context => !!context && store.same(context.session) && context.day === window.CWFieldRouteCache.today();
  const key = context => `cwFieldAlertJournal:v2:${context.session.owner}:${context.role}:${context.day}`;
  function requireScope(context) { if (!same(context)) throw journalCopy.problem('changed'); }
  function validate(value, context) {
    const ids = new Set();
    if (!value || value.v !== 2 || value.owner !== context.session.owner || value.role !== context.role || value.technicianId !== context.session.technicianId || value.day !== context.day || !Array.isArray(value.entries)) throw journalCopy.problem('mismatch');
    for (const entry of value.entries) {
      if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || !actions.includes(entry.action) || typeof entry.exceptionId !== 'string' || !/^[a-z][a-z-]+:[^\s]{1,240}$/.test(entry.exceptionId) || !Number.isFinite(Date.parse(entry.createdAt)) || typeof entry.title !== 'string' || typeof entry.detail !== 'string' || typeof entry.by !== 'string' || typeof entry.createdBy !== 'string' || !Number.isFinite(Date.parse(entry.sourceCreatedAt))) throw journalCopy.problem('unreadable');
      ids.add(entry.id);
    }
    return value;
  }
  function read(context) {
    requireScope(context);
    const raw = localStorage.getItem(key(context));
    if (!raw) return { v: 2, owner: context.session.owner, role: context.role, technicianId: context.session.technicianId, day: context.day, entries: [] };
    let value; try { value = JSON.parse(raw); } catch (_) { throw journalCopy.problem('unreadable'); }
    return validate(value, context);
  }
  function states(value) {
    const result = Object.create(null);
    for (const entry of value.entries) {
      const state = result[entry.exceptionId] ||= { status: 'OPEN', createdBy: entry.createdBy, createdAt: entry.sourceCreatedAt, receivedBy: entry.by, receivedAt: entry.createdAt };
      if (entry.action === 'ASSUMED' && state.status === 'OPEN') Object.assign(state, { status: 'ASSUMED', assumedBy: entry.by, assumedAt: entry.createdAt });
      if (entry.action === 'CONFIRMED') Object.assign(state, { status: 'CONFIRMED', confirmedBy: entry.by, confirmedAt: entry.createdAt });
    }
    return result;
  }
  function legacyWarning(context) {
    requireScope(context);
    return legacyKeys.some(name => localStorage.getItem(name)) ? 'Existem registos antigos sem conta comprovada. Foram preservados e não alteram os alertas atuais.' : '';
  }
  async function record(context, exceptions, action, by, relevant = () => true) {
    requireScope(context);
    if (!actions.includes(action)) throw journalCopy.problem('action');
    if (!navigator.locks?.request) throw journalCopy.problem('locks');
    return navigator.locks.request(key(context), () => {
      requireScope(context); if (!relevant()) throw journalCopy.problem('relevant');
      const value = read(context), before = JSON.stringify(value), stateById = states(value), now = new Date().toISOString();
      for (const exception of exceptions) {
        const state = stateById[exception.id];
        if (action === 'OPEN' && state || action === 'ASSUMED' && state && state.status !== 'OPEN' || action === 'CONFIRMED' && state?.status === 'CONFIRMED') continue;
        const append = event => value.entries.push({ id: crypto.randomUUID(), action: event, exceptionId: exception.id, createdAt: now, title: exception.title, detail: exception.detail || '', by: String(by || 'Técnico'), createdBy: String(exception.createdBy || 'Sistema'), sourceCreatedAt: Number.isFinite(Date.parse(exception.createdAt)) ? exception.createdAt : now });
        if (!state && action !== 'OPEN') append('OPEN');
        append(action);
      }
      validate(value, context); const raw = JSON.stringify(value);
      if (raw !== before) {
        localStorage.setItem(key(context), raw);
        if (localStorage.getItem(key(context)) !== raw) throw journalCopy.problem('readback');
        window.dispatchEvent(new Event('cw:alert-journal-updated'));
      }
      return value;
    });
  }
  window.CWFieldAlertJournal = { scope, same, key, validate, read, states, legacyWarning, record, presentation: journalCopy.presentation };
})();
