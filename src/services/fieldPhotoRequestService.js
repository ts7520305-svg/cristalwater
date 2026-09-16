'use strict';
const fs = require('node:fs/promises'), path = require('node:path');
const { createHash } = require('node:crypto');
const { prisma } = require('../prismaClient');
const { resolveUploadBaseDir, toPublicUploadUrl } = require('../config/uploadPath');
const requests = require('./fieldWriteRequestService');
const categories = ['BEFORE', 'AFTER', 'PROBLEM', 'ACCESS', 'GENERAL'];
function extension(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return '.png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return '.jpg';
  if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString())) return '.gif';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return '.webp';
  if (bytes.subarray(4, 8).toString() === 'ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1|avif|avis)$/.test(bytes.subarray(8, 12).toString())) return /^avi/.test(bytes.subarray(8, 12).toString()) ? '.avif' : '.heic';
  requests.fail('Escolha uma fotografia PNG, JPEG, GIF, WebP, HEIF ou AVIF válida.');
}
async function record(actor, visitId, file, body) {
  if (!file || !categories.includes(body.type) || Object.keys(body).some(key => !['requestId', 'type'].includes(key))) requests.fail('Fotografia ou categoria inválida.');
  const bytes = await fs.readFile(file.path), ext = extension(bytes);
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) requests.fail('Fotografia inválida; limite de 25 MB.');
  const sha256 = createHash('sha256').update(bytes).digest('hex'), id = Number(visitId);
  const request = requests.context(actor, 'VISIT_PHOTO', id, body.requestId, { type: body.type, sha256, size: bytes.length });
  return prisma.$transaction(async tx => {
    const saved = await requests.recover(tx, request); if (saved) return saved;
    await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${id} FOR UPDATE`;
    const visit = await tx.serviceVisit.findUnique({ where: { id }, select: { id: true, technicianId: true, poolId: true, clientId: true } });
    requests.authorize(actor, visit);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`photo:${id}:${body.type}:${sha256}`}))::text`;
    const prefix = `visit-${id}-${body.type}-${sha256}`;
    let photo = await tx.visitPhoto.findFirst({ where: { visitId: id, type: body.type, url: { startsWith: toPublicUploadUrl(prefix) } } });
    const filename = photo ? path.basename(photo.url) : prefix + ext, target = path.join(resolveUploadBaseDir(), filename);
    try { const current = await fs.readFile(target); if (createHash('sha256').update(current).digest('hex') !== sha256) requests.fail('O ficheiro existente precisa de revisão. Os dados foram preservados.', 409, 'FIELD_PHOTO_STORAGE_CONFLICT'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await fs.copyFile(file.path, target, require('node:fs').constants.COPYFILE_EXCL); }
    if (!photo) {
      photo = await tx.visitPhoto.create({ data: { visitId: id, type: body.type, url: toPublicUploadUrl(filename) } });
      await tx.auditTrail.create({ data: { eventType: 'VISIT_PHOTO_UPLOADED', entity: 'VisitPhoto', entityId: photo.id, visitId: id, poolId: visit.poolId, clientId: visit.clientId, action: 'VISIT_PHOTO_UPLOAD', message: `Fotografia registada para a visita #${id}.`, metadata: { owner: request.owner, requestId: request.requestId, type: body.type, sha256 } } });
    }
    return requests.confirm(tx, request, { ok: true, photo, sha256, size: bytes.length });
  }, { maxWait: 15000, timeout: 20000 });
}
async function cleanTemporary(file) {
  if (!file?.path || path.dirname(path.resolve(file.path)) !== path.resolve(resolveUploadBaseDir()) || !/^[0-9a-f-]{36}-/.test(path.basename(file.path))) return;
  await fs.unlink(file.path).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
module.exports = { record, cleanTemporary };
