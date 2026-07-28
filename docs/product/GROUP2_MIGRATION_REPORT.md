# GROUP2_MIGRATION_REPORT

Data: 2026-07-19
Fase: 3.2.1 - Fechar mapeamento e concluir o Grupo 2
Estado: concluido

## Escopo pedido
- Admin Clients
- Admin Pools
- Admin Technicians
- Admin Teams
- Admin Schedule
- Admin Rounds

## Tabela de mapeamento
| Conceito solicitado | Pagina real | JS real | Motivo | Estado |
| --- | --- | --- | --- | --- |
| Admin Clients | `frontend/admin-clients.html` | `frontend/admin-clients.js` | Modulo explicito de clientes, com criacao, edicao, arquivo e ligacao a conta corrente/piscinas/pagamentos. | EQUIVALENTE CONFIRMADO |
| Admin Pools | `frontend/admin-pools.html` | `frontend/admin-pools.js` | Modulo explicito de piscinas/jacuzzis, associacao a cliente, ronda e ficha tecnica. | EQUIVALENTE CONFIRMADO |
| Admin Technicians | `frontend/admin-technicians.html` | `frontend/admin-technicians.js` | Modulo explicito de tecnicos, ativo/inativo, contacto, PIN, zona e ligacao operacional. | EQUIVALENTE CONFIRMADO |
| Admin Teams | `frontend/admin-technicians.html` + `frontend/admin-rounds.html` | `frontend/admin-technicians.js` + `frontend/admin-rounds.js` | Nao existe `admin-teams.*`. A gestao de equipa esta distribuida: tecnicos/listagem/estado em Technicians; atribuicao e organizacao operacional em Rounds. Menus e navegacao referem "Tecnicos e equipa" apontando para `/admin-technicians` e `/admin-rounds`. | FUNÇÃO DISTRIBUÍDA |
| Admin Schedule | `frontend/admin-rounds.html` + apoio de `frontend/admin-today.html` e `frontend/admin-visits-dashboard.html` | `frontend/admin-rounds.js` + `frontend/admin-today.js` + `frontend/admin-visits-dashboard.js` | Nao existe `admin-planning.*`, `admin-calendar.*` ou `admin-agenda.*`. O planeamento editavel real esta em Rounds: filtros por data/semana/dia, geracao semanal, atribuicao, drag-and-drop, alteracao de datas/horas, visitas extra e gravacao. Today e Visits Dashboard sao vistas operacionais/consulta, nao o centro de planeamento. | FUNÇÃO DISTRIBUÍDA |
| Admin Rounds | `frontend/admin-rounds.html` | `frontend/admin-rounds.js` | Modulo explicito de rondas com criacao, atribuicao de tecnico, associacao de piscinas, reordenacao e planeador semanal. | EQUIVALENTE CONFIRMADO |

## Provas de mapeamento
- Nao existem ficheiros `admin-planning`, `admin-calendar` ou `admin-agenda` no frontend.
- [frontend/admin-menu.html](frontend/admin-menu.html) agrupa "Clientes e equipas" com links para `admin-technicians` e `admin-rounds`.
- [frontend/crystal-os-v2-nav.js](frontend/crystal-os-v2-nav.js) declara `'/admin-technicians': { area: 'Tecnicos e equipa', title: 'Equipa tecnica' }` e `'/admin-rounds': { area: 'Operacao', title: 'Rotas e rondas' }`.
- [frontend/admin-rounds.js](frontend/admin-rounds.js) contem os fluxos de agenda/planeamento: `visitDateFilter`, `visitWeekFilter`, `visitDayFilter`, `reassignVisit`, `saveVisitFromRow`, `generateWeek`, `createExtraVisits`, `movePoolToRound`.
- [frontend/admin-today.js](frontend/admin-today.js) e [frontend/admin-visits-dashboard.js](frontend/admin-visits-dashboard.js) sao vistas de consulta/execucao e nao substituem o planeador editavel.

## Paginas concluidas
- [frontend/admin-clients.html](frontend/admin-clients.html)
- [frontend/admin-pools.html](frontend/admin-pools.html)
- [frontend/admin-technicians.html](frontend/admin-technicians.html)
- [frontend/admin-rounds.html](frontend/admin-rounds.html)

## Paginas nao existentes
- `frontend/admin-teams.html`
- `frontend/admin-teams.js`
- `frontend/admin-planning.html`
- `frontend/admin-calendar.html`
- `frontend/admin-agenda.html`

## Funcoes distribuidas
- Equipa: distribuida entre Technicians e Rounds.
- Agenda operacional: distribuida entre Rounds (edicao/atribuicao/planeamento), Today (resumo do dia) e Visits Dashboard (consulta legacy de visitas).

## Componentes migrados/removidos
- Botoes legacy substituidos por `cw-v2-btn`.
- Badges/pills legacy substituidos por `ds-badge`.
- Cards/containers locais alinhados ao baseline DS + shell V2.
- Filtros sem label substituidos por `label + input/select` explicitos.
- Estados de feedback/empty/status remapeados para tokens DS.

## CSS removido ou neutralizado
- Temas dark locais dominantes em Clients, Pools, Technicians e Rounds neutralizados em favor do baseline DS.
- Estilos redundantes de `btn`, `pill`, `card`, `status`, `input` e `textarea` substituidos pelos equivalentes do baseline.
- Ajuste compartilhado em `frontend/ui/components/input.css` para garantir pesquisa do shell com minimo de 44px.
- Ajuste compartilhado em `frontend/cw-polish.css` para sidebar legacy com minimo de 44px.

## Testes executados
Para cada pagina concluida:
- `npm run check:syntax`
- `npm test`
- `npm run smoke`
- Playwright desktop `1440`, tablet `1024`, mobile `390`

Evidencias:
- [docs/product/evidence/group2/admin-clients-validation.json](docs/product/evidence/group2/admin-clients-validation.json)
- [docs/product/evidence/group2/admin-pools-validation.json](docs/product/evidence/group2/admin-pools-validation.json)
- [docs/product/evidence/group2/admin-technicians-validation.json](docs/product/evidence/group2/admin-technicians-validation.json)
- [docs/product/evidence/group2/admin-rounds-validation.json](docs/product/evidence/group2/admin-rounds-validation.json)
- Screenshots after em [docs/product/evidence/group2/after](docs/product/evidence/group2/after)

## Resultado tecnico consolidado
- Clients: status 200, sem erros JS, sem warnings relevantes, sem requests inesperados, sem scroll horizontal, sem campos sem label, sem alvos abaixo de 44x44.
- Pools: status 200, sem erros JS, sem warnings relevantes, sem requests inesperados, sem scroll horizontal, sem campos sem label, sem alvos abaixo de 44x44.
- Technicians: status 200, sem erros JS, sem warnings relevantes, sem requests inesperados, sem scroll horizontal, sem campos sem label, sem alvos abaixo de 44x44.
- Rounds: status 200, sem erros JS, sem warnings relevantes, sem requests inesperados, sem scroll horizontal, sem campos sem label, sem alvos abaixo de 44x44.

## Validacao funcional confirmada por codigo e runtime
### Rounds
- Listar: sim
- Criar: sim
- Editar: sim
- Atribuir tecnico: sim
- Associar piscinas: sim
- Alterar ordem / mover entre rondas: sim
- Filtrar: sim
- Guardar: sim
- Cancelar/nao aplicar: implicito via formularios e confirmacoes existentes
- Estado vazio: sim
- Erro: sim

### Agenda
- Carregar data: sim, em `admin-rounds`
- Navegar/filtrar por dia e semana: sim, em `admin-rounds`
- Visualizar visitas: sim, em `admin-rounds`, `admin-today` e `admin-visits-dashboard`
- Atribuir: sim, em `admin-rounds`
- Reagendar: sim, em `admin-rounds`
- Abrir visita: a vista principal continua a ser `admin-visits`; `admin-today` faz deep link para a visita
- Estado vazio: sim
- Erro: sim

### Equipa
- Listar tecnicos: sim
- Ativo/inativo: sim
- Disponibilidade dedicada: nao existe modulo dedicado; a representacao atual e indireta por estado e atribuicao
- Atribuicao: sim, em `admin-rounds`
- Organizacao operacional: sim, distribuida entre `admin-technicians` e `admin-rounds`

## Regressões
- Nenhuma regressao funcional detetada nas paginas concluidas.
- O `401` de `/api/dashboard/metrics` no smoke continua esperado sem token e nao representa regressao do Grupo 2.

## Limitacoes
- Nao foi identificado modulo standalone para Teams.
- Nao foi identificado modulo standalone para Schedule/Agenda.
- A disponibilidade da equipa nao tem ecrã dedicado; permanece coberta apenas por estado ativo/inativo e atribuicao em rondas.
