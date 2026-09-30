(function () {
  'use strict';
  // Owned errors keep their original Portuguese message and private presentation.
  const routeCopy = (() => {
    const languages = ['pt', 'en', 'fr', 'es', 'de'];
    const copy = {
      "session": [
        "A sessão mudou. Reabra o modo de campo com a conta atual.",
        "The session changed. Reopen field mode with the current account.",
        "La session a changé. Rouvrez le mode terrain avec le compte actuel.",
        "La sesión ha cambiado. Vuelve a abrir el modo de campo con la cuenta actual.",
        "Die Sitzung hat sich geändert. Öffnen Sie den Außendienstmodus erneut mit dem aktuellen Konto."
      ],
      "role": [
        "A conta não permite consultar esta ronda.",
        "This account cannot view this round.",
        "Ce compte ne permet pas de consulter cette tournée.",
        "Esta cuenta no permite consultar esta ronda.",
        "Dieses Konto darf diese Tour nicht anzeigen."
      ],
      "changed": [
        "A sessão ou o dia mudou. Atualize a ronda da conta atual.",
        "The session or day changed. Refresh the round for the current account.",
        "La session ou le jour a changé. Actualisez la tournée du compte actuel.",
        "La sesión o el día ha cambiado. Actualiza la ronda de la cuenta actual.",
        "Die Sitzung oder der Tag hat sich geändert. Aktualisieren Sie die Tour des aktuellen Kontos."
      ],
      "mismatch": [
        "A ronda guardada não corresponde à conta/dia ou está ilegível. Os dados foram preservados.",
        "The saved round does not match this account/day or is unreadable. The data has been preserved.",
        "La tournée enregistrée ne correspond pas à ce compte ou à ce jour, ou elle est illisible. Les données ont été conservées.",
        "La ronda guardada no corresponde a esta cuenta o día, o no se puede leer. Se han conservado los datos.",
        "Die gespeicherte Tour passt nicht zu diesem Konto oder Tag oder ist unlesbar. Die Daten bleiben erhalten."
      ],
      "response": [
        "A resposta não confirma a ronda completa desta conta e deste dia.",
        "The response does not confirm the complete round for this account and day.",
        "La réponse ne confirme pas la tournée complète de ce compte pour ce jour.",
        "La respuesta no confirma la ronda completa de esta cuenta para este día.",
        "Die Antwort bestätigt nicht die vollständige Tour dieses Kontos für diesen Tag."
      ],
      "legacyIncomplete": [
        "A ronda antiga pode estar incompleta. Foi preservada; consulte a ronda completa com rede antes de trabalhar offline.",
        "The old round may be incomplete. It has been preserved; check the complete round online before working offline.",
        "L’ancienne tournée peut être incomplète. Elle a été conservée ; consultez la tournée complète en ligne avant de travailler hors connexion.",
        "La ronda antigua puede estar incompleta. Se ha conservado; consulta la ronda completa con conexión antes de trabajar sin conexión.",
        "Die alte Tour ist möglicherweise unvollständig. Sie bleibt erhalten; prüfen Sie die vollständige Tour online, bevor Sie offline arbeiten."
      ],
      "legacyUnattributed": [
        "Existe uma ronda antiga sem conta/dia comprovados. Foi preservada; consulte a ronda atual com rede.",
        "There is an old round without a verified account/day. It has been preserved; check the current round online.",
        "Une ancienne tournée n’a pas de compte ou de jour vérifiés. Elle a été conservée ; consultez la tournée actuelle en ligne.",
        "Existe una ronda antigua sin cuenta o día verificados. Se ha conservado; consulta la ronda actual con conexión.",
        "Eine alte Tour hat kein bestätigtes Konto oder Datum. Sie bleibt erhalten; prüfen Sie die aktuelle Tour online."
      ],
      "unreadable": [
        "A ronda guardada está ilegível. Os dados foram preservados; peça apoio ao escritório.",
        "The saved round is unreadable. The data has been preserved; ask the office for help.",
        "La tournée enregistrée est illisible. Les données ont été conservées ; demandez de l’aide au bureau.",
        "No se puede leer la ronda guardada. Se han conservado los datos; pide ayuda a la oficina.",
        "Die gespeicherte Tour ist unlesbar. Die Daten bleiben erhalten; bitten Sie das Büro um Hilfe."
      ],
      "readback": [
        "Não foi possível confirmar a gravação da ronda neste dispositivo.",
        "Could not confirm that the round was saved on this device.",
        "Impossible de confirmer l’enregistrement de la tournée sur cet appareil.",
        "No se pudo confirmar que la ronda se guardó en este dispositivo.",
        "Das Speichern der Tour auf diesem Gerät konnte nicht bestätigt werden."
      ]
    };
    const specs = new WeakSet(), errors = new WeakMap();
    function value(key) { const entry = Object.freeze({ key }); specs.add(entry); return entry; }
    function problem(key) { const error = Error(copy[key][0]); errors.set(error, value(key)); return error; }
    function format(entry, language = typeof document === 'undefined' ? 'pt' : document.documentElement?.lang || 'pt') {
      if (!specs.has(entry)) return String(entry ?? '');
      const index = Math.max(0, languages.indexOf(String(language).toLowerCase().split('-')[0]));
      return copy[entry.key][index];
    }
    return { problem, presentation: Object.freeze({ format, error: error => errors.get(error) || null }) };
  })();
  const store = window.CWFieldWriteStore;
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const visitKey = visit => (visit.visitType || 'REGULAR') + ':' + visit.id;
  function today() {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function scope(session = store.session()) {
    if (!store.same(session)) throw routeCopy.problem('session');
    const role = JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role;
    if (!['TECHNICIAN', 'TEAM_LEADER'].includes(role)) throw routeCopy.problem('role');
    return { session, role, day: today() };
  }
  function same(context) {
    return !!context && store.same(context.session) && context.day === today();
  }
  function requireScope(context) {
    if (!same(context)) throw routeCopy.problem('changed');
  }
  const key = context => 'cwFieldRoute:v3:' + context.session.owner + ':' + context.role + ':' + context.day;
  function validate(value, context) {
    const ids = new Set();
    const invalidVisit = visit => {
      if (!visit || !positive(visit.id) || !['REGULAR', 'EXTRA'].includes(visit.visitType) || ids.has(visitKey(visit)) || visit.technician?.id !== context.session.technicianId || (visit.technicianId != null && visit.technicianId !== context.session.technicianId) || typeof visit.status !== 'string' || visit.assistSource) return true;
      ids.add(visitKey(visit)); return false;
    };
    if (!value || value.v !== 3 || value.owner !== context.session.owner || value.role !== context.role || value.technicianId !== context.session.technicianId || value.day !== context.day || !Number.isFinite(Date.parse(value.serverConfirmedAt)) || !Array.isArray(value.visits) || value.visits.some(invalidVisit)) throw routeCopy.problem('mismatch');
    return value;
  }
  function fromResponse(data, context) {
    requireScope(context);
    if (data?.ok !== true || data.complete !== true || data.date !== context.day || data.technicianId !== context.session.technicianId || !Array.isArray(data.visits) || data.total !== data.visits.length) throw routeCopy.problem('response');
    return validate({ v: 3, owner: context.session.owner, role: context.role, technicianId: context.session.technicianId, day: context.day, serverConfirmedAt: new Date().toISOString(), visits: data.visits }, context);
  }
  function read(context) {
    requireScope(context);
    const raw = localStorage.getItem(key(context));
    if (!raw) {
      if (localStorage.getItem(key(context).replace('cwFieldRoute:v3:', 'cwFieldRoute:v2:'))) throw routeCopy.problem('legacyIncomplete');
      if (localStorage.getItem('cwFieldRoute:' + context.session.technicianId)) throw routeCopy.problem('legacyUnattributed');
      return null;
    }
    let value; try { value = JSON.parse(raw); } catch (_) { throw routeCopy.problem('unreadable'); }
    return validate(value, context);
  }
  function save(value, context) {
    requireScope(context); validate(value, context);
    const target = key(context);
    if (localStorage.getItem(target)) read(context);
    const raw = JSON.stringify(value); localStorage.setItem(target, raw);
    if (localStorage.getItem(target) !== raw) throw routeCopy.problem('readback');
    return value;
  }
  function update(value, visits, context) {
    requireScope(context); validate(value, context);
    // Assistance and tomorrow views do not become today's authoritative route.
    const rows = new Map(visits.filter(visit => !visit.assistSource).map(visit => [visitKey(visit), visit]));
    return save({ ...value, visits: value.visits.map(visit => rows.get(visitKey(visit)) || visit) }, context);
  }
  window.CWFieldRouteCache = { today, scope, same, key, validate, fromResponse, read, save, update, presentation: routeCopy.presentation };
})();
