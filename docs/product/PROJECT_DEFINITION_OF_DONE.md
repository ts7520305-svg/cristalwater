# PROJECT_DEFINITION_OF_DONE

Data: 2026-07-20
Estado: OFICIAL
Escopo inicial: Grupo 4 (extensivel aos grupos seguintes)

## Objetivo
Definir, de forma unica e oficial, quando uma pagina pode ser considerada concluida no processo de migracao da Cristal Water.

## Regra fundamental
Uma pagina so pode ser marcada como `COMPLETED` ou `CERTIFIED` quando TODOS os criterios abaixo estiverem cumpridos.

## Criterios obrigatorios de conclusao por pagina
1. `verify-page-evidence-completeness` com `PASS`.
2. `group4-transition-gate` com `TRANSITION_ALLOWED` para a pagina atual.
3. Evidencia before/after completa:
   - before HTML
   - before JS
   - before screenshots (desktop/tablet/mobile)
   - before Playwright
   - after HTML
   - after JS
   - after screenshots (desktop/tablet/mobile)
   - after Playwright
4. Playwright limpo (sem erros de navegacao/console/rede e sem regressao nos indicadores definidos).
5. Gates tecnicos aprovados:
   - `npm run check:syntax`
   - `npm test`
   - `npm run smoke`
6. Documentacao do ciclo atualizada (migracao e auditoria incremental).
7. Matriz de progresso atualizada.
8. Pagina marcada como `CERTIFIED`.

## Correcao obrigatoria do gate - preservar evidencia BEFORE
Foi identificado e corrigido um erro metodologico: o estado BEFORE representa o original real da pagina e pode conter defeitos existentes.

BEFORE deve exigir apenas:
- HTML presente;
- JS presente;
- screenshots `desktop/tablet/mobile` presentes;
- `playwright-before.json` presente;
- `checks = 3`;
- navegacao valida (`statusNot200 = 0` e `navigationErrors = 0`).

BEFORE nao exige indicadores de qualidade a zero.

AFTER deve exigir:
- `statusNot200 = 0`;
- `navigationErrors = 0`;
- `horizontalScroll = 0`;
- `unlabeledVisibleFields = 0`;
- `smallOperationalTouchTargets = 0`;
- `consoleErrors = 0`;
- `failedRequests = 0`;
- `httpErrors = 0`;
- `checks = 3`.

Regra permanente:
- nunca sobrescrever o BEFORE depois de iniciar a migracao;
- se o AFTER falhar, corrigir a pagina e recapturar apenas o AFTER;
- o BEFORE e imutavel e representa o estado original real.

## Politica de bloqueio
Se qualquer criterio falhar:
- a pagina permanece `IN_PROGRESS`;
- a proxima pagina NAO pode ser iniciada.

## Comandos de referencia
- `node scripts/verify-page-evidence-completeness.js --page <pagina>`
- `node scripts/group4-transition-gate.js --page <pagina-atual> --next <proxima-pagina>`
- `node scripts/update-group4-progress-matrix.js`

## Governanca
Este documento e a fonte oficial da definicao de "concluido" para migracao controlada.
Mudancas neste criterio exigem atualizacao explicita deste arquivo antes de entrarem em vigor.
