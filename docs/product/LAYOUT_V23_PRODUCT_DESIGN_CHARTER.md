# Layout V23 Product Design Charter

Date: 2026-07-26
Branch: layout-v23
Status: ACTIVE

## 1) Mission

Evolve product experience without changing system behavior.

Rule of law for this branch:
- No visual change is allowed to alter business logic or flow behavior.
- If a button changes position, that is layout work.
- If a flow changes how it works, that is not layout work.

## 2) Scope Lock

In scope:
- UX hierarchy and task clarity
- UI visual system and consistency
- Responsive behavior (mobile/tablet/desktop)
- Accessibility (focus visibility, contrast, touch targets)
- Motion and feedback polish

Out of scope:
- New features
- Business rule changes
- API contract changes
- Route/permission logic changes
- Data model changes

## 3) Golden Constraints

1. v22.6.7 baseline remains frozen.
2. Every layout change must improve at least one outcome:
- faster task execution
- clearer decision making
- easier interaction
3. No change enters without explicit before/after UX justification.
4. Mobile first for technician is mandatory.

## 4) Execution Order

### Phase A - Technician (100% mobile first)
Primary goal:
- a technician can work a full shift with minimal cognitive friction.

Priority UX outcomes:
- critical actions always reachable with thumb
- less text, stronger hierarchy
- one-touch check-in/check-out priority
- water readings and photos become immediate actions
- problems and interruptions always visible

### Phase B - Administrator
Order:
1. Desktop
2. Tablet
3. Mobile

Primary goal:
- operational state of the company is visible in seconds.

Priority UX outcomes:
- command-center information hierarchy
- critical alerts at top
- fast scan blocks: finance, active technicians, pending pools, incidents, approvals
- contextual AI assistant access without visual clutter

### Phase C - Client
Targets:
- Desktop + Mobile

Primary goal:
- reduce portal to essential trust and self-service actions.

Mandatory surface:
- next visit
- history
- photos
- reports
- invoices
- requests

## 5) UX-First Workflow (before visual styling)

For each screen, answer first:
1. What is the first thing the user wants to do?
2. How many taps/clicks are required now?
3. Can it be done with fewer taps/clicks?
4. Is the right action always visible at the right moment?
5. On mobile, does the thumb reach key controls naturally?

Only after these answers:
- apply visual styling
- apply animation
- apply polish

## 6) Non-Behavior Regression Contract

For each modified screen:
- keep existing route
- keep existing API calls
- keep existing action semantics
- keep existing permissions
- keep existing validation effects

Verification method:
- compare event/action handlers before and after
- run relevant operational tests after UI updates
- reject any diff that changes behavior unintentionally

## 7) Acceptance Metrics Per Task

Each changed user task must include measurable before/after values:
- interaction count (clicks/taps)
- time to first meaningful action
- time to complete core task
- visible error/confusion points

Target deltas:
- reduce interaction count where possible
- reduce time-to-action
- remove dead-end or ambiguous actions

## 8) Definition of Done (Layout V23)

A screen is done only when:
1. Behavior is unchanged.
2. Core task is faster, clearer, or easier.
3. Responsive behavior is validated on target breakpoints.
4. Accessibility essentials pass:
- keyboard focus visibility
- touch target size
- readable contrast
5. Visual consistency aligns with Crystal OS design language.

## 9) Immediate Work Package

WP1 - Technician field mode:
- map top 8 technician tasks
- capture before metrics (taps/time)
- redesign interaction hierarchy without behavior changes
- validate mobile ergonomics first

WP2 - Admin command center:
- define critical-above-the-fold hierarchy
- reduce dashboard scan time
- preserve all existing operational actions

WP3 - Client portal simplification:
- reduce noise and non-essential blocks
- keep only high-confidence, high-frequency tasks

## 10) Release Discipline for Layout V23

- commit small and auditable slices
- document UX rationale in each slice
- keep production freeze of v22.6.7 intact
- if a change requires behavior modification, move it to next version backlog
