# QA Environment Proposal

Date: 2026-07-12

## Objective

Provide a safe functional environment for executing the 22 write-blocked pages without any production side effects.

## Proposed Setup

- Runtime isolation:
  - Dedicated env file: `.env.qa`
  - Dedicated API port: `3102`
  - Dedicated frontend base URL: `https://qa.cristal.local`
- Database isolation:
  - Separate PostgreSQL schema/database (`cristal_qa`), never shared with prod/staging.
  - Daily anonymized refresh from sanitized snapshot.
  - Point-in-time backup before each QA campaign.
- Storage isolation:
  - Separate QA bucket/path for uploads and media.
  - Automatic cleanup policy for QA artifacts.
- Identity and roles:
  - Fixed QA users: `qa_admin`, `qa_technician`, `qa_client`.
  - Deterministic fixture IDs for reproducible tests.
- Feature switches:
  - `WHATSAPP_ENABLED=false`
  - `EMAIL_ENABLED=false`
  - `FISCAL_ISSUING_ENABLED=false`
  - `WEBHOOKS_ENABLED=false`

## Test Data Baseline

- Seed pack with known entities:
  - clients, pools, rounds, technicians, visits, invoices, alerts/incidents.
- Seed script idempotent and re-runnable between test cycles.

## Teardown and Promotion

- Teardown after each cycle:
  - reset DB to pre-cycle snapshot
  - purge QA media/upload artifacts
  - archive test evidence bundle
- Promotion path:
  - promote only code/config verified in QA
  - no direct data promotion from QA to production
  - production rollout requires fresh migration/seed strategy and release checklist sign-off
