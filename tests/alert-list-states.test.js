import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const baseline = process.env.CW_ALERT_STATES_BASELINE === 'true';
function source(file) {
  return baseline ? execFileSync('git', ['show', '5849cb802840c3e77472321d4a53afa101a1a406:' + file], { encoding: 'utf8' })
    : readFileSync(new URL('../' + file, import.meta.url), 'utf8');
}
const presentation = { module: { exports: {} }, require: createRequire(new URL('../src/services/alertPresentationService.js', import.meta.url)) };
vm.runInNewContext(source('src/services/alertPresentationService.js'), presentation);
const code = source('src/business/admin/AlertListBusiness.js');
const row = (id, status = 'OPEN', extra = {}) => ({ id, status, active: true, type: 'ALERT', message: 'Literal <img src=x>', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), ...extra });
function harness(data, linked = {}, failure) {
  const calls = [];
  const tx = Object.fromEntries(['notification', 'technicalAlert', 'serviceVisit', 'alert', 'repair', 'extraVisit'].map(name => [name, { async findMany(query) {
    calls.push({ name, query });
    if (query.where.id?.in) return [...(data[name] || []), ...(linked[name] || [])].filter(row => query.where.id.in.includes(row.id));
    const after = query.where.AND[1].id.gt;
    if (failure === name && after > 0) throw Error('Later ' + name + ' page unavailable');
    expect(query.take).toBe(500);
    return (data[name] || []).filter(row => row.id > after).sort((a, b) => a.id - b.id).slice(0, 500);
  } }]));
  const prisma = { async $transaction(fn, options) { expect(options).toEqual({ isolationLevel: 'RepeatableRead', timeout: 30000 }); return fn(tx); } };
  const context = { module: { exports: {} }, require: name => name.endsWith('prismaClient') ? { prisma } : presentation.module.exports };
  vm.runInNewContext(code, context);
  return { read: context.module.exports.list, dashboard: context.module.exports.listDashboardSources, calls };
}
function consistent(result) {
  expect(result.count).toBe(result.alerts.length);
  expect(result.totals.notifications + result.totals.technical + result.totals.visits + result.totals.generic).toBe(result.count);
  for (const [source, key] of [['notification', 'notifications'], ['technical', 'technical'], ['visit', 'visits'], ['generic', 'generic']]) {
    expect(result.totals[key]).toBe(result.alerts.filter(row => row.source === source).length);
  }
}
describe('actionable alert list excludes closed source records before context and totals', () => {
  it.each(['RESOLVED', 'DONE', 'CLOSED', 'CANCELLED', 'CANCELED', 'ARCHIVED', 'SUPERSEDED'])('excludes every casing of %s in all three status-based sources', async status => {
    const variants = [status, status.toLowerCase(), [...status].map((c, i) => i % 2 ? c.toLowerCase() : c).join('')];
    const rows = variants.map((value, i) => row(i + 1, value));
    const result = await harness({ notification: rows, technicalAlert: rows, alert: rows }).read();
    expect(result.alerts).toEqual([]); expect(result.count).toBe(0); consistent(result);
  });
  it('keeps exact open and unfamiliar statuses without rewriting messages or source data', async () => {
    const rows = ['OPEN', 'pEnDiNg', 'IN_PROGRESS', 'READ', 'UNKNOWN'].map((status, i) => row(i + 1, status));
    const before = JSON.stringify(rows), result = await harness({ notification: rows, technicalAlert: rows, alert: rows }).read();
    expect(result.count).toBe(15); consistent(result);
    for (const alert of result.alerts) { expect(alert.status).toBe(rows[alert.numericId - 1].status); expect(alert.message).toBe('Literal <img src=x>'); }
    expect(JSON.stringify(rows)).toBe(before);
  });
  it('retains alerts attached to completed visits but excludes blank candidates from totals', async () => {
    const result = await harness({ serviceVisit: [row(1, 'DONE', { alerts: 'Unresolved water issue' }), row(2, 'DONE', { alerts: '   ' })] }).read();
    expect(result.alerts.map(row => row.id)).toEqual(['visit-1']); consistent(result);
  });
  it('cannot use a closed notification to change an open technical alert report context', async () => {
    const client = { id: 7, name: 'Client' }, pool = { id: 8, clientId: 7, client };
    const metadata = { alertId: 1, poolId: 8, clientId: 7, visitType: 'REGULAR', visitId: 41 };
    const h = harness({ technicalAlert: [row(1, 'OPEN', { pool, poolId: 8 })], notification: [
      row(1, 'PENDING', { clientId: 7, metadata }),
      row(2, 'rEsOlVeD', { clientId: 7, metadata: { ...metadata, visitId: 42, repairId: 73 }, createdAt: new Date('2025-01-01') }),
    ] }, { serviceVisit: [row(41, 'DONE', { pool, poolId: 8, clientId: 7, notes: 'Current context' }), row(42, 'DONE', { pool, poolId: 8, clientId: 7, notes: 'Closed context' })] });
    const result = await h.read(), technical = result.alerts.find(row => row.source === 'technical');
    expect(technical.serviceNote?.visitId).toBe(41); expect(technical.serviceNote?.notes).toBe('Current context');
    expect(h.calls.filter(call => call.query.where.id?.in).some(call => call.query.where.id.in.includes(42) || call.query.where.id.in.includes(73))).toBe(false);
    expect(result.count).toBe(2); consistent(result);
  });
  it('finds open records after two pages of closed candidates with stable exact totals', async () => {
    const rows = [...Array.from({ length: 1001 }, (_, i) => row(i + 1, 'cLoSeD')), row(1002)];
    const h = harness({ notification: rows, technicalAlert: rows, alert: rows });
    const first = await h.read(), again = await h.read();
    expect(first.count).toBe(3); consistent(first); expect(again).toEqual(first);
    expect(first.alerts.every(row => row.numericId === 1002)).toBe(true);
  });
  it('excludes superseded alerts from the dashboard snapshot too', async () => {
    const rows = [row(1, 'SUPERSEDED'), row(2, 'sUpErSeDeD'), row(3)];
    const result = await harness({ notification: rows, technicalAlert: rows }).dashboard();
    expect(result.coverage.total).toBe(2); expect(result.coverage.returned).toBe(2);
    expect(result.notificationAlerts.map(row => row.id)).toEqual([3]);
    expect(result.technicalAlerts.map(row => row.id)).toEqual([3]);
  });
  it.each(['notification', 'technicalAlert', 'serviceVisit', 'alert'])('rejects a late %s read failure instead of claiming an empty list', async name => {
    const h = harness({ [name]: Array.from({ length: 501 }, (_, i) => row(i + 1, 'closed')) }, {}, name);
    await expect(h.read()).rejects.toThrow('Later ' + name + ' page unavailable');
  });
});
