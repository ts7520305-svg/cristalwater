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
  const context = { window, location, fetch, URL: BlobURL, document: { documentElement: { lang: 'pt' }, addEventListener: vi.fn() }, MutationObserver: class { constructor(callback) { this.callback = callback; } observe() {} }, Blob, Headers, AbortController, atob,
    localStorage: { getItem: key => storage.get(key) ?? null }, setTimeout: vi.fn(), clearTimeout: vi.fn(), setInterval: vi.fn(), clearInterval: vi.fn() };
  vm.runInNewContext(fs.readFileSync('frontend/cw-auth-download.js', 'utf8'), context);
  return { ...context, popup, token, storage, events, open: window.CristalDownloads.open };
}

describe('authenticated guide documents', () => {
  const english = {
    INVALID_DOCUMENT: 'The document is outside the application or the link is invalid.',
    SESSION: 'The session has changed or expired. Sign in again to open the document.',
    POPUP: 'Allow a new window to open to view the document.',
    UNAVAILABLE: 'Your session does not permit access to this document, or it is no longer available.',
    UNCONFIRMED: 'The response does not confirm the selected document. Try again.',
    INCOMPLETE: 'The received document is incomplete. Try again.',
    TIMEOUT: 'The document took too long. Try again.',
    CANCELLED: 'Opening was cancelled. You can open the document again.',
    RETRY: 'The document could not be opened. Try again.'
  };
  it.each(Object.keys(english))('captures presentation for owned %s errors without changing the original Error', async code => {
    const options = { POPUP: { popupBlocked: true }, UNAVAILABLE: { status: 403 }, UNCONFIRMED: { headers: { 'X-CW-Document-Id': '8' } }, INCOMPLETE: { bytes: '%PDF-1.7 unfinished' }, RETRY: { status: 500 } };
    const b = browser(options[code]);
    if (code === 'SESSION') b.storage.set('adminToken', 'different-session');
    if (code === 'CANCELLED') b.popup.closed = true;
    if (code === 'TIMEOUT') b.fetch.mockImplementation((url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
    const promise = b.open(code === 'INVALID_DOCUMENT' ? 'https://other.test/api/guides/work/7/pdf' : '/api/guides/work/7/pdf');
    if (code === 'TIMEOUT') b.setTimeout.mock.calls.find(call => call[1] === 20000)[0]();
    const error = await promise.catch(error => error), raw = error.message, presentation = b.window.CristalDownloads.presentation, entry = presentation.error(error);
    expect(error.code).toBe(code); expect(entry).not.toBeNull(); expect(Object.isFrozen(entry)).toBe(true); expect(presentation.error(error)).toBe(entry);
    for (const language of ['pt', 'en', 'fr', 'es', 'de']) {
      const text = presentation.format(entry, language); expect(typeof text).toBe('string'); expect(text.length).toBeGreaterThan(10);
      expect(error.message).toBe(raw); expect(error.code).toBe(code); expect(presentation.error(error)).toBe(entry);
      if (language === 'pt') expect(text).toBe(raw); else expect(text).not.toBe(raw);
    }
    expect(presentation.format(entry, 'en')).toBe(english[code]); expect(presentation.format(entry, 'EN-gb')).toBe(english[code]); expect(presentation.format(entry, 'unknown')).toBe(raw);
    b.document.documentElement.lang = 'en'; expect(presentation.format(entry)).toBe(english[code]);
    expect(presentation.error({ code, message: raw })).toBeNull(); expect(presentation.error(raw)).toBeNull();
    expect(b.URL.createObjectURL).not.toHaveBeenCalled(); expect(b.setTimeout.mock.calls.filter(call => call[1] === 20000).length).toBe(['INVALID_DOCUMENT', 'SESSION', 'POPUP'].includes(code) ? 0 : 1);
  });
  it('keeps foreign Error identity, code and literal text even when they resemble owned errors', async () => {
    const b = browser(), error = Object.assign(Error('Original <b>{code}</b>'), { code: 'RETRY' }); b.fetch.mockRejectedValue(error);
    await expect(b.open('/api/guides/work/7/pdf')).rejects.toBe(error); expect(b.window.CristalDownloads.presentation.error(error)).toBeNull();
    expect(error.message).toBe('Original <b>{code}</b>'); expect(error.code).toBe('RETRY'); expect(b.popup.close).toHaveBeenCalled();
  });
  it('uses the chosen language for the existing alert fallback', async () => {
    const b = browser({ popupBlocked: true }); b.document.documentElement.lang = 'de'; b.window.alert = vi.fn();
    const click = b.document.addEventListener.mock.calls.find(call => call[0] === 'click')[1], preventDefault = vi.fn();
    click({ target: { closest: () => ({ href: 'https://pool.test/api/guides/work/7/pdf' }) }, preventDefault });
    await vi.waitFor(() => expect(b.window.alert).toHaveBeenCalledWith('Erlauben Sie das Öffnen eines neuen Fensters, um das Dokument anzusehen.')); expect(preventDefault).toHaveBeenCalled(); expect(b.fetch).not.toHaveBeenCalled();
  });
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
