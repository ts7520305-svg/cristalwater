# Resumo ADMIN da faturação externa — TASK277

Data: 21/09/2026. Branch: `work/field-readiness-20260915-simulation`.

## Problema reproduzido

O resumo administrativo filtrava os pendentes por `invoiceIssued === false`. A emissão interna, que não comprova faturação externa, retirava assim documentos do contador. `/tmp/cw277-probe.log`, antes da correção, mostra um documento de 12,30 € pendente no registo externo e zero documentos/zero euros no resumo. A seleção também não excluía todos os estados retirados e não apresentava a revisão histórica da TASK276.

## Alteração

- O resumo usa diretamente a consulta de negócio de `/to-issue`, incluindo elegibilidade, histórico, confirmações e conflitos globais de números. Não foi criada uma segunda regra fiscal nem alterada a associação de faturas.
- Documentos emitidos internamente, documentos pagos e referências em branco continuam pendentes quando há pedido de fatura e valor positivo. Rascunhos, documentos retirados e valores não positivos ficam fora dos pendentes. Pedido por documento, histórico sem pedido atual, duplicados normalizados e divergências são respeitados.
- Os seis campos ADMIN de faturação externa são globais, independentemente do mês escolhido para os restantes indicadores. `officialInvoiceClients` e `officialInvoiceTotal` abrangem o mesmo conjunto do registo, incluindo histórico; não representam apenas pedidos atuais. Pendentes e montante em cêntimos correspondem ao filtro pendente. `officialInvoiceConfirmed` conta confirmações válidas; `officialInvoiceReview` conta referências que precisam de revisão, inclusive divergências sem número atual.
- O cartão «Faturação externa» mostra documentos por associar, o total interno desses documentos e referências confirmadas. O cartão «Referências a rever» abre o filtro de revisão. «Por associar» não afirma que a fatura ainda não foi emitida no programa externo.
- Uma falha ao consultar o registo faz falhar a resposta ADMIN; não devolve zeros artificiais. O navegador distingue dados indisponíveis de zero confirmado, limpa os cartões durante atualização e falha, valida os contadores e ignora respostas de pedidos, meses ou sessões anteriores. Pedidos sobrepostos são cancelados e existe limite de 20 segundos. A resposta ADMIN é privada e sem cache.
- Corrigida sobreposição dos textos e falta de contraste nos cartões: a classe comum de navegação impunha uma linha horizontal sobre a grelha de conteúdo. A correção é local ao resumo, mantém os atalhos e organiza texto/valor/descrição em linhas legíveis.

Os valores, pagamentos, saldos, documentos e auditorias não são alterados por estas consultas. O registo continua a ser administrativo; não emite faturas fiscais nem confirma a sua existência no programa externo.

## Ficheiros

`src/controllers/dashboardController.js`, `src/routes/dashboardRoutes.js`, `frontend/admin-dashboard.js`, `frontend/admin-dashboard.html`, `frontend/sw.js`, `scripts/test-field-external-invoice-summary.js`, `scripts/test-field-suite.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`. A atualização documental de `EXTERNAL_REFERENCE_REVIEW_20260921.md` regista a aprovação nativa anterior. Dez ficheiros no lote, sem migração; cache v94 e 160 grupos no runner.

## Verificação

- Novo teste integrado: seis pendentes/32,90 € adicionados pelos cenários explícitos, uma confirmação e cinco referências por rever antes de confirmar um histórico; contagem total 12. Inclui pedidos individuais, clientes sem documentos, oito estados retirados, pagamento, espaços Unicode, conflito com documento fora do registo, formato inválido, divergência histórica e correção explícita de cópia interna.
- API: igualdade com os totais globais do registo, independência do filtro/mês, confirmação histórica sem alteração financeira, consultas sem escrita, ADMIN/CLIENT/TECHNICIAN/TEAM_LEADER, resposta privada e falha da fonte sem substituição por zeros.
- Navegador real: contadores e texto, navegação para os dois filtros, dados incompletos, HTTP 503, zero válido, resposta antiga após consulta nova, troca de sessão A–B–A e alteração do mês. Imagens a 320/390/1440 px e verificação geométrica de texto sem sobreposição. A primeira inspeção identificou a sobreposição/contraste; CSS corrigido e imagens seguintes revistas.
- `/tmp/cw277-regression.log`: grupo novo, associação externa TASK275, revisão histórica TASK276, visibilidade de rascunhos e Finance OS aprovados. Imagens revistas do novo resumo: `reports/field-visual/external-invoice-summary-1790010134232/`. Ensaio final integral aprovado em `/tmp/cw277-final-test.log`; imagens finais, incluindo o cartão fiscal no viewport móvel, em `reports/field-visual/external-invoice-summary-1790010335561/`.
- Gates locais: 396 unitários/63 ficheiros, quatro técnicos, 21 scripts de navegador e sintaxe 562 backend/185 frontend/56 inline aprovados. Node 24.19.0, Chromium 153 e PGlite com as 21 migrações existentes; operações externas desativadas.

Publicada após autorização explícita do proprietário em 21/09/2026: commit `d0263d483f1eafaeeab8dd8b55ecdf4d6c3cc154`, árvore `24e3d3a681a247aa0f587d9294e257a16979a748`, idêntica ao lote local validado. A comparação atualizada confirmou que o GitHub ainda estava em TASK276 e não tinha alterações divergentes; atualização normal da mesma branch, sem força, merge ou deploy. A tentativa anterior tinha sido bloqueada pela revisão automática por não reconhecer autorização explícita; esse bloqueio foi resolvido pela instrução seguinte do proprietário. O envio usou a integração autenticada do GitHub após o Git local indicar ausência de credenciais. Backups locais preservados.

[CI PostgreSQL 16 e restauro 35630490326](https://github.com/ts7520305-svg/cristalwater/actions/runs/35630490326), job `106435218129`, concluído com sucesso em 21/09/2026. Logs confirmam 160/160 grupos distintos com código zero e sem sinal, 396 unitários/63 ficheiros, quatro técnicos, 21 scripts de navegador, 21 migrações e sintaxe 562/185/56. O restauro recuperou 110 tabelas e 46 ficheiros com linhas/hashes iguais. Novo grupo do resumo em 32692 ms. A atualização posterior deste relatório é apenas documental.

## Continuação e limites

A consulta partilhada carrega o registo completo; esta tarefa não introduz paginação nem certifica desempenho na VPS. Os restantes indicadores monetários/operacionais do dashboard conservam os critérios atuais e exigem revisão própria, incluindo o custo operacional estimado. A consulta administrativa de referências e a emissão externa continuam distintas.

Próximo percurso concreto: seleção explícita de mês no envio de relatórios, preservando o documento guardado e sem envios reais durante QA. Reconciliação de duplicados verdadeiros/divergências, repartição ou agrupamento de documentos numa fatura externa, preçário/rentabilidade, instalação VPS e piloto físico continuam pendentes. Frequências e preços por cliente/época/instalação, três ou mais visitas conforme necessário. Publicação apenas na branch autorizada, sem merge/deploy nem mensagens reais.
