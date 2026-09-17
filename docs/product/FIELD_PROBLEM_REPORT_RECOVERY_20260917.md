# TASK240–241 — ocorrências recuperáveis no modo de campo

## Estado

Confirmada no commit `9b392f18a528608176d8e01d32dc294aa9850038`, árvore `bf2a27c11e44467f9b59cdbf5bd8d47cffa095b0`, CI `35267245025`: 135/135 grupos, 388 unitários/quatro técnicos, 21 scripts de navegador, 20 migrações aditivas, sintaxe de 542 JS backend/178 frontend/57 inline e restauro de 110 tabelas/32 ficheiros com linhas e hashes iguais em PostgreSQL 16. API de ocorrências: 1270 ms; UI: 20171 ms. Pedidos de material também passaram nesta árvore (1509/14988 ms).

Preparada sobre `68df5a10ed918b994c1a156de6e42c0b3a0e612d` e integrada com a correção assíncrona do teste de material. Cache v67; nenhuma migração nova: a tabela de comprovativos já existe e os preços de Repair já admitem null. Backup local `backup/task241-local-20260917`. O registo posterior altera apenas documentação e não substitui o commit de código testado.

## Reprodução anterior à correção

O ensaio isolado `run-1789673271927` reproduziu três problemas no endpoint de ocorrências: repetir um envio criava duas reparações; a descrição com «bomba» atribuía 350 € sem orçamento; a auditoria aceitava o autor enviado no body. Uma falha injetada na criação do alerta devolvia HTTP 200 e deixava a reparação criada com alerta null. O feed CLIENT já excluía a notificação ADMIN; esta revisão não apresenta esse feed nem o emissor Socket.IO, já protegido por MANAGEMENT, como fugas novas.

No ecrã, a leitura de fonte encontrou notas alteradas antes do envio, `ok` genérico como confirmação, lista global `cwFieldProblems` reduzida aos últimos 50 registos e promessa de enviar a ocorrência ao concluir a visita. Uma resposta perdida podia, por isso, deixar uma reparação no servidor e outra ocorrência por enviar nas notas. A categoria do formulário também era reposta durante a troca de visita.

## Alteração

O endpoint `/api/core/visits/:id/problem` usa agora `FIELD_PROBLEM_REPORT`, proprietário tipado, UUID e conteúdo exato. O contrato moderno exige visita REGULAR, piscina, categoria, tipo, urgência e descrição. A identidade do técnico vem da sessão autenticada; o servidor bloqueia a visita, verifica a atribuição e a piscina e exige técnico ativo. Um comprovativo anterior é recuperado antes de reavaliar a atribuição atual, permitindo confirmar uma operação já efetuada depois de uma reatribuição.

Repair PENDING, TechnicalAlert OPEN, histórico técnico, uma notificação ADMIN, auditoria e comprovativo são gravados na mesma transação. Falhas obrigatórias revertem o conjunto. O preço unitário e total ficam null, com indicação de revisão pelo escritório: reportar não é orçamentar, aprovar despesa ou faturar. Este fluxo não altera as notas da visita, existências, faturas ou visitas extra. Categoria e contexto permanecem nos metadados; não há conversão automática de uma categoria «Extra / reparacao» em trabalho faturável.

A notificação não recebe destinatário CLIENT/User nem passa por regras configuráveis que possam criar avisos adicionais. O alerta técnico e a notificação são duas entradas operacionais diferentes, que podem aparecer juntas no painel administrativo. O comprovativo identifica ambas e não afirma que a administração já leu ou tratou o pedido.

Chamadas antigas sem UUID conservam a resposta com repair/alert/notification e `LEGACY_NO_REQUEST_ID`, com autoria autenticada e gravação atómica, mas sem deduplicação. ADMIN antigo é identificado como ADMIN real; o envio moderno exige técnico. Campos actor e cabeçalhos de autoria não substituem a sessão. A alteração é deste endpoint: outros escritores antigos de reparações não herdam automaticamente estas garantias.

O formulário passa a conservar quatro campos e a visita/piscina originais num rascunho por conta. O pedido é persistido antes do POST, com Web Locks e comparação do rascunho entre janelas. A recuperação tem ação própria, disponível mesmo depois de consultar outra visita; fechar o painel conserva o texto. A confirmação verifica UUID, conta, âmbito, conteúdo, identificadores e ausência de preço, sendo persistida localmente antes de limpar o rascunho. Falhar a limpeza depois da confirmação permite apenas limpar o rascunho confirmado, sem repetir o POST.

Sessão alterada, resposta tardia, quota/corrupção, BFCache e divergências entre janelas conservam os dados e impedem confirmação falsa. A cache inclui o módulo para recarga offline. A revisão do dia mostra ocorrências por confirmar, rascunhos por enviar e avisos históricos. O formulário deixa de acrescentar ocorrências às notas ou à lista global. Os bytes de `cwFieldProblems` são preservados, sem atribuição presumida ou envio automático. Uma ocorrência antiga não confirmada num rascunho de visita bloqueia a conclusão automática e pede revisão com o escritório, preservando notas e registo.

## Evidência local

| Ensaio | Resultado |
|---|---|
| API, resposta perdida e reinício | Seis reenvios entre dois processos produzem uma reparação, alerta, histórico, notificação, auditoria e comprovativo idêntico. Preços null, notas originais e contagens de faturas/stock/visitas extra preservadas. |
| Escritas obrigatórias | Falha injetada em TechnicalAlert e FieldWriteRequest reverte todas as escritas; o pedido original pode ser repetido depois de remover a falha. |
| Identidade e contrato | Outro técnico, CLIENT, ADMIN moderno, conteúdo alterado, visita/piscina divergentes, tipo EXTRA e campos indevidos recusados. Conta User associada, ADMIN/TECH antigos e recuperação após reatribuição ensaiados. |
| Formulário real | Quota impede POST e conserva texto; quatro campos e visita tipada sobrevivem a recarga, troca de visita e recarga realmente offline. 51 ocorrências antigas mantêm os mesmos bytes. |
| Confirmação local | Resposta com conteúdo trocado, quota no comprovativo/limpeza, resposta tardia noutra conta, regresso à conta original, BFCache, duas janelas e JSON corrompido ensaiados. |
| Conclusão antiga | Ocorrência histórica não confirmada e notas sobrevivem à tentativa de concluir, sem novo POST de ocorrência, pedido de conclusão ou fim da visita. |
| Administração e apresentação | Painel ADMIN real mostra o autor autenticado e texto literal, sem executar HTML submetido. Larguras 320/390/1440 sem transbordo; estado e ação de recuperação visíveis. Captura Chromium 390 revista. |
| Regressões dirigidas | Tipos de visita, UI dos pedidos de material e interligações aprovados com o novo código. |

API aprovada em `run-1789673722805` (1937 ms). UI aprovada em `run-1789674058858` (16730 ms); versão final com preservação da ocorrência antiga ao concluir aprovada em `run-1789674429240` (20675 ms). As três regressões passaram em `run-1789673934179`; nessa execução inicial, o novo ensaio UI falhou porque procurava um só cartão com a mensagem que existe no alerta e na notificação. O seletor foi limitado ao identificador da notificação ADMIN, conservando a verificação de autoria e texto literal. Não se apresenta essa execução inicial como aprovação global. Os ensaios locais usam PGlite isolado, sem substituir PostgreSQL 16 nativo.

388 testes unitários aprovados; sintaxe de 542 JS backend, 178 JS frontend e 57 scripts inline aprovada. Inventário: 101 HTML, 94 páginas de raiz, sete auxiliares, 55 referências literais nos testes, zero assets ausentes e zero divergências de guardas/catalogação. As 156 referências a scripts ativos incluem os 135 grupos de integração e 21 scripts de navegador; referências literais não são cobertura global demonstrada.

## Limites

- Recuperação explícita no dispositivo original; requer armazenamento local, IndexedDB e Web Locks. Não existe cópia remota dos rascunhos ainda não enviados.
- Uma ocorrência por confirmar por conta. Alterações de atribuição/contexto ou dados antigos ambíguos exigem revisão com o escritório; não foi acrescentada transferência ou cancelamento de pedidos já tentados.
- O formulário conserva o âmbito REGULAR anterior. Visitas extra, reparações por outras APIs, preços históricos e conclusões antigas já preparadas conservam os respetivos contratos.
- Registado não confirma leitura, push, execução, orçamento ou faturação. Nenhum fornecedor externo foi acionado.
- A entrada de novo cliente, relatórios administrativos, revisão global de páginas/PDFs/idiomas e validações em dispositivos/serviços reais continuam na matriz. Não constitui prontidão global.
