# TASK284 — Lacunas na cobertura dos custos

Data: 22/09/2026. Branch: `work/field-readiness-20260915-simulation`. Base: `d1e76a2f6cf887abb828541ff36a8ab8a9637783`, encerramento documental da TASK283, publicado após recuperação da ligação ao GitHub. A árvore desse encerramento coincide com a local (`aea6840a2934789329449da2f5a11d00ddd0ff76`); checkout sincronizado sem força. Código anterior aprovado em `143b1ab`, CI 35690270703.

## Resultado

A área existente `/admin-ai` mostra **O que falta nos custos** e permite perguntar **O que falta registar?**. A IA recebe contagens e exemplos concretos para ajudar a completar os gastos antes de avaliar margens. Reutiliza `/api/ai-admin`, autenticação ADMIN e a consulta financeira transacional existentes. Não cria despesas, pagamentos, atribuições ou ações executáveis.

As ligações de compras de stock e manutenções de viaturas abrangem todos os meses, no estado atual. Compras registadas e manutenções concluídas são separadas entre ligações válidas, origens sem ligação e casos por rever. Estados desconhecidos, despesas ligadas anuladas, alterações da origem ou datas em falta são identificados. Fontes anuladas, rascunhos e tarefas ainda pendentes/em curso ficam excluídos destas candidatas. Datas ausentes não são inventadas.

Uma origem sem ligação pode já ter sido registada manualmente como despesa. O sistema pede conferência antes de criar outro registo; não declara automaticamente uma nova dívida nem que exista um pagamento em atraso. Estes indicadores contam registos e não acrescentam valores às despesas.

## Utilização

Em Gestão com IA, escolher Gestão financeira e o mês de análise, e carregar em Consultar dados. A secção O que falta nos custos distingue origens de todos os meses e serviços do mês selecionado. As listas expansíveis identificam compras, manutenções e visitas pelo tipo e número; as recomendações abrem o registo de despesas.

Antes de registar uma origem sem ligação, conferir fornecedor/documento e despesas manuais existentes. Para tempo ou consumo por completar, usar a despesa confirmada e o percurso de valorização existente. Quando uma valorização estiver por rever, confirmar a alteração da fonte e anular/recalcular conforme as regras já existentes. A conversa explica estas lacunas, mas não executa as correções.

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

Primeira verificação local aprovada: novo grupo de cobertura, API da IA financeira e interface Chromium real, incluindo 320/390/1440 px, contraste com preferência escura, sessões, fontes indisponíveis e respostas malformadas. `/tmp/cw284-focused.log`. 396 testes unitários/63 ficheiros aprovados em `/tmp/cw284-unit.log`. Sintaxe aprovada: 574 ficheiros backend, 189 frontend e 57 scripts inline em `/tmp/cw284-syntax.log`.

A versão final do teste acrescenta uma despesa manual sem ligação e serviços com consumo na interface. Versão final do grupo de cobertura/interface e regressões de atribuições, valorizações e valores operacionais aprovadas em `/tmp/cw284-final-local.log`. A regressão de despesas passou em `/tmp/cw284-regression.log`; essa invocação parou depois por um nome incorreto do script seguinte, corrigido na invocação final. Imagens em `reports/field-visual/financial-ai-*`, incluindo `coverage-320.png`, `coverage-390.png` e `coverage-1440.png`.

Código publicado em `556c8ee9accb68e66b07cf1e36334c7f575c3dfb`, árvore `a8f6e1dfe7e6aa0f6ec704953b3e3ae4bc32bfd0`, igual à validada localmente, na mesma branch autorizada e sem força. Backup local `backup/financial-cost-coverage-local-20260922` (`f32a0920f47a9a15bb5a14d3dcafd7b2a25c8e82`); checkout sincronizado após confirmar igualdade das árvores. A principal `feature/technicians-v25` continua ancestral e no mesmo SHA `6f27081e1d183ff584a62255b016b373836734db`. [CI 35693325875](https://github.com/ts7520305-svg/cristalwater/actions/runs/35693325875), job `106634737471`, terminou às 06:21:41 UTC de 22/09/2026 em 15m56s, com 171/172 grupos aprovados. Restauro omitido devido à falha descrita abaixo; esta execução não aprova o conjunto. Não há merge na principal, instalação no VPS, movimentos bancários, contactos ou fornecedor de IA real.


## Correção da espera no teste do portal

O único grupo falhado foi `test-field-e2e.js`: depois de simular uma resposta 503 dos documentos, verificava de imediato a piscina, cujo pedido independente ainda mostrava «A carregar piscinas...». Os restantes 171 grupos passaram, incluindo cobertura nova (3410 ms), IA financeira API/interface (2442/10022 ms), despesas (1198/6153 ms), atribuições (1447/6880 ms), valorizações (2113/7342 ms) e valores operacionais (354/4814 ms). Também passaram 396 testes unitários/63 ficheiros, quatro técnicos, 21 scripts gerais de navegador, 25 migrações e sintaxe 574/189/57.

O teste passa a reter deliberadamente a resposta saudável do portal até o erro documental estar visível, confirmar que a piscina ainda não foi apresentada, libertar essa resposta e aguardar a piscina esperada. Mantém as asserções da piscina e do erro documental, exercitando precisamente a ordem que falhou no CI; não acrescenta uma espera temporal arbitrária nem altera código do portal. Validação dirigida aprovada em `/tmp/cw284-e2e-wait.log`, incluindo percursos completos de técnico, cliente e administrador, sem falhas. A correção foi publicada com estes dois documentos e o CI/restauro repetido com sucesso.

Correção publicada em `b9dc0988787828088734014f0d0ff0dd6b17a03c`, árvore `d7d38e7da053815c21bb5968f3400ef5bd217579`, igual à local; três ficheiros (teste E2E e dois documentos), produção igual à primeira publicação. Backup `backup/financial-coverage-portal-wait-local-20260922` (`2f03b4ddd50fa9bcce3385e263cbf66bcc5a95af`); checkout alinhado sem força.

## Encerramento aprovado

[Segunda execução 35694816689](https://github.com/ts7520305-svg/cristalwater/actions/runs/35694816689), job `106639256111`, aprovada no commit `b9dc0988787828088734014f0d0ff0dd6b17a03c`. Início às 06:26:13 UTC e conclusão às 06:45:50 UTC de 22/09/2026, duração 19m37s; 17 passos concluídos com sucesso. Logs confirmam 172/172 grupos distintos, todos com código zero e sem sinal, 396 testes unitários/63 ficheiros, quatro testes de técnicos, 21 scripts gerais de navegador, 25 migrações aditivas e sintaxe 574 backend/189 frontend/57 scripts inline.

Cobertura dos custos aprovada em 5432 ms; IA financeira API/interface em 3906/12457 ms; despesas em 1822/7267 ms; atribuições em 2247/8564 ms; valorizações em 3239/9343 ms; valores operacionais em 521/5854 ms. O E2E completo, incluindo a ordem de respostas reproduzida, passou em 31052 ms. Restauro isolado em PostgreSQL 16 aprovado: 117 tabelas e 46 ficheiros carregados, com linhas da base de dados e hashes dos ficheiros iguais.

Este encerramento altera apenas o presente relatório e `CURRENT_WORK_CHECKPOINT.md`, mantendo o código e os testes da árvore aprovada. Publicação na branch de trabalho autorizada, sem força; principal `feature/technicians-v25` confirmada no mesmo SHA `6f27081e1d183ff584a62255b016b373836734db`. A TASK284 fica concluída neste âmbito. Próximo: completar restantes gastos e repartição das receitas antes de apurar margens fiáveis; bases salariais compostas e reconciliação dos emails permanecem separadas.
