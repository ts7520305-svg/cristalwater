# TASK184–185 — conversa CLIENT consolidada e histórico conservado

## Problema e resultado

As rotas `/api/clientChat` e `/api/client-chat` escreviam exclusivamente em `src/data/clientChatMessages.json`. O teste `field-qa-runtime/run-1789541656220` confirmou HTTP 201, mas a mensagem não apareceu em `/api/chat/client/:clientId`. A substituição atómica do ficheiro também não coordenava diferentes processos nem reconhecia reenvios.

Os aliases antigos usam agora `ClientMessageBusiness`, a mesma transação e os mesmos comprovativos dos três percursos atuais. O autor vem da sessão ativa. O UUID, quando fornecido, identifica o envio por conta e assinatura do conteúdo/destinatário; uma repetição entre aliases antigos e atuais conserva a mensagem e a comunicação originais. Um pedido com conteúdo diferente dá 409. Chamadas antigas sem UUID continuam compatíveis, sem garantia de deduplicação.

O contrato antigo conserva o array na consulta e a mensagem direta/HTTP 201 no envio, incluindo nas repetições. Os campos `id`, `clientId`, `from`, `text`, `created_at`, `readByAdmin` e `readByClient` continuam disponíveis. Mensagens novas têm um identificador opaco `db-<id>` e acrescentam `messageId`, `recordId`, `source`, `identityVerified`, `requestId`, `replayed` e `receipt`. O `messageId` e o comprovativo correspondem aos do percurso atual. Os identificadores históricos conservam o valor e tipo originais.

## Histórico e importação

`clientChatHistoryService` lê o ficheiro sem o escrever ou eliminar. A importação autorizada usa uma transação e bloqueio PostgreSQL, com lotes de 500 registos. Quando ocorre durante um envio, importação, mensagem e registo de comunicação pertencem à mesma transação. Um erro não deixa apenas uma parte gravada.

Cada versão válida fica em `ClientChatImport`, com hash SHA-256 e bytes completos em `sourceBytes`, incluindo formatação e defeitos de codificação antigos. `ClientChatLegacyRecord` conserva os objetos lidos e a identidade de cada ocorrência. Chaves JSON reordenadas, indentação e adição de linhas não duplicam o prefixo já importado; linhas históricas idênticas mantêm ocorrências distintas. Alterações de conteúdo criam outro registo conservador, mantendo a versão anterior.

Só são apresentados na conversa comum os registos com cliente existente, texto e data ISO válida. Recebem `senderType: LEGACY`, nunca identidade de uma conta por suposição. Campos arbitrários do arquivo não se tornam remetente autenticado, recibo ou referência de anexo. Registos com data impossível, cliente ausente ou dados insuficientes ficam no arquivo; ADMIN pode consultar os que têm um número de cliente utilizável pelo alias antigo, com `projected: false`. Não são apresentados a uma conta criada posteriormente com o mesmo número. As entradas sem número utilizável permanecem recuperáveis no arquivo da base.

Depois de importado, o histórico continua acessível se o ficheiro faltar. JSON corrompido ou estrutura inválida bloqueiam a operação sem substituir o ficheiro ou confirmar uma escrita. As respostas de erro não expõem fragmentos do JSON nem detalhes SQL. Não existe eliminação automática do arquivo ou fusão automática de históricos independentes de vários servidores.

## Leitura, privacidade e ecrãs

Os dois aliases e os percursos `/api/chat/read` e `/api/client-messages/seen/:clientId` partilham a atualização transacional. CLIENT confirma apenas a própria leitura; ADMIN confirma a leitura administrativa. O campo novo `isReadByClient` distingue a leitura do destinatário do estado antigo `seen`. Não se inferem leituras CLIENT anteriores; a migração conserva `seen`/`seenAt` e não inventa datas. Repetir uma leitura não substitui uma `seenAt` existente.

Os contadores atuais/antigos contam a mesma conversa persistida, incluindo mensagens históricas ainda não lidas pelo administrador. Registos arquivados sem projeção não entram no contador da conversa. A consulta mantém a titularidade por cliente; técnicos e chefes não recebem acesso às conversas privadas.

`client_chat`, `client-portal` e `chat` apresentam “Mensagem antiga · autor não confirmado”, com versões PT/EN/FR/ES/DE. O chat administrativo usa uma apresentação neutra para essas mensagens. Texto HTML permanece literal. Um caminho de upload no JSON não cria um botão de download nem autoriza os bytes: o serviço de anexos recusa mensagens importadas como fonte de autorização e conserva o acesso legítimo do proprietário. A inspeção visual detetou e ocultou a segunda barra de navegação do ecrã CLIENT antigo, conservando a navegação principal existente.

## Migração e validação

`20260916110000_client_chat_legacy` acrescenta duas tabelas, `legacyKey` e `isReadByClient` em ClientMessage, índices e a relação com o arquivo. Não reescreve as mensagens anteriores. O ensaio de atualização passa a doze migrações e verifica as duas mensagens históricas do esquema anterior, com os campos novos sem atribuição retroativa.

- `test-field-client-chat-consolidation.js`: dois processos HTTP, doze reenvios concorrentes, dezasseis envios distintos, repetição entre APIs antigas/atuais, sessão ativa, mais de 500 linhas de importação, duplicadas históricas, arquivo exato dos bytes, codificação antiga, cliente privado, órfão não associado posteriormente, datas impossíveis, anexo não autorizado, leitura partilhada, falhas SQL de leitura/importação/envio, perda da resposta/reinício e ficheiro ausente/corrompido.
- `test-field-client-chat-history-ui.js`: três ecrãs reais, identificação histórica nos cinco idiomas, conteúdo HTML literal, ausência de links de anexo inferidos, separação entre clientes e apresentação a 390/1440 px. Imagens em `reports/field-visual/client-chat-history/`.
- Quatro regressões finais aprovadas em `field-qa-runtime/run-1789542760613`: consolidação, identidade, privacidade REST/Socket.IO e anexos. A recuperação de texto/ficheiro, o chat interno e o portal operacional passaram em `run-1789542279532`.
- UI histórica e percurso completo técnico/cliente/ADMIN aprovados em `run-1789542594521`. A primeira captura ADMIN começou durante uma atualização; o ensaio passou a aguardar o texto final. Uma execução anterior do percurso geral atingiu uma espera de sete segundos no cliente; a repetição em base nova passou sem alterar esse percurso. O diagnóstico do teste passa a conservar a stack em caso de nova falha.
- 324 testes unitários em 58 ficheiros, quatro de técnicos e 17 scripts de navegador aprovados; sintaxe de 523 ficheiros backend aprovada. O runner passa de 85 para 87 grupos. Confirmar a árvore publicada em PostgreSQL 16, as doze migrações e o restauro, incluindo os bytes arquivados nas duas tabelas novas.

## Próximo ponto e limites

Rever os pedidos de visita e avisos de pagamento do portal, que continuam a usar formulários sem pedido persistente/UUID e confirmação exata. A recuperação das mensagens já está tratada; não duplicar a sua implementação. O aviso de pagamento é uma comunicação do cliente, não prova de recebimento.

Esta entrega não executa migrações no VPS, não ativa fornecedores e não demonstra capacidade em produção ou operação prolongada num dispositivo físico. A importação depende de aplicar a migração e gerar o Prisma em todos os processos que servem estas rotas.
