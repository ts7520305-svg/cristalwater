# Registo integral dos excedentes — TASK146

A reprodução em `field-qa-runtime/run-1789492009477` confirmou que receber 25 EUR para uma fatura de 20 EUR pelo Finance OS só criava 20 EUR no histórico de pagamentos. O excedente incrementava o crédito sem movimento correspondente.

O Finance OS reutiliza agora o registo transacional de adiantamentos: a parcela aplicada fica na fatura original e o excedente num documento interno de valor zero, com linha CREDIT_DEPOSIT e pagamento pelo método recebido. O documento não acrescenta faturação nem dívida. A confirmação original conserva o ID do pagamento de crédito; repetições não criam novos movimentos. Não se tenta reconstruir movimentos históricos incompletos nesta tarefa.

As referências dos depósitos usam UUID em vez do relógio, evitando colisões entre operações distintas no mesmo instante. O serviço também protege chamadas diretas com transação e mantém o cliente como parcialmente pago se existirem outras faturas em aberto. Falhar ao criar o depósito reverte o pagamento da fatura, o crédito e o comprovativo.

Ensaio dirigido: `field-qa-runtime/run-1789492185342`, com histórico integral, oito repetições simultâneas, consulta dos dois históricos administrativos, depósitos no mesmo instante e falha forçada seguida de repetição. Inclui regressão de pagamentos, aplicação de crédito e recebimentos por cliente. A bateria passa a 51 grupos; confirmar o workflow publicado com PostgreSQL 16 e restauro.

Ficheiros (6): `FinanceOsBusiness.js`, `clientCreditService.js`, `test-field-surplus-ledger.js`, `test-field-suite.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`. Sem migração, emissão fiscal, instalação no VPS ou merge para a branch principal. Ajustes manuais de crédito não são automaticamente tratados como dinheiro recebido; seguem numa tarefa própria.
