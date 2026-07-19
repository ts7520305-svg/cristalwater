# CRYSTAL REBUILD MASTERPLAN

Mission ID: CRYSTAL-OS-V2-AUDIT
Date: 2026-07-11
Scope: Complete implementation plan only. No code changes.

## Guiding Constraints

Non-negotiable:
- Preserve backend
- Preserve APIs
- Preserve Prisma
- Preserve business logic
- Preserve permissions model

Delivery model:
- One UX phase at a time
- Validate each phase before moving
- No self-approval

## Target Architecture

Frontend target structure:
1. One global shell system with role variants
2. One navigation system (desktop/tablet/mobile behaviors defined centrally)
3. One token system (color/typography/spacing/motion)
4. One component library (buttons, cards, forms, tables, dialogs)
5. Role experiences built from same primitives

## Phase Plan

### Phase 1 - Foundation Baseline
Goals:
- Freeze current frontend map and route inventory
- Define canonical route naming policy
- Define deprecation list for wrapper pages
Outputs:
- route map
- deprecation map
- baseline screenshot set
Validation:
- node --check
- npm test
- npm run smoke
- node scripts/test-operational-flow.js

### Phase 2 - Global Shell
Goals:
- Implement single shell contract
- Standardize header, role identity, context line, global actions
- Remove runtime shell collisions
Outputs:
- shell spec
- shell components
Validation:
- compile/test/smoke set
- visual QA desktop/tablet/mobile

### Phase 3 - Navigation System
Goals:
- Define unified nav IA with max 3 levels
- Implement universal search and command palette contracts
- Eliminate legacy /frontend route links
Outputs:
- nav map per role
- migration checklist by page
Validation:
- route continuity tests
- keyboard navigation test

### Phase 4 - Typography and Design Tokens
Goals:
- Establish one type scale and spacing scale
- Enforce semantic color token set (success/warn/danger/info)
Outputs:
- token files
- typography spec
Validation:
- contrast checks
- visual diff pass

### Phase 5 - Component Library Stabilization
Goals:
- Standardize buttons, inputs, selects, textareas, cards, tables, dialogs
- Replace page-local component clones
Outputs:
- component docs
- migration matrix
Validation:
- component regression checklist

### Phase 6 - Technician Experience (highest priority)
Goals:
- Single field cockpit
- one-hand interaction model
- huge touch targets, low text, high contrast
Outputs:
- unified technician shell
- route/map/visit/products/photos/repair completion flow
Validation:
- outdoor readability checklist
- mobile first acceptance tests

### Phase 7 - Admin Command Center
Goals:
- one canonical operations home
- 5-7 actionable cards max
- contextual drilldowns
Outputs:
- merged dashboard/command center
- action contract per card
Validation:
- click-depth audit (max 2 for daily tasks)

### Phase 8 - Secretary Speed Desk
Goals:
- keyboard-first command workflow
- fast customer/scheduling/invoice workflows
Outputs:
- secretary shell and quick actions
Validation:
- keyboard-only task runbook

### Phase 9 - Customer Premium Experience
Goals:
- one premium customer home
- service timeline + payments + notifications in one hierarchy
Outputs:
- merged customer entrypoint
Validation:
- mobile/tablet readability and conversion flow checks

### Phase 10 - Remaining Modules Consolidation
Goals:
- align long-tail modules (reports/settings/support/maps)
- remove obsolete/prototype artifacts from runtime path
Outputs:
- final migration closure report
Validation:
- full smoke + regression pack

## Risk Controls

1. Feature flag per phase and role scope.
2. Legacy fallback route list for phased rollout.
3. Visual regression snapshots at each phase gate.
4. Explicit route parity checklist before removing legacy pages.

## Acceptance Criteria for Each Phase

Mandatory before phase close:
1. Compilation/syntax pass
2. npm test pass
3. npm run smoke pass
4. node scripts/test-operational-flow.js pass
5. Device QA pass (desktop/tablet/mobile)
6. CTO sign-off

Status: Master rebuild plan complete. Waiting CTO approval.
