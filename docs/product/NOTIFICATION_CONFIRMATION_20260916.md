# TASK179–181 — notificações completas, leitura confirmada e destinatário correto

## Problemas reproduzidos

Um aviso crítico antigo desaparecia por detrás do limite de 50 notificações: `field-qa-runtime/run-1789535651412` confirmou `oldCriticalVisible:false` e 50 resultados. Os ecrãs antigos também alteravam ou substituíam a lista sem validar o resultado HTTP da leitura.

A reprodução de colisão entre User e Technician em `run-1789536182294` mostrou que a sessão de campo perdia a notificação do User correto e via uma notificação destinada ao User com o mesmo número do Technician. A confirmação final passou de `linkedOwnVisible:false, linkedForeignVisible:true, nativeForeignVisible:true` para `true, false, false`.

A revisão do ecrã CLIENT encontrou títulos/mensagens inseridos diretamente em HTML e a decisão de leitura baseada no estado operacional. Esse ecrã passou a usar texto literal e `isRead`, bem como o contrato autenticado comum.

## Contrato e comportamento

- `GET /api/notifications` conserva o conjunto autorizado completo, ordenando avisos críticos/água/bomba primeiro, depois não lidos e data. Consultas auxiliares de mensagens administrativas já não ocultam falhas com uma lista vazia. As relações carregam apenas os nomes necessários.
- `POST /api/notifications/read/:id`, `/:id/read` e `/read-all` partilham validação e transação. O comprovativo devolve `scope: NOTIFICATION_READ`, os IDs exatos e `isRead: true`.
- Um lote explícito recusa IDs inválidos, repetidos ou fora do âmbito; bloqueia as linhas por ordem e confirma novamente o âmbito antes de atualizar. Uma falha reverte o lote inteiro. Só linhas ainda não lidas recebem `readAt`; a repetição conserva a primeira data.
- Os ecrãs enviam apenas os IDs atualmente apresentados por ler e verificam o comprovativo. Uma notificação que chega depois não entra nesse lote. O alias sem `ids` mantém, por compatibilidade, a leitura do conjunto corrente autorizado; não oferece a mesma fotografia explícita.
- Ler não altera resolução operacional: água aberta e bomba manual exigem os percursos físicos existentes. Notificações sintéticas de mensagens CLIENT continuam a usar o endpoint próprio de mensagens vistas.
- Destinatários `userId` exigem um principal USER e o seu `userId` efetivo. Uma sessão TECHNICIAN nativa não recebe uma notificação privada de User por ter o mesmo número. Avisos gerais e dirigidos ao seu `technicianId` continuam acessíveis conforme o âmbito.
- Os ecrãs `notifications`, `admin-notifications` e `client-notifications` conservam a lista perante falhas HTTP/comprovativo, bloqueiam ações concorrentes e limpam os dados ao mudar a sessão. O ecrã CLIENT usa a API principal e células com `textContent`; a tabela pode deslocar-se dentro da página em telemóvel.

## Validação

Novo grupo `scripts/test-field-notification-confirmation.js`: aviso crítico antigo com 510 avisos recentes, primeiro `readAt` conservado nos aliases, leitura sem resolução, titularidade CLIENT, lotes malformados/estranhos, chegada de aviso posterior e falha SQL forçada com reversão integral. A colisão real de IDs é ensaiada nas sessões USER e TECHNICIAN, por GET e POST.

Chromium verifica os dois ecrãs administrativos e o ecrã CLIENT, falhas HTTP, comprovativo errado, lista conservada, leitura válida, conteúdo HTML literal e ausência de transbordo horizontal em mobile. Os fixtures de colisão e o trigger de falha são limpos pelo teste.

Execução final `field-qa-runtime/run-1789536438369`: seis grupos aprovados — notificações, UI da conversa interna, acessos, lembretes de equipamentos, privacidade CLIENT e durabilidade da conversa interna. Runner passa a 83 grupos. Validação unitária: 323 testes e quatro de técnicos. Confirmar a árvore publicada no CI com PostgreSQL 16 e restauro; a base TASK177 já aprovada não substitui esta confirmação.

## Limites

Sem migração, eliminação ou reatribuição histórica. A consulta completa não constitui ensaio de volume de produção. Os aliases antigos do portal CLIENT que não foram migrados conservam a sua validação/implementação própria; não se atribui a todos os endpoints de notificações a mesma garantia de primeiro `readAt`. Não houve entrega por fornecedor real nem alteração do VPS. A próxima revisão incide no envio recuperável das conversas CLIENT/ADMIN.
