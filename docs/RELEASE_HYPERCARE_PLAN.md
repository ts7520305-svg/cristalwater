# RELEASE HYPERCARE PLAN

Date: 2026-07-26
Status: APPROVED
Baseline: RC1 approved
Release candidate: v22.6.7

## Objective

Define the controlled observation window immediately after deployment and the owners responsible for reacting to real production incidents.

## Window

- Planned deploy date: 2026-07-27
- Hypercare start: 2026-07-27T08:00:00Z
- Hypercare end: 2026-07-30T20:00:00Z

## Owners

- Release operator: Tiago Silva
- Technical reviewer: Release governance reviewer
- Business contact: Operations lead
- Incident escalation contact: On-call engineering lead

## Monitored Signals

- Application availability
- Authentication failures
- Error logs
- Backup integrity confirmation
- Technician operational flows
- Admin operational flows
- Client portal flows

## Decision Rules

1. Roll back immediately on blocking authentication, 5xx instability, or critical workflow failure.
2. Fix only real incidents during hypercare.
3. Do not add features or broad refactors.

## Evidence

- Monitoring dashboards reviewed: API health, error rate, auth failures, queue depth
- Log sources reviewed: logs/info-*.log, logs/error-*.log, pm2-out-0.log, pm2-error-0.log
- Rollback operator on call: Assigned

## Approval

- Release owner: Tiago Silva
- Reviewer: Release governance reviewer

## Gate Rule

Change `Status: PENDING` to `Status: APPROVED` only after the hypercare window and owners are formally approved.