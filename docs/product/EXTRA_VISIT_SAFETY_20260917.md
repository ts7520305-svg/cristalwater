# TASK213 — Água aberta e bomba em manual em visitas extra

## Resultado

A visita extra permite registar água aberta e bomba em manual, incluindo depois da conclusão do trabalho: a situação física pode continuar ativa, e um registo preparado sem rede pode chegar mais tarde. A criação numa visita cancelada é recusada; o escritório deve reconciliar essa situação. Concluir a visita não fecha o lembrete. O fecho exige confirmação física explícita no ecrã.

Cada lembrete conserva `REGULAR` ou `EXTRA`, visita, piscina e cliente. Histórico, alerta, passagem de responsabilidade e fecho seguem a mesma origem. IDs numéricos coincidentes entre ServiceVisit e ExtraVisit não alteram o registo errado. Não há efeitos sobre execução, stock ou faturação.

## Escrita e recuperação

- Leitura, autorização e bloqueio da visita dentro da transação; cliente/piscina contraditórios são recusados. O chefe de equipa fica limitado aos seus lembretes, tal como o técnico.
- Criações modernas identificadas pela conta autenticada e UUID local obrigatório, normalizado. O servidor conserva o hash do pedido; repetir o identificador com outra visita/tipo/prazo/nota é recusado.
- Criação, histórico e notificação durável são atómicos. Alarmes, repetição, passagem e fecho usam os bloqueios existentes. As notificações conservam o tipo da visita.
- Fila local comum a água e bomba, separada por conta tipada (`TECH` ou `USER:…:TECH:…`). Gravação verificada antes de indicar sucesso; coordenação de alterações e envios entre janelas.
- Ao recuperar, a criação é confirmada antes do fecho. A resposta tem de corresponder à conta, pedido, hash, tipo, visita, piscina, cliente e prazo; fecho só é confirmado com `isCompleted: true`. HTTP 202 não vale como confirmação.
- Troca de conta bloqueia envios e respostas tardias; voltar à conta original permite recuperar um pedido já persistido no servidor sem o duplicar.
- Lembretes antigos sem identidade suficiente permanecem intactos e originam um aviso de reconciliação. Não são importados ou enviados automaticamente por coincidência de ID. Os registos existentes no servidor são consultados com a autorização atual.
- Revisão do fim do dia inclui pendências dos dois tipos de visita. Cache pública atualizada para v41, incluindo o novo módulo; dados operacionais permanecem privados.

## Validação

Revisão adicional: indicador de água na ronda corrigido para não confundir REGULAR e EXTRA com o mesmo número; o fecho atualiza a lista imediatamente. A reprodução falhou em `run-1789619069044`; correção, UUID ausente/inválido e normalização aprovados em `run-1789619754819`, juntamente com a regressão da API de água. O fluxo completo E2E passou localmente em `run-1789619835260`, com gravação assíncrona e corrupção da nova fila efetivamente verificadas.

Quatro grupos dirigidos aprovados em `field-qa-runtime/run-1789618386006`: `test-field-extra-reminders`, `test-field-extra-execution`, `test-field-water-api` e `test-field-visit-types`. O ensaio novo cobre concorrência, IDs coincidentes, técnico/chefe alheio, pedido alterado, conclusão antes da sincronização, alerta, passagem, fecho, falha transacional da notificação, navegador real, perda de rede, recarregamento, confirmação incompleta, armazenamento cheio, duas janelas e resposta tardia após mudar de conta.

388 testes unitários, quatro testes de técnicos incluídos nessa bateria, 17 scripts de navegador e sintaxe de 536 ficheiros backend aprovados localmente. Interface revista a 320, 390 e 1440 px; aviso pendente com contraste corrigido. Runner de integração passa a 116 grupos. Sem alteração de schema: mantêm-se as 19 migrações. A confirmação final em PostgreSQL 16 e o restauro correspondem ao workflow da publicação, a registar no checkpoint.

Os ensaios usam dados de QA e não verificam entrega push a telemóveis reais. Impedimentos, correções, regressos e equipamento de ExtraVisit continuam como trabalho separado.

Primeiro CI da TASK213 (`35181296038`): 115/116 grupos aprovados; o E2E antigo esperava a bomba aparecer de forma síncrona e ainda usava as chaves/prefixos antigos. Ensaio migrado para aguardar a persistência, corromper/restaurar a fila atual e confirmar o lembrete REGULAR no servidor; o segundo CI deve confirmar a árvore final e o restauro.
