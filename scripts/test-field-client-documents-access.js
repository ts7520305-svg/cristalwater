'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID, randomInt, createHash } = require('node:crypto'), jwt = require('jsonwebtoken');
const { spawnSync } = require('node:child_process');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const { resolveUploadSubdir, getUploadsPublicBasePath } = require('../src/config/uploadPath');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const root = resolveUploadSubdir('documents'), manifest = path.join(root, 'manifest.json');
const original = fs.existsSync(manifest) ? fs.readFileSync(manifest) : null, files = [];
const sign = user => jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
async function get(url, token, options = {}) {
  const response = await fetch(base + url, { signal: AbortSignal.timeout(15000), ...options, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers } });
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
}
(async () => {
  const stamp = 'qa-document-' + randomUUID(), firstId = Date.now();
  const a = await prisma.client.create({ data: { name: stamp + '-current', active: true } });
  const b = await prisma.client.create({ data: { name: stamp + '-original', active: true } });
  const pool = await prisma.pool.create({ data: { clientId: b.id, name: stamp } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: b.id, poolId: pool.id, status: 'DONE' } });
  await prisma.pool.update({ where: { id: pool.id }, data: { clientId: a.id } });
  const tokens = [a, b].map(c => sign({ id: c.id, clientId: c.id, role: 'CLIENT', principalType: 'CLIENT' }));
  const list = id => `/api/client-portal/${id}/documents`, download = (id, doc) => `${list(id)}/${doc.id}/download`;
  function file(name, bytes) { fs.writeFileSync(name, bytes); files.push(name); return path.basename(name); }
  const filename = file(path.join(root, stamp + '.txt'), 'QA_DOCUMENT_ORIGINAL_OWNER');
  const outside = path.join(root, '..', stamp + '-outside.txt'); file(outside, 'QA_DOCUMENT_OUTSIDE_DIRECTORY');
  const docs = [
    { id: firstId, clientId: b.id, poolId: pool.id, filename, originalName: 'historical.txt', title: 'Original owner', createdAt: new Date().toISOString() },
    { id: firstId + 1, clientId: a.id, filename: '../' + path.basename(outside), originalName: 'outside.txt' },
  ];
  fs.writeFileSync(manifest, JSON.stringify(docs));
  const listed = await get(list(a.id), tokens[0]);
  const crossed = await get(download(a.id, docs[0]), tokens[0]);
  const escaped = await get(download(a.id, docs[1]), tokens[0]);
  console.log(JSON.stringify({ transferredPoolDocuments: JSON.parse(listed.bytes).documents.map(d => d.id), crossOwnerDownload: crossed.status, outsideDirectoryDownload: escaped.status }));
  assert.equal(crossed.status, 404, 'The current pool owner must not receive the original customer document');
  assert.equal(escaped.status, 404, 'A manifest path must never escape the documents directory');
  assert.equal((await get(download(b.id, docs[0]), tokens[1])).bytes.toString(), 'QA_DOCUMENT_ORIGINAL_OWNER');
  assert.deepEqual(JSON.parse(listed.bytes).documents, []);
  const empty = await prisma.client.create({ data: { name: stamp + '-empty', active: true } });
  const otherPool = await prisma.pool.create({ data: { clientId: a.id, name: stamp + '-unrelated' } });
  const noOwnerVisit = await prisma.serviceVisit.create({ data: { poolId: pool.id, status: 'DONE' } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const adminToken = sign({ id: admin.id, userId: admin.id, role: 'ADMIN', principalType: 'USER' });
  const collision = randomInt(1000000000, 1900000000);
  const collidingClient = await prisma.client.create({ data: { id: collision, name: stamp + '-identity', active: true } });
  const staff = await prisma.user.create({ data: { id: collision, email: stamp + '@qa.test', name: stamp, password: 'isolated-test-only', role: 'CLIENT', active: true } });
  const tech = await prisma.technician.create({ data: { id: collision, name: stamp, role: 'TEAM_LEADER', active: true } });
  const staffToken = sign({ id: staff.id, userId: staff.id, role: 'CLIENT', principalType: 'USER' });
  const techToken = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' });
  const leaderToken = sign({ id: tech.id, technicianId: tech.id, role: 'TEAM_LEADER', principalType: 'TECHNICIAN' });
  const bytesById = new Map(), hash = bytes => createHash('sha256').update(bytes).digest('hex');
  function add(fields, bytes = 'QA_DOCUMENT_BYTES_' + docs.length) {
    const id = firstId + docs.length, ownFile = fields.filename === undefined ? file(path.join(root, `${stamp}-${id}.txt`), bytes) : fields.filename;
    const row = { id, filename: ownFile, createdAt: '2098-01-01T00:00:00.000Z', originalName: `ficheiro-${id}.txt`, title: `QA_DOCUMENT_TITLE_${id}`, ...fields };
    docs.push(row); bytesById.set(row.id, Buffer.from(bytes)); return row;
  }
  const own = add({ clientId: a.id, originalName: 'Ficha técnica — piscina.html', url: 'javascript:alert(1)' }, '<!doctype html><script>parent.compromised=true</script>');
  const historical = add({ visitId: visit.id, poolId: pool.id });
  const explicitVisit = add({ clientId: b.id, visitId: visit.id, poolId: pool.id });
  const entityClient = add({ entity: 'client', entityId: String(b.id), clientId: b.id });
  const entityVisit = add({ entity: 'SERVICE_VISIT', entityId: String(visit.id), poolId: pool.id });
  const entityPool = add({ entity: 'POOL', entityId: pool.id, clientId: b.id });
  const ambiguous = [
    add({ poolId: pool.id }), add({ entity: 'POOL', entityId: pool.id }), add({}),
    add({ clientId: a.id, visitId: visit.id }), add({ clientId: a.id, entity: 'CLIENT', entityId: b.id }),
    add({ clientId: b.id, visitId: visit.id, poolId: otherPool.id }),
    add({ clientId: a.id, visitId: noOwnerVisit.id }), add({ clientId: a.id, visitId: 2147483647 }),
    add({ clientId: b.id, entity: 'EXTRA_VISIT', entityId: visit.id }),
    add({ clientId: a.id, alertId: visit.id }), add({ clientId: a.id, repairId: visit.id }),
    add({ clientId: true }), add({ clientId: [a.id] }), add({ clientId: '0' + a.id }),
    add({ clientId: a.id, entity: 'VISIT', entityId: visit.id, visitId: noOwnerVisit.id }),
    add({ clientId: b.id, entity: 'POOL', entityId: otherPool.id, poolId: pool.id }),
    add({ clientId: a.id, entity: 'CLIENT' }), add({ clientId: a.id, entityId: a.id }),
  ];
  const duplicate = add({ clientId: a.id }); ambiguous.push(duplicate, add({ id: String(duplicate.id), clientId: b.id }));
  const sharedFile = add({ clientId: a.id }); ambiguous.push(sharedFile, add({ clientId: b.id, filename: sharedFile.filename }));
  const unsafe = ['../' + path.basename(outside), '..\\' + path.basename(outside), outside, 'manifest.json', '.hidden', '', '.', '..', 'nested/file.txt', 'x\u0000.txt'];
  for (const name of unsafe) ambiguous.push(add({ clientId: a.id, filename: name }));
  const symlink = add({ clientId: a.id, filename: stamp + '-symlink.txt' }); fs.symlinkSync(outside, path.join(root, symlink.filename)); files.push(path.join(root, symlink.filename));
  const hardlink = add({ clientId: a.id, filename: stamp + '-hardlink.txt' }); fs.linkSync(outside, path.join(root, hardlink.filename)); files.push(path.join(root, hardlink.filename));
  const directory = add({ clientId: a.id, filename: stamp + '-directory' }); fs.mkdirSync(path.join(root, directory.filename)); files.push(path.join(root, directory.filename));
  const fifo = add({ clientId: a.id, filename: stamp + '-fifo' }); assert.equal(spawnSync('mkfifo', [path.join(root, fifo.filename)]).status, 0); files.push(path.join(root, fifo.filename));
  const missing = add({ clientId: a.id, filename: stamp + '-missing.txt' });
  const emptyFile = add({ clientId: a.id }, '');
  const oversized = add({ clientId: a.id }); fs.truncateSync(path.join(root, oversized.filename), 50 * 1024 * 1024 + 1);
  const highId = add({ id: Number.MAX_SAFE_INTEGER, clientId: a.id });
  const identityDoc = add({ clientId: collidingClient.id });
  const many = Array.from({ length: 14 }, () => add({ clientId: a.id }));
  const large = add({ clientId: a.id }, Buffer.alloc(2 * 1024 * 1024, 91));
  docs.push(null, [], true, 1, { id: {}, clientId: a.id });
  const save = () => fs.writeFileSync(manifest, JSON.stringify(docs)); save();
  const manifestBytes = fs.readFileSync(manifest), sourceState = async () => ({
    pools: await prisma.pool.findMany({ where: { id: { in: [pool.id, otherPool.id] } }, orderBy: { id: 'asc' } }),
    visits: await prisma.serviceVisit.findMany({ where: { id: { in: [visit.id, noOwnerVisit.id] } }, orderBy: { id: 'asc' } }),
    counts: await Promise.all(['invoice', 'payment', 'monthlyReport', 'userAuditLog'].map(model => prisma[model].count())),
  }), before = await sourceState();
  function refused(result, status) {
    assert.equal(result.status, status, result.bytes.toString()); assert.equal(result.headers.get('cache-control'), 'private, no-store');
    assert.equal(result.headers.get('x-content-type-options'), 'nosniff'); assert(!result.bytes.includes(Buffer.from('QA_DOCUMENT_')));
  }
  for (const [customer, token] of [[a, tokens[0]], [b, tokens[1]], [a, adminToken], [b, adminToken]]) {
    const result = await get(list(customer.id), token); assert.equal(result.status, 200);
    assert.equal(result.headers.get('x-cw-document-type'), 'client-document-list'); assert.equal(result.headers.get('x-cw-client-id'), String(customer.id));
    const rows = JSON.parse(result.bytes).documents;
    assert(rows.every(row => row.url === download(customer.id, row) && row.downloadUrl === row.url));
    assert(rows.every(row => !ambiguous.some(bad => Number(bad.id) === Number(row.id))));
    if (customer.id === a.id) { for (const row of [own, highId, ...many]) assert(rows.some(d => d.id === row.id)); assert(!rows.some(row => Number(row.id) === docs[0].id || row.id === historical.id)); }
    else for (const row of [docs[0], historical, explicitVisit, entityClient, entityVisit, entityPool]) assert(rows.some(d => d.id === row.id));
  }
  assert.deepEqual(JSON.parse((await get(list(empty.id), adminToken)).bytes).documents, []);
  for (const method of ['GET', 'HEAD']) {
    for (const url of [list(a.id), download(a.id, own)]) {
      for (const token of [null, 'invalid', jwt.sign({ id: a.id, role: 'CLIENT' }, getJwtSecret(), { expiresIn: -1 })]) refused(await get(url, token, { method }), 401);
      for (const token of [tokens[1], techToken, leaderToken]) refused(await get(url, token, { method }), 403);
    }
    for (const url of [list(collidingClient.id), download(collidingClient.id, identityDoc)]) refused(await get(url, staffToken, { method }), 403);
    for (const row of ambiguous) for (const [customer, token] of [[a, tokens[0]], [b, tokens[1]], [a, adminToken]]) refused(await get(download(customer.id, row), token, { method }), 404);
    for (const row of [symlink, hardlink, directory, fifo, missing, oversized]) refused(await get(download(a.id, row), tokens[0], { method }), 404);
  }
  for (const token of [tokens[0], adminToken, sign({ role: 'CUSTOMER', id: a.id }), sign({ role: 'CLIENT', clientId: a.id })]) {
    for (const row of [own, emptyFile, highId, large]) {
      const result = await get(download(a.id, row), token);
      assert.equal(result.status, 200); assert.equal(result.headers.get('content-type'), 'application/octet-stream');
      assert.equal(result.headers.get('x-cw-document-type'), 'client-document-file'); assert.equal(result.headers.get('x-cw-client-id'), String(a.id));
      assert.equal(result.headers.get('x-cw-document-id'), String(row.id)); assert.match(result.headers.get('content-disposition'), /^attachment;/);
      assert.equal(result.headers.get('accept-ranges'), 'none'); assert.equal(hash(result.bytes), hash(bytesById.get(row.id)));
      const head = await get(download(a.id, row), token, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(head.bytes.length, 0);
      assert.equal(head.headers.get('content-length'), String(bytesById.get(row.id).length));
    }
  }
  for (const bad of ['0', '-1', '01', '1.0', '1e3', '9007199254740992', 'true']) refused(await get(`${list(a.id)}/${bad}/download`, tokens[0]), 400);
  refused(await get(list('0' + a.id), tokens[0]), 400); refused(await get(list(2147483648), adminToken), 400);
  refused(await get(list(2147483647), adminToken), 404);
  refused(await get(download(a.id, docs[0]) + '?clientId=' + b.id + '&role=ADMIN', tokens[0], { headers: { Range: 'bytes=0-10', 'If-None-Match': '*' } }), 404);
  const ranged = await get(download(a.id, own), tokens[0], { headers: { Range: 'bytes=0-10', 'If-None-Match': '*', 'If-Modified-Since': new Date().toUTCString() } });
  assert.equal(ranged.status, 200); assert.equal(hash(ranged.bytes), hash(bytesById.get(own.id)));
  assert.equal((await get(getUploadsPublicBasePath() + '/documents/' + own.filename, tokens[0])).status, 404);
  console.log('PASS document ownership: historical customer survives pool transfer; conflicts, unresolved references, duplicate IDs/files and cross-table principals refused; canonical IDs and private GET/HEAD; complete lists and exact inert bytes');
  await prisma.pool.update({ where: { id: pool.id }, data: { clientId: b.id } });
  assert.equal((await get(download(b.id, historical), tokens[1])).status, 200); refused(await get(download(a.id, historical), tokens[0]), 404);
  // Restore the deliberately changed QA source, including its update timestamp.
  await prisma.pool.update({ where: { id: pool.id }, data: { clientId: a.id, updatedAt: before.pools.find(row => row.id === pool.id).updatedAt } });
  await prisma.client.update({ where: { id: a.id }, data: { active: false } }); refused(await get(download(a.id, own), tokens[0]), 401);
  await prisma.client.update({ where: { id: a.id }, data: { active: true } }); assert.equal((await get(download(a.id, own), tokens[0])).status, 200);
  for (const malformed of ['{broken', '{}', 'null', '']) {
    fs.writeFileSync(manifest, malformed);
    for (const url of [list(a.id), download(a.id, own)]) refused(await get(url, tokens[0]), 503);
    assert.equal(fs.readFileSync(manifest, 'utf8'), malformed); save(); assert.equal((await get(list(a.id), tokens[0])).status, 200);
  }
  fs.rmSync(manifest); assert.deepEqual(JSON.parse((await get(list(a.id), tokens[0])).bytes).documents, []); refused(await get(download(a.id, own), tokens[0]), 404); save();
  fs.rmSync(manifest); fs.symlinkSync(outside, manifest);
  try { refused(await get(list(a.id), tokens[0]), 503); } finally { fs.rmSync(manifest); save(); }
  const service = require('../src/services/customerPortalService'), business = require('../src/business/portal/ClientDocumentBusiness');
  const originalSources = service.documentOwnershipSources;
  service.documentOwnershipSources = async () => { throw Error('QA database unavailable'); };
  try { await assert.rejects(business.list({ id: a.id, role: 'CLIENT' }, String(a.id)), /QA database unavailable/); }
  finally { service.documentOwnershipSources = originalSources; }
  // An already authorized descriptor stays bound to the original inode when the path is replaced.
  const opened = await business.read({ id: a.id, role: 'CLIENT' }, String(a.id), String(own.id));
  const originalPath = path.join(root, own.filename), movedPath = originalPath + '.moved';
  fs.renameSync(originalPath, movedPath); fs.symlinkSync(outside, originalPath);
  try { assert.equal(hash(await opened.file.readFile()), hash(bytesById.get(own.id))); refused(await get(download(a.id, own), tokens[0]), 404); }
  finally { await opened.file.close(); fs.rmSync(originalPath); fs.renameSync(movedPath, originalPath); }
  const aborted = await fetch(base + download(a.id, large), { headers: { Authorization: 'Bearer ' + tokens[0] } }); await aborted.body.cancel();
  assert.equal((await get(download(a.id, large), tokens[0])).status, 200);
  assert.deepEqual(await sourceState(), before); assert.deepEqual(fs.readFileSync(manifest), manifestBytes);
  for (const row of [own, historical, explicitVisit, emptyFile, highId, large, ...many]) assert.equal(hash(fs.readFileSync(path.join(root, row.filename))), hash(bytesById.get(row.id)));
  assert.equal(fs.readFileSync(outside, 'utf8'), 'QA_DOCUMENT_OUTSIDE_DIRECTORY');
  console.log('PASS document files: traversal, symlinks, hardlinks, directories, FIFO and oversized files refused; descriptor replacement and disconnected download handled; corrupt/missing manifest and read faults recover without rewriting source or financial data');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (original) fs.writeFileSync(manifest, original); else fs.rmSync(manifest, { force: true });
  for (const name of files) fs.rmSync(name, { force: true, recursive: true });
  await prisma.$disconnect();
});
