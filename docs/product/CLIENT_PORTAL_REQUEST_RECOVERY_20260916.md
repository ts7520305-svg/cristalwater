# TASK186–187 — pedidos de visita e avisos de pagamento recuperáveis

## Problema e resultado

A revisão dos dois formulários do portal encontrou envios sem UUID, sem pedido conservado entre recarregamentos e sem verificação de uma confirmação ligada ao conteúdo. O servidor criava outra mensagem/notificação em cada chamada. O registo de comunicação da visita ignorava falhas, e uma falha do evento posterior ao pagamento podia devolver erro depois da gravação.

`ClientPortalRequestBusiness` reúne os dois percursos. Cada pedido identificado guarda mensagem, notificação administrativa, comunicação obrigatória e confirmação original numa transação. Um bloqueio PostgreSQL e a chave composta conta/UUID coordenam diferentes processos. A assinatura inclui cliente, tipo de pedido e conteúdo normalizado; reutilizar o UUID para outra visita, valor, nota, método ou tipo devolve 409. Repetir o mesmo pedido devolve o registo original, mesmo depois de ler a mensagem, eliminar a notificação ou alterar o nome do cliente.

A tabela `ClientPortalRequest` conserva a resposta imutável e tem um índice por cliente. Não depende da existência posterior das linhas mutáveis de notificação/mensagem, não é eliminada automaticamente e não atribui UUID a pedidos históricos. A identidade é derivada da sessão CLIENT ativa e só permite o próprio cliente; ADMIN mantém a pré-visualização sem poder enviar por ele. O espaço de UUID destes dois pedidos é distinto do envio normal de chat. As mensagens mantêm `actorKey` e assinatura, mas o UUID fica no comprovativo próprio.

O pedido de visita continua a responder HTTP 201 e conserva `request` e `notification`. O aviso de pagamento conserva HTTP 200, `message` e `paymentReference`. Ambos acrescentam `submission`, `replayed` e `receipt` de âmbito `CLIENT_PORTAL_REQUEST`, com identidade, UUID, assinatura, tipo e identificadores dos três registos; o hash do texto permite validar também a mensagem apresentada. Chamadas antigas sem UUID continuam aceites com conteúdo válido, mas não beneficiam da deduplicação.

## Regras e limites da comunicação

- Descrição de visita obrigatória, até 4000 caracteres; nota de pagamento até 4000 caracteres. Objetos, arrays, texto vazio obrigatório e tipos inválidos são recusados.
- Valor opcional, positivo quando indicado, até duas casas decimais e oito algarismos inteiros; cálculo em cêntimos. Zero conserva a convenção antiga de valor não indicado. Métodos limitados às opções reais do formulário e ao caso antigo não indicado.
- Canal fixado pelo servidor como `PORTAL_CLIENTE`; remetente, referência e cliente não são escolhidos pelo corpo.
- Pedir visita não agenda nem conclui uma visita. Comunicar pagamento não cria recebimento, não liquida faturas e não altera crédito. O texto conserva a instrução de confirmação financeira.
- Eventos ocorrem depois do commit, não repetem em replay e não transformam a falha de transporte do evento em falha da gravação. Usam o encaminhamento autenticado existente para a sala do cliente e a administração.
- Erros inesperados devolvem uma indicação de pedido não confirmado, sem detalhes SQL. As três dependências obrigatórias e a confirmação são revertidas em conjunto quando há falha.

## Formulários e apresentação

`cw-client-portal-request.js` serve os dois formulários existentes. Rascunhos são separados por conta, formulário e janela; o pedido completo passa a IndexedDB antes do POST, com UUID, valores originais e assinatura. O conteúdo pendente é imutável e a repetição é explícita. O mesmo pedido sobrevive a perda de rede/resposta e a recarregamento. Web Locks coordenam janelas; IndexedDB conserva a confirmação final atomicamente com a remoção da pendência, para outra janela não reabrir um rascunho já enviado.

O formulário só aceita HTTP 200/201, `ok: true` e confirmação correspondente à conta, cliente, tipo, UUID, conteúdo e registos. Respostas vazias, malformadas, de outro pedido ou HTTP 202 continuam pendentes. Falhar a atualização da conversa não retira uma confirmação já validada. Falhar o armazenamento antes do envio impede o POST; falhar ao guardar a confirmação conserva o pedido para replay. Conteúdo guardado que não passe a validação fica preservado e bloqueado.

A sessão usada no POST é a capturada na abertura da página. Mudar de conta ou token limpa os campos e oculta a pendência; uma resposta antiga não confirma nem limpa o pedido da conta original. Voltar à conta original recupera-o. A pré-visualização administrativa continua sem enviar, incluindo chamadas diretas aos handlers.

O valor do aviso já não é preenchido automaticamente com o saldo em dívida: é o valor declarado pelo cliente, que pode ser diferente. O resultado indica que o pedido foi registado e que o agendamento ou confirmação financeira ainda são aguardados. Os estados, botões e instruções dos dois formulários têm PT/EN/FR/ES/DE. O ensaio do seletor real encontrou a ausência de ES/DE na lista e o retorno de ES a outro idioma; corrigidos o seletor, a normalização, o dicionário espanhol e a navegação. O painel de pedidos passa a apresentar capacidades úteis em vez de termos internos como `client-owned-data-only`.

## Validação

- `test-field-client-portal-requests.js`: dois processos HTTP reais e oito envios concorrentes por tipo; um conjunto de registos, confirmação original após alterações/eliminação, UUID alterado, conflito entre tipos, isolamento de contas, ADMIN/anónimo recusados, sessão desativada, perda da resposta após commit e reinício do processo. Falhas SQL forçadas em comunicação, notificação e confirmação não deixam escrita parcial; o mesmo pedido funciona após remover a falha.
- O mesmo grupo compara integralmente pagamentos/faturas/visitas e crédito antes/depois; inclui uma fatura parcial, recebimento e saldo positivo. Valida métodos, montantes em cêntimos, tamanhos, tipos inválidos e falha de evento após commit.
- `test-field-client-portal-requests-ui.js`: Chromium com página/API/base reais; rascunho completo, duas janelas, clique repetido, resposta perdida/trocada/malformada/202/403, falha de atualização, reload, falta de rede, quota antes do POST e depois do commit, corrupção, troca de conta e recuperação original. Seletor real nos cinco idiomas, texto HTML literal, larguras 390/1440 e pré-visualização ADMIN.
- Ensaio dirigido dos dois grupos e portal operacional aprovado em `field-qa-runtime/run-1789546052963`. Histórico nos três ecrãs, percurso completo técnico/cliente/ADMIN e recuperação nova aprovados em `run-1789546096402`. Revisão final dos dois grupos e privacidade CLIENT em `run-1789546180805`.
- O ensaio histórico anterior foi ajustado para alterar a preferência de idioma de forma consistente com a página e posicionar a captura pelo contentor estável; conserva todas as verificações de autoria, conteúdo, privacidade e idiomas. Evita a corrida com a substituição das linhas durante a atualização.
- 324 testes unitários em 58 ficheiros, quatro de técnicos, 17 scripts de navegador e sintaxe de 524 ficheiros backend aprovados localmente. Imagens em `reports/field-visual/client-portal-requests/`, revistas em mobile/desktop.

`20260916120000_client_portal_requests` é a décima terceira migração aditiva. O teste parte do esquema anterior, verifica os dados conservados e que a tabela nova começa vazia. O runner passa de 87 para 89 grupos. Publicar a árvore final e confirmar as migrações, os 89 grupos e o restauro em PostgreSQL 16; a aprovação da base anterior não substitui a do código novo.

## Continuação

Rever os formulários de edição de clientes/piscinas e as escritas antigas efetivamente usadas: autenticação não prova controlo de versão, recuperação após falha ou tratamento de conflitos. Continuar o inventário visual por perfil e a matriz global. Esta entrega não instala no VPS, não confirma recebimentos reais nem ativa fornecedores externos.
