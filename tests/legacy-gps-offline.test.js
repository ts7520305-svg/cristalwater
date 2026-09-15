import { describe, it, expect, vi } from 'vitest';
const vm = require('node:vm'), fs = require('node:fs');
function harness() {
  const data = new Map(), nodes = new Map();
  let id = 0, owner = 1, failStorage = false;
  const token = () => 'x.' + Buffer.from(JSON.stringify({ id: owner, role: 'TECHNICIAN' })).toString('base64url') + '.x';
  const localStorage = { get length() { return data.size; }, key: i => [...data.keys()][i], getItem: k => data.get(k) ?? null, setItem(k, v) { if (failStorage) throw Error('quota'); data.set(k, v); }, removeItem: k => data.delete(k) };
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
  const navigator = { onLine: true, geolocation: { watchPosition: vi.fn(() => 1), clearWatch: vi.fn() } };
  const window = { CristalAuth: { getToken: token }, addEventListener() {} };
  const document = { getElementById: id => nodes.get(id), createElement: () => ({ style: {}, setAttribute() {} }), body: { prepend: node => nodes.set(node.id, node) } };
  vm.runInNewContext(fs.readFileSync('frontend/js/offline/offline-gps.js', 'utf8'), { window, document, localStorage, navigator, fetch, crypto: { randomUUID: () => String(++id) }, atob: s => Buffer.from(s, 'base64').toString(), Date, Number, JSON, Error });
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
    finish({ ok: true, json: async () => ({ ok: true }) });
    expect((await sending).pending).toBe(1);
    expect(h.window.getOfflineGps()[0].latitude).toBe(38);
  });
  it('does not acknowledge or resend the previous account queue after a switch', async () => {
    const h = harness(); let finish;
    h.window.saveOfflineGps(point);
    h.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const sending = h.window.syncOfflineGps();
    h.change(2); h.window.saveOfflineGps({ ...point, latitude: 38 });
    finish({ ok: true, json: async () => ({ ok: true }) });
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
});
