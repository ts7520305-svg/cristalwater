'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { createHash, randomUUID } = require('node:crypto'), { inflateSync } = require('node:zlib');
const sharp = require('sharp'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const { defaults } = require('../src/services/clientReportSettingsDefaults');
const { ensureUploadBaseDirReady, toPublicUploadUrl } = require('../src/config/uploadPath');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const imageCount = bytes => (bytes.toString('latin1').match(/\/Subtype \/Image\b/g) || []).length;
function pdfText(bytes) {
  return [...bytes.toString('latin1').matchAll(/\d+ 0 obj\s*<<([\s\S]*?)>>\s*stream\r?\n/g)].filter(m => !/\/Subtype \/Image\b/.test(m[1])).map(m => {
    const size = Number([...m[1].matchAll(/\/Length (\d+)/g)].at(-1)?.[1]), start = m.index + m[0].length;
    return inflateSync(bytes.subarray(start, start + size)).toString('latin1');
  }).map(s => [...s.matchAll(/\[([^\]]+)\]\s*TJ/g)].map(m => [...m[1].matchAll(/<([a-f0-9]+)>/gi)].map(h => Buffer.from(h[1], 'hex').toString('latin1')).join('')).join('\n')).join('\n');
}
let browser, trap, symlinkPath;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const sign = data => jwt.sign(data, getJwtSecret(), { expiresIn: '1h' }), token = sign({ id: admin.id, role: 'ADMIN' });
  const client = await prisma.client.create({ data: { name: 'Report photo owner' } }), other = await prisma.client.create({ data: { name: 'Other photo owner' } });
  const tech = await prisma.technician.create({ data: { name: 'Report photo technician', active: true } });
  const otherTech = await prisma.technician.create({ data: { name: 'Unassigned photo technician', active: true } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Photo QA pool' } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'IN_PROGRESS', notes: 'PHOTO_PUBLIC_NOTE', internalNotes: 'PHOTO_INTERNAL_SECRET' } });
  const foreign = await prisma.serviceVisit.create({ data: { clientId: other.id } });
  const root = ensureUploadBaseDirReady(), sources = [];
  const fixture = (width, height, background) => sharp({ create: { width, height, channels: 3, background } });
  async function add(bytes, extension, type = 'AFTER', owner = visit.id) {
    const filename = `visit-${owner}-${type}-${hash(bytes)}.${extension}`; await fs.writeFile(path.join(root, filename), bytes);
    sources.push({ filename, sha: hash(bytes) });
    return prisma.visitPhoto.create({ data: { visitId: owner, type, url: toPublicUploadUrl(filename) } });
  }
  async function call(view = 'client', auth = token, representation = 'report-visit', id = visit.id) {
    const response = await fetch(`${base}/api/${representation}/visit/${id}?view=${view}`, { headers: auth ? { Authorization: 'Bearer ' + auth } : {} });
    return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
  }
  const jpeg = await fixture(240, 160, '#135b87').withMetadata({ orientation: 6 }).jpeg().toBuffer();
  // Exercise the real field upload and its canonical ownership/hash filename.
  const requestId = randomUUID(), form = new FormData(); form.append('requestId', requestId); form.append('type', 'BEFORE'); form.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), 'before.jpg');
  const upload = await fetch(`${base}/api/visits/${visit.id}/photo`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'X-CW-Field-Request': requestId }, body: form });
  assert.equal(upload.status, 200); const uploaded = (await upload.json()).photo; assert(uploaded.url);
  sources.push({ filename: path.basename(uploaded.url), sha: hash(jpeg) });
  await add(await fixture(640, 360, '#30acc2').png().toBuffer(), 'PNG');
  await add(await fixture(360, 640, '#739d28').webp().toBuffer(), 'webp', 'GENERAL');
  await add(await fixture(400, 120, '#d98619').gif().toBuffer(), 'gif', 'PROBLEM');
  await add(await fixture(180, 220, '#8a54bc').avif({ effort: 0 }).toBuffer(), 'avif', 'ACCESS');
  const frames = Buffer.alloc(30 * 40 * 3, 170); frames.fill(60, frames.length / 2);
  const animated = await sharp(frames, { raw: { width: 30, height: 40, channels: 3, pageHeight: 20 } }).gif({ delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  await add(animated, 'gif', 'GENERAL');
  const foreignPhoto = await add(await fixture(90, 60, '#ef1258').jpeg().toBuffer(), 'jpg', 'AFTER', foreign.id);
  const insert = url => prisma.visitPhoto.create({ data: { visitId: visit.id, type: 'AFTER', url } });
  let requests = 0;
  trap = require('node:http').createServer((req, res) => { requests++; res.end(jpeg); }); await new Promise(resolve => trap.listen(0, '127.0.0.1', resolve));
  for (const url of [foreignPhoto.url, `http://127.0.0.1:${trap.address().port}/private.jpg`, 'file:///etc/passwd', toPublicUploadUrl('../private.jpg'), toPublicUploadUrl('%2e%2e/private.jpg'), uploaded.url + '?token=PRIVATE_URL_TOKEN', uploaded.url.replace('/visit-', '/extra-visit-')]) await insert(url);
  const missing = `visit-${visit.id}-AFTER-${'0'.repeat(64)}.jpg`; await insert(toPublicUploadUrl(missing));
  const wrong = `visit-${visit.id}-AFTER-${'1'.repeat(64)}.jpg`; await fs.writeFile(path.join(root, wrong), jpeg); await insert(toPublicUploadUrl(wrong));
  const link = `visit-${visit.id}-AFTER-${hash(jpeg)}.jpg`; symlinkPath = path.join(root, link); await fs.rm(symlinkPath, { force: true }); await fs.symlink(path.join(root, path.basename(uploaded.url)), path.join(root, link)); await insert(toPublicUploadUrl(link));
  await add(Buffer.from('<svg><script>PRIVATE_SVG_MARKER</script></svg>'), 'png');
  await add((await fixture(30, 40, '#444444').png().toBuffer()).subarray(0, 36), 'png');
  await add(await fixture(7000, 7000, '#dddddd').png().toBuffer(), 'png');
  const oversized = `visit-${visit.id}-AFTER-${'2'.repeat(64)}.png`, large = await fs.open(path.join(root, oversized), 'w'); await large.truncate(25 * 1024 * 1024 + 1); await large.close(); await insert(toPublicUploadUrl(oversized));
  const counters = () => Promise.all(['invoice', 'payment', 'visitPhoto', 'userAuditLog', 'fieldWriteRequest'].map(model => prisma[model].count()));
  const before = await counters();
  let result = await call(); assert.equal(result.status, 200); assert.equal(imageCount(result.bytes), 0, 'Photos default to hidden in client view');
  let html = await call('client', token, 'reports'); assert(!html.bytes.toString().includes('<img'));
  await prisma.clientReportSetting.create({ data: { clientId: client.id, ...defaults, showPhotos: true } });
  result = await call(); assert.equal(result.status, 200); assert.equal(imageCount(result.bytes), 6);
  assert(!pdfText(result.bytes).includes('PHOTO_INTERNAL_SECRET')); assert(pdfText(result.bytes).includes('Fotografia indisponível')); assert(pdfText(result.bytes).includes('limites do relatório'));
  for (const auth of [sign({ id: client.id, clientId: client.id, role: 'CLIENT' }), sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' })]) {
    const permitted = await call('client', auth); assert.equal(permitted.status, 200); assert.equal(imageCount(permitted.bytes), 6);
    assert.equal((await call('admin', auth)).status, 403);
  }
  for (const representation of ['reports', 'report-visit']) {
    assert.equal((await call('client', null, representation)).status, 401);
    assert.equal((await call('client', sign({ id: other.id, clientId: other.id, role: 'CLIENT' }), representation)).status, 403);
    assert.equal((await call('client', sign({ id: otherTech.id, technicianId: otherTech.id, role: 'TECHNICIAN' }), representation)).status, 403);
  }
  html = await call('client', token, 'reports'); const markup = html.bytes.toString();
  assert.equal((markup.match(/<img /g) || []).length, 6); assert(!/https?:|file:|PRIVATE_URL_TOKEN|PRIVATE_SVG_MARKER|\/uploads\//.test(markup));
  const normalized = Buffer.from(markup.match(/src="data:image\/jpeg;base64,([^"]+)"/)[1], 'base64'); const metadata = await sharp(normalized).metadata();
  assert(markup.includes('primeiro fotograma'));
  const lastImage = Buffer.from([...markup.matchAll(/src="data:image\/jpeg;base64,([^"]+)"/g)].at(-1)[1], 'base64'); assert.equal((await sharp(lastImage).metadata()).height, 20);
  assert.equal(metadata.width, 160); assert.equal(metadata.height, 240); assert(!metadata.exif && !metadata.icc && !metadata.xmp, 'Image metadata must be removed');
  assert.equal(requests, 0, 'Report must not fetch external images'); assert.deepEqual(await counters(), before);
  for (const source of sources) assert.equal(hash(await fs.readFile(path.join(root, source.filename))), source.sha, 'Original photos stay intact');
  console.log('PASS real upload to PDF/HTML, five raster formats, orientation and metadata removal, client visibility, historical ownership and assigned technician access; external/foreign/EXTRA/traversal/symlink/tampered/missing/corrupt/oversized references excluded without breaking the report');

  const evidence = path.join(process.cwd(), 'reports/field-visual/visit-photos-' + Date.now()); await fs.mkdir(evidence, { recursive: true });
  // Browser proves the printable contains decoded images and makes no secondary request.
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage(); const network = []; page.on('request', req => network.push(req.url()));
  await page.setContent(markup); await page.waitForFunction(() => [...document.images].length === 6 && [...document.images].every(i => i.complete && i.naturalWidth > 0));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(evidence, `html-${width}.png`), fullPage: true });
  }
  assert.equal(network.length, 0);
  for (const view of ['client', 'admin']) {
    const pdf = await call(view); await fs.writeFile(path.join(evidence, view + '.pdf'), pdf.bytes);
    const text = pdfText(pdf.bytes), pages = (pdf.bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    assert.equal((text.match(/registo atual \| [0-9]+\/[0-9]+/g) || []).length, pages); assert.equal(text.includes('PHOTO_INTERNAL_SECRET'), view === 'admin');
    assert.equal(imageCount(pdf.bytes), 6);
  }
  await prisma.clientReportSetting.update({ where: { clientId: client.id }, data: { showPhotos: false } });
  assert.equal(imageCount((await call('client')).bytes), 0); assert.equal(imageCount((await call('admin')).bytes), 6);
  const empty = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id } });
  assert(pdfText((await call('admin', token, 'report-visit', empty.id)).bytes).includes('Nenhuma foto registada'));
  const count = await prisma.visitPhoto.count({ where: { visitId: visit.id } });
  for (let i = count; i < 27; i++) await insert(toPublicUploadUrl(missing));
  const capped = await call('admin'); assert.equal(imageCount(capped.bytes), 6); assert(pdfText(capped.bytes).includes('3 fotografia(s)'));
  const cappedHtml = (await call('admin', token, 'reports')).bytes.toString(); assert.equal((cappedHtml.match(/<figure>/g) || []).length, 25);
  assert.equal(requests, 0); console.log('PASS self-contained browser images at 320/390/1440 px, multi-page PDF footers, disabled client photos, empty visit and explicit 24-photo cap');
  console.log('PHOTO_REPORT_EVIDENCE ' + evidence);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (symlinkPath) await fs.rm(symlinkPath, { force: true }); if (trap) await new Promise(resolve => trap.close(resolve)); await prisma.$disconnect(); });
