# CRYSTAL UX PROBLEMS

Mission ID: CRYSTAL-OS-V2-AUDIT
Date: 2026-07-11
Scope: UX audit by role and screen groups.

## Method

Inventory audited:
- 40 Admin screens
- 11 Client screens
- 11 Technician screens
- 23 General operational screens
- Supervisor role: no explicit dedicated screens found in frontend inventory

Role inventory sources:
- [frontend/admin-master-control.html](frontend/admin-master-control.html)
- [frontend/admin-dashboard.html](frontend/admin-dashboard.html)
- [frontend/client-dashboard.html](frontend/client-dashboard.html)
- [frontend/technician.html](frontend/technician.html)

## Administrator UX Audit

### Screen groups covered
- Command and overview: admin-master-control, admin-dashboard, admin-menu, admin-today
- Execution modules: clients, pools, rounds, visits, alerts, inventory, payments
- Configuration and support: operational settings, security, suppliers, reports, AI

### Where am I?
- Often unclear. Multiple entry hubs exist (Dashboard, Centro, Menu), with overlapping purpose.

### Primary task clarity
- Mixed. Several screens present too many equal-priority cards/actions.

### How many clicks?
- Daily flows often exceed 2 clicks due to module jumps and context reset.

### What creates confusion?
- Duplicate hubs and wrapper redirects.
- Inconsistent page naming and route style.
- Different visual grammar per module.

### What wastes time?
- Re-entering context (client/pool/visit) when switching modules.
- Switching between old and new-looking pages.

### What should disappear?
- Redirect wrapper screens that do not provide unique value.

### What should merge?
- Dashboard + command center concepts into one canonical admin home.
- Repeated quick-links panels spread across pages.

### What should become automatic?
- Context persistence across modules (current client/pool/visit).
- Pre-filtering lists from previous actions.

## Secretary UX Audit

Primary screen group:
- [frontend/admin-crm.html](frontend/admin-crm.html)
- plus admin clients/pools/payments for operational back-and-forth

### Where am I?
- Clear in CRM screen title, but weak global task orientation after navigation transitions.

### Primary task
- Lead and reminder management is clear locally.

### How many clicks?
- Often >2 for fast scheduling and invoicing because workflow is spread across modules.

### Confusion points
- CRM looks/behaves different from adjacent admin modules.
- Keyboard-first behavior is partial, not systemic.

### Waste
- Repeated data lookup and manual navigation to linked modules.

### Should disappear
- Duplicate top links that recreate global navigation differently per page.

### Should merge
- Lead, reminder, quick scheduling, and invoice action launchers in one speed desk shell.

### Should be automatic
- Smart search across clients/pools/visits from one input.

## Technician UX Audit

Screen groups:
- [frontend/technician-field-mode.html](frontend/technician-field-mode.html)
- [frontend/technician.html](frontend/technician.html)
- route/map/visit/profit/gps/new-client

### Where am I?
- Better in field mode, weaker in legacy technician pages.

### Primary task
- In field mode: reasonably clear (execute visit).
- In legacy pages: mixed priorities and less focused hierarchy.

### How many clicks?
- Varies widely by page. Some flows are optimized, others still require module jumps.

### Confusion
- Two technician experiences coexist (legacy and field mode styles).
- Action labels and button hierarchy vary by screen.

### Waste
- Context switching between route/map/visit pages.

### Should disappear
- Overlapping technician hubs without clear role split.

### Should merge
- Route, current pool, and visit completion controls into one stable field cockpit.

### Should be automatic
- Next best action and required checklist sequencing per visit.

## Customer UX Audit

Screen groups:
- dashboard/menu/portal/payments/notifications/history/login

### Where am I?
- Mixed. Client dashboard is simplistic but disconnects from richer portal screen.

### Primary task
- Not consistently prioritized; dashboard/menu/portal overlap.

### How many clicks?
- Sometimes 1-2, but navigation model is fragmented and repetitive.

### Confusion
- Multiple client entry pages with different visual systems.
- Some legacy .html links and old route patterns remain.

### Waste
- Duplicate “entry pages” before reaching actionable area.

### Should disappear
- Redundant client launch/menu pages where portal already contains those actions.

### Should merge
- Dashboard + menu into one premium customer home.

### Should be automatic
- Unified timeline: next visit, payment status, and latest notification in one view.

## Supervisor UX Audit

Finding:
- No explicit supervisor front role found (no supervisor-prefixed pages, no dedicated IA entry).

Impact:
- Supervisor journeys are likely forced through admin surfaces, reducing role clarity.

Recommendation:
- Define dedicated supervisor role shell and scoped action set in IA.

## Cross-Role UX Problems

1. Role identity not persistent enough across modules.
2. Navigation is broad but not context-driven.
3. Visual language shifts between screens, increasing cognitive load.
4. Too many “hubs”, too few definitive role homes.
5. Keyboard and one-hand principles are not consistently enforced.

## Screen-by-Screen Coverage Matrix (grouped)

### Admin screens
- Hub and wrappers: admin-command-center, admin-core-flow, admin-menu, admin-test-center, admin-today
- Operations: admin-master-control, admin-dashboard, admin-alerts, admin-rounds, admin-visits, admin-visits-dashboard
- Entity modules: admin-clients, admin-pools, admin-pool-technical, admin-technicians, admin-keys, admin-inventory, admin-vehicles
- Financial/communications: admin-payments, admin-payment-settings, admin-collection, admin-email-logs, admin-reports, admin-notifications
- Governance/support: admin-operational-settings, admin-security, admin-ui-settings, admin-suppliers, admin-ai, admin-onboarding, admin-company-closures, admin-priority

### Client screens
- client-dashboard, client-menu, client-portal, client-payments, client-notifications, client-history, client-wow, client, client_chat, client_tech, client-login

### Technician screens
- technician-field-mode, technician, technician-route, technician-map, technician-visit, technician-guide, technician-new-client, technician-gps, technician-profit, technician-profit-dashboard, technician-login

Status: UX problem mapping complete. Waiting CTO approval before implementation.
