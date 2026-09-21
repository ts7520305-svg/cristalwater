# Revisão das referências externas históricas — TASK276

Data: 21/09/2026. Branch: `work/field-readiness-20260915-simulation`.

## Objetivo e reprodução

A aplicação permite ao ADMIN rever referências antigas sem presumir que um campo preenchido comprova uma fatura externa. A emissão fiscal com IVA continua no programa externo do proprietário. Frequências e preços continuam por cliente, época e instalação, com três ou mais visitas conforme o caso.

Antes da alteração, a reprodução isolada `/tmp/cw276-probe.log` mostrou um documento com o mesmo número interno/externo apresentado como registado, sem estado de revisão. Mostrou também que uma referência histórica com espaços Unicode nas extremidades não impedia a associação do mesmo número sem esses espaços. A nova consulta identifica ambas as situações; a reserva transacional dos números compara a mesma normalização nas associações novas e na emissão interna.

## Comportamento

- A consulta assinala referências por rever, coincidência com número interno, duplicação, formato inválido e divergência com uma confirmação histórica. Não altera documentos ao consultar. Confirmações existentes da TASK275 continuam reconhecidas quando correspondem ao documento, cliente e número atuais.
- O filtro «Referências a rever» apresenta o número guardado, o número interno, o estado financeiro, os documentos em conflito, todas as linhas e as decisões anteriores. A interface distingue a contagem de referências confirmadas da contagem de referências que precisam de revisão.
- ADMIN confere todas as linhas, escolhe uma decisão, escreve um motivo e confirma o resumo com cliente, documento, número e decisão. A referência antiga não é editável neste formulário. Documentos antigos sem linhas exigem a confirmação global explícita.
- «Fatura externa» confirma administrativamente uma referência histórica válida e única. Guarda autor, data, motivo, número original e cópia dos serviços/valores, sem escrever no documento financeiro, incluindo o seu `updatedAt`. Um documento histórico cancelado ou sem pedido atual pode ser confirmado como facto histórico, sem reabrir a cobrança.
- «Apenas interno» está disponível apenas quando a referência coincide com o número interno do próprio documento e não existe confirmação externa anterior. Retira exclusivamente `externalInvoiceNo`; o `updatedAt` acompanha essa alteração. Conserva número interno, `invoiceIssued`, preços, IVA, pagamentos, estado financeiro, datas, notas e linhas. A referência exata anterior fica na auditoria e no histórico pesquisável.
- Uma referência duplicada não pode ser confirmada como externa. A correção explícita de uma cópia do próprio número interno continua disponível, permitindo remover apenas essa cópia após conferência. As referências de outros documentos não são alteradas.
- Números externos já confirmados não podem ser apagados ou substituídos por estas ações. Se uma alteração exterior ao fluxo remover uma referência confirmada, a consulta indica divergência e bloqueia uma associação nova até à reconciliação documental.
- O histórico continua disponível depois da correção, mesmo que o cliente/documento deixe de pedir fatura e `invoiceIssued` seja falso. Uma associação externa posterior conserva o histórico da correção interna. A pesquisa inclui números internos, referências atuais e referências revistas.
- As APIs exigem identidade do cliente, checklist completa, versão dos dados/histórico/conflitos, decisão, motivo e UUID do pedido. Alterações desde a consulta exigem nova revisão. Bloqueios transacionais comuns protegem a numeração, o documento e as linhas.
- Gravação, comunicação interna e auditoria são atómicas. Repetir o mesmo UUID e a mesma intenção devolve o recibo original sem novos registos; reutilizar o UUID para outra decisão é recusado. Repetir uma correção antiga depois de associar uma fatura externa não apaga o número novo.
- O navegador partilha o bloqueio de ações com a associação externa, conserva o UUID após resposta perdida, verifica a identidade do recibo e invalida confirmações quando muda a sessão ou seleção, incluindo A–B–A. Respostas tardias não substituem a consulta mais recente. Listas inconsistentes não disponibilizam formulários; os textos são apresentados de forma inerte.

As novas rotas ADMIN `POST /api/invoices/:id/review-external-reference` e `POST /api/core/invoices/:id/review-external-reference` delegam no mesmo negócio. As rotas e os campos anteriores são mantidos; a consulta acrescenta estado e histórico de revisão. As respostas são privadas e sem cache. O registo em `CommunicationLog` é local, sem envio de mensagens.

## Ficheiros da tarefa

| Ficheiro | Alteração |
| --- | --- |
| `src/business/finance/FinanceOsBusiness.js` | Classificação e consulta histórica, conflitos normalizados, revisão transacional e proteção de confirmações anteriores. |
| `src/routes/invoiceRoutes.js` | Nova ação ADMIN delegada no negócio comum. |
| `src/routes/coreFlowRoutes.js` | Alias com as mesmas validações e transação. |
| `frontend/to-issue.js` | Revisão explícita, checklist, motivo, histórico, confirmação e recuperação de pedidos. |
| `frontend/to-issue.html` | Filtro e estilos da revisão e do histórico. |
| `frontend/sw.js` | Cache de recursos v93. |
| `scripts/test-field-external-reference-review.js` | Testes de API, concorrência, rollback, preservação e navegador. |
| `scripts/test-field-suite.js` | Inclusão do 159.º grupo. |
| `docs/product/EXTERNAL_REFERENCE_REVIEW_20260921.md` | Âmbito, evidência e limites. |
| `docs/product/CURRENT_WORK_CHECKPOINT.md` | Ponto de retoma. |

Dez ficheiros, uma responsabilidade, sem alterações ao Prisma nem novas migrações. A autorização de continuidade, commits e publicação na branch já foi dada pelo proprietário.

## Verificação local

O grupo novo testa consulta sem escrita, duplicados globais inclusive fora da lista fiscal, espaços Unicode, IDs/payloads inválidos, ADMIN/CLIENT/ausência de sessão, checklist parcial, cliente/versão errados e confirmação de documentos históricos cancelados. Compara o documento completo antes/depois das duas decisões, conserva pagamentos e o histórico, testa nova associação após correção e repetição do recibo antigo sem apagar o novo número.

Falhas injetadas em `CommunicationLog` e `AuditTrail` nas duas decisões revertem a transação inteira. Oito pedidos simultâneos com o mesmo UUID produzem um registo; decisões concorrentes incompatíveis não se sobrepõem. Serviços alterados, novos conflitos e retirada exterior de uma referência confirmada bloqueiam confirmações desatualizadas.

No navegador real: filtro, avisos, decisões permitidas, checklist/motivo obrigatórios, cancelamento, resumo exato, HTML inerte, resposta perdida após commit, repetição com o mesmo UUID, seleção/sessão A–B–A, recibo com identidade errada, serviços desatualizados, resposta real atrasada após nova consulta e lista com confirmação sem prova correspondente. Capturas a 320/390/1440 px verificam ausência de excesso de largura. A opção de decisão foi encurtada para caber no ecrã de 320 px.

- `/tmp/cw276-test.log`: grupo novo, associação externa da TASK275 e emissão interna aprovados.
- `/tmp/cw276-regression.log`: faturação atómica de reparações, Finance OS e geração da página de faturas aprovados.
- `/tmp/cw276-final-test.log`: grupo novo integral aprovado após os últimos ajustes; imagens finais em `reports/field-visual/external-reference-review-1790008580559/`, com revisão visual a 320 px e revisão anterior a 1440 px.
- Gates locais: 396 unitários em 63 ficheiros, quatro técnicos, 21 scripts do navegador e sintaxe 562 backend/185 frontend/56 inline aprovados.

Runtime local: Node 24.19.0, PGlite, Chromium 153, 21 migrações existentes; serviços externos e telemetria Prisma desligados. Os ensaios usam apenas dados descartáveis, sem rever ou corrigir dados reais dos clientes.

## Publicação e validação nativa

Commit `7c15fd91d0d5e7159ab0910a5904526e0da5f729`, árvore `cabae125bfadd865465c29b7d2bc258564b0abf4`, publicado na branch autorizada. [CI 35627561962](https://github.com/ts7520305-svg/cristalwater/actions/runs/35627561962), job `106425562327`, concluído com sucesso em 21/09/2026 às 17:02:28 UTC; todas as etapas aprovadas. Os logs confirmam 159/159 grupos distintos, todos com código zero e sem sinal, 396 unitários/63 ficheiros, quatro técnicos, 21 scripts de navegador, sintaxe 562/185/56 e restauro PostgreSQL 16 de 110 tabelas/46 ficheiros com igualdade de linhas e hashes. A retoma da TASK277 verificou o job concluído e os logs; os primeiros resultados de consulta do workflow ainda mostravam um estado antigo em execução.

## Limites e continuação

A confirmação é uma decisão administrativa fundamentada pelo utilizador; não verifica a existência da fatura no programa externo nem a emite. A data da revisão é distinta da data fiscal da fatura. Referências inválidas, divergências com confirmações anteriores e duplicados verdadeiros continuam a exigir reconciliação documental. Não existe edição arbitrária do número, eliminação de confirmações nem reclassificação automática de históricos.

A associação continua a abranger um documento interno completo. Repartição de linhas ou agrupamento de vários documentos numa fatura externa exige modelo próprio. O parâmetro legado explícito `externalInvoiceNo` na emissão interna conserva compatibilidade, mas não constitui confirmação administrativa por si só e passa a ser apresentado para revisão.

Os contadores globais ADMIN ainda usam critérios antigos em `dashboardController.js`; alinhar esses agregados com os estados confirmados/por rever é uma tarefa separada. A escolha de mês no email e a revisão dos restantes históricos/documentos também permanecem separadas. Publicação apenas na branch autorizada, sem merge, atualização da VPS, envio real ou emissão fiscal. Esta tarefa não representa a conclusão global do sistema.
