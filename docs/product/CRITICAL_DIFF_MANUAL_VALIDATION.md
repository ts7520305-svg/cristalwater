# FASE 3.0.1 - VALIDACAO MANUAL DOS DIFFS CRITICOS

## Contexto
- Esta validacao substitui a classificacao automatica por leitura manual de diff e comportamento real.
- Nao houve implementacao, migracao, alteracao de layout/codigo fonte, commit ou push nesta fase.
- Evidencias usadas:
- [docs/product/evidence/critical-diffs-tracked.patch](docs/product/evidence/critical-diffs-tracked.patch)
- [docs/product/evidence/critical-adaptar-diffs.patch](docs/product/evidence/critical-adaptar-diffs.patch)
- [docs/product/evidence/critical-diffs-core-files.patch](docs/product/evidence/critical-diffs-core-files.patch)
- [docs/product/evidence/critical-core-files-content.txt](docs/product/evidence/critical-core-files-content.txt)
- [docs/product/evidence/critical-duplicate-comparisons.patch](docs/product/evidence/critical-duplicate-comparisons.patch)
- [docs/product/evidence/critical-reference-map.txt](docs/product/evidence/critical-reference-map.txt)
- [docs/product/evidence/critical-validation/critical-validation-results.json](docs/product/evidence/critical-validation/critical-validation-results.json)
- [docs/product/evidence/critical-validation/critical-functional-final.json](docs/product/evidence/critical-validation/critical-functional-final.json)

## Escopo validado manualmente
Arquivos unicos analisados: 20

1. [frontend/admin-command-center.html](frontend/admin-command-center.html)
2. [frontend/admin-core-flow.html](frontend/admin-core-flow.html)
3. [frontend/admin-menu.html](frontend/admin-menu.html)
4. [frontend/admin-operational-flow.html](frontend/admin-operational-flow.html)
5. [frontend/admin-test-center.html](frontend/admin-test-center.html)
6. [frontend/admin-today.html](frontend/admin-today.html)
7. [src/routes/coreFlowRoutes.js](src/routes/coreFlowRoutes.js)
8. [frontend/ui/design-system.css](frontend/ui/design-system.css)
9. [frontend/ui/design-system.js](frontend/ui/design-system.js)
10. [frontend/ui/tokens.css](frontend/ui/tokens.css)
11. [frontend/ui/tokens/tokens.css](frontend/ui/tokens/tokens.css)
12. [frontend/enterprise-ui.css](frontend/enterprise-ui.css)
13. [frontend/css/enterprise-ui.css](frontend/css/enterprise-ui.css)
14. [frontend/ui/components/button.css](frontend/ui/components/button.css)
15. [frontend/ui/components/buttons.css](frontend/ui/components/buttons.css)
16. [frontend/admin-dashboard.html](frontend/admin-dashboard.html)
17. [frontend/admin-alerts.html](frontend/admin-alerts.html)
18. [frontend/admin-clients.html](frontend/admin-clients.html)
19. [frontend/client-portal.html](frontend/client-portal.html)
20. [frontend/technician-field-mode.html](frontend/technician-field-mode.html)

## Validacao visual (desktop, tablet, mobile)
- Sessao valida usada por perfil (Admin, Tecnico, Cliente) com token real/sintetico valido.
- 18 cenarios validados (6 paginas x 3 viewports).
- Antes/depois capturado com e sem DS (bloqueio de `/ui/design-system.css` e `/ui/design-system.js` no cenario before).
- Resultado consolidado:
- Status HTTP nas 6 paginas: 200 em desktop/tablet/mobile.
- Erros de consola: 0.
- Scroll horizontal: 0 casos.
- Alteracao visual efetiva do DS: 18/18 pares before/after mudaram (tamanho dos PNGs diferente).
- Evidencias de screenshots: [docs/product/evidence/critical-validation](docs/product/evidence/critical-validation)

## Validacao funcional (nao apenas abertura de pagina)
### Admin
- `/api/dashboard/admin`: 200
- `/api/alerts`: 200
- `/api/clients`: 200
- Evidencia: [docs/product/evidence/critical-validation/critical-functional-final.json](docs/product/evidence/critical-validation/critical-functional-final.json)

### Tecnico
- `/api/technician/today`: 200
- `/api/core/visits/{id}/problem`: 200 (com `message` preenchida)
- `/api/core/visits/{id}/complete`: 200
- Evidencia: [src/routes/coreFlowRoutes.js](src/routes/coreFlowRoutes.js#L1829), [src/routes/coreFlowRoutes.js](src/routes/coreFlowRoutes.js#L1924), [docs/product/evidence/critical-validation/critical-functional-final.json](docs/product/evidence/critical-validation/critical-functional-final.json)

### Cliente
- `/api/client-portal/{clientId}/dashboard`: 200
- `/api/client-portal/history/{clientId}`: 200
- `/api/client-portal/{clientId}/latest`: 200
- Evidencia: [src/routes/clientPortalRoutes.js](src/routes/clientPortalRoutes.js#L218), [src/routes/clientPortalRoutes.js](src/routes/clientPortalRoutes.js#L57), [docs/product/evidence/critical-validation/critical-functional-final.json](docs/product/evidence/critical-validation/critical-functional-final.json)

## Tabela obrigatoria
| Ficheiro | Alteracao real | Risco confirmado | Compatibilidade DS | Decisao | Justificacao |
|---|---|---|---|---|---|
| frontend/admin-command-center.html | Adicao de 1 link DS + 1 script DS numa pagina que redireciona imediatamente para `/admin-master-control` | Baixo funcional, Medio de ruido visual/performance | Parcial | REVERTER | Nao agrega valor numa pagina-redirect; so aumenta carga antes de `location.replace` ([frontend/admin-command-center.html](frontend/admin-command-center.html#L12), [frontend/admin-command-center.html](frontend/admin-command-center.html#L15)). |
| frontend/admin-core-flow.html | Mesmo padrao: injecao DS em pagina legacy com meta refresh + redirect JS | Baixo funcional, Medio de ruido/performance | Parcial | REVERTER | Página legado sem UI persistente; DS nao deveria ser carregado aqui ([frontend/admin-core-flow.html](frontend/admin-core-flow.html#L1)). |
| frontend/admin-menu.html | Injecao DS css/js em pagina ativa de navegacao admin | Medio (pode alterar look de componentes legados) | Parcial | ADAPTAR | Mudanca real e util, mas precisa escopo por classes para evitar colisao com shell legado ([frontend/admin-menu.html](frontend/admin-menu.html#L13), [frontend/admin-menu.html](frontend/admin-menu.html#L198)). |
| frontend/admin-operational-flow.html | Injecao DS em pagina legacy redirect | Baixo funcional, Medio ruido/perf | Parcial | REVERTER | Mesmo racional das paginas redirect; sem beneficio de interface persistente ([frontend/admin-operational-flow.html](frontend/admin-operational-flow.html#L4), [frontend/admin-operational-flow.html](frontend/admin-operational-flow.html#L7)). |
| frontend/admin-test-center.html | Injecao DS em pagina legacy redirect | Baixo funcional, Medio ruido/perf | Parcial | REVERTER | Sem ganho funcional; custo de carregamento desnecessario ([frontend/admin-test-center.html](frontend/admin-test-center.html#L3), [frontend/admin-test-center.html](frontend/admin-test-center.html#L6)). |
| frontend/admin-today.html | Injecao DS css/js em pagina principal admin | Medio | Parcial | ADAPTAR | Necessaria para uniformizacao, mas depende de ajuste de especificidade para coexistir com `cw-premium-admin-phase1.css` ([frontend/admin-today.html](frontend/admin-today.html#L12), [frontend/admin-today.html](frontend/admin-today.html#L109)). |
| src/routes/coreFlowRoutes.js | Nova excecao de auth para tecnico em `/visits/:id/problem` e `/visits/:id/complete` + ownership check por tecnico | Medio (seguranca/comportamento de autorizacao), validado | N/A | MANTER | Corrige bloqueio P0 sem abrir permissao ampla; exige tecnico dono da visita ([src/routes/coreFlowRoutes.js](src/routes/coreFlowRoutes.js#L22), [src/routes/coreFlowRoutes.js](src/routes/coreFlowRoutes.js#L28), [src/routes/coreFlowRoutes.js](src/routes/coreFlowRoutes.js#L1844), [src/routes/coreFlowRoutes.js](src/routes/coreFlowRoutes.js#L1933)). |
| frontend/ui/design-system.css | Novo arquivo global com reset amplo (`body`, `button`, `input`, `table`, `card`) | Medio (colisao CSS) | Parcial | ADAPTAR | DS funciona visualmente, mas escopo global e agressivo; requer namespacing progressivo por shell/perfil ([frontend/ui/design-system.css](frontend/ui/design-system.css#L42), [frontend/ui/design-system.css](frontend/ui/design-system.css#L133), [frontend/ui/design-system.css](frontend/ui/design-system.css#L215)). |
| frontend/ui/design-system.js | Novo runtime que injeta nav mobile, wrappers de tabela e prune de navegacao/secoes | Medio (altera comportamento de navegação e visibilidade) | Parcial | ADAPTAR | O arquivo nao e apenas cosmetico; mexe em DOM estrutural e pode ocultar itens validos ([frontend/ui/design-system.js](frontend/ui/design-system.js#L28), [frontend/ui/design-system.js](frontend/ui/design-system.js#L59), [frontend/ui/design-system.js](frontend/ui/design-system.js#L123), [frontend/ui/design-system.js](frontend/ui/design-system.js#L146)). |
| frontend/ui/tokens.css | Sem diff neste lote; tokens usados por foundation atual | Baixo | Sim | MANTER | E o token set ativo do stack principal (`/ui/foundation.css` importa este arquivo) ([frontend/ui/foundation.css](frontend/ui/foundation.css#L1), [docs/product/evidence/critical-reference-map.txt](docs/product/evidence/critical-reference-map.txt)). |
| frontend/ui/tokens/tokens.css | Sem diff neste lote; token set alternativo usado por stack v26 | Baixo no estado atual, Medio se misturado | Parcial | ADAPTAR | Nome e semantica divergem de `tokens.css`; coexistencia e valida mas pede governanca para evitar mistura acidental ([frontend/v26/prototype.css](frontend/v26/prototype.css#L1), [frontend/v26/technician/technician.css](frontend/v26/technician/technician.css#L1)). |
| frontend/enterprise-ui.css | Sem diff; arquivo duplicado de `frontend/css/enterprise-ui.css` | Baixo | Parcial | ADAPTAR | Conteudo e equivalente; duplicidade de caminho aumenta risco operacional em cache/imports ([docs/product/evidence/critical-duplicate-comparisons.patch](docs/product/evidence/critical-duplicate-comparisons.patch)). |
| frontend/css/enterprise-ui.css | Sem diff; usado por pagina admin-keys | Baixo | Parcial | MANTER | Arquivo referenciado explicitamente por pagina ativa ([frontend/admin-keys.html](frontend/admin-keys.html#L8)). |
| frontend/ui/components/button.css | Sem diff; estilos de botao do stack principal (`.cw-v2-btn`, `.btn`, `.cw-btn`) | Baixo | Parcial | MANTER | E o arquivo importado por foundation ativo ([frontend/ui/foundation.css](frontend/ui/foundation.css#L4)). |
| frontend/ui/components/buttons.css | Sem diff; estilos alternativos da stack v26 | Baixo no estado atual, Medio se co-carregado com stack principal | Parcial | ADAPTAR | Diverge de `button.css` em dimensao e tokens; manter separado por stack e documentar fronteiras ([frontend/v26/prototype.css](frontend/v26/prototype.css#L2), [frontend/ui/components/buttons.css](frontend/ui/components/buttons.css#L1)). |
| frontend/admin-dashboard.html | Diff real: injecao DS css/js | Baixo | Sim | MANTER | Nao houve erro de consola/hscroll; comportamento admin continuou funcional ([frontend/admin-dashboard.html](frontend/admin-dashboard.html#L889), [frontend/admin-dashboard.html](frontend/admin-dashboard.html#L1212)). |
| frontend/admin-alerts.html | Diff real: injecao DS css/js | Baixo | Sim | MANTER | Alertas e API continuam 200, sem quebra visual critica ([frontend/admin-alerts.html](frontend/admin-alerts.html#L69), [frontend/admin-alerts.html](frontend/admin-alerts.html#L131)). |
| frontend/admin-clients.html | Diff real: injecao DS css/js | Baixo | Sim | MANTER | Fluxo admin-clients preservado na validacao funcional e visual ([frontend/admin-clients.html](frontend/admin-clients.html#L456), [frontend/admin-clients.html](frontend/admin-clients.html#L574)). |
| frontend/client-portal.html | Diff real: injecao DS css/js | Baixo | Sim | MANTER | Sessao cliente valida e endpoints do portal responderam 200 ([frontend/client-portal.html](frontend/client-portal.html#L337), [frontend/client-portal.html](frontend/client-portal.html#L542)). |
| frontend/technician-field-mode.html | Diff real: injecao DS css/js | Baixo a Medio | Sim | MANTER | Pagina e fluxos tecnicos criticos responderam; sem erro de consola/hscroll ([frontend/technician-field-mode.html](frontend/technician-field-mode.html#L539), [frontend/technician-field-mode.html](frontend/technician-field-mode.html#L872)). |

## Respostas objetivas por ficheiro (1..10)
- As respostas 1..10 para cada ficheiro estao refletidas diretamente na tabela acima:
- 1: Alteracao real
- 2: Porque mudou
- 3: Comportamento afetado
- 4: Necessidade
- 5: Duplicacao
- 6: Conflito CSS real
- 7: Risco funcional
- 8: Compatibilidade DS
- 9: Decisao
- 10: Justificacao concreta com referencia ao diff/arquivo

## Consolidado final solicitado
1. Ficheiros analisados manualmente
- 20 (lista completa na secao Escopo).

2. Conflitos reais confirmados
- 4
- DS injetado em paginas de redirect legado sem beneficio direto: [frontend/admin-command-center.html](frontend/admin-command-center.html), [frontend/admin-core-flow.html](frontend/admin-core-flow.html), [frontend/admin-operational-flow.html](frontend/admin-operational-flow.html), [frontend/admin-test-center.html](frontend/admin-test-center.html).
- Runtime DS com alteracoes estruturais de DOM/navegacao (prune/hide): [frontend/ui/design-system.js](frontend/ui/design-system.js#L123), [frontend/ui/design-system.js](frontend/ui/design-system.js#L146).

3. Falsos conflitos
- 42 da contagem automatica anterior nao foram confirmados no escopo critico manual.
- Em especial, nao foi observado conflito visual critico reproduzivel nas 6 paginas principais (0 erros de consola, 0 hscroll).

4. Riscos reais
- Medio: [src/routes/coreFlowRoutes.js](src/routes/coreFlowRoutes.js), [frontend/ui/design-system.css](frontend/ui/design-system.css), [frontend/ui/design-system.js](frontend/ui/design-system.js), [frontend/admin-menu.html](frontend/admin-menu.html), [frontend/admin-today.html](frontend/admin-today.html).
- Baixo: restantes ficheiros validados no escopo critico.

5. Decisoes alteradas face a auditoria automatica
- Alteradas para REVERTER: [frontend/admin-command-center.html](frontend/admin-command-center.html), [frontend/admin-core-flow.html](frontend/admin-core-flow.html), [frontend/admin-operational-flow.html](frontend/admin-operational-flow.html), [frontend/admin-test-center.html](frontend/admin-test-center.html).
- Alteradas para ADAPTAR (antes marcadas como manter por regra automatica): [frontend/ui/design-system.css](frontend/ui/design-system.css), [frontend/ui/design-system.js](frontend/ui/design-system.js).

6. Paginas visualmente aprovadas
- [frontend/admin-dashboard.html](frontend/admin-dashboard.html)
- [frontend/admin-today.html](frontend/admin-today.html)
- [frontend/admin-alerts.html](frontend/admin-alerts.html)
- [frontend/admin-clients.html](frontend/admin-clients.html)
- [frontend/client-portal.html](frontend/client-portal.html)
- [frontend/technician-field-mode.html](frontend/technician-field-mode.html)

7. Paginas visualmente rejeitadas
- Nenhuma no escopo principal validado (desktop/tablet/mobile).

8. Estado
- BASE SEGURA PARA FASE 3.1
- Condicao: executar migracao por grupos mantendo freeze imediato nos ficheiros com decisao ADAPTAR/REVERTER acima, sem rollout em massa cego.

## Encerramento
- Fase 3.0.1 concluida.
- Nao iniciar Fase 3.1 automaticamente.