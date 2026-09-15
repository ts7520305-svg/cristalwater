# TASK160 — Preparação de documentos com estado de entrega verdadeiro

A reprodução `field-qa-runtime/run-1789502996629` confirmou que o endpoint de envio Finance OS aceitava um rascunho e o convertia implicitamente em ISSUED. A leitura do negócio mostrou também que anunciava envio por email sem contactar qualquer fornecedor.

Este percurso prepara o documento e devolve `prepared: true`, `deliveryStatus: NOT_SENT` e uma mensagem explícita de entrega por concluir. Não altera o estado da fatura. Rascunhos e documentos retirados são recusados. A preparação é guardada uma vez por fatura/canal, na mesma transação da comunicação, auditoria e notificação administrativa. Usa um evento próprio de preparação e deixa de emitir o evento de entrega. Não cria uma tarefa automática de envio nem confirma receção pelo cliente.

Ensaio final aprovado em `field-qa-runtime/run-1789503119295`: preparação, Finance OS operacional e emissão interna. Inclui oito pedidos simultâneos, ausência de falsas notificações de envio, estado pago preservado, cancelamento posterior, canal inválido e reversão após falha de auditoria. O ensaio anterior foi interrompido pelo reinício do ambiente e não é apresentado como concluído. Runner com 65 grupos.

Sete ficheiros: negócio, controlador, catálogo de eventos, teste, runner, relatório e checkpoint. Sem migração. Esta correção não implementa entrega externa nem certifica o percurso separado `/api/invoices/send-full/:invoiceId`; esses percursos requerem revisão e evidência próprias.
