# TASK155 — Cancelamento sem perder pagamentos concorrentes

Reprodução em `field-qa-runtime/run-1789501504494`: um recebimento real de 10 EUR foi confirmado imediatamente antes de começar a transação de cancelamento; a leitura antiga autorizou o cancelamento e deixou a fatura paga no estado CANCELLED.

A decisão passa a ocorrer depois do bloqueio da fatura, dentro da transação. Tanto o saldo pago como qualquer movimento positivo no histórico impedem o cancelamento. Repetições de um cancelamento já concluído devolvem o documento sem repetir auditoria, notificações, comunicação ou evento. IDs e motivos malformados são recusados. Auditoria, notificação interna e comunicação são obrigatórias na transação; a falha de qualquer uma reverte a alteração. O controlador trata exceções sem terminar o processo.

Em `field-qa-runtime/run-1789501568906`, passaram o novo grupo, Finance OS operacional e repetição de pagamentos. O novo grupo cobre a janela reproduzida, oito cancelamentos simultâneos, oito competições com pagamentos, histórico legado com amountPaid desatualizado, IDs inválidos e falhas forçadas em três tabelas, seguidas de repetição bem-sucedida. O runner passa a 60 grupos.

Seis ficheiros: negócio, controlador, teste, runner, relatório e checkpoint. Sem migração nem alteração retroativa de documentos. A emissão interna e notas de crédito têm percursos distintos e não ficam certificadas por este teste.
