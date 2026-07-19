# CRYSTAL ADMIN EXPERIENCE

Mission ID: UX-REBUILD-MASTER
Status: Strategy only. No implementation.

## Experience Goal
Transform Administrator from "viewer of many modules" into "operator of one command system".

## Command Center Model

## Dashboard Structure (5-7 primary cards max)
1. Critical Exceptions
2. SLA Risk Today
3. Team Capacity
4. Financial Risk
5. Pending Approvals
6. Priority Queue
7. End-of-Day Readiness

Rule: Every card is clickable and opens execution workflow.

## Screen Contract
- Where am I?
  - Today > Daily Brief > Admin Command Center
- What requires my attention?
  - Critical/overdue/blocked items at top
- What is my next action?
  - Single recommended next action in primary rail

## Daily Workflow
1. Start-of-day readiness
2. Triage critical exceptions
3. Reassign or escalate blockers
4. Approve high-impact decisions
5. Monitor SLA and financial risk
6. Publish end-of-day state

## Primary Actions
- Reassign
- Escalate
- Approve
- Trigger broadcast
- Open root-cause workflow

## Secondary Actions
- Tune policy settings
- Review trend reports
- Audit timeline review

## Notifications Model
- Critical notifications pin above fold.
- Each alert shows owner, deadline, escalation path.
- No passive alerts without action affordance.

## Search and Command
- Universal search by client, asset, technician, issue, invoice.
- Command palette actions include:
  - "Assign incident"
  - "Open blocked work"
  - "Run EOD checklist"

## Reports for Admin
- Operational throughput
- SLA breach risk
- Delay and root-cause distribution
- Financial risk and collections summary

## End-of-Day Workflow
1. Resolve or assign all P1 exceptions
2. Validate tomorrow coverage
3. Close unresolved with owner and ETA
4. Publish shift summary

## UX Constraints
- No decorative metrics without execution path.
- No duplicate command center screens.
- No more than one primary CTA per block.

## Device Behavior
- Desktop: split command + context panels.
- Tablet: compact command stacks.
- Mobile: critical-only executive mode.
