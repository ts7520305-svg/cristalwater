import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({ window: { addEventListener() {} }, localStorage: { getItem: () => 'session' }, setInterval() {}, document: { getElementById: () => null }, Intl, Date });
vm.runInContext(readFileSync(new URL('../frontend/dashboard.js', import.meta.url), 'utf8'), context);
function packet() {
  return { ok: true, monthRef: '2081-01', summary: { totalClients: 1, totalPools: 1, openAlerts: 1, visitsThisMonth: 4, visitsDoneThisMonth: 1, visitsNotDoneThisMonth: 1, visitsPlannedThisMonth: 1, monthBilled: 0, monthPaid: 0, monthOpen: 0 },
    visits: [1, 2, 3, 4].map(id => ({ id })), alerts: [{ id: 'visit-3', source: 'visit', message: '<img src=x> literal' }],
    poolsByZone: [{ zone: '__proto__', count: 1 }], topDebtors: [{ invoiceId: 1, clientId: 1, clientName: '<img>', monthRef: '2079-01', amountOpen: 2 }],
    latestPayments: [{ paymentId: 1, clientName: 'Cliente', method: 'CASH', amount: -4, paidAt: '2081-01-01T12:00:00Z' }],
    monthlyEvolution: [{ month: '2080-12', billed: 0, paid: -4, open: 0 }],
    alertCoverage: { scope: 'DASHBOARD_ALERT_SOURCES_ALL_PERIODS', totalsComplete: true, limitPerSource: 200, total: 1, returned: 1, truncated: false, sources: { technical: { total: 0, returned: 0 }, notification: { total: 0, returned: 0 }, visit: { total: 1, returned: 1 } } } };
}
const build = value => context.buildLegacyDashboardView(value, '2081-01');
describe('legacy administrative dashboard confirms the actual response contract', () => {
  it('keeps exact zero, signed amounts, literal names and unknown business fields', () => {
    const value = packet(), original = JSON.stringify(value), view = build(value);
    expect(view.summary.monthBilled).toBe(0); expect(view.otherVisits).toBe(1);
    expect(view.data.latestPayments[0].amount).toBe(-4); expect(view.data.poolsByZone[0].zone).toBe('__proto__');
    expect(view.summary.totalCreditBalance).toBeUndefined(); expect(JSON.stringify(value)).toBe(original);
  });
  it.each(['totalClients', 'totalPools', 'openAlerts', 'visitsThisMonth', 'visitsDoneThisMonth', 'visitsNotDoneThisMonth', 'visitsPlannedThisMonth', 'monthBilled', 'monthPaid', 'monthOpen'])('does not turn missing %s into zero', key => {
    const value = packet(); delete value.summary[key]; expect(build(value)).toBeNull();
  });
  it.each([null, '', '0', NaN, Infinity])('refuses an invalid monthly amount %s', invalid => {
    const value = packet(); value.summary.monthPaid = invalid; expect(build(value)).toBeNull();
  });
  it.each(['visits', 'alerts', 'poolsByZone', 'topDebtors', 'latestPayments', 'monthlyEvolution'])('rejects missing %s rather than inventing an empty result', key => {
    const value = packet(); delete value[key]; expect(build(value)).toBeNull();
  });
  it('refuses overlapping visit categories, wrong row counts and zone counts', () => {
    const value = packet(); value.summary.visitsPlannedThisMonth = 4; expect(build(value)).toBeNull();
    value.summary.visitsPlannedThisMonth = 1; value.visits.pop(); expect(build(value)).toBeNull();
    value.visits.push({ id: 4 }); value.poolsByZone[0].count = 2; expect(build(value)).toBeNull();
  });
  it.each(['visits', 'alerts', 'poolsByZone', 'topDebtors', 'latestPayments', 'monthlyEvolution'])('refuses duplicate %s entries', key => {
    const value = packet(); value[key].push(value[key][0]); expect(build(value)).toBeNull();
  });
  it('rejects wrong months, malformed rows, unsafe client IDs and invalid dates', () => {
    for (const change of [v => { v.monthRef = '2081-02'; }, v => { v.ok = false; }, v => { v.topDebtors[0].clientId = '1);alert(1)'; }, v => { v.latestPayments[0].paidAt = 'invalid'; }, v => { v.alerts[0] = null; }]) {
      const value = packet(); change(value); expect(build(value)).toBeNull();
    }
    expect(context.buildLegacyDashboardView(packet(), '2081-13')).toBeNull();
  });
  it('shows an unknown alert total without source coverage and rejects contradictory metadata', () => {
    const value = packet(); delete value.alertCoverage; expect(build(value).coverage).toBeUndefined();
    for (const key of ['scope', 'totalsComplete', 'limitPerSource', 'total', 'returned', 'truncated', 'sources']) {
      const item = packet(); delete item.alertCoverage[key]; expect(build(item)).toBeNull();
    }
    const item = packet(); item.alertCoverage.total = 2; item.alertCoverage.truncated = true; expect(build(item)).toBeNull();
  });
  it('retains a complete total above the preview without truncating it to loaded rows', () => {
    const value = packet(); value.alerts = Array.from({ length: 200 }, (_, i) => ({ id: 'visit-' + (i + 1), source: 'visit', message: 'Literal' }));
    value.summary.openAlerts = 200; Object.assign(value.alertCoverage, { total: 503, returned: 200, truncated: true }); value.alertCoverage.sources.visit = { total: 503, returned: 200 };
    expect(build(value).coverage.total).toBe(503); expect(build(value).data.alerts).toHaveLength(200);
  });
  it('formats known signed and zero amounts while leaving unsupported values unknown', () => {
    expect(context.formatMoney(0)).toBe('0,00 €'); expect(context.formatMoney(-12.34)).toBe('-12,34 €');
    for (const value of [undefined, null, '', '0', NaN]) expect(context.formatMoney(value)).toBe('—');
  });
});
