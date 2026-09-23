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

Escolher uma reparação retira as opções de valorização medida. Se havia um cálculo, limpa o montante e o mês antes da repartição manual. A página explica o âmbito da parcela e adapta as cores ao modo escuro; cache v111. Mantêm-se pesquisa, paginação e acesso às origens do custo.

## Verificação

- API: reparações com e sem materiais, fecho administrativo insuficiente, cliente inativo e transferência da piscina, identidade coincidente entre tipos, limites entre destinos/meses, duplicados, pedidos concorrentes iguais/distintos, recuperação do resultado e falhas atómicas.
- Alterações de movimentos, origem, data, estado e prova, duplicação da prova, preço comercial independente, revisão de despesa e anulação após apagar a reparação. Corrida entre alteração da origem e atribuição deixa a parcela recusada ou por rever, nunca apresentada como custo confirmado da origem alterada.
- Treze destinos em duas páginas e onze parcelas de 37 cêntimos: total integral de 407 cêntimos, sem truncagem pela página. Parcela de 2200, compra de 900 e divergência de 500 cêntimos conservadas em componentes distintos; mês documental diferente do mês de execução.
- Navegador real: seleção do cliente original, confirmação manual, duplo clique, resposta perdida/recarregamento, reenvio exato, cliente/prova adulterados, detalhe de custos por execução, revisão/anulação, rascunhos e sessão. Larguras 320/390/1440 e modo escuro.
- Migração sobre o esquema anterior, preservação dos campos existentes e comprovativos, restrições inválidas recusadas, identidade preservada após apagar a reparação e coincidência final com o esquema Prisma.

API/UI novas e regressões de despesas, atribuição, valorização medida e valores por execução aprovadas localmente. 401 unitários/64 ficheiros; sintaxe 591/194/60; 28 migrações. Logs `/tmp/cw296-runtime/final-ui-api.log`, `ui-regressions.log`, `final.log`, `migrations.log` e `unit.log`. O navegador local foi alinhado com Chromium 149 do Playwright. Publicação/CI serão fechados depois da execução integral da versão publicada. O runner passa de 189 para 191 grupos. A validação local usa um adaptador PostgreSQL; concorrência nativa e restauro são confirmados no CI PostgreSQL 16. Nenhum destes ensaios representa aprovação global de produção ou piloto físico.
