import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const parent = '61fc1ca25bcc30f0f613101920778ace6cea5642';
const baseline = process.env.CW_VISIT_ALERT_BASELINE === 'true';
function load(file, dependencies = {}, historical = baseline) {
  const fallback = createRequire(new URL('../' + file, import.meta.url));
  const context = { module: { exports: {} }, require: name => dependencies[name] || fallback(name) };
  vm.runInNewContext(historical ? execFileSync('git', ['show', parent + ':' + file], { encoding: 'utf8' }) : readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context);
  return context.module.exports;
}
const state = load('src/services/alertResolutionStateService.js');
const presentation = load('src/services/alertPresentationService.js', { './alertResolutionStateService': state });
const aliases = ['NOT_DONE', 'BLOCKED', 'RETAINED', 'IMPEDIDO', ' not done ', 'blocked', ' bLoCkEd ', 'retained', ' ReTaInEd ', 'impedido', ' impédido ', 'INCOMPLETE', 'FAILED', 'NOT_COMPLETED', 'Não realizada', 'Não realizado', 'Não concluída', 'Não concluído'];
const row = (id, status, extra = {}) => ({ id, status, alerts: null, reason: '  Motivo literal <img src=x>  ', updatedAt: new Date('2026-01-01'), date: new Date('2026-01-01'), ...extra });
function matches(row, where) {
  return Object.entries(where || {}).every(([key, value]) => {
    if (key === 'AND') return value.every(condition => matches(row, condition));
    if (key === 'OR') return value.some(condition => matches(row, condition));
    if (key === 'NOT') return !matches(row, value);
    if (value && typeof value === 'object') return Object.entries(value).every(([op, expected]) => {
      if (op === 'gt') return row[key] > expected;
      if (op === 'in') return expected.includes(row[key]);
      if (op === 'notIn') return !expected.includes(row[key]);
      if (op === 'not') return row[key] !== expected;
      throw Error('Unsupported predicate: ' + op);
    });
    return row[key] === value;
  });
}
function harness(rows, failure) {
  const calls = [];
  const tx = Object.fromEntries(['serviceVisit', 'notification', 'technicalAlert', 'alert', 'repair', 'extraVisit'].map(name => [name, { async findMany(query) {
    calls.push({ name, query });
    let selected = (name === 'serviceVisit' ? rows : []).filter(row => matches(row, query.where));
    if (query.where.id?.in) {
      if (failure === 'missing') return selected.slice(1);
      if (failure === 'wrong') return selected.map(row => ({ ...row, id: row.id + 9999 }));
      if (failure === 'duplicate') return selected.map(() => selected[0]);
      return selected;
    }
    if (failure === 'late' && query.where.AND[1].id.gt > 0) throw Error('Later visit page unavailable');
    expect(query.take).toBe(500);
    selected = selected.sort((a, b) => a.id - b.id).slice(0, query.take);
    return query.select ? selected.map(row => Object.fromEntries(Object.keys(query.select).map(key => [key, row[key]]))) : selected;
  } }]));
  const prisma = { $transaction: async (fn, options) => { expect(options).toEqual({ isolationLevel: 'RepeatableRead', timeout: 30000 }); return fn(tx); } };
  const business = load('src/business/admin/AlertListBusiness.js', { '../../prismaClient': { prisma }, '../../services/alertPresentationService': presentation });
  return { read: business.list, dashboard: business.listDashboardSources, calls };
}
describe('visit alert selection, presentation and required action use one status classification', () => {
  it.each(aliases)('retains and protects %s without rewriting the source', async status => {
    const visit = row(1, status), original = JSON.stringify(visit), h = harness([visit]);
    const result = await h.read();
    expect(result.totals.visits).toBe(1); expect(result.count).toBe(1);
    expect(result.alerts[0]).toMatchObject({ id: 'visit-1', status, message: visit.reason, title: 'Visita nao realizada', priority: 'WARNING', resolutionRequirement: { code: 'VISIT_ACTION_REQUIRED' } });
    expect(state.requirement('visit', visit)?.code).toBe('VISIT_ACTION_REQUIRED');
    expect((await h.dashboard()).coverage.sources.visit).toEqual({ total: 1, returned: 1 });
    expect(JSON.stringify(visit)).toBe(original);
  });
  it('keeps a real alert on completed or unfamiliar visits; reasons alone do not create an alert', async () => {
    const rows = [row(1, 'DONE', { alerts: '  Incidente <img src=x>  ' }), row(2, 'UNFAMILIAR', { alerts: 'Incidente' }),
      ...['DONE', 'PLANNED', 'IN_PROGRESS', 'CANCELLED', 'UNDONE', 'NOT_RETAINED', 'Concluída'].flatMap((status, i) => [row(3 + i * 2, status), row(4 + i * 2, status, { alerts: ' \t ' })])];
    const result = await harness(rows).read();
    expect(result.alerts.map(row => row.id).sort()).toEqual(['visit-1', 'visit-2']);
    expect(result.alerts[0].message).toBe(rows[0].alerts);
    expect(result.alerts.every(row => row.priority === 'NORMAL' && row.resolutionRequirement === null)).toBe(true);
  });
  it('falls back from whitespace to the reason, then to a visible status message', async () => {
    const result = await harness([row(1, 'FAILED', { alerts: '  ' }), row(2, 'Não concluída', { alerts: '\t', reason: '  ' })]).read();
    expect(result.alerts.find(row => row.numericId === 1)?.message).toBe('  Motivo literal <img src=x>  ');
    expect(result.alerts.find(row => row.numericId === 2)?.message).toBe('Visita nao realizada');
  });
  it('scans beyond two pages, hydrates only eligible IDs and bounds the dashboard preview', async () => {
    const rows = [...Array.from({ length: 503 }, (_, i) => row(i + 1, 'DONE', { alerts: '  ' })), ...Array.from({ length: 1001 }, (_, i) => row(i + 504, aliases[i % aliases.length]))];
    const h = harness(rows), result = await h.read();
    expect(result.count).toBe(1001); expect(result.totals.visits).toBe(1001);
    expect(h.calls.filter(call => call.name === 'serviceVisit' && call.query.where.AND).every(call => call.query.select && !call.query.include)).toBe(true);
    expect(h.calls.filter(call => call.name === 'serviceVisit' && call.query.include).every(call => call.query.where.id.in.length <= 500 && call.query.where.id.in.every(id => id > 503))).toBe(true);
    const dash = await h.dashboard();
    expect(dash.coverage.sources.visit).toEqual({ total: 1001, returned: 200 }); expect(dash.coverage.truncated).toBe(true);
    expect(dash.visitAlerts.map(row => row.id)).toEqual(Array.from({ length: 200 }, (_, i) => 1504 - i));
    expect(await h.read()).toEqual(result);
  });
  it.each(['late', 'missing', 'wrong', 'duplicate'])('refuses %s reads instead of returning a partial list', async failure => {
    const h = harness(Array.from({ length: 501 }, (_, i) => row(i + 1, 'FAILED')), failure);
    await expect(h.read()).rejects.toThrow(); await expect(h.dashboard()).rejects.toThrow();
  });
  it('preserves resolution versions and the higher priority physical confirmation requirement', () => {
    const historical = load('src/services/alertResolutionStateService.js', {}, true);
    for (const status of aliases) {
      const visit = row(1, status);
      expect(state.resolutionVersion('visit', visit)).toBe(historical.resolutionVersion('visit', visit));
      for (const type of ['AGUA_ABERTA', 'BOMBA_MANUAL', 'WATER_OPEN', 'PUMP_MANUAL']) expect(state.requirement('visit', { ...visit, type })?.code).toBe('PHYSICAL_CONFIRMATION_REQUIRED');
    }
  });
});
