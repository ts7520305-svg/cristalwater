# Recebimentos gerais por cliente — TASK142

O percurso `POST /api/admin/payments/:clientId/manual-received` aceitava o mesmo recebimento duas vezes. A reprodução inicial em `field-qa-runtime/run-1789487863968` criou dois pagamentos de 10 EUR e deixou 20 EUR pagos para o mesmo identificador. A atualização do estado do cliente ocorria depois do commit financeiro; uma falha nesse passo podia devolver erro depois de cobrar.

O recebimento passa pelo negócio `ClientReceiptBusiness`, usando o mesmo serviço de comprovativos das quatro APIs de faturas. O `requestId` identifica de forma global o responsável, cliente, mês, valor em cêntimos, método e nota. Repetições exatas devolvem a confirmação original, mesmo após novos pagamentos; dados ou responsável diferentes dão 409. O mesmo identificador não pode servir para um recebimento por cliente e outro por fatura.

O bloqueio por cliente serializa a distribuição; as linhas de faturas são bloqueadas por ID antes de alterações financeiras. A distribuição segue vencimento, criação e ID, apenas nas faturas cobraveis, com cálculo em cêntimos. Pagamentos, faturas, excedente em crédito, estado do cliente, registo de comunicação e comprovativo são gravados na mesma transação. O crédito já existente não é abatido implicitamente uma segunda vez.

A lista de cobranças apresenta o saldo real de todas as faturas cobraveis do cliente. Um pagamento parcial mantém a dívida visível; mensalidades configuradas, rascunhos e documentos retirados não inventam dívida. O mês continua a selecionar a informação de reparações/visitas e avisos; não limita as faturas que recebem o pagamento. O crédito disponível é apresentado separadamente, até ser aplicado por um percurso próprio.

A antiga ação `mark-paid`, sem valor ou comprovativo, devolve 409 e pede o registo do recebimento. Deixa de alterar clientes, reparações e relatórios como pagos sem movimentos financeiros. As integrações sem `requestId` continuam a registar recebimentos, mas não têm garantia contra repetição; a interface recebe essa proteção na TASK143.

## Validação

Ensaio dirigido aprovado em `field-qa-runtime/run-1789488384427`: recebimentos gerais, repetição das quatro APIs de faturas e proteção de rascunhos. O teste novo cobre confirmação original, alterações de dados/cliente/mês/responsável, oito repetições simultâneas com excedente, doze recebimentos distintos misturando as APIs de cliente/fatura, distribuição fracionária por vencimento, crédito anterior, pagamento parcial visível, adiantamentos e valores inválidos. Falhas forçadas na atualização do cliente, comunicação e comprovativo revertem todos os efeitos; o pedido original pode depois concluir uma vez. A perda de saldo concorrente foi identificada na revisão; a reprodução determinística inicial confirmou a duplicação, não a perda de saldo.

A bateria integrada passa de 46 para 47 grupos. A aprovação de PostgreSQL 16 e restauro deve ser confirmada no commit final publicado. Não há migração de esquema, emissão fiscal, instalação no VPS ou alteração da branch principal.

Ficheiros (7): `src/business/finance/ClientReceiptBusiness.js`, `src/controllers/adminPaymentController.js`, `src/services/invoicePaymentRequestService.js`, `scripts/test-field-client-receipts.js`, `scripts/test-field-suite.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`.
