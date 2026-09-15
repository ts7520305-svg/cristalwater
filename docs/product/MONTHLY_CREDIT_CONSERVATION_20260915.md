# Crédito na faturação mensal antiga — TASK145

O endpoint `/api/billing/generate-monthly` tinha um segundo desconto de crédito, fora de transação e sem movimento de pagamento. A reprodução em `field-qa-runtime/run-1789490171902` encontrou uma mensalidade de 20 EUR reduzida para total 10 EUR, com zero pago e nenhum pagamento, depois de consumir 10 EUR de crédito.

A geração passou para `MonthlyBillingBusiness`. Cada cliente/mês é processado numa transação que cria as linhas, atualiza os totais e aplica o crédito através do serviço comum da TASK144. O valor do serviço permanece nas linhas e nos campos de total; o crédito é um pagamento `CREDIT` com valor em cêntimos e registo de comunicação. Uma falha reverte também a fatura e as linhas acabadas de criar.

A chave cliente/mês impede duplicação de geração; o bloqueio de distribuição é partilhado com os recebimentos por cliente e é adquirido antes das faturas. Dessa forma, um recebimento concorrente vê a mensalidade completa ou é concluído antes da sua criação. Faturas emitidas, com número externo, pagas, parciais, em rascunho ou retiradas não são reescritas para acrescentar mensalidades. Linhas mensais ou de crédito antigas são conservadas, sem migração retroativa.

A resposta mantém `ok`, `totalAdded`, `processed` e `skipped`. `processed` conta mensalidades efetivamente geradas, incluindo as totalmente liquidadas com crédito; `totalAdded` indica o valor mensal novo ainda por pagar. Os preços por piscina configurados neste endpoint são mantidos. A harmonização destes preços com o plano do cliente usado nos percursos atuais de faturas fica numa revisão própria, sem alterar silenciosamente as bases de preço nesta correção.

## Validação

O ensaio inicial corrigido em `field-qa-runtime/run-1789490339202` passou faturação mensal, aplicação de crédito e recebimentos gerais. Inclui duas linhas que somam 20 EUR com 10 EUR pagos por crédito; oito gerações do mesmo mês; seis meses que partilham 25 EUR; preservação de documentos e crédito histórico; cliente sem faturação ativa; recebimento concorrente; falha no registo da comunicação e repetição posterior; meses inválidos. A revisão final do bloqueio partilhado, a aplicação de crédito e a regressão Finance OS passaram em `field-qa-runtime/run-1789490451144`. 323 testes unitários em 58 ficheiros e quatro testes de técnicos aprovados. A TASK144 passou no workflow `34995940941`, commit `7c1298a1afe202e7e8e0c2197dcbffaec78286ad`, com 49 grupos em PostgreSQL 16 e restauro de 99 tabelas/11 anexos.

A bateria integrada passa a 50 grupos. Confirmar o workflow do commit final com PostgreSQL 16 e restauro. A unidade de atomicidade é o cliente/mês; uma falha num cliente não desfaz os anteriores do lote, e repetir o lote conserva as mensalidades já concluídas.

Ficheiros (6): `src/business/finance/MonthlyBillingBusiness.js`, `src/controllers/billingController.js`, `scripts/test-field-monthly-credit.js`, `scripts/test-field-suite.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`.

A adição manual de crédito do endpoint antigo e a uniformização do registo de caixa dos excedentes Finance OS permanecem a rever. Sem migração, emissão fiscal, merge para a branch principal ou instalação no VPS.
