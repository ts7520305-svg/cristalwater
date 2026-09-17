# TASK219 — Ronda diária completa

## Problema e comportamento

`/api/technician/today` e `/api/visits/today` limitavam implicitamente as consultas a 200 visitas (300 com limite explícito). O total era o tamanho já cortado, pelo que os ecrãs e a cache podiam apresentar uma lista parcial como ronda completa. A revisão de fim de dia podia omitir pendências depois desse limite.

Os dois endpoints devolvem por omissão todas as visitas que correspondem ao dia e à autorização atual. A rota moderna conserva REGULAR e EXTRA com identidade tipada, incluindo números iguais entre tipos; a rota antiga mantém o contrato apenas REGULAR. A atribuição e os filtros de datas/estados existentes continuam aplicados antes da apresentação.

## Páginas explícitas

| Pedido/campo | Contrato |
|---|---|
| Sem `limit`/`offset` | Lista completa usada pelos ecrãs operacionais |
| `limit=N` | Inteiro positivo, até 300 elementos da lista combinada por página |
| `offset=N` | Inteiro não negativo, apenas com limite explícito |
| `total` | Número de visitas na lista completa autorizada |
| `returned` | Número de visitas devolvidas nesta resposta |
| `complete` | Verdadeiro apenas se a resposta começar no primeiro elemento e contiver a lista inteira |
| `hasMore`/`nextOffset` | Indicam a página seguinte; `nextOffset` é nulo no fim |

Ordenação determinística por data e ID; em empate entre tipos, REGULAR precede EXTRA. Parâmetros inválidos recebem 400. As páginas são calculadas sobre a lista do pedido atual; não são um snapshot transacional conservado entre pedidos. Se houver alterações entre páginas, um consumidor externo deve atualizar a consulta. Os ecrãs operacionais pedem a lista completa numa única resposta.

## Ecrãs e dados offline

Modo de campo, página antiga, mapa, rota, histórico diário, assistência e revisão de fim de dia exigem confirmação de lista completa. Uma página parcial não substitui a cache nem confirma a revisão. A ronda moderna pode apresentar a cópia completa já guardada, claramente sem confirmação atual; mapas/rota/histórico recusam a resposta parcial.

As caches de ronda passam a v3 porque as v2 podem conter o corte antigo. Os bytes v2 são preservados sob a chave anterior, sem migração automática para uma alegada lista completa. Sem v3, o dispositivo explica que precisa de consultar com rede. A consulta válida cria uma v3 separada. Rascunhos, fotografias, pedidos e respetivas identidades não mudam de versão por este motivo. O service worker passa a v48.

## Evidência

- `run-1789635538241`: `test-field-complete-daily-route.js`, recuperação moderna e recuperação antiga aprovados. Fixture com 305 REGULAR e 305 EXTRA, IDs iguais, visita de outro técnico, futura e cancelada; consulta completa, páginas concatenadas sem perda/duplicação, última página vazia e parâmetros inválidos.
- Chromium real: última visita regular depois de 300, nota existente e recarga offline; mapa/rota/histórico com últimos registos; respostas parciais recusadas; revisão de fim de dia incompleta explícita; cache completa intacta; caches v2 modernas/antigas preservadas e consulta online cria v3 completa.
- `run-1789635618707`: E2E completo, entrada TEAM_LEADER por PIN/email e rascunhos modernos com concorrência/fotografia EXTRA aprovados na árvore final. 388 unitários/quatro técnicos, 17 scripts de navegador e sintaxe de 539 ficheiros backend aprovados.
- Runner integrado passa a 122 grupos. Confirmação nativa da árvore publicada e restauro ainda pendentes.

## Limites

As consultas diárias completas têm custo proporcional à lista autorizada. A paginação explícita limita a resposta, mas esta implementação ainda materializa a lista antes de a dividir; não demonstra dimensionamento de produção nem paginação no banco para conjuntos arbitrariamente grandes. O ensaio de 610 visitas é funcional, não um compromisso de capacidade. Conservam-se os avisos de quota/leitura falhada e o comportamento de atribuição atual no servidor. Sem migração de schema, deploy ou alteração em main.

Continuar a revisão das restantes filas/documentos e o inventário visual por perfil a partir da matriz atual, sem usar a fotografia TASK82 como lista atual de defeitos.
