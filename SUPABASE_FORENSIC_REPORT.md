# SUPABASE_FORENSIC_REPORT

Date: 2026-07-08
Mission ID: SUPABASE-002

## Scope Guardrails
- Database modified: NO
- Migrations executed: NO
- Commits made: NO

## Production Database Snapshot
- Target database: cristalwater_production_20260707
- Host: aws-0-eu-west-1.pooler.supabase.com
- Connection mode:
  - DATABASE_URL: pgbouncer (port 6543)
  - DIRECT_URL: direct PostgreSQL (port 5432)

## Customer Forensic Inventory

| ID | Name | Created date | Pools | Visits | Invoices | Source (if known) | Classification |
|---:|---|---|---:|---:|---:|---|---|
| 1 | QA Real Condominio Azul REAL-MES-1783465091272 | 2026-07-07 22:58:22 | 2 | 16 | 1 | UNKNOWN | TEST |
| 2 | QA Real Hotel Atlantico REAL-MES-1783465091272 | 2026-07-07 22:58:27 | 3 | 18 | 1 | UNKNOWN | TEST |
| 3 | QA Real Moradia Silva REAL-MES-1783465091272 | 2026-07-07 22:58:34 | 1 | 5 | 1 | UNKNOWN | TEST |
| 4 | QA Real Alojamento Sol REAL-MES-1783465091272 | 2026-07-07 22:58:37 | 1 | 7 | 1 | UNKNOWN | TEST |
| 5 | QA Real Moradia Rocha REAL-MES-1783465091272 | 2026-07-07 22:58:39 | 2 | 11 | 1 | UNKNOWN | TEST |
| 6 | QA Real Condominio Azul REAL-MES-1783465358345 | 2026-07-07 23:02:49 | 2 | 16 | 1 | UNKNOWN | TEST |
| 7 | QA Real Hotel Atlantico REAL-MES-1783465358345 | 2026-07-07 23:02:54 | 3 | 18 | 1 | UNKNOWN | TEST |
| 8 | QA Real Moradia Silva REAL-MES-1783465358345 | 2026-07-07 23:03:01 | 1 | 5 | 1 | UNKNOWN | TEST |
| 9 | QA Real Alojamento Sol REAL-MES-1783465358345 | 2026-07-07 23:03:04 | 1 | 7 | 1 | UNKNOWN | TEST |
| 10 | QA Real Moradia Rocha REAL-MES-1783465358345 | 2026-07-07 23:03:06 | 2 | 11 | 1 | UNKNOWN | TEST |
| 11 | QA Real Condominio Azul REAL-MES-1783465622569 | 2026-07-07 23:07:14 | 2 | 16 | 1 | UNKNOWN | TEST |
| 12 | QA Real Hotel Atlantico REAL-MES-1783465622569 | 2026-07-07 23:07:18 | 3 | 18 | 1 | UNKNOWN | TEST |
| 13 | QA Real Moradia Silva REAL-MES-1783465622569 | 2026-07-07 23:07:25 | 1 | 5 | 1 | UNKNOWN | TEST |
| 14 | QA Real Alojamento Sol REAL-MES-1783465622569 | 2026-07-07 23:07:28 | 1 | 7 | 1 | UNKNOWN | TEST |
| 15 | QA Real Moradia Rocha REAL-MES-1783465622569 | 2026-07-07 23:07:30 | 2 | 11 | 1 | UNKNOWN | TEST |

Classification rationale:
- Names contain QA/REAL-MES run markers, matching automated test-run patterns.
- No customer row presented business-origin source metadata.

## Pending Prisma Migrations Investigated

`npx prisma migrate status` reports pending:
- 20260605001000_v22_6_7_final_constraints_audit
- 20260614000100_add_pool_unique_constraints

### Migration: 20260605001000_v22_6_7_final_constraints_audit
1. Already applied manually?
- YES, functionally already present.
- Evidence: current FK delete actions in production already match intended states:
  - RESTRICT for ClientAccess/ClientMessage/ClientReportSetting/RoundTechnician/TechnicianVehicleLog FKs
  - SET NULL for MonthlyReport/RefreshToken/TechnicianLocation/TechnicianTrack FKs

2. Safe to apply?
- LIKELY YES (mostly idempotent `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` blocks).
- Operational caution: it still takes locks while altering constraints.

3. Obsolete?
- PARTIALLY YES.
- Functionally obsolete in this database state because target constraints already match.

4. Required before production?
- NO for runtime correctness in current state.
- YES only if strict Prisma migration-history alignment is required by deployment policy.

### Migration: 20260614000100_add_pool_unique_constraints
1. Already applied manually?
- NO.
- Evidence:
  - `Pool.serialNumber` column not present
  - `Pool_serialNumber_key` index not present
  - `pool_physical_location_unique` index not present

2. Safe to apply?
- YES, currently appears safe.
- Evidence: duplicate groups on `(address, location, type)` = 0.

3. Obsolete?
- NO.
- It adds constraints/features not present today.

4. Required before production?
- RECOMMENDED YES for data-quality enforcement (duplicate equipment prevention).
- STRICTLY REQUIRED only if business/ops policy mandates those uniqueness controls now.

## Risk Statement
- Migration history table is not aligned with current functional schema state (at least one pending migration appears already reflected in DB constraints).
- Customer/business tables in production are populated with test-run artifacts and should not be considered clean bootstrap data.

## Forensic Conclusion
- Customer dataset in current production target is TEST, not real-customer production data.
- Pending migrations consist of:
  - one functionally already-present constraint audit migration
  - one not-yet-applied unique-constraint migration that currently appears safe to apply

