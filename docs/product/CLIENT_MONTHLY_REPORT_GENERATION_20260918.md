# TASK271 — Cálculo mensal CLIENT por período e titular histórico

## Problema confirmado

O gerador CLIENT contava todas as visitas das piscinas atualmente ligadas ao cliente, independentemente do mês, estado ou titular da intervenção. O ensaio `run-1789762611052` reproduziu quatro visitas num mês em que apenas uma pertencia ao cliente e ao período. É a falha de cálculo identificada no encerramento da TASK270.

## Comportamento

- O mês predefinido é o mês civil anterior em UTC, incluindo janeiro e anos bissextos. O argumento interno opcional `monthRef` reutiliza o validador comum (2000–2199); nenhuma nova rota ou opção pública foi criada.
- Uma visita regular conta como realizada quando o estado normalizado é DONE, COMPLETED, CONCLUIDA ou CONCLUIDO e `endAt` está entre o primeiro instante do mês, inclusive, e o primeiro instante do mês seguinte, exclusivo. A regra de estados é partilhada com o relatório operacional.
- NOT_DONE tem contagem separada pelo mesmo período de fecho. Estados planeados, em curso, incompletos, cancelados, arquivados ou desconhecidos não aumentam os totais de visitas realizadas.
- Uma visita concluída/não realizada sem `endAt` fica por confirmar no mês de `plannedDate`, ou de `date` quando não existe data planeada. Não se inventa uma data de execução. O PDF explica e mostra estes registos separadamente.
- A titularidade é sempre `ServiceVisit.clientId`. Não se infere o cliente pelo proprietário atual da piscina. Visitas de outro cliente ou sem cliente não entram na contagem. Intervenções próprias numa piscina entretanto transferida mantêm o identificador histórico, sem divulgar o nome atual da instalação de outro cliente. Visitas sem piscina aparecem como instalação não identificada e exigem revisão.
- Piscinas atuais sem intervenções continuam visíveis com zero. O conjunto não é truncado a mil visitas. Os totais e metadados novos usam `reportVersion: 2`, `scope: REGULAR`, período UTC, base das datas e sinalização `reviewRequired`. As visitas EXTRA continuam no seu relatório separado.
- Nome do cliente, piscinas atuais e estado de pagamento são dados guardados na geração, explicitamente identificados como tal; não representam um saldo ou titularidade no último dia do mês.
- A leitura e criação usam uma transação RepeatableRead. A chave única existente de mês/tipo/cliente reserva um único relatório. Pedidos concorrentes recuperam o relatório vencedor depois de conflito; outros erros fazem rollback e são propagados. Não existe atualização silenciosa do relatório guardado.
- Relatórios antigos e novos já existentes são devolvidos sem recalcular os seus dados, mesmo após alteração de fontes. Não há escrita em visitas, pagamentos, documentos financeiros ou auditoria durante a geração. Não há migração nova nem alteração da cache v89.
- O controlador administrativo delega no Business. A exportação antiga de `reportService` conserva compatibilidade. O PDF reutiliza as fontes incorporadas já usadas nos relatórios de visitas, preservando nomes com acentos e alfabetos suportados.

## Verificação

- `run-1789762734953`: cálculo novo, titularidade mensal, valores operacionais e relatórios mensais ADMIN aprovados antes do ensaio adicional de leitura simultânea.
- `run-1789763233570`: limites UTC/mês bissexto, cliente histórico, aliases de estados, 1001 visitas adicionais, ausência de piscina/fecho, fontes sem escrita, relatório antigo imutável, três processos concorrentes, rollback e PDFs CLIENT autorizados passaram até ao ensaio final. As três regressões de acesso/operacional/mensal ADMIN terminaram com código zero.
- O ensaio final altera cliente e visitas numa segunda ligação entre duas leituras da primeira transação. O PGlite local multiplexa uma única ligação: o segundo escritor fica bloqueado até expirar a transação. O grupo completo local termina com falha P2028 (`run-1789763151833` e `run-1789763233570`); não é declarado aprovado. Todas as asserções permanecem obrigatórias no PostgreSQL nativo do CI, sem exclusão ou redução do teste.
- PDFs atual e antigo obtidos pelas rotas autorizadas em `reports/field-visual/client-monthly-generation-1789763239629/`, com fonte incorporada e texto extraído verificados. Ambos foram renderizados e revistos: uma página cada, nomes latinos/gregos, contagens e avisos legíveis, sem cortes ou sobreposições.
- Gates locais: sintaxe 560 backend/183 frontend/56 inline; 396 unitários em 63 ficheiros e quatro testes técnicos aprovados. O runner passa de 153 para 154 grupos; mantêm-se as 21 migrações.

CI PostgreSQL 16 e restauro: pendentes da publicação desta árvore. A aprovação final deve citar o commit exato, 154 grupos distintos e o restauro de linhas/ficheiros. O resultado parcial local não substitui essa validação.

## Limites e próximo percurso

Esta tarefa corrige apenas a geração de novos relatórios mensais CLIENT de visitas regulares. Relatórios históricos eventualmente incorretos ficam preservados para uma futura revisão explícita. A consulta autorizada da TASK270 mantém-se. Não se altera a frequência ou preço: três ou mais visitas quando necessário, conforme cliente, época e instalação.

Rever depois a entrada e apresentação dos relatórios no portal atual (`customerPortalService`), incluindo os idiomas; não reativar `frontend/client.js`, que não está incluído nas páginas atuais. O gerador global ADMIN histórico ainda precisa de revisão própria dos seus agregados; o fluxo de email também usa uma seleção de mês que deve ser alinhada explicitamente antes de envios reais. Não se declara esses percursos corrigidos por esta tarefa. Instalação no VPS, ensaios físicos e fornecedores continuam pendentes. Nenhum envio externo ou emissão fiscal foi executado.

## Ficheiros (10)

1. `src/business/client/ClientMonthlyReportBusiness.js`
2. `src/services/clientMonthlyReportDataService.js`
3. `src/services/operationalValueReportService.js`
4. `src/services/reportService.js`
5. `src/controllers/adminReportController.js`
6. `src/services/pdfReportService.js`
7. `scripts/test-field-client-monthly-generation.js`
8. `scripts/test-field-suite.js`
9. Este relatório.
10. `docs/product/CURRENT_WORK_CHECKPOINT.md`
