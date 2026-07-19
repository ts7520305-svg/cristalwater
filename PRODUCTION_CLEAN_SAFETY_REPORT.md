# PRODUCTION_CLEAN_SAFETY_REPORT

Date: 2026-07-07
Mission ID: PRODUCTION-001
Status: review only, cleanup script not executed

## Safety Decision

`prepare-production.js` was revised to stop using generic text markers such as `test`, `demo`, `qa`, `fake`, and `stress` as direct deletion criteria.

The script now follows this rule:
- automatic deletion is allowed only when there is strong provenance evidence that the entity was created by simulation, seed, smoke, finance acceptance, customer smoke, monthly real-flow, or stress scripts
- if strong provenance is not present, the entity is not deleted automatically
- uncertain entities are moved to manual review only

## Safe Automatic Deletions

Automatic deletion now starts only from root entities with strong non-production provenance, such as:
- emails in reserved non-production domains:
  - `@example.com`
  - `@cliente.test`
  - `@cristalwater.test`
  - `@stress.cristalwater.local`
- explicit script signatures found in the data itself:
  - `customer-os-`
  - `fin-ops-`
  - `fin-acc-`
  - `REAL-MES-`
  - `CW-STRESS-CLIENT-`
  - `Fatura mensal do teste final FINAL2Y_`
  - `Cliente criado pelo teste real mensal REAL-MES-`
  - `Equipamento real QA REAL-MES-`
  - `Servico concluido no teste real mensal REAL-MES-`
  - `Problema real QA REAL-MES-`
  - `Smoke customer message`
  - `Smoke visit request`
- exact known actor markers from test workflows:
  - `qa-admin`
  - `qa-tech`
  - `qa-client`
  - `qa-lead`
  - `qa-repair`
  - `qa-core-flow`

Once a root entity is confirmed safe to delete, the script may also delete its dependent children automatically, including:
- chat and client messages
- notifications
- communication logs
- visit photos
- chemical usage
- invoice lines and payments
- attachments bound to the targeted roots
- audit trail rows linked to targeted roots
- reminders and tasks linked to targeted roots
- repair, visit, invoice, pool, and client descendants linked to already-confirmed non-production roots

Important safety boundary:
- real technicians, vehicles, rounds, and users are no longer deleted just because they touched test data
- those roots require their own strong provenance before automatic deletion

## Manual Review Required

The script now sends entities to manual review when they show only weak or ambiguous signals, including:
- generic words like `test`, `demo`, `qa`, `fake`, `stress`, `wow`, `lorem`
- installation and construction workflow records in `OperationalLock` that do not carry strong provenance and are not linked to already-confirmed test roots
- technicians, vehicles, rounds, work guides, transport guides, invoices, repairs, pools, users, or clients that contain weak markers but no strong script signature

This change is the main protection against deleting a real customer by mistake.

## Never Delete List

- canonical administrator `cristal.water@sapo.pt`
- real customers without strong non-production provenance
- system configuration
- permissions and notification rules
- templates and frontend/runtime configuration assets
- inventory/product/catalog data
- chemical and equipment reference data
- business rules and company settings
- strategic/company markdown documents

## Remaining Risks

1. Some historical test data may remain in the database because the new strategy prefers false negatives over false positives.
2. `OperationalLock` remains the highest-risk area because installation and construction workflows share the same generic table.
3. If a non-production script wrote data without reserved domains, exact script phrases, `source`, or other strong provenance, that data will stay until manually reviewed.
4. Logs, backups, and generated reports still contain historical non-production references; the cleanup script intentionally does not remove those files.

## CTO Safety Outcome

The cleanup strategy is now safe by design relative to the CTO requirement:
- automatic deletion requires explicit provenance
- uncertainty results in manual review
- generic text markers alone no longer authorize deletion

The script was not executed.