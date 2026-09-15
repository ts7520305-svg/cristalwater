# TASK161 — Acesso autenticado aos documentos financeiros

A reprodução `field-qa-runtime/run-1789503347862` confirmou resposta 200 com o PDF de uma fatura sem sessão. O router passa a exigir autenticação ativa. A consulta no negócio limita os documentos à administração ou ao cliente titular; técnicos, outros clientes e contas inativas não acedem. Rascunhos e documentos retirados não são disponibilizados ao cliente. A mesma regra de titularidade protege os extras por piscina.

Os PDFs usam `Cache-Control: private, no-store`. O botão da faturação obtém o documento com autorização e abre um URL de blob, sem colocar o token no endereço. O auxiliar comum rejeita mudanças de sessão durante a resposta ou leitura do corpo. O nome de ficheiro dos extras usa o identificador numérico, sem interpolar o nome do cliente num cabeçalho HTTP.

Ensaio API/base/Chromium aprovado em `field-qa-runtime/run-1789504441014`, incluindo a regressão da visibilidade dos rascunhos: visitante, titular, outro cliente, técnico, conta inativa, estados retirados, IDs inválidos, PDF normal/extras, abertura na página real e mudança de sessão em duas fases. Testes unitários, técnicos e sintaxe executados antes do commit. Runner com 66 grupos.

Dez ficheiros: negócio, controlador, router, auxiliar de abertura, página/script de faturação, teste, runner, relatório e checkpoint. Sem migração. Os links copiados e os percursos de envio existentes precisam de uma página que abra estes documentos com a sessão do destinatário; essa compatibilidade é tratada na tarefa seguinte. Não criar novamente um URL público para contornar a autenticação.
