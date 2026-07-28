(function () {
  if (window.__CW_V2_PHASE2_NAV__) return;
  window.__CW_V2_PHASE2_NAV__ = true;

  const pathname = String(location.pathname || '/').replace(/\.html$/i, '').toLowerCase();
  const isAuthPage = ['/login', '/admin-login', '/technician-login', '/client-login'].includes(pathname);

  const roleForPath = (() => {
    if (pathname.startsWith('/technician')) return 'TECHNICIAN';
    if (pathname.startsWith('/client')) return 'CLIENT';
    return 'ADMIN';
  })();

  const PAGE_META = {
    '/admin-master-control': { area: 'Visao geral', title: 'Centro de operacoes' },
    '/admin-dashboard': { area: 'Visao geral', title: 'Dashboard administrativo' },
    '/admin-today': { area: 'Operacao', title: 'Resumo do dia' },
    '/admin-visits': { area: 'Operacao', title: 'Gestao de visitas' },
    '/admin-rounds': { area: 'Operacao', title: 'Rotas e rondas' },
    '/admin-live-map': { area: 'Operacao', title: 'Mapa operacional' },
    '/admin-clients': { area: 'Clientes', title: 'Lista de clientes' },
    '/admin-pools': { area: 'Piscinas', title: 'Lista de piscinas' },
    '/admin-pool-technical': { area: 'Piscinas', title: 'Ficha tecnica' },
    '/admin-technicians': { area: 'Tecnicos e equipa', title: 'Equipa tecnica' },
    '/admin-vehicles': { area: 'Tecnicos e equipa', title: 'Viaturas' },
    '/admin-crm': { area: 'Comercial', title: 'CRM e oportunidades' },
    '/billing': { area: 'Faturacao e financeiro', title: 'Visao financeira' },
    '/billing-center': { area: 'Faturacao e financeiro', title: 'Centro de cobrancas' },
    '/invoices': { area: 'Faturacao e financeiro', title: 'Faturas' },
    '/admin-payments': { area: 'Faturacao e financeiro', title: 'Pagamentos' },
    '/admin-inventory': { area: 'Stock e produtos', title: 'Stock e movimentos' },
    '/admin-suppliers': { area: 'Stock e produtos', title: 'Fornecedores' },
    '/admin-collection': { area: 'Faturacao e financeiro', title: 'Contas correntes' },
    '/admin-email-logs': { area: 'Comunicacao', title: 'Logs de email' },
    '/communications': { area: 'Comunicacao', title: 'Comunicacoes' },
    '/chat': { area: 'Comunicacao', title: 'Chat interno' },
    '/admin-reports': { area: 'Relatorios e estatisticas', title: 'Relatorios' },
    '/report-center': { area: 'Relatorios e estatisticas', title: 'Centro de relatorios' },
    '/settings': { area: 'Configuracoes', title: 'Configuracoes' },
    '/admin-security': { area: 'Configuracoes', title: 'Permissoes e seguranca' },
    '/technician-field-mode': { area: 'Tecnico em campo', title: 'Rota do dia' },
    '/technician-route': { area: 'Tecnico em campo', title: 'Sequencia da rota' },
    '/technician-visit': { area: 'Tecnico em campo', title: 'Execucao da visita' },
    '/technician-map': { area: 'Tecnico em campo', title: 'Navegacao GPS' },
    '/technician-guide': { area: 'Tecnico em campo', title: 'Guias e logistica' },
    '/client-portal': { area: 'Portal do cliente', title: 'Estado da piscina' },
    '/client-dashboard': { area: 'Portal do cliente', title: 'Proximas e ultimas visitas' },
    '/client-history': { area: 'Portal do cliente', title: 'Historico tecnico' },
    '/client-payments': { area: 'Portal do cliente', title: 'Pagamentos e faturas' },
    '/client-notifications': { area: 'Portal do cliente', title: 'Mensagens e notificacoes' },
    '/client-menu': { area: 'Portal do cliente', title: 'Pedidos e orcamentos' }
  };

  const NAV = {
    ADMIN: {
      title: 'Administrador',
      groups: [
        { label: '1. Visao geral', links: [
          ['/admin-master-control', 'Centro de operacoes'],
          ['/admin-today', 'Resumo do dia'],
          ['/admin-dashboard', 'Indicadores principais'],
          ['/admin-alerts', 'Alertas operacionais'],
          ['/alerts-financial', 'Alertas financeiros'],
          ['/operational-dashboard', 'Estado geral do sistema']
        ]},
        { label: '2. Operacao', links: [
          ['/admin-visits', 'Visitas'],
          ['/admin-visits-dashboard', 'Painel de visitas'],
          ['/admin-rounds', 'Rotas e rondas'],
          ['/admin-live-map', 'Mapa e localizacao'],
          ['/incident-center', 'Ocorrencias'],
          ['/admin-service-log', 'Historico operacional']
        ]},
        { label: '3. Clientes', links: [
          ['/admin-clients', 'Lista e pesquisa'],
          ['/admin-client-settings', 'Preferencias e comunicacao'],
          ['/admin-crm', 'Pedidos e oportunidades'],
          ['/communications', 'Historico de comunicacoes']
        ]},
        { label: '4. Piscinas', links: [
          ['/admin-pools', 'Lista de piscinas'],
          ['/admin-pool-technical', 'Ficha tecnica e equipamentos'],
          ['/admin-pool-calculator', 'Analise da agua'],
          ['/admin-keys', 'Chaves e acessos'],
          ['/admin-map', 'Localizacao']
        ]},
        { label: '5. Tecnicos e equipa', links: [
          ['/admin-technicians', 'Tecnicos'],
          ['/admin-vehicles', 'Viaturas'],
          ['/technician-guide', 'Guias de obra'],
          ['/technician-guide?tab=transport', 'Guias de transporte'],
          ['/technician-gps', 'Localizacao em campo']
        ]},
        { label: '6. Comercial', links: [
          ['/admin-crm', 'CRM comercial'],
          ['/admin-onboarding', 'Onboarding de contratos'],
          ['/admin-alerts?scope=repairs', 'Reparacoes'],
          ['/admin-company-closures', 'Obras']
        ]},
        { label: '7. Faturacao e financeiro', links: [
          ['/billing', 'Resumo financeiro'],
          ['/billing-center', 'Centro de cobranca'],
          ['/invoices', 'Faturas'],
          ['/admin-payments', 'Pagamentos'],
          ['/admin-collection', 'Conta corrente'],
          ['/billing-history', 'Historico'],
          ['/to-issue', 'Pendencias'],
          ['/admin-payment-settings', 'Parametros financeiros']
        ]},
        { label: '8. Stock e produtos', links: [
          ['/admin-inventory', 'Stock geral'],
          ['/admin-inventory?tab=products', 'Produtos e categorias'],
          ['/admin-inventory?tab=movements', 'Movimentos'],
          ['/admin-suppliers', 'Fornecedores']
        ]},
        { label: '9. Equipamentos', links: [
          ['/admin-pool-technical', 'Equipamentos por piscina'],
          ['/admin-service-log', 'Manutencoes e avarias'],
          ['/admin-alerts?scope=repairs', 'Alertas tecnicos']
        ]},
        { label: '10. Obras e logistica', links: [
          ['/admin-company-closures', 'Planeamento operacional'],
          ['/technician-guide', 'Guias e assinaturas'],
          ['/admin-vehicles', 'Frota']
        ]},
        { label: '11. Comunicacao', links: [
          ['/chat', 'Chat interno'],
          ['/communications', 'Chat com clientes'],
          ['/admin-notifications', 'Notificacoes'],
          ['/config-notifications', 'Modelos e regras'],
          ['/admin-email-logs', 'Historico email']
        ]},
        { label: '12. Relatorios e estatisticas', links: [
          ['/admin-reports', 'Relatorios operacionais'],
          ['/report-center', 'Centro de exportacao'],
          ['/report-settings', 'Configuracao de relatorios'],
          ['/metrics', 'Metricas'],
          ['/ranking', 'Ranking de produtividade']
        ]},
        { label: '13. Configuracoes', links: [
          ['/admin-operational-settings', 'Configuracoes gerais'],
          ['/settings', 'Parametros do sistema'],
          ['/admin-security', 'Utilizadores e permissoes'],
          ['/admin-ui-settings', 'Tema e interface'],
          ['/help-center', 'Ajuda']
        ]}
      ],
      mobile: [
        ['/admin-master-control', 'Home'],
        ['/admin-visits', 'Visitas'],
        ['/admin-clients', 'Clientes'],
        ['/billing-center', 'Financeiro'],
        ['#menu', 'Menu']
      ]
    },
    TECHNICIAN: {
      title: 'Tecnico',
      groups: [
        { label: 'Hoje', links: [
          ['/technician-field-mode', 'Rota do dia'],
          ['/technician-route', 'Proxima piscina'],
          ['/technician-visit', 'Iniciar / concluir visita'],
          ['/technician-map', 'Navegacao GPS'],
          ['/technician-field-mode#syncPhotosBtn', 'Offline e sincronizacao']
        ]},
        { label: 'Trabalho em campo', links: [
          ['/admin-pools', 'Dados essenciais da piscina'],
          ['/admin-pool-technical', 'Equipamentos e alertas'],
          ['/admin-alerts?scope=repairs', 'Avarias e reparacoes'],
          ['/admin-inventory?tab=products', 'Produtos utilizados']
        ]},
        { label: 'Logistica', links: [
          ['/technician-guide', 'Guia de trabalho'],
          ['/technician-guide?tab=transport', 'Guia de transporte'],
          ['/admin-vehicles', 'Viatura'],
          ['/technician-gps', 'Posicao GPS']
        ]},
        { label: 'Conta', links: [
          ['/technician', 'Historico recente'],
          ['/notifications', 'Notificacoes'],
          ['/technician-login', 'Perfil e sessao']
        ]}
      ],
      mobile: [
        ['/technician-field-mode', 'Home'],
        ['/technician-route', 'Rota'],
        ['/technician-visit', 'Visita'],
        ['/technician-map', 'GPS'],
        ['#menu', 'Menu']
      ]
    },
    CLIENT: {
      title: 'Cliente',
      groups: [
        { label: 'Portal do cliente', links: [
          ['/client-portal', 'Estado da piscina'],
          ['/client-dashboard', 'Ultima e proxima visita'],
          ['/client-history', 'Relatorios e fotografias'],
          ['/client-payments', 'Pagamentos e faturas'],
          ['/client-notifications', 'Mensagens e notificacoes'],
          ['/client-menu', 'Pedidos e orcamentos'],
          ['/client', 'Conta e dados'],
          ['/client_chat', 'Chat'],
          ['/client_tech', 'Detalhe tecnico']
        ]}
      ],
      mobile: [
        ['/client-portal', 'Pool'],
        ['/client-dashboard', 'Visitas'],
        ['/client-payments', 'Pagamentos'],
        ['/client-menu', 'Pedidos'],
        ['#menu', 'Menu']
      ]
    }
  };

  function flatLinks(config) {
    return config.groups.flatMap((group) => group.links);
  }

  function isActive(url) {
    const clean = String(url || '').split('?')[0].replace(/\.html$/i, '').toLowerCase();
    return clean && clean === pathname;
  }

  function computeMeta(role) {
    const fromTable = PAGE_META[pathname];
    if (fromTable) return fromTable;

    const config = NAV[role] || NAV.ADMIN;
    for (const group of config.groups) {
      for (const [href, label] of group.links) {
        if (isActive(href)) {
          return { area: group.label.replace(/^\d+\.\s*/, ''), title: label };
        }
      }
    }

    return {
      area: role === 'TECHNICIAN' ? 'Tecnico em campo' : role === 'CLIENT' ? 'Portal do cliente' : 'Administracao',
      title: pathname.replace(/^\//, '').replace(/-/g, ' ') || 'inicio'
    };
  }

  function createGroup(group) {
    const details = document.createElement('details');
    details.className = 'cw-v2-nav-group';
    details.open = true;

    const summary = document.createElement('summary');
    summary.textContent = group.label;
    details.appendChild(summary);

    const links = document.createElement('div');
    links.className = 'cw-v2-nav-links cw-v2-nav';

    group.links.forEach(([href, label]) => {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      a.setAttribute('data-shell-search', label);
      if (isActive(href)) a.classList.add('is-active');
      links.appendChild(a);
    });

    details.appendChild(links);
    return details;
  }

  function buildShell(role) {
    const config = NAV[role] || NAV.ADMIN;
    const meta = computeMeta(role);

    const sidebar = document.createElement('aside');
    sidebar.className = 'cw-v2-sidebar cw-v2-shell-sidebar';
    sidebar.innerHTML = '<div class="cw-v2-brand"><img src="/logo-cristalwater.png" alt="Cristal Water"><div><b>Crystal OS V2</b><small>' + config.title + '</small></div></div>';

    const nav = document.createElement('nav');
    nav.className = 'cw-v2-nav-groups';
    nav.setAttribute('aria-label', 'Navegacao principal V2');
    config.groups.forEach((group) => nav.appendChild(createGroup(group)));
    sidebar.appendChild(nav);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'Fluxo operacional unificado.';
    subtitle.style.color = '#9fb1ca';
    subtitle.style.fontSize = '12px';
    sidebar.appendChild(subtitle);

    const topWrap = document.createElement('div');
    topWrap.className = 'cw-v2-shell-topbar';

    const top = document.createElement('header');
    top.className = 'cw-v2-topbar';
    top.innerHTML = '<div class="cw-v2-context"><div class="cw-v2-context-kicker">' + meta.area + '</div><div class="cw-v2-context-title">' + meta.title + '</div><div class="cw-v2-breadcrumb" data-cw-breadcrumb>' + config.title + ' / ' + meta.area + ' / ' + meta.title + '</div></div><div class="cw-v2-search"><input type="search" placeholder="Pesquisar modulos, clientes, visitas" data-cw-search-input><span class="icon">⌕</span><div class="cw-v2-search-results" data-cw-search-results></div></div><div class="cw-v2-top-actions"><span class="cw-v2-pill success" data-offline-indicator>Online</span><button type="button" class="cw-v2-pill" data-cw-open-drawer>Menu</button></div>';
    topWrap.appendChild(top);

    const drawer = document.createElement('aside');
    drawer.className = 'cw-v2-drawer';
    drawer.setAttribute('data-cw-drawer', '');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = '<div class="cw-v2-drawer-backdrop" data-cw-drawer-backdrop></div><div class="cw-v2-drawer-panel" role="dialog" aria-modal="true" aria-label="Menu completo"><div class="cw-v2-drawer-head"><div class="cw-v2-drawer-title">Menu</div><button class="cw-v2-drawer-close" data-cw-close-drawer type="button" aria-label="Fechar">X</button></div><nav class="cw-v2-nav-groups" data-cw-drawer-groups></nav></div>';

    const drawerGroups = drawer.querySelector('[data-cw-drawer-groups]');
    config.groups.forEach((group) => drawerGroups.appendChild(createGroup(group)));

    const mobile = document.createElement('nav');
    mobile.className = 'cw-v2-mobile-primary';
    mobile.setAttribute('aria-label', 'Navegacao primaria mobile');
    config.mobile.forEach(([href, label]) => {
      if (href === '#menu') {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.setAttribute('data-cw-open-drawer', '');
        mobile.appendChild(button);
        return;
      }
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      if (isActive(href)) a.classList.add('is-active');
      mobile.appendChild(a);
    });

    document.body.prepend(sidebar);
    document.body.prepend(topWrap);
    document.body.appendChild(drawer);
    document.body.appendChild(mobile);

    document.body.classList.add('cw-v2-shell-enabled');
    document.body.setAttribute('data-cw-role', role);
  }

  function normalizeLinks() {
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http')) return;
      a.setAttribute('href', href.replace(/\.html$/i, ''));
    });
  }

  function ensureStatusSlots() {
    const pages = document.querySelectorAll('.empty,.status,[data-state]');
    pages.forEach((n) => {
      const text = String(n.textContent || '').toLowerCase();
      if (text.includes('erro')) n.setAttribute('data-state', 'error');
      if (text.includes('sucesso')) n.setAttribute('data-state', 'success');
      if (text.includes('carregar') || text.includes('loading')) n.setAttribute('data-state', 'loading');
      if (text.includes('offline')) n.setAttribute('data-state', 'offline');
      if (text.includes('vazio') || text.includes('sem ')) n.setAttribute('data-state', 'empty');
    });
  }

  function removeLegacyShell() {
    const selectors = ['.cw-side', '.cw-global-bar', '#cwTopAdminModules', '.cw-theme-fab', '.cw-theme-panel', '.cwos-admin-shell', '.cwos-admin-context', '.cw-mobile-menu-toggle', '.cw-mobile-sidebar-backdrop', '#cw-enterprise-sidebar-style'];
    selectors.forEach((sel) => document.querySelectorAll(sel).forEach((n) => n.remove()));
    document.body.classList.remove('cw-enterprise-theme', 'cw-admin-app', 'cw-client-app', 'cw-with-sidebar', 'cw-sidebar-pinned', 'cw-sidebar-compact', 'cw-mobile-sidebar-open');
  }

  function boot() {
    removeLegacyShell();
    normalizeLinks();
    ensureStatusSlots();
    if (!isAuthPage && !document.querySelector('.cw-v2-sidebar')) {
      buildShell(roleForPath);
    }
    // Old shell scripts can inject legacy UI asynchronously; remove it again shortly after boot.
    setTimeout(removeLegacyShell, 0);
    setTimeout(removeLegacyShell, 500);
    setTimeout(removeLegacyShell, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
