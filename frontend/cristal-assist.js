(function(){
  "use strict";

  const topics = window.CRISTAL_HELP_TOPICS || {};
  const quickActions = window.CRISTAL_QUICK_ACTIONS || [];
  const LOGIN_PATHS = ["/", "/login", "/admin-login", "/client-login", "/technician-login"];
  const HELP_ENABLED_KEY = "cw_help_enabled";
  const HELP_MODE_KEY = "cw_help_mode";
  let tooltip = null;
  let drawerBackdrop = null;
  let drawer = null;
  let commandBackdrop = null;
  let command = null;
  let currentTooltipTopic = null;

  const lower = (value) => String(value || "").toLowerCase();
  const path = lower(window.location.pathname || "/");
  const isLoginPage = LOGIN_PATHS.includes(path);

  function isAuthenticatedArea(){
    if(isLoginPage) return false;
    return path.includes("admin") || path.includes("billing") || path.includes("invoice") || path.includes("incident") || path.includes("report") || path.includes("operational") || path.includes("dashboard") || path.includes("chat") || path.includes("client-") || path.includes("technician-");
  }

  function helpEnabled(){
    return isAuthenticatedArea() && localStorage.getItem(HELP_ENABLED_KEY) === "1";
  }

  function helpMode(){
    return helpEnabled() && localStorage.getItem(HELP_MODE_KEY) === "1";
  }

  function setHelpEnabled(value){
    localStorage.setItem(HELP_ENABLED_KEY, value ? "1" : "0");
    document.body.classList.toggle("cw-help-enabled", value);
    if(!value) {
      localStorage.setItem(HELP_MODE_KEY, "0");
      document.body.classList.remove("cw-help-mode");
      hideTooltip();
      closeDrawer();
    }
  }

  function setHelpMode(value){
    if(!helpEnabled()) return;
    localStorage.setItem(HELP_MODE_KEY, value ? "1" : "0");
    document.body.classList.toggle("cw-help-mode", value);
    if(!value) hideTooltip();
  }

  function getTopic(key){
    return topics[key] || topics.default || { title:"Ajuda", summary:"Função do sistema.", detail:"", actions:[] };
  }

  function classifyElement(el){
    const id = lower(el.id);
    const cls = lower(el.className);
    const text = lower(el.textContent || el.value || el.placeholder || el.getAttribute?.("aria-label") || "");
    const route = lower(el.dataset?.route || el.getAttribute?.("href") || window.location.pathname || "");
    const all = `${id} ${cls} ${text} ${route}`;
    const rules = [
      ["operationalFlow", ["fluxo", "operacional", "pendência", "pendencia", "pipeline", "criar fluxo", "admin-operational-flow"]],
      ["aiAdmin", ["admin-ai", "ia operacional", "cristal ai", "copiloto", "ação ia", "acoes ia", "ações ia"]],
      ["rounds", ["ronda", "round", "rota semanal", "gerar semana", "admin-rounds"]],
      ["dashboard", ["dashboard", "operational intelligence", "monitoring center", "kpi", "timeline", "score operacional"]],
      ["map", ["mapa", "gps", "live map", "localização", "location", "route-map"]],
      ["visits", ["visita", "serviço", "visit", "today", "concluir", "iniciar visita"]],
      ["technicians", ["técnico", "tecnico", "technician", "equipa", "pin"]],
      ["clients", ["cliente", "client", "crm"]],
      ["pools", ["piscina", "pool", "água", "agua"]],
      ["finance", ["finance", "financeiro", "cobran", "billing", "pagamento", "payment", "lucro", "dívida", "divida"]],
      ["invoices", ["fatura", "invoice"]],
      ["alerts", ["alerta", "notifica", "notification", "sino", "crítico", "critico"]],
      ["chat", ["chat", "mensagem", "message", "whatsapp", "comunicação", "communication"]],
      ["reports", ["relatório", "relatorio", "report", "pdf"]],
      ["incidents", ["incident", "incidente", "sla", "escalar"]],
      ["inventory", ["stock", "guia", "viatura", "vehicle", "invent", "material"]],
      ["customerPortal", ["portal cliente", "client portal", "cliente online"]],
      ["themes", ["tema", "visual", "aparência", "dark", "light"]],
      ["settings", ["config", "permiss", "setting"]],
      ["help", ["ajuda", "help", "explica"]]
    ];
    for(const [topic, words] of rules){ if(words.some((word)=>all.includes(word))) return topic; }
    return null;
  }

  function annotateHelpables(){
    if(!helpEnabled()) return;
    const selector = ["button", "a", "input", "select", "textarea", "[data-route]", ".card", ".panel", ".kpi-card", ".chart-box", ".toolbar", ".ai-status", "#liveMap"].join(",");
    document.querySelectorAll(selector).forEach((el)=>{
      if(el.closest(".cw-drawer") || el.closest(".cw-command") || el.closest(".cw-tooltip") || el.closest(".cw-side")) return;
      if(el.dataset.cwHelpReady === "1") return;
      const topicKey = el.dataset.helpTopic || classifyElement(el);
      if(!topicKey) return;
      el.dataset.helpTopic = topicKey;
      el.dataset.cwHelpReady = "1";
      el.classList.add("cw-helpable");
      if(el.getAttribute("title")) el.dataset.cwOriginalTitle = el.getAttribute("title");
      el.removeAttribute("title");
      let cwHoverTimer = null;
      el.addEventListener("mouseenter", (event)=>{
        if(!helpMode()) return;
        cwHoverTimer = setTimeout(()=>showTooltip(el, topicKey, event), 1200);
      });
      el.addEventListener("mousemove", positionTooltip);
      el.addEventListener("mouseleave", ()=>{ clearTimeout(cwHoverTimer); hideTooltipSoon(); });
      let cwPressTimer = null;
      const clearPress = ()=>{ if(cwPressTimer){ clearTimeout(cwPressTimer); cwPressTimer = null; } };
      el.addEventListener("touchstart", (event)=>{ if(!helpEnabled()) return; cwPressTimer = setTimeout(()=>{ event.preventDefault(); openDrawer(topicKey); }, 3000); }, {passive:false});
      el.addEventListener("touchend", clearPress);
      el.addEventListener("touchcancel", clearPress);
      el.addEventListener("contextmenu", (event)=>{ if(helpEnabled()){ event.preventDefault(); openDrawer(topicKey); } });
      el.addEventListener("click", (event)=>{ if(event.altKey && helpEnabled()){ event.preventDefault(); event.stopPropagation(); openDrawer(topicKey); } });
    });
  }

  function showTooltip(el, topicKey, event){
    if(!helpMode()) return;
    currentTooltipTopic = topicKey;
    const topic = getTopic(topicKey);
    if(!tooltip){ tooltip = document.createElement("div"); tooltip.className = "cw-tooltip"; tooltip.addEventListener("mouseenter", ()=>{ if(tooltip) tooltip.dataset.keep = "1"; }); tooltip.addEventListener("mouseleave", hideTooltipSoon); document.body.appendChild(tooltip); }
    tooltip.dataset.keep = "";
    tooltip.innerHTML = `<b>${escapeHtml(topic.title)}</b><span>${escapeHtml(topic.summary)}</span><br><button type="button" data-cw-open-help="${escapeHtml(topicKey)}">Abrir ajuda →</button>`;
    tooltip.querySelector("button")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openDrawer(topicKey); hideTooltip(); });
    positionTooltip(event);
  }

  function positionTooltip(event){
    if(!tooltip || !event) return;
    const pad = 14; const rect = tooltip.getBoundingClientRect();
    let left = event.clientX + pad; let top = event.clientY + pad;
    if(left + rect.width > window.innerWidth - 8) left = event.clientX - rect.width - pad;
    if(top + rect.height > window.innerHeight - 8) top = event.clientY - rect.height - pad;
    tooltip.style.left = Math.max(8, left) + "px"; tooltip.style.top = Math.max(8, top) + "px";
  }
  function hideTooltipSoon(){ setTimeout(()=>{ if(tooltip && tooltip.dataset.keep !== "1") hideTooltip(); }, 120); }
  function hideTooltip(){ tooltip?.remove(); tooltip = null; }

  function renderTopicButton(key, topic){ return `<button type="button" class="cw-topic-btn" data-topic="${escapeHtml(key)}"><strong>${escapeHtml(topic.title)}</strong><small>${escapeHtml(topic.summary)}</small></button>`; }
  function renderDetail(key){
    const topic = getTopic(key); const actions = (topic.actions || []).map((item)=>`<li>${escapeHtml(item)}</li>`).join("");
    return `<h3>${escapeHtml(topic.title)}</h3><p>${escapeHtml(topic.detail || topic.summary)}</p>${actions ? `<h4>Ações principais</h4><ul>${actions}</ul>` : ""}<a class="cw-help-full-link" href="/help-center?topic=${encodeURIComponent(key)}">Abrir centro completo →</a>`;
  }

  function openDrawer(topicKey="help"){
    if(!isAuthenticatedArea()) return;
    setHelpEnabled(true);
    closeDrawer();
    drawerBackdrop = document.createElement("div"); drawerBackdrop.className = "cw-drawer-backdrop"; drawerBackdrop.addEventListener("click", closeDrawer);
    drawer = document.createElement("aside"); drawer.className = "cw-drawer"; drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-label", "Ajuda Cristal Water");
    const entries = Object.entries(topics).filter(([key])=>key !== "default");
    drawer.innerHTML = `<header><h2>❔ Ajuda Cristal Water</h2><button class="cw-close" type="button" aria-label="Fechar">×</button></header>
      <div class="cw-help-mode-row"><label><input type="checkbox" id="cwHelpHoverMode"> Mostrar dicas por hover prolongado</label><small>Long press 3s no mobile continua disponível.</small></div>
      <input class="cw-help-search" placeholder="Pesquisar funcionalidade, ex: rondas, faturas, GPS...">
      <div class="cw-topic-list">${entries.map(([key, topic])=>renderTopicButton(key, topic)).join("")}</div>
      <div class="cw-help-detail">${renderDetail(topicKey)}</div>`;
    document.body.appendChild(drawerBackdrop); document.body.appendChild(drawer);
    drawer.querySelector(".cw-close")?.addEventListener("click", closeDrawer);
    const mode = drawer.querySelector("#cwHelpHoverMode"); mode.checked = helpMode(); mode.addEventListener("change", ()=>setHelpMode(mode.checked));
    drawer.querySelectorAll("[data-topic]").forEach((btn)=>btn.addEventListener("click", ()=>{ drawer.querySelector(".cw-help-detail").innerHTML = renderDetail(btn.dataset.topic); }));
    drawer.querySelector(".cw-help-search")?.addEventListener("input", (event)=>{
      const q = lower(event.target.value);
      drawer.querySelectorAll("[data-topic]").forEach((btn)=>{ const topic = getTopic(btn.dataset.topic); const haystack = lower(`${topic.title} ${topic.summary} ${topic.detail} ${(topic.actions || []).join(" ")}`); btn.style.display = haystack.includes(q) ? "block" : "none"; });
    });
    annotateHelpables();
  }
  function closeDrawer(){ drawerBackdrop?.remove(); drawer?.remove(); drawerBackdrop = null; drawer = null; }

  function openCommand(){
    if(!isAuthenticatedArea()) return;
    closeCommand();
    commandBackdrop = document.createElement("div"); commandBackdrop.className = "cw-command-backdrop"; commandBackdrop.addEventListener("click", closeCommand);
    command = document.createElement("section"); command.className = "cw-command"; command.setAttribute("role", "dialog"); command.setAttribute("aria-label", "Comando rápido Cristal Water");
    command.innerHTML = `<header><h2>⚡ Comando rápido</h2><button class="cw-close" type="button" aria-label="Fechar">×</button></header><input class="cw-command-search" placeholder="Pesquisar: rondas, clientes, mapa, faturas..." autofocus><div class="cw-command-results"></div>`;
    document.body.appendChild(commandBackdrop); document.body.appendChild(command);
    command.querySelector(".cw-close")?.addEventListener("click", closeCommand);
    const input = command.querySelector(".cw-command-search"); const results = command.querySelector(".cw-command-results");
    function render(){ const q = lower(input.value); const list = quickActions.filter((item)=>{ const topic = getTopic(item.topic); const haystack = lower(`${item.label} ${topic.title} ${topic.summary} ${topic.detail}`); return !q || haystack.includes(q); }); results.innerHTML = list.map((item)=>{ const topic = getTopic(item.topic); return `<a class="cw-command-item" href="${escapeHtml(item.href)}"><span class="cw-command-icon">${escapeHtml(item.icon || "•")}</span><span><strong>${escapeHtml(item.label)}</strong><br><small>${escapeHtml(topic.summary)}</small></span></a>`; }).join(""); }
    input.addEventListener("input", render); input.addEventListener("keydown", (event)=>{ if(event.key === "Enter"){ const first = results.querySelector("a"); if(first) window.location.href = first.href; } });
    render(); setTimeout(()=>input.focus(), 30);
  }
  function closeCommand(){ commandBackdrop?.remove(); command?.remove(); commandBackdrop = null; command = null; }

  function escapeHtml(value){ return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

  function loadSidebar(){
    if(document.querySelector('script[data-cw-sidebar]') || !isAuthenticatedArea()) return;
    if(document.querySelector('link[href="/crystal-os-v2-phase2-adapter.css"]') || document.querySelector('.cw-v2-sidebar,.cw-v2-shell-sidebar')) return;
    const script = document.createElement("script"); script.src = "/cw-enterprise-sidebar.js"; script.dataset.cwSidebar = "1"; document.body.appendChild(script);
  }

  function renderFabs(){
    if(!isAuthenticatedArea()) return;
    if(document.querySelector(".cw-command-fab")) return;
    const commandBtn = document.createElement("button"); commandBtn.type = "button"; commandBtn.className = "cw-command-fab"; commandBtn.title = "Comando rápido (CTRL/CMD+K)"; commandBtn.textContent = "⚡"; commandBtn.addEventListener("click", openCommand);
    const helpBtn = document.createElement("button"); helpBtn.type = "button"; helpBtn.className = "cw-help-fab cw-help-fab-quiet"; helpBtn.title = "Ajuda discreta"; helpBtn.textContent = "?"; helpBtn.addEventListener("click", ()=>openDrawer(currentTooltipTopic || "help"));
    document.body.appendChild(commandBtn); document.body.appendChild(helpBtn);
  }

  function init(){
    if(isLoginPage) return;
    if(!document.querySelector('link[href="/crystal-os-v2-phase2-adapter.css"]')) {
      document.body.classList.add("cw-enterprise-theme");
    }
    document.body.classList.toggle("cw-help-enabled", helpEnabled());
    document.body.classList.toggle("cw-help-mode", helpMode());
    loadSidebar();
    renderFabs();
    annotateHelpables();
    setTimeout(annotateHelpables, 1000);
    document.addEventListener("keydown", (event)=>{
      if((event.ctrlKey || event.metaKey) && lower(event.key) === "k"){ event.preventDefault(); openCommand(); }
      if((event.altKey) && lower(event.key) === "h"){ event.preventDefault(); openDrawer("help"); }
      if(event.key === "Escape"){ closeDrawer(); closeCommand(); hideTooltip(); }
    });
    const observer = new MutationObserver(()=>annotateHelpables()); observer.observe(document.body, { childList:true, subtree:true });
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ==========================================================
   CRISTAL WATER THEME MANAGER — V16 QUIET UX
========================================================== */
(function(){
  "use strict";
  const THEMES = ["dark", "mid", "light"];
  const DENSITIES = ["compact", "comfort", "large"];
  const KEY_THEME = "cw_theme";
  const KEY_DENSITY = "cw_density";
  const LOGIN_PATHS = ["/", "/login", "/admin-login", "/client-login", "/technician-login"];
  function pageAllowsControls(){ return !LOGIN_PATHS.includes(String(location.pathname || "").toLowerCase()); }
  function getTheme(){ const saved = localStorage.getItem(KEY_THEME) || "dark"; return THEMES.includes(saved) ? saved : "dark"; }
  function getDensity(){ const saved = localStorage.getItem(KEY_DENSITY) || "comfort"; return DENSITIES.includes(saved) ? saved : "comfort"; }
  function applyTheme(theme){ THEMES.forEach((item)=>document.body.classList.remove(`cw-theme-${item}`)); document.body.classList.add(`cw-theme-${theme}`); localStorage.setItem(KEY_THEME, theme); document.documentElement.setAttribute("data-cw-theme", theme); markActive(); }
  function applyDensity(density){ DENSITIES.forEach((item)=>document.body.classList.remove(`cw-density-${item}`)); document.body.classList.add(`cw-density-${density}`); localStorage.setItem(KEY_DENSITY, density); markActive(); }
  function markActive(){ const theme = getTheme(); const density = getDensity(); document.querySelectorAll(".cw-theme-choice").forEach((btn)=>btn.classList.toggle("active", btn.dataset.theme === theme)); document.querySelectorAll(".cw-density-choice").forEach((btn)=>btn.classList.toggle("active", btn.dataset.density === density)); }
  function togglePanel(){
    const existing = document.querySelector(".cw-theme-panel"); if(existing){ existing.remove(); return; }
    const panel = document.createElement("div"); panel.className = "cw-theme-panel";
    panel.innerHTML = `<h3>🎨 Aparência</h3><p>Tema e densidade visual.</p><div class="cw-theme-grid"><button class="cw-theme-choice" data-theme="dark"><div class="cw-theme-preview cw-preview-dark"></div>Escuro</button><button class="cw-theme-choice" data-theme="mid"><div class="cw-theme-preview cw-preview-mid"></div>Meio</button><button class="cw-theme-choice" data-theme="light"><div class="cw-theme-preview cw-preview-light"></div>Claro</button></div><p>Densidade:</p><div class="cw-theme-grid"><button class="cw-density-choice" data-density="compact">Compacto</button><button class="cw-density-choice" data-density="comfort">Normal</button><button class="cw-density-choice" data-density="large">Grande</button></div><p><a href="/admin-ui-settings" style="color:#35d9ff;font-weight:900">Configurações visuais</a></p>`;
    document.body.appendChild(panel); panel.querySelectorAll("[data-theme]").forEach((btn)=>btn.addEventListener("click", ()=>applyTheme(btn.dataset.theme))); panel.querySelectorAll("[data-density]").forEach((btn)=>btn.addEventListener("click", ()=>applyDensity(btn.dataset.density))); markActive();
  }
  function renderControls(){
    document.querySelector(".cw-theme-fab")?.remove();
    document.querySelector(".cw-theme-panel")?.remove();
  }
  function init(){ if(pageAllowsControls()) document.body.classList.add("cw-enterprise-theme"); applyTheme(getTheme()); applyDensity(getDensity()); renderControls(); document.addEventListener("keydown", (event)=>{ if((event.ctrlKey || event.metaKey) && event.shiftKey && String(event.key).toLowerCase() === "t"){ event.preventDefault(); const idx = THEMES.indexOf(getTheme()); applyTheme(THEMES[(idx + 1) % THEMES.length]); } }); }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
