# TASK156 — Nota de crédito interna com conservação de saldo

A reprodução `field-qa-runtime/run-1789501736334` confirmou que uma nota de 20 EUR sobre uma fatura paga não acrescentava crédito ao cliente: os 5 EUR anteriores continuavam em 5 EUR, em vez de 25 EUR.

O percurso passa por um negócio próprio, com identificador UUID obrigatório e motivo. A confirmação fica na transação da nota. Repetir o mesmo pedido devolve o resultado original; alterar dados, responsável ou finalidade da chave é recusado. O chamador operacional incluído no repositório foi atualizado para enviar UUID. Integrações externas deste endpoint têm de enviar o identificador e conservar o mesmo valor ao repetir.

Bloqueios de fatura e cliente coordenam notas, pagamentos e cancelamentos. A nota não pode exceder o total restante nem ajustar documentos em rascunho/retirados. Reduz primeiro a dívida; apenas a parcela já paga se torna crédito disponível. Pagamentos originais são preservados, sem novo movimento de dinheiro. Notas sucessivas libertam só o novo excedente. Documentos antigos sem linhas recebem uma linha explícita de saldo original; divergências entre linhas/total ou pagamentos/saldo exigem revisão antes de ajustar.

Linha, valores da fatura, crédito, auditoria, comunicação, notificação interna e confirmação são atómicos. O evento existente ocorre após commit e não se repete ao recuperar uma confirmação.

Três grupos aprovados em `field-qa-runtime/run-1789501855427`: nota de crédito, Finance OS operacional e cancelamentos. Inclui oito chamadas simultâneas, limite concorrente do total, competição com recebimento, parcelas pagas/parciais, repetições, dados inválidos e reversão após falha de auditoria. Runner com 61 grupos. Nove ficheiros; sem migração. É um ajuste interno, sem emissão ou transmissão fiscal. Históricos antigos incoerentes não são corrigidos por inferência.
