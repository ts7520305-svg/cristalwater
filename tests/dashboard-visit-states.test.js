import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url), month = '2146-03';
const source = process.env.CW_DASHBOARD_VISIT_BASELINE === 'true'
  ? execFileSync('git', ['show', '97cb9c3112c774665514d1a15d8749ea2ac54874:src/controllers/dashboardController.js'], { encoding: 'utf8' })
  : readFileSync(new URL('../src/controllers/dashboardController.js', import.meta.url), 'utf8');
const viewContext = vm.createContext({ window: { addEventListener() {} }, localStorage: { getItem: () => null }, document: { getElementById: () => null }, Intl, Date });
vm.runInContext(readFileSync(new URL('../frontend/admin-dashboard.js', import.meta.url), 'utf8'), viewContext);
async function read(statuses) {
  const visits = statuses.map((status, i) => ({ id: i + 1, status, plannedDate: new Date(month + '-15T12:00:00Z') }));
  const before = JSON.stringify(visits);
  const prisma = Object.fromEntries(['client', 'pool', 'technician', 'invoice', 'payment', 'serviceVisit'].map(model => [model, { findMany: async () => model === 'serviceVisit' ? visits : [] }]));
  const sandbox = { module: { exports: {} }, require(name) {
    if (name === '../prismaClient') return { prisma };
    if (name === '../business/admin/DashboardSnapshotBusiness') return { readDashboardSources: async () => ({ clients: [], pools: [], technicians: [], invoices: [], payments: [], visits, dashboardAlerts: { technicalAlerts: [], notificationAlerts: [], visitAlerts: [] }, externalBilling: { summary: {} } }) };
    if (name === '../services/clientCreditService') return { isReceivableInvoice: () => true };
    if (name === '../business/finance/FinanceOsBusiness') return { listExternalInvoices: async () => ({ summary: {} }) };
    if (name === '../business/admin/AlertListBusiness') return { listDashboardSources: async () => ({ technicalAlerts: [], notificationAlerts: [], visitAlerts: [] }) };
    if (name === '../business/admin/DashboardVisitBusiness') return require('../src/business/admin/DashboardVisitBusiness');
    throw Error('Unexpected dependency ' + name);
  } };
  vm.runInNewContext(source, sandbox);
  const data = await sandbox.module.exports.getAdminDashboardData({ query: { monthRef: month } });
  expect(JSON.stringify(visits)).toBe(before);
  return { data, view: viewContext.buildDashboardView({ ok: true, ...data }, month) };
}
const counts = data => [data.summary.visitsDoneThisMonth, data.summary.visitsPlannedThisMonth, data.summary.visitsNotDoneThisMonth];
describe('monthly visit categories are exclusive and keep literal status evidence', () => {
  it.each(['NOT_DONE', 'BLOCKED', 'RETAINED', 'IMPEDIDO', ' blocked ', 'Não concluída', 'FAILED'])('does not also count %s as planned or reject the dashboard', async status => {
    const { data, view } = await read([status]);
    expect(counts(data)).toEqual([0, 0, 1]);
    expect(view).not.toBeNull(); expect(view.otherVisits).toBe(0); expect(view.completionRate).toBe(0);
    expect(data.visits[0].status).toBe(status);
  });
  it.each(['ARCHIVED', 'DONE_LATER', 'NOT_IN_PROGRESS', 'constructor', '', '   '])('retains %s in other states without assuming planned work', async status => {
    const { data, view } = await read([status]);
    expect(counts(data)).toEqual([0, 0, 0]); expect(view.otherVisits).toBe(1);
    expect(data.visits[0].status).toBe(status);
  });
  it('uses the existing exact aliases for done, planned, in progress and cancelled', async () => {
    const statuses = ['DONE', 'completed', 'Concluída', 'CONCLUIDO', 'PLANNED', 'PENDING', 'PENDING_TECHNICIAN', 'Agendada', 'PLANEADO', 'IN_PROGRESS', 'Em execução', 'CANCELLED', 'Canceled', 'Cancelada', 'CANCELADO'];
    const { data, view } = await read(statuses);
    expect(counts(data)).toEqual([4, 7, 0]); expect(view.otherVisits).toBe(4);
    expect(data.visits.map(row => row.status)).toEqual(statuses);
  });
  it('does not let cancelled visits hide overlap in a mixed month', async () => {
    const { data, view } = await read(['NOT_DONE', 'BLOCKED', 'PLANNED', 'DONE', 'CANCELLED', 'CANCELED']);
    expect(counts(data)).toEqual([1, 1, 2]); expect(view.otherVisits).toBe(2);
    expect(counts(data).reduce((sum, value) => sum + value, view.otherVisits)).toBe(6);
  });
  it('retains an empty month without inventing a completion percentage', async () => {
    const { data, view } = await read([]);
    expect(counts(data)).toEqual([0, 0, 0]); expect(view.otherVisits).toBe(0); expect(view.completionRate).toBeNull();
  });
  it('counts 6000 records once with order-independent results', async () => {
    const statuses = Array.from({ length: 1000 }, () => ['NOT_DONE', 'RETAINED', 'PLANNED', 'IN_PROGRESS', 'DONE', 'UNKNOWN']).flat();
    const first = await read(statuses), reversed = await read(statuses.slice().reverse());
    expect(counts(first.data)).toEqual([1000, 2000, 2000]); expect(first.view.otherVisits).toBe(1000);
    expect(counts(reversed.data)).toEqual(counts(first.data)); expect(reversed.view.otherVisits).toBe(first.view.otherVisits);
  });
});

describe('dashboard sources share one complete database snapshot', () => {
  const snapshotSource = readFileSync(new URL('../src/business/admin/DashboardSnapshotBusiness.js', import.meta.url), 'utf8');
  const sourceNames = ['client', 'pool', 'technician', 'invoice', 'payment', 'serviceVisit', 'alerts', 'external'];
  function setup(failure) {
    const calls = [], transactions = [], output = Object.fromEntries(sourceNames.map(name => [name, Object.freeze([{ source: name }])])), error = Error('failed ' + failure);
    const read = async (name, query) => { calls.push({ name, query }); if (failure === name) throw error; return output[name]; };
    const tx = Object.fromEntries(sourceNames.slice(0, 6).map(name => [name, { findMany: query => read(name, query) }]));
    const prisma = new Proxy({ $transaction: async (callback, options) => {
      transactions.push(options); if (failure === 'transaction') throw error; return callback(tx);
    } }, { get(target, key) { if (key !== '$transaction') throw Error('Read outside transaction: ' + key); return target[key]; } });
    const sandbox = { module: { exports: {} }, require(name) {
      if (name === '../../prismaClient') return { prisma };
      if (name === './AlertListBusiness') return { listDashboardSources: transaction => { expect(transaction).toBe(tx); return read('alerts'); } };
      if (name === '../finance/FinanceOsBusiness') return { listExternalInvoices: (query, flat, transaction) => {
        expect(transaction).toBe(tx); expect(query).toEqual({ status: 'all' }); expect(flat).toBe(false); return read('external', query);
      } };
      throw Error('Unexpected dependency ' + name);
    } };
    vm.runInNewContext(snapshotSource, sandbox);
    return { ...sandbox.module.exports, calls, transactions, output, error };
  }
  const bounds = { start: new Date('2089-03-01T00:00:00Z'), end: new Date('2089-03-31T23:59:59.999Z') };
  it('keeps all eight sources in one RepeatableRead transaction and preserves period/relations', async () => {
    const run = setup(), result = await run.readDashboardSources(bounds);
    expect(run.transactions).toEqual([{ isolationLevel: 'RepeatableRead', timeout: 30000 }]);
    expect(run.calls.map(call => call.name).sort()).toEqual(sourceNames.slice().sort());
    const sources = { clients: 'client', pools: 'pool', technicians: 'technician', invoices: 'invoice', payments: 'payment', visits: 'serviceVisit', dashboardAlerts: 'alerts', externalBilling: 'external' };
    for (const [key, source] of Object.entries(sources)) expect(result[key]).toBe(run.output[source]);
    expect(run.calls.find(call => call.name === 'serviceVisit').query).toEqual({
      where: { OR: [{ plannedDate: { gte: bounds.start, lte: bounds.end } }, { date: { gte: bounds.start, lte: bounds.end } }] },
      include: { client: true, pool: { include: { client: true } }, technician: true },
      orderBy: [{ plannedDate: 'asc' }, { date: 'asc' }],
    });
    const invoice = run.calls.find(call => call.name === 'invoice').query;
    expect(invoice.orderBy).toEqual({ createdAt: 'desc' });
    expect(invoice.select.payments).toEqual({ select: { amount: true, amountCents: true } });
    expect(invoice.select.client).toEqual({ select: { name: true } });
    const payment = run.calls.find(call => call.name === 'payment').query;
    expect(payment.orderBy).toEqual({ paidAt: 'desc' });
    expect(payment.select.invoice).toEqual({ select: { clientId: true, client: { select: { name: true } } } });
  });
  it.each([...sourceNames, 'transaction'])('rejects the entire summary when %s fails', async failure => {
    const run = setup(failure);
    await expect(run.readDashboardSources(bounds)).rejects.toBe(run.error);
    expect(run.transactions).toHaveLength(1);
  });
});
