# TASK216 — Impedimentos e regressos de visitas normais e extra

## Resultado

O técnico pode registar um impedimento numa visita REGULAR ou EXTRA; o escritório agenda um regresso do mesmo tipo, com data, responsável e instruções. O tipo acompanha a comunicação, a necessidade de produtos, o agendamento, a confirmação de receção e a conclusão. Visitas de tipos diferentes com o mesmo número conservam avisos e históricos separados.

O registo mantém medições, fotografias, execução, notas anteriores e consumos. A visita original fica por concluir quando existe um regresso; não é marcada como realizada pela conclusão desse regresso. Concluir o regresso resolve os impedimentos anteriores da mesma cadeia e os avisos ligados aos respetivos identificadores. Não fecha água nem bombas.

Um regresso extra herda as condições comerciais da intervenção por terminar e começa sem execução, fotografias ou consumos. A visita original não pode ser iniciada, concluída ou alterada para contornar um regresso ativo/concluído. Um regresso cancelado pode ser substituído. Só a visita efetivamente concluída entra no relatório comercial, uma vez; a operação não emite uma fatura.

## Confirmação e compatibilidade

- `VISIT_INCOMPLETE` e `VISIT_RETURN` utilizam `FieldWriteRequest`, por conta e UUID, com hash do conteúdo e comprovativo gravado na mesma transação do trabalho. Não é necessária outra migração; continuam a existir 20 migrações aditivas.
- A consulta devolve uma versão opaca da atribuição, estado, datas, condições comerciais e impedimentos/regressos. Notas de água/bomba que apenas acrescentam histórico não invalidam um pedido que preserva esse histórico.
- Pedidos novos verificam a atribuição e a versão consultada. Estado, versão, piscina, regresso existente, data passada, técnico indisponível, conflito de agenda e reserva comercial têm recusas sem aplicação. Recusas confirmadas permanecem recusadas mesmo depois de o contexto mudar.
- Repetir um pedido confirmado devolve a resposta original dessa conta, inclusive após reatribuição, cancelamento ou conclusão. Não repete o trabalho nem devolve um retrato novo como se fosse a confirmação anterior. Reutilizar o UUID com outro conteúdo é conflito.
- Chamadas antigas sem contrato tipado continuam a tratar visitas REGULAR com o contrato anterior. `incomplete:<id>:<uuid>` mantém o significado regular; EXTRA usa `incomplete:EXTRA:<id>:<uuid>`. Registos antigos sem tipo no servidor continuam regulares, sem inferência por coincidência numérica.

As faltas acompanham o técnico/viatura da visita de regresso atual. Preparação de carga, devolução e confirmação de receção bloqueiam a tabela da visita correta e verificam novamente o destino; a receção de química não conclui a visita nem representa consumo.

## Ecrãs e recuperação

O modo de campo e o formulário do escritório guardam rascunhos por conta/tipo/visita, verificam a gravação e comparam a versão local entre janelas. O pedido imutável fica guardado antes da rede. Recarga, perda de resposta e confirmação incompleta não geram um novo pedido. HTTP 202 não conta como confirmação. O escritório consegue recuperar o pedido mesmo que o regresso já apareça na lista após recarregar.

Os pedidos pendentes e recusas têm apresentação própria, repetição do pedido original e revisão explícita. A revisão de fim de dia inclui impedimentos pendentes e rascunhos. A confirmação provoca uma consulta atual da ronda sem impor a aba que estava aberta quando essa consulta começou. Instruções dos regressos extra são apresentadas no aviso da visita e a receção do trabalho distingue os tipos.

A fila antiga `cwIncompleteVisits:<technicianId>` permanece intacta e identificada como dependente de reconciliação. Não é atribuída automaticamente a uma conta ou a uma visita extra. O modo offline exige contexto anteriormente confirmado para a conta, tipo e piscina. Cache pública v44 inclui os módulos; dados operacionais continuam fora do service worker.

## Evidência

- `run-1789628146154`: E2E completo, água/impedimentos/regressos regulares, novo grupo extra, identidade dos tipos, execução extra e revisões de equipamento extra aprovados.
- `run-1789628258441`: novo grupo ampliado aprovado, incluindo preparação/receção de química numa visita extra, cancelamento/substituição e cadeia de dois regressos com uma única origem comercial. Quatro pedidos concorrentes iguais, resposta congelada, reatribuição, isolamento de números iguais, falha transacional na notificação e repetição exata ensaiados.
- Chromium real: rascunho após recarga, duas janelas com conflito preservado, HTTP 202, pedido após perda de resposta do escritório, fila histórica intacta e largura 320/390 px. Capturas do registo e acompanhamento revistas; a captura técnica inclui o aviso transitório da ronda.
- 388 testes unitários, quatro testes técnicos, 17 scripts de navegador e sintaxe de 538 ficheiros backend aprovados localmente. O runner integrado passa a 119 grupos. O adaptador local PGlite não substitui a confirmação em PostgreSQL nativo.

Primeira publicação `67cf0e6c2151963edfe2ccb05d4667f0d26d96d7`, árvore `fe0cdef20b167e5dbc0c8ca2453fed6695e83c57`: CI `35192642281` aprovou 118/119 grupos, migrações, sintaxe, unitários e navegador. O teste de stock detetou que a implicação de permissões ADMIN→TECHNICIAN permitia ao administrador chegar à verificação de atribuição da receção (409, quando deveria ser recusado com 403). A receção passa a exigir explicitamente TECHNICIAN/TEAM_LEADER destinatário; ADMIN continua excluído. O ensaio de stock completo e o grupo extra ampliado passaram em `run-1789629301945`, incluindo nova asserção explícita de recusa administrativa. CI completo e restauro da correção ainda por confirmar. PNG preexistente preservado com SHA256 `fba3c8189d9e0a31d96b378550736f865d30a4019f5e8d4d4487b15cfc543a71`.

## Continuidade

Rever a concorrência dos rascunhos gerais de medições/checklist e restantes filas/documentos, a entrada TEAM_LEADER, paginação e o inventário visual por perfil. Registos históricos ambíguos exigem reconciliação explícita. Este lote não demonstra operação prolongada num telefone real nem prontidão global do sistema.
