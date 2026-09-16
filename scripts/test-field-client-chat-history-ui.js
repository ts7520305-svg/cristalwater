'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { chromium } = require('playwright'), jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const file = path.join(__dirname, '../src/data/clientChatMessages.json'), evidence = path.resolve('reports/field-visual/client-chat-history');
let previous, touched = false, browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Conversa com histórico', active: true } }), other = await prisma.client.create({ data: { name: 'Histórico privado de outro cliente', active: true } });
  const marker = randomUUID(), text = `Histórico preservado <img src=x onerror="window.badHistory=true"> ${marker}`;
  previous = fs.existsSync(file) ? fs.readFileSync(file) : null; touched = true;
  const historic = { id: marker, clientId: String(client.id), from: 'ADMIN', created_at: '2025-12-07T08:15:03.968Z', readByAdmin: false, readByClient: false };
  fs.writeFileSync(file, JSON.stringify([{ ...historic, text }, { ...historic, id: marker + '-file', text: '/uploads/documents/guessed-private.pdf', fileUrl: '/uploads/documents/guessed-private.pdf' }, { ...historic, clientId: String(other.id), text: 'SECRET-OTHER-' + marker }]));
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] }); fs.mkdirSync(evidence, { recursive: true });
  const labels = { pt: 'Mensagem antiga · autor não confirmado', en: 'Earlier message · author unconfirmed', fr: 'Ancien message · auteur non confirmé', es: 'Mensaje anterior · autor sin confirmar', de: 'Frühere Nachricht · Verfasser unbestätigt' };
  for (const mode of ['legacy', 'portal', 'admin']) {
    const user = mode === 'admin' ? { id: admin.id, role: 'ADMIN' } : { id: client.id, clientId: client.id, role: 'CLIENT' }, token = jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await context.route('https://cdn.socket.io/**', route => route.abort());
    await context.addInitScript(({ token, user }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); localStorage.setItem('cw_language', 'pt'); }, { token, user });
    const page = await context.newPage(), errors = []; page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message));
    const list = mode === 'portal' ? '#chatBox' : '#messages', rowSelector = mode === 'admin' ? '.chat-message' : '.msg';
    await page.goto(base + (mode === 'legacy' ? '/client_chat' : mode === 'portal' ? '/client-portal' : `/chat?clientId=${client.id}`), { waitUntil: 'networkidle' });
    const row = page.locator(`${list} ${rowSelector}`).filter({ hasText: marker }); await row.waitFor({ state: 'visible' });
    assert.match(await row.textContent(), /Mensagem antiga · autor não confirmado/); assert((await row.textContent()).includes(text)); assert.equal(await row.locator('img').count(), 0); assert.equal(await page.evaluate(() => !!window.badHistory), false);
    assert(!(await page.locator(list).textContent()).includes('SECRET-OTHER-')); assert.equal(await page.locator(list).getByText('/uploads/documents/guessed-private.pdf', { exact: false }).locator('a').count(), 0);
    const author = row.locator(mode === 'portal' ? 'b' : 'strong');
    for (const [language, label] of Object.entries(labels)) {
      await page.evaluate(({ language, mode }) => { localStorage.setItem('cw_language', language); document.documentElement.lang = language; if (mode === 'portal') { applyLanguage(language); return loadMessages(); } if (mode === 'legacy') return load(); }, { language, mode });
      if (mode === 'admin') await page.locator(`.client-item[data-client-id="${client.id}"]`).click();
      await page.waitForFunction(({ selector, label }) => document.querySelector(selector)?.textContent === label, { selector: `${list} ${rowSelector} ${mode === 'portal' ? 'b' : 'strong'}`, label });
      assert.equal(await author.textContent(), label);
    }
    await page.evaluate(({ mode }) => { localStorage.setItem('cw_language', 'pt'); document.documentElement.lang = 'pt'; if (mode === 'portal') { applyLanguage('pt'); return loadMessages(); } if (mode === 'legacy') return load(); }, { mode });
    if (mode === 'admin') await page.locator(`.client-item[data-client-id="${client.id}"]`).click();
    await page.waitForFunction(({ selector, label }) => document.querySelector(selector)?.textContent === label, { selector: `${list} ${rowSelector} ${mode === 'portal' ? 'b' : 'strong'}`, label: labels.pt });
    for (const width of [390, 1440]) { await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); await page.locator(list).scrollIntoViewIfNeeded(); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await page.screenshot({ path: path.join(evidence, `${mode}-${width}.png`), fullPage: true }); }
    assert.deepEqual(errors, []); await context.close();
    console.log(`PASS ${mode}: imported conversation, unconfirmed author in five languages, literal text, no inferred attachment access, private ownership and mobile/desktop layout`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (touched) { if (previous !== null) fs.writeFileSync(file, previous); else fs.rmSync(file, { force: true }); } await prisma.$disconnect(); });
