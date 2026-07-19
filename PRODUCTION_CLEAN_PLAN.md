# PRODUCTION_CLEAN_PLAN

Date: 2026-07-07
Mission ID: PRODUCTION-001
Rule: planning only, no deletion executed

## SAFE TO DELETE

Database entities that match strong non-production markers and their dependent records.

Patterns considered strong enough for automatic cleanup:
- `@example.com`
- `.local`
- `.test`
- `customer-os-`
- `fin-ops-`
- `fin-acc-`
- `REAL-MES-`
- `QA `
- `QA-`
- `Stress`
- `Rua de Teste`
- `teste real mensal`
- `teste final`
- `Cliente Demo`
- `Piscina Demo`
- `Técnico Demo`
- `Cliente WOW`
- `Portal WOW`
- `fake`
- `lorem`

Entity groups safe to delete when tied to these markers:
- test customers in `Client`
- test customer portal users in `User`
- test technicians in `Technician`
- test pools in `Pool`
- test service visits in `ServiceVisit`
- test legacy visits in `Visit`
- test repairs in `Repair`
- test invoices, invoice lines, and payments in `Invoice`, `InvoiceLine`, `Payment`
- test notifications in `Notification`
- test chat and client messages in `ChatMessage`, `ClientMessage`
- test communication logs and monthly reports tied to test clients
- test workflow locks for installation/construction in `OperationalLock`
- test vehicles, transport guides, work guides, and assignment logs
- test rounds and their join tables
- attachments, photos, chemical usage, technical history, technical alerts, reminders, tasks, and audit rows tied to test entities

## KEEP

Always keep these categories untouched by the cleanup script:
- administrator `cristal.water@sapo.pt`
- all system configuration in `SystemSetting`
- permission and notification rule structures
- inventory/products/catalogs including `InventoryProduct`
- chemical and equipment databases already represented in inventory/catalog structures
- company closures and seasonal rules
- business rules stored as configuration/documents
- strategic markdown documents in the repository
- templates and frontend assets unless explicitly handled outside this mission

## VERIFY MANUALLY

These require human review because pattern-only deletion can create false positives:
- any real customer whose legal/commercial name contains `Teste` or `Demo`
- historical reports under `reports/`
- logs under `logs/`
- SQL backups under `backups/`
- `.env.example` defaults such as `admin@cristalwater.local`
- frontend/admin test pages and test scripts in the repository
- any `OperationalLock` row not directly tied to a known test client/pool/visit/technician/vehicle and lacking explicit QA/stress markers

## NEVER DELETE

- canonical admin user `cristal.water@sapo.pt`
- production secrets or environment files
- Prisma schema and migrations
- company documents and strategy docs
- product/category/chemical/equipment catalogs
- business rules and system settings
- real customer operational data

## Execution Strategy

1. Ask for explicit confirmation string before any mutation.
2. Resolve target ids first using strong patterns.
3. Expand target ids through relations.
4. Delete children before parents.
5. Preserve canonical admin regardless of pattern overlap.
6. Print a deletion summary at the end.

## Planned Delete Order

1. Message/log child data:
- `ChatMessage`
- `ClientMessage`
- `CommunicationLog`
- `Notification`

2. Visit/repair/invoice child data:
- `VisitPhoto`
- `ChemicalUsage`
- `Attachment`
- `InvoiceLine`
- `Payment`
- `VisitLog`
- `VisitStateLog`

3. Workflow/support data tied to test entities:
- `OperationalReminder`
- `Task`
- `MonthlyReport`
- `TechnicalHistory`
- `TechnicalAlert`
- `AuditTrail`
- `OperationalLock`

4. Fleet/route support data:
- `WorkGuideItem`
- `TransportGuideItem`
- `WorkGuide`
- `TransportGuide`
- `TechnicianVehicleLog`
- `RoundPool`
- `RoundTechnician`

5. Core operational rows:
- `ServiceVisit`
- `Visit`
- `Repair`
- `Invoice`
- `Pool`
- `Round`
- `Vehicle`
- `Technician`
- `Client`
- test `User` rows, excluding `cristal.water@sapo.pt`

## Plan Conclusion

The cleanup can be automated safely if it is restricted to strong non-production markers and relation-based deletion.

The highest-risk area is `OperationalLock` because installation and construction workflows live there instead of dedicated tables.