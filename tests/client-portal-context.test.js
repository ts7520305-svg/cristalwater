import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../frontend/client-portal.js', import.meta.url), 'utf8');
function harness() {
  // The sender has its own real-browser persistence/transport coverage. These
  // tests exercise the portal's consumer callbacks and selection lifecycle.
  const recovery = { active: () => true, begin: () => ({}), accepts: () => true, headers: () => ({}), render() {}, readError() {}, sendText: vi.fn(), sendFile: vi.fn() };
  const senderFactory = vi.fn(() => recovery);
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', innerHTML: '', textContent: '', hidden: false, children: [], appendChild(child) { this.children.push(child); }, dataset: {} });
    return nodes.get(id);
  };
  const context = vm.createContext({
    URLSearchParams, URL, console: { log() {}, warn() {}, error() {}, info() {} },
    location: { search: '?clientId=1' }, navigator: { language: 'pt' },
    localStorage: { getItem: () => null }, window: { addEventListener() {} },
    document: { getElementById: node, addEventListener() {}, querySelector: () => null, createElement: () => ({ dataset: {} }) },
    fetch: vi.fn(),
    CWClientChat: { create: senderFactory },
  });
  vm.runInContext(source, context);
  vm.runInContext(`
    applyLanguage = () => {};
    renderPools = renderPoolSchedules = renderSummary = renderClientFocus = renderPaymentInstructions = renderServiceHistory = renderInvoices = () => {};
    isAdminUser = () => false;
  `, context);
  return { context, node, recovery, senderOptions: senderFactory.mock.calls[0][0], run: script => vm.runInContext(script, context) };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const response = data => ({ ok: true, json: async () => ({ ok: true, ...data }) });

describe('client portal asynchronous context isolation', () => {
  it('ignores an old portal success after switching clients', async () => {
    const h = harness(), pending = deferred();
    h.context.fetch.mockReturnValueOnce(pending.promise);
    const loading = h.run('loadPortal()');
    h.run('clientId = 2; ++clientSelectionRevision;');
    h.node('clientName').textContent = 'Cliente B';
    pending.resolve(response({ client: { name: 'Cliente A' } }));
    await loading;
    expect(h.node('clientName').textContent).toBe('Cliente B');
  });
  it('ignores an old portal failure even after switching A to B to A', async () => {
    const h = harness(), pending = deferred();
    h.context.fetch.mockReturnValueOnce(pending.promise);
    const loading = h.run('loadPortal()');
    h.run('clientSelectionRevision += 2;');
    h.node('clientName').textContent = 'Ficha atual';
    pending.reject(new Error('Late network failure'));
    await loading;
    expect(h.node('clientName').textContent).toBe('Ficha atual');
  });
  it('keeps the newest messages when two refreshes finish out of order', async () => {
    const h = harness(), pending = deferred();
    h.context.fetch.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response({ messages: [] }));
    const old = h.run('loadMessages()');
    await h.run('loadMessages()');
    h.node('chatBox').innerHTML = 'Resposta mais recente';
    pending.resolve(response({ messages: [] }));
    await old;
    expect(h.node('chatBox').innerHTML).toBe('Resposta mais recente');
  });
  it('does not append another client message', () => {
    const h = harness();
    h.run(`appendMessage({clientId: 2, id: 12, text: 'Privado'});`);
    expect(h.node('chatBox').children).toHaveLength(0);
    h.run(`appendMessage({clientId: 1, id: 13, text: 'Correto'});`);
    expect(h.node('chatBox').children).toHaveLength(1);
  });
  it('does not clear a new client draft after an old send succeeds', async () => {
    const h = harness(), pending = deferred();
    h.node('messageInput').value = 'Mesmo texto';
    h.recovery.sendText.mockReturnValueOnce(pending.promise);
    const sending = h.run('sendMessage()');
    h.run('clientId = 2; ++clientSelectionRevision;');
    pending.resolve();
    await h.senderOptions.confirmed({ id: 10, clientId: 1, text: 'Mesmo texto' });
    await sending;
    expect(h.node('messageInput').value).toBe('Mesmo texto');
    expect(h.node('chatBox').children).toHaveLength(0);
    expect(h.context.fetch).not.toHaveBeenCalled();
  });
  it('does not allow actions until the selected client has loaded', async () => {
    const h = harness();
    await h.run(`runPortalAction('sendBtn', () => fetch('/must-not-send'))`);
    expect(h.context.fetch).not.toHaveBeenCalled();
  });
  it('keeps administrator preview read-only even after loading', async () => {
    const h = harness();
    h.run('loadedClientId = 1; isAdminUser = () => true; updatePortalActionAvailability();');
    await h.run(`runPortalAction('sendBtn', () => fetch('/must-not-send'))`);
    expect(h.context.fetch).not.toHaveBeenCalled();
    expect(h.node('sendBtn').disabled).toBe(true);
  });
  it('keeps buttons disabled when an old action finishes during a new load', async () => {
    const h = harness(), pending = deferred();
    h.context.pending = pending.promise;
    h.run('loadedClientId = 1;');
    const action = h.run(`runPortalAction('sendBtn', () => pending)`);
    h.run('clientId = 2; ++clientSelectionRevision; loadedClientId = 0;');
    pending.resolve();
    await action;
    expect(h.node('sendBtn').disabled).toBe(true);
  });
});

describe('administrator client preview guard', () => {
  it('redirects the old client chat link without ending the administrator session', () => {
    const storage = { getItem: key => key === 'token' ? 'qa-token' : JSON.stringify({ id: 99, role: 'ADMIN' }), setItem: vi.fn(), clear: vi.fn() };
    const location = { pathname: '/client_chat', replace: vi.fn() }, alert = vi.fn();
    vm.runInNewContext(readFileSync(new URL('../frontend/client-auth-guard.js', import.meta.url), 'utf8'), { localStorage: storage, window: { location }, alert, console });
    expect(location.replace).toHaveBeenCalledWith('/chat');
    expect(storage.clear).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled(); expect(alert).not.toHaveBeenCalled();
  });
  it('preserves admin session and does not set admin ID as client ID', () => {
    const storage = { getItem: key => key === 'token' ? 'qa-token' : JSON.stringify({ id: 99, role: 'ADMIN' }), setItem: vi.fn(), clear: vi.fn() };
    const location = { pathname: '/client-portal', href: '/client-portal?clientId=1' };
    const alert = vi.fn();
    vm.runInNewContext(readFileSync(new URL('../frontend/client-auth-guard.js', import.meta.url), 'utf8'), { localStorage: storage, window: { location }, alert, console });
    expect(alert).not.toHaveBeenCalled();
    expect(storage.clear).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(location.href).toBe('/client-portal?clientId=1');
  });
});

describe('explicit client notification reading',()=>{
 it('confirms reading only after the server accepts it',async()=>{
  const h=harness(),pending=deferred();h.context.fetch.mockReturnValueOnce(pending.promise);
  h.run('loadedClientId=1; globalThis.notice={id:7,isRead:false};globalThis.button={disabled:false,textContent:"Marcar como lida"};globalThis.feedback={textContent:""};');
  const work=h.run('markPortalNotificationRead(notice,button,feedback)');expect(h.run('notice.isRead')).toBe(false);expect(h.run('button.disabled')).toBe(true);
  pending.resolve(response({ok:true}));await work;expect(h.run('notice.isRead')).toBe(true);expect(h.run('button.textContent')).toBe('Lida');
 });
 it('allows retry after a failed read without inventing a confirmation',async()=>{
  const h=harness();h.context.fetch.mockRejectedValueOnce(new Error('Offline'));
  h.run('loadedClientId=1;globalThis.notice={id:7,isRead:false};globalThis.button={disabled:false};globalThis.feedback={textContent:""};');
  await h.run('markPortalNotificationRead(notice,button,feedback)');expect(h.run('notice.isRead')).toBe(false);expect(h.run('button.disabled')).toBe(false);expect(h.run('feedback.textContent')).toContain('Tente novamente');
 });
 it('keeps administrator previews from confirming client reading',async()=>{
  const h=harness();h.run('loadedClientId=1;isAdminUser=()=>true;');await h.run('markPortalNotificationRead({id:7},{disabled:false},{})');expect(h.context.fetch).not.toHaveBeenCalled();
 });
 it('does not change the current portal after a delayed acknowledgement',async()=>{
  const h=harness(),pending=deferred();h.context.fetch.mockReturnValueOnce(pending.promise);
  h.run('loadedClientId=1;globalThis.notice={id:7,isRead:false};globalThis.button={disabled:false};');const work=h.run('markPortalNotificationRead(notice,button,{})');
  h.run('clientId=2;++clientSelectionRevision;');pending.resolve(response({ok:true}));await work;expect(h.run('notice.isRead')).toBe(false);
 });
 it('uses human reading states in every existing portal language',()=>{
  const h=harness();for(const lang of ['pt','en','fr','de']){h.run(`portalLanguage='${lang}';renderNotifications([{id:7,status:'PENDING',isRead:false}]);`);expect(h.node('notificationList').innerHTML).not.toContain('PENDING');expect(h.node('notificationList').innerHTML).toContain('data-notice-read');}
 });
});

describe('portal logout uses the shared session lifecycle',()=>{
 it('retires the authenticated session through CristalAuth',async()=>{
  const h=harness(),logout=vi.fn(async()=>{}),remove=vi.fn();h.context.window.CristalAuth={logout};h.context.localStorage.removeItem=remove;
  await h.run('logout()');expect(logout).toHaveBeenCalledOnce();expect(remove).toHaveBeenCalledWith('cw_client_id');expect(remove).toHaveBeenCalledWith('clientId');
 });
 it('returns the administrator to management without ending their session',()=>{
  const h=harness(),logout=vi.fn();h.context.window.CristalAuth={logout};h.run('isAdminUser=()=>true;logout();');expect(logout).not.toHaveBeenCalled();expect(h.context.location.href).toBe('/admin-clients');
 });
});
