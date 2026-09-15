# TASK125 — Conclusão segura dos lembretes periódicos

Reprodução inicial em `field-qa-runtime/run-1789469602759`: concluir duas vezes o mesmo lembrete mensal deixou três registos, em vez do original e um sucessor. A conclusão e a criação seguinte eram duas gravações independentes. O percurso CRM/agenda também concluía serviços periódicos sem criar a ocorrência seguinte.

`ReminderCompletionBusiness` centraliza os percursos existentes da ficha da piscina, CRM e agenda. Uma transação bloqueia a linha do lembrete, lê o estado atual e grava a conclusão e o sucessor em conjunto. Pedidos concorrentes e repetições devolvem o registo já concluído, conservando `completedAt`; não criam outra ocorrência. Na repetição, `nextReminder` é `null` porque esse pedido não criou um sucessor, e `idempotent: true` identifica a repetição. A interface consulta a lista atual. Não existe uma associação nova entre registos nem migração de esquema.

O percurso da piscina exige IDs inteiros positivos, a piscina exata e uma das categorias `TECHNICAL_PERIODIC_SERVICE` ou `POOL_SERVICE_REMINDER`. Todos os percursos conservam autorização administrativa. Cancelados são recusados com 409; estados finais antigos ou `completedAt` preenchido são preservados. Recorrências periódicas inválidas são recusadas antes da conclusão. Lembretes gerais do CRM conservam a conclusão pontual existente.

As regras passam para `reminderRepeatService`, partilhado pela criação e conclusão. Mantêm-se dias, meses, anos e as regras históricas WEEKLY/MONTHLY/QUARTERLY/YEARLY. Valores personalizados fracionários, unidades desconhecidas e intervalos fora dos limites são recusados. O sucessor parte do vencimento anterior, preserva os campos de destino e as instruções, e limita o dia ao último dia do mês de destino. A aritmética usa UTC para ser independente do fuso do servidor. Uma tarefa muito atrasada pode produzir outra ocorrência já vencida; não se saltam serviços por executar. Depois de um mês curto, as ocorrências seguintes partem desse dia ajustado, como no comportamento anterior.

A ficha administrativa impede reenvios durante a conclusão e valida a identidade/estado da confirmação. Se a resposta se perder, permite repetir com segurança. Se apenas a atualização da lista falhar, conserva a confirmação da conclusão e pede atualização da página. Respostas de uma sessão anterior não atualizam a confirmação ou a lista de lembretes. Estados cancelados/finais não apresentam a ação Concluir; as regras históricas recebem os rótulos corretos.

Validação:

- Reprodução inicial falhou pelo motivo esperado (3 registos em vez de 2).
- Teste integrado `test-field-service-reminders.js`: reenvio sequencial, oito pedidos concorrentes entre core/CRM, alias agenda, cópia de campos, mês bissexto, estados finais/cancelados, regra inválida, autorização e isolamento por piscina/categoria.
- Falha de inserção simulada por trigger apenas na base QA: original conserva PENDING e `completedAt` vazio; repetição após retirada da falha cria exatamente um sucessor.
- Chromium na página real a 390 px: clique repetido, resposta perdida após gravação, repetição explícita e reload, confirmação de outro ID, falha ao atualizar a lista e troca de sessão durante a resposta.
- 16 testes novos de datas e regras; bateria total com 234 testes unitários, 4 de técnicos, 17 scripts de navegador e sintaxe de 487 ficheiros backend aprovada antes do commit. Os 34 grupos integrados locais foram aprovados em `reports/field-suite/1789469956928/results.json`, incluindo a versão final do novo teste. O workflow PostgreSQL 16/restauro é confirmado depois da publicação do commit.

Limites: não se reconstroem séries antigas quebradas nem se removem duplicados históricos. O botão Eliminar mantém o comportamento existente; apagar um sucessor é uma decisão separada. Não se altera a execução de manutenção de equipamentos, os alertas críticos de água ou as notificações externas. PGlite local serve a verificação funcional; a concorrência nativa e o restauro são verificados no workflow PostgreSQL 16. Ensaios físicos/VPS continuam pendentes.

Ficheiros desta tarefa (10): `ReminderCompletionBusiness.js`, `reminderRepeatService.js`, `coreFlowRoutes.js`, `enterpriseCrmController.js`, `admin-pool-technical.js`, `reminder-repeat.test.js`, `test-field-service-reminders.js`, `test-field-suite.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`.
