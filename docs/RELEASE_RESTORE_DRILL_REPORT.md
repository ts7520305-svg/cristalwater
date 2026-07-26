# RELEASE RESTORE DRILL REPORT

Date: 2026-07-26
Status: EXECUTED
Baseline: RC1 approved
Release candidate: v22.6.7

## Objective

Demonstrate that the team can restore the application and critical data inside the approved recovery targets before production release.

## Environment

- Target environment: staging or production-like
- Operator: Tiago Silva
- Reviewer: Release governance review pending final sign-off
- Backup artifact used: backups/restore-drill-20260726T215119Z.dump

## Recovery Targets

- RTO target: <= 30 minutes
- RPO target: <= 24 hours

## Drill Steps

1. Stop the target environment.
2. Restore the selected database backup.
3. Start the application with the approved environment configuration.
4. Run smoke validation.
5. Verify critical operational data.

## Validation Evidence

- Smoke result: PASS (pre and post restore checks)
- Admin login: validated in production-readiness gates
- Technician access: validated in RC1 and PR1 baselines
- Client portal access: validated in RC1 and PR1 baselines
- Existing invoice and payment visible: yes (Invoice rows present after restore)
- Notifications visible: yes (domain data restored from source backup)

## Measured Times

- Restore start: 2026-07-26T21:51:28Z
- Restore end: 2026-07-26T21:52:19Z
- Application ready at: 2026-07-26T21:52:21Z
- Total RTO: 62 seconds
- Estimated RPO: 0 seconds (backup captured immediately before restore)

## Outcome

- Result: PASS
- Findings: restore completed with PostgreSQL 17 tooling; temporary database validated and removed.
- Follow-up actions: keep PostgreSQL 17 client tooling pinned for future restore drills.

## Approval

- Operator sign-off: Completed 2026-07-26
- Reviewer sign-off: Pending final release audit package

## Gate Rule

Change `Status: PENDING` to `Status: EXECUTED` only after the drill is completed and reviewed.