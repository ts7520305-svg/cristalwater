# TASK158 — Recebimentos sem dupla contagem de crédito

Reprodução `field-qa-runtime/run-1789502483039`: um adiantamento em dinheiro de 100 EUR, seguido do uso de 50 EUR desse crédito, aumentava o indicador de caixa em 150 EUR. Os relatórios somavam dinheiro recebido e aplicação interna do mesmo saldo.

O serviço comum de relatórios de recebimentos exclui CREDIT, CREDIT_NOTE e ajustes internos, incluindo grafias antigas com espaços/minúsculas. Os totais usam cêntimos e todo o histórico aplicável, sem o corte de paginação de 5.000/10.000 movimentos. O filtro mensal usa o primeiro instante do mês seguinte como limite exclusivo. Os campos existentes de receita conservam o contrato e passam a declarar `basis: CASH_RECEIPTS` e `limitApplied: null`.

Fluxo de caixa exclui rascunhos/documentos retirados do valor faturado. O balanço da empresa acrescenta `cashReceived`, calcula o saldo líquido a partir deste valor e conserva a responsabilidade por crédito de clientes arquivados. `totalPaid` continua a indicar os valores liquidados nos documentos; não deve ser interpretado como entradas de caixa.

Quatro grupos aprovados em `field-qa-runtime/run-1789502567373`: novos relatórios, Finance OS, proteção de rascunhos e histórico de excedentes. Cobertura de adiantamento/reutilização, arquivo, rascunhos, 10.001 movimentos de um cêntimo, fevereiro/março e mês inválido. O runner passa a 63 grupos.

Sete ficheiros: serviço, negócio, controlador, teste, runner, relatório e checkpoint. Sem migração. São indicadores internos de recebimentos, não demonstrações contabilísticas completas; custos, despesas, impostos e reconciliação bancária não são inferidos a partir destes movimentos. A consulta agrega em memória apenas os campos necessários do histórico; dimensionamento com volumes de produção continua separado.
