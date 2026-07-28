# GROUP4_EXECUTION_PLAN

Data: 2026-07-20
Fase: Preparacao do Grupo 4 (pre-execucao)
Estado: CONCLUIDO (24/24 CERTIFICADAS)

## Objetivo
Definir ordem de migracao do Grupo 4 com risco minimo, preservando freeze dos Grupos 1-3 e evitando retrabalho.

## Premissas
- Escopo base em docs/product/GROUP4_SCOPE_MAPPING.md.
- Nao alterar paginas congeladas.
- Migracao iniciada em 2026-07-20 com protocolo controlado; throughput otimizado para lotes de ate 3 paginas por ciclo.
- Evidencia obrigatoria por ciclo: codigo before/after + screenshots before/after (desktop/tablet/mobile) + gates automatizados.
- Sem commit, sem push, sem tag.

## Ordem proposta de migracao (quando aprovada)
### Bloco 1 - Navegacao e orquestracao (dependencias primeiro)
1. admin-master-control.html (+ JS associado)
2. admin-menu.html (+ JS associado)

Racional:
- Estas paginas distribuem contexto e navegação para o restante Grupo 4.
- Reduz inconsistencias de shell e facilita validacoes seguintes.

### Bloco 2 - Operacao admin principal
3. admin-live-map.html
4. admin-map.html
5. admin-crm.html
6. admin-client-settings.html
7. admin-service-log.html
8. admin-reports.html
9. admin-notifications.html

Racional:
- Superficies operacionais com uso transversal diario.
- Dependem do contexto estabilizado no Bloco 1.

### Bloco 3 - Configuracoes e modulos tecnicos de suporte
10. admin-operational-settings.html
11. admin-pool-calculator.html
12. admin-collection.html
13. admin-email-logs.html
14. admin-suppliers.html
15. admin-priority.html

Racional:
- Menor risco de regressao no fluxo principal.
- Permite validar consistencia visual apos estabilizar operacao.

### Bloco 4 - Superficies condicionais (entrada apenas apos validacao de uso real)
16. admin-command-center.html
17. admin-core-flow.html
18. admin-operational-flow.html
19. admin-ai.html
20. admin-company-closures.html
21. admin-onboarding.html
22. admin-payment-settings.html
23. admin-security.html
24. admin-ui-settings.html

Racional:
- Estas superficies precisam de validacao adicional de atividade real antes da migracao.

## Superficies explicitamente fora do Grupo 4
- Congeladas (Grupos 1-3): nao alterar.
- Legacy/utilitarias: admin-test-center.html, admin-login.html, login.html, client-login.html, technician-login.html, splash.html.
- Apenas referencia: crystal-os-v2-route-index.html.

## Criterios de aceitacao do Grupo 4 (a aplicar por pagina)
- Migracao visual apenas (sem alterar logica de negocio, API, permissao, schema).
- Preservar IDs funcionais, listeners e data-* criticos.
- Evidencia de codigo obrigatoria: HTML/JS before e after arquivados por pagina.
- Evidencia visual obrigatoria: screenshots before e after em 1440x900, 1024x1366 e 390x844.
- DS dominante (card/button/badge/input/toolbar/tabela/estados/toast quando aplicavel).
- Acessibilidade:
  - 0 campos visiveis sem label;
  - 0 targets operacionais < 44x44;
  - foco visivel e teclado utilizavel.
- Responsividade:
  - status 200 nos 3 breakpoints (1440x900, 1024x1366, 390x844);
  - 0 scroll horizontal real;
  - sem cortes/sobreposicoes bloqueantes.
- Consola/rede:
  - 0 erros JS;
  - 0 requests inesperados;
  - 0 404 funcionais;
  - 0 401/403 inesperados.
- Freeze:
  - 0 alteracoes em paginas congeladas.
- Gate Playwright por pagina executado apos smoke, com relatorio JSON arquivado.

## Regra permanente de conclusao por pagina (obrigatoria)
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
- documentacao atualizada (`GROUP4_MIGRATION_REPORT.md` e `GROUP4_ACCEPTANCE_AUDIT.md`)

## Unidade de trabalho (throughput)
- Unidade padrao: lote de ate 3 paginas consecutivas da ordem oficial.
- Nao exceder 3 paginas por lote para preservar rastreabilidade de regressao.
- Os gates mantem-se identicos; apenas passam a executar uma vez por lote:
  - `check:syntax`
  - `npm test`
  - `npm run smoke`
  - Playwright before/after das paginas do lote
  - `verify-page-evidence-completeness` das paginas do lote
  - `group4-transition-gate` das paginas do lote
  - atualizacao de documentacao e matriz do lote

## Correcao obrigatoria do gate (BEFORE imutavel)
- O BEFORE regista o estado original real e pode conter defeitos existentes.
- BEFORE valida apenas:
  - artefatos completos (HTML/JS/screenshots/playwright-before);
  - `checks = 3`;
  - navegacao valida (`statusNot200 = 0` e `navigationErrors = 0`).
- BEFORE nao valida qualidade a zero (`horizontalScroll`, `unlabeledVisibleFields`, `smallOperationalTouchTargets`, `consoleErrors`, `failedRequests`, `httpErrors`).
- AFTER continua com validacao completa de qualidade a zero + `checks = 3`.
- Regra permanente:
  - nunca sobrescrever BEFORE apos iniciar migracao;
  - se AFTER falhar, corrigir pagina e recapturar apenas AFTER.

Validacao automatica minima de evidencias por pagina:
- `node scripts/verify-page-evidence-completeness.js --page <slug-da-pagina>`
- `node scripts/verify-page-evidence-completeness.js --pages <p1> <p2> <p3>`

Bloqueio automatico de passagem para a pagina seguinte:
- `node scripts/group4-transition-gate.js --page <pagina-atual> --next <proxima-pagina>`
- `node scripts/group4-transition-gate.js --pages <p1> <p2> <p3> --next-pages <n1> <n2> <n3>`
- Se o gate falhar: transicao bloqueada e pagina permanece `IN_PROGRESS`.
- So com gate `PASS`: pagina pode mudar para `COMPLETED` ou `CERTIFIED`.

Matriz automatica de progresso:
- `node scripts/update-group4-progress-matrix.js`
- `node scripts/update-group4-progress-matrix.js --pages <p1> <p2> <p3>` (resumo focado opcional)
- Artefato: `docs/product/GROUP4_PROGRESS_MATRIX.md`

Captura Playwright por lote (evidencia):
- `node scripts/group4-page-evidence.js --pages <p1> <p2> <p3> --routes </r1> </r2> </r3> --phase before`
- `node scripts/group4-page-evidence.js --pages <p1> <p2> <p3> --routes </r1> </r2> </r3> --phase after`

Exemplo:
- `node scripts/verify-page-evidence-completeness.js --page admin-menu`

## Riscos identificados
1. Falso positivo de atividade por pagina apenas existir no route index.
2. Superficies de suporte com uso raro mascararem regressao de fluxo principal.
3. CSS local legacy conflitar com DS se limpeza nao for seletiva.
4. Dependencias cruzadas entre master-control/menu e modulos de operacao.

## Mitigacoes
1. Validar atividade real antes de cada bloco com navegação e evidencias runtime.
2. Migracao pagina-a-pagina com gates apos cada pagina.
3. Tratar CSS apenas quando REDUNDANTE/CONFLITANTE comprovado.
4. Reauditar freeze em cada ciclo.

## Artefatos a manter quando o Grupo 4 iniciar
- docs/product/GROUP4_SCOPE_MAPPING.md
- docs/product/GROUP4_EXECUTION_PLAN.md
- docs/product/GROUP4_MIGRATION_REPORT.md
- docs/product/GROUP4_ACCEPTANCE_AUDIT.md
- docs/product/evidence/group4/before/*
- docs/product/evidence/group4/after/*

## Decisao desta fase
- Preparacao documental concluida.
- Grupo 4 concluido com ciclos 1 a 24 certificados (`admin-master-control.html`, `admin-menu.html`, `admin-live-map.html`, `admin-map.html`, `admin-crm.html`, `admin-client-settings.html`, `admin-service-log.html`, `admin-reports.html`, `admin-notifications.html`, `admin-operational-settings.html`, `admin-pool-calculator.html`, `admin-collection.html`, `admin-email-logs.html`, `admin-suppliers.html`, `admin-priority.html`, `admin-command-center.html`, `admin-core-flow.html`, `admin-operational-flow.html`, `admin-ai.html`, `admin-company-closures.html`, `admin-onboarding.html`, `admin-payment-settings.html`, `admin-security.html`, `admin-ui-settings.html`).
- Lacuna retroativa do ciclo 1 fechada: evidencia visual + Playwright before/after de `admin-master-control.html` concluida sem nova migracao.
- Nenhuma pagina restante no Grupo 4; Grupo 5 nao foi iniciado automaticamente.
