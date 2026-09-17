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
async function record(actor, visitId, file, body, kind = 'REGULAR') {
  const extra = kind === 'EXTRA';
  const poolId = extra ? Number(body.poolId) : null;
  if (extra && (!Number.isSafeInteger(poolId) || poolId <= 0)) requests.fail('Piscina da fotografia inválida.');
  if (!file || !categories.includes(body.type) || Object.keys(body).some(key => ![...['requestId', 'type'], ...(extra ? ['poolId'] : [])].includes(key))) requests.fail('Fotografia ou categoria inválida.');
  const bytes = await fs.readFile(file.path), ext = extension(bytes);
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) requests.fail('Fotografia inválida; limite de 25 MB.');
  const sha256 = createHash('sha256').update(bytes).digest('hex'), id = Number(visitId);
  const request = requests.context(actor, extra ? 'EXTRA_VISIT_PHOTO' : 'VISIT_PHOTO', id, body.requestId, { type: body.type, sha256, size: bytes.length, ...(extra ? {poolId} : {}) });
  return prisma.$transaction(async tx => {
    const saved = await requests.recover(tx, request); if (saved) return saved;
    if (extra) await tx.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${id} FOR UPDATE`;
    else await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${id} FOR UPDATE`;
    const visit = await tx[extra ? 'extraVisit' : 'serviceVisit'].findUnique({ where: { id } });
    requests.authorize(actor, visit);
    if (extra && (visit.poolId !== poolId || visit.endAt || !['PLANNED','PENDING','SCHEDULED','ASSIGNED','ON_ROUTE','A_CAMINHO','IN_PROGRESS','STARTED'].includes(visit.status))) requests.fail('A visita extra mudou ou já foi concluída. Conserve a fotografia e peça revisão.',409);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`photo:${kind}:${id}:${body.type}:${sha256}`}))::text`;
    const prefix = `${extra ? 'extra-visit' : 'visit'}-${id}-${body.type}-${sha256}`;
    const model = tx[extra ? 'extraVisitPhoto' : 'visitPhoto'], foreignKey = extra ? 'extraVisitId' : 'visitId';
    let photo = await model.findFirst({ where: { [foreignKey]: id, type: body.type, url: { startsWith: toPublicUploadUrl(prefix) } } });
    const filename = photo ? path.basename(photo.url) : prefix + ext, target = path.join(resolveUploadBaseDir(), filename);
    try { const current = await fs.readFile(target); if (createHash('sha256').update(current).digest('hex') !== sha256) requests.fail('O ficheiro existente precisa de revisão. Os dados foram preservados.', 409, 'FIELD_PHOTO_STORAGE_CONFLICT'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await fs.copyFile(file.path, target, require('node:fs').constants.COPYFILE_EXCL); }
    if (!photo) {
      photo = await model.create({ data: { [foreignKey]: id, type: body.type, url: toPublicUploadUrl(filename) } });
      await tx.auditTrail.create({ data: { eventType: extra ? 'EXTRA_VISIT_PHOTO_UPLOADED' : 'VISIT_PHOTO_UPLOADED', entity: extra ? 'ExtraVisitPhoto' : 'VisitPhoto', entityId: photo.id, ...(extra ? {} : {visitId:id}), poolId: visit.poolId, clientId: visit.clientId, action: 'VISIT_PHOTO_UPLOAD', message: `Fotografia registada para a visita #${id}.`, metadata: { owner: request.owner, requestId: request.requestId, type: body.type, sha256, ...(extra ? {extraVisitId:id} : {}) } } });
    }
    return requests.confirm(tx, request, { ok: true, photo, sha256, size: bytes.length });
  }, { maxWait: 15000, timeout: 20000 });
}
async function cleanTemporary(file) {
  if (!file?.path || path.dirname(path.resolve(file.path)) !== path.resolve(resolveUploadBaseDir()) || !/^[0-9a-f-]{36}-/.test(path.basename(file.path))) return;
  await fs.unlink(file.path).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
async function protectExtraUploads(req, res, next) {
  let pathname; try { pathname = decodeURIComponent(req.path); } catch (_) { return res.status(400).end(); }
  if (!/(^|\/)extra-visit-/.test(pathname)) return next();
  res.set('Cache-Control','private, no-store');
  return require('../middlewares/authMiddleware')('TECHNICIAN')(req,res,async () => {
    try {
      if (pathname !== '/' + path.basename(pathname)) return res.status(404).end();
      const photo = await prisma.extraVisitPhoto.findFirst({where:{url:toPublicUploadUrl(path.basename(pathname))},include:{extraVisit:true}});
      if (!photo) return res.status(404).end();
      requests.authorize(req.user,photo.extraVisit);
      next();
    } catch (error) { return res.status(error.statusCode || 503).json({ok:false,error:'Fotografia indisponível para esta sessão.'}); }
  });
}
module.exports = { record, cleanTemporary, protectExtraUploads };
