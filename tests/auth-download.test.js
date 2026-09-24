import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

function browser({ status = 200, popupBlocked = false, headers = {}, bytes = '%PDF-1.7\n%%EOF\n' } = {}) {
  const popup = { location: {}, close: vi.fn(), opener: {} }, events = {};
  const token = 'qa.' + Buffer.from(JSON.stringify({ id: 1, role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.signature';
  const storage = new Map([['cristalwater_jwt', token]]);
  const fetch = vi.fn().mockResolvedValue({ status, headers: new Headers({ 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-CW-Document-Type': 'work-guide', 'X-CW-Document-Id': '7', 'X-CW-Vehicle-Id': '2', ...headers }), blob: async () => new Blob([bytes], { type: 'application/pdf' }) });
  const BlobURL = class extends URL {};
  BlobURL.createObjectURL = vi.fn().mockReturnValue('blob:qa-pdf'); BlobURL.revokeObjectURL = vi.fn();
  const location = new URL('https://pool.test/admin-vehicles');
  const window = { location, open: vi.fn(() => popupBlocked ? null : popup), addEventListener: (name, listener) => { events[name] = listener; } };
  const context = { window, location, fetch, URL: BlobURL, document: { addEventListener: vi.fn() }, Blob, Headers, AbortController, atob,
    localStorage: { getItem: key => storage.get(key) ?? null }, setTimeout: vi.fn(), clearTimeout: vi.fn(), setInterval: vi.fn(), clearInterval: vi.fn() };
  vm.runInNewContext(fs.readFileSync('frontend/cw-auth-download.js', 'utf8'), context);
  return { ...context, popup, token, storage, events, open: window.CristalDownloads.open };
}

describe('authenticated guide documents', () => {
  it('fetches with the current session and displays the document, never the token URL', async () => {
    const b = browser(); await b.open('/api/guides/work/7/pdf');
    expect(b.fetch).toHaveBeenCalledWith('/api/guides/work/7/pdf', { headers: { Authorization: 'Bearer ' + b.token }, cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal) });
    expect(b.popup.location.href).toBe('blob:qa-pdf'); expect(b.popup.opener).toBeNull();
    b.setTimeout.mock.calls.find(call => call[1] === 60000)[0]();
    expect(b.URL.revokeObjectURL).toHaveBeenCalledWith('blob:qa-pdf');
  });
  it.each([401, 403, 500])('closes the blank window on HTTP %s', async status => {
    const b = browser({ status }); await expect(b.open('/api/guides/work/7/pdf')).rejects.toThrow();
    expect(b.popup.close).toHaveBeenCalled(); expect(b.URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('does not disclose the token to external URLs', async () => {
    const b = browser(); await expect(b.open('https://other.test/api/guides/work/7/pdf')).rejects.toThrow(); expect(b.fetch).not.toHaveBeenCalled();
  });
  it('reports a blocked popup instead of silently losing the PDF', async () => {
    const b = browser({ popupBlocked: true }); await expect(b.open('/api/guides/work/7/pdf')).rejects.toThrow('nova janela'); expect(b.fetch).not.toHaveBeenCalled();
  });
  it('rejects another document even if the response contains a complete PDF', async () => {
    const b = browser({ headers: { 'X-CW-Document-Id': '8' } }); await expect(b.open('/api/guides/work/7/pdf')).rejects.toMatchObject({ code: 'UNCONFIRMED' }); expect(b.URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('rejects executable and partial content despite a successful response and matching identity', async () => {
    for (const options of [{ bytes: '<script>not a document</script>' }, { bytes: '%PDF-1.7 incomplete' }, { headers: { 'Content-Type': 'text/html' } }]) {
      const b = browser(options); await expect(b.open('/api/guides/work/7/pdf')).rejects.toMatchObject({ code: options.headers ? 'UNCONFIRMED' : 'INCOMPLETE' }); expect(b.URL.createObjectURL).not.toHaveBeenCalled();
    }
  });
  it('revokes a displayed file when the account metadata changes without changing the token', async () => {
    const b = browser(); await b.open('/api/guides/work/7/pdf'); b.storage.set('user', '{different account'); b.events.storage();
    expect(b.popup.close).toHaveBeenCalled(); expect(b.URL.revokeObjectURL).toHaveBeenCalledWith('blob:qa-pdf');
  });
});
