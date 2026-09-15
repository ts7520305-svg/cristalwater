# TASK104 — Eventos de aprovação apenas após confirmação da transação

Revisão independente identificou que o fluxo de aprovação existente emitia eventos antes de as escritas seguintes do portal estarem confirmadas. O portal agora pede ao fluxo de negócio para adiar essa emissão e emite REPAIR_APPROVED só depois do commit. Repetições da mesma decisão não repetem o evento. Os restantes percursos administrativos mantêm o comportamento existente.

O teste integrado injeta uma falha PostgreSQL na escrita da decisão, após a atualização da reparação, e verifica rollback da reparação/decisão e ausência do evento. Ao remover a falha, a repetição conclui e emite uma única vez. As notificações persistentes e a auditoria ficam na mesma transação. Uma falha de processo após commit pode impedir o evento em tempo real; a notificação persistente continua consultável. Isto não implementa um outbox transacional universal para todos os eventos do sistema.
