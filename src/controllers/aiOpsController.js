const jwt = require("jsonwebtoken");
const aiOps = require("../services/aiOpsService");
const { getJwtSecret } = require("../utils/jwtSecret");

const JWT_SECRET = getJwtSecret();

function requireAdmin(req, res, next) {
  const adminToken = req.headers["x-admin-token"] || req.headers["x-cristal-admin-token"];
  const configuredToken = process.env.ADMIN_TOKEN;

  if (configuredToken && adminToken && adminToken === configuredToken) {
    req.admin = { method: "admin-token" };
    return next();
  }

  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (bearer) {
    try {
      const decoded = jwt.verify(bearer, JWT_SECRET);
      if (String(decoded.role || "").toUpperCase() === "ADMIN") {
        req.auth = decoded;
        return next();
      }
    } catch (err) {
      // continua para resposta uniforme
    }
  }

  return res.status(403).json({ ok: false, error: "Acesso reservado a administradores." });
}

async function getContext(req, res, next) {
  try {
    const data = await aiOps.buildOperationalSnapshot();
    res.json({ ok: true, ...data });
  } catch (err) {
    next(err);
  }
}

async function postChat(req, res, next) {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ ok: false, error: "Mensagem obrigatória." });
    const result = await aiOps.handleChat({ req, message, conversationId: req.body?.conversationId });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getConversations(req, res, next) {
  try {
    const conversations = await aiOps.listConversations();
    res.json({ ok: true, conversations });
  } catch (err) {
    next(err);
  }
}

async function getActions(req, res, next) {
  try {
    const actions = await aiOps.listActions({ status: req.query.status });
    res.json({ ok: true, actions });
  } catch (err) {
    next(err);
  }
}

async function approveAction(req, res, next) {
  try {
    const action = await aiOps.approveAction({ actionId: req.params.id, approvedByUserId: req.auth?.id || null });
    res.json({ ok: true, action });
  } catch (err) {
    next(err);
  }
}

async function rejectAction(req, res, next) {
  try {
    const action = await aiOps.rejectAction({ actionId: req.params.id, rejectedByUserId: req.auth?.id || null, reason: req.body?.reason });
    res.json({ ok: true, action });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requireAdmin,
  getContext,
  postChat,
  getConversations,
  getActions,
  approveAction,
  rejectAction
};
