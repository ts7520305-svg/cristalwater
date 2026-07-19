# STRESS_001_BLOCKERS_FIX_REPORT

Date: 2026-07-07
Mission ID: STRESS-001-RCA
Decision: CTO APPROVED
Scope executed: fix only the two real blockers before field validation

## Blocker 1

Issue:
- Duplicate invoice generation for the same client/month in the core monthly billing flow.

Patch applied:
- Updated [src/routes/coreFlowRoutes.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/src/routes/coreFlowRoutes.js) to detect a true duplicate generation request when an invoice for the same client/month already exists and there are no new billable repairs, service visits, extra visits, or monthly amount changes.
- In that case, the route now returns `409 INVOICE_ALREADY_EXISTS` with the existing invoice payload instead of silently regenerating the same monthly invoice.
- The same guard was applied to both `/api/core/invoices/generate` and `/api/core/invoices/generate-legacy` to avoid leaving the same blocker open on the parallel legacy route.

Targeted validation:
- Restarted PM2 app `cristalwater` to load the patch.
- Re-ran a narrow billing probe against `/api/core/invoices/generate`.
- Result:
  - first call: `200`
  - second identical call: `409`
  - second code: `INVOICE_ALREADY_EXISTS`
  - invoice id remained the same: `6133`

Status:
- FIXED

## Blocker 2

Issue:
- Crash 500 in the interconnected monthly flow caused by a `serialNumber` field selection on model `Pool` during the pool creation path used by the real monthly simulation.

Patch applied:
- No source-code patch was required in the current workspace state for this blocker.
- The current code in [src/routes/coreFlowRoutes.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/src/routes/coreFlowRoutes.js) already uses a safe duplicate-pool selector without `serialNumber` in the `select` clause.
- The blocker was resolved operationally by restarting the runtime on port `3002`, which was still serving an older in-memory process state than the code currently on disk.

Targeted validation:
- Re-ran [scripts/test-real-month-flow-api.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/scripts/test-real-month-flow-api.js).
- Result: PASS.
- Key evidence from the rerun:
  - `OK piscinas/jacuzzis criados por API real - 9 equipamentos`
  - `OK faturacao mensal gerada - 5 faturas`
  - report generated at `reports/real-month-flow-REAL-MES-1783460194956.json`

Status:
- FIXED

## Required Validation

`npm test`
- PASS
- `19` test files passed
- `38` tests passed

`npm run smoke`
- PASS
- health, version, modules, dashboard, core dashboard, and gps live endpoints responded successfully

`node scripts/test-operational-flow.js`
- PASS
- `Operational flow static test: OK`

`git status --short`
- Workspace is dirty with many unrelated pre-existing changes.
- Relevant blocker-fix file touched in this mission:
  - [src/routes/coreFlowRoutes.js](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/src/routes/coreFlowRoutes.js)
- Mission report files present:
  - [STRESS_001_SHAKEDOWN_REPORT.md](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/STRESS_001_SHAKEDOWN_REPORT.md)
  - [STRESS_001_ROOT_CAUSE_REPORT.md](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/STRESS_001_ROOT_CAUSE_REPORT.md)
  - [STRESS_001_BLOCKERS_FIX_REPORT.md](/home/ubuntu/systema/cristalwater_corrigido_testado_20260608/backend/STRESS_001_BLOCKERS_FIX_REPORT.md)

## Outcome

Real blockers approved for fix in STRESS-001-RCA:
- Duplicate invoice generation for same client/month
- Crash 500 in interconnected monthly flow caused by serialNumber field issue

Result:
- Both approved blockers are cleared in the validated runtime.