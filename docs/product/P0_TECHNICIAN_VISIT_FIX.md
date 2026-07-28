# P0 Technician Visit Fix

Data: 2026-07-19
Objetivo: corrigir 403 no fluxo principal do Tecnico para registar problema e concluir visita, mantendo seguranca.

## Causa raiz
1. O router `coreFlowRoutes` estava protegido por gate global `auth('ADMIN')`.
2. O frontend Tecnico usa os endpoints reais:
   - `POST /api/core/visits/:id/problem`
   - `POST /api/core/visits/:id/complete`
3. Como essas rotas passavam pelo gate global de Admin, o Tecnico autenticado recebia 403 antes de chegar ao handler.

## Ficheiros alterados
- `src/routes/coreFlowRoutes.js`

## Linhas alteradas
- `src/routes/coreFlowRoutes.js`: 15, 22-30, 1843-1849, 1929-1937

## Motivo do 403
- `router.use(...)` em `coreFlowRoutes` aplicava `adminAuth` em todas as rotas (exceto `GET /health` e `GET /dashboard`).
- As rotas de problema/conclusao de visita, embora usadas pelo fluxo Tecnico, nao tinham excecao de autorizacao.

## Solucao aplicada
1. Autorizacao seletiva no gate global:
   - Mantido `auth('ADMIN')` como regra geral.
   - Excecao estrita apenas para:
     - `POST /visits/:id/problem`
     - `POST /visits/:id/complete`
   - Nessas duas rotas passa a aplicar `auth('TECHNICIAN')`.
2. Ownership enforcement nos handlers:
   - Para perfis nao-admin, valida se `visit.technicianId` corresponde ao tecnico autenticado (`req.user.technicianId` ou `req.user.id`).
   - Se diferente, retorna `403` com mensagem de permissao.
3. Sem alterar schema, sem alterar endpoints publicos, sem mudar layout, sem funcionalidade nova.

## Testes executados
### Fluxo funcional P0
- Login Admin: 200
- Login Tecnico 1 (dono): 200
- Login Tecnico 2 (outro): 200
- Admin criou duas visitas QA para Tecnico 1: 200
- Tecnico 1 abriu agenda (`GET /api/technician/today`): 200
- Tecnico 1 registou problema (`POST /api/core/visits/:id/problem`): 200
- Tecnico 1 concluiu visita (`POST /api/core/visits/:id/complete`): 200
- Tecnico 2 tentou alterar visita do Tecnico 1:
  - problema: 403
  - conclusao: 403

### Regressao tecnica
- `npm run check:syntax`: PASS
- `QA_ENVIRONMENT_SAFE=true UPLOAD_DIR=uploads/qa/p0-technician npm test`: PASS (23 files, 52 tests)
- `npm run smoke`: baseline esperado (inclui 401 em `/api/dashboard/metrics` por auth)

## Resultado final
- P0 RESOLVIDO
