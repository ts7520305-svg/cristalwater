# TASK126 — Lembretes pendentes visíveis com histórico acumulado

Reprodução em `field-qa-runtime/run-1789470750965`: com 105 lembretes concluídos e 505 pendentes na mesma piscina, a ficha devolvia zero pendentes. O limite de 100 resultados era ocupado por estados DONE, ordenados antes de PENDING. O CRM tinha o mesmo problema com limite de 500.

`ReminderListBusiness` reúne as consultas da ficha, CRM e alias agenda. Lê uma fotografia consistente da base, em lotes de 500 ordenados por ID, até esgotar os resultados. A resposta JSON continua a conter `ok` e `reminders`. Pendentes aparecem primeiro, por vencimento e ID; o histórico fica depois, do mais recente para o mais antigo. Mantêm-se os filtros CRM de estado/categoria e o isolamento por piscina e categoria da ficha. Uma falha de leitura é devolvida como erro; não aparece uma lista vazia ou incompleta como se a consulta tivesse sido bem sucedida.

Teste integrado: 505 pendentes, 105 concluídos, outra piscina, listagens core/CRM/agenda e filtros. Exige todos os registos, ordem dos pendentes e histórico intacto. Teste unitário exige erro quando a segunda página da base falha. A interface existente recebe a lista completa sem alteração de navegação.

Limite: a resposta e a apresentação ainda incluem todos os resultados selecionados. Arquivos muito grandes podem exigir paginação visível na interface; os lotes limitam cada consulta, não a dimensão final da resposta. Este trabalho elimina os cortes silenciosos existentes, sem apagar histórico. Não altera criações ou conclusões.

Ficheiros (8): `ReminderListBusiness.js`, `coreFlowRoutes.js`, `enterpriseCrmController.js`, `reminder-list.test.js`, `test-field-reminder-lifecycle.js`, `test-field-suite.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`. A bateria integrada final e o workflow PostgreSQL/restauro serão registados na entrega publicada.

Validação local: 235 testes unitários e 4 de técnicos aprovados; sintaxe dos ficheiros alterados aprovada. Teste integrado aprovado em `field-qa-runtime/run-1789470809542`.
