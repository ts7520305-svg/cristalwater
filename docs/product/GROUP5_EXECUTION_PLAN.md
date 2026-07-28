# GROUP5_EXECUTION_PLAN

Data: 2026-07-20
Fase: Preparacao do Grupo 5 (pre-execucao)
Estado: EM EXECUCAO CONTROLADA (MODO LOTE ATE 3 PAGINAS)

## Objetivo
Definir ordem de migracao do Grupo 5 com risco minimo, preservando freeze dos Grupos 1-4 e mantendo a metodologia consolidada sem alteracoes.

## Premissas
- Escopo base em docs/product/GROUP5_SCOPE_MAPPING.md.
- Nao alterar paginas congeladas dos Grupos 1-4.
- Evidencia obrigatoria por ciclo: codigo before/after + screenshots before/after (desktop/tablet/mobile) + gates automatizados.
- Sem commit, sem push, sem tag.

## Ordem proposta de migracao (quando aprovada)
### Bloco 1 - Tecnico core
1. technician.html
2. technician-route.html
3. technician-gps.html
4. technician-map.html
5. technician-new-client.html

### Bloco 2 - Cliente core
6. client.html
7. client-dashboard.html
8. client-portal.html
9. client-history.html
10. client-notifications.html
11. client-payments.html
12. client_chat.html
13. client-wow.html

### Bloco 3 - Operacao compartilhada
14. dashboard.html
15. operational-dashboard.html
16. incident-center.html
17. notifications.html
18. billing.html
19. billing-center.html
20. invoices.html
21. report-settings.html
22. route-map.html
23. communications.html
24. chat.html
25. help-center.html
26. to-issue.html

## Superficies fora do arranque (validar antes)
- client-menu.html
- client_tech.html
- technician-profit.html
- technician-profit-dashboard.html
- billing-history.html
- billing-extras.html
- config-notifications.html
- map.html
- metrics.html
- multi-map.html
- profit-map.html
- ranking.html
- report-center.html
- settings.html

## Superficies explicitamente fora do Grupo 5
- alerts.html
- alerts-financial.html
- admin-test-center.html
- admin-login.html
- login.html
- client-login.html
- technician-login.html
- splash.html
- crystal-os-v2-route-index.html

## Criterios de aceitacao do Grupo 5 (iguais ao Grupo 4)
- Migracao visual apenas (sem alterar logica de negocio, API, permissao, schema).
- Preservar IDs funcionais, listeners e data-* criticos.
- Evidencia de codigo obrigatoria: HTML/JS before e after arquivados por pagina.
- Evidencia visual obrigatoria: screenshots before e after em 1440x900, 1024x1366 e 390x844.
- Acessibilidade:
  - 0 campos visiveis sem label;
  - 0 targets operacionais < 44x44;
  - foco visivel e teclado utilizavel.
- Responsividade:
  - status 200 nos 3 breakpoints;
  - 0 scroll horizontal real;
  - sem cortes/sobreposicoes bloqueantes.
- Consola/rede:
  - 0 erros JS;
  - 0 requests inesperados;
  - 0 404 funcionais;
  - 0 401/403 inesperados.

## Regra permanente de conclusao por pagina
Uma pagina so pode ser marcada como CONCLUIDA quando TODOS os itens abaixo estiverem completos:
- before HTML
- before JS
- before screenshots (desktop/tablet/mobile)
- before Playwright
- after HTML
- after JS
- after screenshots (desktop/tablet/mobile)
- after Playwright
- gates verdes (`check:syntax`, `npm test`, `smoke`, Playwright final)
- documentacao atualizada (`GROUP5_MIGRATION_REPORT.md` e `GROUP5_ACCEPTANCE_AUDIT.md`)

## Unidade de trabalho
- Unidade padrao: lote de ate 4 paginas consecutivas da ordem oficial (Grupo 5 final).
- Nao exceder 4 paginas por lote para preservar rastreabilidade de regressao.

## Correcao obrigatoria do gate (BEFORE imutavel)
- BEFORE valida: artefatos completos + checks=3 + navegacao valida (statusNot200=0 e navigationErrors=0).
- BEFORE nao exige metricas de qualidade a zero.
- AFTER exige todos os indicadores a zero + checks=3.
- Nunca sobrescrever BEFORE apos iniciar migracao.
- Se AFTER falhar, corrigir e recapturar apenas AFTER.

## Comandos oficiais do Grupo 5
- Captura evidencia:
  - node scripts/group5-page-evidence.js --pages <p1> <p2> <p3> <p4> --routes </r1> </r2> </r3> </r4> --phase before
  - node scripts/group5-page-evidence.js --pages <p1> <p2> <p3> <p4> --routes </r1> </r2> </r3> </r4> --phase after
- Completude:
  - node scripts/verify-group5-page-evidence-completeness.js --page <slug>
  - node scripts/verify-group5-page-evidence-completeness.js --pages <p1> <p2> <p3> <p4>
- Transicao:
  - node scripts/group5-transition-gate.js --page <atual> --next <proxima>
  - node scripts/group5-transition-gate.js --pages <p1> <p2> <p3> <p4> --next-pages <n1> <n2> <n3> <n4>
- Matriz:
  - node scripts/update-group5-progress-matrix.js
  - node scripts/update-group5-progress-matrix.js --pages <p1> <p2> <p3> <p4>

## Decisao desta fase
- Preparacao documental do Grupo 5 concluida.
- Grupo 5 concluido com ciclos 1 a 26 certificados.
- Proximo passo: auditoria final, certificacao final e registo de freeze do Grupo 5.
