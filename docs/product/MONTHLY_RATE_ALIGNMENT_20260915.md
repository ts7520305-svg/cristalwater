# TASK148 — Plano do cliente na faturação mensal antiga

## Divergência reproduzida

`POST /api/billing/generate-monthly` ainda calculava apenas as mensalidades das piscinas, ignorando `ClientRatePlan`. O ensaio `field-qa-runtime/run-1789494281889` confirmou total 20 EUR para duas piscinas de 12,30 + 7,70 EUR, apesar de o cliente ter um plano explícito de 120 EUR. O valor legado do cliente era 80 EUR; nenhum destes valores antigos deve ser somado ao plano, que já representa o contrato completo.

## Correção

`MonthlyBillingBusiness` reutiliza a consulta de versões e o cálculo de `ClientRateBusiness`, conforme o contrato definido nas TASK92/TASK93. Quando existe plano, cria uma linha mensal com o total do contrato: preço base/períodos, datas finais inclusivas, proporcionalidade pelos dias de calendário e arredondamento final ao cêntimo. Um mês gratuito não cria cobrança nem consome crédito. O plano funciona mesmo sem piscinas ou preços antigos positivos.

Sem plano explícito, este endpoint conserva a soma dos preços das piscinas e as linhas individuais existentes. Esta tarefa não uniformiza silenciosamente os diferentes valores de recurso dos outros geradores; a sua compatibilidade continua preservada. A alteração do preço é feita no editor de planos já existente, não por migração de contratos.

Dentro da transação, o negócio mantém a ordem de bloqueios: pedido cliente/mês, distribuição de recebimentos, eventual fatura, cliente. O bloqueio `FOR NO KEY UPDATE` do cliente serializa a leitura do plano com a gravação de versões, sem bloquear desnecessariamente as verificações de chaves estrangeiras. Se outro gerador que bloqueia o cliente tiver acabado de criar uma fatura, a existência é verificada novamente e o documento é preservado.

Com plano, nenhuma fatura existente é recalculada ou recebe nova mensalidade através deste endpoint, mesmo que seja um documento PENDING de serviços avulsos ainda não pago. Continuam as proteções anteriores de faturas mensais, crédito histórico, documentos emitidos, pagos, parciais, em rascunho ou retirados. Corrigir esses documentos exige o percurso financeiro explícito; gerar novamente não é uma correção de preço.

O registo `UserAuditLog/MONTHLY_RATE_APPLIED`, ligado à fatura, conserva cliente, mês, identidade/versão do plano e cálculo com os segmentos de dias. O ator `monthly-billing` identifica o negócio gerador, não uma pessoa. Fatura, linhas, aplicação do crédito e auditoria pertencem à mesma transação. Falhar a auditoria também desfaz a cobrança e o consumo de crédito. Uma repetição não acrescenta auditoria ou mensalidade.

## Evidência

- Primeiro ensaio corrigido: `field-qa-runtime/run-1789494343806`, cinco grupos aprovados.
- Revisão final: `field-qa-runtime/run-1789494413762/suite-results.json`, seis grupos aprovados: novos preços mensais, mensalidades com crédito, planos nos outros percursos, conservação de crédito, recebimentos e ajustes internos com Chromium.
- Casos novos: API real com 120 EUR/15 EUR de crédito; nova versão só afeta novos documentos; mês gratuito; plano sem preço antigo; fevereiro bissexto de 100,69 EUR; retorno ao preço base; compatibilidade sem plano; documentos existentes; oito pedidos simultâneos; gravação concorrente do plano; outro gerador de fatura; rollback da auditoria.
- `npm test`: 323 testes em 58 ficheiros; `npm run test:technician`: quatro testes; sintaxe dos 500 ficheiros backend e dos scripts alterados aprovada.
- O runner passa de 52 para 53 grupos. Confirmar o workflow da árvore publicada, incluindo PostgreSQL 16 e restauro de tabelas/anexos. Os ensaios locais usam PGlite descartável, não demonstram desempenho do VPS.

Ficheiros desta tarefa: `MonthlyBillingBusiness.js`, `test-field-monthly-rates.js`, `test-field-suite.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`.

## Limites e continuação

Não se alteraram planos, faturas ou preços reais, o esquema Prisma, a emissão fiscal, a branch principal ou o VPS. O lote continua atómico por cliente/mês, não por todos os clientes. Geradores antigos que não partilham o bloqueio do cliente e os caminhos de regeneração/ativação de contrato/notas de crédito continuam sujeitos a revisão própria; não declarar todo o módulo financeiro concluído.
