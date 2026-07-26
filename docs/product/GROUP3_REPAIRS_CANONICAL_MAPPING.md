# GROUP3_REPAIRS_CANONICAL_MAPPING

Data: 2026-07-19
Fase: 3.3.1 - Resolver destino canonico de Reparacoes
Escopo desta fase: apenas mapeamento/decisao, sem migracao visual de outras paginas do Grupo 3

## 1) Inventario consolidado de Reparacoes

Evidencia estrutural:
- Backend dedicado existe e esta montado em `/api/repairs` com ciclo completo de rotas.
- Nao existe pagina dedicada `admin-repairs.*` nem `repair-center.*`.
- Navegacao admin aponta para reparacoes via `admin-alerts?scope=repairs`.
- Fluxo tecnico cria reparacao a partir de problema de visita (modo campo/core-flow).

Fontes principais:
- `src/routes/repairRoutes.js`
- `src/controllers/repairController.js`
- `src/business/repair/RepairBusiness.js`
- `src/routes/coreFlowRoutes.js` (rotas de problema/conclusao de visita)
- `frontend/admin-alerts.html` + `frontend/admin-alerts.js`
- `frontend/technician-field-mode.html` + `frontend/technician-field-mode.js`
- `frontend/technician-visit.html` + `frontend/technician-visit.js`
- `frontend/admin-master-control.html`

## 2) Runtime nao destrutivo

Evidencia runtime gerada:
- `docs/product/evidence/group3/repairs/runtime-repairs-mapping.json`

Resumo:
- Login Admin: OK.
- Login Tecnico: NAO VALIDADO (credenciais de tecnico indisponiveis no ambiente).
- Login Cliente: NAO VALIDADO (credenciais de cliente indisponiveis no ambiente).
- Admin:
  - `GET /api/repairs/pool/:poolId` retornou 200 com lista de reparacoes reais.
  - `GET /api/alerts` e `GET /api/alerts?scope=repairs` retornaram 200 com itens contendo `repairId`, `repair.status`, `repair.priority`, `repair.totalPrice`.
  - `admin-alerts?scope=repairs` abriu e exibiu contexto de reparacoes.

## 3) Fluxos reais por acao

| Acao | Pagina/fluxo atual | JS | Endpoint | Funciona? |
|---|---|---|---|---|
| Criar reparacao | Tecnico reporta problema em visita no modo campo | `frontend/technician-field-mode.js` | `POST /api/core/visits/:id/problem` | SIM |
| Criar reparacao (alternativo) | Conclusao de visita com problema | `frontend/technician-field-mode.js` / `frontend/technician-visit.js` | `POST /api/core/visits/:id/complete` | PARCIAL |
| Listar reparacoes | Admin consulta por fluxo de alertas e por piscina | `frontend/admin-alerts.js` + contexto de pagina piscina | `GET /api/alerts?scope=repairs`, `GET /api/repairs/pool/:poolId` | SIM |
| Abrir reparacao | Nao existe detalhe canonico dedicado; acesso indireto por alerta/piscina | `frontend/admin-alerts.js` | sem rota frontend dedicada | PARCIAL |
| Editar reparacao (dados gerais) | Sem formulario dedicado em frontend | n/a | backend suporta `PUT /api/repairs/:id/*` | NAO |
| Alterar prioridade | Exibida em alertas; sem controlo de edicao dedicado visivel | `frontend/admin-alerts.js` | backend suporta transicoes de estado | PARCIAL |
| Alterar estado | Exibido no contexto de alertas; ciclo suportado por backend | `frontend/admin-alerts.js` (leitura) | `PUT /api/repairs/:id/diagnose|schedule|approve|close|complete|cancel` | PARCIAL |
| Associar piscina | Associacao feita na criacao via visita/pool | `frontend/technician-field-mode.js` + core flow | `POST /api/core/visits/:id/problem` | SIM |
| Associar tecnico | Associacao indireta pela visita/tecnico que reporta | `frontend/technician-field-mode.js` | `POST /api/core/visits/:id/problem` | SIM |
| Adicionar notas | Incluidas no reporte de problema e fluxo de visita | `frontend/technician-field-mode.js` / `frontend/technician-visit.js` | `POST /api/core/visits/:id/problem`, `POST /api/core/visits/:id/complete` | SIM |
| Adicionar fotografias | Upload de foto existe na API de reparacao; UI dedicada nao confirmada nesta fase | n/a (UI direta de reparacao nao localizada) | `POST /api/repairs/:id/photo` | NAO VALIDADO |
| Associar orcamento | Backend dedicado; UI dedicada de reparacao nao localizada | n/a | `PUT /api/repairs/:id/quote` | NAO VALIDADO |
| Concluir reparacao | Backend dedicado; UI dedicada de reparacao nao localizada | n/a | `PUT /api/repairs/:id/complete` / `PUT /api/repairs/:id/close` | NAO VALIDADO |
| Cancelar reparacao | Backend dedicado; UI dedicada de reparacao nao localizada | n/a | `PUT /api/repairs/:id/cancel` | NAO VALIDADO |
| Consultar historico | Historico tecnico existe por piscina/alertas; historico dedicado de reparacoes nao encontrado | `frontend/admin-pool-technical.js` + `frontend/admin-alerts.js` | `GET /api/repairs/pool/:poolId` + agregacoes de alertas | PARCIAL |

## 4) Classificacao final (PASSO 3)

Classificacao: B - FUNCAO DISTRIBUIDA

Justificativa objetiva:
- Existe operacao real de reparacoes no backend e nos fluxos de campo/admin.
- Nao existe um centro unico de UI de Reparacoes no frontend.
- O uso real esta distribuido entre:
  - triagem admin por alertas,
  - criacao tecnica durante visita,
  - consulta contextual por piscina.

## 5) Destino canonico de UI

Destino canonico atual: fluxo distribuido, sem pagina unica.

Nucleo canonico por papel:
- Admin: `admin-alerts?scope=repairs` para triagem/monitorizacao.
- Tecnico: `technician-field-mode` e `technician-visit` para origem de pedidos de reparacao.
- Contexto tecnico/cliente interno: `admin-pool-technical` como ponto de consulta por piscina.

## 6) Paginas que devem entrar na migracao do Grupo 3 (somente trilho Reparacoes)

Entram:
- `frontend/admin-alerts.html`
- `frontend/admin-alerts.js`
- `frontend/technician-field-mode.html`
- `frontend/technician-field-mode.js`
- `frontend/technician-visit.html`
- `frontend/technician-visit.js`
- `frontend/admin-master-control.html` (apenas alinhamento de navegacao para este trilho)

Nao entram nesta fase:
- criacao de nova pagina de reparacoes
- alteracoes backend/API/schema

## 7) Funcionalidades em falta

- UI dedicada para edicao completa de ciclo de reparacao (diagnostico/orcamento/aprovacao/agendamento/conclusao/cancelamento) num unico lugar.
- Detalhe dedicado de reparacao com historico e anexos no frontend admin.
- Validacao runtime de consulta por cliente nao concluida nesta fase por indisponibilidade de credenciais cliente no ambiente.

## 8) Recomendacao final

- Recomendacao: GRUPO 3 PODE CONTINUAR.
- Condicao: tratar Reparacoes explicitamente como FUNCAO DISTRIBUIDA no escopo de migracao, sem inventar pagina nova.
- Bloqueio restante para inicio do Grupo 3: NAO.
