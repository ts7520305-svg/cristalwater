/* Native staff-chat HTML/auth/scripts; HTTP data and credentials are QA fixtures.
 * This component checks session events, not SQL authorization or chat delivery. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../frontend'), secret = 'staff-chat-component-test-only';
let writes = 0, held = false, pending = [], entered;
async function deadline(promise, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(label)), 10000); })]); }
  finally { clearTimeout(timer); }
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://qa.local');
  const json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
  if (url.pathname === '/api/settings/language/me') return json({ ok: true, language: 'pt' });
  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET') { writes++; res.writeHead(405); return json({ ok: false }); }
    let actor;
    try { actor = jwt.verify(String(req.headers.authorization || '').replace(/^Bearer /, ''), secret); }
    catch { res.writeHead(403); return json({ ok: false }); }
    const send = () => {
      if (res.destroyed) return;
      if (url.pathname === '/api/chat/internal') return json({ ok: true, messages: [{ recordId: 'qa-' + actor.id, source: 'DATABASE', identityVerified: true, actorType: actor.role === 'ADMIN' ? 'USER' : 'TECHNICIAN', actorId: actor.id, actorName: 'QA staff ' + actor.id, author: actor.role, text: 'Private QA message ' + actor.id, created_at: '2026-10-02T12:00:00Z' }] });
      if (url.pathname === '/api/notifications') return json({ ok: true, notifications: [{ title: 'Private QA notice ' + actor.id, message: 'Original notice ' + actor.id, createdAt: '2026-10-02T12:00:00Z', severity: 'CRITICAL', isRead: false }] });
      res.writeHead(404); json({ ok: false });
    };
    if (held) { pending.push(send); if (pending.length === 2) entered?.(); } else send();
    return;
  }
  const file = path.resolve(root, '.' + (url.pathname === '/technician-chat' ? '/technician-chat.html' : url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(''); }
  res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'text/css');
  res.end(fs.readFileSync(file));
});
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const executablePath = process.env.CW_CHROMIUM_EXECUTABLE || process.env.CW_CHROMIUM_PATH || (fs.existsSync('/tmp/chromium') ? '/tmp/chromium' : undefined);
    browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    const base = 'http://127.0.0.1:' + server.address().port;
    for (const role of ['TECHNICIAN', 'TEAM_LEADER', 'ADMIN']) {
      const actorA = { id: 11, role, name: 'QA A' }, actorB = { id: 22, role, name: 'QA B' };
      const tokenA = jwt.sign(actorA, secret, { expiresIn: '1h' }), tokenB = jwt.sign(actorB, secret, { expiresIn: '1h' });
      const actorType = role === 'ADMIN' ? 'USER' : 'TECHNICIAN', ownerA = actorType + ':11', ownerB = actorType + ':22';
      const keyA = 'cwStaffChat:v1:' + ownerA, keyB = 'cwStaffChat:v1:' + ownerB;
      const draftA = 'cwStaffChatDraft:v1:' + ownerA, draftB = 'cwStaffChatDraft:v1:' + ownerB;
      const rawA = JSON.stringify({ schema: 1, owner: ownerA, requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', text: 'Private pending A' });
      const rawB = JSON.stringify({ schema: 1, owner: ownerB, requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', text: 'Private pending B' });
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      try {
        await context.addInitScript(({ actor, token, keyA, keyB, draftA, draftB, rawA, rawB }) => {
          if (sessionStorage.getItem('qaStaffChatInitialized')) return;
          localStorage.setItem('cw_api_origin', location.origin); localStorage.setItem('cw_language', 'pt');
          for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
          for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(actor));
          localStorage.setItem(keyA, rawA); localStorage.setItem(keyB, rawB);
          sessionStorage.setItem(draftA, 'Private draft A'); sessionStorage.setItem(draftB, 'Private draft B');
          sessionStorage.setItem('qaStaffChatInitialized', 'true');
        }, { actor: actorA, token: tokenA, keyA, keyB, draftA, draftB, rawA, rawB });
        const page = await context.newPage(), errors = [], failures = [];
        page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
        let confirmAborts;
        const aborted = new Promise(resolve => { confirmAborts = resolve; });
        page.on('requestfailed', request => {
          failures.push(new URL(request.url()).pathname);
          if (failures.includes('/api/chat/internal') && failures.includes('/api/notifications')) confirmAborts();
        });
        const ready = () => page.waitForFunction(() => document.getElementById('chatReadStatus').textContent === 'Lista atualizada.' && document.getElementById('noticeStatus').textContent === 'Lista atualizada.');
        const work = () => page.evaluate(({ keyA, keyB, draftA, draftB }) => [localStorage.getItem(keyA), localStorage.getItem(keyB), sessionStorage.getItem(draftA), sessionStorage.getItem(draftB)], { keyA, keyB, draftA, draftB });
        await page.goto(base + '/technician-chat'); await ready();
        assert.equal(await page.locator('#chatText').inputValue(), 'Private draft A');
        assert.match(await page.locator('#messageList').textContent(), /Private QA message 11/);
        assert.match(await page.locator('#noticeList').textContent(), /Private QA notice 11/);
        const before = await work();
        await page.evaluate(() => window.dispatchEvent(new Event('cw:session-change')));
        assert.equal(await page.locator('#staffChat').isVisible(), true, 'Same-account session event must preserve the chat');
        const readsEntered = new Promise(resolve => { entered = resolve; }); held = true;
        await page.locator('#refreshChat').click(); await deadline(readsEntered, 'Both retained chat reads must start');
        const snapshot = await page.evaluate(({ actor, token }) => {
          CristalAuth.persistSession(token, actor); window.dispatchEvent(new Event('cw:session-change'));
          return { hidden: document.getElementById('staffChat').hidden, draft: document.getElementById('chatText').value, messages: document.getElementById('messageList').textContent, notices: document.getElementById('noticeList').textContent, pending: document.getElementById('chatPendingText').textContent, alert: !document.getElementById('sessionStatus').hidden };
        }, { actor: actorB, token: tokenB });
        assert(snapshot.hidden && snapshot.alert, role + ' must hide the old account synchronously');
        assert.deepEqual([snapshot.draft, snapshot.messages, snapshot.notices, snapshot.pending], ['', '', '', '']);
        await deadline(aborted, 'Both original-account reads must be aborted');
        held = false; pending.splice(0).forEach(send => send());
        await page.waitForFunction(() => document.getElementById('staffChat').hidden && document.getElementById('messageList').childElementCount === 0);
        assert.deepEqual(await work(), before, 'Both drafts and pending request bytes must survive the switch');
        assert(failures.includes('/api/chat/internal') && failures.includes('/api/notifications'), 'The old reads must be aborted');
        await page.reload(); await ready();
        assert.equal(await page.locator('#chatText').inputValue(), 'Private draft B');
        assert.equal(await page.locator('#chatPendingText').textContent(), 'Private pending B');
        assert.match(await page.locator('#messageList').textContent(), /Private QA message 22/);
        assert.deepEqual(await work(), before); assert.equal(writes, 0); assert.deepEqual(errors, []);
        console.log('PASS staff-chat session event: ' + role + ', immediate privacy, aborted reads, original drafts/requests, same-account event and new-account reload');
      } finally { held = false; pending.splice(0).forEach(send => send()); await context.close(); }
    }
  } finally { pending.splice(0).forEach(send => send()); await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
