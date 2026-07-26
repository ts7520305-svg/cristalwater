# GROUP4_SCOPE_MAPPING

Data: 2026-07-20
Fase: Preparacao do Grupo 4 (documental)
Estado: CONCLUIDO (CICLO 24 CONCLUIDO)

## Regras desta fase
- Migracao controlada pagina-a-pagina com evidencias before/after.
- Alteracoes restritas ao frontend da pagina em ciclo.
- Gates obrigatorios entre paginas (sintaxe, testes, smoke, Playwright).
- Nao fazer commit, push ou tag.
- Respeitar freeze dos Grupos 1, 2 e 3.

## Fontes de verdade usadas
- frontend/crystal-os-v2-route-index.html
- frontend/admin-menu.html
- frontend/admin-master-control.html
- docs/product/CERTIFIED_UI_FREEZE_REGISTER.md
- docs/product/GROUP3_FINAL_CERTIFICATION.md
- docs/product/PHASE2_GLOBAL_AUDIT_93_PAGES_20260714.md
- docs/product/PHASE2_LOTE_G_REPORT_20260714.md
- docs/product/PHASE2_LOTE_H_REPORT_20260714.md

## Superficies congeladas (fora do Grupo 4)
- Grupo 1: admin-dashboard.html, admin-today.html, admin-alerts.html, admin-payments.html, admin-inventory.html
- Grupo 2: admin-clients.html, admin-pools.html, admin-technicians.html, admin-rounds.html
- Grupo 3: admin-visits-dashboard.html, admin-pool-technical.html, technician-guide.html, admin-keys.html, admin-vehicles.html, admin-visits.html, technician-visit.html, technician-field-mode.html

## Candidatas Grupo 4 (inventario inicial)
| Superficie | Classificacao | Evidencia de uso | Dependencias principais | Acao no Grupo 4 |
|---|---|---|---|---|
| admin-master-control.html | Ativa | Menu admin e rotas V2 | admin-master-control.js, shell/nav V2 | MIGRAR |
| admin-menu.html | Ativa | Menu completo admin | crystal-os-v2-nav.js, shell V2 | MIGRAR |
| admin-live-map.html | Ativa | Menu Operacao diaria | mapas, dados live GPS/visitas | CERTIFICADO (CICLO 3) |
| admin-map.html | Ativa (suporte operacional) | Route index admin | mapas operacionais e contexto geografico | CERTIFICADO (CICLO 4) |
| admin-crm.html | Ativa | Menu Clientes e equipas | dados cliente/piscina/visita | CERTIFICADO (CICLO 5) |
| admin-client-settings.html | Ativa (suporte clientes) | Route index admin | configuracao de parametros de cliente | CERTIFICADO (CICLO 6) |
| admin-service-log.html | Ativa | Menu Clientes e equipas | logs de servico/visitas | CERTIFICADO (CICLO 7) |
| admin-reports.html | Ativa | Route index admin | filtros/export/listagens | CERTIFICADO (CICLO 8) |
| admin-notifications.html | Ativa | Route index admin | notificacoes e estado | CERTIFICADO (CICLO 9) |
| admin-operational-settings.html | Ativa | Route index admin | configuracao operacional | CERTIFICADO (CICLO 10) |
| admin-pool-calculator.html | Ativa | Menu Ativos e armazem | calculo tecnico local | CERTIFICADO (CICLO 11) |
| admin-collection.html | Ativa (baixa criticidade) | Route index admin | cobranças/colecao | CERTIFICADO (CICLO 12) |
| admin-command-center.html | Ativa (a confirmar) | Route index admin | operacao central | CERTIFICADO (CICLO 16) |
| admin-core-flow.html | Ativa (a confirmar) | Route index admin | fluxo operacional core | CERTIFICADO (CICLO 17) |
| admin-operational-flow.html | Ativa (a confirmar) | Route index admin | fluxo operacional | CERTIFICADO (CICLO 18) |
| admin-email-logs.html | Ativa (suporte) | Route index admin | logs/diagnostico | CERTIFICADO (CICLO 13) |
| admin-suppliers.html | Ativa (suporte) | Route index admin | dados fornecedores | CERTIFICADO (CICLO 14) |
| admin-priority.html | Ativa (suporte) | Route index admin | priorizacao operacional | CERTIFICADO (CICLO 15) |
| admin-ai.html | Ativa (suporte) | Route index admin | IA assistiva/admin | CERTIFICADO (CICLO 19) |
| admin-company-closures.html | Ativa (suporte) | Route index admin | fechos empresa | CERTIFICADO (CICLO 20) |
| admin-onboarding.html | Ativa (suporte) | Route index admin | onboarding interno | CERTIFICADO (CICLO 21) |
| admin-payment-settings.html | Ativa (suporte) | Route index admin | configuracoes pagamentos | CERTIFICADO (CICLO 22) |
| admin-security.html | Ativa (suporte) | Route index admin | seguranca/admin | CERTIFICADO (CICLO 23) |
| admin-ui-settings.html | Ativa (suporte) | Route index admin | configuracao UI | CERTIFICADO (CICLO 24) |
| admin-test-center.html | Legacy/Referencia | relatórios fase2 apontam lacunas estruturais e perfil de teste | superficie de teste | EXCLUIR POR LEGACY |
| crystal-os-v2-route-index.html | Apenas referencia | indice de rotas | documentacao/navegacao | APENAS REFERENCIA |
| admin-login.html | Legacy/fora escopo | auth utilitaria | autenticacao | EXCLUIR POR LEGACY |
| login.html | Legacy/fora escopo | auth utilitaria | autenticacao | EXCLUIR POR LEGACY |
| client-login.html | Legacy/fora escopo | auth utilitaria | autenticacao | EXCLUIR POR LEGACY |
| technician-login.html | Legacy/fora escopo | auth utilitaria | autenticacao | EXCLUIR POR LEGACY |
| splash.html | Legacy/fora escopo | pagina utilitaria | arranque | EXCLUIR POR LEGACY |

## Funcoes distribuidas e referencias obrigatorias
| Conceito | Superficie | Classificacao |
|---|---|---|
| Reparacoes | admin-alerts.* + tecnico campo/visita + pool technical | Funcao distribuida (congelada/referencia) |
| Armazem | admin-inventory.* + admin-vehicles.* + technician-guide.* | Funcao distribuida (congelada/referencia) |

## Observacoes de validacao de atividade
- A existencia no route index nao e, por si so, prova de uso operacional critico.
- A navegacao em admin-menu/admin-master-control foi usada como sinal de prioridade de migracao.
- Superficies marcadas "a confirmar" exigem validacao runtime de uso real antes de entrar na ordem final de migracao.

## Decisao desta preparacao
- Grupo 4 fica definido como trilho de superficies ativas remanescentes do shell/admin nao congeladas.
- Páginas legacy, utilitarias de login e indice de rotas ficam fora da migracao.
- Execucao iniciada em 2026-07-20: ciclos 1 a 24 concluidos (`admin-master-control.html`, `admin-menu.html`, `admin-live-map.html`, `admin-map.html`, `admin-crm.html`, `admin-client-settings.html`, `admin-service-log.html`, `admin-reports.html`, `admin-notifications.html`, `admin-operational-settings.html`, `admin-pool-calculator.html`, `admin-collection.html`, `admin-email-logs.html`, `admin-suppliers.html`, `admin-priority.html`, `admin-command-center.html`, `admin-core-flow.html`, `admin-operational-flow.html`, `admin-ai.html`, `admin-company-closures.html`, `admin-onboarding.html`, `admin-payment-settings.html`, `admin-security.html`, `admin-ui-settings.html`).
- Grupo 4 encerrado com 24/24 paginas certificadas.
