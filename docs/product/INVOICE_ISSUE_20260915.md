# TASK159 — Emissão interna sem reabrir documentos retirados

A reprodução `field-qa-runtime/run-1789502766969` confirmou que emitir uma fatura CANCELLED devolvia 200 e mudava o seu estado para ISSUED.

A transição passa a bloquear e reler o documento dentro da transação. Documentos retirados não podem ser reabertos por emissão; documentos com pagamentos não passam por uma nova emissão. Repetir um documento já emitido conserva número, notas, data e estado, incluindo PAID. Alterar um número definido ou reutilizar o número de outro documento devolve conflito. A emissão interna tem auditoria obrigatória e o evento só é emitido após commit, uma vez, quando o negócio controla a transação.

Três grupos aprovados em `field-qa-runtime/run-1789502820028`: emissão interna, Finance OS operacional e Repair OS operacional. Cobertura de cinco estados retirados, oito emissões simultâneas, imutabilidade do número, faturas pagas, número duplicado, seis competições com cancelamento e reversão após falha de auditoria. Runner com 64 grupos.

Seis ficheiros: negócio, controlador, teste, runner, relatório e checkpoint. Mantém a transação fornecida pela faturação de reparações. A marca de emissão continua a ter o significado interno preexistente neste percurso; não transmite documentos nem prova emissão fiscal externa. O percurso de envio de documentos tem revisão separada.
