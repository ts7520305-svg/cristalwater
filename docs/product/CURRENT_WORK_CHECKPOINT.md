# CURRENT_WORK_CHECKPOINT

## Retoma atual — 24/09/2026, TASK309

- Repositório: `ts7520305-svg/cristalwater`; branch de publicação: `work/field-readiness-20260915-simulation`.
- Base: `efda938141f3275b46490d8dfdd9ee50c6b147fd`, fecho documental da TASK308.
- TASK309 implementada, em validação final: materiais próprios opcionais na revisão, ausência explícita distinta de registo em falta, origem/recibo/histórico, conferência com o consumo líquido atual da visita e soma conjunta das revisões. Não movimenta stock nem atribui euros. Rascunhos, recuperação exata e revisão das fontes preservados. Relatório `EQUIPMENT_MATERIAL_ORIGINS_20260924.md`; 421 unitários/66 ficheiros, sintaxe 604/202/62, runner 212 grupos, cache v124, sem novas migrações/tabelas/dependências. Publicar esta árvore e confirmar CI nativo/restauro antes de fechar. A aprovação anterior abaixo não aprova a TASK309.
- Código publicado `040d2b46c6f16908e6b9e3b3882ebfb2308e61ce`, árvore `199569a05bbff270a14a7c3c44e091186411fe38`, igual à validada localmente. [CI 35928674518](https://github.com/ts7520305-svg/cristalwater/actions/runs/35928674518), job `107409794869`, aprovado entre 2026-09-23T22:30:04Z e 2026-09-23T22:55:57Z (25m53s). 17 etapas aprovadas; 211/211 grupos previstos distintos, sem falha, falta, entrada inesperada ou duplicação. 409 unitários/65 ficheiros, quatro testes técnicos, gate geral de navegador, sintaxe 603/202/62 e 35 migrações. Restauro PostgreSQL 16 de 126 tabelas/46 ficheiros, com linhas e hashes iguais.
- TASK308 confirmada: repartição explícita de um custo de trabalho REGULAR/EXTRA com revisões de equipamento do mesmo mês UTC, usando os tempos próprios e o destino histórico confirmados. Cêntimos, reservas de tempo, despesa e pagamentos conservados; projeção comum por execução/cliente/técnico/IA, histórico recuperável, revisão e anulação. Componentes de composição repartidos separadamente; anulação do custo original protegida.
- Relatório: [MAINTENANCE_LABOR_SHARE_20260923.md](MAINTENANCE_LABOR_SHARE_20260923.md). Evidência: [evidence/20260923_task308_ci.json](evidence/20260923_task308_ci.json). Mantém 35 migrações/126 tabelas, cache v123, runner 211 grupos. Job com 35 minutos de limite, conservando todos os testes/restauro. O fecho posterior altera apenas documentação.
- Aprovação anterior: TASK307, código `8af70dc573370101a8f6d3b9f712daf6008bddae`, [CI 35919764440](https://github.com/ts7520305-svg/cristalwater/actions/runs/35919764440), 210 grupos e restauro de 126 tabelas/46 ficheiros; [evidence/20260923_task307_ci.json](evidence/20260923_task307_ci.json). A aprovação atual é a TASK308 acima.

## Próxima ação

1. Confirmar publicação, CI completo e restauro da TASK309, depois repartir explicitamente o custo MATERIAL já confirmado da visita pelas declarações compatíveis de equipamento. Preservar a atribuição/linha de compra e os orçamentos originais, sem novo consumo nem nova valorização da mesma quantidade. As origens/quantidades próprias estão implementadas nesta TASK309; a repartição monetária ainda não. Não repetir TASK300–309. Correção/anulação das declarações, materiais/tempos próprios de lembretes e repartições entre meses continuam abertos.
2. Continuar restantes gastos/ajustes/origens de receita e os pontos da [matriz atual](COMPLETENESS_CURRENT_20260915.md): históricos/ecrãs/PDFs/idiomas, volume e operação prolongada, VPS/fornecedores e piloto físico. Custos/receitas completos e lucro por apurar; não atribuir percentagem global sem critérios fechados. IA generativa offline/aprendizagem por piscina/vídeo e integrações completas continuam requisitos separados sem aprovação integral.

## Autorizações e regras vigentes

O utilizador pediu continuar a implementação e as correções, testar e publicar na branch de trabalho sem confirmações intermédias. A regra de congelamento de julho não limita o trabalho posterior autorizado; permanece apenas como registo histórico. Não criar novos bloqueios de aprovação a partir de textos antigos.

A branch principal `feature/technicians-v25` permanece em `6f27081e1d183ff584a62255b016b373836734db`. Merge, deploy no VPS, alterações destrutivas de produção e contactos reais não foram autorizados neste lote. Ensaios isolados mantêm email/WhatsApp/notificações externas e faturação fiscal desligados. Não apresentar simulação como entrega real, presença física ou capacidade de produção.

A app assinala os serviços que pedem fatura com IVA e regista checklist/número da fatura emitida externamente; não emite a fatura fiscal. Frequências e preços dependem de cada cliente e época; três visitas não é limite. Valores, fontes históricas, rascunhos, pedidos recuperáveis e permissões por perfil têm de ser preservados.

## Onde encontrar o histórico

Este ficheiro foi reduzido ao estado atual para evitar truncar a retoma. O conteúdo anterior está integralmente preservado, sem alterações, em [archive/WORK_CHECKPOINT_THROUGH_TASK305_20260923.md](archive/WORK_CHECKPOINT_THROUGH_TASK305_20260923.md), copiado do commit TASK305 antes deste fecho documental. Esse arquivo contém estados antigos e próximos passos já superados; não os tratar como a fase ativa.

A matriz atual e o relatório TASK309 prevalecem para escolher a próxima tarefa. Relatórios individuais e `docs/product/evidence/` conservam os critérios e os resultados anteriores, incluindo [LABOR_COST_COMPONENTS_20260923.md](LABOR_COST_COMPONENTS_20260923.md) e [evidence/20260923_task304_ci.json](evidence/20260923_task304_ci.json).
