const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();
const baseDir = path.join(__dirname, '../../uploads/documents');
const manifestPath = path.join(baseDir, 'manifest.json');
fs.mkdirSync(baseDir, { recursive: true });
function readManifest(){ try { return JSON.parse(fs.readFileSync(manifestPath,'utf8')); } catch { return []; } }
function writeManifest(rows){ fs.writeFileSync(manifestPath, JSON.stringify(rows, null, 2)); }
const storage = multer.diskStorage({ destination: baseDir, filename: (req, file, cb) => cb(null, `${Date.now()}_${String(file.originalname||'file').replace(/[^a-zA-Z0-9_.-]/g,'_')}`) });
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/', (req, res) => {
  let rows = readManifest();
  const { clientId, poolId, visitId, entity, entityId } = req.query;
  if (clientId) rows = rows.filter(x => String(x.clientId||'') === String(clientId));
  if (poolId) rows = rows.filter(x => String(x.poolId||'') === String(poolId));
  if (visitId) rows = rows.filter(x => String(x.visitId||'') === String(visitId));
  if (entity) rows = rows.filter(x => String(x.entity||'') === String(entity));
  if (entityId) rows = rows.filter(x => String(x.entityId||'') === String(entityId));
  res.json({ ok: true, documents: rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))) });
});

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'Ficheiro obrigatório.' });
  const rows = readManifest();
  const doc = {
    id: Date.now(),
    entity: req.body.entity || null,
    entityId: req.body.entityId || null,
    clientId: req.body.clientId || null,
    poolId: req.body.poolId || null,
    visitId: req.body.visitId || null,
    alertId: req.body.alertId || null,
    repairId: req.body.repairId || null,
    title: req.body.title || req.file.originalname,
    type: req.body.type || req.file.mimetype,
    originalName: req.file.originalname,
    filename: req.file.filename,
    url: `/uploads/documents/${req.file.filename}`,
    notes: req.body.notes || null,
    createdAt: new Date().toISOString()
  };
  rows.push(doc); writeManifest(rows);
  res.status(201).json({ ok: true, document: doc });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const rows = readManifest();
  const doc = rows.find(x => Number(x.id) === id);
  if (!doc) return res.status(404).json({ ok: false, error: 'Documento não encontrado.' });
  writeManifest(rows.filter(x => Number(x.id) !== id));
  try { fs.unlinkSync(path.join(baseDir, doc.filename)); } catch {}
  res.json({ ok: true, deleted: true });
});

module.exports = router;
