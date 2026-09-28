import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../frontend/admin-dashboard.js', import.meta.url), 'utf8');
const context = vm.createContext({ window: { addEventListener() {} }, localStorage: { getItem: () => null }, document: { getElementById: () => null }, Intl, Date });
vm.runInContext(source, context);
const month = '2079-01';
function packet() {
  return { ok: true, monthRef: month, visits: [], technicians: [], alerts: [], summary: {
    totalPools: 0, totalClients: 0, totalInvoicesAll: 20, openInvoicesAll: 10, overdueClients: 5,
    totalInvoices: 0, pendingInvoices: 0, partialInvoices: 0, visitsThisMonth: 0, visitsDoneThisMonth: 0,
    visitsNotDoneThisMonth: 0, visitsPlannedThisMonth: 0, openAlerts: 0,
    monthBilled: 0, monthPaid: 0, monthOpen: 0, totalBilledAll: 10000, totalOpenAll: 5000,
    totalPaidAll: 9000, operationalCost: 24,
  } };
}
const read = data => context.buildDashboardView(data, month);
describe('administrative dashboard uses the exact scope and real fields', () => {
  it('keeps monthly zeros without replacing them with historical totals', () => {
    const result = read(packet());
    expect(result.summary.monthBilled).toBe(0); expect(result.summary.monthPaid).toBe(0); expect(result.summary.monthOpen).toBe(0);
    expect(result.completionRate).toBeNull();
    expect(result).not.toHaveProperty('profit'); expect(result).not.toHaveProperty('operationsScore');
  });
  it.each([undefined, null, '0', NaN, Infinity])('rejects unconfirmed monetary fields: %s', value => {
    const data = packet(); data.summary.monthPaid = value; expect(read(data)).toBeNull();
  });
  it('retains finite signed financial amounts instead of silently turning them into zero', () => {
    const data = packet(); data.summary.monthPaid = -12.34; expect(read(data).summary.monthPaid).toBe(-12.34);
  });
  it('rejects wrong periods and incomplete responses', () => {
    expect(read({ ok: true })).toBeNull(); expect(read({ ...packet(), monthRef: '2079-02' })).toBeNull();
    expect(context.buildDashboardView(packet(), '')).toBeNull();
  });
  it('keeps other visit states distinct from planned visits', () => {
    const data = packet(); data.visits = [{}, {}, {}, {}];
    Object.assign(data.summary, { visitsThisMonth: 4, visitsDoneThisMonth: 1, visitsPlannedThisMonth: 1, visitsNotDoneThisMonth: 1 });
    const view = read(data); expect(view.otherVisits).toBe(1); expect(view.completionRate).toBe(25);
  });
  it('rejects contradictory or negative counts', () => {
    const data = packet(); data.summary.visitsDoneThisMonth = 1; expect(read(data)).toBeNull();
    data.summary.visitsDoneThisMonth = 0; data.summary.totalPools = -1; expect(read(data)).toBeNull();
  });
  it('preserves alert text and refuses duplicate identities or count mismatches', () => {
    const data = packet(); data.alerts = [{ id: 'technical-1', message: '<img src=x onerror=alert(1)>' }]; data.summary.openAlerts = 1;
    expect(read(data).alerts[0].message).toBe(data.alerts[0].message);
    data.alerts.push(data.alerts[0]); data.summary.openAlerts = 2; expect(read(data)).toBeNull();
  });
  it('does not let unsupported predictions or per-visit costs alter the view', () => {
    const data = packet(), expected = JSON.stringify(read(data));
    data.predictiveAnalysis = { tomorrowRiskZones: [{ zone: 'Anything' }], recommendations: [{ message: 'amanhã' }] };
    data.summary.operationalCost = 999999;
    const result = read(data); expect(result.completionRate).toBeNull();
    expect(result).not.toHaveProperty('estimatedProfit'); expect(result).not.toHaveProperty('tomorrowRisk');
    expect(JSON.parse(expected).month).toBe(result.month);
  });
});
