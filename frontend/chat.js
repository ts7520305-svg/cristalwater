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
    const response = await fetch(`${API}${path}`, {
      cache: "no-store",
      headers,
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
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
      const upload = String(text).startsWith("/uploads/");
      const ext = String(text).split(".").pop().toLowerCase();
      const admin = !isClientMessage(message);
      const sender = message.sender || (admin ? "Administracao" : "Cliente");
      const body = upload && ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
        ? `<img src="${esc(text)}" class="chat-image" alt="Anexo">`
        : upload
          ? `<a href="${esc(text)}" target="_blank" rel="noopener">Abrir documento</a>`
          : esc(text);

      return `
        ${separator}
        <div class="chat-message ${admin ? "chat-admin" : "chat-client"}">
          <strong>${esc(sender)}</strong>
          <br>
          ${body}
          <div class="chat-meta">${esc(shortDate(message.createdAt))}</div>
        </div>
      `;
    }).join("");

    setTimeout(() => {
      els.messages.scrollTop = els.messages.scrollHeight;
    }, 30);
  }

  async function loadConversations() {
    const data = await api(`/chat/overview${unreadFilter ? "?filter=unread" : ""}`);
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
    state.activeClientId = Number(clientId);
    const client = state.conversations.find((item) => Number(item.id) === Number(clientId));
    setHeader(client);

    const data = await api(`/chat/client/${state.activeClientId}`);
    state.messages = Array.isArray(data.messages) ? data.messages : [];
    renderMessages();

    await api(`/client-messages/seen/${state.activeClientId}`, { method: "POST" }).catch(() => null);

    const current = state.conversations.find((item) => Number(item.id) === Number(clientId));
    if (current) current.unreadCount = 0;
    if (!options.preserveList) renderConversationList();
  }

  async function sendMessage() {
    const text = String(els.text.value || "").trim();
    if (!state.activeClientId) {
      alert("Escolha uma conversa primeiro.");
      return;
    }
    if (!text) {
      alert("Escreva a mensagem.");
      return;
    }

    const data = await api("/chat", {
      method: "POST",
      body: JSON.stringify({
        clientId: state.activeClientId,
        sender: "admin",
        text,
      }),
    });

    els.text.value = "";
    state.messages.push(data.message);
    renderMessages();
    await loadConversations();

    if (socket) socket.emit("sendMessage", data.message);
  }

  async function sendFile(file) {
    if (!state.activeClientId || !file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", state.activeClientId);
    formData.append("sender", "Administracao Cristal Water");
    const data = await api("/client-messages/upload", { method: "POST", body: formData });
    state.messages.push(data.message);
    renderMessages();
    await loadConversations();
    if (socket) socket.emit("sendMessage", data.message);
  }

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
    els.fileInput.value = "";
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
    socket.on("newMessage", async (message) => {
      if (Number(message.clientId) === Number(state.activeClientId)) {
        state.messages.push(message);
        renderMessages();
        await api(`/client-messages/seen/${state.activeClientId}`, { method: "POST" }).catch(() => null);
      }
      await loadConversations().catch(() => null);
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
