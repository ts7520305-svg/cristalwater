'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { deflateSync } = require('node:zlib');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
const { defaults, keys } = require('../src/services/clientReportSettingsDefaults');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const pdfText = require('./lib/reportPdfText');
(async () => {
  let compressed;
  for(let byte=0;byte<256;byte++){const candidate=deflateSync(Buffer.from('[<5055424c49435f4e4f5445>] TJ\n%'+String.fromCharCode(byte),'latin1'));if(candidate.at(-1)===13){compressed=candidate;break;}}
  assert(compressed);const decoderFixture=Buffer.concat([Buffer.from('1 0 obj\n<< /Length '+compressed.length+' /Filter /FlateDecode >>\nstream\n'),compressed,Buffer.from('\nendstream\nendobj')]);
  assert.equal(pdfText(decoderFixture),'PUBLIC_NOTE');
  const stamp = Date.now(), admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const sign = user => jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  const token = sign({ id: admin.id, userId: admin.id, role: 'ADMIN', principalType: 'USER' });
  const unicodeNames = 'Łukasz Žofie İpek François Björn Straße Ελληνικά Кириллица';
  const literal = '<img src=x onerror="window.qaInjected=1"> & <script>bad()</script>';
  const client = await prisma.client.create({ data: { name: 'QA_CLIENT_' + stamp + ' ' + unicodeNames + ' ' + literal, address: 'PRIVATE_ADDRESS', active: true } });
  const other = await prisma.client.create({ data: { name: 'QA_OTHER_' + stamp, active: true } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'QA_POOL_' + stamp, zone: 'ZONE_MARKER', equipment: { create: { pumpType: 'PUMP_MARKER', brokenLightsCount: 3 } }, technicalRoom: { create: { notes: 'ROOM_MARKER' } } } });
  const tech = await prisma.technician.create({ data: { name: 'QA technician ' + stamp, active: true } });
  const leader = await prisma.technician.create({ data: { name: 'QA leader ' + stamp, role: 'TEAM_LEADER', active: true } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, technicianName: 'TECH_PRIVATE', status: 'COMPLETED', plannedDate: new Date('2097-02-03T12:00:00Z'), startAt: new Date('2097-02-04T12:00:00Z'), endAt: new Date('2097-02-04T13:00:00Z'), ph: 7.2, chlorine: 1.5, salt: 4.1, temperature: 26, orpMv: 700, notes: 'PUBLIC_NOTE ' + literal, internalNotes: 'INTERNAL_SECRET', chemicals: { create: { name: 'CHEMICAL_MARKER Łukasz Ελληνικά', quantity: 2, unit: 'kg' } }, photos: { create: { url: 'PHOTO_REFERENCE ' + literal } } } });
  async function call(suffix = '', auth = token, route = 'report-visit', id = visit.id) {
    const response = await fetch(base + '/api/' + route + '/visit/' + id + suffix, { headers: auth ? { Authorization: 'Bearer ' + auth } : {} });
    const bytes = Buffer.from(await response.arrayBuffer()); return { status: response.status, headers: response.headers, bytes, text: bytes.subarray(0, 5).toString() === '%PDF-' ? pdfText(bytes) : bytes.toString() };
  }
  // Regression: the legacy client preview ignored role=CLIENT and included internal notes.
  let result = await call('?role=CLIENT');
  assert.equal(result.status, 200); assert(!result.text.includes('INTERNAL_SECRET'), 'Client preview disclosed internal notes');
  assert(!result.text.includes('PRIVATE_ADDRESS')); assert(!result.text.includes('TECH_PRIVATE'));
  const counts = () => Promise.all(['invoice', 'payment', 'clientReportSetting', 'userAuditLog'].map(model => prisma[model].count()));
  const before = await counts();
  const settingsResponse = await fetch(base + '/api/report-settings/' + client.id, { headers: { Authorization: 'Bearer ' + token } });
  const state = await settingsResponse.json();
  const query = '?view=client&clientId=' + client.id + '&settingsVersion=' + encodeURIComponent(state.version);
  result = await call(query); assert.equal(result.status, 200); assert.match(result.headers.get('cache-control'), /private.*no-store/);
  assert.equal(result.headers.get('x-cw-report-type'), 'visit-pdf'); assert.equal(result.headers.get('x-cw-client-id'), String(client.id)); assert.equal(result.headers.get('x-cw-visit-id'), String(visit.id)); assert.equal(result.headers.get('x-cw-report-view'), 'client'); assert.equal(result.headers.get('x-cw-settings-version'), state.version);
  assert.equal(result.bytes.subarray(0, 5).toString(), '%PDF-'); assert(result.text.includes('PUBLIC_NOTE'));
  for (const word of unicodeNames.split(' ')) assert(result.text.includes(word), 'Lost Unicode name: ' + word);
  assert.match(result.bytes.toString('latin1'), /\/ToUnicode/);assert.match(result.bytes.toString('latin1'), /\/FontFile2/);
  assert.equal((await call('', null)).status, 401);
  const clientToken = sign({ id: client.id, clientId: client.id, role: 'CLIENT', principalType: 'CLIENT' });
  const techToken = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' });
  const leaderToken = sign({ id: leader.id, technicianId: leader.id, role: 'TEAM_LEADER', principalType: 'TECHNICIAN' });
  for (const route of ['report-visit', 'reports']) {
    assert.equal((await call('', clientToken, route)).status, 200); assert.equal((await call('', techToken, route)).status, 200);
    assert.equal((await call('', leaderToken, route)).status, 403);
    assert.equal((await call('', sign({ id: other.id, clientId: other.id, role: 'CLIENT', principalType: 'CLIENT' }), route)).status, 403);
    for (const auth of [clientToken, techToken, leaderToken]) for (const q of ['?role=ADMIN', '?view=admin']) assert.equal((await call(q, auth, route)).status, 403);
    for (const id of ['0', '-1', '01', '1.5', '2147483648', 'abc']) assert.equal((await call('', token, route, id)).status, 400);
    for (const q of ['?role=OWNER', '?view=client&view=admin', '?view[x]=client', '?role=CLIENT&view=client', '?extra=1', '?clientId=01', '?settingsVersion=x']) assert.equal((await call(q, token, route)).status, 400, q);
    assert.equal((await call('?clientId=' + other.id, token, route)).status, 409);
    assert.equal((await call('', token, route, 2147483647)).status, 404);
  }
  const html = await call('?view=client', token, 'reports'); assert.equal(html.status, 200); assert.match(html.headers.get('content-type'), /^text\/html/); assert(!html.text.includes('<img')); assert(!html.text.includes('<script>')); assert(html.text.includes('&lt;img')); assert(!html.text.includes('INTERNAL_SECRET'));
  assert.deepEqual(await counts(), before);
  // All hidden fields stay hidden, including status in the old summary banner.
  const allOff = Object.fromEntries(keys.map(key => [key, false]));
  await prisma.clientReportSetting.create({ data: { clientId: client.id, ...allOff } });
  assert.equal((await call(query)).status, 409, 'Changed settings must require a fresh preview');
  result = await call('?view=client');
  for (const marker of ['QA_CLIENT_', 'QA_POOL_', 'ZONE_MARKER', 'PRIVATE_ADDRESS', 'TECH_PRIVATE', 'COMPLETED', 'PUBLIC_NOTE', 'INTERNAL_SECRET', 'CHEMICAL_MARKER', 'PUMP_MARKER', 'ROOM_MARKER', 'PHOTO_REFERENCE']) assert(!result.text.includes(marker), marker);
  const markers = { showPlannedDate: '03/02/2097', showStartEnd: '04/02/2097', showWaterParameters: '7.2', showChecklist: 'Limpeza geral', showClientName: 'QA_CLIENT_', showPoolName: 'QA_POOL_', showZone: 'ZONE_MARKER', showAddress: 'PRIVATE_ADDRESS', showTechnicianName: 'TECH_PRIVATE', showStatus: 'COMPLETED', showNotes: 'PUBLIC_NOTE', showChemicals: 'CHEMICAL_MARKER', showEquipment: 'PUMP_MARKER', showTechnicalRoom: 'ROOM_MARKER', showPhotos: 'Fotografia indisponível' };
  for (const [field, marker] of Object.entries(markers)) {
    await prisma.clientReportSetting.update({ where: { clientId: client.id }, data: { ...allOff, [field]: true } });
    result = await call('?view=client'); assert.equal(result.status, 200); assert(result.text.includes(marker), field + ': ' + result.text); assert(!result.text.includes('INTERNAL_SECRET'));
  }
  const fallback = await prisma.serviceVisit.create({ data: { poolId: pool.id, technicianId: leader.id, notes: 'FALLBACK_NOTE' } });
  for (const route of ['report-visit', 'reports']) {
    assert.equal((await call('', clientToken, route, fallback.id)).status, 403, 'Current pool owner cannot claim a visit without historical client');
    assert.equal((await call('', leaderToken, route, fallback.id)).status, 409);
    assert.equal((await call('', token, route, fallback.id)).status, 409);
  }
  await prisma.serviceVisit.update({ where: { id: fallback.id }, data: { clientId: client.id } });
  assert.equal((await call('', leaderToken, 'report-visit', fallback.id)).status, 200);
  await prisma.serviceVisit.update({ where: { id: fallback.id }, data: { clientId: other.id } });
  assert.equal((await call('', token, 'report-visit', fallback.id)).status, 409);
  await prisma.clientReportSetting.update({ where: { clientId: client.id }, data: { ...defaults, showEquipment: true, showTechnicalRoom: true, showPhotos: true, showChemicals: true } });
  await prisma.serviceVisit.update({ where: { id: visit.id }, data: { notes: 'LONG_NOTE_BEGIN Jose\u0301 ' + unicodeNames + ' 漢 א ' + ('Observacao extensa da piscina, sem perda de conteudo. '.repeat(160)) + ' LONG_NOTE_END', internalNotes: 'INTERNAL_SECRET 🧪' } });
  const dir = path.join(__dirname, '../reports/field-visual/visit-report-' + stamp); fs.mkdirSync(dir, { recursive: true });
  for (const view of ['client', 'admin']) { const doc = await call('?view=' + view); assert.equal(doc.status, 200); assert(doc.text.includes('LONG_NOTE_BEGIN')); assert(doc.text.includes('LONG_NOTE_END')); assert(doc.text.includes('José'));assert(doc.text.includes('CHEMICAL_MARKER Łukasz Ελληνικά'));assert(doc.text.includes('[U+6F22]'));assert(doc.text.includes('[U+05D0]'));assert(doc.text.includes('Caracteres por confirmar'));assert.equal(doc.text.includes('[U+1F9EA]'),view==='admin');for(const word of unicodeNames.split(' '))assert(doc.text.includes(word)); assert.equal(doc.text.includes('INTERNAL_SECRET'), view === 'admin'); assert.equal((doc.text.match(/registo atual \| [0-9]+\/[0-9]+/g)||[]).length, (doc.bytes.toString('latin1').match(/\/Type \/Page\b/g)||[]).length, 'Every page must have a footer without extra blank pages'); fs.writeFileSync(path.join(dir, view + '.pdf'), doc.bytes); }
  const original=await prisma.serviceVisit.findUniqueOrThrow({where:{id:visit.id}});assert(original.notes.includes('Jose\u0301')&&original.notes.includes('漢'));assert(original.internalNotes.includes('🧪'));
  const originalHtml=await call('?view=client',token,'reports');assert(originalHtml.text.includes('漢')&&!originalHtml.text.includes('[U+6F22]'));
  await prisma.serviceVisit.update({where:{id:visit.id},data:{notes:'VISIBLE_ASCII_ONLY'}});
  const visibleOnly=await call('?view=client');assert(!visibleOnly.text.includes('Caracteres por confirmar'));assert(!visibleOnly.text.includes('[U+1F9EA]'));await prisma.serviceVisit.update({where:{id:visit.id},data:{notes:original.notes}});
  console.log('PASS embedded fonts preserve Latin extended/Greek/Cyrillic, NFC text, explicit unsupported glyphs only for visible content, source unchanged and complete multipage text');
  console.log('PASS visit PDF/HTML: authenticated role and historical client ownership, client preview without internal notes, exact client/settings version, strict queries, private response contract, saved field visibility, missing/conflicting client refusal, literal HTML and side-effect-free reads');
  console.log('PDF_EVIDENCE ' + dir);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
