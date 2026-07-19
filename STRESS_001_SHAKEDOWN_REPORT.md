# STRESS_001_SHAKEDOWN_REPORT

Date: 2026-07-07
Mission ID: STRESS-001
Mission: Shake Crystal OS hard before field validation
Scope rule: No feature additions, no architecture redesign, no Prisma changes, no commits

## What was tested

Core validation:
- npm test (Vitest)
- npm run smoke

Operational suites executed:
- scripts/test-visit-os-operational.js
- scripts/test-route-os-acceptance.js
- scripts/test-repair-os-operational.js
- scripts/test-installation-os-full-operational.js
- scripts/test-construction-os-operational.js
- scripts/test-administration-os-operational.js
- scripts/test-equipment-stock-os-operational.js
- scripts/test-finance-os-operational.js
- scripts/test-finance-os-acceptance.js
- scripts/test-customer-os-operational.js
- scripts/test-core-flow.js
- scripts/test-operational-flow.js
- scripts/test-system-interconnections.js
- scripts/test-master-month-flow-stress.js
- scripts/test-second-month-billing-flow.js (started, not completed due timeout/background interruption)

Security/integrity/performance probes executed:
- scripts/test-admin-login-alias.js
- scripts/test-v21-concurrency.js
- scripts/test-v21-schema.js
- scripts/test-v226-crud-lifecycle.js
- scripts/test-v2264-deep-audit.js
- scripts/test-v2265-enterprise-audit.js
- scripts/test-v2267-final-enterprise-audit.js
- scripts/test-v21-frontend-continuity.js
- scripts/test-ux-harmonized-v22.js
- scripts/test-navigation-audit-v22.js
- targeted auth/isolation/duplicate-action probes (custom runtime checks)
- dashboard load probe: 200 concurrent requests to /api/dashboard/metrics

Backup/continuity:
- scripts/backup-database.js executed successfully
- backup artifact created in backups/

## What failed

1. Interconnections monthly real flow failed with runtime 500.
- Error: Unknown field serialNumber in Pool select inside core flow creation path.
- Evidence: scripts/test-system-interconnections.js and scripts/test-real-month-flow-api.js failure report.

2. Route acceptance returned ok:false despite all major HTTP steps 200.
- Customer notifications count came back 0 in expected path.

3. Visit OS smoke returned ok:false despite endpoint status chain 200.
- Indicates assertion mismatch/contract drift in verification expectations.

4. Equipment Stock OS operational smoke failed.
- Non-JSON response: Cannot GET /api/equipment-stock-os/equipment on current runtime.

5. Static deep audit found forbidden demo/test text and invalid frontend link.
- demo/test marker found in admin/master flow references.
- invalid link found: /reports from admin master control page.

6. Duplicate invoice generation guard failed in canonical probe.
- Two generate calls for same client/month both accepted (200/200).

7. Navigation audit/UX integrity failed.
- Sidebar missing /admin-command-center link.
- admin-command-center page missing global CSS.

## Critical failures

1. Duplicate invoice generation allowed for same client/month.
- Category: Finance integrity / billing control.
- Impact: double billing risk, reconciliation overhead, trust/legal exposure.

2. Interconnections real-month flow crashes with 500 in core route.
- Category: Operational stability.
- Impact: full cross-module simulation breaks under realistic conditions.

## High failures

1. Equipment Stock OS endpoint mismatch/unavailable in tested runtime.
- Category: Stock operations.
- Impact: stock lifecycle stress path cannot be reliably validated.

2. Route acceptance functional mismatch (ok:false with customer notifications gap).
- Category: Operations + customer communications.
- Impact: route flow may complete without expected customer notification outcomes.

## Medium failures

1. Visit OS smoke assertion mismatch (ok:false while HTTP chain is 200).
- Category: Validation reliability.
- Impact: test contracts and production behavior may be drifting.

2. Dashboard heavy-load latency is high under 200 concurrent requests.
- Metrics: p50 ~2311ms, p95 ~4054ms, p99 ~4200ms, 0 5xx.
- Category: Performance.
- Impact: usable but degraded responsiveness under stress.

3. Frontend navigation/UX continuity gaps from static audits.
- Missing link and missing global CSS in critical admin page path.

## Low failures

1. Forbidden demo/test strings still present in production-facing code paths.
- Category: Release hygiene.

2. Validation completeness gap:
- second-month billing stress run did not complete in this mission run.

## Performance issues

1. Dashboard endpoint sustained concurrency without 5xx, but latency under load is elevated.
2. Stress profile suggests acceptable stability but medium performance risk for heavy simultaneous dashboard usage.

## Security issues

1. Positive result: customer cross-access probe returned blocked (403) in corrected authentication path.
2. Positive result: admin alias login guard passed.
3. Open risk: duplicate invoice generation behaves as a business-control vulnerability.

## Data integrity issues

1. Duplicate invoice generation accepted (same client/month) in targeted probe.
2. Interconnections monthly flow crashes before full lifecycle completion, increasing risk of partial operational artifacts.
3. Schema/migration status is up to date; no migration drift detected.

## UX/flow issues

1. Route acceptance and Visit smoke show assertion/expectation drift despite HTTP success paths.
2. Sidebar/navigation inconsistency and missing global CSS on admin command center path.
3. Customer notification expectation gap in route acceptance scenario.

## Recommended fixes

Priority order (no fixes applied in this mission):

1. Critical
- Enforce idempotency/uniqueness guard for invoice generation by client/month at business layer and persistence constraint boundary.
- Fix core flow monthly creation path causing serialNumber field crash.

2. High
- Align Equipment Stock OS route availability and script base-path assumptions for runtime consistency.
- Restore expected customer notification behavior in route acceptance chain.

3. Medium
- Reconcile Visit/Route smoke assertions with current production contracts.
- Optimize dashboard metrics endpoint performance under concurrency (target p95 reduction).
- Fix admin navigation/CSS continuity issues flagged by static audits.

4. Low
- Remove demo/test text markers from production-facing paths.
- Ensure long-running stress scripts complete in controlled terminal strategy.

## Go/No-Go for field validation

Recommendation: NO-GO.

Rationale:
- Critical finance integrity risk (duplicate invoice generation).
- Critical operational crash in real interconnections monthly flow.
- High-priority stock and route/customer notification validation failures.

## Coverage notes

Backup validated:
- PASS (backup artifact created successfully).

Restore and rollback validated:
- PARTIAL/NOT EXECUTED as full automated restore/rollback mission evidence was not completed in this run.
- No dedicated restore/rollback script detected in scripts/ directory by name convention search.
