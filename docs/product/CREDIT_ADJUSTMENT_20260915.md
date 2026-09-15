# TASK147 — Crédito interno auditado e recuperável

## Contrato

`POST /api/billing/client/:id/credit` continua reservado a ADMIN. A operação atribui **crédito interno, não dinheiro recebido**. Não cria `Payment`, fatura ou nota de crédito fiscal; não altera `lastPaymentAt`, `paymentStatus` nem liquida faturas. Um recebimento real deve usar os percursos de pagamentos/recebimentos, incluindo o movimento de adiantamento da TASK146.

O pedido exige UUID v4 `requestId`, `month` no formato YYYY-MM, valor positivo com até dois decimais, motivo não vazio em `notes` (máximo 2000 caracteres) e saldo observado em `expectedCreditCents` (inteiro não negativo). `method`, se fornecido, tem de ser `ADJUSTMENT`. Chamadas antigas apenas com `amount` passam a receber 400: é necessário atualizar o ecrã ou a integração. Não há conversão automática de entradas históricas em recebimentos.

O negócio bloqueia a chave global do pedido e o cliente (`FOR NO KEY UPDATE`), relê o saldo e recusa versões desatualizadas com 409. Saldo, `AuditTrail`, `CommunicationLog` e confirmação durável são gravados na mesma transação. A auditoria identifica responsável, cliente, valor, motivo, saldo anterior/posterior em cêntimos, mês e UUID. Uma repetição exata devolve a confirmação original mesmo depois de outros movimentos. Reutilização do UUID com outro responsável, cliente, valor, motivo, mês ou tipo de operação é recusada.

## Ecrã de cobranças

- Consulta efetivamente o mês selecionado e apresenta faturas a receber, linhas e saldos; exclui rascunhos e documentos retirados. O seletor permite ajustar clientes mesmo sem fatura nesse mês.
- O resumo distingue faturado, aplicado às faturas e aberto. Crédito aplicado a uma fatura não é apresentado como novo dinheiro recebido. Os aliases anteriores `totals.total/paid/open` são conservados.
- As antigas ações de pagamento/alteração direta de estado, que apontavam para rotas inexistentes, dão lugar a ligações para os percursos de faturas e recebimentos já validados. O botão inoperante de geração mensal foi retirado deste ecrã; a API de geração continua disponível, sem alteração nesta tarefa.
- O formulário mostra cliente e saldo, exige motivo e volta a consultar o saldo antes do envio. O pedido é guardado por conta antes do POST e protegido por Web Locks contra duas janelas. Não há envio automático nem novo UUID após perda da resposta.
- A confirmação é validada pelo tipo, UUID, responsável, cliente, mês, montante, motivo e saldos. Dados guardados alterados durante a resposta não são apagados. Rejeições definitivas exigem revisão com nova consulta; falhas transitórias preservam o pedido para confirmação explícita.
- Falhas de armazenamento, mudança de sessão, consulta antiga e atualização falhada não permitem novas atribuições com dados não confirmados. Nomes e descrições são escapados; formulário e navegação verificados a 390 e 1440 px.

## Verificação

Teste integrado `scripts/test-field-credit-adjustment.js`: API real, concorrência, repetição entre contas/operações, pré-condição de saldo, rollback forçado nas três escritas de auditoria/confirmação e navegador Chromium. Inclui cancelamento, duas janelas, resposta perdida/trocada, quota/corrupção, alteração do pedido guardado, respostas antigas, mudança de sessão e falhas de consulta. Verifica que os ajustes não criam pagamentos nem alteram a fatura do cliente.

Primeiro percurso completo aprovado em `field-qa-runtime/run-1789493316764`. Revisão final e regressão de excedentes, mensalidades, recebimentos e pagamentos em `field-qa-runtime/run-1789493443974`; consultar `suite-results.json` desse ensaio. 323 testes unitários, quatro testes de técnicos e sintaxe dos 500 ficheiros backend aprovados durante a tarefa. O novo grupo integra a bateria operacional, que passa de 51 para 52 grupos. O workflow do commit publicado é a prova final de PostgreSQL 16 e restauro; a base local descartável usa PGlite, não mede o VPS.

## Limites

Não existe ajuste negativo/estorno nesta operação. Saldos negativos ou fora do intervalo seguro exigem reconciliação, sem normalização silenciosa. Não há migração de dados antigos, emissão fiscal, acesso a produção, instalação no VPS ou integração na `main`. A harmonização dos preços da faturação mensal antiga e a revisão dos restantes caminhos de alteração de crédito continuam pendentes.
