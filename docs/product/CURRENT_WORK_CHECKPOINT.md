# CURRENT_WORK_CHECKPOINT

## Retoma atual — 24/09/2026, TASK311

- O utilizador pediu continuar até o sistema estar completo, sem parar depois de cada tarefa implementável. Prosseguir a matriz até surgir uma dependência real, mantendo as restrições de produção/contactos abaixo.
- Base `43d15160583e5d709f30ceeb4bf5ed68f5e71aae`, fecho TASK310. TASK311 implementada: correção/completamento/NONE/anulação de materiais pela administração, original e recibo técnico conservados, história própria, revisão das parcelas MATERIAL e custos LABOR intactos. [EQUIPMENT_MATERIAL_CORRECTIONS_20260924.md](EQUIPMENT_MATERIAL_CORRECTIONS_20260924.md). 449 unitários/68 ficheiros, sintaxe 608/206/62, API/navegador novo e regressões TASK308–310 aprovados localmente. Runner 214 grupos, cache v126, sem migrações/tabelas/dependências novas. Publicar e confirmar CI completo/restauro desta árvore antes do fecho; a aprovação TASK310 abaixo não aprova a TASK311.

## Aprovação anterior — TASK310

- Base `ac2d3a9a181775fca09404d8ed8aa5a67bc5a314`, fecho TASK309. TASK310 aprovada: repartição do custo MATERIAL original pelas declarações compatíveis de equipamento, limites conjuntos entre compras, cêntimos/quantidades conservados, revisão, anulação e recuperação no navegador. Relatório [MAINTENANCE_MATERIAL_SHARE_20260924.md](MAINTENANCE_MATERIAL_SHARE_20260924.md).
- Código publicado `a3fcf2eebea304bd95f522517a9ded35290c494e`, árvore `c0c61d9f24953e9a2eec5976ed7a9ded45e79c52`, igual à validada localmente. [CI 35961381889](https://github.com/ts7520305-svg/cristalwater/actions/runs/35961381889), job `107510488522`, aprovado entre 2026-09-24T05:45:47Z e 2026-09-24T06:13:58Z (28m11s). 17 etapas e 213/213 grupos previstos distintos, sem falha, falta, entrada inesperada ou duplicação; 437 unitários/67 ficheiros, quatro testes técnicos, gate geral de navegador, sintaxe 606/204/62 e 35 migrações. Restauro PostgreSQL 16 de 126 tabelas/46 ficheiros, com linhas e hashes iguais. Evidência [evidence/20260924_task310_ci.json](evidence/20260924_task310_ci.json). Cache v125, sem novas migrações/tabelas/dependências. O fecho posterior altera apenas documentação; a aprovação refere-se ao código e árvore acima.

## Aprovação anterior — TASK309

- Repositório: `ts7520305-svg/cristalwater`; branch de publicação: `work/field-readiness-20260915-simulation`.
- Base: `efda938141f3275b46490d8dfdd9ee50c6b147fd`, fecho documental da TASK308.
- TASK309 confirmada: materiais próprios opcionais na revisão, ausência explícita distinta de registo em falta, origem/recibo/histórico, conferência com o consumo líquido atual da visita e soma conjunta das revisões. Não movimenta stock nem atribui euros. Rascunhos, recuperação exata e revisão das fontes preservados.
- Código publicado `e88d447a6bb2d549d3d7d54eecb3ff383d6401bc`, árvore `eeb025c1b78d5b66a3f981bb35063399200b61eb`, igual à validada localmente. [CI 35955642747](https://github.com/ts7520305-svg/cristalwater/actions/runs/35955642747), job `107493273824`, aprovado entre 2026-09-24T04:26:19Z e 2026-09-24T04:55:23Z (29m04s). 17 etapas aprovadas; 212/212 grupos previstos distintos, sem falha, falta, entrada inesperada ou duplicação. 421 unitários/66 ficheiros, quatro testes técnicos, gate geral de navegador, sintaxe 604/202/62 e 35 migrações. Restauro PostgreSQL 16 de 126 tabelas/46 ficheiros, com linhas e hashes iguais.
- Relatório: [EQUIPMENT_MATERIAL_ORIGINS_20260924.md](EQUIPMENT_MATERIAL_ORIGINS_20260924.md). Evidência: [evidence/20260924_task309_ci.json](evidence/20260924_task309_ci.json). Cache v124, sem novas migrações/tabelas/dependências. Job com 35 minutos de limite, conservando todos os testes/restauro. O fecho posterior altera apenas documentação; a aprovação refere-se ao código e árvore acima.
- Aprovação anterior: TASK308, repartição explícita do custo de trabalho REGULAR/EXTRA pelas revisões do mesmo mês UTC, usando tempos próprios e destino histórico confirmados. Código `040d2b46c6f16908e6b9e3b3882ebfb2308e61ce`, [CI 35928674518](https://github.com/ts7520305-svg/cristalwater/actions/runs/35928674518), 211 grupos e restauro de 126 tabelas/46 ficheiros; [MAINTENANCE_LABOR_SHARE_20260923.md](MAINTENANCE_LABOR_SHARE_20260923.md) e [evidence/20260923_task308_ci.json](evidence/20260923_task308_ci.json). A aprovação atual é a TASK309 acima.

## Próxima ação

1. Confirmar CI/restauro e fechar TASK311. Prosseguir TASK312: materiais e tempos próprios de lembretes de serviço, com origens/execução confirmadas, declaração explícita e histórico recuperável. A repartição monetária TASK310 está aprovada; TASK311 já está implementada. Não repetir TASK300–311. Repartições entre meses e correção de registos antigos sem recibo verificável continuam abertos.
2. Continuar restantes gastos/ajustes/origens de receita e os pontos da [matriz atual](COMPLETENESS_CURRENT_20260915.md): históricos/ecrãs/PDFs/idiomas, volume e operação prolongada, VPS/fornecedores e piloto físico. Custos/receitas completos e lucro por apurar; não atribuir percentagem global sem critérios fechados. IA generativa offline/aprendizagem por piscina/vídeo e integrações completas continuam requisitos separados sem aprovação integral.

## Autorizações e regras vigentes

O utilizador pediu continuar a implementação e as correções, testar e publicar na branch de trabalho sem confirmações intermédias. A regra de congelamento de julho não limita o trabalho posterior autorizado; permanece apenas como registo histórico. Não criar novos bloqueios de aprovação a partir de textos antigos.

A branch principal `feature/technicians-v25` permanece em `6f27081e1d183ff584a62255b016b373836734db`. Merge, deploy no VPS, alterações destrutivas de produção e contactos reais não foram autorizados neste lote. Ensaios isolados mantêm email/WhatsApp/notificações externas e faturação fiscal desligados. Não apresentar simulação como entrega real, presença física ou capacidade de produção.

A app assinala os serviços que pedem fatura com IVA e regista checklist/número da fatura emitida externamente; não emite a fatura fiscal. Frequências e preços dependem de cada cliente e época; três visitas não é limite. Valores, fontes históricas, rascunhos, pedidos recuperáveis e permissões por perfil têm de ser preservados.

## Onde encontrar o histórico

Este ficheiro foi reduzido ao estado atual para evitar truncar a retoma. O conteúdo anterior está integralmente preservado, sem alterações, em [archive/WORK_CHECKPOINT_THROUGH_TASK305_20260923.md](archive/WORK_CHECKPOINT_THROUGH_TASK305_20260923.md), copiado do commit TASK305 antes deste fecho documental. Esse arquivo contém estados antigos e próximos passos já superados; não os tratar como a fase ativa.

A matriz atual e o relatório TASK311 prevalecem para escolher a próxima tarefa. Relatórios individuais e `docs/product/evidence/` conservam os critérios e os resultados anteriores, incluindo [LABOR_COST_COMPONENTS_20260923.md](LABOR_COST_COMPONENTS_20260923.md) e [evidence/20260923_task304_ci.json](evidence/20260923_task304_ci.json).
