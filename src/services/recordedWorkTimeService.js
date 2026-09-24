'use strict';

// A recorded interval belongs to one technician and one typed service. Touching
// endpoints are allowed; two services cannot both consume the same working time.
const key = row => row.type + ':' + row.id;
const millis = value => value instanceof Date ? value.getTime() : NaN;
const openStates = new Set(['IN_PROGRESS', 'STARTED', 'IN_EXECUTION']);
const select = { id: true, technicianId: true, status: true, startAt: true, endAt: true };
function span(row, open = false) {
  const start = millis(row.startAt);
  const end = row.endAt === null && open && openStates.has(String(row.status).trim().toUpperCase()) ? Infinity : millis(row.endAt);
  return Number.isSafeInteger(row.technicianId) && row.technicianId > 0 && Number.isFinite(start) && end > start
    ? { key: key(row), technicianId: row.technicianId, start, end } : null;
}

// Each prefix retains the two furthest ends with distinct identities. This lets
// a batched financial read exclude the service itself without scanning the full
// technician history for every allocation.
function index(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.technicianId)) groups.set(row.technicianId, []);
    groups.get(row.technicianId).push(row);
  }
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.start - b.start);
    let first = null, second = null;
    for (const row of rows) {
      const distinct = new Map();
      for (const item of [first, second, row].filter(Boolean)) if (!distinct.has(item.key) || item.end > distinct.get(item.key).end) distinct.set(item.key, item);
      [first, second] = [...distinct.values()].sort((a,b) => b.end-a.end);
      row.first = first; row.second = second;
    }
  }
  return groups;
}
function intersects(groups, target) {
  const rows = groups.get(target.technicianId) || [];
  let low = 0, high = rows.length;
  while (low < high) { const mid = (low + high) >>> 1; if (rows[mid].start < target.end) low = mid + 1; else high = mid; }
  const prefix = rows[low - 1];
  return !!prefix && [prefix.first, prefix.second].some(row => row && row.key !== target.key && row.end > target.start);
}
async function conflicts(db, requested) {
  const spans = requested.map(row => span(row)).filter(Boolean), windows = new Map();
  for (const row of spans) {
    const window = windows.get(row.technicianId);
    if (window) { window.start = Math.min(window.start, row.start); window.end = Math.max(window.end, row.end); }
    else windows.set(row.technicianId, { ...row });
  }
  if (!windows.size) return new Set();
  const visitWindows = [...windows.values()].map(row => ({ technicianId: row.technicianId, startAt: { lt: new Date(row.end) }, OR: [{ endAt: { gt: new Date(row.start) } }, { endAt: null }] }));
  const repairWindows = [...windows.values()].map(row => ({ technicianId: row.technicianId, startedAt: { lt: new Date(row.end) }, endedAt: { gt: new Date(row.start) } }));
  const [regular, extra, repairs, reminders] = await Promise.all([
    db.serviceVisit.findMany({ where: { OR: visitWindows }, select }),
    db.extraVisit.findMany({ where: { OR: visitWindows }, select }),
    db.repairWorkInterval.findMany({ where: { voidedAt: null, OR: repairWindows }, select: { id: true, technicianId: true, startedAt: true, endedAt: true } }),
    db.reminderResourceDeclaration.findMany({ where: { voidedAt: null, OR: repairWindows } })
  ]);
  // Bounds serve the indexed query only. Verified declarations contribute each
  // actual interval; damaged evidence conservatively reserves the whole span.
  const multiple = reminders.filter(row => row.snapshot?.preview?.schema === 2);
  const receipts = multiple.length ? await db.fieldWriteRequest.findMany({ where: { scope:'REMINDER_RESOURCES',resourceId:{in:[...new Set(multiple.map(row=>row.reminderId))]} } }) : [];
  const reminderSpans = (await Promise.all(reminders.map(async row => {
    if (row.snapshot?.preview?.schema === 2 && await require('./reminderResourceService').intact(row,receipts)) {
      return require('../../frontend/cw-reminder-resource-rules').intervals(row.snapshot.preview.proposed).map(w => span({...row,type:'REMINDER_RESOURCE',startAt:new Date(w.startedAt),endAt:new Date(w.endedAt)}));
    }
    return [span({...row,type:'REMINDER_RESOURCE',startAt:row.startedAt,endAt:row.endedAt})];
  }))).flat();
  const candidates = [
    ...regular.map(row => span({ ...row, type: 'REGULAR' }, true)),
    ...extra.map(row => span({ ...row, type: 'EXTRA' }, true)),
    ...repairs.map(row => span({ ...row, type: 'REPAIR_INTERVAL', startAt: row.startedAt, endAt: row.endedAt })),
    ...reminderSpans
  ].filter(Boolean);
  const groups = index(candidates);
  return new Set(spans.filter(row => intersects(groups, row)).map(row => row.key));
}

module.exports = { conflicts, key };
