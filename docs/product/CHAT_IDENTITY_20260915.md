# TASK165 — Identidade e acesso nas conversas antigas e atuais

A reprodução `field-qa-runtime/run-1789505399380` confirmou leitura anónima no alias `/api/client-chat`. Ambos os aliases JSON passam a autenticar a sessão e restringir cada conversa ao cliente titular, administração ou chefia autorizada. A contagem administrativa de mensagens por ler não é acessível a clientes.

O remetente e a confirmação de leitura são derivados da sessão; os campos `from`, `sender` e `role` enviados pelo cliente não permitem representar a administração. O POST do chat moderno aplica também esta regra e deixa de imprimir o conteúdo privado das mensagens no log.

O negócio legado conserva os formatos de resposta e o histórico JSON existente, usa identificadores UUID para novas mensagens e substituição atómica do ficheiro. Erros de leitura ou conteúdo corrompido devolvem falha sem apagar o histórico. Isto não transforma o armazenamento legado num serviço distribuído: vários processos a escrever no mesmo ficheiro continuam a exigir migração coordenada para a base de dados.

Ensaio `field-qa-runtime/run-1789505523377` aprovado: dois aliases, visitantes, outro cliente, técnico, permissões de leitura/escrita, tentativa de falsificar origem ou leitura administrativa, IDs inválidos e preservação de conteúdo corrompido. O ficheiro de teste é restaurado exatamente no final. Inclui regressões da publicação de faturas e da matriz de acessos. Testes unitários/técnicos/sintaxe executados antes do commit. Runner com 70 grupos.

Sete ficheiros: negócio, router legado, controlador moderno, teste, runner, relatório e checkpoint. Sem migração nem alteração ao histórico de produção.
