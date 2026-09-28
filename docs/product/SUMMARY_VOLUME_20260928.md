# Volume dos resumos — C03 / TASK404 e TASK409

## Atualização TASK409 — memória do resumo administrativo

**Correção aprovada localmente; CI nativo pendente.** O CI TASK407 (`36466632283`, job `109078229561`, commit `6c77104d...`) falhou no dashboard de 400 clientes: RSS ultrapassou a guarda de **768 MiB**. O pico exato ficou fora do excerto do erro; não é inferido. Passaram 311/312 grupos, e o restauro não correu. C03 mantém-se em validação apesar dos ensaios nativos anteriores aprovados.

O dashboard só utiliza `.summary` do catálogo de referências externas, mas carregava também todos os clientes, faturas, linhas, pagamentos, cópias do cliente, hashes de revisão e histórico projetado dos documentos. O novo modo interno do mesmo Business seleciona os campos necessários e reutiliza as regras existentes de elegibilidade, referências, conflitos, precedência do histórico, normalização e arredondamento. A lista financeira normal mantém documentos/tokens, ações e contratos públicos. As oito fontes continuam na mesma transação `RepeatableRead`; falha de qualquer fonte recusa todo o resumo.

**Sete testes novos**, três dos quais falharam antes da correção: o resumo devolvia clientes completos, lia relações desnecessárias e gerava tokens descartados. Conferem também valores esperados explicitamente (incluindo montantes divergentes antes da normalização), referências confirmadas/internas/duplicadas/inválidas, histórico divergente/interno, herança do pedido por cliente/documento, dados fiscais incompletos, falhas das três fontes e preservação dos tokens da lista normal. Não se alterou nenhuma regra financeira.

### Medição local antes/depois

Duas execuções anteriores em base PGlite 0.5.8 nova ficaram dentro da guarda: **576,76 e 601,26 MiB** no maior perfil. O erro de RSS é o reproduzido no CI PostgreSQL, não uma falha local inventada. A tabela compara a segunda medição anterior (com conclusão integral confirmada) com a versão corrigida, usando o mesmo formato de fixture e base nova.

| Clientes | RSS anterior (MiB) | RSS corrigido (MiB) | Tempo anterior (ms) | Tempo corrigido (ms) | JSON (bytes) |
|---:|---:|---:|---:|---:|---:|
| 25 | 175.42 | 165.05 | 276.3 | 285.0 | 2,733,855 |
| 100 | 267.12 | 219.93 | 685.4 | 446.0 | 4,208,417 |
| 400 | 601.26 | 438.89 | 2534.6 | 1410.1 | 10,098,101 |

No perfil de 400, RSS **601,26 → 438,89 MiB** (cerca de 27% nesta comparação); corpo **10 098 101 bytes**, totais/IDs completos. Processo Node novo por GET, API+cliente HTTP; exclui base e navegador. Guardas **30 s / 64 MiB JSON / 768 MiB RSS** conservadas. São observações, não percentis nem garantia de VPS.

O ensaio de volume passou em **27 285 ms**, incluindo processo: quatro APIs × três escalas = doze perfis positivos, três falhas tardias, limpeza de dez modelos/configuração original. O modo de referência repõe agora também a leitura financeira completa anterior; hashes do JSON integral coincidem na base e com 25 clientes da mesma fixture. A maior escala tem **64 816 linhas**, 41 600 visitas/9 600 documentos/3 200 pagamentos. A prova não afirma comparação byte a byte entre fixtures novas com UUIDs diferentes.

**Regressões:** snapshot/API/UI operacionais, resumo fiscal, revisão de referências e registo externo passaram; marcadores finais lidos. Confirmados documentos pagos/retirados, Unicode, cêntimos, referências históricas, perfis, falhas, concorrência de comandos, resposta perdida/repetição e interface. Todas as operações usam QA com integrações desligadas. Snapshot local mantém os totais anteriores e seguintes; PGlite serializa o escritor (`committedBeforeRemaining: false`), pelo que a prova concorrente real continua dependente do PostgreSQL.

**Gates:** 1 318 unitários/135 ficheiros, quatro técnicos, sintaxe 695/307/44, node-check/diff-check. Runner continua com **313 scripts**. Uma falha futura de volume inclui a medição exata também no `results.json` pequeno do CI, conservando o JSON próprio; evita perder o pico no excerto de erro truncado.

**Lote (10 ficheiros):** dois Business, dois scripts de volume, teste unitário novo e teste de snapshot atualizado, este relatório, plano, checkpoint e evidência. [Evidência TASK409](evidence/20260928_task409_local.json). Sem alteração de schema, dependências, endpoints/cache v207, implantação, merge ou contactos reais.

**Limites e continuação:** continuam leituras proporcionais ao total de documentos, referências/histórico e visitas do mês; esta alteração retira relações/tokens descartados, não certifica memória constante. CI TASK408 (`36474118500`) está na suite integrada na última consulta; não cobre ainda a correção TASK409. Exigir no CI da correção 313 grupos exatos, restauro 128 tabelas/ficheiros conferidos e JSONs de snapshot/volume aprovados. Depois seguir C04-E/F. Contagem principal: 28 por iniciar, C04 em execução, C03 em validação e duas concluídas.

## Histórico TASK404

28/09/2026. **Validação local concluída; confirmação nativa pendente.** A correção elimina o carregamento de campos e relações que o resumo administrativo não utiliza. Na reprodução com 400 clientes acrescentados à base QA anterior, o pico passou de **1 119,93 para 672,23 MiB**; a resposta JSON foi comparada integralmente com as projeções antigas. O ensaio final abaixo usa uma base nova e mede **705,55 MiB** no maior dashboard. São observações locais, não uma garantia de capacidade do VPS.

## Cenários e método

Cada escala contém 25, 100 ou 400 clientes com uma piscina, 104 visitas semanais de 2018–2019, 24 documentos e oito pagamentos por cliente. Dez alertas técnicos e dez notificações por cliente incluem estados abertos e resolvidos; existem ainda dois alertas gerais e duas pendências operacionais por cliente. São usados 16 técnicos. A escala maior tem **64 816 linhas sintéticas**, incluindo 41 600 visitas, 9 600 documentos e 3 200 pagamentos. Contagens reais por tabela, linhas lidas, número/duração SQL, bytes e hashes de IDs estão na [evidência](evidence/20260928_task404_local.json).

Os quatro GETs autenticados são `/api/dashboard/admin?monthRef=2019-12`, `/api/dashboard/metrics?force=1`, `/api/alerts` e `/api/operational-risk/summary`. Cada chamada corre num processo Node novo. O tempo vai do início do pedido à leitura completa do corpo HTTP; o RSS/heap é amostrado a cada 5 ms e após o parse. A inicialização ocorre antes da medição; o pico de vida do processo é registado separadamente. A memória inclui a API e o cliente HTTP local, não inclui o servidor de base de dados nem o navegador. Há uma observação final por escala/API, sem percentis de latência.

A base final PGlite 0.5.8 foi criada com o esquema atual, sem mudar o planeador. Os perfis são cumulativos e as linhas/configuração sintéticas são removidas no fim; as contagens das dez tabelas e o registo original das regras têm de coincidir com o início. Testes novos entram no runner oficial: **309 grupos**, mantendo o limite existente de 120 s por grupo. O grupo de volume final levou **24,2 s**, incluindo preparação, 21 subprocessos, falhas e limpeza.

## Medições finais

Bytes são os bytes reais do JSON; MiB = 1 048 576 bytes. O pico é RSS absoluto do processo, não apenas a diferença para o arranque.

| Clientes | API | Tempo, ms | JSON, bytes | Pico RSS, MiB | Pico heap, MiB |
|---:|---|---:|---:|---:|---:|
| 25 | Resumo administrativo | 285.9 | 2 733 855 | 174.41 | 36.38 |
| 25 | Métricas diárias | 33.0 | 415 | 86.82 | 15.15 |
| 25 | Alertas completos | 133.4 | 887 251 | 121.06 | 29.83 |
| 25 | Riscos operacionais | 68.6 | 280 368 | 83.62 | 18.06 |
| 100 | Resumo administrativo | 658.2 | 4 208 417 | 287.17 | 65.43 |
| 100 | Métricas diárias | 28.9 | 415 | 86.85 | 15.90 |
| 100 | Alertas completos | 389.8 | 3 554 872 | 204.30 | 65.61 |
| 100 | Riscos operacionais | 187.3 | 1 123 151 | 105.41 | 21.88 |
| 400 | Resumo administrativo | 2172.5 | 10 098 101 | 705.55 | 213.37 |
| 400 | Métricas diárias | 34.7 | 416 | 94.77 | 18.90 |
| 400 | Alertas completos | 1360.0 | 14 281 840 | 447.93 | 156.58 |
| 400 | Riscos operacionais | 1685.8 | 4 511 351 | 190.82 | 38.00 |

## Completude e compatibilidade

Na escala de 400 clientes: 1 600 visitas mensais; 64 000 € faturados elegíveis, 19 200 € pagos e 44 800 € em aberto; 6 400 documentos elegíveis e 4 800 em aberto. Rascunhos, cancelados, liquidados, pagamentos parciais e saldo legado calculável entram nas asserções próprias. A faturação externa confirma 6 400 documentos pendentes e 64 000 €, conservando o tratamento do histórico.

O resumo conta **9 600 alertas elegíveis** das três fontes e apresenta até 200 por fonte: 600 registos com truncagem explícita. A lista completa contém **10 000 alertas**, incluindo os gerais, e o resumo de riscos **5 200 ocorrências**. IDs únicos e hashes do conjunto esperado recusam perdas, duplicações e estados indevidos. As métricas diárias contam os 3 200 alertas técnicos abertos; o histórico de 2018–2019 não altera os agregados do dia UTC corrente. Este ensaio não simula 41 600 visitas no mesmo dia.

Falhas na segunda página devolvem 500 no dashboard/lista de alertas e 503 nos riscos, sempre `ok: false`, sem dados parciais válidos ou mensagem interna. Uma lista vazia acompanha o erro de alertas no contrato existente. Todos os GETs medidos executam zero escritas; cada leitura de negócio usa uma transação `RepeatableRead`. Comparações dos bytes do JSON completo com as consultas anteriores passaram na base sem fixture e com 25 clientes. Sete grupos existentes passaram adicionalmente: dashboards operacional/administrativo/antigo, resumo de faturação externa, revisão de referências, estados de alertas e riscos.

## Limites e falha do ambiente local

Os testes recusam pedido de 30 s ou mais, JSON de 64 MiB ou mais e RSS amostrado de 768 MiB ou mais. São limites de regressão em QA; não são cortes de resultados nem novas restrições impostas às APIs. Mantêm-se os timeouts de transação existentes, as regras financeiras e as relações efetivamente devolvidas.

Após várias cargas/limpezas, a base PGlite reutilizada devolveu visitas de outros meses apesar do filtro mensal inalterado. Um diagnóstico SQL isolado reproduziu **125 linhas com índice contra 100 numa leitura sequencial**, incluindo datas fora do intervalo. A origem interna não foi atribuída ao código da aplicação nem a uma causa específica do motor. O diagnóstico fez rollback; o ensaio final passou numa base nova, com todas as asserções e sem desativar índices. A prova SQL fica preservada. A primeira execução do ambiente novo também exigiu recuperar o adaptador local de criação do esquema, que estava em falta; não houve migração de produção.

Os detalhes completos de alertas/riscos e o histórico de faturação externa continuam a crescer em memória. A validação de volume real, concorrência entre pedidos, memória do servidor de base de dados e renderização de listas grandes continua a depender do ambiente alvo. Esta tarefa não certifica produção.

## Gates e estado

**1 288 unitários/133 ficheiros, quatro técnicos, sintaxe 694/307/44 e oito grupos integrados distintos aprovados.** O cenário novo passou em duas bases novas; a tabela mostra a execução final do código publicado. Dez ficheiros no lote: cinco de código/testes e cinco documentos, todos listados com hashes na evidência. Cache v206, sem alteração de dependências, esquema ou frontend.

TASK401: CI `36429681410`, job `108952334160`, 17 etapas aprovadas, **308 scripts na ordem exata** e restauro de **128 tabelas/47 ficheiros**, linhas e hashes iguais. C01 fica em validação até ler `operational-dashboard/snapshot.json` do artefacto `10976260376`: a transferência de 124 761 143 bytes excedeu o limite de 32 MiB e o URL assinado respondeu 403. TASK403/C02: CI `36432110804` também aprovado, 17 etapas, 308 scripts na ordem exata e o mesmo restauro; falta ler `field-suite/dashboard-metrics.json` do artefacto `10976776089` (124 765 391 bytes). Os ficheiros específicos continuam por ler, pelo que C01/C02 não ficam fechadas. O plano tem **29 tarefas por iniciar e três em validação (C01–C03)**; nenhuma aceitação final inventada.

**Publicação TASK404:** branch `work/field-readiness-20260915-simulation`, commit `243f9e72da450af0261eee19f4cbba45beb163bd`, árvore `a37e4c98450216d7aaa2a93b1f74ab15b4079f6a`, igual à preparada e testada. [CI 36438347610](https://github.com/ts7520305-svg/cristalwater/actions/runs/36438347610), job `108982012460`, em execução; 309 grupos/restauro ainda por confirmar. A seguir: confirmar os gates nativos e executar C04, volume de agendas, catálogos, guias e relatórios.

**Publicação TASK409:** branch `work/field-readiness-20260915-simulation`, commit `04005a0831f5fe9e6e588b1467596e03036e1779`, árvore `0d753e42d95823755419856e590d9b2e231a0c59`, igual à preparada/testada. [CI 36475513427](https://github.com/ts7520305-svg/cristalwater/actions/runs/36475513427), em execução; 313 grupos, restauro e JSONs nativos ainda por confirmar. Sem merge, deploy ou contactos reais.
