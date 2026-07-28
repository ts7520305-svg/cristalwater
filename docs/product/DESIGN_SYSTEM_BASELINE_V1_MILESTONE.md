# DESIGN SYSTEM BASELINE V1 MILESTONE

Data: 2026-07-19
Estado do marco: ESTABILIZACAO FORMAL ATIVA (GRUPOS 1 E 2)

## 1. Data e estado do marco
- Data de consolidacao: 2026-07-19.
- Baseline ativa: Design System Baseline v1.
- Estado operacional: pronto para inicio controlado do Grupo 3.
- Restricao ativa: sem autorizacao para teste de campo.

## 2. Grupos certificados
- Grupo 1: CERTIFICADO, nota 9,6/10.
- Grupo 2: CERTIFICADO, nota 9,6/10.

## 3. Paginas certificadas
Grupo 1:
- admin-dashboard.html
- admin-today.html
- admin-alerts.html
- admin-payments.html
- admin-inventory.html

Grupo 2:
- admin-clients.html
- admin-pools.html
- admin-technicians.html
- admin-rounds.html

## 4. Notas finais
- P0 do fluxo principal do Tecnico foi corrigido e validado.
- Testes de sintaxe, testes automatizados, smoke e auditorias de aceitacao foram executados.
- O baseline visual e de comportamento para os grupos certificados fica congelado.

## 5. Testes executados
- npm run check:syntax
- npm test
- npm run smoke
- Auditorias runtime/a11y/responsividade com Playwright em desktop, tablet e mobile.

## 6. Evidencias existentes
- docs/product/GROUP1_FINAL_CERTIFICATION.md
- docs/product/GROUP1_ACCEPTANCE_AUDIT.md
- docs/product/GROUP2_MIGRATION_REPORT.md
- docs/product/GROUP2_ACCEPTANCE_AUDIT.md
- docs/product/evidence/group2/group2-acceptance-diff.patch
- docs/product/evidence/group2/acceptance/group2-runtime-audit.json
- docs/product/evidence/group2/acceptance/group2-a11y-detail.json

## 7. Problemas conhecidos nao bloqueantes
- Existem blocos de estilo legacy localizados em paginas nao parte do freeze atual.
- Existem residuais de implementacoes antigas fora do escopo certificado que nao bloqueiam os grupos 1 e 2.
- O escopo de Reparacoes no Grupo 3 nao apresenta pagina admin dedicada com naming canonico; exige mapeamento funcional antes de migracao visual.

## 8. Regras de congelamento
As paginas certificadas dos Grupos 1 e 2 ficam congeladas.

Podem ser alteradas apenas por:
- bug funcional comprovado;
- falha de seguranca;
- regressao confirmada;
- problema real de acessibilidade;
- mudanca global aprovada do Design System.

Nao alterar por preferencia visual.

Nao permitido neste marco:
- push;
- tag Git;
- alteracao de schema;
- alteracao de backend/APIs/permissoes/logica de negocio, exceto regressao funcional real e comprovada.

## 9. Criterios para reabrir uma pagina certificada
Uma pagina certificada so pode ser reaberta se houver:
- evidencia reproduzivel (passos, contexto, resultado esperado vs atual);
- classificacao do problema (funcional, seguranca, regressao, acessibilidade, DS global);
- impacto operacional identificado;
- aprovacao explicita de reabertura;
- plano de reteste e nova certificacao apos ajuste.

## 10. Proximos grupos
- Grupo 3: iniciar por mapeamento real e validado dos conceitos (sem suposicoes de nomes).
- Grupo 4: bloqueado neste ciclo.
