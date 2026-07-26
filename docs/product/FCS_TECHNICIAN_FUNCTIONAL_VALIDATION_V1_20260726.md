# FCS - Validação Funcional Técnica V1

Data: 2026-07-26
Documento alvo: validação funcional real antes de qualquer fusão estrutural.
Sem implementação de código nesta fase.

## 1) Correção da inconsistência numérica

- Resultado validado na fonte oficial de cobertura: 90 rotas reachables.
- Rotas únicas: 90.
- Duplicados na tabela: 0.
- Diferença para 87: o número 87 pertence ao escopo da auditoria visual V3 após exclusão de 3 rotas de harness (/admin-core-flow, /admin-operational-flow, /admin-test-center).

Conclusão: a classificação anterior que somou 90 não estava "matematicamente errada"; estava a usar um escopo de 90 enquanto o texto mencionava 87.

## 2) Tabela canónica de rotas (cada rota aparece 1 vez)

| # | Rota | Módulo | Papéis | Grupo de navegação | Destino atual |
|---:|---|---|---|---|---|
| 1 | /admin-ai | Admin Ai | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 2 | /admin-alerts | Admin Alerts | ADMIN | Admin Full Navigation | /admin-alerts |
| 3 | /admin-client-settings | Admin Client Settings | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 4 | /admin-clients | Admin Clients | ADMIN | Admin Full Navigation | /admin-clients |
| 5 | /admin-collection | Admin Collection | ADMIN | Admin Full Navigation | /admin-collection |
| 6 | /admin-command-center | Admin Command Center | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 7 | /admin-company-closures | Admin Company Closures | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 8 | /admin-core-flow | Admin Core Flow | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 9 | /admin-crm | Admin Crm | ADMIN | Admin Full Navigation | /admin-crm |
| 10 | /admin-dashboard | Admin Dashboard | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 11 | /admin-email-logs | Admin Email Logs | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 12 | /admin-inventory | Admin Inventory | ADMIN | Admin Full Navigation | /admin-inventory |
| 13 | /admin-keys | Admin Keys | ADMIN | Admin Full Navigation | /admin-keys |
| 14 | /admin-live-map | Admin Live Map | ADMIN | Admin Full Navigation | /admin-live-map |
| 15 | /admin-login | Admin Login | PUBLIC | Admin Full Navigation | /crystal-os-v2-route-index |
| 16 | /admin-map | Admin Map | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 17 | /admin-master-control | Admin Master Control | ADMIN | Admin Full Navigation | /admin-master-control |
| 18 | /admin-menu | Admin Menu | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 19 | /admin-notifications | Admin Notifications | ADMIN | Admin Full Navigation | /admin-notifications |
| 20 | /admin-onboarding | Admin Onboarding | ADMIN | Admin Full Navigation | /admin-onboarding |
| 21 | /admin-operational-flow | Admin Operational Flow | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 22 | /admin-operational-settings | Admin Operational Settings | ADMIN | Admin Full Navigation | /admin-operational-settings |
| 23 | /admin-payment-settings | Admin Payment Settings | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 24 | /admin-payments | Admin Payments | ADMIN | Admin Full Navigation | /admin-payments |
| 25 | /admin-pool-calculator | Admin Pool Calculator | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 26 | /admin-pool-technical | Admin Pool Technical | ADMIN | Admin Full Navigation | /admin-pool-technical |
| 27 | /admin-pools | Admin Pools | ADMIN | Admin Full Navigation | /admin-pools |
| 28 | /admin-priority | Admin Priority | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 29 | /admin-reports | Admin Reports | ADMIN | Admin Full Navigation | /admin-reports |
| 30 | /admin-rounds | Admin Rounds | ADMIN | Admin Full Navigation | /admin-rounds |
| 31 | /admin-security | Admin Security | ADMIN | Admin Full Navigation | /admin-security |
| 32 | /admin-service-log | Admin Service Log | ADMIN | Admin Full Navigation | /admin-service-log |
| 33 | /admin-suppliers | Admin Suppliers | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 34 | /admin-technicians | Admin Technicians | ADMIN | Admin Full Navigation | /admin-technicians |
| 35 | /admin-test-center | Admin Test Center | ADMIN | Admin Full Navigation | /admin-test-center |
| 36 | /admin-today | Admin Today | ADMIN | Admin Full Navigation | /admin-today |
| 37 | /admin-ui-settings | Admin Ui Settings | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 38 | /admin-vehicles | Admin Vehicles | ADMIN | Admin Full Navigation | /admin-vehicles |
| 39 | /admin-visits | Admin Visits | ADMIN | Admin Full Navigation | /admin-visits |
| 40 | /admin-visits-dashboard | Admin Visits Dashboard | ADMIN | Admin Full Navigation | /crystal-os-v2-route-index |
| 41 | /alerts | Alerts | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 42 | /alerts-financial | Alerts Financial | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 43 | /billing | Billing | ADMIN | Admin Route Index | /billing |
| 44 | /billing-center | Billing Center | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 45 | /billing-extras | Billing Extras | ADMIN | Admin Route Index | /billing-extras |
| 46 | /billing-history | Billing History | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 47 | /chat | Chat | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 48 | /client | Client | CLIENT, ADMIN | Customer Navigation | /crystal-os-v2-route-index |
| 49 | /client_chat | Client Chat | CLIENT, ADMIN | Customer Navigation | /crystal-os-v2-route-index |
| 50 | /client_tech | Client Tech | CLIENT, ADMIN | Customer Navigation | /crystal-os-v2-route-index |
| 51 | /client-dashboard | Client Dashboard | CLIENT, ADMIN | Customer Navigation | /crystal-os-v2-route-index |
| 52 | /client-history | Client History | CLIENT, ADMIN | Customer Navigation | /crystal-os-v2-route-index |
| 53 | /client-login | Client Login | PUBLIC | Customer Navigation | /crystal-os-v2-route-index |
| 54 | /client-menu | Client Menu | CLIENT, ADMIN | Customer Navigation | /crystal-os-v2-route-index |
| 55 | /client-notifications | Client Notifications | CLIENT, ADMIN | Customer Navigation | /crystal-os-v2-route-index |
| 56 | /client-payments | Client Payments | CLIENT, ADMIN | Customer Navigation | /crystal-os-v2-route-index |
| 57 | /client-portal | Client Portal | CLIENT, ADMIN | Customer Navigation | /client-portal |
| 58 | /client-wow | Client Wow | CLIENT, ADMIN | Customer Navigation | /crystal-os-v2-route-index |
| 59 | /communications | Communications | ADMIN | Admin Route Index | /communications |
| 60 | /config-notifications | Config Notifications | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 61 | /crystal-os-v2-route-index | Crystal Os V2 Route Index | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 62 | /dashboard | Dashboard | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 63 | /help-center | Help Center | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 64 | /incident-center | Incident Center | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 65 | /invoices | Invoices | ADMIN | Admin Route Index | /invoices |
| 66 | /login | Login | PUBLIC | Auth Entry | /crystal-os-v2-route-index |
| 67 | /map | Map | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 68 | /metrics | Metrics | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 69 | /multi-map | Multi Map | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 70 | /notifications | Notifications | ADMIN | Admin Route Index | /notifications |
| 71 | /operational-dashboard | Operational Dashboard | ADMIN | Admin Route Index | /operational-dashboard |
| 72 | /profit-map | Profit Map | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 73 | /ranking | Ranking | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 74 | /report-center | Report Center | ADMIN | Admin Route Index | /report-center |
| 75 | /report-settings | Report Settings | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 76 | /route-map | Route Map | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 77 | /settings | Settings | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 78 | /splash | Splash | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 79 | /technician | Technician | ADMIN | Admin Route Index | /crystal-os-v2-route-index |
| 80 | /technician-field-mode | Technician Field Mode | TECHNICIAN, ADMIN | Technician Menu | /technician-field-mode |
| 81 | /technician-gps | Technician Gps | TECHNICIAN, ADMIN | Technician Menu | /crystal-os-v2-route-index |
| 82 | /technician-guide | Technician Guide | TECHNICIAN, ADMIN | Technician Menu | /technician-guide |
| 83 | /technician-login | Technician Login | PUBLIC | Technician Menu | /technician-login |
| 84 | /technician-map | Technician Map | TECHNICIAN, ADMIN | Technician Menu | /technician-map |
| 85 | /technician-new-client | Technician New Client | TECHNICIAN, ADMIN | Technician Menu | /crystal-os-v2-route-index |
| 86 | /technician-profit | Technician Profit | TECHNICIAN, ADMIN | Technician Menu | /crystal-os-v2-route-index |
| 87 | /technician-profit-dashboard | Technician Profit Dashboard | TECHNICIAN, ADMIN | Technician Menu | /crystal-os-v2-route-index |
| 88 | /technician-route | Technician Route | TECHNICIAN, ADMIN | Technician Menu | /technician-route |
| 89 | /technician-visit | Technician Visit | TECHNICIAN, ADMIN | Technician Menu | /technician-visit |
| 90 | /to-issue | To Issue | ADMIN | Admin Route Index | /crystal-os-v2-route-index |

## 3) Escopo técnico validado (fase atual)

- Rotas técnicas funcionais: 9
- Rota pública de entrada técnica: /technician-login
- Rotas técnicas: /technician-field-mode, /technician-gps, /technician-guide, /technician-map, /technician-new-client, /technician-profit, /technician-profit-dashboard, /technician-route, /technician-visit.

## 4) Cobertura obrigatória de operação técnica

| Item obrigatório | Situação atual | Evidência funcional | Gap |
|---|---|---|---|
| Piscinas do dia | Coberto | /technician-route e /technician-field-mode carregam rota do dia | Baixo |
| Agora/intervenções em curso | Coberto parcial | /technician-field-mode tem fluxo iniciar/concluir e estado da visita | Médio (disperso entre telas) |
| Alertas | Coberto parcial | avisos e notificações via /api/notifications e bloco de aviso admin | Médio (priorização unificada ainda fraca) |
| Visitas agendadas | Coberto | /api/technician/today e /api/visits/today | Baixo |
| Águas abertas | Coberto | /api/technician/water-reminders + close + alarm | Baixo |
| Bombas em manual | Não comprovado como fluxo dedicado | não há endpoint explícito "pump manual" no escopo técnico analisado | Alto (requisito funcional sem trilho claro) |
| Problemas pendentes | Coberto | /api/core/visits/:id/problem e pendências de visita | Médio |
| Documentos da viatura | Coberto | /api/guides/vehicles/:id/insurance/pdf e guias | Baixo |
| Seguros, guias, fichas de segurança | Coberto parcial | seguro e guias AT/obra comprovados; ficha de segurança não isolada como entidade dedicada nesta camada | Médio |
| Ficha técnica com pedido de alteração sujeito a aprovação | Coberto parcial | intake de campo cria pendência admin; não há no escopo técnico um diff formal before/after da ficha técnica | Alto |
| Histórico essencial | Coberto | /technician-history e histórico dentro de visitas | Baixo/Médio |

## 5) Restrições de segurança e privacidade (backend/API)

### 5.1 Regra técnico sem valores/faturação/dívida/contrato
- Parcialmente cumprida: /api/billing/* está protegido por auth(ADMIN) em src/routes/billingRoutes.js.
- Porém há páginas técnicas (/technician-profit e /technician-profit-dashboard) a tentar consumir endpoint financeiro admin-only.
- Implicação: não há exposição quando backend bloqueia, mas há dívida de UX e de arquitetura (feature técnica inconsistente com política).

### 5.2 Restrição aplicada no backend e não só na interface
- Confirmado em vários fluxos críticos:
  - /api/technician/* usa auth(TECHNICIAN).
  - /api/visits/* usa auth(TECHNICIAN) + ownership checks em /:id e /:id/not-done.
  - /api/notifications filtra notificações financeiras para técnico.
- Gaps críticos encontrados (backend sem auth explícito): ver secção 7.

## 6) Validação funcional por rota técnica

| Rota | Funções atuais | Funções únicas | Funções duplicadas | APIs utilizadas | Destino proposto | Risco de migração | Testes necessários |
|---|---|---|---|---|---|---|---|
| /technician-login | Login por PIN, criação de sessão JWT técnica, redirecionamento para modo campo, logout local. | Única porta de entrada de sessão técnica com PIN. | Padrão de login separado de /login e /admin-login (duplicação visual possível, separação funcional necessária). | POST /api/technician-auth/login | Manter como fluxo técnico em /auth/login com trilho técnico dedicado e guardas separados. | Médio (erro de redirecionamento por perfil ou mistura de sessão). | Teste de PIN válido/inválido, expiração token, acesso cruzado ADMIN/CLIENT bloqueado, pós-login cai sempre no hub técnico. |
| /technician-field-mode | Hub de execução: iniciar/concluir visita, checklist, fotos, dosagem/consumo, avisos de stock, lembretes de água aberta, correções de visita, painel de progresso, acessos e lembretes operacionais. | Fluxo operacional completo de campo em uma tela, com sticky action rail e suporte offline/sync visual. | Sobreposição com /technician-route, /technician-visit, /technician-map e partes de /technician-guide. | GET /api/technician/today; POST /api/visits/:id/photo; POST /api/core/visits/:id/problem; POST /api/core/visits/:id/complete; POST /api/technician/water-reminders; POST /api/technician/water-reminders/:id/close; POST /api/technician/water-reminders/:id/alarm; POST /api/technician/stock-reminders; POST /api/operational-state/visits/:id/state; POST /api/technician/visits/:id/correction; GET /api/guides/transport/latest/:vehicleId; GET /api/guides/stock/:vehicleId; GET /api/guides/vehicles/:id/insurance; POST /api/guides/work/consume. | Manter como núcleo do Centro Operacional do Técnico. | Alto (se dividir sem mapa de responsabilidade, perde-se fluxo de ponta a ponta). | Teste e2e da jornada: piscina do dia -> agora -> alerta -> problema -> foto -> consumo -> água aberta -> concluir; regressão mobile 390 e Pixel 7; offline queue e re-sync. |
| /technician-route | Lista sequencial de paragens do dia e sugestões de rota. | Vista compacta focada apenas em sequência de paragens. | Dados da rota já aparecem no hub /technician-field-mode e em /technician-map. | GET /api/technician/today?technicianId&date | Integrar como aba "Piscinas do dia" dentro do Centro Operacional do Técnico. | Baixo/Médio (risco principal é perda de leitura rápida se a aba não for objetiva). | Comparar quantidade e ordem das paragens com /technician-field-mode; atualização manual mantém consistência. |
| /technician-map | Mapa do dia com seleção de visita, next stop e links Google/Waze. | Única superfície cartográfica com markers e navegação externa por destino. | Parte da navegação existe em /technician-field-mode e /technician-gps. | GET /api/visits/today?technicianId | Manter como vista de mapa do centro técnico (não como módulo separado de negócio). | Médio (dependência de coordenadas válidas e UX ao sol). | Sem coordenadas, coordenadas inválidas, várias visitas, troca de paragem e abertura correta de deep links Maps/Waze. |
| /technician-gps | Tracking contínuo, envio manual de ponto, KPI de sincronização/precisão/último envio. | Única tela dedicada a telemetria GPS em tempo real no técnico. | Status de localização parcial já é inferido em telas de rota/mapa. | POST /api/gps/update | Integrar como bloco "Agora" no centro técnico, mantendo endpoint dedicado. | Alto de segurança: endpoint de update sem auth no backend atual. | Sem login deve falhar 401; token técnico válido; payload inválido; throttling 10s; precisão e timestamp atualizados. |
| /technician-visit | Tela detalhada de uma visita: leituras químicas, checklist, notas, upload foto, concluir/não feita. | Experiência detalhada por visita com contexto técnico e intervalos recomendados. | Grande sobreposição com blocos de execução do /technician-field-mode. | GET /api/visits/:id; POST /api/visits/complete; POST /api/visits/:id/not-done; POST /api/visits/:id/photo | Manter como drill-down da visita (não módulo paralelo desconectado). | Alto (ownership e consistência de estado de visita). | Técnico só abre visita atribuída; concluir atualiza estado em todas as telas; not-done exige motivo; upload foto com/sem rede. |
| /technician-guide | Guia de obra, consumo de material, stock da viatura, PDF guia AT, seguro da viatura. | Única superfície que cumpre requisito de documentos em tempo real (guia/seguro/pdf). | Partes de documentos/stock são chamadas dentro de /technician-field-mode. | GET /api/guides/vehicles; POST /api/guides/work/start; GET /api/guides/stock/:vehicleId; POST /api/guides/work/consume; POST /api/guides/work/:id/close; GET /api/guides/work/:id/pdf; GET /api/guides/transport/latest/:vehicleId/pdf; GET /api/guides/vehicles/:id/insurance/pdf | Manter como subfluxo "Documentos e logística" dentro do centro técnico. | Médio/Alto (quebrar integração de guias impacta operação e conformidade). | Abertura/fecho de guia, consumo com auditoria, PDF acessível, seguro acessível, comportamento quando falta guia AT. |
| /technician-new-client | Cadastro provisório de cliente/piscina em campo com pendência de revisão admin. | Único ponto de intake de campo para novos registos. | Sem duplicado direto técnico; dependência com backoffice admin para aprovação. | GET /api/technician-intake/settings; POST /api/technician-intake/client-with-pool | Manter como ação contextual do centro técnico, com governança de aprovação. | Alto de segurança: rotas de intake sem auth middleware no backend atual. | Sem token deve falhar; com técnico permitido cria pendente; aprovação admin muda estado; trilha de auditoria e tarefa geradas. |
| /technician-profit | Mostra ranking financeiro/lucro por técnico. | Nenhuma no contexto técnico operacional. | Duplica /technician-profit-dashboard e colide com centro financeiro admin. | GET /api/billing/technician-profit (ADMIN only) | Eliminar do escopo técnico; mover para admin financeiro. | Alto de compliance de perfil (dados financeiros ao técnico). | Técnico recebe 403 no backend; rota técnica não expõe valores nem campos financeiros. |
| /technician-profit-dashboard | Painel financeiro com receita/custo/lucro e gráfico. | Nenhuma para execução de campo. | Duplica /technician-profit e dashboards financeiros admin. | GET /api/billing/technician-profit?month&year (ADMIN only) | Eliminar do menu técnico; consolidar em admin finance-center. | Alto de compliance de perfil (financeiro sensível). | Técnico sempre bloqueado por backend; remover links técnicos para estas rotas; testes de autorização negativos. |

## 7) Dependências críticas e riscos reais (não teóricos)

| Área | Evidência | Impacto |
|---|---|---|
| Auth backend em /api/technician-intake/* | src/routes/technicianIntakeRoutes.js sem router.use(auth(...)) | Alto - endpoints sensíveis expostos sem autenticação obrigatória. |
| Auth backend em /api/workday/* | src/routes/technicianWorkDayRoutes.js sem auth middleware | Alto - alteração de estado de jornada sem gate explícito. |
| Auth backend em /api/gps/update | src/routes/gpsRoutes.js sem auth middleware | Alto - telemetria pode receber payload sem token. |
| Auth backend em /api/technicians/* | src/routes/technicianCrudRoutes.js sem auth middleware | Crítico - CRUD técnico sem proteção de role. |
| Financeiro em rotas técnicas | frontend/technician-profit*.html chama /api/billing/technician-profit, backend exige ADMIN | Médio funcional + Alto governança - UX quebrada e regra de perfil conflituante. |

## 8) Sobreposições reais identificadas

- Rota e agenda duplicadas entre /technician-field-mode, /technician-route e /technician-map.
- Execução de visita duplicada entre /technician-field-mode e /technician-visit.
- Documentos/stock duplicados entre /technician-field-mode e /technician-guide.
- Financeiro duplicado e fora de política em /technician-profit e /technician-profit-dashboard.

## 9) Decisões de arquitetura técnica (fase de validação, sem implementação)

1. Não iniciar fusão global das 87/90 rotas nesta fase.
2. Tratar /technician-field-mode como núcleo canónico do Centro Operacional do Técnico.
3. Integrar rota, mapa, visita e guias como subfluxos do núcleo (não novos módulos isolados).
4. Retirar financeiro do universo técnico (rotas e links), mantendo backend já restritivo.
5. Corrigir primeiro os gaps de backend auth identificados antes de qualquer reorganização visual ampla.

## 10) Gate para avançar à próxima fase

Pré-condições para aprovação da reorganização técnica:
- Tabela canónica de rotas aceita (90 rotas únicas).
- Política de segurança técnica validada para todos endpoints usados no campo (incluindo GPS, workday e intake).
- Plano de migração do Técnico aprovado com garantia explícita de não perda funcional.
- Suite de testes por rota técnica definida e executável (autorização, mobile, offline, fluxo ponta a ponta).

Estado final desta entrega: validação funcional técnica concluída para revisão, sem implementação.