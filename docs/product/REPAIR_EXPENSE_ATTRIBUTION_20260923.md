# TASK296 — despesas atribuídas a reparações

## Resultado e âmbito

A administração pode atribuir uma parcela manual de uma despesa registada a uma reparação com execução autenticada confirmada. A seleção em Despesas e contas a pagar usa primeiro o cliente original e depois a reparação; aceita clientes históricos inativos e não transfere custos quando a piscina muda de proprietário. A atribuição integra o relatório de custos por cliente/destino e a consulta da Gestão com IA por mês de execução.

São aceites as provas existentes de conclusão com reserva e movimentos de consumo ou a declaração explícita de execução sem materiais. Estado administrativo de conclusão, fatura, pagamento ou preço de venda não bastam. A operação não consome stock, emite documentos, regista pagamentos nem contacta terceiros. Não reconstrói execução física passada.

O montante é uma parcela positiva da despesa confirmada, limitada pelo saldo entre todos os destinos e meses, incluindo atribuições por rever. Não é calculado a partir do orçamento, preço da reparação, tarifas atuais ou custo de uma visita associada. A valorização automática de consumo/tempo continua limitada às visitas regulares e extra. Uma compra de stock atribuída à reparação permanece identificada como compra, separada do consumo valorizado.

## Identidade, prova e período

O destino tem tipo `REPAIR`, identificador da reparação e cliente original da prova de execução. Visita regular, visita extra e reparação com o mesmo número são identidades diferentes. A fotografia guardada inclui piscina, data UTC da execução, base de confirmação, identificador e impressão da prova e modo de materiais. O preço comercial e a progressão entre estados de conclusão válidos não alteram esta identidade.

A confirmação bloqueia o cliente histórico, a reparação e as fontes de execução existentes, voltando a verificar a prova depois dos bloqueios. Alterações à origem, data, cliente, reserva, movimentos, prova ou duplicação da prova retiram a confirmação. O total afetado exige revisão; o orçamento da despesa continua reservado até anulação explícita. A revisão conserva montante, destinatário e mês; a anulação conserva o histórico e permite uma nova parcela expressa.

A data do documento, o mês explícito da atribuição e o mês UTC da execução permanecem separados. Apenas parcelas confirmadas com o mesmo mês entram nos custos alinhados por execução. Divergências de período são apresentadas separadamente; custos sem período confirmável ficam por rever. Um custo desconhecido não se torna zero. Receitas, custos completos e margem continuam por apurar; IVA e faturação fiscal permanecem externos.

## Persistência e interface

A 28.ª migração acrescenta `ExpenseAllocation.repairId`, índice e restrições da identidade. Não altera valores existentes nem preenche atribuições antigas. Não há nova tabela ou dependência de produção. A identidade histórica não tem chave estrangeira para a reparação: apagar a origem operacional conserva a parcela e a fotografia para revisão/anulação, sem mover o custo para outro serviço.

É reutilizado o protocolo transacional de despesas: versão, pedido por conta/UUID, orçamento, evento e recibo na mesma transação, consulta do resultado e reenvio do pedido original. A interface verifica identidade, cliente, período e impressão da prova; recibos incompatíveis permanecem pendentes até recuperação válida. Rascunhos não restauram o consentimento. Alterações de sessão limpam os dados apresentados. Texto livre é literal.

Escolher uma reparação retira as opções de valorização medida. Se havia um cálculo, limpa o montante e o mês antes da repartição manual. A página explica o âmbito da parcela e adapta as cores ao modo escuro; cache v112. Mantêm-se pesquisa, paginação e acesso às origens do custo.

## Verificação

- API: reparações com e sem materiais, fecho administrativo insuficiente, cliente inativo e transferência da piscina, identidade coincidente entre tipos, limites entre destinos/meses, duplicados, pedidos concorrentes iguais/distintos, recuperação do resultado e falhas atómicas.
- Alterações de movimentos, origem, data, estado e prova, duplicação da prova, preço comercial independente, revisão de despesa e anulação após apagar a reparação. Corrida entre alteração da origem e atribuição deixa a parcela recusada ou por rever, nunca apresentada como custo confirmado da origem alterada.
- Treze destinos em duas páginas e onze parcelas de 37 cêntimos: total integral de 407 cêntimos, sem truncagem pela página. Parcela de 2200, compra de 900 e divergência de 500 cêntimos conservadas em componentes distintos; mês documental diferente do mês de execução.
- Navegador real: seleção do cliente original, confirmação manual, duplo clique, resposta perdida/recarregamento, reenvio exato, cliente/prova adulterados, detalhe de custos por execução, revisão/anulação, rascunhos e sessão. Larguras 320/390/1440 e modo escuro.
- Migração sobre o esquema anterior, preservação dos campos existentes e comprovativos, restrições inválidas recusadas, identidade preservada após apagar a reparação e coincidência final com o esquema Prisma.

API/UI novas e regressões de despesas, atribuição, valorização medida e valores por execução aprovadas localmente. 401 unitários/64 ficheiros; sintaxe 591/194/60; 28 migrações. Logs `/tmp/cw296-runtime/final-ui-api.log`, `ui-regressions.log`, `final.log`, `migrations.log` e `unit.log`. O navegador local foi alinhado com Chromium 149 do Playwright. A execução integral da versão corrigida publicada foi aprovada, conforme evidência abaixo. O runner passa de 189 para 191 grupos. A validação local usa um adaptador PostgreSQL; concorrência nativa e restauro foram confirmados no CI PostgreSQL 16. Nenhum destes ensaios representa aprovação global de produção ou piloto físico.

## Publicação e CI

Primeira publicação sem força em `07a4da63247551fa34a6e6a9bd44fa03b9a83e75`, árvore `f07042a2f53b218875c3dafc5ca4ea6be3371ba2`, igual à validada localmente. Backup `backup/repair-expenses-local-20260923` (`3a8da4cd2d8d0dcb82e1f983ce5a2f598372a62d`). [CI 35821370750](https://github.com/ts7520305-svg/cristalwater/actions/runs/35821370750), job `107053729885`, terminou com 190/191 grupos aprovados: falhou apenas o contraste dos indicadores de saldo por pagar em modo escuro (1,445:1). Os novos grupos de reparações passaram, tal como 401 unitários/64 ficheiros, quatro técnicos, sintaxe e 28 migrações; o restauro foi omitido pela falha. Esta execução não aprova o lote. Principal `feature/technicians-v25` inalterada em `6f27081e1d183ff584a62255b016b373836734db`. Sem merge, deploy ou contactos reais.

A correção adapta o fundo dos indicadores ao modo escuro, mantém o requisito de contraste mínimo 4,5:1 e acrescenta identificação dos elementos ao diagnóstico. Seletores longos usam truncagem visual no espaço disponível, sem retirar opções. Cache v112. Os testes locais completos `test-field-company-expenses-ui.js` e `test-field-repair-costs-ui.js` passaram depois da correção (`/tmp/cw296-runtime/contrast-fix.log`), incluindo recuperação, sessão, larguras 320/390/1440 e contraste. O novo CI integral PostgreSQL 16 e o restauro da versão corrigida foram aprovados.

Correção publicada sem força em `09d399a93744d4b87702816496f159322b2fb957`, árvore `8bec86bf2ed45572b90f18bd6727dbb515b4c64d`, igual à local. Backup `backup/repair-expenses-contrast-local-20260923` (`f7c6bd7454d5d465f720ebb32130d782a235bbae`). [CI 35823208111](https://github.com/ts7520305-svg/cristalwater/actions/runs/35823208111), job `107059297189`, aprovado em 23/09/2026 às 06:04:03 UTC.

## Fecho confirmado

A versão corrigida `09d399a93744d4b87702816496f159322b2fb957` (árvore `8bec86bf2ed45572b90f18bd6727dbb515b4c64d`) passou as 17 etapas do CI entre 05:37:58 e 06:04:03 UTC de 23/09/2026, em 26m05s. Os logs completos foram conferidos contra a lista do runner: 191/191 grupos distintos previstos, todos com código zero e sem sinal, sem grupos em falta, inesperados ou duplicados. Passaram também 401 testes unitários/64 ficheiros, quatro testes técnicos, o gate geral do navegador, sintaxe 591/194/60 e as 28 migrações aditivas.

O restauro PostgreSQL 16 confirmou 121 tabelas e 46 ficheiros, com linhas da base e hashes dos ficheiros iguais. Custos de reparações API/UI: 7350/10038 ms; despesas UI: 7373 ms, incluindo o contraste corrigido; custos API/UI: 2921/10227 ms; valorização API/UI: 3965/10931 ms; valores por execução API/UI: 19196/26777 ms. Evidência durável em `evidence/20260923_task296_ci.json`, incluindo a primeira tentativa falhada e a respetiva correção.

Este fecho altera apenas documentação após o código validado. A principal `feature/technicians-v25` permanece em `6f27081e1d183ff584a62255b016b373836734db`; sem merge, deploy ou contactos reais. A atribuição manual fica concluída neste âmbito. Valorização medida de materiais/tempo de reparações, restantes gastos, base de trabalho composta e correção explícita de períodos continuam pendentes; custos e receitas completos e margem permanecem por apurar.
