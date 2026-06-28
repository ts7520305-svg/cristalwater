(function(){
  "use strict";

  const API = "/api/ai-admin";
  let threadId = null;
  let lastRecommendations = [];

  const els = {
    status: document.getElementById("aiStatus"),
    messages: document.getElementById("messages"),
    input: document.getElementById("messageInput"),
    send: document.getElementById("sendBtn"),
    refresh: document.getElementById("refreshBtn"),
    kpis: document.getElementById("kpis"),
    capabilities: document.getElementById("capabilities"),
    recommendations: document.getElementById("recommendations"),
    actions: document.getElementById("actions")
  };

  function token(){
    return localStorage.getItem("token") || localStorage.getItem("adminToken") || "";
  }

  function headers(){
    const authToken = token();
    return {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    };
  }

  async function api(path, options = {}){
    const res = await fetch(API + path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
    const data = await res.json().catch(() => ({ ok:false, error:"Resposta inválida" }));
    if(!res.ok || data.ok === false) throw new Error(data.error || data.message || `Erro ${res.status}`);
    return data;
  }

  function escapeHtml(value){
    return String(value ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function addMessage(role, text){
    const div = document.createElement("div");
    div.className = `msg ${role === "user" ? "user" : "ai"}`;
    div.textContent = text;
    els.messages.appendChild(div);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function renderKpis(context){
    const c = context?.counters || {};
    const items = [
      ["Visitas hoje", c.visitsToday || 0],
      ["Concluídas", c.visitsDoneToday || 0],
      ["Atrasadas", c.overdueVisits || 0],
      ["Alertas", c.openAlerts || 0],
      ["Técnicos", c.techniciansActive || 0],
      ["Cobranças", c.pendingInvoices || 0]
    ];
    els.kpis.innerHTML = items.map(([label, value]) => `<div class="kpi"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("");
  }

  function renderCapabilities(status){
    const configured = Boolean(status.externalAiConfigured);
    const external = Boolean(status.externalAiEnabled ?? status.externalAiConfigured);
    const web = Boolean(status.webAccess?.enabled);
    const approval = status.requireApproval !== false;
    const enabled = status.enabled !== false;
    const items = [
      {
        title: "Leitura operacional",
        desc: "Clientes, piscinas, visitas, alertas, rondas, cobranças e ações pendentes.",
        state: enabled ? "Ativa" : "Off",
        type: enabled ? "ok" : "off"
      },
      {
        title: "Motor IA",
        desc: external
          ? `OpenAI ativo: ${status.model || "modelo definido"}`
          : configured
            ? "Chave OpenAI encontrada, mas o motor externo esta desligado."
            : "Modo local com regras operacionais, sem chave OpenAI.",
        state: external ? "Online" : (configured ? "Off" : "Local"),
        type: external ? "ok" : "warn"
      },
      {
        title: "Web",
        desc: status.webAccess?.note || "Consulta web desligada.",
        state: web ? "Ativa" : "Off",
        type: web ? "ok" : "off"
      },
      {
        title: "Segurança",
        desc: "Alterações sensíveis ficam pendentes para aprovação do administrador.",
        state: approval ? "Aprovação" : "Livre",
        type: approval ? "ok" : "warn"
      },
      {
        title: "Fornecedores",
        desc: "A IA orienta; passwords são copiadas apenas no Gestor de fornecedores.",
        state: "Seguro",
        type: "ok"
      }
    ];

    els.capabilities.innerHTML = items.map((item) => `
      <div class="capability">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.desc)}</span>
        </div>
        <div class="cap-dot ${escapeHtml(item.type)}">${escapeHtml(item.state)}</div>
      </div>
    `).join("");
  }

  function renderRecommendations(list){
    lastRecommendations = Array.isArray(list) ? list : [];
    if(!lastRecommendations.length){
      els.recommendations.innerHTML = '<div class="empty">Pergunta à IA por prioridades, riscos, rondas, cobranças ou fornecedores.</div>';
      return;
    }
    els.recommendations.innerHTML = lastRecommendations.map((item) => {
      if(typeof item === "string") return `<div class="rec">${escapeHtml(item)}</div>`;
      const title = item.title || item.category || "Recomendação";
      const text = item.summary || item.text || item.rationale || "";
      return `<div class="rec"><strong>${escapeHtml(title)}</strong><br>${escapeHtml(text)}</div>`;
    }).join("");
  }

  function renderActions(list){
    if(!Array.isArray(list) || !list.length){
      els.actions.innerHTML = '<div class="empty">Sem ações pendentes.</div>';
      return;
    }
    els.actions.innerHTML = list.map((a) => {
      const risk = a.risk || a.riskLevel || "MEDIUM";
      const description = a.description || a.summary || "";
      return `
        <div class="action" data-action-id="${a.id}">
          <h4>${escapeHtml(a.title || a.type || a.actionType)} <span class="risk ${escapeHtml(risk)}">${escapeHtml(risk)}</span></h4>
          <p>${escapeHtml(description)}</p>
          <small>${escapeHtml(a.type || a.actionType || "AI")} · #${escapeHtml(a.id)}</small>
          <div class="action-buttons">
            <button class="approve" data-approve="${a.id}">Aprovar e executar</button>
            <button class="reject" data-reject="${a.id}">Rejeitar</button>
          </div>
        </div>`;
    }).join("");
  }

  function statusText(data){
    const external = Boolean(data.externalAiEnabled ?? data.externalAiConfigured);
    if(!data.enabled) return "IA desativada";
    if(external && data.webAccess?.enabled) return `OpenAI + Web - ${data.model}`;
    if(external) return `OpenAI - ${data.model}`;
    if(data.externalAiConfigured) return "OpenAI configurado - desligado";
    return "Modo local - sem chave OpenAI";
    if(!data.enabled) return "IA desativada";
    if(data.externalAiConfigured && data.webAccess?.enabled) return `OpenAI + Web · ${data.model}`;
    if(data.externalAiConfigured) return `OpenAI · ${data.model}`;
    return "Modo local · sem chave OpenAI";
  }

  async function loadStatus(){
    try{
      const data = await api("/status");
      els.status.textContent = statusText(data);
      renderKpis(data.context);
      renderCapabilities(data);
      renderRecommendations(lastRecommendations);
      await loadActions();
      if(!els.messages.children.length){
        addMessage("ai", "Estou ligada ao centro operacional Cristal Water. Posso analisar o dia, priorizar visitas, alertas, cobranças, rondas, fornecedores e preparar ações para aprovação. Se a web estiver ativa, também posso pesquisar informação externa quando pedires.");
      }
    }catch(err){
      els.status.textContent = "Erro";
      if(els.capabilities) els.capabilities.innerHTML = `<div class="empty">Erro ao carregar capacidades: ${escapeHtml(err.message)}</div>`;
      addMessage("ai", `Erro ao carregar IA operacional: ${err.message}`);
    }
  }

  async function loadActions(){
    try{
      const data = await api("/actions?status=PENDING&take=30");
      renderActions(data.actions || []);
    }catch(err){
      els.actions.innerHTML = `<div class="empty">Erro ações: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function send(){
    const message = els.input.value.trim();
    if(!message) return;
    els.input.value = "";
    addMessage("user", message);
    els.send.disabled = true;
    els.send.textContent = "A pensar...";
    try{
      const data = await api("/chat", { method:"POST", body: JSON.stringify({ message, threadId }) });
      threadId = data.threadId || threadId;
      addMessage("ai", data.answer || data.reply || "Sem resposta.");
      renderRecommendations(data.recommendations || []);
      renderActions(data.actions || []);
      await loadActions();
    }catch(err){
      addMessage("ai", `Erro: ${err.message}`);
    }finally{
      els.send.disabled = false;
      els.send.textContent = "Enviar";
      els.input.focus();
    }
  }

  async function approve(id){
    if(!confirm("Aprovar e executar esta ação IA?")) return;
    try{
      const data = await api(`/actions/${id}/approve`, { method:"POST", body: JSON.stringify({}) });
      addMessage("ai", `Ação #${id} executada com sucesso. Estado: ${data.action?.status || "EXECUTED"}`);
      await loadStatus();
    }catch(err){
      addMessage("ai", `Falha ao executar ação #${id}: ${err.message}`);
      await loadActions();
    }
  }

  async function reject(id){
    const reason = prompt("Motivo da rejeição:", "Rejeitado pelo administrador") || "Rejeitado pelo administrador";
    try{
      await api(`/actions/${id}/reject`, { method:"POST", body: JSON.stringify({ reason }) });
      addMessage("ai", `Ação #${id} rejeitada.`);
      await loadActions();
    }catch(err){
      addMessage("ai", `Falha ao rejeitar ação #${id}: ${err.message}`);
    }
  }

  els.send.addEventListener("click", send);
  els.refresh.addEventListener("click", loadStatus);
  els.input.addEventListener("keydown", (event) => {
    if(event.key === "Enter" && (event.ctrlKey || event.metaKey)) send();
  });
  document.querySelectorAll("[data-prompt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.input.value = btn.dataset.prompt;
      send();
    });
  });
  els.actions.addEventListener("click", (event) => {
    const approveId = event.target?.dataset?.approve;
    const rejectId = event.target?.dataset?.reject;
    if(approveId) approve(approveId);
    if(rejectId) reject(rejectId);
  });

  loadStatus();
})();
