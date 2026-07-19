# SUPABASE_PRODUCTION_FIX_PLAN

Date: 2026-07-08
Mission ID: SUPABASE-003

## Scope And Safety Rules
- Database modifications in this mission: NO (planning only).
- Migrations in this mission: NOT EXECUTED.
- Data deletion in this mission: NOT EXECUTED.
- Commits in this mission: NO.

## Baseline From SUPABASE-002
- Target DB: `cristalwater_production_20260707` (Supabase).
- TEST customers identified: 15.
- TEST footprint (from forensic report):
  - clients: 15
  - pools: 27
  - visits: 171
  - invoices: 15
- Pattern used to identify TEST customers:
  - `name ILIKE 'QA Real %'`
  - `name ILIKE '%REAL-MES-%'`

## Objective
Safely remove the 15 TEST customers and all dependent TEST data, then normalize migration state with minimal production risk.

## Phase 0 - Pre-Execution Controls (mandatory)
1. Announce maintenance window and freeze writes.
2. Keep one operator and one reviewer present (four-eyes rule).
3. Capture current app/process status and DB target.
4. Run dry-run counts and dependency map review.
5. If any dry-run number differs from approved scope, STOP.

## Phase 1 - Backup Steps (exact, before any DB change)
Run from backend root with current `.env` loaded.

1. Create backup directory:
```bash
TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups/supabase-fix-$TS"
mkdir -p "$BACKUP_DIR"
```

2. Export connection URL from `.env`:
```bash
DIRECT_URL=$(grep '^DIRECT_URL=' .env | cut -d '"' -f2)
```

3. Full logical backup (primary rollback artifact):
```bash
pg_dump "$DIRECT_URL" -Fc -f "$BACKUP_DIR/full_before_fix.dump"
```

4. Schema-only snapshot (audit/reference):
```bash
pg_dump "$DIRECT_URL" --schema-only -f "$BACKUP_DIR/schema_before_fix.sql"
```

5. Targeted TEST-scope export (fast forensic rollback aid):
```bash
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -c "\copy (
  WITH test_clients AS (
    SELECT id FROM \"Client\" WHERE name ILIKE 'QA Real %' OR name ILIKE '%REAL-MES-%'
  )
  SELECT c.* FROM \"Client\" c JOIN test_clients t ON t.id=c.id
) TO '$BACKUP_DIR/test_clients_before_fix.csv' CSV HEADER"
```

6. Check backup integrity:
```bash
pg_restore -l "$BACKUP_DIR/full_before_fix.dump" > "$BACKUP_DIR/full_before_fix.list"
sha256sum "$BACKUP_DIR"/* > "$BACKUP_DIR/checksums.sha256"
```

Approval gate: proceed only after reviewer validates backup files exist and `pg_restore -l` succeeds.

## Phase 2 - TEST Data Cleanup Plan (execution design)
This phase is a plan only. Do not run in SUPABASE-003.

### 2.1 Build deterministic target sets
Inside one SQL transaction:
- Create temp table `_test_clients` from the approved pattern.
- Create temp table `_test_pools` from `_test_clients`.
- Create temp table `_test_visits` from `_test_clients` and `_test_pools`.
- Create temp table `_test_invoices` from `_test_clients`.

### 2.2 Dry-run verification (must match approved scope)
- `count(_test_clients) = 15`
- `count(_test_pools) = 27`
- `count(_test_visits) = 171`
- `count(_test_invoices) = 15`

If any mismatch: ROLLBACK and STOP.

### 2.3 Deletion strategy (safe order)
Delete child rows first, then parent rows, in one transaction, with post-delete assertions.

Recommended order:
1. Invoice children:
- `InvoicePayment` by `_test_invoices`
- `InvoiceLine` by `_test_invoices`

2. Service visit children:
- any `serviceVisit` child tables (photos/chemicals/checklists/logs) by `_test_visits`
- operational records linked by `visitId`/`serviceVisitId` where present

3. Pool routing links and pool-level children:
- `RoundPool` by `_test_pools`
- pool-related children by `poolId` where applicable

4. Mid-level entities:
- `ServiceVisit` by `_test_visits`
- `Invoice` by `_test_invoices`
- `Pool` by `_test_pools`

5. Client-level entities:
- client messages/access/settings/history rows linked to `_test_clients` where not nullable/cascaded
- `Client` by `_test_clients`

6. Assert zero residuals:
- no rows in key business tables linked to `_test_clients`
- no FK violations

7. Commit only if all assertions pass.

Implementation note:
- Before execution day, generate a full FK dependency report for `Client/Pool/ServiceVisit/Invoice` and append exact table delete list to the runbook.
- If any unplanned dependency appears during dry-run, STOP and update the runbook first.

## Phase 3 - Pending Migration Handling Decision

### Migration: 20260605001000_v22_6_7_final_constraints_audit
Decision: MARK AS RESOLVED (not applied again).

Reasoning:
- SUPABASE-002 found its intended FK behaviors already present in production.
- Reapplying is likely safe but unnecessary for runtime behavior.
- Goal is to align Prisma migration history with real schema state.

Planned command (post-backup, controlled window):
```bash
npx prisma migrate resolve --applied 20260605001000_v22_6_7_final_constraints_audit
```

### Migration: 20260614000100_add_pool_unique_constraints
Decision: APPLY (after TEST data cleanup and prechecks).

Reasoning:
- Not present yet (`serialNumber` column + unique indexes missing).
- Functionally valuable for production data quality.
- Forensic check indicated no duplicate `(address, location, type)` groups at assessment time.

Pre-apply checks (mandatory at execution time):
1. Re-check duplicates on `(address, location, type)`.
2. Re-check duplicates/non-null conflicts for `serialNumber` strategy.
3. If duplicates exist, STOP and remediate data first.

Planned command:
```bash
npx prisma migrate deploy
```

## Phase 4 - Validation After Execution (planned)
1. `npx prisma migrate status` must show expected state.
2. `npm run smoke` must pass.
3. `node scripts/test-operational-flow.js` must pass.
4. Confirm TEST clients = 0 with the approved pattern query.
5. Confirm no unintended impact on admin/user/settings/product baselines.

## Rollback Plan (exact)
Rollback trigger examples:
- mismatch in deletion counts
- migration failure
- smoke/operational failure after change

### Fast rollback steps
1. Freeze traffic (maintenance mode).
2. Restore full backup to production DB:
```bash
DIRECT_URL=$(grep '^DIRECT_URL=' .env | cut -d '"' -f2)
BACKUP_DIR="backups/supabase-fix-<TS>"

psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DIRECT_URL" "$BACKUP_DIR/full_before_fix.dump"
```
3. Run validation:
```bash
npm run smoke
node scripts/test-operational-flow.js
```
4. Confirm restored counts match pre-change baseline.

### Rollback decision rule
- If restore validation fails: keep maintenance mode ON and escalate immediately.

## Risks
- Incomplete child-table coverage can cause FK block or orphan risk if delete order is wrong.
- Long transaction/locks during cleanup can impact live operations.
- Migration-history mismatch can confuse future deploy automation if not normalized.

## Go/No-Go Criteria For Execution Day
GO only if all are true:
- Backup verified (`pg_restore -l` successful).
- Dry-run counts exactly match approved target scope.
- FK dependency checklist is complete and reviewed.
- Duplicate prechecks for migration `20260614000100` pass.
- Rollback operator and reviewer are assigned.

Otherwise: NO-GO.
