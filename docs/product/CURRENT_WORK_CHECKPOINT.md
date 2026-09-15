# CURRENT_WORK_CHECKPOINT

## Ponto de retoma atual — 15/09/2026

- Repositório: `ts7520305-svg/cristalwater`.
- Branch de trabalho: `work/field-readiness-20260915-simulation`.
- Última entrega remota verificada: TASK131, commit `b44141c21551c011437f56bcc4f65716473b14ff`; workflow `34969380298` aprovado, incluindo 272 testes unitários, 17 scripts de navegador, 37 grupos operacionais, PostgreSQL 16 e restauro de 99 tabelas/11 anexos.
- TASK123: notas da piscina e seleção correta dos lembretes no endpoint da rota, implementadas. Teste API com 505 lembretes gerais, 23 operacionais, duas piscinas, reatribuição e visitas extra aprovado em `field-qa-runtime/run-1789467419688`. 218 testes unitários e 4 de técnicos aprovados.
- TASK124: notas no ecrã de campo, avisos recorrentes atrasados e confirmação de início completa e vinculada à visita/sessão implementados. Percurso real verificado em PT/EN/FR/ES/DE; regressão local final aprovada: 218 testes unitários, 4 de técnicos, 17 scripts de navegador e 33 grupos integrados (`reports/field-suite/1789468180539/results.json`). Imagem: `reports/field-visual/visit-briefing-1789468325934/technician-briefing-mobile.png`. Workflow PostgreSQL 16/restauro aprovado no commit acima. Continuação sem aprovações intermédias conforme pedido «continua sem parar».
- Relatórios atuais: `VISIT_BRIEFING_API_20260915.md` e `VISIT_BRIEFING_UI_20260915.md`. Inventário concluído nas TASK121/TASK122; não repetir a implementação.

- TASK125 implementada: conclusão atómica/idempotente dos serviços periódicos na ficha, CRM e agenda; interface protegida contra cliques repetidos e respostas perdidas. Relatório `SERVICE_REMINDER_COMPLETION_20260915.md`. Reprodução inicial confirmada; testes dirigidos API/base/Chromium aprovados em `field-qa-runtime/run-1789469812066`. Bateria local final aprovada: 234 testes unitários, 4 de técnicos, 17 scripts de navegador, sintaxe de 487 ficheiros backend e 34 grupos integrados (`reports/field-suite/1789469956928/results.json`). Workflow PostgreSQL 16/restauro da TASK125 aprovado conforme o commit acima.

- TASK126: consulta completa dos lembretes com pendentes antes do histórico; reprodução confirmou zero pendentes na ficha perante 105 concluídos/505 pendentes. Relatório `REMINDER_VISIBILITY_20260915.md`. Teste da consulta aprovado em `field-qa-runtime/run-1789470809542`, com 235 testes unitários e 4 de técnicos.

- TASK127: criação com `requestId`, comprovativo transacional e recusa de repetições alteradas implementada. 249 testes unitários, 4 de técnicos e testes integrados dirigidos aprovados em `field-qa-runtime/run-1789471051397`. Os três formulários são tratados pela TASK128. Relatório `REMINDER_CREATION_API_20260915.md`.

- TASK128 implementada: pedido persistido e imutável nos três formulários, repetição explícita, duas janelas, confirmação inválida, quota/corrupção, rejeição e mudança de sessão. Relatório `REMINDER_CREATION_UI_20260915.md`. Versão final aprovada em `field-qa-runtime/run-1789472050268`, incluindo PT/EN/FR/ES/DE e recuperação da carga inicial. 249 testes unitários, 4 de técnicos e 17 scripts de navegador aprovados; 34 grupos da bateria `reports/field-suite/1789471734616/results.json` passaram, e a falha do novo grupo nos idiomas foi corrigida e revalidada no teste dirigido final. Os 35 grupos e o restauro passaram no workflow 34964272796 do commit f453c729575453c7a6e62d9aeff68b995fbbc17d. Imagem: `reports/field-visual/reminder-creation-1789472056455/lembrete-recuperado.png`.

- TASK129 implementada: eliminação com IDs/categoria/piscina estritos, versão otimista, comprovativo transacional e repetição segura. Ensaio dirigido aprovado em `field-qa-runtime/run-1789473148930`, incluindo criação e conclusão existentes. Relatório `REMINDER_DELETION_API_20260915.md`. A confirmação nos ecrãs está implementada na TASK130.

- TASK130 implementada: confirmação de eliminação comum à ficha/CRM, título e piscina exatos, sessão/versão, resposta perdida ou trocada, refrescamento falhado e cliques tardios. Relatório `REMINDER_DELETION_UI_20260915.md`. 36 grupos integrados aprovados em `reports/field-suite/1789473623034/results.json`, com 272 testes unitários, 4 de técnicos e 17 scripts de navegador. Revisão final de libertação dos botões verificada no ensaio dirigido `field-qa-runtime/run-1789473837096`; workflow 34966846294 aprovado no commit c172760caeb34d1f918f7b0992ea5f33047a2539, incluindo PostgreSQL e restauro.

- TASK131 implementada: listas do CRM coerentes, conclusão com confirmação validada, repetição segura, rejeição de consultas/respostas antigas e estados históricos corretos. Reprodução em `field-qa-runtime/run-1789474663761`; ensaio dirigido aprovado em `field-qa-runtime/run-1789474965482`. Relatório `CRM_REMINDER_COMPLETION_20260915.md`. 37 grupos aprovados em `reports/field-suite/1789475096683/results.json`. Revisão final aprovada em `field-qa-runtime/run-1789475349814`, com 272 testes unitários/4 de técnicos; 17 scripts de navegador aprovados. Imagem revista em `reports/field-visual/crm-reminders-1789475367994/crm-lembrete-concluido.png`. Confirmar workflow publicado.

- TASK132 implementada após divergência entre dois workflows da TASK131: um passou; outro falhou ao esperar a recuperação em português. Reprodução determinística confirmou perda da última escolha de idioma durante resposta anterior retida e reload. Preferência pendente agora conservada por conta e retomada; ensaio dirigido aprovado em `field-qa-runtime/run-1789476149709`. Teste de recuperação passa a isolar o idioma esperado. Relatório `LANGUAGE_RELOAD_RECOVERY_20260915.md`. Confirmar CI final com 38 grupos.

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

1. TASK123–TASK131 publicadas; TASK132 corrige a preferência de idioma pendente identificada na investigação do CI. Confirmar o workflow final com 38 grupos nesta conversa. Não repetir estas implementações.
2. A coerência e conclusão dos lembretes no CRM estão tratadas na TASK131. Prosseguir a revisão dos outros ecrãs operacionais, a partir da implementação atual e relatórios posteriores; não repetir os fluxos de lembretes já corrigidos.
3. Continuar a revisão dos módulos pendentes usando `COMPLETENESS_20260915.md` juntamente com `IMPLEMENTATION_20260915.md` e os relatórios posteriores. A matriz de completude conserva o diagnóstico inicial e contém pontos já corrigidos posteriormente.
4. Manter tarefas pequenas, com testes de comportamento e documentação. Não repetir trabalho apenas por encontrar um relatório antigo.
5. Ensaios físicos e VPS permanecem pendentes. Não declarar o sistema inteiro concluído ou certificado para campo.

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
