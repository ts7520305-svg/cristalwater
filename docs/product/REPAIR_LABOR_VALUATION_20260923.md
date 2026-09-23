# TASK299 — valorização dos intervalos de trabalho nas reparações

## Resultado e âmbito

Em Despesas e contas a pagar, uma despesa manual de trabalho com base confirmada pode valorizar um intervalo de reparação. A administração escolhe a reparação com execução autenticada, consulta os intervalos, escolhe um registo declarado e confirmado e calcula o custo antes de o confirmar expressamente. O técnico do intervalo tem de coincidir com o técnico da base paga. Todo o intervalo tem de estar dentro do período, com o último dia inclusive em UTC.

A duração continua declarada e confirmada, conforme a TASK298. Não é um cronómetro automático ou uma verificação física independente. A execução pode ter materiais reservados ou ser uma declaração sem materiais. O cliente é o cliente original da prova autenticada, incluindo históricos inativos e piscinas cujo titular mudou.

Cada intervalo é valorizado inteiro e uma única vez enquanto houver uma atribuição ativa, mesmo entre despesas diferentes. A mesma reparação pode ter vários intervalos e técnicos: cada registo usa a base que lhe corresponde. Um intervalo que atravesse períodos pagos não é cortado automaticamente; é preciso corrigir expressamente os intervalos, conservando o histórico. A base atual continua a ser uma despesa e um técnico; encargos compostos de vários documentos não são somados implicitamente.

## Cálculo, orçamento e período

O cálculo usa o montante confirmado da despesa dividido pelos segundos abrangidos pelos minutos pagos, multiplicado pelos segundos do intervalo. As contas usam inteiros escalados e cêntimos. O último consumo de todo o tempo da base recebe o remanescente exato, evitando perder ou duplicar cêntimos por arredondamento. Intervalos de reparações e tempos de visitas partilham os limites de segundos e valor da mesma despesa. Atribuições manuais também consomem o valor disponível do documento.

O mês da atribuição é o mês UTC da execução autenticada da reparação, conservando a semântica dos materiais e da consulta por execução. O período do documento e do tempo pago pode ser diferente; a aplicação não move datas nem reescreve documentos para os fazer coincidir. O cálculo não usa o preço comercial, uma taxa atual do técnico ou o valor faturado ao cliente. A atribuição faz parte da despesa existente; não cria pagamento, fatura ou segundo gasto.

## Evidência, concorrência e revisão

A fotografia da valorização conserva o identificador, impressão e fotografia imutável do intervalo, a prova da execução, o técnico, horários, segundos, autoria e justificação original, a base paga e o cálculo. O contrato novo é identificado por fonte versão 3 e `EXPLICIT_AUTHENTICATED_REPAIR_WORK_INTERVAL`. As impressões dos destinos e das fontes anteriores de materiais/visitas permanecem iguais.

A chave ativa `LABOR:REPAIR:<reparação>:INTERVAL:<intervalo>` impede reutilizar o intervalo noutra despesa. O comando bloqueia a despesa, a valorização da reparação, os tempos dessa reparação, a origem histórica, o técnico e o intervalo. Usa a mesma ordem e bloqueios da declaração/anulação dos tempos. Intervalo selecionado, execução, períodos e orçamentos são relidos dentro da transação antes de gravar a atribuição, versão e recibo. Pedidos repetidos recuperam o mesmo resultado; recusas de contexto alterado também são duráveis.

A consulta financeira reutiliza as verificações da página de tempos: integridade do intervalo, fonte autenticada, existência do técnico e sobreposições conhecidas com outras reparações e visitas. Alterações posteriores, intervalos anulados, provas removidas ou orçamentos incoerentes deixam o custo por rever. São também verificados a fotografia efetivamente guardada e o uso da duração integral. Renomear um técnico ou alterar um preço comercial não reescreve o tempo original.

Uma anulação do intervalo não apaga a atribuição nem o recibo: retira-lhe a confirmação. O orçamento continua reservado até a administração anular expressamente a valorização. A correção cria novo histórico e exige cálculo/consentimento novos. A remoção da reparação ou do intervalo não apaga as identidades históricas guardadas nas fotografias. Os percursos de visitas mantêm os bloqueios existentes; horários alterados posteriormente podem exigir revisão e não são impedidos por um bloqueio geral de capacidade.

## Interface e relatórios

A interface identifica o intervalo, nome original do técnico, horários UTC, duração declarada, base paga, custo e mês de execução. Intervalos incompatíveis ficam indisponíveis; a confirmação verifica ainda o orçamento atual. Os nomes e justificações são apresentados literalmente. O histórico mostra qual o intervalo valorizado e permite anular a atribuição sem alterar os pagamentos.

O rascunho conserva a escolha do intervalo, mas não o cálculo nem o consentimento. A consulta de intervalos, cálculo e recibo verificam o contexto da despesa, reparação, cliente, técnico, prova e período. Respostas inválidas ou atrasadas são rejeitadas. Pedido pendente e repetição conservam o UUID e todos os campos, incluindo o intervalo. Uma resposta perdida após gravação é recuperada por consulta, sem novo POST. Mudanças de sessão limpam os dados apresentados.

Os custos entram nas consultas existentes por cliente, técnico e mês de execução e em Gestão com IA. O resumo de valorizações passa a versão 3, com a base `CONFIRMED_DECLARED_REPAIR_INTERVAL_PAID_TIME` explícita. Continuam custos conhecidos parciais; compras, consumo e pagamento não são somados como o mesmo gasto, e não se apura margem completa. Cache v115; sem dependência nova.

## Migração e validação local

A 31.ª migração altera a restrição das valorizações e acrescenta a restrição específica da identidade do intervalo. Não acrescenta tabelas ou colunas, não preenche históricos e mantém 122 tabelas. Conserva integralmente atribuições, intervalos e recibos existentes. A restrição verifica fonte/tipo, intervalo positivo, fotografia, identidades históricas, segundos inteiros e chave ativa compatível. A unicidade ativa e a anulação foram ensaiadas, bem como a conservação do custo após apagar a origem.

- API nova: execução com/sem materiais, cliente original/inativo, técnico e período, intervalos adjacentes e equipa, destino de outro tipo com o mesmo ID, recusa de intervalo errado/parcial ou a atravessar períodos.
- Orçamento partilhado entre visitas/reparações, cêntimo final, três pedidos iguais concorrentes, disputa do mesmo intervalo por despesas diferentes e valorização concorrente com anulação do tempo.
- Reversão integral de atribuição/versão/recibo em falhas forçadas; recuperação exata, recusa durável, revisão de sobreposição posterior, alteração de base ou fotografia, duração parcial adulterada, anulação/correção e remoção da reparação.
- Navegador Chromium 149: seleção explícita e rascunho sem consentimento, fontes/recibos adulterados mesmo com impressões recalculadas, respostas atrasadas, clique duplo, perda de resposta, consulta/repetição exata, histórico/anulação, custos em Gestão com IA, sessão A–B–A e texto literal.
- API/UI de valorização de visitas e materiais de reparações passaram; API de tempos da TASK298 também passou. Visuais 320/390/1440 e modo escuro revistos. 401 unitários/64 ficheiros e sintaxe 593 backend/196 frontend/61 scripts inline aprovados. 31 migrações aprovadas.

Validação local com PGlite e Chromium 149. Logs `/tmp/cw299-api-regressions.log`, `/tmp/cw299-ui.log`, `/tmp/cw299-final.log`, `/tmp/cw299-migrations.log`, `/tmp/cw299-unit.log` e `/tmp/cw299-syntax.log`. Visuais finais em `reports/field-visual/repair-labor-1790153852974/`. Os 197 grupos completos, concorrência nativa e restauro foram posteriormente confirmados no CI PostgreSQL 16 da versão publicada, conforme a evidência abaixo.

## Continuidade e limites

Base `21b7bd48012ba621e46e66787f4695f3e26a30ce`, branch `work/field-readiness-20260915-simulation`. Principal `feature/technicians-v25` conservada em `6f27081e1d183ff584a62255b016b373836734db`; sem merge, instalação no VPS ou contactos reais.

Próximo: base composta de custo do trabalho e restantes gastos, correção explícita das divergências de período e restantes origens/ajustes de receita, mantendo os custos parciais e as fontes históricas. Encargos de vários documentos não cabem ainda numa única valorização do intervalo. Históricos/apresentação, volume, fornecedores reais e piloto físico continuam por fechar. IVA e emissão fiscal permanecem externos; preços e frequências dependem de cada cliente/época.

## Publicação e CI

Código publicado sem força e com árvore igual à validada localmente: commit `78679215a438b09bc65169a1970e6474026f342a`, árvore `93189e38cde3d450ae2165f400927dec3cb5803a`, [CI 35840505468](https://github.com/ts7520305-svg/cristalwater/actions/runs/35840505468), job `107114162074`: 17 etapas aprovadas entre 09:01:43 e 09:25:29 UTC de 23/09/2026 (23m46s). Logs completos conferidos: 197/197 grupos previstos distintos, código zero/sem sinal, sem falta ou duplicação; 401 unitários/64 ficheiros, quatro técnicos, gate geral do navegador, 31 migrações e sintaxe 593/196/61. Restauro PostgreSQL 16: 122 tabelas/46 ficheiros, linhas e hashes iguais.

API/UI de trabalho valorizado aprovadas em 3537/11646 ms; tempos declarados API/UI 1979/5212 ms; materiais de reparações API/UI 3317/10397 ms; valorização de visitas API/UI 3649/9606 ms. Todos os grupos previstos foram conferidos sem falta, entrada inesperada, duplicação ou sinal.

Evidência completa em `evidence/20260923_task299_ci.json`. Backup `backup/repair-labor-local-20260923` (`6a24dc60d70ad4f0f5364e76385b90fa8d187bfd`). O fecho posterior altera apenas documentação e conserva a árvore do código, migrações e testes aprovados. Base composta/restantes gastos, correção explícita de períodos e restantes receitas continuam pendentes; não se apura margem completa. Esta aprovação não abrange instalação no VPS, fornecedores reais ou piloto físico.
