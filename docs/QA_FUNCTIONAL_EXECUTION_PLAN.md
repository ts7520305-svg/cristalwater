# QA Functional Execution Plan

Date: 2026-07-12
Scope: 22 pages currently marked as `bloqueada por escrita` in `docs/UI_UX_PAGE_PROGRESS.md`.

## 1) Execution Preconditions

- Environment: dedicated QA stack only (never production DB).
- Profiles required:
  - `qa_admin` (ADMIN)
  - `qa_technician` (TECHNICIAN)
  - `qa_client` (CLIENT)
- Fixtures:
  - 8 clients, 16 pools, 3 technicians, 4 rounds, 12 open visits.
  - 15 invoices (`PENDING`, `PARTIAL`, `PAID` mix).
  - 20 alerts/incidents in mixed severity.
- External integrations MUST be disabled:
  - WhatsApp OFF
  - SMTP/email OFF
  - Fiscal documents OFF
  - Any webhook/callback OFF
- Capture evidence per test:
  - request/response summary
  - final UI state
  - DB delta (before/after)

## 2) Global Test Rules (Apply to All 22 Pages)

- Validate positive path with authorized profile.
- Validate forbidden path with wrong profile and no session.
- Validate double-click protection on primary write CTA.
- Validate error path with backend forced `4xx/5xx`.
- Validate idempotency by replaying the same payload.
- Validate offline behavior (network drop after submit) and post-reconnect sync state.
- Execute rollback step after each page block.

## 3) Per-Page Functional Matrix

| Page | Module | Main write actions | Fixture | Profile | Inputs | Expected result | Rollback | Risk | Integrations OFF | Double-click | Error path | Idempotency | Offline/sync |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| admin-client-settings.html | Clients/Portal | Save client portal settings | client with portal config | ADMIN | toggles + limits + save | settings persisted and reflected on reload | restore baseline config snapshot | Medium | N/A | second click ignored/locked | show inline error, no partial save | same payload keeps same state | queue none, final state consistent |
| admin-collection.html | Billing | mark paid, mark warned, manual register | 5 pending invoices | ADMIN | invoice id + amount + action | invoice status transitions correct | revert invoice status and ledger entries | High | WhatsApp OFF | only one status transition | toast/error, no duplicate ledger lines | repeated mark paid does not duplicate payment | after reconnect, single final transition |
| admin-company-closures.html | System Settings | create/edit closure periods | 2 existing closures | ADMIN | period, reason, active | closure saved and listed once | delete test closure or restore snapshot | High | N/A | create once only | blocked with message on validation/server fail | duplicate submit does not create extra row | reconnect shows one closure |
| admin-keys.html | Keys/Access | create, transfer, revoke key/codes | 3 keys, 2 technicians | ADMIN | key code + assignee + revoke | ownership updates audit trail once | restore original assignee/status | High | N/A | lock during submit | rollback message and unchanged ownership | repeated transfer to same target no duplicate event | reconnect keeps single event |
| admin-operational-settings.html | System Settings | save permissions/policies/upgrades toggles | baseline policies set | ADMIN | policy flags + confirm | policies persisted and displayed | import baseline policy JSON | Critical | all external OFF | no duplicate policy writes | fail safely; prior policy remains active | same policy payload no version spam | after reconnect effective policy unchanged |
| admin-pool-calculator.html | Pools | persist technical calculation output | pool with known chemical baseline | ADMIN | volume, chemistry values, save | calculated plan stored to pool record | reset pool calculation fields | Medium | N/A | single save event | show validation error, no invalid persist | same calc payload no duplicate note/history | offline save fails cleanly, retry stores once |
| admin-pool-technical.html | Pools | create/update/delete technical sheet and reminders | pool with full sheet | ADMIN | ranges, equipment data, reminder CRUD | sheet and reminders reflect inputs correctly | restore previous sheet from snapshot | High | Notifications OFF | no duplicate reminders/sheet versions | inline error and no partial section corruption | repeated same update keeps one latest version | reconnect state matches last successful write |
| admin-pools.html | Pools | create/edit/delete pools | client with 0/1 pools | ADMIN | pool form + edit + delete | lifecycle operations consistent in list and detail | remove created test pool, restore edited fields | High | N/A | create/delete guarded against double submit | errors do not create ghost rows | repeated create with same payload controlled by validation | reconnect no phantom pools |
| admin-rounds.html | Logistics Team | create/assign/reorder/delete rounds | 3 technicians, 6 pools | ADMIN | day, route, assignee, order | round plan saved and visible to technician context | restore original round map and assignments | High | N/A | assignment lock prevents duplicate action | explicit error and unchanged schedule | repeated assign same tuple no extra relation | reconnect preserves one schedule graph |
| admin-security.html | Team Permissions | reset password / security actions | 1 technician + 1 admin test user | ADMIN | target user + new password + confirm | password reset event logged once | reset back to known QA password | Critical | Email OFF | reset lock prevents duplicate reset | error path keeps old password valid | same reset request once per confirmed action | reconnect no extra reset events |
| admin-technicians.html | Team Permissions | create/edit/deactivate technicians | 2 active technicians | ADMIN | profile fields + permissions + status | technician record updates and ACL reflected | restore ACL/status or delete test user | High | N/A | no duplicate technicians on rapid create | form errors block write | repeated edit with same payload no extra audit noise | reconnect ACL/version consistent |
| admin-visits.html | Field Operations | create/edit visits and statuses | 6 planned visits | ADMIN | schedule, pool, technician, status | visit lifecycle consistent in timeline and list | revert visit statuses/dates | High | Notifications OFF | status update single transition | errors do not leave mixed status | repeated transition to same status is no-op | reconnect keeps final canonical status |
| billing-extras.html | Finance | issue extra billing | 3 extras candidates | ADMIN | extra item + value + confirm issue | extra invoice line generated once | cancel/remove generated extra entry | Critical | Fiscal OFF, WhatsApp OFF | issue action locked | failure does not emit financial row | same extra input not re-issued twice | reconnect confirms single extra record |
| incident-center.html | Field Operations | resolve/escalate incidents | 8 open incidents | ADMIN | incident id + action + note | status and notes updated, SLA timestamps valid | revert incident to previous state for test rows | High | Notifications OFF | one resolution event only | error keeps incident open with no partial note | repeated resolve no duplicate closure events | reconnect shows one authoritative incident state |
| settings.html | Client Settings | save client preferences | client with default settings | CLIENT | notification/sound/preference toggles | preferences stored for current client only | restore baseline preferences | Medium | Email/WhatsApp OFF | save lock active | user feedback on failure, values rollback | repeated same payload no extra writes | offline failure then retry stores once |
| technician-field-mode.html | Field Ops | start/problem/finish field job actions | assigned visit in progress | TECHNICIAN | action + notes + metrics | job state transitions correctly and timestamps set | set visit back to pre-test status | Critical | Notifications OFF | action buttons lock per transition | backend error leaves prior state intact | same transition replay not duplicated | reconnect syncs latest accepted transition |
| technician-gps.html | Fleet | send GPS tracking pings | technician with active route | TECHNICIAN | coordinates + heartbeat payload | one tracking point per accepted send | delete test telemetry points in QA cleanup | High | External maps callbacks OFF | no duplicate ping on double click | fail gracefully and no corrupted point | identical payload in same minute deduped | buffered/offline points sync once on reconnect |
| technician-guide.html | Logistics Guide | consume/close guide operations | 1 active guide with 5 items | TECHNICIAN | item actions + close guide | guide item states and closure consistent | reopen/reset test guide snapshot | High | N/A | close/consume locks active | errors keep guide open and consistent | repeated consume same item no double consumption | reconnect preserves canonical guide state |
| technician-new-client.html | Client Intake | create client by technician | empty lead slot | TECHNICIAN | identity + contact + zone | client created in pending/expected state per rules | delete created QA client | High | Fiscal OFF, Email OFF | create action locked | validation errors no partial client row | duplicate submit blocked by uniqueness rules | reconnect no duplicate client records |
| technician-visit.html | Field Ops | complete/not-done/photo upload | assigned planned visit | TECHNICIAN | checklist + status + media | visit final status, metrics, media linkage valid | restore visit status/remove test media | Critical | Notifications OFF | finish action lock | failure keeps prior status and no orphan media refs | repeated finish no duplicate closure | offline media handling consistent after reconnect |
| technician.html | Technician Shell | indirect write actions from shell widgets | technician with tasks | TECHNICIAN | quick actions from shell | only intended action executes once | undo action or restore fixture snapshot | High | Notifications OFF | shell CTA lock effective | shell shows actionable error | repeated quick action no duplicate side effect | reconnect shell reflects single final outcome |
| to-issue.html | Finance | mark invoice as issued | pending-to-issue invoice set | ADMIN | invoice id + confirm issue | invoice status moves to issued once | revert status to pre-issue in QA DB | Critical | Fiscal OFF | issue button lock | failure leaves status unchanged | repeated issue request is no-op | reconnect shows one issue transition |

## 4) Suggested Execution Order

1. Admin finance/system writes:
   - admin-operational-settings.html
   - admin-security.html
   - billing-extras.html
   - to-issue.html
2. Admin operations writes:
   - admin-pools.html
   - admin-pool-technical.html
   - admin-pool-calculator.html
   - admin-rounds.html
   - admin-visits.html
   - incident-center.html
   - admin-collection.html
   - admin-keys.html
   - admin-client-settings.html
   - admin-company-closures.html
   - admin-technicians.html
3. Client write:
   - settings.html
4. Technician writes:
   - technician.html
   - technician-field-mode.html
   - technician-visit.html
   - technician-guide.html
   - technician-gps.html
   - technician-new-client.html

## 5) Exit Criteria

- All 22 pages executed end-to-end in QA environment.
- 0 critical open defects in write paths.
- 0 duplicate writes under double-click/retry.
- 0 unauthorized cross-profile write.
- Signed evidence package generated (logs + screenshots + DB deltas + rollback proof).
