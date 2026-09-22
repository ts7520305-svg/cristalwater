# TASK283 — Valorização documentada de materiais e trabalho

Início: 21/09/2026. Branch: `work/field-readiness-20260915-simulation`. Base: `b6539ba9ddc3b86bcf5978629096f85d5739f221`, encerramento da TASK282. Implementação e validação local concluídas. Publicação bloqueada em 22/09/2026: conector GitHub e gestão de plugins devolvem HTTP 400 `Invalid MCP request metadata`; `git push --dry-run` confirma ausência de autenticação direta. Nenhum commit desta tarefa foi enviado. CI PostgreSQL 16 e restauro continuam por confirmar.

## Percurso e significado dos valores

A área existente `/admin-expenses` passa a calcular atribuições a visitas regulares e extra concluídas a partir de fontes confirmadas. A repartição manual continua disponível. O administrador escolhe a forma de apurar o valor, revê o serviço e a base, calcula, justifica e confirma. O montante e o mês calculados ficam protegidos de edição; o mês corresponde à conclusão do serviço em UTC.

Materiais: selecionar uma despesa ligada a uma compra existente e a linha documentada que sustenta o consumo. O cálculo usa o total e quantidade dessa linha e o consumo líquido do serviço, descontando devoluções. Aceita consumo direto e consumo de distribuição de emergência; transferências não são consumo. Produto, unidade, cliente, instalação e identidade REGULAR/EXTRA precisam de ser coerentes. Identificadores diferentes de produto ou movimentos ambíguos exigem revisão. Registos antigos sem productId apenas são utilizáveis com correspondência explícita de nome normalizado e unidade. A data da compra não pode ser posterior ao serviço.

O administrador pode distribuir o consumo entre linhas/lotes, confirmando a quantidade de cada origem. A aplicação não infere FIFO nem aplica o preço atual do catálogo a consumos passados. A quantidade total valorizada não pode ultrapassar o consumo líquido do serviço/produto, a quantidade comprada nem o total da linha. O orçamento de toda a despesa, incluindo repartições manuais e outros meses, também permanece limitado.

Trabalho: numa despesa manual de trabalho/salários, confirmar técnico, primeiro e último dia e todos os minutos pagos ou abrangidos pelo documento, incluindo tempo não atribuído a serviços. O valor é proporcional ao tempo medido de cada visita, usando o total confirmado da despesa e esse denominador. Início/fim, técnico e período têm de coincidir. Técnicos inativos continuam identificáveis para registos históricos. Taxas atuais `hourlyCost`/`costPerVisit` não entram neste cálculo.

Só existe uma valorização de trabalho ativa por visita tipada, mesmo entre despesas distintas. Esta etapa não reúne automaticamente vários documentos salariais ou encargos numa base composta. A cobertura de custos permanece parcial. Alterar a base requer anular primeiro as valorizações ativas; os recibos e fontes anteriores mantêm-se no histórico.

## Integridade e correções

As valorizações são parte das atribuições da despesa já registada, não uma segunda despesa ou pagamento. Quantidades usam seis casas decimais exatas, BigInt no cálculo e Decimal(18,6) na persistência. Montantes são cêntimos inteiros positivos. O último consumo completo de uma base recebe o remanescente de cêntimos, evitando ultrapassar ou perder o total por arredondamentos. Quantidades cujo valor não chega a um cêntimo são recusadas explicitamente.

SET_LABOR_BASIS, VALUE_MATERIAL e VALUE_LABOR reutilizam UUID, titular ADMIN, versão, transação e auditoria da despesa. Bloqueios da despesa e do serviço serializam o orçamento e as reservas de uma mesma medição entre despesas. O serviço fica bloqueado durante a confirmação, incluindo inserções de movimentos ligados por chave estrangeira; os movimentos e linhas de origem também são revistos sob bloqueio. Alterações posteriores tornam as atribuições afetadas incertas na consulta.

O pedido inclui o hash da prévia, do destinatário e da fonte. O servidor recalcula antes de escrever. Fotografias da fonte, cálculo, despesa e serviço ficam associadas à atribuição; o recibo original permanece imutável. Alterações de consumo/devolução, compra, cliente, técnico, duração ou base de trabalho exigem revisão. Uma valorização alterada deve ser anulada e calculada de novo: a confirmação genérica de uma atribuição manual não pode validar um cálculo antigo. Anular liberta a reserva e conserva o registo anterior.

O navegador guarda rascunhos por conta/despesa e conserva pedidos pendentes no mecanismo durável já existente. Recarga não envia novamente; consulta e repetição usam o pedido exato. Respostas perdidas ou malformadas não são tratadas como sucesso. Mudanças de conta, despesa, método, lote, quantidade ou destinatário invalidam prévias em curso, incluindo mudança A–B–A. Não há alterações financeiras efetuadas pela IA.

## Relatórios e IA

`finance.expenses.attribution.valuations` apresenta consumo e tempo valorizados, contagem, revisões e bases. Os dois montantes estão incluídos nas atribuições existentes e não devem voltar a somar-se às despesas. A consulta completa sustenta os totais; valores afetados por revisão ficam por confirmar, em vez de zero. A área de despesas e a Gestão com IA mostram estes subconjuntos e a cobertura parcial.

O relatório por cliente inclui materiais e trabalho valorizados; o relatório por técnico mostra trabalho valorizado pela identidade histórica do serviço. Estimativas com taxas atualmente configuradas continuam explicitamente distintas. A resposta financeira local e o contexto do fornecedor opcional explicam as origens e evitam duplicação. Lucro, custo operacional completo, margem, saldo bancário e previsões não são fabricados.

## Migração e validação

25.ª migração aditiva: `20260922010000_expense_measurement_valuation`. Acrescenta `ExpenseLaborBasis` e campos de valorização a `ExpenseAllocation`; registos existentes conservam todos os campos anteriores e passam a MANUAL, sem quantidades/fontes calculadas. Chaves restritivas preservam técnico e linha de compra referenciados. Verificações SQL cobrem forma tipada, quantidades positivas, unidade do trabalho, período, tempo pago, motivo e estado ativo/anulado; índice único protege a medição de trabalho.

Dois grupos novos no runner, agora com 171 grupos. Cache frontend v99. Validação local: API de valorizações, interface Chromium real e regressões de despesas, atribuições, IA financeira e ambos os relatórios operacionais. Os testes abrangem visitas REGULAR/EXTRA com o mesmo número, clientes/técnicos históricos, quantidades/cêntimos exatos, compras diferentes a partilhar um consumo, concorrência, alterações da fonte, devoluções, limites de tempo pago, rollback, cancelamento e repetição de pedidos, totais completos e ausência de dupla contagem. Interface verificada em 320/390/1440 px e com preferência de cor escura, preservando a legibilidade do tema existente.

Ambiente temporário PGlite/Chromium isolado, com serviços externos desativados. A configuração local de ligações/statement cache e fontes do navegador foi corrigida sem alterações às dependências/configuração de produção. PostgreSQL nativo local não estava disponível para execução autorizada; a confirmação nesse motor e o restauro pertencem ao CI obrigatório. Evidência dirigida: `/tmp/cw283-regressions1.log`, `/tmp/cw283-unit.log`, `/tmp/cw283-tech.log`, `/tmp/cw283-browser.log`, `/tmp/cw283-syntax.log`, `/tmp/cw283-migration5.log`; imagens em `reports/field-visual/expense-valuations-*`. 396 testes unitários/63 ficheiros, quatro técnicos, 21 scripts gerais de navegador, 25 migrações desde o esquema anterior e sintaxe 573 backend/189 frontend/57 inline aprovados. O teste do índice único usa o mesmo bloco SQL de captura das restantes restrições, confirmando SQLSTATE 23505 sem depender da tradução de erros pelo simulador local. CI e restauro ainda por confirmar.

Comparação remota inicial: branch de trabalho alinhada, principal `feature/technicians-v25` (`6f27081e1d183ff584a62255b016b373836734db`) ancestral. Publicar apenas na branch autorizada, sem força, e confirmar árvore remota igual à local. Não efetuar merge ou instalação no VPS nesta etapa. IVA/faturação fiscal mantêm-se no programa externo; preços e frequências continuam específicos de cada cliente, época e instalação.

Próximo trabalho: completar os restantes gastos, a cobertura de custos e a repartição das receitas antes de apresentar margens. A reconciliação de emails e as bases salariais compostas permanecem percursos separados.

Retoma após recuperação do acesso: consultar novamente a branch remota, publicar o commit local sem força, confirmar a mesma árvore e acompanhar os 171 grupos e o restauro completo. Backup local `backup/expense-measurement-valuation-local-20260922`. A skill de gestão de plugins foi consultada apenas para diagnóstico; não houve alteração de permissões ou ligações.
