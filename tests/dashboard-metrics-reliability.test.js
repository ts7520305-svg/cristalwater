import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
const source = path => process.env.CW_METRICS_BASELINE
  ? execFileSync('git', ['show', process.env.CW_METRICS_BASELINE + ':' + path], { encoding: 'utf8' })
  : readFileSync(new URL('../' + path, import.meta.url), 'utf8');

function harness() {
  let now = Date.parse('2026-09-28T10:00:00Z');
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const process = { env: { NODE_ENV: 'test', DASHBOARD_BREAKER_THRESHOLD: '2', DASHBOARD_BREAKER_COOLDOWN_MS: '1000', DASHBOARD_CACHE_TTL_MS: '30000' } };
  const global = { metricCounters: {} };
  const cacheContext = vm.createContext({ module: { exports: {} }, process, global, Date: Clock, console });
  vm.runInContext(source('src/services/dashboardCacheService.js'), cacheContext);
  const cache = cacheContext.module.exports;
  const reads = [vi.fn().mockResolvedValue([{ status: 'DONE', _count: { id: 3 } }]), vi.fn().mockResolvedValue(7), vi.fn().mockResolvedValue({ _sum: { total: -12.34 } })];
  const prisma = { serviceVisit: { groupBy: reads[0] }, technicalAlert: { count: reads[1] }, invoice: { aggregate: reads[2] } };
  const routes = [];
  const router = Object.fromEntries(['get', 'post'].map(method => [method, (path, ...handlers) => routes.push({ method, path, handlers })]));
  const context = vm.createContext({ module: { exports: {} }, process, global, Date: Clock, console, require(name) {
    if (name === 'express') return { Router: () => router };
    if (name === '../prismaClient') return prisma;
    if (name === '../services/dashboardCacheService') return cache;
    if (name === '../middlewares/authMiddleware') return () => (_req, _res, next) => next();
    if (['../controllers/dashboardController', '../services/aiOperationalService', '../services/aiPredictiveService', '../services/dispatchEngineService'].includes(name)) return {};
    throw Error('Unexpected dependency ' + name);
  } });
  vm.runInContext(source('src/routes/dashboardRoutes.js'), context);
  async function call({ force = false, method = 'get' } = {}) {
    const route = routes.find(row => row.method === method && row.path === '/metrics');
    const result = { status: 200, headers: {} };
    const res = { set(key, value) { result.headers[key] = value; return this; }, status(value) { result.status = value; return this; }, json(value) { result.body = JSON.parse(JSON.stringify(value)); return this; } };
    let index = 0;
    async function next() { if (index < route.handlers.length) return route.handlers[index++]({ query: force ? { force: '1' } : {} }, res, next); }
    await next(); return result;
  }
  return { call, reads, cache, clock: value => { now = typeof value === 'string' ? Date.parse(value) : now + value; } };
}

describe('live dashboard metrics retain failures instead of manufacturing zero', () => {
  it.each([0, 1, 2])('rejects source %i failure without cache and recovers with original values', async index => {
    const h = harness(); h.reads[index].mockRejectedValueOnce(Error('PRIVATE_SOURCE_SECRET'));
    const failed = await h.call();
    expect(failed.status).toBe(503); expect(failed.body.ok).toBe(false);
    expect(JSON.stringify(failed)).not.toContain('PRIVATE_SOURCE_SECRET'); expect(h.cache.getDashboardCache()).toBeNull();
    const recovered = await h.call(); expect(recovered.status).toBe(200);
    expect(recovered.body.activeAlerts).toBe(7); expect(recovered.body.serviceVisitsByStatus[0]._count.id).toBe(3);
    expect(recovered.body.financialAggregates._sum.total).toBe(-12.34); expect(recovered.body.breaker.failureCount).toBe(0);
  });
  it('preserves a genuine empty database, zero count and nullable SQL sum', async () => {
    const h = harness(); h.reads[0].mockResolvedValue([]); h.reads[1].mockResolvedValue(0); h.reads[2].mockResolvedValue({ _sum: { total: null } });
    const result = await h.call(); expect(result.status).toBe(200);
    expect(result.body.serviceVisitsByStatus).toEqual([]); expect(result.body.activeAlerts).toBe(0); expect(result.body.financialAggregates._sum.total).toBeNull();
  });
  it.each(['get', 'post'])('sends private no-store for successful and failed %s reads', async method => {
    const h = harness(); expect((await h.call({ method })).headers['Cache-Control']).toBe('private, no-store');
    h.cache.invalidateDashboardCache(); h.reads[1].mockRejectedValue(Error('private'));
    const failed = await h.call({ method }); expect(failed.status).toBe(503); expect(failed.headers['Cache-Control']).toBe('private, no-store');
  });
  it('returns an explicitly aged cache hit without querying the database', async () => {
    const h = harness(); await h.call(); h.clock(500);
    const result = await h.call(); expect(result.body.source).toBe('RAM_CACHE_HIT'); expect(result.body.cache.source).toBe('RAM_CACHE_HIT');
    expect(result.body.cache.ageMs).toBe(500); for (const read of h.reads) expect(read).toHaveBeenCalledTimes(1);
  });
  it.each([0, 1, 2])('retains and labels the previous complete snapshot after source %i fails', async index => {
    const h = harness(); await h.call(); h.clock(400); h.reads[index].mockRejectedValueOnce(Error('unavailable'));
    const fallback = await h.call({ force: true }); expect(fallback.status).toBe(200);
    expect(fallback.body.activeAlerts).toBe(7); expect(fallback.body.financialAggregates._sum.total).toBe(-12.34);
    expect(fallback.body.source).toBe('RAM_CACHE_FALLBACK'); expect(fallback.body.cache.source).toBe('RAM_CACHE_FALLBACK');
    expect(fallback.body.breakerDegraded).toBe(true); expect(fallback.body.breaker.failureCount).toBe(1);
    h.clock(600); const subsequent = await h.call(); expect(subsequent.body.breakerDegraded).toBe(true);
    expect(subsequent.body.source).toBe('RAM_CACHE_FALLBACK'); expect(subsequent.body.cache.ageMs).toBe(1000);
    const recovered = await h.call({ force: true }); expect(recovered.body.source).toBe('DATABASE_HIT'); expect(recovered.body.breaker.failureCount).toBe(0);
    expect(recovered.body.breakerDegraded).not.toBe(true);
  });
  it('opens the circuit, avoids repeated database attempts and closes after cooldown and recovery', async () => {
    const h = harness(); h.reads[1].mockRejectedValue(Error('unavailable'));
    expect((await h.call()).status).toBe(503); const open = await h.call(); expect(open.body.breaker.state).toBe('OPEN');
    expect((await h.call({ force: true })).status).toBe(503); expect(h.reads[1]).toHaveBeenCalledTimes(2);
    h.clock(1000); h.reads[1].mockResolvedValue(7); const recovery = await h.call();
    expect(recovery.status).toBe(200); expect(recovery.body.breaker.state).toBe('CLOSED'); expect(recovery.body.breaker.failureCount).toBe(0);
  });
  it('keeps cached data explicitly degraded for both open-circuit access paths', async () => {
    const h = harness(); await h.call(); h.reads[1].mockRejectedValue(Error('unavailable'));
    await h.call({ force: true }); await h.call({ force: true });
    for (const force of [false, true]) {
      const response = await h.call({ force }); expect(response.body.source).toBe('RAM_CIRCUIT_BREAKER');
      expect(response.body.cache.source).toBe('RAM_CIRCUIT_BREAKER'); expect(response.body.breakerDegraded).toBe(true); expect(response.body.activeAlerts).toBe(7);
    }
    expect(h.reads[1]).toHaveBeenCalledTimes(3);
  });
  it('reopens the circuit when its recovery probe fails', async () => {
    const h = harness(); h.reads[1].mockRejectedValue(Error('unavailable'));
    await h.call(); await h.call(); h.clock(1000);
    const failed = await h.call(); expect(failed.status).toBe(503); expect(failed.body.breaker.state).toBe('OPEN');
    await h.call(); expect(h.reads[1]).toHaveBeenCalledTimes(3);
  });
  it('expires the complete cache at its TTL and never extends it on failure', async () => {
    const h = harness(); await h.call(); h.clock(29999); h.reads[1].mockRejectedValue(Error('unavailable'));
    expect((await h.call({ force: true })).status).toBe(200); h.clock(1);
    const expired = await h.call(); expect(expired.status).toBe(503); expect(h.cache.getDashboardCache()).toBeNull();
  });
  it('rejects a cache with a timestamp in the future after a clock correction', async () => {
    const h = harness(); await h.call(); h.clock(-1); expect(h.cache.getDashboardCache()).toBeNull();
  });
  it('never serves the previous UTC day as current metrics, including fallback', async () => {
    const h = harness(); h.clock('2026-09-28T23:59:59.900Z'); await h.call(); h.clock(200);
    h.reads[1].mockRejectedValue(Error('unavailable')); expect((await h.call()).status).toBe(503); expect(h.cache.getDashboardCache()).toBeNull();
    h.reads[1].mockResolvedValue(0); const nextDay = await h.call(); expect(nextDay.body.dayWindow.gte).toBe('2026-09-29T00:00:00.000Z');
  });
  it('rejects a read that crosses midnight before publication', async () => {
    const h = harness(); h.clock('2026-09-28T23:59:59.900Z');
    h.reads[1].mockImplementationOnce(async () => { h.clock(200); return 7; });
    const response = await h.call(); expect(response.status).toBe(503); expect(h.cache.getDashboardCache()).toBeNull();
  });
  it('does not repopulate invalidated data when an older in-flight read finishes', async () => {
    const h = harness(); let release; h.reads[1].mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const oldRead = h.call(); h.cache.invalidateDashboardCache('VISIT_COMPLETED'); release(7);
    const rejected = await oldRead; expect(rejected.status).toBe(503); expect(rejected.body.breaker.failureCount).toBe(0); expect(h.cache.getDashboardCache()).toBeNull();
    h.reads[1].mockResolvedValue(8); expect((await h.call()).body.activeAlerts).toBe(8);
  });
  it('coalesces concurrent refreshes and counts one failed attempt once', async () => {
    const h = harness(), rejects = []; h.reads[1].mockImplementation(() => new Promise((_resolve, fail) => { rejects.push(fail); }));
    const pending = Array.from({ length: 8 }, () => h.call({ force: true })); rejects.forEach(reject => reject(Error('unavailable')));
    const responses = await Promise.all(pending); expect(responses.every(r => r.status === 503 && r.body.breaker.failureCount === 1)).toBe(true);
    for (const read of h.reads) expect(read).toHaveBeenCalledTimes(1);
  });
});
