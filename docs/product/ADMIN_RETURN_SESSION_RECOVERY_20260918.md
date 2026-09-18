# TASK249 — leitura de regressos após mudança de sessão

## Causa e correção

O CI `35304938643`, sobre `4d997baa22ad7cdb063943028df8eebb0548d0f4`, aprovou 141/142 grupos. As configurações de relatório passaram (API 675 ms, interface 20842 ms); a regressão `test-field-alert-billing.js` encontrou uma rejeição não tratada durante a troca de conta. O restauro não foi executado nessa tentativa.

A origem era o acompanhamento de regressos que também existe na página ADMIN de alertas. `cw-admin-incomplete.js` verificava a sessão antes de iniciar a sincronização e tratava falhas de cada envio, mas a leitura assíncrona da fila ficava fora desse tratamento. Se a sessão mudasse durante a leitura, `CWFieldWriteStore.records` recusava corretamente o contexto anterior; a promessa da rotina automática terminava com erro não tratado.

A sincronização passa a tratar também a falha de leitura, verifica novamente a conta antes de percorrer a fila e para ao mudar a sessão. A apresentação de um erro de leitura só pertence à conta capturada. Uma resposta antiga após a mudança esconde o painel, limpa o contexto visível anterior e pede a reabertura da página. Pedidos e rascunhos permanecem guardados. Regras de faturação, valores, agendamento e confirmações do servidor mantêm os contratos existentes.

## Verificação

A reprodução foi acrescentada ao teste existente: retém a chamada de leitura usada pela sincronização de regressos, muda o token e liberta a chamada original. A versão anterior falhou com a mesma mensagem de sessão não tratada em `run-1789704608818` (11224 ms). O teste exige zero erros de página, contexto anterior oculto, rascunho preservado e contagens de faturas/comprovativos iguais antes e depois. É uma interrupção controlada da chamada assíncrona, não uma simulação de avaria física da base.

A versão corrigida passou localmente em `run-1789704675399`: teste completo de faturação de alertas em 11201 ms, percurso de impedimentos/regressos em 7750 ms e interface completa das configurações em 22268 ms. A confirmação conjunta do CI e do restauro será registada após publicação. Cache v72, 142 grupos, 21 scripts no gate de navegador e 20 migrações existentes; não há nova migração.

Este ajuste fecha a falha concreta da regressão. A abertura autenticada e a revisão dos conteúdos/layout dos relatórios continuam como próximo percurso, conforme `CLIENT_REPORT_SETTINGS_RECOVERY_20260918.md`.
