# TASK252–253 — fontes, cálculos e impressão do relatório mensal

## Estado

TASK252–253 confirmadas no commit `cd04d24b942c42fdc5952bffe7a0521d33f635d0`, árvore `5395911431de78ac341b5bcfd277c304f5febc23`, [CI `35316029494`](https://github.com/ts7520305-svg/cristalwater/actions/runs/35316029494), job `105507752531`: 146/146 grupos, 388 testes unitários/62 ficheiros e quatro testes técnicos, 21 scripts no gate de navegador, 20 migrações, sintaxe de 549 JS backend/181 frontend/56 scripts inline e restauro de 110 tabelas/32 ficheiros com linhas e hashes iguais em PostgreSQL 16. CI concluído em 2026-09-18 06:57:26 UTC. Fontes financeiras comuns à API ADMIN e ao imprimível mensal, clientes/documentos distintos, recebimentos por data UTC, filtro documental e montantes ambíguos por rever; cinco páginas de PDF revistas. Cache v76, sem migração nova. `MONTHLY_PRINT_SOURCES_20260918.md`. Esta atualização posterior altera apenas documentação e mantém código/testes da árvore validada. Base: `9ede492f82ed1f5096ff4fffd34cd4e4e24d6068`, depois da aprovação TASK250–251. Branch `work/field-readiness-20260915-simulation`. Cache v76 conservada: o HTML é gerado no servidor com `private, no-store`; não há alteração de assets nem migração nova.

## Problema reproduzido

Na reprodução `run-1789711807586`, o imprimível anterior apresentou 1000 EUR de documentos e 958 EUR em aberto, enquanto a API mensal reconheceu 175 EUR de documentos cobráveis, 108 EUR de saldo atual e 60 EUR/2 recebimentos no mês. O HTML incluía rascunhos nos totais, perdia documentos com referência histórica e confundia os pagamentos do documento com os recebimentos do período. Os preços atuais das piscinas eram apresentados junto dos valores mensais sem uma fonte histórica que os sustentasse.

A caixa «Clientes» usava a contagem de documentos. Na reprodução inicial, o valor 3 coincidia com os clientes distintos por causa da unicidade de cliente/monthRef no universo canónico; não se reproduziu uma sobrecontagem nesse caso. A seleção alargada aos formatos históricos exige agora duas contagens explícitas, verificadas com três documentos do mesmo cliente.

## Contrato aplicado

| Valor ou lista | Fonte e regra |
|---|---|
| Documentos do mês | `documentMonthWhere`: prioridade da referência canónica; na sua ausência, formatos históricos AAAA-MM ou mês numérico, simples/preenchido, com ano. Sem limite de página aplicado aos totais. |
| Clientes nos documentos | IDs distintos de clientes nos documentos selecionados, incluindo os documentos excluídos dos totais financeiros. A contagem de documentos é apresentada separadamente. |
| Valor documental e saldo atual | Projeção financeira partilhada com a API ADMIN. Estados de cobrança reconhecidos; rascunhos, retirados da cobrança e depósitos de crédito excluídos. `invoiceTotal` e `invoiceOpen` mantêm as regras existentes. |
| Montantes por rever | Negativos, frações de cêntimo, aliases positivos contraditórios, estados desconhecidos e somas fora da precisão segura não viram zero. Totais documentais indisponíveis quando existem documentos ambíguos; caixa independente mantém o seu resultado confirmado, e vice-versa. Zeros históricos em aliases não são uma divergência por si só. |
| Recebimentos do mês | `Payment.paidAt` no intervalo UTC fechado à esquerda e aberto à direita, independentemente do mês/estado atual do documento. Inclui dinheiro recebido para depósitos e para documentos hoje cancelados. Exclui os quatro métodos de crédito/ajuste interno, normalizados como na fonte de caixa existente. |
| Filtro «Requer fatura» | Marca guardada no documento. Na lista de recebimentos, usa a marca do documento associado, sem exigir que esse documento seja do mês escolhido. Não usa a preferência atual do cliente. |
| Liquidado registado | Valor atual guardado no documento; pode incluir crédito interno ou pagamentos de outros meses. Não é apresentado como recebimento do período. |
| Contactos, nomes e instalações | Ficha atual, claramente identificada. Não se infere o serviço/preço histórico a partir da mensalidade atual de uma piscina. Os preços atuais foram retirados desta apresentação. |
| Leitura e falhas | Documentos, relações e recebimentos numa transação RepeatableRead. O HTML completo é preparado antes do 200. Falha real em qualquer consulta retorna 503 genérico, sem valores parciais ou cabeçalhos de confirmação de sucesso. GET não grava registos. |

`monthlyFinancialProjection.js` concentra as regras monetárias antes internas a `adminMonthlySummaryService.js`, preservando o formato público da API e a ausência de identidades nessa resposta agregada. `cashReceiptReportService.js` exporta o filtro de métodos já usado, sem mudar os seus restantes contratos. `monthlyPrintableReportService.js` faz a leitura e apresentação; `reportController.js` mantém validação estrita, autorização ADMIN pela rota e confirmação de mês/filtro, agora com versão de relatório 2.

Estados guardados são apresentados literalmente; CANCELLED/ISSUED/desconhecidos não são convertidos em PENDING. Texto de cliente, instalação, método, notas, estado e número documental é escapado. Não há fontes, imagens ou pedidos externos no HTML. A abertura autenticada e a reserva de janela das TASK250–251 são preservadas.

## Verificação local

- `test-field-monthly-print.js`: 7 documentos/5 clientes, 4 documentos cobráveis/3 excluídos, 195 EUR de documentos e 128 EUR de saldo, 90 EUR/5 recebimentos; com filtro, 6 documentos/4 clientes e 50 EUR/4 recebimentos. Valores agregados iguais à API ADMIN. Cobertura dos limites UTC, mês canónico versus aliases, depósitos, crédito interno, estado e montantes inválidos, precisão, ausência de escritas, texto literal e falhas reais das leituras numa instância QA da rota de produção.
- `run-1789712792135`: API ADMIN mensal 3988 ms, novas fontes 1471 ms, acesso ao imprimível 1240 ms, interface ADMIN mensal 8176 ms e abertura autenticada 8431 ms, todos aprovados. O teste da API ADMIN inclui mais de 10000 registos e preserva o contrato agregado.
- `run-1789712960358`: novas fontes 1366 ms, interface do imprimível 800 ms, acesso 1271 ms e abertura autenticada 8534 ms, aprovados. A alteração posterior é apenas a regra de paginação da tabela; interface/PDF final novamente aprovada em `run-1789713434169`, 846 ms.
- Unitários: 388 testes/62 ficheiros; quatro testes técnicos. Sintaxe: 549 JS backend/181 frontend/56 scripts inline. Inventário regenerado: 101 HTML, 59 páginas referenciadas literalmente, 167 scripts ativos (146 grupos de integração e 21 scripts do gate de navegador), sem destinos em falta ou divergências do catálogo.

Limitações e falhas do ensaio local foram conservadas: duas execuções conjuntas anteriores receberam 401 no ensaio de falha da API ADMIN porque a consulta de utilizador perdeu a ligação ao adaptador PGlite. O limite de ligações do harness temporário foi reduzido de 8 para 2, sem alterar produção nem CI, e a regressão conjunta passou. Um primeiro teste visual usou julho de 2094, que corretamente incluía um pagamento no limite do mês criado pelo teste financeiro; o fixture foi isolado em agosto de 2088 e a asserção de notas passou a usar o ID do próprio recebimento. Não se enfraqueceram os limites de largura, dinheiro ou autorização. O bootstrap local por `db push` não demonstra a execução das migrações; essa confirmação pertence ao CI PostgreSQL 16.

## Revisão da impressão

A apresentação foi ensaiada em 320/390/1440 px, com limites de cartões/documento, botão de pelo menos 44 px, deslocação da tabela por teclado e chamada real ao comando de impressão. O modo de impressão remove o botão e usa A4, margens de 14 mm, cabeçalhos repetidos na tabela e rodapé de mês/página. Valores e nomes extensos quebram linha; não são truncados.

O fixture visual tem dois documentos do mesmo cliente, nomes/contactos/instalações longos sem espaços e 42 linhas de notas. A primeira versão reservava uma coluna estreita às notas e gerava seis páginas. As notas passaram a ocupar a largura total da tabela; a revisão seguinte identificou uma página quase vazia causada por regras de não fragmentação. A regra foi corrigida e o PDF final tem quatro páginas, com o mês vazio numa página. As cinco páginas foram renderizadas por `/usr/bin/pdftoppm` e inspecionadas visualmente, incluindo a continuação da tabela e os rodapés.

Evidência final: `reports/field-visual/monthly-print-1789713436508/`; renderização e prova local em `/tmp/task252-pdf-review/verified/`. A extração confirmou cada documento e as 42 linhas uma única vez e na ordem certa, marcadores inicial/final, rodapés i/N e todos os caracteres dentro das margens de segurança. A captura de 320 px foi revista. Os dados são artificiais de QA, não relatórios de clientes reais.

## Confirmação nativa

O CI identificado no estado aprovou todos os 146 grupos distintos, com código zero e sem omissões. Fontes do imprimível: 1558 ms; interface/PDF: 1077 ms; acesso: 1438 ms; API/interface ADMIN mensal: 4133/8464 ms; abertura autenticada: 8869 ms. As 20 migrações aditivas foram aplicadas; restauro confirmado em 110 tabelas/32 ficheiros, com linhas e hashes iguais. A aprovação inclui a projeção financeira partilhada e a paginação final.

Publicação de código: `cd04d24b942c42fdc5952bffe7a0521d33f635d0`; backup local `backup/task252-local-20260918`. Esta atualização de aprovação altera apenas documentação.

## Limites e próximo percurso

O saldo é atual; não foi criado fecho histórico, reconciliação bancária, razão financeiro novo ou estimativa de lucro. A leitura integral não constitui ensaio de carga de produção. A impressão foi comprovada no Chromium de QA; as opções da impressora/navegador podem alterar as margens. Traduções integrais e estados comerciais em vários idiomas permanecem fora deste lote.

Próximo: abertura autenticada do relatório individual a partir dos alertas, seguida da incorporação de fotografias com autorização confirmada. Relatórios EXTRA, fontes Unicode e restantes validações documentadas mantêm o seu âmbito próprio. Sem merge em main, deploy/VPS, fornecedores, envios reais ou emissão fiscal.
