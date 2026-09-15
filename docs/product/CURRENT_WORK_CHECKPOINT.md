# CURRENT_WORK_CHECKPOINT

## Ponto de retoma atual — 15/09/2026

- Repositório: `ts7520305-svg/cristalwater`.
- Branch de trabalho: `work/field-readiness-20260915-simulation`.
- Última entrega remota verificada: TASK122, commit `d9c3af4591f2027a846d3e20211762909e227cc0`; workflow `34955946592` aprovado, incluindo PostgreSQL 16 e restauro de 99 tabelas/11 anexos.
- TASK123: notas da piscina e seleção correta dos lembretes no endpoint da rota, implementadas. Teste API com 505 lembretes gerais, 23 operacionais, duas piscinas, reatribuição e visitas extra aprovado em `field-qa-runtime/run-1789467419688`. 218 testes unitários e 4 de técnicos aprovados.
- Continuação ativa: apresentação das instruções e proteção da confirmação de início da visita (TASK124). Sem aprovações intermédias conforme pedido «continua sem parar».
- Relatório atual: `VISIT_BRIEFING_API_20260915.md`. Inventário concluído nas TASK121/TASK122; não repetir a implementação.

### Pedido ativo

O proprietário pediu continuar a implementação e correções sem aprovações intermédias, concluir os módulos e testar os percursos completos, como registado em `FIELD_READINESS_20260914.md`. Não voltar a usar o congelamento de julho para impedir este trabalho autorizado. Instalação no VPS, ensaios físicos, canais externos, emissão fiscal, alterações destrutivas de produção e merge para a branch principal não fazem parte desta tarefa.

### Estado verificado

O código contém as entregas até TASK118: orçamentos versionados e portal, preços por período, sessões/logout, idiomas, proteção de dados, manutenção preventiva com configuração e avisos, retornos de visitas e seleção de cargas de químicos. Cada relatório delimita o escopo efetivamente testado; não significa que a especificação inteira esteja concluída.

A TASK119 unifica a identidade de produto/unidade entre saldo, movimento e repetição da contagem; conserva reenvios antigos exatos; recusa tipos malformados; protege contra repetição com quantidade alterada e consumo concorrente.

### Evidência da TASK119 (retoma anterior)

Evidência atual da TASK120: 216 testes unitários, 4 testes de técnicos, os 15 scripts de navegador e os 32 grupos integrados locais aprovados. Resultado: `reports/field-suite/1789464442010/results.json`. As imagens atuais estão em `reports/field-visual/inventory-count-<timestamp>/`. O relatório `INVENTORY_COUNT_UI_20260915.md` delimita os ensaios e as pendências.

- Base local e remota da TASK118 com a mesma árvore Git: `8cc09c0e3df85a82a5da7751924b4d4b7dda0699`.
- Sintaxe aprovada em 484 ficheiros backend e nos scripts alterados.
- `npm test`: 216 testes em 49 ficheiros aprovados; `npm run test:technician`: 4 aprovados.
- Teste operacional de stock em base descartável aprovado: `field-qa-runtime/run-1789462922026`.
- Bateria integrada local: `reports/field-suite/1789462961988/results.json`; 31 grupos aprovados, incluindo a versão final dos testes de contagem. Base descartável PGlite, sem alegações de desempenho do VPS.
- `npm run test:field-browser`: os 14 scripts de navegador aprovados.
- PostgreSQL 16/migrações/restauro: confirmar o workflow do commit final; não usar a aprovação de um commit anterior como prova desta alteração.

### Próxima retoma

1. Concluir a apresentação e confirmação das instruções no modo de campo (TASK124); executar a bateria final e confirmar o workflow do commit publicado.
2. Continuar a revisão dos módulos pendentes usando `COMPLETENESS_20260915.md` juntamente com `IMPLEMENTATION_20260915.md` e os relatórios posteriores. A matriz de completude conserva o diagnóstico inicial e contém pontos já corrigidos posteriormente.
3. Manter tarefas pequenas, com testes de comportamento e documentação. Não repetir trabalho apenas por encontrar um relatório antigo.
4. Ensaios físicos e VPS permanecem pendentes. Não declarar o sistema inteiro concluído ou certificado para campo.

## Registo histórico — 21/07/2026 (não é a fase ativa)

1. Data e hora
- 2026-07-21 09:12 UTC

2. Fase ativa
- FASE 6.0 - VALIDACAO GLOBAL E TESTES DE CAMPO.

3. Estado atual
- GRUPOS 1-5 CERTIFICADOS E CONGELADOS.
- GRUPO 6 NAO INICIADO.
- PROJETO EM FASE OFICIAL DE VALIDACAO GLOBAL.

4. Resultado consolidado
- Bloco 1 (Admin): PASS.
- Bloco 2 (Tecnico): PASS.
- Bloco 3 (Cliente): PASS.
- Bloco 4 (Campo): automacao concluida; falta validacao humana em campo.
- Bloco 5: nenhum bug real confirmado.
- Bloco 6: pronto para preparacao de release apos testes de campo.

5. Ultimo passo concluido
- Inicio da validacao de campo controlada (Dia 1): automacao executada, sem bug funcional real confirmado; 2 validacoes pendentes de compatibilidade de scripts registradas em GLOBAL_VALIDATION_ISSUE_TRACKER.md (GV-V001/GV-V002).

6. Artefatos finais criados/atualizados
- docs/product/GROUP4_MIGRATION_REPORT.md
- docs/product/GROUP4_ACCEPTANCE_AUDIT.md
- docs/product/GROUP4_SCOPE_MAPPING.md
- docs/product/GROUP4_EXECUTION_PLAN.md
- docs/product/GROUP4_PROGRESS_MATRIX.md
- docs/product/GROUP4_FINAL_AUDIT.md
- docs/product/GROUP4_FINAL_CERTIFICATION.md
- docs/product/CERTIFIED_UI_FREEZE_REGISTER.md
- docs/product/CURRENT_TODO.md
- docs/product/GROUP5_SCOPE_MAPPING.md
- docs/product/GROUP5_EXECUTION_PLAN.md
- docs/product/GROUP5_MIGRATION_REPORT.md
- docs/product/GROUP5_ACCEPTANCE_AUDIT.md
- docs/product/GROUP5_FINAL_AUDIT.md
- docs/product/GROUP5_FINAL_CERTIFICATION.md
- docs/product/GROUP6_PRECHECK.md
- docs/product/GLOBAL_VALIDATION_PHASE_PLAN.md
- docs/product/FIELD_TEST_EXECUTION_PROTOCOL.md
- docs/product/GLOBAL_VALIDATION_ISSUE_TRACKER.md

7. Evidencias finais
- docs/product/evidence/group4/before/*
- docs/product/evidence/group4/after/*

8. Regras de retoma
- Nao iniciar Grupo 6.
- Nao adicionar funcionalidades.
- Nao fazer redesign.
- Corrigir apenas bugs reais encontrados em campo.

9. Proximo passo permitido
- Iniciar validacao de campo real seguindo docs/product/FIELD_TEST_EXECUTION_PROTOCOL.md.

12. Estado da validacao de campo (hoje)
- Bloco 4 automatizavel executado.
- Pendencias: alinhar scripts legados de automacao com autenticacao atual antes de reutilizacao plena.
- Validacao humana em campo continua obrigatoria (janela 5-7 dias).
- Regra de prioridade ativa: P0/P1 corrige imediato; P2/P3 apenas registra durante a janela.

10. Confirmar
- Nenhum commit.
- Nenhum push.
- Nenhuma tag.

11. Documentos principais para retoma
- docs/product/CURRENT_WORK_CHECKPOINT.md
- docs/product/CURRENT_TODO.md
- docs/product/GLOBAL_VALIDATION_PHASE_PLAN.md
- docs/product/FIELD_TEST_EXECUTION_PROTOCOL.md
- docs/product/CERTIFIED_UI_FREEZE_REGISTER.md
