# TASK136 — Rascunhos não recebem pagamentos

## Falha e correção

Reprodução em `field-qa-runtime/run-1789482654961`: os endpoints de pagamentos manual, core e Finance OS aceitaram 10 EUR sobre documentos DRAFT de 20 EUR, criaram pagamentos e passaram o estado a PARTIAL. A revisão encontrou o mesmo cálculo no fluxo operacional.

O serviço de crédito centraliza agora os estados que não representam valores a cobrar: DRAFT/RASCUNHO, cancelados, VOID, ARCHIVED e SUPERSEDED. O cálculo de saldo aberto devolve zero para esses documentos e a aplicação de crédito não os altera. O valor original preparado continua guardado.

Os pagamentos manual e operacional reutilizam o `CoreInvoicePaymentBusiness`, incluindo o bloqueio da fatura antes de consultar estado/saldo. O core e Finance OS recusam esses estados com HTTP 409 antes de criar pagamentos, crédito ou notificações. Finance OS também bloqueia a linha antes da consulta. A aplicação de crédito passa a executar a consulta e alteração da fatura numa transação, conservando a transação do chamador quando já existe.

Os saldos de cliente/empresa, a conta corrente e o relatório de dívida do Finance OS deixam de tratar os rascunhos e documentos retirados como dívida ou valor faturado. O histórico conserva os documentos e pagamentos reais; rascunhos não geram movimentos de débito nem data de emissão presumida. Um adiantamento recebido para um cliente continua a poder gerar crédito, sem o aplicar ao rascunho.

## Verificação

O teste `scripts/test-field-draft-payments.js` verifica os quatro endpoints, todos os estados protegidos, excesso de pagamento recusado sem criar crédito, conservação integral das faturas, ausência de notificações, crédito automático, saldos/conta/dívida e permissões. Oito pagamentos concorrentes nos quatro endpoints conservam os oito movimentos e o saldo correto. A emissão explícita permite depois o pagamento; faturas PENDING existentes continuam a aceitar crédito.

Ensaios dirigidos: `field-qa-runtime/run-1789482907566`, incluindo a regressão Finance OS, faturação de alertas e preços por período. Passaram a sintaxe de 496 ficheiros backend, 322 testes unitários em 57 ficheiros e quatro testes de técnicos. A bateria integrada passa a incluir 42 grupos. Confirmar o workflow publicado com PostgreSQL 16 e restauro.

## Limites e continuação

Esta tarefa protege a elegibilidade dos documentos; não implementa identificadores de pedido para todos os pagamentos nem uma reconciliação bancária. A receção geral por cliente mantém o seu fluxo existente. Indicadores e ecrãs que calculam saldos com fórmulas próprias precisam de revisão individual. A classificação no ecrã de faturas e o estado apresentado na receção por cliente são a continuação da TASK137. Não houve emissão fiscal em produção, envio externo, instalação no VPS ou merge.

## Ficheiros (10)

- `src/services/clientCreditService.js`
- `src/business/finance/CoreInvoicePaymentBusiness.js`
- `src/business/finance/FinanceOsBusiness.js`
- `src/routes/paymentRoutes.js`
- `src/routes/coreFlowRoutes.js`
- `src/routes/operationalFlowRoutes.js`
- `scripts/test-field-draft-payments.js`
- `scripts/test-field-suite.js`
- `docs/product/DRAFT_PAYMENT_GUARD_20260915.md`
- `docs/product/CURRENT_WORK_CHECKPOINT.md`
