# FCS-1.1 - Inventario

Estado: CONCLUIDO

## Objetivo
Inventariar todo o frontend e eliminar ambiguidade sobre a arquitetura atual.

## Gate 0 - Decisao arquitetural
- Documento de referencia: `docs/product/FCS1_GATE0_ARCHITECTURE_DECISION.md`
- Estado: VERDE

## Evidencia base
- Runtime PM2 validado.
- Dashboard, Clientes e Piscinas funcionais.
- Shell V2 identificado.
- Legado identificado.
- Coexistencia comprovada.

## Gate 1 - Checklist binario (10 itens)
- [x] Todas as paginas inventariadas
- [x] Todas as rotas inventariadas
- [x] Todos os menus identificados
- [x] Todos os shells identificados
- [x] Todos os componentes de navegacao identificados
- [x] Todas as paginas classificadas (Manter/Migrar/Remover)
- [x] Todas as rotas orfas classificadas
- [x] Todos os duplicados classificados
- [x] Navegacao oficial definida
- [x] Landing oficial por perfil definida

## Inventario de itens (formato operacional)
| Item | Estado Atual | Decisao | Justificacao |
|---|---|---|---|
| `crystal-os-v2-nav.js` | Oficial | Manter | Navegacao oficial definida no Gate 0 |
| `crystal-os-v2-shell.js` | Oficial | Manter | Shell oficial definida no Gate 0 |
| `admin-menu.html` | Oficial | Manter | Landing Admin oficial |
| `admin-master-control.html` | Oficial | Manter | Dashboard operacional oficial |
| `ui/core/navigation-context.js` | Ativo V2 | Manter | Contexto/voltar padrao do frontend oficial |
| `nav.js` | Legado ativo | Remover | Substituido por V2; ainda carregado em `admin-collection.html` e `admin-payment-settings.html` |
| `cw-enterprise-sidebar.js` | Legado ativo | Remover | Sidebar concorrente ao V2; ainda carregado direto e por injecao |
| `cw-flow-shell.js` | Legado ativo | Remover | Injeta legado de navegacao e compete com shell oficial |
| `cw-os-admin-shell.js` | Legado ativo | Remover | Shell admin concorrente ao V2 |
| `admin-command-center.html` | Duplicado funcional | Migrar | Funcao absorvida por `admin-master-control.html` |
| `admin-core-flow.html` | Duplicado (redirect) | Remover | Apenas redireciona para `/admin-master-control` |
| `admin-operational-flow.html` | Duplicado (redirect) | Remover | Apenas redireciona para `/admin-master-control` |
| `admin-test-center.html` | Duplicado (redirect) | Remover | Apenas redireciona para `/admin-master-control` |
| `client-logout.js` com `/frontend/client-login.html` | Legado ativo | Migrar | Usa rota antiga `/frontend/...`; deve apontar para rota oficial |
| `service-worker.js` com `/frontend/...` | Legado ativo | Migrar | Mantem referencias legadas de assets/rotas |
| Landing Admin (`/login` -> `/admin-menu`) | Oficial | Manter | Definida em `login.js` como redirecionamento de perfil ADMIN |
| Landing Cliente (`/login` -> `/client-portal`) | Oficial | Manter | Definida em `login.js` como redirecionamento de perfil CLIENT |
| Landing Tecnico (`/login` -> `/technician`) | Oficial | Manter | Definida em `login.js` como redirecionamento de perfil TECHNICIAN |

## Evidencia objetiva de inventario
- Paginas frontend inventariadas: 93 (`frontend/*.html`).
- Rotas frontend inventariadas: mapeamento automatico em `src/server.js` para todo ficheiro `.html` sob `frontend/` com alias `/pagina` e redirect `/pagina.html`.
- Landing por perfil inventariada via `frontend/login.js`:
	- ADMIN -> `/admin-menu`
	- CLIENT -> `/client-portal`
	- TECHNICIAN -> `/technician`
- Classificacao de paginas (fecho Gate 1):
	- 88 paginas V2 puras -> Manter
	- 3 paginas duplicadas de redirect (`admin-core-flow.html`, `admin-operational-flow.html`, `admin-test-center.html`) -> Remover
	- 2 paginas de autenticacao (`admin-login.html`, `client-login.html`) -> Migrar para `/login`
	- 0 paginas V2 com legado explicito
- Classificacao de rotas orfas (navegacao oficial):
	- 73 rotas validadas via runtime (`http://127.0.0.1:3002`) -> 0 orfas/quebradas
- Classificacao de duplicados:
	- 3 duplicados funcionais classificados e apontados para alvo oficial `/admin-master-control`

## Evidencia de consolidacao executada (inicio FCS-1.2)
- `nav.js` removido de paginas V2 consolidadas:
	- `frontend/admin-collection.html`
	- `frontend/admin-payment-settings.html`
- `cw-enterprise-sidebar.js` removido de paginas V2 consolidadas:
	- `frontend/admin-keys.html`
	- `frontend/admin-service-log.html`
- `cw-os-admin-shell.js` removido de paginas V2 consolidadas:
	- `frontend/admin-alerts.html`
	- `frontend/admin-clients.html`
	- `frontend/admin-inventory.html`
	- `frontend/admin-pools.html`
	- `frontend/admin-rounds.html`
- Verificacao final de carregamento legado explicito em `frontend/*.html`:
	- `nav.js`: 0 ocorrencias
	- `cw-enterprise-sidebar.js`: 0 ocorrencias
	- `cw-os-admin-shell.js`: 0 ocorrencias

## Auditoria runtime adicional (release engineering)
- Superficies auditadas em runtime: `/admin-clients`, `/admin-pools`, `/admin-master-control`, `/invoices`.
- Resultado de scripts carregados nessas superficies:
	- `nav.js`: nao carregado
	- `cw-enterprise-sidebar.js`: nao carregado
	- `cw-flow-shell.js`: nao carregado
	- `cw-os-admin-shell.js`: nao carregado
- Resultado funcional de navegacao nessas superficies:
	- Drawer/menu abre com sucesso (`aria-hidden: true -> false`, classe `is-open` ativa)
	- Links do drawer presentes e navegacao operacional
	- Topbar V2 ativa
- Correcao aplicada durante auditoria:
	- `crystal-os-v2-shell.js` atualizado para binding dinamico (delegacao) em componentes injetados pelo nav V2.
	- `cristal-assist.js` deixou de injetar `cw-enterprise-sidebar.js` (remocao de bootstrap legado).
	- `sw.js` removido de `APP_SHELL` o asset legado `cw-enterprise-sidebar.js`.

## Sweep runtime completo FCS-1.2
- Escopo varrido: 87 rotas V2 navegaveis (exclui apenas redirects duplicados classificados para remocao).
- Resultado do sweep Playwright (rota a rota):
	- PASS: 87
	- FAIL: 0
	- Rotas com shell V2 ausente: 0
	- Rotas com scripts legados carregados: 0
	- Rotas com links para rotas removidas: 0
	- Falhas de drawer (abre/fecha): 0
	- Rotas com erros de consola: 0
	- Rotas com API 4xx/5xx no teste: 0

## Service worker - validacao de cache antigo
- Cache versionado para forcar rotacao limpa: `cristalwater-v22-6-16-nav-consolidation`.
- Validacao runtime executada com service worker ja instalado:
	- `beforeKeys`: `cristalwater-v22-6-15-professional-ui`
	- `afterKeys`: `cristalwater-v22-6-16-nav-consolidation`
	- Caches antigos removidos no `activate`: sim
	- `sw.js` ativo apos update: sim (`state=activated`)
	- Asset legado no novo cache (`/cw-enterprise-sidebar.js`): nao encontrado

## Criterio de bloqueio
- Mais de um menu oficial
- Mais de um shell oficial
- Pagina sem classificacao
- Rota sem decisao
- Componente de navegacao sem proprietario

## Decisao
- Gate 1: CONCLUIDO (10/10)
- FCS-1.1: FECHADO

## Proximo checkpoint
- FCS-1.2 - Consolidacao da Navegacao
- Estado: CONCLUIDO

## FCS-1.3 - Consolidacao operacional do fluxo de reparacao (parcial)
- Objetivo em curso:
	- Definir a operacao oficial de "Criar reparacao" no contexto Admin sem criar acao global sem contexto.
- Implementacao aplicada em `frontend/admin-alerts.html` e `frontend/admin-alerts.js`:
	- CTA oficial `Nova reparacao` adicionada na fila de alertas.
	- Modal contextual com regra obrigatoria de contexto:
		- aceita origem por alerta/visita, ou
		- exige selecao cliente + piscina/jacuzzi.
	- Integracao com APIs existentes:
		- leitura de contexto: `/api/core/clients` e `/api/core/pools`
		- criacao de reparacao: `POST /api/repairs`
		- resolucao opcional do alerta de origem apos criacao.
	- Preenchimento assistido:
		- quando contexto de alerta/visita e selecionado, cliente/piscina e problema sao sugeridos automaticamente.
- Validacao tecnica desta entrega:
	- `npm run check:syntax` -> `Syntax OK: 448 backend JS files`.

## Pendencias para fecho FCS-1.3
- Executar micro-sweep autenticado com cronometro para as 6 acoes criticas (desktop e 390x844).
- Registar tempo de descoberta (< 10s) e numero de interacoes (<= 3) por acao.
- Confirmar percursos end-to-end com sessao autenticada (sem `reason=no_session`).

## Evidencia E2E - Criar reparacao a partir de Alertas (FCS-1.3)
- Execucao automatizada concluida com sessao autenticada criada por utilizador temporario (sem depender de `ADMIN_EMAIL`/`ADMIN_PASSWORD` de ambiente).
- Script de validacao: `scripts/test-fcs13-repair-alert-e2e.js`
- Comando reproducivel: `npm run test:fcs13-repair-e2e`
- Resultado da execucao:
	- `ok: true`
	- `runId: FCS13_1784670497218_g0p6c5`
	- `repairId: 114`
	- `technicalAlertId: 128`
- Passos validados fim-a-fim:
	1. Abrir Alertas
	2. Clicar em Nova reparacao
	3. Selecionar contexto de alerta
	4. Criar reparacao
	5. Confirmar reparacao em `GET /api/repairs/pool/:poolId`
	6. Confirmar alerta resolvido (`RESOLVED`)
	7. Reabrir reparacao via `GET /api/repairs/:id/pdf` e confirmar persistencia
- Evidencia objetiva da execucao:
	- `alertStillVisibleAfterResolve: false`
	- `repairListedByPool: true`
	- `alertStatus: RESOLVED`
	- `pdfStatus: 200` / `pdfContentType: application/pdf`
	- Interacoes UI no fluxo: 6 (`abrir pagina`, `abrir modal`, `selecionar contexto`, `preencher problema`, `submeter`, `refresh`) 
	- Timings observados (ms):
		- `openPage: 2162`
		- `openModal: 863`
		- `selectContext: 14`
		- `fillProblem: 14`
		- `submitRepair: 645`
		- `refreshAndPersist: 1434`

## Micro-sweep autenticado FCS-1.3 (6 fluxos x 2 viewports)
- Script: `scripts/test-fcs13-microsweep-six-flows.js`
- Comando reproducivel: `npm run test:fcs13-microsweep`
- Run validada: `FCS13MS_1784671631203_ny3kzp`
- Gate aplicado:
	- Descoberta da acao < 10s
	- Descoberta da acao <= 3 interacoes
	- Fluxo completo concluido sem erro
	- Erros de consola = 0
	- API 4xx/5xx = 0
- Resultado global:
	- total: 12
	- PASS: 12
	- FAIL: 0
	- overTimeGate: 0
	- overInteractionGate: 0

| Fluxo | Perfil | Viewport | Landing inicial | Acao principal encontrada | Tempo ate abrir a acao | Interacoes ate abrir a acao | Fluxo concluido | Erros de consola | API 4xx/5xx | PASS/FAIL |
|---|---|---|---|---|---:|---:|---|---:|---:|---|
| Criar cliente | ADMIN | 1440x920 | /admin-master-control | SIM | 1054 ms | 1 | SIM | 0 | 0 | PASS |
| Criar piscina | ADMIN | 1440x920 | /admin-master-control | SIM | 856 ms | 1 | SIM | 0 | 0 | PASS |
| Agendar visita | ADMIN | 1440x920 | /admin-master-control | SIM | 815 ms | 1 | SIM | 0 | 0 | PASS |
| Criar reparacao | ADMIN | 1440x920 | /admin-master-control | SIM | 1656 ms | 2 | SIM | 0 | 0 | PASS |
| Emitir fatura | ADMIN | 1440x920 | /admin-master-control | SIM | 745 ms | 1 | SIM | 0 | 0 | PASS |
| Criar produto | ADMIN | 1440x920 | /admin-master-control | SIM | 764 ms | 1 | SIM | 0 | 0 | PASS |
| Criar cliente | ADMIN | 390x844 | /admin-master-control | SIM | 991 ms | 1 | SIM | 0 | 0 | PASS |
| Criar piscina | ADMIN | 390x844 | /admin-master-control | SIM | 774 ms | 1 | SIM | 0 | 0 | PASS |
| Agendar visita | ADMIN | 390x844 | /admin-master-control | SIM | 709 ms | 1 | SIM | 0 | 0 | PASS |
| Criar reparacao | ADMIN | 390x844 | /admin-master-control | SIM | 1520 ms | 2 | SIM | 0 | 0 | PASS |
| Emitir fatura | ADMIN | 390x844 | /admin-master-control | SIM | 723 ms | 1 | SIM | 0 | 0 | PASS |
| Criar produto | ADMIN | 390x844 | /admin-master-control | SIM | 700 ms | 1 | SIM | 0 | 0 | PASS |

## Decisao FCS-1.3
- FCS-1.3 (Consolidacao dos Fluxos): CONCLUIDO
- Base de decisao:
	- Criar reparacao validado E2E com persistencia e resolucao de alerta.
	- Seis fluxos criticos validados no micro-sweep autenticado em desktop e 390x844.
