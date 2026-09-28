import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const source = process.env.CW_DASHBOARD_CONTROLLER_BASELINE === 'true'
  ? execFileSync('git', ['show', '7e94fb53db461bb1f7eb30d732f435b7755f563a:src/controllers/dashboardController.js'], { encoding: 'utf8' })
  : readFileSync(new URL('../src/controllers/dashboardController.js', import.meta.url), 'utf8');
async function summary(pools) {
  const prisma = Object.fromEntries(['client', 'pool', 'technician', 'invoice', 'payment', 'technicalAlert', 'notification', 'serviceVisit'].map(model => [model, { findMany: async () => model === 'pool' ? pools : [] }]));
  const sandbox = { module: { exports: {} }, require(name) {
    if (name === '../prismaClient') return { prisma };
    if (name === '../services/clientCreditService') return { isReceivableInvoice: () => true };
    if (name === '../business/finance/FinanceOsBusiness') return { listExternalInvoices: async () => ({ summary: {} }) };
    if (name === '../business/admin/AlertListBusiness') return { listDashboardSources: async () => ({ technicalAlerts: [], notificationAlerts: [], visitAlerts: [] }) };
    if (name === '../business/admin/DashboardVisitBusiness') return { summarize: () => ({ visitsDoneThisMonth: 0, visitsPlannedThisMonth: 0, visitsNotDoneThisMonth: 0 }) };
    throw Error('Unexpected dependency ' + name);
  } };
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  const result = await sandbox.module.exports.getAdminDashboardData({ query: { monthRef: '2077-01' } });
  return { zones: JSON.parse(JSON.stringify(result.poolsByZone)), total: result.summary.totalPools, polluted: vm.runInContext('Object.hasOwn(Object.prototype, "count") || Object.hasOwn(Object, "count") || Object.hasOwn(Object.prototype.toString, "count")', sandbox) };
}

describe('dashboard zone names are data, not inherited object properties', () => {
  it('counts reserved names without altering prototypes', async () => {
    const data = await summary(['__proto__', 'constructor', 'toString'].map(zone => ({ zone })));
    expect(data.zones).toEqual([{ zone: '__proto__', count: 1 }, { zone: 'constructor', count: 1 }, { zone: 'toString', count: 1 }]);
    expect(data.total).toBe(3); expect(data.polluted).toBe(false);
  });
  it('retains duplicate counts, location fallback and missing-zone grouping', async () => {
    const data = await summary([{ zone: 'Lagos' }, { zone: 'Lagos' }, { zone: null, location: 'Burgau' }, { zone: '' }]);
    expect(data.zones).toEqual([{ zone: 'Lagos', count: 2 }, { zone: 'Burgau', count: 1 }, { zone: 'Sem zona', count: 1 }]);
    expect(data.zones.reduce((sum, row) => sum + row.count, 0)).toBe(data.total);
  });
  it('retains empty input and literal user text', async () => {
    expect((await summary([])).zones).toEqual([]);
    expect((await summary([{ zone: '<img src=x onerror=alert(1)>' }])).zones).toEqual([{ zone: '<img src=x onerror=alert(1)>', count: 1 }]);
  });
});
