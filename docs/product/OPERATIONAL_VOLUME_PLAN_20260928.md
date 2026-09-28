# C04 — Volume operacional: manifesto e primeiro lote

Data: 28/09/2026. TASK405 (base `14be8eaf5ca8530a5f005d99b506e3662693f928`) e TASK406 (base `30b119879b6d2573b143c4c2f63a6281e476e1a0`). Âmbito: C04 do [plano de conclusão](COMPLETION_PLAN_20260928.md). **C04 em execução; C04-A e C04-B aprovadas localmente, validação nativa pendente.** Os seis cenários abaixo são filhos de C04, não seis novos IDs de conclusão. Quatro cenários ainda por executar.

## Manifesto fechado de cenários

As escalas seguintes são propostas sintéticas de QA, não dimensões confirmadas do negócio. Cada lote conserva até dez ficheiros e uma responsabilidade; uma falha nova fica ligada ao cenário, com reprodução e critério de saída.

| Cenário | Superfícies e fontes | Escalas / critérios de saída | Estado |
|---|---|---|---|
| C04-A — catálogo de armazém | `/api/inventory/products`, alias `/api/stock/products`, `/admin-inventory`; `inventoryController` e `InventoryCatalogueBusiness` | 100/1 000/10 000 produtos; ativos/todos/inativos, pesquisa por nome/SKU/marca, ordem/IDs sem perdas nem duplicados; páginas SQL limitadas, alteração concorrente, falha tardia sem resposta parcial, interface real e limpeza | TASK405: local aprovado; CI pendente |
| C04-B — catálogos de campo | Técnico moderno, antigo, visita extra e correção da guia original; `cw-product-catalogue.js`, stock da guia de trabalho e `test-field-product-catalogue-ui.js` | 201/1 001/10 001 itens, pesquisa/seleção para além dos primeiros 200, nomes repetidos com unidades distintas, disponibilidade conforme contrato e item sem unidade; não trocar identidade, unidade ou recibo ao navegar | TASK406: 15 probes e regressões aprovados localmente; quota offline do percurso antigo corrigida; CI pendente |
| C04-C — agendas e rondas | Dia/mês administrativos e técnico; `/api/round-planner/week`, `/api/rounds/week`, `/api/admin/rounds/week`; `roundController`, `AdminWeeklyPlanningBusiness` | 25/100/400 piscinas, até 16 técnicos e dois anos; regulares/extra, limites de dia/semana/mês, pausas/recorrência existentes; IDs elegíveis exatos, sem duplicação na navegação e totais coerentes | Por executar; preservar os significados temporais atuais e remeter decisões novas para C10 |
| C04-D — guias e movimentos | Listas/detalhes de transporte/trabalho, movimentos, stock e consulta técnica; `fieldGuideReadService.js` e grupos `test-field-guide-*` | 201/1 001 guias/movimentos, itens numerosos dentro dos limites existentes; percorrer páginas de até 200, `maxId`, inserções concorrentes, relações e isolamento por técnico/viatura; stock/total/última página sem perdas | Por executar; listar respostas grandes e leituras ainda integralmente materializadas |
| C04-E — relatórios e histórico | Resumo mensal administrativo por secção, relatórios guardados/cliente e comunicação/finanças; `adminReportsController`, `test-field-admin-monthly-reports*` | Reexecutar o cenário existente acima de 10 000 documentos/pagamentos/registos e acrescentar 201/1 001 relatórios guardados; meses vazios/completos, dados e totais exatos, navegação/detalhes, titularidade, erro e memória | Por executar; não confundir resumo mensal aprovado com todo o histórico aprovado |
| C04-F — PDFs e anexos grandes | PDFs de visita, mês e guias; documentos oficiais/anexos de inventário e dos percursos anteriores | Para cada modelo: mínimo, multipágina e maior fixture válida; extrair texto/IDs/totais e conferir paginação. Para cada upload aplicável: um byte abaixo/no/acima do limite efetivo, truncado/tipo inválido, abertura/download/hashes/permissões, resposta perdida e limpeza | Por executar; inventariar limites efetivos antes do lote, sem os aumentar para fazer passar testes |

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

**Publicação TASK406:** preparada na branch `work/field-readiness-20260915-simulation`; commit/árvore/CI serão registados após publicação. TASK405 continua nos testes integrados na última consulta, com dez etapas aprovadas; não se confirmaram ainda os 310 grupos/restauro nem os JSON específicos. C01–C03/C04-A continuam com os gates anteriormente registados pendentes.

**Próximo passo:** confirmar os CI e JSON específicos da TASK405/TASK406; executar C04-C, agendas e rondas. C04 só fecha após os seis cenários. Contagem principal: **28 por iniciar, uma em execução, três em validação, zero fechadas**. Sem merge, deploy ou contactos reais; contrato anual mantém-se adiado.
