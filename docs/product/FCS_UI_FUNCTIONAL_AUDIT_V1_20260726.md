# FCS - Auditoria Funcional da Interface (V1)

Data: 2026-07-26T09:07:55.972Z
Escopo: 87 rotas reachables (CRYSTAL_OS_V2_ROUTE_COVERAGE_TABLE.md)
Estado: Estratégia de reorganização UX sem alteração de funcionalidade.

## Objetivo
Redesenhar a experiência sem perder nenhuma funcionalidade, com consolidação de módulos e fluxos orientados a execução.

## Regras de decisão aplicadas
- Centro Operacional do Técnico como hub único de execução de campo.
- Centro Operacional do Administrador como hub único de decisão diária.
- Motor único de alertas e lembretes (persistentes e acionáveis).
- Alterações à ficha técnica com workflow obrigatório de aprovação.
- Consolidação de módulos redundantes em fluxos canónicos.
- Técnico sem acesso a preços/informação financeira.
- Documentação de viatura/seguros/fichas de segurança/manuais em tempo real.

## Resultado global
- Manter: 11
- Fundir: 68
- Dividir: 1
- Retirar/alias: 5
- Rever manualmente: 5

## Macro consolidação proposta (destinos canónicos)
- /admin/operations-center
- /technician/operations-center
- /alerts-center
- /communication-center
- /operations/visits
- /operations/map
- /operations/team-center
- /operations/client-center
- /operations/exception-workflows
- /pool-record
- /admin/finance-center
- /assets/inventory-center
- /assets/fleet-center
- /control/insights-center
- /control/settings-center
- /client/portal
- /technician/knowledge-center

## Decisão página por página
| Rota atual | Módulo atual | Papéis | Decisão | Destino canónico proposto | Justificação funcional |
|---|---|---|---|---|---|
| /admin-ai | Admin Ai | ADMIN | REVER MANUALMENTE | definir no workshop UX | Sem regra automática; confirmar necessidade real para papéis: ADMIN. |
| /admin-alerts | Admin Alerts | ADMIN | FUNDIR | /alerts-center | Motor único de alertas e lembretes com persistência e owner/deadline. |
| /admin-client-settings | Admin Client Settings | ADMIN | REVER MANUALMENTE | definir no workshop UX | Sem regra automática; confirmar necessidade real para papéis: ADMIN. |
| /admin-clients | Admin Clients | ADMIN | FUNDIR | /operations/client-center | Consolidar registos de cliente e contexto operacional. |
| /admin-collection | Admin Collection | ADMIN | FUNDIR | /admin/finance-center | Centro financeiro único: faturação, cobrança, pendências e configuração. |
| /admin-command-center | Admin Command Center | ADMIN | FUNDIR | /admin/operations-center | Evitar duplicação com Centro Operacional do Administrador. |
| /admin-company-closures | Admin Company Closures | ADMIN | FUNDIR | /operations/exception-workflows | Unificar oportunidades, onboarding, obras e incidentes como workflows. |
| /admin-core-flow | Admin Core Flow | ADMIN | RETIRAR (alias legado) | /workflow/* (redirecionar) | Rota técnica/ponte; manter só redirect para fluxo canónico. |
| /admin-crm | Admin Crm | ADMIN | FUNDIR | /operations/exception-workflows | Unificar oportunidades, onboarding, obras e incidentes como workflows. |
| /admin-dashboard | Admin Dashboard | ADMIN | FUNDIR | /control/insights-center | Consolidar relatórios e métricas sem dashboards duplicados. |
| /admin-email-logs | Admin Email Logs | ADMIN | REVER MANUALMENTE | definir no workshop UX | Sem regra automática; confirmar necessidade real para papéis: ADMIN. |
| /admin-inventory | Admin Inventory | ADMIN | FUNDIR | /assets/inventory-center | Consolidar stock, movimentos e fornecedores no mesmo fluxo. |
| /admin-keys | Admin Keys | ADMIN | FUNDIR | /pool-record/* | Consolidar visão de piscina: dados, química, acessos, localização. |
| /admin-live-map | Admin Live Map | ADMIN | FUNDIR | /operations/map | Mapa operacional único com camadas por contexto e permissão. |
| /admin-login | Admin Login | PUBLIC | FUNDIR | /auth/login (seletor de papel) | Consolidar autenticação com guardas por papel e contexto pós-login. |
| /admin-map | Admin Map | ADMIN | FUNDIR | /pool-record/* | Consolidar visão de piscina: dados, química, acessos, localização. |
| /admin-master-control | Admin Master Control | ADMIN | MANTER (núcleo) | /admin/operations-center | Centro Operacional do Administrador; foco em exceções, SLA e decisões. |
| /admin-menu | Admin Menu | ADMIN | MANTER (suporte) | /admin-menu | Mantém-se como catálogo/descoberta durante transição; depois reduzir. |
| /admin-notifications | Admin Notifications | ADMIN | FUNDIR | /alerts-center | Motor único de alertas e lembretes com persistência e owner/deadline. |
| /admin-onboarding | Admin Onboarding | ADMIN | FUNDIR | /operations/exception-workflows | Unificar oportunidades, onboarding, obras e incidentes como workflows. |
| /admin-operational-flow | Admin Operational Flow | ADMIN | RETIRAR (alias legado) | /workflow/* (redirecionar) | Rota técnica/ponte; manter só redirect para fluxo canónico. |
| /admin-operational-settings | Admin Operational Settings | ADMIN | FUNDIR | /control/settings-center | Configuração e governance centralizadas por domínio. |
| /admin-payment-settings | Admin Payment Settings | ADMIN | FUNDIR | /admin/finance-center | Centro financeiro único: faturação, cobrança, pendências e configuração. |
| /admin-payments | Admin Payments | ADMIN | FUNDIR | /admin/finance-center | Centro financeiro único: faturação, cobrança, pendências e configuração. |
| /admin-pool-calculator | Admin Pool Calculator | ADMIN | FUNDIR | /pool-record/* | Consolidar visão de piscina: dados, química, acessos, localização. |
| /admin-pool-technical | Admin Pool Technical | ADMIN | DIVIDIR + APROVAÇÃO | /pool-record (overview, changes, approvals) | Alterações na ficha técnica exigem workflow formal de aprovação. |
| /admin-pools | Admin Pools | ADMIN | FUNDIR | /pool-record/* | Consolidar visão de piscina: dados, química, acessos, localização. |
| /admin-priority | Admin Priority | ADMIN | FUNDIR | /operations/team-center | Vista única de equipa, produtividade, serviço e prioridades. |
| /admin-reports | Admin Reports | ADMIN | FUNDIR | /control/insights-center | Consolidar relatórios e métricas sem dashboards duplicados. |
| /admin-rounds | Admin Rounds | ADMIN | FUNDIR | /operations/visits | Eliminar duplicação de gestão de visitas/rotas em múltiplas telas. |
| /admin-security | Admin Security | ADMIN | FUNDIR | /control/settings-center | Configuração e governance centralizadas por domínio. |
| /admin-service-log | Admin Service Log | ADMIN | FUNDIR | /operations/team-center | Vista única de equipa, produtividade, serviço e prioridades. |
| /admin-suppliers | Admin Suppliers | ADMIN | FUNDIR | /assets/inventory-center | Consolidar stock, movimentos e fornecedores no mesmo fluxo. |
| /admin-technicians | Admin Technicians | ADMIN | FUNDIR | /operations/team-center | Vista única de equipa, produtividade, serviço e prioridades. |
| /admin-test-center | Admin Test Center | ADMIN | RETIRAR (alias legado) | /workflow/* (redirecionar) | Rota técnica/ponte; manter só redirect para fluxo canónico. |
| /admin-today | Admin Today | ADMIN | REVER MANUALMENTE | definir no workshop UX | Sem regra automática; confirmar necessidade real para papéis: ADMIN. |
| /admin-ui-settings | Admin Ui Settings | ADMIN | FUNDIR | /control/settings-center | Configuração e governance centralizadas por domínio. |
| /admin-vehicles | Admin Vehicles | ADMIN | MANTER + INTEGRAR | /assets/fleet-center | Incluir documentos da viatura e seguros em tempo real. |
| /admin-visits | Admin Visits | ADMIN | FUNDIR | /operations/visits | Eliminar duplicação de gestão de visitas/rotas em múltiplas telas. |
| /admin-visits-dashboard | Admin Visits Dashboard | ADMIN | FUNDIR | /operations/visits | Eliminar duplicação de gestão de visitas/rotas em múltiplas telas. |
| /alerts | Alerts | ADMIN | FUNDIR | /alerts-center | Motor único de alertas e lembretes com persistência e owner/deadline. |
| /alerts-financial | Alerts Financial | ADMIN | FUNDIR | /alerts-center | Motor único de alertas e lembretes com persistência e owner/deadline. |
| /billing | Billing | ADMIN | FUNDIR | /admin/finance-center | Centro financeiro único: faturação, cobrança, pendências e configuração. |
| /billing-center | Billing Center | ADMIN | FUNDIR | /admin/finance-center | Centro financeiro único: faturação, cobrança, pendências e configuração. |
| /billing-extras | Billing Extras | ADMIN | FUNDIR | /admin/finance-center | Centro financeiro único: faturação, cobrança, pendências e configuração. |
| /billing-history | Billing History | ADMIN | FUNDIR | /admin/finance-center | Centro financeiro único: faturação, cobrança, pendências e configuração. |
| /chat | Chat | ADMIN | FUNDIR | /communication-center | Unificar mensagens internas, cliente e contexto operacional. |
| /client | Client | CLIENT, ADMIN | FUNDIR | /client/portal | Portal premium: estado, próxima visita, evidências e mensagens. |
| /client_chat | Client Chat | CLIENT, ADMIN | FUNDIR | /communication-center | Unificar mensagens internas, cliente e contexto operacional. |
| /client_tech | Client Tech | CLIENT, ADMIN | FUNDIR | /client/portal | Portal premium: estado, próxima visita, evidências e mensagens. |
| /client-dashboard | Client Dashboard | CLIENT, ADMIN | FUNDIR | /client/portal | Portal premium: estado, próxima visita, evidências e mensagens. |
| /client-history | Client History | CLIENT, ADMIN | FUNDIR | /client/portal | Portal premium: estado, próxima visita, evidências e mensagens. |
| /client-login | Client Login | PUBLIC | FUNDIR | /auth/login (seletor de papel) | Consolidar autenticação com guardas por papel e contexto pós-login. |
| /client-menu | Client Menu | CLIENT, ADMIN | FUNDIR | /client/portal | Portal premium: estado, próxima visita, evidências e mensagens. |
| /client-notifications | Client Notifications | CLIENT, ADMIN | FUNDIR | /client/portal | Portal premium: estado, próxima visita, evidências e mensagens. |
| /client-payments | Client Payments | CLIENT, ADMIN | MANTER (subfluxo) | /client/portal/payments | Pagamento permanece no portal do cliente, sem exposição operacional interna. |
| /client-portal | Client Portal | CLIENT, ADMIN | FUNDIR | /client/portal | Portal premium: estado, próxima visita, evidências e mensagens. |
| /client-wow | Client Wow | CLIENT, ADMIN | FUNDIR | /client/portal | Portal premium: estado, próxima visita, evidências e mensagens. |
| /communications | Communications | ADMIN | FUNDIR | /communication-center | Unificar mensagens internas, cliente e contexto operacional. |
| /config-notifications | Config Notifications | ADMIN | FUNDIR | /alerts-center | Motor único de alertas e lembretes com persistência e owner/deadline. |
| /crystal-os-v2-route-index | Crystal Os V2 Route Index | ADMIN | MANTER (suporte) | /crystal-os-v2-route-index | Mantém-se como catálogo/descoberta durante transição; depois reduzir. |
| /dashboard | Dashboard | ADMIN | FUNDIR | /control/insights-center | Consolidar relatórios e métricas sem dashboards duplicados. |
| /help-center | Help Center | ADMIN | FUNDIR | /control/settings-center | Configuração e governance centralizadas por domínio. |
| /incident-center | Incident Center | ADMIN | FUNDIR | /operations/exception-workflows | Unificar oportunidades, onboarding, obras e incidentes como workflows. |
| /invoices | Invoices | ADMIN | FUNDIR | /admin/finance-center | Centro financeiro único: faturação, cobrança, pendências e configuração. |
| /login | Login | PUBLIC | FUNDIR | /auth/login (seletor de papel) | Consolidar autenticação com guardas por papel e contexto pós-login. |
| /map | Map | ADMIN | FUNDIR | /pool-record/* | Consolidar visão de piscina: dados, química, acessos, localização. |
| /metrics | Metrics | ADMIN | FUNDIR | /control/insights-center | Consolidar relatórios e métricas sem dashboards duplicados. |
| /multi-map | Multi Map | ADMIN | FUNDIR | /operations/map | Mapa operacional único com camadas por contexto e permissão. |
| /notifications | Notifications | ADMIN | FUNDIR | /alerts-center | Motor único de alertas e lembretes com persistência e owner/deadline. |
| /operational-dashboard | Operational Dashboard | ADMIN | FUNDIR | /control/insights-center | Consolidar relatórios e métricas sem dashboards duplicados. |
| /profit-map | Profit Map | ADMIN | FUNDIR | /operations/map | Mapa operacional único com camadas por contexto e permissão. |
| /ranking | Ranking | ADMIN | FUNDIR | /control/insights-center | Consolidar relatórios e métricas sem dashboards duplicados. |
| /report-center | Report Center | ADMIN | FUNDIR | /control/insights-center | Consolidar relatórios e métricas sem dashboards duplicados. |
| /report-settings | Report Settings | ADMIN | FUNDIR | /control/insights-center | Consolidar relatórios e métricas sem dashboards duplicados. |
| /route-map | Route Map | ADMIN | FUNDIR | /operations/visits | Eliminar duplicação de gestão de visitas/rotas em múltiplas telas. |
| /settings | Settings | ADMIN | FUNDIR | /control/settings-center | Configuração e governance centralizadas por domínio. |
| /splash | Splash | ADMIN | MANTER (transição) | /splash | Ecrã de arranque pode permanecer minimalista enquanto houver múltiplos perfis. |
| /technician | Technician | ADMIN | FUNDIR | /technician/operations-center/history | Transformar em histórico operacional dentro do centro técnico. |
| /technician-field-mode | Technician Field Mode | TECHNICIAN, ADMIN | MANTER (núcleo) | /technician/operations-center/* | Centro Operacional do Técnico; execução em campo em 1-2 toques. |
| /technician-gps | Technician Gps | TECHNICIAN, ADMIN | FUNDIR | /operations/map | Mapa operacional único com camadas por contexto e permissão. |
| /technician-guide | Technician Guide | TECHNICIAN, ADMIN | MANTER + EXPANDIR | /technician/knowledge-center | Disponibilizar manuais, fichas de segurança e guias logísticos em tempo real. |
| /technician-login | Technician Login | PUBLIC | FUNDIR | /auth/login (seletor de papel) | Consolidar autenticação com guardas por papel e contexto pós-login. |
| /technician-map | Technician Map | TECHNICIAN, ADMIN | MANTER (núcleo) | /technician/operations-center/* | Centro Operacional do Técnico; execução em campo em 1-2 toques. |
| /technician-new-client | Technician New Client | TECHNICIAN, ADMIN | REVER MANUALMENTE | definir no workshop UX | Sem regra automática; confirmar necessidade real para papéis: TECHNICIAN, ADMIN. |
| /technician-profit | Technician Profit | TECHNICIAN, ADMIN | RETIRAR para técnico / RESTRINGIR ADMIN | /admin/finance/* | Regra de negócio: técnico sem acesso a preços ou informação financeira. |
| /technician-profit-dashboard | Technician Profit Dashboard | TECHNICIAN, ADMIN | RETIRAR para técnico / RESTRINGIR ADMIN | /admin/finance/* | Regra de negócio: técnico sem acesso a preços ou informação financeira. |
| /technician-route | Technician Route | TECHNICIAN, ADMIN | MANTER (núcleo) | /technician/operations-center/* | Centro Operacional do Técnico; execução em campo em 1-2 toques. |
| /technician-visit | Technician Visit | TECHNICIAN, ADMIN | MANTER (núcleo) | /technician/operations-center/* | Centro Operacional do Técnico; execução em campo em 1-2 toques. |
| /to-issue | To Issue | ADMIN | FUNDIR | /admin/finance-center | Centro financeiro único: faturação, cobrança, pendências e configuração. |

## Ordem recomendada de execução (sem quebra funcional)
1. Congelar nomenclatura e mapa canónico de rotas.
2. Implementar hubs: Admin Operations Center e Technician Operations Center.
3. Migrar motor único de alertas/lembretes com persistência.
4. Consolidar Finance Center (admin) e bloquear exposição financeira para técnico.
5. Consolidar Pool Record com workflow de aprovação de ficha técnica.
6. Consolidar mapas/visitas/equipa e remover dashboards duplicados.
7. Consolidar portal do cliente em fluxo premium único.
8. Manter aliases legados com redirecionamento e telemetria até estabilizar.

## Critérios de aceitação para a fase de implementação
- Nenhuma funcionalidade crítica removida.
- Todas as tarefas diárias em <= 2 cliques/toques.
- Um único caminho canónico por workflow.
- Alertas críticos sempre visíveis e acionáveis.
- Técnico sem qualquer dado financeiro visível.
- Evidências/documentos operacionais disponíveis em tempo real.