# Chat interno transacional — TASK177

## Problema e resultado

`/api/chat/internal` devolvia sempre uma lista vazia. `/api/internal-chat/messages` usava um ficheiro JSON: a substituição atómica protegia um processo, mas não coordenava vários servidores nem reconhecia reenvios. Ambos usam agora o mesmo negócio e duas tabelas próprias, `InternalChatMessage` e `InternalChatImport`.

A conversa da equipa continua reservada a ADMIN, TECHNICIAN e TEAM_LEADER ativos. `ChatMessage` mantém as mensagens administrativas dirigidas e `ClientMessage` mantém as conversas privadas; nenhuma dessas tabelas é agregada ao canal da equipa.

## Contrato

| Operação | Endereço antigo | Alias consolidado |
|---|---|---|
| Consultar | `GET /api/internal-chat/messages`: array | `GET /api/chat/internal`: `{ok, messages}` |
| Enviar | `POST /api/internal-chat/messages`: mensagem e `replayed` | `POST /api/chat/internal`: `{ok, message, replayed}` |

- Envio exige `text` entre 1 e 4000 caracteres e `requestId` UUID. O consumidor deve conservar esse UUID e o texto ao repetir, inclusive depois de uma resposta perdida.
- Primeira gravação: 201. Repetição exata pela mesma conta: 200, com a mensagem original. Texto diferente no mesmo pedido: 409. UUID inválido ou ausente: 400, sem escrita.
- Remetente, perfil e técnico são derivados da sessão. Números iguais em User e Technician não representam a mesma conta. Tokens antigos/novos de ADMIN e mudanças de função conservam a chave da conta e o autor original de um reenvio.
- As respostas com conteúdo usam `Cache-Control: private, no-store`. Falhas internas não expõem detalhes SQL e não confirmam um envio.

## Histórico e conservação

A primeira consulta ou escrita autorizada importa o JSON na mesma transação usada para a operação. Um bloqueio na base de dados coordena processos diferentes; índices únicos protegem o pedido por conta e cada registo histórico.

O ficheiro original nunca é alterado ou eliminado pelo negócio. Cada versão lida com sucesso fica arquivada integralmente em `InternalChatImport.sourceText`, incluindo a formatação, para entrar nas cópias da base de dados. Os objetos históricos conservam campos, identificadores e datas originais, com um `recordId` próprio e `identityVerified: false`. Não são atribuídos a uma pessoa por suposição. Mensagens novas têm identidade da sessão verificada no acesso à API.

A identidade histórica usa o conteúdo com chaves ordenadas e o número da ocorrência. Conserva até linhas idênticas repetidas no ficheiro. Uma alteração de indentação/ordem de chaves ou a adição de linhas não reimporta o prefixo existente. Alterar o conteúdo de uma linha produz um novo registo conservador, mantendo a versão antiga. Isto não resolve automaticamente a fusão de históricos independentes de máquinas diferentes.

A importação tem lotes de 500 linhas dentro de uma só transação. Qualquer erro reverte os lotes e o recibo do envio. JSON malformado/estrutura inválida bloqueia a operação sem substituir o ficheiro nem perder dados já importados. Depois de importado, o histórico continua acessível se o ficheiro deixar de existir. Não existe limpeza automática destas tabelas.

## Validação

- `field-qa-runtime/run-1789533950142`: quatro grupos aprovados — durabilidade interna, perfil/acesso interno, privacidade CLIENT/Socket.IO e Administration OS.
- `field-qa-runtime/run-1789534044698`: revisão final da durabilidade e identidades aprovada, incluindo User/Technician distintos com o mesmo número e token USER ligado ao técnico.
- Novo grupo: dois processos HTTP reais; 503 linhas históricas em vários lotes; reimportação e preservação das duplicadas; 12 reenvios concorrentes com uma gravação; 18 mensagens distintas simultâneas; perda deliberada da resposta após commit; reinício do processo; ficheiro ausente/corrompido; falha SQL e reversão integral; separação das conversas privadas.
- 323 testes unitários, quatro de técnicos e sintaxe de 520 ficheiros backend aprovados localmente. Os ensaios locais usam PGlite via TCP; PostgreSQL 16 nativo e restauro são verificados no CI da árvore publicada.
- Runner passa a 81 grupos. `test-field-migrations.js` aplica dez migrações aditivas ao esquema anterior, conserva também uma mensagem administrativa e verifica que o resultado corresponde ao Prisma atual.

## Limites e próximo ponto

A migração `20260916090000_internal_chat` acrescenta apenas tabelas/índices. É necessário aplicar o SQL ao esquema conhecido e gerar o Prisma antes de usar esta versão num servidor. Nenhuma migração foi executada no VPS; o histórico de migrações antigo continua a exigir diagnóstico antes de qualquer instalação.

A tarefa consolida as APIs. `technician-chat.html` continua a mostrar notificações de leitura, e não ganhou um formulário de conversa nesta tarefa. Próxima implementação: integrar a conversa da equipa no ecrã existente com recuperação do pedido, estados de erro e separação das notificações; depois prosseguir a revisão das escritas antigas e o inventário visual. Concorrência controlada não prova dimensionamento, redundância ou entrega de push em dispositivos reais.
