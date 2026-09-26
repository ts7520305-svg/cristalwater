(function () {
  'use strict';
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
    if (!store.same(session) || !positive(Number(vehicleId))) throw Error('Confirme a sessão e a viatura antes de consultar documentos.');
    const role = JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role;
    if (!['TECHNICIAN', 'TEAM_LEADER'].includes(role)) throw Error('A sessão não permite consultar estes documentos.');
    return { session, role, vehicleId: Number(vehicleId), day: day() };
  }
  const same = context => !!context && store.same(context.session) && context.day === day();
  const key = context => `cwFieldDocuments:v3:${context.session.owner}:${context.role}:${context.vehicleId}:${context.day}`;
  function requireScope(context) { if (!same(context)) throw Error('A sessão ou o dia mudou. Os documentos guardados foram preservados.'); }
  function validateData(kind, data, context, live = false) {
    const bad = () => { throw Error('A resposta documental não confirma a viatura e o conteúdo pedidos.'); };
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
    if (!value || value.v !== 3 || value.owner !== context.session.owner || value.role !== context.role || value.technicianId !== context.session.technicianId || value.vehicleId !== context.vehicleId || value.day !== context.day || !value.sections || typeof value.sections !== 'object' || Array.isArray(value.sections)) throw Error('Os documentos guardados não correspondem à conta, viatura ou dia. Foram preservados.');
    for (const [kind, section] of Object.entries(value.sections)) {
      if (!kinds.includes(kind) || !section || !Number.isFinite(Date.parse(section.confirmedAt)) || !Number.isFinite(section.requestedAt)) throw Error('Os documentos guardados estão ilegíveis. Foram preservados.');
      validateData(kind, section.data, context);
    }
    return value;
  }
  function read(context) {
    requireScope(context);
    const raw = localStorage.getItem(key(context));
    if (!raw) {
      if (localStorage.getItem(key(context).replace('cwFieldDocuments:v3:','cwFieldDocuments:v2:'))) throw Error('Existe uma cópia documental anterior às regras atuais de acesso. Foi preservada; atualize com rede antes de a usar.');
      if (localStorage.getItem('cw:tech-field:docs-cache:v1:' + context.vehicleId)) throw Error('Existem documentos antigos sem conta/dia comprovados. Foram preservados; consulte os documentos atuais com rede.');
      return null;
    }
    let value; try { value = JSON.parse(raw); } catch (_) { throw Error('Os documentos guardados estão ilegíveis. Foram preservados.'); }
    return validate(value, context);
  }
  async function save(context, sections) {
    requireScope(context);
    if (!navigator.locks?.request) throw Error('Este navegador não permite coordenar a gravação dos documentos.');
    return navigator.locks.request(key(context), async () => {
      requireScope(context);
      const previous = localStorage.getItem(key(context)) ? read(context) : null;
      const value = previous || { v: 3, owner: context.session.owner, role: context.role, technicianId: context.session.technicianId, vehicleId: context.vehicleId, day: context.day, sections: {} };
      for (const [kind, section] of Object.entries(sections)) {
        if (!value.sections[kind] || value.sections[kind].requestedAt <= section.requestedAt) value.sections[kind] = section;
      }
      validate(value, context); const raw = JSON.stringify(value);
      localStorage.setItem(key(context), raw);
      if (localStorage.getItem(key(context)) !== raw) throw Error('Não foi possível confirmar a gravação dos documentos neste dispositivo.');
      return value;
    });
  }
  async function load(context, relevant) {
    requireScope(context);
    const requestedAt = Date.now(); let cached = null, warning = '';
    try { cached = read(context); } catch (error) { warning = error.message; }
    const paths = {
      transport: '/api/guides/transport/latest/' + context.vehicleId,
      work: '/api/guides/stock/' + context.vehicleId + '?technicianId=' + context.session.technicianId,
      insurance: '/api/guides/vehicles/' + context.vehicleId + '/insurance',
    };
    const results = await Promise.all(kinds.map(async kind => {
      try {
        const response = await fetch(paths[kind], { headers: { Authorization: 'Bearer ' + context.session.token }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
        const data = clean(kind,await response.json().catch(() => null));
        if (response.status !== 200) throw Object.assign(Error(data?.error || 'Consulta indisponível.'), { denied: [401, 403].includes(response.status) });
        const directives = (response.headers.get('cache-control') || '').toLowerCase().split(',').map(s => s.trim());
        if (response.headers.get('x-cw-owner') !== context.session.owner || !directives.includes('private') || !directives.includes('no-store')) throw Error('A resposta documental não confirma a conta e a consulta privada.');
        validateData(kind, data, context, true);
        return { kind, source: 'live', section: { data, requestedAt, confirmedAt: new Date().toISOString() } };
      } catch (error) { return { kind, error: error.message, denied: !!error.denied }; }
    }));
    if (!same(context) || !relevant()) return null;
    if (results.some(result => result.denied)) return { sections: {}, sources: {}, warning: 'Acesso aos documentos recusado. Confirme a sessão e a viatura atribuída; os registos locais foram preservados.', denied: true };
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
          if (kinds.every(kind => sources[kind] === 'live')) warning = '';
        }
      }
      catch (error) { warning = 'Os documentos atuais não ficaram guardados para uso offline. ' + error.message; }
    }
    if (!same(context) || !relevant()) return null;
    return { sections, sources, warning, denied: false };
  }
  window.CWFieldDocuments = { scope, same, key, validate, validateData, read, save, load, consumptionSummary };
})();
