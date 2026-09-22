# TASK288 — Origem documental das reparações

## Âmbito e limite

Continuação autorizada da gestão financeira, após a TASK287. Base `aaad4fef7413747d955b4d5f3f777237c0f392e7`, branch `work/field-readiness-20260915-simulation`. A principal permanece separada; sem merge, deploy ou contactos reais. IVA no programa externo, preços e frequências por cliente, contrato e época.

Os registos anteriores da reparação e da faturação não conservam sempre o cliente, a linha e os dados comerciais exatos em conjunto. A propriedade atual da piscina e a coincidência de valores não bastam para reconstruir essa origem. Acresce que `doneAt` e estados de fecho podem representar fecho administrativo: não certificam, por si, a execução física.

Esta etapa guarda a origem documental na criação de novas faturas. A Gestão com IA separa “Reparações documentadas”, sem as apresentar como trabalhos executados ou receita completa do mês de execução. Documentos antigos sem comprovativo exato continuam por rever. Sem preenchimento retroativo, alteração de preços, cobrança adicional ou cálculo de margens.

## Comprovativo e compatibilidade

- Reutiliza `AuditTrail` com evento `REPAIR_DOCUMENT_ORIGIN_RECORDED`, entidade `InvoiceLine` e ID da linha. Não acrescenta esquema, tabelas, migrações ou dependências: permanecem 26 migrações e 119 tabelas.
- O comprovativo contém documento, linha, reparação, cliente e piscina originais, valores/quantidade/descrição/dados da linha, dados comerciais da reparação, estado/data indicados no momento, autor, data de captura e hash canónico. Não copia os custos privados das versões de orçamento.
- É escrito na mesma transação de criação: rascunho financeiro genérico, faturação direta de reparação e três percursos de geração mensal. Qualquer falha ao guardar o comprovativo reverte a criação; falhas posteriores também revertem o comprovativo. Não há novo envio de notificações ou contacto externo.
- Bloqueios das reparações e piscinas, IDs ordenados e verificação do cliente protegem a captura. Na geração mensal, os dados usados no cálculo têm de coincidir com a origem capturada; alteração durante a geração provoca recusa e rollback.
- Mantêm-se os bloqueios anteriores de cliente/origem, a reserva de uma reparação por documento histórico e a proteção contra repetição entre meses e percursos.
- Emissão, consulta, pagamento e repetição de pedidos não criam nem atualizam comprovativos retroativamente. O comprovativo não tem FKs novas que impeçam os percursos existentes; sobrevive à retirada da linha/documento/reparação.
- Os documentos válidos e preços explícitos continuam a ser responsabilidade do fluxo de faturação. O comprovativo confirma a origem e o valor documental, não representa uma aprovação de orçamento nem prova de execução.

## Conciliação na Gestão com IA

`finance.revenueCoverage` versão 4 acrescenta `repairDocumentedAmountCents`, `lines.repairDocumented` e a amostra `linkedRepairs`. A base é `ORIGINAL_DOCUMENT_LINE_AND_REPAIR_SNAPSHOT_NO_EXECUTION_PROOF`. Sete parcelas somam exatamente os documentos conciliados, pelo mês documental, sem duplicação dos valores ou dos recebimentos.

Exige uma única referência REPAIR em documentos ativos de todos os meses e um único comprovativo válido para a linha. Aliases contraditórios reservam as identidades explícitas para revisão; outra categoria com o mesmo número não é uma reparação. Documentos com créditos, ajustes, impostos, tipos ou totais divergentes conservam as exclusões/revisões existentes.

Cliente, linha e dados comerciais devem corresponder ao comprovativo. Alterar a quantidade, preço, descrição, notas ou período da linha, dados comerciais/piscina da reparação, eliminar a origem, cancelar ou usar um estado desconhecido deixa a ligação por rever. O pagamento ou progressão administrativa de estado não reescreve o comprovativo. Mudar o proprietário/nome atual da piscina ou desativar o cliente não transfere o histórico.

Linhas antigas sem comprovativo, linhas substituídas e referências ausentes ficam por rever, sem inferências a partir do texto. Não existe comando automático de correção ou atribuição retroativa nesta etapa.

Totais completos e amostra identificada de dez origens, com cliente, piscina, reparação, documento/linha, valor e estado registado. Cada reparação mantém `executionConfirmed:false`, inclusive com estado DONE/CLOSED, e não recebe um mês de execução inferido. A interface e a IA explicam esta limitação; receita completa, margem e lucro continuam por estabelecer.

A interface valida versão, bases, contagens, somas, identidades, estados e amostras, e mantém texto literal e isolamento por mês/conta. Falha de leitura do comprovativo deixa o contexto financeiro indisponível/nulo e impede a chamada ao fornecedor externo. Conversas não criam cobranças, pagamentos ou comandos financeiros executáveis.

## Validação local

- API nova: comprovativos reais nos cinco percursos, falha de gravação/rollback/repetição, alteração de preço entre cálculo e captura, linha e cliente originais, preços explícitos diferentes do preço do registo, cliente inativo, mudança de proprietário, identidade por categoria, duplicados noutro mês/aliases, linhas e fontes alteradas/retiradas, comprovativos ausentes/malformados/repetidos e conservação após remoção.
- Fecho ou pagamento não se transforma em execução comprovada. Emissão de documento antigo não cria prova retroativa. Totais completos e amostra maior que dez, partição exata, conversa local/modelo simulado, ausência de escritas financeiras na leitura e falhas de fonte.
- Regressões: faturação direta atómica, reserva da reparação entre meses/percursos, pagamentos, IA API/UI, receitas de manutenção, repartição mensal API/UI, faturação de manutenção, alertas, orçamentos e portal de decisão. O teste anterior de faturação atómica passou a verificar também a preservação/rollback dos novos comprovativos.
- UI a 320/390/1440 px e modo escuro, nomes longos/texto literal, estado “fechada” com execução por confirmar, respostas malformadas, sessão, offline e respostas atrasadas. Sete cartões e detalhe de reparações; sem ação de escrita nova na interface.
- 396 testes unitários/63 ficheiros. Sintaxe 580 backend/190 frontend/58 inline. `git diff --check` aprovado. Runner 177 grupos, cache v104.
- Evidência transitória: `/tmp/cw288-focused.log`, `/tmp/cw288-final-focused.log`, `/tmp/cw288-final-receipts-ui.log`, `/tmp/cw288-unit.log`, `/tmp/cw288-syntax.log`. O primeiro ensaio de falha no comprovativo revelou uma exceção não tratada no controlador de rascunhos: podia encerrar o processo. O controlador agora devolve erro controlado e sem detalhes privados, aconselhando consulta antes de repetir; o teste confirma o rollback e a continuidade do servidor. Não foram removidas asserções de integridade.

## Publicação e validação nativa

Código publicado sem força na branch de trabalho: commit `c3c91a5b796fcbdb6f044c8cc1a07f44f2aa80c4`, árvore `23951f04116d052e1a960e3cfd04c4a337ed87c5`, igual à árvore local validada. Backup local `backup/repair-document-origin-local-20260922` (`7008c2094db1949a5b875ab4e5e96b854b48a80c`). Vinte ficheiros alterados, cache v104; principal preservada, sem merge ou deploy.

[CI PostgreSQL 16 — 35750362285](https://github.com/ts7520305-svg/cristalwater/actions/runs/35750362285), job `106822576129`: aprovado em 22/09/2026, das 15:53:45 às 16:12:40 UTC, duração 18m55s. Identidade do commit e as 17 etapas confirmadas nos metadados; resultados conferidos nos logs completos:

- 177/177 grupos distintos, todos com código zero e sem sinal; 396 unitários/63 ficheiros e quatro testes técnicos aprovados. Gate geral de navegador aprovado.
- 26 migrações aditivas preservam os dados anteriores e coincidem com o esquema atual. Sintaxe: 580 ficheiros backend, 190 frontend e 58 scripts inline.
- Nova origem de reparações em 20471 ms; faturação atómica em 880 ms, reserva mensal em 1824 ms e pagamentos em 750 ms. IA API/UI em 6007/16453 ms; cobertura documental em 16750 ms, repartição mensal API/UI em 4818/8880 ms, faturação de manutenção em 14759 ms e E2E em 29397 ms.
- Restauro isolado PostgreSQL 16 aprovado: 119 tabelas e 46 ficheiros carregados, com igualdade das linhas e dos hashes dos ficheiros.

Evidência compacta local: `/tmp/cw288-ci-evidence.json`. O encerramento posterior altera apenas este documento e `CURRENT_WORK_CHECKPOINT.md`, preservando todo o código e os testes da árvore aprovada. A aprovação desta etapa não transforma origem documental em prova de execução nem remove as limitações da cobertura financeira.

Próximo âmbito: prova explícita da execução das reparações e alinhamento dos períodos; restantes origens/ajustes, revisão das linhas históricas e custos completos antes de margens ou previsões. Reconciliação de emails permanece separada.
