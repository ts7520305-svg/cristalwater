(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CWCompanyClosureRules = factory();
}(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const scope = 'COMPANY_CLOSURE';
  const types = ['HOLIDAY', 'CHRISTMAS', 'SUMMER_BREAK', 'PUBLIC_HOLIDAY', 'INTERNAL_MAINTENANCE'];
  const actions = ['PREVIEW_ONLY', 'CREATE_REPLAN_TASKS', 'MARK_FOR_REVIEW'];
  const booleans = ['notifyClients', 'notifyTechnicians', 'showOnClientPortal', 'pauseNormalVisits', 'allowCriticalServices'];
  const strings = { title: 200, messageTitle: 250, messageBody: 6000, emergencyPhone: 80, emergencyEmail: 254 };
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const positive = v => Number.isSafeInteger(v) && v > 0 && v <= 2147483647;
  const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
  const version = v => typeof v === 'string' && /^company-closure-v2:[a-f0-9]{64}$/.test(v);
  const day = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + 'T00:00:00Z')) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v && v >= '1900-01-01' && v <= '9998-12-31';
  const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
  const fieldKeys = [...Object.keys(strings), ...booleans, 'startDate', 'endDate', 'closureType', 'status', 'routeAction'];
  function fields(value) {
    return exact(value, fieldKeys) && Object.entries(strings).every(([key, max]) => typeof value[key] === 'string' && value[key].length <= max) && value.title.trim().length > 0 && booleans.every(key => typeof value[key] === 'boolean') && day(value.startDate) && day(value.endDate) && value.startDate <= value.endDate && types.includes(value.closureType) && ['PLANNED', 'ACTIVE'].includes(value.status) && actions.includes(value.routeAction);
  }
  const operations = ['CREATE', 'UPDATE', 'ACTIVATE', 'CANCEL', 'NOTIFY'];
  function command(value) {
    if (!exact(value, ['requestId', 'operation', 'closureId', 'expectedVersion', 'fields']) || !uuid(value.requestId) || !operations.includes(value.operation)) return false;
    if (value.operation === 'CREATE' ? value.closureId !== null || value.expectedVersion !== null : !positive(value.closureId) || !version(value.expectedVersion)) return false;
    if (['CREATE', 'UPDATE'].includes(value.operation)) return fields(value.fields);
    if (value.operation === 'CANCEL') return exact(value.fields, ['reason']) && typeof value.fields.reason === 'string' && value.fields.reason.trim().length > 0 && value.fields.reason.length <= 1000;
    return exact(value.fields, []);
  }
  const intent = value => ({ operation: value.operation, closureId: value.closureId, expectedVersion: value.expectedVersion, fields: value.fields });
  const envelope = value => ({ v: 1, scope, resourceId: value.closureId || 1, payload: intent(value) });
  const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
  const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  function state(value) {
    const c = value?.closure;
    return object(value) && positive(c?.id) && typeof c.title === 'string' && typeof c.status === 'string' && typeof c.closureType === 'string' && typeof c.routeAction === 'string' && booleans.every(key => typeof c[key] === 'boolean') && ['startDate', 'endDate', 'updatedAt'].every(k => typeof c[k] === 'string' && Number.isFinite(Date.parse(c[k]))) && Date.parse(c.endDate) >= Date.parse(c.startDate) && version(value.version) && value.automaticReplanning === false && value.timeZone === 'UTC';
  }
  function editable(value) {
    const c = value.closure;
    return Object.fromEntries(fieldKeys.map(key => [key, ['startDate', 'endDate'].includes(key) ? c[key].slice(0, 10) : c[key] ?? '']));
  }
  function updateValues(before, changes) {
    return Object.fromEntries(fieldKeys.map(key => {
      if (['startDate', 'endDate'].includes(key)) return [key, changes[key] === before[key].slice(0, 10) ? before[key] : changes[key] + (key === 'startDate' ? 'T00:00:00.000Z' : 'T23:59:59.999Z')];
      return [key, before[key] === null && changes[key] === '' ? null : changes[key]];
    }));
  }
  return { scope, types, actions, booleans, strings, fieldKeys, day, positive, uuid, version, object, exact, fields, command, intent, envelope, canonical, equal, state, editable, updateValues };
}));
