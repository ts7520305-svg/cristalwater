const express = require("express");
const multer = require("multer");
const path = require("path");
const { prisma } = require("../prismaClient");
const { resolveUploadSubdir, toPublicUploadUrl } = require("../config/uploadPath");
const history = require('../services/clientChatHistoryService');

const router = express.Router();
router.use(require('../middlewares/authMiddleware')('CLIENT'));
const {normalizeRole} = require('../utils/roles');
function canMessage(req,res,clientId) {
  const role=normalizeRole(req.user.role);
  if (role==='ADMIN' || (role==='CLIENT' && Number(clientId)===Number(req.user.clientId||req.user.id))) return true;
  if(req.file?.path) require('fs').unlinkSync(req.file.path);
  res.status(403).json({ok:false,error:'Sem permissão para aceder a esta conversa.'});return false;
}


const uploadDir = resolveUploadSubdir('documents/client-chat');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || "anexo").replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${require('node:crypto').randomUUID()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

function n(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

router.get('/attachments/:messageId', require('../services/clientChatAttachmentService').download);

router.get("/:clientId", async (req, res) => {
  try {
    const clientId = n(req.params.clientId);
    if(!canMessage(req,res,clientId))return;
    if (!clientId) return res.status(400).json({ ok: false, error: "clientId invalido" });
    await history.ensure();
    const messages = await prisma.clientMessage.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ ok: true, messages });
  } catch (err) {
    console.error("client-messages list error:", err);
    return res.status(err.statusCode || 500).json({ ok: false, error: err.statusCode ? err.message : 'Não foi possível aceder à conversa. O histórico foi preservado.' });
  }
});

router.post("/", require('../controllers/clientMessageWriteController').write());

async function removeUnreferenced(file, url) {
  if (!file?.path) return;
  // A failed commit acknowledgement may still have committed. Never remove an
  // upload without first establishing that no message references it.
  try { if (!await prisma.clientMessage.count({ where: { fileUrl: url } })) require('fs').rmSync(file.path, { force: true }); }
  catch (error) { console.error('Preserving upload until reference can be checked:', error.message); }
}
router.post("/upload", upload.single("file"), async (req, res) => {
  const fileUrl = req.file ? toPublicUploadUrl('documents', 'client-chat', req.file.filename) : null;
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Anexo obrigatório.' });
    const name = req.body.fileName === undefined ? req.file.originalname : req.body.fileName;
    if (typeof name !== 'string' || !name || name.length > 255 || /[\x00-\x1f/\\]/.test(name)) throw Object.assign(new Error('Nome do anexo inválido.'), { statusCode: 400 });
    const ext = path.extname(name).toLowerCase();
    const type = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? 'IMAGE' : ext === '.pdf' ? 'PDF' : 'FILE';
    const business = require('../business/chat/ClientMessageBusiness');
    const result = await business.create(req.user, req.body.clientId, req.body, { path: req.file.path, url: fileUrl, name, type });
    if (result.message.fileUrl !== fileUrl) await removeUnreferenced(req.file, fileUrl);
    business.emit(result);
    return res.json({ ...result, type: result.message.messageType });
  } catch (error) {
    await removeUnreferenced(req.file, fileUrl);
    return res.status(error.statusCode || 500).json({ ok: false, error: error.statusCode ? error.message : 'Envio não confirmado. Conserve o anexo e repita o mesmo pedido.' });
  }
});

router.post("/seen/:clientId", async (req, res) => {
  try {
    const clientId = n(req.params.clientId);
    if(!canMessage(req,res,clientId))return;
    if (!clientId) return res.status(400).json({ ok: false, error: "clientId invalido" });
    return res.json(await require('../business/chat/LegacyClientChatBusiness').markRead(req.user, req.params.clientId));
  } catch (err) {
    console.error("client-messages seen error:", err);
    return res.status(err.statusCode || 500).json({ ok: false, error: err.statusCode ? err.message : 'Não foi possível confirmar a leitura.' });
  }
});

router.get("/unread/:clientId", async (req, res) => {
  try {
    const clientId = n(req.params.clientId);
    if(!canMessage(req,res,clientId))return;
    if (!clientId) return res.status(400).json({ ok: false, unread: 0, error: "clientId invalido" });
    await history.ensure();
    const unread = await prisma.clientMessage.count({ where: history.adminUnreadWhere(clientId) });
    return res.json({ ok: true, unread });
  } catch (err) {
    console.error("client-messages unread error:", err);
    return res.status(err.statusCode || 500).json({ ok: false, error: err.statusCode ? err.message : 'Não foi possível consultar as mensagens por ler.' });
  }
});

module.exports = router;
