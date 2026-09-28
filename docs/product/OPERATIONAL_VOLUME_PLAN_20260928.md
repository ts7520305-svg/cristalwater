# C04 — Volume operacional: manifesto e resultados

Data: 28/09/2026. TASK405–TASK411; TASK411 parte de `2a25807e50c487d604805a2cf8e0fff6e67f5881`. Âmbito: C04 do [plano de conclusão](COMPLETION_PLAN_20260928.md). **C04 em execução; A–D aprovados nativamente, E e PDFs de F aprovados localmente; uploads de F pendentes.** Os seis cenários abaixo são filhos de C04, não seis novos IDs de conclusão. C04-F em execução: PDFs validados neste lote, oito superfícies de upload no lote seguinte.

## Manifesto fechado de cenários

As escalas seguintes são propostas sintéticas de QA, não dimensões confirmadas do negócio. Cada lote conserva até dez ficheiros e uma responsabilidade; uma falha nova fica ligada ao cenário, com reprodução e critério de saída.

| Cenário | Superfícies e fontes | Escalas / critérios de saída | Estado |
|---|---|---|---|
| C04-A — catálogo de armazém | `/api/inventory/products`, alias `/api/stock/products`, `/admin-inventory`; `inventoryController` e `InventoryCatalogueBusiness` | 100/1 000/10 000 produtos; ativos/todos/inativos, pesquisa por nome/SKU/marca, ordem/IDs sem perdas nem duplicados; páginas SQL limitadas, alteração concorrente, falha tardia sem resposta parcial, interface real e limpeza | TASK405/TASK406: local e nativo aprovados |
| C04-B — catálogos de campo | Técnico moderno, antigo, visita extra e correção da guia original; `cw-product-catalogue.js`, stock da guia de trabalho e `test-field-product-catalogue-ui.js` | 201/1 001/10 001 itens, pesquisa/seleção para além dos primeiros 200, nomes repetidos com unidades distintas, disponibilidade conforme contrato e item sem unidade; não trocar identidade, unidade ou recibo ao navegar | TASK406: 15 probes e regressões aprovados localmente; quota offline do percurso antigo corrigida; nativo aprovado na TASK406 |
| C04-C — agendas e rondas | Dia/mês administrativos e técnico; `/api/round-planner/week`, `/api/rounds/week`, `/api/admin/rounds/week`; `roundController`, `AdminWeeklyPlanningBusiness` | 25/100/400 piscinas, até 16 técnicos e dois anos; regulares/extra, limites de dia/semana/mês, pausas/recorrência existentes; IDs elegíveis exatos, sem duplicação na navegação e totais coerentes | TASK407: consultas e navegação aprovadas localmente, 53 624 visitas e três interfaces; revalidado nativamente na TASK408 com suite/restauro completos. Significados temporais atuais conservados; decisões novas em C10 |
| C04-D — guias e movimentos | Listas/detalhes de transporte/trabalho, movimentos, stock e consulta técnica; `fieldGuideReadService.js` e grupos `test-field-guide-*` | 201/1 001 guias/movimentos, itens numerosos dentro dos limites existentes; percorrer páginas de até 200, `maxId`, inserções concorrentes, relações e isolamento por técnico/viatura; stock/total/última página sem perdas | TASK408: 272 pedidos e quatro percursos UI aprovados localmente e no PostgreSQL nativo; 313 grupos/restauro confirmados na TASK411 |
| C04-E — relatórios e histórico | Resumo mensal administrativo por secção, relatórios guardados/cliente e comunicação/finanças; `adminReportsController`, `test-field-admin-monthly-reports*` | Reexecutar o cenário existente acima de 10 000 documentos/pagamentos/registos e acrescentar 201/1 001 relatórios guardados; meses vazios/completos, dados e totais exatos, navegação/detalhes, titularidade, erro e memória | TASK410: três probes, 116 pedidos, 201/1 001 relatórios, 10 001 registos por fonte financeira/comunicação e três interfaces aprovados localmente; CI pendente |
| C04-F — PDFs e anexos grandes | PDFs de visita, mês e guias; documentos oficiais/anexos de inventário e dos percursos anteriores | Para cada modelo: mínimo, multipágina e maior fixture válida; extrair texto/IDs/totais e conferir paginação. Para cada upload aplicável: um byte abaixo/no/acima do limite efetivo, truncado/tipo inválido, abertura/download/hashes/permissões, resposta perdida e limpeza | TASK411: nove famílias/27 PDFs/496 páginas aprovados localmente. Oito superfícies de upload inventariadas; fronteiras e recuperação pendentes na TASK412. CI PDF pendente |

Gates comuns: dados sintéticos isolados, notificações/integrações externas desligadas, resultado e versão identificados, contagens/IDs e bytes verificáveis, tempo/memória com âmbito explícito, ausência de escritas nas consultas, falha sem falso sucesso e limpeza das fixtures próprias. O ensaio nativo e o restauro mantêm-se obrigatórios. Estes perfis não substituem amostras reais, dispositivos físicos ou o piloto C30/C31.

## C04-A / TASK405 — falha e correção

A API devolvia HTTP 200/`ok: true` com apenas **500 de 601 produtos**. O corte `take: 500` não tinha paginação nem aviso; a interface tratava a lista como completa. A regressão SQL/HTTP e as medições estão na [evidência TASK405](evidence/20260928_task405_local.json).

O controller passa a delegar num Business. O Business lê páginas SQL de até 500, na ordem ativo/nome/ID, dentro de uma única transação `RepeatableRead` com timeout de 30 s. A resposta conserva `{ ok: true, products }` e todos os campos, filtros, pesquisa e alias. O ID desempata nomes repetidos. Uma falha na abertura, página ou conclusão recusa a resposta; o controller devolve 503 genérico sem produtos parciais ou mensagem privada da base.

Não houve alteração de frontend/cache, esquema, dependências versionadas, regras de stock ou movimentos. **O JSON final e o DOM continuam proporcionais ao total de produtos**: limitar cada consulta SQL não é paginação da resposta nem um limite constante de memória.

## Medições locais finais

Base PGlite 0.5.8 nova em cada execução; Chromium 153.0.8010.0. Cada GET medido corre num processo Node novo, autenticado. Duração até `response.text()`; RSS/heap amostrados a cada 5 ms e após parsing. Inclui API e cliente HTTP local; exclui configuração de fixtures, processo de base e navegador. Não é memória só do servidor nem SLA de produção.

| Produtos — lista completa | Devolvidos | Páginas SQL (inclui vazia final) | JSON (bytes) | HTTP (ms) | Pico RSS amostrado (MiB) |
|---|---:|---:|---:|---:|---:|
| 100 | 100 | 1 | 103 176 | 52,5 | 81,27 |
| 1 000 | 1 000 | 3 | 1 032 245 | 116,8 | 93,26 |
| 10 000 | 10 000 | 21 | 10 331 878 | 575,1 | 219,11 |

**20 probes:** 18 perfis positivos (três escalas × ativos/todos/nome/marca/SKU/alias), uma alteração concorrente e uma falha na segunda página. IDs ordenados e únicos, campos literais, filtros, zero escritas pelo leitor e todas as páginas SQL ≤500 aprovados. 401 anónimo e limpeza dos produtos próprios confirmados. Guardas QA: 30 s por pedido, 64 MiB de JSON, 768 MiB RSS amostrado. Não são limites comerciais nem certificação do VPS.

**Interface real a 390 px:** 10 000 de 10 000 produtos, IDs na ordem exata, nome com `<img>` mostrado literalmente sem criar imagem, zero erros de página/escritas; **2 636,3 ms** até validação do DOM e **16,71 MiB de heap JavaScript** via CDP. Heap JS não é RSS do navegador nem inclui toda a memória nativa do DOM. A página ainda não virtualiza a lista; volumes superiores e hardware real ficam por medir.

**Concorrência:** a primeira página dispara um escritor independente que altera nome/estado do produto usado como cursor e acrescenta um produto. A leitura inicial conserva o conjunto antigo; a seguinte vê o novo estado completo. PGlite serializou a escrita (`committedBeforeRemaining: false`), pelo que isto **não comprova MVCC nativo**. O CI em PostgreSQL tem uma asserção explícita de `true`.

## Testes, limites e continuidade

- 1 305 unitários/134 ficheiros, incluindo 17 novos; quatro testes técnicos; sintaxe 695 backend/307 frontend/44 inline; `node --check` e `git diff --check`.
- Três grupos locais: volume (**19 774 ms**), contagem real com resposta perdida/repetição (**3 330 ms**) e nove cenários de movimentos no navegador (**4 410 ms**, transporte simulado neste último grupo). Não se apresenta transporte simulado como integração SQL.
- Runner conferido: 310 nomes únicos, todos os scripts existentes; novo grupo após volume dos dashboards. Cache v206.
- Recuperação do ambiente QA: dependências temporárias expiradas repostas fora do repositório; download Chromium convencional falhou, pacote de navegador extraído para diretório temporário isolado. A extração automática falhou em `chown`; extração sem alterar dono funcionou. Sem mudanças no lockfile ou relaxamento dos testes.
- TASK404: CI `36438347610`, job `108982012460`, concluído com 17 etapas, **309 scripts na ordem exata**, restauro de **128 tabelas/47 ficheiros**, linhas/hashes iguais. O artefacto tem 124 840 609 bytes; o JSON específico de volume ainda não foi lido. C03 fica em validação, como C01/C02 pelos seus JSON específicos.
- O workflow passa a publicar também `field-readiness-gates`: resultados JSON do runner e provas de snapshot/métricas/volumes, separados do arquivo grande de capturas/PDFs. Não se afirma que esses novos artefactos já foram produzidos ou lidos.

**Ficheiros (10):** seis de código/teste/workflow listados com SHA-256 na evidência, este relatório, plano de conclusão, checkpoint e evidência. Risco residual: resposta/DOM em O(n), transação longa no catálogo, dimensões reais desconhecidas e gates PostgreSQL ainda pendentes.

**Publicação:** branch `work/field-readiness-20260915-simulation`, commit `77e424dd8305534fb63a4d251dba29e9a00b3f0e`, árvore `534fc2a5893a07ebabec6b857f0edea5706ab9c8`, igual à preparada/testada. [CI 36460017985](https://github.com/ts7520305-svg/cristalwater/actions/runs/36460017985), job `109055958055`, em execução; 310 grupos, restauro e gates nativos ainda por confirmar. Sem merge, deploy, contactos reais ou alteração do contrato anual adiado.

## C04-B / TASK406 — catálogo de campo e cópia offline

**Falha reproduzida:** 10 001 itens eram pesquisáveis online no técnico antigo, mas desapareciam do catálogo após recarregar sem rede. O navegador registou `setItem ... exceeded the quota` na chave `cwLegacyVisitProducts:v1:TECH:1:2026-09-28`. O rascunho de 383 caracteres sobreviveu; a cópia da guia não existia e a página mostrou indisponibilidade. Na regressão completa, os 12 probes anteriores passaram (todos até 1 001; API e técnico moderno a 10 001). Repetição focada confirmou a quota e a ausência da cópia. [Provas e medições TASK406](evidence/20260928_task406_local.json).

O snapshot antigo guardava os itens tanto na atribuição da viatura como no pacote próprio de stock. `assignmentForCache` retira apenas `workGuides`/`transportGuides` da atribuição, depois da validação da resposta; conserva a conta, técnico atribuído e dados da viatura. O pacote de stock continua completo e validado. A mesma chave/versão da cópia continua a aceitar o formato anterior. Sem mudança de API, schema, dependências, produtos, quantidades, permissões ou recibos. Cache pública passa a **v207** para disponibilizar o código atualizado.

`WorkGuideItem` não tem um campo `active`: a disponibilidade depende da guia/atribuição e de nome/unidade válidos. Não foi criada uma regra nova para ocultar itens. A regressão de correções cobre guia original encerrada/reafectada, guia posterior excluída, outro técnico e ausência de guia original.

### Medições finais — stock pela API

Cada probe usa um processo Node novo e uma base PGlite isolada nova para a execução. Duração até ler o corpo HTTP; RSS/heap amostrados de 5 em 5 ms e após parsing. Inclui API, cliente HTTP e oracle da fixture em memória; exclui processo de base e navegador. Guardas QA: 30 s, 64 MiB de JSON e 768 MiB RSS. Estes números não são um SLA.

| Itens | Itens confirmados | JSON (bytes) | HTTP (ms) | Pico RSS (MiB) |
|---|---:|---:|---:|---:|
| 201 | 201 | 82 319 | 90,4 | 102,22 |
| 1 001 | 1 001 | 402 442 | 114,7 | 107,45 |
| 10 001 | 10 001 | 4 020 565 | 629,5 | 195,81 |

As três leituras conferem IDs ordenados, todos os campos de identidade/quantidade, igualdade entre `stock` e `workGuide.items`, zero escritas SQL, 401 anónimo e 403 de outro técnico.

### Interface real — maior perfil, 10 001 itens

| Percurso | Abrir e preparar seletor (ms) | Percorrer 401 páginas (ms) | Recarregar offline (ms) | Heap JS (MiB) | Caracteres em localStorage |
|---|---:|---:|---:|---:|---:|
| Técnico moderno | 3 599,8 | 1 465,1 | 5 639,9 | 14,16 | 4 029 579 |
| Técnico antigo | 1 406,1 | 545,2 | 333,7 | 19,16 | 4 022 999 |
| Visita extra | 2 725,6 | 1 650,8 | 5 774,4 | 11,71 | 4 030 825 |
| Correção de visita extra | 2 468,0 | 1 851,5 | 6 060,7 | 16,07 | 5 080 487 |

**15 probes aprovados:** três leituras API e quatro percursos de navegador em cada uma das três escalas. Cada percurso percorre os handlers reais do botão seguinte, inspecionando o DOM após cada render síncrono: 9/41/401 páginas, no máximo 25 opções por página e uma seleção fixada adicional quando necessária. A duração do percurso mede processamento/render DOM; não simula o tempo de cliques humanos nem pintura de todos os fotogramas. Pesquisas literais/com acentos/por ID, nomes iguais, unidade `l` preservada, unidade nula desativada e nome com `<img>` literal passaram. Navegar/pesquisar não mudou os bytes do rascunho, identidade ou quantidade. Recarregamento real sem rede conservou a seleção para além da posição 200 e a pesquisa completa; zero escritas API e zero erros de página. Limpeza dos onze modelos das fixtures confirmada.

Os probes de volume não enviam comandos de consumo/correção. A execução de comandos, resposta perdida, UUID/recibo imutável e débito único foi novamente verificada pelos grupos existentes de produtos antigos, catálogo de 207 linhas e correções extra; assim não se confunde seleção de 10 001 itens com 10 001 consumos enviados.

**Gates:** 1 311 unitários/134 ficheiros (seis novos), quatro técnicos, sintaxe 695/307/44, `node --check` e `git diff --check`. Quatro grupos integrados: volume 89 429 ms, produtos antigos 7 625 ms, catálogo UI 14 479 ms e correções extra 29 144 ms. O grupo de catálogo terminou inicialmente com código 0, mas sem o quarto marcador; a repetição final manteve o processo ativo até aos quatro marcadores, com guarda de conclusão e timeout de 60 s fora do repositório. As quatro confirmações foram lidas. O corpo do teste permaneceu inalterado. Os grupos existentes repetem cinco idiomas × 320/390/1440, acesso recusado, cache corrompida conservada e sessão trocada. Runner conferido: **311 scripts únicos, todos existentes**. O glob JSON do workflow já inclui `product-volume/results.json`.

**Limites:** a API e cópias continuam proporcionais ao catálogo; 10 001 é a maior dimensão sintética testada com estes nomes/IDs e um rascunho por contexto. A correção extra ocupa 5 080 487 caracteres no armazenamento local e pode atingir a quota com mais rascunhos, nomes/IDs maiores ou menos espaço no dispositivo. Não se certifica capacidade ilimitada nem hardware real. Heap JS não inclui toda a memória nativa/DOM; caracteres de localStorage não são bytes de disco. PGlite/Chromium 153 locais não substituem CI PostgreSQL/dispositivos do piloto.

**Ficheiros (10):** `frontend/cw-legacy-product-rules.js`, `frontend/cw-legacy-visit-products.js`, `frontend/sw.js`, `tests/legacy-product-rules.test.js`, `scripts/test-field-product-volume.js`, `scripts/test-field-suite.js`, este relatório, plano de conclusão, checkpoint e evidência TASK406. SHA-256 dos seis ficheiros de código/testes registados na evidência.

**Publicação TASK406:** branch `work/field-readiness-20260915-simulation`, commit `6b35739d193f3d15c5c378bbbcb93153402ed3d3`, árvore `5f24f58520e0cfac852196732fbed441918c9091`, igual à preparada/testada. [CI 36463317792](https://github.com/ts7520305-svg/cristalwater/actions/runs/36463317792), job `109067069909`, em execução; 311 grupos/restauro e JSONs nativos ainda por confirmar. TASK405 continua nos testes integrados na última consulta, com dez etapas aprovadas; não se confirmaram ainda os 310 grupos/restauro nem os JSON específicos. C01–C03/C04-A continuam com os gates anteriormente registados pendentes.

**Próximo passo:** confirmar os CI e JSON específicos da TASK405/TASK406; executar C04-C, agendas e rondas. C04 só fecha após os seis cenários. Contagem principal: **28 por iniciar, uma em execução, três em validação, zero fechadas**. Sem merge, deploy ou contactos reais; contrato anual mantém-se adiado.

## C04-C / TASK407 — agendas e rondas

**Consultas e navegação aprovadas localmente; nenhuma falha nova da aplicação reproduzida.** O lote acrescenta `test-field-agenda-volume.js` e regista-o no runner, que passa a **312 scripts únicos e existentes**. A aplicação mantém a versão anterior e cache v207. [Evidência, leituras e hashes TASK407](evidence/20260928_task407_local.json).

Três perfis com **25/100/400 piscinas, 16 técnicos e 16 rondas**. Cada piscina tem 104 semanas de visitas regulares e 24 meses de extras em 2032–2033, além das visitas atuais e sentinelas dos limites. Maior fixture: **43 612 regulares + 10 012 extras = 53 624 visitas**. As associações das rondas chegam a 25 piscinas por ronda. Testaram-se rondas diárias, semanais e mensais, dia 31 ajustado ao fim do mês, janela de início/fim e ronda inativa com/sem `includeInactive`. Isto valida a consulta do calendário; não é uma simulação de geração ou execução de 53 624 visitas.

**Calendários conservados:** semana móvel desde hoje e semana administrativa desde domingo usam o fuso do servidor e `plannedDate`. O dia administrativo usa Lisboa, com `plannedDate` ou `date` de recurso, e `scheduledAt` para extras. O mês administrativo mantém `plannedDate OR date`, só para regulares. O técnico mantém o seu critério de dia, incluindo início/fim e exclusão dos estados cancelados/arquivados. Os IDs esperados resultam das fixtures, com comparação civil independente em Lisboa; não se reutilizam os filtros SQL da aplicação. C10 continua responsável pela eventual harmonização destes significados.

O ensaio final em **UTC** terminou em **58 133 ms**, abaixo do timeout de 120 s do runner: **177 pedidos HTTP** (144 respostas positivas, 24 recusas de permissões, nove falhas de leitura injetadas), três probes API e um probe com três interfaces. Ambas as rotas administrativas devolvem o mesmo plano; IDs completos/únicos, ordem contratada, totais, 29 de fevereiro, viragem de ano, sentinelas de milissegundo e dias de **23/25 horas** aprovados. A tentativa de consultar outro técnico mantém a identidade autenticada; páginas de 200 reconstituem exatamente a rota completa.

### Medições finais em UTC

Máximos por superfície no perfil de 400 piscinas, entre os pedidos positivos correspondentes; tempo/bytes/memória podem pertencer a pedidos diferentes. Processo Node novo por perfil, não por pedido. RSS inclui routers, cliente HTTP e oracle das fixtures; exclui base de dados e navegador. Duração até corpo HTTP recebido; memória amostrada durante a leitura e após parsing. Guardas de QA: 30 s, 64 MiB de JSON, 768 MiB RSS; não são SLA comerciais.

| Superfície | Maior conjunto verificado | JSON máximo (bytes) | HTTP máximo (ms) | RSS máximo amostrado (MiB) |
|---|---:|---:|---:|---:|
| Semana móvel | 800 regulares | 2 449 044 | 182,8 | 188,76 |
| Semana administrativa `/api/rounds/week` | 1 200 regulares | 468 609 | 219,9 | 287,16 |
| Dia administrativo | 1 600 registos, 32 páginas de 50 | 24 510 por página | 56,7 | 288,45 |
| Mês administrativo | 2 002 regulares, com restante resumo | 7 852 868 | 638,3 | 470,70 |
| Dia do técnico | 825 regulares/extras; cinco páginas de até 200 | 743 114 na resposta completa | 162,2 | 447,64 |

**Navegador real:** planeador com 1 200 linhas, filtros repetidos extra/todos/data e reposição exata, em 7 155,5 ms e 25,55 MiB de heap JS; conferido a 1440/390 px. Vista diária a 390 px percorre 1 600 registos em 32 páginas e regressa à primeira sem perda/duplicação, em 8 619,8 ms. Técnico a 390 px conserva os 825 IDs e seleciona última/primeira/última visita, em 2 319,1 ms e 7,93 MiB de heap JS. Nomes com `<img>` permanecem texto, zero erros de página e zero comandos API de escrita. Capturas dos três percursos registadas com hashes. A tabela móvel do planeador conserva o seu deslocamento horizontal; não se declara uma revisão completa da usabilidade.

Uma primeira execução completa do rascunho do teste em **Europe/Amsterdam** também passou: 156 pedidos, 59 207 ms, 800 linhas diárias/16 páginas e 825 visitas do técnico. Antes do ensaio final ajustaram-se só o oracle de aliases de estado, o registo de fuso e o enquadramento das capturas. As fixtures atuais são ancoradas à meia-noite local do servidor: ao mudar o fuso, mudam os instantes das sentinelas; a diferença 800/1 600 não é comparação do mesmo conjunto de instantes nem falha de contagem.

**Integridade:** zero escritas nas consultas SQL instrumentadas; navegador não enviou comandos de alteração. Contagens em onze modelos e campos de agenda/estado/identidade das fixtures mantidos após as leituras; remoção das fixtures próprias repõe as contagens iniciais. Esta prova não é uma auditoria SQL de toda a telemetria eventualmente desencadeada pelo servidor no navegador. As falhas das consultas semanais recusam dados parciais e mensagens privadas. Cada filho exige marcador terminal e código de saída; o pai só publica `ok: true` após validar também a limpeza.

**Gates locais:** 1 311 unitários/134 ficheiros, quatro técnicos, sintaxe 695/307/44, `node --check` nos dois scripts e `git diff --check`. PGlite 0.5.8 novo em cada execução, Chromium 153.0.8010.0, integrações externas desligadas. O glob já existente do workflow cobre `agenda-volume/results.json` no artefacto pequeno.

**Limites:** semana, mês e DOM continuam proporcionais ao conjunto devolvido; paginação diária/técnica ainda materializa os elegíveis antes de cortar a página. O planeador carrega também o histórico integral de extras. Heap JS não inclui toda a memória nativa/DOM. Não se certificaram geração de visitas, pausas de serviços sazonais, concorrência de alterações de calendário, VPS, dispositivos físicos ou dois anos de disponibilidade real. A pausa da ronda e as suas recorrências/janelas de consulta foram verificadas. C04 continua dependente dos restantes três cenários e dos gates nativos.

**Ficheiros (6):** novo `scripts/test-field-agenda-volume.js`, `scripts/test-field-suite.js`, este relatório, `COMPLETION_PLAN_20260928.md`, `CURRENT_WORK_CHECKPOINT.md` e `evidence/20260928_task407_local.json`. Nenhum ficheiro de produção, dependência ou esquema foi alterado.

**Publicação TASK407:** branch `work/field-readiness-20260915-simulation`, commit `6c77104d02ad4e7f56c77867329ef40278d7726a`, árvore `87c643a2bde495e2a4b2511479a57795af3670df`, igual à preparada/testada. [CI 36466632283](https://github.com/ts7520305-svg/cristalwater/actions/runs/36466632283), job `109078229561`: seis etapas aprovadas, verificação de migração aditiva em execução na consulta; 312 grupos, restauro e JSONs específicos ainda por confirmar. TASK405 e TASK406 mantêm dez etapas aprovadas e o runner em execução na sua última consulta; os respetivos 310/311 grupos, restauros e artefactos específicos continuam por confirmar. Sem merge, deploy ou contactos reais.

**Próximo passo atual:** C04-D — guias e movimentos, 201/1 001 registos e paginação/stock/isolamento conforme manifesto. Confirmar também CI TASK405–TASK407 e provas JSON específicas. C04: três cenários aprovados localmente, três por executar. Contagem principal: **28 por iniciar, uma em execução, três em validação, zero fechadas**. Contrato anual adiado.

## C04-D / TASK408 — guias e movimentos

**Aprovado localmente**, sem falha nova da aplicação. Novo grupo `test-field-guide-volume.js`, runner **313 scripts únicos e existentes**; aplicação/cache v207 inalteradas. [Evidência TASK408](evidence/20260928_task408_local.json).

Dois perfis de **201/1 001 guias de transporte, guias de trabalho e movimentos**, mais sentinelas de outro técnico na mesma viatura e do técnico numa viatura anterior. Uma guia ativa/obra aberta por técnico; **100 itens** na guia atual, limite dos comandos atuais, incluindo zero, unidade nula, nomes/unidades literais e frações de seis casas. Histórico criado diretamente em QA; isto não simula comandos de consumo nem confirma que somas de movimentos sintéticos representam o saldo da guia.

**272 pedidos HTTP**: 236 positivos, 20 recusas e 16 falhas tardias injetadas. Páginas de 200 no técnico (2/6 por lista) e 25 na administração (9/41 por lista), IDs completos/únicos na ordem data/ID, totais, filtros e página vazia final. Stock completo/sem movimentos conserva os mesmos 100 itens; 667 consumos no maior perfil. Listas e detalhes usam transação RepeatableRead. Escritor independente insere entre páginas; `maxId` exclui a nova linha durante a navegação e atualizar passa a incluí-la. Quatro cenários de inserção por perfil: movimentos técnicos e três listas administrativas; mais um no navegador técnico.

**Navegador real a 390 px:** 1 001 movimentos técnicos em 41 páginas, recuperação após falha de rede mantendo a página dos materiais, mais três listas administrativas de 1 001 em 41 páginas cada. Detalhes de transporte/trabalho e stock percorrem quatro páginas dos 100 itens, sem duplicados/perdas. Consulta administrativa também conferida a 1440 px. Nomes com `<img>` continuam literais, zero erros de página/comandos API, rascunho conservado. Capturas e hashes na evidência; aguardado o desaparecimento do aviso transitório antes da captura técnica.

Ensaio final: **31,415 ms** no próprio grupo, 31,520 ms incluindo processo. Técnico: 10,675.8 ms, incluindo recuperação/espera do aviso, 3.51 MiB heap JS. Navegação administrativa transporte/trabalho/movimentos: 5,111.5/4,896.8/3,240.9 ms; heap JS 5.35/4.31/3.90 MiB. Heap JS não é memória nativa total do navegador.

| Superfície, perfil 1 001 | JSON máximo (bytes) | HTTP máximo (ms) | RSS máximo (MiB) |
|---|---:|---:|---:|
| Transporte — técnico | 206,129 | 95.7 | 140.45 |
| Trabalho — técnico | 306,746 | 57.3 | 159.89 |
| Movimentos — técnico | 116,903 | 51.1 | 163.04 |
| Stock com consumos | 448,600 | 48.7 | 196.07 |
| Histórico administrativo | 13,243 | 24.4 | 194.44 |

Máximos por superfície, não necessariamente do mesmo pedido. Processo Node novo por perfil API; RSS inclui servidor, cliente HTTP e oracle, exclui processo da base e navegador. Guardas QA: 30 s, 64 MiB JSON, 768 MiB RSS. PGlite 0.5.8 novo em cada execução, Chromium 153.0.8010.0 e UTC. Sem promessa de SLA/VPS/dispositivos.

**Integridade e regressões:** zero escritas SQL nas APIs instrumentadas; zero comandos de alteração no navegador; contagens de doze modelos e hashes de guias/itens/movimentos conservados, limpeza própria repõe a base inicial. Quatro grupos anteriores passaram com marcadores terminais lidos: scope API, histórico API, consulta técnica UI e histórico UI. Cobrem PIN/conta associada, TECHNICIAN/TEAM_LEADER/ADMIN, PDFs protegidos, troca de conta, expiração, dados parciais, falhas SQL, cinco idiomas e três larguras. 1 311 unitários/134 ficheiros, quatro técnicos, sintaxe 695/307/44, `node --check`, `git diff --check` aprovados.

**Limites:** listas técnicas de guias usam offset sem snapshot entre pedidos; `maxId` protege inserções, não edições/remoções. O scope de movimentos carrega todos os IDs das obras do técnico; stock, itens e relações aninhadas continuam proporcionais ao conjunto. Os endpoints administrativos antigos ainda carregam guias completas/limitam movimentos; a interface administrativa efetiva usa `/api/fleet-history`, que foi percorrida integralmente. Não se alterou esse contrato antigo. PDFs/anexos grandes ficam em C04-F.

**Ficheiros (6):** novo teste, runner, este relatório, plano de conclusão, checkpoint e evidência TASK408. Sem mudança de produção, esquema ou dependências.

## Validação nativa conferida durante TASK408

TASK405 e TASK406 concluíram com **18 etapas aprovadas, 310/311 grupos na ordem exata e restauro de 128 tabelas/47 ficheiros com linhas/hashes iguais**. Os ZIPs pequenos `10988903063`/`10990683702` foram descarregados, hashes conferidos e JSONs lidos. C01/C02 passam a concluídas para a versão revalidada `6b35739...`: provas de concorrência positivas, fontes antigas coerentes e leitura seguinte completa; os testes são idênticos aos lotes originais. Isto não afirma leitura dos antigos artefactos grandes indisponíveis. C04-A/B têm provas nativas aprovadas, incluindo concorrência real do armazém e quinze probes dos catálogos.

**TASK407 terminou com falha global:** 311 dos 312 grupos passaram. `test-field-summary-volume.js` falhou no perfil de 400 clientes porque o processo ultrapassou **768 MiB RSS**; o pico exato não consta do excerto de erro disponível. Restauro não executado. O artefacto pequeno `10991504417` confirma volume de agendas aprovado (três perfis API + uma UI, limpeza, grupo 89 639 ms), mas isso não substitui suite/restauro globais. C03 continua em validação; C04-C mantém este bloqueio. Os resultados positivos anteriores de C03 não apagam esta falha posterior.

**Próximo:** corrigir a memória reproduzida em C03 num lote próprio, mantendo a guarda; depois C04-E/F. Contagem: **28 por iniciar, C04 em execução, C03 em validação, duas concluídas (C01/C02)**.

**Publicação TASK408:** branch `work/field-readiness-20260915-simulation`, commit `f5e18e31daf28f5a074d7a516b6c1f0f44e75d63`, árvore `ae5862e40277e057404c0b12625ee741b8c5e8e3`, igual à preparada/testada. [CI 36474118500](https://github.com/ts7520305-svg/cristalwater/actions/runs/36474118500), em execução; exigir 313 grupos exatos, restauro e `guide-volume/results.json` com três probes/limpeza aprovados. Bloqueio conhecido C03 por tratar no lote seguinte. Sem merge/deploy/contactos reais.


## C04-E / TASK410 — relatórios guardados e histórico mensal

**Aprovado localmente; nenhuma falha nova da aplicação reproduzida.** Acrescentados `test-field-report-volume.js` e o seu registo no runner, agora **314 scripts únicos e existentes**. Código de produção, cache v207, esquema e dependências inalterados. [Evidência, medições e hashes](evidence/20260928_task410_local.json).

Dois perfis de **201/1 001 relatórios CLIENT de um cliente e 201/1 001 relatórios ADMIN**, com 24 piscinas por documento guardado, campos literais/Unicode, zero/nulo e um relatório assinalado para revisão. O histórico maior percorre 1 001 meses sintéticos, de janeiro de 2001 a maio de 2084, respeitando a unicidade cliente/mês/tipo; não representa dados reais de 83 anos. Relatórios administrativos admitem proprietário nulo no esquema atual. Sentinelas de outro cliente e de outros tipos ficam fora da lista do cliente.

O maior perfil inclui também **10 001 faturas, 10 001 pagamentos e 10 001 registos de comunicação no período**, com sentinelas de um milissegundo antes e no início do mês seguinte. Os pagamentos incluem crédito interno excluído e um recebimento efetivamente zero: **8 572 recebimentos, 85,71 €**; documentos: **100,01 €**, também em aberto. Comunicações: total completo de 10 001 e apenas os cinco últimos registos, explicitamente sem confirmação de entrega. O mês selecionado contém 1 004 relatórios (1 001 ADMIN e três outros tipos); mês vazio confirmado. O tipo OTHER produz corretamente o estado «por rever» na interface.

**116 pedidos HTTP**: 58 respostas positivas, 38 recusas/identificadores inválidos ou ausentes e 20 falhas injetadas. Listas administrativas filtrada/integral, IDs completos e únicos, ordem contratada, dados guardados integrais e detalhes no início/meio/fim conferidos. CLIENT, ADMIN, TECHNICIAN e TEAM_LEADER, identidade estrangeira, anónimo e proprietário vazio exercitados. Dez falhas por perfil: lista/detalhe e cinco consultas de resumo após o SQL, mais início/fim do trabalho transacional; sem resposta parcial nem mensagem privada e com recuperação. As secções usam RepeatableRead com timeout de 30 s.

### Medições locais do perfil de 1 001 relatórios

Máximos das leituras positivas da superfície correspondente; bytes, tempo e memória podem pertencer a pedidos diferentes. Processo Node novo por perfil API, não por pedido. RSS inclui rotas, cliente HTTP e oracle; exclui base e navegador. Guardas QA conservadas: 30 s, 64 MiB JSON e 768 MiB RSS.

| Superfície | Dados confirmados | JSON máximo (bytes) | HTTP máximo (ms) | RSS máximo (MiB) |
|---|---:|---:|---:|---:|
| Histórico do cliente | 1 001 relatórios | 2 149 512 | 160,3 | 339,58 |
| Lista administrativa integral | 2 006 relatórios da fixture | 4 401 819 | 232,4 | 359,41 |
| Resumo financeiro | 10 001 faturas/pagamentos de origem | 696 | 246,2 | 440,49 |
| Contagem de relatórios do mês | 1 004 relatórios | 366 | 7,6 | 378,29 |
| Comunicações do mês | 10 001; últimos cinco | 804 | 13,3 | 406,34 |

**Navegador real:** cliente e pré-visualização ADMIN percorrem **167 páginas**, com no máximo seis cartões, IDs exatos e regresso da última à anterior/última. Percursos DOM em **255,8/237,1 ms**, heap JS **12,03/12,43 MiB**. São handlers reais de clique e inspeção de cada DOM, não cliques a ritmo humano nem medição da pintura de todos os fotogramas. Filtro de mês, histórico vazio, limpar filtro, falha 503/recuperação, inserção seguida de atualização e troca A→B→A aprovados. Dois PDFs históricos abertos com identidade/mês/texto exatos; tamanhos máximos pertencem a C04-F. Resumo administrativo real confirma valores, cinco comunicações e texto literal; heap JS 2,70 MiB. Portal verificado a 320/390/1440 px, resumo a 390/1440; capturas móveis revistas.

**Integridade:** zero escritas SQL nas APIs instrumentadas, hashes dos dados de origem conservados, contagens de **doze modelos** repostas após remoção das fixtures próprias. As consultas de relatórios no navegador não enviaram comandos de alteração. O portal envolvente enviou dois POST já existentes para marcar a conversa como lida; registados separadamente, com mensagens vazias e estado conservado, sem os apresentar como GET ou ausência absoluta de comandos. Não houve erros de página.

**Gates:** 1 318 unitários/135 ficheiros, quatro técnicos, sintaxe 695/307/44, node-check e diff-check. Cinco grupos com marcadores finais lidos: volume **18 598 ms** (18 474 ms internos), resumo mensal API **4 837 ms**, resumo UI **8 592 ms**, acesso aos relatórios **1 038 ms**, portal mensal UI **15 791 ms**. As regressões anteriores confirmam mais de 10 000 registos, precedência de referência mensal, crédito/estados/valores inválidos, GET/HEAD/ranges, IDs de titulares coincidentes, cliente inativo, cinco idiomas, sessão, atraso/timeout/offline e PDFs. Esses grupos antigos deixam dados apenas na base QA isolada descartada; a limpeza própria certificada acima é a do novo grupo. PGlite 0.5.8/PostgreSQL 18.3 WASM, Chromium 153.0.8010.0, UTC e integrações externas desligadas.

**Limites:** lista/API e memória das linhas no portal continuam em O(n); a paginação de seis limita o DOM, não o carregamento. Cada secção mensal tem o seu snapshot; não há prova de snapshot comum entre secções nem estabilidade perante alterações concorrentes. Lista administrativa legada conserva ordem por data sem desempate por ID e não declara cache privada no controller. Não foram mudadas estas regras nem certificados VPS/dispositivos, dados reais, geração/envio de relatórios ou limites de anexos.

**Lote de seis ficheiros:** dois scripts, este relatório, plano, checkpoint e evidência. CI TASK408/TASK409 ainda na suite integrada, dez etapas aprovadas em cada um; 313 grupos/restauro/JSONs ainda por confirmar. TASK410 requer 314 grupos na ordem exata, restauro e `report-volume/results.json` com três probes e limpeza aprovados. **C04-E local aprovado; C04-F é o único cenário por executar.** C03 continua em validação e C04 em execução; total principal mantém 28 por iniciar, uma em execução, uma em validação e duas concluídas. Contrato anual adiado; branch autorizada, sem merge/deploy/contactos reais.

**Publicação TASK410:** branch `work/field-readiness-20260915-simulation`, commit `19569a6145ab049b6dca058ae791d81cefc6fc26`, árvore `6726513a322e496354724643cb28852a0d24b1d2`, igual à preparada/testada. [CI 36478772257](https://github.com/ts7520305-svg/cristalwater/actions/runs/36478772257), job `109118978818`, em execução; quatro etapas aprovadas e instalação de dependências na consulta. Exigir 314 grupos na ordem exata, restauro e `report-volume/results.json` com três probes e limpeza aprovados. TASK408/TASK409 continuam na suite integrada, dez etapas aprovadas cada. Sem merge, deploy ou contactos reais.


## C04-F / TASK411 — volume e paginação de PDFs

**PDFs aprovados localmente; uploads ainda pendentes.** Novo `test-field-pdf-volume.js`, acrescentado ao runner de **315 scripts únicos e existentes**. Nenhuma alteração de aplicação, esquema, dependências ou cache v207. [Evidência e hashes](evidence/20260928_task411_local.json).

Inventário fechado de **nove famílias**: visita regular, visita extra, relatório mensal guardado, guia de transporte, guia de obra, seguro de viatura, documento financeiro interno, extras pendentes e orçamento. Três perfis 0/25/1 001 geraram **27 documentos e 496 páginas**. O perfil mínimo usa uma linha para extras faturáveis, porque a ausência de extras produz 404, e uma estimativa antiga sem valores para o orçamento, com revisão explícita. As demais dimensões mínimas admitem zero linhas.

O maior perfil contém **1 001 movimentos, piscinas no relatório mensal, linhas financeiras e extras faturáveis**, **100 itens de guia e de orçamento** dentro do limite de escrita, **50 produtos e 24 fotografias por visita**. Descrições de 300 caracteres, notas de seguro de 2 000 caracteres com quebras e condições de orçamento de 3 000 caracteres. Estes são máximos sintéticos ensaiados, não limites universais da aplicação. As fontes de stock e movimentos foram semeadas separadamente para apresentação; o teste não certifica reconciliação do livro de movimentos.

**100 pedidos HTTP:** 38 PDFs positivos (27 guardados mais acessos do titular e alias) e 62 recusas/IDs ausentes esperados. Marcadores de linhas completos e únicos, texto Unicode, valores financeiros guardados, soma em cêntimos de extras (**10,01 €** no maior perfil), valor final do orçamento, identidade/tipo de documento, cabeçalhos privados e rodapé em todas as páginas conferidos. Acesso do técnico da viatura e do cliente titular, cliente/técnico estrangeiro, anónimo, modo ADMIN do cliente recusado, notas privadas omitidas ao cliente e alias da última guia verificados. Não foram enviados comandos ou entregas.

### PDFs guardados do maior perfil

Medições por resposta ADMIN guardada. Processo Node novo por perfil, não por documento; a memória pode acumular entre pedidos. RSS inclui API, cliente HTTP, dados de fixture e extração de texto, excluindo a base. O pico de todos os pedidos, incluindo acessos repetidos, foi **494,01 MiB**. Guardas de 30 s/64 MiB/768 MiB mantidas.

| Família | Páginas | Bytes | HTTP (ms) | RSS amostrado (MiB) |
|---|---:|---:|---:|---:|
| Guia de transporte | 12 | 41 785 | 173,1 | 158,53 |
| Guia de obra | 170 | 308 620 | 626,4 | 282,92 |
| Seguro | 2 | 24 506 | 58,6 | 351,60 |
| Relatório mensal | 120 | 201 840 | 213,7 | 374,60 |
| Documento financeiro | 49 | 94 734 | 174,7 | 401,53 |
| Extras pendentes | 48 | 98 248 | 317,4 | 472,46 |
| Orçamento | 13 | 46 820 | 79,1 | 476,78 |
| Visita regular, 24 fotografias | 17 | 88 631 | 150,3 | 490,26 |
| Visita extra, 24 fotografias | 17 | 89 197 | 148,4 | 493,26 |

**Renderização:** Poppler extraiu caixas de **138 926 palavras** das 496 páginas: zero palavras fora da página e zero sobreposições superiores a 40% da menor caixa, com interseção superior a um ponto em cada eixo. Primeira/intermédia/última página dos PDFs grandes renderizadas; **13 páginas revistas visualmente**, cobrindo as nove famílias, linhas longas, finais, totais e fotografias. Sem cortes ou sobreposições observados nas amostras. Secções mensais e resumos financeiros podem continuar na página seguinte; o conteúdo mantém-se completo. A geometria de palavras não verifica todas as colisões de imagens e a revisão manual não abrange todas as páginas. Caracteres sem suporte mantêm o aviso e marcador `[U+6F22]`; não equivale a cobertura integral de glifos/idiomas.

**Integridade:** zero escritas SQL nas leituras, snapshot das fontes conservado, contagens de **25 modelos** iguais antes/depois e repostas após limpeza própria. Os **56 originais JPEG sintéticos de 640×360** mantiveram hash e foram removidos no fim. Testar 24 fotografias pequenas não testa ainda a fronteira de 25 MiB por upload ou de 64 MiB agregados na projeção de fotografias.

**Gates locais:** volume **8 963 ms** (8 861 ms internos), guias PDF **1 334 ms**, documento financeiro **712 ms**, regressão financeira **2 895 ms**, fotografias **2 293 ms** e histórico/revisão **5 051 ms**, todos com marcadores finais lidos. **1 318 unitários/135 ficheiros, quatro técnicos, sintaxe 695/307/44**, node-check e diff-check. As regressões existentes cobrem truncagem/tipo/identidade PDF, falha de renderização, sessão/offline, cinco formatos de imagem, orientação/remoção de metadados, ficheiros corrompidos/externos/symlinks recusados, permissões e interfaces estreitas. PGlite 0.5.8/PostgreSQL 18.3 WASM, Chromium 153 para regressões, UTC e integrações desligadas. Os grupos antigos mantêm fixtures apenas na base QA descartada; a limpeza certificada acima pertence ao novo grupo.

### Inventário de uploads para TASK412

Valores encontrados no código, **ainda sem aceitação das fronteiras HTTP neste lote**. Testar limite−1, limite e limite+1 em bytes, original/descarga/hash/permissões, resposta perdida/recuperação e limpeza. Tipos inválidos/corrompidos aplicam-se ao contrato de cada superfície; anexos genéricos não ganham uma whitelist inventada. Confirmar a inclusão do byte do limite no parser e na regra, sem aumentar limites para passar testes.

| Superfície | Limite configurado | Fonte |
|---|---:|---|
| Documento oficial de guia | 25 MiB; regra inclusiva e parser +1 byte | `transportGuideDocumentRoutes.js` / `transportGuideDocumentFiles.js` |
| Compra de inventário | 20 MiB | `inventoryRoutes.js` |
| Documento geral | 50 MiB | `documentRoutes.js` |
| Fotografia de visita regular | 25 MiB | `visitRoutes.js` |
| Fotografia de visita extra | 25 MiB | `extraVisitExecutionRoutes.js` |
| Anexo de conversa do cliente | 25 MiB | `clientMessageRoutes.js` |
| Fotografia de reparação | 20 MiB | `repairRoutes.js` |
| Comprovativo de despesa | 5 MiB | `companyExpenseRoutes.js` / `expenseLedgerRules.js` |

A regressão de documentos oficiais já contém 25 MiB/mais um byte, revisão/commit/recibo e recuperação; será reutilizada. O arquivo administrativo de atualização do sistema (500 MiB) é uma operação de deploy e fica fora dos anexos operacionais C04-F. Fotografias de relatório têm ainda 24 imagens/25 MiB por ficheiro/64 MiB agregados; preservar exclusão explícita e estados atuais.

### CI anterior confirmado neste lote

**TASK408 aprovada nativamente:** commit `f5e18e31daf28f5a074d7a516b6c1f0f44e75d63`, [run 36474118500](https://github.com/ts7520305-svg/cristalwater/actions/runs/36474118500), job `109103422154`, 18 etapas e **313 scripts na ordem exata**, sem falhas. Restauro de **128 tabelas/47 ficheiros**, linhas e hashes iguais. Artefacto `field-readiness-gates` **10996767155**, 30 532 bytes, SHA-256 `6f75b6111fc8ff605db86c1ee20ae2f64ed3399818bcfcd39ae65339d605bf2d`, transferido e lido.

JSON de agendas: quatro probes (três API + UI), perfis 25/100/400 e limpeza; teste idêntico ao da TASK407. JSON de guias: três probes (duas API + UI), 201/1 001, 272 pedidos e limpeza, PostgreSQL 16.15. **C04-C/D aceites nativamente na TASK408**, juntamente com A/B já aceites. A versão C03 anterior à otimização passou aqui, mas alcançou **735,34 MiB** no dashboard de 400 clientes; isso não valida a implementação TASK409. CI TASK409 terminou entretanto com uma falha de rascunhos; TASK410 continua em execução. Ver atualização abaixo.

**Lote de seis ficheiros:** dois scripts e quatro documentos. Exigir na TASK411 **315 scripts na ordem exata, restauro e `pdf-volume/results.json` com três perfis/27 PDFs/limpeza**. C04 continua em execução: E aguarda CI, F aguarda uploads e CI dos PDFs. C03 tem o probe da otimização aprovado, mas aguarda suite/restauro completos. Contagem principal: 28 por iniciar, uma em execução, uma em validação e duas concluídas. Próximo lote TASK412: uploads C04-F; depois C05 idiomas. Contrato anual adiado. Sem merge, deploy ou contactos reais.


**Atualização CI TASK409 antes da publicação:** commit `04005a0831f5fe9e6e588b1467596e03036e1779`, [run 36475513427](https://github.com/ts7520305-svg/cristalwater/actions/runs/36475513427), job `109108100107`, **312/313 grupos aprovados** na ordem exata; restauro saltado. Única falha: `test-field-legacy-visit-drafts.js:39`, após recuperar a ligação e alterar a visita no servidor, a contagem imediata dos conflitos foi **0 em vez de 2**. Os dois primeiros marcadores passaram. Causa ainda em diagnóstico; não se conclui perda de dados nem defeito de aplicação apenas desta asserção.

Artefacto pequeno **10997265072**, 30 434 bytes, SHA256 `32a9e8408e15944ea7624c760cb06036fb36b823ed9b0dc3e84f0071d2c39224`, lido: **summary-volume 12 perfis + três falhas/limpeza aprovados**, dashboard400 otimizado **513,18 MiB/1 677,6 ms**, snapshot operacional com `committedBeforeRemaining: true`. A correção de memória passou nativamente; **C03 mantém-se em validação por falta de suite/restauro completos**. Antes do lote de uploads, reproduzir e resolver a falha dos rascunhos num lote próprio caso necessário, sem enfraquecer as asserções ou aumentar guardas. TASK410 continua em execução.


**Publicação TASK411:** branch `work/field-readiness-20260915-simulation`, commit `b649f1a61bf834c1f5a37a675321aef0c2a55f45`, árvore `ece3b97fcaea2f0bbedab24b56c9acf9cd2e8f42`, igual à preparada/testada. [CI36482590787](https://github.com/ts7520305-svg/cristalwater/actions/runs/36482590787), job `109131593496`, em execução; exigir315 grupos exatos/restauro/JSONpdf-volume com3 perfis/27 documentos/limpeza. TASK408 confirmado; TASK409 probe de memória aprovado e suite bloqueada por rascunhos; TASK410 em execução. Sem merge, deploy ou contactos reais.
