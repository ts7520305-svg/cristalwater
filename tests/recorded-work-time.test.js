import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { conflicts, key } = require('../src/services/recordedWorkTimeService');
const date = n => new Date(Date.UTC(2004, 0, 1) + n * 1000);
const visit = (id, start, end, extra = {}) => ({ id, type: 'REGULAR', technicianId: 1, status: 'DONE', startAt: date(start), endAt: end === null ? null : date(end), ...extra });
function database(regular = [], extra = [], repairs = []) {
  return { serviceVisit: { findMany: vi.fn(async () => regular) }, extraVisit: { findMany: vi.fn(async () => extra) }, repairWorkInterval: { findMany: vi.fn(async () => repairs) } };
}
describe('recorded technician time across typed services', () => {
  it('allows adjacent endpoints and excludes only the same typed identity', async () => {
    const row = visit(1, 0, 60), db = database([row, visit(2, 60, 120)], [visit(1, -60, 0)]);
    expect(await conflicts(db, [row])).toEqual(new Set());
    db.extraVisit.findMany.mockResolvedValue([visit(1, 0, 60)]);
    expect(await conflicts(db, [row])).toEqual(new Set(['REGULAR:1']));
  });
  it('detects containment even when the immediately preceding short interval has ended', async () => {
    const row = visit(8, 100, 200), db = database([visit(1, 0, 500), visit(2, 5, 10), visit(3, 50, 60), row]);
    expect(await conflicts(db, [row])).toEqual(new Set(['REGULAR:8']));
  });
  it('excludes simultaneous work by another technician and ignores unstarted or invalid times', async () => {
    const row = visit(1, 0, 60);
    expect(await conflicts(database([row, visit(2, 0, 60, { technicianId: 2 }), visit(3, 0, 60, { startAt: null }), visit(4, 30, 10)]), [row])).toEqual(new Set());
  });
  it('reserves unfinished work only for a normalized in-progress state', async () => {
    const row = visit(1, 10, 60), db = database([row, visit(2, 0, null, { status: 'PLANNED' })]);
    expect(await conflicts(db, [row])).toEqual(new Set());
    for (const status of [' in_progress ', 'STARTED', 'IN_EXECUTION']) {
      db.extraVisit.findMany.mockResolvedValue([visit(3, 0, null, { status })]);
      expect(await conflicts(db, [row])).toEqual(new Set(['REGULAR:1']));
    }
  });
  it('includes active declared repair intervals with a separate identity', async () => {
    const row = visit(1, 0, 60), repair = { id: 1, technicianId: 1, startedAt: date(0), endedAt: date(60) }, db = database([row], [], [repair]);
    expect(await conflicts(db, [row])).toEqual(new Set(['REGULAR:1']));
    expect(db.repairWorkInterval.findMany.mock.calls[0][0].where.voidedAt).toBe(null);
    const target = { ...row, type: 'REPAIR_INTERVAL' };
    expect(await conflicts(database([], [], [repair]), [target])).toEqual(new Set());
  });
  it('does not query a cost source without valid completed time and propagates database failures', async () => {
    const db = database();
    expect(await conflicts(db, [visit(1, 0, null), visit(2, 0, 60, { technicianId: null })])).toEqual(new Set());
    expect(db.serviceVisit.findMany).not.toHaveBeenCalled();
    db.serviceVisit.findMany.mockRejectedValue(Error('unavailable'));
    await expect(conflicts(db, [visit(1, 0, 60)])).rejects.toThrow('unavailable');
  });
  it('batches reads by technician without narrowing to the selected client or month', async () => {
    const db = database();
    await conflicts(db, [visit(1, 0, 60), visit(2, 60, 120), visit(3, 200, 260, { technicianId: 2 })]);
    expect(db.serviceVisit.findMany).toHaveBeenCalledTimes(1);
    expect(db.serviceVisit.findMany.mock.calls[0][0].where).toEqual({ OR: [
      { technicianId: 1, startAt: { lt: date(120) }, OR: [{ endAt: { gt: date(0) } }, { endAt: null }] },
      { technicianId: 2, startAt: { lt: date(260) }, OR: [{ endAt: { gt: date(200) } }, { endAt: null }] }
    ] });
  });
  it('matches an independent pairwise oracle for nested, equal, short and long intervals', async () => {
    let seed = 305;
    const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
    const rows = Array.from({ length: 1200 }, (_, id) => { const start = random(20000); return visit(id + 1, start, start + 1 + random(500), { technicianId: 1 + random(12), type: random(2) ? 'REGULAR' : 'EXTRA' }); });
    const expected = new Set(rows.filter(a => rows.some(b => key(a) !== key(b) && a.technicianId === b.technicianId && a.startAt < b.endAt && b.startAt < a.endAt)).map(key));
    expect(await conflicts(database(rows.filter(r => r.type === 'REGULAR'), rows.filter(r => r.type === 'EXTRA')), rows)).toEqual(expected);
  });
});
