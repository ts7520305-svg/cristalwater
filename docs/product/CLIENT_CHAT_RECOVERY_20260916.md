# TASK182–183 — envio recuperável nas conversas de clientes

## Problema e resultado

A repetição de um pedido entre `/api/chat` e `/api/client-messages` criava duas mensagens. A reprodução em `field-qa-runtime/run-1789537741693` devolveu dois sucessos HTTP e `count:2` para o mesmo UUID. O ecrã antigo também apagava o texto sem verificar a resposta, e os percursos com anexo perdiam a seleção após falha/reload.

As três entradas que escrevem em ClientMessage — `/api/chat`, `/api/client-messages` e `/api/client-portal/:clientId/messages` — e `/api/client-messages/upload` partilham agora o mesmo negócio. O autor vem da sessão ativa; CLIENT, USER e ENV_ADMIN têm espaços de identidade distintos. A chave combina a conta com o UUID, e a assinatura inclui o cliente e o texto ou o nome/tamanho/bytes do anexo. Um UUID repetido com outro conteúdo ou destinatário dá 409; outro utilizador mantém o seu próprio espaço.

A mensagem, a confirmação e o registo de comunicação são atómicos. Repetir o pedido devolve o mesmo registo, sem duplicar a comunicação. A migração aditiva acrescenta `actorKey`, `requestId` e `payloadHash` opcionais e uma chave única em ClientMessage. As mensagens anteriores conservam null; não se inventam autores nem identificadores históricos. O ensaio de migração inclui duas mensagens antigas preservadas.

Os anexos repetidos são comparados pelos bytes e conservam o ficheiro original autenticado. Uploads redundantes só são removidos depois de confirmar que nenhuma mensagem os referencia. Se a base não permitir essa confirmação, o ficheiro privado é conservado para revisão posterior; uma resposta de commit perdida não deve apagar um anexo válido.

## Comportamento nos ecrãs

`client_chat`, `client-portal` e `chat` usam `cw-client-chat-send.js`. O pedido é escrito e relido em IndexedDB antes de sair, com o Blob completo do anexo, UUID, destinatário e assinatura. O rascunho é separado por conta/conversa/janela. Uma única pendência por conta, coordenada por Web Locks, impede que janelas ou ecrãs concorrentes criem outro envio em substituição do original.

A resposta só confirma o envio com HTTP 200/201, `ok:true`, comprovativo `CLIENT_CHAT_SEND` e correspondência de conta, UUID, cliente, assinatura e mensagem. HTTP 202 de uma fila offline, resposta trocada e sucesso sem comprovativo conservam a pendência. O botão Repetir envio reusa o pedido original; não há envio automático ao recuperar a rede. Texto e anexo sobrevivem ao reload, desde que o armazenamento local permaneça disponível.

Ao mudar a sessão, a apresentação é limpa e a resposta antiga é ignorada; a pendência continua associada à conta original. No administrador, o rascunho muda de forma síncrona ao selecionar outro cliente. Este ponto foi corrigido após o ensaio `run-1789538407608` detetar que o texto anterior permanecia disponível durante a consulta assíncrona.

Leituras falhadas conservam a última lista, e respostas antigas não retiram mensagens mais recentes. O portal passa a devolver a conversa completa por ordem cronológica, sem o limite anterior de 100. O ecrã CLIENT antigo abre diretamente a conversa da sua identidade, apresenta texto literal e mantém o download autenticado. As notificações de mensagens continuam a ser tratadas pelos percursos existentes. Quando o administrador abre o link CLIENT antigo, segue para `/chat` conservando a sessão; o teste detetou que o guarda antigo apagava as credenciais.

## Validação

- `test-field-client-chat-retry.js`: repetição entre as três rotas; nove envios concorrentes; UUID/conteúdo inválidos; separação de conta e destinatário; falha SQL no registo obrigatório e reversão integral; anexos repetidos/alterados; um único ficheiro conservado e download dos bytes originais.
- `test-field-client-chat-recovery-ui.js`: Chromium e API reais nos três ecrãs, rascunho/reload, dois cliques/janelas, resposta perdida/trocada/202, offline, falta de quota, leituras falhadas/antigas, troca de cliente/conta e recuperação da conta original. Os anexos do portal/admin conservam bytes e nomes acentuados após reload. Um pedido local alterado é conservado e bloqueado antes do transporte. As mensagens de estado do componente são verificadas nos cinco idiomas disponíveis.
- Sete regressões aprovadas em `field-qa-runtime/run-1789538958038`: UI/contrato, privacidade CLIENT, anexos, portal operacional, documentos financeiros na conversa e identidade dos aliases antigos. Revisão final de UI em `run-1789539318979`.
- 324 testes unitários em 58 ficheiros e quatro testes de técnicos aprovados; sintaxe de 522 ficheiros backend. Os testes unitários do portal isolam o novo componente e continuam a verificar o ciclo de seleção; persistência e transporte são ensaiados no navegador real.
- Imagens em `reports/field-visual/client-chat-recovery/`. A inspeção detetou estilos de navegação em falta, sobreposição no computador, contraste de datas/estado e um indicador de carregamento que persistia depois da confirmação. Os ecrãs corrigidos foram revistos em 390/1440 px; o teste exige o formulário visível ao lado da navegação administrativa. O ecrã CLIENT antigo deixa de apresentar a segunda barra de navegação e o aviso técnico de leitura segura.

Após uma falha SQL forçada, uma repetição local em `run-1789539318979` encontrou uma ligação PGlite encerrada (`UnexpectedMessage`), devolvendo 401 na consulta de identidade; o grupo de UI passou nessa execução. O mesmo grupo, sem alterações, passou numa base local nova em `run-1789539397352`. A repetição transacional completa deve ser confirmada em PostgreSQL nativo, sem alterar a expectativa do teste.

O runner passa a 85 grupos. Os ensaios locais usam PGlite por TCP; a árvore publicada deve passar o CI em PostgreSQL 16, onze migrações aditivas e restauro. Não usar um workflow de uma árvore anterior como confirmação desta versão.

## Limites e próximo ponto

Chamadas antigas sem UUID continuam compatíveis, sem garantia de repetição idempotente. Os aliases JSON `/api/clientChat` e `/api/client-chat` ainda conservam armazenamento/contrato próprios; consolidá-los é o próximo ponto, preservando integralmente o histórico e a autoria não comprovada. Nenhum dos três ecrãs alterados depende desses aliases.

Eventos Socket.IO são emitidos depois do commit e não constituem fila durável nem prova de receção pelo cliente. A confirmação significa que a mensagem ficou na conversa. Não houve ensaio de capacidade, operação prolongada num telefone físico, instalação no VPS ou entrega por fornecedor externo. IndexedDB/Web Locks/criptografia do navegador requerem um navegador compatível e contexto seguro; indisponibilidade local impede novos envios em vez de fingir recuperação. Não existe limpeza automática de pedidos incertos ou de ficheiros privados que não puderam ser verificados.

## Correção do ensaio isolado no CI

O primeiro workflow desta entrega, `35063090745` (commit `66d4a8450c48b20afa87d3de5dc5a6889df2684d`), aprovou onze migrações, 324 testes unitários/quatro de técnicos e a sintaxe. Parou no ensaio isolado de notificações porque o seu HTML mínimo não carregava o novo componente do portal. O fixture passa a declarar essa dependência, conserva todas as verificações de leitura e acrescenta a ausência de erros JavaScript. O componente real continua coberto pelos três ecrãs no grupo integrado. Os 17 scripts de navegador passaram localmente após a correção. A bateria de 85 grupos e o restauro não correram nessa tentativa; confirmar o workflow da árvore corrigida.

O segundo workflow, `35063541601` (commit `3558f01503ecb80086fd3e3fcc6b6f0c8c678197`), aprovou onze migrações, 324 unitários/quatro de técnicos, 17 scripts de navegador e 84 dos 85 grupos operacionais. Os dois grupos novos passaram em PostgreSQL 16, incluindo a reversão SQL e repetição que tinha encontrado uma ligação PGlite encerrada. O percurso geral `test-field-e2e.js` ainda intercetava a rota antiga do portal, pelo que o envio real chegava ao servidor sem a falha pretendida; tentava também editar a mensagem na pré-visualização ADMIN agora bloqueada.

O ensaio geral passa a intercetar a rota efetivamente usada, exige a pendência e o botão Repetir envio, recarrega a página e compara integralmente o pedido repetido com o original. Conserva a verificação de uma só mensagem e de um só upload. Na pré-visualização ADMIN verifica o bloqueio do compositor; o ensaio de rascunhos por cliente e de respostas antigas usa o campo existente de pedido de visita, cuja ação continua bloqueada para ADMIN. O envio administrativo real e os seus rascunhos permanecem cobertos em `/chat` pelo grupo de recuperação. O restauro foi corretamente omitido nessa tentativa porque a bateria geral falhou; requer novo workflow da árvore corrigida.

O percurso geral corrigido passou integralmente em `field-qa-runtime/run-1789540435746` (técnico móvel, cliente móvel e administrador desktop), sem alterar o comportamento de produção nesta correção.
