const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { prisma } = require("../prismaClient");

const router = express.Router();

const uploadDir = path.join(__dirname, "../../uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || "anexo").replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
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

function isClientSender(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "cliente" || normalized === "client";
}

function messagePayload({ clientId, sender, message }) {
  const rawSender = String(sender || "Cliente").trim();
  const fromClient = isClientSender(rawSender);
  return {
    clientId: n(clientId),
    sender: fromClient ? "Cliente" : (rawSender || "Administracao Cristal Water"),
    senderType: fromClient ? "CLIENT" : "ADMIN",
    message,
    text: message,
    isReadByAdmin: !fromClient,
    seen: !fromClient,
    seenAt: fromClient ? null : new Date(),
  };
}

function emitClientMessage(clientId, message) {
  if (!global.io || !clientId) return;
  global.io.to(`client_${clientId}`).emit("newMessage", message);
  if (message.senderType === "CLIENT") {
    global.io.emit("new-notification", {
      id: `chat-${clientId}`,
      clientId,
      type: "CHAT_MESSAGE",
      message: message.message || "Nova mensagem de cliente",
      createdAt: message.createdAt,
    });
  }
}

router.get("/:clientId", async (req, res) => {
  try {
    const clientId = n(req.params.clientId);
    if (!clientId) return res.status(400).json({ ok: false, error: "clientId invalido" });
    const messages = await prisma.clientMessage.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ ok: true, messages });
  } catch (err) {
    console.error("client-messages list error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = messagePayload({
      clientId: req.body.clientId,
      sender: req.body.sender,
      message: req.body.message || req.body.text,
    });

    if (!payload.clientId || !payload.message) {
      return res.status(400).json({ ok: false, error: "Dados invalidos" });
    }

    const message = await prisma.clientMessage.create({ data: payload });
    emitClientMessage(payload.clientId, message);
    return res.json({ ok: true, message });
  } catch (err) {
    console.error("client-messages create error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.body.clientId || !req.file) {
      return res.status(400).json({ ok: false, error: "Dados invalidos" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const ext = path.extname(req.file.originalname || "").toLowerCase();
    const type = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)
      ? "IMAGE"
      : ext === ".pdf"
        ? "PDF"
        : "FILE";

    const payload = messagePayload({
      clientId: req.body.clientId,
      sender: req.body.sender,
      message: fileUrl,
    });
    payload.messageType = type;
    payload.fileUrl = fileUrl;
    payload.fileName = req.file.originalname || req.file.filename;

    const message = await prisma.clientMessage.create({ data: payload });
    emitClientMessage(payload.clientId, message);
    return res.json({ ok: true, type, message });
  } catch (err) {
    console.error("client-messages upload error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/seen/:clientId", async (req, res) => {
  try {
    const clientId = n(req.params.clientId);
    if (!clientId) return res.status(400).json({ ok: false, error: "clientId invalido" });
    const actor = String(req.query.actor || req.body?.actor || "admin").toLowerCase();

    if (actor === "client" || actor === "cliente") {
      await prisma.clientMessage.updateMany({
        where: {
          clientId,
          seen: false,
          OR: [
            { senderType: "ADMIN" },
            { sender: { not: "Cliente" } },
          ],
        },
        data: { seen: true, seenAt: new Date() },
      });
      return res.json({ ok: true, actor: "client" });
    }

    await prisma.clientMessage.updateMany({
      where: {
        clientId,
        isReadByAdmin: false,
        OR: [{ senderType: "CLIENT" }, { sender: "Cliente" }],
      },
      data: { isReadByAdmin: true, seen: true, seenAt: new Date() },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("client-messages seen error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/unread/:clientId", async (req, res) => {
  try {
    const clientId = n(req.params.clientId);
    if (!clientId) return res.status(400).json({ ok: false, unread: 0, error: "clientId invalido" });
    const unread = await prisma.clientMessage.count({
      where: {
        clientId,
        isReadByAdmin: false,
        OR: [{ senderType: "CLIENT" }, { sender: "Cliente" }],
      },
    });
    return res.json({ ok: true, unread });
  } catch (err) {
    console.error("client-messages unread error:", err);
    return res.status(500).json({ ok: false, unread: 0, error: err.message });
  }
});

module.exports = router;
