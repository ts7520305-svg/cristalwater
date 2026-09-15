# TASK127 — Criação de lembretes resistente a reenvios

Reprodução em `field-qa-runtime/run-1789470902028`: dois POST com o mesmo `requestId` criavam dois lembretes diferentes. `ReminderCreationBusiness` passa a centralizar a criação pela ficha da piscina, CRM e alias agenda.

Um `requestId` UUID v4 identifica a intenção de criação. Dentro da mesma transação, o servidor bloqueia esse identificador, verifica o comprovativo anterior, cria o lembrete e guarda a resposta original num `OperationalReminder` concluído, sem destinatário, como nos comprovativos operacionais já existentes. O resumo criptográfico liga o pedido ao administrador, percurso, destino e campos normalizados. A repetição exata devolve o mesmo resultado com `idempotent: true`; reutilizar o identificador com dados, administrador ou percurso diferentes devolve 409. CRM e agenda partilham o mesmo percurso. A resposta inclui o `requestId` para confirmação na interface.

A falta de gravação do comprovativo reverte também o lembrete. Concluir ou eliminar posteriormente o lembrete não permite recriá-lo repetindo a criação antiga. O comprovativo descreve o resultado original, não o estado atual; a consulta da lista fornece o estado atual.

Mantém-se HTTP 201 e o JSON `ok`/`reminder`. O `requestId` é opcional para compatibilidade com integrações antigas; chamadas sem identificador conservam a criação simples e não têm proteção contra repetição. Os formulários passam a usar sempre um identificador na tarefa seguinte. Não há migração ou novas rotas. O autor vem da sessão administrativa. Campos, datas, IDs, prioridade, recorrência e destinos são validados; numa piscina, o cliente é derivado da ficha, recusando associações contraditórias.

Validação local em `field-qa-runtime/run-1789471051397`: oito criações concorrentes geram um único lembrete; repetição core/CRM/agenda, campos alterados, outro administrador, equivalência de recorrências, conclusão/eliminação posterior, falha simulada ao gravar o comprovativo e compatibilidade sem identificador. O teste anterior de conclusão também passou. 249 testes unitários (14 novos) e 4 de técnicos aprovados, com sintaxe dos ficheiros alterados verificada.

Não se removem duplicados anteriores nem se convertem pedidos antigos sem identificador. Os comprovativos são conservados; uma política futura de limpeza tem de respeitar a prevenção de reenvios. A entrega final verifica a bateria integrada e o PostgreSQL/restauro do commit publicado.

Ficheiros (7): `ReminderCreationBusiness.js`, `coreFlowRoutes.js`, `enterpriseCrmController.js`, `reminder-creation.test.js`, `test-field-reminder-lifecycle.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`.
