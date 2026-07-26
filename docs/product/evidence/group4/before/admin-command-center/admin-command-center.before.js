(function () {
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[char]));

  async function api(path) {
    const response = await fetch(path, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || data.message || "Erro no servidor");
    return data;
  }

  function n(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function formatDate(value) {
    if (!value) return "sem data";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "sem data";
    return date.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function morningIssueCount(morningCheck) {
    const counts = morningCheck?.counts || {};
    return n(counts.bad) + n(counts.warn);
  }

  function morningRisk(morningCheck) {
    const counts = morningCheck?.counts || {};
    return n(counts.bad) * 4 + n(counts.warn) * 2;
  }

  function riskScore(counts, pendingPools, morningCheck) {
    return (
      n(counts.repairsOpen) * 3 +
      n(counts.invoicesOpen) * 2 +
      n(counts.messagesUnread) * 2 +
      n(counts.notificationsUnread) +
      n(pendingPools.length) +
      n(counts.visitsPlanned) +
      morningRisk(morningCheck)
    );
  }

  function riskTone(score) {
    if (score >= 20) return { label: "Critico", title: "Intervencao necessaria", copy: "Existem varios pontos que podem afetar campo, clientes ou cobrancas." };
    if (score >= 8) return { label: "Atencao", title: "Prioridades abertas", copy: "Ha trabalho para rever antes de deixar a operacao correr sozinha." };
    return { label: "Estavel", title: "Operacao controlada", copy: "Nao existem sinais fortes de bloqueio neste momento." };
  }

  function metricCard(label, value, hint, href, tone = "") {
    return `
      <a class="metric" href="${esc(href)}">
        <div class="metric-top"><span class="dot ${esc(tone)}"></span><span class="pill">${esc(label)}</span></div>
        <b>${n(value)}</b>
        <span>${esc(hint)}</span>
      </a>
    `;
  }

  function statusTone(status) {
    const value = String(status || "").toUpperCase();
    if (value === "BAD") return "bad";
    if (value === "WARN") return "warn";
    return "ok";
  }

  function statusLabel(status) {
    const value = String(status || "").toUpperCase();
    if (value === "BAD") return "Critico";
    if (value === "WARN") return "Atencao";
    return "OK";
  }

  function renderMetrics(counts, pendingPools, morningCheck) {
    const score = riskScore(counts, pendingPools, morningCheck);
    $("#metrics").innerHTML = [
      metricCard("Risco", score, "pontos a decidir", "/admin-command-center", score > 7 ? "warn" : "ok"),
      metricCard("Arranque", morningIssueCount(morningCheck), "avisos antes de sair", "/admin-command-center#morningPanel", morningIssueCount(morningCheck) ? "warn" : "ok"),
      metricCard("Visitas", counts.visitsPlanned, "abertas / em curso", "/admin-visits", n(counts.visitsPlanned) ? "warn" : "ok"),
      metricCard("Mensagens", counts.messagesUnread, "por responder", "/chat?filter=unread", n(counts.messagesUnread) ? "warn" : "ok"),
      metricCard("Alertas", counts.repairsOpen, "reparacoes abertas", "/admin-alerts", n(counts.repairsOpen) ? "bad" : "ok"),
      metricCard("Faturas", counts.invoicesOpen, "pendentes / vencidas", "/billing", n(counts.invoicesOpen) ? "bad" : "ok"),
      metricCard("Sem ronda", pendingPools.length, "piscinas por planear", "/admin-rounds", pendingPools.length ? "warn" : "ok"),
    ].join("");
  }

  function queueItem(index, title, detail, href, tone = "warn") {
    return `
      <div class="decision">
        <div class="rank">${index}</div>
        <div>
          <strong>${esc(title)}</strong>
          <small>${esc(detail)}</small>
        </div>
        <a class="btn ${esc(tone)}" href="${esc(href)}">Abrir</a>
      </div>
    `;
  }

  function buildQueue(counts, pendingPools, visits, morningCheck) {
    const rows = [];
    (morningCheck?.checks || [])
      .filter((check) => ["BAD", "WARN"].includes(String(check.status || "").toUpperCase()))
      .forEach((check) => rows.push([`Arranque - ${check.label}`, check.message, check.href || "/admin-command-center#morningPanel", statusTone(check.status)]));
    if (n(counts.repairsOpen)) rows.push(["Alertas tecnicos", `${n(counts.repairsOpen)} reparacao(oes) ou alerta(s) por decidir`, "/admin-alerts", "warn"]);
    if (n(counts.messagesUnread)) rows.push(["Mensagens", `${n(counts.messagesUnread)} mensagem(ns) de cliente/equipa por responder`, "/chat?filter=unread", "warn"]);
    if (n(counts.notificationsUnread)) rows.push(["Notificacoes", `${n(counts.notificationsUnread)} aviso(s) do sistema por abrir`, "/admin-notifications", "warn"]);
    if (n(counts.invoicesOpen)) rows.push(["Financeiro", `${n(counts.invoicesOpen)} fatura(s) pendente(s), parcial ou vencida`, "/billing", "warn"]);
    if (pendingPools.length) rows.push(["Planeamento", `${pendingPools.length} piscina(s) ativa(s) sem ronda`, "/admin-rounds", "warn"]);
    if (visits.length) rows.push(["Campo hoje", `${visits.length} visita(s) ainda abertas ou em execucao`, "/admin-visits", ""]);
    return rows.slice(0, 8);
  }

  function renderQueue(counts, pendingPools, visits, morningCheck) {
    const rows = buildQueue(counts, pendingPools, visits, morningCheck);
    $("#queueHint").textContent = rows.length ? `${rows.length} ponto(s)` : "sem bloqueios";
    $("#decisionQueue").innerHTML = rows.length
      ? rows.map((row, index) => queueItem(index + 1, row[0], row[1], row[2], row[3])).join("")
      : '<div class="empty">Sem decisoes urgentes neste momento.</div>';
  }

  function renderMorningCheck(morningCheck) {
    const statusBox = $("#morningStatus");
    const grid = $("#morningGrid");
    const copy = $("#morningCopy");

    if (!statusBox || !grid) return;

    if (!morningCheck) {
      statusBox.innerHTML = "<strong>Sem dados</strong><span>verificacao indisponivel</span>";
      grid.innerHTML = '<div class="empty">Nao foi possivel carregar a verificacao de arranque.</div>';
      return;
    }

    const nextLabel = morningCheck.next?.label || "proximo periodo";
    const periodText = morningCheck.isFriday
      ? "Hoje e sexta-feira: alem de hoje, o sistema tambem verifica a proxima semana."
      : `O sistema verifica hoje e ${nextLabel.toLowerCase()}.`;

    if (copy) {
      copy.textContent = `${morningCheck.message} ${periodText}`;
    }

    statusBox.className = `morning-status ${statusTone(morningCheck.status)}`;
    statusBox.innerHTML = `
      <strong>${esc(morningCheck.title || statusLabel(morningCheck.status))}</strong>
      <span>${n(morningCheck.counts?.bad)} critico(s), ${n(morningCheck.counts?.warn)} aviso(s)</span>
    `;

    const checks = morningCheck.checks || [];
    grid.innerHTML = checks.length
      ? checks.map((check) => {
          const details = (check.details || []).slice(0, 4);
          return `
            <article class="morning-card ${statusTone(check.status)}">
              <div class="morning-card-top">
                <h3>${esc(check.label)}</h3>
                <span class="pill ${statusTone(check.status)}">${esc(statusLabel(check.status))}</span>
              </div>
              <p>${esc(check.message)}</p>
              ${details.length ? `<ul>${details.map((detail) => `<li>${esc(detail)}</li>`).join("")}</ul>` : ""}
              <a class="btn ${statusTone(check.status) === "ok" ? "ghost" : statusTone(check.status)}" href="${esc(check.href || "#")}">Abrir modulo</a>
            </article>
          `;
        }).join("")
      : '<div class="empty">Sem verificacoes configuradas.</div>';
  }

  function renderVisits(visits) {
    $("#visitList").innerHTML = visits.length
      ? visits.slice(0, 8).map((visit) => `
          <div class="item">
            <div>
              <b>${esc(visit.pool?.name || "Piscina")}</b>
              <small>${esc(visit.client?.name || "Cliente")} - ${esc(visit.technician?.name || "sem tecnico")} - ${formatDate(visit.plannedDate || visit.date || visit.createdAt)}</small>
            </div>
            <span class="pill">${esc(visit.status || "PLANNED")}</span>
          </div>
        `).join("")
      : '<div class="empty">Sem visitas abertas.</div>';
  }

  function renderPools(pools) {
    $("#poolList").innerHTML = pools.length
      ? pools.slice(0, 8).map((pool) => `
          <div class="item">
            <div>
              <b>${esc(pool.name || "Piscina")}</b>
              <small>${esc(pool.client?.name || "Cliente")} - ${esc(pool.zone || pool.location || "zona por definir")}</small>
            </div>
            <a class="btn ghost" href="/admin-rounds">Planear</a>
          </div>
        `).join("")
      : '<div class="empty">Todas as piscinas ativas estao cobertas por rondas.</div>';
  }

  function renderState(counts, pendingPools, morningCheck) {
    const score = riskScore(counts, pendingPools, morningCheck);
    const tone = riskTone(score);
    $("#stateLabel").textContent = tone.label;
    $("#stateTitle").textContent = tone.title;
    $("#stateCopy").textContent = tone.copy;
    $("#riskValue").textContent = score;
    $("#riskRing").style.setProperty("--risk-deg", `${Math.min(360, score * 12)}deg`);
    $("#lastUpdated").textContent = `Atualizado as ${new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`;
  }

  async function load() {
    const button = $("#refreshBtn");
    try {
      if (button) {
        button.disabled = true;
        button.textContent = "A atualizar...";
      }
      const data = await api("/api/core/dashboard");
      const counts = data.counts || {};
      const pendingPools = data.pendingPoolsWithoutRound || [];
      const visits = data.nextVisits || [];
      const morningCheck = data.morningCheck || null;
      renderState(counts, pendingPools, morningCheck);
      renderMetrics(counts, pendingPools, morningCheck);
      renderQueue(counts, pendingPools, visits, morningCheck);
      renderMorningCheck(morningCheck);
      renderVisits(visits);
      renderPools(pendingPools);
    } catch (error) {
      $("#stateLabel").textContent = "Erro";
      $("#stateTitle").textContent = "Sem dados operacionais";
      $("#stateCopy").textContent = error.message || "Nao foi possivel carregar o Command Center.";
      $("#decisionQueue").innerHTML = '<div class="empty">Verifica a ligacao ao servidor.</div>';
      renderMorningCheck(null);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Atualizar";
      }
    }
  }

  const refreshBtn = $("#refreshBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", load);
  document.addEventListener("DOMContentLoaded", load);
})();
