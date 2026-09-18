# TASK270 — Titularidade dos relatórios mensais guardados

## Problema confirmado

A revisão dos documentos por perfil encontrou três acessos a relatórios mensais CLIENT que verificavam o número do cliente, mas não exigiam sempre o perfil CLIENT. As tabelas User, Technician e Client têm identificadores independentes. Um técnico autenticado com o mesmo número de um cliente conseguia consultar a lista e os dois percursos de PDF desse cliente.

O ensaio isolado `run-1789760692406` reproduziu HTTP 200 nos três percursos onde devia receber 403. Não foram usados dados nem contas de produção.

## Comportamento corrigido

- Os dois routers exigem ADMIN ou CLIENT pelo middleware comum; uma regra de negócio partilhada confirma novamente o perfil e a titularidade antes da consulta. TECHNICIAN e TEAM_LEADER não recebem relatórios mensais comerciais por coincidência numérica, mesmo quando associados a uma conta User.
- CLIENT consulta apenas o cliente comprovado na sessão. Identidades históricas com `id`, `clientId` e o alias CUSTOMER continuam aceites. Uma sessão `principalType: USER` marcada CLIENT não prova ligação à tabela Client e é recusada; não se infere essa ligação por número ou email.
- A lista conserva o contrato `{ count, reports }`, consulta exclusivamente `type: CLIENT` e ordena por mês/identificador. Os PDFs conservam o serviço e o conteúdo existentes; ambas as entradas delegam no mesmo controlador e negócio.
- Cliente e relatório no caminho exigem inteiros positivos canónicos até 2147483647. Frações, notação exponencial, zeros iniciais e valores fora do limite são recusados. Query, Range e HEAD não concedem autoridade.
- ADMIN pode consultar o histórico de um cliente inativo. Cliente inativo ou token expirado é recusado pelo middleware existente. Relatórios ADMIN/EXTRA_VISITS, sem cliente ou de outro titular não são devolvidos como PDF CLIENT. O PDF direto de outro titular responde 404, tal como um relatório inexistente.
- `private, no-store` e `nosniff` são aplicados antes da autenticação, incluindo nas recusas. Não há escrita, migração, alteração de cache PWA ou modificação de relatórios históricos.

## Rotas verificadas

1. `GET /api/client-reports/:clientId/reports`
2. `GET /api/client-reports/:clientId/reports/:reportId/pdf`
3. `GET /api/client/client/reports/:id/pdf`

A terceira é a montagem histórica real de `clientReportPDFRoutes`; esta tarefa conserva o caminho. O comentário antigo e `frontend/client.js` usam um caminho diferente, `/api/client/reports/:id/pdf`. Esse ecrã antigo também pede uma lista numa rota não montada e abre o PDF sem Authorization. A abertura antiga precisa de revisão própria; não é declarada corrigida por esta alteração de autorização.

## Verificação

- `run-1789760829940`: novo teste integral de titularidade e regressões de PDF/HTML de visitas regulares, relatório EXTRA e fontes mensais ADMIN aprovados.
- O novo grupo usa Client/Technician/User com o mesmo número, dois clientes, relatório de dois meses e registos CLIENT/ADMIN/EXTRA_VISITS/sem titular. Verifica técnico, chefe, User associado, User CLIENT ambíguo, administrador, cliente próprio/alheio, aliases históricos, sessão inválida/expirada/inativa, GET/HEAD/Range, parâmetros inválidos e conteúdo/assinatura dos PDFs autorizados.
- As contagens de documentos financeiros, pagamentos, auditoria e configurações, bem como os relatórios guardados, permanecem iguais durante a consulta. A mudança de estado da conta usada no ensaio é deliberada e pertence à fixture.
- Runner ampliado de 152 para 153 grupos. Sem novas migrações; permanecem 21. Cache PWA v89 mantida, pois não há alteração de frontend.

Gates locais aprovados: sintaxe de 559 ficheiros backend, 183 frontend e 56 scripts inline; 396 testes unitários em 63 ficheiros e quatro testes de técnicos. Confirmar CI PostgreSQL 16/restauro da árvore publicada antes de declarar a aprovação final.

## Limites e próximo percurso

Esta tarefa fecha a autorização dos relatórios mensais guardados. Os relatórios individuais de visita mantêm as permissões e apresentações já testadas nas TASK250–267; o técnico continua a consultar o relatório permitido da visita que lhe está atribuída.

O gerador histórico `generateClientMonthlyReport` em `reportService.js` ainda agrega visitas da instalação sem delimitar o mês do relatório. Esta leitura estática identifica um próximo ponto a reproduzir e corrigir; a presente tarefa não valida os seus cálculos nem reescreve relatórios antigos. A apresentação, os idiomas e o percurso de abertura mensal do cliente também exigem revisão própria. Instalação no VPS, testes físicos e fornecedores continuam pendentes.

## Ficheiros (9)

1. `src/business/client/ClientMonthlyReportBusiness.js`
2. `src/controllers/clientReportController.js`
3. `src/controllers/clientReportPDFController.js`
4. `src/routes/clientReportRoutes.js`
5. `src/routes/clientReportPDFRoutes.js`
6. `scripts/test-field-client-monthly-report-access.js`
7. `scripts/test-field-suite.js`
8. Este relatório.
9. `docs/product/CURRENT_WORK_CHECKPOINT.md`
