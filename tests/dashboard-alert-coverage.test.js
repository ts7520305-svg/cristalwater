import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const presentation = require('../src/services/alertPresentationService');
const source = fs.readFileSync(new URL('../src/business/admin/AlertListBusiness.js', import.meta.url), 'utf8');
function row(id, extra = {}) { return { id, status: 'OPEN', type: 'ALERT', alerts: 'literal', reason: null, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), date: new Date('2026-01-01'), ...extra }; }
function harness(data, failure) {
  const calls = [];
  const tx = Object.fromEntries(['technicalAlert', 'notification', 'serviceVisit'].map(name => [name, {
    async findMany(query) {
      calls.push({ name, query });
      if (query.where.id?.in) {
        const found = (data[name] || []).filter(row => query.where.id.in.includes(row.id));
        return failure === 'incomplete' ? found.slice(1) : found;
      }
      const after = query.where.AND[1].id.gt;
      if (failure === name && after > 0) throw Error(name + ' later page unavailable');
      expect(query.take).toBe(500); expect(query.orderBy).toEqual({ id: 'asc' }); expect(query.include).toBeUndefined();
      return (data[name] || []).filter(row => row.id > after).sort((a, b) => a.id - b.id).slice(0, query.take);
    },
  }]));
  const prisma = { $transaction: async (fn, options) => { expect(options).toEqual({ isolationLevel: 'RepeatableRead', timeout: 30000 }); return fn(tx); } };
  const sandbox = { require: name => name.endsWith('prismaClient') ? { prisma } : presentation, module: { exports: {} } };
  vm.runInNewContext(source, sandbox);
  return { read: sandbox.module.exports.listDashboardSources, calls };
}
describe('dashboard alert totals and bounded previews', () => {
  it.each([0, 199, 200, 201, 500, 1001])('counts all %i rows per source and retains at most 200', async size => {
    const rows = Array.from({ length: size }, (_, i) => row(i + 1));
    const h = harness({ technicalAlert: rows, notification: rows, serviceVisit: rows });
    const result = await h.read(), returned = Math.min(200, size);
    expect(result.coverage.total).toBe(size * 3); expect(result.coverage.returned).toBe(returned * 3);
    expect(result.coverage.truncated).toBe(size > 200); expect(result.coverage.totalsComplete).toBe(true);
    for (const key of ['technical', 'notification', 'visit']) expect(result.coverage.sources[key]).toEqual({ total: size, returned });
    for (const key of ['technicalAlerts', 'notificationAlerts', 'visitAlerts']) expect(result[key].map(row => row.id)).toEqual(rows.map(row => row.id).reverse().slice(0, 200));
    expect(h.calls.filter(call => call.query.include).every(call => call.query.where.id.in.length <= 200)).toBe(true);
  });
  it('fills the preview after excluding closed statuses and blank visit messages', async () => {
    const open = Array.from({ length: 201 }, (_, i) => row(i + 1));
    const closed = Array.from({ length: 310 }, (_, i) => row(i + 202, { status: i % 2 ? 'resolved' : 'cLoSeD', alerts: '   ' }));
    const result = await harness({ technicalAlert: [...open, ...closed], notification: [...open, ...closed], serviceVisit: [...open, ...closed] }).read();
    expect(result.coverage.total).toBe(603); expect(result.coverage.returned).toBe(600);
    expect(result.technicalAlerts.some(row => row.id > 201)).toBe(false);
  });
  it('uses dates then unique IDs and retains the visit secondary date order', async () => {
    const rows = [row(8), row(1, { createdAt: new Date('2027-01-01'), date: new Date('2028-01-01') }), row(2)];
    const original = JSON.stringify(rows);
    const result = await harness({ technicalAlert: rows, serviceVisit: rows }).read();
    expect(result.technicalAlerts.map(row => row.id)).toEqual([1, 8, 2]);
    expect(result.visitAlerts.map(row => row.id)).toEqual([1, 8, 2]); expect(JSON.stringify(rows)).toBe(original);
  });
  it.each(['technicalAlert', 'notification', 'serviceVisit'])('rejects late %s failures after the preview was filled', async name => {
    const h = harness({ [name]: Array.from({ length: 501 }, (_, i) => row(i + 1)) }, name);
    await expect(h.read()).rejects.toThrow(name + ' later page unavailable');
  });
  it('rejects missing hydrated records instead of certifying a partial preview', async () => {
    await expect(harness({ technicalAlert: [row(1)] }, 'incomplete').read()).rejects.toThrow('Incomplete dashboard alert preview');
  });
});

const context = vm.createContext({ window: { addEventListener() {} }, localStorage: { getItem: () => null }, document: { getElementById: () => null }, Intl, Date });
vm.runInContext(fs.readFileSync(new URL('../frontend/admin-dashboard.js', import.meta.url), 'utf8'), context);
function coverage() { return { scope: 'DASHBOARD_ALERT_SOURCES_ALL_PERIODS', totalsComplete: true, limitPerSource: 200, total: 603, returned: 600, truncated: true, sources: Object.fromEntries(['technical', 'notification', 'visit'].map(key => [key, { total: 201, returned: 200 }])) }; }
const alerts = ['technical', 'notification', 'visit'].flatMap(source => Array.from({ length: 200 }, (_, i) => ({ id: source + '-' + i, source, message: '<img> literal' })));
describe('dashboard refuses unsupported alert totals', () => {
  it('retains complete counts and partial-preview scope', () => {
    expect(context.readAlertCoverage(coverage(), alerts)?.total).toBe(603);
    expect(context.readAlertCoverage(undefined, alerts)).toBeUndefined();
  });
  it.each(['scope', 'totalsComplete', 'limitPerSource', 'total', 'returned', 'truncated', 'sources'])('rejects a missing %s', key => {
    const value = coverage(); delete value[key]; expect(context.readAlertCoverage(value, alerts)).toBeNull();
  });
  it('rejects conflicting source totals, missing rows, wrong sources and negative counts', () => {
    const value = coverage(); value.sources.technical.total = 999; expect(context.readAlertCoverage(value, alerts)).toBeNull();
    expect(context.readAlertCoverage(coverage(), alerts.slice(1))).toBeNull();
    expect(context.readAlertCoverage(coverage(), alerts.map(row => ({ ...row, source: 'unknown' })))).toBeNull();
    value.sources.technical.total = -1; expect(context.readAlertCoverage(value, alerts)).toBeNull();
  });
  it('accepts a confirmed empty result', () => {
    const value = coverage(); value.total = value.returned = 0; value.truncated = false;
    for (const row of Object.values(value.sources)) row.total = row.returned = 0;
    expect(context.readAlertCoverage(value, [])?.total).toBe(0);
  });
});
