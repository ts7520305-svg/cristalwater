# CRYSTAL OS INFORMATION ARCHITECTURE

Mission ID: UX-ARCHITECT-002  
Date: 2026-07-08  
Status: Architecture proposal only (no implementation)

## 1) Design Principles
- Workflow-first operating system, not page-first navigation.
- Maximum three navigation levels.
- Maximum two clicks to every daily operation.
- Role-based home with immediate next action.
- Shared operating model across desktop, tablet, mobile.
- Progressive disclosure: show only what the role needs now.
- Exceptions first: alerts and blocked operations are always visible.

## 2) Core Operating Model (From Zero)
Crystal OS is organized around six universal workflow domains:
1. Today
2. Operations
3. Exceptions
4. Communication
5. Knowledge
6. Control

Each role sees these domains with different depth and permissions.

## 3) Global Navigation Architecture

### Level Rules
- Level 1: Role Home + six universal domains.
- Level 2: Workflow modules inside each domain.
- Level 3: Task views/actions only.
- No Level 4 allowed.

### Two-Click Rule Enforcement
- Click 1: Domain or quick action from Role Home.
- Click 2: Execute operation (create, assign, resolve, close, send, confirm).
- Every daily-critical action must be in:
  - Role Home quick actions, and
  - universal command launcher.

### Global Containers
- Top bar:
  - Role switch (if allowed), global search, notifications, command launcher, profile.
- Left rail (desktop/tablet) or bottom rail (mobile):
  - Today, Operations, Exceptions, Communication, Knowledge, Control.
- Context panel:
  - Live KPIs, blockers, pending approvals.

## 4) Complete Sitemap (Role-Aware)

## Level 1
- Home
- Today
- Operations
- Exceptions
- Communication
- Knowledge
- Control

## Level 2 and 3 by Domain

### Today
- Daily Brief
  - Priority Queue
  - SLA Clock
- Start-of-Day Checklist
  - Readiness
  - Capacity
- Shift Timeline
  - Next Actions
  - Deadlines

### Operations
- Scheduling
  - Route Plan
  - Visit Plan
- Service Execution
  - Active Jobs
  - Work Completion
- Assets
  - Pools/Units
  - Vehicles/Equipment
- Financial Ops
  - Billing Queue
  - Collections Queue

### Exceptions
- Critical Alerts
  - Immediate Response
  - Escalation
- Blocked Work
  - Dependency Resolution
  - Reassignment
- Quality Issues
  - Rework Queue
  - Root Cause Log

### Communication
- Inbox
  - Team Threads
  - Customer Threads
- Broadcasts
  - Internal Notices
  - Customer Notices
- Requests
  - Visit Requests
  - Change Requests

### Knowledge
- Client Records
  - Contracts
  - Service History
- Asset Records
  - Technical Specs
  - Maintenance History
- SOP Library
  - Checklists
  - Playbooks

### Control
- Reports
  - Operational
  - Financial
  - Quality
- Configuration
  - Policies
  - Permissions
- Audit
  - Activity Logs
  - Change Logs

## 5) Module Rationalization (Merge/Move/Hide/Remove)

### Merge
- Dashboard, command center, master control into one: Today > Daily Brief.
- Separate alerts modules into one: Exceptions > Critical Alerts.
- Split finance screens into one operational lane: Operations > Financial Ops.
- Fragmented technician screens into one lane: Operations > Service Execution.

### Move
- Reports under Control only.
- History under Knowledge records + Control audit.
- Notifications into Exceptions and Communication (not standalone module).

### Hide
- Advanced controls by default for Secretary, Technician, Customer.
- Expert planning features behind Supervisor/Admin permission.

### Remove
- Duplicate landing screens by role.
- Redundant dashboards with overlapping KPIs.
- Isolated legacy pages that do not map to workflow domains.

## 6) Role Operating Systems

## ADMIN
1. Daily starting screen:
- Home > Today > Daily Brief with enterprise status, financial risk, critical blockers, top priorities.

2. Main dashboard:
- Cross-domain executive cockpit: SLA, capacity, backlog, cash risk, compliance.

3. Daily workflow:
- Start-of-day readiness -> prioritize exceptions -> unblock teams -> approve critical decisions -> monitor execution -> close risk.

4. Primary actions:
- Approve/override decisions.
- Reassign resources.
- Escalate incidents.
- Trigger urgent communication.

5. Secondary actions:
- Tune policies.
- Review trend reports.
- Manage permissions.

6. Notifications:
- Critical-first stack with escalation timer and ownership.

7. Search:
- Universal search by client, asset, invoice, technician, alert, job ID.

8. History:
- Decision timeline and change/audit log.

9. Reports:
- Executive daily, weekly, monthly performance and risk pack.

10. End-of-day workflow:
- Validate unresolved criticals -> confirm tomorrow capacity -> publish daily summary -> lock shift.

## SECRETARY
1. Daily starting screen:
- Home > Today > Daily Brief focused on scheduling, inbound requests, collections follow-up.

2. Main dashboard:
- Coordination board: today appointments, pending confirmations, payment reminders, message queue.

3. Daily workflow:
- Confirm schedule -> process inbound requests -> update client records -> trigger reminders -> handoff blockers.

4. Primary actions:
- Create/reschedule visits.
- Confirm appointments.
- Send reminders.
- Open service requests.

5. Secondary actions:
- Update contact/contract details.
- Attach documents.
- Prepare supervisor escalations.

6. Notifications:
- Missed confirmations, overdue responses, payment reminder windows.

7. Search:
- Fast lookup by client phone/name/address/reference.

8. History:
- Interaction timeline per client.

9. Reports:
- Scheduling efficiency, no-shows, response times, collections follow-up rate.

10. End-of-day workflow:
- Reconcile tomorrow agenda -> close inbox leftovers -> publish unresolved queue to Supervisor/Admin.

## TECHNICIAN
1. Daily starting screen:
- Home > Today > Start-of-Day Checklist with vehicle, materials, route, access notes.

2. Main dashboard:
- Field cockpit: next job, route ETA, required checklist, safety and quality prompts.

3. Daily workflow:
- Start checklist -> navigate to job -> execute checklist and measurements -> capture evidence -> complete/flag exceptions -> move next.

4. Primary actions:
- Start job.
- Submit measurements/checklist.
- Upload photos/proof.
- Complete or block job.

5. Secondary actions:
- Request support.
- Report stock need.
- Add on-site notes.

6. Notifications:
- Route changes, urgent reassignments, access issues, safety alerts.

7. Search:
- Minimal quick search for assigned assets/clients/jobs only.

8. History:
- My jobs completed, exceptions opened, quality feedback.

9. Reports:
- Personal productivity, completion quality, revisit rate.

10. End-of-day workflow:
- Close open jobs -> submit unresolved reasons -> inventory reconciliation -> shift sign-off.

## CUSTOMER
1. Daily starting screen:
- Home > Today > Daily Brief with next visit, account status, open requests.

2. Main dashboard:
- Trust dashboard: schedule, latest service proof, invoices/payments, notifications.

3. Daily workflow:
- Review upcoming visit -> review service history -> pay/confirm invoice -> send message/request.

4. Primary actions:
- Confirm availability.
- Pay invoice / notify payment.
- Request visit/support.
- Read service report.

5. Secondary actions:
- Update contacts.
- Download documents.
- Adjust notification preferences.

6. Notifications:
- Upcoming visit, completed service report, invoice due, exception notice.

7. Search:
- Search within own history/documents/messages.

8. History:
- Service timeline + invoice timeline + communication timeline.

9. Reports:
- Customer-friendly service quality and account summary.

10. End-of-day workflow:
- Confirm pending actions (payment, approvals, responses) -> done state.

## SUPERVISOR
1. Daily starting screen:
- Home > Today > Team Brief with technician load, exception heatmap, on-time risk.

2. Main dashboard:
- Team operations board: active jobs, blocked jobs, reassignment panel, quality checks.

3. Daily workflow:
- Validate team readiness -> monitor route execution -> resolve blockers -> quality spot-check -> close pending exceptions.

4. Primary actions:
- Reassign technician/work.
- Approve field exception handling.
- Trigger immediate support.
- Validate completed critical jobs.

5. Secondary actions:
- Coaching notes.
- Team performance review.
- Material request approvals.

6. Notifications:
- Team criticals, delays, repeated quality deviations.

7. Search:
- Team-centric search by job, technician, client, zone.

8. History:
- Team decision log and intervention history.

9. Reports:
- Team SLA, first-time fix, delay causes, exception closure time.

10. End-of-day workflow:
- Confirm all critical exceptions owned -> team debrief -> tomorrow prep and staffing confirmation.

## 7) Home Screen Blueprint per Role

## Admin Home
- Top: enterprise health, risk score, cash risk, unresolved criticals.
- Middle: priority queue (actionable).
- Bottom: approvals and escalations.
- Quick actions: Approve, Reassign, Escalate, Broadcast.

## Secretary Home
- Top: today appointments and confirmations.
- Middle: inbox and callback queue.
- Bottom: billing reminders and unresolved requests.
- Quick actions: Schedule, Confirm, Remind, Open request.

## Technician Home
- Top: readiness checklist and first assignment.
- Middle: route + current job card.
- Bottom: pending evidence and unresolved blockers.
- Quick actions: Start Job, Upload Evidence, Report Blocker, Complete.

## Customer Home
- Top: next visit and service status.
- Middle: invoices due and quick payment.
- Bottom: messages and open requests.
- Quick actions: Confirm, Pay, Message, Request.

## Supervisor Home
- Top: team heatmap (risk, load, SLA).
- Middle: active/blocked jobs and reassignment.
- Bottom: quality checks and unresolved escalations.
- Quick actions: Reassign, Support, Validate, Escalate.

## 8) Complete Workflow Map (Cross-Role)

## A) Daily Operations Flow
1. Start-of-day readiness by role.
2. Priority queue generation.
3. Assignment and confirmation.
4. Execution and live updates.
5. Exception handling and escalation.
6. Financial and communication closure.
7. End-of-day handoff and lock.

## B) Exception Flow
1. Alert created.
2. Ownership assigned automatically.
3. SLA timer visible.
4. Resolution attempt.
5. Escalation if blocked.
6. Closure with evidence and root cause tag.

## C) Request Flow (Customer to Ops)
1. Customer request submitted.
2. Secretary triage and categorize.
3. Supervisor scheduling/assignment decision.
4. Technician execution.
5. Customer confirmation and feedback.

## 9) Complete User Journeys (Daily-Critical)

## Journey 1: Admin resolves critical risk
- Home -> Exceptions -> Critical Alerts -> Escalate/Reassign (2 clicks).
- Outcome: owner assigned, deadline set, communication triggered.

## Journey 2: Secretary schedules urgent visit
- Home quick action -> Operations > Scheduling -> Create slot + confirm (2 clicks).
- Outcome: job scheduled and notifications sent.

## Journey 3: Technician completes visit
- Home quick action Start Job -> Operations > Service Execution -> Complete with proof (2 clicks).
- Outcome: checklist, measurements, photos, status submitted.

## Journey 4: Customer pays invoice
- Home quick action Pay -> Operations > Financial Ops (customer scope) -> Confirm payment (2 clicks).
- Outcome: payment notice logged and status updated.

## Journey 5: Supervisor reassigns delayed job
- Home quick action Reassign -> Exceptions > Blocked Work -> Reassign + notify (2 clicks).
- Outcome: job moved, ETA recalculated, stakeholders informed.

## 10) Desktop / Tablet / Mobile Navigation Behavior

## Desktop
- Left rail visible full-time.
- Context panel on right for alerts/KPIs.
- Command launcher shortcut always available.

## Tablet
- Collapsible left rail.
- Floating quick actions pinned to role priorities.
- Split view for queue + detail.

## Mobile
- Bottom rail with five tabs: Home, Today, Ops, Exceptions, Inbox.
- Control and Knowledge via More drawer.
- Sticky quick action button (role-specific).
- One-thumb daily operations optimized.

## 11) Search Architecture
- One universal search with scoped facets by role.
- Search results grouped by:
  - People
  - Assets
  - Work items
  - Financial records
  - Messages
- Direct action from result card to preserve two-click rule.

## 12) Notification Architecture
- Priority levels:
  - P1 Critical (interruptive)
  - P2 Urgent (banner)
  - P3 Informational (feed)
- Every notification has:
  - owner
  - deadline
  - next action
  - escalation path

## 13) History and Audit Architecture
- Operational history in Knowledge domain.
- Governance audit in Control domain.
- Immutable event timeline for key actions:
  - assignment
  - reassignment
  - completion
  - exception closure
  - financial confirmation

## 14) Reporting Architecture
- Reports are role-filtered, not page-fragmented.
- Standard report families:
  - Operational throughput
  - SLA and delays
  - Quality and rework
  - Financial health
  - Customer trust indicators
- Reports support daily summary and end-of-day closure.

## 15) Governance Constraints
- Three-level depth maximum enforced by IA governance.
- Two-click daily operation compliance tested per role.
- No new module added unless mapped to one of six domains.
- Any new feature must declare:
  - primary role
  - primary workflow
  - target domain
  - quick action eligibility

## 16) Final Navigation Tree (Condensed)
- Home
- Today
  - Daily Brief
  - Start-of-Day Checklist
  - Shift Timeline
- Operations
  - Scheduling
  - Service Execution
  - Assets
  - Financial Ops
- Exceptions
  - Critical Alerts
  - Blocked Work
  - Quality Issues
- Communication
  - Inbox
  - Broadcasts
  - Requests
- Knowledge
  - Client Records
  - Asset Records
  - SOP Library
- Control
  - Reports
  - Configuration
  - Audit

All roles consume the same tree with permission-based visibility and role-prioritized shortcuts.

## 17) CTO Decision Gate
- No implementation performed.
- No HTML/CSS/code modified.
- Architecture ready for CTO review and approval.
