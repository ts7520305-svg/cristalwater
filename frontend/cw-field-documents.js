(function () {
  'use strict';

  // Private immutable presentation leaves Error.message and result.warning unchanged.
  const warningTexts = {
  "scopeSession": [
    "Confirme a sessão e a viatura antes de consultar documentos.",
    "Confirm the session and vehicle before viewing documents.",
    "Confirmez la session et le véhicule avant de consulter les documents.",
    "Confirma la sesión y el vehículo antes de consultar documentos.",
    "Bestätigen Sie Sitzung und Fahrzeug, bevor Sie Dokumente abrufen."
  ],
  "scopeRole": [
    "A sessão não permite consultar estes documentos.",
    "This session cannot access these documents.",
    "Cette session ne permet pas de consulter ces documents.",
    "Esta sesión no permite consultar estos documentos.",
    "Diese Sitzung erlaubt keinen Zugriff auf diese Dokumente."
  ],
  "scopeChanged": [
    "A sessão ou o dia mudou. Os documentos guardados foram preservados.",
    "The session or day changed. Saved documents were preserved.",
    "La session ou le jour a changé. Les documents enregistrés ont été conservés.",
    "La sesión o el día ha cambiado. Los documentos guardados se han conservado.",
    "Die Sitzung oder der Tag hat sich geändert. Gespeicherte Dokumente wurden erhalten."
  ],
  "responseContext": [
    "A resposta documental não confirma a viatura e o conteúdo pedidos.",
    "The document response does not confirm the requested vehicle and content.",
    "La réponse documentaire ne confirme pas le véhicule et le contenu demandés.",
    "La respuesta documental no confirma el vehículo y el contenido solicitados.",
    "Die Dokumentantwort bestätigt das angeforderte Fahrzeug und den Inhalt nicht."
  ],
  "storedContext": [
    "Os documentos guardados não correspondem à conta, viatura ou dia. Foram preservados.",
    "Saved documents do not match the account, vehicle or day. They were preserved.",
    "Les documents enregistrés ne correspondent pas au compte, au véhicule ou au jour. Ils ont été conservés.",
    "Los documentos guardados no corresponden a la cuenta, al vehículo o al día. Se han conservado.",
    "Gespeicherte Dokumente passen nicht zum Konto, Fahrzeug oder Tag. Sie wurden erhalten."
  ],
  "storedUnreadable": [
    "Os documentos guardados estão ilegíveis. Foram preservados.",
    "Saved documents are unreadable. They were preserved.",
    "Les documents enregistrés sont illisibles. Ils ont été conservés.",
    "Los documentos guardados no se pueden leer. Se han conservado.",
    "Gespeicherte Dokumente sind unlesbar. Sie wurden erhalten."
  ],
  "storedAccessRules": [
    "Existe uma cópia documental anterior às regras atuais de acesso. Foi preservada; atualize com rede antes de a usar.",
    "A document copy predates the current access rules. It was preserved; refresh online before using it.",
    "Une copie documentaire est antérieure aux règles d’accès actuelles. Elle a été conservée ; actualisez-la en ligne avant de l’utiliser.",
    "Hay una copia documental anterior a las reglas de acceso actuales. Se ha conservado; actualiza con conexión antes de usarla.",
    "Eine Dokumentkopie stammt aus der Zeit vor den aktuellen Zugriffsregeln. Sie wurde erhalten; aktualisieren Sie sie online vor der Nutzung."
  ],
  "storedLegacy": [
    "Existem documentos antigos sem conta/dia comprovados. Foram preservados; consulte os documentos atuais com rede.",
    "Older documents have no confirmed account or day. They were preserved; view current documents online.",
    "Des documents anciens n’ont pas de compte ou de jour confirmé. Ils ont été conservés ; consultez les documents actuels en ligne.",
    "Hay documentos antiguos sin cuenta o día confirmados. Se han conservado; consulta los documentos actuales con conexión.",
    "Ältere Dokumente haben kein bestätigtes Konto oder Datum. Sie wurden erhalten; rufen Sie aktuelle Dokumente online ab."
  ],
  "locksUnavailable": [
    "Este navegador não permite coordenar a gravação dos documentos.",
    "This browser cannot coordinate document saving.",
    "Ce navigateur ne permet pas de coordonner l’enregistrement des documents.",
    "Este navegador no permite coordinar el guardado de documentos.",
    "Dieser Browser kann das Speichern der Dokumente nicht koordinieren."
  ],
  "saveUnconfirmed": [
    "Não foi possível confirmar a gravação dos documentos neste dispositivo.",
    "Saving documents on this device could not be confirmed.",
    "L’enregistrement des documents sur cet appareil n’a pas pu être confirmé.",
    "No se pudo confirmar el guardado de documentos en este dispositivo.",
    "Das Speichern der Dokumente auf diesem Gerät konnte nicht bestätigt werden."
  ],
  "queryUnavailable": [
    "Consulta indisponível.",
    "Query unavailable.",
    "Consultation indisponible.",
    "Consulta no disponible.",
    "Abfrage nicht verfügbar."
  ],
  "responsePrivate": [
    "A resposta documental não confirma a conta e a consulta privada.",
    "The document response does not confirm the account and private access.",
    "La réponse documentaire ne confirme pas le compte et l’accès privé.",
    "La respuesta documental no confirma la cuenta y el acceso privado.",
    "Die Dokumentantwort bestätigt das Konto und den privaten Zugriff nicht."
  ],
  "accessDenied": [
    "Acesso aos documentos recusado. Confirme a sessão e a viatura atribuída; os registos locais foram preservados.",
    "Document access denied. Confirm the session and assigned vehicle; local records were preserved.",
    "Accès aux documents refusé. Confirmez la session et le véhicule attribué ; les enregistrements locaux ont été conservés.",
    "Acceso a los documentos denegado. Confirma la sesión y el vehículo asignado; los registros locales se han conservado.",
    "Zugriff auf Dokumente verweigert. Bestätigen Sie die Sitzung und das zugewiesene Fahrzeug; lokale Daten wurden erhalten."
  ],
  "saveWarning": [
    "Os documentos atuais não ficaram guardados para uso offline. {detail}",
    "Current documents were not saved for offline use. {detail}",
    "Les documents actuels n’ont pas été enregistrés pour une utilisation hors ligne. {detail}",
    "Los documentos actuales no se guardaron para uso sin conexión. {detail}",
    "Aktuelle Dokumente wurden nicht für die Offline-Nutzung gespeichert. {detail}"
  ]
};
  const warningLanguages = ['pt', 'en', 'fr', 'es', 'de'];
  const textSnapshots = new WeakMap(), errorSnapshots = new WeakMap(), resultSnapshots = new WeakMap();
  function warningText(entry, language = 'pt') {
    const texts = textSnapshots.get(entry);
    return texts ? texts[Math.max(0, warningLanguages.indexOf(String(language).toLowerCase().split('-')[0]))] : String(entry ?? '');
  }
  function warningSnapshot(key, values = {}) {
    const entry = Object.freeze({});
    textSnapshots.set(entry, Object.freeze(warningLanguages.map((language, index) => warningTexts[key][index].replace(/\{(\w+)\}/g, (_, name) => warningText(values[name], language)))));
    return entry;
  }
  function ownedError(key) {
    const error = Error(warningTexts[key][0]); errorSnapshots.set(error, warningSnapshot(key)); return error;
  }
  function withWarning(result, entry) {
    resultSnapshots.set(result, { original: result.warning, entry }); return result;
  }
  const presentation = Object.freeze({
    error: error => errorSnapshots.get(error),
    warning: result => { const item = resultSnapshots.get(result); return item && result.warning === item.original ? item.entry : undefined; },
    format: warningText,
  });
  const store = window.CWFieldWriteStore;
  const kinds = ['transport', 'work', 'insurance'];
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, canonical(v[k])])) : v;
  const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const unique = rows => rows.every(row => row && positive(row.id)) && new Set(rows.map(row => row.id)).size === rows.length;
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  function consumptionSummary(data) {
    const available = data.movements.length;
    return { rows: data.movements.slice(-8).reverse(), available, total: data.movementsIncluded === true && count(data.consumptionCount) && data.consumptionCount === available ? available : null };
  }
  const clean = (kind,data) => window.CWFieldGuideProjection.packet(kind,data);
  const day = () => window.CWFieldRouteCache.today();
  function scope(session, vehicleId) {
    if (!store.same(session) || !positive(Number(vehicleId))) throw ownedError('scopeSession');
    const role = JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role;
    if (!['TECHNICIAN', 'TEAM_LEADER'].includes(role)) throw ownedError('scopeRole');
    return { session, role, vehicleId: Number(vehicleId), day: day() };
  }
  const same = context => !!context && store.same(context.session) && context.day === day();
  const key = context => `cwFieldDocuments:v3:${context.session.owner}:${context.role}:${context.vehicleId}:${context.day}`;
  function requireScope(context) { if (!same(context)) throw ownedError('scopeChanged'); }
  function validateData(kind, data, context, live = false) {
    const bad = () => { throw ownedError('responseContext'); };
    if (!data || data.ok !== true) bad();
    if (!equal(data, clean(kind,data)) || live && !data.scope) bad();
    if (data.scope && (data.scope.version!==1 || data.scope.owner!==context.session.owner || data.scope.technicianId!==context.session.technicianId || data.scope.vehicleId!==context.vehicleId)) bad();
    const vehicle = value => { if (value && value.id !== context.vehicleId) bad(); };
    const record = value => { if (value && (!positive(value.id) || value.vehicleId !== context.vehicleId)) bad(); };
    if (kind === 'transport') {
      if (!Object.hasOwn(data, 'guide') || !Array.isArray(data.items)) bad();
      record(data.guide); vehicle(data.guide?.vehicle);
      if (!data.guide && data.items.length) bad();
      if (data.items.some(item => item.guideId != null && item.guideId !== data.guide?.id)) bad();
    } else if (kind === 'work') {
      if (!Object.hasOwn(data, 'workGuide') || !Array.isArray(data.stock) || !Array.isArray(data.movements)) bad();
      record(data.workGuide); vehicle(data.workGuide?.vehicle); record(data.workGuide?.guide); vehicle(data.workGuide?.guide?.vehicle);
      if (!data.workGuide && (data.stock.length || data.movements.length)) bad();
      if (data.stock.some(item => item.workGuideId != null && item.workGuideId !== data.workGuide?.id)) bad();
      if (data.workGuide?.guide && data.workGuide.guideId !== data.workGuide.guide.id) bad();
      if (data.workGuide && data.workGuide.technicianId !== context.session.technicianId) bad();
      if (data.movements.some(m => m.workGuideId !== data.workGuide?.id || m.vehicleId !== context.vehicleId || m.technicianId !== null && m.technicianId !== context.session.technicianId)) bad();
      // Earlier v3 copies have no count metadata. Keep them readable without
      // presenting their list length as a confirmed total for the work guide.
      const hasCounts = ['itemCount', 'movementsIncluded', 'consumptionCount'].some(k => Object.hasOwn(data, k));
      if (live || hasCounts) {
        if (!data.scope || !count(data.itemCount) || data.itemCount !== data.stock.length || !unique(data.stock) || data.movementsIncluded !== true || !count(data.consumptionCount) || data.consumptionCount !== data.movements.length) bad();
        if (data.workGuide && (!Array.isArray(data.workGuide.items) || !equal(data.workGuide.items, data.stock) || data.stock.some(r => r.workGuideId !== data.workGuide.id || typeof r.name !== 'string' || !(r.unit === null || typeof r.unit === 'string') || !['quantity', 'initialQty', 'usedQty'].every(k => numeric(r[k]))))) bad();
      }
      if (!unique(data.movements) || data.movements.some((m, i) => m.movementType !== 'CONSUMPTION' || typeof m.itemName !== 'string' || !numeric(m.quantity) || !(m.unit === null || typeof m.unit === 'string') || !Number.isFinite(Date.parse(m.createdAt)) || i > 0 && !(Date.parse(data.movements[i - 1].createdAt) < Date.parse(m.createdAt) || data.movements[i - 1].createdAt === m.createdAt && data.movements[i - 1].id < m.id))) bad();
    } else if (kind === 'insurance') {
      if (!Object.hasOwn(data, 'vehicle') || !Object.hasOwn(data, 'insurance')) bad();
      vehicle(data.vehicle); record(data.insurance); record(data.vehicle?.inspection);
      if (!data.vehicle && data.insurance) bad();
    } else bad();
    return data;
  }
  function validate(value, context) {
    if (!value || value.v !== 3 || value.owner !== context.session.owner || value.role !== context.role || value.technicianId !== context.session.technicianId || value.vehicleId !== context.vehicleId || value.day !== context.day || !value.sections || typeof value.sections !== 'object' || Array.isArray(value.sections)) throw ownedError('storedContext');
    for (const [kind, section] of Object.entries(value.sections)) {
      if (!kinds.includes(kind) || !section || !Number.isFinite(Date.parse(section.confirmedAt)) || !Number.isFinite(section.requestedAt)) throw ownedError('storedUnreadable');
      validateData(kind, section.data, context);
    }
    return value;
  }
  function read(context) {
    requireScope(context);
    const raw = localStorage.getItem(key(context));
    if (!raw) {
      if (localStorage.getItem(key(context).replace('cwFieldDocuments:v3:','cwFieldDocuments:v2:'))) throw ownedError('storedAccessRules');
      if (localStorage.getItem('cw:tech-field:docs-cache:v1:' + context.vehicleId)) throw ownedError('storedLegacy');
      return null;
    }
    let value; try { value = JSON.parse(raw); } catch (_) { throw ownedError('storedUnreadable'); }
    return validate(value, context);
  }
  async function save(context, sections) {
    requireScope(context);
    if (!navigator.locks?.request) throw ownedError('locksUnavailable');
    return navigator.locks.request(key(context), async () => {
      requireScope(context);
      const previous = localStorage.getItem(key(context)) ? read(context) : null;
      const value = previous || { v: 3, owner: context.session.owner, role: context.role, technicianId: context.session.technicianId, vehicleId: context.vehicleId, day: context.day, sections: {} };
      for (const [kind, section] of Object.entries(sections)) {
        if (!value.sections[kind] || value.sections[kind].requestedAt <= section.requestedAt) value.sections[kind] = section;
      }
      validate(value, context); const raw = JSON.stringify(value);
      localStorage.setItem(key(context), raw);
      if (localStorage.getItem(key(context)) !== raw) throw ownedError('saveUnconfirmed');
      return value;
    });
  }
  async function load(context, relevant) {
    requireScope(context);
    const requestedAt = Date.now(); let cached = null, warning = '', warningCopy = '';
    try { cached = read(context); } catch (error) { warning = error.message; warningCopy = errorSnapshots.get(error) || error.message; }
    const paths = {
      transport: '/api/guides/transport/latest/' + context.vehicleId,
      work: '/api/guides/stock/' + context.vehicleId + '?technicianId=' + context.session.technicianId,
      insurance: '/api/guides/vehicles/' + context.vehicleId + '/insurance',
    };
    const results = await Promise.all(kinds.map(async kind => {
      try {
        const response = await fetch(paths[kind], { headers: { Authorization: 'Bearer ' + context.session.token }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
        const data = clean(kind,await response.json().catch(() => null));
        if (response.status !== 200) throw Object.assign((data?.error ? Error(data.error) : ownedError('queryUnavailable')), { denied: [401, 403].includes(response.status) });
        const directives = (response.headers.get('cache-control') || '').toLowerCase().split(',').map(s => s.trim());
        if (response.headers.get('x-cw-owner') !== context.session.owner || !directives.includes('private') || !directives.includes('no-store')) throw ownedError('responsePrivate');
        validateData(kind, data, context, true);
        return { kind, source: 'live', section: { data, requestedAt, confirmedAt: new Date().toISOString() } };
      } catch (error) { return { kind, error: error.message, denied: !!error.denied }; }
    }));
    if (!same(context) || !relevant()) return null;
    if (results.some(result => result.denied)) return withWarning({ sections: {}, sources: {}, warning: 'Acesso aos documentos recusado. Confirme a sessão e a viatura atribuída; os registos locais foram preservados.', denied: true }, warningSnapshot('accessDenied'));
    const live = {}, sections = {}, sources = {};
    for (const result of results) {
      if (result.section) { live[result.kind] = result.section; sections[result.kind] = result.section; sources[result.kind] = 'live'; }
      else if (cached?.sections[result.kind]) { sections[result.kind] = cached.sections[result.kind]; sources[result.kind] = 'cache'; }
      else sources[result.kind] = 'unavailable';
    }
    if (Object.keys(live).length) {
      try {
        if (same(context) && relevant()) {
          const saved = await save(context, live);
          for (const kind of kinds) if (saved.sections[kind] && (!sections[kind] || saved.sections[kind].requestedAt > sections[kind].requestedAt)) { sections[kind] = saved.sections[kind]; sources[kind] = 'cache'; }
          if (kinds.every(kind => sources[kind] === 'live')) { warning = ''; warningCopy = ''; }
        }
      }
      catch (error) { warning = 'Os documentos atuais não ficaram guardados para uso offline. ' + error.message; warningCopy = warningSnapshot('saveWarning', { detail: errorSnapshots.get(error) || error.message }); }
    }
    if (!same(context) || !relevant()) return null;
    return withWarning({ sections, sources, warning, denied: false }, warningCopy);
  }
  window.CWFieldDocuments = { scope, same, key, validate, validateData, read, save, load, consumptionSummary, presentation };
})();
