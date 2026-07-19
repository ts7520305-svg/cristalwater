# CRYSTAL NAVIGATION SYSTEM

Mission ID: UX-REBUILD-MASTER
Status: Strategy only. No implementation.

## Navigation Philosophy
Crystal OS navigation is action-oriented, not ERP menu-oriented.
Users navigate to complete work, not browse modules.

## Hard Constraints
- Maximum 3 navigation levels.
- Maximum 2 clicks to every daily task.
- Universal search always available.
- Global command palette always available.

## Global IA (All Roles)

## Level 1
- Home
- Today
- Operations
- Exceptions
- Communication
- Knowledge
- Control

## Level 2
- Today:
  - Daily Brief
  - Start Checklist
  - Timeline
- Operations:
  - Scheduling
  - Service Execution
  - Assets
  - Financial Ops
- Exceptions:
  - Critical Alerts
  - Blocked Work
  - Quality Issues
- Communication:
  - Inbox
  - Broadcasts
  - Requests
- Knowledge:
  - Client Records
  - Asset Records
  - SOP Library
- Control:
  - Reports
  - Configuration
  - Audit

## Level 3
- Task views and execution views only.
- No deep nesting.

## Context Navigation
Each screen includes:
- Location breadcrumb (Where am I?)
- Attention panel (What needs attention?)
- Next Action rail (What should I do now?)

## Command Palette
- Trigger: Cmd/Ctrl + K.
- Supports:
  - Jump to any workflow
  - Execute common actions
  - Create records
  - Reassign/resolve/escalate
- Returns executable actions, not just links.

## Universal Search
- One search across all role-allowed entities.
- Grouped results:
  - Clients
  - Assets
  - Work items
  - Financial records
  - Messages
- Each result includes one-click action.

## Role Prioritization
- Admin: Home defaults to Today > Daily Brief.
- Secretary: Home defaults to Today + Inbox + Scheduling.
- Technician: Home defaults to Start Checklist + Current Job.
- Customer: Home defaults to Pool Status + Next Visit + Invoices.

## Navigation Behavior by Device
- Desktop:
  - Left domain rail + contextual right pane.
- Tablet:
  - Collapsible left rail + persistent quick actions.
- Mobile:
  - Bottom navigation (Home, Today, Ops, Exceptions, Inbox)
  - More drawer for Knowledge and Control.

## De-duplication Rules
- One canonical route per workflow.
- Legacy route aliases redirect to canonical workflow endpoint.
- Duplicate dashboards are forbidden.

## Click Budget Matrix
- Critical alert resolution: <= 2 clicks
- Schedule change: <= 2 clicks
- Start visit: <= 2 taps
- Payment registration: <= 2 clicks
- Customer message reply: <= 2 clicks

## Navigation QA Checklist
- Can first-time users identify current location in 2 seconds?
- Is there exactly one dominant next action?
- Are all high-frequency tasks within 2 clicks?
- Are critical alerts visible without search?
- Are labels action-based and role-specific?
