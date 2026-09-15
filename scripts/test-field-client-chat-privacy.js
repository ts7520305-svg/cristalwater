'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { chromium } = require('playwright');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Private client chat QA', active: true } });
  const other = await prisma.client.create({ data: { name: 'Other private chat QA', active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Private chat tech QA', active: true } });
  const leader = await prisma.technician.create({ data: { name: 'Private chat leader QA', role: 'TEAM_LEADER', active: true } });
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const tokens = { admin: sign({ id: admin.id, role: 'ADMIN' }), client: sign({ id: client.id, role: 'CLIENT' }), other: sign({ id: other.id, role: 'CLIENT' }),
    tech: sign({ id: tech.id, role: 'TECHNICIAN' }), leader: sign({ id: leader.id, role: 'TEAM_LEADER' }) };
  async function call(p, token, method = 'GET', body) { const r = await fetch(base + p, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; }
  const probe = await call(`/api/chat/client/${client.id}`, tokens.leader);
  browser = await chromium.launch({ headless: true, ...(process.env.CW_CHROMIUM_PATH ? { executablePath: process.env.CW_CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
  // A neutral same-origin page isolates the API actors from cw-auth's single-account socket wrapper.
  const page = await browser.newPage(); await page.goto(base + '/api/core/health'); await page.addScriptTag({ url: base + '/socket.io/socket.io.js' });
  await page.evaluate(async ({ base, tokens, clientId }) => {
    window.chatSockets = {}; window.chatEvents = {};
    await Promise.all(Object.entries(tokens).map(([key, token]) => new Promise((resolve, reject) => {
      const socket = io(base, { auth: { token }, transports: ['websocket'], forceNew: true, reconnection: false }); window.chatSockets[key] = socket; window.chatEvents[key] = [];
      for (const event of ['newMessage', 'new-notification', 'typing']) socket.on(event, data => window.chatEvents[key].push({ event, data }));
      socket.once('connect_error', reject); socket.once('connect', () => { socket.emit('joinClient', clientId); resolve(); });
    })));
  }, { base, tokens, clientId: client.id });
  // A valid typing event confirms the authorized room before the message is sent.
  await page.evaluate(id => window.chatSockets.client.emit('typing', { clientId: id }), client.id);
  await page.waitForFunction(() => window.chatEvents.client.some(row => row.event === 'typing'));
  await page.waitForTimeout(100);
  const sent = await call('/api/client-messages', tokens.client, 'POST', { clientId: client.id, message: 'PRIVATE-MESSAGE-QA' }); assert.equal(sent.status, 200);
  await page.waitForFunction(id => window.chatEvents.admin.some(row => row.event === 'newMessage' && row.data.id === id) && window.chatEvents.client.some(row => row.event === 'newMessage' && row.data.id === id), sent.body.message.id);
  await page.waitForTimeout(150);
  const events = await page.evaluate(() => window.chatEvents);
  console.log(JSON.stringify({ leaderRestStatus: probe.status, leaderPrivateEvents: events.leader.filter(row => row.event !== 'typing').length }));
  assert.equal(probe.status, 403);
  for (const role of ['leader', 'tech', 'other']) assert.equal(events[role].length, 0, `${role} must not join another client room or receive management events`);
  assert(events.admin.some(row => row.event === 'new-notification')); assert(!events.client.some(row => row.event === 'new-notification'));
  for (const role of ['tech', 'leader']) {
    const routes = [
      ['/api/chat/overview'], ['/api/chat'], ['/api/chat/unread'], [`/api/chat/client/${client.id}`],
      ['/api/chat', 'POST', { clientId: client.id, text: 'Forbidden' }], ['/api/chat/read', 'POST', { clientId: client.id }],
      [`/api/client-messages/${client.id}`], [`/api/client-messages/unread/${client.id}`],
      ['/api/client-messages', 'POST', { clientId: client.id, message: 'Forbidden' }], [`/api/client-messages/seen/${client.id}`, 'POST', {}],
    ];
    for (const prefix of ['/api/clientChat', '/api/client-chat']) routes.push([`${prefix}/unread-count`], [`${prefix}/${client.id}/messages`], [`${prefix}/${client.id}/messages`, 'POST', { text: 'Forbidden' }], [`${prefix}/${client.id}/mark-read`, 'POST', {}]);
    for (const [p, method, body] of routes) assert.equal((await call(p, tokens[role], method, body)).status, 403, `${role}: ${p}`);
  }
  assert.equal(await prisma.clientMessage.count({ where: { clientId: client.id } }), 1);
  assert.equal((await prisma.clientMessage.findUniqueOrThrow({ where: { id: sent.body.message.id } })).isReadByAdmin, false);
  assert.equal((await call(`/api/chat/client/${client.id}`, tokens.client)).status, 200); assert.equal((await call(`/api/chat/client/${client.id}`, tokens.other)).status, 403);
  assert.equal((await call('/api/chat/overview', tokens.admin)).status, 200);
  assert.equal((await call('/api/internal-chat/messages', tokens.leader)).status, 200);
  console.log('PASS client conversations remain private to their owner and administration across REST aliases and authenticated Socket.IO; field staff keep internal chat access');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
