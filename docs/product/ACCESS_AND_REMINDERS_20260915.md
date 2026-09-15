# TASK172–175 — Acessos privados e resultados dos lembretes

## TASK172 — Perfil antigo do cliente e chat interno

A reprodução `field-qa-runtime/run-1789508451828` devolveu 200 sem sessão tanto no perfil antigo como no histórico do chat interno. O perfil exige agora ADMIN ou o próprio CLIENT ativo, ID Int32 positivo e resposta `private, no-store`, conservando apenas os cinco campos do contrato anterior.

O chat interno exige ADMIN/TECHNICIAN/TEAM_LEADER ativos. Autor, tipo de principal, ID e ligação ao técnico são derivados da sessão; o corpo não pode escolher a identidade. Mensagens vazias, não textuais ou superiores a 4.000 caracteres são recusadas. IDs novos usam UUID. O histórico JSON é preservado; leitura inválida falha sem o substituir por uma lista vazia. A substituição por ficheiro temporário impede gravar um JSON parcial.

O teste cobre perfil alheio, roles, conta desativada, USER ligado a técnico, identidade falsificada, IDs inválidos, corrupção do histórico, 12 escritas concorrentes e manutenção das mensagens antigas. A garantia de concorrência do JSON limita-se a um processo; não é armazenamento partilhado seguro entre réplicas nem idempotência de reenvio de mensagens.

## TASK173 — Privacidade da otimização de rota

A mesma reprodução confirmou que o TEAM_LEADER recebia visitas do outro técnico. ADMIN conserva a visão global; TECHNICIAN e TEAM_LEADER recebem apenas visitas atribuídas à sua identidade de campo. O sanitizador existente retira contactos e valores financeiros desses dois perfis. Password/PIN do cliente também são retirados da resposta administrativa.

Coordenadas de partida têm de ser strings não vazias com números finitos nos limites geográficos; listas/objetos são recusados. A ordenação continua por proximidade, com visitas sem coordenadas válidas no fim. Desempates têm ordem estável por ID. A resposta não fica em cache partilhada. Testes verificam ordem, dados privados, reatribuição, conta desativada e inputs malformados. O teste unitário existente foi atualizado para representar uma query HTTP textual e uma sessão ADMIN realista; a asserção da ordem não mudou.

## TASK174 — Lembrete manual de fatura

A reprodução `run-1789508741829` confirmou sucesso (`{ok:true}`) sem qualquer contacto de destino. O controller antigo também ignorava os estados HTTP dos dois pedidos internos, um deles para uma rota inexistente. O novo negócio chama diretamente o envio autenticado existente e exige UUID `requestId`.

O documento tem de ser cobravel, com dívida, cliente ativo e lembretes não desativados/em pausa. Os contactos e canais vêm da ficha; dados de destino enviados no corpo não se sobrepõem à ficha. A preparação de cada canal volta a validar a elegibilidade dentro do bloqueio da fatura. Os comprovativos usam `invoice-reminder:<invoiceId>:<requestId>:<channel>`, separados do primeiro envio do documento e vinculados ao administrador. Repetir o mesmo pedido não volta a enviar um canal já tentado. Um novo UUID representa uma nova tentativa deliberada.

A resposta contém resultados separados de email e WhatsApp. Email distingue aceitação pelo fornecedor, rejeição, resultado desconhecido e falha de preparação. WhatsApp devolve ligação para envio manual, com `NOT_SENT`. O resumo distingue `PREPARED`, `PARTIAL`, `PROVIDER_ACCEPTED`, `REVIEW_REQUIRED` e `NOT_SENT`; `delivered` permanece false. Não atualiza uma fatura nem anuncia entrega ao cliente. Mantém os gates externos e não usa HTTP de retorno à própria aplicação.

Testes com fornecedores exclusivamente simulados verificam repetições, resposta perdida, rejeição, configuração ausente, contactos alternativos registados, canais desativados, documento pago/retirado/rascunho e cliente em pausa. Sem ensaio real SMTP/Twilio. Este endpoint não é o agendador semanal de lembretes do portal nem o serviço antigo `paymentReminderService` não montado neste percurso. O contrato novo exige que consumidores deste endpoint conservem o `requestId`; não foi encontrado formulário atual que o chame.

## TASK175 — Conversa do cliente reservada à administração

A revisão encontrou TEAM_LEADER autorizado nos aliases antigos, no chat moderno e na sala Socket.IO MANAGEMENT. As APIs de conversa CLIENT, leitura e contadores passam a aceitar apenas ADMIN ou o cliente titular, conforme a operação. O bloqueio nos uploads ocorre antes do middleware de gravação para perfis de campo.

No tempo real, MANAGEMENT e a adesão administrativa a salas de clientes ficam exclusivas de ADMIN. TECHNICIAN/TEAM_LEADER aderem à própria sala de campo; o cliente apenas à sua. Conservado o acesso dos dois perfis de campo ao chat interno. O teste utiliza cinco ligações Socket.IO reais em Chromium e confirma a mensagem no cliente/admin, ausência no cliente alheio/técnico/chefe, contador/consulta/escrita recusados e ausência de alteração do histórico após recusas.

O primeiro ensaio do teste Socket.IO falhou porque `cw-auth` substituía os tokens pela sessão única da página de login. O ensaio foi corrigido para uma página neutra da mesma origem; as credenciais e o servidor continuam reais. Essa falha do teste não é prova de um defeito novo de autenticação.

Limites: esta tarefa protege texto e eventos das conversas nas rotas testadas. Anexos antigos de `clientMessageRoutes` ainda usam URLs da área pública de uploads e precisam de um percurso de download autenticado; não declarar confidencialidade integral dos anexos. O alias `/api/chat/internal` ainda devolve lista vazia em vez de ler o histórico de `/api/internal-chat/messages`; consolidar numa tarefa própria. Não há migração automática de histórico.

## Validação

- `run-1789508611851`: perfil/chat interno, rota privada, chat por recurso, matriz de acessos e Route OS — cinco grupos aprovados.
- `run-1789508845457`: lembrete manual, envio de documentos e automação mensal/portal — três grupos aprovados.
- `run-1789509043603`: identidade CLIENT, fatura no chat, perfil/chat interno e interligações aprovados; teste novo Socket.IO falhou pelo motivo de fixture acima.
- `run-1789509078629`: Socket.IO/privacidade CLIENT corrigido, matriz de acessos, rota privada e lembrete manual — quatro grupos aprovados.
- 323 testes unitários em 58 ficheiros e quatro de técnicos aprovados; sintaxe de 518 ficheiros backend aprovada. A bateria integrada passa de 75 para 79 grupos. Confirmar a árvore publicada em PostgreSQL 16 e o restauro antes de usar o CI como evidência deste lote.

Sem instalação no VPS, envio externo real, eliminação histórica ou alteração da branch principal. A matriz atual está em `COMPLETENESS_CURRENT_20260915.md`.
