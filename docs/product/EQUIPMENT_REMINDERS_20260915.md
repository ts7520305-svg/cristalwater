# TASK111 — Avisos de manutenção preventiva

## Comportamento

O motor identifica planos ativos cujo prazo vence hoje ou já passou, em piscinas ativas e não eliminadas. Cria um aviso administrativo por versão do plano. Só cria aviso para um técnico quando existe uma visita aberta, atribuída a um técnico ativo, no dia operacional atual de Lisboa.

O dia agendado usa `plannedDate` e, na sua ausência, `date`. Uma intervenção iniciada hoje também é considerada. Uma visita marcada para amanhã, mas criada hoje, não recebe aviso hoje só por causa da data de criação. Planos já concluídos na mesma visita não voltam a gerar uma tarefa para essa visita.

A chave de deduplicação contém plano, versão, perfil e, para técnicos, visita e técnico. Marcar o aviso como lido não o recria. Reatribuir a visita invalida o destinatário anterior e cria um aviso para o técnico atual. Pausar o plano, avançar o prazo/versão, cancelar/fechar a visita ou sair do seu dia invalida os avisos antigos.

Avisos administrativos apontam para `/admin-operational-settings#equipmentMaintenancePanel`; avisos de campo apontam para `/technician-field-mode`. Nenhum contém contactos, custos ou valores de clientes. Não são publicados com perfil CLIENT.

## Configuração e integração

`EquipmentMaintenanceReminderBusiness` exporta:

- `configuration(db?)`: `{ok, enabled, automaticChecksEnabled}`.
- `configure(user, enabled)`: administração, booleano estrito, auditoria e bloqueio transacional. Desativar marca imediatamente os avisos anteriores como SUPERSEDED.
- `run({now?})` e alias `reconcile`: avalia validade, invalida avisos antigos e cria os necessários.
- `isCurrentNotification(notification, {db?, now?})`: validação assíncrona antes de mostrar/enviar. Devolve true para eventos de outros módulos; apenas filtra `EQUIPMENT_MAINTENANCE_DUE`.

A configuração persistida é `EQUIPMENT_MAINTENANCE_NOTIFICATIONS_ENABLED`, desativada por omissão. Este indicador controla **avisos dentro da aplicação**; não ativa permissões, credenciais nem variáveis de envio externo. A verificação manual apenas cria/atualiza os avisos na aplicação. O envio push, se integrado e autorizado separadamente, deve revalidar a situação antes da entrega.

`automaticChecksEnabled` reflete `ENABLE_BACKGROUND_JOBS=true` fora de NODE_ENV=test/QA_MODE=true. A montagem de scheduler/rotas é responsabilidade da integração; não é implementada neste ficheiro.

## Segurança operacional

`run` usa o bloqueio consultivo transacional 93615004: uma avaliação concorrente retorna `skipped: BUSY`. Com configuração desligada devolve `skipped: CONFIG_DISABLED` e não cria avisos. A reconciliação continua a retirar os antigos.

Paginação por identificador, em lotes de 500, processa todos os avisos ativos e planos elegíveis, sem truncar silenciosamente nos primeiros 500. A transação tem limite de 30 segundos; se exceder esse tempo, reverte integralmente e o erro deve ser registado pelo chamador. Não é uma certificação de capacidade para carteiras arbitrariamente grandes.

A reconciliação altera apenas `status`; mantém integralmente metadados, incluindo contadores/estado de push. Quando uma configuração ou atribuição regressa ao estado anterior, um aviso não lido pode ser reativado reutilizando a mesma linha. Avisos lidos permanecem sem nova entrega.

A validação de situação atual deve ser usada também na consulta/envio porque a atribuição ou o plano podem mudar depois de uma execução do motor. O bloqueio do motor coordena avaliações entre si, não bloqueia globalmente as operações de campo.

## Validação

`scripts/test-field-equipment-reminders.js` exige backend local e os três indicadores QA. Usa a base de dados real e verifica configuração/API por perfil, concorrência, leitura e contadores preservados, visita futura, mudança de técnico, cancelamento, pausa, conclusão, configuração desligada e isolamento de clientes. Restaura o valor de configuração anterior no fim. Não efetua envios externos.
