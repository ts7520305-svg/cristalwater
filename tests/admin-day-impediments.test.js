import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
function source(file) {
  return process.env.CW_ADMIN_DAY_STATES_BASELINE === 'true'
    ? execFileSync('git', ['show', '42f3e194560e4e95d585e357ac50cd0bf3ad45fc:' + file], { encoding: 'utf8' })
    : readFileSync(new URL('../' + file, import.meta.url), 'utf8');
}
const rules = { module: { exports: {} } };
vm.runInNewContext(source('frontend/cw-admin-day-rules.js'), rules);
const R = rules.module.exports;
const dayService = { module: { exports: {} }, require: name => name.endsWith('prismaClient') ? { prisma: {} } : R };
vm.runInNewContext(source('src/services/adminDayService.js'), dayService);
const monthly = { module: { exports: {} }, require: () => R };
vm.runInNewContext(source('src/business/admin/DashboardVisitBusiness.js'), monthly);
const day = '2096-09-25', range = R.bounds(day);
const visit = (id, status) => ({ id, status, plannedDate: new Date(range.start), scheduledAt: new Date(range.start), date: new Date(range.start), startAt: null, endAt: null, client: null, pool: null, technician: null, user: null, technicianName: null });
const project = (kind, id, status) => dayService.module.exports.project(kind, visit(id, status));
const statuses = ['BLOCKED', 'blocked', ' bLoCkEd ', 'RETAINED', 'retained', '\tReTaInEd\n', 'IMPEDIDO', 'impedido', ' iMpEdIdO ', 'Impédido', 'IMPE\u0301DIDO', ' impédido '];
describe('the administrative day and monthly summary share impeded visit categories', () => {
  it.each(statuses)('includes literal %s in not-done filters for regular and extra visits', status => {
    const original = visit(1, status), before = JSON.stringify(original);
    const rows = ['EXTRA', 'REGULAR'].map(kind => dayService.module.exports.project(kind, original));
    for (const row of rows) {
      expect(row.group).toBe('NOT_DONE'); expect(row.status).toBe(status); expect(R.row(row, range)).toBe(true);
      expect(R.matches(row, R.filters({ date: day, group: 'NOT_DONE' }))).toBe(true);
      for (const group of ['PLANNED', 'DONE', 'OTHER']) expect(R.matches(row, R.filters({ date: day, group }))).toBe(false);
    }
    expect(monthly.module.exports.summarize([original]).visitsNotDoneThisMonth).toBe(1);
    expect(JSON.stringify(original)).toBe(before);
  });
  it('does not classify unknown prefixes or suffixes as impediments', () => {
    for (const status of ['UNBLOCKED', 'BLOCKED_LATER', 'NOT_RETAINED', 'IMPEDIDO?', '', 'constructor']) {
      expect(project('REGULAR', 1, status).group).toBe('OTHER');
      expect(monthly.module.exports.summarize([visit(1, status)]).visitsNotDoneThisMonth).toBe(0);
    }
  });
  it('counts each impeded record once and agrees with the monthly summary on the same set', () => {
    const values = ['BLOCKED', ' retained ', 'Impédido', 'NOT_DONE', 'DONE', 'PLANNED', 'IN_PROGRESS', 'CANCELLED', 'UNKNOWN'];
    const raw = values.map((status, i) => visit(i + 1, status)), rows = raw.map(row => dayService.module.exports.project('REGULAR', row));
    const totals = R.totals(rows), summary = monthly.module.exports.summarize(raw);
    expect(totals).toEqual({ total: 9, PLANNED: 1, IN_PROGRESS: 1, DONE: 1, NOT_DONE: 4, CANCELLED: 1, OTHER: 1 });
    expect(summary.visitsNotDoneThisMonth).toBe(totals.NOT_DONE); expect(summary.visitsDoneThisMonth).toBe(totals.DONE);
    expect(summary.visitsPlannedThisMonth).toBe(totals.PLANNED + totals.IN_PROGRESS);
  });
  it('validates filtered packets with exact group and totals, refusing old misclassification', () => {
    const rows = ['EXTRA', 'REGULAR'].flatMap(kind => ['BLOCKED', 'RETAINED', 'IMPEDIDO'].map((status, i) => project(kind, i + 1, status))).sort(R.compare);
    const f = R.filters({ date: day, group: 'NOT_DONE' });
    const packet = { ok: true, version: 1, owner: 'ADMIN:1', asOf: '2096-09-25T12:00:00.000Z', timeZone: R.timeZone, basis: 'SCHEDULED_DAY', day, range, filters: f, pageSize: 50, total: 6, pages: 1, hasPrevious: false, hasNext: false, totals: { total: 6, PLANNED: 0, IN_PROGRESS: 0, DONE: 0, NOT_DONE: 6, CANCELLED: 0, OTHER: 0 }, rows };
    expect(R.packet(packet, f, 'ADMIN:1')).toBe(true);
    expect(R.packet({ ...packet, rows: rows.map(row => ({ ...row, group: 'OTHER' })) }, f, 'ADMIN:1')).toBe(false);
    expect(R.packet({ ...packet, totals: { ...packet.totals, OTHER: 6 } }, f, 'ADMIN:1')).toBe(false);
  });
});
