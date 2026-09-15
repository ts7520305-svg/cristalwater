# TASK168 — Métodos internos separados dos recebimentos

A reprodução `field-qa-runtime/run-1789506706289` confirmou que uma API de pagamento aceitava `method: CREDIT` como novo recebimento. Isso permitia alterar a dívida sem reduzir crédito existente e classificar a entrada de forma errada nos relatórios de caixa.

Os negócios de pagamento core, Finance OS e recebimento geral passam a recusar CREDIT, CREDIT_NOTE, ADJUSTMENT e CREDIT_ADJUSTMENT, incluindo variações de maiúsculas/espaços e chamadas sem UUID. Reparações e ativações reutilizam esses negócios. A lista de métodos internos é partilhada com os relatórios. Os percursos próprios de nota de crédito, ajuste e aplicação do saldo mantêm-se disponíveis, com as respetivas validações.

Validação `field-qa-runtime/run-1789506758326`: cinco APIs recusam métodos internos sem criar pagamentos nem alterar saldos; dinheiro real é aceite e normalizado. Repetição de pagamentos, nota de crédito e ajuste passaram. A sequência local PGlite perdeu a ligação após falhas SQL deliberadas; as regressões de reparação e ativação passaram em ambiente novo, `field-qa-runtime/run-1789506831648`, incluindo todas as falhas transacionais. Não foram reduzidas as asserções. 323 testes unitários, quatro de técnicos e sintaxe de 513 ficheiros backend aprovados. Runner com 72 grupos.

Nove ficheiros: serviço partilhado de pedidos, relatório de caixa, três negócios, teste, runner, relatório e checkpoint. Sem migração ou alteração retroativa de pagamentos antigos; estes continuam sujeitos a reconciliação quando a origem não é comprovável.
