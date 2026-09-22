# TASK284 — Lacunas na cobertura dos custos

Data: 22/09/2026. Branch: `work/field-readiness-20260915-simulation`. Base: `d1e76a2f6cf887abb828541ff36a8ab8a9637783`, encerramento documental da TASK283, publicado após recuperação da ligação ao GitHub. A árvore desse encerramento coincide com a local (`aea6840a2934789329449da2f5a11d00ddd0ff76`); checkout sincronizado sem força. Código anterior aprovado em `143b1ab`, CI 35690270703.

## Resultado

A área existente `/admin-ai` mostra **O que falta nos custos** e permite perguntar **O que falta registar?**. A IA recebe contagens e exemplos concretos para ajudar a completar os gastos antes de avaliar margens. Reutiliza `/api/ai-admin`, autenticação ADMIN e a consulta financeira transacional existentes. Não cria despesas, pagamentos, atribuições ou ações executáveis.

As ligações de compras de stock e manutenções de viaturas abrangem todos os meses, no estado atual. Compras registadas e manutenções concluídas são separadas entre ligações válidas, origens sem ligação e casos por rever. Estados desconhecidos, despesas ligadas anuladas, alterações da origem ou datas em falta são identificados. Fontes anuladas, rascunhos e tarefas ainda pendentes/em curso ficam excluídos destas candidatas. Datas ausentes não são inventadas.

Uma origem sem ligação pode já ter sido registada manualmente como despesa. O sistema pede conferência antes de criar outro registo; não declara automaticamente uma nova dívida nem que exista um pagamento em atraso. Estes indicadores contam registos e não acrescentam valores às despesas.

## Medições dos serviços

Os serviços usam o mês de conclusão em UTC e mantêm identidades REGULAR/EXTRA separadas, mesmo com o mesmo número. Clientes e técnicos históricos inativos são incluídos. O tempo fica valorizado apenas quando há uma valorização ativa, válida e correspondente à duração completa. Falta de cliente/técnico/duração ou uma valorização alterada ficam por rever; anulações deixam de contar como valorização.

O consumo é agrupado por serviço, nome canónico do produto e unidade, usando a mesma normalização e precisão de seis casas decimais das valorizações. Soma consumos e subtrai devoluções; não mistura unidades ou produtos distintos. Valorização parcial, integral, inexistente, saldo líquido zero e casos por rever têm contagens distintas. Compras diferentes podem valorizar partes do mesmo consumo, sem declarar cobertura integral enquanto faltar quantidade. Fontes alteradas, referências de produto incompatíveis, quantidades inválidas, excesso de devoluções ou de quantidade valorizada deixam o grupo por rever.

Uma consulta de um mês passado usa o estado atual: devoluções registadas posteriormente também alteram o consumo líquido. Não reconstrói um fecho histórico. Serviços sem movimentos são explicitamente apresentados como sem consumo/devolução registado; não como custo zero. Movimentos do mês sem um único serviço existente são contados à parte; um movimento com serviço existente de outro mês não entra indevidamente no denominador dos serviços selecionados. Serviços concluídos sem data são separados pelo mês planeado.

Os totais não são truncados. A interface e a IA recebem até dez exemplos de origens e dez de serviços, com total e indicação de amostra. São listas para conferência; não substituem os totais nem certificam que todos os gastos da empresa foram recolhidos. A cobertura permanece PARTIAL, custos completos falsos e lucro nulo, mesmo quando não há lacunas detetadas. Restantes gastos, bases de trabalho compostas, repartição das receitas, margens e previsões continuam etapas próprias.

## Integridade e interface

`financialCostCoverageService` recebe as despesas já decoradas da mesma transação RepeatableRead do contexto financeiro. Reutiliza revisões das fontes, fotografias e regras de validade das valorizações, sem duplicar a leitura integral do registo de despesas. Os indicadores de cobertura têm as suas próprias bases; não alteram o significado de recebimentos, saldos, despesas ou atribuições existentes.

Falha de qualquer consulta deixa o contexto financeiro indisponível, com cobertura e valores nulos; a IA externa não é chamada. O navegador valida mês, data da consulta, bases, contagens inteiras, somas dos grupos, limites e identidade das amostras. Dados malformados são recusados. Mudanças de mês/conta, respostas antigas, BFCache e perda de ligação conservam as proteções anteriores. Listas de origens e serviços são apagadas quando a sessão muda e conteúdo dinâmico é apresentado como texto literal.

Sem migração ou dependência nova. Mantêm-se 25 migrações; cache frontend v100. Runner com 172 grupos. IVA/faturação fiscal continuam externos; preços e frequências variam por cliente, época e instalação.

## Validação e publicação

Primeira verificação local aprovada: novo grupo de cobertura, API da IA financeira e interface Chromium real, incluindo 320/390/1440 px, contraste com preferência escura, sessões, fontes indisponíveis e respostas malformadas. `/tmp/cw284-focused.log`. 396 testes unitários/63 ficheiros aprovados em `/tmp/cw284-unit.log`. Sintaxe em `/tmp/cw284-syntax.log`.

A versão final do teste acrescenta uma despesa manual sem ligação e serviços com consumo na interface. Regressões de atribuições, valorizações e valores operacionais em `/tmp/cw284-final-local.log`. A regressão de despesas passou em `/tmp/cw284-regression.log`; essa invocação parou depois por um nome incorreto do script seguinte, corrigido na invocação final. Imagens em `reports/field-visual/financial-ai-*`, incluindo `coverage-320.png`, `coverage-390.png` e `coverage-1440.png`.

Publicar apenas na branch autorizada, com árvore igual à validada localmente e sem força. CI PostgreSQL 16 completo e restauro ainda por confirmar para esta alteração. Não há merge na principal, instalação no VPS, movimentos bancários, contactos ou fornecedor de IA real.
