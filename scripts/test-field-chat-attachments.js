'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { resolveUploadSubdir, toPublicUploadUrl } = require('../src/config/uploadPath');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Attachment owner QA', active: true } });
  const other = await prisma.client.create({ data: { name: 'Attachment foreign QA', active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Attachment technician QA', active: true } });
  const leader = await prisma.technician.create({ data: { name: 'Attachment leader QA', role: 'TEAM_LEADER', active: true } });
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), ct = sign({ id: client.id, role: 'CLIENT' }), ot = sign({ id: other.id, role: 'CLIENT' }), tt = sign({ id: tech.id, role: 'TECHNICIAN' }), lt = sign({ id: leader.id, role: 'TEAM_LEADER' });
  const filename = `chat-private-${randomUUID()}.txt`, publicName = `field-photo-${randomUUID()}.png`, root = resolveUploadSubdir('');
  fs.writeFileSync(path.join(root, filename), 'PRIVATE-CHAT-FILE-QA'); fs.writeFileSync(path.join(root, publicName), 'FIELD-PHOTO-QA');
  const url = toPublicUploadUrl(filename);
  const legacy = await prisma.clientMessage.create({ data: { clientId: client.id, senderType: 'CLIENT', messageType: 'FILE', fileUrl: url, fileName: 'historico.txt', message: url, text: url } });
  async function get(p, token, options = {}) { return fetch(base + p, { ...options, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } }); }
  const initial = await get(url); console.log(JSON.stringify({ anonymousLegacyAttachment: initial.status, expected: 401 })); assert.equal(initial.status, 401);
  for (const [token, status] of [[null, 401], [ot, 404], [tt, 403], [lt, 403], ['invalid', 401]]) {
    assert.equal((await get(url, token)).status, status); assert.equal((await get(url, token, { method: 'HEAD' })).status, status);
  }
  for (const token of [ct, at]) {
    const response = await get(url, token); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(await response.text(), 'PRIVATE-CHAT-FILE-QA');
    const protectedFile = await get(`/api/client-messages/attachments/${legacy.id}`, token); assert.equal(protectedFile.status, 200); assert.equal(await protectedFile.text(), 'PRIVATE-CHAT-FILE-QA');
  }
  assert.equal((await get(url.replace('chat-private', 'chat%2Dprivate'))).status, 401);
  assert.equal((await get(url, null, { headers: { Range: 'bytes=0-5' } })).status, 401);
  assert.equal((await get(url, ct, { headers: { Range: 'bytes=0-5' } })).status, 206);
  assert.equal((await get(toPublicUploadUrl(publicName))).status, 200, 'Unrelated field upload remains accessible');
  async function upload(token, body = '<html><script>window.opener.document.body.textContent="bad"</script></html>', name = 'private.html', owner = client.id) {
    const data = new FormData(); data.append('clientId', String(owner)); data.append('file', new Blob([body], { type: 'text/html' }), name);
    const response = await fetch(base + '/api/client-messages/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data }); return { status: response.status, body: await response.json() };
  }
  const first = await upload(ct); assert.equal(first.status, 200, JSON.stringify(first));
  const message = first.body.message, download = `/api/client-messages/attachments/${message.id}`;
  assert(message.fileUrl.includes('/documents/client-chat/')); assert.equal((await get(message.fileUrl)).status, 404);
  assert.equal((await get(message.fileUrl.replace('/documents/', '/documents%2F'))).status, 404);
  const pendingName = `pending-${randomUUID()}.txt`, privateRoot = resolveUploadSubdir('documents/client-chat');
  fs.writeFileSync(path.join(privateRoot, pendingName), 'UNREFERENCED-PRIVATE-FILE');
  assert.equal((await get(toPublicUploadUrl('doc%75ments', 'client-chat', pendingName))).status, 404);
  const aliasName = `alias-${randomUUID()}.txt`; fs.symlinkSync(path.join(privateRoot, pendingName), path.join(root, aliasName));
  try { assert.equal((await get(toPublicUploadUrl(aliasName))).status, 404); } finally { fs.unlinkSync(path.join(root, aliasName)); }
  assert.equal((await get(download)).status, 401); assert.equal((await get(download, ot)).status, 404); assert.equal((await get(download, tt)).status, 403);
  const file = await get(download, ct); assert.equal(file.status, 200); assert.equal(file.headers.get('content-type'), 'application/octet-stream'); assert(file.headers.get('content-disposition').includes('private.html'));
  for (const token of [tt, lt]) assert.equal((await upload(token)).status, 403);
  assert.equal((await upload(ct, 'forbidden', 'foreign.txt', other.id)).status, 403);
  const concurrent = await Promise.all(['first-upload', 'second-upload'].map(body => upload(ct, body, 'same-name.txt')));
  assert(concurrent.every(row => row.status === 200)); assert.notEqual(concurrent[0].body.message.fileUrl, concurrent[1].body.message.fileUrl);
  assert.equal(await (await get(`/api/client-messages/attachments/${concurrent[0].body.message.id}`, ct)).text(), 'first-upload');
  assert.equal(await (await get(`/api/client-messages/attachments/${concurrent[1].body.message.id}`, ct)).text(), 'second-upload');
  for (const id of ['0', 'abc', '2147483648']) assert.equal((await get(`/api/client-messages/attachments/${id}`, at)).status, 400);
  const traversal = await prisma.clientMessage.create({ data: { clientId: client.id, messageType: 'FILE', fileUrl: toPublicUploadUrl('../package.json') } });
  assert.equal((await get(`/api/client-messages/attachments/${traversal.id}`, at)).status, 404);
  const textOnlyName = `text-only-${randomUUID()}.txt`; fs.writeFileSync(path.join(root, textOnlyName), 'LEGACY-TEXT-ONLY');
  const textOnly = await prisma.clientMessage.create({ data: { clientId: client.id, text: toPublicUploadUrl(textOnlyName), messageType: 'TEXT' } });
  assert.equal((await get(toPublicUploadUrl(textOnlyName))).status, 401); assert.equal(await (await get(`/api/client-messages/attachments/${textOnly.id}`, ct)).text(), 'LEGACY-TEXT-ONLY');
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [token, user, pagePath, selector] of [[ct, { id: client.id, clientId: client.id, role: 'CLIENT' }, '/client-portal', '#chatBox'], [at, { id: admin.id, role: 'ADMIN' }, `/chat?clientId=${client.id}`, '#messages']]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await context.addInitScript(({ token, user }) => { for (const k of ['token', 'cristalwater_jwt']) localStorage.setItem(k, token); for (const k of ['user', 'cristalwater_user']) localStorage.setItem(k, JSON.stringify(user)); }, { token, user });
    const page = await context.newPage(); page.setDefaultTimeout(10000); await page.goto(base + pagePath, { waitUntil: 'networkidle' });
    const link = page.locator(`${selector} a[data-auth-download][href="${download}"]`); await link.waitFor({ state: 'attached' }); assert.equal(await link.count(), 1);
    const authenticated = page.waitForResponse(response => response.url() === base + download && response.status() === 200);
    const downloaded = page.waitForEvent('download');
    await link.click(); const response = await authenticated; assert((await response.request().allHeaders()).authorization?.startsWith('Bearer '));
    assert.equal((await downloaded).suggestedFilename(), 'private.html');
    assert(!(await page.textContent('body')).includes('window.opener.document')); await context.close();
  }
  await prisma.client.update({ where: { id: client.id }, data: { active: false } }); assert.equal((await get(download, ct)).status, 401); assert.equal((await get(url, ct)).status, 401);
  console.log('PASS new and historical chat attachments require active ownership; aliases, range and HEAD remain private, upload names never collide, unsafe file types download inertly, actual chat/portal use authenticated links');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
