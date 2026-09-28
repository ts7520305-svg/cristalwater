# C04 — Volume operacional: manifesto e primeiro lote

Data: 28/09/2026. TASK405, base `14be8eaf5ca8530a5f005d99b506e3662693f928`. Âmbito: C04 do [plano de conclusão](COMPLETION_PLAN_20260928.md). **C04 em execução; C04-A aprovada localmente, validação nativa pendente.** Os seis cenários abaixo são filhos de C04, não seis novos IDs de conclusão. Os restantes cinco ainda não foram aceites por esta TASK.

## Manifesto fechado de cenários

As escalas seguintes são propostas sintéticas de QA, não dimensões confirmadas do negócio. Cada lote conserva até dez ficheiros e uma responsabilidade; uma falha nova fica ligada ao cenário, com reprodução e critério de saída.

| Cenário | Superfícies e fontes | Escalas / critérios de saída | Estado |
|---|---|---|---|
| C04-A — catálogo de armazém | `/api/inventory/products`, alias `/api/stock/products`, `/admin-inventory`; `inventoryController` e `InventoryCatalogueBusiness` | 100/1 000/10 000 produtos; ativos/todos/inativos, pesquisa por nome/SKU/marca, ordem/IDs sem perdas nem duplicados; páginas SQL limitadas, alteração concorrente, falha tardia sem resposta parcial, interface real e limpeza | TASK405: local aprovado; CI pendente |
| C04-B — catálogos de campo | Técnico moderno, antigo e visita extra; `cw-product-catalogue.js`, stock da guia de trabalho e `test-field-product-catalogue-ui.js` | 201/1 001/10 001 itens, pesquisa/seleção para além dos primeiros 200, nomes repetidos com unidades distintas, ativo/inativo conforme contrato e item indisponível; não trocar identidade, unidade ou recibo ao navegar | Por executar; reutilizar a fixture existente de 207 itens, sem a considerar prova das novas escalas |
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

**Próximo passo:** confirmar CI TASK405 (310 grupos/restauro e JSON específicos), depois executar C04-B. C04 só fecha após aceitação dos seis cenários. Contagem principal: **28 por iniciar, uma em execução, três em validação, zero fechadas**.
