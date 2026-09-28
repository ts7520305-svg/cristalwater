'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { fork } = require('node:child_process'), { randomUUID, createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const dbAddress = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(dbAddress.hostname) && /qa/i.test(dbAddress.pathname));
const { prisma } = require('../src/prismaClient'), uploads = require('../src/config/uploadPath');
const root = path.resolve(__dirname, '..'), folder = path.join(root, 'reports/field-suite/photo-evidence-volume');
const hash = v => createHash('sha256').update(Buffer.isBuffer(v) ? v : JSON.stringify(v)).digest('hex');
const mib = v => Math.round(v / 1048576 * 100) / 100;
let completed = false;
const deadline = setTimeout(() => { console.error('Photo/evidence assertions incomplete'); process.exit(1); }, 110000);
process.on('exit', () => { if (!completed && !process.exitCode) process.exitCode = 1; });

async function probe(mode) {
  const diskRoot = uploads.ensureUploadBaseDirReady();
  assert(/^photo-evidence-volume-[A-Za-z0-9]+$/.test(path.basename(diskRoot)), 'Probe requires its own disposable upload directory');
  const stamp = 'QA414-' + randomUUID(), reads = [], requestIds = [], clients = [], technicians = [];
  const models = ['client','pool','technician','user','serviceVisit','extraVisit','visitPhoto','extraVisitPhoto','fieldWriteRequest','auditTrail','technicalHistory','notification','attachment','repair','companyExpense','expenseEvidence','expenseEvent','expensePayment','expenseAllocation','invoice','payment','userAuditLog'];
  const counts = async () => Object.fromEntries(await Promise.all(models.map(async m => [m, await prisma[m].count()])));
  const finance = async () => hash(await Promise.all(['invoice','payment'].map(m => prisma[m].findMany({ orderBy: { id: 'asc' } }))));
  const before = await counts(), beforeFinance = await finance();
  const files = () => fs.readdirSync(diskRoot, { recursive: true }).filter(f => fs.statSync(path.join(diskRoot, f)).isFile()).sort();
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const sign = body => require('jsonwebtoken').sign(body, require('../src/utils/jwtSecret').getJwtSecret(), { expiresIn: '30m' });
  const adminToken = sign({ id: admin.id, userId: admin.id, role: 'ADMIN', principalType: 'USER' });
  let pool, visit, repair, expense, server, base, token, foreign, clientToken, limit, url;
  const requestId = () => { const id = randomUUID(); requestIds.push(id); return id; };
  const field = mode === 'expense' ? 'file' : 'photo';
  async function sampleServer(command) {
    return new Promise((resolve, reject) => {
      const failed = () => reject(Error('HTTP process exited'));
      server.once('exit', failed); server.once('message', m => { server.off('exit', failed); resolve(m); }); server.send({ command });
    });
  }
  async function request(endpoint, { method = 'GET', form, raw, credential = token, headers = {}, expected = 200, drop = false, binary = false } = {}) {
    await sampleServer('start'); let peak = process.memoryUsage().rss;
    const sample = () => { peak = Math.max(peak, process.memoryUsage().rss); };
    const timer = setInterval(sample, 5), start = performance.now();
    let response, value, bytes = 0, sha256, lost = false;
    try {
      response = await fetch(base + endpoint, { method, headers: { ...(credential ? { Authorization: 'Bearer ' + credential } : {}), ...headers, ...(drop ? { 'x-qa-drop-response': 'true' } : {}) }, body: form || raw, signal: AbortSignal.timeout(30000) });
      if (binary) { const digest = createHash('sha256'); for await (const b of response.body) { bytes += b.length; digest.update(b); } sha256 = digest.digest('hex'); }
      else { const text = await response.text(); bytes = Buffer.byteLength(text); try { value = JSON.parse(text); } catch { value = text; } }
    } catch (error) { if (!drop) throw error; lost = true; }
    finally { sample(); clearInterval(timer); }
    const apiMemory = await sampleServer('stop');
    const record = { mode, endpoint, method, status: response?.status || null, lost, bytes, durationMs: Math.round((performance.now() - start) * 10) / 10, sampledServerRssMiB: apiMemory.rssMiB, sampledClientRssMiB: mib(peak), ...(sha256 ? { sha256 } : {}) };
    reads.push(record);
    if (drop) assert(lost, 'Response loss not reproduced');
    else assert.equal(response.status, expected, JSON.stringify({ ...record, error: value?.error || value?.message }));
    assert(record.durationMs < 30000 && apiMemory.rssMiB < 768 && peak < 768 * 1048576, JSON.stringify(record));
    return { body: value, response, record };
  }
  const multipart = (fields, bytes, mime = 'image/jpeg') => {
    const form = new FormData(); for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
    form.append(field, new Blob([bytes], { type: mime }), stamp + '.jpg'); return form;
  };
  const fieldsFor = async bytes => {
    if (mode === 'expense') {
      const current = await prisma.companyExpense.findUniqueOrThrow({ where: { id: expense.id } });
      return { envelope: JSON.stringify({ requestId: requestId(), command: 'ADD_EVIDENCE', expenseId: expense.id, expectedVersion: current.version, data: { name: stamp + '.jpg', mime: 'image/jpeg', size: bytes.length, sha256: hash(bytes) } }) };
    }
    if (mode === 'repair') return { type: 'AFTER' };
    return { requestId: requestId(), type: 'BEFORE', ...(mode === 'extra' ? { poolId: pool.id } : {}) };
  };
  const send = (fields, bytes, options = {}) => request(url, { method: 'POST', form: multipart(fields, bytes, options.mime), ...options, headers: { ...(mode === 'regular' ? { 'X-CW-Field-Request': fields.requestId } : {}), ...options.headers } });
  try {
    clients.push(await prisma.client.create({ data: { name: stamp, active: true } }));
    for (let i = 0; i < 2; i++) technicians.push(await prisma.technician.create({ data: { name: stamp + '-' + i, active: true } }));
    pool = await prisma.pool.create({ data: { clientId: clients[0].id, name: stamp } });
    token = mode === 'expense' || mode === 'repair' ? adminToken : sign({ id: technicians[0].id, technicianId: technicians[0].id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' });
    foreign = sign({ id: technicians[1].id, technicianId: technicians[1].id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' });
    clientToken = sign({ id: clients[0].id, role: 'CLIENT', principalType: 'CLIENT' });
    if (mode === 'regular' || mode === 'extra') {
      limit = 25 * 1048576;
      visit = await prisma[mode === 'regular' ? 'serviceVisit' : 'extraVisit'].create({ data: { clientId: clients[0].id, poolId: pool.id, technicianId: technicians[0].id, status: 'IN_PROGRESS' } });
      url = '/api/' + (mode === 'regular' ? 'visits' : 'extra-execution') + '/' + visit.id + '/photo';
    } else if (mode === 'repair') {
      limit = 20 * 1048576; repair = await prisma.repair.create({ data: { poolId: pool.id, problem: stamp } }); url = '/api/repairs/' + repair.id + '/photo';
    } else {
      limit = 5 * 1048576; expense = await prisma.companyExpense.create({ data: { title: stamp, supplierName: stamp, documentNumber: '', expenseDate: new Date('2032-01-01T00:00:00Z'), amountCents: 1, category: 'GENERAL', notes: '', sourceType: 'MANUAL', createdById: admin.id } }); url = '/api/expenses/evidence';
    }
    server = fork(__filename, ['server'], { env: process.env, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    base = await new Promise((resolve, reject) => { server.once('message', m => resolve('http://127.0.0.1:' + m.port)); server.once('error', reject); });
    if (mode === 'repair') {
      const empty = await request('/api/repairs/' + repair.id + '/photos');
      assert.deepEqual(empty.body, { ok: true, repairId: repair.id, photos: [] });
    }
    const jpeg = await require('sharp')({ create: { width: 64, height: 48, channels: 3, background: '#267a90' } }).jpeg().toBuffer();
    const data = Buffer.alloc(limit + 1); jpeg.copy(data);
    assert.equal((await require('sharp')(data).metadata()).width, 64);
    const successful = [];
    for (const delta of [-1, 0, 1]) {
      const bytes = data.subarray(0, limit + delta), fields = await fieldsFor(bytes), beforeCounts = await counts(), beforeFiles = files();
      const result = await send(fields, bytes, { expected: delta === 1 ? (['extra', 'expense'].includes(mode) ? 400 : 413) : 200 });
      Object.assign(result.record, { uploadBytes: bytes.length, boundaryDelta: delta });
      if (delta === 1) { assert.deepEqual(await counts(), beforeCounts); assert.deepEqual(files(), beforeFiles); }
      else { assert(result.body.ok); if (mode === 'expense') assert(result.body.applied); successful.push(result.body); }
    }
    // A different valid JPEG (trailing padding changes the digest) forces a fresh effect before response loss.
    data[limit - 1] = 1; const bytes = data.subarray(0, limit), digest = hash(bytes), lostFields = await fieldsFor(bytes);
    const snapshotBeforeLoss = await counts();
    await send(lostFields, bytes, { drop: true });
    let recovered, download, privateDownload = ['extra', 'expense'].includes(mode);
    if (mode === 'repair') {
      const listing = (await request('/api/repairs/' + repair.id + '/photos')).body;
      assert.equal(listing.repairId, repair.id);
      const attachments = listing.photos;
      assert(Array.isArray(attachments));
      const known = new Set(successful.map(r => r.photo.id)), newRows = attachments.filter(a => !known.has(a.id));
      assert.equal(newRows.length, 1); recovered = newRows[0]; download = recovered.fileUrl;
      assert.equal((await counts()).attachment, snapshotBeforeLoss.attachment + 1);
      const beforeReads = await counts(), beforeReadFiles = files();
      const techListing = await request('/api/repairs/' + repair.id + '/photos', { credential: foreign });
      assert.deepEqual(techListing.body, listing); assert.match(techListing.response.headers.get('cache-control'), /private.*no-store/);
      assert.deepEqual(Object.keys(listing).sort(), ['ok','photos','repairId']);
      for (const item of listing.photos) assert.deepEqual(Object.keys(item).sort(), ['createdAt','fileName','fileSize','fileUrl','id','mimeType']);
      await request('/api/repairs/' + repair.id + '/photos', { credential: null, expected: 401 });
      await request('/api/repairs/' + repair.id + '/photos', { credential: clientToken, expected: 403 });
      await request('/api/repairs/not-an-id/photos', { expected: 400 });
      await request('/api/repairs/2147483647/photos', { expected: 404 });
      assert.deepEqual(await counts(), beforeReads); assert.deepEqual(files(), beforeReadFiles);
    } else {
      if (mode === 'expense') {
        const receipt = (await request('/api/expenses/requests/' + JSON.parse(lostFields.envelope).requestId)).body;
        assert(receipt.ok && receipt.applied); assert.equal(receipt.receipt.requestId, JSON.parse(lostFields.envelope).requestId);
      }
      const beforeRepeat = await counts(), filesBeforeRepeat = files();
      recovered = (await send(lostFields, bytes)).body;
      assert.deepEqual(await counts(), beforeRepeat); assert.deepEqual(files(), filesBeforeRepeat);
      const model = mode === 'expense' ? 'expenseEvidence' : mode === 'regular' ? 'visitPhoto' : 'extraVisitPhoto';
      assert.equal(beforeRepeat[model], snapshotBeforeLoss[model] + 1);
      download = mode === 'expense' ? '/api/expenses/' + expense.id + '/evidence/' + recovered.evidence.id : recovered.photo.url;
      if (mode !== 'expense') { assert.equal(recovered.sha256, digest); assert.equal(recovered.size, limit); assert.equal(recovered.receipt.requestId, lostFields.requestId); }
    }
    const downloaded = await request(download, { binary: true });
    assert.equal(downloaded.record.bytes, limit); assert.equal(downloaded.record.sha256, digest);
    if (mode === 'expense') { assert.equal(downloaded.response.headers.get('x-expense-id'), String(expense.id)); assert.equal(downloaded.response.headers.get('x-expense-evidence-id'), String(recovered.evidence.id)); assert.equal(downloaded.response.headers.get('x-content-sha256'), digest); }
    if (privateDownload) {
      assert.match(downloaded.response.headers.get('cache-control'), /private.*no-store/);
      await request(download, { credential: null, expected: 401 }); await request(download, { credential: foreign, expected: 403 });
    } else {
      const publicRead = await request(download, { credential: null, binary: true }); assert.equal(publicRead.record.sha256, digest);
    }
    const smallFields = await fieldsFor(jpeg), rejectionCounts = await counts(), rejectionFiles = files();
    await send(smallFields, jpeg, { credential: null, expected: 401 });
    await send(smallFields, jpeg, { credential: clientToken, expected: 403 });
    if (mode !== 'repair') await send(smallFields, jpeg, { credential: foreign, expected: 403 });
    const invalid = Buffer.from('not an image'), invalidFields = await fieldsFor(invalid);
    await send(invalidFields, invalid, { mime: mode === 'repair' ? 'text/plain' : 'image/jpeg', expected: 400 });
    const duplicate = multipart(await fieldsFor(jpeg), jpeg); duplicate.append(field, new Blob([jpeg], { type: 'image/jpeg' }), 'duplicate.jpg');
    await request(url, { method: 'POST', form: duplicate, expected: 400 });
    const truncated = Buffer.from('--qa-boundary\r\nContent-Disposition: form-data; name="' + field + '"; filename="incomplete.jpg"\r\nContent-Type: image/jpeg\r\n\r\npartial');
    await request(url, { method: 'POST', raw: truncated, headers: { 'Content-Type': 'multipart/form-data; boundary=qa-boundary' }, expected: 400 });
    assert.deepEqual(await counts(), rejectionCounts); assert.deepEqual(files(), rejectionFiles);
    assert.equal(await finance(), beforeFinance);
    return { ok: true, phase: 'assertions-completed', mode, limit, reads, downloadHash: digest, boundariesAccepted: true, malformedRejected: true, responseLossRecovered: true, repeatIsIdempotent: mode !== 'repair', recoveryByListingOnly: mode === 'repair', privateDownload, policy: mode === 'repair' ? 'Legacy repair MIME filter and public file URL; no request UUID or assigned-technician model. Lost response recovered through ADMIN list, no repeat POST.' : mode === 'regular' ? 'Guarded request path; assigned upload, legacy original URL still public.' : 'Scoped private download and upload.', unrelatedFinancePreserved: true };
  } finally {
    if (server && server.exitCode === null) await new Promise(resolve => { server.once('exit', resolve); server.kill('SIGTERM'); });
    await prisma.fieldWriteRequest.deleteMany({ where: { requestId: { in: requestIds } } });
    if (expense) { await prisma.expenseEvent.deleteMany({ where: { expenseId: expense.id } }); await prisma.expenseEvidence.deleteMany({ where: { expenseId: expense.id } }); await prisma.companyExpense.delete({ where: { id: expense.id } }); }
    if (pool) {
      await prisma.attachment.deleteMany({ where: { poolId: pool.id } }); await prisma.notification.deleteMany({ where: { clientId: { in: clients.map(c => c.id) } } });
      await prisma.auditTrail.deleteMany({ where: { poolId: pool.id } }); await prisma.technicalHistory.deleteMany({ where: { poolId: pool.id } });
      if (repair) await prisma.repair.delete({ where: { id: repair.id } });
      if (visit) { await prisma[mode === 'extra' ? 'extraVisitPhoto' : 'visitPhoto'].deleteMany({ where: { [mode === 'extra' ? 'extraVisitId' : 'visitId']: visit.id } }); await prisma[mode === 'extra' ? 'extraVisit' : 'serviceVisit'].delete({ where: { id: visit.id } }); }
      await prisma.pool.delete({ where: { id: pool.id } });
    }
    await prisma.technician.deleteMany({ where: { id: { in: technicians.map(t => t.id) } } }); await prisma.client.deleteMany({ where: { id: { in: clients.map(c => c.id) } } });
    fs.rmSync(diskRoot, { recursive: true, force: true });
    assert.deepEqual(await counts(), before, 'Fixture cleanup must restore model counts'); assert.equal(await finance(), beforeFinance);
  }
}

async function projection() {
  const diskRoot = uploads.ensureUploadBaseDirReady();
  assert(/^photo-evidence-volume-[A-Za-z0-9]+$/.test(path.basename(diskRoot)));
  const prepare = require('../src/services/visitReportPhotoService').prepare;
  const jpeg = await require('sharp')({ create: { width: 64, height: 48, channels: 3, background: '#267a90' } }).jpeg().toBuffer();
  const originals = new Map(), cases = [];
  function photo(size, id = 1) {
    const bytes = Buffer.alloc(size); jpeg.copy(bytes); const sha256 = hash(bytes), filename = 'visit-1-BEFORE-' + sha256 + '.jpg';
    fs.writeFileSync(path.join(diskRoot, filename), bytes); originals.set(filename, sha256);
    return { id, visitId: 1, type: 'BEFORE', url: uploads.toPublicUploadUrl(filename) };
  }
  async function test(name, photos, accepted, limited, count = photos.length) {
    const report = { view: 'admin', language: 'pt', setting: { showPhotos: true }, visitType: 'REGULAR', visit: { id: 1, photos, _count: { photos: count } } };
    const start = performance.now(), result = await prepare(report);
    assert.equal(result.filter(x => x.bytes).length, accepted, name);
    assert.equal(result.filter(x => x.message && /limite/i.test(x.message)).length, limited, name);
    for (const item of result.filter(x => x.bytes)) { const meta = await require('sharp')(item.bytes).metadata(); assert.equal(meta.width, 64); assert.equal(meta.height, 48); assert(!meta.exif); }
    cases.push({ name, records: photos.length, accepted, limited, durationMs: Math.round((performance.now() - start) * 10) / 10 });
  }
  try {
    for (const delta of [-1, 0, 1]) await test('single25MiB' + (delta >= 0 ? '+' : '') + delta, [photo(25 * 1048576 + delta)], delta === 1 ? 0 : 1, delta === 1 ? 1 : 0);
    for (const delta of [-1, 0, 1]) await test('aggregate64MiB' + (delta >= 0 ? '+' : '') + delta, [photo(25 * 1048576, 1), photo(25 * 1048576, 2), photo(14 * 1048576 + delta, 3)], delta === 1 ? 2 : 3, delta === 1 ? 1 : 0);
    const small = photo(jpeg.length), records = Array.from({ length: 25 }, (_, i) => ({ ...small, id: i + 1 }));
    await test('count24', records.slice(0, 24), 24, 0); await test('count25', records, 24, 1);
    for (const [filename, sha256] of originals) assert.equal(hash(fs.readFileSync(path.join(diskRoot, filename))), sha256);
    return { ok: true, phase: 'assertions-completed', mode: 'projection', cases, originalHashesPreserved: true, scope: 'Direct real projection service, valid JPEG with padding, exact byte/count boundaries. No HTTP/PDF or simultaneous load measurement in this probe; those have separate regressions.' };
  } finally { fs.rmSync(diskRoot, { recursive: true, force: true }); }
}

async function main() {
  fs.mkdirSync(folder, { recursive: true });
  const results = [], failures = [], engine = (await prisma.$queryRawUnsafe('SELECT version() AS version'))[0].version;
  await prisma.$disconnect();
  for (const mode of ['regular','extra','repair','expense','projection']) {
    const dir = fs.mkdtempSync(path.join(uploads.ensureUploadBaseDirReady(), 'photo-evidence-volume-'));
    try {
      results.push(await new Promise((resolve, reject) => {
        let packet, error = '';
        const child = fork(__filename, ['probe', mode], { env: { ...process.env, UPLOAD_DIR: path.relative(root, dir) }, stdio: ['ignore','pipe','pipe','ipc'] });
        child.stderr.on('data', b => { error += b; }); child.stdout.on('data', () => {}); child.on('message', p => { packet = p; }); child.once('error', reject);
        child.once('exit', (code, signal) => code === 0 && !signal && packet?.ok ? resolve(packet) : reject(Error(mode + ': ' + (packet?.error || error.slice(-2500) || 'Missing completion proof'))));
      }));
    } catch (error) { failures.push({ mode, error: error.message }); console.error(error.message); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
    fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify({ ok: false, phase: 'in-progress', engine, results, failures }, null, 2) + '\n');
  }
  assert.deepEqual(failures, []); assert.equal(results.length, 5);
  fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify({ ok: true, phase: 'assertions-completed', engine, results, cleanupVerified: true, scope: 'Four real HTTP/SQL upload surfaces, fresh separate API/client processes per surface, configured byte boundaries, valid JPEG originals/download hashes, response loss/recovery, contracts/access/malformed multipart, finance hashes and 22 model counts restored. Fifth probe checks real photo projection 25MiB/64MiB/24 boundaries. Legacy repair/regular file URLs remain public and repair POST has no idempotency. Does not certify VPS, concurrent uploads, decoded validity beyond current route contract, or legacy unguarded regular upload.' }, null, 2) + '\n');
  completed = true;
  console.log('PASS photo/evidence volume: four upload surfaces, exact boundaries, download hashes, response loss and recovery, access policy, invalid multipart, preserved finance and cleanup; projection byte/count boundaries');
}

async function serve() {
  const app = require('express')(); app.use(require('express').json());
  app.use((req, res, next) => { const json = res.json.bind(res); res.json = data => { if (req.headers['x-qa-drop-response'] === 'true' && res.statusCode >= 200 && res.statusCode < 300) { res.destroy(); return res; } return json(data); }; next(); });
  for (const [prefix, route] of [['visits','visitRoutes'],['extra-execution','extraVisitExecutionRoutes'],['repairs','repairRoutes'],['expenses','companyExpenseRoutes']]) app.use('/api/' + prefix, require('../src/routes/' + route));
  app.use(uploads.getUploadsPublicBasePath(), require('../src/services/fieldPhotoRequestService').protectExtraUploads, require('express').static(uploads.resolveUploadBaseDir()));
  app.use(require('../src/middlewares/errorHandlerMiddleware'));
  let timer, peak; const sample = () => { peak = Math.max(peak, process.memoryUsage().rss); };
  process.on('message', ({ command }) => { if (command === 'start') { peak = process.memoryUsage().rss; timer = setInterval(sample, 5); process.send({ ready: true }); } else { sample(); clearInterval(timer); process.send({ rssMiB: mib(peak) }); } });
  await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => process.send({ port: server.address().port })); process.on('SIGTERM', () => { clearInterval(timer); server.close(() => { completed = true; resolve(); }); }); });
}

(process.argv[2] === 'server' ? serve() : process.argv[2] === 'probe' ? (process.argv[3] === 'projection' ? projection() : probe(process.argv[3])).then(result => { completed = true; process.send({ ...result, cleanupVerified: true }); }) : main())
  .catch(error => { console.error(error); if (process.send) process.send({ ok: false, error: error.message }); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); clearTimeout(deadline); if (process.send) process.disconnect(); });
