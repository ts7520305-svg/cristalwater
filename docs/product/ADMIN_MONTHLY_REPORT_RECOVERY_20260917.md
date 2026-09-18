# TASK244–245 — relatório ADMIN com fontes e período confirmados

## Estado

Implementado em 17/09/2026 sobre `d3e7462d8fcbeeca420cf6c5a8f9ac67ac38139d`. TASK244–246 confirmadas no commit `48e29bf00a35a63fae23e0c2176d17e7d4fa28dd`, árvore `30570153a8a715891e6f5d214fb497fccac98607`, [CI `35279447336`](https://github.com/ts7520305-svg/cristalwater/actions/runs/35279447336), job `105397748167`: 140/140 grupos, 388 unitários/quatro técnicos, 21 scripts de navegador, 20 migrações, sintaxe 544 JS backend/179 frontend/57 inline e restauro de 110 tabelas/32 ficheiros com linhas/hashes iguais em PostgreSQL 16. O CI terminou com sucesso em 17/09/2026 às 22:12 UTC; resultado confirmado em 18/09/2026. Cache v69; runner final com 140 grupos, sem migração nova. A proteção adicional do imprimível está em `REPORT_SETTINGS_PRINT_REVIEW_20260917.md`; o diagnóstico anterior está em `FIELD_CLIENT_INTAKE_REVIEW_20260917.md`.

Adenda TASK252–253: as regras financeiras foram extraídas para `monthlyFinancialProjection.js` e são reutilizadas pelo imprimível mensal, preservando o formato agregado desta API. Regressão local aprovada, incluindo mais de 10000 registos; CI nativo do novo lote ainda por confirmar. Ver `MONTHLY_PRINT_SOURCES_20260918.md`.

## Contrato e fontes

`GET /api/admin/reports/summary` exige `monthRef=AAAA-MM` e uma das secções `financial`, `reports` ou `communications`. O mês é explícito, no domínio 2000–2199; parâmetros repetidos, formatos ambíguos e parâmetros desconhecidos são recusados. A rota é ADMIN e precede o detalhe histórico por ID. Respostas privadas sem cache; erro de leitura devolve 503 genérico, sem propriedades financeiras fabricadas ou detalhe interno da base.

Cada secção é consultada numa transação RepeatableRead própria. A resposta confirma versão, secção, mês, limites UTC, instante de consulta, população completa e ausência de corte dos totais. As secções podem ter instantes diferentes, apresentados individualmente; não se declara um snapshot global entre pedidos HTTP separados.

| Informação | Definição aplicada |
|---|---|
| Recebido no mês | Payment.paidAt entre o início UTC do mês, incluído, e o início do mês seguinte, excluído. Reutiliza cashReceiptReportService, com a transação fornecida opcionalmente. Métodos internos CREDIT/CREDIT_NOTE/ADJUSTMENT/CREDIT_ADJUSTMENT são excluídos; depósitos recebidos em dinheiro continuam a contar uma vez. |
| Documentos do mês | Referência monthRef tem precedência; referências históricas month=AAAA-MM ou year + month numérico são usadas quando monthRef é nulo. A definição existente foi extraída de operationalValueReportService e partilhada, conservando o contrato anterior. |
| Valor e saldo dos documentos | Reutiliza invoiceTotal/invoiceOpen/isReceivableInvoice. Rascunhos/documentos retirados e registos de depósito não entram nos valores documentais. Saldo atual desses documentos, sem reconstrução do fecho histórico do mês. |
| Dados financeiros por rever | Estados desconhecidos, montantes negativos/não monetários, totais positivos contraditórios ou soma fora da precisão suportada não se tornam zero. O valor afetado é nulo; contagens e outras fontes confirmadas continuam disponíveis. Aliases monetários com zero histórico não criam uma contradição por si só. |
| Relatórios guardados | MonthlyReport.month, com contagens separadas ADMIN, CLIENT, EXTRA_VISITS e outros tipos. EXTRA_VISITS é produzido pelo fluxo de extras existente e não é tratado como tipo desconhecido; conta relatórios guardados, não o número de visitas dentro de cada JSON. Não reutiliza os montantes do JSON histórico nem presume geração/envio/entrega. |
| Comunicações | CommunicationLog.createdAt no mesmo intervalo UTC. Contagem integral; só a lista de últimas entradas tem limite de cinco, ordenada por data/ID. Apresenta channel e data, sem mensagens, destinatários ou dados de cliente; um registo não confirma entrega. |

Estas leituras não criam pagamentos, documentos, relatórios, notificações ou envios. A página deixou de procurar montantes/contagens inexistentes no dashboard operacional e deixou de consultar listas globais como se fossem mensais. Os endpoints históricos mantêm o seu contrato para os restantes consumidores.

## Página e recuperação

Mês atual UTC na entrada nova; se o navegador restaurar o formulário ao recarregar, consulta o período efetivamente reposto. A primeira leitura espera pageshow e alterações silenciosas posteriores do mês/modo invalidam os dados. Esta correção veio de uma falha reproduzida em Chromium: o formulário voltava a junho de 2098 depois de se iniciar a consulta de setembro de 2026, deixando a página em carregamento.

As três secções têm estado e recuperação próprios. Falha parcial conserva as secções confirmadas, limpa a secção falhada e permite repetir só essa consulta. Falha total, resposta inválida, valor ausente e vazio confirmado são estados distintos. A interface valida período, fontes, somas das contagens, números, completude e a lista limitada de comunicações antes de apresentar os dados.

Alterações de mês/modo, prazo de consulta, troca de conta, outra janela e retorno por BFCache abortam ou invalidam respostas antigas. A troca de sessão limpa os dados apresentados e exige reabrir a página; não limpa rascunhos locais. Não há persistência destes relatórios financeiros no armazenamento do navegador nem cache de API no service worker.

Os painéis declaram gestão manual de estado, evitando que o adaptador visual comum os conserve como indicadores de carregamento e transforme o conteúdo em colunas estreitas. Títulos, estado e conteúdo mantêm ordem vertical. Textos de canais são inseridos literalmente. Larguras 320/390/1440, contraste dos textos dos painéis em claro/escuro e acesso aos botões de recuperação foram ensaiados; capturas finais revistas.

## Evidência local

- `run-1789680466198`: API nova aprovada em 6328 ms; regressões de caixa em 8118 ms e valores operacionais em 717 ms. Base PGlite isolada, HTTP/autenticação reais. Inclui mais de 10000 documentos, recebimentos e comunicações, meses/formatos históricos, fronteiras exatas, inativos, depósitos/crédito interno, estados retirados, vazios, valores contraditórios/negativos e overflow.
- O mesmo ensaio verifica ADMIN, recusa de TECHNICIAN/TEAM_LEADER/CLIENT, consultas inválidas, projeções privadas e ausência de escritas. Um processo HTTP separado injeta falhas nos métodos de leitura dentro da transação do router real; cada fonte devolve 503, recupera e não expõe a sentinela interna. Esta injeção não é uma interrupção real de PostgreSQL.
- `run-1789680831584`: interface com correção da recarga e dos painéis aprovada em 11511 ms. O ensaio inicial que encontrou essas falhas não é usado como aprovação final.
- `run-1789681020764`: interface final, incluindo contraste claro/escuro, aprovada em 11551 ms. Dados reais de dois meses, vazio, canais literais, HTTP 202/503, resposta HTML, dados malformados/incompletos/contraditórios, falha parcial/total, repetição independente, offline/retoma, prazos, respostas atrasadas, BFCache, duas janelas e conta original após reload.
- `run-1789681375742`: contrato final com EXTRA_VISITS aprovado na API em 6402 ms e na interface em 10226 ms. Um relatório com duas visitas é contado uma vez; este tipo conhecido não coloca o painel em revisão. As restantes verificações de recuperação e contraste mantiveram-se aprovadas.
- `run-1789682083504`: regressão conjunta após proteção do imprimível mensal: API 7687 ms, interface 10516 ms e acesso/HTML do imprimível 2886 ms; todos aprovados.
- Regressão das três interfaces de valores operacionais aprovada em 6277 ms na execução local anterior à correção sintática do novo ensaio de contraste; esse conjunto não é apresentado como aprovação global.
- 388 unitários em 62 ficheiros; sintaxe de 544 JS backend/179 frontend/57 inline aprovada. Inventário: 101 HTML, 94 entradas de raiz, sete auxiliares, 57 referências literais em 160 scripts ativos, zero assets ausentes e zero divergências de guardas/catalogação. Inventário não equivale a cobertura integral.

## Publicação e validação nativa

API mensal 4320 ms; interface mensal 8504 ms; proteção do imprimível 1405 ms; caixa 1222/445 ms; valores operacionais 497 ms e respetiva interface 5760 ms. As 140 linhas de resultado do runner têm scripts distintos e código zero. A evidência pertence à árvore de código indicada acima; este checkpoint posterior altera apenas documentação.

A versão final das TASK244–245, antes da TASK246, também passou no CI `35278565342`, commit `946a01f389ab3b37371ece483e4bfee463173dae`: 139 grupos, API mensal 4090 ms, interface 8411 ms e restauro confirmado. A aprovação conjunta de 140 grupos inclui a correção do acesso e do HTML do imprimível.

## Limites e retoma

- Montantes históricos guardados continuam sujeitos à qualidade dos registos. O relatório não calcula lucro nem reparte mensalidades/custos históricos; não reconstrói saldos no último dia de meses passados.
- Documentos sem referência mensal reconhecida não são atribuídos por uma data presumida. As regras de referência históricas são as dos relatórios operacionais existentes.
- População acima de 10000 foi verificada funcionalmente. As leituras financeiras ainda materializam os registos; não é ensaio de dimensionamento, stress ou redundância de produção.
- Página em português; revisão integral de traduções, relatórios imprimíveis/PDF, telefones reais e serviços externos permanece na matriz.
- Próxima revisão: configurações de relatórios e saídas imprimíveis/PDF, cruzando os endpoints e consumidores já existentes. Não repetir a correção mensal deste ecrã.

