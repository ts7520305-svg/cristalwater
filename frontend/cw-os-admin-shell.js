(function () {
  if (document.querySelector('link[href="/crystal-os-v2-phase2-adapter.css"]')) return;
  const isAdminSurface = /^\/admin-(master-control|today|alerts|clients|rounds|pools|inventory|reports|operational-settings|vehicles|visits|technicians|onboarding|priority|collection|crm|notifications|payments|service-log|map|live-map)/.test(location.pathname);
  if (!isAdminSurface) return;

  const contextByRoute = {
    "/admin-master-control": {
      where: "Today > Daily Brief",
      now: "Priorizar excecoes criticas e desbloquear operacao.",
      important: "Fila de decisao e risco operacional em tempo real.",
      level: "warning"
    },
    "/admin-today": {
      where: "Today > Shift Timeline",
      now: "Conduzir o fluxo de hoje por SLA e prioridade.",
      important: "Pendencias vencidas e visitas em risco.",
      level: "warning"
    },
    "/admin-alerts": {
      where: "Exceptions > Critical Alerts",
      now: "Resolver alertas com dono, prazo e escalacao.",
      important: "Criticos sem responsavel exigem acao imediata.",
      level: "critical"
    },
    "/admin-clients": {
      where: "Knowledge > Client Records",
      now: "Atualizar registos e preparar decisoes operacionais.",
      important: "Clientes sem dados completos bloqueiam execucao.",
      level: "warning"
    },
    "/admin-rounds": {
      where: "Operations > Scheduling",
      now: "Atribuir cobertura e balancear carga de equipa.",
      important: "Rondas sem tecnico comprometem SLA.",
      level: "warning"
    },
    "/admin-pools": {
      where: "Operations > Assets",
      now: "Garantir que cada unidade esta atribuida e ativa.",
      important: "Unidades sem cliente/ronda geram risco operacional.",
      level: "warning"
    },
    "/admin-inventory": {
      where: "Operations > Assets",
      now: "Controlar entrada, transferencias e consumo com rastreio.",
      important: "Ruptura de stock impacta execucao de campo.",
      level: "warning"
    }
  };

  const activePath = Object.keys(contextByRoute).find((path) => location.pathname.startsWith(path)) || "/admin-master-control";
  const context = contextByRoute[activePath] || contextByRoute["/admin-master-control"];

  const domains = [
    { label: "Home", href: "/admin-master-control", match: "/admin-master-control" },
    { label: "Today", href: "/admin-today", match: "/admin-today" },
    { label: "Operations", href: "/admin-rounds", match: "/admin-rounds|/admin-pools|/admin-inventory|/admin-visits|/admin-vehicles|/admin-technicians" },
    { label: "Exceptions", href: "/admin-alerts", match: "/admin-alerts|/admin-priority" },
    { label: "Communication", href: "/chat", match: "/chat|/admin-notifications|/admin-email-logs" },
    { label: "Knowledge", href: "/admin-clients", match: "/admin-clients|/admin-crm|/admin-service-log" },
    { label: "Control", href: "/admin-operational-settings", match: "/admin-operational-settings|/admin-reports|/admin-security" }
  ];

  const shell = document.createElement("header");
  shell.className = "cwos-admin-shell";

  const navLinks = domains
    .map((domain) => {
      const active = new RegExp(domain.match).test(location.pathname) ? " is-active" : "";
      return `<a class="${active.trim()}" href="${domain.href}">${domain.label}</a>`;
    })
    .join("");

  shell.innerHTML = `
    <div class="cwos-admin-shell-inner">
      <div class="cwos-admin-brand">
        <img src="/logo-cristalwater.png" alt="Cristal Water">
        <div>
          <strong>Crystal OS Admin</strong>
          <span>Workflow-first operating system</span>
        </div>
      </div>
      <nav class="cwos-admin-domain-nav" aria-label="Dominios Crystal OS">${navLinks}</nav>
      <div class="cwos-admin-actions">
        <a href="/admin-master-control">Fila diaria</a>
        <a href="/admin-alerts">Criticos</a>
      </div>
    </div>
  `;

  document.body.classList.add("cwos-admin-body");
  document.body.prepend(shell);

  const main = document.querySelector("main.page") || document.querySelector("main");
  if (!main) return;

  const contextStrip = document.createElement("section");
  contextStrip.className = "cwos-admin-context";

  const importanceClass = context.level === "critical" ? "is-critical" : "is-warning";
  contextStrip.innerHTML = `
    <article>
      <small>Where am I?</small>
      <strong>${context.where}</strong>
    </article>
    <article>
      <small>What should I do now?</small>
      <strong>${context.now}</strong>
    </article>
    <article class="${importanceClass}">
      <small>What is most important?</small>
      <strong>${context.important}</strong>
    </article>
  `;

  main.prepend(contextStrip);
})();
