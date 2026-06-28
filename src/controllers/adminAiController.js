const service = require("../services/adminAiService");

async function status(req, res) {
  try {
    res.json(await service.getStatus());
  } catch (err) {
    console.error("ADMIN_AI_STATUS_ERROR", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function context(req, res) {
  try {
    const data = await service.collectOperationalContext();
    res.json({ ok: true, context: data });
  } catch (err) {
    console.error("ADMIN_AI_CONTEXT_ERROR", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function recommendations(req, res) {
  try {
    const contextData = await service.collectOperationalContext();
    const items = service.buildLocalRecommendations(contextData);
    res.json({ ok: true, recommendations: items, context: contextData });
  } catch (err) {
    console.error("ADMIN_AI_RECOMMENDATIONS_ERROR", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function chat(req, res) {
  try {
    const result = await service.chat({
      message: req.body?.message,
      conversationId: req.body?.conversationId,
      reqUser: req.user || req.auth,
    });
    res.json(result);
  } catch (err) {
    console.error("ADMIN_AI_CHAT_ERROR", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function listConversations(req, res) {
  try {
    const conversations = await service.listConversations();
    res.json({ ok: true, conversations });
  } catch (err) {
    console.error("ADMIN_AI_LIST_CONVERSATIONS_ERROR", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getConversation(req, res) {
  try {
    const conversation = await service.getConversation(req.params.id);
    if (!conversation) return res.status(404).json({ ok: false, error: "Conversa não encontrada" });
    res.json({ ok: true, conversation });
  } catch (err) {
    console.error("ADMIN_AI_GET_CONVERSATION_ERROR", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function listActions(req, res) {
  try {
    const actions = await service.listActions(req.query.status);
    res.json({ ok: true, actions });
  } catch (err) {
    console.error("ADMIN_AI_LIST_ACTIONS_ERROR", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function createAction(req, res) {
  try {
    const action = await service.createManualAction({ body: req.body || {}, reqUser: req.user || req.auth });
    res.json({ ok: true, action });
  } catch (err) {
    console.error("ADMIN_AI_CREATE_ACTION_ERROR", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function approveAction(req, res) {
  try {
    const action = await service.approveAction({ id: req.params.id, reqUser: req.user || req.auth });
    res.json({ ok: true, action });
  } catch (err) {
    console.error("ADMIN_AI_APPROVE_ACTION_ERROR", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function rejectAction(req, res) {
  try {
    const action = await service.rejectAction({ id: req.params.id, reqUser: req.user || req.auth, reason: req.body?.reason });
    res.json({ ok: true, action });
  } catch (err) {
    console.error("ADMIN_AI_REJECT_ACTION_ERROR", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function executeAction(req, res) {
  try {
    const result = await service.executeApprovedAction({ id: req.params.id, reqUser: req.user || req.auth });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("ADMIN_AI_EXECUTE_ACTION_ERROR", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  status,
  context,
  recommendations,
  chat,
  listConversations,
  getConversation,
  listActions,
  createAction,
  approveAction,
  rejectAction,
  executeAction,
};
