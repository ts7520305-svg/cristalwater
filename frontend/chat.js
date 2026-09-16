(() => {
  const API = "/api";
  function authHeaders(extra = {}) {
    const token = localStorage.getItem("token") || localStorage.getItem("cristalwater_jwt");
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const unreadFilter = ["unread", "por-ler", "nao-lidas"].includes(
    String(params.get("filter") || "").toLowerCase()
  );
  const explicitClientId = Number(params.get("clientId") || 0) || null;
  const ADMIN_PRESENCE_KEY = "cw-admin-chat-presence-active";

  const state = {
    conversations: [],
    activeClientId: explicitClientId,
    messages: [],
    totalUnread: 0,
    adminPresenceActive: localStorage.getItem(ADMIN_PRESENCE_KEY) === "true",
    typingTimeout: null,
  };

  const socket = window.io ? window.io() : null;

  const els = {
    clientList: document.querySelector("#clientList"),
    messages: document.querySelector("#messages"),
    search: document.querySelector("#conversationSearch"),
    text: document.querySelector("#text"),
    sendBtn: document.querySelector("#sendBtn"),
    fileBtn: document.querySelector("#fileBtn"),
    fileInput: document.querySelector("#fileInput"),
    chatClientName: document.querySelector("#chatClientName"),
    clientStatusText: document.querySelector("#clientStatusText"),
    clientStatusDot: document.querySelector("#clientStatusDot"),
    priorityBadge: document.querySelector("#priorityBadge"),
    adminPresenceToggle: document.querySelector("#adminPresenceToggle"),
    adminPresenceNote: document.querySelector("#adminPresenceNote"),
    typing: document.querySelector("#typing"),
  };

  const recovery = CWClientChat.create({ clientId: () => state.activeClientId, input: els.text, sendButton: els.sendBtn, fileInput: els.fileInput, fileButton: els.fileBtn,
    mount: document.querySelector('.chat-area'), list: els.messages, canSend: () => !!state.activeClientId,
    invalidate: () => { els.clientList.replaceChildren(); state.messages = []; state.conversations = []; setHeader(null); socket?.disconnect(); },
    confirmed: async message => { if (Number(message.clientId) === state.activeClientId) await openConversation(state.activeClientId); } });
  let overviewRevision = 0;

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    }[char]));
  }

  function shortDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function messageText(message) {
    return message?.message || message?.text || "";
  }

  function isClientMessage(message) {
    const sender = String(message?.sender || "").toLowerCase();
    const senderType = String(message?.senderType || "").toUpperCase();
    return sender === "cliente" || sender === "client" || senderType === "CLIENT";
  }

  async function api(path, options = {}) {
    const headers = options.body instanceof FormData
      ? authHeaders(options.headers || {})
      : authHeaders({ "Content-Type": "application/json", ...(options.headers || {}) });
    if (!recovery.active()) throw Error("A sessão mudou.");
    Object.assign(headers, recovery.headers());
    const response = await fetch(`${API}${path}`, {
      cache: "no-store",
      headers,
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!recovery.active()) throw Error("A sessão mudou.");
    if (!response.ok || data.ok !== true) {
      throw new Error(data.error || data.message || "Erro no servidor");
    }
    return data;
  }

  function setHeader(client) {
    if (!client) {
      els.chatClientName.textContent = unreadFilter ? "Mensagens por ler" : "Conversas";
      els.clientStatusText.textContent = "Escolha uma conversa";
      els.priorityBadge.textContent = unreadFilter ? "POR LER" : "NORMAL";
      els.clientStatusDot.classList.remove("online");
      return;
    }

    els.chatClientName.textContent = client.name || `Cliente ${client.id}`;
    els.clientStatusText.textContent = [
      client.zone || "zona por definir",
      client.email || client.phone || "",
    ].filter(Boolean).join(" - ");
    els.priorityBadge.textContent = client.unreadCount ? `${client.unreadCount} POR LER` : "NORMAL";
    els.clientStatusDot.classList.toggle("online", !!client.active);
  }

  function broadcastAdminPresence() {
    if (!socket) return;
    socket.emit("userOnline", {
      userId: "admin_public",
      online: state.adminPresenceActive,
      visibleToClients: state.adminPresenceActive,
    });
  }

  function renderAdminPresence() {
    if (!els.adminPresenceToggle) return;
    els.adminPresenceToggle.classList.toggle("active", state.adminPresenceActive);
    els.adminPresenceToggle.textContent = state.adminPresenceActive
      ? "Ativo para clientes"
      : "Invisivel";
    if (els.adminPresenceNote) {
      els.adminPresenceNote.textContent = state.adminPresenceActive
        ? "Os clientes podem ver a administracao online."
        : "Pode ler mensagens sem aparecer ativo.";
    }
  }

  function setAdminPresence(active) {
    state.adminPresenceActive = Boolean(active);
    localStorage.setItem(ADMIN_PRESENCE_KEY, state.adminPresenceActive ? "true" : "false");
    renderAdminPresence();
    broadcastAdminPresence();
  }

  function emitAdminTyping() {
    if (!socket || !state.adminPresenceActive || !state.activeClientId) return;
    socket.emit("typing", {
      clientId: state.activeClientId,
      userId: "admin_public",
    });
    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", {
        clientId: state.activeClientId,
        userId: "admin_public",
      });
    }, 1200);
  }

  function renderConversationList(list = state.conversations) {
    const search = String(els.search.value || "").trim().toLowerCase();
    const filtered = list.filter((client) => {
      if (!search) return true;
      return [
        client.name,
        client.email,
        client.phone,
        client.zone,
        client.latestMessage?.text,
      ].some((value) => String(value || "").toLowerCase().includes(search));
    });

    if (!filtered.length) {
      els.clientList.innerHTML = `
        <div class="client-item">
          <div class="client-name">Sem conversas encontradas</div>
          <div class="client-last">Nao ha mensagens para este filtro.</div>
        </div>
      `;
      return;
    }

    els.clientList.innerHTML = filtered.map((client) => `
      <div class="client-item ${Number(client.id) === Number(state.activeClientId) ? "active" : ""}" data-client-id="${esc(client.id)}">
        <div class="client-top">
          <div class="client-name">${esc(client.name || `Cliente ${client.id}`)}</div>
          ${client.unreadCount ? `<div class="badge">${esc(client.unreadCount)}</div>` : ""}
        </div>
        <div class="client-last">${esc(client.latestMessage?.text || "Sem mensagens recentes")}</div>
        <div class="client-meta">
          <span>${esc(client.zone || client.email || client.phone || "sem zona")}</span>
          <span>${esc(shortDate(client.latestMessage?.createdAt))}</span>
        </div>
      </div>
    `).join("");

    els.clientList.querySelectorAll(".client-item[data-client-id]").forEach((item) => {
      item.addEventListener("click", () => openConversation(Number(item.dataset.clientId)));
    });
  }

  function renderMessages(messages = state.messages) {
    if (!messages.length) {
      els.messages.innerHTML = '<div class="client-last">Ainda nao existem mensagens nesta conversa.</div>';
      return;
    }

    let lastDate = "";
    els.messages.innerHTML = messages.map((message) => {
      const date = new Date(message.createdAt);
      const dateLabel = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-PT");
      const separator = dateLabel && dateLabel !== lastDate
        ? (() => {
          lastDate = dateLabel;
          return `<div style="text-align:center;margin:18px 0;color:#b8d6e9;font-size:12px;font-weight:800">${esc(dateLabel)}</div>`;
        })()
        : "";
      const text = messageText(message);
      const upload = [message.fileUrl, text].some(value => String(value || '').startsWith('/uploads/')) && Number.isSafeInteger(Number(message.id)) && Number(message.id) > 0;
      const admin = !isClientMessage(message);
      const sender = message.sender || (admin ? "Administracao" : "Cliente");
      const body = upload
          ? `<a data-auth-download href="/api/client-messages/attachments/${Number(message.id)}" target="_blank" rel="noopener">Abrir anexo${message.fileName ? ': ' + esc(message.fileName) : ''}</a>`
          : esc(text);
      const invoiceDocument = message.messageType === 'DOCUMENT' && /^\/invoice-document\?id=[1-9]\d{0,9}$/.test(message.fileUrl || '')
        ? `<br><a href="${esc(message.fileUrl)}" target="_blank" rel="noopener">Abrir documento</a>` : '';

      return `
        ${separator}
        <div class="chat-message ${admin ? "chat-admin" : "chat-client"}">
          <strong>${esc(sender)}</strong>
          <br>
          ${body}${invoiceDocument}
          <div class="chat-meta">${esc(shortDate(message.createdAt))}</div>
        </div>
      `;
    }).join("");

    setTimeout(() => {
      els.messages.scrollTop = els.messages.scrollHeight;
    }, 30);
  }

  async function loadConversations() {
    await recovery.ready; const stamp = ++overviewRevision, selected = state.activeClientId;
    const data = await api(`/chat/overview${unreadFilter ? "?filter=unread" : ""}`);
    if (stamp !== overviewRevision || selected !== state.activeClientId || !Array.isArray(data.conversations)) return;
    state.totalUnread = Number(data.totalUnread || 0);
    state.conversations = Array.isArray(data.conversations) ? data.conversations : [];
    renderConversationList();

    if (!state.activeClientId && state.conversations.length && !unreadFilter) {
      state.activeClientId = Number(state.conversations[0].id);
    }

    if (state.activeClientId) {
      await openConversation(state.activeClientId, { preserveList: true });
    } else {
      setHeader(null);
      els.messages.innerHTML = `
        <div class="client-last">
          ${unreadFilter ? "Escolha uma conversa por ler para abrir. A mensagem so fica marcada como lida depois de entrar na conversa." : "Escolha uma conversa."}
        </div>
      `;
    }
  }

  async function openConversation(clientId, options = {}) {
    const selected = Number(clientId), changed = selected !== state.activeClientId;
    state.activeClientId = selected;
    recovery.selectionChanged();
    const client = state.conversations.find(item => Number(item.id) === selected); setHeader(client);
    if (changed) { state.messages = []; els.messages.replaceChildren(); }
    await recovery.ready; await recovery.sync();
    const read = recovery.begin(); if (!read) return;
    try {
      const data = await api(`/chat/client/${selected}`);
      if (!recovery.accepts(read)) return;
      if (!Array.isArray(data.messages)) throw Error('Conversa inválida');
      state.messages = data.messages; renderMessages();
      await api(`/client-messages/seen/${selected}`, { method: 'POST' });
      if (!recovery.accepts(read)) return;
      const current = state.conversations.find(item => Number(item.id) === selected);
      if (current) current.unreadCount = 0;
      if (!options.preserveList) renderConversationList();
    } catch { if (recovery.accepts(read)) recovery.readError(); }
  }

  async function sendMessage() { return recovery.sendText(); }
  async function sendFile(file) { return recovery.sendFile(file); }

  els.search.addEventListener("input", () => renderConversationList());
  els.sendBtn.addEventListener("click", () => sendMessage().catch((error) => alert(error.message)));
  els.text.addEventListener("keydown", (event) => {
    emitAdminTyping();
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage().catch((error) => alert(error.message));
    }
  });
  els.fileBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", async () => {
    const file = els.fileInput.files?.[0];
    if (file) await sendFile(file).catch((error) => alert(error.message));
  });
  if (els.adminPresenceToggle) {
    els.adminPresenceToggle.addEventListener("click", () => {
      setAdminPresence(!state.adminPresenceActive);
    });
  }

  if (socket) {
    socket.on("connect", () => {
      broadcastAdminPresence();
    });
    socket.on("newMessage", async message => {
      if (!recovery.active()) return;
      if (Number(message.clientId) === state.activeClientId) await openConversation(state.activeClientId);
      else await loadConversations().catch(() => null);
    });
    socket.on("typing", () => {
      els.typing.textContent = "Cliente a escrever...";
    });
    socket.on("stopTyping", () => {
      els.typing.textContent = "";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderAdminPresence();
    broadcastAdminPresence();
    loadConversations().catch((error) => {
      setHeader(null);
      els.clientList.innerHTML = `<div class="client-item"><div class="client-name">Erro</div><div class="client-last">${esc(error.message)}</div></div>`;
    });
  });

  window.addEventListener("beforeunload", () => {
    if (!socket || !state.adminPresenceActive) return;
    socket.emit("userOnline", {
      userId: "admin_public",
      online: false,
      visibleToClients: false,
    });
  });
})();
