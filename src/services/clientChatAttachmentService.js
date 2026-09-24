'use strict';
const fs = require('node:fs/promises'), path = require('node:path');
const { prisma } = require('../prismaClient');
const { resolveUploadBaseDir, getUploadsPublicBasePath, toPublicUploadUrl } = require('../config/uploadPath');
const { normalizeRole } = require('../utils/roles');
const auth = require('../middlewares/authMiddleware')('CLIENT');
const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
function contentType(filename) {
  return ({ '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' })[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}
function referencePath(value) {
  const prefix = getUploadsPublicBasePath() + '/';
  if (typeof value !== 'string' || !value.startsWith(prefix)) return null;
  let relative; try { relative = decodeURIComponent(value.slice(prefix.length)); } catch { return null; }
  if (!relative || /[\\\0?#]/.test(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) return null;
  return relative;
}
async function physical(relative) {
  const root = await fs.realpath(resolveUploadBaseDir());
  const candidate = path.resolve(root, relative);
  if (!candidate.startsWith(root + path.sep)) fail(404, 'Anexo não encontrado.');
  let target;
  try { target = await fs.realpath(candidate); } catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') fail(404, 'Anexo não encontrado.'); throw error; }
  if (!target.startsWith(root + path.sep) || !(await fs.stat(target)).isFile()) fail(404, 'Anexo não encontrado.');
  return { target, relative: path.relative(root, target).split(path.sep).join('/') };
}
async function references(relative) {
  const url = toPublicUploadUrl(relative), encoded = toPublicUploadUrl(relative.split('/').map(encodeURIComponent).join('/'));
  return prisma.clientMessage.findMany({ where: { legacyKey: null, OR: ['fileUrl', 'message', 'text'].map(key => ({ [key]: { in: [...new Set([url, encoded])] } })) }, select: { id: true, clientId: true } });
}
function allowed(user, rows) {
  if (normalizeRole(user?.role) === 'ADMIN') return true;
  return normalizeRole(user?.role) === 'CLIENT' && rows.length > 0 && rows.every(row => row.clientId === Number(user.clientId || user.id));
}
function respondError(res, error) {
  return res.status(error.statusCode || 503).json({ ok: false, error: error.statusCode ? error.message : 'Não foi possível verificar o acesso ao anexo.' });
}
async function protectLegacyUploads(req, res, next) {
  try {
    let decoded; try { decoded = decodeURIComponent(req.path); } catch { return res.status(400).end(); }
    if (/[\\\0]/.test(decoded)) return res.status(400).end();
    const relative = path.posix.normalize('/' + decoded).slice(1);
    if (relative === 'documents' || relative.startsWith('documents/')) return res.status(404).end();
    let file; try { file = await physical(relative); } catch (error) { if (error.statusCode === 404) return res.status(404).end(); throw error; }
    if (file.relative.startsWith('documents/')) return res.status(404).end();
    const rows = await references(file.relative);
    if (!rows.length) return next();
    res.set('Cache-Control', 'private, no-store');
    return auth(req, res, () => {
      if (!allowed(req.user, rows)) return res.status(404).json({ ok: false, error: 'Anexo não encontrado.' });
      res.attachment(path.basename(file.target)); res.type(contentType(file.target)); next();
    });
  } catch (error) { return respondError(res, error); }
}
async function download(req, res) {
  try {
    res.set('Cache-Control', 'private, no-store');
    const rawId = req.params.messageId, id = Number(rawId);
    if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(id) || id > 2147483647) fail(400, 'Anexo inválido.');
    const message = await prisma.clientMessage.findUnique({ where: { id } });
    if (!message || message.legacyKey || !allowed(req.user, [message])) fail(404, 'Anexo não encontrado.');
    const relative = referencePath(message.fileUrl) || referencePath(message.message) || referencePath(message.text);
    if (!relative) fail(404, 'Anexo não encontrado.');
    const file = await physical(relative), rows = await references(file.relative);
    if (!allowed(req.user, rows)) fail(404, 'Anexo não encontrado.');
    res.type(contentType(file.target)); res.set('X-Content-Type-Options', 'nosniff');
    res.set({ 'X-CW-Document-Type': 'chat-attachment', 'X-CW-Message-Id': String(id) });
    return res.download(file.target, path.basename(message.fileName || file.target), { cacheControl: false }, error => { if (error && !res.headersSent) respondError(res, Object.assign(error, { statusCode: 404 })); });
  } catch (error) { return respondError(res, error); }
}
module.exports = { protectLegacyUploads, download };
