const { prisma } =
  require("../prismaClient");

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

function adminUnreadWhere(clientId = null) {
  return {
    ...(clientId ? { clientId } : {}),
    isReadByAdmin: false,
    OR: [
      { senderType: "CLIENT" },
      { sender: "Cliente" },
    ],
  };
}

// ======================================================
// CREATE MESSAGE
// ======================================================

async function createMessage(req, res){

  try {

    const clientId =
      toNumber(req.body.clientId);

    const text =
      req.body.text
        ? String(req.body.text).trim()
        : null;

    const sender =
      String(
        req.body.sender || "admin"
      );

    const fromClient =
      isClientSender(sender);

    if(!clientId){

      return res.status(400).json({

        ok:false,

        error:
          "clientId obrigatório"
      });
    }

    if(!text){

      return res.status(400).json({

        ok:false,

        error:
          "Mensagem vazia"
      });
    }

    // ==================================================
    // NOME
    // ==================================================

    let senderName =
      "Administração Cristal Water";

    if(fromClient){

      senderName =
        "Cliente";
    }

    // ==================================================
    // CREATE
    // ==================================================

    const message =
      await prisma.clientMessage.create({

        data: {

          clientId,

          sender: senderName,

          message: text,

          text,

          senderType: fromClient ? "CLIENT" : "ADMIN",

          isReadByAdmin: !fromClient,

          seen: !fromClient,
        },
      });

    console.log(
      "CHAT MESSAGE:",
      message
    );

    return res.json({

      ok:true,

      message,
    });

  } catch(err){

    console.error(
      "ERRO CHAT createMessage:",
      err
    );

    return res.status(500).json({

      ok:false,

      error: err.message
    });
  }
}

// ======================================================
// OVERVIEW
// ======================================================

async function listOverview(req, res) {
  try {
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
    return res.status(500).json({ ok: false, error: err.message });
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

      error: err.message
    });
  }
}

// ======================================================
// INTERNAL
// ======================================================

async function listInternalConversation(req, res){

  return res.json({

    ok:true,

    messages:[]
  });
}

// ======================================================
// LIST
// ======================================================

async function listMessages(req, res){

  try {

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

      error: err.message
    });
  }
}

// ======================================================
// READ
// ======================================================

async function markAsRead(req, res){

  try {
    const clientId = toNumber(req.body?.clientId || req.query?.clientId);
    await prisma.clientMessage.updateMany({
      where: adminUnreadWhere(clientId),
      data: { isReadByAdmin: true, seen: true, seenAt: new Date() },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("ERRO CHAT markAsRead:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ======================================================
// UNREAD
// ======================================================

async function getUnreadCount(req, res){

  try {
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
