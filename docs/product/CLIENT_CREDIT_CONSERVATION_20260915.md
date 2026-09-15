# Conservação do crédito disponível — TASK144

A aplicação automática bloqueava apenas a fatura e lia o crédito do cliente antes de o descontar. Duas faturas podiam usar o mesmo saldo. O teste unitário força duas leituras simultâneas da mesma fotografia e reproduziu 20 EUR aplicados a partir de 10 EUR. O teste integrado usa doze faturas e um atraso no intervalo crítico; a validação de concorrência real é feita em PostgreSQL 16 no workflow, pois a base PGlite local não demonstra o mesmo escalonamento de transações.

O serviço bloqueia agora a linha do cliente com `FOR NO KEY UPDATE`, depois da fatura, e relê o saldo antes de decidir o desconto. Esse bloqueio conserva a compatibilidade com verificações de chave estrangeira durante a criação de outras faturas. A aplicação usa cêntimos inteiros e grava o saldo restante exato sob o bloqueio. Pagamento de crédito, fatura, cliente e comunicação integram a mesma transação; erros de comunicação deixam de ser ignorados. O estado final do cliente usa a dívida cobravel real.

Foi reproduzido outro erro no Finance OS em `field-qa-runtime/run-1789489780281`: crédito anterior 15 EUR, fatura 20 EUR, recebimento 25 EUR. O sistema deixava 5 EUR de crédito e 35 EUR pagos na fatura. O percurso aplicava crédito antes de recalcular o dinheiro acabado de receber. Essa aplicação indevida foi removida: a fatura recebe 20 EUR e o crédito anterior passa de 15 para 20 EUR com o excedente de 5 EUR. O mecanismo existente de registo do excedente do Finance OS continua a incrementar o saldo; a uniformização do respetivo movimento de caixa é uma revisão separada.

## Validação

Quatro grupos dirigidos aprovados em `field-qa-runtime/run-1789489938046`: alocação de crédito, rascunhos, repetição de pagamentos e recebimentos por cliente. Casos: doze faturas a partilhar 10,01 EUR; doze repetições na mesma fatura; saldos de 0,30/0,10/0,20 EUR; seis faturas criadas e creditadas dentro de transações; pagamentos Core/Finance OS/cliente simultâneos com crédito; chamadas concorrentes da API mensal; falhas forçadas nos movimentos, fatura, cliente e comunicação, com reversão e nova aplicação válida.

A bateria integrada passa a 49 grupos. O teste unitário aumenta a bateria para 323 testes em 58 ficheiros. Confirmar o workflow do commit publicado, incluindo PostgreSQL 16 e restauro. Não há alterações de esquema, emissão fiscal ou instalação no VPS.

Ficheiros (7): `src/services/clientCreditService.js`, `src/business/finance/FinanceOsBusiness.js`, `tests/client-credit-concurrency.test.js`, `scripts/test-field-credit-allocation.js`, `scripts/test-field-suite.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`.

A faturação mensal antiga em `billingController` contém um segundo desconto de crédito sem transação. A TASK145 deve ligá-lo ao serviço comum; esta tarefa não declara esse percurso corrigido.
