# TASK166 — Envios autenticados com resultado recuperável

A reprodução `field-qa-runtime/run-1789506216496` confirmou que `/api/email/invoice` chegava ao bloqueio QA sem autenticação; as rotas email/WhatsApp passam a exigir administração ativa antes de qualquer consulta ou transporte.

O envio completo e o email delegam num negócio comum. Validam o documento, o estado e o cliente; usam o link autenticado da TASK162. Retiram a geração de ficheiro temporário e a frase que anunciava um anexo inexistente. O email só utiliza um endereço registado na ficha, com verificação do certificado TLS. O modo browser prepara uma ligação e declara NOT_SENT.

Para email/API, o comprovativo da tentativa fica na base antes de contactar o fornecedor. Repetições por documento/canal não voltam a enviar. O resultado distingue PROVIDER_ACCEPTED, REJECTED, UNKNOWN e PENDING_CONFIRMATION; aceitação pelo fornecedor não confirma entrega/leitura. Falha ou perda da resposta, ou falha ao guardar o resultado após aceitação, exigem conciliação antes de qualquer novo envio. Uma interrupção antes do contacto também pode deixar uma tentativa por confirmar: a prioridade é não duplicar mensagens automaticamente. Não há reenvio manual nem conciliação automática adicionados nesta tarefa.

Ensaio `field-qa-runtime/run-1789506413208` aprovado, com regressões do chat e PDF. Abrange permissões, bloqueio QA, rascunhos/retirados, link preparado, oito chamadas simultâneas, resposta perdida, destinatário diferente e falha de escrita após aceitação. Os fornecedores foram substituídos por funções locais nos testes de transporte; nenhuma mensagem saiu para email/WhatsApp. Testes unitários/técnicos/sintaxe executados antes do commit. Runner com 71 grupos.

Dez ficheiros: negócio de envio/acesso, dois controladores, dois routers, teste, runner, relatório e checkpoint. Sem migração. Os contratos, credenciais, entrega real e conciliação com fornecedores continuam pendentes de validação. Não declara faturação fiscal nem recebimento bancário.
