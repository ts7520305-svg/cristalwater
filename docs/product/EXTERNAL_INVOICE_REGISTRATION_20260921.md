# Associação de faturas externas — TASK275

Data: 21/09/2026. Branch: `work/field-readiness-20260915-simulation`.

## Objetivo e comportamento

A emissão fiscal com IVA pertence ao programa externo indicado pelo proprietário. A aplicação assinala o pedido de fatura, permite conferir os serviços e ajustes do documento interno e guarda o número externo confirmado. Esta tarefa reutiliza `to-issue`, os campos existentes e as duas rotas de associação.

A reprodução isolada anterior à correção (`/tmp/cw275-probe.log`) confirmou HTTP 503 no registo principal com integrações desligadas, enquanto o alias core aceitava HTTP 200 sem número, substituía um número existente e marcava um documento cancelado. O registo interno passa a ter uma única operação de negócio; não chama qualquer serviço fiscal nem ativa integrações.

- ADMIN confere todas as linhas do documento, introduz o número e confirma um resumo com cliente, documento, valor interno e número externo. Documentos antigos sem linhas exigem confirmação global explícita.
- A associação abrange **um documento interno completo**. Não representa faturação parcial nem permite repartir linhas por várias faturas externas ou agrupar vários documentos internos sob o mesmo número. O limite existente de unicidade é preservado e passa a ser protegido entre pedidos simultâneos.
- O servidor recusa números vazios, tipos inesperados, controlos, mais de 200 caracteres, aliases contraditórios, IDs inválidos, documentos sem pedido de fatura, valores não positivos, rascunhos e documentos retirados. Documentos pagos continuam elegíveis para associação fiscal.
- A checklist enviada pelo ecrã identifica o cliente, todas as linhas e a versão do conteúdo consultado. Alterações aos serviços, preços, estado ou dados fiscais desde a consulta exigem nova confirmação. Os aliases antigos continuam a aceitar o número isolado, associando o documento completo; a auditoria distingue a ausência de checklist explícita.
- A reserva transacional do número é comum às duas rotas e à numeração interna. O documento e as linhas ficam bloqueados durante a confirmação. Gravação, comunicação interna e auditoria são atómicas: se uma falhar, nenhuma fica concluída.
- Repetir o mesmo documento/número não altera notas, datas ou auditoria. Um número externo já registado não pode ser substituído por esta ação. O ecrã conserva o número e as seleções após falha; permite consultar o histórico ou repetir o pedido explicitamente, sem duplicação.
- A operação não altera preços, IVA, pagamentos, saldo, estado de cobrança, número interno ou data de emissão interna. A data guardada na auditoria é a data da associação, não a data fiscal da fatura externa.
- A numeração interna simples deixa de preencher automaticamente `externalInvoiceNo`. O parâmetro explícito legado `externalInvoiceNo` na emissão interna mantém compatibilidade; o fluxo recomendado é a associação confirmada neste ecrã. Referências antigas preenchidas não são apagadas nem reclassificadas automaticamente.
- O histórico inclui todos os registos, inclusive após retirar o pedido de fatura do cliente. O pedido por documento também é respeitado. Um simples `invoiceIssued: true` sem número é apresentado como número em falta. Rascunhos/cancelados não entram nos pendentes; uma referência histórica existente continua consultável.
- Cada associação nova conserva uma cópia das linhas, valores e dados de contexto no momento do registo. Alterações posteriores ao documento não reescrevem essa cópia. Registos anteriores sem cópia são identificados no ecrã. Pesquisa inclui o número externo e totais são agregados em cêntimos.
- O navegador bloqueia confirmações sobre uma sessão ou seleção anterior, incluindo A–B–A, e exige identidade do documento/cliente/número na resposta. Pedidos têm limite de 20 segundos. Listas inválidas não disponibilizam formulários. Respostas das APIs são privadas e sem cache.

## Ficheiros da tarefa

| Ficheiro | Alteração |
| --- | --- |
| `src/business/finance/FinanceOsBusiness.js` | Consulta/associação partilhadas, reserva do número, validação, cópia histórica e transação; distinção entre número interno e referência externa. |
| `src/routes/invoiceRoutes.js` | Delegação da consulta e registo ADMIN; resposta normalizada compatível. |
| `src/routes/coreFlowRoutes.js` | Alias com a mesma validação e transação; falhas de consulta explícitas. |
| `frontend/to-issue.js` | Checklist, confirmação, recuperação, histórico completo e controlo de identidade/sessão. |
| `frontend/to-issue.html` | Explicação do fluxo e estilos legíveis em ecrãs pequenos e no tema claro. |
| `frontend/sw.js` | Cache de recursos v92. |
| `scripts/test-field-external-invoice-registration.js` | Testes integrados de API, concorrência, rollback, histórico e navegador. |
| `scripts/test-field-suite.js` | Inclusão do 158.º grupo. |
| `docs/product/EXTERNAL_INVOICE_REGISTRATION_20260921.md` | Âmbito, evidência e limites. |
| `docs/product/CURRENT_WORK_CHECKPOINT.md` | Ponto de retoma. |

Dez ficheiros, uma responsabilidade, sem alterações Prisma ou novas migrações. Rotas e campos anteriores mantidos; a consulta acrescenta dados de confirmação/histórico. A autorização de continuidade e publicação na branch já foi dada pelo proprietário.

## Verificação local

O grupo novo cobre as duas rotas, IDs/tipos/aliases inválidos, ADMIN/CLIENT/ausência de sessão, pedido por cliente e por documento, documentos pagos/retirados, número em falta, pesquisa/histórico, preservação de valores/pagamentos/datas e da cópia histórica. Injeta falhas em `CommunicationLog` e `AuditTrail`, envia oito pedidos simultâneos para o mesmo registo e disputa o mesmo número entre dois documentos/rotas e entre emissão interna e associação externa. Confirma também a independência dos números interno/externo e os documentos sem linhas.

No navegador real verifica checklist completa, cancelamento, confirmação do número, texto com apóstrofos/HTML inerte, primeira resposta perdida depois do commit, repetição sem duplicação, alteração dos serviços antes de guardar, mudança de seleção/sessão, identidade errada na resposta e lista inválida. Captura 320/390/1440 px e verifica ausência de excesso de largura. A revisão das primeiras imagens encontrou baixo contraste no tema claro; estilos corrigidos e imagens seguintes revistas.

Primeiro grupo integral em `/tmp/cw275-test.log`; segundo em `/tmp/cw275-final-test.log`, imagens revistas em `reports/field-visual/external-invoice-1790005670497/`. `/tmp/cw275-regression.log` aprovou emissão interna, geração da página de faturas, cancelamento, notas de crédito e faturação atómica de reparações. O ensaio final `/tmp/cw275-complete.log` aprovou o novo grupo e as regressões de emissão interna, Finance OS e reparações após distinguir os dois números; imagens finais em `reports/field-visual/external-invoice-1790005812356/`.

Runtime local: Node 24.19.0, PGlite, Chromium 153, 21 migrações existentes; serviços externos desligados e telemetria Prisma desativada. Gates: 396 unitários em 63 ficheiros, quatro técnicos, 21 scripts do navegador e sintaxe 562 backend/185 frontend/56 inline. CI PostgreSQL 16 e restauro do commit publicado aprovados, conforme o registo seguinte.

## Publicação e validação nativa

- Commit publicado: `113013a2cabc80358a566c190eac20308ca6f0ef`; árvore `13498153a088a8ea7436c1c615fd29d935288dff`, idêntica à versão local.
- [CI 35621988931](https://github.com/ts7520305-svg/cristalwater/actions/runs/35621988931), job `106407029132`: concluído com sucesso, workflow atualizado em 21/09/2026 às 16:11:04 UTC; todas as etapas aprovadas.
- 158/158 grupos distintos previstos no runner, todos com código zero e sem sinal de interrupção. Associação externa: 4985 ms; emissão interna: 589 ms; Finance OS: 544 ms; geração da página: 2726 ms; reparações: 854 ms; cancelamento: 665 ms; notas de crédito: 596 ms.
- 396 unitários/63 ficheiros, quatro técnicos, 21 scripts do gate de navegador, 21 migrações aditivas e sintaxe 562 backend/185 frontend/56 inline aprovados.
- Restauro PostgreSQL 16 de 110 tabelas e 46 ficheiros enviados aprovado, com igualdade das linhas da base de dados e dos hashes dos ficheiros.

Publicação não forçada na branch autorizada. Backup local `backup/external-invoice-registration-local-20260921`. A atualização posterior à aprovação altera apenas este relatório e o checkpoint, conservando o código/testes do commit validado.

## Limites e continuação

Ainda é necessária revisão explícita das referências históricas, sobretudo números antigos preenchidos pela emissão interna ou duplicados antes desta proteção. Não inventar prova fiscal nem apagar esses dados automaticamente. Repartição/agrupamento de vários documentos numa fatura externa precisa de modelo próprio de associação e não foi introduzida nesta tarefa. Agregados globais ADMIN e escolha de mês no email continuam tarefas separadas.

Frequências e preços mantêm-se por cliente, época e instalação, com três ou mais visitas conforme o caso. Publicação apenas na branch autorizada; sem merge, atualização da VPS, envio real ou emissão fiscal. Esta tarefa não equivale à conclusão global do sistema.
