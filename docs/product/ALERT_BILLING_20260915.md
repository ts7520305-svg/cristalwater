# TASK135 — Preparação segura de rascunhos a partir de alertas

## Problema reproduzido

Em `field-qa-runtime/run-1789480413006`, dois POST idênticos de 12,34 EUR produziram duas linhas, total de 24,68 EUR e estado PENDING. A rota anterior acrescentava linhas à fatura do mês sem transação e voltava a definir o estado PENDING, incluindo quando o documento já estava emitido ou pago. O ecrã não conservava o pedido após uma resposta perdida.

## Comportamento entregue

- A conversão cria um rascunho separado por alerta através do Finance OS existente. `monthRef: null` conserva a disponibilidade da mensalidade; `month`/`year` mantêm o período de preparação. Não emite documentos nem acrescenta valores a documentos existentes.
- Valores positivos com até duas casas decimais são tratados como cêntimos inteiros, incluindo entrada com vírgula. Valores coercivos, frações de cêntimo, valores contraditórios e excedentes do inteiro de 32 bits são recusados.
- O alerta e a notificação explicitamente ligada por `metadata.alertId` partilham a identidade. O bloqueio transacional, a linha, os totais e o comprovativo `alert-billing:<origem>-<id>` impedem duplicação por concorrência ou repetição. A referência numérica antiga continua a identificar uma notificação.
- O comprovativo conserva o relato original, ator, cliente, montante, documento, linha e momento. A repetição devolve a preparação original, mesmo depois de apagado o alerta ou emitido/pago o documento. Um montante ou cliente diferente dá conflito e identifica o documento original. A preparação não resolve o alerta.
- Os novos alertas manuais e respetivas notificações são criados juntos, com associação explícita. Notificações manuais antigas sem associação exigem usar o alerta técnico original; não se infere identidade pelo texto.
- Uma associação explícita a reparação exige o fluxo próprio da reparação. Linhas antigas ALERT sem marcador de origem exigem revisão quando o ID numérico e cliente podem corresponder ao alerta.
- O ecrã passa a mostrar “Preparar rascunho”, com confirmação literal de cliente, piscina, relato e valor. Conserva um pedido imutável por conta antes do envio e coordena janelas com Web Locks. A resposta é validada por referência, cliente, cêntimos, documento, linha e momento.
- A opção “Repetir confirmação” recupera o resultado após perda de resposta, resposta inválida, recarregamento ou desaparecimento do alerta. Rejeições definitivas persistem e exigem “Rever alerta”. Falha de armazenamento ou dados corrompidos não enviam novos pedidos. Uma mudança de sessão esconde os dados anteriores e conserva o pedido sob a conta original.

## Verificação

Ensaio dirigido final: `field-qa-runtime/run-1789481333543/suite-results.json`, quatro grupos aprovados: faturação, resolução, visibilidade dos alertas e preços por período.

O novo grupo verifica oito pedidos simultâneos e aliases, valores alterados, comprovativo original, alertas manuais, documentos pagos/emitidos intactos, mensalidade depois do extra, autorização, versão/cliente, reparações, linhas antigas e rollback perante falha injetada no comprovativo. Chromium verifica cancelamento, texto literal, clique repetido, resposta realmente gravada e perdida, reload, origem apagada, confirmação trocada, rejeição persistida, quota/corrupção, duas janelas e mudança de sessão antes/depois do envio.

Os testes unitários passam a 322 em 57 ficheiros. O grupo de técnicos mantém quatro testes. Passaram também os 17 scripts de navegador e a sintaxe de 496 ficheiros backend, do ecrã e do novo script. A bateria integrada inclui agora 41 grupos; confirmar o workflow do commit publicado, incluindo PostgreSQL 16, migrações aditivas e restauro. O ensaio local usa PGlite por TCP e não constitui validação de desempenho do VPS.

## Limites

Cada identidade de alerta admite uma preparação original; alterações posteriores são tratadas no documento existente. O estado DRAFT do comprovativo descreve o momento de preparação, e a mensagem de repetição manda consultar o estado atual. Não se deduplicam incidentes sem associação explícita entre registos distintos, nem se reconstroem automaticamente relações antigas. Reparações criadas separadamente e ligadas apenas por notas continuam a exigir revisão humana do contexto. O novo percurso foi verificado em português; não se afirma tradução integral dos novos textos. Não houve emissão fiscal, envio externo, instalação no VPS ou merge na branch principal.

## Ficheiros da tarefa (10)

1. `src/business/admin/AlertBillingBusiness.js`
2. `src/business/admin/AlertResolutionBusiness.js` — reutilização do bloqueio de origem.
3. `src/business/finance/FinanceOsBusiness.js` — suporte a rascunho avulso.
4. `src/routes/alertRoutes.js`
5. `frontend/admin-alerts.js`
6. `tests/alert-billing.test.js`
7. `scripts/test-field-alert-billing.js`
8. `scripts/test-field-suite.js`
9. `docs/product/ALERT_BILLING_20260915.md`
10. `docs/product/CURRENT_WORK_CHECKPOINT.md`
