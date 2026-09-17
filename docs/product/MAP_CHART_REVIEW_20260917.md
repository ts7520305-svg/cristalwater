# Revisão pendente dos mapas e gráficos antigos

Este registo conserva a triagem inicial. TASK233 trata /admin-map e /route-map, conforme `ADMIN_MAP_RECOVERY_20260917.md`; TASK234–235 tratam /map e /multi-map, conforme `GEOGRAPHIC_AND_MULTI_MAP_RECOVERY_20260917.md`. Permanecem /profit-map, o seu planeador e /technician-profit-dashboard. Base da triagem: `e1b9ddc4353781de43d04f716ae725bea47dc306` (TASK231–232).

## Evidência

O ensaio de 45 entradas reais da TASK229, com pedidos externos bloqueados, reproduziu `L is not defined` em `/admin-map`, `/map`, `/multi-map`, `/profit-map` e `/route-map`; `/technician-profit-dashboard` produziu `Chart is not defined`. O mesmo ensaio também encontrou os defeitos de ranking e prioridades depois tratados na TASK230. Os resultados locais desse ensaio ficaram em `/tmp/task229-page-audit/results.json`; não foram confundidos com cobertura de todas as páginas.

A leitura autenticada ADMIN em QA isolada `run-1789662888980` confirmou `/api/pools` com HTTP 200 e objeto `{ ok, pools }`, `/api/routes/optimize` e `/api/routes/multi-profit-route` com HTTP 404, e o endereço existente `/api/route/optimize` com HTTP 200 e array. O ensaio só consultou estes contratos; não validou nem corrigiu os mapas.

| Página | Falha identificada na triagem | Critério para fechar |
|---|---|---|
| `/admin-map` | Usa Leaflet externo sem guarda. `loadPools` e `loadRoute` aceitam apenas array, embora `/api/pools` responda `{ ok, pools }`. Coordenada zero é ignorada e os popups interpolam nomes. | Leitura validada, nomes literais, coordenadas válidas incluindo zero, falhas e ausência da biblioteca com alternativa utilizável. |
| `/route-map` | Usa Leaflet sem guarda; pede `/api/routes/optimize`, mas o router de otimização está montado em `/api/route`. Falha de GPS é silenciada; nova carga não remove as camadas anteriores. | Endpoint existente, estado explícito de GPS/rede, nova consulta sem camadas antigas e exportação apenas de destinos confirmados. |
| `/multi-map` | Usa Leaflet sem guarda e pede `/api/routes/multi-profit-route`; essa rota não consta dos routers ativos revistos. | Definir e validar o contrato com o planeamento existente, preservar perfis/identidades e apresentar falha sem um falso mapa vazio. |
| `/map` | Aceita a forma atual de piscinas, mas depende de Leaflet; a filtragem por valor lógico elimina latitude/longitude zero. | Falha de recurso externo, dados/coordenadas, nomes literais, atualização e mudança de conta. |
| `/profit-map` | Usa Leaflet sem guarda; coordenadas convertidas com `Number` podem transformar ausência em zero; renderiza o primeiro plano retornado. | Seleção/identidade do plano explícita, coordenadas ausentes distintas de zero e alternativa sem biblioteca. |
| `/technician-profit-dashboard` | Chart.js externo é chamado sem guarda e a data inicial fixa é 2025. O backend usa `User.role = tecnico`, associação pelo nome e critérios próprios de receitas/custos. | Separar funcionamento da página da definição financeira; rever a população, identidade, período, fontes e custos reais antes de chamar ao indicador «lucro real». |

## Percursos que já têm alternativa

`/admin-live-map` trata falhas de inicialização/tiles com mapa operacional interno. `/technician-map` conserva a lista e as ligações de navegação quando Leaflet não está disponível; possui ainda proteções de sessão, resposta completa e identidade REGULAR/EXTRA. A próxima intervenção deve aproveitar estes percursos e as suas regressões, sem substituir a sua proteção por uma nova implementação genérica.

`/admin-dashboard` verifica a existência de Chart/Leaflet antes de criar os gráficos, mas omitir um gráfico não equivale a informar claramente o utilizador de todas as falhas. `/metrics` passou a usar barras locais na TASK232.

As bibliotecas externas bloqueadas simulam indisponibilidade; o ensaio não demonstra falha permanente do fornecedor. Devem também ser distinguidas falha da biblioteca, falha dos tiles e falha da consulta operacional. Permanecem pendentes a revisão dos restantes HTML/PDFs e os ensaios físicos/VPS descritos na matriz atual.

## Revisão complementar na TASK233

O botão «Atribuir zonas» de /map só escreve associações na consola e apresenta «Zonas atribuídas»; não persiste atribuições. Corrigir a alegação e definir um percurso verificável de pré-visualização/aprovação antes de implementar gravações. Não substituir isto por atribuição automática silenciosa.

A consulta autenticada em QA `run-1789664433390` confirmou /api/routes/auto-plan com HTTP 200 e `ok:false`; o servidor regista `Unknown field extras for include statement on model Pool`. A revisão do código também encontra planeamento baseado em User.role=tecnico e visitas antigas. A substituição de um nome de relação, por si só, não comprova a identidade, completude, período nem as fontes financeiras de um plano. /route-map da TASK233 usa o endpoint separado de sugestões regulares e não depende desse planeador.

TASK233 fechada para /admin-map e /route-map no commit `083dc7f600e989236c2611eae5724dc0be35923a`, CI `35250616882` aprovado com 126 grupos e restauro de 110 tabelas/32 ficheiros. As falhas das restantes páginas nesta triagem continuam pendentes.

TASK234–235 substituem a falsa atribuição por pré-visualização explícita e ligam /multi-map ao contrato diário completo existente. Não corrigem nem validam as fontes financeiras do planeador antigo. CI/restauro da nova árvore por confirmar.
