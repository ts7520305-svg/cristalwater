# TASK154 — Recuperação da ativação no formulário

O ecrã de clientes conserva um pedido de ativação por conta administrativa, com UUID, cliente, mês e valor imutáveis. Antes do primeiro envio, consulta novamente o cliente e confirma que ainda está por ativar. O pedido é guardado e relido antes de enviar; falha de armazenamento impede o envio.

Um painel independente dos filtros da lista permite recuperar o mesmo pedido após perda da resposta ou recarregamento, mesmo que o contrato já apareça ativo. Web Locks coordena as janelas da mesma conta. A confirmação precisa de identificar o pedido, cliente, responsável, mês, valor, parcelas aplicadas e crédito corretos antes de remover o registo local. Mudança de sessão impede envios e oculta o painel anterior; o cabeçalho de autenticação fica vinculado à sessão que abriu o formulário.

Recusas explícitas 400/404/409 ficam guardadas e exigem a ação Rever pedido recusado, que atualiza os clientes antes de retirar o pedido. Respostas inválidas, falhas de rede e erros de servidor conservam o pedido para nova confirmação. Dados locais corrompidos bloqueiam novas ativações e são conservados para revisão.

O teste integrado usa Chromium e a API/base reais: primeiro recebimento de 10 EUR preserva 5 EUR anteriores; resposta perdida, duas janelas, reload e confirmação adulterada não geram outro pagamento. Inclui quota de armazenamento, dados locais corrompidos, recusa explícita e mudança de sessão. A revisão final passou em `field-qa-runtime/run-1789500790063`, após corrigir o estilo que sobrepunha a ocultação do botão de repetição durante uma recusa. A regressão da API passou em `field-qa-runtime/run-1789500704985`. O runner passa a 59 grupos. Sete ficheiros: helper, página, script existente, teste, runner, relatório e checkpoint.

Limites: o navegador precisa de contexto seguro e Web Locks; nenhum envio é feito sem essas capacidades. A recuperação refere-se a este formulário; não substitui revisão de outros percursos financeiros nem ensaios em dispositivos físicos. Registos corrompidos exigem revisão do conteúdo conservado; não são eliminados automaticamente.
