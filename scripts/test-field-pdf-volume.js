'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { randomUUID, createHash } = require('node:crypto'), { spawn } = require('node:child_process'), { performance } = require('node:perf_hooks');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const address = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(address.hostname) && /qa/i.test(address.pathname));
const { PrismaClient } = require('@prisma/client'), prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
global.__CRISTAL_WATER_PRISMA__ = prisma;
const folder = path.join(__dirname, '../reports/field-suite/pdf-volume'), pdfText = require('./lib/reportPdfText');
const digest = v => createHash('sha256').update(Buffer.isBuffer(v) ? v : JSON.stringify(v)).digest('hex'), mib = n => Math.round(n / 1048576 * 100) / 100;
const marker = (kind, i) => kind + '_' + String(i).padStart(5, '0') + '_END';
const sign = actor => require('jsonwebtoken').sign(actor, require('../src/utils/jwtSecret').getJwtSecret(), { expiresIn: '30m' });
const clientActor = c => ({ id: c.id, clientId: c.id, role: 'CLIENT', principalType: 'CLIENT' });
const techActor = t => ({ id: t.id, technicianId: t.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' });
let completed = false;
process.on('exit', () => { if (!completed && !process.exitCode) { fs.writeSync(2, 'PDF volume exited before assertions completed\n'); process.exitCode = 1; } });

async function probe(f) {
  const app = require('express')();
  for (const [prefix, route] of [['guides', 'guideRoutes'], ['client-reports', 'clientReportRoutes'], ['invoice-pdf', 'invoicePdfRoutes'], ['repairs', 'repairRoutes'], ['report-visit', 'reportVisitRoutes']]) app.use('/api/' + prefix, require('../src/routes/' + route));
  app.use(require('../src/middlewares/errorHandlerMiddleware'));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const origin = 'http://127.0.0.1:' + server.address().port, admin = sign({ id: f.admin, role: 'ADMIN', principalType: 'USER' });
  const ownClient = sign(clientActor(f.clients[0])), foreignClient = sign(clientActor(f.clients[1])), ownTech = sign(techActor(f.techs[0])), foreignTech = sign(techActor(f.techs[1]));
  const results = [], reads = []; let measuring = false, sql;
  prisma.$on('query', e => { if (measuring) { sql.queries++; sql.durationMs += e.duration; if (/^\s*(INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(e.query)) sql.writes++; } });
  async function get(url, token = admin, status = 200) {
    const peak = { rss: 0, heap: 0 }, sample = () => { const m = process.memoryUsage(); peak.rss = Math.max(peak.rss, m.rss); peak.heap = Math.max(peak.heap, m.heapUsed); };
    sql = { queries: 0, durationMs: 0, writes: 0 }; sample(); measuring = true;
    const start = performance.now(), timer = setInterval(sample, 5); let response, bytes, duration;
    try { response = await fetch(origin + url, { headers: token ? { Authorization: 'Bearer ' + token } : {}, signal: AbortSignal.timeout(30000) }); bytes = Buffer.from(await response.arrayBuffer()); duration = performance.now() - start; sample(); }
    finally { measuring = false; clearInterval(timer); }
    assert.equal(response.status, status, url + ' ' + bytes.subarray(0, 250).toString()); assert.equal(sql.writes, 0);
    let text = '', pages = 0, images = 0;
    if (status === 200) {
      assert.equal(response.headers.get('content-type'), 'application/pdf'); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-'); assert.equal(bytes.subarray(-6).toString(), '%%EOF\n');
      text = pdfText(bytes); pages = (bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length; images = (bytes.toString('latin1').match(/\/Subtype \/Image\b/g) || []).length;
      assert(pages > 0); for (let i = 1; i <= pages; i++) assert(text.includes(url.includes('/report-visit/') ? 'registo atual | ' + i + '/' + pages : `Página ${i} de ${pages}`), url + ' footer ' + i);
    } else assert(!bytes.subarray(0, 5).equals(Buffer.from('%PDF-')));
    sample(); const measurement = { url, status, bytes: bytes.length, durationMs: Math.round(duration * 10) / 10, sampledRssMiB: mib(peak.rss), sampledHeapMiB: mib(peak.heap), pages, images, sql };
    reads.push(measurement); fs.writeFileSync(path.join(folder, 'last-measurement.json'), JSON.stringify(measurement));
    assert(duration < 30000 && bytes.length < 64 * 1048576 && peak.rss < 768 * 1048576, JSON.stringify(measurement));
    return { bytes, text, pages, images, headers: response.headers, measurement };
  }
  const entries = [
    { family: 'transport', url: '/api/guides/transport/' + f.transport.id + '/pdf', token: ownTech, foreign: foreignTech, denied: 403, markers: Array.from({ length: f.items }, (_, i) => marker('ITEM', i)), values: [f.transport.codeAT], headers: { 'x-cw-document-type': 'transport-guide', 'x-cw-document-id': f.transport.id, 'x-cw-vehicle-id': f.vehicles[0].id } },
    { family: 'work', url: '/api/guides/work/' + f.work.id + '/pdf', token: ownTech, foreign: foreignTech, denied: 403, markers: Array.from({ length: f.n }, (_, i) => marker('MOVE', i)), values: ['Leitura final do stock', f.transport.codeAT], headers: { 'x-cw-document-type': 'work-guide', 'x-cw-document-id': f.work.id, 'x-cw-vehicle-id': f.vehicles[0].id } },
    { family: 'insurance', url: '/api/guides/vehicles/' + f.vehicles[0].id + '/insurance/pdf', token: ownTech, foreign: foreignTech, denied: 403, markers: f.insurance ? ['INSURANCE_END'] : [], values: f.insurance ? ['INSURANCE_START'] : ['Seguro não registado'], headers: { 'x-cw-document-type': 'vehicle-insurance', 'x-cw-vehicle-id': f.vehicles[0].id } },
    { family: 'monthly', url: '/api/client-reports/' + f.clients[0].id + '/reports/' + f.monthly.id + '/pdf', token: ownClient, foreign: foreignClient, denied: 403, markers: Array.from({ length: f.n }, (_, i) => marker('POOL', i)), values: ['SAVED_411', '2092-01'], headers: { 'x-cw-report-type': 'client-monthly-pdf', 'x-cw-client-id': f.clients[0].id, 'x-cw-report-id': f.monthly.id, 'x-cw-month-ref': '2092-01' } },
    { family: 'invoice', url: '/api/invoice-pdf/' + f.invoice.id, token: ownClient, foreign: foreignClient, denied: 404, markers: Array.from({ length: f.n }, (_, i) => marker('INVOICE', i)), values: ['€ ' + (f.n / 100).toFixed(2), 'não fiscal'], headers: { 'x-cw-document-type': 'invoice-pdf', 'x-cw-client-id': f.clients[0].id, 'x-cw-invoice-id': f.invoice.id } },
    { family: 'extras', url: '/api/invoice-pdf/extras/' + f.clients[0].id, token: ownClient, foreign: foreignClient, denied: 404, markers: f.billableIds.map(id => 'Visita #' + id + ' ·'), values: ['€ ' + (f.billableIds.length / 100).toFixed(2), 'não fiscal'], headers: { 'x-cw-document-type': 'extra-billing-pdf', 'x-cw-client-id': f.clients[0].id } },
    { family: 'quote', url: '/api/repairs/' + f.repair.id + '/pdf', token: null, foreign: foreignClient, denied: 403, markers: Array.from({ length: f.items }, (_, i) => marker('QUOTE', i)), values: f.quote ? ['TERMS_END', '€ ' + f.quote.snapshot.total.toFixed(2)] : ['Estimativa antiga', 'Por rever'], headers: {} },
    ...[['regular', f.visit.id, 'REGULAR'], ['extra', f.extra.id, 'EXTRA']].map(([family, id, type]) => ({ family, url: '/api/report-visit/visit/' + id + '?view=admin&visitType=' + type, token: ownClient, foreign: foreignClient, denied: 403, markers: Array.from({ length: f.chemicals }, (_, i) => marker('CHEM', i)), values: ['OBSERVATIONS_END', 'PRIVATE_411_' + type], headers: { 'x-cw-report-type': type === 'EXTRA' ? 'extra-visit-pdf' : 'visit-pdf', 'x-cw-visit-id': id, 'x-cw-client-id': f.clients[0].id, 'x-cw-visit-type': type, 'x-cw-report-view': 'admin' } }))
  ];
  try {
    for (const entry of entries) {
      const response = await get(entry.url);
      for (const [key, value] of Object.entries(entry.headers)) assert.equal(response.headers.get(key), String(value));
      for (const value of [...entry.markers, ...entry.values]) assert(response.text.includes(value), entry.family + ' missing ' + value);
      for (const value of entry.markers) assert.equal(response.text.split(value).length - 1, 1, entry.family + ' repeated ' + value);
      assert(response.text.includes('Łukasz')); assert(!response.text.includes('FOREIGN_411') && !response.text.includes('PRIVATE_411_PIN'));
      if (!['regular', 'extra'].includes(entry.family)) assert(!response.text.includes('PRIVATE_411'));
      if (['regular', 'extra'].includes(entry.family)) assert.equal(response.images, f.photos);
      if (f.n > 0) assert(response.pages > 1, entry.family + ' should exercise page breaks');
      const filename = entry.family + '-' + f.n + '.pdf'; fs.writeFileSync(path.join(folder, filename), response.bytes);
      results.push({ family: entry.family, profile: f.n, file: filename, sha256: digest(response.bytes), markersVerified: entry.markers.length, totalsAndIdentity: true, ...response.measurement });
      await get(entry.url, null, 401); await get(entry.url.replace('view=admin', 'view=client'), entry.foreign, entry.denied);
      if (f.n === 1001 && entry.token) {
        const owned = await get(entry.url.replace('view=admin', 'view=client'), entry.token);
        for (const value of entry.markers) assert(owned.text.includes(value)); assert(!owned.text.includes('PRIVATE_411'));
        if (['regular', 'extra'].includes(entry.family)) { assert.equal(owned.images, f.photos); assert.equal(owned.headers.get('x-cw-report-view'), 'client'); await get(entry.url, entry.token, 403); }
      }
    }
    const latest = await get('/api/guides/transport/latest/' + f.vehicles[0].id + '/pdf', ownTech); assert.equal(latest.headers.get('x-cw-document-id'), String(f.transport.id)); assert(latest.text.includes(f.transport.codeAT));
    await get('/api/invoice-pdf/2147483647', admin, 404); await get('/api/guides/work/2147483647/pdf', admin, 404);
    return { profile: f.n, results, reads, writes: 0, exactMarkers: true, permissions: true };
  } finally { await new Promise(resolve => server.close(resolve)); }
}

async function run(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename, 'probe', file], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
    child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { err += b; }); const timer = setTimeout(() => child.kill('SIGKILL'), 85000);
    child.once('error', e => { clearTimeout(timer); reject(e); }); child.once('close', (code, signal) => { clearTimeout(timer);
      if (code !== 0 || signal) return reject(Error('PDF probe failed ' + code + '/' + signal + '\n' + out.slice(-1000) + err.slice(-4500)));
      const line = out.split('\n').find(l => l.startsWith('{"pdfVolumeProbe"')); if (!line) return reject(Error('Missing assertion completion proof'));
      const result = JSON.parse(line).pdfVolumeProbe; assert(result.ok && result.phase === 'assertions-completed'); console.log(JSON.stringify({ pdfVolume: result.profile, documents: result.results.length, reads: result.reads.length })); resolve(result);
    });
  });
}
async function main() {
  fs.mkdirSync(folder, { recursive: true }); const output = path.join(folder, 'results.json'), profiles = [0, 25, 1001], results = [], integrity = [], started = Date.now();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-pdf-volume-')), file = path.join(temporary, 'fixture.json'), engine = (await prisma.$queryRawUnsafe('SELECT version() AS version'))[0].version;
  const models = ['client', 'pool', 'technician', 'vehicle', 'vehicleMaintenanceRecord', 'transportGuide', 'transportGuideItem', 'workGuide', 'workGuideItem', 'vehicleStockMovement', 'monthlyReport', 'invoice', 'invoiceLine', 'payment', 'repair', 'repairQuote', 'serviceVisit', 'chemicalUsage', 'visitPhoto', 'extraVisit', 'extraVisitPhoto', 'clientReportSetting', 'fieldWriteRequest', 'userAuditLog', 'systemSetting'];
  const counts = async () => { const out = {}; for (const model of models) out[model] = await prisma[model].count(); return out; }, baseline = await counts();
  const many = async (model, data) => { for (let i = 0; i < data.length; i += 250) await prisma[model].createMany({ data: data.slice(i, i + 250) }); };
  fs.writeFileSync(output, JSON.stringify({ ok: false, phase: 'started', profiles }));
  try {
    for (const n of profiles) {
      const f = { n, items: Math.min(n, 100), chemicals: Math.min(n, 50), photos: n === 1001 ? 24 : n ? 4 : 0, prefix: 'QA411-' + randomUUID(), clients: [], vehicles: [], techs: [], files: [] };
      const clientWhere = () => ({ clientId: { in: f.clients.map(c => c.id) } }), vehicleWhere = () => ({ vehicleId: { in: f.vehicles.map(v => v.id) } });
      try {
        f.admin = (await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } })).id;
        for (let i = 0; i < 2; i++) { f.clients.push(await prisma.client.create({ data: { name: (i ? 'FOREIGN_411' : 'OWNER_411 Łukasz Γιάννης 漢') + f.prefix, active: true } })); f.vehicles.push(await prisma.vehicle.create({ data: { plate: f.prefix + i, name: 'Viatura Łukasz Γιάννης 漢', active: true } })); f.techs.push(await prisma.technician.create({ data: { name: 'Técnico Łukasz', vehicleId: f.vehicles[i].id, pin: 'PRIVATE_411_PIN', active: true } })); }
        const clientId = f.clients[0].id, vehicleId = f.vehicles[0].id, technicianId = f.techs[0].id;
        f.pool = await prisma.pool.create({ data: { clientId, name: 'Piscina Łukasz Γιάννης 漢' } });
        await prisma.clientReportSetting.create({ data: { clientId, ...Object.fromEntries(require('../src/services/clientReportSettingsDefaults').keys.map(key => [key, true])) } });
        const long = (label, length) => (label + '_START ' + 'Água Łukasz e manutenção. '.repeat(Math.ceil(length / 20))).slice(0, length - label.length - 5) + ' ' + label + '_END';
        f.transport = await prisma.transportGuide.create({ data: { vehicleId, codeAT: f.prefix, status: 'ACTIVE', isDraft: false, validUntil: new Date('2099-01-01Z'), origin: 'Origem Łukasz', destination: 'Destino Γιάννης' } });
        f.work = await prisma.workGuide.create({ data: { vehicleId, technicianId, guideId: f.transport.id, status: 'OPEN', isDraft: false } });
        const items = Array.from({ length: f.items }, (_, i) => ({ name: (marker('ITEM', i) + (n === 1001 ? ' Material Água Łukasz '.repeat(20) : ' Água Łukasz')).slice(0, 300), type: 'CHEMICAL', unit: 'kg', quantity: 1.000001 }));
        await many('transportGuideItem', items.map(r => ({ ...r, guideId: f.transport.id })));
        await many('workGuideItem', items.map(r => ({ ...r, workGuideId: f.work.id, initialQty: 2, usedQty: 0.999999 })));
        await many('vehicleStockMovement', Array.from({ length: n }, (_, i) => ({ vehicleId, technicianId, workGuideId: f.work.id, transportGuideId: f.transport.id, movementType: 'CONSUMPTION', itemName: items[i % f.items].name, quantity: -0.000001, unit: 'kg', notes: JSON.stringify({ cwGuideMovement: true, userNotes: marker('MOVE', i), readings: { ph: 0 }, private: 'PRIVATE_411_MOVEMENT' }) })));
        if (n) f.insurance = await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId, type: 'INSURANCE', title: 'Seguro Łukasz ' + 'Apólice '.repeat(20), status: 'ACTIVE', notes: long('INSURANCE', 2000).replaceAll('manutenção. ', 'manutenção.\n'), dueDate: new Date('2099-01-01Z') } });
        f.monthly = await prisma.monthlyReport.create({ data: { clientId, month: '2092-01', type: 'CLIENT', data: { reportVersion: 2, client: 'SAVED_411 Łukasz Γιάννης 漢', paymentStatus: 'PAID', pools: Array.from({ length: n }, (_, i) => ({ name: marker('POOL', i) + ' Łukasz', totalVisits: i % 12, notDone: 0, unconfirmed: i % 3 })) } } });
        f.invoice = await prisma.invoice.create({ data: { clientId, monthRef: '2092-01', total: n / 100, amountPaid: 0, amountOpen: n / 100, status: 'ISSUED', notes: 'PRIVATE_411_INVOICE' } });
        await many('invoiceLine', Array.from({ length: n }, (_, i) => ({ invoiceId: f.invoice.id, description: marker('INVOICE', i) + ' Água Łukasz', total: 0.01, quantity: 1, unitPrice: 0.01 })));
        await many('extraVisit', Array.from({ length: Math.max(1, n) }, () => ({ clientId, poolId: f.pool.id, price: 0.01, status: 'DONE', billingMode: 'EXTRA', isBillable: true, billed: false, scheduledAt: new Date('2092-01-01Z') })));
        f.billableIds = (await prisma.extraVisit.findMany({ where: { clientId }, select: { id: true }, orderBy: { id: 'asc' } })).map(r => r.id);
        f.repair = await prisma.repair.create({ data: { poolId: f.pool.id, problem: 'Problema Łukasz Γιάννης', quantity: 1, unitPrice: null, totalPrice: null, notes: 'PRIVATE_411_REPAIR' } });
        if (n) { const snapshot = require('../src/business/repair/CommercialQuoteBusiness').calculate({ lines: Array.from({ length: f.items }, (_, i) => ({ type: 'MATERIAL', description: (marker('QUOTE', i) + (n === 1001 ? ' Água Łukasz '.repeat(30) : ' Água Łukasz')).slice(0, 300), quantity: 1, unitCost: 73.19, marginPercent: 20 })), taxPercent: 23, terms: long('TERMS', 3000) }); f.quote = await prisma.repairQuote.create({ data: { repairId: f.repair.id, version: 1, snapshot, createdBy: 'QA' } }); }
        const chemicals = Array.from({ length: f.chemicals }, (_, i) => ({ name: marker('CHEM', i) + ' Água Łukasz', quantity: 1.000001, unit: 'kg' }));
        const notes = long('OBSERVATIONS', n ? 2000 : 100);
        f.visit = await prisma.serviceVisit.create({ data: { clientId, poolId: f.pool.id, technicianId, technicianName: 'Técnico Łukasz', status: 'COMPLETED', ph: 0, cleaned: false, notes, internalNotes: 'PRIVATE_411_REGULAR', chemicals: { create: chemicals } } });
        f.extra = await prisma.extraVisit.create({ data: { clientId, poolId: f.pool.id, technicianId, status: 'DONE', billingMode: 'NO_CHARGE', isBillable: false, notes: 'Planeamento guardado', internalNote: 'PRIVATE_411_EXTRA', execution: { notes, ph: 0, cleaned: false, chemicalsJson: chemicals } } });
        const { ensureUploadBaseDirReady, toPublicUploadUrl } = require('../src/config/uploadPath'), uploadRoot = ensureUploadBaseDirReady();
        for (let i = 0; i < f.photos; i++) {
          const bytes = await require('sharp')({ create: { width: 640, height: 360, channels: 3, background: { r: 20 + i * 5, g: 100 + i * 3, b: 180 - i * 5 } } }).jpeg().toBuffer();
          for (const extra of [false, true]) { const id = extra ? f.extra.id : f.visit.id, filename = `${extra ? 'extra-' : ''}visit-${id}-AFTER-${digest(bytes)}.jpg`, disk = path.join(uploadRoot, filename); fs.writeFileSync(disk, bytes); f.files.push({ disk, sha256: digest(bytes) }); await prisma[extra ? 'extraVisitPhoto' : 'visitPhoto'].create({ data: { [extra ? 'extraVisitId' : 'visitId']: id, type: 'AFTER', url: toPublicUploadUrl(filename) } }); }
        }
        const snapshot = async () => digest(await Promise.all([
          prisma.transportGuide.findMany({ where: vehicleWhere(), include: { items: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } }), prisma.workGuide.findMany({ where: vehicleWhere(), include: { items: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } }), prisma.vehicleStockMovement.findMany({ where: vehicleWhere(), orderBy: { id: 'asc' } }), prisma.vehicleMaintenanceRecord.findMany({ where: vehicleWhere(), orderBy: { id: 'asc' } }),
          prisma.invoice.findMany({ where: clientWhere(), include: { lines: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } }), prisma.monthlyReport.findMany({ where: clientWhere(), orderBy: { id: 'asc' } }), prisma.serviceVisit.findMany({ where: clientWhere(), include: { chemicals: { orderBy: { id: 'asc' } }, photos: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } }), prisma.extraVisit.findMany({ where: clientWhere(), include: { photos: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } }), prisma.repair.findUnique({ where: { id: f.repair.id }, include: { quotes: true } }), prisma.clientReportSetting.findMany({ where: clientWhere(), orderBy: { id: 'asc' } })
        ]));
        const before = await counts(), beforeHash = await snapshot(); fs.writeFileSync(file, JSON.stringify(f)); results.push(await run(file));
        assert.deepEqual(await counts(), before); assert.equal(await snapshot(), beforeHash); for (const source of f.files) assert.equal(digest(fs.readFileSync(source.disk)), source.sha256);
        integrity.push({ profile: n, sourceSnapshotSha256: beforeHash, sourcePreserved: true, originalPhotos: f.files.length, unchangedModelCounts: before });
        fs.writeFileSync(output, JSON.stringify({ ok: false, phase: 'profiles-in-progress', profiles, results, integrity }, null, 2) + '\n');
      } finally {
        await prisma.extraVisitPhoto.deleteMany({ where: { extraVisit: clientWhere() } }); await prisma.extraVisit.deleteMany({ where: clientWhere() }); await prisma.serviceVisit.deleteMany({ where: clientWhere() });
        if (f.repair) { await prisma.repairQuote.deleteMany({ where: { repairId: f.repair.id } }); await prisma.repair.delete({ where: { id: f.repair.id } }); }
        await prisma.invoice.deleteMany({ where: clientWhere() }); await prisma.monthlyReport.deleteMany({ where: clientWhere() }); await prisma.clientReportSetting.deleteMany({ where: clientWhere() });
        await prisma.vehicleStockMovement.deleteMany({ where: vehicleWhere() }); await prisma.workGuide.deleteMany({ where: vehicleWhere() }); await prisma.transportGuide.deleteMany({ where: vehicleWhere() }); await prisma.vehicleMaintenanceRecord.deleteMany({ where: vehicleWhere() });
        await prisma.technician.deleteMany({ where: { id: { in: f.techs.map(t => t.id) } } }); await prisma.vehicle.deleteMany({ where: { id: { in: f.vehicles.map(v => v.id) } } }); if (f.pool) await prisma.pool.delete({ where: { id: f.pool.id } }); await prisma.client.deleteMany({ where: { id: { in: f.clients.map(c => c.id) } } });
        for (const source of f.files) fs.rmSync(source.disk, { force: true }); assert.deepEqual(await counts(), baseline);
      }
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); const partial = JSON.parse(fs.readFileSync(output)); partial.cleanupVerified = digest(await counts()) === digest(baseline); fs.writeFileSync(output, JSON.stringify(partial, null, 2) + '\n'); }
  assert.equal(results.length, 3); fs.writeFileSync(output, JSON.stringify({ ok: true, phase: 'assertions-completed', engine, profiles, results, integrity, durationMs: Date.now() - started, cleanupVerified: true, scope: 'Nine PDF families, empty/legacy minimum, multipage and largest synthetic profile. Guide/quote rows capped at their 100-item write limit; visit chemicals at 50, photos at 24, insurance notes at 2000 and quote terms at 3000 characters. Monthly pools, invoice lines, pending extras and work movements reach 1001; these are tested dimensions, not application limits. Fresh Node process per profile; RSS includes API, fixture, HTTP and PDF text decoder, excludes DB. No commands or deliveries. Text/page checks do not replace external visual rendering QA. Upload byte boundaries belong to the subsequent C04-F batch.' }, null, 2) + '\n');
  completed = true; console.log('PASS PDF volume: nine families, 27 documents, complete markers/totals/pages, 1001 rows, 100-item guides/quotes, 24 photos, owner isolation, unchanged sources and cleanup');
}
async function child(file) { const result = await probe(JSON.parse(fs.readFileSync(file, 'utf8'))); completed = true; console.log(JSON.stringify({ pdfVolumeProbe: { ok: true, phase: 'assertions-completed', ...result } })); }
(process.argv[2] === 'probe' ? child(process.argv[3]) : main()).catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
