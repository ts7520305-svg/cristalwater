# CURRENT_WORK_CHECKPOINT

## Retoma atual — 23/09/2026, TASK306

- Repositório: `ts7520305-svg/cristalwater`; branch de publicação: `work/field-readiness-20260915-simulation`.
- Base: `c3461e4e2860968a468bddf75df7e3769470b763`, fecho documental da TASK305.
- Código publicado: `d93f3e2ffea493140d6f3621438f9a5e3b10d511`, árvore `0da598fa0fe424c6ea5ae80a4e7e2a6ab294c29b`, igual à validada localmente. [CI 35912816866](https://github.com/ts7520305-svg/cristalwater/actions/runs/35912816866), job `107356686960`, aprovado em 23/09/2026 entre 19:58:12 e 20:27:00 UTC (28m48s): 17 etapas, 209/209 grupos previstos distintos, sem falha, falta ou duplicação. Restauro PostgreSQL 16 de 126 tabelas/46 ficheiros, linhas e hashes iguais.
- TASK306 confirmada no CI e restauro: a cobertura conta as parcelas monetárias de uma composição de trabalho confirmada como uma medição da visita. Corrige a falsa classificação LABOR_REVIEW de composições v1/v2, sem alterar montantes nem esconder parcelas alteradas, grupos forjados ou conflitos reais de horários.
- Local e CI: novo teste de API/ecrã/contexto financeiro e regressões de cobertura, assistente financeiro API/UI e integridade dos tempos aprovados. 409 unitários/65 ficheiros; sintaxe 601/201/62. Mantém 35 migrações, 126 tabelas e cache v121; runner 209 grupos.
- Relatório: [COMPOSED_LABOR_COVERAGE_20260923.md](COMPOSED_LABOR_COVERAGE_20260923.md). Evidência: [evidence/20260923_task306_ci.json](evidence/20260923_task306_ci.json). O fecho posterior altera apenas documentação, conservando o código/testes aprovados.
- Aprovação anterior: TASK305, código `c6e44f8360ec6a0d0eefe17a060bc075f0d88bda`, [CI 35907124329](https://github.com/ts7520305-svg/cristalwater/actions/runs/35907124329), 208 grupos e restauro de 126 tabelas/46 ficheiros; [evidence/20260923_task305_ci.json](evidence/20260923_task305_ci.json). A aprovação atual é a TASK306 indicada acima.

## Próxima ação

1. Continuar o financeiro a partir de [COMPLETENESS_CURRENT_20260915.md](COMPLETENESS_CURRENT_20260915.md): custos medidos próprios das manutenções, restantes gastos/ajustes e origens de receita. Definir a próxima lacuna com código e critérios verificáveis antes de a implementar. TASK300–306 já confirmadas no respetivo CI/restauro; não repetir.
2. Restam ainda revisão dos históricos/ecrãs/PDFs/idiomas, volume e operação prolongada, VPS/fornecedores e piloto físico. Custos/receitas completos e lucro por apurar; não atribuir percentagem global sem critérios fechados. IA generativa offline/aprendizagem por piscina/vídeo e integrações completas continuam requisitos separados sem aprovação integral.

## Autorizações e regras vigentes

O utilizador pediu continuar a implementação e as correções, testar e publicar na branch de trabalho sem confirmações intermédias. A regra de congelamento de julho não limita o trabalho posterior autorizado; permanece apenas como registo histórico. Não criar novos bloqueios de aprovação a partir de textos antigos.

A branch principal `feature/technicians-v25` permanece em `6f27081e1d183ff584a62255b016b373836734db`. Merge, deploy no VPS, alterações destrutivas de produção e contactos reais não foram autorizados neste lote. Ensaios isolados mantêm email/WhatsApp/notificações externas e faturação fiscal desligados. Não apresentar simulação como entrega real, presença física ou capacidade de produção.

A app assinala os serviços que pedem fatura com IVA e regista checklist/número da fatura emitida externamente; não emite a fatura fiscal. Frequências e preços dependem de cada cliente e época; três visitas não é limite. Valores, fontes históricas, rascunhos, pedidos recuperáveis e permissões por perfil têm de ser preservados.

## Onde encontrar o histórico

Este ficheiro foi reduzido ao estado atual para evitar truncar a retoma. O conteúdo anterior está integralmente preservado, sem alterações, em [archive/WORK_CHECKPOINT_THROUGH_TASK305_20260923.md](archive/WORK_CHECKPOINT_THROUGH_TASK305_20260923.md), copiado do commit TASK305 antes deste fecho documental. Esse arquivo contém estados antigos e próximos passos já superados; não os tratar como a fase ativa.

A matriz atual e o relatório TASK306 prevalecem para escolher a próxima tarefa. Relatórios individuais e `docs/product/evidence/` conservam os critérios e os resultados anteriores, incluindo [LABOR_COST_COMPONENTS_20260923.md](LABOR_COST_COMPONENTS_20260923.md) e [evidence/20260923_task304_ci.json](evidence/20260923_task304_ci.json).
