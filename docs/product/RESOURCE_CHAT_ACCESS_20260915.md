# TASK171 — Titularidade dos chats por recurso

A reprodução `field-qa-runtime/run-1789507871374` confirmou `GET /api/poolChat/:poolId` com 200 sem sessão. Os dois aliases por piscina e os dois por serviço também aceitavam o remetente indicado no corpo do pedido.

Os routers exigem agora sessão ativa ADMIN/TECHNICIAN/TEAM_LEADER. Os controllers delegam em `ResourceChatBusiness`. ADMIN pode consultar os recursos; técnicos e chefes de equipa precisam de atribuição própria, piscina e cliente ativos. Para a conversa da piscina é necessária uma visita ou serviço aberto atribuído. O histórico de um serviço específico permanece acessível ao técnico que continua atribuído, mas mensagens novas do técnico exigem serviço aberto. Reatribuição revoga o acesso anterior; recurso alheio devolve 404. CLIENT recebe 403.

O remetente é derivado da sessão; texto estrito entre 1 e 4000 caracteres, IDs positivos Int32, resposta `private, no-store`. A resposta de campo reutiliza os sanitizadores existentes para retirar contactos privados, valores financeiros e credenciais. Credenciais também não saem na resposta administrativa. Mensagem e auditoria do autor real são gravadas na mesma transação. Na escrita, a atribuição concedente é bloqueada e relida antes de criar a mensagem.

Validação: três grupos aprovados em `field-qa-runtime/run-1789507968865` (chats por recurso, identidade do chat CLIENT, administração antiga). Inclui aliases, anónimo, cliente, técnico alheio, chefe alheio/atribuído, perfil inativo, falsificação de remetente, dados privados, reatribuição, serviço fechado, mensagem inválida e auditoria. 323 testes unitários e quatro de técnicos aprovados; sintaxe validada.

Nove ficheiros: business comum, dois controllers, dois routers, teste integrado, runner, relatório e checkpoint. Sem alteração de schema. O antigo helper PoolChatBusiness deixa de ser chamado pelas rotas, preservando os consumidores internos antigos enquanto se revê a sua utilização.

Limites: mensagens não têm chave idempotente, nem esta tarefa migra conversas antigas para o chat CLIENT. Não inclui chat interno, perfil antigo do cliente ou otimização de rota; esses acessos continuam no próximo trabalho. Não é aceitação em campo nem conclusão global.
