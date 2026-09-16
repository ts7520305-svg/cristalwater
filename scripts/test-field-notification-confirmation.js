'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { chromium } = require('playwright');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
let browser, trigger = false;
async function removeTrigger() {
  if (!trigger) return;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS cw_qa_notice_fail ON "Notification"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS cw_qa_notice_fail()'); trigger = false;
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const tech = await prisma.technician.create({ data: { name: 'Notification completeness QA', active: true } });
  const sign = identity => jwt.sign(identity, getJwtSecret(), { expiresIn: '1h' }), at = sign({ id: admin.id, role: 'ADMIN' }), tt = sign({ id: tech.id, role: 'TECHNICIAN' });
  async function call(url, token = at, body) { const response = await fetch(base + url, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: response.status, body: await response.json() }; }
  const marker = randomUUID(), old = await prisma.notification.create({ data: { role: 'TECHNICIAN', type: 'WATER_OPEN', eventType: 'WATER_OPEN_OVERDUE', severity: 'CRITICAL', message: marker + ' old water notice', createdAt: new Date('2020-01-01'), metadata: { technicianId: tech.id } } });
  await prisma.notification.createMany({ data: Array.from({ length: 510 }, (_, index) => ({ role: 'TECHNICIAN', type: 'INFO', message: marker + ' recent ' + index, metadata: { technicianId: tech.id } })) });
  const feed = await call('/api/notifications', tt);
  console.log(JSON.stringify({ oldCriticalVisible: feed.body.notifications?.some(row => row.id === old.id), returned: feed.body.notifications?.length }));
  assert.equal(feed.status, 200); assert(feed.body.notifications.some(row => row.id === old.id), 'Old active critical notification must not be hidden by a recent limit');
  assert(feed.body.notifications.findIndex(row => row.id === old.id) < feed.body.notifications.findIndex(row => row.message.includes(' recent ')));
  assert.equal(feed.body.notifications.filter(row => row.message.startsWith(marker)).length, 511);
  const one = await call(`/api/notifications/read/${old.id}`, tt, {}); assert.equal(one.status, 200); assert.deepEqual(one.body.receipt.ids, [old.id]);
  const first = await prisma.notification.findUniqueOrThrow({ where: { id: old.id } });
  await call(`/api/notifications/${old.id}/read`, tt, {});
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: old.id } })).readAt.toISOString(), first.readAt.toISOString());
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: old.id } })).status, first.status, 'Reading is not physical resolution');
  const item = await prisma.notification.create({ data: { role: 'ADMIN', type: 'INFO', message: marker + ' confirm me' } });
  const newer = await prisma.notification.create({ data: { role: 'ADMIN', type: 'INFO', message: marker + ' not in snapshot' } });
  for (const ids of [[0], [-1], [1.2], ['1'], null, {}, [item.id, item.id]]) assert.equal((await call('/api/notifications/read-all', at, { ids })).status, 400);
  assert.equal((await call('/api/notifications/read-all', tt, { ids: [old.id, item.id] })).status, 403);
  const all = await call('/api/notifications/read-all', at, { ids: [item.id] }); assert.equal(all.status, 200); assert.deepEqual(all.body.receipt.ids, [item.id]);
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: newer.id } })).isRead, false);
  const marked = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
  await call('/api/notifications/read-all', at, { ids: [item.id] }); assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })).readAt.toISOString(), marked.readAt.toISOString());
  const pendingOwn = await prisma.notification.create({ data: { role: 'TECHNICIAN', type: 'INFO', message: marker + ' protected batch', metadata: { technicianId: tech.id } } });
  assert.equal((await call('/api/notifications/read-all', tt, { ids: [pendingOwn.id, item.id] })).status, 403);
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: pendingOwn.id } })).isRead, false);
  await prisma.notification.update({ where: { id: item.id }, data: { isRead: false, readAt: null } });
  trigger = true;
  await prisma.$executeRawUnsafe(`CREATE FUNCTION cw_qa_notice_fail() RETURNS trigger AS $$ BEGIN IF NEW.id = ${newer.id} AND NEW."isRead" THEN RAISE EXCEPTION 'QA read failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER cw_qa_notice_fail BEFORE UPDATE ON "Notification" FOR EACH ROW EXECUTE FUNCTION cw_qa_notice_fail()');
  assert.equal((await call('/api/notifications/read-all', at, { ids: [item.id, newer.id] })).status, 500);
  for (const id of [item.id, newer.id]) { const row = await prisma.notification.findUniqueOrThrow({ where: { id } }); assert.equal(row.isRead, false); assert.equal(row.readAt, null); }
  await removeTrigger();
  await call('/api/notifications/read-all', at, { ids: [item.id] });

  // Notification.userId references User, never a same-number Technician.
  const linkedUser = await prisma.user.create({ data: { email: `${marker}@qa.test`, password: 'qa-no-login', role: 'TECHNICIAN', active: true } });
  let linkedTech = await prisma.technician.create({ data: { name: 'Linked notification recipient', active: true } });
  if (linkedTech.id === linkedUser.id) linkedTech = await prisma.technician.create({ data: { name: 'Distinct linked recipient', active: true } });
  await prisma.technician.update({ where: { id: linkedTech.id }, data: { email: linkedUser.email } });
  let foreignUser, foreignNotice;
  try {
    if (!await prisma.user.findUnique({ where: { id: linkedTech.id } })) foreignUser = await prisma.user.create({ data: { id: linkedTech.id, email: `foreign-${marker}@qa.test`, password: 'qa-no-login', role: 'TECHNICIAN', active: true } });
    foreignNotice = await prisma.notification.create({ data: { userId: linkedTech.id, role: 'TECHNICIAN', type: 'INFO', message: 'FOREIGN USER PRIVATE NOTICE' } });
    const ownNotice = await prisma.notification.create({ data: { userId: linkedUser.id, role: 'TECHNICIAN', type: 'INFO', message: 'OWN USER NOTICE' } });
    const linkedToken = sign({ id: linkedTech.id, userId: linkedUser.id, technicianId: linkedTech.id, principalType: 'USER', role: 'TECHNICIAN' });
    const nativeToken = sign({ id: linkedTech.id, role: 'TECHNICIAN' });
    const linkedFeed = await call('/api/notifications', linkedToken), nativeFeed = await call('/api/notifications', nativeToken);
    console.log(JSON.stringify({ linkedOwnVisible: linkedFeed.body.notifications.some(row => row.id === ownNotice.id), linkedForeignVisible: linkedFeed.body.notifications.some(row => row.id === foreignNotice.id), nativeForeignVisible: nativeFeed.body.notifications.some(row => row.id === foreignNotice.id) }));
    assert(linkedFeed.body.notifications.some(row => row.id === ownNotice.id));
    for (const [credential, result] of [[linkedToken, linkedFeed], [nativeToken, nativeFeed]]) {
      assert(!result.body.notifications.some(row => row.id === foreignNotice.id));
      assert.equal((await call(`/api/notifications/read/${foreignNotice.id}`, credential, {})).status, 403);
    }
    assert.equal((await call(`/api/notifications/read/${ownNotice.id}`, linkedToken, {})).status, 200);
  } finally {
    if (foreignNotice) await prisma.notification.delete({ where: { id: foreignNotice.id } });
    if (foreignUser) await prisma.user.delete({ where: { id: foreignUser.id } });
  }

  browser = await chromium.launch({ headless: true, ...(process.env.CW_CHROMIUM_PATH ? { executablePath: process.env.CW_CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => { for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); }, { token: at, id: admin.id });
  for (const path of ['/notifications', '/admin-notifications']) {
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    await page.goto(base + path); await page.waitForFunction(() => document.querySelector('#list').textContent.includes('not in snapshot'));
    const before = await page.locator('#list').textContent();
    await page.route(base + '/api/notifications/read/**', route => route.fulfill({ status: 503, json: { ok: false } }));
    await page.evaluate(id => markRead(id), newer.id);
    assert.equal(await page.locator('#list').textContent(), before); assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: newer.id } })).isRead, false);
    assert.match(await page.locator('#notificationActionStatus').textContent(), /não foi confirmada/);
    await page.unroute(base + '/api/notifications/read/**');
    await page.route(base + '/api/notifications/read/**', route => route.fulfill({ json: { ok: true, receipt: { scope: 'NOTIFICATION_READ', isRead: true, ids: [item.id] } } }));
    await page.evaluate(id => markRead(id), newer.id); assert.equal(await page.locator('#list').textContent(), before);
    await page.unroute(base + '/api/notifications/read/**');
    await page.evaluate(id => markRead(id), newer.id); assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: newer.id } })).isRead, true);
    await page.route(base + '/api/notifications', route => route.fulfill({ status: 503, json: {} }));
    const last = await page.locator('#list').textContent(); await page.evaluate(() => loadNotifications()); assert.equal(await page.locator('#list').textContent(), last);
    await page.close();
    await prisma.notification.update({ where: { id: newer.id }, data: { isRead: false, readAt: null } });
  }
  const customer = await prisma.client.create({ data: { name: 'Client notice recipient', active: true } });
  const clientNote = await prisma.notification.create({ data: { clientId: customer.id, role: 'CLIENT', type: 'INFO', title: '<img src=x onerror="window.noticeXss=1">', message: '<script>window.noticeXss=1</script> Texto literal do aviso' } });
  const clientContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await clientContext.addInitScript(({ id, token }) => { for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'CLIENT' })); }, { id: customer.id, token: sign({ id: customer.id, role: 'CLIENT' }) });
  const clientPage = await clientContext.newPage(); clientPage.setDefaultTimeout(8000); await clientPage.goto(base + '/client-notifications');
  await clientPage.waitForFunction(() => document.querySelector('#rows').textContent.includes('Texto literal'));
  assert.equal(await clientPage.evaluate(() => window.noticeXss || 0), 0); assert.equal(await clientPage.locator('#rows img, #rows script').count(), 0);
  assert(!(await clientPage.locator('#rows').textContent()).includes('confirm me'));
  const clientBefore = await clientPage.locator('#rows').textContent();
  await clientPage.route(base + '/api/notifications/read/**', route => route.fulfill({ status: 503, json: { ok: false } }));
  await clientPage.evaluate(id => markRead(id), clientNote.id); assert.equal(await clientPage.locator('#rows').textContent(), clientBefore);
  await clientPage.unroute(base + '/api/notifications/read/**');
  await clientPage.evaluate(id => markRead(id), clientNote.id);
  assert.equal(await clientPage.locator('#rows button[data-notification-read]').count(), 0); assert.match(await clientPage.locator('#rows').textContent(), /Lida/);
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: clientNote.id } })).isRead, true);
  assert.equal(await clientPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log('PASS complete critical-first feed, stable first-read time, exact batch, rollback, recipient namespaces, no physical resolution, and truthful UI on three screens including literal client content');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); try { await removeTrigger(); } finally { await prisma.$disconnect(); } });
