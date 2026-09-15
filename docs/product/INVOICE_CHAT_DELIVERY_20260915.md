# TASK164 — Documento disponível na conversa realmente usada pelo cliente

A reprodução `field-qa-runtime/run-1789505133988` confirmou que `/api/invoices/send-full/:id?mode=chat` anunciava sucesso mas a conversa do cliente continuava sem mensagens. O controlador escrevia em ChatMessage, enquanto o chat/portal consultam ClientMessage; guardava também o caminho local de um PDF ainda em escrita.

O negócio passa a disponibilizar o documento em ClientMessage com um link autenticado, sem ficheiro temporário. Mensagem, notificação ao cliente, comunicação, autor real, auditoria e comprovativo são gravados na mesma transação. O bloqueio da fatura e o comprovativo por documento impedem duplicação nas repetições. Rascunhos, documentos retirados e clientes inativos são recusados. A resposta distingue disponibilidade no portal de receção/leitura pelo cliente.

O chat administrativo e o portal apresentam o link de documento com endereço estritamente interno. O ecrã de documentos por emitir usa também a página autenticada. Não são criados links públicos com credenciais.

Ensaio `field-qa-runtime/run-1789505209296` aprovado: documento visível na API e nos dois ecrãs reais, oito repetições, um só aviso/comprovativo, autor diferente do utilizador 1, titularidade, rascunhos/retirados e reversão de toda a publicação após falha de auditoria. Inclui regressão do link/login. Testes unitários/técnicos/sintaxe executados antes do commit; runner com 69 grupos.

Nove ficheiros: negócio, controlador, três scripts de interface, teste, runner, relatório e checkpoint. Sem migração, mensagem externa ou confirmação de leitura. Os modos browser/API e emissores separados ainda requerem revisão; esta tarefa certifica apenas a disponibilização interna.
