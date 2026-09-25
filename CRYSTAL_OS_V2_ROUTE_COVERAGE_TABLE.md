# Navigation catalogue and historical route inventory

Updated by TASK360 on 2026-09-25. `/admin-menu` and `/crystal-os-v2-route-index` are ADMIN entry pages backed by the same live shell projection: 68 distinct module entries, 13 areas and 67 distinct destinations, including six existing anchors. Repeated shell links are combined; seven complementary entries are explicit in `frontend/cw-admin-catalogue.js`.

“ADMIN catalogue” records whether a module card exists now. “ENTRY” identifies the two catalogue pages themselves. “NO” means the route is outside this catalogue, not that it is broken or inaccessible to its own profile. Existing recorded roles are retained and are not an authorization audit. Public, client and technician pages must not be described as reachable through this ADMIN-only index. Historical entries are retained for traceability; the current complete HTML inventory is `docs/product/PAGE_INVENTORY_20260925.md`.

TASK360 checks HTML destinations, listed anchors, catalogue interaction and one real daily-summary navigation. It does not certify every destination workflow. See `docs/product/ADMIN_MODULE_CATALOGUE_20260925.md` for tests and limits.

| Existing route or catalogue key | Module | Recorded roles | Catalogue area or entry type | Entry destination | ADMIN catalogue | Notes |
|---|---|---|---|---|---|---|
| /admin-ai | Admin Ai | ADMIN | Financeiro | /admin-ai | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-alerts | Admin Alerts | ADMIN | Visão geral | /admin-alerts | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-client-settings | Admin Client Settings | ADMIN | Clientes | /admin-client-settings | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-clients | Admin Clients | ADMIN | Clientes | /admin-clients | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-collection | Admin Collection | ADMIN | Financeiro | /admin-collection | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-command-center | Admin Command Center | ADMIN | Session entry alias | /admin-master-control (ADMIN), /client-portal (CLIENT), /technician-field-mode (field), /login (invalid) | NO | Role-aware compatibility redirect; only a supported language is forwarded. Not a module card. |
| /admin-company-closures | Admin Company Closures | ADMIN | Comercial · Obras e logística | /admin-company-closures | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-core-flow | Admin Core Flow | ADMIN | Session entry alias | /admin-master-control (ADMIN), /client-portal (CLIENT), /technician-field-mode (field), /login (invalid) | NO | Role-aware compatibility redirect; only a supported language is forwarded. Not a module card. |
| /admin-crm | Admin Crm | ADMIN | Clientes · Comercial | /admin-crm | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-dashboard | Admin Dashboard | ADMIN | Visão geral | /admin-dashboard | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-email-logs | Admin Email Logs | ADMIN | Comunicação | /admin-email-logs | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-inventory | Admin Inventory | ADMIN | Stock e produtos | /admin-inventory | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-keys | Admin Keys | ADMIN | Piscinas | /admin-keys | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-live-map | Admin Live Map | ADMIN | Operação · Técnicos e equipa | /admin-live-map | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-login | Admin Login | PUBLIC | Admin Full Navigation | /admin-login | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /admin-map | Admin Map | ADMIN | Piscinas | /admin-map | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-master-control | Admin Master Control | ADMIN | Visão geral | /admin-master-control | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-menu | Admin Menu | ADMIN | Catalogue entry | /admin-menu | ENTRY | Searchable ADMIN catalogue with the same 68 entries and filters. |
| /admin-notifications | Admin Notifications | ADMIN | Comunicação | /admin-notifications | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-onboarding | Admin Onboarding | ADMIN | Comercial | /admin-onboarding | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-operational-flow | Admin Operational Flow | ADMIN | Session entry alias | /admin-master-control (ADMIN), /client-portal (CLIENT), /technician-field-mode (field), /login (invalid) | NO | Role-aware compatibility redirect; only a supported language is forwarded. Not a module card. |
| /admin-operational-settings | Admin Operational Settings | ADMIN | Configurações | /admin-operational-settings | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-payment-settings | Admin Payment Settings | ADMIN | Financeiro | /admin-payment-settings | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-payments | Admin Payments | ADMIN | Financeiro | /admin-payments | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-pool-calculator | Admin Pool Calculator | ADMIN | Piscinas | /admin-pool-calculator | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-pool-technical | Admin Pool Technical | ADMIN | Piscinas · Equipamentos | /admin-pools | YES | Choose a pool in /admin-pools before opening its technical sheet; no pool identity is guessed. |
| /admin-pools | Admin Pools | ADMIN | Piscinas | /admin-pools | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-priority | Admin Priority | ADMIN | Admin Full Navigation | /admin-priority | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /admin-reports | Admin Reports | ADMIN | Relatórios e estatísticas | /admin-reports | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-rounds | Admin Rounds | ADMIN | Operação | /admin-rounds | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-security | Admin Security | ADMIN | Configurações | /admin-security | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-service-log | Admin Service Log | ADMIN | Operação · Equipamentos | /admin-service-log | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-suppliers | Admin Suppliers | ADMIN | Stock e produtos | /admin-suppliers | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-technicians | Admin Technicians | ADMIN | Técnicos e equipa | /admin-technicians | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-test-center | Admin Test Center | ADMIN | Session entry alias | /admin-master-control (ADMIN), /client-portal (CLIENT), /technician-field-mode (field), /login (invalid) | NO | Role-aware compatibility redirect; only a supported language is forwarded. Not a module card. |
| /admin-today | Admin Today | ADMIN | Visão geral | /admin-today | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-ui-settings | Admin Ui Settings | ADMIN | Configurações | /admin-ui-settings | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-vehicles | Admin Vehicles | ADMIN | Técnicos e equipa · Obras e logística | /admin-vehicles | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-visits-dashboard | Admin Visits Dashboard | ADMIN | Operação | /admin-visits-dashboard | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-visits | Admin Visits | ADMIN | Operação | /admin-visits | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /alerts-financial | Alerts Financial | ADMIN | Visão geral | /alerts-financial | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /alerts | Alerts | ADMIN | Admin Route Index | /alerts | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /billing-center | Billing Center | ADMIN | Financeiro | /billing-center | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /billing-extras | Billing Extras | ADMIN | Financeiro | /billing-extras | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /billing-history | Billing History | ADMIN | Financeiro | /billing-history | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /billing | Billing | ADMIN | Financeiro | /billing | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /chat | Chat | ADMIN | Comunicação | /chat | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /client-dashboard | Client Dashboard | CLIENT | Customer Navigation | /client-dashboard | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /client-history | Client History | CLIENT | Customer Navigation | /client-history | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /client-login | Client Login | PUBLIC | Customer Navigation | /client-login | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /client-menu | Client Menu | CLIENT | Customer Navigation | /client-menu | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /client-notifications | Client Notifications | CLIENT | Customer Navigation | /client-notifications | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /client-payments | Client Payments | CLIENT | Customer Navigation | /client-payments | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /client-portal | Client Portal | CLIENT, ADMIN | Customer Navigation | /client-portal | NO | Direct in V2 navigation; outside the current ADMIN catalogue. |
| /client-wow | Client Wow | CLIENT | Session entry alias | /admin-master-control (ADMIN), /client-portal (CLIENT), /technician-field-mode (field), /login (invalid) | NO | Role-aware compatibility redirect; only a supported language is forwarded. Not a module card. |
| /client | Client | CLIENT | Customer Navigation | /client | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /client_chat | Client Chat | CLIENT, ADMIN | Customer Navigation | /client_chat | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /client_tech | Client Tech | CLIENT | Customer Navigation | /client_tech | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /communications | Communications | ADMIN | Clientes · Comunicação | /communications | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /config-notifications | Legacy account settings entry | ADMIN, CLIENT, TECHNICIAN, TEAM_LEADER | Account settings alias | /settings | NO | Redirects to authenticated account preferences; preserves old local values; outside the current ADMIN catalogue. |
| /crystal-os-v2-route-index | Crystal Os V2 Route Index | ADMIN | Catalogue entry | /crystal-os-v2-route-index | ENTRY | Searchable ADMIN catalogue with the same 68 entries and filters. |
| /dashboard | Dashboard | ADMIN | Admin Route Index | /dashboard | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /help-center | Role help centre | ADMIN, CLIENT, TECHNICIAN, TEAM_LEADER | Configurações | /help-center | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /incident-center | Incident Center | ADMIN | Operação | /incident-center | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /invoices | Invoices | ADMIN | Financeiro | /invoices | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /login | Login | PUBLIC | Auth Entry | /login | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /map | Map | ADMIN | Piscinas | /map | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /metrics | Metrics | ADMIN | Relatórios e estatísticas | /metrics | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /multi-map | Multi Map | ADMIN | Operação | /multi-map | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /notifications | Notifications | ADMIN | Admin Route Index | /notifications | NO | Direct in V2 navigation; outside the current ADMIN catalogue. |
| /operational-dashboard | Operational Dashboard | ADMIN | Visão geral | /operational-dashboard | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /profit-map | Profit Map | ADMIN | Operação | /profit-map | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /ranking | Ranking | ADMIN | Relatórios e estatísticas | /ranking | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /report-center | Report Center | ADMIN | Relatórios e estatísticas | /report-center | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /report-settings | Report Settings | ADMIN | Relatórios e estatísticas | /report-settings | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /route-map | Route Map | ADMIN | Operação | /route-map | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /settings | Account sound preferences | ADMIN, CLIENT, TECHNICIAN, TEAM_LEADER | Configurações | /settings | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /splash | Splash | ADMIN | Session entry alias | /admin-master-control (ADMIN), /client-portal (CLIENT), /technician-field-mode (field), /login (invalid) | NO | Role-aware compatibility redirect; only a supported language is forwarded. Not a module card. |
| /technician-field-mode | Technician Field Mode | TECHNICIAN, TEAM_LEADER | Technician Menu | /technician-field-mode | NO | Direct in V2 navigation; outside the current ADMIN catalogue. |
| /technician-gps | Technician Gps | TECHNICIAN, TEAM_LEADER | Technician Menu | /technician-gps | NO | ADMIN uses /admin-live-map; current field guard remains restricted; outside the current ADMIN catalogue. |
| /technician-guide | Technician Guide | TECHNICIAN, TEAM_LEADER | Technician Menu | /technician-guide | NO | ADMIN uses /admin-vehicles#works or #guides; current field guard remains restricted; outside the current ADMIN catalogue. |
| /technician-login | Technician Login | PUBLIC | Technician Menu | /technician-login | NO | Direct in V2 navigation; outside the current ADMIN catalogue. |
| /technician-map | Technician Map | TECHNICIAN, TEAM_LEADER | Technician Menu | /technician-map | NO | Direct in V2 navigation; outside the current ADMIN catalogue. |
| /technician-new-client | Technician New Client | TECHNICIAN, TEAM_LEADER | Technician Menu | /technician-new-client | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /technician-profit-dashboard | Technician Profit Dashboard | ADMIN | Technician Menu | /technician-profit-dashboard | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /technician-profit | Technician Profit | ADMIN | Técnicos e equipa | /technician-profit | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /technician-route | Technician Route | TECHNICIAN, TEAM_LEADER | Technician Menu | /technician-route | NO | Direct in V2 navigation; outside the current ADMIN catalogue. |
| /technician-visit | Technician Visit | TECHNICIAN, TEAM_LEADER | Technician Menu | /technician-visit | NO | Direct in V2 navigation; outside the current ADMIN catalogue. |
| /technician | Technician | TECHNICIAN, TEAM_LEADER | Admin Route Index | /technician | NO | Outside the ADMIN catalogue. Own profile or direct entry; historical functional coverage not revalidated here. |
| /to-issue | To Issue | ADMIN | Financeiro | /to-issue | YES | Current ADMIN catalogue; navigation only, destination workflow not revalidated here. |
| /admin-vehicles#works | Guias de obra | ADMIN | Técnicos e equipa · Obras e logística | /admin-vehicles#works | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
| /admin-vehicles#guides | Guias de transporte | ADMIN | Técnicos e equipa | /admin-vehicles#guides | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
| /admin-alerts?scope=repairs | Reparações e orçamentos | ADMIN | Comercial · Equipamentos | /admin-alerts#commercialQuotes | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
| /repair-execution | Execução de reparações | ADMIN | Comercial | /repair-execution | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
| /admin-credit-revenue | Reduções por serviço | ADMIN | Financeiro | /admin-credit-revenue | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
| /admin-revenue | Repartição de mensalidades | ADMIN | Financeiro | /admin-revenue | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
| /admin-expenses | Despesas e contas a pagar | ADMIN | Financeiro | /admin-expenses | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
| /labor-cost-bases | Bases de custo de trabalho | ADMIN | Financeiro | /labor-cost-bases | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
| /admin-inventory?tab=products | Stock do armazém | ADMIN | Stock e produtos | /admin-inventory#stock | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
| /admin-inventory?tab=movements | Movimentos de stock | ADMIN | Stock e produtos | /admin-inventory#movements | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
| /technician-chat | Conversa da equipa | ADMIN | Comunicação | /technician-chat | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
| /admin-operational-settings#equipmentReminderControls | Avisos de manutenção | ADMIN | Comunicação | /admin-operational-settings#equipmentReminderControls | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
| /admin-email-review | Revisão de envios de email | ADMIN | Relatórios e estatísticas | /admin-email-review | YES | Current ADMIN catalogue; existing destination/anchor checked. Role shown is catalogue context, not a new API authorization. |
