(function(){
  const topics = {
    operationalFlow: {
      title: "Fluxo Operacional Guiado",
      summary: "Linha obrigatória: cliente → piscina/jacuzzi → ficha técnica → ronda → técnico → visita → reparação/orçamento → fatura → pagamento.",
      detail: "Use este módulo para criar e testar a operação completa sem perder dados entre módulos. Se faltar ronda, técnico ou financeiro, o sistema cria uma pendência visível para o admin.",
      actions: ["Criar cliente", "Adicionar piscina", "Atribuir ronda", "Atribuir técnico", "Gerar visita", "Faturar e fechar"]
    },
    dashboard: {
      title: "Centro de Operações",
      summary: "Painel central para acompanhar a operação em tempo real: técnicos, visitas, alertas, mapa, produtividade e finanças.",
      detail: "Use este ecrã como sala de comando. Ele mostra o que está a acontecer agora, o que está atrasado, onde estão os técnicos, quais visitas estão críticas e qual o impacto financeiro. A evolução ideal é permitir personalização dos widgets, alertas preditivos e comandos rápidos.",
      actions: ["Ver KPIs", "Abrir mapa live", "Analisar alertas", "Ver timeline operacional"]
    },
    aiOps: {
      title: "IA Operacional Admin",
      summary: "Chat interno só para administradores, com contexto da plataforma, recomendações e propostas de ação com aprovação humana.",
      detail: "A IA Operacional é uma camada de apoio à decisão. Pode resumir a operação, preparar tarefas, recomendar prioridades, sugerir mudanças de rondas, preparar rascunhos de faturas/orçamentos e criar recomendações para técnicos. Por segurança, ações que alterem dados ou enviem informação ficam pendentes até aprovação de um administrador.",
      actions: ["Perguntar à IA", "Rever recomendações", "Aprovar ações", "Criar tarefa", "Preparar fatura/orçamento"]
    },
    rounds: {
      title: "Gestão de Rondas",
      summary: "Planeamento semanal das rotas: dias, técnicos, piscinas, ordem de visita e geração automática de visitas.",
      detail: "As rondas são a base operacional da Cristal Water. Uma ronda define que piscinas entram em cada dia, quem as executa e em que ordem. No futuro pode evoluir para otimização automática por distância, prioridade, tempo estimado, químicos necessários, trânsito e disponibilidade dos técnicos.",
      actions: ["Criar ronda", "Atribuir técnico", "Atribuir piscinas", "Gerar semana", "Reordenar paragens"]
    },
    visits: {
      title: "Visitas / Serviços",
      summary: "Controlo do ciclo de cada visita: planeada, aceite, em execução, concluída, cancelada ou adiada.",
      detail: "Cada visita deve gerar histórico técnico, fotografias, medições da água, produtos usados, alertas, tempo real de execução e informação para faturação. Este módulo liga o trabalho de campo ao dashboard, relatórios, cliente e financeiro.",
      actions: ["Criar visita", "Iniciar", "Concluir", "Adicionar fotos", "Gerar relatório"]
    },
    technicians: {
      title: "Técnicos",
      summary: "Gestão da equipa de campo, localização, produtividade, custos, PINs e disponibilidade.",
      detail: "Aqui controlas quem está ativo, que técnico está em cada ronda, custos por visita/hora, produtividade e localização. Futuramente pode incluir avaliação de performance, carga de trabalho, competências e disponibilidade inteligente.",
      actions: ["Criar técnico", "Associar a ronda", "Ver GPS", "Analisar produtividade"]
    },
    clients: {
      title: "Clientes",
      summary: "Base de dados dos clientes, contactos, moradas, condições de pagamento, acessos e histórico.",
      detail: "A ficha do cliente deve concentrar tudo: piscinas, visitas, mensagens, pagamentos, faturas, preferências, contratos, notas internas e alertas. É o Lembretes central do sistema.",
      actions: ["Abrir ficha", "Ver piscinas", "Ver pagamentos", "Enviar mensagem"]
    },
    pools: {
      title: "Piscinas",
      summary: "Ficha técnica de cada piscina: localização, equipamento, volume, frequência, histórico e alertas.",
      detail: "Cada piscina deve ter dados técnicos completos: bomba, filtro, luzes, sal, areia, produtos, medições históricas, fotos, avarias e notas de acesso. Isto permite recomendações, manutenção preventiva e relatórios profissionais.",
      actions: ["Editar piscina", "Ver equipamento", "Ver histórico", "Agendar visita"]
    },
    finance: {
      title: "Financeiro / Cobranças",
      summary: "Gestão de mensalidades, faturas, pagamentos, dívidas, extras e lucro operacional.",
      detail: "O financeiro deve estar ligado ao trabalho concluído. Visitas, reparações, químicos, extras e contratos devem alimentar faturas e relatórios de rentabilidade. A evolução ideal é ter aging de dívida, avisos automáticos e exportação contabilística.",
      actions: ["Ver cobranças", "Emitir fatura", "Registar pagamento", "Exportar"]
    },
    invoices: {
      title: "Faturas",
      summary: "Criação, consulta e envio de faturas ligadas a visitas, mensalidades e reparações.",
      detail: "As faturas devem puxar automaticamente dados de visitas concluídas, extras aprovados e reparações. A IA pode preparar rascunhos, mas o envio externo deve exigir aprovação humana.",
      actions: ["Gerar fatura", "Enviar", "Marcar paga", "Exportar PDF"]
    },
    alerts: {
      title: "Alertas / Notificações",
      summary: "Centro de avisos críticos: avarias, acessos bloqueados, visitas atrasadas, dívida, químicos e riscos.",
      detail: "Os alertas devem ser priorizados por severidade e impacto. Um alerta crítico deve aparecer no dashboard, notificar admin/técnico e criar histórico até ser resolvido.",
      actions: ["Abrir alerta", "Resolver", "Escalar", "Criar tarefa"]
    },
    map: {
      title: "Mapa Live / GPS",
      summary: "Mapa operacional com técnicos, piscinas, rotas, zonas e estado das visitas.",
      detail: "O mapa deve permitir ver técnicos em tempo real, próximas visitas, atrasos, zonas com maior carga, histórico de deslocações e sugestões de rota. É essencial para despacho operacional.",
      actions: ["Ver técnicos", "Ver rota", "Abrir visita", "Otimizar"]
    },
    chat: {
      title: "Chat / Comunicação",
      summary: "Mensagens realtime entre administração, técnicos e clientes, com histórico e anexos.",
      detail: "O chat deve guardar contexto por cliente, piscina, serviço ou reparação. Futuramente pode sugerir respostas, criar tarefas a partir de mensagens e anexar fotos a relatórios.",
      actions: ["Enviar mensagem", "Anexar foto", "Marcar visto", "Criar tarefa"]
    },
    reports: {
      title: "Relatórios",
      summary: "Relatórios técnicos, financeiros e operacionais para clientes, condomínios e gestão interna.",
      detail: "Relatórios bons reduzem chamadas e dúvidas dos clientes. Devem incluir fotos, químicos, tarefas, avarias, recomendações, custos e assinatura/validação quando necessário.",
      actions: ["Gerar relatório", "Exportar PDF", "Enviar cliente", "Ver histórico"]
    },
    incidents: {
      title: "Incident Center",
      summary: "Gestão de incidentes críticos, escalamentos, SLA, risco operacional e resolução.",
      detail: "Um incidente é mais grave que um alerta normal. Deve ter dono, prioridade, timeline, estado, impacto, SLA e resolução documentada. Ideal para avarias críticas, reclamações e falhas operacionais.",
      actions: ["Criar incidente", "Atribuir", "Escalar", "Resolver"]
    },
    inventory: {
      title: "Stock / Guias / Viaturas",
      summary: "Gestão de químicos, peças, equipamentos, guias de transporte e consumos por técnico/viatura.",
      detail: "Este módulo evita perda de material e melhora a rentabilidade. Cada consumo em visita deve reduzir stock da viatura e alimentar custos, faturas e reposição de armazém.",
      actions: ["Ver stock", "Criar guia", "Carregar viatura", "Registar consumo"]
    },
    customerPortal: {
      title: "Portal Cliente",
      summary: "Área onde o cliente vê serviços, fotos, relatórios, pagamentos, notificações e mensagens.",
      detail: "O portal cliente aumenta transparência. O cliente deve conseguir consultar visitas concluídas, ver fotos, relatórios, valores pendentes e comunicar com a empresa sem depender de chamadas soltas.",
      actions: ["Ver histórico", "Ver pagamentos", "Enviar mensagem", "Abrir relatório"]
    },
    ai: {
      title: "AI / Inteligência Operacional",
      summary: "Camada de recomendações, scoring, previsão de risco, prioridades e automação controlada.",
      detail: "A IA deve ajudar a decidir o que fazer primeiro: visitas em risco, técnicos sobrecarregados, clientes com problemas repetidos, dívidas, atrasos, químicos fora do padrão e rotas pouco eficientes.",
      actions: ["Ver score", "Aplicar sugestão", "Priorizar", "Criar alerta"]
    },
    aiAdmin: {
      title: "IA Operacional Admin",
      summary: "Chat interno para administradores com leitura da plataforma, recomendações e ações pendentes de aprovação.",
      detail: "A IA operacional funciona como copiloto: analisa visitas, rondas, técnicos, cobranças, alertas e reparações. Pode preparar tarefas, notificações, rascunhos de contas, orçamentos, visitas e alterações de ronda, mas as ações críticas ficam pendentes até aprovação humana. A emissão fiscal real deve passar por software certificado/integração apropriada.",
      actions: ["Perguntar prioridades", "Gerar recomendações", "Preparar ação", "Aprovar execução", "Auditar histórico"]
    },
    help: {
      title: "Ajuda Contextual",
      summary: "Passa o cursor por cima de uma função para ver uma explicação curta. Abre o painel para detalhes.",
      detail: "Este sistema ensina o utilizador dentro da própria aplicação. Funciona com tooltips, painel lateral, centro de ajuda e comando rápido CTRL/CMD+K.",
      actions: ["Pesquisar ajuda", "Abrir tópico", "Ver atalhos", "Aprender fluxo"]
    },
    themes: {
      title: "Temas / Aparência",
      summary: "Escolhe entre tema escuro futurista, meio termo ou claro, além da densidade de informação.",
      detail: "Este módulo permite adaptar a aplicação ao contexto de trabalho: escuro para monitorização e uso prolongado, meio termo para equilíbrio diário e claro para escritório/impressões. A densidade compacta mostra mais informação no ecrã; a grande facilita utilização em campo.",
      actions: ["Trocar tema", "Alterar densidade", "Guardar preferência", "Abrir configurações"]
    },
    default: {
      title: "Função Cristal Water",
      summary: "Elemento do sistema operacional Cristal Water. Usa a ajuda para perceber a função e o fluxo correto.",
      detail: "Esta função faz parte da plataforma enterprise. Se for uma ação, verifica o contexto antes de executar. Se for um painel, usa-o para análise e tomada de decisão.",
      actions: ["Ver ajuda", "Abrir menu", "Consultar documentação"]
    }
  };

  const quickActions = [
    { label: "Centro de Operações", icon: "🧭", href: "/admin-master-control", topic: "operationalFlow" },
    { label: "Dashboard", icon: "🧠", href: "/admin-dashboard", topic: "dashboard" },
    { label: "IA Operacional", icon: "🤖", href: "/admin-ai", topic: "aiAdmin" },
    { label: "Assistente interno", icon: "🤖", href: "/admin-ai", topic: "aiOps" },
    { label: "Rondas", icon: "🛰️", href: "/admin-rounds", topic: "rounds" },
    { label: "Visitas", icon: "📄", href: "/admin-visits-dashboard", topic: "visits" },
    { label: "Mapa", icon: "🌍", href: "/admin-live-map", topic: "map" },
    { label: "Técnicos", icon: "👷", href: "/admin-technicians", topic: "technicians" },
    { label: "Clientes", icon: "👥", href: "/admin-clients", topic: "clients" },
    { label: "Piscinas", icon: "💧", href: "/admin-pools", topic: "pools" },
    { label: "Financeiro", icon: "💶", href: "/billing", topic: "finance" },
    { label: "Incidentes", icon: "🚨", href: "/incident-center", topic: "incidents" },
    { label: "Visual", icon: "🎨", href: "/admin-ui-settings", topic: "themes" },
    { label: "Ajuda", icon: "❔", href: "/help-center", topic: "help" }
  ];

  window.CRISTAL_HELP_TOPICS = topics;
  window.CRISTAL_QUICK_ACTIONS = quickActions;
})();

window.CRISTAL_HELP_TOPICS = window.CRISTAL_HELP_TOPICS || {};
window.CRISTAL_HELP_TOPICS.vehicles = { title:"Frota, Guias e Stock", body:"Gestão de viaturas, guias de transporte AT, guias de obra diárias, consumos de químicos/material, manutenção e histórico de movimentos por viatura." };
