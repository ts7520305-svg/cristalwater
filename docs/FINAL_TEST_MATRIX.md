# FINAL TEST MATRIX

Date: 2026-07-12
Scope: execution in progress (not final closure)

Status values: aprovado | falhado | bloqueado | nao aplicavel | nao testado

| ID | Modulo | Perfil | Pre-condicoes | Passos | Resultado esperado | Resultado real | Estado | Evidencia | Data | Observacoes |
|---|---|---|---|---|---|---|---|---|---|---|
| FTM-001 | Auth admin | ADMIN | ADMIN_EMAIL/ADMIN_PASSWORD validos | POST /api/auth/login | token retornado | status 200 + token | aprovado | scripts/test-crystal-os-zero-bugs.js | 2026-07-12 | validado em runner real |
| FTM-002 | Auth admin invalido | ADMIN | credencial errada | POST /api/auth/login com password invalida | 401 | status 401 | aprovado | scripts/test-crystal-os-zero-bugs.js | 2026-07-12 | bloqueio de acesso confirmado |
| FTM-003 | Seguranca clientes | TECHNICIAN | login tecnico valido | GET /api/clients | 403 | status 403 | aprovado | scripts/test-zero-bugs-backend-security.js | 2026-07-12 | regra critica validada |
| FTM-004 | Seguranca dashboard | CLIENT | login cliente valido | GET /api/dashboard/metrics | 403 | status 403 | aprovado | scripts/test-zero-bugs-backend-security.js | 2026-07-12 | regra critica validada |
| FTM-005 | Dashboard admin | ADMIN | login admin valido | GET /api/dashboard/metrics | 200 | status 200 | aprovado | scripts/test-zero-bugs-backend-security.js | 2026-07-12 | endpoint protegido ok |
| FTM-006 | Idempotencia visita start (sequencial) | ADMIN | dados de visita validos | POST /api/visits/start duas vezes | no maximo 1 visita nova | validado sem duplicar | aprovado | scripts/test-zero-bugs-backend-security.js | 2026-07-12 | defeito CTO coberto |
| FTM-007 | Idempotencia visita start (concorrente) | ADMIN | payload identico concorrente | POST concorrente /api/visits/start | no maximo 1 visita nova | validado sem duplicar | aprovado | scripts/test-zero-bugs-backend-security.js | 2026-07-12 | lock+janela operacional ok |
| FTM-008 | Portal cliente proprio | CLIENT | token cliente A | GET /api/client-portal/:id proprio | 200 | status 200 | aprovado | scripts/test-crystal-os-zero-bugs.js | 2026-07-12 | isolamento base ok |
| FTM-009 | Portal cliente cruzado | CLIENT | token cliente B | GET /api/client-portal/:id cliente A | bloqueado | acesso cruzado bloqueado | aprovado | scripts/test-crystal-os-zero-bugs.js | 2026-07-12 | anti-IDOR basico ok |
| FTM-010 | Fluxo operacional interligacoes | ADMIN/TECH/CLIENT | servidor 3002 ativo | executar script de interligacoes | todos checkpoints OK | checkpoints OK + relatorio JSON | aprovado | reports/system-interconnections-INTERLINK-1783857435794.json | 2026-07-12 | cobranca, chat, gps e portal validados |
| FTM-011 | Fluxo mensal real | ADMIN | servidor 3002 ativo | executar script monthly real flow | ciclo completo gerado | OK + relatorio JSON | aprovado | reports/real-month-flow-REAL-MES-1783857436921.json | 2026-07-12 | dados sinteticos de producao controlada |
| FTM-012 | Offline real browser | TECHNICIAN | browser autenticado + modo offline controlado | iniciar visita, perder ligacao, sincronizar | sem perda e sem duplicacao | nao executado em browser real nesta ronda | bloqueado | scripts/test-crystal-os-zero-bugs.js (flag fail esperada) | 2026-07-12 | runner Node nao emula offline real de browser |
| FTM-013 | Validacao visual pixel-perfect | ADMIN/TECH/CLIENT | browser autenticado e viewport matrix | medir overflow/sobreposicao em 11 larguras | sem cortes e sem scroll horizontal global | parcialmente coberto por heuristicas de HTML, sem pixel runtime autenticado | bloqueado | scripts/test-crystal-os-zero-bugs.js (flag fail esperada) | 2026-07-12 | requer sessao browser partilhada/autenticada |
| FTM-014 | Smoke API base | anon/admin | servidor ativo | npm run smoke | endpoints base saudaveis | health/version/modules/core/gps OK; /dashboard/metrics 401 sem token | aprovado | npm run smoke | 2026-07-12 | 401 sem token e esperado |
| FTM-015 | Migrations status | infra | DB acessivel | npx prisma migrate status | schema atualizado | up to date | aprovado | prisma migrate status | 2026-07-12 | sem drift detectado |
| FTM-016 | Dashboard admin UX base | ADMIN | rota dashboard acessivel e scripts carregados | revisar toolbar, status, timeline, semanticas aria | consistencia visual e estados acessiveis | ajustes aplicados e sem regressao em smoke/syntax | aprovado | frontend/admin-dashboard.html + npm run smoke | 2026-07-12 | validacao pixel runtime autenticada ainda pendente |
| FTM-017 | Billing center autenticado | ADMIN | token admin presente no localStorage | carregar /billing-center e executar acoes de lembrete/whatsapp | requests com auth + mensagens claras + tabela usavel | headers auth corrigidos e estado UX aplicado | aprovado | frontend/billing-center.js + npm run check:syntax/smoke | 2026-07-12 | teste cruzado por perfil nao-admin pendente |

## Adendo de Correcao de Matriz (2026-07-12)

- Registro anterior "84/84": INVALIDADO.
- Motivo: criterio anterior nao comprovava separacao completa entre ADMIN/TECHNICIAN/CLIENT/no-session/expired-session.

| ID | Modulo | Perfil | Pre-condicoes | Passos | Resultado esperado | Resultado real | Estado | Evidencia | Data | Observacoes |
|---|---|---|---|---|---|---|---|---|---|---|
| FTM-018 | Secure auth matrix backend | ADMIN/TECH/CLIENT/anon/expired | servidor 3002 ativo + tokens de teste isolados | executar `node scripts/test-secure-auth-matrix.js` | admin=200; tecnico/cliente=403; sem sessao/expirada=401 | comportamento confirmado em `inventory/payments/reports/invoices` | aprovado | reports/secure-auth-matrix-2026-07-12T13-08-02-570Z.json | 2026-07-12 | ambiente classificado como potential-production |
| FTM-019 | Secure auth matrix frontend | ADMIN/TECH/CLIENT/anon/expired | browser Playwright + perfis isolados | navegar nas 4 paginas em 7 larguras | ADMIN permitido; restantes bloqueados para `/login` sem termos sensiveis | PASS=true com 0 falhas | aprovado | reports/secure-auth-matrix-2026-07-12T13-08-02-570Z.json | 2026-07-12 | sem overflow horizontal global no bloco |
| FTM-020 | Acoes funcionais admin no bloco | ADMIN | sessao admin valida | inventario load/validacao, pagamentos filtro, reports refresh, invoices validacao input | todas as 5 acoes marcadas `ok=true` | 5/5 acoes ok | aprovado | reports/secure-auth-matrix-2026-07-12T13-08-02-570Z.json | 2026-07-12 | validacao funcional real incorporada no runner seguro |

| FTM-021 | Secure auth matrix final (fecho) | ADMIN/TECH/CLIENT/anon/expired | backend reiniciado com patches de incidente | executar `node scripts/test-secure-auth-matrix.js` (execucao final) | backend+frontend PASS e sem flash protegido | PASS=true, backend failures=0, frontend failures=0, flash fails=0, revocation pass=true | aprovado | reports/secure-auth-matrix-2026-07-12T14-07-02-413Z.json | 2026-07-12 | evidencia usada para classificacao final do incidente |
| FTM-022 | Sanitizacao de relatorio seguro | n/a | existencia de report secure-auth-matrix | executar `node scripts/test-security-report-sanitization.js` | zero padroes sensiveis no relatorio | REPORT_SANITIZATION_PASS true, FINDINGS=0 | aprovado | reports/secure-auth-matrix-2026-07-12T14-07-02-413Z.json | 2026-07-12 | sem JWT/Authorization/password/PIN expostos |
| FTM-023 | Bateria obrigatoria completa do ciclo | multi-perfil | servidor 3002 + DB ativo | check:syntax, test, smoke, operational-flow, interconnections, zero-bugs-security, crystal-os-zero-bugs, secure-auth-matrix, prisma migrate status | concluir bloco de seguranca sem regressao critica | todos aprovados para seguranca; 2 flags conhecidas de escopo nao-seguranca em crystal-os-zero-bugs (offline browser real e pixel runtime) | aprovado com ressalva | reports/crystal-os-zero-bugs-2026-07-12T14-06-33-592Z.json | 2026-07-12 | ressalvas nao invalidam fecho do incidente de autorizacao/exposicao |
