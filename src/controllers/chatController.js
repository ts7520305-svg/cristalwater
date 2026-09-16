const { prisma } =
  require("../prismaClient");
const { normalizeRole } = require("../utils/roles");
const history = require("../services/clientChatHistoryService");

// ======================================================
// HELPERS
// ======================================================

function toNumber(v){

  const n = Number(v);

  return Number.isNaN(n)
    ? null
    : n;
}

function isClientSender(value) {
  return String(value || "").trim().toLowerCase() === "client" ||
    String(value || "").trim().toLowerCase() === "cliente";
}

const adminUnreadWhere = history.adminUnreadWhere;

function authClientId(req) {
  return toNumber(req.user?.clientId || req.user?.id);
}

function isClientRole(req) {
  return normalizeRole(req.user?.role) === "CLIENT";
}

// ======================================================
// CREATE MESSAGE
// ======================================================

const createMessage = require('./clientMessageWriteController').write();

// ======================================================
// OVERVIEW
// ======================================================

async function listOverview(req, res) {
  try {
    await history.ensure();
    const unreadOnly = String(req.query.unreadOnly || req.query.filter || "").toLowerCase().includes("unread");

    const [clients, latestMessages, unreadGroups] = await Promise.all([
      prisma.client.findMany({
        select: { id: true, name: true, phone: true, email: true, zone: true, status: true, active: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 1000,
      }),
      prisma.clientMessage.findMany({
        select: {
          id: true,
          clientId: true,
          sender: true,
          senderType: true,
          message: true,
          text: true,
          isReadByAdmin: true,
          seen: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      prisma.clientMessage.groupBy({
        by: ["clientId"],
        where: adminUnreadWhere(),
        _count: { _all: true },
      }),
    ]);

    const latestByClient = new Map();
    for (const message of latestMessages) {
      if (!latestByClient.has(message.clientId)) latestByClient.set(message.clientId, message);
    }

    const unreadByClient = new Map(
      unreadGroups.map((row) => [row.clientId, row._count?._all || 0])
    );

    let conversations = clients.map((client) => {
      const latest = latestByClient.get(client.id) || null;
      return {
        ...client,
        unreadCount: unreadByClient.get(client.id) || 0,
        latestMessage: latest ? {
          id: latest.id,
          sender: latest.sender || latest.senderType || "",
          text: latest.message || latest.text || "",
          isReadByAdmin: latest.isReadByAdmin,
          createdAt: latest.createdAt,
        } : null,
      };
    });

    if (unreadOnly) {
      conversations = conversations.filter((client) => client.unreadCount > 0);
    }

    conversations.sort((a, b) => {
      if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
      const at = a.latestMessage?.createdAt ? new Date(a.latestMessage.createdAt).getTime() : 0;
      const bt = b.latestMessage?.createdAt ? new Date(b.latestMessage.createdAt).getTime() : 0;
      return bt - at;
    });

    return res.json({
      ok: true,
      totalUnread: unreadGroups.reduce((sum, row) => sum + (row._count?._all || 0), 0),
      conversations,
    });
  } catch (err) {
    console.error("ERRO CHAT listOverview:", err);
    return res.status(500).json({ ok: false, error: "Não foi possível aceder à conversa. O histórico foi preservado." });
  }
}

// ======================================================
// CLIENT CONVERSATION
// ======================================================

async function listClientConversation(req, res){

  try {

    const clientId =
      toNumber(
        req.params.clientId
      );

    if(!clientId){

      return res.status(400).json({

        ok:false,

        error:
          "clientId inválido"
      });
    }

    if (isClientRole(req)) {
      const scopedClientId = authClientId(req);
      if (!scopedClientId || scopedClientId !== clientId) {
        return res.status(403).json({ ok: false, error: "Acesso negado" });
      }
    }

    await history.ensure();
    const messages =
      await prisma.clientMessage.findMany({

        where: {

          clientId,
        },

        orderBy: {

          createdAt:"asc"
        },
      });

    return res.json({

      ok:true,

      messages,
    });

  } catch(err){

    console.error(
      "ERRO CHAT listClientConversation:",
      err
    );

    return res.status(500).json({

      ok:false,

      error: "Não foi possível aceder à conversa. O histórico foi preservado."
    });
  }
}

// ======================================================
// INTERNAL
// ======================================================

const listInternalConversation = require("./internalChatController").list(true);

// ======================================================
// LIST
// ======================================================

async function listMessages(req, res){

  try {

    await history.ensure();
    const messages =
      await prisma.clientMessage.findMany({

        orderBy: {

          createdAt:"asc"
        },
      });

    return res.json({

      ok:true,

      messages,
    });

  } catch(err){

    console.error(
      "ERRO CHAT listMessages:",
      err
    );

    return res.status(500).json({

      ok:false,

      error: "Não foi possível aceder à conversa. O histórico foi preservado."
    });
  }
}

// ======================================================
// READ
// ======================================================

async function markAsRead(req, res){

  try {
    const clientId = req.body?.clientId ?? req.query?.clientId;
    await require("../business/chat/LegacyClientChatBusiness").markRead(req.user, clientId);
    return res.json({ ok: true });
  } catch (err) {
    console.error("ERRO CHAT markAsRead:", err);
    return res.status(500).json({ ok: false, error: "Não foi possível aceder à conversa. O histórico foi preservado." });
  }
}

// ======================================================
// UNREAD
// ======================================================

async function getUnreadCount(req, res){

  try {
    await history.ensure();
    const unread = await prisma.clientMessage.count({ where: adminUnreadWhere() });
    return res.json({ ok: true, unread });
  } catch (err) {
    console.error("ERRO CHAT getUnreadCount:", err);
    return res.status(500).json({ ok: false, unread: 0 });
  }
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {

  createMessage,

  listOverview,

  listClientConversation,

  listInternalConversation,

  listMessages,

  markAsRead,

  getUnreadCount,
};
