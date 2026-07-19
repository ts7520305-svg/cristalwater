# ZERO BUGS Backend Security Fix Report

Mission: CRYSTAL-OS-ZERO-BUGS-001  
Execution order: CTO APPROVED FOR TARGETED BACKEND SECURITY AND INTEGRITY FIXES  
Date: 2026-07-12

## Safety pre-checks

1. File backups created before edits
- backup directory: backups/zero-bugs-backend-fix-20260712T100835Z
- files backed up:
  - src/routes/visitRoutes.js
  - src/routes/clientRoutes.js
  - src/routes/dashboardRoutes.js
- checksums:
  - 65226ff82bbb1165823e3dda0c21a7a8998f495e76a254284e2d827c8d13a387 (visitRoutes.js)
  - b397829592a05a09f1c5f8d35611f9ea789e55e48964523709d41bf685f00617 (clientRoutes.js)
  - 74d9f69544fe95d062b3f75974bc2aa332bd6324ad78694e9e97b21572bfb60f (dashboardRoutes.js)

2. git status captured before modifications
- repository was already dirty (large pre-existing worktree).

3. API process + DB fingerprint captured before modifications
- listener PID: 241811
- API cwd: /home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend
- runner DB URL fingerprint: b53697a3702c2618a8876374e2749894f5b7ab80b1035b667199684e5b40f86f
- API DB URL fingerprint: b53697a3702c2618a8876374e2749894f5b7ab80b1035b667199684e5b40f86f
- aligned: true
- DB redacted identity: postgresql://aws***om:6543/cri***07

4. Guardrails respected
- no schema change
- no migration change
- no DB structure change
- no frontend layout changes
- no production-record broad modifications

## Defect 1 - duplicate visit creation/start

### Root cause
- /api/visits/start in src/routes/visitRoutes.js always created a new ServiceVisit without duplicate/idempotency guard.

### Fix
- Added server-side idempotency protection in src/routes/visitRoutes.js:
  - deterministic request window around plannedDate (+/- 60s)
  - same identity dimensions: poolId + technicianId + roundId + active statuses
  - transactional guard with advisory xact lock and serializable transaction
  - if equivalent active visit exists: return existing visit with idempotent=true
  - otherwise create new visit

### Files/lines changed
- src/routes/visitRoutes.js:272-390

### Behavior after fix
- Equivalent immediate duplicate request no longer creates second visit.
- Concurrent equivalent requests produce at most one visit.
- Future legitimate visit still succeeds.
- Explicit extra visit via /api/extra-visits remains possible.

## Defect 2 - TECHNICIAN access to unrestricted client list

### Root cause
- /api/clients route had no auth middleware at route level.

### Fix
- Added centralized middleware gate at route file:
  - router.use(auth("TEAM_LEADER"))
  - This keeps ADMIN and TEAM_LEADER allowed under existing role implication logic.
  - TECHNICIAN and CLIENT receive 403.

### Files/lines changed
- src/routes/clientRoutes.js:1-10

### Authorization before/after
- Before:
  - GET /api/clients: accessible with any valid token reaching controller path (including TECHNICIAN/CLIENT in practice).
- After:
  - ADMIN: allowed
  - TEAM_LEADER/internal supervisory roles mapped by normalizeRole: allowed
  - TECHNICIAN: 403
  - CLIENT: 403

## Defect 3 - CLIENT access to company dashboard metrics

### Root cause
- /api/dashboard/metrics had no auth/role guard and returned company-wide metrics payload.

### Fix
- Added auth role middleware to metrics routes:
  - router.get("/metrics", auth("TEAM_LEADER"), ...)
  - router.post("/metrics", auth("TEAM_LEADER"), ...)

### Files/lines changed
- src/routes/dashboardRoutes.js:149-150

### Authorization before/after
- Before:
  - GET /api/dashboard/metrics exposed to CLIENT/TECHNICIAN tokens.
- After:
  - ADMIN/internal supervisor roles: allowed
  - TECHNICIAN: 403
  - CLIENT: 403

## Focused regression test suite

Added file:
- scripts/test-zero-bugs-backend-security.js

Coverage includes:
1. admin can access /api/clients
2. technician gets 403 on /api/clients
3. client gets 403 on /api/clients
4. admin can access /api/dashboard/metrics
5. client gets 403 on /api/dashboard/metrics
6. technician gets expected dashboard metrics result (403)
7. customer portal endpoint remains functional
8. technician today/route endpoint remains functional
9. duplicate sequential /api/visits/start creates at most one visit
10. duplicate concurrent /api/visits/start creates at most one visit
11. future visit still succeeds
12. explicit extra visit still succeeds

Test evidence (latest run): all checks OK + cleanup verified.

## Endpoint status matrix by role

| Endpoint | ADMIN | TEAM_LEADER/internal supervisor | TECHNICIAN | CLIENT |
|---|---|---|---|---|
| GET /api/clients | 200 | allowed by role implication | 403 | 403 |
| GET /api/dashboard/metrics | 200 | allowed by role implication | 403 | 403 |
| POST /api/visits/start (equivalent duplicate) | 200 idempotent or 409 | same contract | n/a | n/a |

## Cleanup evidence

All disposable test runs used ZERO-BUGS-BACKEND-<timestamp> prefix.
For each focused run, script logged cleanup success:
- OK cleanup verified - ZERO-BUGS-BACKEND-20260712T102353Z
- OK cleanup verified - ZERO-BUGS-BACKEND-20260712T102453Z

No residual prefix records were reported by the focused suite.

## Mandatory validation command exit codes

Final executed sequence (latest):
- C1 node --check (all modified JS): 0
- C2 node scripts/test-zero-bugs-backend-security.js: 0
- C3 node scripts/test-crystal-os-zero-bugs.js: 0
- C4 npm test: 0
- C5 npm run smoke: 0
- C6 node scripts/test-operational-flow.js: 0
- C7 node scripts/test-system-interconnections.js: 0
- C8 npx prisma migrate status: 0
- C9 git status --short: 0

## Remaining failures

- No critical or high failures remain for the three authorized backend defects.
- ZERO-BUGS runner still reports two explicit node-runner capability limitations:
  - offline/reconnect fully validated (not emulable in node-only runner)
  - visual overflow fully validated (needs browser runtime)
- These are non-blocking warnings in current runner severity model.

## Final recommendation

APPROVE FOR CONTROLLED FIELD PILOT

Rationale:
- All three authorized backend security/integrity defects are fixed.
- ZERO-BUGS runner exits 0.
- Full mandatory command set exits 0.
- Cleanup verified.
- No remaining critical/high blocker tied to authorized scope.
