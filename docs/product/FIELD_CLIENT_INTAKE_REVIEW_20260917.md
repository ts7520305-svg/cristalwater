# Cadastro de clientes em campo — diagnóstico para a próxima correção

Diagnóstico anterior preservado em 17/09/2026. Cadastro e aprovação foram depois implementados e ensaiados nas TASK242–243; ver `FIELD_CLIENT_INTAKE_RECOVERY_20260917.md` para estado do CI e limites. O relatório ADMIN no final foi depois tratado nas TASK244–245; estado e limites em `ADMIN_MONTHLY_REPORT_RECOVERY_20260917.md`. As reproduções abaixo descrevem as bases anteriores. Base inicial examinada: `9b392f18a528608176d8e01d32dc294aa9850038`.

## Resultado observado

Ensaio local isolado `run-1789674821158`, executado com o router de produção, autenticação real e PGlite. Todos os dados e intervenientes foram criados para QA, com fornecedores externos desligados.

| Percurso | Reprodução | Resultado |
|---|---|---|
| Permissões do formulário | Técnico autenticado consulta `/api/technician-intake/settings` depois de se criar uma configuração QA alheia ao cadastro | HTTP 200 inclui a configuração sentinela no mapa completo. Prova de âmbito excessivo; não houve leitura ou exposição de segredos reais. |
| Reenvio após resposta perdida | A resposta HTTP é destruída depois do commit; repete-se o mesmo pedido de cliente/piscina | Dois clientes criados. O endpoint não possui UUID/comprovativo de operação. |
| Validação numérica | Submeter latitude 500, longitude -999 e volume -5 | HTTP 200, valores inválidos persistidos. O código verifica conversão finita, sem limites geográficos/volume positivo. |
| Aprovação parcial | Depois de criar uma ficha pendente, injetar falha no método de atualização das piscinas e aprovar o cliente | HTTP 500; cliente fica aprovado e piscina continua pendente. As duas escritas não partilham transação. |
| Autor da aprovação | Nessa aprovação, enviar o ID de outro administrador no body | O cliente guarda o ID enviado, diferente do administrador autenticado. |

A falha da aprovação foi injetada no método `prisma.pool.updateMany` do processo HTTP isolado, depois da atualização real do cliente. Não foi apresentada como falha de produção nem ensaio PostgreSQL nativo. Uma tentativa anterior com triggers (`run-1789674772718`) encontrou erro de protocolo/ligação no adaptador local e não é usada para afirmar sucesso falso ou rollback do cadastro.

## Inspeção adicional e âmbito necessário

`technician-new-client.js` repõe o formulário ao receber um `ok` genérico; ainda não conserva um pedido/rascunho próprio nem confirma conta, cliente, piscina e conteúdo originais. A autoria do técnico já é validada na API: o diagnóstico não a apresenta como uma falha nova. A consulta é autenticada; a lacuna é devolver todas as configurações ao técnico em vez das três capacidades do cadastro.

A criação já usa uma transação para cliente/piscina, mas tolera falhas de tarefa/auditoria com `catch`. O comportamento em PostgreSQL nativo perante essas falhas precisa de um ensaio próprio. Não se deduz aprovação global nem sucesso falso desse padrão apenas por leitura de fonte.

O âmbito de implementação identificado neste diagnóstico foi cadastro e aprovação separadamente: permissões limitadas ao necessário, validação explícita, autoria da sessão, escritas/auditoria obrigatórias, UUID/comprovativo, revisão de versões na aprovação e recuperação do formulário. Preservar fichas históricas e rascunhos existentes sem lhes atribuir autoria presumida. Os testes deverão cobrir reenvio, falhas em cada escrita, duas janelas, troca de conta e aprovação parcial.

## Relatório administrativo — diagnóstico separado

O ecrã real `/admin-reports` foi depois exercitado em Chromium, com conta ADMIN de QA e respostas HTTP controladas (`run-1789675099019`, 2388 ms):

- Selecionar fevereiro de 1999 e atualizar volta a pedir `/api/admin/reports`, `/api/core/dashboard` e `/api/communications` sem período. O valor global fornecido pelo ensaio permanece igual, agora acompanhado pelo mês escolhido. Esta prova verifica o comportamento do ecrã/transporte; não é um apuramento financeiro real desse mês.
- Ao devolver HTTP 503 nas três fontes, a página apresenta valores zero e «Relatorios atualizados.» com estado de sucesso. A falha deixa de ser distinguível de ausência de atividade.

A inspeção de `admin-reports.js` confirma a causa: `readJson` devolve fallbacks e `load` anuncia sucesso incondicionalmente; selectedMonth só é usado na legenda. Esta lacuna ainda não foi corrigida. Deverá ser tratada com fontes e período explícitos, erro/recuperação e preservação da diferença entre valor zero e informação indisponível, reutilizando os serviços financeiros existentes.

Um segundo ensaio, `run-1789679035371` (2164 ms), confirmou a integração com routers, autenticação, base PGlite e página Chromium reais, sem substituir respostas HTTP no navegador, no commit `fcae79921350fac15251d4c4367b7985fb66d092`. A base isolada continha um documento de 93,40 €, saldo atual de 77,50 €, recebimentos de 12,34 € em fevereiro de 2058 e 3,56 € no primeiro instante de março, três relatórios guardados e dois registos de comunicação de meses diferentes. Não foram emitidos documentos nem contactados fornecedores: os registos foram criados diretamente para QA.

As consultas financeiras existentes devolveram corretamente 12,34/3,56 € por mês e a consulta de relatórios filtrada devolveu um ADMIN em fevereiro. Ao selecionar fevereiro, a página continuou a apresentar aberto/pago de 0,00 €, zero faturas/pagamentos, três «relatórios administrativos» e as duas comunicações como «evento». Todos os três pedidos da página omitiram o período. Esta reprodução confirma montantes e contagens falsos na integração atual, além da falha de transporte do primeiro ensaio; não prova que o saldo atual seja um saldo histórico de fecho.

### Fontes confirmadas para a retoma

Inspeção de código em `fcae79921350fac15251d4c4367b7985fb66d092`, para preparar a correção seguinte:

| Fonte atual | Contrato observado | Consequência para a correção |
|---|---|---|
| `adminReportsController.listMonthlyReports` | Aceita `month=AAAA-MM` e `type`; a página não os envia e conta todos os registos devolvidos. | Contar os relatórios guardados do período e tipo efetivamente indicados; não presumir que o JSON histórico de cada relatório é uma fonte financeira atual validada. |
| `coreFlowRoutes`, GET `/dashboard` | Devolve contagens operacionais, incluindo `invoicesOpen`, mas não `financial`, `finance`, `counts.invoices` ou `counts.payments`, procurados pela página. Não lê o mês escolhido. | A integração atual não dispõe dos montantes/contagens anunciados, mesmo com HTTP 200. Usar fontes financeiras explícitas, sem converter propriedades ausentes em zero. O ensaio anterior com valores controlados verificou transporte/apresentação, não este apuramento real. |
| `communicationRoutes`, GET `/` | Consulta todos os CommunicationLog por `createdAt`; o modelo tem `channel` e não `type`. Não contém estado de entrega. | Filtrar por mês, usar canal real, contar a população completa e limitar só a lista de últimas entradas. Apresentar registos de comunicação, sem os confundir com entrega confirmada ao destinatário. |
| `cashReceiptReportService.payments/total` | Recebimentos por `Payment.paidAt`, intervalo UTC `[início, mês seguinte)`, exclusão de métodos internos e sem limite de página. `monthRef` aceita os anos 2000–2199. | Reutilizar esta definição de caixa e o ensaio `test-field-cash-reports.js`; definir o mesmo domínio de meses no formulário e na API. Um mês fora do contrato deve ser recusado, sem reapresentar dados globais. |
| `clientCreditService.invoiceTotal/invoiceOpen/isReceivableInvoice` | Montante e saldo atuais do documento; rascunhos e documentos retirados não são recebíveis. | Distinguir documentos do mês de recebimentos nesse mês. O saldo atual de documentos de um mês não é o saldo histórico no fim desse mês; essa reconstrução não está demonstrada. |
| `operationalValueReportService` | Referência mensal documental, atividade regular/extra, proveniência e margem desconhecida. | Reutilizar definições aplicáveis; não somar mensalidades, caixa e linhas extra como se fossem a mesma medida de receita ou lucro. |

A proteção ADMIN de `/api/admin` e `/api/communications` já é instalada por `legacyAdministrationAccess` antes dos routers. A falta de autenticação dentro do ficheiro `communicationRoutes` não demonstra acesso público. Conservar e ensaiar esta proteção no novo percurso. O relatório global `getOutstandingDebtReport` tem limite explícito de 10000 documentos; não o reutilizar como um total mensal completo sem tratar essa limitação.

Critérios concretos para o próximo lote:

1. Contrato de leitura com mês validado, definição de cada métrica, período UTC e completude explícitos. Não criar pagamentos, emitir documentos, gerar relatórios ou enviar comunicações ao abrir o ecrã.
2. Ensaiar dados reais de meses diferentes e fronteiras exatas, pagamentos internos, documentos retirados e população superior aos limites de apresentação. Confirmar o significado e a proveniência de cada montante.
3. Separar vazio confirmado, zero confirmado, campo inválido e fonte indisponível. Uma falha parcial deve identificar a secção afetada, permitir recuperação e nunca anunciar atualização integral.
4. Impedir que respostas atrasadas de outro mês, modo ou conta repovoem o ecrã; tornar explícita a data/período dos dados. Exercitar rede interrompida, resposta inválida, troca de conta e recarga.
5. Rever apresentação a 320/390/1440 px, texto literal, títulos, controlos e estados acessíveis. Confirmar o CI/restauro da árvore que implementar a correção; este diagnóstico não a declara concluída.
