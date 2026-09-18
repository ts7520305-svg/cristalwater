'use strict';
const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const sharp = require('sharp');
const { resolveUploadBaseDir, getUploadsPublicBasePath } = require('../config/uploadPath');
const { translator } = require('./visitReportLanguage');
const MAX_PHOTOS = 24, MAX_FILE = 25 * 1024 * 1024, MAX_TOTAL = 64 * 1024 * 1024;
const labels = { BEFORE: 'Antes', AFTER: 'Depois', PROBLEM: 'Problema', ACCESS: 'Acesso', GENERAL: 'Geral' };
const unavailable = 'Fotografia indisponível. Peça a revisão do registo.';
const limited = 'Fotografia não incluída por exceder os limites do relatório.';

function raster(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return true;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return true;
  if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString())) return true;
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return true;
  return bytes.subarray(4, 8).toString() === 'ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1|avif|avis)$/.test(bytes.subarray(8, 12).toString());
}

// Called only after report access, historical ownership and visibility are established.
// Never fetch a URL or follow a path supplied by a photo record.
async function prepare(report) {
  if (report.view !== 'admin' && !report.setting.showPhotos) return [];
  const t = translator(report.language);
  const result = [], root = resolveUploadBaseDir(), started = Date.now();
  let total = 0;
  const records = report.visit.photos || [], extra = report.visitType === 'EXTRA';
  for (const [index, photo] of records.slice(0, MAX_PHOTOS).entries()) {
    const entry = { id: photo.id, label: `${t('Fotografia')} ${index + 1} - ${t(labels[photo.type] || 'Registo')}`, message: t(unavailable) };
    result.push(entry);
    if (Date.now() - started > 10000) { entry.message = t(limited); continue; }
    const prefix = getUploadsPublicBasePath() + '/';
    if (photo[extra ? 'extraVisitId' : 'visitId'] !== report.visit.id || typeof photo.url !== 'string' || !photo.url.startsWith(prefix)) continue;
    const filename = photo.url.slice(prefix.length);
    const match = /^(extra-)?visit-([1-9]\d*)-(BEFORE|AFTER|PROBLEM|ACCESS|GENERAL)-([a-f0-9]{64})\.([a-zA-Z]{3,4})$/.exec(filename);
    if (!match || Boolean(match[1]) !== extra) continue;
    match.splice(1, 1);
    if (!match || !['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'avif'].includes(match[4].toLowerCase()) || Number(match[1]) !== report.visit.id || match[2] !== photo.type) continue;
    let file;
    try {
      const target = path.join(root, filename);
      if ((await fs.promises.lstat(target)).isSymbolicLink()) continue;
      file = await fs.promises.open(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
      const stat = await file.stat();
      if (!stat.isFile() || !stat.size) continue;
      if (stat.size > MAX_FILE || total + stat.size > MAX_TOTAL) { entry.message = t(limited); continue; }
      total += stat.size;
      // A bounded read also refuses a file replaced or enlarged after stat().
      const buffer = Buffer.alloc(stat.size + 1); let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, length);
        if (!bytesRead) break;
        length += bytesRead;
      }
      await file.close(); file = null;
      if (length !== stat.size) continue;
      const bytes = buffer.subarray(0, length);
      if (createHash('sha256').update(bytes).digest('hex') !== match[3] || !raster(bytes)) continue;
      const pipeline = sharp(bytes, { failOn: 'warning', limitInputPixels: 48000000, animated: false, pages: 1 }).timeout({ seconds: 3 });
      const metadata = await pipeline.metadata();
      if (!['jpeg', 'png', 'webp', 'gif', 'heif'].includes(metadata.format)) continue;
      // Decode before passing anything to PDFKit, normalize orientation, omit EXIF/GPS.
      const { data, info } = await pipeline.autoOrient().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
      Object.assign(entry, { bytes: data, width: info.width, height: info.height, message: null });
      if (metadata.pages > 1) entry.label += t(' (primeiro fotograma)');
    } catch (_) { /* A missing, unsupported or damaged image must not break the report. */ }
    finally { if (file) await file.close().catch(() => {}); }
  }
  const count = report.visit._count?.photos ?? records.length;
  if (count > MAX_PHOTOS) result.push({ label: t('Outras fotografias'), message: t('{count} fotografia(s) não incluída(s). Limite de {limit} por relatório; consulte o registo da visita.', { count: count - MAX_PHOTOS, limit: MAX_PHOTOS }) });
  return result;
}
module.exports = { prepare };
