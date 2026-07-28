# RC2 Technical Debt Report

Os numeros automaticos nao representam falhas confirmadas. Apenas os achados validados manualmente devem entrar no plano RC2.

Data: 2026-07-19
Modo: auditoria read-only (sem alteracao de codigo, sem commit, sem branch, sem migration)

## Achados automaticos
- Alta: 337
- Media: 915
- Baixa: 76

Composicao das Altas automaticas:
- `route-protection`: 327
- `file-size (>1000 linhas)`: 10

Observacao:
- As Altas automaticas foram geradas por heuristicas agressivas.
- Foi executada validacao manual e runtime read-only para reclassificacao.

## Achados confirmados manualmente
### 1) Rotas potencialmente desprotegidas (Alta)
Validacao feita em 61 ficheiros de rotas marcados como Alta (categoria `route-protection`), incluindo testes read-only de endpoints GET com:
- sem token
- token invalido
- token de tecnico (perfil errado em rotas administrativas)

Resultado (por ocorrencias Alta da categoria rota):
- Confirmado: 270
- Ja mitigado: 20
- Necessita investigacao: 37
- Falso positivo: 0

Criterio usado:
- `CONFIRMADO`: endpoint respondeu 2xx sem token em rota nao intencionalmente publica.
- `JA MITIGADO`: endpoint respondeu 401/403 sem token de forma consistente.
- `NECESSITA INVESTIGACAO`: mistura de comportamentos, 404 sistematico em amostra, ou cobertura incompleta por tipo de endpoint.

Exemplos confirmados (sem token => 200):
- `src/routes/coreFlowRoutes.js` (`/api/core/health`, `/api/core/dashboard`, `/api/core/clients`)
- `src/routes/guideRoutes.js` (`/api/guides/vehicles`, `/api/guides/transport`)
- `src/routes/repairRoutes.js` (`/api/repairs/pool/:poolId`)
- `src/routes/operationalStateRoutes.js` (`/api/operational-state/locks`)
- `src/routes/enterpriseCrmRoutes.js` (`/api/crm/leads`, `/api/crm/appointments`)
- `src/routes/keyRoutes.js` (`/api/keys`, `/api/keys/holder/:id`)
- `src/routes/billingRoutes.js` (`/api/billing/monthly`, `/api/billing/extras`)
- `src/routes/chatRoutes.js` (`/api/chat`, `/api/chat/overview`)

Exemplos ja mitigados (sem token => 401/403):
- `src/routes/aiAdminRoutes.js`
- `src/routes/aiOpsRoutes.js`
- `src/routes/incidentRoutes.js`

### 2) Ficheiros grandes (>1000 linhas) (Alta automatica, validacao manual de risco)
Nao foram tratados como falha automatica; foram reclassificados por risco real RC2:

Refatoracao prioritaria:
- `src/routes/coreFlowRoutes.js` (2251)
- `src/business/repair/RepairBusiness.js` (1557)
- `frontend/technician-field-mode.js` (2484)
- `frontend/client-portal.js` (1833)

Refatoracao futura:
- `src/controllers/guideController.js` (1349)
- `src/routes/technicianRoutes.js` (1292)
- `frontend/admin-dashboard.js` (1622)
- `frontend/technician.js` (1403)
- `scripts/reset-and-seed-stress-real-db.js` (1313)

Tamanho aceitavel no contexto atual (monitorizar):
- `frontend/admin-vehicles.js` (1040)

## Falsos positivos
- Altas classificadas como falso positivo apos validacao manual: 0

## Ja mitigados
- Altas ja mitigadas (categoria rotas): 20
- Evidencia: 401/403 em testes sem token/token invalido/perfil errado.

## Necessitam investigacao
- Altas por investigar: 37
- Motivos principais:
  - amostra GET com 404 sem comprovar protecao efetiva em outros metodos
  - endpoints com comportamento misto no mesmo ficheiro
  - necessidade de revisar cadeia completa de middleware por modulo

## Revisao manual do Top 20
| Ficheiro | Linhas | Responsabilidade | Rotas/Funcoes | Protecao existente | Testes existentes | Risco real | Prioridade RC2 |
|---|---:|---|---|---|---|---|---|
| src/routes/coreFlowRoutes.js | 2251 | Fluxos core (clientes/piscinas/visitas/faturacao) | 47 rotas / 63 funcoes | Nao evidente no router | Sem evidencia direta dedicada | Alto | P0 RC2 |
| src/routes/guideRoutes.js | 78 | Guias, frota e stock de viatura | 31 rotas / 0 funcoes locais | Nao evidente no router | Sem evidencia direta dedicada | Alto | P0 RC2 |
| src/routes/repairRoutes.js | 57 | Reparacoes (CRUD/estado/foto/pdf) | 15 rotas / 0 funcoes locais | Nao evidente no router | Sem evidencia direta dedicada | Alto | P0 RC2 |
| src/routes/operationalStateRoutes.js | 66 | Estado operacional e locks | 12 rotas / 0 funcoes locais | Nao evidente no router | Sem evidencia direta dedicada | Alto | P1 RC2 |
| src/routes/operationalFlowRoutes.js | 540 | Fluxo operacional e faturacao | 7 rotas / 15 funcoes | Nao evidente no router | Sem evidencia direta dedicada | Alto | P1 RC2 |
| src/routes/enterpriseCrmRoutes.js | 17 | CRM/agenda | 11 rotas / 1 funcao | Nao evidente no router | Sem evidencia direta dedicada | Alto | P1 RC2 |
| src/routes/poolEquipmentRoutes.js | 31 | Equipamentos de piscina | 11 rotas / 0 funcoes | Nao evidente no router | `tests/pool-equipment-installation.test.js` | Alto | P1 RC2 |
| src/routes/companyClosureRoutes.js | 265 | Fechos de empresa/periodo | 9 rotas / 4 funcoes | Nao evidente no router | Sem evidencia direta dedicada | Alto | P1 RC2 |
| src/routes/clientPortalRoutes.js | 287 | Portal cliente e ownership | 15 rotas / 4 funcoes | Evidencia de protecao parcial | `tests/client-portal.test.js`, `tests/customer-portal-service.test.js` | Medio | P2 RC2 |
| src/routes/keyRoutes.js | 342 | Chaves e posse operacional | 8 rotas / 11 funcoes | Nao evidente no router | Sem evidencia direta dedicada | Alto | P1 RC2 |
| src/routes/billingRoutes.js | 265 | Faturacao operacional | 7 rotas / 0 funcoes locais | Nao evidente no router | `tests/finance-os-business.test.js` | Alto | P1 RC2 |
| src/routes/settingsRoutes.js | 221 | Configuracoes/sessoes | 11 rotas / 2 funcoes | Protecao parcial | Sem evidencia direta dedicada | Medio | P2 RC2 |
| src/routes/poolRoutes.js | 16 | Rotas base de piscina | 9 rotas / 0 funcoes locais | Nao evidente no router | Varios testes pool* | Alto | P1 RC2 |
| src/routes/installationRoutes.js | 35 | Instalacoes | 23 rotas / 0 funcoes locais | Evidencia de protecao | `tests/pool-equipment-installation.test.js` | Medio | P2 RC2 |
| src/routes/constructionRoutes.js | 33 | Obras | 21 rotas / 0 funcoes locais | Evidencia de protecao | Sem evidencia direta dedicada | Medio | P2 RC2 |
| src/routes/financeOsRoutes.js | 34 | Finance OS | 20 rotas / 0 funcoes locais | Evidencia de protecao | `tests/finance-os-business.test.js` | Medio | P2 RC2 |
| src/routes/administrationRoutes.js | 31 | Administracao operacional | 19 rotas / 0 funcoes locais | Evidencia de protecao | Sem evidencia direta dedicada | Medio | P2 RC2 |
| src/routes/aiAdminRoutes.js | 17 | IA admin | 7 rotas / 0 funcoes locais | Evidencia de protecao | Sem evidencia direta dedicada | Baixo/Medio | P3 RC2 |
| src/routes/chatRoutes.js | 36 | Chat interno/cliente | 7 rotas / 0 funcoes locais | Nao evidente no router | `tests/pool-chat-business.test.js` | Alto | P1 RC2 |
| src/routes/incidentRoutes.js | 296 | Incidentes e alertas | 7 rotas / 0 funcoes locais | Evidencia de protecao | Sem evidencia direta dedicada | Medio | P2 RC2 |

## Recomendacao RC2
1. Tratar primeiro seguranca de superficie API (rotas confirmadas sem token com 2xx), com prioridade em `coreFlowRoutes`, `guideRoutes`, `repairRoutes`, `billingRoutes`, `keyRoutes`, `chatRoutes`, `enterpriseCrmRoutes`, `operationalStateRoutes`.
2. Fechar investigacao das 37 Altas pendentes antes de qualquer refatoracao estrutural.
3. Manter refatoracao de ficheiros grandes desacoplada da correccao de seguranca, em lotes pequenos e testaveis.
4. Cada correcao RC2 deve ser acompanhada por teste de autorizacao (sem token, token invalido, perfil errado).

## Atualizacao pos-hardening (2026-07-19)
Foi concluido um lote prioritario de seguranca com hardening minimo em 9 modulos sensiveis:
- `src/routes/coreFlowRoutes.js`
- `src/routes/guideRoutes.js`
- `src/routes/repairRoutes.js`
- `src/routes/operationalStateRoutes.js`
- `src/routes/operationalFlowRoutes.js`
- `src/routes/enterpriseCrmRoutes.js`
- `src/routes/keyRoutes.js`
- `src/routes/billingRoutes.js`
- `src/routes/chatRoutes.js`

E ownership no controlador:
- `src/controllers/chatController.js`

Validacao runtime final (apos restart PM2) confirmou comportamento esperado no escopo do lote:
- sem token => 401
- token invalido => 401
- perfil errado => 403
- perfil autorizado => 200 (ou 404 quando recurso inexistente)
- ownership cliente no chat => 200 (proprio) / 403 (terceiro)

Cobertura de inventario no lote: 145 endpoints.
Detalhe completo em: `docs/product/RC2_SECURITY_HARDENING_REPORT.md`.
