import { describe, it, expect, vi } from 'vitest';
const vm = require('node:vm'), fs = require('node:fs');
function accepted(init) { const point = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ ok: true, success: true, acknowledgement: { ...point, scope: 'GPS_READING', owner: 'TECH:' + point.technicianId, outcome: 'RECORDED' } }) }; }
function harness() {
  const data = new Map(), nodes = new Map();
  let owner = 1, failStorage = false;
  const token = () => 'x.' + Buffer.from(JSON.stringify({ id: owner, role: 'TECHNICIAN' })).toString('base64url') + '.x';
  const localStorage = { get length() { return data.size; }, key: i => [...data.keys()][i], getItem: k => data.get(k) ?? null, setItem(k, v) { if (failStorage) throw Error('quota'); data.set(k, v); }, removeItem: k => data.delete(k) };
  const fetch = vi.fn(async (_, init) => accepted(init));
  const navigator = { onLine: true, locks: { request: (_, options, run) => run({}) }, geolocation: { watchPosition: vi.fn(() => 1), clearWatch: vi.fn() } };
  const window = { CristalAuth: { getToken: token }, addEventListener() {} };
  const document = { getElementById: id => nodes.get(id), createElement: () => ({ style: {}, setAttribute() {} }), body: { prepend: node => nodes.set(node.id, node) } };
  vm.runInNewContext(fs.readFileSync('frontend/js/offline/offline-gps.js', 'utf8'), { window, document, localStorage, navigator, fetch, crypto: require('node:crypto').webcrypto, atob: s => Buffer.from(s, 'base64').toString(), Date, Number, JSON, Error, AbortController, setTimeout, clearTimeout, setInterval: () => 1 });
  return { window, data, fetch, navigator, change: id => { owner = id; }, quota: () => { failStorage = true; } };
}
const point = { latitude: 37, longitude: -8, recordedAt: '2026-09-15T10:00:00.000Z', accuracy: 12 };
describe('Legacy GPS durable account queues', () => {
  it('preserves a new point captured while an earlier point is being acknowledged', async () => {
    const h = harness(); let finish;
    h.window.saveOfflineGps(point);
    h.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const sending = h.window.syncOfflineGps();
    h.window.saveOfflineGps({ ...point, latitude: 38 });
    finish(accepted(h.fetch.mock.calls[0][1]));
    expect((await sending).pending).toBe(1);
    expect(h.window.getOfflineGps()[0].latitude).toBe(38);
  });
  it('does not acknowledge or resend the previous account queue after a switch', async () => {
    const h = harness(); let finish;
    h.window.saveOfflineGps(point);
    h.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const sending = h.window.syncOfflineGps();
    h.change(2); h.window.saveOfflineGps({ ...point, latitude: 38 });
    finish(accepted(h.fetch.mock.calls[0][1]));
    await expect(sending).rejects.toThrow('conta mudou');
    expect(h.window.getOfflineGps()).toHaveLength(1);
    await h.window.syncOfflineGps();
    expect(JSON.parse(h.fetch.mock.calls[1][1].body).technicianId).toBe(2);
    h.change(1); expect(h.window.getOfflineGps()).toHaveLength(1);
  });
  it.each([true, false])('retains rejected points (HTTP error %s)', async http => {
    const h = harness(); h.window.saveOfflineGps(point);
    h.fetch.mockResolvedValue({ ok: !http, json: async () => ({ ok: false }) });
    await expect(h.window.syncOfflineGps()).rejects.toThrow();
    expect(h.window.getOfflineGps()).toHaveLength(1);
  });
  it('preserves corrupt and unattributed legacy data instead of replacing them', async () => {
    const h = harness(); h.data.set('cristalwater_offline_gps', '[{"userId":1}]');
    await h.window.syncOfflineGps(); expect(h.fetch).not.toHaveBeenCalled();
    expect(h.data.get('cristalwater_offline_gps')).toContain('userId');
    h.data.set('cwGpsPoint:v2:TECH:1:bad', '{');
    await expect(h.window.syncOfflineGps()).rejects.toThrow('ilegível');
    expect(h.data.get('cwGpsPoint:v2:TECH:1:bad')).toBe('{');
  });
  it('does not claim persistence or send when device storage fails', async () => {
    const h = harness(); h.quota();
    await expect(h.window.sendGpsPosition(37, -8)).rejects.toThrow('quota');
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it('sends original timestamp, precision and captured credentials', async () => {
    const h = harness(); h.window.saveOfflineGps(point); await h.window.syncOfflineGps();
    const request = h.fetch.mock.calls[0][1];
    expect(JSON.parse(request.body)).toMatchObject({ ...point, technicianId: 1 });
    expect(request.headers.Authorization).toMatch(/^Bearer /);
  });
  it('starts only one watcher and refuses old-account callbacks', () => {
    const h = harness(); h.window.startGpsTracking(); h.window.startGpsTracking();
    expect(h.navigator.geolocation.clearWatch).toHaveBeenCalledOnce();
    h.change(2);
    h.navigator.geolocation.watchPosition.mock.calls[1][0]({ coords: point, timestamp: Date.now() });
    expect(h.data.size).toBe(0);
  });
  it.each([200, 202, 204])('does not erase a point for an incomplete HTTP %s acknowledgement', async status => {
    const h = harness(); h.window.saveOfflineGps(point); const before = [...h.data];
    h.fetch.mockResolvedValue({ ok: true, status, json: async () => ({ ok: true, success: true }) });
    await expect(h.window.syncOfflineGps()).rejects.toThrow('por confirmar'); expect([...h.data]).toEqual(before);
  });
  it.each(['owner', 'pointId', 'technicianId', 'latitude', 'longitude', 'recordedAt', 'accuracy'])('retains a point when the acknowledgement has another %s', async key => {
    const h = harness(); h.window.saveOfflineGps(point); const before = [...h.data];
    h.fetch.mockImplementation(async (_, init) => { const response = accepted(init), data = await response.json(); data.acknowledgement[key] = 'wrong'; return { ...response, json: async () => data }; });
    await expect(h.window.syncOfflineGps()).rejects.toThrow('por confirmar'); expect([...h.data]).toEqual(before);
  });
  it('rejects corrupt identity, key, timestamp and precision without sending or deleting', async () => {
    for (const mutation of [p => { p.technicianId = 999; }, p => { p.id = require('node:crypto').randomUUID(); }, p => { p.recordedAt = 'bad'; }, p => { p.accuracy = -1; }]) {
      const h = harness(); h.window.saveOfflineGps(point); const [key, raw] = [...h.data][0], changed = JSON.parse(raw); mutation(changed); h.data.set(key, JSON.stringify(changed));
      await expect(h.window.syncOfflineGps()).rejects.toThrow('inválido'); expect(h.fetch).not.toHaveBeenCalled(); expect(h.data.get(key)).toBe(JSON.stringify(changed));
    }
  });
  it('does not capture a callback from an earlier watcher of the same account', () => {
    const h = harness(); h.window.startGpsTracking(); h.window.startGpsTracking(); h.navigator.geolocation.watchPosition.mock.calls[0][0]({ coords: point, timestamp: Date.now() }); expect(h.data.size).toBe(0);
  });
  it('exposes unattributed old data as unfinished and distinguishes old readings from a current fix', async () => {
    const h = harness(); h.data.set('cristalwater_offline_gps', '[{"userId":1}]'); expect((await h.window.syncOfflineGps()).unattributed).toBe(true); h.window.saveOfflineGps(point);
    h.fetch.mockImplementation(async (_, init) => { const response = accepted(init), data = await response.json(); data.ignored = true; data.code = data.acknowledgement.outcome = 'STALE_LOCATION'; return { ...response, json: async () => data }; });
    const result = await h.window.syncOfflineGps(); expect(result.ignored).toBe(1); expect(result.sent).toBe(0); expect(result.pending).toBe(0); expect(result.unattributed).toBe(true);
  });
});
