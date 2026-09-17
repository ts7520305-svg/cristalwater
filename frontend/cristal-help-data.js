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

  topics.vehicles = { title: 'Frota, Guias e Stock', summary: 'Viaturas, documentos e movimentos de material.', detail: 'Consulte as guias, a viatura e o histórico de movimentos. Confirme a origem e a data dos documentos antes de os utilizar.', actions: [], href: '/admin-vehicles' };
  topics.settings = { title: 'Configurações operacionais', summary: 'Controlos da operação e avisos de manutenção.', detail: 'Abra as configurações e confirme a gravação de cada alteração. As preferências de som da sua conta têm uma página própria.', actions: [], href: '/admin-operational-settings' };
  for (const action of quickActions) if (topics[action.topic]) topics[action.topic].href = action.href;

  const words = {
    pt: { title: 'Centro de Ajuda Cristal Water', intro: 'Guias e atalhos para o seu perfil. Use Ctrl/Cmd+K para pesquisar os atalhos.', search: 'Pesquisar ajuda', empty: 'Nenhum tópico corresponde à pesquisa.', unavailable: 'Este tópico não está disponível para o seu perfil. Escolha outro tópico.', session: 'A sessão mudou ou terminou. Abra novamente a ajuda depois de entrar na conta pretendida.', open: 'Abrir página', actions: 'Ações principais', full: 'Abrir centro completo', close: 'Fechar', command: 'Comando rápido', hover: 'Mostrar dicas ao manter o cursor', press: 'No telemóvel, mantenha o elemento premido durante três segundos.', help: 'Ajuda', helpSummary: 'Escolha um tópico ou procure um atalho.', helpDetail: 'A ajuda apresenta apenas os percursos do seu perfil. Antes de agir, confirme a conta, o dia e o registo selecionado.' },
    en: { title: 'Cristal Water Help Centre', intro: 'Guides and shortcuts for your role. Use Ctrl/Cmd+K to search shortcuts.', search: 'Search help', empty: 'No topics match your search.', unavailable: 'This topic is unavailable for your role. Choose another topic.', session: 'The session changed or ended. Reopen help after signing in to the intended account.', open: 'Open page', actions: 'Main actions', full: 'Open full help centre', close: 'Close', command: 'Quick commands', hover: 'Show tips on prolonged hover', press: 'On mobile, press and hold the element for three seconds.', help: 'Help', helpSummary: 'Choose a topic or find a shortcut.', helpDetail: 'Help shows the routes available to your role. Before acting, check the account, date and selected record.' },
    es: { title: 'Centro de ayuda Cristal Water', intro: 'Guías y accesos para su perfil. Use Ctrl/Cmd+K para buscar accesos.', search: 'Buscar ayuda', empty: 'Ningún tema coincide con la búsqueda.', unavailable: 'Este tema no está disponible para su perfil. Elija otro tema.', session: 'La sesión cambió o terminó. Abra la ayuda después de entrar en la cuenta deseada.', open: 'Abrir página', actions: 'Acciones principales', full: 'Abrir el centro completo', close: 'Cerrar', command: 'Comandos rápidos', hover: 'Mostrar consejos al mantener el cursor', press: 'En el móvil, mantenga pulsado el elemento durante tres segundos.', help: 'Ayuda', helpSummary: 'Elija un tema o busque un acceso.', helpDetail: 'La ayuda muestra las rutas de su perfil. Antes de actuar, compruebe la cuenta, la fecha y el registro seleccionado.' },
    fr: { title: 'Centre d’aide Cristal Water', intro: 'Guides et raccourcis pour votre profil. Utilisez Ctrl/Cmd+K pour chercher un raccourci.', search: 'Rechercher dans l’aide', empty: 'Aucun sujet ne correspond à la recherche.', unavailable: 'Ce sujet est indisponible pour votre profil. Choisissez un autre sujet.', session: 'La session a changé ou a expiré. Rouvrez l’aide après connexion au compte souhaité.', open: 'Ouvrir la page', actions: 'Actions principales', full: 'Ouvrir le centre complet', close: 'Fermer', command: 'Commandes rapides', hover: 'Afficher les conseils au survol prolongé', press: 'Sur mobile, maintenez l’élément enfoncé pendant trois secondes.', help: 'Aide', helpSummary: 'Choisissez un sujet ou un raccourci.', helpDetail: 'L’aide présente les parcours de votre profil. Avant toute action, vérifiez le compte, la date et la fiche sélectionnée.' },
    de: { title: 'Cristal Water Hilfezentrum', intro: 'Anleitungen und Verknüpfungen für Ihre Rolle. Suchen Sie mit Strg/Cmd+K nach Verknüpfungen.', search: 'Hilfe durchsuchen', empty: 'Keine passenden Themen gefunden.', unavailable: 'Dieses Thema ist für Ihre Rolle nicht verfügbar. Wählen Sie ein anderes Thema.', session: 'Die Sitzung wurde geändert oder beendet. Melden Sie sich mit dem gewünschten Konto an und öffnen Sie die Hilfe erneut.', open: 'Seite öffnen', actions: 'Wichtige Aktionen', full: 'Hilfezentrum öffnen', close: 'Schließen', command: 'Schnellbefehle', hover: 'Tipps bei längerem Verweilen anzeigen', press: 'Halten Sie das Element auf dem Mobilgerät drei Sekunden lang gedrückt.', help: 'Hilfe', helpSummary: 'Wählen Sie ein Thema oder eine Verknüpfung.', helpDetail: 'Die Hilfe zeigt die verfügbaren Seiten Ihrer Rolle. Prüfen Sie vor jeder Aktion Konto, Datum und ausgewählten Datensatz.' }
  };
  // Short task guides for the client and field surfaces. Administrative legacy
  // topics remain available only to ADMIN; these guides do not grant API access.
  const guideCopy = {
    pt: {
      customerPortal: ['A minha piscina', 'Consulte os dados e serviços associados à sua conta.', 'Abra o portal e confirme a piscina antes de consultar os registos.'],
      reports: ['Histórico de serviços', 'Consulte as visitas e os registos disponibilizados.', 'Abra o histórico e confirme a data da visita. Uma falha de consulta não significa que não existam serviços.'],
      finance: ['Pagamentos e faturas', 'Consulte os valores e os documentos da sua conta.', 'Verifique o documento e o saldo apresentados. Se a consulta falhar, atualize antes de concluir que está tudo pago.'],
      visits: ['Rota do dia', 'Abra as visitas atribuídas e confirme o dia selecionado.', 'Confirme a piscina e o tipo de visita antes de começar. Um pedido pendente não equivale a uma conclusão confirmada pelo servidor.'],
      vehicles: ['Guias e documentos', 'Consulte os documentos e o stock da viatura.', 'Verifique a viatura, a data e a indicação de origem. Uma cópia guardada pode não refletir as alterações mais recentes.'],
      safety: ['Alertas de campo', 'Consulte os avisos durante a visita e no fecho do dia.', 'Ler ou assumir um alerta não fecha a água nem altera a bomba. Resolva a causa e confirme o registo da operação.'],
      chat: ['Mensagens', 'Abra a conversa da sua conta ou equipa.', 'Aguarde a confirmação de envio. Se a resposta se perder, use a recuperação disponibilizada na conversa.'],
      alerts: ['Notificações', 'Consulte os avisos disponíveis para a sua conta.', 'Marcar um aviso como lido não resolve a ocorrência que lhe deu origem. Abra a operação correspondente.'],
      settings: ['O meu perfil', 'Consulte a conta e as opções disponíveis.', 'Confirme a identidade antes de mudar de conta. Os rascunhos e pedidos pendentes pertencem à conta que os criou.']
    },
    en: {
      customerPortal: ['My pool', 'View the details and services linked to your account.', 'Open the portal and check the pool before viewing its records.'],
      reports: ['Service history', 'View the available visits and records.', 'Open the history and check the visit date. A failed request does not mean there are no services.'],
      finance: ['Payments and invoices', 'View amounts and documents for your account.', 'Check the document and balance shown. If loading fails, refresh before assuming everything is paid.'],
      visits: ['Daily route', 'Open assigned visits and check the selected date.', 'Check the pool and visit type before starting. A pending request is not a completion confirmed by the server.'],
      vehicles: ['Guides and documents', 'View vehicle documents and stock.', 'Check the vehicle, date and source label. A saved copy may not include the latest changes.'],
      safety: ['Field alerts', 'Review warnings during visits and at the end of the day.', 'Reading or accepting an alert does not turn off water or change a pump. Address the cause and confirm the operation record.'],
      chat: ['Messages', 'Open the conversation for your account or team.', 'Wait for send confirmation. If the response is lost, use the recovery option in the conversation.'],
      alerts: ['Notifications', 'View the notices available to your account.', 'Marking a notice as read does not resolve its cause. Open the related operation.'],
      settings: ['My profile', 'View your account and available options.', 'Check your identity before switching accounts. Drafts and pending requests belong to the account that created them.']
    },
    es: {
      customerPortal: ['Mi piscina', 'Consulte los datos y servicios de su cuenta.', 'Abra el portal y compruebe la piscina antes de consultar los registros.'],
      reports: ['Historial de servicios', 'Consulte las visitas y los registros disponibles.', 'Abra el historial y compruebe la fecha. Un error de consulta no significa que no existan servicios.'],
      finance: ['Pagos y facturas', 'Consulte los importes y documentos de su cuenta.', 'Compruebe el documento y el saldo. Si la consulta falla, actualice antes de asumir que todo está pagado.'],
      visits: ['Ruta del día', 'Abra las visitas asignadas y compruebe la fecha.', 'Compruebe la piscina y el tipo de visita. Una solicitud pendiente no equivale a una finalización confirmada por el servidor.'],
      vehicles: ['Guías y documentos', 'Consulte los documentos y el stock del vehículo.', 'Compruebe el vehículo, la fecha y el origen. Una copia guardada puede no incluir los cambios recientes.'],
      safety: ['Alertas de campo', 'Revise los avisos durante la visita y al cerrar el día.', 'Leer o asumir una alerta no cierra el agua ni cambia la bomba. Resuelva la causa y confirme el registro.'],
      chat: ['Mensajes', 'Abra la conversación de su cuenta o equipo.', 'Espere la confirmación del envío. Si se pierde la respuesta, use la recuperación disponible en la conversación.'],
      alerts: ['Notificaciones', 'Consulte los avisos de su cuenta.', 'Marcar un aviso como leído no resuelve su causa. Abra la operación correspondiente.'],
      settings: ['Mi perfil', 'Consulte la cuenta y las opciones disponibles.', 'Compruebe la identidad antes de cambiar de cuenta. Los borradores y las solicitudes pendientes pertenecen a la cuenta que los creó.']
    },
    fr: {
      customerPortal: ['Ma piscine', 'Consultez les données et services de votre compte.', 'Ouvrez le portail et vérifiez la piscine avant de consulter les fiches.'],
      reports: ['Historique des services', 'Consultez les visites et les fiches disponibles.', 'Ouvrez l’historique et vérifiez la date. Un échec de chargement ne signifie pas une absence de services.'],
      finance: ['Paiements et factures', 'Consultez les montants et documents de votre compte.', 'Vérifiez le document et le solde affichés. En cas d’échec, actualisez avant de considérer que tout est payé.'],
      visits: ['Tournée du jour', 'Ouvrez les visites attribuées et vérifiez la date.', 'Vérifiez la piscine et le type de visite. Une demande en attente ne vaut pas une clôture confirmée par le serveur.'],
      vehicles: ['Bons et documents', 'Consultez les documents et le stock du véhicule.', 'Vérifiez le véhicule, la date et la provenance. Une copie enregistrée peut ne pas inclure les dernières modifications.'],
      safety: ['Alertes de terrain', 'Consultez les avertissements pendant la visite et en fin de journée.', 'Lire ou prendre en charge une alerte ne ferme pas l’eau et ne modifie pas la pompe. Traitez la cause et confirmez l’enregistrement.'],
      chat: ['Messages', 'Ouvrez la conversation de votre compte ou équipe.', 'Attendez la confirmation de l’envoi. En cas de réponse perdue, utilisez la récupération proposée dans la conversation.'],
      alerts: ['Notifications', 'Consultez les avis de votre compte.', 'Marquer un avis comme lu ne résout pas sa cause. Ouvrez l’opération correspondante.'],
      settings: ['Mon profil', 'Consultez le compte et les options disponibles.', 'Vérifiez l’identité avant de changer de compte. Les brouillons et demandes en attente appartiennent au compte qui les a créés.']
    },
    de: {
      customerPortal: ['Mein Pool', 'Sehen Sie die Daten und Leistungen Ihres Kontos.', 'Öffnen Sie das Portal und prüfen Sie den Pool, bevor Sie die Einträge ansehen.'],
      reports: ['Serviceverlauf', 'Sehen Sie verfügbare Besuche und Einträge.', 'Öffnen Sie den Verlauf und prüfen Sie das Datum. Ein Ladefehler bedeutet nicht, dass keine Leistungen vorhanden sind.'],
      finance: ['Zahlungen und Rechnungen', 'Sehen Sie Beträge und Dokumente Ihres Kontos.', 'Prüfen Sie Dokument und Kontostand. Aktualisieren Sie nach einem Fehler, bevor Sie von vollständiger Zahlung ausgehen.'],
      visits: ['Tagesroute', 'Öffnen Sie zugewiesene Besuche und prüfen Sie das Datum.', 'Prüfen Sie Pool und Besuchsart. Eine ausstehende Anfrage ist kein vom Server bestätigter Abschluss.'],
      vehicles: ['Belege und Dokumente', 'Sehen Sie Dokumente und Fahrzeugbestand.', 'Prüfen Sie Fahrzeug, Datum und Herkunft. Eine gespeicherte Kopie enthält möglicherweise nicht die neuesten Änderungen.'],
      safety: ['Warnungen im Außendienst', 'Prüfen Sie Hinweise während des Besuchs und zum Tagesabschluss.', 'Das Lesen oder Übernehmen einer Warnung schließt kein Wasser und ändert keine Pumpe. Beheben Sie die Ursache und bestätigen Sie den Eintrag.'],
      chat: ['Nachrichten', 'Öffnen Sie die Unterhaltung Ihres Kontos oder Teams.', 'Warten Sie auf die Sendebestätigung. Bei verlorener Antwort nutzen Sie die Wiederherstellung in der Unterhaltung.'],
      alerts: ['Benachrichtigungen', 'Sehen Sie die Hinweise Ihres Kontos.', 'Das Markieren als gelesen behebt nicht die Ursache. Öffnen Sie den zugehörigen Vorgang.'],
      settings: ['Mein Profil', 'Sehen Sie Ihr Konto und die verfügbaren Optionen.', 'Prüfen Sie vor einem Kontowechsel Ihre Identität. Entwürfe und ausstehende Anfragen gehören zum Konto, das sie erstellt hat.']
    }
  };
  let language;
  try { language = localStorage.getItem('cw_language'); } catch (_) {}
  const locale = () => words[String(language || document.documentElement.lang || 'pt').slice(0, 2)] ? String(language || document.documentElement.lang || 'pt').slice(0, 2) : 'pt';
  function session() {
    try {
      const token = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('cristalwater_user') || localStorage.getItem('user') || '{}');
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const role = String(payload.role || '').trim().toUpperCase(), id = Number(payload.userId || payload.id || payload.technicianId || payload.clientId);
      if (!Number.isSafeInteger(id) || id <= 0 || id !== Number(user.userId || user.id || user.technicianId || user.clientId) || role !== String(user.role || '').trim().toUpperCase() || !['ADMIN', 'CLIENT', 'TECHNICIAN', 'TEAM_LEADER'].includes(role) || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) return null;
      return { role, id, token };
    } catch (_) { return null; }
  }
  function currentTopics() {
    const owner = session(); if (!owner) return {};
    const text = words[locale()];
    const help = { title: text.help, summary: text.helpSummary, detail: text.helpDetail, actions: [], href: '/help-center' };
    if (owner.role === 'ADMIN') return { ...topics, help };
    const routes = owner.role === 'CLIENT'
      ? { customerPortal: '/client-portal', reports: '/client-history', finance: '/client-payments', chat: '/client_chat', alerts: '/client-notifications' }
      : { visits: '/technician-field-mode', vehicles: '/technician-guide', safety: '/technician-field-mode', chat: '/technician-chat', alerts: '/technician-chat#noticesTitle', settings: '/technician-profile' };
    const result = { help };
    for (const [key, href] of Object.entries(routes)) {
      const [title, summary, detail] = guideCopy[locale()][key]; result[key] = { title, summary, detail, actions: [], href };
    }
    return result;
  }
  function currentActions() {
    const owner = session(); if (!owner) return [];
    if (owner.role === 'ADMIN') return quickActions.map(action => ({ ...action }));
    return Object.entries(currentTopics()).map(([topic, guide]) => ({ topic, href: guide.href, label: guide.title, icon: topic === 'help' ? '?' : '→' }));
  }
  window.CristalHelp = Object.freeze({ session, topics: currentTopics, actions: currentActions, words: () => words[locale()] });
  Object.defineProperty(window, 'CRISTAL_HELP_TOPICS', { configurable: true, get: currentTopics });
  Object.defineProperty(window, 'CRISTAL_QUICK_ACTIONS', { configurable: true, get: currentActions });
  window.addEventListener('cw-language-change', event => { language = event.detail?.language || 'pt'; });
  window.addEventListener('storage', event => { if (event.key === 'cw_language') language = event.newValue; });
})();
