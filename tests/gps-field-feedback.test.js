import { describe, it, expect, vi } from 'vitest';
const fs = require('node:fs'), vm = require('node:vm');
function harness(result, error) {
  let active = true; const nodes = new Map(), node = id => { if (!nodes.has(id)) nodes.set(id, { textContent: '', dataset: {}, addEventListener() {} }); return nodes.get(id); };
  const send = vi.fn(async () => { if (error) throw Error(error); return result; });
  const client = { session: () => ({}), same: () => active, send, status: () => ({ pending: 0 }), stop: vi.fn() };
  const context = vm.createContext({ window: { CWGps: client, CristalAuth: { requireAuth: () => true }, addEventListener() {} }, navigator: {}, document: { getElementById: node }, setInterval: () => 1, Date, Error });
  vm.runInContext(fs.readFileSync('frontend/technician-gps.js', 'utf8'), context);
  return { node, client, switch: () => { active = false; vm.runInContext('checkGpsSession()', context); }, send: () => vm.runInContext('sendPoint({timestamp:1700000000000,coords:{latitude:37,longitude:-8,accuracy:8}})', context) };
}
describe('GPS screen uses the durable sender result', () => {
  it('shows the confirmed measurement time and accuracy', async () => {
    const h = harness({ pending: 0, sent: 1, ignored: 0, lastAcknowledgement: { outcome: 'RECORDED', accuracy: 8, recordedAt: '2023-11-14T22:13:20.000Z' } }); await h.send();
    expect(h.client.send.mock.calls[0].slice(0, 3)).toEqual([37, -8, { accuracy: 8, recordedAt: '2023-11-14T22:13:20.000Z' }]); expect(h.node('syncKpi').textContent).toBe('Sincronizado');
  });
  it.each([{ pending: 1 }, { pending: 1, offline: true }, { pending: 1, busy: true }])('does not claim synchronization while a point is pending: %j', async result => { const h = harness(result); await h.send(); expect(h.node('syncKpi').textContent).toBe('Por confirmar'); });
  it('does not present an acknowledged old reading as current GPS', async () => { const h = harness({ pending: 0, ignored: 1 }); await h.send(); expect(h.node('syncKpi').textContent).toBe('A atualizar'); expect(h.node('gpsStatus').textContent).toContain('antigas'); });
  it('preserves an explicit recovery error', async () => { const h = harness(null, 'Não confirmado'); await expect(h.send()).rejects.toThrow('Não confirmado'); expect(h.node('syncKpi').textContent).not.toBe('Sincronizado'); });
  it('ignores a late result after the account changes', async () => { const h = harness(); let finish; h.client.send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const sent = h.send(); h.switch(); finish({ pending: 0, sent: 1, lastAcknowledgement: { outcome: 'RECORDED', accuracy: 8, recordedAt: new Date().toISOString() } }); await sent; expect(h.node('syncKpi').textContent).toBe('Sessão alterada'); expect(h.client.stop).toHaveBeenCalledOnce(); });
});
