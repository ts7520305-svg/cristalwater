# GROUP5_SCOPE_MAPPING

Data: 2026-07-20
Fase: Preparacao do Grupo 5 (documental)
Estado: CONCLUIDO (CICLO 26 CONCLUIDO)

## Regras desta fase
- Manter metodologia consolidada dos Grupos 1-4, sem alteracoes de processo.
- Migracao controlada pagina-a-pagina ou lote ate 4 paginas.
- Alteracoes restritas ao frontend da pagina em ciclo.
- Gates obrigatorios entre ciclos/lotes (sintaxe, testes, smoke, Playwright).
- Nao fazer commit, push ou tag.

## Superficies congeladas (fora do Grupo 5)
- Grupo 1: admin-dashboard.html, admin-today.html, admin-alerts.html, admin-payments.html, admin-inventory.html
- Grupo 2: admin-clients.html, admin-pools.html, admin-technicians.html, admin-rounds.html
- Grupo 3: admin-visits-dashboard.html, admin-pool-technical.html, technician-guide.html, admin-keys.html, admin-vehicles.html, admin-visits.html, technician-visit.html, technician-field-mode.html
- Grupo 4: admin-master-control.html, admin-menu.html, admin-live-map.html, admin-map.html, admin-crm.html, admin-client-settings.html, admin-service-log.html, admin-reports.html, admin-notifications.html, admin-operational-settings.html, admin-pool-calculator.html, admin-collection.html, admin-email-logs.html, admin-suppliers.html, admin-priority.html, admin-command-center.html, admin-core-flow.html, admin-operational-flow.html, admin-ai.html, admin-company-closures.html, admin-onboarding.html, admin-payment-settings.html, admin-security.html, admin-ui-settings.html

## Fontes de verdade usadas
- frontend/crystal-os-v2-route-index.html
- docs/product/CERTIFIED_UI_FREEZE_REGISTER.md
- docs/product/GROUP4_FINAL_CERTIFICATION.md
- docs/product/GROUP4_PROGRESS_MATRIX.md

## Inventario candidato do Grupo 5
| Superficie | Classificacao | Evidencia de uso | Dependencias principais | Acao no Grupo 5 |
|---|---|---|---|---|
| technician.html | Ativa | Route index + shell tecnico | technician.js, auth guard tecnico | CERTIFICADO (CICLO 1) |
| technician-route.html | Ativa | Route index tecnico | technician-route.js, dados de rota | CERTIFICADO (CICLO 2) |
| technician-gps.html | Ativa | Route index tecnico | technician-gps.js, mapa/GPS | CERTIFICADO (CICLO 3) |
| technician-map.html | Ativa | Route index tecnico | technician-map.js | CERTIFICADO (CICLO 4) |
| technician-new-client.html | Ativa | Route index tecnico | technician-new-client.js | CERTIFICADO (CICLO 5) |
| client.html | Ativa | Route index cliente | client.js | CERTIFICADO (CICLO 6) |
| client-dashboard.html | Ativa | Route index cliente | client-dashboard.js | CERTIFICADO (CICLO 7) |
| client-portal.html | Ativa | Route index cliente | client-portal.js | CERTIFICADO (CICLO 8) |
| client-history.html | Ativa | Route index cliente | client-history.js | CERTIFICADO (CICLO 9) |
| client-notifications.html | Ativa | Route index cliente | client-notifications.js | CERTIFICADO (CICLO 10) |
| client-payments.html | Ativa | Route index cliente | client-payments.js | CERTIFICADO (CICLO 11) |
| client_chat.html | Ativa | Route index cliente | client_chat.js | CERTIFICADO (CICLO 12) |
| client-wow.html | Ativa | Route index cliente | client-wow.js | CERTIFICADO (CICLO 13) |
| dashboard.html | Ativa | Route index general | dashboard.js | CERTIFICADO (CICLO 14) |
| operational-dashboard.html | Ativa | Route index general | operational-dashboard.js | CERTIFICADO (CICLO 15) |
| incident-center.html | Ativa | Route index general | incident-center.js | CERTIFICADO (CICLO 16) |
| notifications.html | Ativa | Route index general | notifications.js | CERTIFICADO (CICLO 17) |
| billing.html | Ativa | Route index general | billing.js | CERTIFICADO (CICLO 18) |
| billing-center.html | Ativa | Route index general | billing-center.js | CERTIFICADO (CICLO 19) |
| invoices.html | Ativa | Route index general | invoices.js | CERTIFICADO (CICLO 20) |
| report-settings.html | Ativa | Route index general | report-settings.js | CERTIFICADO (CICLO 21) |
| route-map.html | Ativa | Route index general | route-map.js | CERTIFICADO (CICLO 22) |
| communications.html | Ativa | Route index general | communications.js | CERTIFICADO (CICLO 23) |
| chat.html | Ativa | Route index general | chat.js | CERTIFICADO (CICLO 24) |
| help-center.html | Ativa | Route index general | help-center.js | CERTIFICADO (CICLO 25) |
| to-issue.html | Ativa | Route index general | to-issue.js | CERTIFICADO (CICLO 26) |
| client-menu.html | Ativa (suporte) | Route index cliente | navegacao local | VALIDAR E DECIDIR |
| client_tech.html | Ativa (suporte) | Route index cliente | fluxo tecnico-cliente | VALIDAR E DECIDIR |
| technician-profit.html | Ativa (a confirmar) | Route index tecnico | sem JS dedicado | VALIDAR E DECIDIR |
| technician-profit-dashboard.html | Ativa (a confirmar) | Route index tecnico | sem JS dedicado | VALIDAR E DECIDIR |
| billing-history.html | Ativa (a confirmar) | Route index general | sem JS dedicado | VALIDAR E DECIDIR |
| billing-extras.html | Ativa (a confirmar) | Route index general | sem JS dedicado | VALIDAR E DECIDIR |
| alerts.html | Legacy/Referencia | Route index general | sem JS dedicado | EXCLUIR POR LEGACY |
| alerts-financial.html | Legacy/Referencia | Route index general | sem JS dedicado | EXCLUIR POR LEGACY |
| config-notifications.html | Ativa (a confirmar) | Route index general | sem JS dedicado | VALIDAR E DECIDIR |
| map.html | Ativa (a confirmar) | Route index general | sem JS dedicado | VALIDAR E DECIDIR |
| metrics.html | Ativa (a confirmar) | Route index general | sem JS dedicado | VALIDAR E DECIDIR |
| multi-map.html | Ativa (a confirmar) | Route index general | sem JS dedicado | VALIDAR E DECIDIR |
| profit-map.html | Ativa (a confirmar) | Route index general | sem JS dedicado | VALIDAR E DECIDIR |
| ranking.html | Ativa (a confirmar) | Route index general | sem JS dedicado | VALIDAR E DECIDIR |
| report-center.html | Ativa (a confirmar) | Route index general | sem JS dedicado | VALIDAR E DECIDIR |
| settings.html | Ativa (a confirmar) | Route index general | sem JS dedicado | VALIDAR E DECIDIR |

## Decisao desta preparacao
- Grupo 5 fica inicialmente composto pelas superficies marcadas como MIGRAR (26 paginas).
- Superficies VALIDAR E DECIDIR ficam fora dos primeiros lotes e serao classificadas apos evidencias runtime do Grupo 5.
- Superficies Legacy/Referencia permanecem fora da migracao ativa.
- Proximo passo: executar auditoria final, certificacao final e freeze do Grupo 5.
