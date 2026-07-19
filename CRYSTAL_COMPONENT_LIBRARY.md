# CRYSTAL COMPONENT LIBRARY

Mission ID: UX-REBUILD-MASTER
Status: Strategy only. No implementation.

## Goal
Define one reusable component system across Admin, Secretary, Technician, and Customer surfaces.

## Core Component Families

## 1) Shell Components
- App Shell (top bar + domain nav + context rail)
- Role Header (role indicator + mode)
- Breadcrumb + location marker
- Command palette entry

## 2) Priority Components
- Actionable Command Card (mandatory click target)
- Priority Queue Item
- Critical Banner
- SLA Timer Badge
- Ownership Chip

## 3) Data Components
- KPI Tile (must link to workflow)
- Status Matrix
- Evidence Strip (photos/documents)
- Timeline Feed (events + decisions)

## 4) Form Components
- Quick Create Form
- Inline Validation Field
- Step Form (max 3 steps)
- Voice-ready Input Trigger (technician)

## 5) Coordination Components
- Assignment Panel
- Reassignment Drawer
- Escalation Dialog
- Broadcast Composer

## 6) Customer Trust Components
- Service Summary Card
- Visit Schedule Card
- Invoice + Payment Card
- Message Thread

## 7) Technician Field Components
- Current Job Hero
- Next Task Block
- Big Action Button (56px+)
- Checklist Toggle Tile
- Product/Tool Requirement Tile
- Capture Proof Panel (photo/video)
- Offline Sync Status Bar

## Component Behavior Standards
- Every interactive card is clickable.
- Hover, focus, active, disabled states are mandatory.
- Empty/loading/error states are mandatory.
- Destructive actions require explicit confirmation with object naming.

## Card Taxonomy
- Primary card:
  - one dominant action
  - highest contrast in section
- Secondary card:
  - supportive task
- Informational card:
  - non-blocking context only

## Button Hierarchy
- Primary: exactly one per section.
- Secondary: supportive actions.
- Tertiary: low-emphasis links/actions.
- Danger: destructive only.

## Table and List Policy
- Lists default to actionable rows.
- Dense tables only when expert mode is enabled.
- First column always communicates object identity.
- Last column always communicates next action.

## Notification Components
- P1 Critical Toast/Banner with owner + deadline.
- P2 Urgent banner inline in workflow.
- P3 informational feed item.

## Accessibility Rules
- Focus-visible ring on all interactive components.
- Keyboard navigation path must be deterministic.
- Touch-safe spacing in all mobile contexts.
- Status never conveyed by color alone.

## Role Overrides
- Technician: larger controls, fewer concurrent controls, reduced text input.
- Customer: cleaner cards, premium spacing, reduced operational jargon.
- Admin/Secretary: denser than customer, but still action-first.

## Component Governance
- New component requires:
  - role use case
  - semantic states
  - token usage
  - accessibility notes
  - anti-abuse constraints
