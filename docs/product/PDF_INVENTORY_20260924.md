# Inventário de PDFs gerados — 24/09/2026

Inventário estático das rotas montadas no backend: oito famílias, dez rotas GET (HEAD segue o comportamento das rotas). «Revisto» identifica o âmbito das TASK334–338 e respetivas provas; não equivale à aprovação do CI completo nem à conclusão de toda a aplicação.

| Família | Rota ativa | Origem e acesso | Apresentação / prova |
| --- | --- | --- | --- |
| Conta corrente interna | `/api/invoice-pdf/:id` | Documento/linhas guardados; ADMIN ou CLIENT titular, com estados não partilháveis recusados | PT; valores originais e rótulo não fiscal; TASK337. Identidade/sessão/início-fim conferidos na abertura: TASK338 |
| Extras pendentes | `/api/invoice-pdf/extras/:id` | Visitas concluídas cobradas à parte e ainda livres; ADMIN ou CLIENT titular | PT; total em cêntimos, sem confirmar faturação/pagamento; TASK337. Cliente histórico e abertura conferidos: TASK338 |
| Orçamento de reparação | `/api/repairs/:id/pdf` | Última versão comercial guardada ou estimativa antiga; ADMIN | PT; preços de venda sem custos/margens/notas internas; TASK337 |
| Relatório mensal do cliente | `/api/client-reports/:clientId/reports/:reportId/pdf` | Snapshot histórico; ADMIN ou CLIENT titular | PT; nomes/contagens históricos, versão 2 UTC; TASK337 |
| Relatório mensal, rota antiga | `/api/client/client/reports/:id/pdf` | Mesma família e serviço, compatibilidade de identidade do cliente | PT; alias mantido e verificado; TASK337 |
| Relatório de visita | `/api/report-visit/visit/:id` | Identidade tipada REGULAR/EXTRA e projeção por papel; inspeção de histórico ambíguo apenas ADMIN | PT/EN/FR/ES; Unicode, versões/origens e privacidade; TASK334 e provas anteriores |
| Ficha de seguro de viatura | `/api/guides/vehicles/:id/insurance/pdf` | Registo atual do seguro; ADMIN e papéis técnicos autorizados pela viatura | PT; ausência explícita, notas extensas; TASK335 |
| Guia de transporte | `/api/guides/transport/:id/pdf` | Guia guardada; ADMIN e papéis técnicos autorizados pela viatura | PT; conteúdo/provisoriedade preservados; TASK335 |
| Última guia de transporte | `/api/guides/transport/latest/:vehicleId/pdf` | Mesma família, última guia da viatura autorizada | PT; alias funcional verificado; TASK335 |
| Guia de obra | `/api/guides/work/:id/pdf` | Guia guardada; ADMIN e papéis técnicos autorizados pela viatura | PT; materiais/serviços/notas sem truncagem; TASK335 |

Nas guias, o controlo existente restringe TECHNICIAN à viatura atribuída; a equivalência existente de TEAM_LEADER mantém-se. A TASK335 valida o caminho/ID antes desse controlo. Não se alargou acesso a clientes.

As sete famílias distintas da visita usam `documentPdfService.js`; as guias conservam a exportação compatível em `guidePdfService.js`. O relatório de visita mantém o gerador próprio em `visitReportService.js`. Ambos reutilizam as fontes já distribuídas por `visitReportPdfFonts.js`. A apresentação dos dados não altera os originais.

## Fora destas dez rotas

- `/api/reports/visit/:id`, `/api/reports/monthly-print` são HTML imprimível, não outros geradores PDF. A página `/invoice-document` é uma entrada pública para abrir o PDF autenticado, sem apresentar os dados financeiros no HTML. Ambos constam do inventário separado de páginas/impressão.
- Anexos oficiais, faturas fiscais externas, fotografias e PDFs enviados por utilizadores não são modelos gerados pela aplicação; mantêm os controlos de ficheiros existentes.
- `src/controllers/paymentController.js` contém um gerador antigo de recibo em PDFKit sem importação/montagem no percurso ativo. As rotas de pagamento atuais usam o serviço financeiro próprio. Não foi ativado, corrigido ou apresentado como funcionalidade disponível.

## Pendências finitas

1. Confirmar os 235 grupos e o restauro PostgreSQL nativo do [CI 36053066253](https://github.com/ts7520305-svg/cristalwater/actions/runs/36053066253) (TASK338), incluindo concorrência da geração mensal.
2. Traduzir os modelos ainda exclusivamente PT, se incluídos no critério multilingue final; os cinco idiomas da interface mensal não traduzem o PDF guardado. Não declarar cobertura multilingue integral destes modelos.
3. Completar o inventário e revisão das páginas HTML/impressão, separado deste inventário PDF.
4. A TASK336 acrescentou confirmação histórica explícita para o cliente já registado. Conservar a separação entre inspeção administrativa, confirmação com evidência e partilha autorizada; cliente ausente continua por resolver.
