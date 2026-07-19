## Visit OS

Status: ✅ Production Ready

Mission: A technician must be able to perform an entire visit from start to finish without leaving Visit OS.

Validated capabilities:

- Open assigned visit
- Show customer and pool context
- Show permanent notes, temporary notes, alerts, equipment and chemistry targets
- Record chemistry, products, photos, observations and incidents
- Complete visit and generate customer notification
- Update customer portal, dashboard, history, audit log and technician statistics

Validation:

- `node -c` on runtime files ✅
- `npm test` ✅
- Operational smoke test ✅

Operational Acceptance Record

- Status: Completed
- Acceptance date: 2026-07-05
- Scenario executed: Create 1 technician, start 1 workday, create 5 clients, 5 pools and 5 planned visits, generate the technician day route, log in by PIN, load today's route, complete the 5 visits, and verify notifications, dashboard, history and audit trail.
- Number of clients: 5
- Number of pools: 5
- Number of visits: 5
- Number of notifications: 6
- Number of audit entries: 5
- Issues found: technician portal today route was not mounted; global route optimization included existing visits; visit equipment relation shape was one-to-one.
- Issues fixed: used the mounted technician today route, validated the created visits as a filtered route subset, and aligned the equipment assertion with the real Prisma relation.
- Final Go/No-Go decision: GO

## Route OS Operational Acceptance

Status: ✅ Acceptance Passed

Mission:

- Create one technician and one workday
- Create 5 real pools with equipment and planned visits
- Generate the technician day route
- Log in as technician and open today's route
- Execute the 5 visits in sequence
- Verify customer notifications, dashboard, history and audit trail

Acceptance checklist:

- Technician created with PIN login
- Workday started for the assigned user
- 5 pools created with coordinates
- 5 planned visits created for the technician
- Route preview generated
- Today's route loaded for the technician
- 5 visits completed successfully
- Customer notifications created
- Dashboard metrics updated
- Technical history updated
- Audit trail entries recorded

Result:

- Passed on the live backend in 25.9s.
- 5 clients created.
- 5 pools created.
- 5 planned visits created and completed.
- 5 technical history rows confirmed.
- 5 audit trail rows confirmed.
- 6 customer notifications confirmed.
- Technician today route loaded successfully.
- Workday stayed ACTIVE throughout the scenario.

Issues found:

- The technician portal route was not mounted at `/api/technician-portal/:id/today`; the acceptance used `/api/technician/today` instead.
- Route optimization is global, so the test validates the created visits as a filtered subset instead of assuming an empty routing dataset.
- `equipment` is a one-to-one relation on visit detail, so it must be checked as an object, not a list.

Fixes applied during the test:

- Switched the today-route validation to `/api/technician/today?technicianId=...`.
- Relaxed the route assertion to confirm inclusion of the 5 created visits.
- Adjusted the equipment assertion to match the actual Prisma relation shape.

Go / No-Go:

- GO for Route OS implementation planning.

## Repair OS Operational Phase

Status: ✅ Operational phase validated

Business outcome:

- Repair intake, diagnosis, quote, scheduling, messaging, approval, invoicing, and closure now run through a single repair business layer.
- Diagnostic and scheduling steps reuse the existing stock repository instead of creating a parallel repair stock subsystem.

Operational outcome:

- Repair creation remains the entry point.
- New `/api/repairs/:id/diagnose` and `/api/repairs/:id/schedule` flows are available.
- `mark-sent` no longer references broken state and returns the historical confirmation message again.

Files changed:

- `src/business/repair/RepairBusiness.js`
- `src/controllers/repairController.js`
- `src/routes/repairRoutes.js`
- `src/services/repairEventService.js`

Tests executed:

- `node -c src/business/repair/RepairBusiness.js`
- `node -c src/controllers/repairController.js`
- `node -c src/routes/repairRoutes.js`
- `node -c src/services/repairEventService.js`
- `npm test`

Operational validation:

- Live backend smoke on an isolated port validated create, diagnose, schedule, and mark-sent repair flows.
- The server start failure seen on the default port was confirmed as `EADDRINUSE`, not a code regression.

Risks:

- Repair scheduling currently persists through the Repair state machine and history rather than a dedicated repair schedule table.
- Repair stock availability is checked from the central stock balances, but actual reservation/consumption still needs a later capability slice.

Production recommendation:

- GO for the current repair slice.
- Continue with the next repair capability only if the same single-source-of-truth rule is preserved for stock reservation and execution.

## Repair Photo Capability

Status: ✅ Operational capability validated

Business outcome:

- Repair records now support proof-of-work photos as first-class attachments.
- Photo uploads are recorded in repair history, audit trail, notifications, and the repair event stream.

Operational outcome:

- `POST /api/repairs/:id/photo` accepts a multipart `photo` upload.
- Uploaded photos are persisted as repair attachments and returned through repair detail data.
- Dashboard refresh is emitted through the repair event bus.

Files changed:

- `src/business/repair/RepairBusiness.js`
- `src/controllers/repairController.js`
- `src/dal/RepairRepository.js`
- `src/routes/repairRoutes.js`
- `src/services/repairEventService.js`

Tests executed:

- `node -c src/business/repair/RepairBusiness.js`
- `node -c src/controllers/repairController.js`
- `node -c src/routes/repairRoutes.js`
- `node -c src/dal/RepairRepository.js`
- `node -c src/services/repairEventService.js`
- `npm test`

Operational validation:

- Live multipart smoke uploaded a repair photo successfully.
- The repair record returned one persisted attachment with the expected URL and MIME type.

Risks:

- Repair photos are stored on local disk under `uploads/repairs` and continue to rely on the existing filesystem deployment model.
- Large photo volumes may require later object storage or lifecycle retention policies.

Production recommendation:

- GO for the photo capability.
- Continue to the next repair capability with the same architecture guardrails.

## Repair Creation Delegation Closeout

Status: ✅ Duplicate repair creation path removed

Business outcome:

- The direct repair creation path in `src/routes/coreFlowRoutes.js` was removed.
- Repair creation now delegates to `RepairBusiness.createRepairTicket()` as the single repair creation entry point.
- API, JSON, EventBus, and audit compatibility were preserved.

Duplicated path removed:

- `src/routes/coreFlowRoutes.js` direct `db('repair').create(...)` call

Files changed:

- `src/routes/coreFlowRoutes.js`
- `OPERATIONS.md`

Validation:

- Repository-wide creation scan confirmed no remaining direct repair creation calls outside the delegated repository layer.
- `node -c src/routes/coreFlowRoutes.js`
- `npm test`
- `npm run smoke`
- `git status --short`

Risks:

- `src/dal/RepairRepository.js` still owns the delegated Prisma write, which is expected because RepairBusiness now routes all repair creation through that repository abstraction.
- The workspace remains dirty with unrelated user edits, so later diffs must be reviewed carefully before any broader refactor.

## Repair OS Production Ready

Status: ✅ Production Ready

Business outcome:

- Operation 2 (Repair) now executes end to end inside Crystal OS: ticket creation, diagnosis, parts suggestion, stock reservation, quote, customer approval, technician scheduling, execution, photo attachment, stock consumption, invoice generation, payment tracking, and final closeout.

Operational outcome:

- Repair invoice generation now creates and issues a real invoice through the finance business layer.
- Repair payment tracking now records payment against the generated invoice and marks the repair as paid.
- Repair closeout now requires payment unless forced, and the repair lifecycle ends in `CLOSED`.

Files changed:

- `src/business/repair/RepairBusiness.js`
- `src/controllers/repairController.js`
- `src/routes/repairRoutes.js`
- `src/services/repairEventService.js`
- `scripts/test-repair-os-operational.js`

Tests:

- `node -c src/business/repair/RepairBusiness.js`
- `node -c src/controllers/repairController.js`
- `node -c src/routes/repairRoutes.js`
- `node -c src/services/repairEventService.js`
- `node -c scripts/test-repair-os-operational.js`
- `npm test`
- `node scripts/test-repair-os-operational.js`
- `npm run smoke`

Risks:

- Repair invoice creation still depends on the existing finance business layer for invoice persistence and payment registration.
- Repair closeout requires the payment flag to be set unless `force` is explicitly passed.
- The workspace still contains many unrelated modified and untracked files from prior delivery work.

Production recommendation:

- GO for Repair OS production rollout.

## Installation OS Operational Phase

Status: ✅ Operational phase validated

Business outcome:

- Pool equipment installation is now executable as a single business action inside the Pool Equipment subsystem.
- Installing equipment upserts the pool equipment record and records the installation in technical history and event streams.

Operational outcome:

- `POST /api/pool-equipment/:poolId/install` installs or updates pool equipment for a pool.
- Installation events are visible in equipment lifecycle history and the stock event bus.
- The installed equipment becomes available to the equipment lifecycle dashboard and reporting views.

Files changed:

- `src/business/pool/PoolEquipmentBusiness.js`
- `src/controllers/poolEquipmentController.js`
- `src/routes/poolEquipmentRoutes.js`
- `src/services/equipmentStockEventService.js`
- `tests/pool-equipment-installation.test.js`
- `scripts/test-installation-os-operational.js`

Tests:

- `node -c src/business/pool/PoolEquipmentBusiness.js`
- `node -c src/controllers/poolEquipmentController.js`
- `node -c src/routes/poolEquipmentRoutes.js`
- `node -c src/services/equipmentStockEventService.js`
- `node -c scripts/test-installation-os-operational.js`
- `npm test`
- `node scripts/test-installation-os-operational.js`
- `npm run smoke`

Risks:

- Pool equipment is still modeled as one record per pool, so installation currently behaves as an upsert rather than a multi-item asset register.
- The installation event is recorded through the existing technical history and event bus model, which is consistent with the current architecture but may need richer asset metadata later.

Production recommendation:

- GO for Installation OS production rollout.

## Installation OS V2 — Equipment Registry

Status: ✅ Operational capability validated

Business outcome:

- Equipment Registry now supports multiple pumps, multiple filters, and multiple chlorinators per pool.
- Asset lifecycle now includes installation, replacement, warranty updates, and removal.
- Removed equipment stays visible in lifecycle history instead of being lost from operational traceability.

Operational outcome:

- New registry endpoints in Pool Equipment API:
	- `GET /api/pool-equipment/:poolId/registry`
	- `POST /api/pool-equipment/:poolId/assets/install`
	- `POST /api/pool-equipment/:poolId/assets/:assetId/replace`
	- `POST /api/pool-equipment/:poolId/assets/:assetId/warranty`
	- `POST /api/pool-equipment/:poolId/assets/:assetId/remove`
- Registry is event-sourced through technical history events (`EQUIPMENT_ASSET_*`) and exposed as active assets, removed assets, replacement history, warranty history, and full lifecycle stream.

Files changed:

- `src/business/pool/PoolEquipmentBusiness.js`
- `src/controllers/poolEquipmentController.js`
- `src/routes/poolEquipmentRoutes.js`
- `tests/pool-equipment-installation.test.js`
- `scripts/test-installation-os-operational.js`

Tests:

- `node -c src/business/pool/PoolEquipmentBusiness.js`
- `node -c src/controllers/poolEquipmentController.js`
- `node -c src/routes/poolEquipmentRoutes.js`
- `node -c scripts/test-installation-os-operational.js`
- `npm test`
- `node scripts/test-installation-os-operational.js`
- `npm run smoke`

Risks:

- Registry lifecycle is reconstructed from technical-history events, so event payload integrity must be preserved.
- Existing one-row `poolEquipment` model remains as the pool equipment snapshot, while multi-asset lifecycle is maintained in the registry stream.

Production recommendation:

- GO for Installation OS V2 rollout.

EPIC-004 Route OS implementation plan

1. Validate and expose the daily route surface consistently for the technician workflow.
2. Formalize route generation inputs and outputs around the existing optimize endpoint.
3. Add regression coverage for route creation, route loading, and visit execution order.
4. Verify downstream effects for notifications, dashboard, history, and audit trail after route completion.
5. Publish the Route OS readiness report and only then start feature implementation work.

## Route OS Production Ready

Status: ✅ Production Ready

Operational Acceptance Record

- Status: Completed
- Acceptance date: 2026-07-05
- Scenario executed: Create 1 technician, start 1 workday, create 5 real pools with coordinates and equipment, create 5 planned visits, generate the day route, load the technician today route, complete the 5 visits, and verify notifications, dashboard, history and audit trail.
- Number of clients: 5
- Number of pools: 5
- Number of visits: 5
- Number of notifications: 6
- Number of audit entries: 5
- Issues found: route optimization is global across the dataset; the technician today route must be resolved through the mounted today endpoint; offline route continuity needed client-side recovery and idempotent sync handling.
- Issues fixed: validated the generated visits as a filtered subset, aligned route loading to the mounted technician today endpoint, added route snapshot recovery, added sync-key deduplication, and resolved already-completed visit conflicts deterministically.
- Final Go/No-Go decision: GO

## Installation OS Production Ready

Status: ✅ Production Ready

Business outcome:

- Operation 3 (Installation) now runs end-to-end as a single orchestrated workflow: request, proposal, quote, customer approval, scheduling, technician assignment, stock reservation, work order generation, installation execution, GPS check-in, photos, serials, warranty, checklist, signatures, customer acceptance, stock consumption, invoice, payment, and completion.
- Installation now has a dedicated Controller → Business → Repository flow, with stock, finance, audit, notification, client message, and event-bus integrations.

Operational outcome:

- New Installation OS API mounted at `/api/installations` with explicit workflow step endpoints.
- New installation event stream introduced in `src/services/installationEventService.js`.
- Full operational acceptance script introduced in `scripts/test-installation-os-full-operational.js`.

Files changed:

- `src/business/installation/InstallationBusiness.js`
- `src/controllers/installationController.js`
- `src/dal/InstallationRepository.js`
- `src/routes/installationRoutes.js`
- `src/services/installationEventService.js`
- `src/server.js`
- `scripts/test-installation-os-full-operational.js`

Validation:

- `node -c src/services/installationEventService.js`
- `node -c src/dal/InstallationRepository.js`
- `node -c src/business/installation/InstallationBusiness.js`
- `node -c src/controllers/installationController.js`
- `node -c src/routes/installationRoutes.js`
- `node -c scripts/test-installation-os-full-operational.js`
- `node -c src/server.js`
- `npm test`
- `node scripts/test-installation-os-full-operational.js`
- `npm run smoke`

Performance check:

- Full installation acceptance runtime: `elapsed=0:13.88`, `maxrss=83200KB`.

Production recommendation:

- GO for Installation OS production rollout.

## Construction OS Production Ready

Status: ✅ Production Ready

Business outcome:

- Operation 4 (Construction) now executes as a complete workflow in Crystal OS with a single source of truth from project creation to warranty and completion.
- Flow delivered: project creation, customer approval, budget, planning, phases, material planning, stock reservation, team assignment, daily logs, photos, progress tracking, variation orders + approval, billing milestone, final inspection, final handover, warranty registration, customer notification, dashboard sync, audit/history trail, and completion.

Operational outcome:

- New Construction OS API mounted at `/api/construction`.
- Construction orchestration follows Controller → Business → Repository.
- EventBus, audit trail, metrics, stock integration and finance milestone billing are enforced in the workflow.

Files changed:

- `src/services/constructionEventService.js`
- `src/dal/ConstructionRepository.js`
- `src/business/construction/ConstructionBusiness.js`
- `src/controllers/constructionController.js`
- `src/routes/constructionRoutes.js`
- `src/server.js`
- `scripts/test-construction-os-operational.js`

Validation:

- `node -c src/services/constructionEventService.js`
- `node -c src/dal/ConstructionRepository.js`
- `node -c src/business/construction/ConstructionBusiness.js`
- `node -c src/controllers/constructionController.js`
- `node -c src/routes/constructionRoutes.js`
- `node -c scripts/test-construction-os-operational.js`
- `node -c src/server.js`
- `npm test`
- `node scripts/test-construction-os-operational.js`
- `npm run smoke`

Production recommendation:

- GO for Construction OS production rollout.

## Administration OS Production Ready

Status: ✅ Production Ready

Business outcome:

- Operation 5 (Administration) now delivers a full operational module with HR, Vehicles, Fleet, Purchases, Suppliers, Internal Tasks, KPIs, Company Dashboard, Productivity, Vacation, Absences, Internal Messaging, Approvals, Company Reports, Audit, and Notifications.
- Administration workflow is centralized under one operational module state with end-to-end traceability and completion gate.

Operational outcome:

- New Administration OS API mounted at `/api/administration`.
- Controller → Business → Repository architecture enforced.
- EventBus, audit trail, metrics, notifications, and reporting integration are active.

Files changed:

- `src/services/administrationEventService.js`
- `src/dal/AdministrationRepository.js`
- `src/business/admin/AdministrationBusiness.js`
- `src/controllers/administrationController.js`
- `src/routes/administrationRoutes.js`
- `src/server.js`
- `scripts/test-administration-os-operational.js`

Validation:

- `node -c src/services/administrationEventService.js`
- `node -c src/dal/AdministrationRepository.js`
- `node -c src/business/admin/AdministrationBusiness.js`
- `node -c src/controllers/administrationController.js`
- `node -c src/routes/administrationRoutes.js`
- `node -c scripts/test-administration-os-operational.js`
- `node -c src/server.js`
- `npm test`
- `node scripts/test-administration-os-operational.js`
- `npm run smoke`

Production recommendation:

- GO for Administration OS production rollout.

## RC1 Release Gate - Backup/Restore and Rollback Evidence

Status: 🟡 Required before V1.0 GO

Mandatory checks:

1. Backup drill executed with `npm run backup:db`.
2. Restore drill executed in staging from latest backup.
3. Post-restore smoke test executed with `npm run smoke`.
4. Migration rollback drill documented for last release candidate.

Rollback drill minimum:

- deploy previous app version in staging
- restore pre-migration backup
- run smoke test and login checks
- validate one technician route flow and one finance flow

Acceptance evidence to attach:

- backup filename and timestamp
- restore command log
- smoke output summary
- measured RTO/RPO
- pass/fail signed by operations owner
