# CURRENT_WORK_CHECKPOINT

## Retoma atual — 24/09/2026, TASK309

- Repositório: `ts7520305-svg/cristalwater`; branch de publicação: `work/field-readiness-20260915-simulation`.
- Base: `efda938141f3275b46490d8dfdd9ee50c6b147fd`, fecho documental da TASK308.
- TASK309 confirmada: materiais próprios opcionais na revisão, ausência explícita distinta de registo em falta, origem/recibo/histórico, conferência com o consumo líquido atual da visita e soma conjunta das revisões. Não movimenta stock nem atribui euros. Rascunhos, recuperação exata e revisão das fontes preservados.
- Código publicado `e88d447a6bb2d549d3d7d54eecb3ff383d6401bc`, árvore `eeb025c1b78d5b66a3f981bb35063399200b61eb`, igual à validada localmente. [CI 35955642747](https://github.com/ts7520305-svg/cristalwater/actions/runs/35955642747), job `107493273824`, aprovado entre 2026-09-24T04:26:19Z e 2026-09-24T04:55:23Z (29m04s). 17 etapas aprovadas; 212/212 grupos previstos distintos, sem falha, falta, entrada inesperada ou duplicação. 421 unitários/66 ficheiros, quatro testes técnicos, gate geral de navegador, sintaxe 604/202/62 e 35 migrações. Restauro PostgreSQL 16 de 126 tabelas/46 ficheiros, com linhas e hashes iguais.
- Relatório: [EQUIPMENT_MATERIAL_ORIGINS_20260924.md](EQUIPMENT_MATERIAL_ORIGINS_20260924.md). Evidência: [evidence/20260924_task309_ci.json](evidence/20260924_task309_ci.json). Cache v124, sem novas migrações/tabelas/dependências. Job com 35 minutos de limite, conservando todos os testes/restauro. O fecho posterior altera apenas documentação; a aprovação refere-se ao código e árvore acima.
- Aprovação anterior: TASK308, repartição explícita do custo de trabalho REGULAR/EXTRA pelas revisões do mesmo mês UTC, usando tempos próprios e destino histórico confirmados. Código `040d2b46c6f16908e6b9e3b3882ebfb2308e61ce`, [CI 35928674518](https://github.com/ts7520305-svg/cristalwater/actions/runs/35928674518), 211 grupos e restauro de 126 tabelas/46 ficheiros; [MAINTENANCE_LABOR_SHARE_20260923.md](MAINTENANCE_LABOR_SHARE_20260923.md) e [evidence/20260923_task308_ci.json](evidence/20260923_task308_ci.json). A aprovação atual é a TASK309 acima.

## Próxima ação

1. TASK310: repartir explicitamente o custo MATERIAL já confirmado da visita pelas declarações compatíveis de equipamento. Preservar a atribuição/linha de compra e os orçamentos originais, sem novo consumo nem nova valorização da mesma quantidade. As origens/quantidades próprias estão implementadas e aprovadas na TASK309; a repartição monetária ainda não. Não repetir TASK300–309. Correção/anulação das declarações, materiais/tempos próprios de lembretes e repartições entre meses continuam abertos.
2. Continuar restantes gastos/ajustes/origens de receita e os pontos da [matriz atual](COMPLETENESS_CURRENT_20260915.md): históricos/ecrãs/PDFs/idiomas, volume e operação prolongada, VPS/fornecedores e piloto físico. Custos/receitas completos e lucro por apurar; não atribuir percentagem global sem critérios fechados. IA generativa offline/aprendizagem por piscina/vídeo e integrações completas continuam requisitos separados sem aprovação integral.

## Autorizações e regras vigentes

O utilizador pediu continuar a implementação e as correções, testar e publicar na branch de trabalho sem confirmações intermédias. A regra de congelamento de julho não limita o trabalho posterior autorizado; permanece apenas como registo histórico. Não criar novos bloqueios de aprovação a partir de textos antigos.

A branch principal `feature/technicians-v25` permanece em `6f27081e1d183ff584a62255b016b373836734db`. Merge, deploy no VPS, alterações destrutivas de produção e contactos reais não foram autorizados neste lote. Ensaios isolados mantêm email/WhatsApp/notificações externas e faturação fiscal desligados. Não apresentar simulação como entrega real, presença física ou capacidade de produção.

A app assinala os serviços que pedem fatura com IVA e regista checklist/número da fatura emitida externamente; não emite a fatura fiscal. Frequências e preços dependem de cada cliente e época; três visitas não é limite. Valores, fontes históricas, rascunhos, pedidos recuperáveis e permissões por perfil têm de ser preservados.

## Onde encontrar o histórico

Este ficheiro foi reduzido ao estado atual para evitar truncar a retoma. O conteúdo anterior está integralmente preservado, sem alterações, em [archive/WORK_CHECKPOINT_THROUGH_TASK305_20260923.md](archive/WORK_CHECKPOINT_THROUGH_TASK305_20260923.md), copiado do commit TASK305 antes deste fecho documental. Esse arquivo contém estados antigos e próximos passos já superados; não os tratar como a fase ativa.

A matriz atual e o relatório TASK309 prevalecem para escolher a próxima tarefa. Relatórios individuais e `docs/product/evidence/` conservam os critérios e os resultados anteriores, incluindo [LABOR_COST_COMPONENTS_20260923.md](LABOR_COST_COMPONENTS_20260923.md) e [evidence/20260923_task304_ci.json](evidence/20260923_task304_ci.json).
