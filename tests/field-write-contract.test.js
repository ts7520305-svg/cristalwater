import { describe, it, expect } from 'vitest';
const fs = require('node:fs'), vm = require('node:vm'), { randomUUID, webcrypto } = require('node:crypto');
const requests = require('../src/services/fieldWriteRequestService');
function browser(actor = { id: 3, role: 'TECHNICIAN' }) {
  let token = 'x.' + Buffer.from(JSON.stringify(actor)).toString('base64url') + '.x';
  const window = { CristalAuth: { getToken: () => token } };
  vm.runInNewContext(fs.readFileSync('frontend/cw-field-write-store.js', 'utf8'), { window, localStorage: { getItem: () => null }, atob, crypto: webcrypto, TextEncoder, Uint8Array, Blob });
  return { store: window.CWFieldWriteStore, change: value => { token = value; } };
}
describe('Exact field write contract', () => {
  it.each(['id','technicianId','visitId','message','priority','recipientRole'])('rejects a mismatching ADMIN alert confirmation: %s', field => {
    const payload = { message: 'Texto original', visitId: 8, priority: 'HIGH' };
    const record = { ...requests.context({ id: 3, role: 'TECHNICIAN' }, 'TECHNICIAN_ALERT', 3, randomUUID(), payload), payload };
    const response = { ok: true, alert: { id: 9, technicianId: 3, ...payload, recipientRole: 'ADMIN', createdAt: new Date().toISOString() }, receipt: { owner: record.owner, requestId: record.requestId, scope: record.scope, resourceId: record.resourceId, payloadHash: record.payloadHash, confirmedAt: new Date().toISOString() } };
    expect(browser().store.confirmation(response, record)).toBe(response); response.alert[field] = 'wrong'; expect(() => browser().store.confirmation(response, record)).toThrow();
  });
  it.each([{ id: 3, role: 'TECHNICIAN' }, { id: 3, role: 'TEAM_LEADER' }, { id: 9, userId: 9, technicianId: 3, principalType: 'USER', role: 'TECHNICIAN' }])('uses the same typed owner in API and browser: %s', actor => {
    const client = browser(actor); expect(client.store.session().owner).toBe(requests.owner(actor));
    const captured = client.store.session(); client.change('invalid'); expect(client.store.same(captured)).toBe(false);
  });
  it('uses an identical canonical payload hash in API and browser', async () => {
    const payload = { notes: 'Água limpa', products: [{ name: 'Sal', quantity: 2 }], ph: 7.4 };
    const record = requests.context({ id: 3, role: 'TECHNICIAN' }, 'VISIT_COMPLETION', 7, randomUUID(), payload);
    expect(await browser().store.hash({ v: 1, scope: record.scope, resourceId: 7, payload })).toBe(record.payloadHash);
  });
  it.each(['CLIENT', '', null])('refuses a non-field identity: %s', role => { expect(() => requests.owner({ id: 3, role })).toThrow(); expect(browser({ id: 3, role }).store.session()).toBe(null); });
  it.each(['invalid', '', null])('refuses invalid request identifiers: %s', requestId => { expect(() => requests.context({ id: 3, role: 'TECHNICIAN' }, 'VISIT_PHOTO', 7, requestId, {})).toThrow(); });
  it.each(['owner','requestId','scope','resourceId','payloadHash'])('rejects a mismatching confirmation field: %s', field => {
    const record = requests.context({ id: 3, role: 'TECHNICIAN' }, 'VISIT_COMPLETION', 7, randomUUID(), {});
    const response = { ok: true, visit: { id: 7, status: 'DONE', completionRequestId: record.requestId, endAt: new Date().toISOString() }, receipt: { ...record, confirmedAt: new Date().toISOString() } };
    expect(browser().store.confirmation(response, record)).toBe(response); response.receipt[field] = 'wrong'; expect(() => browser().store.confirmation(response, record)).toThrow();
  });
});
